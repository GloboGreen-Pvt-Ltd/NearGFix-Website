'use client';

/**
 * RescheduleModal — "Re-Schedule" on a Bookings card: move the booking's
 * delivery date/time.
 *
 * Shows, read-only, when it was Booked On and the Delivery time currently on
 * record (the repair ticket's estimatedDeliveryAt, read fresh with GET
 * /tickets/{id}; when none is saved, the same estimate the Details page shows
 * — booked time + duration + 2 h — labelled as an estimate). The one editable
 * field is the updated delivery date & time, saved through
 * updateTicketSchedule() (PUT /tickets/{id}, only estimatedDeliveryAt changes,
 * status untouched). onSaved(ticket) gets the updated ticket.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarCheck, CalendarClock, Loader2, X } from 'lucide-react';

import { fetchTicket, updateTicketSchedule } from '@/lib/shopDashboard';
import { notifyError, notifySuccess } from '@/lib/toast';

/** Date -> the "YYYY-MM-DDTHH:mm" a datetime-local input takes (local time). */
function toLocalInput(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDate(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

const fmt = (d) => (d ? d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

function ReadOnlyRow({ icon: Icon, label, value, caption }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#ECECEC] bg-[#F8F8F8] px-3.5 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E5F3F5] text-[#035C6C]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#666666]">{label}</p>
        <p className="text-[14px] font-bold text-[#111111]">{value}</p>
        {caption ? <p className="text-[11.5px] text-[#98A2B3]">{caption}</p> : null}
      </div>
    </div>
  );
}

const INPUT_CLS =
  'mt-1.5 w-full rounded-xl border border-[#ECECEC] bg-white px-3 py-2.5 text-[14px] font-semibold normal-case tracking-normal text-[#111111] focus:border-[#035C6C] focus:outline-none focus:ring-4 focus:ring-[#035C6C]/10 disabled:bg-[#F8F8F8]';

export default function RescheduleModal({ open, ticketId, bookingLabel, bookedAt, durationHours, onClose, onSaved }) {
  const [current, setCurrent] = useState({ booked: null, delivery: null, estimated: false });
  const [nextDelivery, setNextDelivery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !ticketId) return undefined;
    let alive = true;
    setErr('');
    setNextDelivery('');
    setCurrent({ booked: toDate(bookedAt), delivery: null, estimated: false });
    setLoading(true);
    fetchTicket(ticketId)
      .then((t) => {
        if (!alive) return;
        const booked = toDate(bookedAt) || toDate(t?.createdAt);
        const saved = toDate(t?.estimatedDeliveryAt);
        const hours = Number(durationHours) || 2;
        const estimate = booked ? new Date(booked.getTime() + (hours + 2) * 3600 * 1000) : null;
        setCurrent({ booked, delivery: saved || estimate, estimated: !saved });
      })
      .catch((e) => alive && setErr(e?.message || 'Could not load the current schedule.'))
      .finally(() => alive && setLoading(false));
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticketId]);

  if (!open || typeof document === 'undefined') return null;

  async function save() {
    if (!nextDelivery) {
      setErr('Pick the updated delivery date & time.');
      return;
    }
    const deliveryAt = new Date(nextDelivery);
    if (current.booked && deliveryAt < current.booked) {
      setErr('Delivery can’t be before the booking date.');
      return;
    }
    if (!window.confirm(`Move delivery to ${fmt(deliveryAt)}?`)) return;
    setSaving(true);
    setErr('');
    try {
      const ticket = await updateTicketSchedule(ticketId, { estimatedDeliveryAt: deliveryAt.toISOString() });
      notifySuccess('Delivery time updated');
      onSaved?.(ticket);
      onClose();
    } catch (e) {
      notifyError(e, 'Could not update the delivery time.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111111]/60 p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Re-Schedule"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-[22px] lg:max-w-3xl lg:rounded-xl bg-white p-5 shadow-[0_24px_60px_rgba(16,24,40,0.25)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-extrabold text-[#111111]">Re-Schedule</h2>
            <p className="mt-0.5 truncate text-[13px] text-[#666666]">{bookingLabel || 'Move the delivery date & time.'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3] text-[#344054] hover:bg-[#ECECEC]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="lg:mt-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="mt-5 space-y-2.5 lg:mt-0">
          <ReadOnlyRow icon={CalendarCheck} label="Booked On" value={fmt(current.booked)} />
          <ReadOnlyRow
            icon={CalendarClock}
            label="Current Delivery"
            value={loading ? 'Loading…' : fmt(current.delivery)}
            caption={!loading && current.delivery && current.estimated ? 'Estimate — not saved yet' : null}
          />
        </div>

        <div>
        <label className="mt-5 block lg:mt-0 text-[12px] font-bold uppercase tracking-wide text-[#666666]">
          Updated delivery date &amp; time
          <input
            type="datetime-local"
            value={nextDelivery}
            min={toLocalInput(current.booked) || undefined}
            disabled={loading}
            onChange={(e) => setNextDelivery(e.target.value)}
            className={INPUT_CLS}
          />
        </label>
        </div>
        </div>
        {err ? <p className="mt-3 text-[13px] font-semibold text-[#B42318]">{err}</p> : null}

        <div className="mt-6 flex gap-2 lg:justify-end">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border lg:w-40 lg:flex-none border-[#ECECEC] bg-white text-[14px] font-bold text-[#344054] hover:bg-[#F8F8F8]">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="inline-flex h-11 flex-1 items-center lg:w-48 lg:flex-none justify-center gap-2 rounded-xl bg-[#035C6C] text-[14px] font-bold text-white transition hover:bg-[#024A57] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Update delivery'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
