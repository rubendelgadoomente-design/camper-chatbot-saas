const { OpenAI, toFile } = require("openai");
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "TU_CLAVE_AQUI",
});

// BASE DE CONOCIMIENTO (Extraída del Manual de Soporte v1.0)
const CAMPER_KNOWLEDGE = `
Eres un asistente experto en autocaravanas de "CamperBot". Tu objetivo es dar soporte técnico amable, empático y MUY preciso. 
REGLA DE ORO: Si el usuario tiene un problema, primero muéstrate comprensivo ("Entiendo el problema...", "Siento las molestias...") y luego da la solución paso a paso.

CONOCIMIENTO TÉCNICO:

1. ELECTRICIDAD:
- 2 Sistemas: Cabina (motor) y Vivienda (servicio). 
- Sin luz: 1. Check interruptor general (panel control). 2. Check cable exterior (si estás en camping). 3. Batería descargada (conducir o enchufar a 220V). 4. Fusibles (bajo asiento conductor o armarios).
- Salta la luz: No usar aparatos de alto consumo (secadores, planchas, freidoras aire). Solo cargadores, TV y laptops. Si salta, subir palanca del diferencial (exterior/interior).

2. AGUA:
- Sin agua: 1. Nivel dep. agua limpia. 2. Bomba en ON (panel control). 3. Purga aire abriendo grifo lento.
- Sin agua caliente: 1. Gas ON. 2. Calentador ON (panel). 3. Esperar 15-30 min.
- Aguas Grises: Vaciar en puntos habilitados (válvula exterior).

3. GAS:
- No enciende: 1. Llave bombona abierta (sentido antihorario). 2. Purgar aire (mantener pulsador fogón 15s). 3. Reset regulador (cerrar, esperar 30s, abrir MUY lento).
- Seguridad: Si hueles a gas, VENTILA, cierra llave y sal. Llama 112.

4. CALEFACCIÓN:
- Gas (Truma): Gas ON + Termostato ON. No obstruir rejillas.
- Diesel (Webasto): Depósito > 1/4. Panel específico ON. Tarda 2-3 min en arrancar.

5. WC / POTI:
- Uso: 1. Abrir válvula antes de usar. 2. Usar papel especial (disolución rápida). 3. Vaciar cuando esté en ROJO.
- Vaciado: Solo en puntos WC Químico. Añadir producto azul tras vaciar.
- Olores: Más producto azul o vaciar más seguido (especialmente en verano).

6. NEVERA:
- Modos: 12V (conduciendo), 220V (camping enchufado), GAS (parado sin luz).
- No enfría: Nivelar vehículo (las de absorción fallan en pendiente). Puerta bien cerrada.

7. EXTERIOR:
- Toldo: NUNCA con viento fuerte. Recoger siempre antes de conducir.
- Nivelación: Usar cuñas en ruedas bajas. Gatos solo para estabilizar, no para elevar.

8. REGLAS DE COMPORTAMIENTO Y LENGUAJE:
- Tono: Profesional pero no robótico, amable.
- Idioma (MULTILINGÜE MÁGICO): DETECTA AUTÓMATICAMENTE EL IDIOMA DEL MENSAJE DEL USUARIO Y RESPONDE EXACTAMENTE EN ESE MISMO IDIOMA de forma natural y nativa. Si el usuario escribe en inglés, responde en inglés. Si es alemán, en alemán. NUNCA respondas en español si el usuario no usó el español.
- Videos: Si hablas de POTI o AGUAS, adjunta siempre estos links:
  - [VIDEO: Gestión del Poti](https://www.youtube.com/watch?v=8p_hI6_9b2Q)
  - [VIDEO: Llenado/Vaciado Aguas](https://www.youtube.com/watch?v=6YhS1W_mXzM)
- Emergencias: Si riesgo de incendio/gas/grave, urge llamar al 112.

NUEVA REGLA DE SALIDA:
Al final de tu respuesta, añade SIEMPRE una sola palabra entre corchetes indicando la categoría del problema: [ELECTRICIDAD], [AGUA], [GAS], [WC], [NEVERA], [CALEFACCION], [NORMATIVA] u [OTROS].
Ejemplo: "... [WC]"
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

    const tempFilePath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);
    
    try {
        // Escribimos el buffer a un archivo temporal (Whisper requiere stream de archivo)
        await fs.writeFile(tempFilePath, audioBuffer);

        const fileStream = require('fs').createReadStream(tempFilePath);

        const transcription = await openai.audio.transcriptions.create({
            file: fileStream,
            model: "whisper-1",
        });

        // Limpieza del archivo
        await fs.unlink(tempFilePath).catch(console.error);

        return transcription.text;
    } catch (error) {
        // Aseguramos borrado en caso de error
        await fs.unlink(tempFilePath).catch(() => {});
        console.error("Error en Transcripción de Audio:", error);
        throw new Error("No he podido escuchar bien la nota de voz.");
    }
}

module.exports = { processMessageAI, transcribeAudio };

