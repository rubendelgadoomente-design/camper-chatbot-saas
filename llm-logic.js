const { OpenAI, toFile } = require("openai");
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

// POLYFILL PARA NODE 18: OpenAI necesita 'File' global.
if (typeof globalThis.File === 'undefined') {
    globalThis.File = class File extends Blob {
        constructor(bits, name, options = {}) {
            super(bits, options);
            this.name = name;
        }
    };
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "TU_CLAVE_AQUI",
});

// BASE DE CONOCIMIENTO (Cargada desde system-prompt.txt - Manual Completo v2)
let SYSTEM_PROMPT = '';
try {
    const fsSync = require('fs');
    SYSTEM_PROMPT = fsSync.readFileSync(path.join(__dirname, 'system-prompt.txt'), 'utf-8');
    console.log(`✅ System prompt cargado: ${SYSTEM_PROMPT.length} caracteres`);
} catch (err) {
    console.error('ERROR CRITICO: No se pudo cargar system-prompt.txt:', err.message);
    process.exit(1);
}

/**
 * Procesa un mensaje usando OpenAI con historial de conversación.
 * @param {string} userMessage - El mensaje actual del usuario.
 * @param {Array} history - Historial previo [{role: 'user', content: '...'}, ...]
 */
async function processMessageAI(userMessage, history = []) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "TU_CLAVE_AQUI") {
        return {
            response: "⚠️ Configurador: Falta la clave de OpenAI (OPENAI_API_KEY). Por favor, contacta con soporte.",
            category: "OTROS"
        };
    }

    try {
        // Construir el array de mensajes para OpenAI (System + Historial + Mensaje Actual)
        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...history,
            { role: "user", content: userMessage }
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            temperature: 0.3, // Más conservador para respuestas técnicas consistentes
            max_tokens: 500   // Respuestas concisas pero con margen para pasos técnicos
        });

        let reply = completion.choices[0].message.content;

        if (!reply) throw new Error("Respuesta vacía de OpenAI");

        // Extraer categoría de los corchetes [CATEGORIA] (soporta guion bajo para PRIMEROS_PASOS etc.)
        const categoryMatch = reply.match(/\[([A-Z_]+)\]/);
        const category = categoryMatch ? categoryMatch[1].toLowerCase() : "otros";

        // Limpiar la respuesta para el usuario (quitar la etiqueta)
        reply = reply.replace(/\[[A-Z_]+\]/, "").trim();

        return { response: reply, category: category };

    } catch (error) {
        console.error("Error en OpenAI Logic:", error.message);

        return {
            response: "Lo siento, ha habido un problema técnico con mi 'cerebro' de IA. ¿Puedo ayudarte con lo básico (agua, luz, gas) mediante el manual impreso mientras me recupero?",
            category: "OTROS"
        };
    }
}

/**
 * Transcribe un buffer de audio (nota de voz de WhatsApp) a texto usando Whisper.
 * @param {Buffer} audioBuffer - El buffer binario del audio descargado(.ogg)
 */
async function transcribeAudio(audioBuffer) {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "TU_CLAVE_AQUI") {
        return "⚠️ Sin API KEY para procesar audios.";
    }

    try {
        // Usamos toFile de OpenAI directamente sobre el Buffer en RAM, 
        // evitando tocar el disco duro y evitando el error de 'globalThis.File'
        const audioFile = await toFile(audioBuffer, 'audio.ogg', { type: 'audio/ogg' });

        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
        });

        // Ya no necesitamos fs.unlink porque no guardamos en disco
        return transcription.text;
    } catch (error) {
        console.error("Error en Transcripción de Audio:", error);
        throw error;
    }
}

module.exports = { processMessageAI, transcribeAudio };

