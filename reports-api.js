// Legacy drop-in for the API bridge.
//
// The Nivara frontend already ships this integration — its js/api/backend.js
// resolves the API base and js/store.js hydrates from the API and reconciles
// every local change back to it. This file is kept only for older copies of
// the frontend that do not have it; copy it over js/api/reports-api.js only
// if the frontend has no js/api/backend.js.

import { delay, readLocalList, writeLocalList } from "./api.js";

const KEY = "nivara.reports";
const API_BASE = window.NIVARA_API_URL || "http://localhost:5050/api";

export async function listReports() {
  try {
    const res = await fetch(`${API_BASE}/reports`);
    if (res.ok) {
      const dbReports = await res.json();
      writeLocalList(KEY, dbReports);
      return dbReports;
    }
  } catch (e) {
    // Fallback to localStorage if backend server is offline
  }
  await delay(80);
  return readLocalList(KEY);
}

export async function createReport(report) {
  const payload = {
    id: `NVR-${String(Date.now()).slice(-5)}`,
    status: "Reported",
    priority: report.priority || "Medium",
    reportedAt: new Date().toLocaleString(),
    updates: ["Report received"],
    ...report,
    department:
      report.department ||
      ({
        Pothole: "Roads & Civil Works",
        "Road Damage": "Roads & Civil Works",
        Sidewalk: "Roads & Civil Works",
        Garbage: "Sanitation",
        Streetlight: "Electrical Quick Response",
        Drainage: "Water & Drainage",
        Water: "Water & Drainage",
      }[report.category] || "Roads & Civil Works"),
    ward: report.ward || "Ward pending",
    slaHours:
      report.slaHours ??
      ({ Critical: 4, High: 12, Medium: 24, Low: 36 }[report.priority] || 24),
  };

  try {
    const res = await fetch(`${API_BASE}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const saved = await res.json();
      writeLocalList(KEY, [saved, ...readLocalList(KEY)]);
      window.dispatchEvent(new CustomEvent("nivara:report-created", { detail: saved }));
      return saved;
    }
  } catch (e) {
    // Fallback to localStorage if backend is not running
  }

  await delay(450);
  writeLocalList(KEY, [payload, ...readLocalList(KEY)]);
  window.dispatchEvent(new CustomEvent("nivara:report-created", { detail: payload }));
  return payload;
}

export async function updateReport(id, patch) {
  try {
    const res = await fetch(`${API_BASE}/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updatedDoc = await res.json();
      const items = readLocalList(KEY);
      writeLocalList(
        KEY,
        items.map((item) => (item.id === id ? { ...item, ...updatedDoc } : item))
      );
      return updatedDoc;
    }
  } catch (e) {
    // Fallback to localStorage
  }

  const items = readLocalList(KEY);
  const updated = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
  writeLocalList(KEY, updated);
  return updated.find((item) => item.id === id) || null;
}
