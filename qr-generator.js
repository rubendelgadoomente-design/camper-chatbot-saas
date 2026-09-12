const QRCode = require('qrcode');
const path = require('path');

// Reemplaza esto con el número de teléfono verificado de tu bot en Meta (incluye el prefijo sin el +)
// Ejemplo: 447458038618 (UK) o 34600000000 (España)
const BOT_PHONE_NUMBER = '447458038618'; 

// El mensaje predefinido que el usuario enviará al escanear
const PREFILLED_MESSAGE = encodeURIComponent('ACTIVAR MI VIAJE');

// Enlace oficial de WhatsApp
const whatsappUrl = `https://wa.me/${BOT_PHONE_NUMBER}?text=${PREFILLED_MESSAGE}`;

const outputPath = path.join(__dirname, 'public', 'qr-camperbot-whatsapp.png');

async function generateQR() {
    try {
        await QRCode.toFile(outputPath, whatsappUrl, {
            color: {
                dark: '#25D366',  // Color verde WhatsApp
                light: '#ffffff'
            },
            width: 800, // Alta resolución para imprimir en pegatinas
            margin: 2
        });
        console.log(`✅ ¡Código QR de WhatsApp generado con éxito!`);
        console.log(`📍 Guardado en: ${outputPath}`);
        console.log(`🌐 Apuntando a: ${whatsappUrl}`);
        console.log(`\n💡 INSTRUCCIONES:`);
        console.log(`Imprime la imagen 'qr-camperbot-whatsapp.png'. Cuando el cliente la escanee,`);
        console.log(`se le abrirá WhatsApp automáticamente con el mensaje "ACTIVAR MI VIAJE" listo para enviar.`);
    } catch (err) {
        console.error('❌ Error al generar el QR:', err);
    }
}

generateQR();
