# Guía Completa: Proceso de Ventas, Onboarding y Operativa (CamperBot MVP)

Para que tengas total seguridad en tus visitas de ventas, aquí tienes el desglose exacto de cómo funciona el sistema actualmente (MVP) y cómo debes explicárselo a los clientes. 

Es importante distinguir entre lo que tú haces como dueño del SaaS, lo que hace la empresa de alquiler, y lo que hace el turista.

---

## 1. El Proceso de Venta y Alta de la Empresa (Tu lado)

Actualmente, para asegurar la máxima calidad y personalización en estos primeros clientes (Early Adopters), **el servicio es un modelo "Conserje" (White-glove onboarding)**. No hay un panel donde el cliente pague con tarjeta y se configure todo solo; tú ofreces un servicio premium llave en mano.

### Paso a paso del alta de una Empresa de Alquiler:
1. **Firma del acuerdo:** Cierras la venta y te pasan los manuales en PDF/Word de los modelos exactos que tienen en su flota (ej. Benimar Tessoro 463).
2. **Setup Técnico (Lo hacemos nosotros en el backend):** 
   - Subimos sus manuales a nuestra base de datos inteligente (RAG).
   - Cargamos las fotos específicas de sus paneles de control usando nuestro script de imágenes.
3. **Entrega:** Le proporcionas a la empresa un enlace privado (ej. `camperbot.es/registro-empresaX`) y un Código QR genérico para que lo impriman y lo peguen en sus autocaravanas.
4. **Pagos y Planes:** Por ahora, como tienes pocos clientes, la facturación la gestionas mediante transferencia bancaria mensual o un enlace de Stripe (suscripción). *No necesitas un dashboard complejo de MRR (Ingresos Recurrentes) hasta que no tengas 10+ clientes.*

---

## 2. El Día a Día de la Empresa de Alquiler (Dashboard del Cliente)

La empresa de alquiler (tu cliente) busca simplicidad absoluta. No quieren software complicado. Les damos dos herramientas muy sencillas:

### A. La página de Check-in (`registro.html`)
Cuando entregan las llaves a un turista, el recepcionista tarda 10 segundos en darlo de alta.
- **Qué ven:** Un formulario simple en su móvil u ordenador.
- **Qué introducen:** 
  - Nombre del turista (Ej: Juan Pérez).
  - Teléfono (Ej: 34600000000).
  - Fecha de fin del viaje (Check-out).
  - *Opcional:* Enlace de Google Maps de la empresa (para la reseña final).
- **Qué ocurre:** El sistema registra al turista en la base de datos con estado "Activo" pero silencioso. **El bot NO le escribe primero para no ser spam.**

### B. El Dashboard de Estadísticas (`stats.html`)
Un panel visual (que ya tienes programado) donde el gerente de la empresa puede ver el valor que le estás aportando.
- **Qué ven:**
  - **Consultas Resueltas:** Número total de dudas que el bot ha respondido.
  - **Soporte Ahorrado:** Horas estimadas que se han ahorrado (calculado a 5 mins por duda).
  - **Dudas por Categoría:** Un gráfico de barras que muestra de qué se quejan más (Ej: 40% Agua, 30% Electricidad). Esto les ayuda a saber qué explicar mejor antes de entregar la caravana.

---

## 3. La Experiencia del Turista (Usuario final)

El proceso está diseñado para cumplir con las políticas anti-spam de WhatsApp.

1. **Escaneo del QR:** El turista sube a la autocaravana, ve una pegatina que dice *"¿Dudas técnicas? Escanéame"* y escanea el código QR con su cámara.
2. **Activación:** El QR le abre su WhatsApp con un mensaje preescrito: `ACTIVAR MI VIAJE`. El turista solo tiene que darle a enviar.
3. **Bienvenida:** El sistema cruza su número de teléfono con los registros de la empresa. Si coincide, el bot se presenta: *"¡Hola Juan Pérez! Has activado tu asistente..."* y le muestra 3 botones (Agua, Luz, Otros).
4. **Soporte 24/7:** El turista pregunta (incluso con notas de voz). El bot busca en los manuales de ESA empresa y le responde al instante. Si la empresa subió fotos, el bot se las envía (Ej: foto de la válvula de purga).
5. **El Check-out y la Reseña:** El día que finaliza su alquiler (la fecha que puso el recepcionista), el sistema evalúa:
   - ¿Tuvo problemas mecánicos graves? -> Se queda callado (Marketing Defensivo).
   - ¿Todo fue bien? -> Le envía automáticamente el link de Google Maps pidiendo 5 estrellas.

---

## 4. Tu Dashboard de Control (`monitor.html`)

Como administrador del sistema, tú tienes un panel técnico oculto.
- **Qué puedes ver:**
  - **Estado de la IA:** Si está activa o pausada.
  - **Logs en tiempo real:** Ves las conversaciones anónimas que están ocurriendo en ese momento (muy útil para afinar las respuestas de la IA en estas primeras semanas).
  - **Chat de Prueba:** Un simulador para que tú pruebes cómo está respondiendo la IA a ciertas preguntas antes de ir a visitar a un cliente.

*(Nota: Un panel administrativo de facturación, gestión de suscripciones de clientes y alta automática de empresas lo desarrollaremos en la Fase 2, una vez valides el modelo de negocio vendiendo a las primeras 3-5 empresas).*

---

## Resumen para tu Pitch de Ventas

Cuando estés frente al gerente de **Naccaravan** o **Caravan Sierra**, tu discurso sobre el proceso debe ser este:

> *"El sistema es invisible y no requiere que instaléis nada. Cuando entregáis las llaves, metéis el teléfono del cliente en un enlace que os doy (tardáis 5 segundos). En la autocaravana pegamos un QR. Si el cliente a las 2 de la mañana no sabe encender la calefacción, escanea el QR, y mi inteligencia artificial —que se ha estudiado vuestros manuales exactos— le responde por WhatsApp con texto, audios o fotos de vuestros propios paneles. A vosotros os doy un panel donde veréis cuántas horas de teléfono os estoy ahorrando al mes."*
