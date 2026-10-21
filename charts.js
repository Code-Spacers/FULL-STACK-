// Lightweight canvas 2D charts for the resolution console.
// Same DPR/gradient conventions as city-simulation.js — no libraries.

const FONT = "11px Manrope, system-ui, sans-serif";
const LABEL = "#6b8296";
const GRID = "rgba(148,167,181,0.12)";

function setupCanvas(canvas, height) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = rect.width || canvas.parentElement?.clientWidth || 420;
  const h = height || Math.max(140, w * 0.42);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
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

function emptyState(ctx, w, h, message) {
  ctx.fillStyle = LABEL;
  ctx.font = FONT;
  ctx.textAlign = "center";
  ctx.fillText(message, w / 2, h / 2);
}

/** Multi-series area+line chart. series: [{ values, color, fill }], labels under x. */
export function drawAreaLine(canvas, { series = [], labels = [], yMax = null } = {}) {
  const { ctx, w, h } = setupCanvas(canvas, Math.max(160, w0(canvas) * 0.34));
  const valid = series.filter((s) => s.values?.length);
  if (!valid.length) return emptyState(ctx, w, h, "No data yet");
  const padL = 26, padR = 12, padT = 14, padB = labels.length ? 22 : 10;
  const max = yMax ?? Math.max(4, ...valid.flatMap((s) => s.values));
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.fillStyle = LABEL;
  ctx.font = FONT;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 3; i++) {
    const y = padT + (innerH / 3) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(String(Math.round(max - (max / 3) * i)), padL - 6, y);
  }

  const n = Math.max(...valid.map((s) => s.values.length));
  const xAt = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v) => padT + innerH - (Math.min(v, max) / max) * innerH;

  valid.forEach((s) => {
    const pts = s.values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    if (s.fill !== false) {
      const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH);
      grad.addColorStop(0, hexAlpha(s.color, 0.26));
      grad.addColorStop(1, hexAlpha(s.color, 0));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, padT + innerH);
      pts.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[pts.length - 1].x, padT + innerH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    pts.forEach((p) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = s.color; ctx.fill();
    });
  });

  if (labels.length) {
    ctx.fillStyle = LABEL;
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const step = Math.ceil(labels.length / Math.max(3, Math.floor(innerW / 54)));
    labels.forEach((label, i) => {
      if (i % step !== 0 && i !== labels.length - 1) return;
      ctx.fillText(label, xAt(i), padT + innerH + 7);
    });
  }
}

/** Donut chart. slices: [{ value, color }]; `centerTop/centerBottom` in the hole. */
export function drawDonut(canvas, slices = [], { centerTop = "", centerBottom = "", size = 0.9 } = {}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const { ctx, w, h } = setupCanvas(canvas);
  if (!total) return emptyState(ctx, w, h, "No data yet");
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h) / 2 * size;
  const thickness = Math.max(16, radius * 0.3);
  let angle = -Math.PI / 2;
  const gap = total > 1 ? 0.045 : 0;
  slices.forEach((s) => {
    if (!s.value) return;
    const sweep = (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - thickness / 2, angle + gap, angle + sweep - gap);
    ctx.arc(cx, cy, radius + thickness / 2, angle + sweep - gap, angle + gap, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    angle += sweep;
  });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#eaf6ff";
  ctx.font = "700 22px Syne, Manrope, sans-serif";
  ctx.fillText(String(centerTop || total), cx, cy - 7);
  ctx.fillStyle = LABEL;
  ctx.font = FONT;
  ctx.fillText(centerBottom || "total", cx, cy + 12);
}

/** Horizontal bars with left labels and right value text. rows: [{ label, value, color, valueLabel }] */
export function drawHBars(canvas, rows = []) {
  const rowH = 30;
  const { ctx, w, h } = setupCanvas(canvas, rows.length ? rows.length * rowH + 12 : 120);
  if (!rows.length) return emptyState(ctx, w, h, "No data yet");
  const labelW = Math.min(120, w * 0.32);
  const valueW = 44;
  const barW = w - labelW - valueW - 10;
  const max = Math.max(1, ...rows.map((r) => r.value));
  ctx.font = FONT;
  ctx.textBaseline = "middle";
  rows.forEach((r, i) => {
    const y = 8 + i * rowH + rowH / 2;
    ctx.fillStyle = "#9fb3c2";
    ctx.textAlign = "left";
    const label = r.label.length > 16 ? r.label.slice(0, 15) + "…" : r.label;
    ctx.fillText(label, 0, y);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, labelW, y - 5, barW, 10, 5);
    const grad = ctx.createLinearGradient(labelW, 0, labelW + barW, 0);
    grad.addColorStop(0, r.color);
    grad.addColorStop(1, hexAlpha(r.color, 0.45));
    ctx.fillStyle = grad;
    roundRect(ctx, labelW, y - 5, Math.max(3, (r.value / max) * barW), 10, 5);
    ctx.fillStyle = "#eaf6ff";
    ctx.textAlign = "right";
    ctx.fillText(r.valueLabel ?? String(r.value), w, y);
  });
}

function hexAlpha(hex, alpha) {
  if (!hex?.startsWith("#")) return `rgba(148,167,181,${alpha})`;
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  if (hex.length === 4) { r *= 17; g *= 17; b *= 17; }
  return `rgba(${r},${g},${b},${alpha})`;
}

function w0(canvas) {
  return canvas.getBoundingClientRect().width || canvas.parentElement?.clientWidth || 400;
}

export const STATUS_COLORS = {
  Reported: "#ffb020",
  Acknowledged: "#00e5ff",
  "In Progress": "#7a5cff",
  Resolved: "#00ffc6",
};
