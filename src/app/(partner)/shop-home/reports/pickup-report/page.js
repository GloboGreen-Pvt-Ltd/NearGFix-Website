'use client';

/**
 * /shop-home/reports/pickup-report — shop-wide pickup activity.
 *
 * The all-pickup-persons aggregate version of
 * employee/pickup-report/PickupReportClient.js — same real
 * GET {ORDER_BASE}/repair-bookings/shop feed filtered to
 * serviceMode==='PICKUP', same id-OR-name defensive join rationale (see
 * that file's header comment), just without the `?employeeId=` single-
 * person scope, plus a "By Pickup Person" breakdown table (a real
 * group-by over the same rows, not new data) and a "Download PDF" export.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CheckCircle2, ChevronDown, Download, Flag, Loader2, RefreshCw, Truck, Users } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import StatCard from '@/components/shop-dashboard/StatCard';
import FilterChips from '@/components/shop-dashboard/FilterChips';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonRows, SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import MonthSwitcher, { shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchShopBookings, friendlyBookingStatus } from '@/lib/shopDashboard';
import { BOOKING_STATUS_BADGE, bookingEstimatedAmount, formatBookingDate, formatPickupAddress } from '@/lib/bookingFormat';
import { downloadReportPdf } from '@/lib/reportPdf';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';
const FULL_LIST_FILTERS = [
  { value: 'All', label: 'All' },
  { value: 'Completed', label: 'Completed' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Pending', label: 'Assigned' },
];

function assigneeName(booking) {
  return booking.assignedPickupPersonName || booking.pickupPersonName || '';
}

function displayBucket(statusLabel) {
  if (statusLabel === 'Created') return 'Pending';
  if (statusLabel === 'Pickup' || statusLabel === 'In Progress') return 'In Progress';
  return statusLabel;
}

export default function PickupReportOverviewPage() {
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
        if (alive) setError(err.message || 'Could not load the pickup report.');
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
        .filter((b) => b.serviceMode === 'PICKUP')
        .map((b) => {
          const { statusLabel } = friendlyBookingStatus(b.status);
          return { ...b, statusLabel, displayStatus: displayBucket(statusLabel) };
        })
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [bookings],
  );

  const counts = useMemo(() => {
    const c = { All: rows.length, Pending: 0, 'In Progress': 0, Completed: 0, Cancelled: 0 };
    rows.forEach((r) => {
      c[r.displayStatus] = (c[r.displayStatus] || 0) + 1;
    });
    return c;
  }, [rows]);

  const monthCounts = useMemo(() => {
    const c = { Pending: 0, 'In Progress': 0, Completed: 0, total: 0 };
    rows.forEach((r) => {
      const d = new Date(r.createdAt || 0);
      if (Number.isNaN(d.getTime())) return;
      if (d.getFullYear() !== viewDate.getFullYear() || d.getMonth() !== viewDate.getMonth()) return;
      c.total += 1;
      if (r.displayStatus !== 'Cancelled') c[r.displayStatus] = (c[r.displayStatus] || 0) + 1;
    });
    return c;
  }, [rows, viewDate]);

  const byPickupPerson = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const name = assigneeName(r) || 'Unassigned';
      if (!map.has(name)) map.set(name, { name, total: 0, completed: 0 });
      const entry = map.get(name);
      entry.total += 1;
      if (r.displayStatus === 'Completed') entry.completed += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const recentAssigned = useMemo(() => rows.filter((r) => r.displayStatus === 'Pending').slice(0, 3), [rows]);
  const inProgressList = useMemo(() => rows.filter((r) => r.displayStatus === 'In Progress').slice(0, 3), [rows]);
  const filtered = useMemo(() => (filter === 'All' ? rows : rows.filter((r) => r.displayStatus === filter)), [rows, filter]);

  const goPrevMonth = () => shiftMonth(setViewDate, -1);
  const goNextMonth = () => shiftMonth(setViewDate, 1);
  const goToFilter = (f) => {
    setFilter(f);
    fullListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const toggleExpanded = (id) => setExpandedId((cur) => (cur === id ? null : id));

  const monthStats = [
    { label: 'Assigned', value: monthCounts.Pending, icon: Flag, tone: 'orange' },
    { label: 'In Progress', value: monthCounts['In Progress'], icon: Truck, tone: 'blue' },
    { label: 'Completed', value: monthCounts.Completed, icon: CheckCircle2, tone: 'green' },
    { label: 'Total', value: monthCounts.total, icon: BarChart3, tone: 'violet' },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({
        title: 'Pickup Report',
        subtitle: 'Shop-wide pickup activity — NearGFix Partner Dashboard',
        stats: monthStats.map((s) => ({ label: s.label, value: s.value })),
        columns: [
          { header: 'Pickup Person', key: 'name' },
          { header: 'Total Pickups', key: 'total' },
          { header: 'Completed', key: 'completed' },
        ],
        rows: byPickupPerson,
        filename: 'pickup-report.pdf',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pickup Report"
        subtitle="Analyze pickup performance across your whole team."
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
              disabled={loading || exporting || byPickupPerson.length === 0}
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
        <p className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-[#111111]">
          <Users className="h-4 w-4 text-[#024A57]" aria-hidden="true" /> By Pickup Person
        </p>
        {loading ? (
          <SkeletonRows rows={3} />
        ) : byPickupPerson.length === 0 ? (
          <EmptyState icon={Users} title="No pickups yet" description="Pickup activity per person will show up here." />
        ) : (
          <div className="divide-y divide-[#ECECEC] rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
            {byPickupPerson.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <p className="min-w-0 truncate text-sm font-bold text-[#111111]">{p.name}</p>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-4 gap-y-1 text-right text-xs">
                  <span className="text-[#666666]">Total: <span className="font-bold text-[#111111]">{p.total}</span></span>
                  <span className="text-[#666666]">Completed: <span className="font-bold text-[#024A57]">{p.completed}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[#111111]">Recent Assigned</p>
          {recentAssigned.length > 0 ? (
            <button type="button" onClick={() => goToFilter('Pending')} className="text-xs font-bold text-[#024A57] hover:underline">
              View all
            </button>
          ) : null}
        </div>
        {loading ? (
          <SkeletonRows rows={2} />
        ) : recentAssigned.length === 0 ? (
          <EmptyState icon={Flag} title="No new pickup assignments." />
        ) : (
          <div className="divide-y divide-[#ECECEC] rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
            {recentAssigned.map((b) => (
              <PickupReportRow key={b.id} booking={b} expanded={expandedId === b.id} onToggle={() => toggleExpanded(b.id)} />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[#111111]">In Progress</p>
          {inProgressList.length > 0 ? (
            <button type="button" onClick={() => goToFilter('In Progress')} className="text-xs font-bold text-[#024A57] hover:underline">
              View all
            </button>
          ) : null}
        </div>
        {loading ? (
          <SkeletonRows rows={2} />
        ) : inProgressList.length === 0 ? (
          <EmptyState icon={Truck} title="No pickups in progress." />
        ) : (
          <div className="divide-y divide-[#ECECEC] rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
            {inProgressList.map((b) => (
              <PickupReportRow key={b.id} booking={b} expanded={expandedId === b.id} onToggle={() => toggleExpanded(b.id)} />
            ))}
          </div>
        )}
      </div>

      <div ref={fullListRef}>
        <p className="mb-2.5 text-sm font-bold text-[#111111]">All Pickups</p>
        <section className="rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
          <div className="border-b border-[#ECECEC] px-4 py-4 sm:px-5">
            <FilterChips options={FULL_LIST_FILTERS} value={filter} onChange={setFilter} counts={counts} />
          </div>

          {loading ? (
            <SkeletonRows rows={5} />
          ) : filtered.length === 0 ? (
            rows.length === 0 ? (
              <EmptyState icon={Truck} title="No pickups yet" description="Pickup bookings assigned to your pickup staff will show up here." />
            ) : (
              <EmptyState icon={Truck} tone="muted" title="No pickups found." description="Try a different status." />
            )
          ) : (
            <div className="divide-y divide-[#ECECEC]">
              {filtered.map((b) => (
                <PickupReportRow key={b.id} booking={b} expanded={expandedId === b.id} onToggle={() => toggleExpanded(b.id)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PickupReportRow({ booking, expanded, onToggle }) {
  const assignee = assigneeName(booking);
  const amount = bookingEstimatedAmount(booking);
  const services = Array.isArray(booking.services) ? booking.services : [];

  return (
    <div>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#F8F8F8] sm:px-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8]">
          <Truck className="h-5 w-5 text-[#024A57]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#111111]">{booking.customerName || 'Not available'}</p>
          <p className="truncate text-xs text-[#666666]">
            #{booking.bookingNumber || booking.id} · {formatBookingDate(booking.pickupDate)} · {assignee || 'Unassigned'}
          </p>
        </div>
        <span className={cx('hidden shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide sm:inline-block', BOOKING_STATUS_BADGE[booking.statusLabel] || 'bg-[#F8F8F8] text-[#666666]')}>
          {booking.displayStatus}
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-[#98A2B3] transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-dashed border-[#ECECEC] bg-[#F8F8F8] px-4 py-4 sm:px-5">
          <div>
            <p className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-[#98A2B3]">Customer</p>
            <p className="text-sm text-[#344054]">{booking.customerName || 'Not available'} · {booking.customerMobile || 'Not available'}</p>
          </div>
          <div>
            <p className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-[#98A2B3]">Pickup</p>
            <p className="text-sm text-[#344054]">{formatPickupAddress(booking)}</p>
          </div>
          <div>
            <p className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-[#98A2B3]">Assignment</p>
            <p className="text-sm text-[#344054]">{assignee || 'Not yet assigned'}</p>
          </div>
          {services.length ? (
            <div>
              <p className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-[#98A2B3]">Services</p>
              <ul className="space-y-1">
                {services.map((s, i) => (
                  <li key={s.repairServiceId || i} className="flex items-center justify-between gap-3 text-xs text-[#666666]">
                    <span className="min-w-0 break-words">{s.serviceName || s.serviceCode}</span>
                    {s.estimatedPrice != null ? <span className="font-semibold text-[#111111]">₹{Number(s.estimatedPrice).toLocaleString('en-IN')}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-sm font-bold text-[#111111]">{amount != null ? `₹${Number(amount).toLocaleString('en-IN')} estimated` : 'Amount not available'}</p>
        </div>
      ) : null}
    </div>
  );
}
