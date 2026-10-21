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
