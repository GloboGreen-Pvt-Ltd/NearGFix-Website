'use client';

/**
 * /shop-home/reports/service-report — Booking Status, the web counterpart of
 * the Partner app's BookingStatusScreen (+ its BookingStatusReport drill-down
 * and BookingPreviousReport screens), with the same status mapping:
 *
 *   Total Booking              every ticket                (counts.total)
 *   Total Processed            READY
 *   Total Delivered            DELIVERED
 *   Out for Delivery           DELIVERED_PROCESSING
 *   Total In Process           IN_DIAGNOSIS + IN_REPAIR
 *   Re-Estimated               APPROVED + QUOTED
 *     1. Spare parts pending   APPROVED (customer said go, repair not started)
 *     2. Customer approval     QUOTED   (quote not answered yet)
 *
 * Layout: the Jobs page's StageRail + BookingTile grid (components/shop-dashboard/BookingTiles.js).
 * Counts: GET {TICKET_BASE}/tickets/counts (fetchTicketCounts) — all-time,
 * like the app. ?view=<bucket key> opens that bucket's bookings (the shared
 * Bookings-page cards over bookings joined to tickets, filtered by ticket
 * status, with the app's Today/Yesterday/Week/Month/All period chips);
 * ?view=previous shows the app's month-by-month snapshot, derived from the
 * /tickets feed (no monthly endpoint exists).
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, History, Package, PackageCheck, Truck, UserCheck, Wrench } from 'lucide-react';

import { cx } from '@/components/site/ui';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import AssignTechnicianModal from '@/components/shop-dashboard/AssignTechnicianModal';
import ServiceStatusSheet from '@/components/shop-dashboard/ServiceStatusSheet';
import { OrdersSkeleton, matchesQuery, orderBadgeText, useOrderRows, withHash } from '@/components/shop-dashboard/OrdersList';
import { BookingTile, BookingTilesGrid, BookingsEmpty, BookingsHeader, BookingsLoader, BookingsSearch, BookingsShell, StageRail } from '@/components/shop-dashboard/BookingTiles';
import { fetchTicket, fetchTicketCounts, fetchTicketsPaged } from '@/lib/shopDashboard';
import { variantLabel } from '@/lib/deviceImage';
import { bookingRef, buildOrderRows } from '@/lib/orderStages';

/* -------------------------------------------------------------------------- */
/* Buckets (the app's tile config)                                             */
/* -------------------------------------------------------------------------- */

const TOTAL = { key: 'total', label: 'Total Booking', statusList: [], countKey: 'total', icon: ClipboardList };
const TILES = [
  { key: 'processed', label: 'Total Processed', statusList: ['READY'], icon: CheckCircle2 },
  { key: 'delivered', label: 'Total Delivered', statusList: ['DELIVERED'], icon: PackageCheck },
  { key: 'out-for-delivery', label: 'Out for Delivery', statusList: ['DELIVERED_PROCESSING'], icon: Truck },
  { key: 'in-process', label: 'Total In Process', statusList: ['IN_DIAGNOSIS', 'IN_REPAIR'], icon: Wrench },
];
const STALLED = { key: 'stalled', label: 'Re-Estimated', statusList: ['APPROVED', 'QUOTED'], icon: AlertTriangle };
const PENDING = [
  { key: 'spare-parts', label: 'Spare parts pending', statusList: ['APPROVED'], icon: Package },
  { key: 'customer-approval', label: 'Customer approval pending', statusList: ['QUOTED'], icon: UserCheck },
];
// Every bucket the page can drill into — the "N statuses" in the header, as the app counts them.
const ALL_BUCKETS = [TOTAL, ...TILES, STALLED, ...PENDING];
const STATUS_COUNT = ALL_BUCKETS.length;
const BUCKET_BY_KEY = Object.fromEntries(ALL_BUCKETS.map((b) => [b.key, b]));

const MONTHS_TO_SHOW = 6;
const pad2 = (n) => String(n).padStart(2, '0');
const countFor = (counts, b) => (b.countKey ? Number(counts?.[b.countKey] || 0) : b.statusList.reduce((s, k) => s + Number(counts?.[k] || 0), 0));

function readView() {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('view');
  return v === 'previous' || BUCKET_BY_KEY[v] ? v : null;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

// Rail order + tones (the Jobs page palette). Previous opens the monthly snapshot.
const RAIL_TONE = { total: '#035C6C', processed: '#609138', delivered: '#035C6C', 'out-for-delivery': '#0788C9', 'in-process': '#357D89', stalled: '#F32C26', 'spare-parts': '#E08E00', 'customer-approval': '#7C3AED' };
const RAIL_ITEMS = [
  ...ALL_BUCKETS.map((b) => ({ key: b.key, label: b.key === 'total' ? 'All' : b.label.replace(/^Total /, ''), icon: b.icon, tone: RAIL_TONE[b.key] })),
  { key: 'previous', label: 'Previous', icon: History, tone: '#1C3053' },
];

export default function BookingStatusPage() {
  const [view, setView] = useState('total');

  useEffect(() => {
    const read = () => setView(readView() || 'total');
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  // The selected status lives in ?view= (replaced, so Back leaves the page, as on Jobs).
  function select(next) {
    const url = new URL(window.location.href);
    if (next && next !== 'total') url.searchParams.set('view', next);
    else url.searchParams.delete('view');
    window.history.replaceState(null, '', url);
    setView(next);
    window.scrollTo?.({ top: 0 });
  }

  return <StatusBoard view={view} onSelect={select} />;
}

/* -------------------------------------------------------------------------- */
/* Board: status rail + the Jobs page tiles                                    */
/* -------------------------------------------------------------------------- */

const PERIODS = [
  { value: 'TODAY', label: 'Today' },
  { value: 'YESTERDAY', label: 'Yesterday' },
  { value: 'WEEK', label: 'This Week' },
  { value: 'MONTH', label: 'This Month' },
  { value: 'ALL', label: 'All Time' },
];

function periodRange(period) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'TODAY') return [today, null];
  if (period === 'YESTERDAY') return [new Date(today.getTime() - 86400000), today];
  if (period === 'WEEK') return [new Date(today.getTime() - 7 * 86400000), null];
  if (period === 'MONTH') return [new Date(now.getFullYear(), now.getMonth(), 1), null];
  return [null, null];
}

const inBucket = (r, b) => r.ticketRef && (b.statusList.length === 0 || b.statusList.includes(String(r.ticketStatus || '').toUpperCase()));

function StatusBoard({ view, onSelect }) {
  const { bookings, tickets, options, loading, error, reload, mergeTicket } = useOrderRows();
  const [counts, setCounts] = useState(null);
  const [period, setPeriod] = useState('ALL');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [countsKey, setCountsKey] = useState(0);

  // All-time counts, as the app (GET /tickets/counts); falls back to the loaded rows.
  useEffect(() => {
    let alive = true;
    fetchTicketCounts()
      .then((c) => alive && setCounts(c))
      .catch(() => alive && setCounts(null));
    return () => {
      alive = false;
    };
  }, [countsKey]);

  const allRows = useMemo(() => buildOrderRows(bookings, tickets).filter((r) => r.ticketRef), [bookings, tickets]);
  const railCounts = useMemo(
    () => Object.fromEntries(ALL_BUCKETS.map((b) => [b.key, counts ? countFor(counts, b) : allRows.filter((r) => inBucket(r, b)).length])),
    [counts, allRows],
  );

  const isPrevious = view === 'previous';
  const bucket = BUCKET_BY_KEY[view] || TOTAL;
  const rows = useMemo(() => {
    const [from, to] = periodRange(period);
    return allRows.filter((r) => {
      if (!inBucket(r, bucket)) return false;
      if (!from) return true;
      const d = r.createdAt ? new Date(r.createdAt) : null;
      return d && d >= from && (!to || d < to);
    });
  }, [allRows, bucket, period]);
  const filtered = useMemo(() => rows.filter((r) => matchesQuery(r, query)), [rows, query]);

  const searchShown = searchOpen || query !== '';
  const firstLoad = loading && allRows.length === 0;
  function refresh() {
    reload();
    setCountsKey((k) => k + 1);
  }
  function toggleSearch() {
    if (searchShown) {
      setQuery('');
      setSearchOpen(false);
    } else setSearchOpen(true);
  }

  async function refreshTicket(ticketId) {
    try {
      const ticket = await fetchTicket(ticketId);
      if (ticket?.id) mergeTicket(ticket);
      else refresh();
    } catch {
      refresh();
    }
  }

  return (
    <BookingsShell
      header={
        <BookingsHeader
          eyebrow="Service Status"
          title={isPrevious ? 'Previous Reports' : firstLoad ? bucket.label : `${bucket.label} · ${filtered.length}`}
          loading={loading}
          onRefresh={refresh}
          searchOpen={searchShown}
          onToggleSearch={toggleSearch}
        />
      }
      search={searchShown && !isPrevious ? <BookingsSearch value={query} onChange={setQuery} /> : null}
      rail={
        <StageRail
          items={RAIL_ITEMS}
          value={view}
          onChange={onSelect}
          counts={{ ...railCounts, previous: MONTHS_TO_SHOW }}
          loading={firstLoad && !counts}
          ariaLabel={`Service statuses (${STATUS_COUNT})`}
        />
      }
    >
      {isPrevious ? (
        <PreviousReports />
      ) : (
        <>
          <div role="tablist" aria-label="Period" className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="tab"
                aria-selected={period === p.value}
                onClick={() => setPeriod(p.value)}
                className={cx(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition',
                  period === p.value ? 'border-[#035C6C] bg-[#035C6C] text-white' : 'border-[#E5E7EB] bg-white text-[#475467] hover:border-[#035C6C]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mb-2.5">
              <ErrorBanner message={error} onRetry={refresh} />
            </div>
          ) : null}

          {firstLoad ? (
            <BookingsLoader />
          ) : error ? null : filtered.length === 0 ? (
            <BookingsEmpty
              title={query ? 'No jobs found' : 'No bookings here'}
              text={query ? 'Try a different search term.' : period === 'ALL' ? `No booking is currently in “${bucket.label}”.` : 'Nothing in this period — try All Time.'}
            />
          ) : (
            <BookingTilesGrid>
              {filtered.map((r) => (
                <BookingTile key={r.id} row={r} variant={variantLabel(r, options)} onOpenStatus={() => setUpdating(r)} onAssign={() => setAssigning(r)} />
              ))}
            </BookingTilesGrid>
          )}
        </>
      )}

      <AssignTechnicianModal
        open={Boolean(assigning)}
        ticketId={assigning?.ticketRef}
        currentTechnicianId={assigning?.assignedTechnicianId}
        bookingLabel={assigning ? [withHash(bookingRef(assigning)), assigning.deviceDisplayName || assigning.modelName].filter(Boolean).join(' · ') : ''}
        onClose={() => setAssigning(null)}
        onAssigned={mergeTicket}
      />
      {/* Keyed per ticket so a newly opened booking never shows the previous one's steps. */}
      <ServiceStatusSheet
        key={updating?.ticketRef || 'closed'}
        open={Boolean(updating?.ticketRef)}
        ticketId={updating?.ticketRef}
        bookingRef={updating ? withHash(bookingRef(updating)) : ''}
        lifecycleStatus={updating?.ticketStatus}
        statusLabel={updating ? orderBadgeText(updating) : ''}
        onClose={() => setUpdating(null)}
        onUpdated={() => updating?.ticketRef && refreshTicket(updating.ticketRef)}
      />
    </BookingsShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Previous Reports (month-by-month, the app's BookingPreviousReport)          */
/* -------------------------------------------------------------------------- */

const SNAPSHOT_BUCKETS = [
  { key: 'CREATED', label: 'Accepted', color: '#0788C9', bg: '#E6F4FB' },
  { key: 'IN_PROGRESS', label: 'In Service', color: '#FAA700', bg: '#FFF6E0' },
  { key: 'READY', label: 'Ready', color: '#609138', bg: '#EEF6E8' },
  { key: 'DELIVERED', label: 'Delivered', color: '#035C6C', bg: '#E5F3F5' },
  { key: 'PENDING', label: 'Pending', color: '#F32C26', bg: '#FEF3F2' },
];
const STATUS_TO_BUCKET = {
  CREATED: 'CREATED',
  ASSIGNED: 'CREATED',
  IN_DIAGNOSIS: 'IN_PROGRESS',
  IN_REPAIR: 'IN_PROGRESS',
  QUOTED: 'PENDING',
  APPROVED: 'PENDING',
  READY: 'READY',
  INVOICE_GENERATED: 'READY',
  INVOICE_READY: 'READY',
  DELIVERED_PROCESSING: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'PENDING',
};

function monthlySnapshots(tickets) {
  const now = new Date();
  const months = [];
  for (let i = 0; i < MONTHS_TO_SHOW; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      total: 0,
      buckets: Object.fromEntries(SNAPSHOT_BUCKETS.map((b) => [b.key, 0])),
    });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  (tickets || []).forEach((t) => {
    const d = t.createdAt ? new Date(t.createdAt) : null;
    if (!d || Number.isNaN(d.getTime())) return;
    const m = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (!m) return;
    m.total += 1;
    const b = STATUS_TO_BUCKET[String(t.status || '').toUpperCase()];
    if (b) m.buckets[b] += 1;
  });
  return months; // newest first
}

function PreviousReports() {
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setError('');
    fetchTicketsPaged()
      .then((list) => alive && setTickets(list))
      .catch((err) => alive && setError(err.message || 'Could not load previous reports.'));
    return () => {
      alive = false;
    };
  }, [reload]);

  const months = useMemo(() => monthlySnapshots(tickets), [tickets]);
  const grandTotal = months.reduce((s, m) => s + m.total, 0);

  const totals = Object.fromEntries(SNAPSHOT_BUCKETS.map((b) => [b.key, months.reduce((n, m) => n + m.buckets[b.key], 0)]));

  return (
    <>
      {error ? <ErrorBanner message={error} onRetry={() => setReload((k) => k + 1)} /> : null}
      {!tickets && !error ? (
        <OrdersSkeleton />
      ) : tickets ? (
        <div className="space-y-4">
          {/* Six-month summary */}
          <section className="rounded-[20px] border border-[#E5E7EB] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Last {MONTHS_TO_SHOW} months</p>
                <p className="text-[24px] font-extrabold leading-tight text-[#023A44]">{grandTotal} <span className="text-[14px] font-semibold text-[#6B7280]">bookings</span></p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {SNAPSHOT_BUCKETS.map((b) => (
                <div key={b.key} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: b.bg }}>
                  <p className="text-[20px] font-extrabold leading-none" style={{ color: b.color }}>{totals[b.key]}</p>
                  <p className="mt-1 text-[12px] font-semibold text-[#374151]">{b.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Month cards, newest first */}
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {months.map((m) => (
              <section key={m.key} className={cx('rounded-[20px] border bg-white p-4', m.total ? 'border-[#E5E7EB]' : 'border-dashed border-[#E5E7EB]')}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className={cx('text-[15px] font-extrabold', m.total ? 'text-[#023A44]' : 'text-[#9CA3AF]')}>{m.label}</h2>
                  <span className={cx('rounded-full px-2.5 py-1 text-[12px] font-extrabold', m.total ? 'bg-[#E5F3F5] text-[#035C6C]' : 'bg-[#F3F4F6] text-[#9CA3AF]')}>
                    {m.total} {m.total === 1 ? 'booking' : 'bookings'}
                  </span>
                </div>
                {m.total ? (
                  <>
                    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[#F3F4F6]" aria-hidden="true">
                      {SNAPSHOT_BUCKETS.map((b) => (m.buckets[b.key] ? <span key={b.key} style={{ width: `${(m.buckets[b.key] / m.total) * 100}%`, backgroundColor: b.color }} /> : null))}
                    </div>
                    <div className="mt-3 grid grid-cols-5 gap-1.5">
                      {SNAPSHOT_BUCKETS.map((b) => (
                        <div key={b.key} className="min-w-0 rounded-lg px-1 py-2 text-center" style={{ backgroundColor: m.buckets[b.key] ? b.bg : '#F9FAFB' }}>
                          <p className="text-[17px] font-extrabold leading-none" style={{ color: m.buckets[b.key] ? b.color : '#9CA3AF' }}>{m.buckets[b.key]}</p>
                          <p className="mt-1 truncate text-[10.5px] font-semibold text-[#6B7280]">{b.label}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-[12.5px] text-[#9CA3AF]">No bookings this month.</p>
                )}
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
