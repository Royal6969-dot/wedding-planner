// Coolplanners · prototipo navegable (sin servidor). Todo vive en localStorage.
// Los códigos entre corchetes (A1, C5, D3…) remiten a la especificación.
(() => {
  "use strict";

  const D = window.CP_DATA;
  const STORE = "coolplanners-prototipo-v1";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();

  // ---------- utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const imgSrc = (n) => `assets/img/${n}.webp`;
  const pad = (n) => String(n).padStart(2, "0");
  const uid = (p) => `${p}${Math.random().toString(36).slice(2, 9)}`;
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const catOf = (id) => D.CATEGORIES.find((c) => c.id === id) || D.CATEGORIES[D.CATEGORIES.length - 1];

  // D1: identificador largo y aleatorio, imposible de adivinar
  function newToken() {
    const a = new Uint8Array(18);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 28);
  }

  const copFmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const cop = (n) => copFmt.format(Math.round(n));

  // horas en formato de 12 h con a. m. / p. m.
  const fmtT = (m) => {
    const x = ((Math.round(m) % 1440) + 1440) % 1440;
    const h = Math.floor(x / 60);
    return `${h % 12 || 12}:${pad(x % 60)} ${h < 12 ? "a. m." : "p. m."}`;
  };
  const hourLabel = (h) => `${h % 12 || 12} ${h % 24 < 12 ? "a. m." : "p. m."}`;
  const fmtDur = (d) => (d >= 60 ? `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60} min` : ""}` : `${d} min`);
  const toMin = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
    return m ? +m[1] * 60 + +m[2] : null;
  };
  const toHHMM = (m) => `${pad(Math.floor((((m % 1440) + 1440) % 1440) / 60))}:${pad(((m % 60) + 60) % 60)}`;

  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const longDate = (s) => { const d = fromISO(s); return d ? d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""; };
  const dayMonth = (s) => { const d = fromISO(s); return d ? d.toLocaleDateString("es-CO", { day: "numeric", month: "long" }) : ""; };
  const shortDate = (d) => d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  const daysUntil = (s) => { const d = fromISO(s); const t = new Date(); t.setHours(0, 0, 0, 0); return d ? Math.round((d - t) / 86400000) : null; };
  const clockOf = (ts) => { const d = new Date(ts); return fmtT(d.getHours() * 60 + d.getMinutes()); };

  function rel(ts) {
    if (!ts) return "";
    const min = (Date.now() - ts) / 60000;
    if (min < 1) return "ahora";
    if (min < 60) return `hace ${Math.round(min)} min`;
    const h = min / 60;
    if (h < 24) return `hace ${Math.round(h)} h`;
    const days = Math.round(h / 24);
    return `hace ${plural(days, "día", "días")}`;
  }

  // B1: WhatsApp con formato de Colombia (celular 3xx) o de otro país con +
  function normPhone(raw) {
    const s = String(raw || "").trim();
    const d = s.replace(/\D/g, "");
    if (!d) return null;
    const co = (n) => `+57 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
    if (d.length === 10 && d[0] === "3") return co(d);
    if (d.length === 12 && d.startsWith("573")) return co(d.slice(2));
    if (s.startsWith("+") && !d.startsWith("57") && d.length >= 8 && d.length <= 15) return `+${d}`;
    return null;
  }
  const digits = (p) => String(p || "").replace(/\D/g, "");
  const telHref = (p) => `tel:+${digits(p)}`;
  const waHref = (p, text) => `https://wa.me/${digits(p)}?text=${encodeURIComponent(text)}`;
  const mapsHref = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  const wazeHref = (q) => `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
  const baseUrl = () => location.href.split("#")[0];

  // ---------- íconos ----------
  const ICONS = {
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
    send: '<path d="M4 12 20 4l-6 16-3-7-7-1Z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    car: '<path d="M3 13l2-5h14l2 5v5h-3v-2H6v2H3z"/><path d="M7 13h.01M17 13h.01"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
    chat: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.3L4 20Z"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    more: '<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    unlink: '<path d="M9 15l6-6M10 6.5l1-1a4.5 4.5 0 0 1 6.4 6.4l-1 1M14 17.5l-1 1a4.5 4.5 0 0 1-6.4-6.4l1-1M3 3l18 18"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    wifioff: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.7M14 9.8a10 10 0 0 1 5 2.7M2 8.8a15 15 0 0 1 4.5-2.9M12 20h.01"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
    msg: '<path d="M4 5h16v11H8l-4 4V5Z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    invite: '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'
  };
  const icon = (n, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;

  function thumb(catId, cls = "") {
    const c = catOf(catId);
    return c.img
      ? `<img class="thumb ${cls}" src="${imgSrc(c.img)}" alt="" width="44" height="44" loading="lazy">`
      : `<span class="thumb ${cls}" style="background:var(--peach)" aria-hidden="true">${icon("plus")}</span>`;
  }
  const pill = (statusId) => { const s = D.STATUS[statusId] || D.STATUS.sin_invitar; return `<span class="pill" data-tone="${s.tone}">${icon(s.icon)}${s.label}</span>`; };
  const tonePill = (tone, label, ic) => `<span class="pill" data-tone="${tone}">${icon(ic)}${esc(label)}</span>`;

  // ---------- estado ----------
  function freshState() {
    return { v: 1, variant: null, channel: null, own: null, example: null, current: null, draft: null, ui: { view: "landing" }, metrics: [] };
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || "null");
      if (s && s.v === 1) return { ...freshState(), ...s };
    } catch { /* sin almacenamiento: arrancamos de cero */ }
    return freshState();
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ ...state, ui: { ...state.ui, sheet: null } })); } catch { /* modo privado */ }
  }
  let state = load();
  const ev = () => (state.current ? state[state.current] : null);
  const sessionFlags = {};

  // G1: analítica de producto, sin datos personales
  function track(n, p = {}) {
    state.metrics.push({ n, t: Date.now(), p });
    if (state.metrics.length > 800) state.metrics.splice(0, state.metrics.length - 800);
  }

  // ---------- modelo del evento ----------
  const byStart = (a, b) => a.start - b.start;
  const taskById = (e, id) => e.tasks.find((t) => t.id === id);
  const vendorById = (e, id) => e.vendors.find((v) => v.id === id);
  const tasksOf = (e, vid) => e.tasks.filter((t) => t.vendorId === vid).sort(byStart);
  const coupleName = (e) => e.names.filter(Boolean).join(" y ") || "La pareja";
  const coupleShort = (e) => e.names.filter(Boolean).join(" & ") || "Nuestra boda";
  const coupleActor = (e) => `${e.names[0] || "Titular"} (titular)`;
  const PLACE_LABEL = { ceremonia: "Ceremonia", recepcion: "Recepción", preparacion: "Preparación" };
  const placeName = (e, key) => e.places[key] || `Lugar de ${(PLACE_LABEL[key] || key).toLowerCase()}`;
  const placeQuery = (e, key) => [e.places[key], e.city].filter(Boolean).join(", ");
  const isConfirmedLike = (st) => ["confirmo", "en_camino", "en_lugar", "termino"].includes(st);

  function setStatus(v, status, by, note = "") {
    v.status = status;
    v.statusAt = Date.now();
    v.statusBy = by;
    v.statusNote = note;
  }
  function log(e, entry) {
    e.log.push({ id: uid("l"), at: Date.now(), ...entry });
  }

  function makeVendor(src) {
    return {
      id: uid("v"), cat: src.cat, name: src.name || catOf(src.cat).name, contact: src.contact || "",
      phone: src.phone || "", email: src.email || "", notes: "",
      status: "sin_invitar", statusAt: Date.now(), statusBy: null, statusNote: "",
      token: newToken(), revoked: false, consent: null,
      sentAt: null, openedAt: null, respondedAt: null,
      request: null, question: null, change: null, delay: 0,
      total: src.total || 0, paid: src.paid || 0, payDue: null
    };
  }

  // C1: cronograma sugerido a partir de la hora, el tipo de ceremonia, los invitados y las categorías
  function templateTasksFor(e, cats) {
    const owner = {};
    e.vendors.forEach((v) => { if (!owner[v.cat]) owner[v.cat] = v.id; });
    const rows = D.scheduleTemplate(e).filter((r) => owner[r.cat] && cats.includes(r.cat));
    return rows.map((r) => ({ id: uid("t"), key: r.key, title: r.title, vendorId: owner[r.cat], start: r.start, dur: r.dur, place: r.place, reqs: r.reqs || [], notes: "", critical: !!r.critical, afterKeys: r.after || [], after: [] }));
  }
  function linkTemplateDeps(e) {
    const byKey = {};
    e.tasks.forEach((t) => { if (t.key) byKey[t.key] = t; });
    const tpl = D.scheduleTemplate(e);
    for (const row of tpl) {
      const t = byKey[row.key];
      if (!t) continue;
      for (const [k, gap] of row.after || []) {
        const dep = byKey[k];
        if (dep && !t.after.some((a) => a.id === dep.id) && !(t.removedDeps || []).includes(dep.id)) t.after.push({ id: dep.id, gap });
      }
      delete t.afterKeys;
    }
  }
  function generatePrep(e) {
    const cats = new Set(e.vendors.map((v) => v.cat));
    const wed = fromISO(e.date);
    const today = new Date();
    return D.prepTemplate(e)
      .filter((p) => !p.cats || p.cats.some((c) => cats.has(c)))
      .map((p) => {
        const d = addDays(wed, -p.days);
        const cat = p.cats ? p.cats.find((c) => cats.has(c)) : null;
        return { id: uid("p"), title: p.title, date: toISO(d), cat, done: e.example && d < today };
      });
  }
  function buildEvent(src, example = false) {
    const e = {
      id: uid("ev"), example, names: [...src.names], phone: src.phone || "", date: src.date,
      ceremonyTime: src.ceremonyTime, receptionStart: src.receptionStart, receptionEnd: src.receptionEnd,
      ceremonyType: src.ceremonyType, city: src.city, places: { ...(src.places || {}) }, guests: src.guests,
      tz: "America/Bogota", vendors: [], tasks: [], prep: [], log: [],
      activated: false, payment: null, pending: null,
      dday: { on: false, clock: null, updatedAt: null, simPrepared: false },
      templates: {}, createdAt: Date.now()
    };
    e.vendors = (src.vendors || []).map(makeVendor);
    e.tasks = templateTasksFor(e, e.vendors.map((v) => v.cat));
    linkTemplateDeps(e);
    e.prep = generatePrep(e);
    return e;
  }
  function addTasksForVendor(e, v) {
    if (e.tasks.some((t) => vendorById(e, t.vendorId)?.cat === v.cat)) return 0;
    const fresh = templateTasksFor(e, [v.cat]).map((t) => ({ ...t, vendorId: v.id }));
    e.tasks.push(...fresh);
    linkTemplateDeps(e);
    return fresh.length;
  }

  // H1 / L2: boda de ejemplo con estados variados
  function buildExample() {
    const X = D.EXAMPLE;
    const e = buildEvent({ ...X, vendors: X.vendors.map((v) => ({ cat: v.cat, name: v.name, contact: v.contact, total: v.total, paid: v.paid })) }, true);
    const now = Date.now();
    const H = 3600e3;
    const entries = [];
    const add = (at, entry) => entries.push({ id: uid("l"), at, ...entry });
    X.vendors.forEach((sv, i) => {
      const v = e.vendors[i];
      v.phone = `+57 300 000 01${pad(i + 1)}`;
      v.email = `${sv.contact.split(" ")[0].toLowerCase()}@ejemplo.com`.normalize("NFD").replace(/[̀-ͯ]/g, "");
      v.payDue = sv.payDays ? toISO(addDays(new Date(), sv.payDays)) : null;
      const at = now - (sv.hoursAgo || 0) * H;
      const who = `${v.name} (proveedor)`;
      if (sv.status === "sin_invitar") return;
      v.sentAt = sv.status === "invitado" ? at : at - 6 * H;
      add(v.sentAt, { by: "pareja", who: `${X.names[0]} (titular)`, vendorId: v.id, text: "Envió el enlace por WhatsApp. SMS y correo automáticos enviados." });
      if (sv.status === "invitado") { v.status = "invitado"; v.statusAt = at; return; }
      v.openedAt = sv.status === "abrio" ? at : at - 2 * H;
      add(v.openedAt, { by: "proveedor", who, vendorId: v.id, text: "Abrió su enlace" });
      if (sv.status === "abrio") { v.status = "abrio"; v.statusAt = at; return; }
      v.consent = { at: v.openedAt, whatsappSms: true };
      v.respondedAt = at;
      if (sv.status === "pidio_cambio") {
        v.request = { ...sv.request };
        v.status = "pidio_cambio"; v.statusAt = at; v.statusBy = "proveedor";
        add(at, { by: "proveedor", who, vendorId: v.id, text: `Pidió otra hora: ${fmtT(sv.request.time)}. "${sv.request.note}"` });
        return;
      }
      v.status = "confirmo"; v.statusAt = at;
      v.statusBy = sv.byCouple ? "pareja" : "proveedor";
      v.statusNote = sv.byCouple || "";
      add(at, sv.byCouple
        ? { by: "pareja", who: `${X.names[1]} (co-organizador)`, vendorId: v.id, text: `Marcó "Confirmó" a nombre del proveedor: ${sv.byCouple}` }
        : { by: "proveedor", who, vendorId: v.id, text: "Confirmó su hora" });
    });
    e.log = entries.sort((a, b) => a.at - b.at);
    e.activated = true;
    e.payment = paymentRecord(e, "PSE", now - 200 * H);
    return e;
  }

  function paymentRecord(e, method, at = Date.now()) {
    const usd = state.variant || D.PRICING.variants[1];
    return {
      no: `CP-${new Date(at).getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      at, usd, cop: usd * D.PRICING.copPerUsd, method,
      validUntil: toISO(addDays(fromISO(e.date), D.PRICING.graceDays))
    };
  }

  // ---------- dependencias y cascada (C3, C5) ----------
  function ancestors(e, id) {
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      const t = taskById(e, stack.pop());
      for (const a of t?.after || []) if (!seen.has(a.id)) { seen.add(a.id); stack.push(a.id); }
    }
    return seen;
  }
  function descendants(e, id) {
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const t of e.tasks) if (t.after.some((a) => a.id === cur) && !seen.has(t.id)) { seen.add(t.id); stack.push(t.id); }
    }
    return seen;
  }
  const wouldCycle = (e, taskId, depId) => taskId === depId || ancestors(e, depId).has(taskId);

  function topo(tasks) {
    const indeg = new Map(tasks.map((t) => [t.id, 0]));
    const out = new Map(tasks.map((t) => [t.id, []]));
    tasks.forEach((t) => t.after.forEach((a) => { if (out.has(a.id)) { indeg.set(t.id, indeg.get(t.id) + 1); out.get(a.id).push(t.id); } }));
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const q = tasks.filter((t) => indeg.get(t.id) === 0).map((t) => t.id);
    const order = [];
    while (q.length) {
      const id = q.shift();
      order.push(byId.get(id));
      for (const n of out.get(id)) { indeg.set(n, indeg.get(n) - 1); if (indeg.get(n) === 0) q.push(n); }
    }
    return order;
  }

  // Lo que depende de la tarea se corre solo lo que la holgura no absorba.
  function cascade(e, rootId, newStart) {
    const start = new Map(e.tasks.map((t) => [t.id, t.start]));
    start.set(rootId, newStart);
    const down = descendants(e, rootId);
    for (const t of topo(e.tasks)) {
      if (!down.has(t.id)) continue;
      let s = t.start;
      for (const a of t.after) {
        const d = taskById(e, a.id);
        if (d) s = Math.max(s, start.get(d.id) + d.dur + a.gap);
      }
      start.set(t.id, s);
    }
    return e.tasks
      .filter((t) => start.get(t.id) !== t.start)
      .map((t) => ({ id: t.id, from: t.start, to: start.get(t.id) }))
      .sort((a, b) => (a.id === rootId ? -1 : b.id === rootId ? 1 : a.from - b.from));
  }

  function affectedVendors(e, proposal, changes) {
    const root = taskById(e, proposal.rootId);
    const ids = new Set();
    for (const c of changes) {
      const vid = taskById(e, c.id)?.vendorId;
      if (vid && !(vid === root?.vendorId && proposal.reporter !== "pareja")) ids.add(vid);
    }
    if (proposal.reporter === "pareja" && root) ids.add(root.vendorId);
    return [...ids].map((id) => vendorById(e, id)).filter(Boolean);
  }

  function applyProposal(e, p) {
    const changes = cascade(e, p.rootId, p.newStart);
    const root = taskById(e, p.rootId);
    const rootVendor = root && vendorById(e, root.vendorId);
    const who = coupleActor(e);
    const notify = affectedVendors(e, p, changes);
    for (const c of changes) {
      const t = taskById(e, c.id);
      t.start = c.to;
      log(e, { by: "pareja", who, taskId: t.id, vendorId: t.vendorId, text: `Aprobó mover "${t.title}" de ${fmtT(c.from)} a ${fmtT(c.to)}. Causa: ${p.cause}` });
    }
    for (const v of notify) {
      const own = changes.find((c) => taskById(e, c.id)?.vendorId === v.id);
      if (own) v.change = { from: own.from, to: own.to, reason: p.cause, title: taskById(e, own.id).title, at: Date.now() };
    }
    if (rootVendor && p.reporter === "proveedor" && rootVendor.request) {
      rootVendor.request = null;
      setStatus(rootVendor, "confirmo", "pareja", "Aceptamos su nueva hora");
    }
    if (rootVendor) rootVendor.delay = 0;
    if (rootVendor && p.reporter === "sistema" && !["en_lugar", "termino"].includes(rootVendor.status)) {
      setStatus(rootVendor, "retraso", "sistema", "No marcó 'Llegué' a tiempo");
    }
    if (notify.length) {
      log(e, {
        by: "sistema", who: "Coolplanners",
        text: e.activated
          ? `Aviso enviado por SMS y correo a: ${notify.map((v) => v.name).join(", ")}. Su enlace muestra "Tu hora cambió".`
          : `Cambio guardado. No se avisó a nadie porque el evento no está activado.`
      });
    }
    if (e.pending && e.pending.rootId === p.rootId) e.pending = null;
    track("cascade_approved", { affected: notify.length, dday: e.dday.on, ms: p.at ? Date.now() - p.at : null });
    return notify;
  }

  // ---------- Día D (F1–F3) ----------
  function ddayTaskState(e, t) {
    const clock = e.dday.clock;
    const v = vendorById(e, t.vendorId);
    const st = v?.status;
    const first = v && tasksOf(e, v.id)[0]?.id === t.id;
    if (clock >= t.start + t.dur) return { tone: "ok", label: "Lista", icon: "check", done: true };
    if (first && (st === "retraso" || (clock >= t.start + 15 && !["en_lugar", "termino"].includes(st)))) return { tone: "risk", label: "Retrasada", icon: "x" };
    if (e.pending && cascade(e, e.pending.rootId, e.pending.newStart).some((c) => c.id === t.id)) return { tone: "wait", label: "En riesgo", icon: "alert" };
    if (first && clock >= t.start - 30 && !["en_camino", "en_lugar", "termino"].includes(st)) return { tone: "wait", label: "En riesgo", icon: "alert" };
    return { tone: "ok", label: "A tiempo", icon: "dot" };
  }

  function vendorDelay(e, v, min, reporter) {
    const clock = e.dday.on ? e.dday.clock : -1;
    const t = tasksOf(e, v.id).find((x) => x.start + x.dur > clock) || tasksOf(e, v.id)[0];
    setStatus(v, "retraso", reporter, `${min} min`);
    v.delay = min;
    log(e, { by: reporter, who: reporter === "proveedor" ? `${v.name} (proveedor)` : "Coolplanners", vendorId: v.id, text: `Reportó "Voy con retraso": ${min} min` });
    track("delay_reported", { min });
    if (t) e.pending = { rootId: t.id, newStart: t.start + min, cause: `${v.name} va ${min} min tarde`, reporter: "proveedor", at: Date.now() };
  }

  function simTick(e) {
    const clock = e.dday.clock;
    const rank = { confirmo: 0, retraso: 0, en_camino: 1, en_lugar: 2, termino: 3 };
    for (const v of e.vendors) {
      const ts = tasksOf(e, v.id);
      if (!ts.length || !(v.status in rank)) continue;
      const first = ts[0].start + (v.status === "retraso" ? v.delay || 0 : 0);
      const last = Math.max(...ts.map((t) => t.start + t.dur));
      let next = v.status;
      if (clock >= last) next = "termino";
      else if (clock >= first - 15) next = "en_lugar";
      else if (clock >= first - 45 && v.status !== "retraso") next = "en_camino";
      if (rank[next] > rank[v.status]) {
        setStatus(v, next, "proveedor");
        if (next !== "en_camino") v.delay = 0;
        log(e, { by: "proveedor", who: `${v.name} (proveedor)`, vendorId: v.id, text: `Marcó "${D.STATUS[next].label}" a las ${fmtT(clock)}` });
      }
    }
    if (e.pending) return;
    for (const v of e.vendors) {
      const t0 = tasksOf(e, v.id)[0];
      if (!t0 || clock < t0.start + 15 || ["en_lugar", "termino", "retraso"].includes(v.status)) continue;
      const late = Math.ceil((clock - t0.start) / 15) * 15;
      e.pending = { rootId: t0.id, newStart: t0.start + late, cause: `${v.name} no ha marcado "Llegué" (${clock - t0.start} min después de su hora)`, reporter: "sistema", at: Date.now() };
      log(e, { by: "sistema", who: "Coolplanners", vendorId: v.id, text: `Alerta: ${v.name} no ha marcado "Llegué"` });
      break;
    }
  }

  // ---------- mensajes (E1) ----------
  const tplText = (e, id) => e.templates[id] || D.TEMPLATES.find((t) => t.id === id).text;
  const fillTpl = (e, id, v, vars = {}) => fillText(e, tplText(e, id), v, vars);
  function fillText(e, base, v, vars = {}) {
    const t = tasksOf(e, v.id)[0];
    const map = {
      proveedor: (v.contact || v.name).split(" ")[0],
      pareja: coupleName(e),
      fecha: dayMonth(e.date),
      hora: vars.hora || (t ? fmtT(t.start) : "por definir"),
      lugar: t ? placeName(e, t.place) : e.city,
      enlace: `${baseUrl()}#p-${v.token}`
    };
    return base.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m)).replace(/m\.\./g, "m.");
  }

  // ---------- navegación ----------
  const root = $("#app");
  const sheetRoot = $("#sheet-root");
  let lastViewKey = "";
  let lastSheetKey = "";
  const snapshot = () => JSON.parse(JSON.stringify(state.ui));

  let depth = 0; // entradas de historial creadas en esta sesión
  function nav(patch, { push = true } = {}) {
    Object.assign(state.ui, patch);
    if (!("sheet" in patch)) state.ui.sheet = null;
    save();
    render();
    if (push) { history.pushState({ ui: snapshot() }, ""); depth++; }
    else history.replaceState({ ui: snapshot() }, "");
  }
  function goBack(fallback) {
    if (depth > 0) history.back();
    else nav(fallback, { push: false });
  }
  function openSheet(sheet) {
    state.ui.sheet = sheet;
    renderSheet();
    history.pushState({ ui: snapshot() }, "");
    depth++;
  }
  function updateSheet(patch) {
    Object.assign(state.ui.sheet, patch);
    renderSheet();
    history.replaceState({ ui: snapshot() }, "");
  }
  function closeSheet() {
    if (history.state && history.state.ui && history.state.ui.sheet) history.back();
    else { state.ui.sheet = null; renderSheet(); }
  }
  window.addEventListener("popstate", (e) => {
    depth = Math.max(0, depth - 1);
    state.ui = (e.state && e.state.ui) || { view: "landing" };
    render();
  });

  function render() {
    const u = state.ui;
    const e = ev();
    if (u.view === "app" && !e) u.view = "landing";
    if (u.view === "onb" && !state.draft && state.current === "own" && state.own) Object.assign(u, { view: "app", tab: "inicio" });
    document.body.dataset.view = u.view;
    document.documentElement.classList.toggle("dday", u.view === "app" && !!e?.dday.on);
    let html;
    if (u.view === "auth") html = viewAuth();
    else if (u.view === "onb") html = viewOnb();
    else if (u.view === "app") html = viewApp(e);
    else if (u.view === "vendor") html = viewVendor();
    else html = viewLanding();
    const key = `${u.view}|${u.tab || ""}|${u.onbStep || ""}|${u.cronoView || ""}|${u.vendorId || ""}|${e?.dday.on ? 1 : 0}`;
    root.innerHTML = `<div class="${key !== lastViewKey && !reduceMotion ? "enter" : ""}">${html}</div>`;
    if (key !== lastViewKey) window.scrollTo(0, 0);
    lastViewKey = key;
    renderSheet();
  }

  function renderSheet() {
    const s = state.ui.sheet;
    if (!s) {
      sheetRoot.innerHTML = "";
      document.body.style.overflow = "";
      lastSheetKey = "";
      return;
    }
    const fn = SHEETS[s.type];
    const e = state.ui.view === "vendor" ? state[state.ui.vendorEvent] : ev();
    if (!fn || !e) { state.ui.sheet = null; return renderSheet(); }
    const key = `${s.type}|${s.id || ""}`;
    const old = $(".sheet", sheetRoot);
    const scroll = old && key === lastSheetKey ? old.scrollTop : 0;
    sheetRoot.innerHTML = `<div class="sheet-wrap" role="dialog" aria-modal="true">
      <button class="sheet-backdrop" type="button" data-act="close-sheet" aria-label="Cerrar" ${key === lastSheetKey ? 'style="animation:none"' : ""}></button>
      <div class="sheet" tabindex="-1" ${key === lastSheetKey ? 'style="animation:none"' : ""}><div class="sheet__grab" aria-hidden="true"></div>${fn(e, s)}</div>
    </div>`;
    const el = $(".sheet", sheetRoot);
    el.scrollTop = scroll;
    if (key !== lastSheetKey) el.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    lastSheetKey = key;
  }

  const sheetHead = (eyebrow, title) => `<div class="sheet__head"><span class="eyebrow">${esc(eyebrow)}</span><button class="icon-btn icon-btn--soft" type="button" data-act="close-sheet" aria-label="Cerrar">${icon("x")}</button></div>${title ? `<h2 class="display h2">${esc(title)}</h2>` : ""}`;

  let toastT = null;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("is-on"), 3200);
  }

  function copyText(text, okMsg) {
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
      toast(ok ? okMsg : "No se pudo copiar aquí. Mantén presionado el texto para copiarlo.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(okMsg), fallback);
    else fallback();
  }

  // =====================================================================
  // L1 · Página de inicio
  // =====================================================================
  function viewLanding() {
    if (!state.variant) { state.variant = pickOne(D.PRICING.variants); save(); }
    if (!sessionFlags.landing) { sessionFlags.landing = true; track("landing_view", { usd: state.variant }); save(); }
    const usd = state.variant;
    const own = state.own;
    return `
    <div class="land-top">
      <figure class="land-hero" style="margin:0">
        <img src="${imgSrc("hero-hacienda")}" alt="Hacienda colombiana preparada para una boda al atardecer" width="720" height="960">
        <figcaption class="land-hero__copy">
          <span class="brand">Coolplanners</span>
          <h1 class="display h1">Tu boda coordinada sin Excel ni 12 chats</h1>
          <p>Un cronograma que avisa solo a cada proveedor cuando algo cambia. Ellos confirman con un toque, sin crear cuenta ni descargar nada.</p>
        </figcaption>
      </figure>
      <div class="land-body"><div class="wrap stack">
        <div class="stack--s">
          ${own ? `<button class="btn btn--primary btn--lg btn--block" type="button" data-act="open-own">Abrir mi evento · ${esc(coupleShort(own))}</button>` : ""}
          <button class="btn ${own ? "btn--ghost" : "btn--primary"} btn--lg btn--block" type="button" data-act="example">Ver una boda de ejemplo</button>
          ${own ? "" : `<button class="btn btn--ghost btn--lg btn--block" type="button" data-act="start">Crear mi evento gratis</button>`}
          <p class="small muted" style="text-align:center">El ejemplo no pide registro.</p>
        </div>

        <section class="panel panel--lilac stack">
          <h2 class="display h3">Así funciona</h2>
          <ol class="steps">
            <li><div><strong>Carga tus proveedores</strong><div class="small muted">Por categoría o importando tu Excel.</div></div></li>
            <li><div><strong>Te sugerimos el cronograma del Día D</strong><div class="small muted">Con quién debe terminar antes de quién.</div></div></li>
            <li><div><strong>Cada proveedor confirma desde un enlace</strong><div class="small muted">Si algo se mueve, la app reajusta y avisa solo a los afectados.</div></div></li>
          </ol>
        </section>

        <section class="panel panel--sky stack--s" aria-label="Así se ve tu tablero">
          <span class="eyebrow">Así se ve tu tablero</span>
          <div class="teaser">
            <div class="item">${thumb("floristeria")}<div><div class="item__title">Flores del Campo</div><div class="item__sub">Montaje 12:30 p. m.</div></div>${pill("confirmo")}</div>
            <div class="item">${thumb("iluminacion")}<div><div class="item__title">Luz Viva Técnica</div><div class="item__sub">Montaje 2:50 p. m.</div></div>${pill("abrio")}</div>
            <div class="item">${thumb("dj")}<div><div class="item__title">DJ Santi Ríos</div><div class="item__sub">No responde hace 2 días</div></div>${tonePill("risk", "Llamar", "phone")}</div>
          </div>
        </section>

        <section class="panel panel--mint stack--s">
          <span class="eyebrow">Pago único por evento</span>
          <div class="price">USD ${usd}</div>
          <p class="muted">≈ ${cop(usd * D.PRICING.copPerUsd)} COP. Incluye todo, vigente hasta ${D.PRICING.graceDays} días después de tu boda. Tus proveedores nunca pagan.</p>
          <p class="small">Armar tu evento y ver el cronograma es gratis. Pagas solo cuando quieras enviar los enlaces.</p>
        </section>

        <section class="panel panel--peach stack--s">
          <h2 class="display h3">No es un directorio</h2>
          <p>Coolplanners no te vende proveedores ni muestra publicidad. Es para coordinar a los que ya contrataste.</p>
        </section>

        <p class="small muted">Prototipo navegable para validar con parejas y proveedores. "Coolplanners" es el nombre de trabajo. Los datos se guardan solo en este navegador.</p>
      </div></div>
    </div>`;
  }

  // =====================================================================
  // A1 · Registro
  // =====================================================================
  function viewAuth() {
    return `
    <header class="topnav"><div class="wrap topnav__row">
      <button class="icon-btn" type="button" data-act="back" aria-label="Volver">${icon("left")}</button>
      <span class="brand">Coolplanners</span><span></span>
    </div></header>
    <main class="wrap page stack">
      <div class="stack--s">
        <h1 class="display h2">Crea tu evento</h1>
        <p class="muted">Armar tu cronograma es gratis. Sin contraseñas.</p>
      </div>
      <button class="btn btn--primary btn--lg btn--block" type="button" data-act="auth" data-method="google">Continuar con Google</button>
      <div class="field">
        <label class="label" for="auth-email">O recibe un enlace en tu correo</label>
        <input class="input" id="auth-email" type="email" placeholder="tu@correo.com" autocomplete="email">
        <button class="btn btn--ghost btn--block" type="button" data-act="auth" data-method="email">Enviarme el enlace</button>
      </div>
      <div class="field">
        <span class="label">¿Cómo nos conociste? (opcional)</span>
        <div class="chips">${D.CHANNELS.map((c) => `<button class="chip" type="button" data-act="channel" data-v="${esc(c)}" aria-pressed="${state.channel === c}">${esc(c)}</button>`).join("")}</div>
      </div>
      <p class="small muted">Al continuar aceptas los términos y la política de tratamiento de datos (Ley 1581 de 2012). Prototipo: no se crea ninguna cuenta real.</p>
    </main>`;
  }

  // =====================================================================
  // P13 · Onboarding en 4 pasos
  // =====================================================================
  function newDraft() {
    let d = addDays(new Date(), 120);
    d = addDays(d, (6 - d.getDay() + 7) % 7);
    return { names: ["", ""], date: toISO(d), time: "16:00", city: "", guests: 120, ceremonyType: null, places: { ceremonia: "", recepcion: "" }, phone: "", recStart: "", recEnd: "", cats: [], info: {}, tried: false, startedAt: Date.now() };
  }
  function draftSource(d) {
    const C = toMin(d.time) ?? 16 * 60;
    const R = toMin(d.recStart) ?? C + 120;
    let E = toMin(d.recEnd) ?? R + 420;
    if (E <= R) E += 1440;
    return {
      names: d.names.map((n) => n.trim()), phone: normPhone(d.phone) || "", date: d.date, ceremonyTime: C, receptionStart: R, receptionEnd: E,
      ceremonyType: d.ceremonyType || "religiosa", city: d.city.trim(), guests: d.guests,
      places: { ceremonia: d.places.ceremonia.trim(), recepcion: d.places.recepcion.trim() },
      vendors: d.cats.map((cat) => ({ cat, name: (d.info[cat]?.name || "").trim() || catOf(cat).name, phone: normPhone(d.info[cat]?.phone) || "", contact: d.info[cat]?.contact || "" }))
    };
  }
  function onbErrors(d, step) {
    const err = {};
    if (step === 1) {
      if (!d.names[0].trim() || !d.names[1].trim()) err.names = "Escribe los dos nombres.";
      if (!fromISO(d.date)) err.date = "Elige la fecha.";
      if (toMin(d.time) == null) err.time = "Elige la hora.";
      if (!d.city.trim()) err.city = "Escribe la ciudad.";
      if (!d.ceremonyType) err.type = "Elige el tipo de ceremonia.";
      if (d.phone && !normPhone(d.phone)) err.phone = "Revisa el número.";
    }
    if (step === 2) {
      if (!d.cats.length) err.cats = "Elige al menos un proveedor.";
      for (const c of d.cats) if (d.info[c]?.phone && !normPhone(d.info[c].phone)) err[`ph_${c}`] = "Número no válido";
    }
    return err;
  }

  function viewOnb() {
    if (!state.draft) state.draft = newDraft();
    const d = state.draft;
    const step = state.ui.onbStep || 1;
    if (!sessionFlags[`onb${step}`]) { sessionFlags[`onb${step}`] = true; track(step === 1 ? "onb_start" : "onb_step", { step }); save(); }
    const err = d.tried ? onbErrors(d, step) : {};
    const errTxt = (k) => (err[k] ? `<span class="err">${esc(err[k])}</span>` : "");
    const titles = ["Evento", "Proveedores", "Cronograma", "Revisión"];
    let body = "";

    if (step === 1) {
      body = `
      <div class="stack--s"><h1 class="display h2">Cuéntanos de tu boda</h1><p class="muted">6 datos y listo. Lo demás lo agregas después.</p></div>
      <div class="field"><span class="label">Nombres de la pareja</span>
        <div class="grid-2">
          <input class="input ${err.names && !d.names[0].trim() ? "is-bad" : ""}" data-bind="d.names.0" value="${esc(d.names[0])}" placeholder="Laura" aria-label="Tu nombre" autocomplete="given-name">
          <input class="input ${err.names && !d.names[1].trim() ? "is-bad" : ""}" data-bind="d.names.1" value="${esc(d.names[1])}" placeholder="Andrés" aria-label="Nombre de tu pareja">
        </div>${errTxt("names")}</div>
      <div class="grid-2">
        <label class="field"><span class="label">Fecha</span><input class="input" type="date" data-bind="d.date" value="${esc(d.date)}" min="${toISO(new Date())}">${errTxt("date")}</label>
        <label class="field"><span class="label">Hora de ceremonia</span><input class="input" type="time" step="900" data-bind="d.time" value="${esc(d.time)}">${errTxt("time")}</label>
      </div>
      <label class="field"><span class="label">Ciudad</span><input class="input ${err.city ? "is-bad" : ""}" data-bind="d.city" value="${esc(d.city)}" placeholder="Ej.: Medellín" list="cities">${errTxt("city")}</label>
      <datalist id="cities"><option value="Bogotá"><option value="Medellín"><option value="Cali"><option value="Barranquilla"><option value="Cartagena"><option value="Bucaramanga"><option value="Pereira"><option value="Rionegro, Antioquia"><option value="Santa Marta"><option value="Villa de Leyva"></datalist>
      <div class="field"><span class="label">Invitados (aprox.)</span>
        <div class="row-between"><input class="range" type="range" min="20" max="300" step="10" data-bind="d.guests" data-num="1" data-out="#g-out" value="${d.guests}" aria-label="Número de invitados"><output id="g-out" class="display h3 tnum">${d.guests}</output></div>
      </div>
      <div class="field"><span class="label">Tipo de ceremonia</span>
        <div class="pick-grid pick-grid--3">${D.CEREMONIES.map((c) => pickCard({ act: "ceremony", id: c.id, img: c.img, name: c.name, sub: c.blurb, on: d.ceremonyType === c.id })).join("")}</div>${errTxt("type")}
      </div>
      <div class="panel stack">
        <span class="eyebrow">Opcional</span>
        <div class="grid-2">
          <label class="field"><span class="label">Lugar ceremonia</span><input class="input" data-bind="d.places.ceremonia" value="${esc(d.places.ceremonia)}" placeholder="Capilla…"></label>
          <label class="field"><span class="label">Lugar recepción</span><input class="input" data-bind="d.places.recepcion" value="${esc(d.places.recepcion)}" placeholder="Hacienda…"></label>
          <label class="field"><span class="label">Inicio recepción</span><input class="input" type="time" step="900" data-bind="d.recStart" value="${esc(d.recStart)}"></label>
          <label class="field"><span class="label">Cierre recepción</span><input class="input" type="time" step="900" data-bind="d.recEnd" value="${esc(d.recEnd)}"></label>
        </div>
        <label class="field"><span class="label">Tu WhatsApp (para tus proveedores)</span><input class="input" type="tel" data-bind="d.phone" value="${esc(d.phone)}" placeholder="300 000 0000">${errTxt("phone")}</label>
        <p class="small muted">Zona horaria: Bogotá (GMT-5). Todas las horas se muestran en la hora del evento.</p>
      </div>`;
    }

    if (step === 2) {
      body = `
      <div class="stack--s"><h1 class="display h2">¿Qué proveedores ya contrataste?</h1><p class="muted">Toca todos los que tengas. Puedes agregar más después.</p></div>
      <button class="btn btn--soft btn--block" type="button" data-act="import" data-target="onb">${icon("upload")} Importar desde Excel o CSV</button>
      <div class="pick-grid">${D.CATEGORIES.map((c) => pickCard({ act: "cat", id: c.id, img: c.img, name: c.short, sub: c.name !== c.short ? c.name : "", on: d.cats.includes(c.id) })).join("")}</div>
      ${errTxt("cats")}
      ${d.cats.length ? `<section class="panel"><span class="eyebrow">Sus datos (puedes completarlos después)</span>
        ${d.cats.map((c) => `<div class="vrow">${thumb(c, "thumb--s")}<div class="vrow__fields">
          <input class="input" data-bind="d.info.${c}.name" value="${esc(d.info[c]?.name || "")}" placeholder="${esc(catOf(c).name)}" aria-label="Nombre de ${esc(catOf(c).name)}">
          <input class="input ${err[`ph_${c}`] ? "is-bad" : ""}" type="tel" data-bind="d.info.${c}.phone" value="${esc(d.info[c]?.phone || "")}" placeholder="WhatsApp" aria-label="WhatsApp de ${esc(catOf(c).name)}">
        </div></div>`).join("")}</section>` : ""}`;
    }

    if (step === 3) {
      const tmp = buildEvent(draftSource(d));
      const deps = tmp.tasks.reduce((n, t) => n + t.after.length, 0);
      body = `
      <div class="stack--s"><h1 class="display h2">Tu Día D sugerido</h1>
      <p class="muted">${plural(tmp.tasks.length, "tarea", "tareas")} y ${plural(deps, "paso que depende de otro", "pasos que dependen de otros")}. Es una sugerencia: todo se puede cambiar.</p></div>
      ${tmp.tasks.length ? timelineHtml(tmp, { readonly: true }) : `<div class="empty"><strong>No hay tareas sugeridas para estas categorías.</strong><span class="small">Podrás crearlas a mano en tu tablero.</span></div>`}`;
    }

    if (step === 4) {
      const src = draftSource(d);
      const tmp = buildEvent(src);
      const cer = D.CEREMONIES.find((c) => c.id === src.ceremonyType);
      body = `
      <div class="stack--s"><h1 class="display h2">Todo listo</h1><p class="muted">Revisa y entra a tu tablero.</p></div>
      <section class="panel panel--lilac stack--s">
        <span class="eyebrow">Evento</span>
        <strong class="display h3">${esc(coupleShort(src))}</strong>
        <span>${esc(longDate(src.date))}</span>
        <span class="muted">${esc(cer.name)} a las ${fmtT(src.ceremonyTime)} · ${esc(src.city)} · ${src.guests} invitados</span>
      </section>
      <div class="grid-2">
        <section class="panel panel--mint stack--s"><span class="eyebrow">Proveedores</span><span class="big-num">${tmp.vendors.length}</span><span class="small">Todos en "Sin invitar"</span></section>
        <section class="panel panel--sky stack--s"><span class="eyebrow">Tareas</span><span class="big-num">${tmp.tasks.length}</span><span class="small">En tu Día D</span></section>
      </div>
      <section class="panel panel--peach stack--s">
        <strong>Siguiente paso</strong>
        <p class="small">Para enviar los enlaces a tus proveedores activa tu evento: USD ${state.variant || 35}, pago único. Lo haces desde tu tablero cuando quieras.</p>
      </section>`;
    }

    const cta = step === 4 ? "Ir a mi tablero" : step === 3 ? "Se ve bien" : "Siguiente";
    return `
    <header class="topnav"><div class="wrap">
      <div class="topnav__row">
        <button class="icon-btn" type="button" data-act="onb-back" aria-label="Volver">${icon("left")}</button>
        <span class="small" style="font-weight:600">Paso ${step} de 4 · ${titles[step - 1]}</span><span></span>
      </div>
      <div class="progress" aria-hidden="true">${titles.map((_, i) => `<span class="${i < step ? "is-on" : ""}"></span>`).join("")}</div>
    </div></header>
    <main class="wrap page stack">${body}</main>
    <div class="bottom-cta"><div class="wrap">
      <button class="btn btn--primary btn--lg btn--block" type="button" data-act="onb-next">${cta}</button>
      ${step === 2 && !d.cats.length ? `<button class="link-btn" style="display:block;margin:10px auto 0" type="button" data-act="onb-skip">Lo hago después</button>` : ""}
    </div></div>`;
  }

  function pickCard({ act, id, img, name, sub, on }) {
    return `<button class="pick ${img ? "" : "pick--plain"}" type="button" data-act="${act}" data-id="${id}" aria-pressed="${on}">
      ${img ? `<img src="${imgSrc(img)}" alt="" width="600" height="800" loading="lazy">` : `<span class="pick__plus" aria-hidden="true">+</span>`}
      <span class="pick__check">${icon("check", "icon--s")}</span>
      <span class="pick__body"><span class="pick__name">${esc(name)}</span>${sub ? `<span class="pick__sub">${esc(sub)}</span>` : ""}</span>
    </button>`;
  }

  // =====================================================================
  // App de la pareja
  // =====================================================================
  function viewApp(e) {
    const u = state.ui;
    const tab = u.tab || "inicio";
    const days = daysUntil(e.date);
    const urgent = todos(e).filter((t) => t.tone === "risk").length + (e.pending ? 1 : 0);
    const tabs = [["inicio", "Inicio", e.dday.on ? "sun" : "home"], ["crono", "Cronograma", "calendar"], ["prov", "Proveedores", "users"], ["mas", "Más", "more"]];
    let content = "";
    if (tab === "inicio") content = e.dday.on ? viewDday(e) : viewInicio(e);
    if (tab === "crono") content = viewCrono(e);
    if (tab === "prov") content = viewProv(e);
    if (tab === "mas") content = viewMas(e);
    const fab = tab === "crono" && (u.cronoView || "dia") === "dia" ? `<button class="btn btn--primary fab" type="button" data-act="new-task">${icon("plus")} Tarea</button>`
      : tab === "prov" ? `<button class="btn btn--primary fab" type="button" data-act="add-vendor">${icon("plus")} Proveedor</button>` : "";
    return `
    <header class="appbar">
      ${e.example ? `<div class="example-bar"><div class="wrap row-between"><span>Boda de ejemplo con datos ficticios</span><button class="link-btn" type="button" data-act="exit">Salir</button></div></div>` : ""}
      <div class="wrap appbar__row">
        <div style="min-width:0"><div class="appbar__title">${esc(coupleShort(e))}</div>
        <div class="small muted">${esc(dayMonth(e.date))} · ${e.dday.on ? "Modo Día D" : days > 0 ? `Faltan ${plural(days, "día", "días")}` : days === 0 ? "¡Es hoy!" : "Evento pasado"}</div></div>
        ${e.activated ? tonePill("ok", "Activo", "check") : `<button class="btn btn--soft btn--s" type="button" data-act="activate">Activar</button>`}
      </div>
    </header>
    <main class="wrap content stack">${content}</main>
    ${fab}
    <nav class="tabbar" aria-label="Secciones"><div class="tabbar__row">
      ${tabs.map(([id, label, ic]) => `<button class="tab" type="button" data-act="tab" data-tab="${id}" ${tab === id ? 'aria-current="page"' : ""}>${icon(ic)}${label}${id === "inicio" && urgent ? `<span class="tab__badge">${urgent}</span>` : ""}</button>`).join("")}
    </div></nav>`;
  }

  // P1 · pendientes ordenados por urgencia
  function todos(e) {
    const out = [];
    if (!e.activated && e.vendors.length) out.push({ tone: "wait", title: "Activa tu evento", sub: "Para enviar enlaces y avisos a tus proveedores.", act: "activate", label: "Ver" });
    for (const v of e.vendors) {
      if (v.request) out.push({ tone: "wait", v, title: `${v.name} pidió otra hora`, sub: `Propone ${fmtT(v.request.time)}${v.request.note ? ` · "${v.request.note}"` : ""}`, act: "review-request", id: v.id, label: "Revisar" });
      if (v.question) out.push({ tone: "wait", v, title: `${v.name} tiene una duda`, sub: `"${v.question.text}"`, act: "open-vendor", id: v.id, label: "Ver" });
      if (["invitado", "abrio"].includes(v.status) && v.sentAt && Date.now() - v.sentAt > 48 * 3600e3) out.push({ tone: "risk", v, title: `${v.name} no responde`, sub: `Le enviaste el enlace ${rel(v.sentAt)} y ya recibió los recordatorios.`, href: telHref(v.phone), label: "Llamar" });
      if (v.change) out.push({ tone: "wait", v, title: `${v.name} no ha reconfirmado`, sub: `Su nueva hora es ${fmtT(v.change.to)}.`, act: "open-vendor", id: v.id, label: "Ver" });
      if (v.status === "sin_invitar") out.push({ tone: "idle", v, title: `${v.name} sin invitar`, sub: v.phone ? "Envíale su enlace por WhatsApp." : "Falta su WhatsApp.", act: "open-vendor", id: v.id, label: "Invitar" });
    }
    const order = { risk: 0, wait: 1, idle: 2 };
    return out.sort((a, b) => order[a.tone] - order[b.tone]);
  }

  function vendorCounts(e) {
    const c = { ok: 0, wait: 0, idle: 0 };
    for (const v of e.vendors) {
      if (isConfirmedLike(v.status) && !v.change) c.ok++;
      else if (v.status === "sin_invitar") c.idle++;
      else c.wait++;
    }
    return c;
  }

  function viewInicio(e) {
    const c = vendorCounts(e);
    const n = e.vendors.length;
    const list = todos(e);
    const nextPrep = e.prep.filter((p) => !p.done && fromISO(p.date) >= addDays(new Date(), -1)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    const flores = e.tasks.find((t) => t.key === "flores");
    const pct = (k) => (n ? (c[k] / n) * 100 : 0);
    return `
    <section class="panel panel--lilac stack--s">
      <span class="eyebrow">Proveedores confirmados</span>
      <div class="row-between"><span class="big-num tnum">${c.ok}<span class="muted" style="font-size:0.5em">/${n}</span></span>
      <span class="small" style="text-align:right">${c.wait ? `${c.wait} esperando<br>` : ""}${c.idle ? `${c.idle} sin invitar` : n ? "Nadie sin invitar" : ""}</span></div>
      <div class="bar" role="img" aria-label="${c.ok} confirmados, ${c.wait} esperando, ${c.idle} sin invitar"><span class="ok" style="width:${pct("ok")}%"></span><span class="wait" style="width:${pct("wait")}%"></span></div>
    </section>

    ${e.example && flores ? `<section class="panel panel--butter stack--s">
      <span class="eyebrow">Pruébalo</span>
      <strong>Flores del Campo avisa que llega 30 min tarde</strong>
      <p class="small">Mira cómo se corren las tareas que dependen de ellas y a quién hay que avisar.</p>
      <button class="btn btn--primary btn--block" type="button" data-act="demo-cascade">Ver el reajuste en cascada</button>
    </section>` : ""}

    ${!n ? `<div class="empty"><strong>Tu evento aún no tiene proveedores</strong><span class="small">Agrégalos uno por uno o importa tu Excel.</span><button class="btn btn--primary" type="button" data-act="tab" data-tab="prov">Agregar proveedores</button></div>` : ""}

    <section class="panel">
      <div class="row-between"><h2 class="display h3">Pendientes</h2><span class="small muted">${list.length || "Nada"}</span></div>
      ${list.length ? list.map((t) => `<div class="todo"><span class="dot" data-tone="${t.tone}" aria-hidden="true"></span>
        <div style="min-width:0"><div class="item__title">${esc(t.title)}</div><div class="item__sub">${esc(t.sub)}</div></div>
        ${t.href ? `<a class="btn btn--ghost btn--s" href="${t.href}">${icon("phone", "icon--s")}${t.label}</a>` : `<button class="btn btn--ghost btn--s" type="button" data-act="${t.act}" data-id="${t.id || ""}">${t.label}</button>`}
      </div>`).join("") : `<p class="muted small" style="padding-top:8px">Todo bajo control.</p>`}
    </section>

    ${nextPrep.length ? `<section class="panel"><h2 class="display h3">Próximos</h2>
      ${nextPrep.map((p) => `<div class="todo"><span class="tag tag--soft">${esc(fromISO(p.date).toLocaleDateString("es-CO", { day: "numeric", month: "short" }))}</span>
      <div><div class="item__title">${esc(p.title)}</div>${p.cat ? `<div class="item__sub">${esc(catOf(p.cat).name)}</div>` : ""}</div><span></span></div>`).join("")}
    </section>` : ""}

    <section class="panel panel--sky stack--s">
      <span class="eyebrow">Modo Día D</span>
      <strong>Todo en vivo el día de tu boda</strong>
      <p class="small">Se activa solo 24 horas antes. Ves quién llegó, quién va tarde y apruebas reajustes con un toque.</p>
      <button class="btn btn--primary btn--block" type="button" data-act="dday-on" ${e.tasks.length ? "" : "disabled"}>${icon("sun")} Probar el modo Día D</button>
    </section>`;
  }

  // P8 · tablero del Día D
  function viewDday(e) {
    const clock = e.dday.clock;
    const tasks = [...e.tasks].sort(byStart);
    const states = tasks.map((t) => ({ t, s: ddayTaskState(e, t) }));
    const atRisk = states.filter((x) => !x.s.done && x.s.tone !== "ok").length + (e.pending && !states.some((x) => x.t.id === e.pending.rootId && x.s.tone !== "ok") ? 1 : 0);
    const online = navigator.onLine !== false;
    const p = e.pending;
    const pChanges = p ? cascade(e, p.rootId, p.newStart) : [];
    const pVendor = p ? vendorById(e, taskById(e, p.rootId)?.vendorId) : null;
    const pOthers = p ? affectedVendors(e, p, pChanges).length : 0;
    return `
    <div class="row-between">
      <h1 class="display h1">Día D</h1>
      <button class="btn btn--ghost btn--s" type="button" data-act="dday-off">Salir</button>
    </div>
    <p class="small muted" style="display:flex;gap:6px;align-items:center">${online ? icon("check", "icon--s") : icon("wifioff", "icon--s")}
      ${online ? `Actualizado a las ${clockOf(e.dday.updatedAt || Date.now())}` : `Sin conexión. Ves la última versión (${clockOf(e.dday.updatedAt || Date.now())}). Los cambios se envían al reconectar.`}</p>

    <section class="dd-status" data-tone="${atRisk ? "risk" : "ok"}">
      ${icon(atRisk ? "alert" : "check")}
      <div><div class="dd-status__big">${atRisk ? `${atRisk} en riesgo` : "Todo en orden"}</div>
      <div class="small">Hora del evento: <strong>${fmtT(clock)}</strong></div></div>
    </section>

    ${p ? `<section class="panel panel--risk stack--s" role="alert">
      <strong>${esc(p.cause)}</strong>
      <p class="small">${pOthers ? `Esto afecta a ${plural(pOthers, "proveedor más", "proveedores más")}. Revisa las horas nuevas y aprueba.` : "No afecta a otros proveedores."}</p>
      <div class="btn-row">
        <button class="btn btn--primary" type="button" data-act="open-pending">Ver reajuste</button>
        ${pVendor ? `<a class="btn btn--ghost" href="${telHref(pVendor.phone)}">${icon("phone", "icon--s")}Llamar</a>` : ""}
      </div>
    </section>` : ""}

    <section class="stack--s" aria-label="Línea de tiempo del Día D">
      ${states.map(({ t, s }) => {
        const v = vendorById(e, t.vendorId);
        const now = clock >= t.start && clock < t.start + t.dur;
        return `<div class="dd-task ${now ? "is-now" : ""} ${s.done ? "is-done" : ""}">
          <div><div class="dd-task__time">${fmtT(t.start).replace(/ (a|p)\. m\./, "")}</div><div class="small muted">${fmtT(t.start).slice(-5)}</div></div>
          <button class="dd-task__body" type="button" data-act="open-task" data-id="${t.id}">
            <span class="item__title" style="display:block">${now ? '<span class="tag tag--soft">Ahora</span> ' : ""}${esc(t.title)}</span>
            <span class="item__sub" style="display:block">${esc(v?.name || "")} · ${D.STATUS[v?.status]?.label || ""}</span>
            <span class="task__meta">${tonePill(s.tone, s.label, s.icon)}</span>
          </button>
          ${v?.phone ? `<a class="icon-btn icon-btn--soft" href="${telHref(v.phone)}" aria-label="Llamar a ${esc(v.name)}">${icon("phone")}</a>` : "<span></span>"}
        </div>`;
      }).join("")}
    </section>

    <section class="sim stack--s">
      <span class="eyebrow">Simulación del prototipo</span>
      <p class="small muted">Adelanta el reloj para ver llegar a los proveedores. ${e.example ? "En el ejemplo todos confirmaron menos el DJ, para que veas qué pasa si alguien no llega." : ""}</p>
      <div class="btn-row">
        <button class="btn btn--ghost btn--s" type="button" data-act="sim-step" data-min="15">+15 min</button>
        <button class="btn btn--ghost btn--s" type="button" data-act="sim-step" data-min="60">+1 hora</button>
      </div>
      <button class="btn btn--soft btn--s btn--block" type="button" data-act="sim-delay">Un proveedor avisa que va 30 min tarde</button>
    </section>`;
  }

  // P2 · cronograma con tres vistas
  function viewCrono(e) {
    const v = state.ui.cronoView || "dia";
    const seg = `<div class="seg" role="group" aria-label="Vista del cronograma">
      ${[["dia", "Día D"], ["prov", "Por proveedor"], ["prep", "Preparación"]].map(([id, l]) => `<button type="button" data-act="crono-view" data-v="${id}" aria-pressed="${v === id}">${l}</button>`).join("")}
    </div>`;
    let body = "";
    if (v === "dia") {
      body = e.tasks.length ? timelineHtml(e) : `<div class="empty"><strong>Tu cronograma está vacío</strong><span class="small">Agrega proveedores y te sugerimos las tareas, o crea una a mano.</span></div>`;
    } else if (v === "prov") {
      body = e.vendors.length ? e.vendors.map((vd) => {
        const ts = tasksOf(e, vd.id);
        return `<section class="panel stack--s">
          <button class="item" type="button" data-act="open-vendor" data-id="${vd.id}">${thumb(vd.cat)}<span style="min-width:0"><span class="item__title" style="display:block">${esc(vd.name)}</span><span class="item__sub">${esc(catOf(vd.cat).name)}</span></span>${pill(vd.status)}</button>
          ${ts.length ? ts.map((t) => `<button class="task" type="button" data-act="open-task" data-id="${t.id}"><span class="task__time">${fmtT(t.start)}</span><span><span class="task__title" style="display:block">${esc(t.title)}</span><span class="item__sub">${fmtDur(t.dur)} · ${esc(PLACE_LABEL[t.place] || t.place)}</span></span></button>`).join("") : `<p class="small muted">Sin tareas asignadas.</p>`}
        </section>`;
      }).join("") : `<div class="empty"><strong>Aún no tienes proveedores</strong></div>`;
    } else {
      const items = [...e.prep].sort((a, b) => a.date.localeCompare(b.date));
      body = `<section class="panel"><p class="small muted">Los 3 meses antes: pruebas, ensayos y entregas.</p>
        <ul class="list">${items.map((p) => `<li><label class="check" style="padding:12px 0">
          <input type="checkbox" data-change="prep" data-id="${p.id}" ${p.done ? "checked" : ""}>
          <span style="min-width:0"><span class="item__title" style="display:block;${p.done ? "text-decoration:line-through;opacity:.6" : ""}">${esc(p.title)}</span>
          <span class="item__sub">${esc(longDate(p.date))}${p.cat ? ` · ${esc(catOf(p.cat).name)}` : ""}</span></span>
        </label></li>`).join("")}</ul></section>`;
    }
    return `<h1 class="display h2">Cronograma</h1>${seg}${body}`;
  }

  function timelineHtml(e, { readonly = false } = {}) {
    const groups = new Map();
    [...e.tasks].sort(byStart).forEach((t) => {
      const h = Math.floor(t.start / 60);
      if (!groups.has(h)) groups.set(h, []);
      groups.get(h).push(t);
    });
    return `<div class="tl">${[...groups.entries()].map(([h, ts]) => `
      <div class="tl-hour"><div class="tl-hour__label">${hourLabel(h)}</div><div class="tl-hour__items">
        ${ts.map((t) => {
          const v = vendorById(e, t.vendorId);
          const deps = t.after.map((a) => taskById(e, a.id)).filter(Boolean);
          const tag = readonly ? "div" : "button";
          return `<${tag} class="task ${v?.change ? "is-changed" : ""}" ${readonly ? "" : `type="button" data-act="open-task" data-id="${t.id}"`}>
            ${v ? thumb(v.cat, "thumb--s") : ""}
            <span style="min-width:0">
              <span class="task__time">${fmtT(t.start)} · ${fmtDur(t.dur)}</span>
              <span class="task__title" style="display:block">${esc(t.title)}</span>
              ${deps.length ? `<span class="task__dep" style="display:block">Antes debe terminar: ${esc(deps.map((d) => d.title).join(", "))}</span>` : ""}
              <span class="task__meta">${v ? `<span class="small">${esc(v.name)}</span>` : ""}${!readonly && v ? pill(v.status) : ""}${t.critical ? '<span class="tag">Crítica</span>' : ""}</span>
            </span>
          </${tag}>`;
        }).join("")}
      </div></div>`).join("")}</div>`;
  }

  // P4 · proveedores
  function viewProv(e) {
    const f = state.ui.provFilter || "todos";
    const list = e.vendors.filter((v) => (f === "pend" ? !(isConfirmedLike(v.status) && !v.change) : f === "ok" ? isConfirmedLike(v.status) && !v.change : true));
    return `
    <h1 class="display h2">Proveedores</h1>
    <div class="chips" role="group" aria-label="Filtro">
      ${[["todos", `Todos (${e.vendors.length})`], ["pend", "Pendientes"], ["ok", "Confirmados"]].map(([id, l]) => `<button class="chip" type="button" data-act="prov-filter" data-v="${id}" aria-pressed="${f === id}">${l}</button>`).join("")}
    </div>
    <button class="btn btn--soft btn--block" type="button" data-act="import" data-target="app">${icon("upload")} Importar desde Excel o CSV</button>
    ${list.length ? `<section class="panel" style="padding-block:4px"><ul class="list">${list.map((v) => `<li>
      <button class="item" type="button" data-act="open-vendor" data-id="${v.id}">${thumb(v.cat)}
        <span style="min-width:0"><span class="item__title" style="display:block">${esc(v.name)}</span>
        <span class="item__sub">${esc(catOf(v.cat).name)} · ${rel(v.statusAt)}${v.statusBy === "pareja" ? " · por la pareja" : ""}${!v.phone ? " · falta WhatsApp" : ""}</span></span>
        ${pill(v.status)}
      </button></li>`).join("")}</ul></section>`
      : `<div class="empty"><strong>${e.vendors.length ? "Nadie en este filtro" : "Aún no tienes proveedores"}</strong><span class="small">${e.vendors.length ? "Prueba con otro filtro." : "Agrega el primero o importa tu Excel."}</span></div>`}`;
  }

  function viewMas(e) {
    const items = [
      ["log", "list", "Bitácora de cambios", "Quién cambió qué y a quién se avisó"],
      ["budget", "wallet", "Presupuesto y pagos", "Lo acordado con cada proveedor"],
      ["templates", "msg", "Plantillas de mensajes", "Invitación, recordatorio, cambios"],
      [e.activated ? "receipt" : "activate", "lock", "Plan y pago", e.activated ? `Activo hasta ${shortDate(fromISO(e.payment.validUntil))}` : "Activa tu evento para enviar avisos"],
      ["invite", "invite", "Invitar a tu pareja", "Como co-organizador"],
      ["settings", "info", "Datos del evento y privacidad", "Evento, roles y borrado de datos"],
      ["metrics", "chart", "Métricas del prototipo", "Lo que mide el piloto"]
    ];
    return `
    <h1 class="display h2">Más</h1>
    <section class="panel" style="padding-block:4px"><ul class="list">
      ${items.map(([sheet, ic, t, s]) => `<li><button class="item" type="button" data-act="sheet" data-sheet="${sheet}">
        <span class="thumb thumb--s" style="background:var(--lilac)">${icon(ic)}</span>
        <span style="min-width:0"><span class="item__title" style="display:block">${t}</span><span class="item__sub">${esc(s)}</span></span>${icon("right")}
      </button></li>`).join("")}
      ${inFrame ? "" : `<li><button class="item" type="button" data-act="print"><span class="thumb thumb--s" style="background:var(--lilac)">${icon("print")}</span><span><span class="item__title" style="display:block">Imprimir cronograma</span><span class="item__sub">Una hoja con el Día D</span></span>${icon("right")}</button></li>`}
    </ul></section>
    <button class="btn btn--ghost btn--block" type="button" data-act="exit">${e.example ? "Salir del ejemplo" : "Ir a la página de inicio"}</button>`;
  }

  // =====================================================================
  // Hojas (detalles)
  // =====================================================================
  const SHEETS = {};

  // P3 · detalle de tarea
  SHEETS.task = (e, s) => {
    const t = taskById(e, s.id);
    if (!t) return sheetHead("Tarea", "Esta tarea ya no existe");
    const v = vendorById(e, t.vendorId);
    const move = s.move || 0;
    const deps = t.after.map((a) => ({ a, d: taskById(e, a.id) })).filter((x) => x.d);
    const blocks = e.tasks.filter((x) => x.after.some((a) => a.id === t.id));
    const up = ancestors(e, t.id);
    const down = descendants(e, t.id);
    const chain = e.tasks.filter((x) => up.has(x.id) || down.has(x.id) || x.id === t.id).sort(byStart);
    const options = e.tasks.filter((x) => x.id !== t.id && !t.after.some((a) => a.id === x.id)).sort(byStart);
    const history = e.log.filter((l) => l.taskId === t.id).slice(-5).reverse();
    return `
    ${sheetHead("Tarea", t.title)}
    <div class="stack" style="margin-top:12px">
      ${v ? `<div class="item" style="cursor:default">${thumb(v.cat)}<span style="min-width:0"><span class="item__title" style="display:block">${esc(v.name)}</span>${pill(v.status)}</span>
        ${v.phone ? `<a class="icon-btn icon-btn--soft" href="${telHref(v.phone)}" aria-label="Llamar">${icon("phone")}</a>` : ""}</div>` : ""}
      <div class="grid-2">
        <div class="panel panel--lilac"><span class="label">Hora</span><strong class="tnum">${fmtT(t.start)} – ${fmtT(t.start + t.dur)}</strong></div>
        <div class="panel panel--lilac"><span class="label">Lugar</span><strong>${esc(placeName(e, t.place))}</strong></div>
      </div>
      ${t.critical ? `<p class="small"><span class="tag">Crítica</span> Si se retrasa, frena a otros proveedores.</p>` : ""}
      ${t.reqs.length ? `<section class="stack--s"><span class="label">Requerimientos técnicos</span>${t.reqs.map((r) => `<span class="check">${icon("check", "icon--s")}${esc(r)}</span>`).join("")}</section>` : ""}

      <section class="panel stack--s">
        <span class="label">Antes de esto debe terminar</span>
        ${deps.length ? deps.map(({ a, d }) => `<div class="row-between"><span style="min-width:0"><strong>${esc(d.title)}</strong><span class="item__sub" style="display:block">Termina ${fmtT(d.start + d.dur)} · holgura mínima ${a.gap} min</span></span>
          <button class="icon-btn" type="button" data-act="rm-dep" data-id="${d.id}" aria-label="Quitar">${icon("x")}</button></div>`).join("") : `<p class="small muted">Nada. Puede empezar cuando quiera.</p>`}
        ${options.length ? `<div class="grid-2" style="grid-template-columns:minmax(0,1fr) 112px">
          <select class="select" data-bind="s.depId" aria-label="Tarea que debe terminar antes"><option value="">Agregar una…</option>${options.map((o) => `<option value="${o.id}" ${s.depId === o.id ? "selected" : ""}>${esc(fmtT(o.start))} · ${esc(o.title)}</option>`).join("")}</select>
          <select class="select" data-bind="s.depGap" data-num="1" aria-label="Holgura mínima">${[0, 10, 15, 30].map((g) => `<option value="${g}" ${Number(s.depGap || 0) === g ? "selected" : ""}>+${g} min</option>`).join("")}</select>
        </div>
        <button class="btn btn--ghost btn--s" type="button" data-act="add-dep">${icon("plus", "icon--s")} Agregar</button>` : ""}
        ${s.depErr ? `<span class="err">${esc(s.depErr)}</span>` : ""}
        ${blocks.length ? `<p class="small muted">Si esta tarea se mueve, también se mueven: ${esc(blocks.map((b) => b.title).join(", "))}.</p>` : ""}
      </section>

      ${chain.length > 1 ? `<section class="stack--s"><span class="label">Cadena completa</span><div class="chain">
        ${chain.map((c, i) => `${i ? '<div class="chain__link"></div>' : ""}<div class="chain__node ${c.id === t.id ? "is-self" : ""}"><span><strong class="tnum">${fmtT(c.start)}</strong> ${esc(c.title)}</span></div>`).join("")}
      </div></section>` : ""}

      <section class="panel panel--butter stack--s">
        <span class="label">Mover esta tarea</span>
        <div class="row-between">
          <button class="btn btn--ghost" type="button" data-act="move" data-d="-15" aria-label="15 minutos antes">−15</button>
          <strong class="display h3 tnum">${fmtT(t.start + move)}</strong>
          <button class="btn btn--ghost" type="button" data-act="move" data-d="15" aria-label="15 minutos después">+15</button>
        </div>
        <button class="btn btn--primary btn--block" type="button" data-act="propose-move" ${move ? "" : "disabled"}>Ver a quién afecta</button>
        <p class="small muted">Nada se avisa a un proveedor sin que tú lo apruebes.</p>
      </section>

      ${history.length ? `<section class="stack--s"><span class="label">Historial</span>${history.map((l) => `<p class="small"><strong>${esc(rel(l.at))}</strong> · ${esc(l.text)}</p>`).join("")}</section>` : ""}
    </div>`;
  };

  // P6 · propuesta de reajuste en cascada
  SHEETS.cascade = (e, s) => {
    const changes = cascade(e, s.rootId, s.newStart);
    const notify = affectedVendors(e, s, changes);
    const others = changes.filter((c) => c.id !== s.rootId);
    const row = (c) => {
      const t = taskById(e, c.id);
      const v = vendorById(e, t.vendorId);
      return `<div class="diff"><span style="min-width:0"><strong>${esc(t.title)}</strong><span class="item__sub" style="display:block">${esc(v?.name || "")}</span></span>
        <span class="diff__times"><s>${fmtT(c.from)}</s> → <strong>${fmtT(c.to)}</strong><span class="diff__delta" style="display:block">${c.to > c.from ? "+" : ""}${c.to - c.from} min</span></span></div>`;
    };
    const rootChange = changes.find((c) => c.id === s.rootId);
    const rootTask = taskById(e, s.rootId);
    const rootVendor = vendorById(e, rootTask?.vendorId);
    const preview = notify[0] ? fillTpl(e, e.dday.on ? "retraso" : "cambio", notify[0], { hora: fmtT((changes.find((c) => taskById(e, c.id)?.vendorId === notify[0].id) || {}).to ?? 0) }) : "";
    return `
    ${sheetHead("Propuesta de reajuste", notify.length ? `Esto afecta a ${plural(notify.length, "proveedor", "proveedores")}` : "No afecta a nadie más")}
    <div class="stack" style="margin-top:12px">
      <p>${esc(s.cause)}</p>
      ${rootChange ? `<section class="panel stack--s"><span class="label">Antes y después</span>
        ${row(rootChange)}
        ${others.slice(0, 3).map(row).join("")}
        ${others.length > 3 ? `<details><summary class="small" style="cursor:pointer;padding:8px 0">Ver ${others.length - 3} más</summary>${others.slice(3).map(row).join("")}</details>` : ""}
        ${!others.length ? `<p class="small muted">La holgura absorbe el cambio: nadie más se corre.</p>` : ""}
      </section>` : `<p class="muted">La hora no cambia.</p>`}
      ${preview ? `<section class="stack--s"><span class="label">Lo que recibirán (${preview.length}/300)</span>
        <div class="panel panel--sky small">${esc(preview)}</div>
        <p class="small muted">Se avisa solo a los afectados por SMS y correo. Su enlace mostrará "Tu hora cambió" y les pedirá reconfirmar.</p></section>` : ""}
      ${!e.activated ? `<p class="small panel panel--peach">Tu evento no está activado: el cambio se guarda pero no se avisa a nadie.</p>` : ""}
      <button class="btn btn--primary btn--lg btn--block" type="button" data-act="approve" ${rootChange ? "" : "disabled"}>${e.activated && notify.length ? "Aprobar y avisar" : "Aprobar"}</button>
      <div class="btn-row">
        <button class="btn btn--ghost" type="button" data-act="adjust">Ajustar a mano</button>
        ${rootVendor?.phone ? `<a class="btn btn--ghost" href="${telHref(rootVendor.phone)}">${icon("phone", "icon--s")}Llamar</a>` : `<span></span>`}
      </div>
    </div>`;
  };

  // P5 · ficha del proveedor
  SHEETS.vendor = (e, s) => {
    const v = vendorById(e, s.id);
    if (!v) return sheetHead("Proveedor", "Ya no existe");
    const c = catOf(v.cat);
    const ts = tasksOf(e, v.id);
    const link = `${baseUrl()}#p-${v.token}`;
    const msg = fillTpl(e, v.sentAt ? "recordatorio" : "invitacion", v);
    const history = e.log.filter((l) => l.vendorId === v.id).slice(-6).reverse();
    const manual = [["confirmo", "Confirmó por teléfono"], ["en_camino", "Avisó que va en camino"], ["en_lugar", "Ya llegó"], ["termino", "Terminó"]];
    return `
    ${c.img ? `<div class="sheet__banner"><img src="${imgSrc(c.img)}" alt="" width="600" height="800"></div>` : ""}
    ${sheetHead(c.name, v.name)}
    <div class="stack" style="margin-top:8px">
      <div class="row-between"><span class="small muted">${esc(v.contact || "Sin persona de contacto")}${v.phone ? ` · ${esc(v.phone)}` : ""}</span><button class="link-btn small" type="button" data-act="edit-vendor" data-id="${v.id}">Editar</button></div>
      <div class="row-between">${pill(v.status)}<span class="small muted">${rel(v.statusAt)}${v.statusBy === "pareja" ? " · registrado por la pareja" : ""}</span></div>
      ${v.statusNote ? `<p class="small muted">${esc(v.statusNote)}</p>` : ""}

      ${v.request ? `<section class="panel panel--butter stack--s"><strong>Pidió otra hora: ${fmtT(v.request.time)}</strong>${v.request.note ? `<p class="small">"${esc(v.request.note)}"</p>` : ""}
        <button class="btn btn--primary btn--block" type="button" data-act="review-request" data-id="${v.id}">Revisar el cambio</button></section>` : ""}
      ${v.question ? `<section class="panel panel--butter stack--s"><strong>Tiene una duda</strong><p class="small">"${esc(v.question.text)}"</p>
        <button class="btn btn--ghost btn--s" type="button" data-act="q-done" data-id="${v.id}">Marcar como resuelta</button></section>` : ""}
      ${v.change ? `<section class="panel panel--butter small">Su hora cambió a <strong>${fmtT(v.change.to)}</strong> y aún no reconfirma.</section>` : ""}

      ${v.phone ? `<div class="btn-row">
        <a class="btn btn--ghost" href="${telHref(v.phone)}">${icon("phone", "icon--s")}Llamar</a>
        <a class="btn btn--ghost" href="${waHref(v.phone, "")}" target="_blank" rel="noopener">${icon("chat", "icon--s")}WhatsApp</a>
      </div>` : `<p class="panel panel--peach small">Falta su WhatsApp. <button class="link-btn" type="button" data-act="edit-vendor" data-id="${v.id}">Agregarlo</button></p>`}

      <section class="panel stack--s">
        <span class="label">Su enlace</span>
        ${v.revoked ? `<p class="small" style="color:var(--risk)">Enlace revocado. El proveedor ya no puede abrirlo.</p>` : `<p class="mono" style="overflow-wrap:anywhere">${esc(link)}</p>`}
        ${!v.phone ? "" : e.activated
          ? `<a class="btn btn--primary btn--block" href="${waHref(v.phone, msg)}" target="_blank" rel="noopener" data-act="sent-wa" data-id="${v.id}">${icon("send", "icon--s")}${v.sentAt ? "Reenviar" : "Enviar"} por WhatsApp</a>`
          : `<button class="btn btn--primary btn--block" type="button" data-act="activate" data-reason="send">${icon("lock", "icon--s")}Activar para enviar</button>`}
        <div class="btn-row btn-row--3">
          <button class="btn btn--ghost btn--s" type="button" data-act="copy-link" data-id="${v.id}">${icon("copy", "icon--s")}Copiar</button>
          <button class="btn btn--ghost btn--s" type="button" data-act="regen-link" data-id="${v.id}">${icon("refresh", "icon--s")}Nuevo</button>
          <button class="btn btn--ghost btn--s" type="button" data-act="revoke-link" data-id="${v.id}">${icon("unlink", "icon--s")}${v.revoked ? "Activar" : "Revocar"}</button>
        </div>
        <button class="btn btn--soft btn--block" type="button" data-act="view-as-vendor" data-id="${v.id}">${icon("eye", "icon--s")}Ver lo que ve el proveedor</button>
        <p class="small muted">Si no responde, le llegan recordatorios a las 48 h, 24 h y 2 h antes del plazo. Se detienen cuando confirma.</p>
      </section>

      <section class="stack--s"><span class="label">Sus tareas</span>
        ${ts.length ? ts.map((t) => `<button class="task" type="button" data-act="open-task" data-id="${t.id}"><span class="task__time">${fmtT(t.start)}</span><span class="task__title">${esc(t.title)}</span></button>`).join("") : `<p class="small muted">Sin tareas asignadas.</p>`}
      </section>

      <section class="panel stack--s">
        <span class="label">Marcar estado a su nombre</span>
        <p class="small muted">Para cuando te confirma por teléfono y no usa el enlace. Queda como "registrado por la pareja".</p>
        <div class="chips">${manual.map(([st, l]) => `<button class="chip" type="button" data-act="manual-pick" data-v="${st}" aria-pressed="${s.manual === st}">${l}</button>`).join("")}</div>
        ${s.manual ? `<input class="input" data-bind="s.manualNote" value="${esc(s.manualNote || "")}" placeholder="Motivo (opcional)" aria-label="Motivo">
        <button class="btn btn--primary btn--block" type="button" data-act="manual-save" data-id="${v.id}">Guardar</button>` : ""}
      </section>

      ${v.total ? `<section class="panel stack--s"><span class="label">Acuerdo y pagos</span>
        <div class="row-between"><span>Total</span><strong class="tnum">${cop(v.total)}</strong></div>
        <div class="row-between"><span>Pagado</span><span class="tnum">${cop(v.paid)}</span></div>
        <div class="row-between"><span>Saldo</span><strong class="tnum">${cop(v.total - v.paid)}</strong></div>
        ${v.payDue && v.total > v.paid ? `<p class="small muted">Próximo pago: ${esc(longDate(v.payDue))}</p>` : ""}
      </section>` : ""}

      ${history.length ? `<section class="stack--s"><span class="label">Historial</span>${history.map((l) => `<p class="small"><strong>${esc(rel(l.at))}</strong> · ${esc(l.text)}</p>`).join("")}</section>` : ""}
    </div>`;
  };

  // B1 · agregar o editar proveedor
  SHEETS.vendorForm = (e, s) => {
    const phoneBad = s.tried && !normPhone(s.phone);
    const nameBad = s.tried && !String(s.name || "").trim();
    return `
    ${sheetHead(s.editId ? "Editar proveedor" : "Nuevo proveedor", s.editId ? "Editar datos" : "Agregar proveedor")}
    <div class="stack" style="margin-top:12px">
      <label class="field"><span class="label">Categoría</span><select class="select" data-bind="s.cat">${D.CATEGORIES.map((c) => `<option value="${c.id}" ${s.cat === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
      <label class="field"><span class="label">Nombre o empresa</span><input class="input ${nameBad ? "is-bad" : ""}" data-bind="s.name" value="${esc(s.name || "")}" placeholder="Ej.: Flores del Campo">${nameBad ? '<span class="err">Escribe el nombre.</span>' : ""}</label>
      <label class="field"><span class="label">Persona de contacto</span><input class="input" data-bind="s.contact" value="${esc(s.contact || "")}" placeholder="Ej.: Camila Ortiz"></label>
      <label class="field"><span class="label">WhatsApp</span><input class="input ${phoneBad ? "is-bad" : ""}" type="tel" data-bind="s.phone" value="${esc(s.phone || "")}" placeholder="300 000 0000 o +52…">${phoneBad ? '<span class="err">Usa un celular de Colombia (3xx) o un número con código de país (+…).</span>' : ""}</label>
      <label class="field"><span class="label">Correo (opcional)</span><input class="input" type="email" data-bind="s.email" value="${esc(s.email || "")}"></label>
      <label class="field"><span class="label">Notas</span><input class="input" data-bind="s.notes" value="${esc(s.notes || "")}"></label>
      <button class="btn btn--primary btn--lg btn--block" type="button" data-act="vendor-save">Guardar</button>
    </div>`;
  };

  // C2 · nueva tarea
  SHEETS.newTask = (e, s) => {
    const titleBad = s.tried && !String(s.title || "").trim();
    return `
    ${sheetHead("Nueva tarea", "Agregar tarea")}
    <div class="stack" style="margin-top:12px">
      <label class="field"><span class="label">Qué hay que hacer</span><input class="input ${titleBad ? "is-bad" : ""}" data-bind="s.title" value="${esc(s.title || "")}" placeholder="Ej.: Entrega de recordatorios">${titleBad ? '<span class="err">Escribe un título.</span>' : ""}</label>
      <label class="field"><span class="label">Proveedor responsable</span><select class="select" data-bind="s.vendorId"><option value="">Sin proveedor</option>${e.vendors.map((v) => `<option value="${v.id}" ${s.vendorId === v.id ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></label>
      <div class="grid-2">
        <label class="field"><span class="label">Hora</span><input class="input" type="time" step="900" data-bind="s.time" value="${esc(s.time)}"></label>
        <label class="field"><span class="label">Duración</span><select class="select" data-bind="s.dur" data-num="1">${[15, 30, 45, 60, 90, 120, 180, 240].map((d) => `<option value="${d}" ${Number(s.dur) === d ? "selected" : ""}>${fmtDur(d)}</option>`).join("")}</select></label>
      </div>
      <label class="field"><span class="label">Lugar</span><select class="select" data-bind="s.place">${Object.keys(PLACE_LABEL).map((k) => `<option value="${k}" ${s.place === k ? "selected" : ""}>${PLACE_LABEL[k]}: ${esc(placeName(e, k))}</option>`).join("")}</select></label>
      <label class="field"><span class="label">Antes de esto debe terminar (opcional)</span><select class="select" data-bind="s.depId"><option value="">Nada</option>${[...e.tasks].sort(byStart).map((t) => `<option value="${t.id}" ${s.depId === t.id ? "selected" : ""}>${fmtT(t.start)} · ${esc(t.title)}</option>`).join("")}</select></label>
      <label class="field"><span class="label">Requerimientos técnicos (uno por línea)</span><textarea class="textarea" data-bind="s.reqs">${esc(s.reqs || "")}</textarea></label>
      <label class="check"><input type="checkbox" data-change="s-critical" ${s.critical ? "checked" : ""}> Es crítica (si se retrasa, frena a otros)</label>
      <button class="btn btn--primary btn--lg btn--block" type="button" data-act="task-save">Guardar tarea</button>
    </div>`;
  };

  // C8 · importar Excel/CSV con mapeo y vista previa
  const FIELDS = [["cat", "Categoría"], ["name", "Nombre o empresa"], ["contact", "Contacto"], ["phone", "WhatsApp"], ["email", "Correo"]];
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  function parseCsv(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    if (!lines.length) return { head: [], rows: [] };
    const delim = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
    const split = (line) => {
      const out = [];
      let cur = "";
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === delim && !q) { out.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      out.push(cur.trim());
      return out;
    };
    const [head, ...rows] = lines.map(split);
    return { head, rows };
  }
  function guessMap(head) {
    const keys = { cat: ["categoria", "category", "tipo", "servicio"], name: ["nombre", "empresa", "proveedor", "name"], contact: ["contacto", "persona"], phone: ["whatsapp", "telefono", "celular", "movil", "phone", "numero"], email: ["correo", "email", "mail"] };
    const map = {};
    for (const [f, words] of Object.entries(keys)) {
      const i = head.findIndex((h) => words.some((w) => norm(h).includes(w)));
      map[f] = i >= 0 ? i : "";
    }
    return map;
  }
  function matchCat(raw) {
    const n = norm(raw);
    if (!n) return null;
    return D.CATEGORIES.find((c) => c.id !== "otro" && (norm(c.name).includes(n) || n.includes(norm(c.short)) || n.includes(c.id)))?.id || null;
  }
  function importRows(s) {
    const { rows } = parseCsv(s.text || "");
    const get = (r, f) => (s.map[f] === "" || s.map[f] == null ? "" : r[Number(s.map[f])] || "");
    return rows.map((r) => {
      const cat = matchCat(get(r, "cat"));
      const name = get(r, "name").trim();
      const phone = normPhone(get(r, "phone"));
      const errors = [];
      if (!name) errors.push("Falta el nombre");
      if (!phone) errors.push("WhatsApp no válido");
      return { cat: cat || "otro", catRaw: get(r, "cat"), name, contact: get(r, "contact"), phone, email: get(r, "email"), errors, warn: !cat ? `"${get(r, "cat") || "sin categoría"}" se importa como Otro` : "" };
    });
  }
  SHEETS.import = (e, s) => {
    const parsed = s.text ? parseCsv(s.text) : null;
    const rows = parsed ? importRows(s) : [];
    const ok = rows.filter((r) => !r.errors.length);
    return `
    ${sheetHead("Importar", "Importar desde Excel o CSV")}
    <div class="stack" style="margin-top:12px">
      <p class="small">Guarda tu Excel como CSV. Columnas sugeridas: categoría, nombre, contacto, WhatsApp, correo. Nada se guarda hasta que confirmes.</p>
      <div class="btn-row">
        <label class="btn btn--ghost btn--s" style="cursor:pointer">${icon("upload", "icon--s")}Elegir archivo<input type="file" accept=".csv,text/csv,text/plain" data-change="csv-file" hidden></label>
        <button class="btn btn--ghost btn--s" type="button" data-act="csv-sample">Probar con un ejemplo</button>
      </div>
      ${inFrame ? "" : `<button class="link-btn small" type="button" data-act="csv-template">Descargar plantilla</button>`}
      ${parsed ? `
      <section class="panel stack--s"><span class="label">Columnas</span>
        ${FIELDS.map(([f, l]) => `<label class="grid-2" style="align-items:center"><span class="small">${l}</span><select class="select" data-bind="s.map.${f}" data-rerender="1">
          <option value="">No usar</option>${parsed.head.map((h, i) => `<option value="${i}" ${String(s.map[f]) === String(i) ? "selected" : ""}>${esc(h || `Columna ${i + 1}`)}</option>`).join("")}</select></label>`).join("")}
      </section>
      <section class="stack--s"><span class="label">Vista previa · ${ok.length} listos, ${rows.length - ok.length} con error</span>
        ${rows.map((r) => `<div class="panel ${r.errors.length ? "panel--risk" : ""}" style="padding:10px 12px">
          <div class="row-between"><strong>${esc(r.name || "(sin nombre)")}</strong><span class="small">${esc(catOf(r.cat).short)}</span></div>
          <div class="small muted">${esc(r.phone || "—")}</div>
          ${r.errors.length ? `<div class="err">${esc(r.errors.join(" · "))}</div>` : ""}${r.warn ? `<div class="small" style="color:var(--wait)">${esc(r.warn)}</div>` : ""}
        </div>`).join("")}
      </section>
      <button class="btn btn--primary btn--lg btn--block" type="button" data-act="csv-confirm" ${ok.length ? "" : "disabled"}>Importar ${plural(ok.length, "proveedor", "proveedores")}</button>
      ${rows.length - ok.length ? `<p class="small muted">Las filas con error no se importan. Corrígelas en tu archivo o agrégalas a mano.</p>` : ""}` : ""}
    </div>`;
  };

  // P7 · bitácora
  SHEETS.log = (e, s) => {
    const list = e.log.filter((l) => !s.vendor || l.vendorId === s.vendor).slice().reverse();
    return `
    ${sheetHead("Registro", "Bitácora de cambios")}
    <div class="stack" style="margin-top:12px">
      <p class="small muted">Se registra sola. No se puede editar ni borrar.</p>
      <select class="select" data-bind="s.vendor" data-rerender="1" aria-label="Filtrar por proveedor"><option value="">Todos los proveedores</option>${e.vendors.map((v) => `<option value="${v.id}" ${s.vendor === v.id ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select>
      <ul class="list">${list.map((l) => `<li style="padding:10px 0"><div class="row-between"><strong class="small">${esc(l.who)}</strong><span class="small muted">${esc(rel(l.at))}</span></div><p class="small">${esc(l.text)}</p></li>`).join("") || `<li class="small muted">Sin registros.</li>`}</ul>
    </div>`;
  };

  // P9 · presupuesto (solo registro, no procesa pagos)
  SHEETS.budget = (e) => {
    const total = e.vendors.reduce((n, v) => n + v.total, 0);
    const paid = e.vendors.reduce((n, v) => n + v.paid, 0);
    const soon = e.vendors.filter((v) => v.payDue && v.total > v.paid && daysUntil(v.payDue) <= 7);
    return `
    ${sheetHead("Presupuesto", "Presupuesto y pagos")}
    <div class="stack" style="margin-top:12px">
      <div class="grid-2">
        <div class="panel panel--lilac"><span class="label">Total acordado</span><strong class="tnum">${cop(total)}</strong></div>
        <div class="panel panel--mint"><span class="label">Pagado</span><strong class="tnum">${cop(paid)}</strong></div>
      </div>
      <div class="panel panel--peach row-between"><span class="label">Saldo pendiente</span><strong class="display h3 tnum">${cop(total - paid)}</strong></div>
      ${soon.length ? `<p class="small panel panel--butter">Pagos en los próximos 7 días: ${esc(soon.map((v) => `${v.name} (${shortDate(fromISO(v.payDue))})`).join(", "))}</p>` : ""}
      <section class="panel" style="padding-block:4px">${e.vendors.map((v) => `<div class="budget-row">${thumb(v.cat, "thumb--s")}
        <span style="min-width:0"><strong style="display:block">${esc(v.name)}</strong><span class="item__sub">${v.total ? `Pagado ${cop(v.paid)} de ${cop(v.total)}` : "Sin monto registrado"}</span></span>
        <span class="amt">${v.total ? cop(v.total - v.paid) : "—"}</span></div>`).join("") || `<p class="small muted" style="padding:12px 0">Sin proveedores.</p>`}</section>
      <p class="small muted">Solo registro. Coolplanners no cobra ni paga a tus proveedores.</p>
    </div>`;
  };

  // P10 · plantillas de mensajes
  SHEETS.templates = (e, s) => {
    const id = s.id || "invitacion";
    const text = s.text ?? tplText(e, id);
    const sample = e.vendors[0] || makeVendor({ cat: "floristeria", name: "Tu proveedor", contact: "Camila" });
    const preview = fillText(e, text, sample);
    return `
    ${sheetHead("Mensajes", "Plantillas de mensajes")}
    <div class="stack" style="margin-top:12px">
      <div class="chips">${D.TEMPLATES.map((t) => `<button class="chip" type="button" data-act="tpl-pick" data-v="${t.id}" aria-pressed="${id === t.id}">${t.name}</button>`).join("")}</div>
      <label class="field"><span class="label">Texto</span><textarea class="textarea" data-bind="s.text" data-input="tpl" style="min-height:140px">${esc(text)}</textarea></label>
      <p class="small muted">Variables: {proveedor} {pareja} {fecha} {hora} {lugar} {enlace}</p>
      <section class="stack--s"><div class="row-between"><span class="label">Vista previa</span><span id="tpl-count" class="counter ${preview.length > 300 ? "is-over" : ""}">${preview.length}/300</span></div>
        <div id="tpl-preview" class="panel panel--sky small">${esc(preview)}</div></section>
      ${s.err ? `<span class="err">${esc(s.err)}</span>` : ""}
      <div class="btn-row"><button class="btn btn--ghost" type="button" data-act="tpl-reset">Restaurar</button><button class="btn btn--primary" type="button" data-act="tpl-save">Guardar</button></div>
    </div>`;
  };

  // P12 · activación y pago (simulado)
  SHEETS.activate = (e, s) => {
    const usd = state.variant || 35;
    const method = s.method || "pse";
    const until = longDate(toISO(addDays(fromISO(e.date), D.PRICING.graceDays)));
    return `
    ${sheetHead("Plan único", "Activa tu evento")}
    <div class="stack" style="margin-top:12px">
      ${s.reason === "send" ? `<p class="panel panel--butter small">Armar el evento es gratis. Para enviar enlaces y avisos a tus proveedores, actívalo.</p>` : ""}
      <section class="panel panel--mint stack--s">
        <span class="price">USD ${usd}</span>
        <span class="muted">≈ ${cop(usd * D.PRICING.copPerUsd)} COP · pago único, sin cuotas</span>
      </section>
      <section class="stack--s"><span class="label">Incluye</span>
        ${["Enlaces para todos tus proveedores", "Avisos automáticos por SMS y correo", "Reprogramación en cascada con aviso", "Modo Día D en vivo", "Co-organizador sin costo extra"].map((x) => `<span class="check">${icon("check", "icon--s")}${x}</span>`).join("")}
      </section>
      <p class="small muted">Vigente hasta el ${esc(until)} (30 días después de tu boda). Si la boda se aplaza, cambias la fecha sin costo.</p>
      <section class="stack--s"><span class="label">Medio de pago</span>
        <div class="chips">${D.PAY_METHODS.map((m) => `<button class="chip" type="button" data-act="pay-method" data-v="${m.id}" aria-pressed="${method === m.id}">${m.name}</button>`).join("")}</div>
      </section>
      <button class="btn btn--primary btn--lg btn--block" type="button" data-act="pay" ${s.busy ? "disabled" : ""}>${s.busy ? "Procesando…" : `Pagar USD ${usd}`}</button>
      <p class="small muted">Prototipo: no se hace ningún cobro.</p>
    </div>`;
  };

  // comprobante (la "factura" del prototipo)
  SHEETS.receipt = (e) => {
    const p = e.payment;
    if (!p) return sheetHead("Comprobante", "Aún no has pagado");
    const total = e.vendors.reduce((n, v) => n + v.total, 0);
    return `
    ${sheetHead("Comprobante", "Tu evento está activo")}
    <div class="stack" style="margin-top:12px">
      <article class="receipt">
        <span class="stamp">Pagado · demo</span>
        <div><span class="brand">Coolplanners</span><div class="small muted">Comprobante de pago</div></div>
        <dl>
          <dt>Número</dt><dd class="mono">${esc(p.no)}</dd>
          <dt>Fecha</dt><dd>${esc(shortDate(new Date(p.at)))}</dd>
          <dt>Titular</dt><dd>${esc(e.names[0] || "")}</dd>
          <dt>Evento</dt><dd>Boda ${esc(coupleShort(e))} · ${esc(shortDate(fromISO(e.date)))}</dd>
          <dt>Concepto</dt><dd>Activación del evento (plan único)</dd>
          <dt>Incluye</dt><dd>${plural(e.vendors.length, "proveedor", "proveedores")}, avisos, cascada y Día D</dd>
          <dt>Vigencia</dt><dd>Hasta ${esc(shortDate(fromISO(p.validUntil)))}</dd>
          <dt>Medio</dt><dd>${esc(p.method)}</dd>
        </dl>
        <dl class="receipt__total">
          <dt>Total</dt><dd class="display h3">USD ${p.usd}</dd>
          <dt>Equivalente</dt><dd>≈ ${cop(p.cop)} COP</dd>
        </dl>
        <p class="small muted">Simulación: no se cobró dinero. El tipo de factura (electrónica o no) está pendiente de definir con un contador.</p>
      </article>
      ${total ? `<section class="panel panel--lilac stack--s"><span class="eyebrow">Tu boda en números</span>
        <div class="row-between"><span>Acordado con proveedores</span><strong class="tnum">${cop(total)}</strong></div>
        <button class="btn btn--ghost btn--s" type="button" data-act="sheet" data-sheet="budget">Ver presupuesto por proveedor</button></section>` : ""}
      <button class="btn btn--primary btn--block" type="button" data-act="close-sheet">Listo</button>
    </div>`;
  };

  // A3 · invitar co-organizador
  SHEETS.invite = (e) => {
    const link = `${baseUrl()}#inv-${e.id}`;
    return `
    ${sheetHead("Co-organizador", "Invita a tu pareja")}
    <div class="stack" style="margin-top:12px">
      <p>Entra con su propia cuenta y ve el mismo evento al instante.</p>
      <p class="mono panel" style="overflow-wrap:anywhere">${esc(link)}</p>
      <button class="btn btn--primary btn--block" type="button" data-act="copy" data-text="${esc(link)}">${icon("copy", "icon--s")}Copiar enlace</button>
      <section class="panel stack--s"><span class="label">Roles</span>
        <p class="small"><strong>Titular (tú):</strong> todo, incluido pagar, eliminar el evento y cambiar roles.</p>
        <p class="small"><strong>Co-organizador:</strong> todo menos pagar, eliminar el evento y cambiar roles.</p>
      </section>
    </div>`;
  };

  // P11 · datos del evento y privacidad
  SHEETS.settings = (e, s) => {
    const cer = D.CEREMONIES.find((c) => c.id === e.ceremonyType);
    return `
    ${sheetHead("Ajustes", "Tu evento")}
    <div class="stack" style="margin-top:12px">
      <section class="panel stack--s">
        <div class="row-between"><span class="muted">Pareja</span><strong>${esc(coupleShort(e))}</strong></div>
        <div class="row-between"><span class="muted">Fecha</span><strong>${esc(shortDate(fromISO(e.date)))}</strong></div>
        <div class="row-between"><span class="muted">Ceremonia</span><strong>${esc(cer?.name || "")} · ${fmtT(e.ceremonyTime)}</strong></div>
        <div class="row-between"><span class="muted">Recepción</span><strong>${fmtT(e.receptionStart)} – ${fmtT(e.receptionEnd)}</strong></div>
        <div class="row-between"><span class="muted">Ciudad</span><strong>${esc(e.city)}</strong></div>
        <div class="row-between"><span class="muted">Zona horaria</span><strong>Bogotá (GMT-5)</strong></div>
        <div class="row-between"><span class="muted">Invitados</span><strong>${e.guests}</strong></div>
      </section>
      <section class="panel stack--s"><span class="label">Privacidad</span>
        <p class="small">Los datos de contacto de tus proveedores solo los ves tú y tu co-organizador. Cada proveedor acepta el tratamiento de sus datos la primera vez que abre su enlace (Ley 1581 de 2012).</p>
      </section>
      ${e.example ? "" : `<button class="btn btn--danger btn--block" type="button" data-act="delete-own">${s.armed ? "Toca otra vez para borrar todo" : "Borrar mi evento y sus datos"}</button>`}
    </div>`;
  };

  // G1 · métricas del piloto
  SHEETS.metrics = () => {
    const m = state.metrics;
    const count = (n) => m.filter((x) => x.n === n).length;
    const first = (n) => m.find((x) => x.n === n);
    const onbStart = first("onb_start");
    const onbDone = first("onb_done");
    const resp = m.filter((x) => x.n === "vendor_response" && x.p.ms != null).map((x) => x.p.ms).sort((a, b) => a - b);
    const median = resp.length ? resp[Math.floor(resp.length / 2)] : null;
    const maxStep = m.filter((x) => x.n === "onb_step" || x.n === "onb_start").reduce((a, x) => Math.max(a, x.p.step || 1), 0);
    const signup = [...m].reverse().find((x) => x.n === "signup");
    const fmtMs = (ms) => (ms < 60000 ? `${Math.round(ms / 1000)} s` : ms < 3600e3 ? `${Math.round(ms / 60000)} min` : `${Math.round(ms / 3600e3)} h`);
    const rows = [
      ["Página de inicio", [["Precio mostrado", state.variant ? `USD ${state.variant}` : "—"], ["Visitas", count("landing_view")], ["Clic en ejemplo", count("cta_example")], ["Clic en crear evento", count("cta_create")], ["Pagos (activaciones)", count("payment")]]],
      ["Carga inicial (supuesto 3)", [["Onboarding iniciado", count("onb_start")], ["Onboarding terminado", count("onb_done")], ["Tiempo hasta el primer cronograma", onbStart && onbDone ? fmtMs(onbDone.t - onbStart.t) : "—"], ["Último paso alcanzado", maxStep ? `${maxStep} de 4` : "—"], ["Usos de la importación", count("import_done")], ["Canal de origen", signup?.p.channel || "—"]]],
      ["Proveedores (supuesto 1)", [["Enlaces enviados", count("link_sent")], ["Enlaces abiertos", count("link_opened")], ["Respuestas", count("vendor_response")], ["Tiempo mediano hasta responder", median != null ? fmtMs(median) : "—"], ["Estados marcados por la pareja", count("manual_status")]]],
      ["Día D", [["Retrasos reportados", count("delay_reported")], ["Reajustes aprobados", count("cascade_approved")]]]
    ];
    return `
    ${sheetHead("Validación", "Métricas del prototipo")}
    <div class="stack" style="margin-top:12px">
      <p class="small muted">En el piloto real estas métricas van a un panel interno. Aquí solo cuentan lo que pasó en este navegador.</p>
      ${rows.map(([title, list]) => `<section class="panel stack--s"><span class="label">${title}</span>${list.map(([k, v]) => `<div class="row-between small"><span>${k}</span><strong class="tnum">${esc(v)}</strong></div>`).join("")}</section>`).join("")}
    </div>`;
  };

  // ---------- hojas del proveedor (V2, V3, retraso, privacidad) ----------
  SHEETS.vtime = (e, s) => `
    ${sheetHead("Proponer otra hora", "¿A qué hora puedes?")}
    <div class="stack" style="margin-top:12px">
      <input class="input" type="time" step="900" data-bind="s.time" value="${esc(s.time)}" aria-label="Nueva hora" style="font-size:1.4rem">
      <input class="input" data-bind="s.note" value="${esc(s.note || "")}" maxlength="120" placeholder="Motivo (opcional)" aria-label="Motivo">
      <button class="btn btn--primary btn--lg btn--block" type="button" data-act="v-send-time">Enviar</button>
    </div>`;
  SHEETS.vq = (e, s) => `
    ${sheetHead("Tengo una duda", "Escribe tu duda")}
    <div class="stack" style="margin-top:12px">
      <textarea class="textarea" data-bind="s.text" data-input="vq" maxlength="200" aria-label="Tu duda">${esc(s.text || "")}</textarea>
      <span id="vq-count" class="counter">${(s.text || "").length}/200</span>
      <button class="btn btn--primary btn--lg btn--block" type="button" data-act="v-send-q">Enviar</button>
    </div>`;
  SHEETS.vdelay = (e, s) => `
    ${sheetHead("Voy con retraso", "¿Cuánto te vas a demorar?")}
    <div class="stack" style="margin-top:12px">
      <div class="dd-grid">${[15, 30, 60].map((n) => `<button class="dd-btn dd-btn--risk" type="button" data-act="v-delay" data-min="${n}">${n} min</button>`).join("")}
        <label class="dd-btn" style="cursor:text"><span class="small">Otro</span><input class="input" type="number" min="5" max="240" step="5" data-bind="s.other" data-num="1" value="${s.other || ""}" placeholder="min" style="width:80px;text-align:center" aria-label="Otros minutos"></label></div>
      ${s.other ? `<button class="btn btn--primary btn--block" type="button" data-act="v-delay" data-min="${s.other}">Avisar ${s.other} min</button>` : ""}
      <p class="small muted">La pareja ve tu aviso al instante y ajusta a los demás.</p>
    </div>`;
  SHEETS.vprivacy = (e) => `
    ${sheetHead("Tus datos", "Tus datos y tus derechos")}
    <div class="stack" style="margin-top:12px">
      <p class="small">${esc(coupleName(e))} cargaron tu nombre y tu WhatsApp para coordinar su boda. Coolplanners los usa solo para eso.</p>
      <p class="small">Puedes conocer, actualizar, corregir o pedir que borremos tus datos. Si revocas la autorización, dejas de recibir avisos.</p>
      <div class="btn-row"><button class="btn btn--ghost" type="button" data-act="v-rights" data-v="ver">Ver mis datos</button><button class="btn btn--danger" type="button" data-act="v-rights" data-v="borrar">Pedir borrado</button></div>
    </div>`;

  // =====================================================================
  // V1–V7 · página del proveedor (sin cuenta, sin descarga)
  // =====================================================================
  function vendorCtx() {
    const u = state.ui;
    const e = state[u.vendorEvent];
    const v = e && e.vendors.find((x) => x.id === u.vendorId);
    return { e, v };
  }

  function viewVendor() {
    const u = state.ui;
    const { e, v } = vendorCtx();
    const proto = u.fromCouple ? `<div class="vp-proto"><div class="wrap row-between"><span>Vista del proveedor (prototipo)</span><button class="link-btn" type="button" data-act="v-back">Volver a la pareja</button></div></div>` : "";
    if (!e || !v || v.revoked) {
      return `${proto}<main class="wrap page stack" style="text-align:center;justify-items:center">
        ${icon("unlink", "")}<h1 class="display h2">Este enlace ya no está activo</h1>
        <p class="muted">La pareja lo cambió o el evento terminó. Escríbeles para pedir uno nuevo.</p>
        ${e?.phone ? `<div class="btn-row" style="width:100%"><a class="btn btn--primary" href="${telHref(e.phone)}">Llamar</a><a class="btn btn--ghost" href="${waHref(e.phone, "")}" target="_blank" rel="noopener">WhatsApp</a></div>` : ""}
      </main>`;
    }
    if (!v.openedAt) {
      v.openedAt = Date.now();
      if (["sin_invitar", "invitado"].includes(v.status)) setStatus(v, "abrio", "proveedor");
      log(e, { by: "proveedor", who: `${v.name} (proveedor)`, vendorId: v.id, text: "Abrió su enlace" });
      track("link_opened");
      save();
    }
    return proto + (v.consent ? vendorMain(e, v) : vendorConsent(e, v));
  }

  // V6 · privacidad y avisos (primera visita)
  function vendorConsent(e, v) {
    return `
    <main class="wrap page stack" style="padding-bottom:40px">
      <span class="brand">Coolplanners</span>
      <h1 class="display h2">${esc(coupleName(e))} te invitan a coordinar su boda</h1>
      <p class="muted">${esc(longDate(e.date))} · ${esc(e.city)}</p>
      <section class="panel panel--lilac stack--s">
        <strong>Antes de ver tu parte</strong>
        <p class="small">Coolplanners guarda tu nombre, tu teléfono y tus respuestas solo para coordinar este evento. Los ven ${esc(coupleName(e))}. Puedes pedir ver, corregir o borrar tus datos cuando quieras.</p>
      </section>
      <label class="check"><input type="checkbox" data-change="v-optin" ${state.ui.optin !== false ? "checked" : ""}> Acepto recibir avisos de este evento por WhatsApp y SMS</label>
      <button class="btn btn--primary btn--lg btn--block" type="button" data-act="v-consent">Aceptar y ver mi parte</button>
      <p class="small muted">No necesitas crear cuenta ni descargar nada.</p>
    </main>`;
  }

  // V1 · mi parte del evento
  function vendorMain(e, v) {
    const c = catOf(v.cat);
    const ts = tasksOf(e, v.id);
    const t0 = ts[0];
    const beforeM = new Map();
    const afterM = new Map();
    for (const t of ts) {
      t.after.forEach((a) => { const d = taskById(e, a.id); if (d && d.vendorId !== v.id) beforeM.set(d.id, d); });
      e.tasks.filter((x) => x.vendorId !== v.id && x.after.some((a) => a.id === t.id)).forEach((x) => afterM.set(x.id, x));
    }
    const before = [...beforeM.values()].sort(byStart);
    const after = [...afterM.values()].sort(byStart);
    const who = (t) => { const o = vendorById(e, t.vendorId); return `<div class="row-between small"><span><strong>${esc(o?.name || "")}</strong> · ${esc(catOf(o?.cat).short)}</span><span class="tnum">${fmtT(t.start)}</span></div>`; };
    const placeKey = t0 ? t0.place : "recepcion";
    const q = placeQuery(e, placeKey) || e.city;
    const dd = e.dday.on;
    const answered = isConfirmedLike(v.status) && !v.change;

    let actions;
    if (dd) {
      actions = `<div class="dd-grid">
        <button class="dd-btn" type="button" data-act="v-dd" data-v="en_camino" aria-pressed="${v.status === "en_camino"}">${icon("car")}Voy en camino</button>
        <button class="dd-btn" type="button" data-act="v-dd" data-v="en_lugar" aria-pressed="${v.status === "en_lugar"}">${icon("pin")}Llegué</button>
        <button class="dd-btn" type="button" data-act="v-dd" data-v="termino" aria-pressed="${v.status === "termino"}">${icon("flag")}Estoy listo</button>
        <button class="dd-btn dd-btn--risk" type="button" data-act="v-open" data-sheet="vdelay">${icon("clock")}Voy con retraso</button>
      </div>`;
    } else if (answered && !state.ui.reanswer) {
      actions = `<div class="row-between"><span class="pill" data-tone="ok">${icon("check")}Confirmaste ${esc(rel(v.respondedAt || v.statusAt))}</span><button class="link-btn" type="button" data-act="v-reanswer">Cambiar respuesta</button></div>`;
    } else {
      actions = `${v.request ? `<p class="small" style="margin-bottom:10px">Pediste cambiar a <strong>${fmtT(v.request.time)}</strong>. La pareja lo está revisando.</p>` : ""}<button class="btn btn--ok btn--lg btn--block" type="button" data-act="v-confirm">${icon("check")}Confirmo</button>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn--ghost" type="button" data-act="v-open" data-sheet="vtime">Necesito otra hora</button>
          <button class="btn btn--ghost" type="button" data-act="v-open" data-sheet="vq">Tengo una duda</button>
        </div>`;
    }

    return `
    ${v.change ? `<section class="panel panel--butter" style="border-radius:0"><div class="wrap stack--s">
      <strong class="display h3">Tu hora cambió</strong>
      <p><s class="muted">${fmtT(v.change.from)}</s> → <strong>${fmtT(v.change.to)}</strong> · ${esc(v.change.title)}</p>
      <p class="small">${esc(v.change.reason)}</p>
      <button class="btn btn--primary btn--block" type="button" data-act="v-ack">Enterado</button>
    </div></section>` : ""}
    <figure class="vp-hero" style="margin:0">
      ${c.img ? `<img src="${imgSrc(c.img)}" alt="" width="600" height="800">` : ""}
      <figcaption class="vp-hero__copy"><span class="small">Boda de ${esc(coupleName(e))}</span><h1 class="display h2">${esc(longDate(e.date))}</h1></figcaption>
    </figure>
    <main class="wrap stack" style="padding-block:18px 24px">
      <section class="stack--s"><span class="eyebrow">Tu parte · ${esc(v.name)}</span>
        ${ts.length ? ts.map((t) => `<div class="panel stack--s">
          <div class="vp-time">${fmtT(t.start)}</div>
          <strong>${esc(t.title)}</strong>
          <span class="small muted">${fmtDur(t.dur)} · ${esc(placeName(e, t.place))}</span>
          ${t.reqs.length ? `<div class="stack--s">${t.reqs.map((r) => `<span class="check small">${icon("check", "icon--s")}${esc(r)}</span>`).join("")}</div>` : ""}
        </div>`).join("") : `<p class="muted">La pareja aún no te asigna horas. Te avisamos cuando lo haga.</p>`}
      </section>
      ${before.length ? `<section class="panel panel--lilac stack--s"><span class="label">Antes de ti debe terminar</span>${before.map(who).join("")}</section>` : ""}
      ${after.length ? `<section class="panel panel--sky stack--s"><span class="label">Después de ti sigue</span>${after.map(who).join("")}</section>` : ""}
      <section class="panel stack--s"><span class="label">Dónde</span><strong>${esc(placeName(e, placeKey))}</strong><span class="small muted">${esc(e.city)}</span>
        <div class="btn-row"><a class="btn btn--ghost btn--s" href="${mapsHref(q)}" target="_blank" rel="noopener">${icon("map", "icon--s")}Google Maps</a><a class="btn btn--ghost btn--s" href="${wazeHref(q)}" target="_blank" rel="noopener">${icon("map", "icon--s")}Waze</a></div>
      </section>
      <section class="panel stack--s"><span class="label">Contacto de la pareja</span>
        ${e.phone ? `<div class="btn-row"><a class="btn btn--ghost btn--s" href="${telHref(e.phone)}">${icon("phone", "icon--s")}Llamar</a><a class="btn btn--ghost btn--s" href="${waHref(e.phone, "")}" target="_blank" rel="noopener">${icon("chat", "icon--s")}WhatsApp</a></div>` : `<p class="small muted">La pareja aún no agregó su número.</p>`}
      </section>
      <p class="small muted">${icon("lock", "icon--s")} Quién ve tu información: solo ${esc(coupleName(e))}. Otros proveedores solo ven tu nombre, categoría y hora. <button class="link-btn" type="button" data-act="v-open" data-sheet="vprivacy">Tus datos</button></p>
    </main>
    <div class="vp-actions"><div class="wrap">${actions}</div></div>`;
  }

  // =====================================================================
  // Acciones
  // =====================================================================
  const ACT = {};
  const curEv = () => (state.ui.view === "vendor" ? vendorCtx().e : ev());

  ACT["close-sheet"] = () => closeSheet();
  ACT.back = () => goBack({ view: "landing" });
  ACT.copy = (el) => copyText(el.dataset.text, "Enlace copiado");

  // L1
  ACT.example = () => {
    state.example = buildExample();
    state.current = "example";
    track("cta_example");
    nav({ view: "app", tab: "inicio" });
  };
  ACT.start = () => { track("cta_create"); nav({ view: "auth" }); };
  ACT["open-own"] = () => { state.current = "own"; nav({ view: "app", tab: "inicio" }); };
  ACT.exit = () => { state.current = state.own ? "own" : null; nav({ view: "landing" }); };

  // A1
  ACT.channel = (el) => { state.channel = state.channel === el.dataset.v ? null : el.dataset.v; save(); render(); };
  ACT.auth = (el) => {
    if (el.dataset.method === "email") {
      const mail = $("#auth-email").value.trim();
      if (!/^\S+@\S+\.\S+$/.test(mail)) { toast("Escribe un correo válido."); return; }
      toast("Prototipo: entraste sin abrir el correo.");
    }
    track("signup", { method: el.dataset.method, channel: state.channel });
    if (!state.draft) state.draft = newDraft();
    nav({ view: "onb", onbStep: 1 });
  };

  // P13
  ACT.ceremony = (el) => { state.draft.ceremonyType = el.dataset.id; save(); render(); };
  ACT.cat = (el) => {
    const d = state.draft;
    const id = el.dataset.id;
    d.cats = d.cats.includes(id) ? d.cats.filter((c) => c !== id) : [...d.cats, id];
    if (!d.info[id]) d.info[id] = { name: "", phone: "" };
    save();
    render();
  };
  ACT["onb-back"] = () => { const step = state.ui.onbStep || 1; goBack(step > 1 ? { onbStep: step - 1 } : { view: "auth" }); };
  ACT["onb-skip"] = () => { state.draft.tried = false; nav({ onbStep: 3 }); };
  ACT["onb-next"] = () => {
    const d = state.draft;
    const step = state.ui.onbStep || 1;
    const err = onbErrors(d, step);
    if (Object.keys(err).length) {
      d.tried = true;
      save();
      render();
      const bad = $(".err, .is-bad");
      if (bad) bad.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
    d.tried = false;
    if (step < 4) { nav({ onbStep: step + 1 }); return; }
    const e = buildEvent(draftSource(d));
    log(e, { by: "pareja", who: coupleActor(e), text: `Creó el evento con ${plural(e.vendors.length, "proveedor", "proveedores")} y ${plural(e.tasks.length, "tarea sugerida", "tareas sugeridas")}` });
    state.own = e;
    state.current = "own";
    track("onb_done", { ms: Date.now() - d.startedAt, vendors: e.vendors.length });
    state.draft = null;
    nav({ view: "app", tab: "inicio" });
    toast("¡Listo! Este es tu tablero.");
  };

  // pestañas
  ACT.tab = (el) => nav({ tab: el.dataset.tab }, { push: false });
  ACT["crono-view"] = (el) => nav({ cronoView: el.dataset.v }, { push: false });
  ACT["prov-filter"] = (el) => nav({ provFilter: el.dataset.v }, { push: false });
  ACT.sheet = (el) => openSheet({ type: el.dataset.sheet });
  ACT.activate = (el) => openSheet({ type: "activate", reason: el.dataset.reason || "" });
  ACT["open-task"] = (el) => openSheet({ type: "task", id: el.dataset.id, move: 0 });
  ACT["open-vendor"] = (el) => openSheet({ type: "vendor", id: el.dataset.id });
  ACT["add-vendor"] = () => openSheet({ type: "vendorForm", cat: "floristeria", name: "", contact: "", phone: "", email: "", notes: "" });
  ACT["edit-vendor"] = (el) => {
    const v = vendorById(ev(), el.dataset.id);
    openSheet({ type: "vendorForm", editId: v.id, cat: v.cat, name: v.name, contact: v.contact, phone: v.phone, email: v.email, notes: v.notes });
  };
  ACT["new-task"] = () => openSheet({ type: "newTask", title: "", vendorId: "", time: toHHMM(ev().receptionStart - 120), dur: 60, place: "recepcion", depId: "", reqs: "", critical: false });
  ACT.import = (el) => openSheet({ type: "import", target: el.dataset.target, text: "", map: {} });
  ACT.print = () => { nav({ tab: "crono", cronoView: "dia" }); setTimeout(() => window.print(), 300); };

  // cascada
  ACT["demo-cascade"] = () => {
    const e = ev();
    const t = e.tasks.find((x) => x.key === "flores");
    const v = vendorById(e, t.vendorId);
    openSheet({ type: "cascade", rootId: t.id, newStart: t.start + 30, cause: `${v.name} avisó que llega 30 min tarde al montaje.`, reporter: "proveedor", at: Date.now() });
  };
  ACT["review-request"] = (el) => {
    const e = ev();
    const v = vendorById(e, el.dataset.id);
    const t = tasksOf(e, v.id)[0];
    if (!t || !v.request) return;
    openSheet({ type: "cascade", rootId: t.id, newStart: v.request.time, cause: `${v.name} pidió cambiar su hora a ${fmtT(v.request.time)}.`, reporter: "proveedor", at: Date.now() });
  };
  ACT["open-pending"] = () => { const e = ev(); if (e.pending) openSheet({ type: "cascade", ...e.pending }); };
  ACT.move = (el) => { const s = state.ui.sheet; updateSheet({ move: (s.move || 0) + Number(el.dataset.d) }); };
  ACT["propose-move"] = () => {
    const e = ev();
    const s = state.ui.sheet;
    const t = taskById(e, s.id);
    openSheet({ type: "cascade", rootId: t.id, newStart: t.start + s.move, cause: `Cambio de hora de "${t.title}" hecho por la pareja.`, reporter: "pareja", at: Date.now() });
  };
  ACT.approve = () => {
    const e = ev();
    const s = state.ui.sheet;
    const notified = applyProposal(e, s);
    e.dday.updatedAt = Date.now();
    save();
    render();
    closeSheet();
    toast(notified.length ? (e.activated ? `Listo. Avisamos a ${plural(notified.length, "proveedor", "proveedores")}.` : "Cambio guardado sin avisar.") : "Cambio guardado.");
  };
  ACT.adjust = () => {
    const s = state.ui.sheet;
    const t = taskById(ev(), s.rootId);
    openSheet({ type: "task", id: s.rootId, move: s.newStart - t.start });
  };

  // dependencias
  ACT["add-dep"] = () => {
    const e = ev();
    const s = state.ui.sheet;
    const t = taskById(e, s.id);
    if (!s.depId) { updateSheet({ depErr: "Elige una tarea." }); return; }
    if (wouldCycle(e, t.id, s.depId)) { updateSheet({ depErr: "No se puede: esa tarea ya depende de esta. Se formaría un círculo." }); return; }
    t.after.push({ id: s.depId, gap: Number(s.depGap || 0) });
    t.removedDeps = (t.removedDeps || []).filter((x) => x !== s.depId);
    log(e, { by: "pareja", who: coupleActor(e), taskId: t.id, text: `Ahora "${t.title}" espera a que termine "${taskById(e, s.depId).title}"` });
    save();
    render();
    updateSheet({ depId: "", depGap: 0, depErr: "" });
  };
  ACT["rm-dep"] = (el) => {
    const e = ev();
    const t = taskById(e, state.ui.sheet.id);
    t.after = t.after.filter((a) => a.id !== el.dataset.id);
    t.removedDeps = [...(t.removedDeps || []), el.dataset.id];
    log(e, { by: "pareja", who: coupleActor(e), taskId: t.id, text: `"${t.title}" ya no espera a "${taskById(e, el.dataset.id)?.title}"` });
    save();
    render();
  };

  // proveedores
  ACT["vendor-save"] = () => {
    const e = ev();
    const s = state.ui.sheet;
    const phone = normPhone(s.phone);
    if (!String(s.name || "").trim() || !phone) { updateSheet({ tried: true }); return; }
    if (s.editId) {
      const v = vendorById(e, s.editId);
      Object.assign(v, { cat: s.cat, name: s.name.trim(), contact: s.contact.trim(), phone, email: s.email.trim(), notes: s.notes.trim() });
      log(e, { by: "pareja", who: coupleActor(e), vendorId: v.id, text: "Actualizó los datos del proveedor" });
      toast("Datos guardados");
    } else {
      const v = makeVendor({ cat: s.cat, name: s.name.trim(), contact: s.contact.trim(), phone, email: s.email.trim() });
      v.notes = s.notes.trim();
      e.vendors.push(v);
      const n = addTasksForVendor(e, v);
      log(e, { by: "pareja", who: coupleActor(e), vendorId: v.id, text: `Agregó a ${v.name}${n ? ` y ${plural(n, "tarea sugerida", "tareas sugeridas")}` : ""}` });
      track("vendor_added");
      toast(n ? `Agregado, con ${plural(n, "tarea sugerida", "tareas sugeridas")}` : "Proveedor agregado");
    }
    save();
    render();
    closeSheet();
  };
  ACT["sent-wa"] = (el) => {
    const e = ev();
    const v = vendorById(e, el.dataset.id);
    const first = !v.sentAt;
    v.sentAt = Date.now();
    if (v.status === "sin_invitar") setStatus(v, "invitado", "pareja");
    log(e, { by: "pareja", who: coupleActor(e), vendorId: v.id, text: `${first ? "Envió" : "Reenvió"} el enlace por WhatsApp. SMS y correo automáticos enviados.` });
    track("link_sent", { again: !first });
    save();
    setTimeout(render, 300);
  };
  ACT["copy-link"] = (el) => { const v = vendorById(ev(), el.dataset.id); copyText(`${baseUrl()}#p-${v.token}`, "Enlace copiado"); };
  ACT["regen-link"] = (el) => {
    const e = ev();
    const v = vendorById(e, el.dataset.id);
    v.token = newToken();
    v.revoked = false;
    log(e, { by: "pareja", who: coupleActor(e), vendorId: v.id, text: "Generó un enlace nuevo. El anterior ya no abre." });
    save();
    renderSheet();
    toast("Enlace nuevo listo. El anterior dejó de funcionar.");
  };
  ACT["revoke-link"] = (el) => {
    const e = ev();
    const v = vendorById(e, el.dataset.id);
    v.revoked = !v.revoked;
    log(e, { by: "pareja", who: coupleActor(e), vendorId: v.id, text: v.revoked ? "Revocó el enlace" : "Reactivó el enlace" });
    save();
    renderSheet();
    toast(v.revoked ? "Enlace revocado" : "Enlace activo otra vez");
  };
  ACT["view-as-vendor"] = (el) => nav({ view: "vendor", vendorId: el.dataset.id, vendorEvent: state.current, fromCouple: true, reanswer: false });
  ACT["manual-pick"] = (el) => updateSheet({ manual: el.dataset.v });
  ACT["manual-save"] = (el) => {
    const e = ev();
    const v = vendorById(e, el.dataset.id);
    const s = state.ui.sheet;
    const label = { confirmo: "Confirmó por teléfono", en_camino: "Avisó que va en camino", en_lugar: "Ya llegó", termino: "Terminó" }[s.manual];
    const note = (s.manualNote || "").trim();
    setStatus(v, s.manual, "pareja", note ? `${label}: ${note}` : label);
    if (s.manual === "confirmo") { v.request = null; v.change = null; }
    log(e, { by: "pareja", who: coupleActor(e), vendorId: v.id, text: `Marcó "${D.STATUS[s.manual].label}" a nombre del proveedor${note ? `: ${note}` : ""}` });
    track("manual_status");
    save();
    render();
    updateSheet({ manual: null, manualNote: "" });
    toast("Estado guardado como registrado por la pareja");
  };
  ACT["q-done"] = (el) => {
    const e = ev();
    const v = vendorById(e, el.dataset.id);
    v.question = null;
    log(e, { by: "pareja", who: coupleActor(e), vendorId: v.id, text: "Marcó la duda como resuelta" });
    save();
    render();
  };

  // nueva tarea
  ACT["task-save"] = () => {
    const e = ev();
    const s = state.ui.sheet;
    const start = toMin(s.time);
    if (!String(s.title || "").trim() || start == null) { updateSheet({ tried: true }); return; }
    const t = { id: uid("t"), key: null, title: s.title.trim(), vendorId: s.vendorId || null, start, dur: Number(s.dur) || 60, place: s.place, reqs: String(s.reqs || "").split("\n").map((x) => x.trim()).filter(Boolean), notes: "", critical: !!s.critical, after: s.depId ? [{ id: s.depId, gap: 0 }] : [] };
    e.tasks.push(t);
    log(e, { by: "pareja", who: coupleActor(e), taskId: t.id, vendorId: t.vendorId, text: `Creó la tarea "${t.title}" a las ${fmtT(start)}` });
    save();
    render();
    closeSheet();
    toast("Tarea agregada");
  };

  // importación
  ACT["csv-sample"] = () => { const text = D.SAMPLE_CSV; updateSheet({ text, map: guessMap(parseCsv(text).head) }); };
  ACT["csv-template"] = () => {
    const blob = new Blob(["﻿Categoría;Nombre;Contacto;WhatsApp;Correo\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "plantilla-proveedores.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  ACT["csv-confirm"] = () => {
    const s = state.ui.sheet;
    const rows = importRows(s).filter((r) => !r.errors.length);
    if (s.target === "onb") {
      const d = state.draft;
      for (const r of rows) {
        if (!d.cats.includes(r.cat)) d.cats.push(r.cat);
        d.info[r.cat] = { name: r.name, phone: r.phone, contact: r.contact };
      }
    } else {
      const e = ev();
      let tasks = 0;
      for (const r of rows) {
        const v = makeVendor(r);
        e.vendors.push(v);
        tasks += addTasksForVendor(e, v);
      }
      log(e, { by: "pareja", who: coupleActor(e), text: `Importó ${plural(rows.length, "proveedor", "proveedores")} desde un archivo` });
    }
    track("import_done", { rows: rows.length });
    save();
    render();
    closeSheet();
    toast(`${plural(rows.length, "proveedor importado", "proveedores importados")}`);
  };

  // plantillas
  ACT["tpl-pick"] = (el) => updateSheet({ id: el.dataset.v, text: undefined, err: "" });
  ACT["tpl-reset"] = () => { const s = state.ui.sheet; delete ev().templates[s.id || "invitacion"]; save(); updateSheet({ text: undefined, err: "" }); toast("Plantilla restaurada"); };
  ACT["tpl-save"] = () => {
    const e = ev();
    const s = state.ui.sheet;
    const id = s.id || "invitacion";
    const text = s.text ?? tplText(e, id);
    if (!text.includes("{enlace}")) { updateSheet({ err: "El mensaje siempre debe incluir {enlace}." }); return; }
    const sample = e.vendors[0] || makeVendor({ cat: "floristeria", contact: "Camila" });
    if (fillText(e, text, sample).length > 300) { updateSheet({ err: "Con los datos reales pasa de 300 caracteres. Acórtalo un poco." }); return; }
    e.templates[id] = text;
    save();
    updateSheet({ err: "" });
    toast("Plantilla guardada");
  };

  // pago
  ACT["pay-method"] = (el) => updateSheet({ method: el.dataset.v });
  ACT.pay = () => {
    const e = ev();
    const s = state.ui.sheet;
    updateSheet({ busy: true });
    setTimeout(() => {
      const method = D.PAY_METHODS.find((m) => m.id === (s.method || "pse")).name;
      e.activated = true;
      e.payment = paymentRecord(e, method);
      log(e, { by: "pareja", who: coupleActor(e), text: `Activó el evento: USD ${e.payment.usd} con ${method} (simulado)` });
      track("payment", { usd: e.payment.usd });
      save();
      state.ui.sheet = { type: "receipt" };
      history.replaceState({ ui: snapshot() }, "");
      render();
      toast("Evento activado. Ya puedes enviar los enlaces.");
    }, 1200);
  };

  ACT["delete-own"] = () => {
    const s = state.ui.sheet;
    if (!s.armed) { updateSheet({ armed: true }); setTimeout(() => { if (state.ui.sheet === s) updateSheet({ armed: false }); }, 3000); return; }
    state.own = null;
    state.current = null;
    save();
    nav({ view: "landing" });
    toast("Tu evento y sus datos se borraron de este navegador.");
  };

  // Día D
  ACT["dday-on"] = () => {
    const e = ev();
    if (!e.tasks.length) return;
    e.dday.on = true;
    if (e.dday.clock == null) e.dday.clock = Math.floor((Math.min(...e.tasks.map((t) => t.start)) - 30) / 15) * 15;
    e.dday.updatedAt = Date.now();
    if (e.example && !e.dday.simPrepared) {
      e.vendors.forEach((v) => { if (v.cat !== "dj" && !isConfirmedLike(v.status)) { v.request = null; setStatus(v, "confirmo", "proveedor"); } v.change = null; v.question = null; });
      e.dday.simPrepared = true;
      log(e, { by: "sistema", who: "Coolplanners", text: "Simulación: todos confirmaron menos el DJ" });
    }
    log(e, { by: "pareja", who: coupleActor(e), text: "Activó el modo Día D" });
    track("dday_on");
    save();
    nav({ tab: "inicio" });
  };
  ACT["dday-off"] = () => { const e = ev(); e.dday.on = false; log(e, { by: "pareja", who: coupleActor(e), text: "Salió del modo Día D" }); save(); render(); };
  ACT["sim-step"] = (el) => {
    const e = ev();
    const step = Number(el.dataset.min);
    for (let m = 0; m < step; m += 15) { e.dday.clock += 15; simTick(e); }
    e.dday.updatedAt = Date.now();
    save();
    render();
  };
  ACT["sim-delay"] = () => {
    const e = ev();
    const clock = e.dday.clock;
    const upcoming = [...e.tasks].sort(byStart).filter((t) => t.start > clock && isConfirmedLike(vendorById(e, t.vendorId)?.status) && vendorById(e, t.vendorId)?.status !== "en_lugar");
    const t = upcoming.find((x) => x.key === "flores") || upcoming.find((x) => e.tasks.some((y) => y.after.some((a) => a.id === x.id))) || upcoming[0];
    if (!t) { toast("No quedan proveedores por llegar."); return; }
    vendorDelay(e, vendorById(e, t.vendorId), 30, "proveedor");
    e.dday.updatedAt = Date.now();
    save();
    render();
  };

  // ---------- proveedor ----------
  const vendorResponded = (e, v) => {
    if (!v.respondedAt) track("vendor_response", { ms: v.sentAt ? Date.now() - v.sentAt : null });
    v.respondedAt = Date.now();
  };
  ACT["v-back"] = () => goBack({ view: "app", tab: "prov" });
  ACT["v-consent"] = () => {
    const { e, v } = vendorCtx();
    v.consent = { at: Date.now(), whatsappSms: state.ui.optin !== false, text: "Aviso de privacidad v1" };
    log(e, { by: "proveedor", who: `${v.name} (proveedor)`, vendorId: v.id, text: `Aceptó el aviso de privacidad${v.consent.whatsappSms ? " y los avisos por WhatsApp y SMS" : ""}` });
    save();
    render();
  };
  ACT["v-confirm"] = () => {
    const { e, v } = vendorCtx();
    vendorResponded(e, v);
    v.request = null;
    v.change = null;
    setStatus(v, "confirmo", "proveedor");
    log(e, { by: "proveedor", who: `${v.name} (proveedor)`, vendorId: v.id, text: "Confirmó su hora" });
    state.ui.reanswer = false;
    save();
    render();
    toast(`¡Listo! ${coupleName(e)} ya ven que confirmaste.`);
  };
  ACT["v-reanswer"] = () => { state.ui.reanswer = true; render(); };
  ACT["v-open"] = (el) => {
    const { e, v } = vendorCtx();
    const t0 = tasksOf(e, v.id)[0];
    openSheet({ type: el.dataset.sheet, time: toHHMM(t0 ? t0.start : 12 * 60), note: "", text: "" });
  };
  ACT["v-send-time"] = () => {
    const { e, v } = vendorCtx();
    const s = state.ui.sheet;
    const time = toMin(s.time);
    if (time == null) { toast("Elige una hora."); return; }
    vendorResponded(e, v);
    v.request = { time, note: (s.note || "").trim() };
    setStatus(v, "pidio_cambio", "proveedor");
    log(e, { by: "proveedor", who: `${v.name} (proveedor)`, vendorId: v.id, text: `Pidió otra hora: ${fmtT(time)}${v.request.note ? `. "${v.request.note}"` : ""}` });
    state.ui.reanswer = false;
    save();
    render();
    closeSheet();
    toast("Enviado. La pareja revisa y te confirma.");
  };
  ACT["v-send-q"] = () => {
    const { e, v } = vendorCtx();
    const text = (state.ui.sheet.text || "").trim().slice(0, 200);
    if (!text) { toast("Escribe tu duda."); return; }
    vendorResponded(e, v);
    v.question = { text, at: Date.now() };
    log(e, { by: "proveedor", who: `${v.name} (proveedor)`, vendorId: v.id, text: `Tiene una duda: "${text}"` });
    save();
    render();
    closeSheet();
    toast("Enviado. La pareja te responde pronto.");
  };
  ACT["v-ack"] = () => {
    const { e, v } = vendorCtx();
    const to = v.change.to;
    v.change = null;
    if (!e.dday.on && !isConfirmedLike(v.status)) setStatus(v, "confirmo", "proveedor");
    vendorResponded(e, v);
    log(e, { by: "proveedor", who: `${v.name} (proveedor)`, vendorId: v.id, text: `Enterado del cambio. Nueva hora: ${fmtT(to)}` });
    save();
    render();
    toast("Gracias. La pareja ya lo sabe.");
  };
  ACT["v-dd"] = (el) => {
    const { e, v } = vendorCtx();
    const st = el.dataset.v;
    setStatus(v, st, "proveedor");
    if (st !== "en_camino") v.delay = 0;
    log(e, { by: "proveedor", who: `${v.name} (proveedor)`, vendorId: v.id, text: `Marcó "${D.STATUS[st].label}"` });
    e.dday.updatedAt = Date.now();
    save();
    render();
    toast(`Marcado: ${D.STATUS[st].label}`);
  };
  ACT["v-delay"] = (el) => {
    const { e, v } = vendorCtx();
    const min = Math.max(5, Math.min(240, Number(el.dataset.min) || 15));
    vendorDelay(e, v, min, "proveedor");
    e.dday.updatedAt = Date.now();
    save();
    render();
    closeSheet();
    toast("Avisamos a la pareja. Ellos ajustan a los demás.");
  };
  ACT["v-rights"] = (el) => {
    const { e, v } = vendorCtx();
    log(e, { by: "proveedor", who: `${v.name} (proveedor)`, vendorId: v.id, text: el.dataset.v === "borrar" ? "Pidió borrar sus datos" : "Pidió ver sus datos" });
    save();
    toast(el.dataset.v === "borrar" ? "Solicitud registrada. Prototipo: no se borra nada." : `Tus datos: ${v.name}, ${v.phone || "sin teléfono"}${v.email ? `, ${v.email}` : ""}.`);
  };

  // ---------- eventos del DOM ----------
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    if (el.tagName !== "A") e.preventDefault();
    fn(el, e);
  });

  function setPath(obj, path, val) {
    const keys = path.split(".");
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null || typeof o[keys[i]] !== "object") o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = val;
  }
  const INPUT = {
    tpl: (el) => {
      const e = curEv();
      const sample = e.vendors[0] || makeVendor({ cat: "floristeria", contact: "Camila" });
      const out = fillText(e, el.value, sample);
      $("#tpl-preview").textContent = out;
      const c = $("#tpl-count");
      c.textContent = `${out.length}/300`;
      c.classList.toggle("is-over", out.length > 300);
    },
    vq: (el) => { $("#vq-count").textContent = `${el.value.length}/200`; }
  };
  function onBind(el) {
    const path = el.dataset.bind;
    const val = el.dataset.num ? Number(el.value) : el.value;
    if (path.startsWith("d.")) setPath(state.draft, path.slice(2), val);
    else if (path.startsWith("s.") && state.ui.sheet) setPath(state.ui.sheet, path.slice(2), val);
    if (el.dataset.out) $(el.dataset.out).textContent = el.value;
    if (el.dataset.input) INPUT[el.dataset.input](el);
    save();
  }
  document.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.bind) onBind(e.target); });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.bind) { onBind(el); if (el.dataset.rerender) renderSheet(); return; }
    const k = el.dataset.change;
    if (k === "prep") {
      const p = ev().prep.find((x) => x.id === el.dataset.id);
      p.done = el.checked;
      save();
      render();
    } else if (k === "s-critical") {
      state.ui.sheet.critical = el.checked;
    } else if (k === "v-optin") {
      state.ui.optin = el.checked;
    } else if (k === "csv-file" && el.files && el.files[0]) {
      const reader = new FileReader();
      reader.onload = () => updateSheet({ text: String(reader.result || ""), map: guessMap(parseCsv(String(reader.result || "")).head) });
      reader.onerror = () => toast("No pudimos leer ese archivo. ¿Es un CSV?");
      reader.readAsText(el.files[0]);
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.ui.sheet) closeSheet(); });
  window.addEventListener("online", () => { if (ev()?.dday.on) render(); });
  window.addEventListener("offline", () => { if (ev()?.dday.on) render(); });

  // ---------- arranque ----------
  function boot() {
    const h = location.hash;
    if (h.startsWith("#p-")) {
      const tok = h.slice(3);
      let found = null;
      for (const k of ["own", "example"]) {
        const v = state[k]?.vendors.find((x) => x.token === tok);
        if (v) { found = { vendorEvent: k, vendorId: v.id }; break; }
      }
      state.ui = { view: "vendor", fromCouple: false, ...(found || { vendorEvent: null, vendorId: null }) };
    } else if (h.startsWith("#inv-")) {
      state.ui = { view: state.own ? "app" : "landing", tab: "inicio" };
      if (state.own) state.current = "own";
      setTimeout(() => toast("Prototipo: así entraría tu pareja como co-organizador."), 400);
    } else if (state.ui.view === "vendor" && !state.ui.fromCouple) {
      state.ui = { view: "landing" };
    }
    state.ui.sheet = null;
    history.replaceState({ ui: snapshot() }, "");
    render();
  }

  if ("serviceWorker" in navigator && !inFrame && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  boot();
})();
