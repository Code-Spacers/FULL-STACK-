import { delay, loadMockData } from "./api.js?v=20261020d";
import { listReports, updateReport } from "./reports-api.js?v=20261020d";

const ISSUE_UPDATES_KEY = "nivara.authority.updates";
const CREATED_ISSUES_KEY = "nivara.authority.created-issues";
const PROFILE_KEY = "nivara.authority.profile";

const crews = [
  { id: "R1", name: "Asphalt Patch Team Alpha", department: "Roads & Civil Works", status: "On Site", assignment: "NVR-00123 · 9th Main", eta: "12 min", workload: 4, latitude: 12.9258, longitude: 77.5838 },
  { id: "R2", name: "Road Repair Unit Bravo", department: "Roads & Civil Works", status: "En Route", assignment: "NVR-00127 · 3rd Cross", eta: "18 min", workload: 3, latitude: 12.9211, longitude: 77.5781 },
  { id: "E2", name: "Electrical Quick Response", department: "Electrical Quick Response", status: "Available", assignment: "Standby · Central", eta: "Ready", workload: 1, latitude: 12.9754, longitude: 77.6068 },
  { id: "S4", name: "Sanitation Heavy Crew", department: "Sanitation", status: "Available", assignment: "Standby · Ward 153", eta: "Ready", workload: 2, latitude: 12.9291, longitude: 77.5812 },
  { id: "W2", name: "Water Line Response", department: "Water & Drainage", status: "En Route", assignment: "NVR-00128 · Market Road", eta: "8 min", workload: 3, latitude: 12.9342, longitude: 77.5937 },
  { id: "D3", name: "Drainage Team Delta", department: "Water & Drainage", status: "Available", assignment: "Standby · Jayanagar", eta: "Ready", workload: 1, latitude: 12.9062, longitude: 77.5668 },
];

const defaultCrewByCategory = {
  Pothole: "Asphalt Patch Team Alpha",
  "Road Damage": "Road Repair Unit Bravo",
  Sidewalk: "Asphalt Patch Team Alpha",
  Garbage: "Sanitation Heavy Crew",
  Streetlight: "Electrical Quick Response",
  Water: "Water Line Response",
  Drainage: "Drainage Team Delta",
};

function readUpdates() {
  try {
    return JSON.parse(localStorage.getItem(ISSUE_UPDATES_KEY) || "{}");
  } catch {
    return {};
  }
}

function readCreatedIssues() {
  try {
    const created = JSON.parse(localStorage.getItem(CREATED_ISSUES_KEY) || "[]");
    return Array.isArray(created) ? created : [];
  } catch {
    return [];
  }
}

function enrichIssue(issue) {
  const duplicateCount = issue.duplicateCount ?? (issue.priority === "Critical" ? 3 : issue.priority === "High" ? 2 : 1);
  const severity = Number(issue.severity) || 5;
  return {
    ...issue,
    duplicateCount,
    reportCount: issue.reportCount ?? duplicateCount + 1,
    priorityScore: issue.priorityScore ?? Math.min(99, Math.round(severity * 8 + duplicateCount * 3)),
    assignedCrew: issue.assignedCrew || defaultCrewByCategory[issue.category] || "Unassigned",
    recommendedDepartment: issue.recommendedDepartment || issue.department,
    recommendedAction: issue.recommendedAction || (issue.priority === "Critical" ? "Dispatch a field crew immediately" : "Inspect location and confirm scope"),
    confidence: Number(issue.confidence) || 90,
  };
}

export async function listAuthorityIssues() {
  await delay(140);
  const [issues, citizenReports] = await Promise.all([loadMockData("issues"), listReports()]);
  const updates = readUpdates();
  const authorityIssues = [...issues, ...readCreatedIssues()].map((issue) =>
    enrichIssue({ ...issue, ...(updates[issue.id] || {}) }),
  );
  const submittedReports = citizenReports.map((report) => {
    const authorityUpdate = updates[report.id] || {};
    return enrichIssue({
      ...report,
      ...authorityUpdate,
      id: report.id,
      title: report.title,
      status: report.status,
      category: report.category || "Other",
      priority: report.priority || "Medium",
      department: report.department || authorityUpdate.department || "Roads & Civil Works",
      reportedAt: report.reportedAt || new Date().toISOString(),
      description: report.description || "",
      location: report.location || "Location pending",
      ward: report.ward || "Ward pending",
      slaHours: report.slaHours ?? ({ Critical: 4, High: 12, Medium: 24, Low: 36 }[report.priority] || 24),
    });
  });
  const submittedIds = new Set(submittedReports.map((report) => report.id));
  return [...authorityIssues.filter((issue) => !submittedIds.has(issue.id)), ...submittedReports];
}

export async function createAuthorityIssue(issue) {
  await delay(160);
  const created = enrichIssue({
    ...issue,
    id: `NVR-${String(Date.now()).slice(-5)}`,
    status: "Reported",
    reportedAt: new Date().toISOString(),
    ward: issue.ward || "Ward 153",
    department: issue.department || "Roads & Civil Works",
    slaHours: issue.slaHours ?? 24,
    severity: issue.severity || (issue.priority === "Critical" ? 9.2 : issue.priority === "High" ? 7.6 : 5.1),
    confidence: issue.confidence || 92,
    latitude: Number(issue.latitude) || 12.9258,
    longitude: Number(issue.longitude) || 77.5838,
  });
  localStorage.setItem(CREATED_ISSUES_KEY, JSON.stringify([created, ...readCreatedIssues()]));
  window.dispatchEvent(new CustomEvent("nivara:authority-issue-created", { detail: created }));
  return created;
}

export async function listAuthorityDepartments() {
  await delay(80);
  return loadMockData("departments");
}

export async function listAuthorityCrews() {
  await delay(60);
  const updates = readUpdates();
  return crews.map((crew) => {
    const activeIssue = Object.entries(updates).find(([, update]) => update.assignedCrew === crew.name && update.status !== "Resolved");
    return activeIssue ? { ...crew, assignment: `${activeIssue[0]} · Active work`, status: "Dispatched" } : { ...crew };
  });
}

export async function updateAuthorityIssue(id, patch) {
  await delay(180);
  const updates = readUpdates();
  updates[id] = { ...(updates[id] || {}), ...patch };
  localStorage.setItem(ISSUE_UPDATES_KEY, JSON.stringify(updates));
  await updateReport(id, patch);
  window.dispatchEvent(new CustomEvent("nivara:authority-issue-updated", { detail: { id, patch } }));
  return updates[id];
}

export function getAuthorityProfile() {
  try {
    return {
      name: "Alex Mercer",
      department: "Roads & Infrastructure Department",
      role: "Municipal Operations Officer",
      email: "alex.mercer@nivara.gov.in",
      phone: "+91 80 5550 1530",
      ...JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}"),
    };
  } catch {
    return { name: "Alex Mercer", department: "Roads & Infrastructure Department", role: "Municipal Operations Officer", email: "alex.mercer@nivara.gov.in", phone: "+91 80 5550 1530" };
  }
}

export function saveAuthorityProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent("nivara:authority-profile-updated", { detail: profile }));
  return profile;
}
