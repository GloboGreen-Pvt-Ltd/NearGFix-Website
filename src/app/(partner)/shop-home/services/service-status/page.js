'use client';

/**
 * /shop-home/services/service-status — active repair-ticket progress
 * tracker, with a per-ticket stage timeline.
 *
 * Reads GET {TICKET_BASE}/tickets via fetchTicketsPaged() (src/lib/shopDashboard.js).
 * The timeline stages come from src/lib/ticketStatus.js — see that file's
 * header for why "Device Received" and "Quality Check" (both requested in
 * the original design brief) are intentionally not shown: no backend
 * ticket status represents either one, so a step for them could never
 * actually light up.
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Clock, FileClock, Package, RefreshCw, Wrench } from 'lucide-react';

import { cx } from '@/components/site/ui';
import Icon3D from '@/components/shop-dashboard/Icon3D';
import FilterChips from '@/components/shop-dashboard/FilterChips';
import SearchField, { FOCUS_RING } from '@/components/shop-dashboard/SearchField';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonRows, SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import { fetchTicketsPaged } from '@/lib/shopDashboard';
import { TICKET_STAGES, TICKET_STAGE_BADGE, ticketStageLabel, ticketStageProgress } from '@/lib/ticketStatus';

const FILTERS = ['All', ...TICKET_STAGES.map((s) => s.label), 'Cancelled'];

/** Small decorative empty-state graphic — a wrench + gear over a checklist, matching a reference design. Purely decorative. */
function ServiceStatusEmptyIllustration() {
  return (
    <svg viewBox="0 0 160 140" className="h-28 w-28" aria-hidden="true">
      <defs>
        <linearGradient id="ssEmptyGear" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#357D89" />
          <stop offset="1" stopColor="#035C6C" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="70" r="54" fill="#E5F3F5" opacity="0.6" />
      <ellipse cx="80" cy="118" rx="34" ry="7" fill="#024A57" opacity="0.1" />
      <circle cx="34" cy="40" r="4" fill="#C7E6EA" />
      <circle cx="128" cy="96" r="3.5" fill="#C7E6EA" />
      <rect x="50" y="44" width="44" height="56" rx="8" fill="white" stroke="#E5F3F5" strokeWidth="2" />
      <rect x="58" y="54" width="28" height="4" rx="2" fill="#E5F3F5" />
      <rect x="58" y="64" width="22" height="4" rx="2" fill="#E5F3F5" />
      <rect x="58" y="74" width="26" height="4" rx="2" fill="#E5F3F5" />
      <circle cx="100" cy="92" r="20" fill="url(#ssEmptyGear)" />
      <circle cx="100" cy="92" r="8" fill="white" opacity="0.9" />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <rect key={deg} x={97} y={92 - 26} width="6" height="10" rx="2" fill="url(#ssEmptyGear)" transform={`rotate(${deg} 100 92)`} />
      ))}
    </svg>
  );
}

// Page-local pastel KPI-card styling — not the shared StatCard (used by ~10
// other pages, unaffected): matches a reference design's pastel-gradient +
// glossy circular icon chip + large translucent background-glyph treatment,
// same approach as the redesigned Delivery/Pickups/Requote/Bookings pages.
const SERVICE_STATUS_STYLES = {
  green: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#035C6C] to-[#035C6C]',
    value: 'text-[#1C3053]',
    label: 'text-[#024A57]',
    wave: 'text-[#C7E6EA]',
    glow: 'bg-[#F3F3F3]',
  },
  orange: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#FB923C] to-[#FF7A1A]',
    value: 'text-[#1C3053]',
    label: 'text-[#9A5B27]',
    wave: 'text-[#FDBA74]',
    glow: 'bg-[#FDBA74]',
  },
  blue: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#38BDF8] to-[#1DA8E8]',
    value: 'text-[#1C3053]',
    label: 'text-[#1D6FA0]',
    wave: 'text-[#93D6F7]',
    glow: 'bg-[#93D6F7]',
  },
  purple: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#A78BFA] to-[#8B5CF6]',
    value: 'text-[#1C3053]',
    label: 'text-[#6D5A9E]',
    wave: 'text-[#C4B5FD]',
    glow: 'bg-[#C4B5FD]',
  },
};

function ServiceStatusStatCard({ icon: Icon, bgIcon: BgIcon, label, value, tone }) {
  const s = SERVICE_STATUS_STYLES[tone] || SERVICE_STATUS_STYLES.green;
  return (
    <div
      className={cx(
        'relative flex h-[178px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#ECECEC] p-4 sm:p-5',
        s.card,
      )}
    >
      <BgIcon className={cx('pointer-events-none absolute -bottom-7 -right-7 h-32 w-32 rotate-[-10deg] opacity-[0.28]', s.wave)} aria-hidden="true" />

      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
        <span
          className={cx(
            'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white',
            s.chip,
          )}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      </span>

      <p className={cx('relative mt-4 text-[30px] font-extrabold leading-none tracking-tight sm:text-[32px]', s.value)}>{value}</p>
      <p className={cx('relative mt-1.5 text-sm font-semibold', s.label)}>{label}</p>
    </div>
  );
}

export default function ServiceStatusPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetchTicketsPaged()
      .then((list) => {
        if (alive) setTickets(list);
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load service status.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const rows = useMemo(
    () =>
      tickets
        .filter((t) => String(t.status || '').toUpperCase() !== 'DELIVERED')
        .map((t) => ({ ...t, stageLabel: ticketStageLabel(t.status) }))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)),
    [tickets],
  );

  const counts = useMemo(() => {
    const c = { All: rows.length };
    FILTERS.forEach((f) => {
      if (f !== 'All') c[f] = 0;
    });
    rows.forEach((r) => {
      c[r.stageLabel] = (c[r.stageLabel] || 0) + 1;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'All' && r.stageLabel !== filter) return false;
      if (!q) return true;
      return (
        (r.trackingId || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.deviceDisplayName || '').toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query]);

  const stats = [
    { label: 'Active Services', value: rows.length, icon: Clock, bgIcon: Clock, tone: 'green' },
    { label: 'Awaiting Approval', value: counts['Quote Pending'] || 0, icon: Clock, bgIcon: FileClock, tone: 'orange' },
    { label: 'In Repair', value: counts['Repair In Progress'] || 0, icon: Clock, bgIcon: Wrench, tone: 'blue' },
    { label: 'Ready for Delivery', value: counts['Ready for Delivery'] || 0, icon: Clock, bgIcon: Package, tone: 'purple' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Hero — soft mint gradient banner with layered abstract waves + a
          decorative "SERVICE STATUS" clipboard/gear/wrench/phone/package
          illustration on the far right, matching the same premium design
          system as the other redesigned Partner Dashboard pages.
          Title/subtitle/Refresh are the exact same content/handler this page
          always had. */}
      <div className="relative overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-6 sm:p-7">

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[34px]">Service Status</h1>
            <p className="mt-1 text-[14px] text-[#666666] sm:text-[15px]">Track the current progress and status of active repair services.</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className={cx(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#ECECEC] bg-white px-4 py-2.5 text-sm font-semibold text-[#1C3053] transition hover:border-[#035C6C] hover:text-[#035C6C]',
              FOCUS_RING,
            )}
          >
            <RefreshCw className={cx('h-4 w-4 text-[#035C6C]', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
        </div>

      </div>

      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}

      {loading ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <ServiceStatusStatCard key={s.label} icon={s.icon} bgIcon={s.bgIcon} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </div>
      )}

      <section className="overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8]">
        <div className="flex flex-col gap-3.5 border-b border-[#ECECEC] px-5 py-5 sm:px-6">
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} counts={counts} />
          <SearchField value={query} onChange={setQuery} placeholder="Search by tracking ID, customer, or device" />
        </div>

        {loading ? (
          <SkeletonRows rows={5} />
        ) : filtered.length === 0 ? (
          rows.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-14 text-center sm:px-5">
              <ServiceStatusEmptyIllustration />
              <p className="mt-3 text-base font-bold text-[#1C3053]">No service records found</p>
              <p className="mt-1 max-w-sm text-sm text-[#666666]">Active repair service updates will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center px-4 py-14 text-center sm:px-5">
              <Icon3D icon={Clock} tone="gray" size="lg" />
              <p className="mt-3 text-sm font-bold text-[#1C3053]">No services match your filters</p>
              <p className="mt-1 text-sm text-[#666666]">Try a different stage or search term.</p>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-2.5 p-3 sm:p-4">
            {filtered.map((t) => (
              <ServiceStatusRow key={t.id} ticket={t} expanded={expandedId === t.id} onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ServiceStatusRow({ ticket, expanded, onToggle }) {
  const progress = ticketStageProgress(ticket.status);
  const cancelled = String(ticket.status || '').toUpperCase() === 'CANCELLED';

  return (
    <div className="overflow-hidden rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] transition duration-200 ease-out hover:-translate-y-px">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cx(
          'group flex w-full items-center gap-3.5 px-4 py-4 text-left transition duration-200 ease-out hover:bg-gradient-to-r hover:from-[#F3F3F3]/55 hover:to-white sm:px-5',
          FOCUS_RING,
        )}
      >
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <Icon3D icon={Clock} tone="green" size="lg" className="relative" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-[#1C3053]">{ticket.customerName || ticket.deviceDisplayName || 'Ticket'}</p>
          <p className="truncate text-[13px] text-[#666666]">
            #{ticket.trackingId || ticket.id} {ticket.deviceDisplayName ? `· ${ticket.deviceDisplayName}` : ''}
          </p>
        </div>
        <span
          className={cx(
            'hidden shrink-0 items-center rounded-full px-3.5 py-2 text-[0.68rem] font-bold uppercase tracking-wide sm:inline-flex',
            TICKET_STAGE_BADGE[ticket.stageLabel] || 'bg-[#F8F8F8] text-[#666666]',
          )}
        >
          {ticket.stageLabel}
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#1C3053] transition">
          <ChevronDown className={cx('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-dashed border-[#ECECEC] bg-[#F8F8F8] px-4 py-4 sm:px-5">
          <span
            className={cx(
              'mb-3 inline-block rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-wide sm:hidden',
              TICKET_STAGE_BADGE[ticket.stageLabel] || 'bg-[#F8F8F8] text-[#666666]',
            )}
          >
            {ticket.stageLabel}
          </span>
          {ticket.updatedAt ? (
            <p className="mb-3 text-xs text-[#666666]">Last updated {new Date(ticket.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
          ) : null}

          {cancelled ? (
            <p className="text-sm font-semibold text-red-600">This service was cancelled.</p>
          ) : (
            <ol className="space-y-0">
              {TICKET_STAGES.map((stage, i) => {
                const done = progress >= 0 && i < progress;
                const current = progress >= 0 && i === progress;
                const upcoming = !done && !current;
                return (
                  <li key={stage.key} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < TICKET_STAGES.length - 1 ? (
                      <span
                        className={cx('absolute left-[11px] top-6 h-full w-[2px]', done || current ? 'bg-[#024A57]' : 'bg-[#EAECF0]')}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span
                      className={cx(
                        'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                        done ? 'bg-[#024A57] text-white' : current ? 'bg-[#024A57] text-white ring-4 ring-[#ECECEC]' : 'bg-white text-[#98A2B3] ring-1 ring-[#D0D5DD]',
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </span>
                    <span className={cx('text-sm', current ? 'font-bold text-[#111111]' : done ? 'font-semibold text-[#344054]' : 'text-[#98A2B3]', upcoming && 'opacity-80')}>
                      {stage.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}
