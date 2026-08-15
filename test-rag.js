require('dotenv').config();
const { processMessageAI } = require('./llm-logic');

async function test() {
    console.log('\n=== TEST RAG - CamperBot ===\n');

    const preguntas = [
        { q: '¿Cómo enciendo la calefacción?', company: 'benimar' },
        { q: '¿Qué hago si no sale agua del grifo?', company: 'hymer' },
        { q: '¿Cómo conecto la autocaravana al camping?', company: 'default_company' },
    ];

    for (const test of preguntas) {
        console.log(`\n📝 Empresa: ${test.company}`);
        console.log(`❓ Pregunta: ${test.q}`);
        console.log('─'.repeat(60));
        
        const result = await processMessageAI(test.q, [], test.company);
        console.log(`🤖 Respuesta:\n${result.response}`);
        console.log(`📂 Categoría: ${result.category}`);
        console.log('─'.repeat(60));
    }

    console.log('\n✅ Test completado.');
}

test().catch(console.error);
