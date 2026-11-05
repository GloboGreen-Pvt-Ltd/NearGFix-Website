'use client';

/**
 * /shop-home/reports/revenue — daily, weekly and monthly revenue.
 *
 * Real data: ticket rows' `paymentAmount`/`paymentPaidAt`
 * (GET {TICKET_BASE}/tickets via fetchTicketsPaged(), the exact fields
 * src/lib/shopDashboard.js's todaysRevenue()/yesterdaysRevenue() already
 * reduce for the Dashboard). There's no server-side date filter, so "this
 * month" is computed client-side over the full fetched list, same as the
 * rest of these report pages. There is no payment-method field anywhere
 * in this backend (confirmed by a full-tree grep) — this page shows
 * amount + date only, with an explicit note about that gap, never a
 * fabricated method breakdown.
 */

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, IndianRupee, Info, Loader2, Receipt, RefreshCw, TrendingUp } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import { HEADER_BUTTON, MonthPicker } from '@/components/shop-dashboard/HeaderControls';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonRows, SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import { MONTHS, shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchTicketsPaged, isToday } from '@/lib/shopDashboard';
import { downloadReportPdf } from '@/lib/reportPdf';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

const CARD = 'min-w-0 rounded-[20px] border border-[#E5E7EB] bg-white p-5 sm:p-6';

const TONE = {
  green: 'bg-[#035C6C]/10 text-[#035C6C]',
  blue: 'bg-[#0788C9]/10 text-[#0788C9]',
  orange: 'bg-[#FAA700]/15 text-[#B87A00]',
  navy: 'bg-[#1C3053]/10 text-[#1C3053]',
};

function RevenueStatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex min-w-0 flex-col rounded-[20px] border border-[#E5E7EB] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-semibold text-[#666666]">{label}</p>
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE[tone] || TONE.green)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 truncate text-[22px] font-extrabold leading-tight text-[#111111] sm:text-[26px]">{value}</p>
    </div>
  );
}

function CardTitle({ title, hint }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-[15px] font-bold text-[#111111]">{title}</h2>
      {hint ? <span className="text-xs text-[#666666]">{hint}</span> : null}
    </div>
  );
}

function money(n) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function RevenueReportPage() {
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
    fetchTicketsPaged()
      .then((list) => {
        if (alive) setTickets(list);
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load the revenue report.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const paid = useMemo(
    () =>
      tickets
        .filter((t) => t.paymentPaidAt && Number(t.paymentAmount) > 0)
        .sort((a, b) => new Date(b.paymentPaidAt) - new Date(a.paymentPaidAt)),
    [tickets],
  );

  const monthPaid = useMemo(
    () =>
      paid.filter((t) => {
        const d = new Date(t.paymentPaidAt);
        return d.getFullYear() === viewDate.getFullYear() && d.getMonth() === viewDate.getMonth();
      }),
    [paid, viewDate],
  );

  const monthRevenue = useMemo(() => monthPaid.reduce((sum, t) => sum + Number(t.paymentAmount || 0), 0), [monthPaid]);
  const todayRevenue = useMemo(() => paid.filter((t) => isToday(t.paymentPaidAt)).reduce((sum, t) => sum + Number(t.paymentAmount || 0), 0), [paid]);

  const daysWithPayments = useMemo(() => new Set(monthPaid.map((t) => new Date(t.paymentPaidAt).toDateString())).size, [monthPaid]);
  const avgPerDay = daysWithPayments > 0 ? monthRevenue / daysWithPayments : 0;

  const daily = useMemo(() => {
    const days = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const arr = Array.from({ length: days }, (_, i) => ({ day: i + 1, amount: 0 }));
    monthPaid.forEach((t) => {
      arr[new Date(t.paymentPaidAt).getDate() - 1].amount += Number(t.paymentAmount || 0);
    });
    return arr;
  }, [monthPaid, viewDate]);
  const maxDaily = Math.max(1, ...daily.map((d) => d.amount));
  const bestDay = daily.reduce((best, d) => (d.amount > best.amount ? d : best), { day: 0, amount: 0 });

  const weekly = useMemo(() => {
    const weeks = [0, 0, 0, 0, 0];
    daily.forEach((d) => {
      weeks[Math.min(4, Math.floor((d.day - 1) / 7))] += d.amount;
    });
    return weeks
      .map((amount, i) => ({ label: `Week ${i + 1}`, range: `${i * 7 + 1}–${Math.min(daily.length, i * 7 + 7)}`, amount }))
      .filter((w, i) => i * 7 < daily.length);
  }, [daily]);

  const monthStats = [
    { label: 'This Month', value: money(monthRevenue), icon: IndianRupee, tone: 'green' },
    { label: "Today's Revenue", value: money(todayRevenue), icon: TrendingUp, tone: 'blue' },
    { label: 'Avg / Active Day', value: money(avgPerDay), icon: CalendarDays, tone: 'orange' },
    { label: 'Transactions', value: monthPaid.length, icon: Receipt, tone: 'navy' },
  ];

  const goPrevMonth = () => shiftMonth(setViewDate, -1);
  const goNextMonth = () => shiftMonth(setViewDate, 1);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({
        title: 'Revenue Report',
        subtitle: `${new Date(viewDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} — NearGFix Partner Dashboard`,
        stats: monthStats.map((s) => ({ label: s.label, value: s.value })),
        notes: ['Payment-method breakdown is not tracked by this backend — amounts and dates only.'],
        columns: [
          { header: 'Date', value: (t) => new Date(t.paymentPaidAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) },
          { header: 'Customer', value: (t) => t.customerName || 'Not available' },
          { header: 'Device / Issue', value: (t) => t.deviceDisplayName || t.issueDescription || '—' },
          { header: 'Amount', value: (t) => money(t.paymentAmount) },
        ],
        rows: monthPaid,
        filename: 'revenue-report.pdf',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1440px] flex-col gap-5">
      <PageHeader
        title="Revenue Report"
        subtitle="Daily, weekly and monthly revenue."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={HEADER_BUTTON}>
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={loading || exporting || monthPaid.length === 0}
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
      >
        <MonthPicker
          label={`${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`}
          onPrev={goPrevMonth}
          onNext={goNextMonth}
        />
      </PageHeader>

      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}

      {loading ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {monthStats.map((s) => (
            <RevenueStatCard key={s.label} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={cx(CARD, 'lg:col-span-2')}>
          <CardTitle title="Daily Revenue" hint={`${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`} />
          {loading ? (
            <SkeletonRows rows={4} />
          ) : monthPaid.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No revenue this month yet" description="Daily totals will appear once tickets are paid." />
          ) : (
            <div className="flex h-48 items-end gap-[2px] sm:gap-1" role="img" aria-label="Daily revenue bar chart">
              {daily.map((d) => (
                <div key={d.day} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <div
                    className={cx('w-full rounded-t-[4px] transition-colors', d.amount > 0 ? 'bg-[#035C6C] group-hover:bg-[#0788C9]' : 'bg-[#E5E7EB]')}
                    style={{ height: `${d.amount > 0 ? Math.max(4, (d.amount / maxDaily) * 100) : 2}%` }}
                    title={`${d.day} ${MONTHS[viewDate.getMonth()]}: ${money(d.amount)}`}
                  />
                  <span className={cx('mt-1 text-[10px] text-[#666666]', d.day % 5 !== 1 && 'invisible')}>{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={CARD}>
          <CardTitle title="Weekly Breakdown" hint={bestDay.amount > 0 ? `Best day: ${bestDay.day} · ${money(bestDay.amount)}` : null} />
          {loading ? (
            <SkeletonRows rows={4} />
          ) : (
            <ul className="flex flex-col gap-3.5">
              {weekly.map((w) => (
                <li key={w.label}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold text-[#111111]">
                      {w.label} <span className="text-xs font-normal text-[#666666]">Days {w.range}</span>
                    </span>
                    <span className="font-bold text-[#111111]">{money(w.amount)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
                    <div className="h-full rounded-full bg-[#0788C9]" style={{ width: `${monthRevenue > 0 ? (w.amount / monthRevenue) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 flex items-start gap-1.5 rounded-xl bg-[#F8FAFC] px-3 py-2.5 text-xs text-[#024A57]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Payment-method breakdown isn&apos;t tracked by this backend — amounts and dates only.
          </p>
        </section>
      </div>

      <section className={cx(CARD, 'p-0 sm:p-0')}>
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <CardTitle title="Transactions This Month" hint={loading ? null : `${monthPaid.length} payments`} />
        </div>
        {loading ? (
          <SkeletonRows rows={5} />
        ) : monthPaid.length === 0 ? (
          <EmptyState icon={Receipt} title="No revenue this month yet" description="Paid tickets will show up here as amount + date." />
        ) : (
          <div className="divide-y divide-[#E5E7EB] border-t border-[#E5E7EB]">
            {monthPaid.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#035C6C]/10">
                  <IndianRupee className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#111111]">{t.customerName || t.deviceDisplayName || 'Ticket'}</p>
                  <p className="truncate text-xs text-[#666666]">
                    {new Date(t.paymentPaidAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                    {t.customerName && t.deviceDisplayName ? ` · ${t.deviceDisplayName}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-[#111111]">{money(t.paymentAmount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
