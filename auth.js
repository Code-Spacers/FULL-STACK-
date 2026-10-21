// Demo-only account and session store for NIVARA.
// Everything stays in this browser with localStorage. This is NOT real
// authentication: passwords are only lightly encoded, no server is involved,
// and anything stored here is readable from DevTools. It exists so the
// citizen and authority portals have a believable sign-in flow.

const USERS_KEY = "nivara.users";
const SESSION_KEY = "nivara.session";
const SEED_FLAG = "nivara.authSeeded";

export const DEPARTMENTS = [
  "Mobility & Traffic",
  "Roads & Civil Works",
  "Sanitation",
  "Water & Drainage",
  "Electrical Quick Response",
  "Parks & Horticulture",
  "Accessibility Cell",
  "General Services",
];

/** Field-officer roster used by the resolution console for assignment. */
const OFFICERS_KEY = "nivara.officers";

export const DEMO_OFFICERS = [
  { employeeId: "NVR-OFF-3101", name: "S. Nair", designation: "Junior Engineer", department: "Roads & Civil Works" },
  { employeeId: "NVR-OFF-3102", name: "T. Bhattacharya", designation: "Site Supervisor", department: "Roads & Civil Works" },
  { employeeId: "NVR-OFF-3201", name: "L. Fernandes", designation: "Sanitary Inspector", department: "Sanitation" },
  { employeeId: "NVR-OFF-3301", name: "P. Iyengar", designation: "Lineman Crew Lead", department: "Water & Drainage" },
  { employeeId: "NVR-OFF-3401", name: "G. Reddy", designation: "Electrical Foreman", department: "Electrical Quick Response" },
  { employeeId: "NVR-OFF-3501", name: "H. Kaur", designation: "Horticulture Officer", department: "Parks & Horticulture" },
  { employeeId: "NVR-OFF-3601", name: "D. Pillai", designation: "Accessibility Officer", department: "Accessibility Cell" },
  { employeeId: "NVR-OFF-3701", name: "V. Sharma", designation: "Traffic Engineer", department: "Mobility & Traffic" },
  { employeeId: "NVR-OFF-3702", name: "A. Bose", designation: "Signal Technician", department: "Mobility & Traffic" },
  { employeeId: "NVR-OFF-3801", name: "M. Joshi", designation: "Ward Officer", department: "General Services" },
];

/** Seed the roster once. Safe to call on every boot. */
export function seedOfficers() {
  if (localStorage.getItem(OFFICERS_KEY)) return;
  writeList(OFFICERS_KEY, DEMO_OFFICERS);
}

export function listOfficers(department) {
  const roster = readList(OFFICERS_KEY);
  const source = roster.length ? roster : DEMO_OFFICERS;
  return department ? source.filter((o) => o.department === department) : source;
}

const encode = (pw) => btoa(unescape(encodeURIComponent(`nivara::${pw}`)));

const DEMO_CITIZENS = [
  { name: "Anya Rao", email: "anya.rao@nivara.demo", phone: "98450 11223", ward: "Ward 12", password: "city1234" },
  { name: "Arjun Mehta", email: "arjun@nivara.demo", phone: "98801 44520", ward: "Ward 7", password: "city1234" },
];

const DEMO_AUTHORITIES = [
  {
    name: "Meera Kulkarni",
    employeeId: "NVR-OFF-2291",
    email: "meera.kulkarni@nivara.gov",
    department: "Mobility & Traffic",
    designation: "Deputy Commissioner (Traffic)",
    password: "secure@123",
  },
  {
    name: "R. Das",
    employeeId: "NVR-OFF-1180",
    email: "r.das@nivara.gov",
    department: "Sanitation",
    designation: "Health Officer",
    password: "secure@123",
  },
];

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
  return list;
}

function prepare(user) {
  const { password, ...rest } = user;
  return { ...rest, passwordHash: encode(password || "") };
}

/** Seed the two demo roles once so the login page is never empty. */
export function seedAuth() {
  if (localStorage.getItem(SEED_FLAG)) return;
  const citizens = readList(`${USERS_KEY}.citizens`);
  const authorities = readList(`${USERS_KEY}.authorities`);
  DEMO_CITIZENS.forEach((u) => { if (!citizens.some((c) => c.email === u.email)) citizens.push(prepare(u)); });
  DEMO_AUTHORITIES.forEach((u) => { if (!authorities.some((a) => a.employeeId === u.employeeId)) authorities.push(prepare(u)); });
  writeList(`${USERS_KEY}.citizens`, citizens);
  writeList(`${USERS_KEY}.authorities`, authorities);
  localStorage.setItem(SEED_FLAG, "1");
}

function keyFor(role) {
  return `${USERS_KEY}.${role === "authority" ? "authorities" : "citizens"}`;
}

export function listUsers(role) {
  return readList(keyFor(role));
}

export function findUser(role, identifier) {
  const id = String(identifier || "").trim().toLowerCase();
  return listUsers(role).find((u) =>
    [u.email, u.employeeId, u.phone].filter(Boolean).some((v) => String(v).toLowerCase() === id)
  ) || null;
}

export function emailTaken(email) {
  return Boolean(findUser("citizen", email));
}

export function passwordMatches(user, password) {
  return Boolean(user) && user.passwordHash === encode(password || "");
}

export function registerCitizen({ name, email, phone, password, ward }) {
  const list = listUsers("citizen");
  const user = prepare({
    name,
    email,
    phone,
    ward: ward || "Ward pending",
    password,
    joinedAt: new Date().toISOString(),
  });
  list.push(user);
  writeList(keyFor("citizen"), list);
  return createSession("citizen", user);
}

export function createSession(role, user) {
  const session = {
    role: role === "authority" ? "authority" : "citizen",
    name: user.name || "NIVARA user",
    email: user.email || "",
    employeeId: user.employeeId || "",
    department: user.department || "",
    designation: user.designation || "",
    ward: user.ward || "",
    since: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("nivara:session-changed", { detail: session }));
  return session;
}

export function getSession() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY));
    return value && value.role ? value : null;
  } catch {
    return null;
  }
}

export function updateSession(patch) {
  const current = getSession();
  if (!current) return null;
  const next = { ...current, ...patch };
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("nivara:session-changed", { detail: next }));
  return next;
}

// Half-finished sign-in state owned by the person who just signed out:
// the pending authority record and the OTP challenge must not survive a
// sign-out, or the next person at the browser could resume them.
const TRANSIENT_AUTH_KEYS = ["nivara.pendingAuthority", "nivara.otpUser"];

export function endSession() {
  localStorage.removeItem(SESSION_KEY);
  TRANSIENT_AUTH_KEYS.forEach((key) => sessionStorage.removeItem(key));
  window.dispatchEvent(new CustomEvent("nivara:session-changed", { detail: null }));
}

export function displayName(session) {
  if (!session) return "";
  if (session.role === "authority" && session.employeeId) return session.name;
  return session.name;
}

export function roleLabel(role) {
  return role === "authority" ? "City authority" : "Citizen";
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "N";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
