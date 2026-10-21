// OpenStreetMap fallback — the free, key-less backup for every map feature.
//
// Google's key (js/config.js) is rejected when its Cloud project has no
// billing enabled, which takes down three things at once: the map tiles, the
// Places autocomplete, and Geocoding. This module keeps all three alive with
// Leaflet + OSM tiles and Nominatim search, and it is only ever loaded when
// the Google path fails, so a working Google key still serves every map.
//
// Leaflet is injected on demand from a CDN (unpkg); nothing else in the
// project imports it.

import { CATEGORY_COLORS } from "./store.js?v=20261020d";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const NOMINATIM = "https://nominatim.openstreetmap.org";

let leafletPromise;

/** Load Leaflet once (CSS + JS) and resolve with `window.L`. */
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-nivara-leaflet]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      link.setAttribute("data-nivara-leaflet", "");
      document.head.append(link);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.defer = true;
    script.setAttribute("data-nivara-leaflet", "");
    script.onload = () => {
      if (window.L) resolve(window.L);
      else { leafletPromise = null; reject(new Error("OpenStreetMap library did not initialise.")); }
    };
    script.onerror = () => {
      leafletPromise = null;
      reject(new Error("OpenStreetMap could not load — check the internet connection."));
    };
    document.head.append(script);
  });
  return leafletPromise;
}

function baseMap(container, center, zoom) {
  const L = window.L;
  container.innerHTML = "";
  const map = L.map(container, {
    center: [center.lat, center.lng],
    zoom,
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: true,
  });
  L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION, maxNativeZoom: 19 }).addTo(map);
  // The container is sized by CSS; Leaflet needs a nudge after the swap.
  setTimeout(() => map.invalidateSize(), 80);
  return map;
}

const hasCoords = (r) =>
  Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude));

/**
 * Issue map for map.html: pan/zoom API shaped like the Google adapter, with
 * category-coloured pins, report popups and click-through to the list.
 */
export async function createOsmIssueMap(container, { center, zoom = 12, popupHtml, onSelect } = {}) {
  const L = await loadLeaflet();
  const map = baseMap(container, center, zoom);
  const group = L.layerGroup().addTo(map);

  return {
    provider: "openstreetmap",
    setMarkers(reports) {
      group.clearLayers();
      for (const report of reports || []) {
        if (!hasCoords(report)) continue;
        const marker = L.circleMarker([Number(report.latitude), Number(report.longitude)], {
          radius: 9,
          weight: 2,
          color: "#ffffff",
          fillColor: CATEGORY_COLORS[report.category] || "#00e5ff",
          fillOpacity: 1,
        });
        if (popupHtml) marker.bindPopup(popupHtml(report), { closeButton: true });
        marker.on("click", () => onSelect?.(report));
        group.addLayer(marker);
      }
    },
    panTo({ lat, lng }) { map.setView([lat, lng], map.getZoom(), { animate: true }); },
    setZoom(level) { map.setZoom(level); },
    focus({ lat, lng }) { map.setView([lat, lng], 16, { animate: true }); },
    reset() { map.setView([center.lat, center.lng], zoom ?? 12, { animate: true }); },
    destroy() { try { map.remove(); } catch { /* already gone */ } },
  };
}

/**
 * Location picker for report.html. Same shape as the Google picker
 * (panTo / setZoom / setMarker / reset) so the form code stays identical.
 * Click or drag the pin to set the report coordinates.
 */
export async function createOsmPicker(container, { center, zoom = 13, onPick, onMove } = {}) {
  const L = await loadLeaflet();
  const map = baseMap(container, center, zoom);
  const marker = L.marker([center.lat, center.lng], { draggable: true, autoPan: true }).addTo(map);

  const pick = (lat, lng) => onPick?.(Number(lat), Number(lng));
  map.on("click", (e) => { marker.setLatLng(e.latLng); pick(e.latLng.lat, e.latLng.lng); });
  marker.on("dragend", () => { const p = marker.getLatLng(); pick(p.lat, p.lng); });
  marker.on("drag", () => { const p = marker.getLatLng(); onMove?.(p.lat, p.lng); });

  return {
    provider: "openstreetmap",
    panTo({ lat, lng }) { map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true }); },
    setZoom(level) { map.setZoom(level); },
    setMarker(lat, lng) { marker.setLatLng([lat, lng]); map.panTo([lat, lng]); },
    reset() { map.setView([center.lat, center.lng], zoom ?? 13); marker.setLatLng([center.lat, center.lng]); },
    destroy() { try { map.remove(); } catch { /* already gone */ } },
  };
}

/* ------------------------------------------------------------- Nominatim
   Address search and reverse lookup without an API key. Nominatim's usage
   policy asks for low volume and a identifying referer — requests here are
   debounced by the caller (one per keystroke pause) and sent from the page
   normally, so a demo stays well inside the limit.                        */

async function nominatim(path, params) {
  const url = `${NOMINATIM}/${path}?${new URLSearchParams({ format: "jsonv2", ...params })}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Address lookup unavailable (${response.status}).`);
  return response.json();
}

export async function nominatimGeocode(address) {
  const rows = await nominatim("search", { q: String(address || "").trim(), limit: 1, addressdetails: 0 });
  if (!rows.length) throw new Error("No matching place found for that address.");
  return {
    latitude: Number(rows[0].lat),
    longitude: Number(rows[0].lon),
    formatted: rows[0].display_name,
  };
}

export async function nominatimReverse(lat, lng) {
  const rows = await nominatim("reverse", { lat, lon: lng });
  return rows?.display_name || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

/**
 * Address suggestions in the same dropdown markup the Google autocomplete
 * uses (.autocomplete-list / .autocomplete-item), so the styles match.
 */
export function attachNominatimAutocomplete(input, onSelect, { delay = 420, limit = 5 } = {}) {
  let box = input.parentElement?.querySelector(".autocomplete-list");
  if (!box) {
    box = document.createElement("div");
    box.className = "autocomplete-list";
    box.hidden = true;
    input.parentElement?.append(box);
  }

  let items = [];
  let timer;
  let token = 0;

  const close = () => { box.hidden = true; box.innerHTML = ""; };
  const open = (rows) => {
    items = rows;
    if (!rows.length) return close();
    box.innerHTML = rows
      .map((row, i) => {
        const parts = String(row.display_name || "").split(", ");
        const title = parts.shift();
        return `<button type="button" class="autocomplete-item" data-i="${i}"><strong>${title}</strong><small>${parts.join(", ")}</small></button>`;
      })
      .join("");
    box.hidden = false;
  };

  input.addEventListener("input", () => {
    clearTimeout(timer);
    const value = input.value.trim();
    if (value.length < 3) return close();
    const myToken = ++token;
    timer = setTimeout(async () => {
      try {
        const rows = await nominatim("search", { q: value, limit, addressdetails: 0 });
        if (myToken !== token || input.value.trim() !== value) return;
        open(rows);
      } catch { if (myToken === token) close(); }
    }, delay);
  });

  box.addEventListener("click", (e) => {
    const btn = e.target.closest(".autocomplete-item");
    if (!btn) return;
    const row = items[Number(btn.dataset.i)];
    if (!row) return;
    input.value = row.display_name;
    close();
    onSelect?.({
      latitude: Number(row.lat),
      longitude: Number(row.lon),
      formatted: row.display_name,
    });
  });

  input.addEventListener("blur", () => setTimeout(close, 180));
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  return { close, get available() { return true; } };
}
