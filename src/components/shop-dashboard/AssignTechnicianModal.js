'use client';

/**
 * AssignTechnicianModal — pick one of the shop's technicians (GET
 * {TICKET_BASE}/technicians) and assign them to a booking's repair ticket
 * (assignTicketTechnician -> PATCH {TICKET_BASE}/tickets/{id}). Used by the
 * Bookings list's "Assign" action and the Device Details page.
 *
 * onAssigned(ticket) receives the updated TicketResponse so the caller can
 * refresh its own view without a full reload.
 */

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Search, UserCog, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { assignTicketTechnician, fetchTechnicians } from '@/lib/shopDashboard';
import { notifyError, notifySuccess } from '@/lib/toast';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase() : '?';
}

export default function AssignTechnicianModal({ open, ticketId, currentTechnicianId, bookingLabel, onClose, onAssigned }) {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setLoading(true);
    setLoadError('');
    setQuery('');
    setSelected(currentTechnicianId ? String(currentTechnicianId) : null);
    fetchTechnicians()
      .then((list) => alive && setTechnicians(list))
      .catch((err) => alive && setLoadError(err.message || 'Could not load technicians.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, currentTechnicianId]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !saving && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...technicians].sort((a, b) => Number(b.isAvailable !== false) - Number(a.isAvailable !== false) || String(a.name).localeCompare(String(b.name)));
    return q ? list.filter((t) => [t.name, t.roleLabel, t.phone].some((v) => String(v || '').toLowerCase().includes(q))) : list;
  }, [technicians, query]);

  if (!open) return null;

  const unchanged = selected && currentTechnicianId && String(selected) === String(currentTechnicianId);

  async function assign() {
    if (!selected || !ticketId) return;
    setSaving(true);
    try {
      const ticket = await assignTicketTechnician(ticketId, selected);
      onAssigned?.(ticket);
      notifySuccess('Technician assigned');
      onClose();
    } catch (err) {
      notifyError(err, 'Could not assign the technician.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0B1739]/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={() => !saving && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-tech-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[22px] pb-[env(safe-area-inset-bottom)] sm:pb-0 bg-white shadow-[0_24px_60px_rgba(11,23,57,0.25)] sm:rounded-[22px]"
      >
        <div className="flex items-start gap-3 border-b border-[#ECECEC] px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F3F3] text-[#035C6C]">
            <UserCog className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="assign-tech-title" className="text-[17px] font-extrabold text-[#111111]">
              Assign Technician
            </h2>
            {bookingLabel ? <p className="truncate text-[12.5px] text-[#666666]">{bookingLabel}</p> : null}
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded-full p-1.5 text-[#98A2B3] hover:bg-[#F3F3F3] hover:text-[#344054]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-[#ECECEC] px-3 focus-within:border-[#035C6C]">
            <Search className="h-4 w-4 text-[#98A2B3]" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search technicians"
              aria-label="Search technicians"
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#98A2B3]"
            />
          </label>
        </div>

        <div className="min-h-[160px] flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-[13.5px] text-[#98A2B3]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Loading technicians…
            </div>
          ) : loadError ? (
            <p className="rounded-xl bg-[#FEF3F2] p-3 text-[13px] text-[#B42318]">{loadError}</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-[13.5px] text-[#666666]">
              {technicians.length ? 'No technicians match your search.' : 'No technicians yet — add one under Team.'}
            </p>
          ) : (
            <ul role="radiogroup" aria-label="Technicians" className="space-y-2">
              {filtered.map((t) => {
                const id = String(t.id);
                const isSel = selected === id;
                const unavailable = t.isAvailable === false;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSel}
                      onClick={() => setSelected(id)}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-xl border-[1.5px] px-3 py-2.5 text-left transition',
                        isSel ? 'border-[#035C6C] bg-[#F3F3F3]' : 'border-[#ECECEC] hover:border-[#ECECEC]',
                      )}
                    >
                      {t.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote profile photo.
                        <img src={t.photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#035C6C] to-[#024A57] text-[13px] font-bold text-white">
                          {initials(t.name)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-[#111111]">
                          {t.name || 'Technician'}
                          {String(currentTechnicianId || '') === id ? <span className="ml-1.5 text-[11.5px] font-semibold text-[#035C6C]">(current)</span> : null}
                        </span>
                        <span className="block truncate text-[12px] text-[#666666]">{[t.roleLabel, t.phone].filter(Boolean).join(' · ') || 'Technician'}</span>
                      </span>
                      <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase', unavailable ? 'bg-[#F3F3F3] text-[#98A2B3]' : 'bg-[#F3F3F3] text-[#024A57]')}>
                        {unavailable ? 'Unavailable' : 'Available'}
                      </span>
                      {isSel ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#035C6C]" aria-hidden="true" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-[#ECECEC] px-5 py-4">
          <div className="flex gap-2.5">
            <button type="button" onClick={onClose} disabled={saving} className="h-11 flex-1 rounded-xl border border-[#ECECEC] text-[14px] font-bold text-[#344054] hover:bg-[#F8F8F8]">
              Cancel
            </button>
            <button
              type="button"
              onClick={assign}
              disabled={!selected || unchanged || saving}
              className="inline-flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#F3BF23] text-[#1E1E1E] hover:bg-[#E5B11A] text-[14px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserCog className="h-4 w-4" aria-hidden="true" />}
              {saving ? 'Assigning…' : unchanged ? 'Already assigned' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
