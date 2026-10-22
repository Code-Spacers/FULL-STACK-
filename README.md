#NIVARA — Frontend

Reimagining Tomorrow. Sustaining Today.
A dynamic single-page website for UN Sustainable Development Goal 11: Sustainable Cities and Communities. NIVARA presents an urban-innovation platform with an animated graphics background, a challenge explorer, a live-city demonstration dashboard, a civic reporting system, and an illustrative sustainability calculator.
The frontend is plain HTML5, CSS3 and native ES modules — no build step, no framework, no external JS dependencies. It runs as a static site on its own, and it also talks to the NIVARA API (nivara-backend) so reports persist in MongoDB.
Demonstration metrics, maps and reports are simulated. Nothing is connected to municipal sensors or government services.
Highlights
Animated graphics background — a fixed canvas rendering drifting gradient orbs, a twinkling star field, a glowing city skyline and a connected particle constellation. Falls back to a static frame when prefers-reduced-motion is set.
Scroll-driven motion — reveal-on-scroll sections, staggered card entrances, count-up statistics, a scroll progress bar and an animated loader.
Interactive sections — filterable urban challenges with detail modals, an SDG-aligned live-city dashboard with canvas charts and a district map, a sustainability calculator and a civic reporting system.
Accessible & responsive — keyboard-friendly modal, skip link, ARIA labelling, visible focus, and breakpoints for tablet and mobile.
Live city map — the issue map and report location picker are real, interactive Google Maps (official Maps JavaScript API, default roadmap), so they show Google's standard roads, labels, parks and water.
Works online or offline — with the API running, reports are kept in MongoDB; with the API down, the app keeps working from the browser's local storage and syncs later.
Quick start
This repository is self-contained. Clone it and serve the folder — no build, no install, no dependencies.
git clone <https://github.com/><you>/nivara-frontend.git
cd nivara-frontend
python3 -m http.server 8765
​
Open http://localhost:8765. The app detects that no API is running and keeps reports in the browser's local storage.
ES modules do not load from a file:// URL, so always use a local server (or double-click serve.command). Opening the .html files directly shows a blank/broken page.
Optional — add the backend for a real database
The NIVARA API ([nivara-backend](https://github.com/<you>/nivara-backend)) stores reports in MongoDB. Clone it next to this folder:
nivara/
  nivara-frontend/   ← this repo
  nivara-backend/    ← the API
​
cd nivara-backend
npm install
cp .env.example .env      # then edit MONGO_URI if you use MongoDB Atlas
npm run seed              # optional: import the sample data
npm start                 # serves the API *and* this frontend on <http://localhost:5050>
​
Open http://localhost:5050. The backend finds this folder automatically and serves the static files, so the frontend and the API share one origin — no CORS, no configuration.
Configuration
Everything lives in js/config.js:
Setting
Default
What it does
googleMapsApiKey
a project key
Authorises the Google Maps JavaScript API
googleMapsMapId
""
Optional map ID; Google's public sample ID is used when empty
apiBaseUrl
http://localhost:5050/api
Where the NIVARA API lives
apiBaseUrl must match the backend's PORT if you run one. If you change the backend's port, change it here too. You can also override it at runtime with window.NIVARA_API_URL, which takes priority over the config file.
The browser key also lives in js/config.local.js, which is git-ignored. js/config.local.example.js is the template. Note that js/config.js ships with a key committed to the repository, so that a fresh clone renders maps without extra setup.
How the API integration works
File
Role
js/api/backend.js
Resolves the API base URL, fetches JSON, strips MongoDB internals
js/api/reports-api.js
Promise-based CRUD for reports, with a local-storage fallback
js/store.js
The store every page uses. Hydrates from the API on load, then reconciles each local change back to it
The flow:
On load, js/store.js fetches GET /api/reports and merges the result into the browser copy. The server is the source of truth; records created while it was offline are kept so they can be pushed later.
Every local write is reconciled: new records are POSTed, changed ones are PATCHed, removed ones are DELETEd. Only ids the server is known to hold are ever deleted, so clearing the browser cache can never wipe the database.
If any call fails the app silently keeps the browser copy. The UI never breaks because the API is down.
Authentication is deliberately not wired to the API — sign-in records stay in the browser, so the demo has no password handling and no personal data in the database.
Project layout
nivara-frontend/
  index.html            landing page
  login.html            citizen / authority sign-in
  report.html           file a complaint, track a reference
  my-reports.html       the citizen's own reports
  map.html              live issue map
  console.html          authority operations console
  authority.html        authority sign-in
  css/
    style.css           design system + layout
    animations.css      keyframes + scroll reveals
    responsive.css      breakpoints
    auth.css            sign-in pages
    console.css         authority console
    pages.css           map, report and my-reports pages
    chatbot.css         the assistant
  js/
    main.js             boot, nav, challenges, reveals, counters
    background.js       animated canvas background
    city-simulation.js  live-city dashboard + charts + district map
    charts.js           canvas chart primitives
    store.js            the shared report store (local + API sync)
    auth.js             browser-local accounts and sessions
    ui.js               shared nav, toasts, helpers
    analytics.js        dashboard roll-ups
    chatbot.js          the on-page assistant
    map.js  maps.js  osm-map.js     map page, Google Maps loader, OpenStreetMap fallback
    report.js  my-reports.js  console.js  login.js
    config.js           single source of truth for settings
    api/
      api.js            mock-data loader + local-storage helpers
      backend.js        API base URL, fetch wrapper, payload sanitising
      reports-api.js    report CRUD against the API
      authority-api.js  authority screens against the API
      ai-api.js  map-api.js
  data/                 sample fixtures (also served live by the backend)
  assets/icons/         logo and favicon
  tests/                smoke pages and the chatbot test
  serve.command         double-clickable local server
​
Tests
node tests/chatbot.test.cjs      # chatbot response assertions
​
tests/smoke.html and tests/css-restore.html are manual pages — open them through a local server.
Notes
Maps are rendered by the official Google Maps JavaScript API (mapTypeId: "roadmap", Google's default styling, no custom theme). Address search and autocomplete additionally need the Geocoding and Places APIs; without them the map still renders and addresses are typed as text. OpenStreetMap is used only as an automatic fallback, never as the primary interface.
Live City Intelligence uses labelled demonstration data. Filters change the model; they do not read real AQI or energy meters.
Calculator results are order-of-magnitude estimates with assumptions printed on the page.
SDG framing follows published UN Goal 11 targets (11.1, 11.2, 11.3, 11.5, 11.6, 11.7, 11.b).
Security
The committed Google Maps browser key is visible in js/config.js. Before publishing this repository:
Restrict the key in the Google Cloud console to the exact domains that will serve the app (e.g. http://localhost:5050/*, https://your-domain.example/*) and to the Maps JavaScript API only.
Rotate the key if it has been shared or committed to a public repository.
Never commit .env files or real credentials. js/config.local.js is already git-ignored.
Pushing to GitHub
cd nivara-frontend
git init
git add .
git commit -m "NIVARA frontend: SDG 11 civic platform"
git remote add origin <https://github.com/><you>/nivara-frontend.git
git push -u origin main
​
js/config.local.js and .DS_Store are ignored by .gitignore and will not be committed.


# NIVARA — Backend

**Real-time MongoDB database and Express API for the NIVARA civic issue reporting platform.**

This is the server for the [NIVARA frontend](../nivara-frontend). It stores reports, issues, departments, users and community posts in MongoDB, exposes a REST API, and — when the frontend folder sits next to this one — serves the frontend's static files from the same origin.

## Stack

- Node.js + Express 4
- MongoDB via Mongoose 8
- CORS enabled, so the frontend can also be served from a different origin

## Quick start

```bash
cd nivara-backend
npm install
cp .env.example .env      # then edit MONGO_URI if you use MongoDB Atlas
npm run seed              # optional: import the sample data from data/
npm start                 # http://localhost:5050
```

Open <http://localhost:5050>. If a `nivara-frontend` (or `Nivara`) folder sits next to this one, the frontend is served too and the whole app runs from a single port.

### MongoDB

Any MongoDB works — a local `mongod`, Docker, or MongoDB Atlas. Put the connection string in `.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/nivara_db
```

For Atlas, use the SRV string from the cluster's connect dialog:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/nivara_db?retryWrites=true&w=majority
```

`.env` is git-ignored; `.env.example` is the committed template.

### Ports

The default is **5050**, not 5000 — on macOS the AirPlay Receiver usually holds port 5000 and the server would refuse to start. If you change `PORT` in `.env`, change `apiBaseUrl` in the frontend's `js/config.js` to match.

## Project layout

```text
nivara-backend/
  config/
    db.js                        MongoDB connection
  data/                          sample fixtures used by the seeder
    users.json  departments.json  issues.json  reports.json  community-reports.json
  models/
    options.js                   shared schema options (strict:false, no Mongo internals)
    User.js  Department.js  Issue.js  Report.js  CommunityReport.js
  routes/
    api.js                       REST API endpoints
  seed/
    seeder.js                    imports data/*.json into MongoDB
  frontend-integration/
    reports-api.js               legacy drop-in for older frontend copies
  server.js                      Express app, /data/*.json interceptor, static hosting
  .env.example                   environment template
  package.json
```

## API reference — `http://localhost:5050/api`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Server and MongoDB health |
| `GET` | `/api/reports` | All citizen reports |
| `POST` | `/api/reports` | Create a report (auto-synced to the authority issues and map) |
| `PATCH` | `/api/reports/:id` | Update status, priority or crew assignment |
| `DELETE` | `/api/reports/:id` | Delete a report and its issue record |
| `GET` | `/api/issues` | Authority issues and map coordinates |
| `POST` | `/api/issues` | Create an issue from the authority portal |
| `PATCH` | `/api/issues/:id` | Update an issue |
| `GET` | `/api/departments` | Municipal departments |
| `GET` | `/api/community-reports` | Community watch reports |
| `POST` | `/api/community-reports/:id/verify` | Upvote / verify a community report |
| `GET` | `/api/users` | All users |
| `POST` | `/api/users` | Create a user |
| `POST` | `/api/auth/login` | Authenticate by email and role |

Report ids look like `NVR-00123`. A `POST /api/reports` writes to both the `reports` and the `issues` collection, so a citizen submission shows up in the authority queue and on the live map immediately.

## How the frontend talks to it

The frontend already contains this integration — no copying is needed:

- `js/api/backend.js` resolves the API base URL (`apiBaseUrl` in `js/config.js`).
- `js/store.js` hydrates the report list from `GET /api/reports` on load, then reconciles every local change back to the API.

Two details worth knowing:

- `server.js` intercepts `GET /data/users.json`, `/data/departments.json`, `/data/issues.json`, `/data/reports.json` and `/data/community-reports.json` and answers them straight from MongoDB, so the frontend's fixture URLs return live data when it is served from here.
- Mongoose internals (`_id`, `__v`) are stripped from every response, and the frontend strips them again before sending anything back — a `PATCH` that included `_id` would be rejected by MongoDB as an immutable-field update.

`frontend-integration/reports-api.js` is kept only for older copies of the frontend that predate `js/api/backend.js`.

## Scripts

```bash
npm start          # run the server
npm run dev        # run with nodemon
npm run seed       # import data/*.json into MongoDB
npm run seed:destroy   # clear the seeded collections
```

## Security

- `.env` is git-ignored — never commit a real `MONGO_URI`; use `.env.example`.
- The seeded users carry placeholder passwords. This API has no password hashing, so it is a demonstration backend: do not put real personal data in it and do not expose it to the public internet as-is.
- The frontend's sign-in is browser-local and never sends credentials here.

## Pushing to GitHub

```bash
cd nivara-backend
git init
git add .
git commit -m "NIVARA backend: Express + MongoDB API"
git remote add origin https://github.com/<you>/nivara-backend.git
git push -u origin main
```

`.env`, `node_modules` and `.DS_Store` are ignored by `.gitignore` and will not be committed.
