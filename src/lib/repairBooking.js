/**
 * repairBooking.js — the authenticated API calls behind the web repair-booking
 * flow (address → slot → review → confirm). Mirrors the mobile customer app's
 * contracts exactly (verified against the live services):
 *
 *   GET  {USER_BASE}/customer/addresses            Bearer  -> AddressResponse[]
 *   POST {USER_BASE}/customer/addresses            Bearer  -> AddressResponse
 *   GET  {SHOP_BASE}/shops/{id}/pickup-slots       public  -> PickupSlotResponse[]
 *   GET  {AUTH_BASE}/auth/shops/{id}/public        public  -> shop {name,address,phone,...}
 *   POST {ORDER_BASE}/repair-bookings              Bearer(CUSTOMER) -> { bookingNumber, id, status, ... }
 *
 * Every write carries the CUSTOMER Bearer token from customerAuth. All four
 * services allow browser CORS from any origin, so these run from the site — but
 * they are blocked as mixed content once the site is HTTPS against the HTTP
 * backend (documented caveat).
 */

import { AUTH_BASE, ORDER_BASE, SHOP_BASE, USER_BASE } from '@/lib/api';
import { readCustomer } from '@/lib/customerAuth';

function authHeaders() {
  const c = readCustomer();
  return c && c.token ? { Authorization: `Bearer ${c.token}` } : {};
}

const trim = (base) => String(base || '').replace(/\/$/, '');
const unwrap = (d) => (Array.isArray(d) ? d : (d && (d.content || d.data)) || []);

async function jsonOrThrow(res) {
  if (!res.ok) {
    let msg = '';
    try {
      const b = await res.json();
      msg = (b && (b.message || b.error)) || '';
    } catch {
      /* non-json */
    }
    const err = new Error(msg || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json().catch(() => null);
}

/* -------------------------------------------------------------------------- */
/* Addresses (user-service)                                                    */
/* -------------------------------------------------------------------------- */

export async function listAddresses() {
  const res = await fetch(`${trim(USER_BASE())}/customer/addresses`, {
    credentials: 'omit',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  return unwrap(await jsonOrThrow(res));
}

/**
 * @param {object} form  { label, fullName, mobile, addressLine, area, taluk,
 *                         district, state, pincode, latitude?, longitude?, isDefault? }
 * The app dual-writes the legacy mirrors (locality<-area, city<-district).
 */
export async function createAddress(form) {
  const body = {
    ...form,
    locality: form.area || form.locality || '',
    city: form.district || form.city || '',
  };
  const res = await fetch(`${trim(USER_BASE())}/customer/addresses`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res);
}

/** One-line address string, matching how the app joins it. */
export function formatAddress(a) {
  if (!a) return '';
  return [a.addressLine, a.locality || a.area, a.city || a.district, a.state, a.pincode]
    .filter(Boolean)
    .join(', ');
}

/* -------------------------------------------------------------------------- */
/* Pickup slots (shop-service, public)                                         */
/* -------------------------------------------------------------------------- */

export async function getPickupSlots(shopId) {
  const res = await fetch(`${trim(SHOP_BASE())}/shops/${encodeURIComponent(shopId)}/pickup-slots`, {
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  return unwrap(await jsonOrThrow(res));
}

/** Public shop detail (name / address / phone) for review + confirmation. */
export async function getShopPublic(shopId) {
  try {
    const res = await fetch(`${trim(AUTH_BASE())}/auth/shops/${encodeURIComponent(shopId)}/public`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Booking (order-service)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create a repair booking. Payload keys match RepairBookingRequest exactly.
 * @returns the RepairBookingResponse ({ bookingNumber, id, status, ... }).
 */
export async function createRepairBooking(payload) {
  const res = await fetch(`${trim(ORDER_BASE())}/repair-bookings`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

/* -------------------------------------------------------------------------- */
/* In-progress photo store                                                     */
/* -------------------------------------------------------------------------- */
/* The device photos are uploaded (to media.ggfix.in) back on the report step,
 * but the booking is submitted several steps later. The URL is the wrong place
 * for long hosted URLs, so they ride in sessionStorage keyed by the model — it
 * survives step navigation and clears when the tab closes. */

const photoKey = (modelId) => `ggfix_repair_photos_${modelId || 'x'}`;

export function savePhotos(modelId, photos) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(photoKey(modelId), JSON.stringify(photos || {}));
  } catch {
    /* private mode / quota */
  }
}

export function readPhotos(modelId) {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(photoKey(modelId)) || '{}') || {};
  } catch {
    return {};
  }
}
