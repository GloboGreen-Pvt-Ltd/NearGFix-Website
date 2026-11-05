/**
 * placeSearch.js — shop-name / address type-ahead for the Business Location
 * forms (BusinessLocationsManager, shops/new-owner, shop-dashboard
 * LocationFormModal).
 *
 * Primary source is Google Places API (New) over REST, called straight from
 * the browser with the same referrer-restricted NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * googleMapsLoader.js uses. Google actually lists small businesses ("Globo
 * Green, Cuddalore"), which OpenStreetMap mostly does not — OSM only matched
 * the words against street and school names.
 *
 * Two-step on purpose: `searchAddressSuggestions` returns lightweight
 * predictions (name + locality only), and `resolveSuggestion` fetches the full
 * address / pincode / coords / phone / hours only for the row the user picks.
 * A shared session token ties the two together so Google bills them as one
 * autocomplete session instead of per keystroke.
 *
 * Falls back to OSM Nominatim when the key is missing or Google errors, so the
 * form degrades to the old behaviour rather than to no suggestions at all.
 */

const PLACES_BASE = 'https://places.googleapis.com/v1';
const DETAIL_FIELDS = [
  'displayName',
  'formattedAddress',
  'addressComponents',
  'location',
  'nationalPhoneNumber',
  'regularOpeningHours.periods',
].join(',');

// Static literal reference required: Next.js only inlines NEXT_PUBLIC_* vars
// referenced this way.
function googleKey() {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim();
}

let sessionToken = null;
function getSessionToken() {
  if (!sessionToken) {
    sessionToken = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return sessionToken;
}

// ── Google Places (New) ───────────────────────────────────────────────────

async function googleAutocomplete(q, bias) {
  const body = {
    input: q,
    includedRegionCodes: ['in'],
    sessionToken: getSessionToken(),
  };
  if (bias && Number.isFinite(bias.latitude) && Number.isFinite(bias.longitude)) {
    body.locationBias = {
      circle: { center: { latitude: bias.latitude, longitude: bias.longitude }, radius: 50000 },
    };
  }
  const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': googleKey() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Places autocomplete ${res.status}`);
  const json = await res.json();
  return (json.suggestions || [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      source: 'google',
      placeId: p.placeId,
      displayName: p.structuredFormat?.mainText?.text || p.text?.text || '',
      secondary: p.structuredFormat?.secondaryText?.text || '',
      lat: null,
      lng: null,
    }));
}

function component(components, ...types) {
  for (const t of types) {
    const c = components.find((x) => (x.types || []).includes(t));
    if (c) return c.longText || c.shortText || '';
  }
  return '';
}

function fmtTime(t) {
  if (!t || !Number.isFinite(t.hour)) return '';
  const h = t.hour % 24;
  const m = String(t.minute || 0).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

// Only a real Indian mobile goes into the Mobile field — a landline like
// "080123 45280" would fail the form's mobile validation, so it's skipped.
function toMobile(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}

// Many small shops' Google addresses are owner-typed free text ("30/5, lalitha
// plaza, Imperial road,, Cuddalore, Tamil Nadu 607002, India") with no
// premise/route components, so the building/street part is only recoverable
// from formattedAddress: drop the locality / state / pincode / country tail.
function addressLineFromFormatted(formatted, known) {
  const drop = known.filter(Boolean).map((k) => k.toLowerCase());
  return String(formatted || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x && x.toLowerCase() !== 'india')
    .filter((x) => !drop.some((k) => x.toLowerCase() === k || x.toLowerCase().includes(k) && /\d{6}/.test(x)))
    .join(', ');
}

async function googleDetails(placeId) {
  const url = `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(getSessionToken())}`;
  const res = await fetch(url, {
    headers: { 'X-Goog-Api-Key': googleKey(), 'X-Goog-FieldMask': DETAIL_FIELDS },
  });
  // The session ends with a details call, used or not.
  sessionToken = null;
  if (!res.ok) throw new Error(`Place details ${res.status}`);
  const p = await res.json();
  const comps = p.addressComponents || [];
  const street = component(comps, 'route');
  const addressLine = [
    component(comps, 'subpremise'),
    component(comps, 'premise'),
    component(comps, 'street_number'),
  ].filter(Boolean).join(', ');
  const period = (p.regularOpeningHours?.periods || [])[0];
  const area = component(comps, 'sublocality_level_1', 'sublocality', 'neighborhood', 'locality');
  const district = component(comps, 'administrative_area_level_2', 'locality');
  const state = component(comps, 'administrative_area_level_1');
  const pincode = component(comps, 'postal_code');
  return {
    source: 'google',
    name: p.displayName?.text || '',
    displayName: p.displayName?.text || '',
    formattedAddress: p.formattedAddress || '',
    address: addressLine || addressLineFromFormatted(p.formattedAddress, [area, district, state, pincode]),
    street,
    area,
    taluk: component(comps, 'administrative_area_level_3'),
    district,
    state,
    pincode,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    mobile: toMobile(p.nationalPhoneNumber),
    openingTime: fmtTime(period?.open),
    closingTime: fmtTime(period?.close),
  };
}

// ── OSM Nominatim fallback (previous behaviour) ───────────────────────────

async function nominatimSearch(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=in&limit=6`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

function mapNominatimRows(rows) {
  return (rows || []).map((r) => ({
    source: 'osm',
    displayName: r.display_name,
    secondary: '',
    lat: Number(r.lat),
    lng: Number(r.lon),
    street: r.address?.road || r.address?.pedestrian || r.address?.path || '',
    area: r.address?.suburb || r.address?.neighbourhood || r.address?.village || r.address?.town || '',
    taluk: r.address?.county || r.address?.subdistrict || '',
    district: r.address?.state_district || r.address?.county || '',
    state: r.address?.state || '',
    pincode: r.address?.postcode || '',
  }));
}

async function osmSuggestions(q) {
  let rows = await nominatimSearch(q);
  if (rows.length === 0) {
    const tokens = q.split(/\s+/);
    if (tokens.length >= 2) {
      const tail = tokens.slice(-2).join(' ');
      if (tail !== q) rows = await nominatimSearch(tail);
    }
  }
  if (rows.length === 0) {
    const tokens = q.split(/\s+/);
    const last = tokens[tokens.length - 1];
    if (last.length >= 3 && last !== q) rows = await nominatimSearch(last);
  }
  return mapNominatimRows(rows);
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * @param {string} query what the user typed
 * @param {{latitude:number, longitude:number}} [bias] optional nearby point
 * @returns {Promise<Array>} rows with `source`, `displayName`, `secondary`,
 *   and (OSM only) address fields + lat/lng already filled in.
 */
export async function searchAddressSuggestions(query, bias) {
  const q = (query || '').trim();
  if (q.length < 3) return [];
  if (googleKey()) {
    try {
      const rows = await googleAutocomplete(q, bias);
      if (rows.length > 0) return rows;
    } catch (e) {
      console.warn('[placeSearch] Google Places failed, falling back to OSM:', e?.message);
    }
  }
  return osmSuggestions(q);
}

/**
 * Merge a resolved place into a location form object. Address fields only
 * fill ones that are still empty (the forms' Clear Address button resets
 * them); coords always take the picked place. A Google pick also supplies the
 * proper business name, and mobile / address line / hours when those are empty.
 */
export function applyPlaceToLocation(loc, full) {
  if (!full) return loc;
  const fill = (k) => loc[k] || full[k] || loc[k] || '';
  const next = {
    ...loc,
    street: fill('street'),
    area: fill('area'),
    taluk: fill('taluk'),
    district: fill('district'),
    state: fill('state'),
    pincode: fill('pincode'),
  };
  if (full.lat != null && full.lng != null) {
    next.latitude = String(full.lat);
    next.longitude = String(full.lng);
  }
  if (full.source === 'google') {
    if (full.name) next.name = full.name;
    next.address = fill('address');
    next.mobile = fill('mobile');
    next.openingTime = fill('openingTime');
    next.closingTime = fill('closingTime');
  }
  return next;
}

/**
 * Turn a picked row into full address fields. Google rows need a details
 * call; OSM rows are already complete. Resolves to null when details fail.
 */
export async function resolveSuggestion(sug) {
  if (!sug) return null;
  if (sug.source !== 'google') return sug;
  try {
    return await googleDetails(sug.placeId);
  } catch (e) {
    console.warn('[placeSearch] Place details failed:', e?.message);
    return null;
  }
}
