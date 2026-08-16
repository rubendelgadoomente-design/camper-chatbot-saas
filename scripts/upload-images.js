/**
 * Script para subir imágenes a Supabase Storage y registrarlas en image_library
 * Uso: node scripts/upload-images.js <ruta-imagen> <category> <subcategory> <description> [company_id]
 * Ejemplo: node scripts/upload-images.js ./fotos/deposito.jpg agua deposito_agua "Depósito de agua fresca" generic
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function uploadImage(imagePath, category, subcategory, description, companyId = 'generic') {
    console.log(`\n📸 Subiendo imagen: ${imagePath}`);
    
    const fileBuffer = await fs.readFile(imagePath);
    const fileName = `${companyId}/${category}/${subcategory}_${Date.now()}${path.extname(imagePath)}`;
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    // Upload to Supabase Storage
    const { data: storageData, error: storageError } = await supabase.storage
        .from('camperbot-images')
        .upload(fileName, fileBuffer, { contentType: mimeType, upsert: true });
    
    if (storageError) throw new Error(`Storage error: ${storageError.message}`);
    
    // Get public URL
    const { data: urlData } = supabase.storage
        .from('camperbot-images')
        .getPublicUrl(fileName);
    
    const publicUrl = urlData.publicUrl;
    console.log(`   ✅ URL pública: ${publicUrl}`);
    
    // Register in image_library table
    const { error: dbError } = await supabase
        .from('image_library')
        .upsert({ category, subcategory, description, image_url: publicUrl, company_id: companyId }, 
                { onConflict: 'subcategory,company_id' });
    
    if (dbError) throw new Error(`DB error: ${dbError.message}`);
    
    console.log(`   ✅ Registrada en base de datos`);
    return publicUrl;
}

// Main
const [,, imagePath, category, subcategory, description, companyId] = process.argv;
if (!imagePath || !category || !subcategory || !description) {
    console.log('Uso: node scripts/upload-images.js <imagen> <category> <subcategory> <description> [company_id]');
    console.log('Ejemplo: node scripts/upload-images.js foto.jpg agua deposito_agua "Depósito de agua" generic');
    process.exit(1);
}

uploadImage(imagePath, category, subcategory, description, companyId || 'generic')
    .then(url => console.log(`\n🎉 Imagen disponible en: ${url}`))
    .catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
