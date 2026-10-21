// Google Maps JavaScript API loader — the only map provider in NIVARA.
//
// The official Google Maps JS API is loaded directly (roadmap, Google's default
// visual style: white/light-gray buildings, green parks, blue water, road and
// place labels). There is no OpenStreetMap / Leaflet / Mapbox / CARTO fallback
// and no custom style array is ever applied to the map.
//
// The browser key comes from window.NIVARA_CONFIG.googleMapsApiKey, which is
// set in js/config.js (or the git-ignored js/config.local.js that overrides
// it). Nothing else in the project should hard-code the key.
//
// Note: the Maps JavaScript API renders on this key, while the Geocoding and
// Places web services may answer REQUEST_DENIED for the same project. Those
// failures are surfaced as ordinary errors so pages can degrade (address
// search simply pans nowhere) instead of breaking the map itself.

import { CATEGORY_COLORS } from "./store.js?v=20261020d";
import {
  attachNominatimAutocomplete, nominatimGeocode, nominatimReverse,
} from "./osm-map.js?v=20261020d";

const SCRIPT_ID = "nivara-google-maps";
const LOAD_TIMEOUT_MS = 12000;
let mapsPromise;
let authFailed = false;

// Google reports a rejected key (billing disabled, referrer limits) through
// gm_authFailure rather than a rejected promise, and it happens *after* the
// script has loaded. Pages subscribe here so they can swap in the
// OpenStreetMap fallback instead of leaving Google's error box on screen.
window.gm_authFailure = () => {
  authFailed = true;
  window.dispatchEvent(new Event("nivara:maps-auth-failed"));
};

/** True once Google has rejected this key in the current page. */
export function googleMapsRejected() {
  return authFailed;
}

/** Run `cb` now if Google already rejected the key, or as soon as it does. */
export function onMapsRejected(cb) {
  if (authFailed) { queueMicrotask(cb); return () => {}; }
  window.addEventListener("nivara:maps-auth-failed", cb, { once: true });
  return () => window.removeEventListener("nivara:maps-auth-failed", cb);
}

export function getMapKey() {
  return (
    window.NIVARA_CONFIG?.googleMapsApiKey?.trim() ||
    document.querySelector('meta[name="google-maps-api-key"]')?.content.trim() ||
    ""
  );
}

export function hasMapKey() {
  return Boolean(getMapKey());
}

/**
 * Cloud map ID used for the map. A mapId is required by the official
 * AdvancedMarkerElement; without one Google shows "This page can't load Google
 * Maps correctly" instead of a map. "DEMO_MAP_ID" is Google's public sample ID
 * and renders the standard roadmap — replace it in js/config.js with a map ID
 * from your own Cloud project if you have one.
 */
export function getMapId() {
  return window.NIVARA_CONFIG?.googleMapsMapId?.trim() || "DEMO_MAP_ID";
}

/** Which provider is serving the maps: always "google", or null before load. */
export function mapProvider() {
  return mapsPromise ? "google" : null;
}

function loadGoogleScript(key) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  return new Promise((resolve, reject) => {
    const finish = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps did not initialize."));
    };
    let script = document.getElementById(SCRIPT_ID);
    if (script) {
      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
      return;
    }
    script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    const libs = "maps,marker,geocoding,places,geometry";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=${libs}&v=weekly`;
    script.onload = finish;
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.append(script);
  });
}

async function initMaps() {
  const key = getMapKey();
  if (!key) throw new Error("No Google Maps API key configured in js/config.js.");

  const maps = await Promise.race([
    loadGoogleScript(key),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Google Maps timed out.")), LOAD_TIMEOUT_MS)),
  ]);

  if (authFailed) {
    throw new Error("Google Maps rejected this API key (billing, API or referrer restrictions).");
  }
  return maps;
}

/**
 * Resolve the Google Maps JavaScript API namespace — the primary map provider,
 * always attempted first. Rejections are only thrown when the API cannot be
 * loaded or authenticates against the key; callers fall back to the
 * OpenStreetMap renderer (js/osm-map.js) when that happens.
 */
export function loadGoogleMaps() {
  if (mapsPromise) return mapsPromise;
  mapsPromise = initMaps().then((m) => {
    // Ensure google.maps is available
    if (!m && window.google?.maps) return window.google.maps;
    return m || window.google?.maps;
  });
  // Allow a later retry if the load failed.
  mapsPromise.catch(() => { mapsPromise = null; });
  return mapsPromise;
}

export async function geocodeAddress(address) {
  const maps = await loadGoogleMaps();
  const { Geocoder } = await maps.importLibrary("geocoding");
  const response = await new Geocoder().geocode({ address });
  if (response.status !== "OK" || !response.results?.length) {
    throw new Error(`Address lookup unavailable (${response.status}).`);
  }
  const loc = response.results[0].geometry.location;
  return {
    latitude: loc.lat(),
    longitude: loc.lng(),
    formatted: response.results[0].formatted_address,
  };
}

export async function reverseGeocode(lat, lng) {
  const maps = await loadGoogleMaps();
  const { Geocoder } = await maps.importLibrary("geocoding");
  const response = await new Geocoder().geocode({ location: { lat, lng } });
  if (response.status !== "OK" || !response.results?.length) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
  return response.results[0].formatted_address;
}

/** True when the Geocoding service answers this key (cached after first call). */
export async function addressLookupAvailable() {
  if (typeof window.__nivaraGeocodeOk === "boolean") return window.__nivaraGeocodeOk;
  try {
    await geocodeAddress("India");
    window.__nivaraGeocodeOk = true;
  } catch {
    window.__nivaraGeocodeOk = false;
  }
  return window.__nivaraGeocodeOk;
}

/* ------------------------------------------------- provider-aware address API
   Google's Places and Geocoding die with the same rejected key as the tiles.
   These three helpers try Google first and quietly continue with
   Nominatim/OpenStreetMap, so address search, reverse lookup and the pin
   picker keep working with or without billing on the Cloud project.       */

/** Resolve an address to coordinates (Google, else OSM). */
export async function lookupAddress(address) {
  if (await addressLookupAvailable()) {
    try { return await geocodeAddress(address); } catch { /* fall through */ }
  }
  return nominatimGeocode(address);
}

/** Resolve coordinates to an address label (Google, else OSM). */
export async function reverseLookup(latitude, longitude) {
  if (await addressLookupAvailable()) {
    try { return await reverseGeocode(latitude, longitude); } catch { /* fall through */ }
  }
  return nominatimReverse(latitude, longitude);
}

/** Address suggestions on an input (Google Places, else OSM Nominatim). */
export async function attachAddressAutocomplete(input, onSelect) {
  if (await addressLookupAvailable()) {
    try { return await attachAutocomplete(input, onSelect); } catch { /* fall through */ }
  }
  return attachNominatimAutocomplete(input, onSelect);
}

// Attach an address autocomplete dropdown to an input using the Places library.
export async function attachAutocomplete(input, onSelect) {
  const maps = await loadGoogleMaps();
  const { AutocompleteService } = await maps.importLibrary("places");
  const service = new AutocompleteService();

  const box = document.createElement("div");
  box.className = "autocomplete-list";
  box.hidden = true;
  input.parentElement.append(box);

  let predictions = [];
  let denied = false;
  const close = () => { box.hidden = true; box.innerHTML = ""; };

  const settle = (bias) => new Promise((resolve) => {
    service.getPlacePredictions(
      { input: input.value.trim(), componentRestrictions: { country: "in" }, ...bias },
      (results, status) => {
        if (status === "REQUEST_DENIED") denied = true;
        predictions = status === "OK" ? results || [] : [];
        resolve(predictions);
      },
    );
  });

  input.addEventListener("input", async () => {
    const value = input.value.trim();
    if (value.length < 3 || denied) return close();
    await settle({});
    if (!predictions.length) return close();
    box.innerHTML = predictions.slice(0, 5).map((p, i) =>
      `<button type="button" class="autocomplete-item" data-i="${i}"><strong>${p.structured_formatting.main_text}</strong><small>${p.structured_formatting.secondary_text || ""}</small></button>`
    ).join("");
    box.hidden = false;
  });

  box.addEventListener("click", (e) => {
    const btn = e.target.closest(".autocomplete-item");
    if (!btn) return;
    const p = predictions[Number(btn.dataset.i)];
    input.value = p.description;
    close();
    onSelect?.(p);
  });

  input.addEventListener("blur", () => setTimeout(close, 180));
  return { close, get available() { return !denied; } };
}

export async function makePin(maps, category, selected = false) {
  const { PinElement } = await maps.importLibrary("marker");
  return new PinElement({
    background: CATEGORY_COLORS[category] || "#1a73e8",
    borderColor: selected ? "#1a73e8" : "#ffffff",
    glyphColor: "#ffffff",
    scale: selected ? 1.25 : 1,
  });
}

export function mapsPlaceholder(message, hint = "") {
  return `<div class="map-placeholder"><div class="map-placeholder__icon" aria-hidden="true">⌖</div><strong>${message}</strong>${
    hint ? `<p>${hint}</p>` : ""
  }</div>`;
}
