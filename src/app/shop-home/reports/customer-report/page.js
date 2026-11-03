'use client';

/**
 * /shop-home/reports/customer-report — customer activity and service
 * history, report-styled.
 *
 * Reuses the exact same derivation services/customers/page.js already
 * uses (src/lib/customerDirectory.js's deriveCustomers over
 * GET {ORDER_BASE}/repair-bookings/shop) — same stats, same "Pending
 * Payments — not tracked yet" honesty note that page already shows, just
 * laid out as a report with a month switcher for "New This Month" and a
 * "Download PDF" export. No new derivation, no new data source.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, Loader2, Mail, Phone, RefreshCw, Users } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import StatCard from '@/components/shop-dashboard/StatCard';
import SearchField from '@/components/shop-dashboard/SearchField';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SkeletonRows, SkeletonStatCards } from '@/components/shop-dashboard/SkeletonBlocks';
import MonthSwitcher, { shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchShopBookings, friendlyBookingStatus } from '@/lib/shopDashboard';
import { deriveCustomers as deriveCustomerDirectory } from '@/lib/customerDirectory';
import { downloadReportPdf } from '@/lib/reportPdf';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function deriveCustomers(bookings) {
  return deriveCustomerDirectory(bookings).map((c) => {
    const withStatus = c.bookings.map((b) => ({ ...b, ...friendlyBookingStatus(b.status) }));
    const active = withStatus.some((b) => ['Created', 'Pickup', 'In Progress'].includes(b.statusLabel));
    const totalSpent = c.bookings.reduce((sum, b) => sum + Number(b.pricing?.finalAmount ?? b.pricing?.estimatedAmount ?? 0), 0);
    return { ...c, active, totalSpent };
  });
}

export default function CustomerReportPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [expandedKey, setExpandedKey] = useState(null);
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
    fetchShopBookings()
      .then((list) => {
        if (alive) setBookings(list);
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load the customer report.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const customers = useMemo(() => deriveCustomers(bookings), [bookings]);

  const newThisMonth = useMemo(
    () =>
      customers.filter((c) => {
        if (!c.firstServiceAt) return false;
        const d = new Date(c.firstServiceAt);
        return d.getFullYear() === viewDate.getFullYear() && d.getMonth() === viewDate.getMonth();
      }).length,
    [customers, viewDate],
  );
  const activeCount = customers.filter((c) => c.active).length;
  const repeatCount = customers.filter((c) => c.totalBookings > 1).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [customers, query]);

  const monthStats = [
    { label: 'Total Customers', value: customers.length, icon: Users, tone: 'green' },
    { label: 'New This Month', value: newThisMonth, icon: Users, tone: 'blue' },
    { label: 'Active Customers', value: activeCount, icon: Users, tone: 'orange' },
    { label: 'Repeat Customers', value: repeatCount, icon: Users, tone: 'violet' },
  ];

  const goPrevMonth = () => shiftMonth(setViewDate, -1);
  const goNextMonth = () => shiftMonth(setViewDate, 1);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadReportPdf({
        title: 'Customer Report',
        subtitle: 'NearGFix Partner Dashboard',
        stats: monthStats.map((s) => ({ label: s.label, value: s.value })),
        notes: ['Pending-payment amounts are not tracked by this backend.'],
        columns: [
          { header: 'Customer', key: 'name' },
          { header: 'Phone', key: 'phone' },
          { header: 'Bookings', key: 'totalBookings' },
          { header: 'Total Spent', value: (c) => `₹${Number(c.totalSpent || 0).toLocaleString('en-IN')}` },
        ],
        rows: filtered,
        filename: 'customer-report.pdf',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customer Report"
        subtitle="View customer activity and service history."
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
              disabled={loading || exporting || filtered.length === 0}
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

      <MonthSwitcher viewDate={viewDate} onPrev={goPrevMonth} onNext={goNextMonth} label="New Customers This Month" />

      {loading ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {monthStats.map((s) => (
            <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </div>
      )}

      <section className="rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
        <div className="border-b border-[#ECECEC] px-4 py-4 sm:px-5">
          <SearchField value={query} onChange={setQuery} placeholder="Search by name, phone, or email" />
        </div>

        {loading ? (
          <SkeletonRows rows={5} />
        ) : filtered.length === 0 ? (
          customers.length === 0 ? (
            <EmptyState icon={Users} title="No customers yet" description="Customers from your bookings will show up here." />
          ) : (
            <EmptyState icon={Users} tone="muted" title="No customers match your search" description="Try a different name, phone, or email." />
          )
        ) : (
          <div className="divide-y divide-[#ECECEC]">
            {filtered.map((c) => (
              <CustomerRow key={c.key} customer={c} expanded={expandedKey === c.key} onToggle={() => setExpandedKey(expandedKey === c.key ? null : c.key)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CustomerRow({ customer, expanded, onToggle }) {
  return (
    <div>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#F8F8F8] sm:px-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8] text-sm font-bold text-[#024A57]">
          {initials(customer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#111111]">{customer.name}</p>
          <p className="truncate text-xs text-[#666666]">
            {customer.phone || 'No phone'} {customer.email ? `· ${customer.email}` : ''}
          </p>
        </div>
        <span className="hidden shrink-0 text-xs font-semibold text-[#666666] sm:block">
          {customer.totalBookings} booking{customer.totalBookings === 1 ? '' : 's'}
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-[#98A2B3] transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-dashed border-[#ECECEC] bg-[#F8F8F8] px-4 py-4 sm:px-5">
          <div className="grid grid-cols-1 gap-1.5 text-sm text-[#344054] sm:grid-cols-2">
            <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0 text-[#98A2B3]" aria-hidden="true" />{customer.phone || '—'}</p>
            <p className="flex min-w-0 items-center gap-1.5 break-all"><Mail className="h-3.5 w-3.5 shrink-0 text-[#98A2B3]" aria-hidden="true" />{customer.email || '—'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-xs text-[#666666]">Total Spent</p>
              <p className="text-sm font-bold text-[#111111]">₹{customer.totalSpent.toLocaleString('en-IN')}</p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="text-xs text-[#666666]">Pending Payments</p>
              <p className="text-sm font-bold text-[#98A2B3]">— <span className="text-[0.65rem] font-normal">not tracked yet</span></p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
