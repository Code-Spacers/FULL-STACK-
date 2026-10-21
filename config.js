// Single source of truth for browser-side settings.
//
// Maps are rendered with the official Google Maps JavaScript API (roadmap,
// Google's default map type and standard visual style). Set the browser key
// below, or in the git-ignored js/config.local.js (loaded after this file,
// which may override any value here — see js/config.local.example.js).
//
// Loaded by map.html and report.html before their page module.
window.NIVARA_CONFIG = {
  googleMapsApiKey: "AIzaSyBZ60Xjn8M7auWamXbTyj9ekcsUOE3A7HY",
  // Optional: a map ID from your own Google Cloud project. Google's public
  // sample ID is used when this is empty; a map ID is required for advanced
  // markers to render.
  googleMapsMapId: "",
  // Base URL of the Nivara API (the Express + MongoDB backend).
  // This must match the backend's PORT (see its .env). The backend enables
  // CORS, so this works whether the frontend is served by the backend itself
  // or by any other static server.
  apiBaseUrl: "http://localhost:5050/api",
};
