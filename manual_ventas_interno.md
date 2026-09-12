# Manual Interno de Ventas — CamperBot SaaS
**Versión 1.0 — Septiembre 2026 | CONFIDENCIAL — Solo uso interno de Rubén**

---

## Índice
1. [Resumen del Producto](#1-resumen-del-producto)
2. [Proceso de Venta Paso a Paso](#2-proceso-de-venta-paso-a-paso)
3. [Onboarding Técnico (Post-Firma)](#3-onboarding-técnico-post-firma)
4. [Preguntas del Cliente y Respuestas Exactas](#4-preguntas-del-cliente-y-respuestas-exactas)
5. [Argumentario de Objeciones](#5-argumentario-de-objeciones)
6. [Guion de Demo en Vivo](#6-guion-de-demo-en-vivo)
7. [Cuadro de Mando: Lo que EXISTE vs Lo que NO](#7-cuadro-de-mando-lo-que-existe-vs-lo-que-no)

---

## 1. Resumen del Producto

CamperBot es un asistente técnico de Inteligencia Artificial que atiende por WhatsApp a los turistas que alquilan autocaravanas. Funciona 24 horas, en 12 idiomas, transcribe notas de voz, envía fotos y vídeos de los paneles específicos de la furgoneta, y protege la reputación del cliente en Google Maps filtrando las reseñas negativas automáticamente.

**Propuesta de valor para el dueño de la flota:**
- Reduce un 80% las llamadas fuera de horario (madrugadas, fines de semana).
- Protege su puntuación en Google Maps (solo pide reseña si el viaje fue bien).
- No requiere que el turista instale ninguna app (usa WhatsApp, que ya tiene).
- Cumplimiento RGPD automático: los datos del turista se borran a las 48h.

---

## 2. Proceso de Venta Paso a Paso

### FASE 1: Prospección (Antes de la visita)

1. **Busca empresas de alquiler** en Google Maps, Yescapa, Indie Campers, CamperDays, etc.
2. **Investiga la empresa:**
   - ¿Cuántos vehículos tienen? (determina el plan y el precio)
   - ¿Qué puntuación tienen en Google Maps? (si tienen reseñas malas, tienes un argumento de oro)
   - ¿Tienen web propia o solo están en plataformas?
3. **Primer contacto** (teléfono o email): *"Buenos días, soy Rubén de CamperBot. Tenemos un software de inteligencia artificial que responde por WhatsApp a las dudas técnicas de vuestros clientes cuando están de ruta, de día y de noche. ¿Tenéis 10 minutos para que os lo enseñe?"*

### FASE 2: La Reunión Comercial (La visita presencial)

**Duración ideal:** 20-30 minutos.

**Estructura de la reunión:**

| Minuto | Qué hacer | Material |
|--------|-----------|----------|
| 0-3 | Romper el hielo. Pregunta: *"¿Cuántos vehículos tenéis en flota? ¿Os llaman mucho fuera de horario?"* | Tu presencia + tarjeta NFC |
| 3-8 | Presenta el problema con datos: *"El 70% de las llamadas que recibís son dudas tontas: cómo encender el gas, dónde está el WC..."* | `pitch.html` en tu tablet/portátil |
| 8-15 | **Demo en vivo** (ver sección 6): Saca tu móvil, escribe al bot delante de ellos | Tu móvil con WhatsApp |
| 15-20 | Enseña el panel de estadísticas: *"Esto es lo que vosotros veríais"* | `app.campersupport.es/stats.html` |
| 20-25 | Precio y cierre: *"El plan básico son 99€/mes"* | Contrato impreso |
| 25-30 | Resolver objeciones y firmar | Contrato + bolígrafo |

### FASE 3: Cierre y Firma

- Lleva **dos copias impresas** del [contrato](file:///c:/Users/ruben/Documents/Proyectos/camper_chatbot/CONTRATO_PRESTACION_SERVICIOS.md).
- Firma ambas copias. Una para ti, otra para el cliente.
- Explica que en **48 horas** tendrás todo configurado y le darás acceso.

---

## 3. Onboarding Técnico (Post-Firma)

### Lo que tú haces tras la firma (el cliente NO tiene que hacer nada técnico)

| Paso | Acción | Tiempo estimado |
|------|--------|-----------------|
| 1 | **Configurar las variables de entorno** en Railway: cambiar `COMPANY_NAME`, `SUPPORT_PHONE`, `SUPPORT_HOURS` y `REVIEW_LINK` con los datos del nuevo cliente. | 5 minutos |
| 2 | **Subir el manual técnico** de sus vehículos a la base de conocimiento (RAG). Ejecutar el script `upload-knowledge.js` con los textos de sus modelos específicos. | 30 minutos |
| 3 | **Subir las fotos/vídeos** de sus furgonetas a Supabase Storage y registrarlas en `image_library`. | 30 minutos |
| 4 | **Imprimir los códigos QR** personalizados con el enlace de WhatsApp que incluya el texto "ACTIVAR MI VIAJE". Uno por vehículo. | 15 minutos |
| 5 | **Enviarle al cliente** por email: la URL de su panel de estadísticas, la URL de registro de clientes, y los QR impresos (o el PDF para que los imprima él). | 5 minutos |
| 6 | **Hacer una prueba de fuego** contigo mismo: registrar un alquiler ficticio, activar el bot, hacerle preguntas y verificar que responde con el nombre de la empresa del cliente. | 15 minutos |

**Tiempo total de onboarding: ~1,5 horas de tu trabajo.**

### Lo que el cliente tiene que hacer

1. **Pegar el código QR** en cada autocaravana (sugerencia: en la puerta del armario de la cocina o en la guantera).
2. **Registrar a cada turista** cuando le entregue las llaves entrando en `app.campersupport.es/registro.html` desde su móvil (tarda 10 segundos).
3. **Consultar sus estadísticas** cuando quiera en `app.campersupport.es/stats.html`.

---

## 4. Preguntas del Cliente y Respuestas Exactas

### "¿Cómo accedo yo a mi panel de estadísticas?"

> *"Te doy un enlace web que funciona desde cualquier dispositivo: móvil, tablet u ordenador. Solo tienes que abrir el navegador y entrar en la dirección que te paso. No hace falta instalar nada."*

**Ejemplo práctico:**
*"Imagina que es lunes por la mañana y quieres ver cuántas consultas ha resuelto el bot este fin de semana. Coges tu móvil, abres Chrome, pones la dirección y ves un panel con gráficas: 47 consultas resueltas, 3,9 horas de teléfono ahorradas, y que el tema estrella ha sido 'agua caliente'. Todo visual, todo claro."*

**Realidad técnica:** Actualmente es una URL directa sin contraseña. Para la fase MVP esto es perfectamente válido (la URL no es pública ni indexada por Google). Si el cliente insiste en tener usuario y contraseña, le dices: *"Lo implementamos en la siguiente fase de personalización"*.

---

### "¿Puedo verlo en el móvil y en el ordenador?"

> *"Sí, funciona en cualquier dispositivo con navegador. La web se adapta automáticamente al tamaño de la pantalla. Lo puedes abrir en tu móvil personal, en el ordenador de la oficina, o en la tablet que tengáis en recepción. Incluso lo podéis tener varios compañeros abierto a la vez."*

---

### "¿Se integra con nuestro sistema de gestión (ERP, Excel, etc.)?"

> *"CamperBot funciona de forma independiente. No necesita conectarse a vuestro sistema de gestión. Lo único que tiene que hacer vuestro recepcionista es entrar en una web desde su móvil y poner el nombre y teléfono del turista cuando le dé las llaves. Son literalmente 10 segundos."*

**Si insisten en integración:**
> *"Para empresas grandes con más de 20 vehículos, ofrecemos integración por API con vuestro software de gestión para que el alta se haga automáticamente. Esto entra en el plan Enterprise."*

**Realidad técnica:** La API `POST /api/rentals` ya existe y es perfectamente funcional para integraciones. Si algún día un cliente con un ERP quiere automatizarlo, solo tendría que hacer un POST con nombre, teléfono y fecha de fin. Es viable, pero no está empaquetado como producto todavía.

---

### "¿Y si tenemos varias furgonetas distintas? ¿El bot sabe diferenciarlas?"

> *"Sí. Nosotros subimos el manual técnico específico de cada modelo que tengáis. Si tenéis una Fiat Ducato y una VW California, el bot sabe que el panel de la Ducato está en un sitio y el de la California en otro. Incluso puede enviar fotos y vídeos de los paneles exactos de VUESTRA furgoneta, no fotos genéricas de Internet."*

**Realidad técnica:** El sistema RAG (base de conocimiento vectorial) ya soporta esto mediante el campo `company_id` en `knowledge_base` e `image_library`. Lo que aún no está automatizado es la diferenciación por matrícula/vehículo dentro de una misma empresa (el bot responde con el conocimiento global de la empresa, no por vehículo individual). Para la fase MVP con flotas pequeñas (3-10 vehículos del mismo modelo), esto no es un problema.

---

### "¿El bot habla en el idioma del turista?"

> *"Automáticamente. En cuanto el turista escribe su primer mensaje, el bot detecta el idioma y responde en ese idioma durante toda la conversación. Funciona en español, inglés, francés, alemán, italiano, portugués, neerlandés y más. Si un holandés os alquila una furgo y le surge una duda a las 3 de la mañana, le responde en neerlandés sin que vosotros tengáis que hacer nada."*

---

### "¿Y si el turista tiene un problema de verdad (avería, accidente)?"

> *"El bot está programado para detectar problemas graves. Si la duda es algo que el turista puede resolver solo (encender el gas, llenar agua, cambiar un fusible), el bot lo guía paso a paso. Pero si es algo que requiere intervención humana (una fuga de agua por las tuberías internas, un problema de motor, un accidente), el bot lo detecta automáticamente, le da vuestro teléfono de emergencias y os avisa."*

---

### "¿Vosotros tenéis acceso a los datos de nuestros clientes?"

> *"No. Y no es solo de palabra, está en el contrato que vamos a firmar (cláusula 4). Los datos del turista (nombre y teléfono) se borran automáticamente a las 48 horas de devolver la autocaravana. Ni nosotros ni nadie puede exportar vuestra base de datos porque el sistema la destruye solo. Lo que sí conservamos son las estadísticas anónimas (cuántas consultas hubo sobre gas, cuántas sobre agua) para que vosotros podáis ver las gráficas en vuestro panel."*

---

### "¿Y si nos damos de baja?"

> *"Sin permanencia. Si un mes no os convence, dejáis de pagar y se desactiva. Sin preguntas, sin penalizaciones. Está en el contrato."*

---

### "¿Cuánto cuesta?"

| Plan | Precio | Ideal para |
|------|--------|-----------|
| **Starter** | 99 €/mes | Flotas de 1-5 vehículos |
| **Pro** | 149 €/mes | Flotas de 6-15 vehículos |
| **Enterprise** | 299 €/mes | Flotas de 16+ vehículos, integración API |

> *"El plan básico son 99 euros al mes. Piensa que si el bot os ahorra UNA SOLA llamada de 15 minutos a las 3 de la mañana cada semana, ya se ha pagado solo. Y normalmente resuelve entre 5 y 10 consultas diarias en temporada alta."*

---

## 5. Argumentario de Objeciones

### "Es muy caro / No tenemos presupuesto"

> *"Entiendo. Haz la cuenta conmigo: ¿Cuántas llamadas recibís fuera de horario al mes en temporada alta? Si son 20 llamadas de 10 minutos, eso son 3,3 horas de tu tiempo. A 30€/hora (que es barato para un autónomo), son 100€ en tiempo perdido. CamperBot te cuesta 99€ y te devuelve esas horas para dormir o para dedicarlas a lo que de verdad importa."*

### "Ya tenemos un sistema / Ya le damos un manual al cliente"

> *"Un manual en papel es genial para el día 1, cuando el turista está fresco y atento. Pero las dudas surgen el día 3, a las 11 de la noche, cuando llevan 3 cervezas encima y no recuerdan cómo encender el calentador. En ese momento, tu manual de 20 páginas está en la guantera olvidado. Con CamperBot, le mandan un audio de 5 segundos diciendo 'no me sale agua caliente' y reciben la solución instantánea en su idioma."*

### "No me fío de la IA / ¿Y si dice algo incorrecto?"

> *"CamperBot no es un ChatGPT genérico que se inventa respuestas. Está entrenado EXCLUSIVAMENTE con los manuales de VUESTRAS furgonetas. Si le preguntan algo que no sabe, en lugar de inventar, dice: 'No tengo esa información, llama a [vuestro teléfono]'. Además, si en algún momento detectáis una respuesta que no os gusta, me lo decís y la corrijo en 24 horas."*

### "¿Y si se cae el sistema?"

> *"El servidor está alojado en Railway, que es la misma infraestructura que usan startups de Silicon Valley. Tiene un 99,9% de disponibilidad. Y si por algún motivo se cayera, el turista simplemente no recibe respuesta del bot y llama por teléfono como haría normalmente. No se rompe nada."*

### "Necesito consultarlo con mi socio / Lo tengo que pensar"

> *"Por supuesto, tómate tu tiempo. Te dejo mi tarjeta (NFC) con toda la información y el enlace a la web. Solo ten en cuenta que ahora mismo estamos aceptando 10 empresas en el programa Early Access con precio fundador. Una vez se llenen las plazas, el precio sube."*

---

## 6. Guion de Demo en Vivo

La demo en vivo es tu arma más potente. Hacerla delante del cliente con tu propio móvil es lo que diferencia tu producto de un PDF bonito.

### Preparación (antes de la reunión)
1. Asegúrate de tener un alquiler de prueba activo en el sistema con tu propio número.
2. Abre WhatsApp en tu móvil en el chat de CamperBot.

### Guion de la demo (5 minutos)

**[Paso 1 — El QR]**
*"Mira, esto es lo que el turista vería pegado en la furgoneta."* (Enseña el QR impreso o en pantalla). *"Lo escanea con la cámara del móvil y se le abre WhatsApp automáticamente."*

**[Paso 2 — La Activación]**
Envía el mensaje `ACTIVAR MI VIAJE` desde tu móvil delante del cliente. *"¿Ves? Sin instalar nada. Le llega un mensaje de bienvenida con botones."*

**[Paso 3 — Una duda fácil]**
Escribe: *"No me sale agua caliente de la ducha"*. Espera la respuesta del bot. *"Fíjate: le ha dado los 3 pasos exactos para encender el boiler. Sin que tú hayas cogido el teléfono."*

**[Paso 4 — Un audio]**
Graba un audio de 3 segundos diciendo: *"Oye, no sé dónde está la bomba de agua, no sale nada por el grifo."* Espera la respuesta. *"¿Has visto? Ha transcrito tu audio automáticamente y te ha respondido con la solución."*

**[Paso 5 — El Marketing Defensivo]**
*"Y ahora viene lo mejor. Cuando el turista devuelve la furgoneta, si todo ha ido bien, el bot le pide automáticamente una reseña de 5 estrellas en Google Maps con un enlace directo. PERO, si durante el viaje ha tenido problemas técnicos, el bot se calla y no le pide reseña. Así protegemos tu puntuación."*

**[Paso 6 — Las Estadísticas]**
Abre `app.campersupport.es/stats.html` en tu móvil o tablet. *"Y esto es lo que verías tú cada lunes por la mañana: cuántas consultas ha resuelto el bot, cuántas horas de teléfono te ha ahorrado y cuáles son los temas que más preguntan tus clientes."*

---

## 7. Cuadro de Mando: Lo que EXISTE vs Lo que NO

> [!CAUTION]
> **Esta sección es SOLO para ti. NUNCA la enseñes a un cliente.** Úsala para saber hasta dónde puedes prometer y dónde tienes que ser ambiguo.

### ✅ Funciona al 100% HOY

| Funcionalidad | Estado |
|---------------|--------|
| Bot por WhatsApp con IA (GPT-4o-mini) | ✅ Operativo |
| Transcripción de audios (Whisper) | ✅ Operativo |
| Detección automática de idioma (12+) | ✅ Operativo |
| Envío de fotos/vídeos técnicos por WhatsApp | ✅ Operativo |
| Formulario de registro de turistas (web) | ✅ Operativo |
| Activación por código QR físico | ✅ Operativo |
| Marketing Defensivo (filtro de reseñas) | ✅ Operativo |
| Panel de estadísticas con gráficas | ✅ Operativo |
| Anonimización RGPD automática (48h) | ✅ Operativo |
| Base de conocimiento por empresa (RAG) | ✅ Operativo |
| Cumplimiento legal España (toldo, aguas) | ✅ Operativo |

### ⚠️ Funciona pero con limitaciones (no mencionar salvo que pregunten)

| Funcionalidad | Limitación real | Qué decir si preguntan |
|---------------|-----------------|------------------------|
| Acceso al dashboard | Sin contraseña (URL directa) | *"Te damos un enlace privado. Estamos implementando login con usuario y contraseña para la próxima versión."* |
| Multi-empresa | Solo 1 empresa a la vez | No aplica aún (solo tienes 0 clientes). Cuando firmes el 2º, hay que desplegar una segunda instancia en Railway. |
| Diferenciación por vehículo | El bot sabe los modelos de la empresa, pero no distingue por matrícula | *"El bot está entrenado con todos vuestros modelos."* (Suficiente para flotas de 1-10 vehículos iguales). |

### ❌ NO existe todavía (no prometas esto)

| Funcionalidad | Lo que NO debes prometer |
|---------------|--------------------------|
| Login con usuario y contraseña | No digas *"cada empleado tiene su usuario"*. |
| App móvil nativa | No digas *"tenemos una app"*. Es una web. |
| Integración automática con ERPs | No digas *"se conecta solo a vuestro programa"*. Puedes decir *"tiene API para integraciones futuras"*. |
| Facturación automática (Stripe) | No digas *"os llegará la factura automática"*. Cobras manualmente por transferencia o Bizum. |
| Panel de super-administrador para ti | No existe. Tú gestionas todo por Railway + Supabase directamente. |

---

> [!TIP]
> **Regla de oro para la reunión:** Si un cliente te hace una pregunta sobre algo que NO existe, nunca digas "no tenemos eso". Di: *"Eso está en el roadmap de la siguiente fase. Para empezar, lo gestionamos de esta otra forma que es incluso más ágil."* Y cambia de tema hacia algo que SÍ funciona.
