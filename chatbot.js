// NIVARA guide chatbot — a self-contained, backend-free assistant that
// teaches visitors how to use this site. The knowledge base below is
// written from the real page sources; scoring is keyword + phrase
// matching with a confidence threshold and a helpful fallback.

(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && root.document && !root.document.getElementById("cbRoot")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => api.initWidget(api));
    } else {
      api.initWidget(api);
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const MIN_SCORE = 2;

  /* ---------------------------------------------------------
     KNOWLEDGE BASE
     Each intent: id, title, terms (phrase or word → weight),
     optional blockers (soft-penalised words), reply, chips.
     --------------------------------------------------------- */
  const KB = [
    {
      id: "greeting",
      title: "Greeting",
      terms: { hi: 4, hello: 4, hey: 4, greetings: 4, namaste: 4, howdy: 4, "good morning": 4, "good evening": 4 },
      reply:
        "Hello! I'm the **NIVARA Guide**. I can walk you through this site — reporting civic issues, tracking them, the live city dashboard, sign-in, and more.\n" +
        "What would you like to do?",
      chips: [
        { label: "How do I report an issue?", ask: "How do I report an issue?" },
        { label: "What is NIVARA?", ask: "What is NIVARA?" },
        { label: "Show me around", ask: "How do I navigate this site?" },
      ],
    },
    {
      id: "help",
      title: "What can you do",
      terms: {
        help: 4, "what can you do": 5, "what can i ask": 5, "guide me": 4, "show me around": 5,
        "how does this work": 4, "how to use this site": 5, "using this website": 4, "how do i use": 5,
        menu: 2, "what should i ask": 4, capabilities: 4, tutorial: 3,
      },
      reply:
        "I'm a built-in guide for NIVARA. I can explain:\n" +
        "• **Reporting** — file a civic issue and what each form field does\n" +
        "• **Tracking** — check a report's status with a reference like `NVR-1000`\n" +
        "• **Map & My reports** — browse community reports and your own submissions\n" +
        "• **Sign-in** — citizen and city-authority accounts, including demo logins\n" +
        "• **Home sections** — SDG 11 pillars, Challenges, Live City, Solutions, Calculator\n" +
        "• **Troubleshooting** — why a page or the map might not load\n" +
        "Ask me in your own words, e.g. \"how do I report a pothole\".",
      chips: [
        { label: "Report an issue", ask: "How do I report an issue?" },
        { label: "Track a report", ask: "How do I track my report?" },
        { label: "Sign-in help", ask: "How do I sign in?" },
      ],
    },
    {
      id: "assistant",
      title: "About the assistant",
      terms: {
        "who are you": 6, "what are you": 5, "are you a bot": 6, "are you human": 6, "are you ai": 6,
        "your name": 4, "chatbot": 3, "who am i talking": 6, "are you real": 5,
      },
      reply:
        "I'm the **NIVARA Guide** — a small assistant built into this page (version " + VERSION + ").\n" +
        "I answer questions about how the site works. Everything runs in your browser: no account, no server, no messages leave this device.",
      chips: [{ label: "What can you do?", ask: "What can you do?" }],
    },
    {
      id: "about",
      title: "What is NIVARA",
      terms: {
        "what is nivara": 6, "about nivara": 5, "what is this website": 6, "what is this site": 6,
        "what is this": 4, about: 3, purpose: 3, mission: 3, tagline: 3, "who made": 3,
        "academic project": 4, exhibition: 3, demo: 2, demonstration: 2, real: 2, fake: 2,
      },
      reply:
        "**NIVARA** is an academic exhibition platform for **UN Sustainable Development Goal 11 — Sustainable Cities & Communities**.\n" +
        "• Tagline: **Reimagining Tomorrow. Sustaining Today.**\n" +
        "• Sections: SDG 11 pillars, urban Challenges, a Live City dashboard, Solutions, a civic-reporting portal, and a sustainability Calculator.\n" +
        "• All metrics, maps, and reports are **demonstration data** — nothing is connected to municipal sensors or government services.",
      chips: [
        { label: "Explore SDG 11", to: "#explore" },
        { label: "Read About", to: "#about" },
      ],
    },
    {
      id: "sdg11",
      title: "SDG 11 & the six pillars",
      terms: {
        "sdg 11": 6, "goal 11": 6, "sustainable development goal": 5, "what is sdg": 6,
        "six pillars": 6, pillars: 4, pillar: 3, sdg: 3, targets: 2, "11.1": 4, "11.7": 4,
        housing: 2, "public space": 2, "disaster resilience": 3, "inclusive": 1,
      },
      reply:
        "**SDG 11** calls for inclusive, safe, resilient, and sustainable cities. NIVARA turns its targets into **six pillars** (section **SDG 11**):\n" +
        "• Adequate housing (11.1) · Public transport (11.2) · Inclusive public space (11.7)\n" +
        "• Lower environmental impact (11.6) · Disaster resilience (11.5, 11.b) · Sustainable planning (11.3)\n" +
        "The **Impact map** section lower down shows how site features align to those targets.",
      chips: [
        { label: "See the pillars", to: "#explore" },
        { label: "Impact map", to: "#impact" },
      ],
    },
    {
      id: "navigation",
      title: "Navigating the site",
      terms: {
        navigate: 3, navigation: 3, sections: 3, "nav bar": 4, "top bar": 4, "how do i get to": 5,
        "where is": 2, "how do i find": 4, "how do i go to": 5, menu: 2, links: 2, scroll: 2,
        "back to top": 3, footer: 2, browse: 1, explore: 1,
      },
      reply:
        "The top bar links to **Home · SDG 11 · Challenges · Live City · Map · My reports · About**, plus the **＋ Report an issue** button.\n" +
        "On the home page every item is a scroll anchor: `#home`, `#explore`, `#challenges`, `#live-city`, `#solutions`, `#report`, `#calculator`, `#impact`, `#about`.\n" +
        "The **↑** button (bottom-right) returns to the top, and the footer repeats the main links.",
      chips: [
        { label: "Go to Challenges", to: "#challenges" },
        { label: "Open the map", to: "map.html" },
      ],
    },
    {
      id: "report",
      title: "Reporting an issue",
      terms: {
        "report an issue": 5, "how do i report": 6, "how to report": 6, "where do i report": 6,
        "file an issue": 5, "file a complaint": 5, "log an issue": 5, complain: 3, complaint: 3,
        report: 2, reporting: 2, pothole: 2, streetlight: 2, "water leak": 2, "waste overflow": 2,
        "broken light": 3, "broken road": 3, submit: 2, raise: 1, issue: 1, civic: 1,
      },
      blockers: ["solar", "rooftop", "rainwater", "electric bus", "solution"],
      reply:
        "There are two ways to log an issue:\n" +
        "**1. Quick demo on this page** — scroll to **Log a city issue**, pick a category, describe it, add a location, submit. It's saved in this browser with an `NV-` reference and status Submitted.\n" +
        "**2. Full citizen portal** — press **＋ Report an issue** (sign-in required), then on `report.html`: add up to 4 photos, a short title, category, urgency, a mapped location (search, GPS, or drop a pin), and a description. You get an `NVR-` reference instantly.\n" +
        "Reports can be kept private or shared on the public issue map.",
      chips: [
        { label: "＋ Report an issue", to: "login.html?next=report.html&msg=report" },
        { label: "Quick demo form", to: "#report" },
      ],
    },
    {
      id: "track",
      title: "Tracking a report",
      terms: {
        "track my report": 6, "track a report": 6, "check status": 5, "status of my report": 6,
        "my report status": 6, "reference number": 6, "where is my report": 6, "check my report": 5,
        track: 3, tracking: 3, status: 2, reference: 3, nvr: 3, progress: 2, timeline: 2,
        "follow up": 2, update: 1,
      },
      reply:
        "Open **Track a report** on `report.html` and type your reference (format `NVR-1000` — try `NVR-1000` or `NVR-1003`).\n" +
        "You'll see the current status, a progress timeline, and every action taken by the authority.\n" +
        "Statuses move: **Reported → Acknowledged → In Progress → Resolved**.\n" +
        "Anyone can track with a reference — no sign-in needed. Your own submissions are also listed on **My reports** (sign-in required).",
      chips: [
        { label: "Track a report", to: "report.html" },
        { label: "My reports", to: "my-reports.html" },
      ],
    },
    {
      id: "my_reports",
      title: "My reports page",
      terms: {
        "my reports": 6, "my complaints": 6, "my submissions": 5, "reports i submitted": 5,
        "list of my reports": 5, "my report list": 5, "where are my reports": 5, history: 2,
      },
      reply:
        "**my-reports.html** shows every report you created — it's a **sign-in only** page, so NIVARA sends logged-out visitors to the sign-in card first (demo: `anya.rao@nivara.demo` / `city1234`).\n" +
        "Once signed in you can:\n" +
        "• Search by title, location, or reference number\n" +
        "• Filter by status (Reported, Acknowledged, In Progress, Resolved)\n" +
        "• Open any card for the full timeline of authority actions\n" +
        "Data lives in this browser's storage only.",
      chips: [
        { label: "Open My reports", to: "my-reports.html" },
        { label: "Track by reference", ask: "How do I track my report?" },
      ],
    },
    {
      id: "map",
      title: "The city issue map",
      terms: {
        "issue map": 6, "city map": 6, "open the map": 6, "live map": 5, "map view": 4,
        "neighborhood map": 5, "where are issues": 4, map: 3, maps: 3, markers: 3, plot: 1,
      },
      reply:
        "**map.html** plots every community report on the live city map:\n" +
        "• Search by location or issue type in the search box\n" +
        "• Use the category filter chips to narrow what's shown\n" +
        "• The side panel lists the same reports — click one to fly to its marker\n" +
        "It uses the Google Maps JavaScript API, so it needs a valid browser key (see Troubleshooting).",
      chips: [
        { label: "Open the city map", to: "map.html" },
        { label: "＋ Report an issue", to: "login.html?next=report.html&msg=report" },
      ],
    },
    {
      id: "login",
      title: "Citizen sign-in",
      terms: {
        "sign in": 3, "log in": 3, login: 3, signin: 3, "create account": 5, register: 3,
        signup: 3, "sign up": 3, password: 2, account: 1, email: 1, "forgot password": 4,
      },
      blockers: ["authority", "officer", "officers", "employee", "otp", "console", "department", "triage"],
      reply:
        "Go to **login.html** — the **＋ Report an issue** button takes you there.\n" +
        "• **Citizen** tab: sign in with email + password, or switch to **Create account**\n" +
        "• Password reset is shown for completeness — no mail is actually sent\n" +
        "• Deep links are supported: `login.html?next=report.html` returns you to the page you wanted after sign-in",
      chips: [
        { label: "Sign in", to: "login.html" },
        { label: "Demo account", ask: "Which demo account can I use?" },
      ],
    },
    {
      id: "demo",
      title: "Demo accounts",
      terms: {
        "demo account": 6, "demo login": 6, "sample account": 5, credentials: 5,
        "test account": 5, "example account": 5, "which account": 4, "demo citizen": 6,
        "demo officer": 6, "password for": 4, "city1234": 6, "secure@123": 6,
      },
      reply:
        "Demonstration credentials built into the site:\n" +
        "• **Citizen**: `anya.rao@nivara.demo` / `city1234` (Ward 12) or `arjun@nivara.demo` / `city1234` (Ward 7) — click the demo panel on the sign-in card to auto-fill\n" +
        "• **Authority**: employee ID `NVR-OFF-2291` (Mobility & Traffic) or `NVR-OFF-1180` (Sanitation), code `secure@123`, then any 6-digit OTP — except `000000`, which is rejected",
      chips: [
        { label: "Citizen sign in", to: "login.html" },
        { label: "Authority sign in", to: "authority.html" },
      ],
    },
    {
      id: "authority",
      title: "City authority & console",
      terms: {
        "authority sign in": 6, "officer login": 6, "how do officers": 5, authority: 2,
        authorities: 2, officer: 2, officers: 2, console: 3, triage: 3, otp: 3,
        "verification code": 4, department: 1, admin: 2, staff: 2, employee: 1,
      },
      reply:
        "For city officers:\n" +
        "1. Open **authority.html** (or `login.html?role=authority`) and switch the role toggle to **Authority**\n" +
        "2. Employee ID format `NVR-OFF-0000`, department, and the access code\n" +
        "3. Enter the 6-digit OTP — any 6 digits work except `000000`\n" +
        "4. You land in the **resolution console** (`console.html`): triage queue, department load, SLA analytics, assignments\n" +
        "Citizens sign in on login.html instead.",
      chips: [
        { label: "Authority sign in", to: "authority.html" },
        { label: "Open console", to: "console.html" },
      ],
    },
    {
      id: "live_city",
      title: "Live City dashboard",
      terms: {
        "live city": 6, "live city intelligence": 6, dashboard: 3, kpi: 3, "air quality": 3,
        district: 2, simulation: 2, charts: 2, "city status": 4, metrics: 1, canvas: 2,
      },
      reply:
        "The **Live City** section is a dashboard of demonstration data (not live sensors):\n" +
        "• Pick a **district** — Ridge District, Harbour Belt, or Meadow Arc\n" +
        "• Pick a **time of day** — Morning, Peak commute, or Night operations\n" +
        "• KPI tiles, two canvas charts (air index trend, energy vs mobility), and the district canvas all update together\n" +
        "Values refresh whenever you change a filter.",
      chips: [
        { label: "See the live city", to: "#live-city" },
        { label: "Is this real data?", ask: "Is the data real?" },
      ],
    },
    {
      id: "challenges",
      title: "Challenges section",
      terms: {
        challenges: 4, challenge: 3, "urban pressure": 4, "urban problems": 4,
        "filter the challenges": 5, "challenge cards": 5, "detail modal": 4,
      },
      reply:
        "**Challenges** lists the fractures a smart city must heal. How to use it:\n" +
        "1. Filter with the chips — All, Mobility, Safety, Environment, Access\n" +
        "2. Select a challenge card to open its detail modal\n" +
        "3. Press **See solutions** in the modal to jump to matching fixes",
      chips: [
        { label: "Browse challenges", to: "#challenges" },
        { label: "See solutions", to: "#solutions" },
      ],
    },
    {
      id: "solutions",
      title: "Solutions section",
      terms: {
        solutions: 3, solution: 3, solar: 2, rooftop: 3, rainwater: 3, "green roof": 4,
        "electric bus": 4, "smart traffic": 4, pedestrian: 2, "waste collection": 4,
        "streetlight": 3, technology: 2, "street lighting": 4,
      },
      blockers: ["broken", "not working", "fix my", "repair", "complain", "complaint", "report it", "report a", "submit"],
      reply:
        "**Solutions** pairs eight civic technologies with real urban problems — each card lists **Problem → Technology → Environment → Community**:\n" +
        "Solar streetlights · Intelligent waste collection · Smart traffic management · Rainwater harvesting · Electric public transport · Green rooftops · Pedestrian-friendly streets · Citizen-powered civic reporting.",
      chips: [
        { label: "See solutions", to: "#solutions" },
        { label: "Report a streetlight fault", ask: "How do I report an issue?" },
      ],
    },
    {
      id: "calculator",
      title: "Sustainability calculator",
      terms: {
        calculator: 4, calculate: 3, carbon: 3, co2: 3, emissions: 2, footprint: 3,
        estimate: 2, "how much": 2, "carbon footprint": 5, "weekly impact": 4,
      },
      reply:
        "The **Sustainability calculator** estimates a week of quieter impact:\n" +
        "1. Drag the slider — weekly public-transport trips (0–20; each trip replaces an 8 km car ride)\n" +
        "2. Tick the actions: LED lighting & device shutdown, waste segregation, shorter showers\n" +
        "3. Press **Estimate week** — results update with CO₂, energy, and water figures\n" +
        "Assumptions are printed under the form; these are illustrative estimates, not audits.",
      chips: [{ label: "Open the calculator", to: "#calculator" }],
    },
    {
      id: "privacy",
      title: "Where your data lives",
      terms: {
        privacy: 4, "my data": 4, "where is my data": 6, "stored locally": 5, localstorage: 6,
        "is this safe": 5, "who can see": 4, "delete my": 4, "sent to": 2, server: 2, gdpr: 4,
        "my reports stored": 6, "browser only": 5,
      },
      reply:
        "Your data stays on this device:\n" +
        "• Reports, sign-in records, and demo seeds live in this browser's **localStorage**\n" +
        "• With the Nivara API running, reports are also written to its **MongoDB** database\n" +
        "• No municipal system is connected — NIVARA is an academic demonstration\n" +
        "• Clearing your site data resets the browser copy\n" +
        "The public issue map shows the reports held for this browser.",
      chips: [{ label: "What is NIVARA?", ask: "What is NIVARA?" }],
    },
    {
      id: "troubleshoot",
      title: "Troubleshooting",
      terms: {
        "not working": 4, "does not load": 5, "won't load": 5, blank: 3, "map not loading": 6,
        "map is blank": 6, error: 2, "can't sign in": 5, "nothing happens": 4, refresh: 1,
        reload: 2, broken: 2, slow: 1, fix: 1,
      },
      reply:
        "Common fixes:\n" +
        "• **Blank or broken page** — serve over `http://localhost:8765` (run `serve.command` or `python3 -m http.server 8765`). Opening the files from `file://` breaks ES modules.\n" +
        "• **Map tiles blank** — the Google Maps key in `js/config.js` / `js/config.local.js` must be valid with the Maps JavaScript API enabled.\n" +
        "• **Sign-in or reports not saving** — browser storage may be blocked for this origin.\n" +
        "Still stuck? Reload the page — the demo always boots with seeded data.",
      chips: [
        { label: "Reload home", to: "index.html" },
        { label: "Demo account", ask: "Which demo account can I use?" },
      ],
    },
    {
      id: "accessibility",
      title: "Accessibility",
      terms: {
        accessible: 4, accessibility: 4, keyboard: 3, "dark mode": 4, theme: 2,
        "screen reader": 4, "reduced motion": 4, contrast: 3, "high contrast": 4,
      },
      reply:
        "NIVARA is built for an accessible dark experience:\n" +
        "• Skip-to-content link, visible focus rings, ARIA labels throughout\n" +
        "• Modals and this chat close with **Escape**; everything is keyboard-reachable\n" +
        "• `prefers-reduced-motion` disables the loader, reveals, and animations\n" +
        "The cinematic dark palette is the site's only theme.",
      chips: [{ label: "What else can I do?", ask: "What can you do?" }],
    },
    {
      id: "voice",
      title: "Voice input",
      terms: {
        "voice input": 6, "use the mic": 6, "use the microphone": 6, "voice assistant": 6,
        microphone: 4, mic: 3, voice: 3, speech: 3, dictation: 4, speak: 3,
        "talk to you": 4, "can i say": 3, talking: 2, dictate: 4,
      },
      reply:
        "Tap the **🎤 microphone** beside the text box and speak — when you stop, your words are **sent automatically** and I answer right away.\n" +
        "• Tap the mic again or press Escape to stop early; whatever you said is still sent\n" +
        "• Want to edit first? Start typing during the pause after speaking — auto-send cancels and you press **Send** yourself\n" +
        "• If the browser blocks the mic, allow microphone permission for this site — or just type\n" +
        "Voice uses your browser's Web Speech API; NIVARA stores nothing extra.",
      chips: [
        { label: "Ask a question instead", ask: "How do I report an issue?" },
      ],
    },
    {
      id: "thanks",
      title: "Thanks",
      terms: { thanks: 4, "thank you": 5, "thanks a lot": 5, appreciated: 4, "much obliged": 4 },
      reply: "You're welcome! Press **✕** anytime — the 💬 button brings me back. Happy exploring!",
      chips: [],
    },
    {
      id: "bye",
      title: "Goodbye",
      terms: { bye: 4, goodbye: 4, "see you": 4, "that is all": 4, "thats all": 4, "i'm done": 3 },
      reply: "Goodbye! The chat button stays in the corner if you need me again.",
      chips: [],
    },
  ];

  const FALLBACK = {
    id: "fallback",
    title: "Fallback",
    reply:
      "Hmm, I didn't quite catch that — I'm best at **how-to questions about this site**.\n" +
      "Try one of these, or rephrase:",
    chips: [
      { label: "How do I report an issue?", ask: "How do I report an issue?" },
      { label: "How do I track a report?", ask: "How do I track my report?" },
      { label: "Open the map", to: "map.html" },
      { label: "What can you do?", ask: "What can you do?" },
    ],
  };

  /* ---------------------------------------------------------
     INTENT ENGINE
     --------------------------------------------------------- */
  function normalizeWords(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalize(message) {
    return " " + normalizeWords(message) + " ";
  }

  function termMatches(hay, term) {
    const words = term.split(" ").filter(Boolean);
    if (!words.length) return false;
    if (words.length === 1) {
      return new RegExp("\\b" + words[0] + "(s|es|ed|ing)?\\b").test(hay);
    }
    return hay.includes(" " + words.join(" ") + " ");
  }

  function scoreIntent(entry, hay) {
    let score = 0;
    for (const rawTerm in entry.terms) {
      if (termMatches(hay, normalizeWords(rawTerm))) score += entry.terms[rawTerm];
    }
    if (entry.blockers) {
      for (const rawBlocker of entry.blockers) {
        if (termMatches(hay, normalizeWords(rawBlocker))) score = Math.round(score * 0.25 * 100) / 100;
      }
    }
    return score;
  }

  function matchIntent(message) {
    const hay = normalize(message);
    if (!hay.trim()) return { intent: FALLBACK, score: 0 };
    let best = null;
    for (const entry of KB) {
      const score = scoreIntent(entry, hay);
      if (!best || score > best.score) best = { intent: entry, score };
    }
    if (!best || best.score < MIN_SCORE) return { intent: FALLBACK, score: best ? best.score : 0 };
    return best;
  }

  function answer(message) {
    const { intent, score } = matchIntent(message);
    return { id: intent.id, reply: intent.reply, chips: intent.chips || [], score };
  }

  /* ---------------------------------------------------------
     RICH TEXT (escape first, then light markdown)
     --------------------------------------------------------- */
  function renderRich(text) {
    const esc = String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return esc
      .split(/\n{2,}/)
      .map((block) =>
        '<div class="cb-block">' +
          block
            .split("\n")
            .map((line) => {
              let html = line
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/`([^`]+)`/g, "<code>$1</code>");
              if (/^•\s/.test(html)) return `<div class="cb-line cb-bullet">${html.replace(/^•\s/, "")}</div>`;
              return `<div class="cb-line">${html}</div>`;
            })
            .join("") +
        "</div>"
      )
      .join('<div class="cb-gap"></div>');
  }

  // Tidies browser dictation for review: collapses whitespace and
  // capitalises the first letter. Never sends anything by itself.
  function normalizeTranscript(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return "";
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // Should a finished dictation be sent automatically? Only when there
  // is text, the panel is open, the bot is not busy, and the user has
  // not started editing the transcript by typing.
  function shouldAutoSend(state) {
    if (!state) return false;
    if (!state.panelOpen || state.pending || state.userEdited) return false;
    return String(state.transcript || "").trim().length > 0;
  }

  /* ---------------------------------------------------------
     WIDGET
     --------------------------------------------------------- */
  const ARROW_SVG =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHAT_SVG =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 0 1-8 8H4l2.2-2.6A8 8 0 1 1 20 12z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="12.5" cy="12" r="1" fill="currentColor"/><circle cx="16" cy="12" r="1" fill="currentColor"/></svg>';
  const BOT_SVG =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V10l8-6 8 6v10H4z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 20v-6h4v6" stroke="currentColor" stroke-width="1.7"/><circle cx="9.5" cy="11.5" r="1" fill="currentColor"/><circle cx="14.5" cy="11.5" r="1" fill="currentColor"/></svg>';
  const MIC_SVG =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const EXT_SVG =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17L17 7M17 7H9M17 7v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function prefersReduced() {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function isNarrow() {
    return typeof window !== "undefined" && window.innerWidth <= 560;
  }

  function initWidget(api) {
    const doc = document;
    const root = doc.createElement("div");
    root.className = "cb-root";
    root.id = "cbRoot";
    root.innerHTML = `
      <section class="cb-panel" id="cbPanel" role="dialog" aria-label="NIVARA guide chat" hidden>
        <header class="cb-head">
          <span class="cb-avatar">${BOT_SVG}</span>
          <span class="cb-head-text"><strong>NIVARA Guide</strong><small>Ask how to use this site</small></span>
          <button class="cb-iconbtn" id="cbClose" type="button" aria-label="Close chat">×</button>
        </header>
        <div class="cb-msgs" id="cbMsgs" role="log" aria-live="polite" aria-relevant="additions"></div>
        <form class="cb-composer" id="cbForm" autocomplete="off">
          <button class="cb-mic" id="cbMic" type="button" aria-label="Start voice input" aria-pressed="false" title="Speak your message">${MIC_SVG}</button>
          <input class="cb-input" id="cbInput" type="text" placeholder="Type your message..." aria-label="Type your message" maxlength="280" />
          <button class="cb-send" id="cbSend" type="submit" aria-label="Send message" disabled>${ARROW_SVG}</button>
        </form>
      </section>
      <button class="cb-launcher" id="cbLauncher" type="button" aria-label="Open the NIVARA guide chat" aria-expanded="false">
        ${CHAT_SVG}<span class="cb-dot" aria-hidden="true"></span>
      </button>`;
    doc.body.appendChild(root);

    const panel = root.querySelector("#cbPanel");
    const msgs = root.querySelector("#cbMsgs");
    const form = root.querySelector("#cbForm");
    const input = root.querySelector("#cbInput");
    const send = root.querySelector("#cbSend");
    const launcher = root.querySelector("#cbLauncher");
    const closeBtn = root.querySelector("#cbClose");
    const micBtn = root.querySelector("#cbMic");

    let greeted = false;
    let pending = false;
    const pendingTimers = [];

    /* -----------------------------------------------------
       VOICE INPUT — Web Speech API dictation into the input.
       The transcript appears in the text field while you
       speak and is sent automatically when you stop; start
       typing during the brief pause to review/edit instead,
       then press Send yourself.
       ----------------------------------------------------- */
    const SpeechAPI =
      typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    let recognition = null;
    let listening = false;
    let dictationBase = "";
    let dictationFinal = "";
    let dictationHeard = false;
    let dictationEdited = false;
    let dictationAborted = false;
    let autoSendTimer = null;

    function cancelAutoSend() {
      if (autoSendTimer) {
        clearTimeout(autoSendTimer);
        autoSendTimer = null;
      }
    }

    function scheduleAutoSend() {
      cancelAutoSend();
      autoSendTimer = setTimeout(() => {
        autoSendTimer = null;
        const text = input.value.trim();
        if (
          api.shouldAutoSend({ transcript: text, panelOpen: !panel.hidden, pending, userEdited: dictationEdited })
        ) {
          input.value = "";
          send.disabled = true;
          handleUserMessage(text);
        }
      }, 450);
    }

    function setMicIdle() {
      listening = false;
      micBtn.classList.remove("is-listening");
      micBtn.setAttribute("aria-pressed", "false");
      micBtn.setAttribute("aria-label", "Start voice input");
      input.placeholder = "Type your message...";
    }

    function setMicListening() {
      listening = true;
      micBtn.classList.add("is-listening");
      micBtn.setAttribute("aria-pressed", "true");
      micBtn.setAttribute("aria-label", "Stop voice input");
      input.placeholder = "Listening…";
    }

    function stopListening() {
      if (!listening) return;
      setMicIdle();
      if (recognition) {
        try { recognition.stop(); } catch (_) { /* already stopped */ }
      }
    }

    function startListening() {
      if (!SpeechAPI) {
        botSay(
          "Voice input isn't supported in this browser — the Web Speech API isn't available here. " +
            "Try Chrome, Edge, or Safari, or just type your message and press Send."
        );
        return;
      }
      if (!recognition) {
        recognition = new SpeechAPI();
        recognition.lang = navigator.language || "en-US";
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const chunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) dictationFinal += chunk + " ";
            else interim += chunk;
          }
          const spoken = (dictationBase ? dictationBase + " " : "") + dictationFinal + interim;
          input.value = api.normalizeTranscript(spoken);
          dictationHeard = input.value.trim().length > 0;
          send.disabled = pending || !input.value.trim();
        };
        recognition.onerror = (event) => {
          setMicIdle();
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            botSay(
              "Microphone access was blocked. Allow the microphone permission for this site " +
                "(check the 🎤 icon in the address bar), then tap the mic again — or just type your message."
            );
          } else if (event.error === "audio-capture") {
            botSay("No microphone was found on this device. Check your input device, or type your message instead.");
          }
          // "no-speech" and "aborted" end quietly — whatever is typed stays for review.
        };
        recognition.onend = () => {
          const heard = dictationHeard;
          const edited = dictationEdited;
          const aborted = dictationAborted;
          setMicIdle();
          dictationHeard = false;
          dictationAborted = false;
          if (heard && !edited && !aborted) scheduleAutoSend();
        };
      }
      dictationBase = input.value.trim();
      dictationFinal = "";
      dictationHeard = false;
      dictationEdited = false;
      dictationAborted = false;
      try {
        recognition.start();
        setMicListening();
      } catch (_) {
        setMicIdle();
      }
    }

    micBtn.addEventListener("click", () => (listening ? stopListening() : startListening()));

    function scrollDown() {
      msgs.scrollTop = msgs.scrollHeight;
    }

    function addRow(side, html) {
      const row = doc.createElement("div");
      row.className = "cb-row " + side;
      row.innerHTML = `<div class="cb-bubble">${html}</div>`;
      msgs.appendChild(row);
      scrollDown();
      return row;
    }

    function clearChips() {
      msgs.querySelectorAll(".cb-chips").forEach((el) => el.remove());
    }

    function addChips(chips) {
      if (!chips || !chips.length) return;
      const wrap = doc.createElement("div");
      wrap.className = "cb-chips";
      chips.forEach((chip) => {
        let el;
        if (chip.to) {
          el = doc.createElement("a");
          el.className = "cb-chip";
          el.href = chip.to;
          el.innerHTML = chip.label + EXT_SVG;
          el.addEventListener("click", (e) => {
            e.preventDefault();
            go(chip);
          });
        } else {
          el = doc.createElement("button");
          el.type = "button";
          el.className = "cb-chip";
          el.textContent = chip.label;
          el.addEventListener("click", () => go(chip));
        }
        wrap.appendChild(el);
      });
      msgs.appendChild(wrap);
      scrollDown();
    }

    function botSay(reply, chips) {
      addRow("bot", api.renderRich(reply));
      addChips(chips);
    }

    function showTyping() {
      const row = doc.createElement("div");
      row.className = "cb-row bot";
      row.id = "cbTyping";
      row.innerHTML = '<div class="cb-bubble"><span class="cb-typing" aria-label="Guide is typing"><i></i><i></i><i></i></span></div>';
      msgs.appendChild(row);
      scrollDown();
    }

    function hideTyping() {
      const el = msgs.querySelector("#cbTyping");
      if (el) el.remove();
    }

    function go(chip) {
      if (chip.ask) {
        handleUserMessage(chip.ask);
        return;
      }
      if (!chip.to) return;
      if (chip.to.startsWith("#")) {
        const el = doc.querySelector(chip.to);
        if (el) {
          el.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
          if (history.replaceState) history.replaceState(null, "", chip.to);
        } else {
          window.location.hash = chip.to;
        }
        if (isNarrow()) close();
      } else {
        window.location.href = chip.to;
      }
    }

    function handleUserMessage(text) {
      const message = String(text || "").trim();
      if (!message || pending) return;
      clearChips();
      addRow("user", api.renderRich(message));
      pending = true;
      send.disabled = true;
      showTyping();
      const res = api.answer(message);
      const delay = prefersReduced() ? 60 : Math.min(900, 260 + res.reply.length * 1.2);
      const timer = setTimeout(() => {
        pending = false;
        send.disabled = !input.value.trim();
        hideTyping();
        botSay(res.reply, res.chips);
        input.focus();
      }, delay);
      pendingTimers.push(timer);
    }

    function open() {
      panel.hidden = false;
      launcher.setAttribute("aria-expanded", "true");
      launcher.classList.add("is-open");
      input.focus();
      if (!greeted) {
        greeted = true;
        botSay(
          "Hi! I'm the **NIVARA Guide**. I can show you how to report an issue, track a report, use the map, sign in, and what each section of this page does.\n" +
            "What would you like to do?",
          [
            { label: "How do I report an issue?", ask: "How do I report an issue?" },
            { label: "Track a report", ask: "How do I track my report?" },
            { label: "Open the map", to: "map.html" },
            { label: "What is NIVARA?", ask: "What is NIVARA?" },
          ]
        );
      }
    }

    function close() {
      cancelAutoSend();
      stopListening();
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      launcher.classList.remove("is-open");
      launcher.focus();
    }

    launcher.addEventListener("click", () => (panel.hidden ? open() : close()));
    closeBtn.addEventListener("click", close);
    doc.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) {
        if (listening) { dictationAborted = true; stopListening(); return; }
        cancelAutoSend();
        close();
      }
    });

    input.addEventListener("input", () => {
      // Real typing means the user is reviewing/editing: cancel the
      // post-dictation auto-send so they can press Send themselves.
      dictationEdited = true;
      cancelAutoSend();
      send.disabled = !input.value.trim() || pending;
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      cancelAutoSend();
      stopListening();
      const value = input.value;
      input.value = "";
      send.disabled = true;
      handleUserMessage(value);
    });
  }

  return { VERSION, KB, FALLBACK, matchIntent, answer, renderRich, initWidget, normalize, normalizeTranscript, shouldAutoSend, termMatches };
});
