require('dotenv').config();
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');
const qrcodeFile = require('qrcode');
const { processMessageAI } = require('./llm-logic');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURACIÓN DE ESTADO Y LOGS ---
let logs = [];
let botStatus = 'Desconectado'; // 'Desconectado', 'Esperando QR', 'Conectado'
let isAIActive = true;
let lastQR = null;

// Memoria de conversación por usuario (ID -> [mensajes])
const userContext = {}; 
const MAX_HISTORY = 10;

const addLog = (user, message, type = 'user') => {
    const timestamp = new Date().toLocaleTimeString();
    logs.unshift({ timestamp, user, message, type });
    if (logs.length > 50) logs.pop(); // Mantener solo los últimos 50
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${user} -> ${message}`);
};

// --- INICIALIZACIÓN DE WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', async (qr) => {
    botStatus = 'Esperando QR';
    lastQR = qr;
    const qrPath = path.join(__dirname, 'public', 'whatsapp-auth.png');
    await qrcodeFile.toFile(qrPath, qr, { width: 500 });
});

client.on('ready', () => {
    botStatus = 'Conectado';
    lastQR = null;
    console.log('✅ WhatsApp listo');
});

client.on('message_create', async (msg) => {
    // Debug Log para ver en Railway exactamente qué detecta el bot
    console.log(`[DEBUG] Msg detectado: ${msg.from} -> ${msg.body} (Me: ${msg.fromMe})`);

    if (msg.type !== 'chat') return;
    
    const body = msg.body.trim();
    const from = msg.from; // ID completo del chat
    
    // Lista de administradores permitidos (tu número personal)
    const adminNumbers = ['34616063682@c.us'];
    const isAdmin = msg.fromMe || adminNumbers.includes(from);

    // --- COMANDOS DE ADMINISTRADOR ---
    if (isAdmin && body.startsWith('/')) {
        addLog('Admin', body, 'admin');
        
        const command = body.split(' ')[0].toLowerCase();
        
        if (command === '/pausa') {
            isAIActive = false;
            return client.sendMessage(msg.from, '⏸️ Asistente IA pausado por el administrador.');
        }
        if (command === '/activa') {
            isAIActive = true;
            return client.sendMessage(msg.from, '▶️ Asistente IA reactivado.');
        }
        if (command === '/status') {
            const statusReport = `🤖 *Estado del Bot*:\n- IA Activa: ${isAIActive ? 'SÍ' : 'NO'}\n- Status: ${botStatus}\n- Uptime: ${Math.floor(process.uptime() / 60)} min`;
            return client.sendMessage(msg.from, statusReport);
        }
        if (command === '/ayuda') {
            const helpMsg = '🛠️ *Comandos Admin*:\n/status - Ver estado\n/pausa - Pausar IA\n/activa - Activar IA\n/resena [num] - Enviar link reseña';
            return client.sendMessage(msg.from, helpMsg);
        }
        if (command === '/resena') {
            const parts = body.split(' ');
            if (parts.length < 2) return msg.reply('Uso: /resena [numero]');
            const target = parts[1].includes('@') ? parts[1] : `${parts[1]}@c.us`;
            const msgReview = `¡Hola! Gracias por confiar en nosotros. Si te ha gustado la experiencia, ¿podrías dejarnos una reseña? 👉 [LINK]`;
            await client.sendMessage(target, msgReview);
            return msg.reply('✅ Reseña enviada.');
        }
        return; // Detener aquí para que no lo procese la IA
    }

    // Ignorar otros mensajes internos (no comandos)
    if (msg.fromMe) return;

    const chat = await msg.getChat();
    if (chat.isGroup) return;

    addLog(from, body, 'user');

    // --- PROCESAMIENTO IA ---
    if (isAIActive) {
        try {
            // Obtener o inicializar historial del usuario
            if (!userContext[from]) userContext[from] = [];
            
            const history = userContext[from];
            
            const aiResponse = await processMessageAI(body, history);
            
            // Actualizar historial (Usuario -> Asistente)
            userContext[from].push({ role: 'user', content: body });
            userContext[from].push({ role: 'assistant', content: aiResponse });
            
            // Mantener solo los últimos N mensajes para no saturar
            if (userContext[from].length > MAX_HISTORY) {
                userContext[from] = userContext[from].slice(-MAX_HISTORY);
            }

            await msg.reply(aiResponse);
            addLog('Asistente', aiResponse, 'ai');
        } catch (error) {
            console.error('Error IA:', error);
        }
    } else {
        console.log(`🔇 IA pausada, ignorando mensaje de ${from}`);
    }
});

client.initialize();

// --- RUTAS EXPRESS ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- RUTAS DE NAVEGACIÓN ---
app.get('/monitor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'monitor.html'));
});

app.get('/api/status', (req, res) => {
    res.json({ 
        status: botStatus, 
        isAIActive,
        hasQR: !!lastQR 
    });
});

app.get('/api/logs', (req, res) => res.json(logs));
app.get('/api/is-ai-active', (req, res) => res.json({ active: isAIActive }));

// --- NUEVO: ENDPOINT PARA CHAT WEB (PROBADOR AI) ---
app.post('/api/chat', express.json(), async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje vacío' });
    
    try {
        // Para el Web Tester usamos un ID genérico 'web-tester'
        if (!userContext['web-tester']) userContext['web-tester'] = [];
        const history = userContext['web-tester'];

        const aiResponse = await processMessageAI(message, history);
        
        userContext['web-tester'].push({ role: 'user', content: message });
        userContext['web-tester'].push({ role: 'assistant', content: aiResponse });
        
        if (userContext['web-tester'].length > MAX_HISTORY) {
            userContext['web-tester'] = userContext['web-tester'].slice(-MAX_HISTORY);
        }

        addLog('Web Tester', message, 'user');
        addLog('Asistente (Web)', aiResponse, 'ai');
        res.json({ response: aiResponse });
    } catch (error) {
        console.error('Error en Chat Web:', error);
        res.status(500).json({ error: 'Fallo al procesar IA' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Dashboard en http://localhost:${PORT}`);
});
