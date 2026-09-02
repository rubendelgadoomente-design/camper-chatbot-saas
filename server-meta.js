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
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { processMessageAI, transcribeAudio } = require('./llm-logic');
const db = require('./database');
const whatsapp = require('./whatsapp-meta');

const app = express();
const PORT = process.env.PORT || 3001;

// --- AUTENTICACIÓN Y SESIONES ---
const DASHBOARD_USER = process.env.DASHBOARD_USER || 'admin';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'camperbot2026';

app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'camperbot-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Railway termina SSL en el proxy, Express ve HTTP
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Páginas y rutas protegidas (requieren login)
const PROTECTED_PAGES = ['/monitor.html', '/stats.html', '/registro.html'];
const PROTECTED_API = ['/api/logs', '/api/stats', '/api/feedback', '/api/metrics', '/api/rentals'];

// Middleware: redirigir a login si no hay sesión activa
const requireAuth = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        return next();
    }
    // Si es una petición API, devolver 401
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'No autenticado. Inicia sesión en /login.html' });
    }
    // Si es una página HTML, redirigir al login
    return res.redirect('/login.html');
};

// Aplicar protección a las páginas del dashboard
PROTECTED_PAGES.forEach(page => {
    app.get(page, requireAuth, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', page));
    });
});

// Login endpoint
app.post('/api/login', express.json(), (req, res) => {
    const { username, password } = req.body;
    if (username === DASHBOARD_USER && password === DASHBOARD_PASSWORD) {
        req.session.authenticated = true;
        req.session.user = username;
        console.log(`🔑 Login exitoso: ${username}`);
        return res.json({ success: true, redirect: '/monitor.html' });
    }
    console.log(`🚫 Login fallido: ${username}`);
    return res.status(401).json({ error: 'Credenciales inválidas' });
});

// Logout endpoint
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

// --- CONFIGURACIÃ“N DE ESTADO Y LOGS ---
let logs = [];
let isAIActive = true;

// Memoria de conversación por usuario (ID -> [mensajes])
const userContext = {};
const MAX_HISTORY = 10;

// Set para deduplicación de mensajes (evitar procesar el mismo mensaje 2 veces)
const processedMessages = new Set();
const MAX_PROCESSED_CACHE = 1000;

// Estado de feedback por usuario (para capturar puntuación y comentarios)
// Posibles estados: null, 'awaiting_rating', 'awaiting_comment'
const feedbackState = {};
const lastCategory = {}; // Última categoría detectada por usuario

const addLog = (user, message, type = 'user') => {
    const timestamp = new Date().toLocaleTimeString();
    logs.unshift({ timestamp, user, message, type });
    if (logs.length > 50) logs.pop();
    console.log(`[${timestamp}] ${type.toUpperCase()}: ${user} -> ${message}`);
};

/**
 * Función para enviar mensajes programados (Bienvenida / Reseña)
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
 * Procesa un mensaje entrante (lógica de negocio del bot)
 */
async function handleMessage(msg) {
    console.log(`[DEBUG] Msg detectado: ${msg.from} -> ${msg.body} (Me: ${msg.fromMe})`);

    if (msg.type !== 'chat') return;

    let body = msg.body.trim();
    const from = msg.from; // Número limpio sin @

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
            return whatsapp.sendMessage(from, "Lo siento, no he podido escuchar bien la nota de voz. ¿Puedes escribírmelo de momento? 🎙️➡️📝");
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
            return whatsapp.sendMessage(from, '⏸️ Asistente IA pausado por el administrador.');
        }
        if (command === '/activa') {
            isAIActive = true;
            return whatsapp.sendMessage(from, '▶️ Asistente IA reactivado.');
        }
        if (command === '/resumen') {
            try {
                const stats = await db.getStats();
                let report = `📊 *RESUMEN DE SOPORTE MENSUAL*\n\n`;
                report += `✅ Consultas resueltas: ${stats.total_queries}\n`;
                report += `--------------------------\n`;
                Object.entries(stats.categories).forEach(([name, count]) => {
                    if (count > 0) {
                        const icon = name === 'wc' ? '🚽' : name === 'agua' ? '💧' : name === 'electricidad' ? '⚡' : '🔧';
                        report += `${icon} ${name.toUpperCase()}: ${count}\n`;
                    }
                });
                return whatsapp.sendMessage(from, report);
            } catch (e) {
                return whatsapp.sendMessage(from, '❌ Error al generar el resumen.');
            }
        }
        if (command === '/status') {
            const metrics = whatsapp.getMetrics();
            const statusReport = `🤖 *Estado del Bot*:\n- IA Activa: ${isAIActive ? 'Sí ' : 'NO'}\n- API: ${metrics.status}\n- Mensajes IN: ${metrics.totalMessagesIn}\n- Mensajes OUT: ${metrics.totalMessagesOut}\n- Errores: ${metrics.totalErrors}\n- RAM: ${metrics.memory}\n- Uptime: ${metrics.uptime}`;
            return whatsapp.sendMessage(from, statusReport);
        }
        if (command === '/ayuda') {
            const helpMsg = '🛠️ *Comandos Admin*:\n/status - Ver estado\n/pausa - Pausar IA\n/activa - Activar IA\n/resena [num] - Enviar link reseña\n/resumen - Estadísticas\n/feedback - Ver resumen de valoraciones';
            return whatsapp.sendMessage(from, helpMsg);
        }
        if (command === '/feedback') {
            try {
                const summary = await db.getFeedbackSummary();
                if (summary.total === 0) {
                    return whatsapp.sendMessage(from, '📊 Aún no hay valoraciones registradas.');
                }
                let report = `⭐ *RESUMEN DE VALORACIONES*\n\n`;
                report += `📋 Total: ${summary.total} valoraciones\n`;
                report += `📊 Media: ${summary.average}/5\n`;
                report += `✅ Resueltos sin humano: ${summary.resolved_rate}\n`;
                report += `\n*Distribución:*\n`;
                for (let i = 5; i >= 1; i--) {
                    const count = summary.distribution[i] || 0;
                    const bar = '★'.repeat(count);
                    report += `${i}⭐: ${bar} (${count})\n`;
                }
                if (summary.recent.length > 0) {
                    report += `\n*Últimos comentarios:*\n`;
                    summary.recent.filter(f => f.comment).slice(0, 5).forEach(f => {
                        report += `- ${f.rating}⭐ "${f.comment}" (${new Date(f.created_at).toLocaleDateString()})\n`;
                    });
                }
                return whatsapp.sendMessage(from, report);
            } catch (e) {
                return whatsapp.sendMessage(from, '❌ Error al generar resumen de feedback.');
            }
        }
        if (command === '/resena') {
            const parts = body.split(' ');
            if (parts.length < 2) return whatsapp.sendMessage(from, 'Uso: /resena [numero]');
            const target = parts[1].replace(/[^0-9]/g, '');
            const reviewLink = process.env.REVIEW_LINK || 'https://g.page/r/YOUR_LINK/review';
            const msgReview = `¡Hola! Gracias por confiar en nosotros. Si te ha gustado la experiencia, ¿podrías dejarnos una reseña? 👉 ${reviewLink}`;
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

    // --- INTERCEPTAR FEEDBACK (antes de enviar a la IA) ---
    if (feedbackState[from] === 'awaiting_rating') {
        const rating = parseInt(body.trim());
        if (rating >= 1 && rating <= 5) {
            // Guardar la puntuación temporalmente
            feedbackState[from] = 'awaiting_comment';
            feedbackState[from + '_data'] = {
                phone: from,
                rating: rating,
                category: lastCategory[from] || 'otros',
                resolved_without_human: true
            };

            if (rating >= 4) {
                const reviewLink = process.env.REVIEW_LINK || '';
                let thankMsg = `¡Gracias! 🙌 Tu valoración de *${rating}/5* nos motiva mucho.`;
                if (reviewLink && reviewLink !== 'https://g.page/r/YOUR_LINK/review') {
                    thankMsg += `\n\nSi te apetece, nos encantaría que dejaras una reseña: ${reviewLink}`;
                }
                thankMsg += `\n\n¿Algún comentario adicional? (Escribe tu comentario o *"no"* para finalizar)`;
                await whatsapp.sendMessage(from, thankMsg);
            } else {
                await whatsapp.sendMessage(from, `Gracias por tu honestidad. Tu valoración de *${rating}/5* queda registrada.\n\n¿Puedes contarme brevemente qué podríamos mejorar? (Escribe tu comentario o *"no"* para finalizar)`);
            }
            addLog('Feedback', `${from} valoró: ${rating}/5`, 'feedback');
            return;
        }
        // Si no es un número 1-5, salimos del estado feedback y procesamos normalmente
        feedbackState[from] = null;
    }

    if (feedbackState[from] === 'awaiting_comment') {
        const feedbackData = feedbackState[from + '_data'];
        const comment = body.toLowerCase().trim() === 'no' ? '' : body.trim();
        feedbackData.comment = comment;

        try {
            await db.saveFeedback(feedbackData);
            addLog('Feedback', `${from} comentó: "${comment || '(sin comentario)'}" | Rating: ${feedbackData.rating}/5`, 'feedback');
        } catch (e) {
            console.error('Error guardando feedback:', e);
        }

        // Limpiar estado de feedback
        feedbackState[from] = null;
        delete feedbackState[from + '_data'];

        await whatsapp.sendMessage(from, '¡Registrado! Muchas gracias por tu tiempo. 😊 Si necesitas cualquier cosa durante tu viaje, aquí estaré 24h. ¡Buen viaje! 🚐');
        return;
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

            // Guardar la última categoría por usuario (para el feedback)
            if (category && category !== 'otros' && category !== 'bienvenida') {
                lastCategory[from] = category;
            }

            // Si la IA ha enviado un mensaje de FEEDBACK, activar el estado de espera
            if (category === 'feedback') {
                feedbackState[from] = 'awaiting_rating';
            }

            // Marcar "problemas" en el alquiler si la duda es técnica
            try {
                const rentals = await db.getRentals();
                const currentRental = rentals.find(r => r.phone === from && r.status === 'active');
                if (currentRental && category !== 'otros' && category !== 'normativa' && category !== 'bienvenida' && category !== 'feedback') {
                    await db.updateRental(currentRental.id, { has_problems: true });
                }
            } catch (e) { }

            // Actualizar historial
            userContext[from].push({ role: 'user', content: body });
            userContext[from].push({ role: 'assistant', content: aiResponse });

            if (userContext[from].length > MAX_HISTORY) {
                userContext[from] = userContext[from].slice(-MAX_HISTORY);
            }

            await whatsapp.sendMessage(from, aiResponse);
            addLog('Asistente', aiResponse, 'ai');

            // Send relevant image if available
            const visualCategories = ['agua', 'gas', 'electricidad', 'calefaccion', 'nevera', 'wc', 'conexion_camping'];
            if (visualCategories.includes(category)) {
                try {
                    const companyId = 'generic';
                    const image = await db.getImageForCategory(category, companyId);
                    if (image) {
                        await whatsapp.sendMediaByUrl(from, 'image', image.image_url, image.description);
                        addLog('Asistente', `🖼️ Imagen enviada: ${image.subcategory || category}`, 'ai');
                    }
                } catch (imgError) {
                    console.error('[IMG] Error enviando imagen:', imgError.message);
                    // Non-fatal: continue without image
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

app.post('/api/rentals', requireAuth, async (req, res) => {
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
                console.log(`[SISTEMA] Saltando reseña para ${rental.phone} por problemas técnicos detectados.`);
                await db.updateRental(rental.id, { status: 'completed_no_review' });
            }
        }

        // --- CUMPLIMIENTO RGPD / PRIVACIDAD ---
        // Eliminar datos personales (Nombre, Teléfono) 48 horas después del fin del alquiler
        const date2DaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const rentalsToAnonymize = rentals.filter(r => 
            r.phone !== 'ANONIMIZADO' && r.end_date <= date2DaysAgo
        );

        for (const r of rentalsToAnonymize) {
            console.log(`[RGPD] Anonimizando datos del alquiler ${r.id}...`);
            await db.updateRental(r.id, {
                client_name: 'Anónimo (RGPD)',
                name: 'Anónimo (RGPD)',
                phone: 'ANONIMIZADO',
                review_link: ''
            });
        }

    } catch (e) {
        console.error('Error en tarea programada:', e);
    }
}, 3600000);

app.get('/api/logs', requireAuth, (req, res) => res.json(logs));
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

app.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const stats = await db.getStats();
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: 'Fallo al leer estadísticas' });
    }
});

app.get('/api/feedback', requireAuth, async (req, res) => {
    try {
        const summary = await db.getFeedbackSummary();
        res.json(summary);
    } catch (e) {
        res.status(500).json({ error: 'Fallo al leer feedback' });
    }
});

// --- HEALTH CHECK + MÃ‰TRICAS ---
app.get('/api/health', (req, res) => {
    const metrics = whatsapp.getMetrics();
    res.status(metrics.healthy ? 200 : 503).json(metrics);
});

app.get('/api/metrics', requireAuth, (req, res) => {
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