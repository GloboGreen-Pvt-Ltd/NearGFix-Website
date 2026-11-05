/**
 * subscriptionFormat.js — shared helpers for Subscription v2 (shop web +
 * management). Money in the API is ALWAYS integer paise; every screen
 * formats it through formatPaise() so the display is identical everywhere
 * (₹ + en-IN grouping + 2 decimals). Clients never compute an authoritative
 * amount — these helpers only format what the server returned.
 */

const INR = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 12345 -> "₹123.45"; null/undefined/NaN -> fallback. */
export function formatPaise(paise, fallback = '—') {
  if (paise === null || paise === undefined || paise === '') return fallback;
  const n = Number(paise);
  if (!Number.isFinite(n)) return fallback;
  return `${n < 0 ? '−' : ''}₹${INR.format(Math.abs(n) / 100)}`;
}

/** Admin ₹ input -> integer paise (null when blank/invalid). */
export function rupeesToPaise(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).replace(/[,₹\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Integer paise -> "123.45" for an editable ₹ input. */
export function paiseToRupeesInput(paise) {
  if (paise === null || paise === undefined || paise === '') return '';
  const n = Number(paise);
  return Number.isFinite(n) ? (n / 100).toFixed(2) : '';
}

const IST = 'Asia/Kolkata';

export function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST });
}

export function formatDateTime(value, fallback = '—') {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: IST,
  });
}

/** null limit = unlimited (contract). */
export function limitText(value, unit = '') {
  if (value === null || value === undefined) return `Unlimited${unit ? ` ${unit}` : ''}`;
  return `${value}${unit ? ` ${unit}` : ''}`;
}

export const asList = (d) => (Array.isArray(d) ? d : Array.isArray(d?.content) ? d.content : Array.isArray(d?.items) ? d.items : []);

/** Server `{message}` when it is meaningful; otherwise the caller's fallback plus a hint. */
export function errorText(e, fallback = 'Something went wrong. Please try again.') {
  if (!e) return fallback;
  const msg = e.body?.message || e.message || '';
  if (e.status === 404 && (!msg || /^not found$/i.test(msg) || /\b404\b/.test(msg))) return `${fallback} The subscription service is not available yet.`;
  if (e.name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(msg)) return `${fallback} Please check your connection and try again.`;
  if (e.status >= 500 && (!msg || /internal server error|\b5\d\d\b/i.test(msg))) return `${fallback} The server had a problem — please try again shortly.`;
  return msg || fallback;
}

/** Order statuses that still need a Razorpay reconcile before a new attempt. */
export const OPEN_ORDER_STATUSES = ['CREATED', 'AWAITING_PAYMENT', 'PAID'];

/* ----------------------------- Razorpay loader ----------------------------- */

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let checkoutPromise = null;

/** Loads Razorpay Checkout once, on demand. Resolves window.Razorpay. */
export function loadRazorpayCheckout() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Checkout is only available in the browser.'));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (checkoutPromise) return checkoutPromise;
  checkoutPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Payment gateway failed to load.')));
    script.onerror = () => {
      checkoutPromise = null;
      script.remove();
      reject(new Error('Could not load the payment gateway. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });
  return checkoutPromise;
}

/* -------------------------- Checkout session state ------------------------- */

const CHECKOUT_KEY = 'ggfix.subscription.checkout';

/** { planCode, shopIds, orderId, termsAccepted, replaceAck } — survives reloads and the add-shop detour. */
export function readCheckoutState() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(CHECKOUT_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function writeCheckoutState(patch) {
  if (typeof window === 'undefined') return {};
  const next = { ...readCheckoutState(), ...patch };
  try {
    window.sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — state still lives in memory/URL */
  }
  return next;
}

export function clearCheckoutState() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(CHECKOUT_KEY);
  } catch {
    /* ignore */
  }
}
