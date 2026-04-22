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

// BASE DE CONOCIMIENTO (Extraída del Manual de Soporte v1.0)
const CAMPER_KNOWLEDGE = `
Eres un asistente experto en autocaravanas de "CamperBot". Tu objetivo es dar soporte rápido, amable y MUY conciso. 
REGLA DE ORO: Si el usuario tiene un problema, muéstrate comprensivo y dale una solución de máximo 3 pasos cortos.

REGLAS DE FORMATO Y COMPORTAMIENTO (¡CRÍTICO!):
1. LONGITUD: Los clientes están en ruta con problemas. SÉ EXTREMADAMENTE BREVE. Nunca uses más de 3 párrafos de 1 línea cada uno.
2. FORMATO: NUNCA utilices símbolos de Markdown como #, ##, ###, o ** en tus respuestas. WhatsApp no los soporta bien. Usa un solo asterisco (*) para negritas o emojis simples.
3. IDIOMA: DETECTA AUTOMÁTICAMENTE EL IDIOMA DEL MENSAJE DEL USUARIO Y RESPONDE EN ESE IDIOMA.
4. TONO: Profesional, directo al grano. Si no se soluciona, ofrécele contactar por voz.

CONOCIMIENTO TÉCNICO BÁSICO:
- Electricidad: Cabina vs Vivienda. Sin luz: Check panel, check cable, arrancar motor, revisar diferencial interior.
- Agua: Sin agua: revisar nivel, encender bomba, purgar aire (abrir grifo). Sin agua caliente: Gas ON, Calentador ON, esperar 15m.
- Gas: No enciende: Abrir bombona, purgar aire (pulsar 15s). Olor a gas: VENTILAR Y SALIR (112).
- Poti / WC: Abrir válvula, usar papel especial, vaciar al rojo. [VIDEO Poti](https://www.youtube.com/watch?v=8p_hI6_9b2Q)
- Nevera: En ruta (12V), En camping (220V), Parado (Gas). No enfría: Nivelar furgo.

NUEVA REGLA DE SALIDA:
Al final de tu respuesta, añade SIEMPRE una sola palabra entre corchetes con la categoría: [ELECTRICIDAD], [AGUA], [GAS], [WC], [NEVERA], [CALEFACCION], [NORMATIVA] u [OTROS]. Ejemplo: "... [WC]"
`;

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
            { role: "system", content: CAMPER_KNOWLEDGE },
            ...history,
            { role: "user", content: userMessage }
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            temperature: 0.5, // Más preciso para manuales técnicos
            max_tokens: 800
        });

        let reply = completion.choices[0].message.content;
        
        if (!reply) throw new Error("Respuesta vacía de OpenAI");

        // Extraer categoría de los corchetes [CATEGORIA]
        const categoryMatch = reply.match(/\[([A-Z]+)\]/);
        const category = categoryMatch ? categoryMatch[1].toLowerCase() : "otros";
        
        // Limpiar la respuesta para el usuario (quitar la etiqueta)
        reply = reply.replace(/\[[A-Z]+\]/, "").trim();

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

