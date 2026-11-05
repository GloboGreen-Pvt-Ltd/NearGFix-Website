/**
 * cashBook.js — real Cash Book ledger endpoints, ticket-service.
 *
 * Confirmed real (2026-09-28, live responses supplied directly):
 *   GET {TICKET_BASE}/ledger-parties?partyType=CUSTOMER|SUPPLIER
 *     -> [{ id, partyType, name, phone, balance, createdAt, updatedAt,
 *           lastEntryAmount, lastEntryDate, lastEntryDirection: 'GIVEN'|'RECEIVED',
 *           totalGiven, totalReceived }, ...]
 *   GET {TICKET_BASE}/ledger-entries/party/{partyId}
 *     -> { balance, party: {...same shape as above}, entries: [
 *           { id, partyId, partyName, amount, direction: 'GIVEN'|'RECEIVED',
 *             entryDate, createdAt, runningBalance, billUrls }, ...] }
 *
 *   POST {TICKET_BASE}/ledger-parties { partyType, name, phone } -> party
 *     (add an account; confirmed in ticket-service ShopLedgerPartyController)
 *
 * Posting a Received/Given entry is not wired here yet. Uses shopRequest (the shop-
 * owner session token, src/lib/shopApi.js), the same auth every other real
 * shop-dashboard fetch in this codebase uses — not a separate auth path.
 */

import { shopRequest } from './shopApi';
import { TICKET_BASE } from './api';

export async function fetchLedgerParties(partyType) {
  const list = await shopRequest(TICKET_BASE(), `/ledger-parties?partyType=${encodeURIComponent(partyType)}`);
  return Array.isArray(list) ? list : [];
}

export async function fetchLedgerPartyStatement(partyId) {
  return shopRequest(TICKET_BASE(), `/ledger-entries/party/${encodeURIComponent(partyId)}`);
}

/** 10-digit Indian mobile from "+91 98765 43210" / "098765 43210" / "9876543210" (same rule as the Partner app). */
export function normalizeLedgerPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/**
 * Add a customer/supplier account — POST {TICKET_BASE}/ledger-parties
 * { partyType, name, phone, dueDate? } (ShopLedgerPartyController.create, owner only).
 * The server upserts on (shop, type, phone): an existing number keeps its
 * account and just takes the new name; a blank name falls back to the number.
 */
export async function createLedgerParty({ partyType, name, phone, dueDate }) {
  return shopRequest(TICKET_BASE(), '/ledger-parties', {
    method: 'POST',
    body: JSON.stringify({ partyType, name: String(name || '').trim(), phone: normalizeLedgerPhone(phone), ...(dueDate ? { dueDate } : {}) }),
  });
}

/**
 * Set or clear an account's due date (expected settlement date) —
 * PATCH {TICKET_BASE}/ledger-parties/{id} { dueDate } / { clearDueDate: true }.
 * `dueDate` is YYYY-MM-DD; pass null to clear it.
 */
export async function updateLedgerPartyDueDate(id, dueDate) {
  return shopRequest(TICKET_BASE(), `/ledger-parties/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(dueDate ? { dueDate } : { clearDueDate: true }),
  });
}

/** Days without a payment after which an open balance with no due date counts as delayed. */
export const DEFAULT_CREDIT_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/**
 * Payment status of a ledger account, worked out automatically:
 *   - settled   — balance is 0.
 *   - defaulter — money is still outstanding and either its due date has
 *                 passed, or (no due date) nothing has been received for
 *                 DEFAULT_CREDIT_DAYS since the last payment / account
 *                 opening.
 *   - due       — outstanding, not late yet (dueOn = the date it becomes late).
 * Returns { status, dueOn: Date|null, daysLate, reason }.
 */
export function ledgerPaymentStatus(party, now = new Date()) {
  const balance = Number(party?.balance) || 0;
  if (balance === 0) return { status: 'settled', dueOn: null, daysLate: 0, reason: '' };
  const today = startOfDay(now);
  const explicit = party.dueDate ? startOfDay(`${String(party.dueDate).slice(0, 10)}T00:00:00`) : null;
  const anchor = startOfDay(party.lastPaymentDate || party.createdAt || now);
  const dueOn = explicit || (anchor ? new Date(anchor.getTime() + DEFAULT_CREDIT_DAYS * DAY_MS) : null);
  if (dueOn && today > dueOn) {
    return {
      status: 'defaulter',
      dueOn,
      daysLate: Math.round((today - dueOn) / DAY_MS),
      reason: explicit ? 'Due date passed' : `No payment for ${DEFAULT_CREDIT_DAYS}+ days`,
    };
  }
  return { status: 'due', dueOn, daysLate: 0, reason: '' };
}
