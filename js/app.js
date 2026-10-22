(() => {
  "use strict";

  const { steps: STEPS, fees: FEES } = window.PLANNER_DATA;
  const INVOICE = STEPS.length; // step index of the invoice screen
  const STORE_KEY = "ever-after-planner-v1";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();

  const $ = (sel) => document.querySelector(sel);
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const fmt = (n) => money.format(Math.round(n));
  const pct = (f) => `${Math.round(f * 1000) / 10}%`;
  const imgSrc = (name) => `assets/img/${name}.webp`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- dates ----------
  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const longDate = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const shortDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // a Saturday roughly 8 months out
  function defaultDate() {
    const d = addDays(new Date(), 240);
    return toISO(addDays(d, (6 - d.getDay() + 7) % 7));
  }

  // ---------- state ----------
  function freshState() {
    return {
      names: ["", ""],
      date: defaultDate(),
      guests: 120,
      picks: Object.fromEntries(STEPS.map((s) => [s.id, s.multi ? [] : null])),
      step: -1,
      invoiceNo: null,
      issued: null,
      paid: false
    };
  }

  function load() {
    const base = freshState();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch { saved = null; }
    if (!saved || typeof saved !== "object") return base;

    const st = { ...base, ...saved, picks: { ...base.picks } };
    for (const s of STEPS) {
      const valid = new Set(s.options.map((o) => o.id));
      const p = saved.picks && saved.picks[s.id];
      if (s.multi) st.picks[s.id] = Array.isArray(p) ? p.filter((id) => valid.has(id)) : [];
      else st.picks[s.id] = valid.has(p) ? p : null;
    }
    st.guests = clampGuests(st.guests);
    if (!Array.isArray(st.names)) st.names = ["", ""];
    if (!Number.isInteger(st.step) || st.step < -1 || st.step > INVOICE) st.step = -1;
    return st;
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage off, that's fine */ }
  }

  const clampGuests = (n) => Math.min(300, Math.max(20, Math.round(Number(n) / 5) * 5 || 120));

  let state = load();

  // ---------- pricing ----------
  const optionOf = (step, id) => step.options.find((o) => o.id === id);
  const pickedIds = (step) => {
    const p = state.picks[step.id];
    return step.multi ? p : p ? [p] : [];
  };
  const qtyFor = (opt) => (opt.unit === "event" ? 1 : state.guests);

  function priceTag(opt) {
    if (opt.unit === "guest") return `${fmt(opt.price)} / guest`;
    if (opt.unit === "slice") return `${fmt(opt.price)} / slice`;
    return fmt(opt.price);
  }

  function lineItems() {
    const out = [];
    for (const s of STEPS) {
      for (const id of pickedIds(s)) {
        const o = optionOf(s, id);
        if (o) out.push({ step: s, opt: o, qty: qtyFor(o), amount: o.price * qtyFor(o) });
      }
    }
    return out;
  }

  function totals() {
    const lines = lineItems();
    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
    const coordination = Math.round(subtotal * FEES.coordination);
    const tax = Math.round(subtotal * FEES.tax);
    const total = subtotal + coordination + tax;
    const deposit = Math.round(total * FEES.deposit);
    return { lines, subtotal, coordination, tax, total, deposit, balance: total - deposit };
  }

  const isDone = (s) => s.optional || pickedIds(s).length > 0;
  const firstOpenStep = () => {
    const i = STEPS.findIndex((s) => !isDone(s));
    return i === -1 ? INVOICE : i;
  };

  function coupleName() {
    const [a, b] = state.names.map((n) => (n || "").trim());
    if (a && b) return `${a} & ${b}`;
    return a || b || "The happy couple";
  }

  // ---------- navigation ----------
  const screens = { intro: $("#screen-intro"), step: $("#screen-step"), invoice: $("#screen-invoice") };

  function go(step, { push = true } = {}) {
    step = Math.max(-1, Math.min(step, INVOICE));
    if (step === INVOICE && firstOpenStep() !== INVOICE) step = firstOpenStep();
    state.step = step;
    save();

    const which = step === -1 ? "intro" : step === INVOICE ? "invoice" : "step";
    for (const [k, el] of Object.entries(screens)) {
      el.hidden = k !== which;
      el.classList.toggle("is-entering", k === which && !reduceMotion);
    }
    $("#topbar").hidden = which === "intro";
    $("#dock").hidden = which !== "step";

    if (which === "intro") renderIntro();
    if (which === "step") renderStep();
    if (which === "invoice") renderInvoice();
    if (which !== "intro") renderChips();

    window.scrollTo(0, 0);
    if (push) history.pushState({ step }, "");
  }

  window.addEventListener("popstate", (e) => {
    const step = e.state && Number.isInteger(e.state.step) ? e.state.step : -1;
    go(step, { push: false });
  });

  // ---------- intro ----------
  const nameA = $("#name-a");
  const nameB = $("#name-b");
  const dateIn = $("#date");
  const guestsIn = $("#guests");
  const guestsOut = $("#guests-out");

  function renderIntro() {
    nameA.value = state.names[0] || "";
    nameB.value = state.names[1] || "";
    dateIn.value = state.date || "";
    dateIn.min = toISO(new Date());
    guestsIn.value = state.guests;
    guestsOut.textContent = state.guests;
  }

  nameA.addEventListener("input", () => { state.names[0] = nameA.value; save(); });
  nameB.addEventListener("input", () => { state.names[1] = nameB.value; save(); });
  dateIn.addEventListener("change", () => { state.date = dateIn.value; save(); });
  guestsIn.addEventListener("input", () => {
    state.guests = clampGuests(guestsIn.value);
    guestsOut.textContent = state.guests;
    save();
  });

  $("#intro-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!fromISO(state.date)) state.date = defaultDate();
    go(Math.min(firstOpenStep(), STEPS.length - 1));
  });

  // ---------- step ----------
  const grid = $("#grid");

  function renderStep() {
    const s = STEPS[state.step];
    $("#step-eyebrow").textContent = s.label;
    $("#step-title").textContent = s.title;
    $("#step-hint").textContent = s.hint;
    $("#step-count").textContent = `${state.step + 1}/${STEPS.length}`;

    grid.className = `grid ${s.options.length > 4 ? "grid--6" : "grid--4"} ${s.multi ? "grid--multi" : "grid--single"}`;
    grid.setAttribute("aria-label", s.title);
    grid.innerHTML = s.options.map((o, i) => `
      <button class="card" type="button" data-id="${o.id}" aria-pressed="false" style="--i:${i}">
        <img src="${imgSrc(o.img)}" alt="" width="600" height="800" decoding="async" ${i > 1 ? 'loading="lazy"' : ""}>
        <span class="card__check">${CHECK_SVG}</span>
        <span class="card__body">
          <span class="card__name">${esc(o.name)}</span>
          <span class="card__blurb">${esc(o.blurb)}</span>
          <span class="card__price">${priceTag(o)}</span>
        </span>
      </button>`).join("");

    syncCards();
    renderDock(false);
    preload(STEPS[state.step + 1]);
  }

  function syncCards() {
    const s = STEPS[state.step];
    const picked = new Set(pickedIds(s));
    grid.querySelectorAll(".card").forEach((c) => c.setAttribute("aria-pressed", String(picked.has(c.dataset.id))));
    grid.classList.toggle("has-pick", picked.size > 0);
  }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const s = STEPS[state.step];
    const id = card.dataset.id;
    const hadPick = pickedIds(s).length > 0;

    if (s.multi) {
      const list = state.picks[s.id];
      state.picks[s.id] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    } else {
      state.picks[s.id] = id;
    }
    state.paid = false;
    save();
    buzz();
    syncCards();
    renderDock(true);
    renderChips();
    if (!s.multi && !hadPick) nudge($("#next"));
  });

  function preload(step) {
    if (!step) return;
    step.options.forEach((o) => { const im = new Image(); im.decoding = "async"; im.src = imgSrc(o.img); });
  }

  // ---------- dock ----------
  const dockTotal = $("#dock-total");
  let shownTotal = 0;

  function renderDock(animate) {
    const t = totals();
    countTo(dockTotal, animate ? shownTotal : t.total, t.total);
    shownTotal = t.total;

    const imgs = t.lines.map((l) => l.opt.img);
    const shown = imgs.slice(-2).reverse();
    const extra = imgs.length - shown.length;
    $("#dock-picks").innerHTML =
      shown.map((n) => `<img src="${imgSrc(n)}" alt="" width="34" height="34">`).join("") +
      (extra > 0 ? `<span class="dock__more">+${extra}</span>` : "");

    const s = STEPS[state.step];
    const next = $("#next");
    const isLast = state.step === STEPS.length - 1;
    const ready = isDone(s);
    next.disabled = !ready;
    if (!ready) next.textContent = "Pick one";
    else if (isLast) next.textContent = pickedIds(s).length ? "See invoice" : "Skip to invoice";
    else next.textContent = "Next";
  }

  function countTo(el, from, to) {
    if (reduceMotion || from === to) { el.textContent = fmt(to); return; }
    const start = performance.now();
    const dur = 450;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  $("#next").addEventListener("click", () => {
    if (state.step < INVOICE) go(state.step + 1);
  });

  $("#back").addEventListener("click", () => go(state.step - 1));

  // ---------- chips ----------
  function renderChips() {
    const reach = firstOpenStep();
    const items = STEPS.map((s, i) => {
      const first = pickedIds(s)[0];
      const opt = first && optionOf(s, first);
      const dot = opt ? `<img src="${imgSrc(opt.img)}" alt="">` : i + 1;
      const cur = i === state.step;
      return `<li><button class="chip${cur ? " is-current" : ""}" type="button" data-step="${i}" ${i > reach ? "disabled" : ""} ${cur ? 'aria-current="step"' : ""}>
        <span class="chip__dot">${dot}</span>${esc(s.label)}</button></li>`;
    });
    const invCur = state.step === INVOICE;
    items.push(`<li><button class="chip${invCur ? " is-current" : ""}" type="button" data-step="${INVOICE}" ${reach < INVOICE ? "disabled" : ""} ${invCur ? 'aria-current="step"' : ""}>
      <span class="chip__dot">$</span>Invoice</button></li>`);
    $("#chips").innerHTML = items.join("");

    const current = $("#chips .is-current");
    if (current) current.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }

  $("#chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip || chip.disabled) return;
    const step = Number(chip.dataset.step);
    if (step !== state.step) go(step);
  });

  // ---------- invoice ----------
  function ensureInvoiceMeta() {
    if (state.invoiceNo && state.issued) return;
    const d = new Date();
    state.issued = toISO(d);
    state.invoiceNo = `EA-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
    save();
  }

  function renderInvoice() {
    ensureInvoiceMeta();
    $("#step-count").textContent = "Invoice";
    const wed = fromISO(state.date);
    $("#inv-couple").textContent = wed ? `${coupleName()} · ${longDate(wed)}` : coupleName();

    renderBoard();
    $("#guests-inv").value = state.guests;
    $("#guests-inv-out").textContent = state.guests;
    renderPaper();
  }

  function renderBoard() {
    const tiles = [];
    const extras = [];
    for (const s of STEPS) {
      for (const id of pickedIds(s)) {
        const o = optionOf(s, id);
        if (s.multi) extras.push(o);
        else tiles.push({ s, o });
      }
    }
    $("#board").innerHTML = tiles.map(({ s, o }, i) => `
      <figure class="board__tile${i === 0 ? " board__tile--wide" : ""}">
        <img src="${imgSrc(o.img)}" alt="${esc(o.name)}" width="600" height="800">
        <figcaption>${esc(i === 0 ? `${s.label}: ${o.name}` : s.label)}</figcaption>
      </figure>`).join("");
    $("#board-extras").innerHTML = extras.map((o) => `
      <span class="extra-chip"><img src="${imgSrc(o.img)}" alt="" width="26" height="26">${esc(o.name)}</span>`).join("");
  }

  function renderPaper() {
    const t = totals();
    const wed = fromISO(state.date);
    const issued = fromISO(state.issued) || new Date();

    $("#inv-no").textContent = `No. ${state.invoiceNo}`;
    $("#inv-billed").textContent = coupleName();
    $("#inv-date").textContent = wed ? longDate(wed) : "Date to be set";
    $("#inv-issued").textContent = shortDate(issued);
    $("#inv-guests").textContent = `${state.guests} guests`;

    $("#inv-lines").innerHTML = t.lines.map((l) => {
      const how = l.opt.unit === "guest" ? `${l.qty} guests × ${fmt(l.opt.price)}`
        : l.opt.unit === "slice" ? `${l.qty} slices × ${fmt(l.opt.price)}`
        : l.opt.blurb;
      return `<li class="line">
        <img src="${imgSrc(l.opt.img)}" alt="" width="48" height="48">
        <div><div class="line__name">${esc(l.opt.name)}</div><div class="line__meta">${esc(l.step.label)} · ${esc(how)}</div></div>
        <div class="line__amt">${fmt(l.amount)}</div>
      </li>`;
    }).join("");

    $("#inv-totals").innerHTML = `
      <dt>Subtotal</dt><dd>${fmt(t.subtotal)}</dd>
      <dt>Coordination fee (${pct(FEES.coordination)})</dt><dd>${fmt(t.coordination)}</dd>
      <dt>Sales tax (${pct(FEES.tax)})</dt><dd>${fmt(t.tax)}</dd>
      <dt class="grand">Total</dt><dd class="grand">${fmt(t.total)}</dd>`;

    const depositBy = addDays(issued, 7);
    let balanceBy = wed ? addDays(wed, -30) : null;
    if (balanceBy && balanceBy < depositBy) balanceBy = depositBy;
    $("#inv-due").innerHTML = `
      <div class="due__row">
        <span>${state.paid ? "Deposit paid" : "Deposit to lock your date"}<small>${pct(FEES.deposit)} · ${state.paid ? "thanks!" : `due by ${shortDate(depositBy)}`}</small></span>
        <strong>${fmt(t.deposit)}</strong>
      </div>
      <div class="due__row">
        <span>Balance<small>${balanceBy ? `due by ${shortDate(balanceBy)}` : "due 30 days before the wedding"}</small></span>
        <strong>${fmt(t.balance)}</strong>
      </div>`;

    const stamp = $("#stamp");
    stamp.textContent = state.paid ? "Paid · demo" : "Sample";
    stamp.classList.toggle("is-paid", state.paid);

    const pay = $("#pay");
    pay.classList.remove("is-busy");
    pay.disabled = state.paid;
    pay.textContent = state.paid ? "Deposit paid (demo)" : `Pay ${fmt(t.deposit)} deposit`;
  }

  $("#guests-inv").addEventListener("input", (e) => {
    state.guests = clampGuests(e.target.value);
    $("#guests-inv-out").textContent = state.guests;
    state.paid = false;
    save();
    renderPaper();
  });

  $("#pay").addEventListener("click", () => {
    const pay = $("#pay");
    pay.disabled = true;
    pay.classList.add("is-busy");
    pay.innerHTML = '<span class="spinner" aria-hidden="true"></span> Processing…';
    setTimeout(() => {
      $("#paper").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      setTimeout(() => {
        state.paid = true;
        save();
        renderPaper();
        confetti();
        toast("Demo mode: no real money moved. But imagine.");
      }, reduceMotion ? 0 : 550);
    }, 1300);
  });

  $("#edit").addEventListener("click", () => go(0));

  const printBtn = $("#print");
  if (inFrame) printBtn.hidden = true; // print dialogs are blocked inside embeds
  printBtn.addEventListener("click", () => window.print());

  const resetBtn = $("#reset");
  let resetArmed = null;
  resetBtn.addEventListener("click", () => {
    if (!resetArmed) {
      resetBtn.textContent = "Tap again to reset";
      resetBtn.classList.add("btn--warn");
      resetArmed = setTimeout(disarmReset, 3000);
      return;
    }
    disarmReset();
    state = freshState();
    save();
    go(-1);
  });
  function disarmReset() {
    clearTimeout(resetArmed);
    resetArmed = null;
    resetBtn.textContent = "Start over";
    resetBtn.classList.remove("btn--warn");
  }

  $("#copy").addEventListener("click", () => {
    const text = summaryText();
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
      toast(ok ? "Summary copied" : "Copy is blocked here. Try the full site.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast("Summary copied"), fallback);
    } else {
      fallback();
    }
  });

  function summaryText() {
    const t = totals();
    const wed = fromISO(state.date);
    const rows = t.lines.map((l) => `${l.step.label}: ${l.opt.name} — ${fmt(l.amount)}`);
    return [
      `Ever After · Invoice ${state.invoiceNo}`,
      `${coupleName()}${wed ? ` · ${longDate(wed)}` : ""} · ${state.guests} guests`,
      "",
      ...rows,
      "",
      `Subtotal: ${fmt(t.subtotal)}`,
      `Coordination fee: ${fmt(t.coordination)}`,
      `Sales tax: ${fmt(t.tax)}`,
      `TOTAL: ${fmt(t.total)}`,
      `Deposit (${pct(FEES.deposit)}): ${fmt(t.deposit)}`,
      "",
      "Demo invoice. Prices are made up."
    ].join("\n");
  }

  // ---------- little delights ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 2800);
  }

  function nudge(el) {
    if (reduceMotion) return;
    el.classList.remove("nudge");
    void el.offsetWidth;
    el.classList.add("nudge");
  }

  function buzz() {
    try { if (navigator.vibrate) navigator.vibrate(8); } catch { /* not allowed here */ }
  }

  function confetti() {
    if (reduceMotion) return;
    const css = getComputedStyle(document.documentElement);
    const colors = [css.getPropertyValue("--rose"), css.getPropertyValue("--accent"), "#F2C4CE", "#D9B26F"].map((c) => c.trim());
    const canvas = document.createElement("canvas");
    canvas.className = "confetti";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (canvas.width = window.innerWidth * dpr);
    const H = (canvas.height = window.innerHeight * dpr);
    const petals = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.4,
      y: H * 0.7,
      vx: (Math.random() - 0.5) * 16 * dpr,
      vy: (-Math.random() * 18 - 10) * dpr,
      r: (4 + Math.random() * 5) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)]
    }));
    const start = performance.now();
    const frame = (now) => {
      ctx.clearRect(0, 0, W, H);
      for (const p of petals) {
        p.vy += 0.5 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (now - start < 2800) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  history.replaceState({ step: state.step }, "");
  go(state.step, { push: false });
})();
