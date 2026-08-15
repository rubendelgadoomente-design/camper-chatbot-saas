const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs/promises');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error("Faltan credenciales de Supabase en el .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuración
const CHUNK_SIZE = 1000; // Caracteres por chunk aprox
const CHUNK_OVERLAP = 200; // Caracteres superpuestos para no cortar contexto

/**
 * Función sencilla para dividir texto en chunks con algo de solapamiento
 */
function chunkText(text, size, overlap) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + size));
        i += size - overlap;
    }
    return chunks;
}

async function uploadManual(filePath, companyId) {
    console.log(`Leyendo archivo: ${filePath}`);
    let content;
    try {
        const rawData = await fs.readFile(filePath);
        if (path.extname(filePath).toLowerCase() === '.pdf') {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(rawData);
            console.log(`   Páginas: ${data.numpages} | Caracteres extraídos: ${data.text.length}`);
            content = data.text;
        } else {
            content = rawData.toString('utf-8');
        }
    } catch (err) {
        console.error("Error al leer el archivo:", err.message);
        return;
    }

    console.log("Generando fragmentos (chunks)...");
    const chunks = chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);
    console.log(`Se generaron ${chunks.length} fragmentos.`);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Procesando chunk ${i + 1}/${chunks.length}...`);
        
        try {
            // Generar embedding
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: chunk,
                encoding_format: "float",
            });
            const embedding = embeddingResponse.data[0].embedding;

            // Insertar en Supabase
            const { error } = await supabase
                .from('knowledge_base')
                .insert({
                    company_id: companyId,
                    content: chunk,
                    embedding: embedding
                });

            if (error) {
                console.error(`Error guardando en Supabase (Chunk ${i + 1}):`, error.message);
            } else {
                console.log(`Chunk ${i + 1} guardado correctamente.`);
            }
        } catch (err) {
            console.error(`Error con OpenAI en Chunk ${i + 1}:`, err.message);
        }
    }
    
    console.log("¡Subida completada!");
}

// Uso desde la línea de comandos: node upload-knowledge.js <ruta_archivo> <company_id>
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log("Uso: node upload-knowledge.js <ruta_al_archivo_txt_o_pdf> <company_id>");
    process.exit(1);
}

const filePath = path.resolve(args[0]);
const companyId = args[1];

uploadManual(filePath, companyId);
