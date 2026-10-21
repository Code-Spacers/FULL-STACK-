// Live City Intelligence — labelled demonstration dashboard.
// Not connected to municipal sensors; values are synthetic.

const DISTRICTS = {
  ridge: { name: "Ridge District", air: 62, energy: 71, waste: 54, water: 48, transit: 66, green: 31, series: [58, 60, 59, 63, 61, 62, 64] },
  harbour: { name: "Harbour Belt", air: 48, energy: 82, waste: 61, water: 44, transit: 78, green: 18, series: [44, 46, 49, 47, 50, 48, 51] },
  meadow: { name: "Meadow Arc", air: 78, energy: 58, waste: 70, water: 63, transit: 52, green: 44, series: [74, 76, 75, 77, 78, 79, 78] },
};

const TIME_MOD = {
  morning: { air: 4, energy: -8, waste: -4, water: 6, transit: 8, green: 0 },
  peak: { air: -10, energy: 12, waste: 6, water: 4, transit: 16, green: -2 },
  night: { air: 8, energy: -4, waste: -6, water: -8, transit: -10, green: 3 },
};

function clamp(n) { return Math.max(8, Math.min(96, Math.round(n))); }

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = rect.width || 480;
  const h = w * 0.38;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function drawLine(canvas, values, color) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(148,167,181,0.12)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, (h / 4) * i); ctx.lineTo(w, (h / 4) * i); ctx.stroke(); }
  const pad = 14;
  const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * (w - pad * 2) + pad, y: h - (v / 100) * (h - pad * 2) - pad }));
  // area fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(0,229,255,0.28)");
  grad.addColorStop(1, "rgba(0,229,255,0)");
  ctx.beginPath();
  ctx.moveTo(pts[0].x, h);
  pts.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  // line
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
  // dots
  pts.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
}

function drawBars(canvas, a, b) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const pad = 20;
  const bw = Math.min(56, w * 0.18);
  const bh = (a / 100) * (h - pad * 2);
  const bh2 = (b / 100) * (h - pad * 2);
  const g1 = ctx.createLinearGradient(0, h - bh - pad, 0, h - pad);
  g1.addColorStop(0, "#00e5ff"); g1.addColorStop(1, "rgba(0,229,255,0.3)");
  ctx.fillStyle = g1;
  roundRect(ctx, w * 0.24 - bw / 2, h - bh - pad, bw, bh, 6);
  const g2 = ctx.createLinearGradient(0, h - bh2 - pad, 0, h - pad);
  g2.addColorStop(0, "#00ffc6"); g2.addColorStop(1, "rgba(0,255,198,0.3)");
  ctx.fillStyle = g2;
  roundRect(ctx, w * 0.6 - bw / 2, h - bh2 - pad, bw, bh2, 6);
  ctx.fillStyle = "#94a7b5";
  ctx.font = "12px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Energy", w * 0.24, h - 4);
  ctx.fillText("Transit", w * 0.6, h - 4);
}

function roundRect(ctx, x, y, w, h, r) {
  if (h < 0) { y += h; h = -h; }
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function paintMap(svg, district) {
  const nodes = {
    ridge: [[80, 70], [140, 90], [110, 150]],
    harbour: [[250, 80], [320, 120], [280, 180]],
    meadow: [[90, 200], [170, 210], [210, 160]],
  };
  svg.innerHTML = `
    <defs>
      <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#00ffc6" stop-opacity="0.5"/><stop offset="100%" stop-color="#00ffc6" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="400" height="280" fill="#071018" rx="8"/>
    <path d="M20 240 C90 180, 140 200, 200 150 S330 90, 380 70" stroke="rgba(0,229,255,.25)" fill="none" stroke-width="1.5"/>
    <path d="M30 60 L120 40 L210 80 L300 50 L370 90 L340 180 L250 230 L140 250 L50 190 Z" fill="#0b141b" stroke="rgba(0,229,255,.35)"/>
    ${["ridge", "harbour", "meadow"].map((key) =>
      nodes[key].map(([x, y]) => {
        const on = key === district;
        return `${on ? `<circle cx="${x}" cy="${y}" r="20" fill="url(#nodeGlow)"/>` : ""}
          <circle cx="${x}" cy="${y}" r="${on ? 7 : 4}" fill="${on ? "#00ffc6" : "#00e5ff"}" opacity="${on ? 1 : 0.35}"/>`;
      }).join("")
    ).join("")}
  `;
}

export function initCitySimulation() {
  const kpiGrid = document.getElementById("kpiGrid");
  const districtSelect = document.getElementById("districtSelect");
  const timeSelect = document.getElementById("timeSelect");
  const airChart = document.getElementById("airChart");
  const mixChart = document.getElementById("mixChart");
  const cityMap = document.getElementById("cityMap");
  const sysStatus = document.getElementById("sysStatus");
  if (!kpiGrid || !districtSelect) return;

  const metrics = [
    ["Air quality index", "air", "Higher is cleaner in this demo"],
    ["Energy load", "energy", "% of modelled peak"],
    ["Waste collection", "waste", "% of scheduled routes complete"],
    ["Water use", "water", "% of daily allocation"],
    ["Public transport", "transit", "Service occupancy index"],
    ["Green cover", "green", "% canopy in district model"],
  ];
  kpiGrid.innerHTML = metrics.map(([label, key, hint]) => `
    <article class="glass kpi" data-key="${key}" title="${hint}">
      <div class="label">${label}</div>
      <div class="value" data-val>0</div>
      <div class="meter"><span></span></div>
    </article>`).join("");

  function render() {
    const base = DISTRICTS[districtSelect.value];
    const mod = TIME_MOD[timeSelect.value];
    const values = {};
    Object.keys(mod).forEach((k) => { values[k] = clamp(base[k] + mod[k]); });
    kpiGrid.querySelectorAll(".kpi").forEach((card) => {
      const key = card.dataset.key;
      const n = values[key];
      card.querySelector("[data-val]").textContent = n;
      card.querySelector(".meter span").style.width = `${n}%`;
    });
    if (airChart) drawLine(airChart, base.series.map((n) => clamp(n + mod.air / 4)), "#00e5ff");
    if (mixChart) drawBars(mixChart, values.energy, values.transit);
    if (cityMap) paintMap(cityMap, districtSelect.value);
    if (sysStatus) sysStatus.textContent = `System: ${base.name} · ${timeSelect.options[timeSelect.selectedIndex].text} · demonstration`;
  }

  districtSelect.addEventListener("change", render);
  timeSelect.addEventListener("change", render);
  window.addEventListener("resize", () => { clearTimeout(window.__simT); window.__simT = setTimeout(render, 150); });
  render();
}
