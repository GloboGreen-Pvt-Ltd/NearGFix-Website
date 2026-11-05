/**
 * customerAuth.js — phone + OTP customer sign-in for the public site.
 *
 * Talks to the SAME auth-service the mobile customer app uses (verified live):
 *   POST {AUTH_BASE}/auth/customer/otp/send   body { mobile }          -> sends OTP
 *   POST {AUTH_BASE}/auth/customer-login       body { mobile, otp }      -> { accessToken, userId, fullName, email, mobile, roles }
 * Both allow browser CORS from any origin (auth-service SecurityConfig + WebConfig).
 *
 * SEPARATE STORAGE FROM ADMIN: the admin panel keeps its JWT under `admin_token`
 * (src/lib/auth.js). Customer sessions use their OWN keys so the two can never
 * clobber each other — an admin browsing the marketing site and a customer
 * logging in are independent.
 *
 * SSR-SAFE: no top-level browser access; every window/localStorage touch is
 * guarded so this imports cleanly into server components under output:'export'.
 *
 * PRODUCTION CAVEAT: the backend is plain HTTP on a bare IP. Once the site is
 * served over HTTPS these calls are blocked as mixed content — the backend must
 * move to HTTPS (or sit behind a TLS proxy) for login to work in production.
 */

import { AUTH_BASE } from '@/lib/api';

export const CUSTOMER_TOKEN_KEY = 'ggfix_customer_token';
export const CUSTOMER_USER_KEY = 'ggfix_customer';
export const CUSTOMER_EVENT = 'ggfix:customer';

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

/** The signed-in customer, or null. Includes profile fields kept in sync by My Account. */
export function readCustomer() {
  const storage = safeStorage();
  if (!storage) return null;
  let token;
  let raw;
  try {
    token = storage.getItem(CUSTOMER_TOKEN_KEY);
    raw = storage.getItem(CUSTOMER_USER_KEY);
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
  return Boolean(readCustomer());
}

function emit(detail) {
  if (!isBrowser()) return;
  try {
    window.dispatchEvent(new CustomEvent(CUSTOMER_EVENT, { detail }));
  } catch {
    /* pre-CustomEvent browsers: storage still holds the truth */
  }
}

function save(session) {
  const storage = safeStorage();
  if (storage) {
    try {
      storage.setItem(CUSTOMER_TOKEN_KEY, session.token);
      storage.setItem(
        CUSTOMER_USER_KEY,
        JSON.stringify({
          userId: session.userId,
          fullName: session.fullName,
          mobile: session.mobile,
          email: session.email,
          alternateMobile: session.alternateMobile,
          profileImageUrl: session.profileImageUrl,
          roles: session.roles,
        }),
      );
    } catch {
      /* quota / private mode — session-only login is still useful this tab */
    }
  }
  emit(session);
}

export function logout() {
  const storage = safeStorage();
  if (storage) {
    try {
      storage.removeItem(CUSTOMER_TOKEN_KEY);
      storage.removeItem(CUSTOMER_USER_KEY);
    } catch {
      /* ignore */
    }
  }
  emit(null);
}

/**
 * Persist an updated customer-profile response and notify all account/header
 * listeners immediately. The profile endpoint uses `id`, while the customer
 * auth session calls the same identifier `userId`, so we deliberately support
 * both names here.
 */
export function updateCustomerSession(profile) {
  const current = readCustomer();
  if (!current?.token) return null;
  const next = {
    token: current.token,
    userId: profile?.userId ?? profile?.id ?? current.userId,
    fullName: profile?.fullName ?? current.fullName,
    mobile: profile?.mobile ?? current.mobile,
    email: profile?.email ?? current.email,
    alternateMobile: profile?.alternateMobile ?? current.alternateMobile,
    profileImageUrl: profile?.profileImageUrl ?? current.profileImageUrl,
    roles: profile?.roles ?? current.roles ?? ['CUSTOMER'],
  };
  save(next);
  return next;
}

/** Subscribe to login/logout. Returns an unsubscribe; no-op on the server. */
export function subscribe(cb) {
  if (!isBrowser() || typeof cb !== 'function') return () => {};
  const onCustom = (event) => cb(event && event.detail ? readCustomer() : readCustomer());
  const onStorage = (event) => {
    if (event && event.key !== null && event.key !== CUSTOMER_TOKEN_KEY) return;
    cb(readCustomer());
  };
  window.addEventListener(CUSTOMER_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CUSTOMER_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

/** Bare digits only — the API wants "9876543210", not "+91 98765 43210". */
export function normalizeMobile(input) {
  return String(input || '').replace(/\D/g, '');
}

function base() {
  return String(AUTH_BASE() || '').replace(/\/$/, '');
}

async function readError(res) {
  // Surface the server's own message where it is human-friendly (e.g.
  // "No account found for this mobile number"), never a raw stack line.
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
 * Send (or resend) an OTP to a mobile number.
 * @returns {Promise<{ok:boolean, defaultOtp?:string, message?:string}>}
 *   ok:false carries a `message` suitable to show the user. Never throws.
 *
 * NOTE: the backend only sends to an EXISTING customer account; an unknown
 * number comes back ok:false with "No account found…". Registration is not part
 * of this web flow — those users are pointed at the app.
 */
export async function sendOtp(mobile) {
  const digits = normalizeMobile(mobile);
  if (digits.length < 10) return { ok: false, message: 'Enter a valid 10-digit mobile number.' };
  try {
    const res = await fetch(`${base()}/auth/customer/otp/send`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ mobile: digits }),
    });
    if (!res.ok) {
      const message = (await readError(res)) || "We couldn't send an OTP. Please try again.";
      return { ok: false, message };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, defaultOtp: data && data.defaultOtp };
  } catch {
    // Network / CORS / mixed-content block.
    return {
      ok: false,
      message: "Couldn't reach the login service. Check your connection and try again.",
    };
  }
}

/**
 * Verify the OTP and sign in.
 * @returns {Promise<{ok:boolean, session?:object, message?:string}>} Never throws.
 */
export async function login(mobile, otp) {
  const digits = normalizeMobile(mobile);
  const code = String(otp || '').trim();
  if (digits.length < 10 || code.length < 4) {
    return { ok: false, message: 'Enter the OTP sent to your number.' };
  }
  try {
    const res = await fetch(`${base()}/auth/customer-login`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ mobile: digits, otp: code }),
    });
    if (!res.ok) {
      const message = (await readError(res)) || 'That OTP did not work. Please try again.';
      return { ok: false, message };
    }
    const data = await res.json().catch(() => ({}));
    const token = data && (data.accessToken || data.token);
    if (!token) return { ok: false, message: 'Login failed — no token returned.' };
    const session = {
      token,
      userId: data.userId,
      fullName: data.fullName,
      email: data.email,
      mobile: data.mobile || digits,
      roles: data.roles || ['CUSTOMER'],
    };
    save(session);
    return { ok: true, session };
  } catch {
    return {
      ok: false,
      message: "Couldn't reach the login service. Check your connection and try again.",
    };
  }
}

/**
 * Fetch the signed-in customer's live profile via GET /auth/customer-me and heal
 * the stored session with it (same token, fresh name/email/mobile) so the sidebar
 * and header identity update too. Returns { userId, fullName, email, mobile, roles }
 * or null on any failure. Editing is handled separately by the user-service
 * /customer/profile endpoint in customerAccount.js.
 */
export async function getCustomerMe() {
  const current = readCustomer();
  if (!current || !current.token) return null;
  try {
    const res = await fetch(`${base()}/auth/customer-me`, {
      credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: `Bearer ${current.token}` },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data) return null;
    const profile = {
      userId: data.userId ?? current.userId,
      fullName: data.fullName ?? current.fullName,
      email: data.email ?? current.email,
      mobile: data.mobile ?? current.mobile,
      alternateMobile: data.alternateMobile ?? current.alternateMobile,
      profileImageUrl: data.profileImageUrl ?? current.profileImageUrl,
      roles: data.roles ?? current.roles ?? ['CUSTOMER'],
    };
    save({ token: current.token, ...profile });
    return profile;
  } catch {
    return null;
  }
}
