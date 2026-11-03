'use client';

/**
 * /shop-home/reports/cash-book
 *
 * 2026-09-28: the Customer/Supplier ledger IS real — src/lib/cashBook.js
 * calls the two confirmed live ticket-service endpoints:
 *   GET {TICKET_BASE}/ledger-parties?partyType=CUSTOMER|SUPPLIER
 *   GET {TICKET_BASE}/ledger-entries/party/{partyId}
 * (found by hitting the live API directly with real data — not something a
 * repo-only search could have found, since nothing in this frontend
 * referenced them before). Account list, Net Balance, and each row's
 * expandable statement below are all real, fetched data.
 *
 * "Add Customer"/"Add Supplier" open AddPartyModal, which creates the
 * account via POST {TICKET_BASE}/ledger-parties (confirmed in the
 * ticket-service source, ShopLedgerPartyController) and re-fetches the
 * list. Posting a Received/Given entry and a date-filtered list are still
 * not wired, so the Today/This Week/Month pills stay inert.
 *
 * Payment delay → "Defaulter", automatically (ledgerPaymentStatus in
 * src/lib/cashBook.js): an account with money outstanding whose due date has
 * passed — or, with no due date, that has received nothing for
 * DEFAULT_CREDIT_DAYS — gets a red Defaulter tag on its name, sorts to the
 * top, and is counted in the Net Balance card. The due date itself is the
 * account's real dueDate (set when adding, or from the account's expanded
 * row via PATCH /ledger-parties/{id}).
 *
 * The top 4 KPI cards (Cash In/Cash Out/Balance/Today's Entries) are a
 * DIFFERENT, still-unconfirmed aggregate — computing them for real would
 * mean fetching every party's full entry history just to sum them (no
 * dedicated summary endpoint has been confirmed), so those keep their
 * original "—" placeholders unchanged.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CalendarClock,
  ArrowLeft,
  ArrowUpDown,
  BookOpen,
  ChevronDown,
  FileClock,
  Loader2,
  Phone,
  ShieldAlert,
  X,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { readShopOwner, subscribe } from '@/lib/shopAuth';
import {
  DEFAULT_CREDIT_DAYS,
  createLedgerParty,
  fetchLedgerParties,
  fetchLedgerPartyStatement,
  ledgerPaymentStatus,
  normalizeLedgerPhone,
  updateLedgerPartyDueDate,
} from '@/lib/cashBook';
import { notifyError, notifySuccess } from '@/lib/toast';

const DASH = '—';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatShortDate(value) {
  if (!value) return 'Not available';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not available';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${d.getFullYear()}`;
}
/** Date -> YYYY-MM-DD (local) for a date input. */
function toDateInput(value) {
  const d = value instanceof Date ? value : value ? new Date(`${String(value).slice(0, 10)}T00:00:00`) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function inr(amount) {
  return `₹${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`;
}
function directionLabel(direction) {
  return direction === 'RECEIVED' ? 'Received' : 'Given';
}

// Icon + tint + watermark per summary card — four distinct identities
// (green/orange/blue/violet), matching a reference design's "cash flow"
// look, deliberately different from Profit & Loss/Service Report's own
// card treatments.
const CASH_CARD_STYLES = {
  green: { card: 'bg-[#F3F3F3]', chip: 'bg-gradient-to-br from-[#035C6C] to-[#035C6C]', watermark: 'text-[#035C6C]' },
  orange: { card: 'bg-[#F8F8F8]', chip: 'bg-gradient-to-br from-[#FFB35C] to-[#FF8F2C]', watermark: 'text-[#FF8F2C]' },
  blue: { card: 'bg-[#F8F8F8]', chip: 'bg-gradient-to-br from-[#5EB6FA] to-[#2196F3]', watermark: 'text-[#2196F3]' },
  violet: { card: 'bg-[#F8F8F8]', chip: 'bg-gradient-to-br from-[#A78BFA] to-[#8B5CF6]', watermark: 'text-[#8B5CF6]' },
};

const CASH_CARDS = [
  { key: 'in', label: 'Cash In', icon: TrendingUp, watermark: Wallet, tone: 'green' },
  { key: 'out', label: 'Cash Out', icon: TrendingDown, watermark: Wallet, tone: 'orange' },
  { key: 'balance', label: 'Balance', icon: Wallet, watermark: Wallet, tone: 'blue' },
  { key: 'entries', label: "Today's Entries", icon: FileClock, watermark: FileClock, tone: 'violet' },
];

function CashCard({ icon: Icon, watermark: Watermark, label, tone }) {
  const s = CASH_CARD_STYLES[tone] || CASH_CARD_STYLES.green;
  return (
    <div className="relative flex flex-col overflow-hidden rounded-[18px] border border-[#ECECEC] bg-[#F8F8F8] p-5">
      <Watermark className={cx('pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 opacity-15', s.watermark)} aria-hidden="true" />
      <span className={cx('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white', s.chip)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="relative mt-4 text-[28px] font-extrabold leading-none text-[#111111]">{DASH}</p>
      <p className="relative mt-1.5 text-[14px] font-medium text-[#666666]">{label}</p>
    </div>
  );
}

/** Set / change / clear an account's due date (PATCH /ledger-parties/{id}). */
function DueDateEditor({ party, onSaved }) {
  const [value, setValue] = useState(toDateInput(party.dueDate));
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(toDateInput(party.dueDate)), [party.dueDate]);

  async function save(next) {
    setSaving(true);
    try {
      await updateLedgerPartyDueDate(party.id, next || null);
      notifySuccess(next ? 'Due date saved' : 'Due date cleared');
      onSaved?.();
    } catch (err) {
      notifyError(err, 'Could not update the due date.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#ECECEC] bg-white px-3 py-2.5">
      <CalendarClock className="h-4 w-4 shrink-0 text-[#035C6C]" aria-hidden="true" />
      <span className="text-xs font-bold text-[#344054]">Due date</span>
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 rounded-lg border border-[#D0D5DD] px-2 text-xs text-[#1C3053] outline-none focus:border-[#035C6C]"
      />
      <button
        type="button"
        onClick={() => save(value)}
        disabled={saving || !value || value === toDateInput(party.dueDate)}
        className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#035C6C] px-3 text-xs font-bold text-white transition hover:bg-[#035C6C] disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
        Save
      </button>
      {party.dueDate ? (
        <button type="button" onClick={() => save(null)} disabled={saving} className="h-8 rounded-lg px-2 text-xs font-bold text-[#B42318] hover:bg-[#FEF2F2] disabled:opacity-50">
          Clear
        </button>
      ) : (
        <span className="text-[0.68rem] text-[#98A2B3]">Not set — marked Defaulter after {DEFAULT_CREDIT_DAYS} days without payment.</span>
      )}
    </div>
  );
}

// One customer/supplier account row — real data from GET /ledger-parties.
// Clicking it lazy-loads that party's real statement (GET
// /ledger-entries/party/{id}) and expands it inline, same expand/toggle
// pattern already used elsewhere in this app (e.g. ServiceReportClient's
// TaskRow) rather than a new routed screen.
function PartyRow({ party, expanded, onToggle, statement, statementLoading, statementError, onPartyUpdated }) {
  const initial = (party.name || '?').trim().charAt(0).toUpperCase() || '?';
  const hasLastEntry = party.lastEntryAmount != null && party.lastEntryDirection;
  const activityLine = hasLastEntry
    ? `${inr(party.lastEntryAmount)} ${directionLabel(party.lastEntryDirection)} on ${formatShortDate(party.lastEntryDate)}`
    : `Added On ${formatShortDate(party.createdAt)}`;
  const due = Number(party.balance || 0) !== 0;
  const pay = ledgerPaymentStatus(party);
  const defaulter = pay.status === 'defaulter';

  return (
    <div>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#F8F8F8] sm:px-5">
        <span
          className={cx(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white',
            defaulter ? 'bg-gradient-to-br from-[#F04438] to-[#B42318]' : 'bg-gradient-to-br from-[#035C6C] to-[#035C6C]',
          )}
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-bold text-[#1C3053]">{party.name}</span>
            {defaulter ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FEE4E2] px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wide text-[#B42318]">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Defaulter
              </span>
            ) : null}
          </p>
          {defaulter ? (
            <p className="truncate text-xs font-semibold text-[#B42318]">
              {pay.reason} · {pay.daysLate} day{pay.daysLate === 1 ? '' : 's'} late (due {formatShortDate(pay.dueOn)})
            </p>
          ) : (
            <p className="truncate text-xs text-[#666666]">
              {activityLine}
              {due && party.dueDate ? ` · Due on ${formatShortDate(pay.dueOn)}` : ''}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={cx('text-sm font-extrabold', defaulter ? 'text-[#B42318]' : 'text-[#1C3053]')}>{inr(party.balance)}</p>
          <p className={cx('text-xs font-bold', defaulter ? 'text-[#B42318]' : due ? 'text-[#DC6803]' : 'text-[#035C6C]')}>
            {defaulter ? 'Overdue' : due ? 'Due' : 'Settled'}
          </p>
        </div>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-[#98A2B3] transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </button>

      {expanded ? (
        <div className="border-t border-dashed border-[#ECECEC] bg-[#F8F8F8] px-4 py-4 sm:px-5">
          <DueDateEditor party={party} onSaved={onPartyUpdated} />
          {party.phone ? (
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[#666666]">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {party.phone}
            </p>
          ) : null}
          {statementLoading ? (
            <p className="flex items-center gap-2 text-xs text-[#666666]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Loading statement…
            </p>
          ) : statementError ? (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              {statementError}
            </p>
          ) : !statement || statement.entries.length === 0 ? (
            <p className="text-xs text-[#98A2B3]">No entries recorded for this account yet.</p>
          ) : (
            <div className="space-y-2">
              {statement.entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1C3053]">{directionLabel(entry.direction)}</p>
                    <p className="text-[0.68rem] text-[#98A2B3]">{formatShortDate(entry.entryDate)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cx('text-xs font-extrabold', entry.direction === 'RECEIVED' ? 'text-[#035C6C]' : 'text-[#DC2626]')}>
                      {inr(entry.amount)}
                    </p>
                    <p className="text-[0.68rem] text-[#98A2B3]">Bal. {inr(entry.runningBalance)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Add a customer/supplier account — name (optional) + 10-digit mobile. */
function AddPartyModal({ partyType, onClose, onAdded }) {
  const noun = partyType === 'SUPPLIER' ? 'Supplier' : 'Customer';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const digits = normalizeLedgerPhone(phone);
  const valid = digits.length === 10;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !saving && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  async function submit(e) {
    e.preventDefault();
    if (!valid || saving) {
      if (!valid) setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const party = await createLedgerParty({ partyType, name, phone: digits, dueDate: dueDate || undefined });
      onAdded(party);
    } catch (err) {
      notifyError(err, `Could not add the ${noun.toLowerCase()}.`);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0B1739]/40 sm:items-center sm:p-4" onMouseDown={() => !saving && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-party-title"
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[24px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_24px_60px_rgba(11,23,57,0.25)] sm:rounded-[24px] sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F3F3] text-[#035C6C]">
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 id="add-party-title" className="text-[17px] font-extrabold text-[#1C3053]">
              Add {noun}
            </h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded-full p-1.5 text-[#98A2B3] hover:bg-[#F3F3F3] hover:text-[#344054]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-[#666666]" htmlFor="party-name">
          Name <span className="font-semibold normal-case tracking-normal text-[#98A2B3]">(optional)</span>
        </label>
        <input
          id="party-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${noun} name`}
          maxLength={120}
          autoFocus
          className="mt-1.5 h-12 w-full rounded-xl border border-[#D0D5DD] px-3.5 text-[15px] text-[#1C3053] outline-none transition focus:border-[#035C6C] focus:ring-4 focus:ring-[#035C6C]/10"
        />

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#666666]" htmlFor="party-phone">
          Mobile number <span className="text-[#DC2626]">*</span>
        </label>
        <div className="mt-1.5 flex h-12 items-center rounded-xl border border-[#D0D5DD] px-3.5 transition focus-within:border-[#035C6C] focus-within:ring-4 focus-within:ring-[#035C6C]/10">
          <span className="mr-2 text-[15px] font-semibold text-[#666666]">+91</span>
          <input
            id="party-phone"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
              setError('');
            }}
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#1C3053] outline-none"
          />
        </div>
        <p className="mt-1.5 text-xs text-[#98A2B3]">If this number already has an account, its name is updated instead.</p>

        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#666666]" htmlFor="party-due">
          Payment due date <span className="font-semibold normal-case tracking-normal text-[#98A2B3]">(optional)</span>
        </label>
        <input
          id="party-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mt-1.5 h-12 w-full rounded-xl border border-[#D0D5DD] px-3.5 text-[15px] text-[#1C3053] outline-none transition focus:border-[#035C6C] focus:ring-4 focus:ring-[#035C6C]/10"
        />
        <p className="mt-1.5 text-xs text-[#98A2B3]">
          Past this date with money still due, the account is marked Defaulter automatically. Without one, that happens after {DEFAULT_CREDIT_DAYS} days with no payment.
        </p>

        {error ? <p className="mt-3 text-sm font-semibold text-[#DC2626]">{error}</p> : null}

        <div className="mt-5 flex gap-2.5">
          <button type="button" onClick={onClose} disabled={saving} className="h-11 flex-1 rounded-xl border border-[#D0D5DD] bg-white text-sm font-bold text-[#344054] transition hover:bg-[#F8F8F8]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !valid}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#F3BF23] text-[#1E1E1E] hover:bg-[#E5B11A] text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Add {noun}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CashBookReportPage() {
  const router = useRouter();
  // loginScope comes straight from the real session (src/lib/shopAuth.js,
  // set at login by src/lib/shopMobileAuth.js): 'OWNER' for a personal-
  // number login vs 'SHOP' for the shop's own shared-number login (e.g. a
  // counter clerk). The cash book is gated on that real field — same
  // read/subscribe pattern src/app/shop-home/account/profile/page.js
  // already uses — not a fabricated permission check.
  const [shopOwner, setShopOwner] = useState(null);
  useEffect(() => {
    setShopOwner(readShopOwner());
    const unsub = subscribe((session) => setShopOwner(session));
    return unsub;
  }, []);
  const ownerOnlyRestricted = shopOwner?.loginScope === 'SHOP';

  // Real Customer/Supplier ledger state. Each tab fetches its own party list
  // independently (partyType=CUSTOMER vs partyType=SUPPLIER) — never mixed.
  const [tab, setTab] = useState('CUSTOMER');
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [statements, setStatements] = useState({});
  const [statementLoadingId, setStatementLoadingId] = useState(null);
  const [statementErrors, setStatementErrors] = useState({});
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (ownerOnlyRestricted) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    setExpandedId(null);
    fetchLedgerParties(tab)
      .then((list) => {
        if (alive) setParties(list);
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load the cash book.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tab, reloadKey, ownerOnlyRestricted]);

  const netBalance = useMemo(() => parties.reduce((sum, p) => sum + (Number(p.balance) || 0), 0), [parties]);
  const accountCount = parties.length;
  // Defaulters first (most days late first), the rest in the server's order.
  const sortedParties = useMemo(() => {
    const withStatus = parties.map((p, i) => ({ p, i, s: ledgerPaymentStatus(p) }));
    return withStatus
      .sort((a, b) => {
        const da = a.s.status === 'defaulter' ? 1 : 0;
        const db = b.s.status === 'defaulter' ? 1 : 0;
        if (da !== db) return db - da;
        if (da && db) return b.s.daysLate - a.s.daysLate;
        return a.i - b.i;
      })
      .map((x) => x.p);
  }, [parties]);
  const defaulterCount = useMemo(() => parties.filter((p) => ledgerPaymentStatus(p).status === 'defaulter').length, [parties]);

  function toggleParty(party) {
    const nextId = expandedId === party.id ? null : party.id;
    setExpandedId(nextId);
    if (nextId && !statements[nextId] && statementLoadingId !== nextId) {
      setStatementLoadingId(nextId);
      setStatementErrors((prev) => ({ ...prev, [nextId]: '' }));
      fetchLedgerPartyStatement(nextId)
        .then((data) => {
          setStatements((prev) => ({ ...prev, [nextId]: data }));
        })
        .catch((err) => {
          setStatementErrors((prev) => ({ ...prev, [nextId]: err.message || 'Could not load the statement.' }));
        })
        .finally(() => {
          setStatementLoadingId((cur) => (cur === nextId ? null : cur));
        });
    }
  }

  return (
    <div className="flex flex-col gap-5" style={{ background: '#FFFFFF' }}>
      <PageHeader title="Cash Book" subtitle="Manage cash-in and cash-out records." />

      {/* ---- Summary cards -------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CASH_CARDS.map((c) => (
          <CashCard key={c.key} icon={c.icon} watermark={c.watermark} label={c.label} tone={c.tone} />
        ))}
      </div>

      {/* ---- Content panel ---------------------------------------------- */}
      <section
        className="rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-5 sm:p-6"
        style={{ border: '1px solid rgba(15, 80, 60, 0.06)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Back"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#344054] transition hover:border-[#035C6C] hover:text-[#035C6C]"
            >
              <ArrowLeft className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
            <p className="truncate text-[16px] font-bold text-[#1C3053]">Cash Book</p>
          </div>
          {/* Real disabled control, not a fake live button — there's no
              cash-book ledger data source anywhere to actually open/export. */}
          <button
            type="button"
            disabled
            title="Cash book ledger export isn't available yet."
            aria-label="Ledger (not available yet)"
            className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-gradient-to-br from-[#035C6C] to-[#035C6C] text-white opacity-60"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Customer/Supplier are now both real, independently-fetched tabs
            (see the effect above — switching tab re-fetches that party
            type, never mixing the two arrays). Today/This Week/Month stay
            plain, non-interactive labels — no date-filtered variant of
            /ledger-parties has been confirmed to exist. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[
            { value: 'CUSTOMER', label: 'Customer' },
            { value: 'SUPPLIER', label: 'Supplier' },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-pressed={tab === t.value}
              className={cx(
                'rounded-full px-4 py-2 text-xs font-bold transition',
                tab === t.value
                  ? 'bg-gradient-to-r from-[#035C6C] to-[#024A57] text-white'
                  : 'bg-[#F8F8F8] text-[#344054] hover:bg-[#F3F3F3] hover:text-[#024A57]',
              )}
            >
              {t.label}
            </button>
          ))}
          {['Today', 'This Week', 'Month'].map((label) => (
            <span key={label} className="rounded-full bg-[#F8F8F8] px-4 py-2 text-xs font-bold text-[#344054]">
              {label}
            </span>
          ))}
        </div>

        {ownerOnlyRestricted ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-red-700">The cash book is available to the shop owner only.</p>
          </div>
        ) : (
          <>
            {/* Net Balance card — real values: sum of every loaded party's
                real `balance`, and a real account count. Filter/sort icon
                stays honestly disabled — no sort/filter param has been
                confirmed on GET /ledger-parties. */}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[#F3F3F3] px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1C3053]">Net Balance</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#5C7A6D]">
                  {accountCount} {accountCount === 1 ? 'Account' : 'Accounts'}
                  {defaulterCount ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FEE4E2] px-2 py-0.5 text-[0.68rem] font-extrabold text-[#B42318]">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {defaulterCount} {defaulterCount === 1 ? 'Defaulter' : 'Defaulters'}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-extrabold leading-none text-[#1C3053]">{inr(netBalance)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#5C7A6D]">{netBalance === 0 ? 'Settled' : 'Due'}</p>
                </div>
                <button
                  type="button"
                  disabled
                  title="Filtering or sorting accounts isn't available yet."
                  aria-label="Filter or sort (not available yet)"
                  className="flex h-8 w-8 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#5C7A6D]"
                >
                  <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-[#1C3053]">Accounts</p>
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#F3BF23] px-3.5 py-2 text-xs font-bold text-[#1E1E1E] transition hover:brightness-105 hover:bg-[#E5B11A]"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Add {tab === 'SUPPLIER' ? 'Supplier' : 'Customer'}
              </button>
            </div>

            {/* Loading / error / empty / real-list — four genuinely distinct
                states, not "every problem collapses into the empty state":
                a fetch failure shows ErrorBanner (with Retry re-running the
                effect via reloadKey), and "No customers/suppliers yet" only
                renders once loading is false, error is empty, AND the real
                response array is actually empty. */}
            {loading ? (
              <div className="mt-4 space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[64px] animate-pulse rounded-2xl bg-[#F8F8F8]" />
                ))}
              </div>
            ) : error ? (
              <div className="mt-4">
                <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />
              </div>
            ) : parties.length === 0 ? (
              <EmptyState
                icon={Users}
                title={tab === 'SUPPLIER' ? 'No suppliers yet' : 'No customers yet'}
                description={`${tab === 'SUPPLIER' ? 'Supplier' : 'Customer'} cash-book entries will show up here once available.`}
              />
            ) : (
              <div className="mt-4 divide-y divide-[#ECECEC] rounded-[16px] border border-[#ECECEC]">
                {sortedParties.map((party) => (
                  <PartyRow
                    key={party.id}
                    party={party}
                    expanded={expandedId === party.id}
                    onToggle={() => toggleParty(party)}
                    statement={statements[party.id]}
                    statementLoading={statementLoadingId === party.id}
                    statementError={statementErrors[party.id]}
                    onPartyUpdated={() => setReloadKey((k) => k + 1)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {adding ? (
        <AddPartyModal
          partyType={tab}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            setReloadKey((k) => k + 1);
          }}
        />
      ) : null}
    </div>
  );
}
