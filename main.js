import { initBackground } from "./background.js?v=20261020d";
import { initCitySimulation } from "./city-simulation.js?v=20261020d";
import { mountAccountControls } from "./ui.js?v=20261020d";

const CHALLENGES = [
  { id: "potholes", cat: "mobility", title: "Potholes and damaged roads", desc: "Broken carriageways concentrate risk on two-wheelers and buses.", impact: "Injuries, vehicle damage, and slower emergency response.", solution: "Condition mapping, timely patching, and drainage so water does not reopen the wound." },
  { id: "lights", cat: "safety", title: "Non-functional streetlights", desc: "A dark street is a planning failure, not just a fused lamp.", impact: "Fear after dusk and higher collision risk at crossings.", solution: "Solar lights with outage tickets the public can see." },
  { id: "garbage", cat: "environment", title: "Overflowing garbage bins", desc: "Waste that misses the truck becomes waterlogging later.", impact: "Odour, pests, and blocked storm drains.", solution: "Fill-aware collection and segregation at source." },
  { id: "traffic", cat: "mobility", title: "Traffic congestion", desc: "Congestion is a capacity mismatch, usually for people not cars.", impact: "Lost hours and idling emissions on the same corridors daily.", solution: "Transit priority and adaptive signals, not only extra lanes." },
  { id: "air", cat: "environment", title: "Air pollution", desc: "Air quality is the most public of public goods.", impact: "Chronic respiratory harm, especially for children and outdoor workers.", solution: "Cleaner fleets, dust control, and canopy on hot corridors." },
  { id: "water", cat: "environment", title: "Water wastage", desc: "Leakage is often larger than household carelessness.", impact: "Empty taps elsewhere and flooded streets after rain.", solution: "Leak repair, rainwater harvesting, and visible metering." },
  { id: "green", cat: "access", title: "Insufficient green spaces", desc: "Shade is infrastructure. Parks are not leftover land.", impact: "Heat stress and no safe play within a short walk.", solution: "Pocket parks, street trees, and protected existing canopy." },
  { id: "walk", cat: "access", title: "Poor pedestrian accessibility", desc: "If you cannot walk it, the city is not inclusive.", impact: "People using wheelchairs, strollers, or canes are forced into traffic.", solution: "Continuous sidewalks, kerb cuts, and 30 km/h design speeds." },
];

function initNav() {
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  const toTop = document.getElementById("toTop");
  const progress = document.getElementById("scrollProgress");

  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  links?.addEventListener("click", (e) => { if (e.target.closest("a")) nav.classList.remove("is-open"); });

  const sections = [...document.querySelectorAll("main section[id]")];
  const navAnchors = [...document.querySelectorAll(".nav-links a")];
  const onScroll = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 24);
    toTop.classList.toggle("is-on", window.scrollY > 600);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
    const y = window.scrollY + 140;
    let current = sections[0]?.id;
    sections.forEach((s) => { if (s.offsetTop <= y) current = s.id; });
    const alias = { calculator: "solutions", impact: "about", report: "solutions" };
    const mapped = alias[current] || current;
    navAnchors.forEach((a) => {
      const href = a.getAttribute("href")?.slice(1);
      a.classList.toggle("is-active", href === mapped || href === current);
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function initChallenges() {
  const grid = document.getElementById("challengeGrid");
  const filters = document.getElementById("challengeFilters");
  const modal = document.getElementById("challengeModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const cta = document.getElementById("modalCta");
  const close = document.getElementById("modalClose");
  if (!grid) return;

  const visuals = {
    potholes: `<path d="M20 70c20-18 40-8 70-14 28-6 40 10 70 4 22-4 40-16 60-8" stroke="#00e5ff" fill="none"/><circle cx="90" cy="78" r="10" fill="none" stroke="#00ffc6"/>`,
    lights: `<path d="M120 18v36" stroke="#00e5ff"/><circle cx="120" cy="64" r="10" fill="#00e5ff" opacity=".35" stroke="#00ffc6"/><path d="M40 96h160" stroke="#94a7b5" opacity=".4"/>`,
    garbage: `<rect x="88" y="36" width="64" height="58" rx="6" stroke="#00e5ff"/><path d="M80 36h80" stroke="#00ffc6"/><path d="M100 28h40" stroke="#00e5ff"/>`,
    traffic: `<rect x="30" y="48" width="70" height="28" rx="4" stroke="#00e5ff"/><rect x="120" y="48" width="70" height="28" rx="4" stroke="#00ffc6"/><path d="M20 92h200" stroke="#94a7b5"/>`,
    air: `<path d="M30 70c30-30 50-10 80-20s50-28 100-8" stroke="#00e5ff" fill="none"/><path d="M40 90c40-20 60 4 90-6 40-12 60 6 80 0" stroke="#00ffc6" fill="none" opacity=".7"/>`,
    water: `<path d="M120 24c28 36 48 50 48 78a48 48 0 11-96 0c0-28 20-42 48-78z" stroke="#00e5ff"/>`,
    green: `<circle cx="120" cy="48" r="28" stroke="#00ffc6"/><path d="M120 48v48M88 96h64" stroke="#00e5ff"/>`,
    walk: `<path d="M40 88h160" stroke="#00e5ff"/><path d="M70 88V48h20v40" stroke="#00ffc6"/><circle cx="80" cy="36" r="6" stroke="#00e5ff"/>`,
  };
  const visual = (id) => `<svg viewBox="0 0 240 110" width="100%" height="110" aria-hidden="true"><rect width="240" height="110" fill="#071018"/>${visuals[id] || ""}</svg>`;

  grid.innerHTML = CHALLENGES.map((c) => `
    <button class="glass challenge" data-cat="${c.cat}" data-id="${c.id}" type="button">
      <div class="challenge-visual">${visual(c.id)}</div>
      <div class="challenge-body"><h3>${c.title}</h3><p>${c.desc}</p></div>
    </button>`).join("");

  function openModal(c) {
    title.textContent = c.title;
    body.innerHTML = `<p>${c.desc}</p><p><strong>Impact:</strong> ${c.impact}</p><p><strong>Path forward:</strong> ${c.solution}</p>`;
    cta.setAttribute("href", "#solutions");
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
    close.focus();
  }
  function hideModal() { modal.classList.remove("is-open"); setTimeout(() => (modal.hidden = true), 300); }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".challenge");
    if (card) openModal(CHALLENGES.find((c) => c.id === card.dataset.id));
  });
  close?.addEventListener("click", hideModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal?.classList.contains("is-open")) hideModal(); });

  filters?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    filters.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-on", c === btn));
    const f = btn.dataset.filter;
    grid.querySelectorAll(".challenge").forEach((card) => { card.hidden = f !== "all" && card.dataset.cat !== f; });
  });
}

function initReveals() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nodes = document.querySelectorAll(".reveal, [data-reveal]");
  if (reduced) { nodes.forEach((n) => n.classList.add("is-in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  nodes.forEach((n) => io.observe(n));
}

function initCounters() {
  const els = document.querySelectorAll("[data-count]");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const end = Number(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const start = performance.now();
      const dur = 1300;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = `${Math.round(end * eased)}${suffix}`;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      io.unobserve(el);
    });
  }, { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
}

function initClock() {
  const el = document.getElementById("cityClock");
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
  tick();
  setInterval(tick, 1000);
}

function initReporting() {
  const form = document.getElementById("reportForm");
  const list = document.getElementById("reportList");
  const err = document.getElementById("formError");
  const ok = document.getElementById("formSuccess");
  if (!form) return;
  const KEY = "nivara_reports";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
  const save = (r) => localStorage.setItem(KEY, JSON.stringify(r));

  function render() {
    const reports = load();
    if (!reports.length) {
      list.innerHTML = `<div class="report-item"><p>No reports yet. Submit the form to create a local demonstration record.</p></div>`;
      return;
    }
    list.innerHTML = reports.map((r) => `
      <div class="report-item">
        <h4>${r.category} · ${r.id}</h4>
        <p>${r.description}</p>
        <p style="color:var(--dim);margin-top:4px">📍 ${r.location} · ${new Date(r.ts).toLocaleString()}</p>
        <span class="status">${r.status}</span>
      </div>`).join("");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    err.textContent = ""; ok.textContent = "";
    const data = new FormData(form);
    const category = data.get("category");
    const description = (data.get("description") || "").toString().trim();
    const location = (data.get("location") || "").toString().trim();
    if (!category || !description || !location) { err.textContent = "Please fill category, description, and location."; return; }
    const reports = load();
    const rec = { id: "NV-" + Math.random().toString(36).slice(2, 7).toUpperCase(), category, description, location, ts: Date.now(), status: "Submitted" };
    reports.unshift(rec);
    save(reports);
    render();
    form.reset();
    ok.textContent = `Report ${rec.id} saved locally. Status: Submitted.`;
  });
  render();
}

function initCalculator() {
  const form = document.getElementById("calcForm");
  const result = document.getElementById("calcResult");
  const tripLabel = document.getElementById("tripLabel");
  if (!form) return;
  const trips = form.querySelector("[name=trips]");
  trips?.addEventListener("input", () => { tripLabel.textContent = trips.value; });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const t = Number(fd.get("trips") || 0);
    const co2 = t * 8 * (120 - 40) / 1000; // kg per week
    const kwh = (fd.get("leds") ? 0.7 * 7 : 0);
    const water = (fd.get("water") ? 40 * 7 : 0);
    const seg = fd.get("segregate") ? "Adopted" : "Not selected";
    result.innerHTML = `
      <small class="kicker">Illustrative week</small>
      <div class="stat"><span>CO₂e avoided (transport)</span><b>${co2.toFixed(1)} kg</b></div>
      <div class="stat"><span>Electricity avoided</span><b>${kwh.toFixed(1)} kWh</b></div>
      <div class="stat"><span>Water saved</span><b>${water} L</b></div>
      <div class="stat"><span>Waste segregation</span><b>${seg}</b></div>
      <p class="demo-note" style="margin-top:14px">Order-of-magnitude estimates based on the assumptions printed below the form.</p>`;
  });
  document.getElementById("calcReset")?.addEventListener("click", () => {
    result.innerHTML = `<small class="kicker">Illustrative week</small><p style="color:var(--muted);margin-top:10px">Adjust the inputs and estimate.</p>`;
  });
}

function paintSolutionArt() {
  const art = {
    lights: ["#00e5ff", "M40 140 L90 40 L140 140", "sun"],
    waste: ["#00ffc6", "M60 60 h60 v70 h-60 z", "bin"],
    traffic: ["#00e5ff", "M30 100 h120", "road"],
    water: ["#00ffc6", "M90 30 c30 40 40 60 40 80 a40 40 0 1 1 -80 0 c0-20 10-40 40-80", "drop"],
    transit: ["#00e5ff", "M50 50 h80 v50 h-80 z", "bus"],
    roofs: ["#00ffc6", "M40 90 L90 50 L140 90", "roof"],
    streets: ["#00e5ff", "M30 120 h120 M60 120 V70 h20 v50", "walk"],
    civic: ["#00ffc6", "M60 40 h60 v80 h-60 z", "report"],
  };
  document.querySelectorAll("[data-art]").forEach((el) => {
    const key = el.dataset.art;
    const [color, path] = art[key] || ["#00e5ff", "M40 90 h100", ""];
    el.innerHTML = `<svg viewBox="0 0 180 180" width="100%" height="160" aria-hidden="true">
      <defs><linearGradient id="g-${key}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="0.9"/><stop offset="1" stop-color="#7a5cff" stop-opacity="0.7"/>
      </linearGradient></defs>
      <rect width="180" height="180" fill="#071018"/>
      <circle cx="90" cy="90" r="60" fill="${color}" opacity="0.05"/>
      <path d="${path}" stroke="url(#g-${key})" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="16" y="26" fill="#94a7b5" font-size="10" font-family="Manrope, sans-serif" letter-spacing="2">${key.toUpperCase()}</text>
    </svg>`;
  });
}

function boot() {
  document.getElementById("year").textContent = new Date().getFullYear();
  initBackground();
  initNav();
  initChallenges();
  initCitySimulation();
  initReporting();
  initCalculator();
  initReveals();
  initCounters();
  initClock();
  mountAccountControls();
  paintSolutionArt();
  setTimeout(() => document.getElementById("loader")?.classList.add("is-done"), 850);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
