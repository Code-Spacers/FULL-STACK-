import { initBackground } from "./background.js?v=20261020d";
import { mountNav, initPageChrome, showToast, formatDate, escapeHtml, LOGIN_URL } from "./ui.js?v=20261020d";
import { readReports, deleteReport, advanceReport, CATEGORY_COLORS } from "./store.js?v=20261020d";
import { getSession } from "./auth.js?v=20261020d";

const STATUSES = ["Reported", "Acknowledged", "In Progress", "Resolved"];

// My Reports is a signed-in citizen page. A logged-out visitor — whether they
// clicked the nav link or typed the URL — is sent to the existing Sign In
// page before any page chrome or report data is rendered. Signing in as a
// citizen returns here automatically (login.html redirects to my-reports).
if (!getSession()) {
  location.replace(LOGIN_URL);
} else {
  bootMyReports();
}

function bootMyReports() {
  initBackground();
  mountNav("my-reports");
  initPageChrome();

  const grid = document.getElementById("reportsGrid");
  const statsEl = document.getElementById("reportStats");
  const filtersEl = document.getElementById("statusFilters");
  const searchEl = document.getElementById("reportSearch");

  let activeStatus = "All";
  let query = "";

  const statusClasses = { Reported: "badge-warning", Acknowledged: "badge", "In Progress": "badge-success", Resolved: "badge-success" };

  function renderFilters() {
    const items = [["All", "All"], ...STATUSES.map((s) => [s, s])];
    filtersEl.innerHTML = items.map(([value, label]) => {
      const count = value === "All" ? readReports().length : readReports().filter((r) => r.status === value).length;
      return `<button class="chip${activeStatus === value ? " is-on" : ""}" data-status="${value}" aria-pressed="${activeStatus === value}">${label}<span class="count">${count}</span></button>`;
    }).join("");
  }

  function renderStats(reports) {
    const open = reports.filter((r) => r.status !== "Resolved").length;
    const resolved = reports.filter((r) => r.status === "Resolved").length;
    const critical = reports.filter((r) => r.priority === "Critical" && r.status !== "Resolved").length;
    const card = (label, value, tone) => `<div class="glass" style="padding:16px 20px;min-width:150px"><div style="color:var(--muted);font-size:0.82rem">${label}</div><div style="font-family:var(--font-head);font-size:1.8rem;font-weight:800;${tone ? `color:${tone}` : ""}">${value}</div></div>`;
    statsEl.innerHTML = card("Total reports", reports.length) + card("Open", open) + card("Resolved", resolved, "var(--accent)") + card("Critical open", critical, "var(--danger)");
  }

  function timeline(report) {
    const done = STATUSES.indexOf(report.status);
    return `<div class="timeline-track">${STATUSES.map((s, i) => {
      const update = (report.updates || []).find((u) => u.status === s);
      return `<div class="timeline-step${i <= done ? " is-done" : ""}">
        <div class="timeline-step__marker"><span class="timeline-step__dot"></span></div>
        <div class="timeline-step__body"><b>${s}</b><small>${update ? formatDate(update.at) : (i <= done ? "Completed" : "Pending")}</small></div>
      </div>`;
    }).join("")}</div>`;
  }

  function render() {
    const reports = readReports();
    // Advance status and Delete are authority-only controls; citizens get a
    // read-only card (the authority console is where reports are managed).
    const canManage = getSession()?.role === "authority";
    renderFilters();
    renderStats(reports);
    const q = query.trim().toLowerCase();
    const rows = reports.filter((r) =>
      (activeStatus === "All" || r.status === activeStatus) &&
      `${r.title} ${r.location} ${r.id} ${r.category}`.toLowerCase().includes(q)
    );
    if (!rows.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        ${reports.length ? "No reports match these filters." : "No reports yet. <a href='login.html?next=report.html&amp;msg=report' style='color:var(--primary)'>Sign in to submit your first report →</a>"}
      </div>`;
      return;
    }
    grid.innerHTML = rows.map((r) => `
      <article class="glass report-card">
        <div class="report-card__head">
          <div>
            <div class="row-top" style="display:flex;align-items:center;gap:8px">
              <span class="dot" style="width:10px;height:10px;border-radius:50%;background:${CATEGORY_COLORS[r.category] || "#00e5ff"}"></span>
              <h3>${escapeHtml(r.title)}</h3>
            </div>
            <div class="report-card__meta">${escapeHtml(r.id)} · ${escapeHtml(r.category)} · ${escapeHtml(r.ward)} · ${formatDate(r.reportedAt)}</div>
          </div>
          <span class="badge ${statusClasses[r.status] || "badge-muted"}">${escapeHtml(r.status)}</span>
        </div>
        <p class="report-card__desc">${escapeHtml(r.description)}</p>
        <div class="report-card__meta">📍 ${escapeHtml(r.location)} · <b style="color:var(--text)">${escapeHtml(r.department)}</b> · SLA ${r.slaHours}h · priority ${escapeHtml(r.priority)}</div>
        ${r.images?.length ? `<div class="report-card__images">${r.images.slice(0, 3).map((src) => `<img src="${src}" alt="Report photo" />`).join("")}</div>` : ""}
        ${timeline(r)}
        <div class="report-card__actions">
          ${canManage && r.status !== "Resolved" ? `<button class="btn btn-sm btn-primary" data-advance="${r.id}">Advance status</button>` : ""}
          <a class="btn btn-sm" href="map.html">View on map</a>
          <button class="btn btn-sm" data-copy="${r.id}">Copy ID</button>
          ${canManage ? `<button class="btn btn-sm" data-delete="${r.id}" style="border-color:rgba(255,93,115,0.5);color:var(--danger)">Delete</button>` : ""}
        </div>
      </article>`).join("");
  }

  filtersEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-status]");
    if (!btn) return;
    activeStatus = btn.dataset.status;
    render();
  });
  searchEl.addEventListener("input", () => { query = searchEl.value; render(); });
  grid.addEventListener("click", (e) => {
    const adv = e.target.closest("[data-advance]");
    const del = e.target.closest("[data-delete]");
    const cp = e.target.closest("[data-copy]");
    if (adv) { advanceReport(adv.dataset.advance); showToast("Status updated.", "success"); render(); }
    if (del) { deleteReport(del.dataset.delete); showToast("Report removed from this device.", "info"); render(); }
    if (cp) { navigator.clipboard?.writeText(cp.dataset.copy); showToast(`Copied ${cp.dataset.copy}.`, "success"); }
  });

  render();
}
