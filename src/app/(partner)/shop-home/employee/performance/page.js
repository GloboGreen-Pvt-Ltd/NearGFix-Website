'use client';

/**
 * /shop-home/employee/performance — technician & pickup-person productivity.
 *
 * No endpoint anywhere computes per-employee performance — this is entirely
 * derived client-side from three real, already-used calls: fetchTechnicians()
 * (roster), fetchTicketsPaged() (technician-assigned repair tickets), and
 * fetchShopBookings() (pickup-person-assigned pickup bookings). The
 * technician join is id-OR-name (same defensive pattern as Service Report,
 * required by shopDashboard.js's own documented id-drift issue); the
 * pickup-person join is the same, with even weaker reliability per this
 * session's investigation (assignedPickupPersonId has no successful reader
 * anywhere else in this codebase).
 *
 * "Attendance Rate" is requested by the original brief but has zero backing
 * (no attendance endpoint exists anywhere) — shown as "—", never fabricated.
 * "Average completion/pickup time" is approximated from `updatedAt` minus
 * `createdAt` on records that reached a completed status — there is no
 * dedicated "completedAt" timestamp, so this is a best-effort proxy, not an
 * exact figure, and is labeled as an average rather than implying precision.
 * Date-range filtering (This/Last Month, custom range) was simplified to a
 * single Role filter — slicing already-approximate derived metrics by date
 * on top of an approximate join added more surface area for a subtly wrong
 * number than it was worth; all-time is shown instead.
 *
 * 2026-09: page-local hero/KPI-card/row redesign matching a reference
 * design, replacing the shared PageHeader/StatCard usage (both used by
 * ~15+ and ~10 other pages respectively, unaffected) with bespoke markup —
 * every value below is exactly the same derived number as before, just
 * restyled.
 */

import { useEffect, useMemo, useState } from 'react';
import { Award, Clock, Info, ListChecks, RefreshCw, Star, Truck, Trophy, Wrench } from 'lucide-react';

import { cx } from '@/components/site/ui';
import Icon3D from '@/components/shop-dashboard/Icon3D';
import FilterChips from '@/components/shop-dashboard/FilterChips';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonRows, SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import { fetchShopBookings, fetchTechnicians, fetchTicketsPaged, friendlyBookingStatus } from '@/lib/shopDashboard';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
const ROLE_FILTERS = ['All', 'Technician', 'Pickup Person'];
const COMPLETED_TICKET_STATUSES = new Set(['DELIVERED', 'READY', 'INVOICE_GENERATED', 'INVOICE_READY', 'DELIVERED_PROCESSING']);

// Icon + tint + watermark per KPI card — four distinct identities
// (green/blue/purple/orange), matching a reference design's "performance
// dashboard" look, deliberately different from Service Report/Attendance's
// own card treatments.
const PERF_STAT_STYLES = {
  green: {
    card: 'bg-[#F3F3F3]',
    chip: 'bg-gradient-to-br from-[#035C6C] to-[#035C6C]',
    watermark: 'text-[#035C6C]',
  },
  blue: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#5EB6FA] to-[#2196F3]',
    watermark: 'text-[#2196F3]',
  },
  violet: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#A78BFA] to-[#8B5CF6]',
    watermark: 'text-[#8B5CF6]',
  },
  orange: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#FFB35C] to-[#FF8F2C]',
    watermark: 'text-[#FF8F2C]',
  },
};

function PerfStatCard({ icon: Icon, watermark: Watermark, label, value, tone }) {
  const s = PERF_STAT_STYLES[tone] || PERF_STAT_STYLES.green;
  return (
    <div className={cx('relative flex min-h-[135px] min-w-0 flex-col justify-center overflow-hidden rounded-[20px] border border-[#ECECEC] p-4 sm:p-5 lg:h-[135px]', s.card)}>
      <Watermark className={cx('pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 opacity-15', s.watermark)} aria-hidden="true" />
      <div className="relative flex flex-col items-start gap-2 lg:flex-row lg:items-center lg:gap-3">
        <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white', s.chip)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 max-w-full">
          <p className="truncate text-[20px] font-extrabold leading-tight text-[#1C3053] sm:text-[22px]">{value}</p>
          <p className="mt-0.5 text-[13px] font-semibold text-[#1C3053] sm:text-sm">{label}</p>
        </div>
      </div>
    </div>
  );
}

function avgHours(records) {
  const durations = records
    .map((r) => {
      if (!r.createdAt || !r.updatedAt) return null;
      const ms = new Date(r.updatedAt) - new Date(r.createdAt);
      return ms > 0 ? ms / 36e5 : null;
    })
    .filter((v) => v != null);
  if (!durations.length) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

export default function PerformancePage() {
  const [technicians, setTechnicians] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([fetchTechnicians(), fetchTicketsPaged(), fetchShopBookings()])
      .then(([techList, ticketList, bookingList]) => {
        if (!alive) return;
        setTechnicians(techList);
        setTickets(ticketList);
        setBookings(bookingList.filter((b) => b.serviceMode === 'PICKUP'));
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load performance data.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const rows = useMemo(() => {
    return technicians.map((tech) => {
      const isPickup = (tech.roleLabel || '') === 'Pickup Person';
      const assigned = isPickup
        ? bookings.filter((b) => b.assignedPickupPersonId === tech.id || (b.assignedPickupPersonName || b.pickupPersonName) === tech.name)
        : tickets.filter((t) => t.assignedTechnicianId === tech.id || t.assignedTechnicianName === tech.name);
      const completed = isPickup
        ? assigned.filter((b) => friendlyBookingStatus(b.status).statusLabel === 'Completed')
        : assigned.filter((t) => COMPLETED_TICKET_STATUSES.has(String(t.status || '').toUpperCase()));
      const completionRate = assigned.length ? Math.round((completed.length / assigned.length) * 100) : null;
      const avgTime = avgHours(completed);
      return {
        id: tech.id,
        name: tech.name || 'Unnamed',
        roleLabel: isPickup ? 'Pickup Person' : 'Technician',
        assignedCount: assigned.length,
        completedCount: completed.length,
        completionRate,
        avgTimeHours: avgTime,
      };
    });
  }, [technicians, tickets, bookings]);

  const filtered = useMemo(() => {
    const base = roleFilter === 'All' ? rows : rows.filter((r) => r.roleLabel === roleFilter);
    return [...base].sort((a, b) => (b.completionRate ?? -1) - (a.completionRate ?? -1) || b.completedCount - a.completedCount);
  }, [rows, roleFilter]);

  const withData = rows.filter((r) => r.assignedCount > 0);
  const topPerformer = [...withData].sort((a, b) => (b.completionRate ?? -1) - (a.completionRate ?? -1))[0];
  const avgCompletionRate = withData.length
    ? Math.round(withData.reduce((sum, r) => sum + (r.completionRate || 0), 0) / withData.length)
    : null;
  const totalCompleted = rows.reduce((sum, r) => sum + r.completedCount, 0);

  const stats = [
    { label: 'Top Performer', value: topPerformer ? topPerformer.name : '—', icon: Star, watermark: Trophy, tone: 'green' },
    { label: 'Average Completion Rate', value: avgCompletionRate != null ? `${avgCompletionRate}%` : '—', icon: Award, watermark: ListChecks, tone: 'blue' },
    { label: 'Total Completed Tasks', value: totalCompleted, icon: Wrench, watermark: ListChecks, tone: 'violet' },
    { label: 'Average Attendance', value: '—', icon: Clock, watermark: Clock, tone: 'orange' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Hero — page-local, not the shared PageHeader (used by ~15+ other
          pages, unaffected). Title/subtitle/Refresh are the exact same
          content/handler this page always had; the info text about
          "Average Attendance"/completion-time approximation is the same
          real caveat, just restyled as an info banner instead of plain
          text. */}
      <div
        className="relative overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-5 sm:p-7"
        style={{ background: '#F8F8F8', border: '1px solid #ECECEC' }}
      >
        {/* Decorative performance graphics — trend line, bars, dots, a
            faint chart-card silhouette — low-opacity, purely decorative. */}
        <svg className="pointer-events-none absolute right-6 top-4 hidden h-[100px] w-[220px] text-[#035C6C]/25 sm:block" viewBox="0 0 220 100" aria-hidden="true">
          <path d="M4 88 L40 60 L74 70 L110 30 L150 40 L196 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="110" cy="30" r="4" fill="currentColor" />
          <circle cx="196" cy="10" r="4" fill="currentColor" />
        </svg>
        <div className="pointer-events-none absolute bottom-4 right-8 hidden items-end gap-2 sm:flex" aria-hidden="true">
          {[26, 40, 54, 34, 66].map((h, i) => (
            <span key={i} className="w-3 rounded-full bg-[#035C6C]/20" style={{ height: `${h}px` }} />
          ))}
        </div>
        <span className="pointer-events-none absolute right-10 top-16 hidden h-1.5 w-1.5 rounded-full bg-[#2196F3]/40 sm:block" aria-hidden="true" />
        <span className="pointer-events-none absolute right-24 top-8 hidden h-1.5 w-1.5 rounded-full bg-[#035C6C]/50 sm:block" aria-hidden="true" />

        <div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[34px]">Employee Performance</h1>
            <p className="mt-1 text-[14px] text-[#666666] sm:text-[15px]">Monitor employee productivity and work performance.</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className={cx(
              'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#1C3053] transition hover:border-[#035C6C] hover:text-[#035C6C]',
              FOCUS_RING,
            )}
          >
            <RefreshCw className={cx('h-4 w-4 text-[#035C6C]', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="relative z-[1] mt-4 flex items-start gap-2.5 rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] px-4 py-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#035C6C] text-white">
            <Info className="h-3 w-3" aria-hidden="true" />
          </span>
          <p className="text-[12px] leading-relaxed text-[#6D7E94] sm:text-[13px]">
            &ldquo;Average Attendance&rdquo; isn&apos;t tracked by this backend yet, so it shows as &ldquo;—&rdquo;. Completion time is an approximation
            based on when a record was last updated, not an exact completion timestamp.
          </p>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}

      {loading ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <PerfStatCard key={s.label} icon={s.icon} watermark={s.watermark} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </div>
      )}

      <section
        className="overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8]"
        style={{ border: '1px solid rgba(15, 80, 60, 0.06)' }}
      >
        <div className="border-b border-[#ECECEC] px-4 py-4 sm:px-5">
          <FilterChips options={ROLE_FILTERS} value={roleFilter} onChange={setRoleFilter} />
        </div>

        {loading ? (
          <SkeletonRows rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Award} title="No employees yet" description="Performance metrics will show up here once employees have assigned work." />
        ) : (
          <div className="flex flex-col gap-2.5 p-3 sm:p-4">
            {filtered.map((r, i) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[#ECECEC] bg-[#F8F8F8] px-3.5 py-3 sm:flex-nowrap sm:px-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3] text-sm font-bold text-[#035C6C]">
                  #{i + 1}
                </span>
                <Icon3D icon={r.roleLabel === 'Pickup Person' ? Truck : Wrench} tone={r.roleLabel === 'Pickup Person' ? 'orange' : 'green'} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-[#1C3053] sm:text-[16px]">{r.name}</p>
                  <p className="truncate text-xs text-[#6D7E94] sm:text-[13px]">
                    {r.roleLabel} · {r.completedCount}/{r.assignedCount} completed{r.avgTimeHours != null ? ` · ~${Math.round(r.avgTimeHours)}h avg` : ''}
                  </p>
                </div>
                <div className="order-last flex w-full items-center gap-3 sm:order-none sm:w-auto">
                  <div className="hidden h-2 w-40 shrink-0 overflow-hidden rounded-full bg-[#F3F3F3] sm:block md:w-[180px]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${r.completionRate ?? 0}%`, background: 'linear-gradient(90deg, #11B964, #0A9352)' }}
                    />
                  </div>
                  <span className="shrink-0 text-base font-bold text-[#1C3053] sm:text-[17px]">{r.completionRate != null ? `${r.completionRate}%` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
