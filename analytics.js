// Issue-resolution analytics — pure functions over the reports array.
// No DOM access, so the same numbers feed the KPI cards, the charts,
// and any future export. Pre-existing reports (saved before the resolution
// workflow existed) are handled through fallbacks on updates[] timestamps.

import { STATUSES, resolutionHours, firstResponseHours, slaState } from "./store.js?v=20261020d";

const HOUR = 36e5;
const DAY = 864e5;

export function isOpen(report) {
  return report.status !== "Resolved";
}

export function slaMet(report) {
  const state = slaState(report);
  if (report.status === "Resolved") return state.kind === "met";
  return state.kind === "on-track" || state.kind === "at-risk";
}

export function computeMetrics(reports, now = Date.now()) {
  const total = reports.length;
  const resolved = reports.filter((r) => r.status === "Resolved");
  const open = reports.filter(isOpen);
  const resolutionTimes = resolved.map(resolutionHours).filter((v) => v != null);
  const responseTimes = reports.map(firstResponseHours).filter((v) => v != null);
  const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
  const median = (list) => {
    if (!list.length) return null;
    const s = [...list].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const met = resolved.filter((r) => slaState(r).kind === "met").length;
  const breached = open.filter((r) => slaState(r, now).kind === "breached").length;
  const atRisk = open.filter((r) => slaState(r, now).kind === "at-risk").length;
  return {
    total,
    open: open.length,
    resolved: resolved.length,
    inProgress: reports.filter((r) => r.status === "In Progress").length,
    acknowledged: reports.filter((r) => r.status === "Acknowledged").length,
    reported: reports.filter((r) => r.status === "Reported").length,
    criticalOpen: open.filter((r) => r.priority === "Critical").length,
    avgResolutionHours: avg(resolutionTimes),
    medianResolutionHours: median(resolutionTimes),
    avgFirstResponseHours: avg(responseTimes),
    slaMet: met,
    slaMissed: resolved.length - met,
    slaCompliance: resolved.length ? Math.round((met / resolved.length) * 100) : null,
    breached,
    atRisk,
    unassigned: open.filter((r) => !r.officer).length,
  };
}

/** Last `days` calendar days, oldest first: reported vs resolved counts. */
export function throughput(reports, days = 14, now = Date.now()) {
  const buckets = [];
  const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const today = startOfDay(now);
  for (let i = days - 1; i >= 0; i--) {
    const day = today - i * DAY;
    buckets.push({ day, label: "", reported: 0, resolved: 0 });
  }
  const index = new Map(buckets.map((b) => [b.day, b]));
  reports.forEach((r) => {
    const rb = index.get(startOfDay(Date.parse(r.reportedAt)));
    if (rb) rb.reported += 1;
    const resolvedAt = r.resolvedAt ? Date.parse(r.resolvedAt) : NaN;
    if (Number.isFinite(resolvedAt)) {
      const db = index.get(startOfDay(resolvedAt));
      if (db) db.resolved += 1;
    }
  });
  buckets.forEach((b) => { b.label = new Date(b.day).toLocaleDateString([], { day: "2-digit", month: "short" }); });
  return buckets;
}

export function statusDistribution(reports) {
  return STATUSES.map((status) => ({
    status,
    count: reports.filter((r) => r.status === status).length,
  }));
}

function groupBy(reports, keyFn) {
  const map = new Map();
  reports.forEach((r) => {
    const key = keyFn(r) || "Unassigned";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });
  return map;
}

export function departmentBreakdown(reports, now = Date.now()) {
  const depts = [...new Set(reports.map((r) => r.department || "General Services"))];
  return depts.map((department) => {
    const group = reports.filter((r) => (r.department || "General Services") === department);
    const resolved = group.filter((r) => r.status === "Resolved");
    const times = resolved.map(resolutionHours).filter((v) => v != null);
    const met = resolved.filter((r) => slaState(r, now).kind === "met").length;
    return {
      department,
      total: group.length,
      open: group.length - resolved.length,
      resolved: resolved.length,
      breached: group.filter((r) => isOpen(r) && slaState(r, now).kind === "breached").length,
      slaCompliance: resolved.length ? Math.round((met / resolved.length) * 100) : null,
      avgResolutionHours: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    };
  }).sort((a, b) => b.open - a.open || b.total - a.total);
}

export function categoryBreakdown(reports) {
  const map = groupBy(reports, (r) => r.category);
  return [...map.entries()]
    .map(([category, group]) => ({
      category,
      total: group.length,
      open: group.filter(isOpen).length,
      resolved: group.filter((r) => r.status === "Resolved").length,
    }))
    .sort((a, b) => b.total - a.total);
}

export function wardBreakdown(reports, now = Date.now()) {
  const map = groupBy(reports, (r) => r.ward);
  return [...map.entries()]
    .map(([ward, group]) => {
      const resolved = group.filter((r) => r.status === "Resolved");
      return {
        ward,
        total: group.length,
        open: group.length - resolved.length,
        resolved: resolved.length,
        breached: group.filter((r) => isOpen(r) && slaState(r, now).kind === "breached").length,
        slaCompliance: resolved.length
          ? Math.round((resolved.filter((r) => slaState(r, now).kind === "met").length / resolved.length) * 100)
          : null,
      };
    })
    .sort((a, b) => b.open - a.open || b.total - a.total);
}

export function officerWorkload(reports, officers = []) {
  const open = reports.filter(isOpen);
  const resolved = reports.filter((r) => r.status === "Resolved");
  const rows = officers.map((o) => ({
    employeeId: o.employeeId,
    name: o.name,
    department: o.department,
    open: open.filter((r) => r.officer?.employeeId === o.employeeId).length,
    resolved: resolved.filter((r) => r.officer?.employeeId === o.employeeId).length,
  }));
  // Anyone holding open assignments but missing from the roster still shows up.
  open.forEach((r) => {
    if (r.officer && !rows.some((row) => row.employeeId === r.officer.employeeId)) {
      rows.push({
        employeeId: r.officer.employeeId,
        name: r.officer.name,
        department: r.department || "",
        open: 1,
        resolved: resolved.filter((x) => x.officer?.employeeId === r.officer.employeeId).length,
      });
    }
  });
  return rows.sort((a, b) => b.open - a.open || b.resolved - a.resolved);
}

/** Flattened, newest-first work log across all reports (activity feed). */
export function recentActivity(reports, limit = 12) {
  const entries = [];
  reports.forEach((r) => {
    (r.workLog || []).forEach((entry) => entries.push({ ...entry, reportId: r.id, reportTitle: r.title }));
    if (!(r.workLog || []).length) {
      (r.updates || []).forEach((u) => entries.push({
        at: u.at,
        by: { name: "Citizen portal", employeeId: "" },
        action: "status",
        note: u.note || `Status moved to ${u.status}.`,
        reportId: r.id,
        reportTitle: r.title,
      }));
    }
  });
  return entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

/** Compact "xh left" / "breached" copy for SLA chips. */
export function slaLabel(state) {
  if (!state) return "";
  if (state.kind === "met") return state.hours == null ? "SLA met" : `SLA met in ${formatHours(state.hours)}`;
  if (state.kind === "missed") return state.hours == null ? "SLA missed" : `SLA missed · ${formatHours(state.hours)}`;
  if (state.kind === "breached") return `Breached by ${formatHours(Math.abs(state.hours))}`;
  return `${formatHours(state.hours)} left`;
}

export function formatHours(hours) {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${(hours / 24).toFixed(1)}d`;
}
