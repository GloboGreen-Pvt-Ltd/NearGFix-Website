'use client';

/**
 * /shop-home/reports/profit-loss — NOT a full P&L statement.
 *
 * Revenue is real (same ticket paymentAmount/paymentPaidAt Revenue Report
 * uses). Expenses don't exist anywhere in this codebase (confirmed by a
 * full-tree grep for "expense" — zero hits beyond nav labels), so no real
 * net profit/loss number can ever be computed here. This page shows the
 * one real number it has (Revenue this month) and is explicit that the
 * other half of the equation isn't tracked — it never invents an expense
 * figure or a fabricated net total. The PDF export carries the same
 * caveat, not just the on-screen UI.
 */

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, IndianRupee, Loader2, RefreshCw } from 'lucide-react';

import { cx } from '@/components/site/ui';
import StatCard from '@/components/shop-dashboard/StatCard';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import { shiftMonth, MONTHS } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchTicketsPaged } from '@/lib/shopDashboard';
import { downloadReportPdf } from '@/lib/reportPdf';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

function money(n) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function ProfitLossReportPage() {
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
        if (alive) setError(err.message || 'Could not load the profit & loss report.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const monthRevenue = useMemo(() => {
    return tickets
      .filter((t) => t.paymentPaidAt && Number(t.paymentAmount) > 0)
      .filter((t) => {
        const d = new Date(t.paymentPaidAt);
        return d.getFullYear() === viewDate.getFullYear() && d.getMonth() === viewDate.getMonth();
      })
      .reduce((sum, t) => sum + Number(t.paymentAmount || 0), 0);
  }, [tickets, viewDate]);

  const goPrevMonth = () => shiftMonth(setViewDate, -1);
  const goNextMonth = () => shiftMonth(setViewDate, 1);
  const monthLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({
        title: 'Profit & Loss',
        subtitle: monthLabel,
        stats: [
          { label: 'Revenue', value: money(monthRevenue) },
          { label: 'Expenses', value: 'Not tracked' },
          { label: 'Net Profit / Loss', value: 'Not computable' },
        ],
        notes: [
          'This is not a full profit & loss statement. Revenue is real (paid tickets this month). ' +
            'This backend has no expense-tracking data anywhere, so a real net profit/loss figure cannot be computed — ' +
            'it is intentionally not shown rather than estimated or fabricated.',
        ],
        filename: 'profit-loss.pdf',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Hero — ONE complete banner image (public/profit-loss.png): that
          asset already renders its own title/subtitle/icon/artwork as one
          finished scene (unlike Service Report's asset, this one has no
          fake baked controls), so it's shown directly via object-cover
          inside a single overflow-hidden rounded container, with the real
          Refresh/Download PDF/month-selector controls overlaid on top. */}
      <div
        className="relative overflow-hidden rounded-[22px] p-6 sm:p-7"
        style={{ background: '#F8F8F8', border: '1px solid #ECECEC', isolation: 'isolate' }}
      >
        <div className="pr-0 md:pr-[420px]">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[34px]">Profit &amp; Loss</h1>
          <p className="mt-1 text-[14px] text-[#666666] sm:text-[15px]">Compare business income against expenses.</p>
        </div>

        <div className="absolute right-3 top-3 z-[5] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className={cx(
              'inline-flex h-9 items-center gap-1.5 rounded-full border border-[#ECECEC] bg-white/95 px-3 text-sm font-semibold text-[#1C3053] backdrop-blur-sm transition hover:border-[#035C6C] hover:text-[#035C6C] sm:px-3.5',
              FOCUS_RING,
            )}
          >
            <RefreshCw className={cx('h-4 w-4 text-[#035C6C]', loading && 'animate-spin')} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || exporting}
            className={cx(
              'inline-flex h-9 items-center gap-1.5 rounded-full bg-[#F3BF23] px-3 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-60 sm:px-3.5',
              FOCUS_RING,
            )}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            <span className="hidden sm:inline">Download PDF</span>
          </button>
          <div className="inline-flex h-9 items-center gap-0.5 rounded-full bg-gradient-to-r from-[#035C6C] to-[#035C6C] p-1">
            <button
              type="button"
              onClick={goPrevMonth}
              aria-label="Previous month"
              className={cx('flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:bg-white/15', FOCUS_RING)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="px-1.5 text-sm font-bold text-white">
              <span className="hidden sm:inline">{monthLabel}</span>
              <span className="sm:hidden">{viewDate.getFullYear()}</span>
            </span>
            <button
              type="button"
              onClick={goNextMonth}
              aria-label="Next month"
              className={cx('flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:bg-white/15', FOCUS_RING)}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}

      {loading ? (
        <SkeletonStatCards count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={IndianRupee} label={`Revenue — ${monthLabel}`} value={money(monthRevenue)} tone="green" />
          <StatCard icon={IndianRupee} label="Expenses" value="Not tracked" tone="orange" />
          <StatCard icon={IndianRupee} label="Net Profit / Loss" value="Not computable" tone="violet" />
        </div>
      )}

      <div role="note" className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          This isn&apos;t a full profit &amp; loss statement. Revenue above is real (paid tickets this month) — this backend has no
          expense-tracking data anywhere, so a real net profit/loss figure can&apos;t be computed. It&apos;s shown as &ldquo;Not
          tracked&rdquo;/&ldquo;Not computable&rdquo; rather than estimated.
        </span>
      </div>
    </div>
  );
}
