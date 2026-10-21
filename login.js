// NIVARA login controller — drives both the citizen portal and the
// authority console from one template. Demo authentication only.

import { initBackground } from "./background.js?v=20261020d";
import { initPageChrome, showToast } from "./ui.js?v=20261020d";
import {
  seedAuth, findUser, passwordMatches, registerCitizen, emailTaken,
  createSession, DEPARTMENTS,
} from "./auth.js?v=20261020d";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMPLOYEE_RE = /^NVR-OFF-\d{3,5}$/i;

const REDIRECT = { citizen: "my-reports.html", authority: "console.html" };

// Deep-link support: ?next=page.html sends citizens there after sign-in,
// ?msg=report shows the "sign in to report" notice. Both are validated —
// only same-origin page names are honoured.
const params = new URLSearchParams(location.search);
const nextParam = params.get("next");
const SAFE_NEXT_RE = /^[a-z0-9][a-z0-9\-]*\.html$/i;
const safeNext = SAFE_NEXT_RE.test(nextParam || "") ? nextParam : null;

const COPY = {
  citizen: { title: "Welcome back", sub: "Sign in to report issues, track fixes, and follow your ward.", doc: "Sign in | NIVARA" },
  authority: { title: "City authority console", sub: "Officers only. Credentials are verified, then confirmed with a one-time code.", doc: "Authority sign in | NIVARA" },
};

seedAuth();
initBackground();
initPageChrome();

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const switchEl = $(".role-switch");
const panels = $(".auth-panels");
const departmentSelect = $("#authDepartment");

let role = document.body.dataset.authRole === "authority" ? "authority" : "citizen";
let citizenTab = "signin";
let otpTimer = null;

/* ---------------------------------------------------------------- panels */

function showPanel(name) {
  $$(".auth-panel").forEach((p) => p.classList.toggle("is-on", p.dataset.panel === name));
  $$(".auth-visual-pane").forEach((p) => p.classList.toggle("is-on", p.dataset.pane === (role === "authority" ? "authority" : "citizen")));
  const pane = $(`.auth-visual-pane[data-pane="${role}"]`);
  if (pane) animateCounts(pane);
}

function setRole(next, { focus = true } = {}) {
  role = next === "authority" ? "authority" : "citizen";
  switchEl.dataset.role = role;
  $$(".role-switch__btn", switchEl).forEach((btn) => {
    const on = btn.dataset.setRole === role;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-selected", String(on));
  });
  document.body.dataset.authRole = role;
  const copy = COPY[role];
  if ($("#authTitle")) $("#authTitle").textContent = copy.title;
  if ($("#authSub")) $("#authSub").textContent = copy.sub;
  document.title = copy.doc;
  clearErrors();
  showPanel(role === "authority" ? "authority-signin" : `citizen-${citizenTab}`);
  if (focus) {
    const first = $(`.auth-panel.is-on .auth-input, .auth-panel.is-on .auth-select`);
    first?.focus({ preventScroll: true });
  }
}

function setCitizenTab(tab) {
  citizenTab = tab === "signup" ? "signup" : "signin";
  $$(".auth-tab").forEach((t) => {
    const on = t.dataset.tab === citizenTab;
    t.classList.toggle("is-on", on);
    t.setAttribute("aria-selected", String(on));
  });
  clearErrors();
  showPanel(`citizen-${citizenTab}`);
}

/* ------------------------------------------------------------- validation */

function setError(field, message) {
  if (!field) return;
  field.classList.toggle("is-invalid", Boolean(message));
  field.classList.toggle("is-valid", !message && Boolean($("input, select", field)?.value));
  const box = $(".auth-error", field);
  if (box) box.textContent = message || "";
}

function clearErrors() {
  $$(".auth-field.is-invalid").forEach((f) => setError(f, ""));
  $$(".auth-error").forEach((e) => { e.textContent = ""; });
  $$(".otp-row").forEach((r) => r.classList.remove("is-error"));
}

function fieldOf(el) {
  return el.closest(".auth-field, .auth-select-wrap");
}

function value(id) {
  return ($(id)?.value || "").trim();
}

function validateEmail(input) {
  const field = fieldOf(input);
  const v = input.value.trim();
  if (!v) return setError(field, "Enter your email address."), false;
  if (!EMAIL_RE.test(v)) return setError(field, "That does not look like a valid email."), false;
  setError(field, "");
  return true;
}

function validatePassword(input, { min = 8 } = {}) {
  const field = fieldOf(input);
  const v = input.value;
  if (!v) return setError(field, "Enter your password."), false;
  if (v.length < min) return setError(field, `Use at least ${min} characters.`), false;
  setError(field, "");
  return true;
}

function validateText(input, label, min = 2) {
  const field = fieldOf(input);
  const v = input.value.trim();
  if (!v) return setError(field, `Enter your ${label}.`), false;
  if (v.length < min) return setError(field, `${label} looks too short.`), false;
  setError(field, "");
  return true;
}

function validatePhone(input) {
  const field = fieldOf(input);
  const v = input.value.trim();
  if (!v) return setError(field, "Add a mobile number for status updates."), false;
  if (v.replace(/\D/g, "").length < 10) return setError(field, "Enter a 10-digit mobile number."), false;
  setError(field, "");
  return true;
}

function validateEmployeeId(input) {
  const field = fieldOf(input);
  const v = input.value.trim();
  if (!v) return setError(field, "Enter your authority ID."), false;
  if (!EMPLOYEE_RE.test(v)) return setError(field, "Format: NVR-OFF-0000"), false;
  setError(field, "");
  return true;
}

function validateDepartment(select) {
  const field = fieldOf(select);
  if (!select.value) return setError(field, "Select your department."), false;
  setError(field, "");
  return true;
}

/* --------------------------------------------------------- live behaviours */

function bindLiveValidation() {
  $$("input.auth-input, select.auth-select").forEach((el) => {
    el.addEventListener("blur", () => {
      const id = el.id;
      if (!el.value.trim()) { setError(fieldOf(el), ""); return; }
      if (id === "signinEmail" || id === "signupEmail" || id === "resetEmail") validateEmail(el);
      else if (id === "signinPassword" || id === "signupPassword" || id === "signupConfirm" || id === "authCode") validatePassword(el, { min: id === "authCode" ? 6 : 8 });
      else if (id === "signupName") validateText(el, "full name");
      else if (id === "signupPhone") validatePhone(el);
      else if (id === "authEmployeeId") validateEmployeeId(el);
    });
    el.addEventListener("input", () => setError(fieldOf(el), ""));
  });
}

function bindPasswordToggles() {
  $$(".auth-eye").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.for);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.classList.toggle("is-shown", show);
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      input.focus();
    });
  });
}

function bindCapsLock() {
  $$("input[type='password'], input.auth-input").forEach((input) => {
    const caps = fieldOf(input)?.querySelector(".auth-caps");
    if (!caps) return;
    const check = (e) => caps.classList.toggle("is-on", e.getModifierState && e.getModifierState("CapsLock"));
    input.addEventListener("keydown", check);
    input.addEventListener("keyup", check);
    input.addEventListener("blur", () => caps.classList.remove("is-on"));
  });
}

function strengthOf(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH_TEXT = ["Too short", "Weak — add numbers or symbols", "Fair — mix in capitals", "Good password", "Strong password"];

function bindStrength() {
  const input = $("#signupPassword");
  const meter = $("#passwordStrength");
  if (!input || !meter) return;
  const label = $("small", meter);
  const update = () => {
    const pw = input.value;
    const level = pw ? strengthOf(pw) : 0;
    meter.dataset.level = String(level);
    meter.style.visibility = pw ? "visible" : "hidden";
    if (label) label.textContent = STRENGTH_TEXT[level];
  };
  input.addEventListener("input", update);
  update();
}

function bindDemoCredentials() {
  $$(".auth-demo").forEach((demo) => {
    $(".auth-demo__toggle", demo)?.addEventListener("click", () => demo.classList.toggle("is-open"));
    $$(".auth-demo__cred", demo).forEach((cred) => {
      cred.addEventListener("click", () => {
        const fill = JSON.parse(cred.dataset.fill || "{}");
        Object.entries(fill).forEach(([id, v]) => {
          const el = document.getElementById(id);
          if (!el) return;
          el.value = v;
          setError(fieldOf(el), "");
          if (el.type === "password") el.dispatchEvent(new Event("input"));
        });
        showToast("Demo credentials filled in. Select sign in to continue.", "info", "Ready");
      });
    });
  });
}

function animateCounts(root) {
  $$("[data-count]", root).forEach((el) => {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    const end = Number(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 1200);
      el.textContent = `${Math.round(end * (1 - Math.pow(1 - p, 3)))}${suffix}`;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ---------------------------------------------------------------- buttons */

function withLoading(button, task, { delay = 850 } = {}) {
  const label = button.innerHTML;
  button.classList.add("is-loading");
  button.setAttribute("aria-busy", "true");
  button.innerHTML = `<span class="spinner" aria-hidden="true"></span> Verifying…`;
  setTimeout(() => {
    button.classList.remove("is-loading");
    button.removeAttribute("aria-busy");
    button.innerHTML = label;
    task();
  }, delay);
}

function completeSignIn(session, message) {
  showToast(message, "success", `Welcome, ${session.name.split(" ")[0]}`);
  const target = session.role === "citizen" && safeNext ? safeNext : REDIRECT[session.role];
  setTimeout(() => { location.href = target; }, 700);
}

/* ------------------------------------------------------------- form flows */

function bindCitizenSignin() {
  const form = $("#citizenSigninForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#signinEmail");
    const pw = $("#signinPassword");
    const ok = validateEmail(email) & validatePassword(pw);
    if (!ok) { showToast("Check the highlighted fields.", "error"); return; }
    const button = $("button[type='submit']", form);
    withLoading(button, () => {
      const user = findUser("citizen", email.value.trim());
      if (!user || !passwordMatches(user, pw.value)) {
        setError(fieldOf(pw), "Email or password is not recognised.");
        showToast("Those credentials do not match a NIVARA citizen account.", "error", "Sign in failed");
        return;
      }
      completeSignIn(createSession("citizen", user), "Signed in to the citizen portal.");
    });
  });
}

function bindCitizenSignup() {
  const form = $("#citizenSignupForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#signupName");
    const email = $("#signupEmail");
    const phone = $("#signupPhone");
    const pw = $("#signupPassword");
    const confirm = $("#signupConfirm");
    const terms = $("#signupTerms");

    let ok = validateText(name, "full name");
    ok = validateEmail(email) && ok;
    ok = validatePhone(phone) && ok;
    ok = validatePassword(pw) && ok;

    const confirmField = fieldOf(confirm);
    if (!confirm.value) { setError(confirmField, "Re-enter your password."); ok = false; }
    else if (confirm.value !== pw.value) { setError(confirmField, "Passwords do not match."); ok = false; }
    else setError(confirmField, "");

    if (!ok) { showToast("Check the highlighted fields.", "error"); return; }
    if (!terms.checked) { showToast("Please accept the community guidelines to continue.", "warning"); return; }

    const emailField = fieldOf(email);
    if (emailTaken(email.value.trim())) {
      setError(emailField, "An account already exists for this email. Try signing in.");
      return;
    }

    const button = $("button[type='submit']", form);
    withLoading(button, () => {
      const session = registerCitizen({
        name: name.value.trim(),
        email: email.value.trim(),
        phone: phone.value.trim(),
        password: pw.value,
        ward: "Ward 12",
      });
      completeSignIn(session, "Account created. Your citizen portal is ready.");
    }, { delay: 1000 });
  });
}

function bindAuthoritySignin() {
  const form = $("#authorityForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const idInput = $("#authEmployeeId");
    const dept = $("#authDepartment");
    const code = $("#authCode");
    const device = $("#authDevice");

    let ok = validateEmployeeId(idInput);
    ok = validateDepartment(dept) && ok;
    ok = validatePassword(code, { min: 6 }) && ok;
    if (!ok) { showToast("Check the highlighted fields.", "error"); return; }

    const user = findUser("authority", idInput.value.trim());
    if (!user || !passwordMatches(user, code.value)) {
      setError(fieldOf(code), "ID or access code is not recognised.");
      showToast("Access denied. Check your authority ID and code.", "error", "Sign in failed");
      return;
    }
    if (user.department !== dept.value) {
      setError(fieldOf(dept), `This ID is registered to ${user.department}.`);
      return;
    }

    const button = $("button[type='submit']", form);
    withLoading(button, () => {
      sessionStorage.setItem("nivara.pendingAuthority", JSON.stringify({
        employeeId: idInput.value.trim(),
        trusted: device.checked,
      }));
      startOtp(user);
    }, { delay: 1100 });
  });
}

/* ------------------------------------------------------------------- OTP */

const otpInputs = $$(".otp-digit");

function startOtp(user) {
  sessionStorage.setItem("nivara.otpUser", user.employeeId);
  otpInputs.forEach((i) => { i.value = ""; i.classList.remove("is-filled"); });
  $(".otp-row")?.classList.remove("is-error");
  const echo = $("#otpEcho");
  if (echo) echo.textContent = `We sent a 6-digit code to the registered device for ${user.employeeId} (${user.department}).`;
  showPanel("authority-otp");
  setTimeout(() => otpInputs[0]?.focus(), 120);
  startResendTimer();
}

function otpValue() {
  return otpInputs.map((i) => i.value).join("");
}

function startResendTimer() {
  const btn = $("#resendOtp");
  if (!btn) return;
  clearInterval(otpTimer);
  let left = 30;
  btn.disabled = true;
  btn.textContent = `Resend code in ${left}s`;
  otpTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(otpTimer);
      btn.disabled = false;
      btn.textContent = "Resend code";
    } else {
      btn.textContent = `Resend code in ${left}s`;
    }
  }, 1000);
}

function bindOtp() {
  otpInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 1);
      input.classList.toggle("is-filled", Boolean(input.value));
      $(".otp-row")?.classList.remove("is-error");
      if (input.value && index < otpInputs.length - 1) otpInputs[index + 1].focus();
      if (otpValue().length === otpInputs.length) verifyOtp();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && index > 0) {
        otpInputs[index - 1].focus();
        otpInputs[index - 1].value = "";
        otpInputs[index - 1].classList.remove("is-filled");
      }
      if (e.key === "ArrowLeft" && index > 0) otpInputs[index - 1].focus();
      if (e.key === "ArrowRight" && index < otpInputs.length - 1) otpInputs[index + 1].focus();
    });
    input.addEventListener("paste", (e) => {
      const digits = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, otpInputs.length);
      if (!digits) return;
      e.preventDefault();
      digits.split("").forEach((d, i) => {
        if (!otpInputs[i]) return;
        otpInputs[i].value = d;
        otpInputs[i].classList.add("is-filled");
      });
      otpInputs[Math.min(digits.length, otpInputs.length - 1)].focus();
      if (otpValue().length === otpInputs.length) verifyOtp();
    });
  });

  $("#otpForm")?.addEventListener("submit", (e) => { e.preventDefault(); verifyOtp(); });
  $("#otpBack")?.addEventListener("click", () => { clearInterval(otpTimer); setRole("authority", { focus: false }); $("#authEmployeeId")?.focus(); });
  $("#resendOtp")?.addEventListener("click", () => {
    if ($("#resendOtp").disabled) return;
    startResendTimer();
    showToast("A new code was sent to the registered device.", "info", "Code resent");
  });
}

function verifyOtp() {
  const code = otpValue();
  if (code.length !== otpInputs.length) {
    showToast("Enter all six digits.", "warning");
    return;
  }
  if (code === "000000") {
    $(".otp-row")?.classList.add("is-error");
    showToast("That code was rejected. Try again or resend.", "error", "Invalid code");
    return;
  }
  const employeeId = sessionStorage.getItem("nivara.otpUser");
  const user = findUser("authority", employeeId);
  if (!user) {
    showToast("Session expired. Sign in again.", "error");
    setRole("authority");
    return;
  }
  clearInterval(otpTimer);
  completeSignIn(createSession("authority", user), "Identity verified. Opening the authority console.");
}

/* --------------------------------------------------------- forgot password */

function bindForgotPassword() {
  const modal = $("#resetModal");
  const open = $("#forgotPassword");
  const close = $("#resetClose");
  const form = $("#resetForm");
  if (!modal) return;

  const setOpen = (on) => {
    modal.classList.toggle("is-open", on);
    modal.hidden = !on;
    if (on) setTimeout(() => $("#resetEmail")?.focus(), 120);
  };

  open?.addEventListener("click", (e) => { e.preventDefault(); setOpen(true); });
  close?.addEventListener("click", () => setOpen(false));
  modal.addEventListener("click", (e) => { if (e.target === modal) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) setOpen(false); });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#resetEmail");
    if (!validateEmail(email)) return;
    withLoading($("button[type='submit']", form), () => {
      setOpen(false);
      form.reset();
      showToast(`If ${email.value.trim() || "that address"} exists, a reset link is on its way.`, "success", "Reset requested");
    }, { delay: 700 });
  });
}

/* ------------------------------------------------------------------- boot */

$$(".role-switch__btn").forEach((btn) => btn.addEventListener("click", () => setRole(btn.dataset.setRole)));
$$(".auth-tab").forEach((tab) => tab.addEventListener("click", () => setCitizenTab(tab.dataset.tab)));

if (departmentSelect && !departmentSelect.options.length) {
  departmentSelect.insertAdjacentHTML("beforeend", DEPARTMENTS.map((d) => `<option value="${d}">${d}</option>`).join(""));
}

bindLiveValidation();
bindPasswordToggles();
bindCapsLock();
bindStrength();
bindDemoCredentials();
bindCitizenSignin();
bindCitizenSignup();
bindAuthoritySignin();
bindOtp();
bindForgotPassword();
setRole(role, { focus: false });

// Honour ?role=authority deep links (used by authority.html).
if (params.get("role") === "authority") setRole("authority", { focus: false });

// Bottom-right popup on the sign-in page. Arriving from "Report an issue"
// (?msg=report) shows the reporting prompt; every other visit gets a welcome.
if (params.get("msg") === "report") {
  showToast("Please sign in to report an issue and track its resolution.", "info", "Sign in required");
} else {
  showToast("Sign in to report issues, track fixes, and follow your ward.", "info", "Welcome back");
}
