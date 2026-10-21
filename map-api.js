import { delay, readLocalList } from "./api.js?v=20261020d";

const REPORTS_KEY = "nivara.reports";
const MAPS_SCRIPT_ID = "nivara-google-maps-api";
let mapsPromise;

export async function listMapIssues() {
  await delay(80);
  return readLocalList(REPORTS_KEY).map((report) => ({
    ...report,
    latitude: Number(report.latitude) || null,
    longitude: Number(report.longitude) || null,
  }));
}

export function loadGoogleMaps() {
  const key = window.NIVARA_CONFIG?.googleMapsApiKey?.trim() || document
    .querySelector('meta[name="google-maps-api-key"]')
    ?.content.trim();
  if (!key)
    return Promise.reject(
      new Error("Add a restricted Google Maps API key to the map page."),
    );
  if (window.google?.maps?.importLibrary)
    return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(MAPS_SCRIPT_ID);
    const finish = async () => {
      try {
        if (!window.google?.maps?.importLibrary)
          throw new Error(
            "Google Maps did not initialize. Check the API key and enabled APIs.",
          );
        resolve(window.google.maps);
      } catch (error) {
        reject(error);
      }
    };
    if (script) {
      script.addEventListener("load", finish, { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("Google Maps could not be loaded.")),
        { once: true },
      );
      return;
    }
    script = document.createElement("script");
    script.id = MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = finish;
    script.onerror = () =>
      reject(new Error("Google Maps could not be loaded."));
    document.head.append(script);
  });
  return mapsPromise;
}

export async function geocodeReportLocation(address) {
  const maps = await loadGoogleMaps();
  const { Geocoder } = await maps.importLibrary("geocoding");
  const response = await new Geocoder().geocode({ address, region: "IN" });
  const location = response.results?.[0]?.geometry?.location;
  if (!location) return null;
  return { latitude: location.lat(), longitude: location.lng() };
}
