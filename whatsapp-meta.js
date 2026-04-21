/**
 * whatsapp-meta.js — Módulo de WhatsApp via Meta Cloud API
 * 
 * Solución DEFINITIVA: sin Chrome, sin WebSocket, sin sesiones frágiles.
 * Usa la API REST oficial de Meta para enviar mensajes.
 * Recibe mensajes via webhook HTTP (configurado en server.js).
 * 
 * Ventajas:
 * - 0 conexiones zombie (no hay conexión persistente)
 * - ~30MB de RAM
 * - 100% estabilidad (infraestructura de Meta)
 * - Sin QR code nunca más
 */

const https = require('https');

// --- CONFIGURACIÓN (desde .env) ---
const WHATSAPP_TOKEN = ('EAHuI94RyFmABRNQ5dXdEZBvHdbJmXWOWQITbA279mtn04APCZBOh2ql1ZAjRTpVyRvEQ7WlS2GdTCgrY1ZBV7FOVs1sQQ9NuWVkJ6smchLPhZCkvJkGnPvq4VuiJxMEp2BaPYyx273SZBs2sYSYzFPTSSfDJZCdViuEpn9vnUnlyvK1sPNsOpfIMF2V8zbOfqDlUwZDZD');
const PHONE_NUMBER_ID = ('1018983194639061');
const WEBHOOK_VERIFY_TOKEN = 'camperbot_verify_2026';
const API_VERSION = 'v19.0';

// --- MÉTRICAS ---
const metrics = {
    lastIncoming: null,
    lastOutgoingOk: null,
    lastError: null,
    consecutiveFailures: 0,
    totalMessagesIn: 0,
    totalMessagesOut: 0,
    totalErrors: 0,
    startTime: Date.now(),
};

/**
 * Envía un mensaje de texto via Meta Cloud API
 * @param {string} to — Número de teléfono (con código país, sin +)
 * @param {string} text — Texto del mensaje
 * @returns {Promise<boolean>}
 */
async function sendMessage(to, text) {
    // Limpiar el número: quitar @s.whatsapp.net, @c.us, espacios, +
    const cleanNumber = to
        .replace(/@s\.whatsapp\.net/g, '')
        .replace(/@c\.us/g, '')
        .replace(/@lid/g, '')
        .replace(/[^0-9]/g, '');

    const payload = JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'text',
        text: { 
            preview_url: true,
            body: text 
        }
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'graph.facebook.com',
            port: 443,
            path: `/${API_VERSION}/${PHONE_NUMBER_ID}/messages`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    // --- ÉXITO ---
                    metrics.lastOutgoingOk = Date.now();
                    metrics.totalMessagesOut++;
                    metrics.consecutiveFailures = 0;
                    console.log(`[Meta API] ✅ Mensaje enviado a ${cleanNumber}`);
                    resolve(true);
                } else {
                    // --- ERROR ---
                    metrics.lastError = Date.now();
                    metrics.consecutiveFailures++;
                    metrics.totalErrors++;
                    console.error(`[Meta API] ❌ Error ${res.statusCode}: ${data}`);
                    reject(new Error(`Meta API error ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            metrics.lastError = Date.now();
            metrics.consecutiveFailures++;
            metrics.totalErrors++;
            console.error('[Meta API] ❌ Error de red:', error.message);
            reject(error);
        });

        req.write(payload);
        req.end();
    });
}

/**
 * Envía un mensaje con reintentos (cola simple con backoff)
 */
async function sendMessageWithRetry(to, text, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await sendMessage(to, text);
        } catch (error) {
            if (attempt === maxRetries) {
                console.error(`[Meta API] 🔴 Falló tras ${maxRetries} intentos: ${to}`);
                throw error;
            }
            const delay = 1000 * Math.pow(2, attempt);
            console.log(`[Meta API] 🔄 Reintento ${attempt}/${maxRetries} en ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

/**
 * Obtiene la URL de descarga y descarga el binario del medio desde Meta API
 * @param {string} mediaId - ID del medio entrante
 * @returns {Promise<Buffer>} - Buffer del audio/imagen
 */
async function downloadMedia(mediaId) {
    // Paso 1: Obtener la URL del media
    const urlPayload = await new Promise((resolve, reject) => {
        const req = https.get({
            hostname: 'graph.facebook.com',
            path: `/${API_VERSION}/${mediaId}`,
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Meta Media API error ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
    });

    if (!urlPayload.url) throw new Error("No URL returned for media ID");

    // Paso 2: Descargar el buffer usando la URL
    return new Promise((resolve, reject) => {
        const req = https.get(urlPayload.url, {
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
        }, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Error downloading media binary: ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
    });
}

/**
 * Procesa el payload del webhook de Meta (mensaje entrante)
 * Extrae los datos relevantes y devuelve un objeto de mensaje normalizado
 * @param {object} body — Body del webhook POST
 * @returns {object|null} — Mensaje normalizado o null si no es soportado
 */
function parseIncomingWebhook(body) {
    try {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        if (!value || !value.messages || value.messages.length === 0) {
            return null; // No es un mensaje (puede ser un status update, read receipt, etc.)
        }

        const message = value.messages[0];
        const contact = value.contacts?.[0];

        // Procesamos texto, audio y botones interactivos
        if (message.type !== 'text' && message.type !== 'audio' && message.type !== 'interactive') {
            console.log(`[Meta API] Mensaje tipo '${message.type}' ignorado`);
            return null;
        }

        let extractedBody = '';
        if (message.type === 'text') extractedBody = message.text.body;
        if (message.type === 'interactive') extractedBody = message.interactive.button_reply?.title || message.interactive.list_reply?.title || '';

        // --- ACTUALIZAR MÉTRICAS ---
        metrics.lastIncoming = Date.now();
        metrics.totalMessagesIn++;

        return {
            from: message.from,
            body: extractedBody,
            audioId: message.type === 'audio' ? message.audio.id : null, 
            isAudio: message.type === 'audio',
            isInteractive: message.type === 'interactive',
            fromMe: false,
            type: 'chat',
            isGroup: false,                        // Cloud API no soporta grupos por defecto
            messageId: message.id,                 // ID único del mensaje
            timestamp: message.timestamp,          // Timestamp Unix
            contactName: contact?.profile?.name || contact?.wa_id || message.from,
            // Función reply compatible con la estructura anterior
            reply: async (text) => {
                await sendMessageWithRetry(message.from, text);
            },
            getChat: async () => ({ isGroup: false })
        };
    } catch (error) {
        console.error('[Meta API] Error parseando webhook:', error);
        return null;
    }
}

/**
 * Verifica el webhook de Meta (challenge de verificación)
 * Meta envía un GET con un challenge que debemos devolver
 */
function verifyWebhook(query) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
        console.log('[Meta API] ✅ Webhook verificado correctamente');
        return { success: true, challenge };
    } else {
        console.error('[Meta API] ❌ Verificación de webhook fallida');
        return { success: false };
    }
}

/**
 * Obtiene el estado y métricas del sistema
 */
function getStatus() {
    return {
        status: WHATSAPP_TOKEN ? 'Configurado' : 'Sin configurar',
        isConfigured: !!WHATSAPP_TOKEN && !!PHONE_NUMBER_ID
    };
}

function getMetrics() {
    const now = Date.now();
    return {
        status: WHATSAPP_TOKEN ? 'Conectado' : 'Sin configurar',
        healthy: !!WHATSAPP_TOKEN && !!PHONE_NUMBER_ID && metrics.consecutiveFailures < 5,
        debug_phone: PHONE_NUMBER_ID,
        debug_token_len: WHATSAPP_TOKEN.length,
        debug_token_hash: WHATSAPP_TOKEN.substring(0, 5) + '...' + WHATSAPP_TOKEN.substring(WHATSAPP_TOKEN.length - 5),
        lastIncoming: metrics.lastIncoming
            ? Math.round((now - metrics.lastIncoming) / 1000) + 's ago'
            : 'never',
        lastOutgoingOk: metrics.lastOutgoingOk
            ? Math.round((now - metrics.lastOutgoingOk) / 1000) + 's ago'
            : 'never',
        consecutiveFailures: metrics.consecutiveFailures,
        totalMessagesIn: metrics.totalMessagesIn,
        totalMessagesOut: metrics.totalMessagesOut,
        totalErrors: metrics.totalErrors,
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        uptime: Math.floor(process.uptime() / 60) + ' min'
    };
}

/**
 * Envía un mensaje con botones interactivos (Max 3 botones)
 * @param {string} to - Número destino
 * @param {string} text - Texto principal del mensaje
 * @param {Array<{id: string, title: string}>} buttons - Array de botones
 */
async function sendInteractiveButtons(to, text, buttons) {
    const cleanNumber = to.replace(/[^0-9]/g, '');

    const interactiveButtons = buttons.slice(0, 3).map(btn => ({
        type: 'reply',
        reply: { id: btn.id, title: btn.title.substring(0, 20) }
    }));

    const payload = JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: { text: text },
            action: { buttons: interactiveButtons }
        }
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'graph.facebook.com',
            port: 443,
            path: `/${API_VERSION}/${PHONE_NUMBER_ID}/messages`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`[Meta API] 🔘 Botones enviados a ${cleanNumber}`);
                    resolve(true);
                } else {
                    reject(new Error(`Meta API error ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

module.exports = {
    sendMessage: sendMessageWithRetry,
    sendInteractiveButtons,
    parseIncomingWebhook,
    verifyWebhook,
    getStatus,
    getMetrics,
    downloadMedia,
    WEBHOOK_VERIFY_TOKEN
};
