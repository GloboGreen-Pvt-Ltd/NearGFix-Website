/**
 * customerAccount.js — the authenticated API surface behind the web "My Account"
 * area (Orders · Cart · Devices · Addresses). It mirrors the mobile customer
 * app's own account screens exactly, against the same live microservices:
 *
 *   Orders     GET    {ORDER}/customer-orders?orderType=&status=   Bearer(CUSTOMER)
 *   Cart       GET    {MARKETPLACE}/customer/cart                  Bearer
 *              PUT    {MARKETPLACE}/customer/cart/{itemId}         Bearer
 *              DELETE {MARKETPLACE}/customer/cart/{itemId}         Bearer
 *              DELETE {MARKETPLACE}/customer/cart                  Bearer
 *              POST   {ORDER}/customer-orders/buy                  Bearer  (checkout)
 *   Devices    GET/POST {USER}/customer/devices                   Bearer
 *              PUT    {USER}/customer/devices/{id}                 Bearer
 *              DELETE {USER}/customer/devices/{id}                 Bearer
 *              POST   {USER}/customer/devices/{id}/default         Bearer
 *   Addresses  GET/POST {USER}/customer/addresses                 Bearer
 *              PUT/DELETE {USER}/customer/addresses/{id}          Bearer
 *              POST   {USER}/customer/addresses/{id}/default       Bearer
 *
 * Every request carries the CUSTOMER Bearer from customerAuth. All services allow
 * browser CORS from any origin, so these run from the site — but they are blocked
 * as mixed content once the site is HTTPS against the HTTP backend (documented
 * caveat, same as repairBooking.js / customerAuth.js).
 *
 * SSR-SAFE: no top-level browser access; readCustomer() is guarded, so this
 * imports cleanly under output:'export'.
 */

import {
  AUTH_BASE,
  MEDIA_UPLOAD_URL,
  MARKETPLACE_BASE,
  ORDER_BASE,
  SHOP_BASE,
  TICKET_BASE,
  USER_BASE,
} from '@/lib/api';
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
      /* non-json body */
    }
    const err = new Error(msg || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

/** Common GET helper for the authenticated customer endpoints. */
async function authGet(url) {
  const res = await fetch(url, {
    credentials: 'omit',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  return jsonOrThrow(res);
}

/** Common JSON mutation helper for authenticated customer endpoints. */
async function authJson(url, method, body) {
  const res = await fetch(url, {
    method,
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return jsonOrThrow(res);
}

/* -------------------------------------------------------------------------- */
/* Personal profile (user-service /customer/profile)                           */
/* -------------------------------------------------------------------------- */

/** Get the signed-in customer's editable profile, including avatar URL. */
export async function getCustomerProfile() {
  return authGet(`${trim(USER_BASE())}/customer/profile`);
}

/**
 * Save the customer profile. Its field names intentionally match
 * UpdateProfileRequest in user-service and the mobile app's EditProfile screen.
 */
export async function updateCustomerProfile(profile) {
  return authJson(`${trim(USER_BASE())}/customer/profile`, 'PUT', profile);
}

/**
 * Upload one customer avatar to media.ggfix.in through the media service.
 * The profile table stores an URL (not a data URI), so callers must not use a
 * base64 fallback when this request fails.
 */
export async function uploadCustomerAvatar(file) {
  const data = new FormData();
  data.append('file', file);
  data.append('folder', 'customers/avatars');
  const res = await fetch(MEDIA_UPLOAD_URL(), {
    method: 'POST',
    credentials: 'omit',
    headers: { Accept: 'application/json', ...authHeaders() },
    body: data,
  });
  const result = await jsonOrThrow(res);
  if (!result?.url || String(result.url).startsWith('data:')) {
    throw new Error('Image upload did not return a hosted image URL.');
  }
  return result.url;
}

/* -------------------------------------------------------------------------- */
/* Orders (order-service /customer-orders)                                     */
/* -------------------------------------------------------------------------- */

/**
 * List the logged-in customer's orders for one order type.
 * @param {{orderType?:string, status?:string}} q
 *   orderType ∈ REPAIR|PICKUP|BUY|SELL|ENQUIRY ; status ∈ Pending|Completed|Cancelled
 */
export async function listMyOrders({ orderType, status } = {}) {
  const qs = new URLSearchParams();
  if (orderType) qs.set('orderType', orderType);
  if (status) qs.set('status', status);
  const s = qs.toString();
  return unwrap(await authGet(`${trim(ORDER_BASE())}/customer-orders${s ? `?${s}` : ''}`));
}

/** One unified-order row, re-read before opening a detailed web flow. */
export async function getMyOrder(id) {
  return authGet(`${trim(ORDER_BASE())}/customer-orders/${encodeURIComponent(id)}`);
}

/** Customer-owned repair/pickup/enquiry booking, including services and events. */
export async function getRepairBooking(id) {
  return authGet(`${trim(ORDER_BASE())}/repair-bookings/${encodeURIComponent(id)}`);
}

/** Same repair-booking reschedule mutation used by the customer mobile app. */
export async function rescheduleRepairBooking(id, payload) {
  return authJson(
    `${trim(ORDER_BASE())}/repair-bookings/${encodeURIComponent(id)}/reschedule`,
    'POST',
    payload,
  );
}

/** Customer's sell request, with assessment answers, photos and quotations. */
export async function getSellOrder(id) {
  return authGet(`${trim(ORDER_BASE())}/sell-orders/${encodeURIComponent(id)}`);
}

/** Withdraw an editable sell request. */
export async function cancelSellOrder(id) {
  return authJson(`${trim(ORDER_BASE())}/sell-orders/${encodeURIComponent(id)}/cancel`, 'POST');
}

/** Shop-created service ticket path (distinct from a repair-booking id). */
export async function getServiceTicket(id) {
  return authGet(`${trim(TICKET_BASE())}/tickets/customer/${encodeURIComponent(id)}`);
}

/** Public shop identity shown in the customer app's booking detail screens. */
export async function getShopPublic(shopId) {
  if (!shopId) return null;
  try {
    const res = await fetch(`${trim(AUTH_BASE())}/auth/shops/${encodeURIComponent(shopId)}/public`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  } catch {
    return null;
  }
}

/** Pickup-slot availability from the selected repair shop (public endpoint). */
export async function listPickupSlots(shopId) {
  if (!shopId) return [];
  const res = await fetch(`${trim(SHOP_BASE())}/shops/${encodeURIComponent(shopId)}/pickup-slots`, {
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  return unwrap(await jsonOrThrow(res));
}

/* -------------------------------------------------------------------------- */
/* Cart (marketplace-service /customer/cart)                                   */
/* -------------------------------------------------------------------------- */

export async function getCart() {
  return unwrap(await authGet(`${trim(MARKETPLACE_BASE())}/customer/cart`));
}

export async function updateCartItem(itemId, quantity) {
  const res = await fetch(`${trim(MARKETPLACE_BASE())}/customer/cart/${encodeURIComponent(itemId)}`, {
    method: 'PUT',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify({ quantity }),
  });
  return jsonOrThrow(res);
}

export async function removeCartItem(itemId) {
  const res = await fetch(`${trim(MARKETPLACE_BASE())}/customer/cart/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
    credentials: 'omit',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  return jsonOrThrow(res);
}

export async function clearCart() {
  const res = await fetch(`${trim(MARKETPLACE_BASE())}/customer/cart`, {
    method: 'DELETE',
    credentials: 'omit',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  return jsonOrThrow(res);
}

/** Checkout: turn cart items into a BUY order (order-service). */
export async function checkoutBuy({ items, totalAmount }) {
  const res = await fetch(`${trim(ORDER_BASE())}/customer-orders/buy`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify({ items, totalAmount }),
  });
  return jsonOrThrow(res);
}

/* -------------------------------------------------------------------------- */
/* Saved devices (user-service /customer/devices)                              */
/* -------------------------------------------------------------------------- */

export async function listDevices() {
  return unwrap(await authGet(`${trim(USER_BASE())}/customer/devices`));
}

/** Create a saved device using the same payload as the customer app. */
export async function createDevice(device) {
  const res = await fetch(`${trim(USER_BASE())}/customer/devices`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(device),
  });
  return jsonOrThrow(res);
}

/** Update the selected device's variant details. */
export async function updateDevice(id, device) {
  const res = await fetch(`${trim(USER_BASE())}/customer/devices/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(device),
  });
  return jsonOrThrow(res);
}

export async function deleteDevice(id) {
  const res = await fetch(`${trim(USER_BASE())}/customer/devices/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'omit',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  return jsonOrThrow(res);
}

export async function setDefaultDevice(id) {
  const res = await fetch(`${trim(USER_BASE())}/customer/devices/${encodeURIComponent(id)}/default`, {
    method: 'POST',
    credentials: 'omit',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  return jsonOrThrow(res);
}

/* -------------------------------------------------------------------------- */
/* Addresses (user-service /customer/addresses) — full CRUD                    */
/* -------------------------------------------------------------------------- */
/* The account area needs the mutations the booking flow doesn't (delete /
 * set-default / update), so it owns the complete set. `area`/`district`/`taluk`
 * are canonical; `locality`/`city` are the LEGACY mirrors the backend also
 * accepts — we dual-write them so old readers keep working (matches the app). */

export async function listAddresses() {
  return unwrap(await authGet(`${trim(USER_BASE())}/customer/addresses`));
}

function addressBody(form) {
  return {
    ...form,
    locality: form.area || form.locality || '',
    city: form.district || form.city || '',
  };
}

export async function createAddress(form) {
  const res = await fetch(`${trim(USER_BASE())}/customer/addresses`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(addressBody(form)),
  });
  return jsonOrThrow(res);
}

export async function updateAddress(id, form) {
  const res = await fetch(`${trim(USER_BASE())}/customer/addresses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() },
    body: JSON.stringify(addressBody(form)),
  });
  return jsonOrThrow(res);
}

export async function deleteAddress(id) {
  const res = await fetch(`${trim(USER_BASE())}/customer/addresses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'omit',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  return jsonOrThrow(res);
}

export async function setDefaultAddress(id) {
  const res = await fetch(`${trim(USER_BASE())}/customer/addresses/${encodeURIComponent(id)}/default`, {
    method: 'POST',
    credentials: 'omit',
    headers: { Accept: 'application/json', ...authHeaders() },
  });
  return jsonOrThrow(res);
}

/** One-line address string, joined the way the app's ManageAddress does. */
export function formatAddress(a) {
  if (!a) return '';
  return [a.addressLine, a.area || a.locality, a.taluk, a.district || a.city, a.state, a.pincode]
    .filter(Boolean)
    .join(', ');
}

/* -------------------------------------------------------------------------- */
/* Small shared formatters                                                     */
/* -------------------------------------------------------------------------- */

/** ₹ amount in Indian grouping, e.g. 12500 -> "12,500". Blank for null. */
export function formatINR(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  try {
    return new Intl.NumberFormat('en-IN').format(v);
  } catch {
    return String(Math.round(v));
  }
}

/** "21 Jul 2026" from an ISO string; blank when unparseable. */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d.toDateString();
  }
}
