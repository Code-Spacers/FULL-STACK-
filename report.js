import { initBackground } from "./background.js?v=20261020d";
import { mountNav, initPageChrome, initReveals, showToast, escapeHtml, formatDate } from "./ui.js?v=20261020d";
import {
  CATEGORIES, PRIORITIES, STATUSES,
  createReport, readReports, seedDemoReports, DEMO_REPORTS,
} from "./store.js?v=20261020d";
import { getSession } from "./auth.js?v=20261020d";
import {
  loadGoogleMaps, getMapId, attachAddressAutocomplete,
  lookupAddress, reverseLookup, addressLookupAvailable,
  googleMapsRejected, onMapsRejected,
} from "./maps.js?v=20261020d";
import { createOsmPicker } from "./osm-map.js?v=20261020d";

initBackground();
mountNav("report");
initPageChrome();
initReveals();
try {
  seedDemoReports(DEMO_REPORTS);
} catch (err) {
  console.warn("NIVARA: could not seed demo reports.", err);
}

const params = new URLSearchParams(location.search);
const LOGIN_URL = "login.html?next=report.html&msg=report";

const STATUS_BADGE = { Reported: "badge-warning", Acknowledged: "badge", "In Progress": "badge-success", Resolved: "badge-success" };
const ACTION_LABEL = {
  assign: "Officer assigned",
  start: "Repair initiated",
  resolve: "Marked resolved",
  status: "Status changed",
  note: "Update note",
  reopen: "Reopened for inspection",
};

/* =========================================================
   1 · Status lookup — public, no sign-in required.
   Visitors enter a reference number and see the current
   status, the progress timeline, and the authority's
   action history for that report.
   ========================================================= */

const trackForm = document.getElementById("trackForm");
const trackIdInput = document.getElementById("trackId");
const trackResult = document.getElementById("trackResult");

function actorName(by) {
  if (!by) return "System";
  return by.employeeId ? `${by.name} (${by.employeeId})` : by.name || "System";
}

function clip(text, max = 90) {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function timelineHtml(report) {
  const done = STATUSES.indexOf(report.status);
  return `<div class="timeline-track">${STATUSES.map((status, i) => {
    const update = (report.updates || []).find((u) => u.status === status);
    const when = update ? `${formatDate(update.at)}${update.note ? ` · ${clip(update.note)}` : ""}` : (i <= done ? "Completed" : "Pending");
    return `<div class="timeline-step${i <= done ? " is-done" : ""}">
      <div class="timeline-step__marker"><span class="timeline-step__dot"></span></div>
      <div class="timeline-step__body"><b>${status}</b><small>${escapeHtml(when)}</small></div>
    </div>`;
  }).join("")}</div>`;
}

function actionHistoryHtml(report) {
  const log = [...(report.workLog || [])].reverse();
  if (!log.length) {
    return `<span class="form-hint">No authority actions recorded yet — the report is queued for triage.</span>`;
  }
  return `<ul class="action-log">${log.map((entry) => `
    <li>
      <b>${escapeHtml(ACTION_LABEL[entry.action] || "Authority action")}</b>
      <small>${escapeHtml(actorName(entry.by))} · ${formatDate(entry.at)}</small>
      ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}
    </li>`).join("")}</ul>`;
}

function renderLookup(report) {
  trackResult.innerHTML = `
    <article class="track-report">
      <div class="track-report__head">
        <div>
          <h3>${escapeHtml(report.title)}</h3>
          <div class="track-report__meta">${escapeHtml(report.id)} · ${escapeHtml(report.category)} · ${escapeHtml(report.department)} · ${escapeHtml(report.ward)}</div>
        </div>
        <span class="badge ${STATUS_BADGE[report.status] || "badge-muted"}"><span class="badge-dot"></span>${escapeHtml(report.status)}</span>
      </div>
      <p class="track-report__desc">${escapeHtml(report.description)}</p>
      <div class="track-report__meta">📍 ${escapeHtml(report.location)} · SLA ${report.slaHours}h · priority ${escapeHtml(report.priority)} · reported ${formatDate(report.reportedAt)}${report.officer ? ` · officer ${escapeHtml(report.officer.name)} (${escapeHtml(report.officer.employeeId)})` : ""}</div>
      <div class="track-section"><h4>Progress timeline</h4>${timelineHtml(report)}</div>
      <div class="track-section"><h4>Authority action history</h4>${actionHistoryHtml(report)}</div>
    </article>`;
}

function lookup(rawId) {
  const query = String(rawId || "").trim();
  if (!query) {
    trackResult.innerHTML = `<div class="empty-state">Enter a reference number such as NVR-1000.</div>`;
    return null;
  }
  const report = readReports().find((r) => String(r.id).toLowerCase() === query.toLowerCase());
  if (!report) {
    trackResult.innerHTML = `<div class="empty-state">No report found for “${escapeHtml(query)}” on this device. Check the reference number and try again.</div>`;
    return null;
  }
  renderLookup(report);
  return report;
}

trackForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const found = lookup(trackIdInput.value);
  if (found) trackResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

/* =========================================================
   2 · Create a new complaint — sign-in required.
   The photo-upload form stays hidden (no flash, no options)
   until an authenticated citizen opens it explicitly.
   ========================================================= */

const composePanel = document.getElementById("composePanel");
const startComplaintBtn = document.getElementById("startComplaint");
const closeComposeBtn = document.getElementById("closeCompose");
let composeReady = false;

function revealCompose({ scroll = true } = {}) {
  composePanel.hidden = false;
  if (!composeReady) { composeReady = true; initCompose(); }
  if (scroll) composePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideCompose() {
  composePanel.hidden = true;
  document.querySelector(".hub-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

startComplaintBtn.addEventListener("click", () => {
  if (!getSession()) { location.href = LOGIN_URL; return; }
  history.replaceState(null, "", "report.html?compose=1");
  revealCompose();
});

closeComposeBtn.addEventListener("click", () => {
  history.replaceState(null, "", "report.html");
  hideCompose();
});

// Deep link ?compose=1 (used after signing in): still verify the session,
// so the form is never reachable without authentication.
if (params.get("compose") === "1") {
  if (!getSession()) {
    location.replace(LOGIN_URL);
  } else {
    revealCompose({ scroll: false });
  }
}

/* ---------------- complaint form wiring ---------------- */

function initCompose() {
  const form = document.getElementById("reportForm");
  const categorySel = document.getElementById("category");
  const prioritySel = document.getElementById("priority");
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("reportImages");
  const imageGrid = document.getElementById("imageGrid");
  const locationInput = document.getElementById("location");
  const hint = document.getElementById("locationHint");
  const errorEl = document.getElementById("formError");
  const resultEl = document.getElementById("reportResult");
  const submitBtn = document.getElementById("submitReport");

  const MAX_IMAGES = 4;
  let images = []; // { dataUrl, name }
  // Google's Map (provider "google") or the OpenStreetMap adapter
  // ("openstreetmap") — the form only ever talks to window.__pickerMap /
  // window.__pickerDrop, so both providers are interchangeable.
  let picker = null;
  const MAP_CENTER = { lat: 12.9716, lng: 77.5946 };

  categorySel.innerHTML = `<option value="">Choose category</option>` + CATEGORIES.map((c) => `<option>${c}</option>`).join("");
  prioritySel.innerHTML = PRIORITIES.map((p, i) => `<option${i === 1 ? " selected" : ""}>${p}</option>`).join("");

  /* ---------------- images ---------------- */
  function renderImages() {
    imageGrid.innerHTML = images
      .map((img, i) => `
        <div class="image-thumb">
          <img src="${img.dataUrl}" alt="${escapeHtml(img.name)}" />
          <button type="button" data-remove="${i}" aria-label="Remove image">×</button>
        </div>`)
      .join("");
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 1000;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    for (const file of files) {
      if (images.length >= MAX_IMAGES) { showToast(`Up to ${MAX_IMAGES} images allowed.`, "warning"); break; }
      if (file.size > 10 * 1024 * 1024) { showToast(`${file.name} is over 10 MB.`, "warning"); continue; }
      try {
        const dataUrl = await compressImage(file);
        images.push({ dataUrl, name: file.name });
      } catch { showToast(`Could not read ${file.name}.`, "error"); }
    }
    renderImages();
  }

  fileInput?.addEventListener("change", () => { addFiles(fileInput.files); fileInput.value = ""; });
  imageGrid?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    images.splice(Number(btn.dataset.remove), 1);
    renderImages();
  });
  ["dragover", "dragenter"].forEach((ev) => dropzone?.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("is-dragover"); }));
  ["dragleave", "dragend"].forEach((ev) => dropzone?.addEventListener(ev, () => dropzone.classList.remove("is-dragover")));
  dropzone?.addEventListener("drop", (e) => { e.preventDefault(); dropzone.classList.remove("is-dragover"); addFiles(e.dataTransfer.files); });

  /* ---------------- maps: autocomplete + picker ---------------- */

  // Writes the chosen coordinates into the form; every path (pin click,
  // drag, suggestion, "Use my location", map search) funnels through here.
  function setCoords(latitude, longitude) {
    form.latitude.value = Number(latitude).toFixed(6);
    form.longitude.value = Number(longitude).toFixed(6);
  }

  function adoptPicker(provider, mapLike, move) {
    picker = { provider, reset: () => { move(MAP_CENTER.lat, MAP_CENTER.lng); mapLike.panTo(MAP_CENTER); mapLike.setZoom?.(13); } };
    window.__pickerMap = mapLike;
    window.__pickerDrop = move;
  }

  async function startGooglePicker() {
    const maps = await loadGoogleMaps();
    if (googleMapsRejected()) throw new Error("Google Maps rejected this API key.");
    const { Map } = await maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await maps.importLibrary("marker");
    const host = document.getElementById("mapPicker");
    host.innerHTML = "";
    const googleMap = new Map(host, {
      center: MAP_CENTER,
      zoom: 13,
      mapId: getMapId(),
      disableDefaultUI: false,
      zoomControl: true,
      clickableIcons: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    });
    const marker = new AdvancedMarkerElement({ map: googleMap, position: MAP_CENTER, gmpDraggable: true });
    googleMap.addListener("click", (e) => setCoords(e.latLng.lat(), e.latLng.lng()));
    marker.addListener("dragend", () => {
      const position = marker.position;
      if (position && Number.isFinite(Number(position.lat))) setCoords(Number(position.lat), Number(position.lng));
    });
    const move = (latitude, longitude) => {
      marker.position = { lat: Number(latitude), lng: Number(longitude) };
      setCoords(latitude, longitude);
    };
    adoptPicker("google", googleMap, move);
  }

  async function startOsmPicker() {
    const adapter = await createOsmPicker(document.getElementById("mapPicker"), {
      center: MAP_CENTER,
      zoom: 13,
      onPick: (latitude, longitude) => setCoords(latitude, longitude),
    });
    const move = (latitude, longitude) => { adapter.setMarker(latitude, longitude); setCoords(latitude, longitude); };
    adoptPicker("openstreetmap", adapter, move);
  }

  async function swapToOsmPicker(reason) {
    if (picker?.provider === "openstreetmap") return;
    if (reason) console.warn("NIVARA: Google map picker unavailable — using OpenStreetMap.", reason);
    try {
      picker = null;
      window.__pickerMap = null;
      window.__pickerDrop = null;
      await startOsmPicker();
    } catch (err) {
      hint.textContent = "Map could not load — addresses are saved as text.";
      document.getElementById("mapPicker").innerHTML =
        `<div class="map-placeholder"><div class="map-placeholder__icon" aria-hidden="true">⌖</div><strong>Map unavailable</strong><p>${escapeHtml(err.message)}</p></div>`;
    }
  }

  async function setupMaps() {
    // Address suggestions: Google Places while the key works, OpenStreetMap
    // Nominatim otherwise — either way typing an address gives suggestions.
    attachAddressAutocomplete(locationInput, async (match) => {
      try {
        const coords = match?.latitude != null ? match : await lookupAddress(locationInput.value);
        if (coords && window.__pickerMap) {
          window.__pickerMap.panTo({ lat: coords.latitude, lng: coords.longitude });
          window.__pickerMap.setZoom?.(16);
          window.__pickerDrop?.(coords.latitude, coords.longitude);
        }
      } catch { /* non-blocking */ }
    }).catch(() => {});

    try {
      await startGooglePicker();
      // Google rejects the key after the script loads (gm_authFailure);
      // rebuild the picker on OpenStreetMap the moment that happens.
      onMapsRejected(() => { if (picker?.provider === "google") swapToOsmPicker(); });
    } catch (err) {
      await swapToOsmPicker(err);
    }

    if (!(await addressLookupAvailable())) {
      hint.textContent = "Address search is powered by OpenStreetMap — type at least 3 characters and pick a suggestion.";
    }
  }
  setupMaps();

  /* ---------------- use my location ---------------- */
  document.getElementById("useLocation")?.addEventListener("click", () => {
    if (!navigator.geolocation) { showToast("Location access is unavailable in this browser.", "warning"); return; }
    showToast("Locating…", "info");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        form.latitude.value = latitude.toFixed(6);
        form.longitude.value = longitude.toFixed(6);
        locationInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        if (window.__pickerMap) {
          window.__pickerMap.panTo({ lat: latitude, lng: longitude });
          window.__pickerMap.setZoom(16);
        }
        window.__pickerDrop?.(latitude, longitude);
        try {
          const address = await reverseLookup(latitude, longitude);
          if (address) locationInput.value = address;
        } catch { /* keep coordinates */ }
        showToast("Location added to the report.", "success");
      },
      () => showToast("Location access was denied. Enter a nearby street instead.", "warning"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  /* ---------------- submit ---------------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    if (!getSession()) { location.replace(LOGIN_URL); return; }
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());

    submitBtn.disabled = true;
    const original = submitBtn.textContent;
    submitBtn.textContent = "Submitting…";

    try {
      if (!data.latitude && !data.longitude && data.location) {
        try {
          const coords = await lookupAddress(data.location);
          if (coords) { data.latitude = coords.latitude; data.longitude = coords.longitude; }
        } catch { /* keep without pin */ }
      }
      const report = createReport({ ...data, images: images.map((i) => i.dataUrl), isPublic: data.isPublic === "on" });
      resultEl.hidden = false;
      resultEl.innerHTML = `
        <strong>Report received · ${report.id}</strong>
        <p>Routed to <b>${escapeHtml(report.department)}</b> · priority ${escapeHtml(report.priority)} · response target ${report.slaHours}h.</p>
        <p><a href="#" data-track="${report.id}">See status &amp; authority history →</a> · <a href="my-reports.html">Track this report →</a> · <a href="map.html">See it on the map →</a></p>`;
      showToast(`Reference ${report.id} is ready to track.`, "success", "Report submitted");
      form.reset();
      images = [];
      renderImages();
      picker?.reset?.();
      resultEl.scrollIntoView({ behavior: "smooth", block: "center" });

      resultEl.querySelector("[data-track]")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        trackIdInput.value = report.id;
        hideCompose();
        lookup(report.id);
        setTimeout(() => document.querySelector(".hub-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      });
    } catch (err) {
      errorEl.textContent = "Could not save the report. Please try again.";
      showToast("Could not save the report.", "error");
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  });
}
