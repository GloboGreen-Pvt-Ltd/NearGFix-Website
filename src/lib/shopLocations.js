/**
 * shopLocations.js — the shop owner's own "Business Locations" CRUD
 * (/shop-home/account/business-profile).
 *
 * Backed by the SAME auth-service endpoints the admin's
 * BusinessLocationsManager already uses (Client/src/components/
 * BusinessLocationsManager.js), just signed with the owner's own session
 * token via shopRequest() instead of admin_token:
 *   GET    {AUTH_BASE}/auth/me                                        -> ShopOwnerView, includes locations[]
 *   POST   {AUTH_BASE}/auth/shop-owners/{ownerId}/locations            -> add
 *   PATCH  {AUTH_BASE}/auth/shop-owners/{ownerId}/locations/{id}       -> update
 *   DELETE {AUTH_BASE}/auth/shop-owners/{ownerId}/locations/{id}       -> delete
 *
 * ownerId must always be the FRESH id from fetchMyProfile() (ShopOwnerView.id)
 * — never something cached in the shopAuth session — because the
 * email/password login() path in shopAuth.js never stores a userId; only the
 * mobile-OTP path (shopMobileAuth.js) does.
 *
 * NOTE the doubled "/auth": AUTH_BASE() already ends in "/auth", and the
 * paths below start with "/auth/..." again — see src/lib/api.js's header
 * comment. The edge's `location /auth/ { proxy_pass .../; }` strips ONE
 * "/auth/" before forwarding to the service, whose controller is itself
 * @RequestMapping("/auth"); a path with only one "/auth" segment (as this
 * file originally had) reaches nginx fine but arrives at Spring as a bare
 * `/shop-owners/...`, which matches no permitAll pattern and no controller —
 * Spring Security's default entry point then returns 403 for the resulting
 * unauthenticated "anyRequest" match. That looks exactly like an ownership/
 * auth rejection but is really just a mis-routed path.
 */

import { AUTH_BASE, MEDIA_UPLOAD_URL } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';
import { SHOP_TOKEN_KEY } from '@/lib/shopAuth';

function base() {
  return String(AUTH_BASE() || '').replace(/\/$/, '');
}

export async function addShopLocation(ownerId, payload) {
  return shopRequest(base(), `/auth/shop-owners/${ownerId}/locations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateShopLocation(ownerId, locationId, payload) {
  return shopRequest(base(), `/auth/shop-owners/${ownerId}/locations/${locationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteShopLocation(ownerId, locationId) {
  return shopRequest(base(), `/auth/shop-owners/${ownerId}/locations/${locationId}`, {
    method: 'DELETE',
  });
}

/**
 * Uploads one shop document/photo (front/banner/GST/Udyam) to S3, signed
 * with the owner's own token. Mirrors uploadMedia() in src/lib/api.js, which
 * is admin-token-only — this is that same master-data-service endpoint
 * (not role-gated; any valid bearer token is accepted, same as the
 * customer-facing uploadCustomerAvatar() in customerAccount.js) with the
 * shop-owner token attached instead.
 */
export async function uploadShopLocationMedia(file, folder, { document = false } = {}) {
  if (!file) return null;
  const fd = new FormData();
  fd.append('file', file);
  if (folder) fd.append('folder', folder);
  if (document) fd.append('allowDocument', 'true');
  const token = typeof window !== 'undefined' ? window.localStorage.getItem(SHOP_TOKEN_KEY) : null;
  const res = await fetch(MEDIA_UPLOAD_URL(), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const data = await res.json().catch(() => ({}));
  return data?.url || null;
}
