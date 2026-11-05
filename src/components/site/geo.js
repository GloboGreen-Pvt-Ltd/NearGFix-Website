/**
 * geo.js — the single source of truth for the visitor's chosen location.
 *
 * Two independent pieces of UI care about this value: the navbar
 * <LocationControl /> (which sets it) and the /nearby-shops page (which reads it
 * and calls /shops/nearby with it). They are never mounted in the same React
 * tree branch, so the coordinates live in localStorage and changes are broadcast
 * on a window CustomEvent rather than through context or props.
 *
 * Contract — do not change these without updating BOTH consumers:
 *   storage key   'ggfix_geo'  -> JSON { lat:number, lng:number, at:number, label?, ...place }
 *   event name    'ggfix:geo'  -> CustomEvent, detail = the entry, or null on clear
 *
 * The entry always has lat/lng/at; every other field is optional and additive
 * — placeId, pincode, area, city, district, state, country, formattedAddress,
 * source ('gps' | 'google_places' | 'pincode'). A GPS-only entry from before
 * this feature existed still normalizes fine with just lat/lng/at/label.
 *
 * This module is import-safe from a server component: it declares no 'use client'
 * directive, holds no React state, and every window/localStorage access is
 * guarded. Under `output: 'export'` the whole site prerenders in Node, where
 * `window` does not exist — an unguarded access here would fail the build, not
 * just the browser.
 */

import { AUTH_BASE } from '@/lib/api';

export const GEO_STORAGE_KEY = 'ggfix_geo';
export const GEO_EVENT = 'ggfix:geo';

/** True only in a real browser. Checked before every window/storage touch. */
function isBrowser() {
  return typeof window !== 'undefined';
}

/**
 * localStorage can throw on *access*, not just on read: Safari in private mode
 * and any browser with site-data blocked raise a SecurityError just for
 * touching `window.localStorage`. Everything below therefore treats storage as
 * best-effort — losing the saved location is a degraded experience, never a
 * crash, and the visitor can simply set it again.
 */
function safeStorage() {
  if (!isBrowser()) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Coerce an unknown value into a valid geo entry, or null.
 *
 * Anything can end up under this key — a stale entry from an older build, a
 * value another script wrote, or hand-edited junk from devtools — so the shape
 * is validated on the way in AND on the way out. Note `Number.isFinite` rather
 * than a plain type check: JSON.parse happily yields NaN-producing values, and
 * NaN coordinates would sail through `typeof x === 'number'` and then poison the
 * /shops/nearby query string as `lat=NaN`.
 */
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Accept BOTH our own {lat,lng} shape and the browser's GeolocationCoordinates,
  // which spells them `latitude`/`longitude`. Without the second pair, passing
  // `position.coords` straight in — exactly what the writeGeo docs invite, and
  // what LocationControl did — normalised to null, so every navbar "Set location"
  // press silently failed with "Couldn't get your location".
  const lat = Number(raw.lat !== undefined ? raw.lat : raw.latitude);
  const lng = Number(raw.lng !== undefined ? raw.lng : raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  const at = Number.isFinite(Number(raw.at)) ? Number(raw.at) : Date.now();

  // `label` is the reverse-geocoded place name ("Cuddalore"). Optional by
  // design: it is looked up from a third-party service that may be slow,
  // blocked or down, and a missing label must never invalidate usable
  // coordinates — the whole point of the entry is the /shops/nearby query.
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : '';

  // The rest of a structured place — all optional, all additive. Every field
  // is trimmed-string-or-undefined so a partial Google/backend result (a
  // point with no sublocality, no postal_code) never poisons the entry;
  // omitted keys just don't appear in the persisted JSON.
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const placeId = str(raw.placeId);
  const pincode = str(raw.pincode);
  const area = str(raw.area);
  const city = str(raw.city);
  const district = str(raw.district);
  const state = str(raw.state);
  const country = str(raw.country);
  const formattedAddress = str(raw.formattedAddress);
  const source = raw.source === 'gps' || raw.source === 'google_places' || raw.source === 'pincode'
    ? raw.source
    : undefined;

  return {
    lat,
    lng,
    at,
    label,
    ...(placeId && { placeId }),
    ...(pincode && { pincode }),
    ...(area && { area }),
    ...(city && { city }),
    ...(district && { district }),
    ...(state && { state }),
    ...(country && { country }),
    ...(formattedAddress && { formattedAddress }),
    ...(source && { source }),
  };
}

/* -------------------------------------------------------------------------- */
/* Reverse geocoding                                                           */
/* -------------------------------------------------------------------------- */
/**
 * BigDataCloud's free client-side endpoint. No API key, CORS `*`, and it 307s to
 * api-bdc.io — both hops send `access-control-allow-origin: *`, so a plain
 * browser fetch follows the redirect fine.
 *
 * PRIVACY: this sends the visitor's exact coordinates to a third party NearGFix has
 * no agreement with. That is a deliberate, approved trade to show a place name
 * instead of "Near you". It is disclosed in /privacy — if this call is ever
 * removed or swapped, update that page too.
 */
const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

/**
 * Turn coordinates into a human place name.
 *
 * @returns {Promise<string>} the place name, or '' on ANY failure. Never throws
 *   and never rejects — callers fall back to "Near you", which is always correct.
 *
 * Aborts after 6s: a hung lookup must not leave the navbar stuck on "Locating…"
 * when the coordinates themselves are already good enough to sort shops by.
 */
export async function lookupPlaceName(lat, lng) {
  const place = await lookupPlace(lat, lng);
  return place ? place.label : '';
}

/**
 * Same BigDataCloud lookup, but keeps the structured bits the chip needs —
 * {label, pincode?, city?, state?, country?} — or null on ANY failure.
 * `postcode` is used as the PIN code (6 digits only), never as the label.
 */
export async function lookupPlace(lat, lng) {
  if (!isBrowser() || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 6000) : null;

  try {
    const url = `${REVERSE_GEOCODE_URL}?latitude=${encodeURIComponent(
      lat,
    )}&longitude=${encodeURIComponent(lng)}&localityLanguage=en`;
    const res = await fetch(url, { signal: controller ? controller.signal : undefined });
    if (!res.ok) return null;
    const data = await res.json();

    // Prefer the most specific name that is actually populated. `postcode` is
    // kept separately as the PIN code; `plusCode` is never used.
    const name =
      (typeof data.city === 'string' && data.city.trim()) ||
      (typeof data.locality === 'string' && data.locality.trim()) ||
      (typeof data.principalSubdivision === 'string' && data.principalSubdivision.trim()) ||
      '';
    if (!name) return null;
    const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    // BigDataCloud leaves `postcode` empty for most of India — ask Nominatim
    // (already used for PIN lookups) for just the PIN in that case.
    let postcode = str(data.postcode);
    if (!postcode) {
      try {
        const osm = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
          { headers: { Accept: 'application/json' }, signal: controller ? controller.signal : undefined },
        );
        if (osm.ok) {
          const o = await osm.json();
          postcode = str(o && o.address && o.address.postcode && String(o.address.postcode).replace(/\s/g, ''));
        }
      } catch {
        /* PIN is optional — keep the place name */
      }
    }
    return {
      label: name,
      ...(postcode && /^\d{6}$/.test(postcode) && { pincode: postcode }),
      ...(str(data.city) && { city: str(data.city) }),
      ...(str(data.principalSubdivision) && { state: str(data.principalSubdivision) }),
      ...(str(data.countryName) && { country: str(data.countryName) }),
    };
  } catch {
    // Offline, CORS, abort, blocked by a tracker blocker, junk body — all the
    // same outcome. The coordinates still work; only the pretty name is lost.
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Reverse-geocode via NearGFix's own backend (Google Geocoding, server-side —
 * the API key never reaches the browser). This is the PRIMARY path; callers
 * fall back to lookupPlaceName() (BigDataCloud) only when this returns null,
 * so the location chip keeps working even if the key isn't configured yet or
 * the backend call fails for any reason.
 *
 * @returns {Promise<object|null>} a partial geo entry — {pincode, area, city,
 *   district, state, country, formattedAddress, placeId} — to spread into
 *   writeGeo() alongside {lat, lng, source}. Never throws; null on ANY
 *   failure (network, non-2xx, {success:false}, malformed body).
 *
 * AUTH_BASE() + call site both carry '/auth' — the edge nginx location
 * strips one prefix, and the Spring mapping expects the other, the same
 * doubling every other AUTH_BASE() call in this codebase already relies on
 * (see NearbyShops.js's getShopPublic).
 */
export async function reverseGeocodeBackend(lat, lng) {
  if (!isBrowser() || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;

  try {
    const base = String(AUTH_BASE() || '').replace(/\/$/, '');
    const res = await fetch(`${base}/auth/location/reverse-geocode`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
      signal: controller ? controller.signal : undefined,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.success !== true || !data.location || typeof data.location !== 'object') return null;

    const loc = data.location;
    return {
      placeId: loc.placeId,
      pincode: loc.pincode,
      area: loc.area,
      city: loc.city,
      district: loc.district,
      state: loc.state,
      country: loc.country,
      formattedAddress: loc.formattedAddress,
      // formattedAddress reads better as the chip label than a bare area name
      // when we have it; callers still prefer their own label if they build one.
      label: loc.area || loc.city || loc.formattedAddress,
    };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Nominatim (OpenStreetMap) — free, keyless, and already the geocoder this
 * codebase trusts for the same postcode -> coordinates need (see the address
 * search in BusinessLocationsManager.js). Used here for FORWARD geocoding
 * (a typed PIN code -> coordinates) so manual entry keeps working regardless
 * of the Google Maps key's API restrictions.
 */
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Forward-geocode a 6-digit Indian PIN code to coordinates + a "PIN - place"
 * label.
 *
 * @param {string} pincode
 * @returns {Promise<{lat:number, lng:number, label:string, pincode:string, source:'pincode'}|null>}
 *   null when the input isn't a 6-digit PIN or nothing matched it. Never throws.
 */
export async function geocodePincode(pincode) {
  if (!isBrowser()) return null;
  const pin = String(pincode || '').trim();
  if (!/^\d{6}$/.test(pin)) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 6000) : null;

  try {
    const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(
      pin,
    )}&format=json&addressdetails=1&countrycodes=in&limit=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
      signal: controller ? controller.signal : undefined,
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const addr = row.address || {};
    const name =
      addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || addr.state_district || '';
    const resolvedPincode = addr.postcode || pin;
    const label = resolvedPincode && name ? `${resolvedPincode} - ${name}` : name || resolvedPincode || '';
    return { lat, lng, label, pincode: resolvedPincode, source: 'pincode' };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Read the stored location.
 *
 * @returns {{lat:number, lng:number, at:number}|null} null when unset, when
 *   running on the server, or when the stored value is unusable.
 *
 * NEVER call this to seed useState during the first render of a client
 * component: the server renders "unset" and this would render "set", which is a
 * hydration mismatch. Seed with null and hydrate inside useEffect.
 */
export function readGeo() {
  const storage = safeStorage();
  if (!storage) return null;

  let rawText;
  try {
    rawText = storage.getItem(GEO_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!rawText) return null;

  try {
    return normalize(JSON.parse(rawText));
  } catch {
    // Corrupt JSON. Treat as unset and drop it so it cannot fail forever.
    try {
      storage.removeItem(GEO_STORAGE_KEY);
    } catch {
      /* nothing further we can do */
    }
    return null;
  }
}

/** Fire the broadcast. Wrapped because CustomEvent is browser-only. */
function emit(detail) {
  if (!isBrowser()) return;
  try {
    window.dispatchEvent(new CustomEvent(GEO_EVENT, { detail }));
  } catch {
    /* pre-CustomEvent-constructor browsers: storage still holds the truth */
  }
}

/**
 * Persist a location and notify every listener.
 *
 * @param {{lat:number, lng:number, at?:number}} coords Raw coordinates —
 *   a GeolocationCoordinates object works as-is.
 * @returns {{lat:number, lng:number, at:number}|null} the stored entry, or null
 *   if the input was not usable (in which case nothing is written or emitted).
 *
 * The event fires even when the write fails, so the UI still reflects the
 * visitor's action in this tab for as long as the page is open.
 */
export function writeGeo(coords) {
  // Hand the object to normalize as-is. The previous version re-projected it to
  // {lat, lng, at} first, which threw away `latitude`/`longitude` and made the
  // documented "a GeolocationCoordinates object works as-is" false. normalize()
  // reads either spelling and ignores any extra properties, so projecting here
  // bought nothing and silently broke the navbar's only write path.
  const entry = normalize(coords && typeof coords === 'object' ? coords : null);
  if (!entry) return null;

  const storage = safeStorage();
  if (storage) {
    try {
      storage.setItem(GEO_STORAGE_KEY, JSON.stringify(entry));
    } catch {
      /* quota / private mode — session-only location is still useful */
    }
  }

  emit(entry);
  return entry;
}

/** Forget the stored location and broadcast `null`. */
export function clearGeo() {
  const storage = safeStorage();
  if (storage) {
    try {
      storage.removeItem(GEO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  emit(null);
}

/**
 * Subscribe to location changes.
 *
 * @param {(entry: {lat:number, lng:number, at:number}|null) => void} cb
 * @returns {() => void} unsubscribe. Safe to call on the server, where it is a
 *   no-op — so a useEffect can `return subscribe(...)` unconditionally.
 *
 * Listens on two channels:
 *  - 'ggfix:geo'  — same-tab updates from writeGeo/clearGeo.
 *  - 'storage'    — other tabs. The browser fires this only in OTHER documents,
 *                   so it never double-fires alongside the CustomEvent above.
 *                   Without it, setting a location in one tab would leave a
 *                   second open tab showing a stale "Set location" button.
 *
 * The storage branch re-reads through readGeo() rather than trusting
 * event.newValue, which re-runs validation on a payload this tab did not write.
 */
export function subscribe(cb) {
  if (!isBrowser() || typeof cb !== 'function') return () => {};

  const onCustom = (event) => {
    cb(normalize(event && event.detail));
  };

  const onStorage = (event) => {
    // key === null means the whole store was cleared (storage.clear()).
    if (event && event.key !== null && event.key !== GEO_STORAGE_KEY) return;
    cb(readGeo());
  };

  window.addEventListener(GEO_EVENT, onCustom);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(GEO_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Format coordinates for display.
 *
 * The fallback for when reverse geocoding gave us nothing. When `entry.label` is
 * present, show that instead — this is the degraded path, and callers render it
 * as a small muted detail that reads as coordinates, never as an address.
 *
 * 4 decimal places ~= 11 m, which is precise enough to be recognisable and
 * coarse enough not to advertise a doorstep.
 */
export function formatGeo(entry, digits = 4) {
  const value = normalize(entry);
  if (!value) return '';
  return `${value.lat.toFixed(digits)}, ${value.lng.toFixed(digits)}`;
}
