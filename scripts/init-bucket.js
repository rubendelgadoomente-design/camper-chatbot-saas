require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function initBucket() {
    console.log('Creando bucket camperbot-images...');
    const { data, error } = await supabase.storage.createBucket('camperbot-images', {
        public: true,
        fileSizeLimit: 52428800 // 50MB
    });
    
    if (error && !error.message.includes('already exists')) {
        console.error('Error creando bucket:', error.message);
    } else {
        console.log('Bucket listo.');
    }
}
initBucket();
