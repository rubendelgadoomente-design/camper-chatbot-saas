require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
async function uploadMedia(filePath, category, subcategory, description, companyId = 'generic') {
    const fileBuffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const fileName = `${companyId}/${category}/${subcategory}_${Date.now()}${ext}`;
    let mimeType = 'application/octet-stream';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.mp4') mimeType = 'video/mp4';
    
    await supabase.storage.from('camperbot-images').upload(fileName, fileBuffer, { contentType: mimeType, upsert: true });
    const { data: urlData } = supabase.storage.from('camperbot-images').getPublicUrl(fileName);
    
    const { error: dbError } = await supabase.from('image_library').insert({ category, subcategory, description, image_url: urlData.publicUrl, company_id: companyId });
    if (dbError) throw new Error(dbError.message);
    console.log(`✅ DB Insert OK: ${subcategory}`);
}
const [,, filePath, category, subcategory, description, companyId] = process.argv;
uploadMedia(filePath, category, subcategory, description, companyId || 'generic').catch(console.error);
