'use client';

/**
 * ServiceStatusSheet — "Update Service Status" for one booking's repair
 * ticket. Web port of the Partner app's ServiceStatusSheet
 * (screens/owner/AllBooking/BookingActionSheets.js), same flow and calls:
 *
 *   - Status Type first (Regular Service / Return Device), then only the NEXT
 *     stage of that flow plus Repair Cancelled — never the whole list.
 *   - What's done is read from the ticket's timeline on every open
 *     (GET /tickets/{id}/events); the lifecycle status counts too.
 *   - Saving POSTs /tickets/{id}/progress-events { statusKey, actor: OWNER }.
 *   - Invoice Generated is never written from here: it's earned by
 *     saving an invoice in the Invoice Generator
 *     (/shop-home/services/invoice/generate), which that stage links to.
 *
 * Bottom sheet on phones, centered dialog from sm up. A successful save shows
 * a "Status updated" toast, then onUpdated() fires so the caller can re-fetch.
 */

import { useEffect, useState } from 'react';
import Link from '@/components/PortalLink';
import { ChevronDown, Loader2, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { fetchTicketEvents, recordTicketStatus } from '@/lib/shopDashboard';
import { notifyError, notifySuccess } from '@/lib/toast';

const STATUS_TYPES = [
  {
    key: 'REGULAR',
    label: 'Regular Service',
    hint: 'Repaired — going out to the customer',
    historyGroup: 'Working Pending',
    stages: [
      [{ key: 'READY', label: 'Ready for Delivery' }],
      [{ key: 'INVOICE_GENERATED', label: 'Invoice Generated', action: 'INVOICE' }],
      [{ key: 'DELIVERED', label: 'Delivered to Customer' }],
    ],
  },
  {
    key: 'RETURN',
    label: 'Return Device',
    hint: 'Not repaired — going back as it came',
    historyGroup: 'Return Device',
    stages: [
      [
        { key: 'CUSTOMER_REJECTED', label: 'Customer Rejected' },
        { key: 'REPAIR_NOT_COMPLETED', label: 'Repair Not Completed' },
      ],
      [{ key: 'RETURN_DELIVERY', label: 'Return Delivery' }],
      [{ key: 'INVOICE_GENERATED', label: 'Invoice Generated', action: 'INVOICE' }],
      [{ key: 'DELIVERED', label: 'Delivered to Customer' }],
    ],
  },
];
const RETURN_KEYS = ['CUSTOMER_REJECTED', 'REPAIR_NOT_COMPLETED', 'RETURN_DELIVERY'];
const CANCEL_OPTION = { key: 'CANCELLED', label: 'Repair Cancelled' };
const TERMINAL_KEYS = ['DELIVERED', 'CANCELLED'];

const CONFIRM_BEFORE = {
  CANCELLED: {
    message: "This moves the booking to Repair Cancelled. Cancelled bookings can't be moved to another status afterwards.",
    confirmText: 'Cancel repair',
    destructive: true,
  },
  DELIVERED: {
    message: "This records Delivered to Customer on the customer's Service History and closes the booking.",
    confirmText: 'Mark delivered',
  },
};

function nextOptionsFor(type, completed) {
  if (TERMINAL_KEYS.some((k) => completed.has(k))) return [];
  const stage = type.stages.find((opts) => !opts.some((o) => completed.has(o.key)));
  return stage ? [...stage, CANCEL_OPTION] : [CANCEL_OPTION];
}

function completedLabelFor(type, completed) {
  let label = null;
  type.stages.forEach((opts) => {
    const hit = opts.find((o) => completed.has(o.key));
    if (hit) label = hit.label;
  });
  if (completed.has('CANCELLED')) label = CANCEL_OPTION.label;
  return label;
}

function SelectField({ label, value, options, onChange, disabled, hint }) {
  const id = `sss-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#98A2B3]">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-[52px] w-full cursor-pointer appearance-none rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] pl-4 pr-11 text-[15px] font-extrabold text-[#111111] outline-none transition focus:border-[#035C6C] focus:ring-4 focus:ring-[#035C6C]/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8FA08F]" aria-hidden="true" />
      </div>
      {hint ? <p className="mt-1 text-[12px] text-[#666666]">{hint}</p> : null}
    </div>
  );
}

export default function ServiceStatusSheet({ open, ticketId, bookingRef, lifecycleStatus, statusLabel, onClose, onUpdated }) {
  const [shown, setShown] = useState(false);
  const [typeKey, setTypeKey] = useState('REGULAR');
  const [statusKey, setStatusKey] = useState(null);
  const [completed, setCompleted] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open || !ticketId) return undefined;
    let alive = true;
    setStatusKey(null);
    setConfirming(false);
    setSaving(false);
    setLoading(true);
    fetchTicketEvents(ticketId)
      .then((rows) => {
        const keys = new Set(rows.map((e) => String(e.status || '').toUpperCase()));
        const lifecycle = String(lifecycleStatus || '').toUpperCase();
        if (TERMINAL_KEYS.includes(lifecycle)) keys.add(lifecycle);
        if (!alive) return;
        setCompleted(keys);
        setTypeKey(RETURN_KEYS.some((k) => keys.has(k)) ? 'RETURN' : 'REGULAR');
      })
      .catch(() => alive && setCompleted(new Set()))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, ticketId, lifecycleStatus]);

  // Slide/fade in after mount.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return undefined;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !saving && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const type = STATUS_TYPES.find((t) => t.key === typeKey) || STATUS_TYPES[0];
  const options = nextOptionsFor(type, completed);
  const status = options.find((o) => o.key === statusKey) || options[0] || null;
  const currentLabel = completedLabelFor(type, completed) || statusLabel;
  const finished = options.length === 0;
  const ask = status ? CONFIRM_BEFORE[status.key] : null;
  const invoiceStep = status?.action === 'INVOICE';

  async function submit() {
    if (!ticketId || saving || !status || invoiceStep) return;
    if (ask && !confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    try {
      await recordTicketStatus(ticketId, status.key);
      notifySuccess('Status updated');
      onUpdated?.();
      onClose();
    } catch (err) {
      notifyError(err, 'Could not update the status. Please try again.');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={cx(
        'fixed inset-0 z-[60] flex items-end justify-center bg-[#0B1739]/50 transition-opacity duration-200 sm:items-center sm:p-4',
        shown ? 'opacity-100' : 'opacity-0',
      )}
      onMouseDown={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sss-title"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          'relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[30px] pb-[env(safe-area-inset-bottom)] sm:pb-0 bg-white transition-transform duration-300 ease-out sm:max-w-[560px] sm:rounded-[28px] lg:max-w-[760px] lg:rounded-xl',
          shown ? 'translate-y-0' : 'translate-y-full sm:translate-y-4',
        )}
      >
        <span className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-[#F3F3F3]" aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[#98A2B3] transition hover:bg-[#F3F3F3] hover:text-[#344054]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="overflow-y-auto px-5 pb-6 pt-3 sm:px-7 sm:pb-7">
          <h2 id="sss-title" className="text-[20px] font-extrabold tracking-tight text-[#111111]">
            Update Service Status
          </h2>
          {bookingRef ? <p className="mt-0.5 text-[13.5px] text-[#666666]">Booking {bookingRef}</p> : null}

          {currentLabel ? (
            <div className="mt-4 rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] px-4 py-3">
              <p className="text-[12px] text-[#666666]">Current status</p>
              <p className="mt-0.5 truncate text-[16px] font-extrabold text-[#111111]">{currentLabel}</p>
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center py-10 text-[#666666]">
              <Loader2 className="h-6 w-6 animate-spin text-[#035C6C]" aria-hidden="true" />
              <p className="mt-2 text-[12.5px]">Checking what&apos;s next…</p>
            </div>
          ) : finished ? (
            <div className="px-2 py-8 text-center">
              <p className="text-[15px] font-extrabold text-[#111111]">This booking is closed</p>
              <p className="mt-1 text-[13px] text-[#666666]">
                {completed.has('CANCELLED')
                  ? 'The repair was cancelled — there is no further status to record.'
                  : 'The device is with the customer — there is no further status to record.'}
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <SelectField
                label="Status Type"
                value={type.key}
                options={STATUS_TYPES}
                hint={type.hint}
                disabled={saving}
                onChange={(key) => {
                  setTypeKey(key);
                  setStatusKey(null);
                  setConfirming(false);
                }}
              />
              <SelectField
                label="Status"
                value={status?.key || ''}
                options={options}
                disabled={saving}
                onChange={(key) => {
                  setStatusKey(key);
                  setConfirming(false);
                }}
              />

              {confirming && ask ? (
                <p className={cx('rounded-xl px-3.5 py-3 text-[13px] font-semibold', ask.destructive ? 'bg-[#FEF3F2] text-[#B42318]' : 'bg-[#F3F3F3] text-[#024A57]')}>
                  {ask.message}
                </p>
              ) : null}

              <button
                type="button"
                onClick={submit}
                disabled={saving || !status || invoiceStep}
                className={cx(
                  'inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold text-white transition',
                  saving || !status || invoiceStep
                    ? 'cursor-not-allowed bg-[#F3F3F3]'
                    : confirming && ask?.destructive
                      ? 'bg-[#D92D20] hover:bg-[#B42318]'
                      : 'bg-[#035C6C] hover:bg-[#024A57]',
                )}
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
                {confirming && ask ? ask.confirmText : 'Update Status'}
              </button>

              {invoiceStep ? (
                <Link
                  href={`/shop-home/services/invoice/generate/?ticketId=${encodeURIComponent(ticketId || '')}`}
                  className="inline-flex h-[50px] w-full items-center justify-center rounded-2xl border-2 border-[#035C6C] text-[15px] font-extrabold text-[#035C6C] transition hover:bg-[#E5F3F5]"
                >
                  Open Invoice Generator
                </Link>
              ) : null}

              <p className="text-center text-[12px] text-[#666666]">
                {invoiceStep
                  ? 'Invoice Generated is recorded when the invoice is saved in the Invoice Generator.'
                  : `Recorded on the customer's Service History under ${type.historyGroup}.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
