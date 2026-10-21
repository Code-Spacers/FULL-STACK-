// Single place that knows how to reach the Nivara backend.
//
// The base URL is resolved in this order:
//   1. window.NIVARA_CONFIG.apiBaseUrl   (js/config.js — the committed default)
//   2. window.NIVARA_API_URL              (set at runtime, e.g. by a host page)
//
// The default points at the backend's own port. The backend enables CORS, so
// this works whether the frontend is served by the backend itself or by any
// other static server.
//
// Every call is allowed to fail: the app keeps working from localStorage when
// the API is not running, so the frontend stays a static site you can open
// without a server.

const DEFAULT_API_BASE = "http://localhost:5050/api";

let resolvedBase = null;

// Short circuit breaker. When the API is unreachable there is no point in
// retrying it on every keystroke-triggered write — the app keeps working from
// local storage either way. After the cooldown the next call tries again, so
// the API is picked up again as soon as it comes back.
const OFFLINE_COOLDOWN_MS = 30000;
let offlineUntil = 0;

function configuredBase() {
  const config = typeof window !== "undefined" ? window.NIVARA_CONFIG : null;
  const configured = (config && config.apiBaseUrl) || (typeof window !== "undefined" && window.NIVARA_API_URL) || "";
  return String(configured).replace(/\/+$/, "");
}

/** The API base URL. */
export function apiBase() {
  if (!resolvedBase) resolvedBase = configuredBase() || DEFAULT_API_BASE;
  return resolvedBase;
}

/** True when the API is believed to be unreachable right now. */
export function isApiOffline() {
  return Date.now() < offlineUntil;
}

/** True when the browser is allowed to call a non-localhost API. */
export function isRemoteApi() {
  try {
    const host = new URL(apiBase()).hostname;
    return host !== "localhost" && host !== "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Fetch JSON from the API. Throws on network failure or a non-2xx status so
 * callers can fall back to localStorage.
 */
export async function apiFetch(path, options = {}) {
  if (isApiOffline()) throw new Error("API is offline — retrying later");

  const base = apiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
    if (res.status === 204) return null;
    return await res.json();
  } catch (err) {
    // Only a transport failure means "the API is down"; a 4xx/5xx means the
    // API is up and the request itself was wrong.
    if (!(err instanceof TypeError)) throw err;
    offlineUntil = Date.now() + OFFLINE_COOLDOWN_MS;
    throw err;
  }
}

/** MongoDB internals and server-managed timestamps are not ours to send back. */
const SERVER_OWNED = ["_id", "__v", "createdAt", "updatedAt"];

/** Strip fields the browser app must not own (and must not PATCH back). */
export function stripServerFields(report) {
  if (!report || typeof report !== "object") return report;
  const clean = { ...report };
  for (const field of SERVER_OWNED) delete clean[field];
  return clean;
}

/** Normalise a report coming from the API into the shape the app stores. */
export function normaliseReport(report) {
  return stripServerFields(report);
}

/** True when two reports differ in a way worth sending to the server. */
export function reportsDiffer(a, b) {
  if (!a || !b) return true;
  return JSON.stringify(a) !== JSON.stringify(b);
}
