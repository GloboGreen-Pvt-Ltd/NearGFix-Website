'use client';

/**
 * EmployeeMonthList — the Partner app's per-month employee roster (Attendance,
 * Leave Report): back · title, a month switcher, a "Total …" pill, then one
 * row per employee (avatar initial, name, role) with that month's counts,
 * each row opening the employee's own page.
 *
 * The roster is GET {TICKET_BASE}/technicians; each row's counts come from
 * `loadStats(technician, month, year)` (month 1–12), loaded in parallel and
 * reloaded when the month changes. A row whose stats fail shows "—".
 */

import { useEffect, useState } from 'react';
import Link from '@/components/PortalLink';
import { useRouter } from '@/lib/portalNavigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { MONTHS, shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchTechnicians } from '@/lib/shopDashboard';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';

export default function EmployeeMonthList({ title, icon: Icon, totalLabel, columns, loadStats, totalOf, hrefFor, emptyText = 'Employees added to your shop will show up here.' }) {
  const router = useRouter();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [stats, setStats] = useState({}); // id -> stats | null (failed) | undefined (loading)

  useEffect(() => {
    let alive = true;
    fetchTechnicians()
      .then((rows) => alive && setTeam(rows))
      .catch((err) => alive && setError(err.message || 'Could not load your team.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!team.length) return undefined;
    let alive = true;
    setStats({});
    const month = viewDate.getMonth() + 1;
    const year = viewDate.getFullYear();
    team.forEach((t) => {
      loadStats(t, month, year)
        .then((s) => alive && setStats((prev) => ({ ...prev, [t.id]: s })))
        .catch(() => alive && setStats((prev) => ({ ...prev, [t.id]: null })));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, viewDate]);

  const total = team.reduce((sum, t) => sum + (stats[t.id] ? Number(totalOf(stats[t.id])) || 0 : 0), 0);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <div className="relative flex items-center justify-center pb-1">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className={cx('absolute left-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#E5F3F5] text-[#111111] transition hover:bg-[#E5F3F5]', FOCUS_RING)}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="flex min-w-0 items-center justify-center gap-2 px-12 text-center text-[20px] font-extrabold text-[#111111] sm:text-[22px]">
          {Icon ? <Icon className="h-6 w-6" aria-hidden="true" /> : null}
          {title}
        </h1>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECECEC] pb-4">
        <div className="flex items-center gap-1 rounded-full bg-[#F3F3F3] px-2 py-1.5">
          <button type="button" onClick={() => shiftMonth(setViewDate, -1)} aria-label="Previous month" className={cx('rounded-full p-1.5 text-[#111111] hover:bg-white', FOCUS_RING)}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="min-w-[96px] text-center text-[16px] font-extrabold text-[#111111]">
            {MONTHS[viewDate.getMonth()].slice(0, 3)} {viewDate.getFullYear()}
          </span>
          <button type="button" onClick={() => shiftMonth(setViewDate, 1)} aria-label="Next month" className={cx('rounded-full p-1.5 text-[#111111] hover:bg-white', FOCUS_RING)}>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <span className="rounded-full bg-[#F3F3F3] px-4 py-2 text-[15px] font-extrabold text-[#024A57]">
          {totalLabel}: {total}
        </span>
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[24px] bg-[#F3F3F3]" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] font-semibold text-[#B42318]">{error}</p>
      ) : team.length === 0 ? (
        <p className="rounded-[24px] border border-[#ECECEC] bg-white px-5 py-12 text-center text-[14px] text-[#667085]">{emptyText}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {team.map((t) => {
            const s = stats[t.id];
            return (
              <li key={t.id}>
                <Link
                  href={hrefFor(t)}
                  className={cx(
                    'flex flex-wrap items-center gap-4 rounded-[24px] border border-[#ECECEC] bg-white px-4 py-4 shadow-[0_4px_14px_rgba(16,24,40,0.05)] transition hover:border-[#035C6C] sm:flex-nowrap sm:px-5',
                    FOCUS_RING,
                  )}
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[22px] font-extrabold text-[#024A57]">
                    {String(t.name || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[19px] font-extrabold text-[#0F2440]">{t.name || 'Unnamed'}</span>
                    <span className="block truncate text-[15px] text-[#6B7C93]">{t.roleLabel || 'Technician'}</span>
                  </span>
                  <span className="flex items-center gap-4 sm:gap-6">
                    {columns.map((c) => (
                      <span key={c.key} className="flex w-14 flex-col items-center">
                        <span className={cx('text-[20px] font-extrabold', c.accent ? 'text-[#C2410C]' : 'text-[#111111]')}>
                          {s === undefined ? '…' : s === null ? '—' : c.value(s)}
                        </span>
                        <span className={cx('text-[13px] font-semibold', c.accent ? 'text-[#C2410C]' : 'text-[#8A9AA9]')}>{c.label}</span>
                      </span>
                    ))}
                    <ChevronRight className="h-5 w-5 text-[#B0BAC4]" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
