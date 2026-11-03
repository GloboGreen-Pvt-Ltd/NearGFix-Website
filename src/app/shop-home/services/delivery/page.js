'use client';

/**
 * /shop-home/services/delivery — completed repairs ready for or already
 * handed back to the customer.
 *
 * Reads GET {TICKET_BASE}/tickets via fetchTicketsPaged(), filtered to the
 * READY-family statuses (READY/INVOICE_GENERATED/INVOICE_READY/
 * DELIVERED_PROCESSING, all folded onto "Ready for Delivery" — see
 * src/lib/ticketStatus.js) and DELIVERED.
 *
 * "Out for Delivery" and "Pending" (both requested in the original design
 * brief) have no corresponding ticket status anywhere in this backend —
 * there is no courier/dispatch concept, only "ready" and "delivered". Both
 * stat tiles are shown for layout consistency with the brief but read "—"
 * rather than a fabricated count. Likewise there is no delivery-status
 * mutation endpoint, so this is a tracking page only, per the brief's own
 * instruction not to simulate one.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Clock, Copy, Info, Package, Phone, RefreshCw, Truck } from 'lucide-react';

import { cx } from '@/components/site/ui';
import Icon3D from '@/components/shop-dashboard/Icon3D';
import FilterChips from '@/components/shop-dashboard/FilterChips';
import SearchField, { FOCUS_RING } from '@/components/shop-dashboard/SearchField';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonRows, SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import { fetchTicketsPaged } from '@/lib/shopDashboard';
import { ticketStageLabel } from '@/lib/ticketStatus';

const FILTERS = ['All', 'Ready for Delivery', 'Delivered'];
const RELEVANT_STAGES = new Set(['Ready for Delivery', 'Delivered']);

// Page-local badge tones for this page's own two real stage buckets — not
// the shared TICKET_STAGE_BADGE (used by other pages, unaffected). Matches a
// reference design's pastel lavender/green treatment for these two exact
// labels; anything else falls back to the shared map's own styling.
const DELIVERY_ROW_BADGE = {
  'Ready for Delivery': 'bg-[#F1EBFC] text-[#7C3AED]',
  Delivered: 'bg-[#F3F3F3] text-[#067A3D]',
};


// Page-local pastel KPI-card styling — not the shared StatCard (used by ~10
// other pages, unaffected): matches a reference design's pastel-gradient +
// solid circular icon chip + large translucent background-glyph treatment
// per card, same idea as Pickups' PickupStatCard/Customers' CustomerStatCard,
// but with a round (not rounded-square) icon chip since that's what this
// page's specific reference shows.
const DELIVERY_STAT_STYLES = {
  violet: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#A78BFA] to-[#7C3AED]',
    value: 'text-[#1C3053]',
    label: 'text-[#6D5A9E]',
    wave: 'text-[#C4B5FD]',
    glow: 'bg-[#C4B5FD]',
  },
  blue: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#38BDF8] to-[#18A5E5]',
    value: 'text-[#1C3053]',
    label: 'text-[#1D6FA0]',
    wave: 'text-[#93D6F7]',
    glow: 'bg-[#93D6F7]',
  },
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
    chip: 'bg-gradient-to-br from-[#FB923C] to-[#FF7B24]',
    value: 'text-[#1C3053]',
    label: 'text-[#9A5B27]',
    wave: 'text-[#FDBA74]',
    glow: 'bg-[#FDBA74]',
  },
};

function DeliveryStatCard({ icon: Icon, bgIcon: BgIcon, label, value, tone }) {
  const s = DELIVERY_STAT_STYLES[tone] || DELIVERY_STAT_STYLES.green;
  return (
    <div
      className={cx(
        'relative flex h-[178px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#ECECEC] p-4 sm:p-5',
        s.card,
      )}
    >
      {/* glass highlight along the top edge */}
      {/* large translucent background glyph, matching the reference's oversized card art */}
      <BgIcon className={cx('pointer-events-none absolute -bottom-7 -right-7 h-36 w-36 rotate-[-10deg] opacity-[0.28]', s.wave)} aria-hidden="true" />

      {/* colored glow behind the icon chip, then the raised glossy chip itself */}
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

      <p className={cx('relative mt-4 text-[34px] font-extrabold leading-none tracking-tight', s.value)}>{value}</p>
      <p className={cx('relative mt-1.5 text-[15px] font-semibold', s.label)}>{label}</p>
    </div>
  );
}

export default function DeliveryPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
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
        if (alive) setError(err.message || 'Could not load deliveries.');
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
        .map((t) => ({ ...t, stageLabel: ticketStageLabel(t.status) }))
        .filter((t) => RELEVANT_STAGES.has(t.stageLabel))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)),
    [tickets],
  );

  const counts = useMemo(() => {
    const c = { All: rows.length, 'Ready for Delivery': 0, Delivered: 0 };
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
    { label: 'Ready for Delivery', value: counts['Ready for Delivery'], icon: Package, bgIcon: Package, tone: 'violet' },
    { label: 'Out for Delivery', value: '—', icon: Truck, bgIcon: Truck, tone: 'blue' },
    { label: 'Delivered', value: counts.Delivered, icon: Package, bgIcon: Package, tone: 'green' },
    { label: 'Pending', value: '—', icon: Clock, bgIcon: Clock, tone: 'orange' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Hero — plain #F8F8F8 grey banner (no illustration / waves).
          Title/subtitle/Refresh are the same content/handler as always. */}
      <div className="relative overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-6 sm:p-7">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[34px]">Delivery</h1>
            <p className="mt-1 text-[14px] text-[#666666] sm:text-[15px]">Manage completed repairs and customer deliveries.</p>
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
            <DeliveryStatCard key={s.label} icon={s.icon} bgIcon={s.bgIcon} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </div>
      )}
      {!loading ? (
        <p className="-mt-3 flex items-center gap-1.5 rounded-xl bg-[#F8F8F8] px-3 py-2 text-xs text-[#666666]">
          <Info className="h-3.5 w-3.5 shrink-0 text-[#98A2B3]" aria-hidden="true" />
          &ldquo;Out for Delivery&rdquo; and &ldquo;Pending&rdquo; aren&apos;t tracked by this backend yet, so they show as &ldquo;—&rdquo;.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8]">
        <div className="flex flex-col gap-3.5 border-b border-[#ECECEC] px-5 py-5 sm:px-6">
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} counts={counts} />
          <SearchField value={query} onChange={setQuery} placeholder="Search by tracking ID, customer, or device" />
        </div>

        {loading ? (
          <SkeletonRows rows={4} />
        ) : filtered.length === 0 ? (
          rows.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-14 text-center sm:px-5">
              <Icon3D icon={Package} tone="green" size="lg" />
              <p className="mt-3 text-sm font-bold text-[#1C3053]">No deliveries yet</p>
              <p className="mt-1 text-sm text-[#666666]">Completed repairs ready for delivery will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center px-4 py-14 text-center sm:px-5">
              <Icon3D icon={Package} tone="gray" size="lg" />
              <p className="mt-3 text-sm font-bold text-[#1C3053]">No deliveries match your filters</p>
              <p className="mt-1 text-sm text-[#666666]">Try a different status or search term.</p>
            </div>
          )
        ) : (
          <div className="divide-y divide-[#ECECEC]">
            {filtered.map((t) => (
              <DeliveryRow key={t.id} ticket={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DeliveryRow({ ticket }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const address = ticket.customerAddress || '';

  function copyAddress() {
    if (typeof navigator === 'undefined' || !navigator.clipboard || !address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx(
          'group flex w-full items-center gap-3.5 px-4 py-5 text-left transition duration-200 ease-out hover:translate-x-0.5 hover:bg-gradient-to-r hover:from-[#F3F3F3]/65 hover:to-white sm:px-5',
          FOCUS_RING,
        )}
      >
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <Icon3D icon={Package} tone="green" size="lg" className="relative" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-[#1C3053]">{ticket.customerName || ticket.deviceDisplayName || 'Ticket'}</p>
          <p className="truncate text-[13px] text-[#666666]">#{ticket.trackingId || ticket.id}</p>
        </div>
        <span
          className={cx(
            'hidden shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.68rem] font-bold uppercase tracking-wide sm:inline-flex',
            DELIVERY_ROW_BADGE[ticket.stageLabel] || 'bg-[#F8F8F8] text-[#666666]',
          )}
        >
          <Package className="h-3 w-3 shrink-0" aria-hidden="true" />
          {ticket.stageLabel}
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#1C3053] transition">
          <ChevronDown className={cx('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-dashed border-[#ECECEC] bg-[#F8F8F8] px-4 py-4 sm:px-5">
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-wide sm:hidden',
              DELIVERY_ROW_BADGE[ticket.stageLabel] || 'bg-[#F8F8F8] text-[#666666]',
            )}
          >
            <Package className="h-3 w-3 shrink-0" aria-hidden="true" />
            {ticket.stageLabel}
          </span>

          {ticket.customerMobile ? (
            <a href={`tel:${ticket.customerMobile}`} className="flex w-fit items-center gap-2 text-sm font-semibold text-[#024A57]">
              <Phone className="h-4 w-4" aria-hidden="true" />
              {ticket.customerMobile}
            </a>
          ) : null}

          {address ? (
            <div className="flex items-start gap-2 rounded-xl bg-white px-3 py-2.5 text-sm text-[#344054]">
              <span className="min-w-0 flex-1 break-words">{address}</span>
              <button
                type="button"
                onClick={copyAddress}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F3F3F3] px-2.5 py-1 text-xs font-semibold text-[#067A3D] transition hover:bg-[#F3F3F3]"
              >
                <Copy className="h-3 w-3" aria-hidden="true" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[#98A2B3]">No delivery address on file for this ticket.</p>
          )}

          <p className="flex items-center gap-1.5 text-[0.7rem] text-[#98A2B3]">
            <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
            Delivery-status updates aren&apos;t available yet — this backend has no write endpoint for it.
          </p>
        </div>
      ) : null}
    </div>
  );
}
