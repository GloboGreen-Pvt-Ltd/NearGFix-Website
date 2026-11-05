'use client';

/**
 * /shop-home/reports/expense-report — no backing endpoint exists anywhere
 * in this codebase (confirmed by a full-tree grep for "expense" — zero
 * hits beyond the nav label itself). See NotYetAvailablePage's header
 * comment for why this is a real page, not the generic ComingSoon stub,
 * and why there's no "Download PDF" button here — there's nothing real
 * to export.
 */

import { IndianRupee } from 'lucide-react';
import NotYetAvailablePage from '@/components/shop-dashboard/NotYetAvailablePage';

export default function ExpenseReportPage() {
  return (
    <NotYetAvailablePage
      title="Expense Report"
      subtitle="Track business expenses."
      icon={IndianRupee}
      statLabels={['This Month', 'Last Month', 'Categories', 'Entries']}
      filters={['Today', 'This Week', 'This Month']}
      explanation="Expense tracking isn't available yet — this backend has no expense-tracking data or endpoint anywhere."
    />
  );
}
