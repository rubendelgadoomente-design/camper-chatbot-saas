/**
 * server-meta.js â€” Servidor definitivo de CamperBot con Meta Cloud API
 * 
 * SIN Chrome, SIN Puppeteer, SIN WebSocket, SIN sesiones frÃ¡giles.
 * Recibe mensajes via webhook de Meta, responde via REST API.
 * ~30MB de RAM. Estabilidad total.
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { processMessageAI, transcribeAudio } = require('./llm-logic');
const db = require('./database');
const whatsapp = require('./whatsapp-meta');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURACIÃ“N DE ESTADO Y LOGS ---
let logs = [];
let isAIActive = true;

// Memoria de conversaciÃ³n por usuario (ID -> [mensajes])
const userContext = {};
const MAX_HISTORY = 10;

// Set para deduplicaciÃ³n de mensajes (evitar procesar el mismo mensaje 2 veces)
const processedMessages = new Set();
const MAX_PROCESSED_CACHE = 1000;

const addLog = (user, message, type = 'user') => {
    const timestamp = new Date().toLocaleTimeString();
    logs.unshift({ timestamp, user, message, type });
    if (logs.length > 50) logs.pop();
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${user} -> ${message}`);
};

/**
 * FunciÃ³n para enviar mensajes programados (Bienvenida / ReseÃ±a)
 */
const sendProactiveMessage = async (phone, message) => {
    try {
        await whatsapp.sendMessage(phone, message);
        addLog('SISTEMA', `Mensaje proactivo enviado a ${phone}`, 'ai');
    } catch (e) {
        console.error(`Error enviando mensaje proactivo a ${phone}:`, e);
    }
};

/**
 * Procesa un mensaje entrante (lÃ³gica de negocio del bot)
 */
async function handleMessage(msg) {
    console.log(`[DEBUG] Msg detectado: ${msg.from} -> ${msg.body} (Me: ${msg.fromMe})`);

    if (msg.type !== 'chat') return;

    let body = msg.body.trim();
    const from = msg.from; // NÃºmero limpio sin @

    // --- MANEJO DE AUDIO (NOTAS DE VOZ) ---
    if (msg.isAudio && msg.audioId) {
        console.log(`[DEBUG] Descargando y transcribiendo audio ${msg.audioId}...`);
        try {
            const audioBuffer = await whatsapp.downloadMedia(msg.audioId);
            body = await transcribeAudio(audioBuffer);
            console.log(`[DEBUG] Audio transcrito: "${body}"`);
            
            // Si hay error en la transcripción, enviamos un aviso y cortamos el flujo
            if (body.startsWith("⚠️")) {
                return whatsapp.sendMessage(from, body);
            }
        } catch (error) {
            console.error(`Error procesando nota de voz de ${from}:`, error);
            return whatsapp.sendMessage(from, `[DEBUG ERROR AUDIO] ${error.message} \nStack: ${error.stack ? error.stack.substring(0, 100) : ''}`);
        }
    }

    // Lista de administradores (tu número personal)
    const adminNumbers = ['34616063682'];
    const isAdmin = adminNumbers.includes(from);

    // --- COMANDOS DE ADMINISTRADOR ---
    if (isAdmin && body.startsWith('/')) {
        addLog('Admin', body, 'admin');

        const command = body.split(' ')[0].toLowerCase();

        if (command === '/pausa') {
            isAIActive = false;
            return whatsapp.sendMessage(from, 'â¸ï¸ Asistente IA pausado por el administrador.');
        }
        if (command === '/activa') {
            isAIActive = true;
            return whatsapp.sendMessage(from, 'â–¶ï¸ Asistente IA reactivado.');
        }
        if (command === '/resumen') {
            try {
                const stats = await db.getStats();
                let report = `ðŸ“Š *RESUMEN DE SOPORTE MENSUAL*\n\n`;
                report += `âœ… Consultas resueltas: ${stats.total_queries}\n`;
                report += `--------------------------\n`;
                Object.entries(stats.categories).forEach(([name, count]) => {
                    if (count > 0) {
                        const icon = name === 'wc' ? 'ðŸš½' : name === 'agua' ? 'ðŸ’§' : name === 'electricidad' ? 'âš¡' : 'ðŸ”§';
                        report += `${icon} ${name.toUpperCase()}: ${count}\n`;
                    }
                });
                return whatsapp.sendMessage(from, report);
            } catch (e) {
                return whatsapp.sendMessage(from, 'âŒ Error al generar el resumen.');
            }
        }
        if (command === '/status') {
            const metrics = whatsapp.getMetrics();
            const statusReport = `ðŸ¤– *Estado del Bot*:\n- IA Activa: ${isAIActive ? 'SÃ' : 'NO'}\n- API: ${metrics.status}\n- Mensajes IN: ${metrics.totalMessagesIn}\n- Mensajes OUT: ${metrics.totalMessagesOut}\n- Errores: ${metrics.totalErrors}\n- RAM: ${metrics.memory}\n- Uptime: ${metrics.uptime}`;
            return whatsapp.sendMessage(from, statusReport);
        }
        if (command === '/ayuda') {
            const helpMsg = 'ðŸ› ï¸ *Comandos Admin*:\n/status - Ver estado\n/pausa - Pausar IA\n/activa - Activar IA\n/resena [num] - Enviar link reseÃ±a\n/resumen - EstadÃ­sticas';
            return whatsapp.sendMessage(from, helpMsg);
        }
        if (command === '/resena') {
            const parts = body.split(' ');
            if (parts.length < 2) return whatsapp.sendMessage(from, 'Uso: /resena [numero]');
            const target = parts[1].replace(/[^0-9]/g, '');
            const msgReview = `¡Hola! Gracias por confiar en nosotros. Si te ha gustado la experiencia, ¿podrías dejarnos una reseña? 👉 https://g.page/r/YOUR_LINK/review`;
            await whatsapp.sendMessage(target, msgReview);
            return whatsapp.sendMessage(from, '✅ Reseña enviada.');
        }
        return;
    }

    // Ignorar mensajes propios (no deberÃ­a llegar por webhook, pero por seguridad)
    if (msg.fromMe) return;

    // Ignorar grupos
    if (msg.isGroup) return;

    addLog(from, body, 'user');

    // --- LÃ“GICA DE ACTIVACIÃ“N POR QR ---
    if (body.toUpperCase().includes('ACTIVAR MI VIAJE')) {
        try {
            const rentals = await db.getRentals();
            const rental = rentals.find(r => r.phone === from && r.status === 'active');

            if (rental) {
                await db.updateRental(rental.id, {
                    activated: true,
                    welcome_sent: true
                });

                const welcomeMsg = `¡Hola ${rental.client_name}! 👋 Has activado correctamente tu asistente de viaje. Soy una IA experta en tu camper y estoy aquí 24h para ayudarte. ¿Tienes alguna duda técnica ahora mismo?`;
                return whatsapp.sendInteractiveButtons(from, welcomeMsg, [
                    { id: 'btn_agua', title: '💧 Agua / Poti' },
                    { id: 'btn_luz', title: '⚡ Luz / Nevera' },
                    { id: 'btn_otros', title: '🔧 Otras dudas' }
                ]);
            } else {
                return whatsapp.sendMessage(from, "¡Hola! 🚐 Para activar tu asistencia, asegúrate de que la empresa de alquiler ha registrado tu número correctamente.");
            }
        } catch (e) {
            console.error("Error en activación:", e);
        }
    }

    // --- PROCESAMIENTO IA ---
    if (isAIActive) {
        try {
            if (!userContext[from]) userContext[from] = [];
            const history = userContext[from];

            const aiData = await processMessageAI(body, history);
            const aiResponse = aiData.response;
            const category = aiData.category;

            // Actualizar estadísticas
            db.incrementStat(category);

            // Marcar "problemas" en el alquiler si la duda es técnica
            try {
                const rentals = await db.getRentals();
                const currentRental = rentals.find(r => r.phone === from && r.status === 'active');
                if (currentRental && category !== 'otros' && category !== 'normativa') {
                    await db.updateRental(currentRental.id, { has_problems: true });
                }
            } catch (e) {}

            // Actualizar historial
            userContext[from].push({ role: 'user', content: body });
            userContext[from].push({ role: 'assistant', content: aiResponse });

            if (userContext[from].length > MAX_HISTORY) {
                userContext[from] = userContext[from].slice(-MAX_HISTORY);
            }

            await whatsapp.sendMessage(from, aiResponse);
            addLog('Asistente', aiResponse, 'ai');

            // --- INYECCIÓN DE MULTIMEDIA MVP ---
            const mediaCatalog = {
                'agua': { type: 'video', url: '', caption: '🎥 Videotutorial: Gestión de Aguas' }, // Dejar URL vacía hasta que las grabes
                'electricidad': { type: 'image', url: '', caption: '📸 Panel Eléctrico Principal' },
                'gas': { type: 'image', url: '', caption: '📸 Compartimento de Gas' },
                'wc': { type: 'video', url: '', caption: '🎥 Videotutorial: Uso del Poti' }
            };

            if (mediaCatalog[category] && mediaCatalog[category].url) {
                try {
                    await whatsapp.sendMediaByUrl(
                        from, 
                        mediaCatalog[category].type, 
                        mediaCatalog[category].url, 
                        mediaCatalog[category].caption
                    );
                    addLog('Asistente', `[Media Enviado: ${category}]`, 'ai');
                } catch (e) {
                    console.error("Fallo enviando multimedia adjunto:", e);
                }
            }
        } catch (error) {
            console.error('Error IA:', error);
        }
    } else {
        console.log(`🔇 IA pausada, ignorando mensaje de ${from}`);
    }
}

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================
// WEBHOOK de META — Recepción de mensajes de WhatsApp
// =====================================================

/**
 * GET /webhook — Verificación del webhook (Meta envía un challenge)
 * Se usa UNA sola vez cuando configuras el webhook en Meta Developers
 */
app.get('/webhook', (req, res) => {
    const result = whatsapp.verifyWebhook(req.query);
    if (result.success) {
        res.status(200).send(result.challenge);
    } else {
        res.sendStatus(403);
    }
});

/**
 * POST /webhook — Recepción de mensajes entrantes
 * Meta envía cada mensaje aquí como un POST con JSON
 */
app.post('/webhook', async (req, res) => {
    // IMPORTANTE: Responder 200 inmediatamente para que Meta no reintente
    res.sendStatus(200);

    try {
        const msg = whatsapp.parseIncomingWebhook(req.body);

        if (!msg) return; // No es un mensaje de texto (status update, etc.)

        // --- DEDUPLICACIÓN (evitar procesar el mismo mensaje 2 veces) ---
        if (processedMessages.has(msg.messageId)) {
            console.log(`[Webhook] Mensaje duplicado ignorado: ${msg.messageId}`);
            return;
        }
        processedMessages.add(msg.messageId);

        // Limpiar cache de deduplicación si crece demasiado
        if (processedMessages.size > MAX_PROCESSED_CACHE) {
            const entries = Array.from(processedMessages);
            entries.slice(0, entries.length - 500).forEach(id => processedMessages.delete(id));
        }

        // Procesar el mensaje
        await handleMessage(msg);

    } catch (error) {
        console.error('[Webhook] Error procesando mensaje:', error);
    }
});

// =====================================================
// RUTAS DE NAVEGACIÓN Y API
// =====================================================

app.get('/monitor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'monitor.html'));
});

app.get('/api/status', (req, res) => {
    const status = whatsapp.getStatus();
    res.json({
        status: status.status,
        isAIActive,
        hasQR: false, // Meta Cloud API nunca necesita QR
        reconnectAttempts: 0
    });
});

app.post('/api/rentals', async (req, res) => {
    const name = req.body.client_name || req.body.name;
    let phone = req.body.phone;
    const endDate = req.body.end_date || req.body.endDate;
    const reviewLink = req.body.review_link || req.body.reviewLink;

    if (!name || !phone || !endDate) {
        return res.status(400).json({ error: 'Datos incompletos. Se requiere nombre, teléfono y fecha.' });
    }

    phone = phone.replace(/\D/g, '');

    let finalDate = endDate;
    if (endDate.includes('/')) {
        const parts = endDate.split('/');
        if (parts[0].length === 2) {
            finalDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }

    try {
        const newRental = {
            client_name: name,
            name: name,
            phone: phone,
            end_date: finalDate,
            endDate: finalDate,
            review_link: reviewLink || '',
            reviewLink: reviewLink || '',
            status: 'active',
            has_problems: false,
            welcome_sent: false,
            activated: false,
            review_sent: false
        };

        await db.saveRental(newRental);
        res.json({ success: true, message: 'Alquiler registrado correctamente.' });
    } catch (e) {
        console.error('❌ ERROR TÉCNICO EN REGISTRO:', e);
        res.status(500).json({ error: 'Fallo al guardar alquiler', details: e.message });
    }
});

/**
 * Tarea de fondo: Comprobar finales de alquiler (Review Request)
 */
setInterval(async () => {
    console.log('[SISTEMA] Comprobando finales de alquiler (solo activados)...');
    const today = new Date().toISOString().split('T')[0];

    try {
        const rentals = await db.getRentals();
        const activeRentals = rentals.filter(r => r.status === 'active' && r.end_date === today && r.activated && !r.review_sent);

        for (const rental of activeRentals) {
            if (!rental.has_problems) {
                const reviewMsg = `¡Hola ${rental.client_name}! Esperamos que tu experiencia haya sido increíble. 🚐 ¿Podrías dedicarnos 1 minuto para dejarnos una reseña? Nos ayuda muchísimo: ${rental.review_link || 'https://g.page/r/YOUR_LINK/review'}`;
                await sendProactiveMessage(rental.phone, reviewMsg);
                await db.updateRental(rental.id, {
                    review_sent: true,
                    status: 'completed'
                });
            } else {
                console.log(`[SISTEMA] Saltando reseÃ±a para ${rental.phone} por problemas tÃ©cnicos detectados.`);
                await db.updateRental(rental.id, { status: 'completed_no_review' });
            }
        }
    } catch (e) {
        console.error('Error en tarea programada:', e);
    }
}, 3600000);

app.get('/api/logs', (req, res) => res.json(logs));
app.get('/api/is-ai-active', (req, res) => res.json({ active: isAIActive }));

// --- CHAT WEB (PROBADOR AI) ---
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje vacÃ­o' });

    try {
        if (!userContext['web-tester']) userContext['web-tester'] = [];
        const history = userContext['web-tester'];

        const aiData = await processMessageAI(message, history);

        userContext['web-tester'].push({ role: 'user', content: message });
        userContext['web-tester'].push({ role: 'assistant', content: aiData.response });

        if (userContext['web-tester'].length > MAX_HISTORY) {
            userContext['web-tester'] = userContext['web-tester'].slice(-MAX_HISTORY);
        }

        addLog('Web Tester', message, 'user');
        addLog('Asistente (Web)', aiData.response, 'ai');
        res.json({ response: aiData.response });
    } catch (error) {
        console.error('Error en Chat Web:', error);
        res.status(500).json({ error: 'Fallo al procesar IA' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const stats = await db.getStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: 'Fallo al leer estadÃ­sticas' });
    }
});

// --- HEALTH CHECK + MÃ‰TRICAS ---
app.get('/api/health', (req, res) => {
    const metrics = whatsapp.getMetrics();
    res.status(metrics.healthy ? 200 : 503).json(metrics);
});

app.get('/api/metrics', (req, res) => {
    const metrics = whatsapp.getMetrics();
    res.json({
        ...metrics,
        isAIActive,
        logsCount: logs.length,
        activeConversations: Object.keys(userContext).length,
        processedMessages: processedMessages.size
    });
});

app.listen(PORT, '0.0.0.0', () => {
    const status = whatsapp.getStatus();
    console.log(`ðŸš€ Dashboard en http://localhost:${PORT}`);
    console.log(`ðŸ“¡ Webhook en http://localhost:${PORT}/webhook`);
    console.log(`ðŸ“Š API Status: ${status.status}`);
    if (!status.isConfigured) {
        console.log('âš ï¸  Configura WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID en .env');
    }
});

process.on('uncaughtException', (err) => { console.error('🔥 CRITICAL ERROR:', err); });
process.on('unhandledRejection', (reason, promise) => { console.error('🔥 UNHANDLED REJECTION:', reason); });