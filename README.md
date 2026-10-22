# Coolplanners · prototipo navegable

Prototipo de la app descrita en *Especificación de la aplicación Coolplanners* (21 oct 2026). Es una web app (PWA) pensada primero para el celular: la pareja coordina a los proveedores que ya contrató en un solo cronograma, y cada proveedor confirma desde un enlace, sin crear cuenta.

No tiene servidor. Todo se guarda en el navegador (localStorage), así que sirve para pruebas de usabilidad y para mostrar los flujos, no para un piloto real.

## Qué se puede probar

| Flujo de la especificación | Dónde |
| --- | --- |
| L1 Página de inicio con precio A/B (USD 20, 35 o 50) | Al abrir la app |
| H1 / L2 Boda de ejemplo sin registro, con un retraso que muestra la cascada | "Ver una boda de ejemplo" → "Ver el reajuste en cascada" |
| Flujo 1: la pareja arma su evento (A1, A2, B1, B2, C1, C8, P13) | "Crear mi evento gratis" |
| Flujo 2: el proveedor responde por enlace (D1–D7, V1–V7) | Ficha del proveedor → "Ver lo que ve el proveedor" |
| Flujo 3: un proveedor se retrasa el Día D (F1–F4, C5, P6, P8) | Inicio → "Probar el modo Día D" → simulación |
| Activación y pago (A5, P12) con comprobante | Botón "Activar" o Más → Plan y pago |
| Bitácora, presupuesto, plantillas, co-organizador, métricas (C7, P9, P10, A3, G1) | Pestaña Más |

Detalles que cumple:

- Reprogramación en cascada: lo que depende de una tarea se corre solo lo que la holgura no absorbe (30 min de retraso con 20 de holgura corre 10 min). Nada se avisa sin que la pareja apruebe.
- Dependencias sin círculos: la app no deja crear una dependencia circular y muestra la cadena completa.
- El proveedor ve solo nombre, categoría y hora de quien va antes o después de él. Nunca teléfonos ni montos.
- Semáforo siempre con color, palabra e ícono. Modo Día D en alto contraste.
- Horas en formato de 12 h con a. m. / p. m., zona horaria de Bogotá.
- Aviso de privacidad y consentimiento del proveedor en su primera visita (Ley 1581 de 2012).
- WhatsApp asistido: el botón abre el chat de la pareja con el mensaje ya escrito. SMS y correo automáticos se simulan en la bitácora.
- Importar Excel/CSV con mapeo de columnas y vista previa de errores. No se guarda nada hasta confirmar.
- Funciona sin internet una vez cargada (service worker), cuando se sirve desde un servidor.

Todo lo que la especificación marca como supuesto (precios, plantillas de cronograma, recordatorios) está en `js/data.js` para cambiarlo fácil.

## Correrlo

No necesita compilar nada.

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

Para publicarlo gratis: en GitHub ve a **Settings → Pages**, elige "Deploy from a branch", esta rama y la carpeta `/ (root)`.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `index.html` | El cascarón de la app |
| `css/styles.css` | Sistema de diseño: titulares condensados en mayúsculas, fondos pastel, modo oscuro y modo Día D |
| `js/data.js` | Categorías, estados, plantillas de mensajes, plantilla del cronograma, precios y la boda de ejemplo |
| `js/app.js` | Pantallas, cascada, página del proveedor, Día D, pago simulado y métricas |
| `sw.js`, `manifest.webmanifest` | Lo que la vuelve PWA instalable y usable sin señal |
| `assets/img/` | Fotos generadas con Higgsfield (GPT Image 2.5) |

## Lo que falta para un piloto real

- Servidor y base de datos para que la pareja y el proveedor vean lo mismo en dispositivos distintos, en tiempo real.
- Envío real de SMS y correo, notificaciones push y pasarela de pago con medios de Colombia.
- Panel interno del piloto (I1). Hoy las métricas solo cuentan lo que pasa en un navegador.
- Página del proveedor separada y liviana (la especificación pide 150 KB o menos).
- Revisión legal de los textos de privacidad y términos.
