/**
 * legalConsent.js — records that a signed-in account accepted the current
 * Terms and Conditions and Privacy Policy versions (src/lib/legalContent.js).
 *
 * Same backend the NearGFix apps use (verified in auth-service LegalPolicyController):
 *   POST {AUTH_BASE}/auth/legal/acceptances
 *        Authorization: Bearer <the account's own token>
 *        body { documents: [{ type, version }], app, platform }
 * The server takes the account id and type (customer vs shop user) from the
 * token, rejects unknown document types and malformed versions, and stamps
 * the time, IP and user agent itself. `app` is the consent source
 * (LEGAL_CONSENT_SOURCE) and `platform` is always "web".
 *
 * The checkbox is ticked before this browser holds a token, so the record can
 * only be written right after login. Login never waits on it. A call that fails
 * for a retryable reason (offline, 5xx, or the endpoint not deployed yet) is
 * kept in localStorage and retried on later page loads by LegalConsentSync,
 * until it succeeds, the token stops being accepted, or 30 days pass.
 *
 * SSR-SAFE: every window/localStorage touch is guarded.
 */

import { AUTH_BASE } from '@/lib/api';
import { CURRENT_LEGAL_VERSIONS } from '@/lib/legalContent';

export const LEGAL_CONSENT_SOURCE = {
  CUSTOMER: 'website-customer',
  BUSINESS: 'website-business',
};

const PENDING_KEY = 'ggfix_legal_pending';
const PENDING_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SIGNATURE = JSON.stringify(CURRENT_LEGAL_VERSIONS);

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readPending() {
  const store = storage();
  if (!store) return [];
  try {
    const list = JSON.parse(store.getItem(PENDING_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writePending(list) {
  const store = storage();
  if (!store) return;
  try {
    if (list.length) store.setItem(PENDING_KEY, JSON.stringify(list));
    else store.removeItem(PENDING_KEY);
  } catch {
    /* quota / private mode — the next login records it again */
  }
}

/** @returns {Promise<'ok'|'drop'|'retry'>} Never throws. */
async function post(token, source) {
  try {
    const res = await fetch(`${String(AUTH_BASE() || '').replace(/\/$/, '')}/auth/legal/acceptances`, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        documents: Object.entries(CURRENT_LEGAL_VERSIONS).map(([type, version]) => ({ type, version })),
        app: source,
        platform: 'web',
      }),
    });
    if (res.ok) return 'ok';
    // 400: the server rejected the payload; 401/403: the token is no longer
    // valid. Repeating the same request cannot succeed.
    if (res.status === 400 || res.status === 401 || res.status === 403) return 'drop';
    return 'retry';
  } catch {
    return 'retry';
  }
}

/**
 * Record acceptance of the current versions for the account behind `token`.
 * Call right after a login whose consent checkbox was ticked.
 * @returns {Promise<boolean>} true once the server has the record. Never throws.
 */
export async function recordLegalAcceptance(token, source) {
  if (!token) return false;
  const result = await post(token, source);
  if (result === 'retry') {
    writePending([
      ...readPending().filter((entry) => entry.token !== token),
      { token, source, versions: SIGNATURE, savedAt: Date.now() },
    ]);
  }
  return result === 'ok';
}

/** Retry records that failed earlier. Run once per page load (LegalConsentSync). */
export async function flushPendingLegalAcceptances() {
  const pending = readPending();
  if (!pending.length) return;
  const keep = [];
  for (const entry of pending) {
    // A record for an older policy version, or one too old to trust, is dropped:
    // that account is asked again when it next logs in.
    if (!entry?.token || entry.versions !== SIGNATURE) continue;
    if (!(Date.now() - Number(entry.savedAt) < PENDING_MAX_AGE_MS)) continue;
    // eslint-disable-next-line no-await-in-loop -- one or two entries at most.
    if ((await post(entry.token, entry.source)) === 'retry') keep.push(entry);
  }
  writePending(keep);
}
