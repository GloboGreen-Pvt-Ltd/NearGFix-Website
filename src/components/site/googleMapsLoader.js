/**
 * googleMapsLoader.js — lazy, single-load of the Google Maps JavaScript API.
 *
 * Nothing on this site touches Google Maps until a visitor actually opens the
 * location search or switches /nearby-shops to Map view — loading the script
 * eagerly would tax every page view for something most visitors never need.
 *
 * Plain module, no React Context — a cached Promise stands in for "load
 * state", the same shape this codebase already uses for shared client state
 * (see geo.js). Import-safe from a server component: no top-level
 * window/document access, every touch is inside loadGoogleMaps() itself.
 */

let loadPromise = null;

function isBrowser() {
  return typeof window !== 'undefined';
}

/**
 * Load the Maps JS API (with the Places library) exactly once, however many
 * components ask for it concurrently — each gets the same Promise.
 *
 * @returns {Promise<typeof google>} resolves with the `google` global.
 *   Rejects when the key is missing or the script fails to load; every
 *   caller in this codebase catches this and degrades (e.g. hides the map /
 *   search box) rather than crashing the page.
 */
export function loadGoogleMaps() {
  if (!isBrowser()) return Promise.reject(new Error('loadGoogleMaps: no window'));

  if (window.google && window.google.maps && window.google.maps.places) {
    return Promise.resolve(window.google);
  }
  if (loadPromise) return loadPromise;

  // Static literal reference required: Next.js only inlines NEXT_PUBLIC_* vars
  // referenced this way, not a dynamic lookup (see src/lib/api.js's own note).
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || !key.trim()) {
    return Promise.reject(new Error('loadGoogleMaps: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set'));
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('ggfix-google-maps');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Google Maps script failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'ggfix-google-maps';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      // Let a later call retry — a transient network failure shouldn't
      // permanently disable maps for the rest of the session.
      loadPromise = null;
      reject(new Error('Google Maps script failed to load'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
