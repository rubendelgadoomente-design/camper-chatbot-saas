// Test rápido del nuevo system prompt
require('dotenv').config();
const { processMessageAI } = require('./llm-logic');

const testCases = [
    { name: "Primera vez", msg: "Hola, acabo de recoger la autocaravana y no sé por dónde empezar" },
    { name: "Cerraduras", msg: "No puedo abrir la puerta de la autocaravana, la llave no gira" },
    { name: "Gas por país", msg: "Estoy en Alemania y se me ha acabado el gas, dónde puedo comprar una bombona?" },
    { name: "Conectores", msg: "El cable azul no encaja en el poste del camping, estoy en Suiza" },
    { name: "Idioma inglés", msg: "Hello, my fridge is not cooling at all" },
];

async function runTests() {
    for (const test of testCases) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`TEST: ${test.name}`);
        console.log(`USER: "${test.msg}"`);
        console.log('='.repeat(60));
        
        try {
            const result = await processMessageAI(test.msg);
            console.log(`CATEGORÍA: [${result.category.toUpperCase()}]`);
            console.log(`RESPUESTA:\n${result.response}`);
        } catch (err) {
            console.error(`ERROR: ${err.message}`);
        }
    }
    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Tests completados');
}

runTests();
