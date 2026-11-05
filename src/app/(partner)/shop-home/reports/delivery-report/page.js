'use client';

/**
 * /shop-home/reports/delivery-report — delivered-device statistics.
 *
 * There is no dedicated "delivery" entity anywhere in this backend — a
 * delivery is just a repair booking whose status has reached the
 * DELIVERED/RECEIVED_AT_SHOP/DEVICE_PICKED_UP family, the same "Completed"
 * bucket friendlyBookingStatus() already buckets those into
 * (src/lib/shopDashboard.js:190-197). "Ready for Delivery" is a real,
 * separate ticket-side count (sumReadyForDelivery(), driven by
 * GET /tickets/counts — the same call the Dashboard's own "Ready for
 * Delivery" tile uses, src/app/shop-home/page.js). Both real endpoints
 * are fetched here; nothing is invented.
 */

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Clock, Download, Loader2, Package, RefreshCw, Smartphone } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import StatCard from '@/components/shop-dashboard/StatCard';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonRows, SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import MonthSwitcher, { shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchShopBookings, fetchTicketCounts, friendlyBookingStatus, sumReadyForDelivery } from '@/lib/shopDashboard';
import { bookingEstimatedAmount } from '@/lib/bookingFormat';
import { downloadReportPdf } from '@/lib/reportPdf';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

export default function DeliveryReportPage() {
  const [bookings, setBookings] = useState([]);
  const [ticketCounts, setTicketCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([fetchShopBookings(), fetchTicketCounts()])
      .then(([b, c]) => {
        if (!alive) return;
        setBookings(b);
        setTicketCounts(c || {});
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load the delivery report.');
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

  const delivered = useMemo(() => rows.filter((r) => r.statusLabel === 'Completed'), [rows]);
  const pendingDelivery = useMemo(() => rows.filter((r) => r.statusLabel !== 'Completed' && r.statusLabel !== 'Cancelled').length, [rows]);
  const readyForDelivery = sumReadyForDelivery(ticketCounts);

  const deliveredThisMonth = useMemo(
    () =>
      delivered.filter((r) => {
        const d = new Date(r.createdAt || 0);
        if (Number.isNaN(d.getTime())) return false;
        return d.getFullYear() === viewDate.getFullYear() && d.getMonth() === viewDate.getMonth();
      }),
    [delivered, viewDate],
  );

  const goPrevMonth = () => shiftMonth(setViewDate, -1);
  const goNextMonth = () => shiftMonth(setViewDate, 1);
  const toggleExpanded = (id) => setExpandedId((cur) => (cur === id ? null : id));

  const monthStats = [
    { label: 'Delivered This Month', value: deliveredThisMonth.length, icon: CheckCircle2, tone: 'green' },
    { label: 'Ready for Delivery', value: loading ? 0 : readyForDelivery, icon: Package, tone: 'blue' },
    { label: 'Pending Delivery', value: loading ? 0 : pendingDelivery, icon: Clock, tone: 'orange' },
    { label: 'Total Delivered', value: delivered.length, icon: CheckCircle2, tone: 'violet' },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({
        title: 'Delivery Report',
        subtitle: `Delivered devices for ${new Date(viewDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} — NearGFix Partner Dashboard`,
        stats: monthStats.map((s) => ({ label: s.label, value: s.value })),
        columns: [
          { header: 'Booking #', key: 'bookingNumber' },
          { header: 'Customer', value: (r) => r.customerName || 'Not available' },
          { header: 'Device / Issue', value: (r) => r.issueSummary || r.deviceDisplayName || '—' },
          { header: 'Delivered On', value: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Not available') },
        ],
        rows: deliveredThisMonth,
        filename: 'delivery-report.pdf',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Delivery Report"
        subtitle="View delivered-device statistics."
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
              disabled={loading || exporting || deliveredThisMonth.length === 0}
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
        <p className="mb-2.5 text-sm font-bold text-[#111111]">Delivered This Month</p>
        <section className="rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
          {loading ? (
            <SkeletonRows rows={5} />
          ) : deliveredThisMonth.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No deliveries this month" description="Devices marked delivered in this month will show up here." />
          ) : (
            <div className="divide-y divide-[#ECECEC]">
              {deliveredThisMonth.map((b) => (
                <DeliveryRow key={b.id} booking={b} expanded={expandedId === b.id} onToggle={() => toggleExpanded(b.id)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DeliveryRow({ booking, expanded, onToggle }) {
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
            {booking.customerName || 'Customer'} · #{booking.bookingNumber || booking.id}
          </p>
        </div>
        <div className="hidden shrink-0 text-right text-xs text-[#666666] sm:block">
          {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''}
        </div>
        <span className="hidden shrink-0 rounded-full bg-[#F3F3F3] px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-[#024A57] sm:inline-block">
          Delivered
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-[#98A2B3] transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-dashed border-[#ECECEC] bg-[#F8F8F8] px-4 py-4 text-sm text-[#344054] sm:px-5">
          <p>Customer: <span className="font-semibold text-[#111111]">{booking.customerName || 'Not available'}</span> · {booking.customerMobile || 'Not available'}</p>
          <p>Final Amount: <span className="font-semibold text-[#111111]">{amount != null ? `₹${Number(amount).toLocaleString('en-IN')}` : 'Not available'}</span></p>
        </div>
      ) : null}
    </div>
  );
}
