# NIVARA — upload to GitHub

Two independent repositories, packaged as ready-to-push zips.

| Archive | Repository | Contents |
| --- | --- | --- |
| `nivara-frontend.zip` | `nivara-frontend` | Static HTML/CSS/ES-module frontend — 7 pages, canvas dashboard, Google Maps, API bridge |
| `nivara-backend.zip` | `nivara-backend` | Express + Mongoose API on MongoDB, seeder, static hosting for the frontend |

Both archives already contain a git repository with an initial commit, so you can push straight away.

## 1. Push the frontend

```bash
unzip nivara-frontend.zip
cd nivara-frontend
git remote add origin https://github.com/<you>/nivara-frontend.git
git push -u origin main
```

## 2. Push the backend

```bash
unzip nivara-backend.zip
cd nivara-backend
git remote add origin https://github.com/<you>/nivara-backend.git
git push -u origin main
```

Prefer to start from scratch? Delete `.git` inside each folder and follow the "Pushing to GitHub" section in that repository's README.

## 3. Run them together

Keep the two folders side by side:

```
nivara/
  nivara-frontend/
  nivara-backend/
```

```bash
cd nivara-backend
npm install
cp .env.example .env
npm run seed      # optional — loads the sample data
npm start         # http://localhost:5050
```

The backend finds the frontend folder next to it and serves both from one origin, so there is nothing to configure.

Running them apart works too — the frontend reaches the API at `apiBaseUrl` in `js/config.js` and the API allows cross-origin requests.

## Before you publish

- **Restrict the Google Maps key.** `js/config.js` ships with a browser key that is visible in the repository. In the Google Cloud console, restrict it to your own domains and to the Maps JavaScript API, or rotate it. See the "Security" section of the frontend README.
- **Never commit `.env`.** It is git-ignored in both repositories. `.env.example` is the committed template.
- **The demo has no password hashing** and the seeded users carry placeholder passwords. It is a demonstration backend — do not put real personal data in it and do not expose it to the public internet as-is.
