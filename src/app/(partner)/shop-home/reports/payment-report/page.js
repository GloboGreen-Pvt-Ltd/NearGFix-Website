'use client';

/**
 * /shop-home/reports/payment-report — payment transaction ledger.
 *
 * Same real ticket `paymentAmount`/`paymentPaidAt` fields Revenue Report
 * uses (GET {TICKET_BASE}/tickets via fetchTicketsPaged()) — this page is
 * the transaction-ledger view of the same data instead of the revenue-
 * trend view. There is no `paymentMethod`, `paymentStatus`, or
 * `transactionId` field anywhere in this backend (confirmed by a
 * full-tree grep) — every row here is explicitly amount + date only, with
 * a visible note about that gap, never a fabricated method/ID column.
 */

import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Download, IndianRupee, Info, Loader2, Receipt, RefreshCw, TrendingUp } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import StatCard from '@/components/shop-dashboard/StatCard';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonRows, SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import MonthSwitcher, { shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchTicketsPaged } from '@/lib/shopDashboard';
import { downloadReportPdf } from '@/lib/reportPdf';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

function money(n) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function PaymentReportPage() {
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
        if (alive) setError(err.message || 'Could not load the payment report.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const paid = useMemo(
    () => tickets.filter((t) => t.paymentPaidAt && Number(t.paymentAmount) > 0).sort((a, b) => new Date(b.paymentPaidAt) - new Date(a.paymentPaidAt)),
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

  const totalCollected = useMemo(() => monthPaid.reduce((sum, t) => sum + Number(t.paymentAmount || 0), 0), [monthPaid]);
  const highest = useMemo(() => monthPaid.reduce((max, t) => Math.max(max, Number(t.paymentAmount || 0)), 0), [monthPaid]);
  const average = monthPaid.length > 0 ? totalCollected / monthPaid.length : 0;

  const monthStats = [
    { label: 'Total Collected', value: money(totalCollected), icon: IndianRupee, tone: 'green' },
    { label: 'Transactions', value: monthPaid.length, icon: Receipt, tone: 'blue' },
    { label: 'Highest Payment', value: money(highest), icon: TrendingUp, tone: 'orange' },
    { label: 'Average Payment', value: money(average), icon: CreditCard, tone: 'violet' },
  ];

  const goPrevMonth = () => shiftMonth(setViewDate, -1);
  const goNextMonth = () => shiftMonth(setViewDate, 1);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({
        title: 'Payment Report',
        subtitle: `${new Date(viewDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} — NearGFix Partner Dashboard`,
        stats: monthStats.map((s) => ({ label: s.label, value: s.value })),
        notes: ['Payment method and transaction ID are not tracked by this backend — amount and date only.'],
        columns: [
          { header: 'Date', value: (t) => new Date(t.paymentPaidAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) },
          { header: 'Customer', value: (t) => t.customerName || 'Not available' },
          { header: 'Amount', value: (t) => money(t.paymentAmount) },
        ],
        rows: monthPaid,
        filename: 'payment-report.pdf',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payment Report"
        subtitle="Analyze payment transactions and collected amounts."
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

      <p className="flex items-start gap-1.5 rounded-xl bg-[#F8F8F8] px-3.5 py-2.5 text-xs text-[#024A57]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Payment method and transaction ID aren&apos;t tracked by this backend — every row below shows amount and date only.
      </p>

      <div>
        <p className="mb-2.5 text-sm font-bold text-[#111111]">Payments This Month</p>
        <section className="rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
          {loading ? (
            <SkeletonRows rows={5} />
          ) : monthPaid.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments this month yet" description="Paid tickets will show up here." />
          ) : (
            <div className="divide-y divide-[#ECECEC]">
              {monthPaid.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8]">
                    <CreditCard className="h-4 w-4 text-[#024A57]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111111]">{t.customerName || t.deviceDisplayName || 'Ticket'}</p>
                    <p className="truncate text-xs text-[#666666]">
                      {new Date(t.paymentPaidAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-[#111111]">{money(t.paymentAmount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
