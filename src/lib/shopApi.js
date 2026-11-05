/**
 * shopApi.js — authenticated fetch for the shop-owner dashboard.
 *
 * Mirrors src/lib/api.js's request() helper, but signs with the shop-owner
 * session token (SHOP_TOKEN_KEY, src/lib/shopAuth.js) instead of
 * `admin_token`. Shop-owner and admin sessions are stored under separate
 * keys on purpose (see shopAuth.js's doc comment) so they never clobber one
 * another in the same browser — this helper keeps that separation on the
 * request side too, rather than reusing api.js's request() as-is.
 */

import { SHOP_TOKEN_KEY } from '@/lib/shopAuth';

function shopToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SHOP_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function shopRequest(base, path, options = {}) {
  const url = `${String(base || '').replace(/\/$/, '')}${path}`;
  const token = shopToken();
  // rawResponse:true returns the Response itself (e.g. a PDF blob) after the ok check.
  const { headers, rawResponse, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let body = raw;
    if (raw) {
      try { body = JSON.parse(raw); } catch { /* keep raw text */ }
    }
    const apiMsg =
      (body && typeof body === 'object' && (body.message || body.error)) ||
      (typeof body === 'string' && body.trim() ? body : null);
    const err = new Error(apiMsg || `Request failed (${res.status}): ${path}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (rawResponse) return res;
  if (res.status === 204) return null;
  return res.json();
}
