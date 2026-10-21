// NIVARA authority console — issue resolution analytics dashboard.
// Triage queue, officer assignment, repair workflow, and live analytics.
// Real-time: same-tab via nivara:reports-changed, cross-tab via storage.

import { initBackground } from "./background.js?v=20261020d";
import { mountNav, initPageChrome, showToast, escapeHtml, formatDate } from "./ui.js?v=20261020d";
import { getSession, seedOfficers, listOfficers } from "./auth.js?v=20261020d";
import {
  readReports, seedDemoReports, DEMO_REPORTS, applyReports, deleteReport,
  assignOfficer, startRepair, resolveReport, setReportStatus, addWorkNote, reopenReport,
  slaState, CATEGORY_COLORS, STATUSES,
} from "./store.js?v=20261020d";
import {
  computeMetrics, throughput, statusDistribution, departmentBreakdown,
  categoryBreakdown, wardBreakdown, officerWorkload, recentActivity,
  slaLabel, formatHours,
} from "./analytics.js?v=20261020d";
import { drawAreaLine, drawDonut, drawHBars, STATUS_COLORS } from "./charts.js?v=20261020d";

initBackground();
mountNav("console");
initPageChrome();

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const gate = $("#consoleGate");
const app = $("#consoleApp");
const session = getSession();

const PRIORITY_WEIGHT = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const SLA_RANK = { breached: 0, "at-risk": 1, "on-track": 2, met: 3, missed: 3 };

let reports = [];
let activeStatus = "All";
let query = "";
let sortBy = "sla";
let selectedId = null;

function isAuthority(s) {
  return Boolean(s && s.role === "authority");
}

function actor() {
  return { name: session.name, employeeId: session.employeeId, designation: session.designation };
}

/* ---------------------------------------------------------- demo enrichment
   Records seeded before the resolution workflow existed get synthetic
   officers/timestamps so the analytics view is meaningful. Only touches
   the NVR-1xxx demonstration ids, never citizen-submitted reports.     */

function enrichSeededReports() {
  if (localStorage.getItem("nivara.consoleEnriched")) return;
  const roster = listOfficers();
  let touched = false;
  const next = readReports().map((r, idx) => {
    if (!/^NVR-1\d{3}$/.test(r.id) || Array.isArray(r.workLog)) return r;
    touched = true;
    const officer = roster.find((o) => o.department === r.department) || roster[idx % roster.length];
    const reported = Date.parse(r.reportedAt);
    const ack = new Date(reported + 25 * 6e4).toISOString();
    const start = r.status === "Reported" ? null : new Date(reported + 2 * 36e5).toISOString();
    const resolved = r.status === "Resolved" ? new Date(reported + (r.slaHours || 24) * 0.7 * 36e5).toISOString() : null;
    const assigned = r.status !== "Reported";
    return {
      ...r,
      officer: assigned && officer ? { name: officer.name, employeeId: officer.employeeId, designation: officer.designation } : null,
      acknowledgedAt: assigned ? ack : null,
      startedAt: start,
      resolvedAt: resolved,
      workLog: assigned && officer
        ? [
            { at: ack, by: { name: "Duty Officer", employeeId: "NVR-OFF-2291" }, action: "assign", note: `Assigned to ${officer.name} (${officer.employeeId}).` },
            ...(start ? [{ at: start, by: { name: officer.name, employeeId: officer.employeeId }, action: "start", note: "Repair crew dispatched to site." }] : []),
            ...(resolved ? [{ at: resolved, by: { name: officer.name, employeeId: officer.employeeId }, action: "resolve", note: "Work completed and verified on site." }] : []),
          ]
        : [],
    };
  });
  if (touched) applyReports(next);
  localStorage.setItem("nivara.consoleEnriched", "1");
}

/* --------------------------------------------------------------- utilities */

function timeAgo(iso) {
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return "";
  const m = Math.round(diff / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function officerChip(officer) {
  if (!officer) {
    return `<span class="officer-chip officer-chip--none"><i>?</i> Unassigned</span>`;
  }
  const initials = escapeHtml(officer.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase());
  return `<span class="officer-chip" title="${escapeHtml(officer.designation || "")}"><i>${initials}</i>${escapeHtml(officer.name)} · ${escapeHtml(officer.employeeId)}</span>`;
}

function slaChip(report) {
  const state = slaState(report);
  const cls = { breached: "is-breached", "at-risk": "is-at-risk", met: "is-met", missed: "is-missed" }[state.kind] || "";
  return `<span class="sla-chip ${cls}" data-sla="${escapeHtml(report.id)}">${escapeHtml(slaLabel(state))}</span>`;
}

function statusBadge(status) {
  const cls = { Reported: "badge-warning", Acknowledged: "badge", "In Progress": "badge", Resolved: "badge-success" }[status] || "badge-muted";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

/* ------------------------------------------------------------------ KPIs */

function renderKpis() {
  const m = computeMetrics(reports);
  const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
  const compliance = m.slaCompliance;
  const cards = [
    {
      label: "Open queue", value: m.open,
      sub: `${m.unassigned} unassigned · ${m.atRisk} at risk`,
      meter: pct(m.open, m.total),
    },
    {
      label: "Critical open", value: m.criticalOpen,
      sub: "priority Critical, unresolved",
      tone: m.criticalOpen > 0 ? "is-danger" : "is-good",
      meter: pct(m.criticalOpen, Math.max(1, m.open)),
    },
    {
      label: "Avg. resolution", value: m.avgResolutionHours == null ? "—" : formatHours(m.avgResolutionHours),
      sub: `median ${m.medianResolutionHours == null ? "—" : formatHours(m.medianResolutionHours)} · across ${m.resolved} resolved`,
    },
    {
      label: "SLA compliance", value: compliance == null ? "—" : `${compliance}%`,
      sub: `${m.slaMet} met · ${m.slaMissed} missed`,
      tone: compliance == null ? "" : compliance >= 85 ? "is-good" : compliance >= 60 ? "is-warn" : "is-danger",
      meter: compliance ?? 0,
    },
    {
      label: "SLA breached", value: m.breached,
      sub: `${m.atRisk} more at risk right now`,
      tone: m.breached > 0 ? "is-danger" : "is-good",
      meter: pct(m.breached, Math.max(1, m.open)),
    },
    {
      label: "First response", value: m.avgFirstResponseHours == null ? "—" : formatHours(m.avgFirstResponseHours),
      sub: "avg. time to acknowledge",
    },
  ];
  $("#kpiGrid").innerHTML = cards.map((c) => `
    <article class="glass kpi ${c.tone || ""}">
      <div class="label">${escapeHtml(c.label)}</div>
      <div class="value">${escapeHtml(String(c.value))}</div>
      ${c.meter != null ? `<div class="meter"><span style="width:${Math.min(100, c.meter)}%"></span></div>` : ""}
      <span class="sub">${escapeHtml(c.sub)}</span>
    </article>`).join("");
}

/* ----------------------------------------------------------------- charts */

function renderCharts() {
  const days = throughput(reports, 14);
  drawAreaLine($("#trendChart"), {
    series: [
      { values: days.map((d) => d.reported), color: "#ffb020" },
      { values: days.map((d) => d.resolved), color: "#00ffc6" },
    ],
    labels: days.map((d) => d.label),
    yMax: Math.max(4, ...days.flatMap((d) => [d.reported, d.resolved])),
  });
  const sum = (k) => days.reduce((a, d) => a + d[k], 0);
  $("#trendLegend").innerHTML = `
    <span><i style="background:#ffb020"></i>Reported <b>${sum("reported")}</b></span>
    <span><i style="background:#00ffc6"></i>Resolved <b>${sum("resolved")}</b></span>`;

  const dist = statusDistribution(reports);
  drawDonut($("#statusChart"), dist.map((d) => ({ value: d.count, color: STATUS_COLORS[d.status] })), {
    centerTop: reports.length,
    centerBottom: "reports",
  });
  $("#statusLegend").innerHTML = dist.map((d) => `
    <span><i style="background:${STATUS_COLORS[d.status]}"></i>${escapeHtml(d.status)} <b>${d.count}</b></span>`).join("");

  const depts = departmentBreakdown(reports).slice(0, 8);
  drawHBars($("#deptChart"), depts.map((d) => ({
    label: d.department, value: d.open, color: d.breached ? "#ff5d73" : "#00e5ff",
    valueLabel: `${d.open}/${d.total}`,
  })));

  const cats = categoryBreakdown(reports).slice(0, 6);
  drawHBars($("#catChart"), cats.map((c) => ({
    label: c.category, value: c.open, color: CATEGORY_COLORS[c.category] || "#94a3b8",
    valueLabel: `${c.open}/${c.total}`,
  })));
}

/* ------------------------------------------------------------------ queue */

function filteredQueue() {
  const q = query.trim().toLowerCase();
  const rows = reports.filter((r) => {
    const statusOk =
      activeStatus === "All" ||
      (activeStatus === "Unassigned" ? !r.officer && r.status !== "Resolved" : r.status === activeStatus);
    if (!statusOk) return false;
    if (!q) return true;
    return `${r.title} ${r.location} ${r.id} ${r.category} ${r.ward} ${r.officer?.name || ""} ${r.officer?.employeeId || ""}`
      .toLowerCase().includes(q);
  });
  return rows.sort((a, b) => {
    if (sortBy === "newest") return Date.parse(b.reportedAt) - Date.parse(a.reportedAt);
    if (sortBy === "priority") return (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
    if (sortBy === "ward") return String(a.ward).localeCompare(String(b.ward));
    const rank = (r) => SLA_RANK[slaState(r).kind] ?? 4;
    return rank(a) - rank(b) || (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
  });
}

function renderQueueFilters() {
  const items = [
    ["All", "All", reports.length],
    ["Reported", "Reported", reports.filter((r) => r.status === "Reported").length],
    ["Acknowledged", "Acknowledged", reports.filter((r) => r.status === "Acknowledged").length],
    ["In Progress", "In progress", reports.filter((r) => r.status === "In Progress").length],
    ["Resolved", "Resolved", reports.filter((r) => r.status === "Resolved").length],
    ["Unassigned", "Unassigned", reports.filter((r) => !r.officer && r.status !== "Resolved").length],
  ];
  $("#queueFilters").innerHTML = items.map(([value, label, count]) => `
    <button class="chip${activeStatus === value ? " is-on" : ""}" data-status="${value}" aria-pressed="${activeStatus === value}">
      ${label}<span class="count">${count}</span>
    </button>`).join("");
}

function rowActions(r) {
  const btn = (act, label, primary = false) =>
    `<button class="btn btn-sm${primary ? " btn-primary" : ""}" data-${act}="${escapeHtml(r.id)}">${label}</button>`;
  let html = btn("review", "Review", true);
  if (r.status === "Reported") html += btn("assign", "Assign officer") + btn("start", "Start work");
  else if (r.status === "Acknowledged") html += btn("start", "Start work") + btn("assign", "Reassign");
  else if (r.status === "In Progress") html += btn("resolve", "Resolve") + btn("assign", "Reassign");
  else html += btn("reopen", "Reopen");
  return html;
}

function renderQueue() {
  const rows = filteredQueue();
  const list = $("#queueList");
  if (!rows.length) {
    list.innerHTML = `<div class="empty-state">${reports.length ? "No reports match these filters." : "No reports yet. Citizen submissions will land here instantly."}</div>`;
    return;
  }
  list.innerHTML = rows.map((r) => `
    <article class="q-row" data-id="${escapeHtml(r.id)}">
      <span class="q-row__dot" style="background:${CATEGORY_COLORS[r.category] || "#00e5ff"}" aria-hidden="true"></span>
      <div class="q-row__main">
        <div class="q-row__title">
          <h3>${escapeHtml(r.title)}</h3>
          ${statusBadge(r.status)}
          <span class="badge badge-muted prio-chip prio-${escapeHtml(r.priority)}">${escapeHtml(r.priority)}</span>
        </div>
        <div class="q-row__meta">${escapeHtml(r.id)} · ${escapeHtml(r.category)} · ${escapeHtml(r.ward)} · ${escapeHtml(r.location)} · reported ${escapeHtml(timeAgo(r.reportedAt))}</div>
        <div class="q-row__officer">${officerChip(r.officer)}</div>
      </div>
      <div class="q-row__side">${slaChip(r)}</div>
      <div class="q-row__actions">${rowActions(r)}</div>
    </article>`).join("");
}

/* -------------------------------------------------------- side: roster etc */

function renderRoster() {
  const rows = officerWorkload(reports, listOfficers());
  const max = Math.max(1, ...rows.map((r) => r.open));
  $("#rosterList").innerHTML = rows.map((o) => `
    <button class="roster-row" type="button" data-officer="${escapeHtml(o.name)}" title="Filter queue by this officer">
      <div><strong>${escapeHtml(o.name)}</strong><small>${escapeHtml(o.employeeId)} · ${escapeHtml(o.department)}</small></div>
      <span class="load">${o.open}<small> open</small></span>
      <div class="meter"><span style="width:${Math.round((o.open / max) * 100)}%"></span></div>
    </button>`).join("") || `<p class="side-card__sub">No officers seeded.</p>`;
}

function renderWards() {
  const rows = wardBreakdown(reports).slice(0, 6);
  $("#wardTable").innerHTML = rows.map((w) => {
    const cls = w.slaCompliance == null ? "" : w.slaCompliance >= 85 ? "ok" : w.slaCompliance >= 60 ? "warn" : "bad";
    return `<div class="ward-row">
      <span>${escapeHtml(w.ward)} <small>· ${w.resolved}/${w.total} resolved</small></span>
      <small>${w.breached ? `${w.breached} breached` : "no breaches"}</small>
      <b class="${cls}">${w.slaCompliance == null ? "—" : w.slaCompliance + "%"}</b>
    </div>`;
  }).join("") || `<p class="side-card__sub">No ward data yet.</p>`;
}

function renderFeed() {
  const entries = recentActivity(reports, 9);
  $("#activityFeed").innerHTML = entries.map((e) => `
    <div class="feed-item is-${escapeHtml(e.action)}">
      <b>${escapeHtml(e.by?.name || "System")} · ${escapeHtml(e.action)}</b>
      <p>${escapeHtml(e.note || "")}</p>
      <small>${escapeHtml(e.reportId)} · ${escapeHtml(timeAgo(e.at))}</small>
    </div>`).join("") || `<p class="side-card__sub">Actions you take will appear here.</p>`;
}

/* ------------------------------------------------------------------ modal */

const modal = $("#reportModal");
const modalBody = $("#modalBody");

function closeModal() {
  selectedId = null;
  modal.classList.remove("is-open");
  modal.hidden = true;
  modalBody.innerHTML = "";
}

function renderModal(id) {
  const r = reports.find((x) => x.id === id);
  if (!r) return closeModal();
  const officerOptions = listOfficers()
    .sort((a, b) => (a.department === r.department ? -1 : 0) - (b.department === r.department ? -1 : 0) || a.name.localeCompare(b.name))
    .map((o) => `<option value="${escapeHtml(o.employeeId)}">${escapeHtml(o.name)} · ${escapeHtml(o.employeeId)} · ${escapeHtml(o.department)}${o.department === r.department ? " ★" : ""}</option>`)
    .join("");
  const from = STATUSES.indexOf(r.status);
  const statusOptions = (r.status === "Resolved" ? ["In Progress"] : STATUSES.slice(from + 1))
    .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  const state = slaState(r);

  modalBody.innerHTML = `
    <div class="console-modal__head">
      <div>
        <h3>${escapeHtml(r.title)}</h3>
        <div class="console-modal__badges">
          <span class="badge badge-muted">${escapeHtml(r.id)}</span>
          ${statusBadge(r.status)}
          <span class="badge badge-muted prio-chip prio-${escapeHtml(r.priority)}">${escapeHtml(r.priority)} priority</span>
          ${slaChip(r)}
        </div>
      </div>
      <button class="modal-close" type="button" data-close aria-label="Close">×</button>
    </div>

    <div class="meta-grid">
      <div><small>Department</small><b>${escapeHtml(r.department)}</b></div>
      <div><small>Ward</small><b>${escapeHtml(r.ward)}</b></div>
      <div><small>Category</small><b>${escapeHtml(r.category)}</b></div>
      <div><small>Location</small><b>${escapeHtml(r.location)}</b></div>
      <div><small>Reporter</small><b>${escapeHtml(r.reporter || "Anonymous")}</b></div>
      <div><small>Reported</small><b>${escapeHtml(formatDate(r.reportedAt))}</b></div>
      <div><small>SLA target</small><b>${r.slaHours}h · ${escapeHtml(slaLabel(state))}</b></div>
      <div><small>Assigned officer</small><b>${r.officer ? escapeHtml(r.officer.name) : "Unassigned"}</b></div>
      <div><small>Response so far</small><b>${r.acknowledgedAt ? escapeHtml(timeAgo(r.acknowledgedAt)) : "not acknowledged"}</b></div>
    </div>

    <p class="console-modal__desc">${escapeHtml(r.description || "No description provided.")}</p>
    ${r.images?.length ? `<div class="console-modal__images">${r.images.slice(0, 4).map((src) => `<img src="${src}" alt="Report photo" />`).join("")}</div>` : ""}

    <div class="modal-section">
      <h4>Assign officer</h4>
      <div class="action-grid">
        <div class="action-row">
          <select class="form-control" id="assignSelect" aria-label="Choose officer">${officerOptions}</select>
          <button class="btn btn-primary btn-sm" type="button" data-act="assign">${r.officer ? "Reassign" : "Assign"} →</button>
        </div>
        <p class="action-hint">★ marks an officer from the report's own department. Assignment acknowledges the report and is attributed to your ID.</p>
      </div>
    </div>

    <div class="modal-section">
      <h4>Update status</h4>
      <div class="action-grid">
        <div class="action-row">
          <select class="form-control" id="statusSelect" aria-label="New status">${statusOptions || '<option value="">No further transitions</option>'}</select>
          <button class="btn btn-sm" type="button" data-act="status" ${statusOptions ? "" : "disabled"}>Apply status</button>
        </div>
        <div class="action-row">
          <textarea class="form-control" id="statusNote" placeholder="Optional note shown to the citizen (e.g. crew scheduled for tomorrow morning)"></textarea>
        </div>
        <div class="action-row">
          ${r.status !== "Resolved" && r.status !== "In Progress" ? '<button class="btn btn-sm" type="button" data-act="start">Start repair work</button>' : ""}
          ${r.status !== "Resolved" ? '<button class="btn btn-sm btn-primary" type="button" data-act="resolve">Mark resolved</button>' : '<button class="btn btn-sm" type="button" data-act="reopen">Reopen report</button>'}
        </div>
      </div>
    </div>

    <div class="modal-section">
      <h4>Add progress note</h4>
      <div class="action-grid">
        <div class="action-row">
          <textarea class="form-control" id="noteInput" placeholder="e.g. Materials ordered, site visit booked for 10:00."></textarea>
        </div>
        <div class="action-row">
          <button class="btn btn-sm" type="button" data-act="note">Post note</button>
        </div>
      </div>
    </div>

    <div class="modal-section">
      <h4>Citizen-visible timeline</h4>
      <div class="modal-timeline">
        ${(r.updates || []).map((u) => `
          <div class="tl-item is-done">
            <span class="tl-item__dot"></span>
            <b>${escapeHtml(u.status)}</b>
            <p>${escapeHtml(u.note || "")}</p>
            <small>${escapeHtml(formatDate(u.at))}</small>
          </div>`).join("")}
      </div>
    </div>

    <div class="modal-section">
      <h4>Officer activity log</h4>
      <div class="log-list">
        ${(r.workLog || []).length
          ? (r.workLog || []).map((e) => `
            <div class="log-item">
              <b>${escapeHtml(e.action)}</b>
              <span>${escapeHtml(e.note || "")}</span>
              <small>${escapeHtml(e.by?.name || "System")}${e.by?.employeeId ? " · " + escapeHtml(e.by.employeeId) : ""} · ${escapeHtml(formatDate(e.at))}</small>
            </div>`).join("")
          : '<p class="side-card__sub">No attributed officer actions yet.</p>'}
      </div>
    </div>

    <div class="modal-section">
      <h4>Danger zone</h4>
      <div class="action-grid">
        <div class="action-row">
          <button class="btn btn-sm" type="button" data-act="delete" style="border-color:rgba(255,93,115,0.5);color:var(--danger)">Delete report</button>
        </div>
        <p class="action-hint">Removes this report and its full history from this device.</p>
      </div>
    </div>`;
}

function openModal(id, { focusAssign = false } = {}) {
  selectedId = id;
  renderModal(id);
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("is-open"));
  if (focusAssign) setTimeout(() => $("#assignSelect")?.focus(), 150);
  else setTimeout(() => $("[data-close]")?.focus(), 120);
}

/* ---------------------------------------------------------------- actions */

function withReport(id, fn, successMsg) {
  const result = fn();
  if (!result) {
    showToast("That action could not be applied. Check the report state and try again.", "error", "Action blocked");
    return;
  }
  if (successMsg) showToast(successMsg, "success");
  // store.js already dispatched nivara:reports-changed → renderAll() follows.
}

const ACTIONS = {
  assign(id) {
    const r = reports.find((x) => x.id === id);
    const select = $("#assignSelect");
    const officer = listOfficers().find((o) => o.employeeId === select?.value);
    if (!r || !officer) return showToast("Choose an officer to assign.", "warning");
    withReport(id, () => assignOfficer(id, officer, actor()), `Assigned ${id} to ${officer.name}.`);
  },
  start(id) {
    withReport(id, () => startRepair(id, actor()), `Repair work initiated on ${id}.`);
  },
  resolve(id) {
    const note = $("#statusNote")?.value?.trim() || "";
    withReport(id, () => resolveReport(id, actor(), note), `${id} marked resolved.`);
  },
  reopen(id) {
    withReport(id, () => reopenReport(id, actor(), "Reopened for re-inspection."), `${id} reopened.`);
  },
  status(id) {
    const status = $("#statusSelect")?.value;
    const note = $("#statusNote")?.value?.trim() || "";
    if (!status) return;
    withReport(id, () => setReportStatus(id, status, actor(), note), `${id} moved to ${status}.`);
  },
  note(id) {
    const note = $("#noteInput")?.value?.trim() || "";
    if (!note) return showToast("Write a note first.", "warning");
    withReport(id, () => addWorkNote(id, actor(), note), "Note posted.");
  },
  delete(id) {
    const report = reports.find((x) => x.id === id);
    if (!report) return;
    deleteReport(id);
    closeModal();
    showToast(`${id} — “${report.title}” was removed from this device.`, "success", "Report deleted");
  },
};

/* ------------------------------------------------------------------ render */

function markUpdated() {
  const el = $("#lastUpdated");
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderAll() {
  renderKpis();
  renderCharts();
  renderQueueFilters();
  renderQueue();
  renderRoster();
  renderWards();
  renderFeed();
  if (selectedId) renderModal(selectedId);
  markUpdated();
}

function tickSla() {
  $$("[data-sla]").forEach((el) => {
    const r = reports.find((x) => x.id === el.dataset.sla);
    if (!r) return;
    const state = slaState(r);
    el.textContent = slaLabel(state);
    el.className = `sla-chip ${{ breached: "is-breached", "at-risk": "is-at-risk", met: "is-met", missed: "is-missed" }[state.kind] || ""}`;
  });
}

/* ------------------------------------------------------------------- boot */

function bootConsole() {
  seedDemoReports(DEMO_REPORTS);
  seedOfficers();
  enrichSeededReports();
  reports = readReports();

  const chip = $("#officerChip");
  chip.hidden = false;
  chip.innerHTML = `<span class="nav-avatar">${escapeHtml((session.name || "N").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase())}</span>
    ${escapeHtml(session.name)} <small>· ${escapeHtml(session.employeeId)} · ${escapeHtml(session.department)}</small>`;

  $("#queueFilters").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-status]");
    if (!btn) return;
    activeStatus = btn.dataset.status;
    renderQueueFilters();
    renderQueue();
  });
  $("#queueSearch").addEventListener("input", (e) => { query = e.target.value; renderQueue(); });
  $("#queueSort").addEventListener("change", (e) => { sortBy = e.target.value; renderQueue(); });

  $("#queueList").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-review], button[data-assign], button[data-start], button[data-resolve], button[data-reopen]");
    if (!btn) return;
    const id = btn.dataset.review || btn.dataset.assign || btn.dataset.start || btn.dataset.resolve || btn.dataset.reopen;
    if (btn.dataset.review) return openModal(id);
    if (btn.dataset.assign) return openModal(id, { focusAssign: true });
    if (btn.dataset.start) return ACTIONS.start(id);
    if (btn.dataset.resolve) return ACTIONS.resolve(id);
    if (btn.dataset.reopen) return ACTIONS.reopen(id);
  });

  $("#rosterList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-officer]");
    if (!btn) return;
    query = btn.dataset.officer;
    $("#queueSearch").value = query;
    activeStatus = "All";
    renderQueueFilters();
    renderQueue();
    showToast(`Queue filtered to ${btn.dataset.officer}.`, "info");
  });

  $("#activityFeed").addEventListener("click", (e) => {
    const item = e.target.closest(".feed-item");
    if (!item) return;
    const id = (item.querySelector("small")?.textContent || "").split(" · ")[0];
    if (reports.some((r) => r.id === id)) openModal(id);
  });

  modalBody.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return closeModal();
    const btn = e.target.closest("[data-act]");
    if (!btn || !selectedId) return;
    ACTIONS[btn.dataset.act]?.(selectedId);
  });
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && selectedId) closeModal(); });

  window.addEventListener("nivara:reports-changed", () => { reports = readReports(); renderAll(); });
  window.addEventListener("storage", (e) => { if (e.key === "nivara.reports") { reports = readReports(); renderAll(); } });
  window.addEventListener("resize", () => { clearTimeout(window.__consoleT); window.__consoleT = setTimeout(renderCharts, 160); });
  setInterval(tickSla, 1000);

  renderAll();
  tickSla();
}

if (isAuthority(session)) {
  app.hidden = false;
  gate.hidden = true;
  bootConsole();
} else {
  gate.hidden = false;
  app.hidden = true;
}

window.addEventListener("nivara:session-changed", (e) => {
  if (isAuthority(e.detail)) location.reload();
});
