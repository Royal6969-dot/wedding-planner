// Contenido fijo del prototipo: categorías, estados, plantillas y el evento de ejemplo.
// Todo lo que dice "supuesto" en la especificación está aquí como dato editable.
(() => {
  "use strict";

  const CATEGORIES = [
    { id: "salon", name: "Salón o locación", short: "Salón", img: "venue-garden" },
    { id: "catering", name: "Catering y banquete", short: "Catering", img: "food-plated" },
    { id: "fotografia", name: "Fotografía", short: "Fotografía", img: "photo-classic" },
    { id: "video", name: "Video", short: "Video", img: "photo-video" },
    { id: "dj", name: "DJ y sonido", short: "DJ", img: "music-dj" },
    { id: "musica", name: "Música en vivo", short: "Música", img: "music-strings" },
    { id: "floristeria", name: "Floristería", short: "Flores", img: "flowers-roses" },
    { id: "decoracion", name: "Decoración y montaje", short: "Decoración", img: "vibe-classic" },
    { id: "iluminacion", name: "Iluminación y técnico", short: "Iluminación", img: "cat-iluminacion" },
    { id: "maquillaje", name: "Maquillaje y peinado", short: "Maquillaje", img: "cat-maquillaje" },
    { id: "pasteleria", name: "Pastelería", short: "Pastel", img: "cake-classic" },
    { id: "transporte", name: "Transporte", short: "Transporte", img: "extra-car" },
    { id: "oficiante", name: "Oficiante o ceremonia", short: "Oficiante", img: "cat-oficiante" },
    { id: "otro", name: "Otro", short: "Otro", img: null }
  ];

  const CEREMONIES = [
    { id: "religiosa", name: "Religiosa", blurb: "Iglesia o capilla", img: "cer-religiosa", title: "Ceremonia religiosa", dur: 60 },
    { id: "civil", name: "Civil", blurb: "Notaría o juzgado", img: "cer-civil", title: "Firma ante notario", dur: 30 },
    { id: "simbolica", name: "Simbólica", blurb: "A tu manera", img: "cer-simbolica", title: "Ceremonia simbólica", dur: 45 }
  ];

  // B3: estados del proveedor. tone = color del semáforo (siempre con palabra e ícono).
  const STATUS = {
    sin_invitar: { label: "Sin invitar", tone: "idle", icon: "dot" },
    invitado: { label: "Invitado", tone: "wait", icon: "send" },
    abrio: { label: "Abrió el enlace", tone: "wait", icon: "eye" },
    confirmo: { label: "Confirmó", tone: "ok", icon: "check" },
    pidio_cambio: { label: "Pidió cambio", tone: "wait", icon: "clock" },
    en_camino: { label: "En camino", tone: "ok", icon: "car" },
    en_lugar: { label: "En el lugar", tone: "ok", icon: "pin" },
    termino: { label: "Terminó", tone: "ok", icon: "flag" },
    retraso: { label: "Va con retraso", tone: "risk", icon: "alert" }
  };

  // E1: plantillas de mensaje. Variables: {proveedor} {pareja} {fecha} {hora} {lugar} {enlace}
  const TEMPLATES = [
    { id: "invitacion", name: "Invitación", text: "Hola, {proveedor}. Somos {pareja} y nuestra boda es el {fecha}. Para coordinar a todos en un solo lugar, confirma tu hora aquí: {enlace}. Toma menos de 1 minuto y no necesitas crear cuenta." },
    { id: "recordatorio", name: "Recordatorio", text: "Hola, {proveedor}. Te recordamos confirmar tu hora para la boda de {pareja} ({fecha}). Es un solo toque: {enlace}" },
    { id: "cambio", name: "Cambio de hora", text: "Hola, {proveedor}. Tu hora para la boda de {pareja} cambió a las {hora}. Revisa y reconfirma aquí: {enlace}" },
    { id: "retraso", name: "Retraso en cadena", text: "Hola, {proveedor}. Hubo un retraso en la boda de {pareja}. Tu nueva hora es {hora}. Toca 'Enterado' aquí: {enlace}" },
    { id: "diad", name: "Día D", text: "Hola, {proveedor}. ¡Hoy es la boda de {pareja}! Tu hora: {hora} en {lugar}. Marca 'Voy en camino' aquí: {enlace}" }
  ];

  // G3: precios que se prueban en la página de inicio (supuesto 2, sin validar)
  const PRICING = { variants: [20, 35, 50], copPerUsd: 4000, graceDays: 30 };

  const PAY_METHODS = [
    { id: "tarjeta", name: "Tarjeta" },
    { id: "pse", name: "PSE" },
    { id: "nequi", name: "Nequi" }
  ];

  const CHANNELS = ["Instagram", "TikTok", "Me lo recomendaron", "Aliado", "Otro"];

  // C1: plantilla de cronograma del Día D. Tiempos en minutos desde las 00:00 del día.
  // C = hora de ceremonia, R = inicio de recepción, E = cierre. after = [clave, holgura mínima].
  // El contenido es una sugerencia: debe validarse con proveedores reales antes del piloto.
  function scheduleTemplate(ev) {
    const C = ev.ceremonyTime;
    const R = ev.receptionStart;
    const E = ev.receptionEnd;
    const cer = CEREMONIES.find((c) => c.id === ev.ceremonyType) || CEREMONIES[0];
    const banquet = 60 + Math.round(ev.guests / 60) * 15;
    return [
      { key: "salon_open", cat: "salon", title: "Apertura del salón para montaje", start: R - 360, dur: 30, place: "recepcion", critical: true, reqs: ["Acceso para carga y descarga", "Punto eléctrico disponible"] },
      { key: "flores", cat: "floristeria", title: "Montaje de flores en ceremonia y mesas", start: R - 330, dur: 120, place: "recepcion", critical: true, after: [["salon_open", 0]], reqs: ["Mesas ya ubicadas", "Agua disponible"] },
      { key: "deco", cat: "decoracion", title: "Montaje de mesas y decoración", start: R - 330, dur: 120, place: "recepcion", after: [["salon_open", 0]], reqs: ["Plano de mesas impreso"] },
      { key: "luces", cat: "iluminacion", title: "Montaje de luces y sonido técnico", start: R - 190, dur: 70, place: "recepcion", critical: true, after: [["flores", 0], ["deco", 0]], reqs: ["2 tomas de 110 V cerca de la pista", "Escalera de 3 m"] },
      { key: "banquete", cat: "catering", title: "Montaje del banquete", start: R - 120, dur: banquet, place: "recepcion", critical: true, after: [["luces", 0], ["flores", 15]], reqs: [`Mesas para ${ev.guests} invitados`, "Cocina auxiliar habilitada"] },
      { key: "pastel", cat: "pasteleria", title: "Entrega y montaje del pastel", start: R - 60, dur: 30, place: "recepcion", after: [["deco", 0]], reqs: ["Mesa del pastel lista", "Lejos del sol directo"] },
      { key: "sonido", cat: "dj", title: "Prueba de sonido", start: R - 60, dur: 30, place: "recepcion", after: [["luces", 15]], reqs: ["Cabina del DJ instalada"] },
      { key: "maquillaje", cat: "maquillaje", title: "Maquillaje y peinado", start: C - 270, dur: 150, place: "preparacion", reqs: ["Buena luz natural", "Mesa y 2 sillas"] },
      { key: "foto_prep", cat: "fotografia", title: "Fotos de la preparación", start: C - 150, dur: 90, place: "preparacion" },
      { key: "video_prep", cat: "video", title: "Video de la preparación", start: C - 150, dur: 90, place: "preparacion" },
      { key: "recogida", cat: "transporte", title: "Recogida de la pareja", start: C - 50, dur: 40, place: "preparacion", after: [["maquillaje", 10]] },
      { key: "musica_cer", cat: "musica", title: "Música de la ceremonia", start: C - 20, dur: cer.dur + 20, place: "ceremonia", reqs: ["4 sillas sin brazos", "Sombra para los instrumentos"] },
      { key: "ceremonia", cat: "oficiante", title: cer.title, start: C, dur: cer.dur, place: "ceremonia", critical: true, after: [["recogida", 10]] },
      { key: "cobertura", cat: "fotografia", title: "Fotos de ceremonia y recepción", start: C - 15, dur: R + 180 - (C - 15), place: "ceremonia" },
      { key: "video_cob", cat: "video", title: "Video de ceremonia y recepción", start: C - 15, dur: R + 180 - (C - 15), place: "ceremonia" },
      { key: "coctel", cat: "musica", title: "Música del cóctel", start: R, dur: 60, place: "recepcion" },
      { key: "cena", cat: "catering", title: "Servicio de cena", start: R + 60, dur: 90, place: "recepcion", critical: true, after: [["banquete", 0]] },
      { key: "fiesta", cat: "dj", title: "Fiesta y baile", start: R + 150, dur: Math.max(60, E - (R + 150) - 30), place: "recepcion", after: [["cena", 0]] },
      { key: "salida", cat: "transporte", title: "Salida de la pareja", start: E - 30, dur: 30, place: "recepcion" }
    ];
  }

  // C4: calendario de preparación (días antes de la boda)
  function prepTemplate(ev) {
    const typeTask = {
      religiosa: "Documentos de la parroquia listos",
      civil: "Cita en la notaría confirmada",
      simbolica: "Guion de la ceremonia con el oficiante"
    }[ev.ceremonyType];
    return [
      { days: 84, title: "Firmar contratos y pagar anticipos", cats: null },
      { days: 60, title: "Prueba de menú", cats: ["catering"] },
      { days: 45, title: "Prueba de maquillaje y peinado", cats: ["maquillaje"] },
      { days: 35, title: "Reunión de estilo con flores y decoración", cats: ["floristeria", "decoracion"] },
      { days: 30, title: "Enviar lista de canciones", cats: ["dj", "musica"] },
      { days: 21, title: "Visita técnica al salón", cats: ["iluminacion", "salon"] },
      { days: 14, title: "Número final de invitados al catering", cats: ["catering"] },
      { days: 10, title: typeTask, cats: null },
      { days: 7, title: "Ensayo de la ceremonia", cats: ["oficiante"] },
      { days: 2, title: "Confirmar horas del Día D con todos", cats: null }
    ];
  }

  // H1 / L2: boda de ejemplo con datos ficticios
  const EXAMPLE = {
    names: ["Isabella", "Gabriel"],
    phone: "+57 300 000 0100",
    date: "2026-12-12",
    ceremonyTime: 16 * 60,
    receptionStart: 18 * 60,
    receptionEnd: 25 * 60,
    ceremonyType: "religiosa",
    city: "Rionegro, Antioquia",
    places: { ceremonia: "Capilla del Bosque", recepcion: "Hacienda Los Almendros", preparacion: "Casa de Isabella" },
    guests: 120,
    vendors: [
      { cat: "salon", name: "Hacienda Los Almendros", contact: "Marta Ruiz", status: "confirmo", hoursAgo: 72, total: 18000000, paid: 9000000, payDays: 20 },
      { cat: "floristeria", name: "Flores del Campo", contact: "Camila Ortiz", status: "confirmo", hoursAgo: 50, total: 4500000, paid: 1500000, payDays: 15 },
      { cat: "decoracion", name: "Decoraciones Aura", contact: "Julián Mesa", status: "confirmo", hoursAgo: 30, byCouple: "Confirmó por teléfono", total: 6000000, paid: 3000000, payDays: 15 },
      { cat: "iluminacion", name: "Luz Viva Técnica", contact: "Diego Pérez", status: "abrio", hoursAgo: 20, total: 3200000, paid: 1000000, payDays: 10 },
      { cat: "catering", name: "Sabor & Mesa", contact: "Paula Restrepo", status: "confirmo", hoursAgo: 96, total: 11400000, paid: 5700000, payDays: 14 },
      { cat: "pasteleria", name: "Dulce Taller", contact: "Sofía Gil", status: "sin_invitar", total: 1200000, paid: 400000, payDays: 7 },
      { cat: "dj", name: "DJ Santi Ríos", contact: "Santiago Ríos", status: "invitado", hoursAgo: 60, total: 2800000, paid: 1000000, payDays: 10 },
      { cat: "musica", name: "Cuarteto Andante", contact: "Elena Vargas", status: "confirmo", hoursAgo: 40, total: 2400000, paid: 1200000, payDays: 10 },
      { cat: "maquillaje", name: "Glam by Caro", contact: "Carolina López", status: "pidio_cambio", hoursAgo: 5, request: { time: 11 * 60 + 45, note: "Tengo otra novia temprano, ¿puedo llegar 15 min más tarde?" }, total: 900000, paid: 300000, payDays: 5 },
      { cat: "fotografia", name: "Ana Gómez Fotografía", contact: "Ana Gómez", status: "confirmo", hoursAgo: 120, total: 4800000, paid: 2400000, payDays: 12 },
      { cat: "transporte", name: "Clásicos del Oriente", contact: "Mauricio Henao", status: "invitado", hoursAgo: 8, total: 700000, paid: 0, payDays: 6 },
      { cat: "oficiante", name: "Parroquia del Bosque", contact: "Secretaría parroquial", status: "confirmo", hoursAgo: 200, total: 500000, paid: 500000, payDays: null }
    ]
  };

  const SAMPLE_CSV = [
    "Categoría;Nombre;Contacto;WhatsApp;Correo",
    "Floristería;Flores del Campo;Camila Ortiz;3000000201;camila@ejemplo.com",
    "Catering;Sabor & Mesa;Paula Restrepo;+57 300 000 0202;",
    "DJ;DJ Santi Ríos;Santiago Ríos;300 000 0203;",
    "Fotografía;Ana Gómez Fotografía;Ana Gómez;30000;ana@ejemplo.com",
    "Globos;Fiesta Total;Pedro Gil;+57 300 000 0205;"
  ].join("\n");

  window.CP_DATA = { CATEGORIES, CEREMONIES, STATUS, TEMPLATES, PRICING, PAY_METHODS, CHANNELS, EXAMPLE, SAMPLE_CSV, scheduleTemplate, prepTemplate };
})();
