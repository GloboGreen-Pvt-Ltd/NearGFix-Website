/**
 * shopSubscription.js — the shop owner's own subscription status
 * (/shop-home/account/settings, "Subscription" tab).
 *
 * The two legacy helpers below are read-only. The Subscription v2 helpers at
 * the bottom (catalog, quote, purchase, Razorpay UPI order/verify, receipts)
 * identify the owner from the shop JWT only — they never send ownerUserId.
 *
 * Unlike AUTH_BASE, SUBSCRIPTION_BASE() is NOT doubled: the edge special-cases
 * this service's routing the same way it does master-data (see the header
 * comment in src/lib/api.js), and the admin's own subscriptionApi calls
 * confirm the single-prefix shape (Client/src/app/management/(portal)/
 * subscriptions/page.js calls '/subscriptions', not '/subscription/subscriptions').
 */

import { SUBSCRIPTION_BASE } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';

/** The signed-in owner's subscription row, or null when none exists yet. */
export async function fetchMySubscription(ownerId) {
  return shopRequest(SUBSCRIPTION_BASE(), `/subscriptions/owner/${ownerId}`);
}

/** Static plan catalog (BASIC pricing, feature list) for the upgrade card. */
export async function fetchSubscriptionPlans() {
  const list = await shopRequest(SUBSCRIPTION_BASE(), '/subscriptions/plans');
  return Array.isArray(list) ? list : [];
}

/* -------------------------------------------------------------------------- */
/* Subscription v2 (owner = JWT sub; never send ownerUserId). Money in paise.  */
/* -------------------------------------------------------------------------- */

const sub = (path, options) => shopRequest(SUBSCRIPTION_BASE(), `/subscriptions${path}`, options);
const post = (path, body) => sub(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

/** { subscription, shops, entitlements, usage, trialAvailable, pendingOrder } */
export const fetchSubscriptionMe = () => sub('/me');
/** { plans, checkout:{ webEnabled, androidEnabled, iosEnabled, configured }, taxPercent, taxInclusive } */
export const fetchSubscriptionCatalog = () => sub('/catalog');
export const fetchEligibleShops = async () => {
  const list = await sub('/eligible-shops');
  return Array.isArray(list) ? list : [];
};
export const fetchQuote = (planCode, shopIds) => post('/quote', { planCode, shopIds });
export const fetchQuotePreview = (planCode, shopCount) => post('/quote/preview', { planCode, shopCount });
export const purchaseSubscription = (planCode, shopIds) =>
  post('/purchase', { planCode, shopIds, channel: 'WEB', acceptTerms: true });
export const createPaymentOrder = (orderId) => post('/payment/order', { orderId });
export const verifyPayment = (payload) => post('/payment/verify', payload);
export const fetchPaymentStatus = (orderId) => sub(`/payment/status/${encodeURIComponent(orderId)}`);
export const cancelPaymentOrder = (orderId, reason) => post('/payment/cancel', { orderId, reason });
export const fetchPaymentHistory = async () => {
  const list = await sub('/payment/history');
  return Array.isArray(list) ? list : [];
};
export const fetchReceipt = (paymentId) => sub(`/receipts/${encodeURIComponent(paymentId)}`);
export const activateTrial = (shopIds) => post('/trial/activate', { shopIds });

/* ------------------------- Invoices (GST / receipt) ------------------------ */
/* Additive endpoints — a server without them answers 404; callers then hide  */
/* the invoice UI and keep the receipt-only behaviour.                       */

/** InvoiceView[] (newest first). */
export const fetchInvoices = async () => {
  const list = await sub('/invoices');
  return Array.isArray(list) ? list : [];
};
export const fetchInvoice = (id) => sub(`/invoices/${encodeURIComponent(id)}`);
/** 404 until the invoice is issued (right after activation) — poll a few times. */
export const fetchInvoiceByOrder = (orderId) => sub(`/invoices/by-order/${encodeURIComponent(orderId)}`);
export const retryInvoiceWhatsapp = (id) => post(`/invoices/${encodeURIComponent(id)}/whatsapp/retry`);

function filenameFrom(disposition, invoiceNo) {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition || '');
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return `${String(invoiceNo || 'invoice').replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`;
}

/** Authenticated PDF fetch → browser download named after the invoice number. */
export async function downloadInvoicePdf(id, invoiceNo) {
  const res = await sub(`/invoices/${encodeURIComponent(id)}/pdf`, { rawResponse: true, headers: { Accept: 'application/pdf' } });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filenameFrom(res.headers.get('content-disposition'), invoiceNo);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
