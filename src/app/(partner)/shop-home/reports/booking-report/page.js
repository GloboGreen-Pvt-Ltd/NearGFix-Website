'use client';

/**
 * /shop-home/reports/booking-report — every repair booking, shop-wide.
 *
 * Same real GET {ORDER_BASE}/repair-bookings/shop feed
 * (fetchShopBookings(), src/lib/shopDashboard.js) the Pickups/Bookings/
 * Customers pages already use, unfiltered by serviceMode — this is the
 * "every booking, every mode" view. Same structural template as
 * employee/job-report and employee/pickup-report (This Month tiles
 * via a month switcher → Recent Created / In Progress previews → a full
 * filterable list) — see those files' header comments for why "this
 * month" is always computed client-side (no server date filter exists).
 * "Download PDF" exports exactly the stats and rows already on screen,
 * nothing new is fetched for it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CheckCircle2, ChevronDown, ClipboardList, Download, Inbox, Loader2, RefreshCw, Smartphone, Truck } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import StatCard from '@/components/shop-dashboard/StatCard';
import FilterChips from '@/components/shop-dashboard/FilterChips';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonRows, SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import MonthSwitcher, { shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchShopBookings, friendlyBookingStatus } from '@/lib/shopDashboard';
import { BOOKING_STATUS_BADGE, SERVICE_MODE_LABEL, bookingEstimatedAmount, formatBookingDate } from '@/lib/bookingFormat';
import { downloadReportPdf } from '@/lib/reportPdf';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';
const FULL_LIST_FILTERS = ['All', 'Created', 'Pickup', 'In Progress', 'Completed', 'Cancelled'];

export default function BookingReportPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const fullListRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetchShopBookings()
      .then((list) => {
        if (alive) setBookings(list);
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load the booking report.');
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
      bookings
        .map((b) => ({ ...b, ...friendlyBookingStatus(b.status) }))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [bookings],
  );

  const counts = useMemo(() => {
    const c = { All: rows.length, Created: 0, Pickup: 0, 'In Progress': 0, Completed: 0, Cancelled: 0 };
    rows.forEach((r) => {
      c[r.statusLabel] = (c[r.statusLabel] || 0) + 1;
    });
    return c;
  }, [rows]);

  const monthRows = useMemo(
    () =>
      rows.filter((r) => {
        const d = new Date(r.createdAt || 0);
        if (Number.isNaN(d.getTime())) return false;
        return d.getFullYear() === viewDate.getFullYear() && d.getMonth() === viewDate.getMonth();
      }),
    [rows, viewDate],
  );

  const monthCounts = useMemo(() => {
    const c = { Created: 0, 'In Progress': 0, Completed: 0, total: monthRows.length };
    monthRows.forEach((r) => {
      if (r.statusLabel === 'Created') c.Created += 1;
      else if (r.statusLabel === 'In Progress' || r.statusLabel === 'Pickup') c['In Progress'] += 1;
      else if (r.statusLabel === 'Completed') c.Completed += 1;
    });
    return c;
  }, [monthRows]);

  const recentCreated = useMemo(() => rows.filter((r) => r.statusLabel === 'Created').slice(0, 3), [rows]);
  const inProgress = useMemo(() => rows.filter((r) => r.statusLabel === 'In Progress' || r.statusLabel === 'Pickup').slice(0, 3), [rows]);
  const filtered = useMemo(() => (filter === 'All' ? rows : rows.filter((r) => r.statusLabel === filter)), [rows, filter]);

  const goPrevMonth = () => shiftMonth(setViewDate, -1);
  const goNextMonth = () => shiftMonth(setViewDate, 1);
  const goToFilter = (f) => {
    setFilter(f);
    fullListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const toggleExpanded = (id) => setExpandedId((cur) => (cur === id ? null : id));

  const monthStats = [
    { label: 'Created', value: monthCounts.Created, icon: ClipboardList, tone: 'blue' },
    { label: 'In Progress', value: monthCounts['In Progress'], icon: Truck, tone: 'orange' },
    { label: 'Completed', value: monthCounts.Completed, icon: CheckCircle2, tone: 'green' },
    { label: 'Total', value: monthCounts.total, icon: BarChart3, tone: 'violet' },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({
        title: 'Booking Report',
        subtitle: `${filter === 'All' ? 'All bookings' : `${filter} bookings`} — NearGFix Partner Dashboard`,
        stats: monthStats.map((s) => ({ label: s.label, value: s.value })),
        columns: [
          { header: 'Booking #', key: 'bookingNumber' },
          { header: 'Customer', value: (r) => r.customerName || 'Not available' },
          { header: 'Device / Issue', value: (r) => r.issueSummary || r.deviceDisplayName || '—' },
          { header: 'Mode', value: (r) => SERVICE_MODE_LABEL[r.serviceMode] || r.serviceMode || '—' },
          { header: 'Status', key: 'statusLabel' },
          { header: 'Date', value: (r) => formatBookingDate(r.pickupDate) },
        ],
        rows: filtered,
        filename: 'booking-report.pdf',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Booking Report"
        subtitle="View booking statistics and trends across every service mode."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-xl border border-[#ECECEC] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054] transition hover:border-[#024A57] hover:text-[#024A57]',
                FOCUS_RING,
              )}
            >
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={loading || exporting || rows.length === 0}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-xl bg-[#F3BF23] px-4 py-2.5 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-60',
                FOCUS_RING,
              )}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              Download PDF
            </button>
          </div>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}

      <div>
        <MonthSwitcher viewDate={viewDate} onPrev={goPrevMonth} onNext={goNextMonth} />
        {loading ? (
          <SkeletonStatCards count={4} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {monthStats.map((s) => (
              <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[#111111]">Recent Created</p>
          {recentCreated.length > 0 ? (
            <button type="button" onClick={() => goToFilter('Created')} className="text-xs font-bold text-[#024A57] hover:underline">
              View all
            </button>
          ) : null}
        </div>
        {loading ? (
          <SkeletonRows rows={2} />
        ) : recentCreated.length === 0 ? (
          <EmptyState icon={Inbox} title="No new bookings." description="Newly created bookings will show up here." />
        ) : (
          <div className="divide-y divide-[#ECECEC] rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
            {recentCreated.map((b) => (
              <BookingRow key={b.id} booking={b} expanded={expandedId === b.id} onToggle={() => toggleExpanded(b.id)} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[#111111]">In Progress</p>
          {inProgress.length > 0 ? (
            <button type="button" onClick={() => goToFilter('In Progress')} className="text-xs font-bold text-[#024A57] hover:underline">
              View all
            </button>
          ) : null}
        </div>
        {loading ? (
          <SkeletonRows rows={2} />
        ) : inProgress.length === 0 ? (
          <EmptyState icon={Truck} title="No bookings in progress." description="Nothing being worked on right now." />
        ) : (
          <div className="divide-y divide-[#ECECEC] rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
            {inProgress.map((b) => (
              <BookingRow key={b.id} booking={b} expanded={expandedId === b.id} onToggle={() => toggleExpanded(b.id)} />
            ))}
          </div>
        )}
      </div>

      <div ref={fullListRef}>
        <p className="mb-2.5 text-sm font-bold text-[#111111]">All Bookings</p>
        <section className="rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
          <div className="border-b border-[#ECECEC] px-4 py-4 sm:px-5">
            <FilterChips options={FULL_LIST_FILTERS} value={filter} onChange={setFilter} counts={counts} />
          </div>

          {loading ? (
            <SkeletonRows rows={5} />
          ) : filtered.length === 0 ? (
            rows.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No bookings yet" description="Bookings created for your shop will show up here." />
            ) : (
              <EmptyState icon={ClipboardList} tone="muted" title="No bookings found." description="Try a different status." />
            )
          ) : (
            <div className="divide-y divide-[#ECECEC]">
              {filtered.map((b) => (
                <BookingRow key={b.id} booking={b} expanded={expandedId === b.id} onToggle={() => toggleExpanded(b.id)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function BookingRow({ booking, expanded, onToggle }) {
  const amount = bookingEstimatedAmount(booking);
  return (
    <div>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#F8F8F8] sm:px-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8]">
          <Smartphone className="h-5 w-5 text-[#024A57]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#111111]">{booking.issueSummary || booking.deviceDisplayName || 'Service booking'}</p>
          <p className="truncate text-xs text-[#666666]">
            {booking.customerName || 'Customer'} · #{booking.bookingNumber || booking.id} · {SERVICE_MODE_LABEL[booking.serviceMode] || booking.serviceMode}
          </p>
        </div>
        <div className="hidden shrink-0 text-right text-xs text-[#666666] sm:block">
          {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''}
        </div>
        <span className={cx('hidden shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide sm:inline-block', BOOKING_STATUS_BADGE[booking.statusLabel] || 'bg-[#F8F8F8] text-[#666666]')}>
          {booking.statusLabel}
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-[#98A2B3] transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-dashed border-[#ECECEC] bg-[#F8F8F8] px-4 py-4 text-sm text-[#344054] sm:px-5">
          <p>Customer: <span className="font-semibold text-[#111111]">{booking.customerName || 'Not available'}</span> · {booking.customerMobile || 'Not available'}</p>
          <p>Estimated Amount: <span className="font-semibold text-[#111111]">{amount != null ? `₹${Number(amount).toLocaleString('en-IN')}` : 'Not available'}</span></p>
          <p className="text-xs text-[#666666]">
            Created: <span className="font-semibold text-[#111111]">{booking.createdAt ? new Date(booking.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available'}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
