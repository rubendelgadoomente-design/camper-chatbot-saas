const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuración de Supabase (se llenará con vbles de entorno mañana)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Conexión con Supabase configurada.');
} else {
    console.log('⚠️ Supabase no configurado. Utilizando archivos locales (Modo Desarrollo).');
}

/**
 * Guarda un nuevo alquiler
 */
async function saveRental(rentalData) {
    if (supabase) {
        const { data, error } = await supabase
            .from('rentals')
            .insert([rentalData]);
        if (error) throw error;
        return data;
    } else {
        const filePath = path.join(__dirname, 'data', 'rentals.json');
        let rentals = [];
        if (fs.existsSync(filePath)) {
            rentals = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        rentals.push({ ...rentalData, id: Date.now(), created_at: new Date().toISOString() });
        fs.writeFileSync(filePath, JSON.stringify(rentals, null, 2));
        return rentals;
    }
}

/**
 * Obtiene las estadísticas
 */
async function getStats() {
    if (supabase) {
        const { data, error } = await supabase
            .from('stats')
            .select('*')
            .single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows"
        return data || { total_queries: 0, categories: { motor: 0, rutas: 0, equipamiento: 0, otros: 0 } };
    } else {
        const statsPath = path.join(__dirname, 'data', 'camper_stats.json');
        if (fs.existsSync(statsPath)) {
            return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        }
        return { total_queries: 0, categories: { motor: 0, rutas: 0, equipamiento: 0, otros: 0 } };
    }
}

/**
 * Actualiza estadísticas
 */
async function incrementStat(category) {
    if (supabase) {
        const current = await getStats();
        current.total_queries += 1;
        const cat = category.toLowerCase();
        if (current.categories[cat] !== undefined) {
            current.categories[cat] += 1;
        } else {
            current.categories['otros'] += 1;
        }

        const { error } = await supabase
            .from('stats')
            .upsert({ id: 1, ...current });
        if (error) console.error('Error en Supabase stats:', error);
    } else {
        const statsPath = path.join(__dirname, 'data', 'camper_stats.json');
        const data = await getStats();
        data.total_queries += 1;
        const cat = category.toLowerCase();
        if (data.categories[cat] !== undefined) {
            data.categories[cat] += 1;
        } else {
            data.categories['otros'] += 1;
        }
        fs.writeFileSync(statsPath, JSON.stringify(data, null, 2));
    }
}

/**
 * Obtiene la lista de alquileres
 */
async function getRentals() {
    if (supabase) {
        const { data, error } = await supabase
            .from('rentals')
            .select('*');
        if (error) throw error;
        return data || [];
    } else {
        const filePath = path.join(__dirname, 'data', 'rentals.json');
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        return [];
    }
}

/**
 * Actualiza un alquiler existente
 */
async function updateRental(id, updates) {
    if (supabase) {
        const { data, error } = await supabase
            .from('rentals')
            .update(updates)
            .eq('id', id);
        if (error) throw error;
        return data;
    } else {
        const filePath = path.join(__dirname, 'data', 'rentals.json');
        let rentals = await getRentals();
        const index = rentals.findIndex(r => r.id === id);
        if (index !== -1) {
            rentals[index] = { ...rentals[index], ...updates };
            fs.writeFileSync(filePath, JSON.stringify(rentals, null, 2));
        }
        return rentals;
    }
}

/**
 * Busca un alquiler activo por número de teléfono
 */
async function getRentalByPhone(phone) {
    if (supabase) {
        const { data, error } = await supabase
            .from('rentals')
            .select('*')
            .eq('phone', phone)
            .eq('status', 'active')
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    } else {
        const rentals = await getRentals();
        return rentals.find(r => r.phone === phone && r.status === 'active');
    }
}

/**
 * Guarda el feedback de un usuario tras una conversación
 */
async function saveFeedback(feedbackData) {
    const entry = {
        id: Date.now(),
        phone: feedbackData.phone || 'desconocido',
        rating: feedbackData.rating,
        comment: feedbackData.comment || '',
        category: feedbackData.category || 'otros',
        resolved_without_human: feedbackData.resolved_without_human !== false,
        created_at: new Date().toISOString()
    };

    if (supabase) {
        const { data, error } = await supabase
            .from('feedback')
            .insert([entry]);
        if (error) throw error;
        return data;
    } else {
        const filePath = path.join(__dirname, 'data', 'feedback.json');
        let feedbackList = [];
        if (fs.existsSync(filePath)) {
            feedbackList = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        feedbackList.push(entry);
        fs.writeFileSync(filePath, JSON.stringify(feedbackList, null, 2));
        return entry;
    }
}

/**
 * Obtiene todo el feedback almacenado
 */
async function getAllFeedback() {
    if (supabase) {
        const { data, error } = await supabase
            .from('feedback')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } else {
        const filePath = path.join(__dirname, 'data', 'feedback.json');
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
        return [];
    }
}

/**
 * Genera un resumen agregado del feedback
 */
async function getFeedbackSummary() {
    const allFeedback = await getAllFeedback();
    if (allFeedback.length === 0) {
        return { total: 0, average: 0, distribution: {}, recent: [] };
    }

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    let resolvedCount = 0;

    allFeedback.forEach(f => {
        distribution[f.rating] = (distribution[f.rating] || 0) + 1;
        sum += f.rating;
        if (f.resolved_without_human) resolvedCount++;
    });

    return {
        total: allFeedback.length,
        average: (sum / allFeedback.length).toFixed(1),
        distribution,
        resolved_rate: ((resolvedCount / allFeedback.length) * 100).toFixed(0) + '%',
        recent: allFeedback.slice(0, 10)
    };
}

/**
 * RAG: Busca fragmentos de manuales en la base de datos usando similitud vectorial
 */
async function searchKnowledgeBase(queryEmbedding, companyId) {
    if (!supabase) {
        console.warn('⚠️ Supabase no configurado. Búsqueda RAG deshabilitada.');
        return [];
    }

    try {
        const { data, error } = await supabase.rpc('match_documents', {
            query_embedding: queryEmbedding,
            match_threshold: 0.70, // Similitud mínima (70%)
            match_count: 3, // Recuperar los 3 mejores fragmentos
            p_company_id: companyId
        });

        if (error) {
            console.error("Error en búsqueda RAG (Supabase RPC):", error.message);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error("Excepción en searchKnowledgeBase:", error.message);
        return [];
    }
}

/**
 * Busca una imagen relevante para una categoría y empresa
 */
async function getImageForCategory(category, companyId = 'generic') {
    try {
        // Try company-specific first, then generic
        let { data, error } = await supabase
            .from('image_library')
            .select('image_url, description, subcategory')
            .eq('category', category)
            .eq('active', true)
            .in('company_id', [companyId, 'generic'])
            .order('company_id', { ascending: false }) // company-specific first
            .limit(1);
        
        if (error || !data || data.length === 0) return null;
        return data[0];
    } catch (e) {
        console.error('[DB] Error buscando imagen:', e.message);
        return null;
    }
}

module.exports = {
    getImageForCategory,
    saveRental,
    getStats,
    incrementStat,
    getRentals,
    updateRental,
    getRentalByPhone,
    saveFeedback,
    getAllFeedback,
    getFeedbackSummary,
    searchKnowledgeBase
};
