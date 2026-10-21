// Shared UI helpers used across every page: navigation, toasts, reveals,
// counters, clock, and small formatting utilities.

import {
  getSession, endSession, displayName, initials, roleLabel,
} from "./auth.js?v=20261020d";

const NAV_LINKS = [
  ["Home", "index.html", "home"],
  ["Map", "map.html", "map"],
  ["Report", "report.html", "report"],
  ["My reports", "my-reports.html", "my-reports"],
];

/** Where Sign Out always lands: the Home route of this site. */
export const HOME_URL = "index.html#home";
/** The existing Sign In page, used for every auth redirect. */
export const LOGIN_URL = "login.html";
/** Signed-in only pages: visitors without a session are sent to Sign In. */
const PROTECTED_LINKS = ["my-reports.html"];

const FLASH_KEY = "nivara.flash";

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function mountNav(active) {
  const host = document.querySelector("[data-site-nav]");
  if (!host) return;
  const page = active || document.body.dataset.page || "";
  const links = () =>
    NAV_LINKS.map(
      ([label, href, key]) =>
        `<a class="nav-link${page === key ? " is-active" : ""}" href="${href}"${page === key ? ' aria-current="page"' : ""}>${label}</a>`
    ).join("");
  host.outerHTML = `
    <header class="nav" id="nav">
      <div class="nav-inner">
        <a class="logo" href="index.html">
          <img src="assets/icons/logo.svg" alt="" width="32" height="32" /> NIVARA
        </a>
        <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="navLinks" aria-label="Open menu"><span></span></button>
        <ul class="nav-links" id="navLinks">
          <li><a href="index.html"${page === "home" ? ' class="is-active"' : ""}>Home</a></li>
          <li><a href="index.html#explore"${page === "explore" ? ' class="is-active"' : ""}>SDG 11</a></li>
          <li><a href="map.html"${page === "map" ? ' class="is-active"' : ""}>Map</a></li>
          <li><a href="my-reports.html"${page === "my-reports" ? ' class="is-active"' : ""}>My reports</a></li>
          <li><a href="index.html#about">About</a></li>
          <li class="nav-mobile-auth" data-mobile-auth></li>
          <li class="nav-mobile-cta"><a class="btn btn-primary" href="login.html?next=report.html&amp;msg=report">＋ Report an issue</a></li>
        </ul>
        <div data-account-slot></div>
        <a class="btn btn-primary nav-cta" href="login.html?next=report.html&amp;msg=report">＋ Report an issue</a>
      </div>
    </header>`;
  mountAccountControls();
  initNav();
}

/* ---------- account chip (sign in / sign out) ---------- */

export function accountControlsHtml() {
  const session = getSession();
  if (!session) {
    return `<a class="btn btn-ghost nav-signin" href="login.html">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c.9-3.6 3.6-5.4 7-5.4s6.1 1.8 7 5.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      Sign in</a>`;
  }
  const label = session.role === "authority" ? session.employeeId || session.name : session.name;
  return `<div class="nav-account" data-nav-account>
      <button class="nav-account__btn" type="button" aria-expanded="false" aria-haspopup="true">
        <span class="nav-avatar">${escapeHtml(initials(session.name))}</span>
        <span class="nav-account__name">${escapeHtml(displayName({ ...session, name: label }))}</span>
      </button>
      <div class="nav-account__menu">
        <small>Signed in · ${escapeHtml(roleLabel(session.role))}</small>
        ${session.role === "authority"
          ? `<a href="console.html">Resolution console</a><a href="map.html">City map</a><a href="index.html#live-city">Live city</a>`
          : `<a href="my-reports.html">My reports</a><a href="map.html">City map</a>`}
        <a href="login.html?next=report.html&amp;msg=report">Report an issue</a>
        <button type="button" data-sign-out>Sign out</button>
      </div>
    </div>`;
}

let accountBound = false;

/**
 * Re-render the signed-in chip / Sign in button (and the mobile auth item)
 * from the current session. Called on mount and on every session change, so
 * the bar flips to the logged-out state the moment Sign Out is pressed.
 */
function renderAccountControls() {
  document
    .querySelectorAll("[data-account-slot], [data-nav-account], .nav-signin")
    .forEach((el) => { el.outerHTML = accountControlsHtml(); });
  const session = getSession();
  document.querySelectorAll("[data-mobile-auth]").forEach((el) => {
    el.innerHTML = session
      ? `<button type="button" data-sign-out>Sign out · ${escapeHtml(session.name)}</button>`
      : `<a href="login.html">Sign in</a>`;
  });
}

/**
 * Sign Out: drop the session (and the other auth state) right away, flip the
 * navigation to the logged-out state in place, then leave whatever page the
 * user was on — protected pages such as My Reports never keep a signed-out
 * visitor. The confirmation toast is queued for the Home page instead of
 * delaying the redirect; if we are already on Home the page does not reload,
 * so the toast is shown straight away.
 */
function signOut() {
  endSession();
  const message = "You have been signed out of NIVARA.";
  const target = new URL(HOME_URL, location.href);
  // A relative replace that only changes the fragment does not reload the
  // document, so a queued flash would never be consumed — show it here.
  const sameDocument = target.pathname === location.pathname && target.search === location.search;
  if (sameDocument) {
    location.replace(target.href);
    showToast(message, "info", "Signed out");
    return;
  }
  setFlash(message, "info", "Signed out");
  location.replace(target.href);
}

export function mountAccountControls() {
  renderAccountControls();
  if (accountBound) return;
  accountBound = true;

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-account__btn");
    document.querySelectorAll(".nav-account.is-open").forEach((acc) => {
      if (btn && acc === btn.closest(".nav-account")) return;
      acc.classList.remove("is-open");
      acc.querySelector(".nav-account__btn")?.setAttribute("aria-expanded", "false");
    });
    if (btn) {
      const acc = btn.closest(".nav-account");
      const open = acc.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    }
    if (e.target.closest("[data-sign-out]")) {
      signOut();
      return;
    }
    // Signed-in-only links (My reports) go straight to Sign In when logged out.
    const guarded = e.target.closest("a[href]");
    const href = guarded?.getAttribute("href");
    if (href && PROTECTED_LINKS.includes(href) && !getSession()) {
      e.preventDefault();
      location.replace(LOGIN_URL);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".nav-account.is-open").forEach((acc) => {
      acc.classList.remove("is-open");
      acc.querySelector(".nav-account__btn")?.setAttribute("aria-expanded", "false");
    });
  });

  window.addEventListener("nivara:session-changed", renderAccountControls);
}

export function initNav() {
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  const toTop = document.getElementById("toTop");
  const progress = document.getElementById("scrollProgress");
  if (!nav) return;

  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  links?.addEventListener("click", (e) => { if (e.target.closest("a")) nav.classList.remove("is-open"); });

  const anchorLinks = [...document.querySelectorAll("main section[id]")];
  const navAnchors = [...document.querySelectorAll(".nav-links a[href^='#']")];

  const onScroll = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 24);
    if (toTop) toTop.classList.toggle("is-on", window.scrollY > 600);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
    }
    const y = window.scrollY + 140;
    let current = anchorLinks[0]?.id;
    anchorLinks.forEach((s) => { if (s.offsetTop <= y) current = s.id; });
    navAnchors.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href")?.slice(1) === current));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

export function initReveals(root = document) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nodes = root.querySelectorAll(".reveal, [data-reveal]");
  if (reduced) { nodes.forEach((n) => n.classList.add("is-in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  nodes.forEach((n) => io.observe(n));
}

export function initCounters(root = document) {
  const els = root.querySelectorAll("[data-count]");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const end = Number(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / 1300);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = `${Math.round(end * eased)}${suffix}`;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      io.unobserve(el);
    });
  }, { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
}

export function initClock() {
  const el = document.getElementById("cityClock");
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
  tick();
  setInterval(tick, 1000);
}

export function initToTop() {
  const toTop = document.getElementById("toTop");
  toTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

export function showToast(message, type = "info", title = "") {
  let stack = document.querySelector("[data-toast-stack]");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("data-toast-stack", "");
    stack.setAttribute("aria-live", "polite");
    document.body.append(stack);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<div class="toast__body">${title ? `<strong>${escapeHtml(title)}</strong>` : ""}<span>${escapeHtml(message)}</span></div>`;
  stack.append(toast);
  requestAnimationFrame(() => toast.classList.add("is-in"));
  setTimeout(() => {
    toast.classList.remove("is-in");
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

export function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

/* ------------- cross-page toast (used by Sign Out redirect) ------------- */

function setFlash(message, type = "info", title = "") {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type, title }));
  } catch { /* storage disabled — the toast is optional */ }
}

// Shown once on the next page load, so Sign Out can redirect immediately
// without the confirmation disappearing mid-navigation.
function consumeFlash() {
  let flash = null;
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return;
    sessionStorage.removeItem(FLASH_KEY);
    flash = JSON.parse(raw);
  } catch { return; }
  if (flash?.message) showToast(flash.message, flash.type || "info", flash.title || "");
}

consumeFlash();

export function initPageChrome() {
  document.getElementById("year") && (document.getElementById("year").textContent = new Date().getFullYear());
  initClock();
  initToTop();
}
