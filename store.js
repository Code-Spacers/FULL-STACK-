// Shared report store — localStorage-backed with optional demo seeding.
//
// The app runs as a static site: reports live in the browser. When the Nivara
// API is reachable, the same records are kept in MongoDB as well — the list is
// hydrated from the server on load and every local change is reconciled back
// to it. With no server running nothing changes and the browser copy is used
// exactly as before.

import { apiFetch, normaliseReport, reportsDiffer, stripServerFields } from "./api/backend.js?v=20261020d";

const KEY = "nivara.reports";
const SEED_FLAG = "nivara.seeded";

export const CATEGORIES = [
  "Pothole",
  "Road damage",
  "Streetlight",
  "Garbage",
  "Drainage",
  "Water leak",
  "Sidewalk",
  "Traffic signal",
  "Public toilet",
  "Park / green space",
  "Accessibility",
  "Other",
];

export const PRIORITIES = ["Low", "Medium", "High", "Critical"];

export const CATEGORY_COLORS = {
  Pothole: "#ff5d73",
  "Road damage": "#ff8f4d",
  Streetlight: "#ffd23f",
  Garbage: "#8bd450",
  Drainage: "#38bdf8",
  "Water leak": "#22d3ee",
  Sidewalk: "#a78bfa",
  "Traffic signal": "#f472b6",
  "Public toilet": "#c084fc",
  "Park / green space": "#34d399",
  Accessibility: "#60a5fa",
  Other: "#94a3b8",
};

const DEPARTMENT = {
  Pothole: "Roads & Civil Works",
  "Road damage": "Roads & Civil Works",
  Sidewalk: "Roads & Civil Works",
  Garbage: "Sanitation",
  "Public toilet": "Sanitation",
  Streetlight: "Electrical Quick Response",
  "Traffic signal": "Traffic Engineering",
  Drainage: "Water & Drainage",
  "Water leak": "Water & Drainage",
  "Park / green space": "Parks & Horticulture",
  Accessibility: "Accessibility Cell",
  Other: "General Services",
};

const SLA = { Critical: 4, High: 12, Medium: 24, Low: 36 };

// localStorage can reject writes (quota — reports carry base64 photos — or
// private browsing). Keeping the last written list in memory means the map
// and dashboards still render for the session instead of the whole page
// module dying on a thrown setItem.
let memoryReports = null;

/* --------------------------------------------------------- backend sync layer
   The store stays synchronous for every caller. The API is touched in the
   background: once on load (hydrate) and after each local write (reconcile).
   Every API call is allowed to fail — offline is the normal case for a static
   site, and the local copy remains authoritative then.                     */

let suppressSync = false;   // set while the store is being written by the sync itself
let syncTimer = null;       // debounce handle for the reconcile
let syncPromise = null;     // the initial hydrate, awaited by the first reconcile
let lastSyncedIds = new Set(); // ids the server is known to hold

/** Pull the server's reports into the local list. Resolves true when the API answered. */
async function hydrateFromApi() {
  try {
    const serverReports = await apiFetch("/reports");
    if (!Array.isArray(serverReports)) return false;

    const fromServer = serverReports.map(normaliseReport);
    const serverIds = new Set(fromServer.map((r) => r.id));
    // The server is the source of truth, but records created while it was
    // offline are kept so the next reconcile can push them up.
    const localOnly = readReports().filter((r) => !serverIds.has(r.id));

    suppressSync = true;
    try {
      writeReports([...localOnly, ...fromServer]);
    } finally {
      suppressSync = false;
    }
    lastSyncedIds = new Set(fromServer.map((r) => r.id));

    // Records that were created while the API was unreachable are not on the
    // server yet — schedule a reconcile to push them up.
    if (localOnly.length) scheduleSync();

    return true;
  } catch {
    return false; // no API — the browser copy stands on its own
  }
}

/** Push the local list to the server, creating, updating and deleting as needed. */
async function reconcileWithApi() {
  try {
    if (syncPromise) await syncPromise; // never race the initial hydrate

    const local = readReports();
    const serverReports = await apiFetch("/reports");
    if (!Array.isArray(serverReports)) return;

    const serverById = new Map(serverReports.map((r) => [r.id, normaliseReport(r)]));
    const localById = new Map(local.map((r) => [r.id, r]));

    for (const [id, report] of localById) {
      const current = serverById.get(id);
      try {
        if (!current) {
          await apiFetch("/reports", { method: "POST", body: JSON.stringify(stripServerFields(report)) });
        } else if (reportsDiffer(current, report)) {
          await apiFetch(`/reports/${id}`, { method: "PATCH", body: JSON.stringify(stripServerFields(report)) });
        }
      } catch (err) {
        console.warn(`NIVARA: could not sync report ${id} to the API.`, err);
      }
    }

    // Only ids the server was known to hold may be deleted — a cleared
    // browser cache must never wipe the database.
    for (const id of lastSyncedIds) {
      if (localById.has(id)) continue;
      try {
        await apiFetch(`/reports/${id}`, { method: "DELETE" });
      } catch (err) {
        console.warn(`NIVARA: could not delete report ${id} from the API.`, err);
      }
    }

    lastSyncedIds = new Set(localById.keys());
  } catch {
    // No API reachable — the browser copy stays authoritative.
  }
}

/** Debounced reconcile, so a burst of writes costs one round trip. */
function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    reconcileWithApi();
  }, 250);
}

export function readReports() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return memoryReports ? [...memoryReports] : [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : (memoryReports ? [...memoryReports] : []);
  } catch {
    return memoryReports ? [...memoryReports] : [];
  }
}

function writeReports(list) {
  memoryReports = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("NIVARA: report storage is full or blocked — keeping reports in memory for this session.", err);
  }
  window.dispatchEvent(new CustomEvent("nivara:reports-changed"));
  if (!suppressSync) scheduleSync();
  return list;
}

export function makeId() {
  return "NVR-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

export function createReport(input) {
  const now = Date.now();
  const report = {
    id: makeId(),
    title: input.title || "Untitled report",
    category: input.category || "Other",
    description: input.description || "",
    location: input.location || "Location pending",
    ward: input.ward || "Ward pending",
    priority: input.priority || "Medium",
    latitude: input.latitude != null ? Number(input.latitude) : null,
    longitude: input.longitude != null ? Number(input.longitude) : null,
    images: Array.isArray(input.images) ? input.images.slice(0, 4) : [],
    isPublic: input.isPublic !== false,
    reporter: input.reporter || "Anonymous",
    status: "Reported",
    department: DEPARTMENT[input.category] || "General Services",
    slaHours: SLA[input.priority] || 24,
    reportedAt: new Date(now).toISOString(),
    officer: null,
    workLog: [],
    acknowledgedAt: null,
    startedAt: null,
    resolvedAt: null,
    updates: [{ at: new Date(now).toISOString(), status: "Reported", note: "Report received and queued for triage." }],
  };
  const list = readReports();
  list.unshift(report);
  writeReports(list);
  return report;
}

export function updateReport(id, patch) {
  const list = readReports().map((r) => (r.id === id ? { ...r, ...patch } : r));
  writeReports(list);
  return list.find((r) => r.id === id) || null;
}

/** Write a whole new list in one shot (single storage event). */
export function applyReports(list) {
  return writeReports(list);
}

export function deleteReport(id) {
  const list = readReports().filter((r) => r.id !== id);
  writeReports(list);
  return list;
}

export const STATUSES = ["Reported", "Acknowledged", "In Progress", "Resolved"];

const STATUS_TIME_FIELD = { Acknowledged: "acknowledgedAt", "In Progress": "startedAt", Resolved: "resolvedAt" };

function nowIso() {
  return new Date().toISOString();
}

function mutate(id, fn) {
  const list = readReports();
  const index = list.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const next = fn({ ...list[index] });
  if (!next) return null;
  list[index] = next;
  writeReports(list);
  return next;
}

function logAction(report, by, action, note) {
  const entry = { at: nowIso(), by: by || { name: "System", employeeId: "" }, action, note: note || "" };
  return { ...report, workLog: [...(report.workLog || []), entry] };
}

function logUpdate(report, status, note) {
  return { ...report, updates: [...(report.updates || []), { at: nowIso(), status, note: note || "" }] };
}

function actorLabel(by) {
  if (!by) return "System";
  return by.employeeId ? `${by.name} (${by.employeeId})` : by.name || "System";
}

export function advanceReport(id, by) {
  const report = readReports().find((r) => r.id === id);
  if (!report) return null;
  const order = STATUSES;
  const next = order[Math.min(order.indexOf(report.status) + 1, order.length - 1)];
  if (next === report.status) return report;
  return mutate(id, (r) => {
    const patch = { status: next };
    const field = STATUS_TIME_FIELD[next];
    if (field && !r[field]) patch[field] = nowIso();
    return { ...r, ...patch };
  });
}

/* ------------------------------------------------------- resolution workflow
   The authority flow: review → assign officer → initiate repair →
   update status / add notes → resolve (or reopen). Every action is
   attributed to the acting officer and mirrored into the citizen-visible
   updates[] timeline.                                                  */

/** Assign an officer. Auto-acknowledges a still-Reported issue. */
export function assignOfficer(id, officer, by, note) {
  if (!officer || !officer.employeeId) return null;
  return mutate(id, (r) => {
    let next = { ...r, officer: { name: officer.name, employeeId: officer.employeeId, designation: officer.designation || "" } };
    const detail = `Assigned to ${officer.name} (${officer.employeeId}) by ${actorLabel(by)}.${note ? " " + note : ""}`;
    next = logAction(next, by, "assign", detail);
    next = logUpdate(next, next.status, detail);
    if (next.status === "Reported") {
      next = { ...next, status: "Acknowledged", acknowledgedAt: next.acknowledgedAt || nowIso() };
    }
    return next;
  });
}

/** Initiate repair work. Requires the issue to be acknowledged already. */
export function startRepair(id, by, note) {
  return mutate(id, (r) => {
    if (r.status === "Resolved" || r.status === "In Progress") return null;
    let next = { ...r, status: "In Progress", startedAt: r.startedAt || nowIso() };
    if (!next.officer && by) {
      next.officer = { name: by.name, employeeId: by.employeeId, designation: by.designation || "" };
    }
    next.acknowledgedAt = next.acknowledgedAt || nowIso();
    const detail = `Repair work initiated by ${actorLabel(by)}.${note ? " " + note : ""}`;
    next = logAction(next, by, "start", detail);
    return logUpdate(next, "In Progress", detail);
  });
}

export function resolveReport(id, by, note) {
  return mutate(id, (r) => {
    if (r.status === "Resolved") return null;
    let next = {
      ...r,
      status: "Resolved",
      acknowledgedAt: r.acknowledgedAt || nowIso(),
      startedAt: r.startedAt || nowIso(),
      resolvedAt: nowIso(),
    };
    const detail = `Marked resolved by ${actorLabel(by)}.${note ? " " + note : ""}`;
    next = logAction(next, by, "resolve", detail);
    return logUpdate(next, "Resolved", detail);
  });
}

/** Explicit status move with validation. Allowed: any forward step, or reopen. */
export function setReportStatus(id, status, by, note) {
  if (!STATUSES.includes(status)) return null;
  return mutate(id, (r) => {
    const from = STATUSES.indexOf(r.status);
    const to = STATUSES.indexOf(status);
    const reopening = r.status === "Resolved" && status === "In Progress";
    if (to <= from && !reopening) return null;
    let next = { ...r, status };
    const field = STATUS_TIME_FIELD[status];
    if (field && !next[field]) next[field] = nowIso();
    if (reopening) next.resolvedAt = null;
    const detail = `Status set to ${status} by ${actorLabel(by)}.${note ? " " + note : ""}`;
    next = logAction(next, by, reopening ? "reopen" : "status", detail);
    return logUpdate(next, status, detail);
  });
}

/** Status-only note (crew dispatched, parts ordered…). Stays citizen-visible. */
export function addWorkNote(id, by, note) {
  if (!note || !note.trim()) return null;
  return mutate(id, (r) => {
    const detail = `${note.trim()} — ${actorLabel(by)}`;
    const next = logAction(r, by, "note", detail);
    return logUpdate(next, next.status, detail);
  });
}

export function reopenReport(id, by, note) {
  return setReportStatus(id, "In Progress", by, note || "Reopened for re-inspection.");
}

/* ------------------------------------------------------------- SLA helpers */

function lastUpdateAt(report, status) {
  const list = (report.updates || []).filter((u) => u.status === status && u.at);
  return list.length ? Date.parse(list[list.length - 1].at) : NaN;
}

export function resolutionHours(report) {
  const start = Date.parse(report.reportedAt);
  const end = report.resolvedAt ? Date.parse(report.resolvedAt) : lastUpdateAt(report, "Resolved");
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, (end - start) / 36e5);
}

export function firstResponseHours(report) {
  const start = Date.parse(report.reportedAt);
  const ack = report.acknowledgedAt ? Date.parse(report.acknowledgedAt) : lastUpdateAt(report, "Acknowledged");
  if (!Number.isFinite(start) || !Number.isFinite(ack)) return null;
  return Math.max(0, (ack - start) / 36e5);
}

/**
 * SLA position of a report.
 * Returns { kind: "met"|"missed"|"on-track"|"at-risk"|"breached", hours }
 * where hours is resolution time (resolved) or remaining time (open).
 */
export function slaState(report, now = Date.now()) {
  const target = Date.parse(report.reportedAt) + (report.slaHours || 24) * 36e5;
  if (report.status === "Resolved") {
    const hours = resolutionHours(report);
    if (hours == null) return { kind: "met", hours: null };
    const end = Date.parse(report.reportedAt) + hours * 36e5;
    return { kind: end <= target ? "met" : "missed", hours };
  }
  const left = (target - now) / 36e5;
  if (left <= 0) return { kind: "breached", hours: left };
  if (left <= (report.slaHours || 24) * 0.25) return { kind: "at-risk", hours: left };
  return { kind: "on-track", hours: left };
}

// Seed a few demonstration reports once, so the map and dashboard are not empty.
export function seedDemoReports(DEMO) {
  let flagged = false;
  try { flagged = localStorage.getItem(SEED_FLAG) === "1"; } catch { flagged = false; }

  const existing = readReports();
  if (flagged && existing.length) return;
  // The flag can be set while the list itself is empty (a cleared or failed
  // write). Returning there left "Current reports" empty forever, so fall
  // through and seed again instead.
  if (existing.length) {
    try { localStorage.setItem(SEED_FLAG, "1"); } catch { /* memory-only session */ }
    return;
  }

  const now = Date.now();
  const seeded = DEMO.map((d, i) => ({
    id: "NVR-" + (1000 + i),
    title: d.title,
    category: d.category,
    description: d.description,
    location: d.location,
    ward: d.ward,
    priority: d.priority,
    latitude: d.latitude,
    longitude: d.longitude,
    images: [],
    isPublic: true,
    reporter: d.reporter || "Community",
    status: d.status,
    department: DEPARTMENT[d.category] || "General Services",
    slaHours: SLA[d.priority] || 24,
    reportedAt: new Date(now - (i + 1) * 3600e3 * 6).toISOString(),
    officer: null,
    workLog: [],
    acknowledgedAt: d.status === "Reported" ? null : new Date(now - (i + 1) * 3600e3 * 5).toISOString(),
    startedAt: d.status === "In Progress" ? new Date(now - (i + 1) * 3600e3 * 3).toISOString() : null,
    resolvedAt: null,
    updates: [
      { at: new Date(now - (i + 1) * 3600e3 * 6).toISOString(), status: "Reported", note: "Report received and queued for triage." },
      ...(d.status !== "Reported"
        ? [{ at: new Date(now - i * 3600e3 * 3).toISOString(), status: d.status, note: `Status moved to ${d.status}.` }]
        : []),
    ],
  }));
  writeReports(seeded);
  try { localStorage.setItem(SEED_FLAG, "1"); } catch { /* memory-only session */ }
  return seeded;
}

export const DEMO_REPORTS = [
  { title: "Large pothole near bus stop", category: "Pothole", description: "Deep pothole on the left lane, two-wheelers swerve into traffic.", location: "MG Road near Central Library", ward: "Ward 12", priority: "High", latitude: 12.9756, longitude: 77.5963, status: "In Progress", reporter: "A. Rao" },
  { title: "Streetlight out for a week", category: "Streetlight", description: "Three poles dark along the park boundary, unsafe after dusk.", location: "Ridge Park west gate", ward: "Ward 7", priority: "Medium", latitude: 12.9611, longitude: 77.5842, status: "Acknowledged", reporter: "S. Iyer" },
  { title: "Overflowing garbage bin", category: "Garbage", description: "Bin not collected for three days, waste spilling onto footpath.", location: "Harbour Market Lane", ward: "Ward 21", priority: "High", latitude: 12.9489, longitude: 77.6039, status: "Reported", reporter: "Anonymous" },
  { title: "Blocked storm drain", category: "Drainage", description: "Plastic blocking the drain, water pools across the crossing after rain.", location: "Meadow Arc junction", ward: "Ward 3", priority: "Critical", latitude: 12.9536, longitude: 77.6266, status: "In Progress", reporter: "K. Menon" },
  { title: "Water leak flooding kerb", category: "Water leak", description: "Continuous leak from a valve, drinking water washing into the drain.", location: "Ridge 4th Cross", ward: "Ward 7", priority: "High", latitude: 12.9701, longitude: 77.5761, status: "Acknowledged", reporter: "P. Sharma" },
  { title: "Parked cars blocking footpath", category: "Sidewalk", description: "Footpath used as parking, pedestrians forced onto the road.", location: "Meadow Arc main street", ward: "Ward 3", priority: "Medium", latitude: 12.9590, longitude: 77.6312, status: "Reported", reporter: "Community" },
  { title: "Broken footpath tiles", category: "Accessibility", description: "Loose tiles and a missing kerb cut make the route impassable for wheelchairs.", location: "Harbour Belt promenade", ward: "Ward 21", priority: "Medium", latitude: 12.9441, longitude: 77.6108, status: "Resolved", reporter: "R. Das" },
  { title: "Traffic signal stuck on red", category: "Traffic signal", description: "Signal at the junction stays red, long queues build each morning.", location: "Ridge–Meadow junction", ward: "Ward 12", priority: "High", latitude: 12.9667, longitude: 77.6110, status: "In Progress", reporter: "N. Gupta" },
];

// Pull the server's reports in as soon as this module is evaluated. The
// promise is kept so the first reconcile can wait for the hydrate to finish.
syncPromise = hydrateFromApi();
