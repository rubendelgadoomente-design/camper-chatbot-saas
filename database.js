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

module.exports = {
    saveRental,
    getStats,
    incrementStat,
    getRentals,
    updateRental,
    getRentalByPhone
};
