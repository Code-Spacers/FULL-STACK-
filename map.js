import { initBackground } from "./background.js?v=20261020d";
import { mountNav, initPageChrome, showToast, formatDate, escapeHtml } from "./ui.js?v=20261020d";
import { readReports, seedDemoReports, DEMO_REPORTS, CATEGORY_COLORS } from "./store.js?v=20261020d";
import {
  loadGoogleMaps, getMapId, makePin, mapsPlaceholder,
  lookupAddress, googleMapsRejected, onMapsRejected,
} from "./maps.js?v=20261020d";
import { createOsmIssueMap } from "./osm-map.js?v=20261020d";

const CENTER = { lat: 12.9716, lng: 77.5946 };

initBackground();
mountNav("map");
initPageChrome();
// Seeding touches localStorage; if the browser refuses the write the page
// must still render the list instead of the whole module aborting.
try {
  seedDemoReports(DEMO_REPORTS);
} catch (err) {
  console.warn("NIVARA: could not seed demo reports.", err);
}

const canvas = document.getElementById("mapCanvas");
const listEl = document.getElementById("mapList");
const countEl = document.getElementById("mapCount");
const filtersEl = document.getElementById("mapFilters");
const searchEl = document.getElementById("mapSearch");

let reports = readReports();
let activeFilter = "All";
let query = "";

// mapApi is a small adapter with the same shape for both providers:
//   Google Maps JavaScript API  →  OpenStreetMap (Leaflet) when Google fails
let mapApi = null;
let building = null;

const hasCoords = (r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude));

/* --------------------------------------------------------------- providers */

// Google's official Maps JavaScript API (roadmap, Google's default map type
// and visual style). js/maps.js owns loading and the key; a rejected key
// surfaces later through gm_authFailure, which onMapsRejected() turns into a
// swap to the OpenStreetMap fallback below.
async function buildGoogleMap() {
  const maps = await loadGoogleMaps();
  const { Map: MapClass, InfoWindow } = await maps.importLibrary("maps");
  canvas.innerHTML = "";

  const options = {
    center: CENTER,
    zoom: 12,
    mapTypeId: "roadmap",
    disableDefaultUI: false,
    zoomControl: true,
    clickableIcons: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
  };
  // Advanced markers require a map ID; DEMO_MAP_ID is Google's public sample.
  const mapId = getMapId();
  let googleMap;
  try {
    googleMap = new MapClass(canvas, mapId ? { ...options, mapId } : options);
  } catch (err) {
    // A rejected map ID must not take the whole map down.
    googleMap = new MapClass(canvas, options);
  }

  const infoWindow = new InfoWindow();
  const markerLib = await maps.importLibrary("marker");
  const { AdvancedMarkerElement, Marker } = markerLib;
  let markers = [];

  const popupContent = (report) => `<div class="gm-popup">
    <strong>${escapeHtml(report.title)}</strong>
    <p>${escapeHtml(report.location)}${report.ward ? ` · ${escapeHtml(report.ward)}` : ""}</p>
    <span class="badge badge-muted">${escapeHtml(report.status)}</span>
    ${report.createdAt || report.reportedAt ? `<small>${escapeHtml(formatDate(report.createdAt || report.reportedAt))}</small>` : ""}
  </div>`;

  return {
    provider: "google",
    async setMarkers(rows) {
      markers.forEach((marker) => { marker.map = null; });
      markers = [];
      for (const report of rows) {
        if (!hasCoords(report)) continue;
        const position = { lat: Number(report.latitude), lng: Number(report.longitude) };
        try {
          let marker;
          if (AdvancedMarkerElement) {
            marker = new AdvancedMarkerElement({ map: googleMap, position, title: report.title });
            try { marker.append(await makePin(maps, report.category)); } catch { /* default pin */ }
            marker.addListener("click", () => {
              select(report, false);
              infoWindow.setContent(popupContent(report));
              infoWindow.open({ map: googleMap, anchor: marker });
            });
          } else {
            marker = new Marker({ map: googleMap, position, title: report.title });
            marker.addListener("click", () => {
              select(report, false);
              infoWindow.setContent(popupContent(report));
              infoWindow.open({ map: googleMap, anchor: marker });
            });
          }
          markers.push(marker);
        } catch (err) {
          console.warn("NIVARA: could not place a marker.", err);
        }
      }
    },
    panTo({ lat, lng }) { googleMap.panTo({ lat, lng }); },
    setZoom(level) { googleMap.setZoom(level); },
    focus({ lat, lng }) { googleMap.panTo({ lat, lng }); googleMap.setZoom(16); },
    reset() { googleMap.panTo(CENTER); googleMap.setZoom(12); },
  };
}

// Free fallback: Leaflet + OpenStreetMap tiles, loaded on demand. Same
// adapter shape, so the list, filters and search behave identically.
async function buildOsmMap() {
  return createOsmIssueMap(canvas, {
    center: CENTER,
    zoom: 12,
    popupHtml: (report) => `<div class="gm-popup">
      <strong>${escapeHtml(report.title)}</strong>
      <p>${escapeHtml(report.location)}${report.ward ? ` · ${escapeHtml(report.ward)}` : ""}</p>
      <span class="badge badge-muted">${escapeHtml(report.status)}</span>
      ${report.reportedAt ? `<small>${escapeHtml(formatDate(report.reportedAt))}</small>` : ""}
    </div>`,
    onSelect: (report) => select(report, false),
  });
}

async function useOsmMap(reason) {
  if (building === "osm" || mapApi?.provider === "openstreetmap") return;
  building = "osm";
  if (reason) console.warn("NIVARA: Google Maps unavailable — using OpenStreetMap.", reason);
  try {
    mapApi?.destroy?.();
    mapApi = null;
    mapApi = await buildOsmMap();
    await renderMarkers();
  } catch (err) {
    canvas.innerHTML = mapsPlaceholder("Map unavailable", escapeHtml(err.message));
    mapApi = null;
  } finally {
    building = null;
  }
}

async function buildMap() {
  if (googleMapsRejected()) return useOsmMap();
  building = "google";
  try {
    mapApi = await buildGoogleMap();
    // The key can be rejected after the script resolved — check again so the
    // error box never stays on screen.
    if (googleMapsRejected()) {
      building = null;
      return useOsmMap();
    }
    await renderMarkers();
  } catch (err) {
    building = null;
    return useOsmMap(err);
  } finally {
    if (building === "google") building = null;
  }
}

// gm_authFailure fires at any time after the API loads (billing / key
// restrictions) — swap to the fallback map the moment it happens.
onMapsRejected(() => { if (mapApi?.provider === "google" || building === "google") useOsmMap(); });

/* ------------------------------------------------------------------ markers */

async function renderMarkers() {
  if (!mapApi) return;
  try {
    await mapApi.setMarkers(filtered());
  } catch (err) {
    console.warn("NIVARA: could not render map markers.", err);
  }
}

/* ---------------------------------------------------------------- view/fit */

function resetView() {
  mapApi?.reset();
}

function focusReport(report) {
  if (!hasCoords(report)) return;
  mapApi?.focus({ lat: Number(report.latitude), lng: Number(report.longitude) });
}

function categoriesPresent() {
  return [...new Set(reports.map((r) => r.category))];
}

function renderFilters() {
  const cats = categoriesPresent();
  const items = [["All", "All reports"], ...cats.map((c) => [c, c])];
  filtersEl.innerHTML = items
    .map(([value, label]) => {
      const count = value === "All" ? reports.length : reports.filter((r) => r.category === value).length;
      return `<button class="chip${activeFilter === value ? " is-on" : ""}" data-filter="${escapeHtml(value)}" aria-pressed="${activeFilter === value}">${escapeHtml(label)}<span class="count">${count}</span></button>`;
    })
    .join("");
}

function filtered() {
  const q = query.trim().toLowerCase();
  return reports.filter((r) =>
    (activeFilter === "All" || r.category === activeFilter) &&
    `${r.title} ${r.location} ${r.category} ${r.ward}`.toLowerCase().includes(q)
  );
}

function renderList() {
  const rows = filtered();
  listEl.innerHTML = rows.length
    ? rows.map((r) => `
      <article class="map-issue-row" data-id="${r.id}" tabindex="0">
        <div class="row-top"><span class="dot" style="background:${CATEGORY_COLORS[r.category] || "#00e5ff"}"></span><strong>${escapeHtml(r.title)}</strong></div>
        <small>${escapeHtml(r.location)}${hasCoords(r) ? "" : " · no pin yet"}</small>
        <span class="badge badge-muted">${escapeHtml(r.status)}</span>
      </article>`).join("")
    : `<div class="empty-state">${reports.length ? "No reports match these filters." : "No community reports yet. Submit the first report."}</div>`;
  countEl.textContent = String(reports.length);
}

function select(report, pan = true) {
  if (pan && hasCoords(report)) focusReport(report);
  else if (pan) showToast("This report has no pinned location yet.", "info");
  listEl.querySelectorAll(".map-issue-row").forEach((row) => row.classList.toggle("is-active", row.dataset.id === report.id));
  const row = listEl.querySelector(`[data-id="${report.id}"]`);
  row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// Each stage is guarded on purpose: a map or storage failure must never stop
// the "Current reports" list from rendering.
function refresh() {
  try { renderFilters(); } catch (err) { console.warn("NIVARA: filters failed.", err); }
  try { renderList(); } catch (err) { console.warn("NIVARA: report list failed.", err); }
  renderMarkers();
}

/* ------------------------------------------------------------------- wiring */

filtersEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  refresh();
});

let searchTimer;
searchEl.addEventListener("input", () => {
  query = searchEl.value;
  refresh();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const value = query.trim();
    if (value.length >= 3 && mapApi) {
      try {
        const coords = await lookupAddress(value);
        if (coords && mapApi) {
          mapApi.panTo({ lat: coords.latitude, lng: coords.longitude });
          mapApi.setZoom(13);
        }
      } catch { /* keep the current view */ }
    } else if (!value) resetView();
  }, 450);
});

listEl.addEventListener("click", (e) => {
  const row = e.target.closest(".map-issue-row");
  if (row) { const r = reports.find((x) => x.id === row.dataset.id); if (r) select(r); }
});
listEl.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const row = e.target.closest(".map-issue-row");
  if (row) { e.preventDefault(); const r = reports.find((x) => x.id === row.dataset.id); if (r) select(r); }
});
window.addEventListener("nivara:reports-changed", () => { reports = readReports(); refresh(); });

refresh();
buildMap();
