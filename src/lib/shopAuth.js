/**
 * shopAuth.js — email + password/OTP sign-in for shop owners on the public
 * site, gating the /shopmanagement -> /shop-home door.
 *
 * Same backend endpoint the staff admin portal uses — POST {AUTH_BASE}/auth/login
 * — because the auth-service issues one token per account regardless of which
 * front door it came through; `loginType` in the response is what tells the
 * two apart. src/app/management/(login)/page.js accepts SUPER_ADMIN /
 * MARKET_PERSON and rejects SHOP_OWNER / SHOP_LOGIN with "Shop accounts must
 * sign in through the NearGFix mobile app." This is the mirror of that gate: it
 * accepts SHOP_OWNER / SHOP_LOGIN and rejects staff/employee loginTypes, so
 * the two portals can never cross-admit each other's accounts.
 *
 * SEPARATE STORAGE from both admin (`admin_token`, src/lib/auth.js) and
 * customer (`ggfix_customer_token`, src/lib/customerAuth.js) sessions, for the
 * same reason those two are already kept apart: independent accounts must
 * never clobber one another in the same browser.
 *
 * SSR-SAFE: no top-level browser access; every window/localStorage touch is
 * guarded so this imports cleanly into server components under output:'export'.
 *
 * A THIRD real path also lands a session here: POST /auth/shop-login (mobile
 * + OTP/password, see src/lib/shopMobileAuth.js) — a genuine backend
 * endpoint, verified end-to-end against production, distinct from login()
 * below. It writes through the exported writeSession() rather than login()
 * itself, since it authenticates by mobile number, not email.
 */

import { AUTH_BASE } from '@/lib/api';
import { scopedSessionFields, sessionScope } from '@/lib/shopAccess';

export const SHOP_TOKEN_KEY = 'ggfix_shop_token';
export const SHOP_USER_KEY = 'ggfix_shop_owner';
export const SHOP_EVENT = 'ggfix:shopOwner';

function isBrowser() {
  return typeof window !== 'undefined';
}

function safeStorage() {
  if (!isBrowser()) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The signed-in shop owner session, or null. */
export function readShopOwner() {
  const storage = safeStorage();
  if (!storage) return null;
  let token;
  let raw;
  try {
    token = storage.getItem(SHOP_TOKEN_KEY);
    raw = storage.getItem(SHOP_USER_KEY);
  } catch {
    return null;
  }
  if (!token) return null;
  let user = {};
  if (raw) {
    try {
      user = JSON.parse(raw) || {};
    } catch {
      user = {};
    }
  }
  return { token, ...user };
}

export function isLoggedIn() {
  return Boolean(readShopOwner());
}

function emit(detail) {
  if (!isBrowser()) return;
  try {
    window.dispatchEvent(new CustomEvent(SHOP_EVENT, { detail }));
  } catch {
    /* pre-CustomEvent browsers: storage still holds the truth */
  }
}

function save(rawSession) {
  // A SHOP login keeps only its own shop — never the owner's shop list.
  const session = scopedSessionFields(rawSession);
  const storage = safeStorage();
  if (storage) {
    try {
      storage.setItem(SHOP_TOKEN_KEY, session.token);
      storage.setItem(
        SHOP_USER_KEY,
        JSON.stringify({
          email: session.email,
          mobile: session.mobile,
          loginType: session.loginType,
          // Present when the session came from the real POST /auth/shop-login
          // (src/lib/shopMobileAuth.js) rather than the older email/password
          // login() below, which never reads these fields off its response.
          userId: session.userId,
          shopId: session.shopId,
          shopName: session.shopName,
          name: session.name,
          roles: session.roles,
          roleLabel: session.roleLabel,
          loginScope: session.loginScope,
          shops: session.shops,
          avatarUrl: session.avatarUrl,
        }),
      );
    } catch {
      /* quota / private mode — session-only login is still useful this tab */
    }
  }
  emit(session);
}

/**
 * Write a session from a source OTHER than login() above — currently used by
 * the mobile-OTP Business Login flow (src/components/site/shoplogin.js),
 * which calls the real POST /auth/shop-login (see src/lib/shopMobileAuth.js)
 * and passes its full response through here. login()'s own behaviour above
 * is untouched by this export.
 */
export function writeSession(session) {
  preserveShopSessionFor(session);
  save(session);
}

/* -------------------------------------------------------------------------- */
/* Preserved SHOP session (Shop → Owner → "Logout" → back to the same Shop)    */
/* -------------------------------------------------------------------------- */

// When an OWNER signs in on top of a live SHOP session (shop-mobile login),
// the shop's real, server-issued SHOP-scoped token is set aside here instead
// of being overwritten. Owner logout puts it back (exitOwnerMode) — no OTP,
// no re-login, and no client-side role faking: the restored token is the one
// the backend issued for that shop.
export const PRESERVED_SHOP_KEY = 'ggfix_shop_preserved';

/** true when a JWT's `exp` is still in the future (unreadable/absent exp → treated as valid). */
function tokenNotExpired(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return true;
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return !json.exp || json.exp * 1000 > Date.now() + 30000;
  } catch {
    return true;
  }
}

function readPreserved() {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(PRESERVED_SHOP_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return s && s.token ? s : null;
  } catch {
    return null;
  }
}

function clearPreserved() {
  const storage = safeStorage();
  try {
    storage?.removeItem(PRESERVED_SHOP_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Called before any NEW login is stored. OWNER login over a valid SHOP
 * session → keep that shop session aside. A new SHOP login → any older
 * preserved shop session is obsolete, drop it.
 */
function preserveShopSessionFor(incoming) {
  const storage = safeStorage();
  if (!storage) return;
  if (sessionScope(incoming) !== 'OWNER') {
    clearPreserved();
    return;
  }
  const current = readShopOwner();
  if (current?.token && sessionScope(current) === 'SHOP' && tokenNotExpired(current.token)) {
    try {
      storage.setItem(PRESERVED_SHOP_KEY, JSON.stringify(current));
    } catch {
      /* quota / private mode — owner logout will then fall back to a full logout */
    }
  }
}

/** Is there a still-valid shop session to return to after owner logout? */
export function hasPreservedShopSession() {
  const s = readPreserved();
  return Boolean(s && tokenNotExpired(s.token));
}

/**
 * Owner "Logout" when the owner came in on top of a shop session: drop the
 * owner session and make the preserved SHOP session active again. Returns the
 * restored session, or null when there is none (caller then does a full logout).
 */
export function exitOwnerMode() {
  const shop = readPreserved();
  clearPreserved();
  if (!shop || !tokenNotExpired(shop.token)) return null;
  save(shop); // re-stores the shop's own token + fields; emits to every subscriber
  return readShopOwner();
}

/**
 * Merges fresh profile fields (e.g. from GET /auth/me or a just-saved avatar)
 * into the current session without touching the token, and re-emits so every
 * mounted screen (sidebar avatar, profile page, etc.) picks it up. No-op if
 * nobody's signed in. Mirrors customerAuth.js's updateCustomerSession().
 */
export function updateShopOwnerSession(profile) {
  const current = readShopOwner();
  if (!current?.token) return null;
  const next = {
    ...current,
    name: profile?.name ?? current.name,
    email: profile?.email ?? current.email,
    mobile: profile?.phone ?? current.mobile,
    avatarUrl: profile?.avatarUrl ?? current.avatarUrl,
  };
  save(next);
  return next;
}

/**
 * Switch the active shop — POST {AUTH_BASE}/auth/switch-shop { shopId }, the
 * call the Partner app's switchShop() makes. The backend re-issues the JWT
 * for that shop (only for owner-scoped sessions; a shop-mobile login is
 * locked to one shop and is refused). On success the new token + shop fields
 * replace the stored ones and every subscriber is notified; on failure the
 * current session is left untouched. Throws with the server's message.
 * (AUTH_BASE already ends in /auth — the doubled segment is intentional, see
 * shopMobileAuth.js.)
 */
export async function switchShop(shopId) {
  const current = readShopOwner();
  if (!current?.token) throw new Error('You are signed out. Please sign in again.');
  const res = await fetch(`${base()}/auth/switch-shop`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${current.token}` },
    body: JSON.stringify({ shopId }),
  });
  if (!res.ok) throw new Error((await readError(res)) || 'Could not switch shop. Please try again.');
  const data = await res.json().catch(() => ({}));
  const token = data && (data.accessToken || data.token);
  if (!token) throw new Error('Invalid response: no token returned.');
  const next = {
    ...current,
    token,
    userId: data.userId ?? current.userId,
    shopId: data.shopId ?? shopId,
    shopName: data.shopName ?? current.shopName,
    name: data.name ?? current.name,
    email: data.email ?? current.email,
    roles: data.roles ?? current.roles,
    roleLabel: data.roleLabel ?? current.roleLabel,
    loginScope: data.loginScope ?? current.loginScope,
    shops: Array.isArray(data.shops) ? data.shops : current.shops,
  };
  save(next);
  return next;
}

// Browser-stored, shop-scoped leftovers (recent customer searches, notification
// 'seen' marks) — cleared on logout so the next account starts clean.
const SHOP_SCOPED_PREFIXES = ['owner.search.recents', 'ggfix_notifications_seen_at'];

export function logout() {
  const storage = safeStorage();
  if (storage) {
    try {
      storage.removeItem(SHOP_TOKEN_KEY);
      storage.removeItem(SHOP_USER_KEY);
      storage.removeItem(PRESERVED_SHOP_KEY); // full logout: nothing to return to
      Object.keys(storage)
        .filter((k) => SHOP_SCOPED_PREFIXES.some((p) => k.startsWith(p)))
        .forEach((k) => storage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
  emit(null);
}

/** Subscribe to login/logout. Returns an unsubscribe; no-op on the server. */
export function subscribe(cb) {
  if (!isBrowser() || typeof cb !== 'function') return () => {};
  const onCustom = () => cb(readShopOwner());
  const onStorage = (event) => {
    if (event && event.key !== null && event.key !== SHOP_TOKEN_KEY) return;
    cb(readShopOwner());
  };
  window.addEventListener(SHOP_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(SHOP_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

function base() {
  return String(AUTH_BASE() || '').replace(/\/$/, '');
}

async function readError(res) {
  // Surface the server's own message where it is human-friendly, never a raw
  // stack line.
  try {
    const body = await res.json();
    const msg = body && (body.message || body.error);
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  } catch {
    /* non-JSON body */
  }
  return null;
}

/**
 * Sign in with email + password, or email + OTP — same two methods the
 * management portal offers, against the same /auth/login endpoint.
 * @param {{email:string, password?:string, otp?:string}} credentials
 * @returns {Promise<{ok:boolean, session?:object, message?:string}>} Never throws.
 */
export async function login({ email, password, otp }) {
  const trimmedEmail = String(email || '').trim();
  if (!trimmedEmail) return { ok: false, message: 'Enter your email or username.' };
  const usingOtp = Boolean(otp);
  if (!usingOtp && !password) return { ok: false, message: 'Enter your password.' };

  try {
    const body = { email: trimmedEmail };
    if (usingOtp) body.otp = otp;
    else body.password = password;

    const res = await fetch(`${base()}/auth/login`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const message = (await readError(res)) || 'Login failed. Please check your details and try again.';
      return { ok: false, message };
    }
    const data = await res.json().catch(() => ({}));
    const token = data && (data.accessToken || data.token);
    if (!token) return { ok: false, message: 'Invalid response: no token returned.' };

    // Same gate as the management portal, inverted: only a shop account may
    // pass through this door.
    const loginType = data.loginType;
    const isShop = loginType === 'SHOP_OWNER' || loginType === 'SHOP_LOGIN';
    if (loginType && !isShop) {
      return {
        ok: false,
        message:
          loginType === 'SUPER_ADMIN' || loginType === 'MARKET_PERSON'
            ? 'Staff accounts must sign in through the Admin Portal.'
            : 'This account type cannot sign in here.',
      };
    }

    const session = { token, email: trimmedEmail, loginType: loginType || 'SHOP_OWNER' };
    preserveShopSessionFor(session);
    save(session);
    return { ok: true, session };
  } catch {
    return {
      ok: false,
      message: "Couldn't reach the login service. Check your connection and try again.",
    };
  }
}
