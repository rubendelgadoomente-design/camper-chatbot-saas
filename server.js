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

client.on('message', async (msg) => {
    if (msg.type !== 'chat' || msg.fromMe) return;
    
    const chat = await msg.getChat();
    if (chat.isGroup) return;

    const from = msg.from.split('@')[0];
    const body = msg.body.trim();

    addLog(from, body, 'user');

    // --- COMANDOS DE ADMINISTRADOR ---
    if (body.startsWith('/')) {
        const command = body.split(' ')[0].toLowerCase();
        
        if (command === '/pausa') {
            isAIActive = false;
            return msg.reply('⏸️ Asistente IA pausado por el administrador.');
        }
        if (command === '/activa') {
            isAIActive = true;
            return msg.reply('▶️ Asistente IA reactivado.');
        }
        if (command === '/status') {
            return msg.reply(`🤖 *Estado del Bot*:\n- IA Activa: ${isAIActive ? 'SÍ' : 'NO'}\n- Status: ${botStatus}\n- Uptime: ${Math.floor(process.uptime() / 60)} min`);
        }
        if (command === '/ayuda') {
            return msg.reply('🛠️ *Comandos Admin*:\n/status - Ver estado\n/pausa - Pausar IA\n/activa - Activar IA\n/resena [num] - Enviar link reseña');
        }
        // El comando /resena ya existía, lo mantenemos:
        if (command === '/resena') {
            const parts = body.split(' ');
            if (parts.length < 2) return msg.reply('Uso: /resena [numero]');
            const target = parts[1].includes('@') ? parts[1] : `${parts[1]}@c.us`;
            const msgReview = `¡Hola! Gracias por confiar en nosotros. Si te ha gustado la experiencia, ¿podrías dejarnos una reseña? 👉 [LINK]`;
            await client.sendMessage(target, msgReview);
            return msg.reply('✅ Reseña enviada.');
        }
    }

    // --- PROCESAMIENTO IA ---
    if (isAIActive) {
        try {
            const aiResponse = await processMessageAI(body);
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

app.get('/api/status', (req, res) => {
    res.json({ 
        status: botStatus, 
        isAIActive,
        hasQR: !!lastQR 
    });
});

app.get('/api/logs', (req, res) => {
    res.json(logs);
});

// Mantener la ruta original para pruebas manuales si se desea
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    const response = await processMessageAI(message);
    res.json({ response });
});

app.listen(PORT, () => {
    console.log(`🚀 Dashboard en http://localhost:${PORT}`);
});
