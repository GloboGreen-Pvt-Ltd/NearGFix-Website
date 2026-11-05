'use client';

/**
 * /shop-home/reports/overview — "Business Overview".
 *
 * The report-page version of the Dashboard's own data: same real calls
 * and aggregation functions src/app/shop-home/page.js already uses
 * (fetchShopBookings, fetchTicketCounts, fetchShopChats, fetchTicketsPaged
 * + shopDashboard.js's pendingPickups/openEnquiries/sumActiveRepairs/
 * sumReadyForDelivery/todaysRevenue/weeklyBookings/completionRate/
 * recentBookings), laid out as a report instead of the home page — same
 * KPI tiles, the same weekly-bookings bar chart, the same completion-rate
 * gauge, the same recent-bookings list. "New Customers This Month" is the
 * one new figure here, a real derivation via customerDirectory.js's
 * firstServiceAt (the same thing services/customers/page.js's "New This
 * Month" stat already computes), scoped to a month switcher.
 *
 * 2026-09: page-local hero/KPI-card/chart redesign matching a reference
 * design, replacing the shared PageHeader/CardShell/StatCard/MonthSwitcher
 * usage (each used by many other pages, unaffected) with bespoke markup.
 * The Completion Rate donut's legend (Completed/In Process/Pending/
 * Cancelled) is computed from the same real `counts` map this page's own
 * completionRate() already reads (counts.DELIVERED, sumActiveRepairs(counts),
 * counts.CANCELLED, and the total-of-the-rest as Pending) — not a new
 * invented breakdown.
 *
 * Later 2026-09: the Customer Growth chart was removed per explicit
 * request, replaced with 3 real panels built from data this page already
 * fetches — no new API calls:
 *   - "Top Services Today" counts each real `serviceName` across today's
 *     real `services[]` array per booking (the same field
 *     services/bookings/page.js already displays) — genuinely empty if no
 *     bookings today have a services breakdown, never invented categories.
 *   - "Device Category Distribution" groups all real bookings by their
 *     real `brandName` field (Apple/Samsung/etc., the same field the
 *     booking detail pages already show) — whatever brands actually appear
 *     in this shop's real bookings, not a fixed hardcoded list.
 *   - "Recent Bookings" reuses the exact same recentBookings() data this
 *     page's bottom list already rendered — just given a compact
 *     column layout and a real "View all" link to the existing Bookings
 *     page.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/PortalLink';
import { ArrowRight, CheckCircle2, ClipboardList, Download, FileText, IndianRupee, Loader2, MessageSquare, Package, RefreshCw, Smartphone, Truck, Wrench } from 'lucide-react';

import { cx } from '@/components/site/ui';
import Icon3D from '@/components/shop-dashboard/Icon3D';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import { HEADER_BUTTON } from '@/components/shop-dashboard/HeaderControls';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import {
  fetchShopBookings,
  fetchTicketCounts,
  fetchShopChats,
  fetchTicketsPaged,
  pendingPickups,
  openEnquiries,
  sumActiveRepairs,
  sumReadyForDelivery,
  todaysRevenue,
  yesterdaysRevenue,
  trendFromYesterday,
  weeklyBookings,
  completionRate,
  recentBookings,
  isToday,
} from '@/lib/shopDashboard';
import { downloadReportPdf } from '@/lib/reportPdf';

// Cycled per brand/rank slot — matching the Dashboard's Quick Nav tile
// convention of cycling a fixed palette rather than hardcoding meaning to a
// specific brand name (this shop's real brands may differ from any
// reference example).
const SLOT_COLORS = ['#035C6C', '#2196F3', '#FF8F2C', '#8B5CF6', '#94A3B8'];

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';
const DASH = '—';

const STATUS_BADGE = {
  Created: 'bg-[#F3F3F3] text-[#024A57]',
  'In Progress': 'bg-sky-100 text-sky-700',
  Pickup: 'bg-orange-100 text-orange-700',
  Completed: 'bg-violet-100 text-violet-700',
  Cancelled: 'bg-red-100 text-red-700',
};

// Icon + tint + watermark per KPI card — six distinct identities, matching
// a reference design's "one row of premium metric cards" look.
const OVERVIEW_STAT_STYLES = {
  green: { card: 'bg-[#F3F3F3]', chip: 'bg-gradient-to-br from-[#035C6C] to-[#035C6C]', watermark: 'text-[#035C6C]' },
  orange: { card: 'bg-[#F8F8F8]', chip: 'bg-gradient-to-br from-[#FFB35C] to-[#FF8F2C]', watermark: 'text-[#FF8F2C]' },
  blue: { card: 'bg-[#F8F8F8]', chip: 'bg-gradient-to-br from-[#5EB6FA] to-[#2196F3]', watermark: 'text-[#2196F3]' },
  violet: { card: 'bg-[#F8F8F8]', chip: 'bg-gradient-to-br from-[#A78BFA] to-[#8B5CF6]', watermark: 'text-[#8B5CF6]' },
  pink: { card: 'bg-[#F8F8F8]', chip: 'bg-gradient-to-br from-[#FB7185] to-[#E11D48]', watermark: 'text-[#E11D48]' },
};

function OverviewStatCard({ icon: Icon, watermark: Watermark, label, value, trend, tone }) {
  const s = OVERVIEW_STAT_STYLES[tone] || OVERVIEW_STAT_STYLES.green;
  return (
    <div className="relative flex flex-col overflow-hidden rounded-[18px] border border-[#ECECEC] bg-[#F8F8F8] p-5">
      <Watermark className={cx('pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 opacity-15', s.watermark)} aria-hidden="true" />
      <span className={cx('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white', s.chip)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="relative mt-4 text-[28px] font-extrabold leading-none text-[#111111]">{value}</p>
      <p className="relative mt-1.5 text-[14px] font-medium text-[#666666]">{label}</p>
      {trend ? (
        <p className="relative mt-1 flex items-center gap-1 text-xs font-bold text-[#035C6C]">
          <span aria-hidden="true">↗</span>
          {trend}
        </p>
      ) : null}
    </div>
  );
}

function money(n) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

// One card style for every section (min-w-0 so long names truncate instead of overflowing).
const CARD = 'min-w-0 rounded-[20px] border border-[#035C6C]/[0.08] bg-[#F8F8F8] p-5 sm:p-6';

export default function BusinessOverviewPage() {
  const [data, setData] = useState({ bookings: [], counts: {}, chats: [], tickets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([fetchShopBookings(), fetchTicketCounts(), fetchShopChats(), fetchTicketsPaged()])
      .then(([bookings, counts, chats, tickets]) => {
        if (alive) setData({ bookings, counts: counts || {}, chats, tickets });
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load the business overview.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const { bookings, counts, chats, tickets } = data;
  const bookingsToday = bookings.filter((b) => isToday(b.createdAt));
  const bookingsYesterday = bookings.filter((b) => {
    const d = new Date(b.createdAt || 0);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return d.toDateString() === y.toDateString();
  });
  const pending = pendingPickups(bookings);
  const revenueToday = todaysRevenue(tickets);
  const revenueYesterday = yesterdaysRevenue(tickets);
  const enquiries = openEnquiries(chats);

  const kpis = [
    { key: 'bookings', label: "Today's Bookings", value: loading ? DASH : String(bookingsToday.length), trend: loading ? null : trendFromYesterday(bookingsToday.length, bookingsYesterday.length), icon: ClipboardList, watermark: ClipboardList, tone: 'green' },
    { key: 'pickups', label: 'Pending Pickups', value: loading ? DASH : String(pending.length), icon: Truck, watermark: Truck, tone: 'orange' },
    { key: 'repairs', label: 'Active Repairs', value: loading ? DASH : String(sumActiveRepairs(counts)), icon: Wrench, watermark: Wrench, tone: 'blue' },
    { key: 'delivery', label: 'Ready for Delivery', value: loading ? DASH : String(sumReadyForDelivery(counts)), icon: Package, watermark: Package, tone: 'violet' },
    { key: 'revenue', label: "Today's Revenue", value: loading ? DASH : money(revenueToday), trend: loading ? null : trendFromYesterday(revenueToday, revenueYesterday), icon: IndianRupee, watermark: IndianRupee, tone: 'green' },
    { key: 'enquiries', label: 'Open Enquiries', value: loading ? DASH : String(enquiries.length), icon: MessageSquare, watermark: MessageSquare, tone: 'pink' },
  ];

  const weekly = useMemo(() => weeklyBookings(bookings), [bookings]);
  const rate = completionRate(counts);
  const recent = useMemo(() => recentBookings(bookings, 6), [bookings]);

  // Real per-status breakdown of the same `counts` map completionRate()
  // already reads — Completed = DELIVERED, In Process = the same
  // sumActiveRepairs() bucket the KPI card above uses, Cancelled =
  // CANCELLED, Pending = whatever's left of the real total. Not a new
  // invented split.
  const statusBreakdown = useMemo(() => {
    const total = Number(counts.total || 0);
    const completedCount = Number(counts.DELIVERED || 0);
    const inProcessCount = sumActiveRepairs(counts);
    const cancelledCount = Number(counts.CANCELLED || 0);
    const pendingCount = Math.max(0, total - completedCount - inProcessCount - cancelledCount);
    return [
      { label: 'Completed', value: completedCount, color: '#035C6C' },
      { label: 'In Process', value: inProcessCount, color: '#2196F3' },
      { label: 'Pending', value: pendingCount, color: '#FF8F2C' },
      { label: 'Cancelled', value: cancelledCount, color: '#E11D48' },
    ];
  }, [counts]);

  // "Top Services Today" — real serviceName counts across today's real
  // bookings.services[] arrays (same field services/bookings/page.js
  // already reads), top 4 by count. Empty if no booking today has a
  // services breakdown.
  const topServicesToday = useMemo(() => {
    const counts = new Map();
    bookingsToday.forEach((b) => {
      (b.services || []).forEach((s) => {
        const name = s.serviceName || s.serviceCode;
        if (!name) return;
        counts.set(name, (counts.get(name) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [bookingsToday]);

  // "Device Category Distribution" — real bookings grouped by their real
  // brandName field. Whatever brands actually appear, top 4 + an "Others"
  // bucket for the rest — not a fixed hardcoded brand list.
  const deviceDistribution = useMemo(() => {
    const counts = new Map();
    bookings.forEach((b) => {
      const brand = String(b.brandName || '').trim() || 'Others';
      counts.set(brand, (counts.get(brand) || 0) + 1);
    });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4).map(([name, count]) => ({ name, count }));
    const restCount = sorted.slice(4).reduce((sum, [, count]) => sum + count, 0);
    const rows = restCount > 0 ? [...top, { name: 'Others', count: restCount }] : top;
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return { rows, total };
  }, [bookings]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({
        title: 'Business Overview',
        subtitle: 'NearGFix Partner Dashboard',
        stats: [...kpis.map((k) => ({ label: k.label, value: k.value })), { label: 'Completion Rate', value: `${rate}%` }],
        columns: [
          { header: 'Booking #', key: 'bookingNumber' },
          { header: 'Customer', value: (b) => b.customerName || 'Customer' },
          { header: 'Issue', value: (b) => b.issueSummary || 'Service booking' },
          { header: 'Status', key: 'statusLabel' },
        ],
        rows: recent,
        filename: 'business-overview.pdf',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-5 bg-white">
      <PageHeader
        title="Business Overview"
        subtitle="Total bookings, revenue, completed/pending services and customer growth."
        action={
          <>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={HEADER_BUTTON}>
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={loading || exporting}
              className={cx(
                'inline-flex h-11 items-center gap-1.5 rounded-full bg-[#F3BF23] px-4 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-60',
                FOCUS_RING,
              )}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              Download PDF
            </button>
          </>
        }
      />

      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}

      {loading ? (
        <SkeletonStatCards count={6} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((k) => (
            <OverviewStatCard key={k.key} icon={k.icon} watermark={k.watermark} label={k.label} value={k.value} trend={k.trend} tone={k.tone} />
          ))}
        </div>
      )}

      {/* ---- Top Services Today / Device Category Distribution / Recent Bookings --- */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section className={CARD}>
          <div className="flex items-center gap-2.5">
            <Icon3D icon={Wrench} tone="green" size="sm" />
            <div>
              <p className="text-[16px] font-bold text-[#1C3053]">Top Services Today</p>
              <p className="text-xs text-[#6D7E94]">Most requested services today.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {loading ? (
              <p className="py-4 text-center text-sm text-[#98A2B3]">Loading…</p>
            ) : topServicesToday.length === 0 ? (
              <p className="py-4 text-center text-sm text-[#98A2B3]">No service data available</p>
            ) : (
              (() => {
                const maxCount = topServicesToday[0].count || 1;
                return topServicesToday.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3] text-xs font-bold text-[#035C6C]">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[#1C3053]">{s.name}</p>
                        <span className="shrink-0 text-sm font-bold text-[#1C3053]">{s.count}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#F3F3F3]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#035C6C] to-[#035C6C]" style={{ width: `${Math.round((s.count / maxCount) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ));
              })()
            )}
          </div>
        </section>

        <section className={CARD}>
          <div className="flex items-center gap-2.5">
            <Icon3D icon={Smartphone} tone="blue" size="sm" />
            <div>
              <p className="text-[16px] font-bold text-[#1C3053]">Device Category Distribution</p>
              <p className="text-xs text-[#6D7E94]">Devices booked for service.</p>
            </div>
          </div>
          {loading ? (
            <p className="py-4 text-center text-sm text-[#98A2B3]">Loading…</p>
          ) : (
            <div className="mt-4 flex items-center gap-4">
              <div
                className="relative h-[100px] w-[100px] shrink-0 rounded-full"
                style={{
                  background:
                    deviceDistribution.total > 0
                      ? `conic-gradient(${deviceDistribution.rows
                          .reduce((acc, r, i) => {
                            const start = acc.pct;
                            const pct = start + (r.count / deviceDistribution.total) * 100;
                            acc.segments.push(`${SLOT_COLORS[i % SLOT_COLORS.length]} ${start}% ${pct}%`);
                            acc.pct = pct;
                            return acc;
                          }, { pct: 0, segments: [] })
                          .segments.join(', ')})`
                      : '#EDF3F1',
                }}
              >
                <div className="absolute inset-[12px] flex flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-lg font-extrabold text-[#1C3053]">{deviceDistribution.total}</span>
                  <span className="text-[10px] text-[#6D7E94]">Total</span>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {deviceDistribution.rows.length === 0 ? (
                  <p className="text-sm text-[#98A2B3]">No device data available</p>
                ) : (
                  deviceDistribution.rows.map((r, i) => (
                    <div key={r.name} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: SLOT_COLORS[i % SLOT_COLORS.length] }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-[#6D7E94]">{r.name}</span>
                      <span className="shrink-0 font-bold text-[#1C3053]">{r.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>

        <section className={cx(CARD, 'md:col-span-2 xl:col-span-1')}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Icon3D icon={FileText} tone="green" size="sm" />
              <div>
                <p className="text-[16px] font-bold text-[#1C3053]">Recent Bookings</p>
                <p className="text-xs text-[#6D7E94]">Latest service bookings from customers.</p>
              </div>
            </div>
            <Link
              href="/shop-home/services/bookings"
              className="flex shrink-0 items-center gap-1 rounded-full border border-[#ECECEC] px-3 py-1.5 text-xs font-bold text-[#1C3053] transition hover:border-[#035C6C] hover:text-[#035C6C]"
            >
              View All
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-[#98A2B3]">Loading…</p>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FileText className="h-6 w-6 text-[#98A2B3]" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-[#1C3053]">No recent bookings</p>
              <p className="mt-0.5 text-xs text-[#6D7E94]">New bookings will appear here.</p>
            </div>
          ) : (
            <div className="mt-3 flex flex-col divide-y divide-[#ECECEC]">
              {recent.slice(0, 4).map((booking) => (
                <Link
                  key={booking.id}
                  href={`/shop-home/services/bookings/view/?id=${encodeURIComponent(booking.id)}`}
                  className="flex items-center gap-3 py-2.5 transition hover:bg-[#F8F8F8]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3]">
                    <Smartphone className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1C3053]">{booking.customerName || 'Customer'}</p>
                    <p className="truncate text-xs text-[#6D7E94]">
                      {booking.deviceDisplayName || booking.modelName || 'Device'} · {booking.services?.[0]?.serviceName || booking.issueSummary || 'Service booking'}
                    </p>
                  </div>
                  <span className={cx('shrink-0 rounded-full px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wide', STATUS_BADGE[booking.statusLabel] || 'bg-[#F8F8F8] text-[#666666]')}>
                    {booking.statusLabel}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* ---- Weekly Bookings ------------------------------------------ */}
        <section className={cx(CARD, 'xl:col-span-2')}>
          <div className="flex items-center gap-2.5">
            <Icon3D icon={ClipboardList} tone="green" size="sm" />
            <div>
              <p className="text-[16px] font-bold text-[#1C3053]">Weekly Bookings</p>
              <p className="text-xs text-[#6D7E94]">Total bookings created each week.</p>
            </div>
          </div>
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-[#98A2B3]">Loading…</div>
          ) : (
            <>
              <div className="mt-5 flex h-40 items-end justify-between gap-2.5 border-t border-[#ECECEC] pt-4">
                {weekly.map((bar, index) => {
                  const pct = Math.round(Number(bar.value || 0) * 100);
                  const count = Number(bar.count || 0);
                  return (
                    <div key={`${bar.day}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-32 w-full items-end justify-center" title={`${count} booking${count === 1 ? '' : 's'}`}>
                        <div
                          className={cx('w-full max-w-[26px] rounded-full transition-all', bar.today ? 'bg-gradient-to-b from-[#035C6C] to-[#035C6C]' : 'bg-[#F3F3F3]')}
                          style={{ height: `${pct}%`, minHeight: pct > 0 ? '4px' : 0 }}
                        />
                      </div>
                      <span className={cx('text-xs font-semibold', bar.today ? 'text-[#035C6C]' : 'text-[#98A2B3]')}>{bar.day}</span>
                    </div>
                  );
                })}
              </div>
              {weekly.every((bar) => Number(bar.count || 0) === 0) ? (
                <p className="mt-3 text-center text-xs text-[#98A2B3]">No bookings for this period.</p>
              ) : null}
            </>
          )}
        </section>

        {/* ---- Completion Rate ------------------------------------------ */}
        <section className={CARD}>
          <div className="flex items-center gap-2.5">
            <Icon3D icon={CheckCircle2} tone="green" size="sm" />
            <div>
              <p className="text-[16px] font-bold text-[#1C3053]">Completion Rate</p>
              <p className="text-xs text-[#6D7E94]">Percentage of completed services.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 border-t border-[#ECECEC] pt-5 sm:justify-between">
            <div className="relative h-[130px] w-[130px] shrink-0">
              <svg width="130" height="130" viewBox="0 0 130 130" className="-rotate-90">
                <circle cx="65" cy="65" r="46" fill="none" stroke="#EAFBF3" strokeWidth="12" />
                <circle
                  cx="65"
                  cy="65"
                  r="46"
                  fill="none"
                  stroke="url(#completionGradient)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 46}
                  strokeDashoffset={2 * Math.PI * 46 * (1 - (loading ? 0 : rate) / 100)}
                />
                <defs>
                  <linearGradient id="completionGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#035C6C" />
                    <stop offset="1" stopColor="#035C6C" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-[#1C3053]">{loading ? DASH : `${rate}%`}</span>
                <span className="text-[11px] font-medium text-[#6D7E94]">Completed</span>
              </div>
            </div>
            {!loading ? (
              <div className="flex flex-col gap-2.5">
                {statusBreakdown.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                    <span className="text-[#6D7E94]">{s.label}</span>
                    <span className="font-bold text-[#1C3053]">{s.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
