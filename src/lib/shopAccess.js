/**
 * shopAccess.js — the ONE place the partner dashboard decides what an
 * OWNER login and a SHOP login may see. Built on the backend's own role
 * fields from the login response (no new roles):
 *
 *   loginScope 'OWNER'  owner signed in with their personal mobile/email;
 *                       may switch between their shops (POST /auth/switch-shop
 *                       re-issues the JWT for the chosen shop).
 *   loginScope 'SHOP'   signed in with a shop's own mobile; the backend locks
 *                       the JWT to that one shop and refuses switch-shop.
 *   loginType           SHOP_OWNER / SHOP_LOGIN — only consulted for older
 *                       sessions saved before loginScope existed.
 *
 * Anything unrecognised is treated as SHOP (fail closed): a session we can't
 * classify never gets the owner's switcher, shop list or personal profile.
 *
 * This is VISIBILITY only. Every operational API call is already scoped by
 * the JWT (no request sends a shopId — see shopApi.js); keeping a SHOP token
 * out of other shops' data is the backend's job and can't be done here.
 */

const upper = (v) => String(v || '').trim().toUpperCase();

/** 'OWNER' | 'SHOP' for a stored session (readShopOwner()). */
export function sessionScope(session) {
  const scope = upper(session?.loginScope);
  if (scope === 'OWNER' || scope === 'SHOP') return scope;
  // Sessions from before loginScope was stored: SHOP_OWNER = owner account.
  return upper(session?.loginType) === 'SHOP_OWNER' ? 'OWNER' : 'SHOP';
}

export function isOwnerSession(session) {
  return Boolean(session?.token) && sessionScope(session) === 'OWNER';
}

/** Switch Account (and any multi-shop control) is for owners only. */
export function canSwitchAccount(session) {
  return isOwnerSession(session);
}

/**
 * The shops/locations this session may see. OWNER: all of theirs.
 * SHOP: only its own (matched on the JWT's shopId) — never the owner's
 * other shops, even though GET /auth/me returns them all.
 */
export function visibleLocations(session, locations) {
  const list = Array.isArray(locations) ? locations : [];
  if (isOwnerSession(session)) return list;
  const own = String(session?.shopId || '');
  return own ? list.filter((l) => String(l?.id) === own) : [];
}

/**
 * Session fields safe to persist for this login. A SHOP session keeps only
 * its own shop in `shops` (the login response lists the owner's shops).
 */
export function scopedSessionFields(session) {
  if (sessionScope(session) === 'OWNER') return session;
  const own = String(session?.shopId || '');
  const shops = Array.isArray(session?.shops) ? session.shops.filter((s) => String(s?.id) === own) : undefined;
  return { ...session, shops };
}

/**
 * Dashboard routes only an OWNER may open (the owner's plan & billing). A shop
 * login landing on one is sent to the dashboard by DashboardShell; nav items
 * flagged ownerOnly in partnerNav.js are not rendered for it either.
 */
export const OWNER_ONLY_ROUTES = ['/shop-home/settings/subscription'];

export function canOpenRoute(session, pathname) {
  const clean = String(pathname || '').replace(/\/+$/, '');
  return isOwnerSession(session) || !OWNER_ONLY_ROUTES.some((r) => clean === r || clean.startsWith(`${r}/`));
}

/** Account Settings tabs, and who may open each. */
export const OWNER_ONLY_TABS = ['kyc', 'subscription'];
