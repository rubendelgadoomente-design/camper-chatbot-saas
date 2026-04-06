require('dotenv').config();
const { processMessageAI } = require('./llm-logic');

const tests = [
    { msg: 'hola', expected: 'Local' },
    { msg: '¿cómo funciona el poti?', expected: 'Local' },
    { msg: 'tengo un error en el motor', expected: 'AI/Error' },
    { msg: 'no funciona el gas', expected: 'AI/Error' }
];

async function runTests() {
    console.log('--- Iniciando Test del Cerebro Híbrido (Local + IA) ---\n');

    for (const test of tests) {
        process.stdout.write(`Prueba: "${test.msg}" -> `);
        try {
            const response = await processMessageAI(test.msg);
            console.log(`\nRespuesta: ${response.substring(0, 80)}...`);
        } catch (err) {
            console.error('\nError en el test:', err.message);
        }
        console.log('-'.repeat(40));
    }

    console.log('\n--- Test Finalizado ---');
}

runTests();
