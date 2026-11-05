'use client';

/**
 * /shop-home/reports/employee-report — roster + real completed-task
 * counts per employee.
 *
 * Roster: GET {TICKET_BASE}/technicians via fetchTechnicians() (same call
 * employee/team already uses). Completed-task counts: a real join against
 * GET {TICKET_BASE}/tickets (fetchTicketsPaged()) by assignedTechnicianName
 * — the same defensive name join teamActivity() (src/lib/shopDashboard.js)
 * and every other report page in this app use, since technician-id joins
 * have drifted from the id elsewhere in this codebase.
 *
 * Per partnerNav.js's own description ("Attendance, productivity,
 * completed tasks and leave statistics"), only completed-task counts are
 * real — attendance and leave are confirmed fabricated-nothing elsewhere
 * (employee/attendance, employee/leave both already show honest zero
 * states), so this page links to those instead of duplicating fake
 * numbers here.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/PortalLink';
import { Download, Info, Loader2, RefreshCw, ShieldCheck, UserCheck, Users } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import StatCard from '@/components/shop-dashboard/StatCard';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonRows, SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import MonthSwitcher, { shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchTechnicians, fetchTicketsPaged } from '@/lib/shopDashboard';
import { downloadReportPdf } from '@/lib/reportPdf';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export default function EmployeeReportPage() {
  const [technicians, setTechnicians] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([fetchTechnicians(), fetchTicketsPaged()])
      .then(([t, tk]) => {
        if (!alive) return;
        setTechnicians(Array.isArray(t) ? t : []);
        setTickets(tk);
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load the employee report.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const monthCompletedByName = useMemo(() => {
    const map = new Map();
    tickets.forEach((t) => {
      const s = String(t.status || '').toUpperCase();
      const isCompleted = ['DELIVERED', 'READY', 'INVOICE_GENERATED', 'INVOICE_READY', 'DELIVERED_PROCESSING'].includes(s);
      if (!isCompleted) return;
      const d = new Date(t.updatedAt || t.createdAt || 0);
      if (Number.isNaN(d.getTime())) return;
      if (d.getFullYear() !== viewDate.getFullYear() || d.getMonth() !== viewDate.getMonth()) return;
      const name = t.assignedTechnicianName || 'Unassigned';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return map;
  }, [tickets, viewDate]);

  const roster = useMemo(
    () =>
      technicians.map((t) => ({
        id: t.id,
        name: t.name || 'Unnamed',
        roleLabel: t.roleLabel || 'Technician',
        active: t.isAvailable !== false,
        completedThisMonth: monthCompletedByName.get(t.name) || 0,
      })),
    [technicians, monthCompletedByName],
  );

  const activeCount = roster.filter((r) => r.active).length;
  const completedThisMonthTotal = useMemo(() => Array.from(monthCompletedByName.values()).reduce((sum, n) => sum + n, 0), [monthCompletedByName]);

  const monthStats = [
    { label: 'Total Employees', value: technicians.length, icon: Users, tone: 'green' },
    { label: 'Active Employees', value: activeCount, icon: UserCheck, tone: 'blue' },
    { label: 'Completed Tasks', value: completedThisMonthTotal, icon: ShieldCheck, tone: 'violet' },
  ];

  const goPrevMonth = () => shiftMonth(setViewDate, -1);
  const goNextMonth = () => shiftMonth(setViewDate, 1);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({
        title: 'Employee Report',
        subtitle: `${new Date(viewDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} — NearGFix Partner Dashboard`,
        stats: monthStats.map((s) => ({ label: s.label, value: s.value })),
        notes: ['Attendance, leave, and broader productivity metrics are not tracked by this backend — completed-task counts only.'],
        columns: [
          { header: 'Employee', key: 'name' },
          { header: 'Role', key: 'roleLabel' },
          { header: 'Status', value: (r) => (r.active ? 'Active' : 'Inactive') },
          { header: 'Completed This Month', key: 'completedThisMonth' },
        ],
        rows: roster,
        filename: 'employee-report.pdf',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Employee Report"
        subtitle="Monitor employee productivity and performance."
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
              disabled={loading || exporting || roster.length === 0}
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
          <SkeletonStatCards count={3} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {monthStats.map((s) => (
              <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
            ))}
          </div>
        )}
      </div>

      <p className="flex items-start gap-1.5 rounded-xl bg-[#F8F8F8] px-3.5 py-2.5 text-xs text-[#024A57]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Attendance and leave aren&apos;t tracked here — see{' '}
        <Link href="/shop-home/employee/attendance" className="font-bold underline">Attendance</Link> and{' '}
        <Link href="/shop-home/employee/leave" className="font-bold underline">Leave</Link>.
      </p>

      <div>
        <p className="mb-2.5 text-sm font-bold text-[#111111]">Employee Roster</p>
        <section className="rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
          {loading ? (
            <SkeletonRows rows={4} />
          ) : roster.length === 0 ? (
            <EmptyState icon={Users} title="No employees yet" description="Technicians and pickup staff added to your shop will show up here." />
          ) : (
            <div className="divide-y divide-[#ECECEC]">
              {roster.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-sm font-bold text-[#024A57]">
                    {initials(r.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111111]">{r.name}</p>
                    <p className="truncate text-xs text-[#666666]">{r.roleLabel}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:contents">
                    <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide', r.active ? 'bg-[#F3F3F3] text-[#024A57]' : 'bg-[#F3F3F3] text-[#666666]')}>
                      {r.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="shrink-0 text-xs text-[#666666]">
                      Completed: <span className="font-bold text-[#111111]">{r.completedThisMonth}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
