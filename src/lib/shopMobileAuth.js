/**
 * shopMobileAuth.js — REAL mobile-number + OTP sign-in for NearGFix Business
 * Login, supporting all three real identifier types the backend recognises:
 *   1. a shop owner's own personal mobile number (users.phone)
 *   2. a shop's own registered mobile number (shops.mobile)
 *   3. (POST /auth/login also accepts email, unused by this mobile-only UI)
 *
 * Verified end-to-end against production (2026-09-09) for both #1 and #2:
 *
 *   POST {AUTH_BASE}/auth/shop-login/request-otp   { mobile } -> { sent, devOtp, ttlMinutes }
 *     Real, but SHOP-mobile only — 400 "No shop registered for that mobile
 *     number" for a number that's a real owner's phone rather than a shop's
 *     own number. See sendMobileOtp()'s handling of that specific case below.
 *
 *   POST {AUTH_BASE}/auth/login   { email: <mobile digits>, otp } -> LoginResponse
 *     The unified verify call. Despite the field name (unchanged from the
 *     email/password DTO), the backend's own AuthService.login() resolves a
 *     non-email identifier by trying users.phone first (any shop owner's
 *     personal number, e.g. the account's own login), then falling back to
 *     shops.mobile if no user matched (routing internally to the same logic
 *     as /auth/shop-login) — one real call handles all three identifier
 *     types server-side. Response:
 *       { accessToken, userId, shopId, shopName, name, email, roles,
 *         roleLabel, shops[], loginScope: 'OWNER'|'SHOP', loginType }
 *     loginScope is 'OWNER' for a personal-number login (session can later
 *     switch between the owner's shops via POST /auth/switch-shop — not
 *     wired here) or 'SHOP' for a shop-number login (locked to that one
 *     shop). Both are handled identically by this module and by
 *     src/lib/shopAuth.js's session storage.
 *
 * One real limitation worth knowing: OTP delivery is dev-mode on the
 * backend for every non-email identifier — it doesn't send a real SMS, the
 * OTP is a stored static value (defaults to "123456"). This file never
 * reads or surfaces that dev value from the send-otp response. Wiring a
 * real SMS gateway is backend work, not something this frontend module can
 * fix.
 */

import { AUTH_BASE } from '@/lib/api';

export function normalizeMobile(value) {
  return String(value || '').replace(/\D/g, '');
}

function base() {
  return String(AUTH_BASE() || '').replace(/\/$/, '');
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function messageFrom(body) {
  const msg = body && (body.message || body.error);
  return typeof msg === 'string' && msg.trim() ? msg.trim() : null;
}

// AUTH_BASE() already ends in "/auth" (api.js: `${EDGE}/auth`) and every
// call below appends another literal "/auth/..." — the resulting
// /auth/auth/... shape LOOKS like a duplicated-path bug but is not one.
// See api.js's own file-header comment: the edge's nginx uses a
// trailing-slash proxy_pass (`location /auth/ { proxy_pass .../; }`) that
// STRIPS the first "/auth/" before forwarding, and the Spring controller
// behind it is itself @RequestMapping("/auth") — so the segment has to
// appear twice on the wire for the request to land on the right mapping.
// This exact call was verified end-to-end against production on
// 2026-09-09 (see this file's own header comment). Do not "fix" this by
// removing the doubled segment; that would send a bare
// /shop-login/request-otp to the auth service, which 404s.
const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Dev-only — never logs the mobile number, OTP, or any response body. */
function logRequestUrl(label, url) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[shopMobileAuth] ${label} ->`, url);
  }
}

/** A thrown fetch error (never an HTTP error response — see classifyHttpError for that). */
function classifyFetchError(err) {
  if (err?.name === 'AbortError') {
    return `The login service didn't respond within ${REQUEST_TIMEOUT_MS / 1000}s. It may be temporarily unreachable — please try again shortly.`;
  }
  return "Couldn't reach the login service. Check your connection and try again.";
}

/** A real HTTP error response with no usable server-provided message. */
function classifyHttpError(res, fallbackAction = 'complete this request') {
  if (res.status === 404) return `Login route not found (404) — the API may be misconfigured. Please contact support.`;
  if (res.status === 401) return 'Not authorized (401). Please try again.';
  if (res.status === 403) return 'This request was blocked (403). Please try again.';
  if (res.status >= 500) return `The login service is having trouble right now (${res.status}). Please try again shortly.`;
  return `We couldn't ${fallbackAction}. Please try again.`;
}

/**
 * @param {string} mobile
 * @returns {Promise<{ok:boolean, message?:string}>} Never throws.
 *
 * Only shop numbers get a real "OTP requested" confirmation from this call
 * (the only non-destructive send-otp endpoint that exists for a mobile
 * identifier). A number that turns out to be an owner's personal phone
 * fails this specific call with a real, expected 400 — there's no
 * equivalent standalone "send" endpoint for that identifier type that
 * doesn't also force a password reset (POST /auth/otp/send does, so this
 * deliberately doesn't call it). Rather than block on that expected
 * failure, this treats "no shop registered for that mobile number" as a
 * soft pass: the real, single source of truth is verifyMobileOtp() below,
 * which authenticates for real regardless of which identifier type it
 * turns out to be. Any OTHER failure (network error, malformed number)
 * still fails here for real.
 */
export async function sendMobileOtp(mobile) {
  const digits = normalizeMobile(mobile);
  if (digits.length !== 10) {
    return { ok: false, message: 'Enter a valid 10-digit mobile number.' };
  }
  const url = `${base()}/auth/shop-login/request-otp`;
  logRequestUrl('POST', url);
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ mobile: digits }),
    });
    if (!res.ok) {
      const body = await readJson(res);
      const message = messageFrom(body);
      if (res.status === 400 && message && /no shop registered/i.test(message)) {
        // Not a shop's own number — may still be a real owner's phone.
        // verifyMobileOtp() is the actual gate; proceed to the OTP step.
        return { ok: true };
      }
      return { ok: false, message: message || classifyHttpError(res, 'send an OTP') };
    }
    // devOtp is intentionally never read from this response — see module
    // doc comment. Nothing here surfaces it to the UI.
    return { ok: true };
  } catch (err) {
    return { ok: false, message: classifyFetchError(err) };
  }
}

/**
 * @param {string} mobile
 * @param {string} otp
 * @returns {Promise<{ok:boolean, session?:object, message?:string}>} Never throws.
 */
export async function verifyMobileOtp(mobile, otp) {
  const digits = normalizeMobile(mobile);
  const code = String(otp || '').replace(/\D/g, '');
  if (digits.length !== 10) return { ok: false, message: 'Enter a valid 10-digit mobile number.' };
  if (code.length !== 6) return { ok: false, message: 'Enter the complete 6-digit OTP.' };

  const url = `${base()}/auth/login`;
  logRequestUrl('POST', url);
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      // Field name is "email" per the shared LoginRequest DTO, but the
      // backend accepts a bare mobile number here — see module doc comment.
      body: JSON.stringify({ email: digits, otp: code }),
    });
    if (!res.ok) {
      const body = await readJson(res);
      const message = messageFrom(body);
      // Backend's own message wins when it sends one (this is also how an
      // expired-OTP message reaches the UI — passed through verbatim rather
      // than guessed at here). These are just the honest fallbacks for the
      // real HTTP statuses this endpoint can return with no body at all.
      if (message) return { ok: false, message };
      if (res.status === 401) {
        return { ok: false, message: 'Invalid OTP. Please check the code and try again.' };
      }
      if (res.status === 400) {
        return { ok: false, message: 'Invalid OTP request.' };
      }
      if (res.status === 403) {
        return { ok: false, message: 'OTP verification is not allowed. Please request a new OTP.' };
      }
      if (res.status === 429) {
        return { ok: false, message: 'Too many attempts. Please wait before trying again.' };
      }
      if (res.status === 404 || res.status >= 500) {
        return { ok: false, message: classifyHttpError(res, 'verify the OTP') };
      }
      return { ok: false, message: 'Something went wrong. Please try again.' };
    }
    const data = await res.json().catch(() => ({}));
    const token = data && data.accessToken;
    if (!token) return { ok: false, message: 'Login failed — no token returned.' };

    return {
      ok: true,
      session: {
        token,
        mobile: digits,
        userId: data.userId,
        shopId: data.shopId,
        shopName: data.shopName,
        name: data.name,
        email: data.email,
        roles: data.roles,
        roleLabel: data.roleLabel,
        loginScope: data.loginScope,
        loginType: data.loginType || 'SHOP_LOGIN',
        shops: data.shops,
      },
    };
  } catch (err) {
    return { ok: false, message: classifyFetchError(err) };
  }
}
