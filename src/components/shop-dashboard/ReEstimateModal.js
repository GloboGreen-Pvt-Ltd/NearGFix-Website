'use client';

/**
 * ReEstimateModal — revise the service lines / price on a booking's repair
 * ticket. The web counterpart of the Partner app's Re-Est edit flow: loads
 * the ticket fresh (GET /tickets/{id}), edits its priceItemsJson lines, and
 * saves through reEstimateTicket() (src/lib/shopDashboard.js), which re-sends
 * every other ticket field unchanged. Used by the Requote page's "Re-Est".
 *
 * onSaved(ticket) receives the updated TicketResponse; the caller re-fetches
 * so the Re-Estimated tab reflects the backend's new status.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { fetchTicket, reEstimateTicket } from '@/lib/shopDashboard';
import { notifyError } from '@/lib/toast';

const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

let lineSeq = 0;
const newKey = () => `line-${(lineSeq += 1)}`;

/** priceItemsJson -> editable lines; falls back to one line from the ticket's summary + estimate. */
function linesFromTicket(ticket) {
  let parsed = [];
  try {
    const p = ticket.priceItemsJson ? JSON.parse(ticket.priceItemsJson) : [];
    if (Array.isArray(p)) parsed = p;
  } catch {
    parsed = [];
  }
  if (parsed.length) {
    return parsed.map((it) => ({
      key: newKey(),
      id: it.id || it.serviceId || null,
      code: it.code || it.serviceCode || null,
      label: it.label || it.serviceName || it.name || 'Service',
      amount: String(Math.round(Number(it.amount ?? it.price ?? it.estimatedPrice) || 0)),
      warranty: it.warranty || null,
    }));
  }
  if (ticket.repairServicesSummary || ticket.estimatedPrice != null) {
    return [
      {
        key: newKey(),
        id: null,
        code: null,
        label: ticket.repairServicesSummary || 'Service',
        amount: String(Math.round(Number(ticket.estimatedPrice) || 0)),
        warranty: null,
      },
    ];
  }
  return [];
}

const toItems = (lines) =>
  lines.map((l) => ({ id: l.id, code: l.code, label: l.label.trim(), amount: Number(l.amount) || 0, warranty: l.warranty }));

export default function ReEstimateModal({ open, ticketId, bookingLabel, onClose, onSaved }) {
  const [ticket, setTicket] = useState(null);
  const [lines, setLines] = useState([]);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !ticketId) return undefined;
    let alive = true;
    setLoading(true);
    setLoadError('');
    setTicket(null);
    fetchTicket(ticketId)
      .then((t) => {
        if (!alive) return;
        setTicket(t);
        setLines(linesFromTicket(t));
        setApproved(Boolean(t.customerApproval));
      })
      .catch((err) => alive && setLoadError(err.message || 'Could not load this booking’s estimate.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, ticketId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !saving && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  const original = useMemo(() => (ticket ? JSON.stringify(toItems(linesFromTicket(ticket))) : ''), [ticket]);
  const total = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const previousTotal = ticket ? Number(ticket.estimatedPrice) || 0 : 0;
  const paid = ticket ? Number(ticket.paymentAmount) || 0 : 0;

  const invalid = !lines.length
    ? 'Add at least one service.'
    : lines.some((l) => !l.label.trim())
      ? 'Every service needs a name.'
      : paid > total
        ? `The new total can't be less than the ${inr(paid)} already collected.`
        : '';
  // Only a change to the services/price is a re-estimate (it's what moves the ticket to QUOTED).
  const changed = ticket && (JSON.stringify(toItems(lines)) !== original || total !== previousTotal);

  if (!open) return null;

  function setLine(key, field, value) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  async function save() {
    if (!ticket || invalid || !changed) return;
    setSaving(true);
    try {
      const saved = await reEstimateTicket(ticket, { items: toItems(lines), customerApproval: approved });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      notifyError(err, 'Could not save the re-estimate.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0B1739]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={() => !saving && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="re-est-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[22px] pb-[env(safe-area-inset-bottom)] sm:pb-0 bg-white shadow-[0_24px_60px_rgba(11,23,57,0.25)] sm:rounded-[22px]"
      >
        <div className="flex items-start gap-3 border-b border-[#ECECEC] px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F3F3] text-[#035C6C]">
            <Pencil className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="re-est-title" className="text-[17px] font-extrabold text-[#111111]">
              Re-Estimate
            </h2>
            {bookingLabel ? <p className="truncate text-[12.5px] text-[#666666]">{bookingLabel}</p> : null}
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded-full p-1.5 text-[#98A2B3] hover:bg-[#F3F3F3] hover:text-[#344054]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-[180px] flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-[#666666]">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            </div>
          ) : loadError ? (
            <p className="rounded-xl bg-[#FEF3F2] px-3.5 py-3 text-[13px] font-semibold text-[#B42318]">{loadError}</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-[#666666]">Services &amp; price</p>
                <div className="space-y-2">
                  {lines.map((l) => (
                    <div key={l.key} className="flex items-center gap-2">
                      <input
                        value={l.label}
                        onChange={(e) => setLine(l.key, 'label', e.target.value)}
                        placeholder="Service name"
                        aria-label="Service name"
                        className="h-11 min-w-0 flex-1 rounded-xl border border-[#ECECEC] px-3 text-[14px] text-[#111111] outline-none focus:border-[#035C6C]"
                      />
                      <label className="flex h-11 w-[120px] shrink-0 items-center gap-1 rounded-xl border border-[#ECECEC] px-3 focus-within:border-[#035C6C]">
                        <span className="text-[14px] font-semibold text-[#666666]">₹</span>
                        <input
                          value={l.amount}
                          onChange={(e) => setLine(l.key, 'amount', e.target.value.replace(/\D/g, '').slice(0, 7))}
                          inputMode="numeric"
                          placeholder="0"
                          aria-label="Price"
                          className="min-w-0 flex-1 bg-transparent text-right text-[14px] font-bold text-[#111111] outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                        aria-label={`Remove ${l.label || 'service'}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#ECECEC] text-[#98A2B3] transition hover:border-[#FDA29B] hover:text-[#D92D20]"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setLines((prev) => [...prev, { key: newKey(), id: null, code: null, label: '', amount: '', warranty: null }])}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#ECECEC] px-3 py-2 text-[13px] font-bold text-[#024A57] transition hover:bg-[#F8F8F8]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add service
                </button>
              </div>

              <div className="space-y-1.5 rounded-2xl bg-[#F8F8F8] p-3.5 text-[13.5px]">
                <p className="flex justify-between text-[#666666]">
                  <span>Previous estimate</span>
                  <span className="font-semibold">{inr(previousTotal)}</span>
                </p>
                {paid > 0 ? (
                  <p className="flex justify-between text-[#666666]">
                    <span>Already collected{ticket?.paymentType ? ` (${String(ticket.paymentType).toLowerCase()})` : ''}</span>
                    <span className="font-semibold">{inr(paid)}</span>
                  </p>
                ) : null}
                <p className="flex justify-between text-[15px] font-extrabold text-[#111111]">
                  <span>New estimate</span>
                  <span>{inr(total)}</span>
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#ECECEC] px-3.5 py-3">
                <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="h-4 w-4 accent-[#035C6C]" />
                <span className="text-[13.5px] font-semibold text-[#111111]">Customer approved this estimate</span>
              </label>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-[#ECECEC] px-5 py-4">
          {!loading && !loadError && invalid ? (
            <p className="text-[12.5px] font-semibold text-[#B42318]">{invalid}</p>
          ) : !loading && !loadError && !changed ? (
            <p className="text-[12.5px] text-[#666666]">Change a service or price to re-estimate.</p>
          ) : null}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-11 flex-1 rounded-xl border border-[#ECECEC] bg-white text-[14px] font-bold text-[#344054] transition hover:bg-[#F8F8F8]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading || Boolean(loadError) || Boolean(invalid) || !changed}
              className={cx(
                'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white transition',
                saving || loading || loadError || invalid || !changed ? 'cursor-not-allowed bg-[#F3F3F3]' : 'bg-[#035C6C] hover:bg-[#024A57]',
              )}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Save Re-Estimate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
