'use client';

/**
 * /shop-home/employee/salary/view/?id=<employeeId> — one employee's "Salary
 * Report", as in the Partner app: the year (shown as its financial year,
 * e.g. 2026-27) with a switcher, Total Present / Total Earned / Avg per Month,
 * and Monthly Payslips January–December (days, amount, Paid / Unpaid).
 * A month expands to its payslip breakdown.
 *
 * Data: GET {TICKET_BASE}/technicians/{id}/payslips?year (PayslipResponse[] —
 * month, periodStart/End, presentDays, dailyWageDays, regularSalary,
 * regularWage, netSalary, netWage) via fetchTechnicianPayslips(). The
 * payslip has no paid flag; as in the app a month with a payout above ₹0
 * counts as Paid and ₹0 as Unpaid.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Banknote, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, TrendingUp, Users } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { MONTHS } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchTechnician, fetchTechnicianPayslips } from '@/lib/shopDashboard';

const DARK = '#035C6C';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
const num = (v) => Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0;
const money = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const fmtDate = (v) => {
  const d = v ? new Date(`${String(v).slice(0, 10)}T00:00:00`) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
};
/** What the month pays: salary for salaried staff, wages for daily-wage staff. */
const payout = (p) => (p ? num(p.netSalary) + num(p.netWage) : 0);

function Stat({ icon: Icon, value, label, sub }) {
  return (
    <div className="min-w-0 rounded-[20px] border border-[#ECECEC] bg-white p-4 shadow-[0_2px_10px_rgba(16,24,40,0.04)]">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E5F3F5]" style={{ color: DARK }}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-3 break-words text-[22px] font-extrabold text-[#111111]">{value}</p>
      <p className="text-[14.5px] font-bold text-[#111111]">{label}</p>
      <p className="text-[12.5px] text-[#98A2B3]">{sub}</p>
    </div>
  );
}

export default function EmployeeSalaryPage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [name, setName] = useState('');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [slips, setSlips] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    fetchTechnician(id)
      .then((t) => alive && setName(t?.name || ''))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setSlips(null);
    setError('');
    setOpen(null);
    fetchTechnicianPayslips(id, year)
      .then((rows) => alive && setSlips(rows))
      .catch((err) => {
        if (!alive) return;
        setSlips([]);
        setError(err.message || 'Could not load payslips.');
      });
    return () => {
      alive = false;
    };
  }, [id, year]);

  const byMonth = useMemo(() => new Map((slips || []).map((p) => [Number(p.month), p])), [slips]);
  const months = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, slip: byMonth.get(i + 1) || null }));
  const totalPresent = months.reduce((s, x) => s + (Number(x.slip?.presentDays) || 0), 0);
  const totalEarned = months.reduce((s, x) => s + payout(x.slip), 0);
  const paidMonths = months.filter((x) => payout(x.slip) > 0).length;
  const loading = slips === null;

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
      <div className="relative flex items-center justify-center border-b border-[#ECECEC] pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className={cx('absolute left-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#E5F3F5] text-[#111111] transition hover:bg-[#E5F3F5]', FOCUS_RING)}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 px-12 text-center">
          <h1 className="text-[20px] font-extrabold text-[#111111]">Salary Report</h1>
          {name ? <p className="break-words text-[12.5px] font-semibold text-[#666666]">{name}</p> : null}
        </div>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#ECECEC] bg-white p-5 shadow-[0_4px_14px_rgba(16,24,40,0.06)]">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E5F3F5]" style={{ color: DARK }}>
            <CalendarDays className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[14px] text-[#667085]">Financial Year</p>
            <p className="text-[26px] font-extrabold leading-tight text-[#111111]">
              {year}-{String(year + 1).slice(-2)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full px-3 py-2 text-white" style={{ backgroundColor: DARK }}>
          <button type="button" onClick={() => setYear((y) => y - 1)} aria-label="Previous year" className="rounded-full p-1 hover:bg-white/15">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="px-2 text-[16px] font-bold">{year}</span>
          <span className="h-4 w-px bg-white/30" aria-hidden="true" />
          <button type="button" onClick={() => setYear((y) => y + 1)} aria-label="Next year" className="rounded-full p-1 hover:bg-white/15">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={Users} value={loading ? '…' : totalPresent} label="Total Present" sub="Days" />
        <Stat icon={Banknote} value={loading ? '…' : money(totalEarned)} label="Total Earned" sub={`${12 - paidMonths} not paid`} />
        <Stat icon={TrendingUp} value={loading ? '…' : money(paidMonths ? totalEarned / paidMonths : 0)} label="Avg / Month" sub="Avg payout" />
      </div>

      {error ? <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] font-semibold text-[#B42318]">{error}</p> : null}

      <section>
        <h2 className="mb-3 text-[18px] font-extrabold text-[#111111]">Monthly Payslips</h2>
        <ul className="space-y-2.5">
          {months.map(({ m, slip }) => {
            const amount = payout(slip);
            const paid = amount > 0;
            const expanded = open === m;
            return (
              <li key={m} className="overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white shadow-[0_2px_10px_rgba(16,24,40,0.04)]">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : m)}
                  aria-expanded={expanded}
                  className={cx('flex w-full items-center gap-3 px-4 py-4 text-left sm:gap-4', FOCUS_RING)}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[16px] font-extrabold" style={{ color: DARK }}>
                    {String(m).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-extrabold text-[#111111]">
                      {MONTHS[m - 1]} <span className="text-[14px] font-semibold text-[#98A2B3]">{year}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-[#667085]">
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      {loading ? '…' : Number(slip?.presentDays) || 0} Days
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={cx('rounded-full border px-3 py-0.5 text-[12.5px] font-bold', paid ? 'border-[#C7E6EA] bg-[#E5F3F5] text-[#024A57]' : 'border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]')}>
                      {paid ? 'Paid' : 'Unpaid'}
                    </span>
                    <span className="text-[16px] font-extrabold text-[#667085]">{money(amount)}</span>
                  </span>
                  <ChevronDown className={cx('h-5 w-5 shrink-0 text-[#667085] transition', expanded && 'rotate-180')} aria-hidden="true" />
                </button>
                {expanded ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[#ECECEC] bg-[#F8F8F8] px-4 py-3 sm:gap-x-6 sm:px-5 text-[13.5px] sm:grid-cols-3">
                    {slip ? (
                      [
                        ['Period', `${fmtDate(slip.periodStart)} – ${fmtDate(slip.periodEnd)}`],
                        ['Present days', Number(slip.presentDays) || 0],
                        ['Daily-wage days', Number(slip.dailyWageDays) || 0],
                        ['Regular salary', money(num(slip.regularSalary))],
                        ['Regular wage', money(num(slip.regularWage))],
                        ['Net payout', money(amount)],
                      ].map(([k, v]) => (
                        <p key={k} className="min-w-0 break-words">
                          <span className="block text-[11.5px] font-bold uppercase tracking-wide text-[#98A2B3]">{k}</span>
                          <span className="font-bold text-[#111111]">{v}</span>
                        </p>
                      ))
                    ) : (
                      <p className="col-span-full text-[#667085]">No payslip for this month yet.</p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
