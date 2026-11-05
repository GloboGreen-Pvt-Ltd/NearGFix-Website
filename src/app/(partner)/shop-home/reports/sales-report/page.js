'use client';

/**
 * /shop-home/reports/sales-report — no shop-scoped Buy/Sell listing
 * endpoint exists anywhere in this codebase (confirmed: the only real
 * Buy/Sell order data reachable is a CUSTOMER-scoped single-order fetch,
 * getSellOrder(id) in src/lib/customerAccount.js, authenticated with the
 * customer's own bearer token — not something a shop session can list
 * from). See NotYetAvailablePage's header comment for why this is a real
 * page, not the generic ComingSoon stub, and why there's no "Download
 * PDF" button here — there's nothing real to export.
 */

import { ShoppingBag } from 'lucide-react';
import NotYetAvailablePage from '@/components/shop-dashboard/NotYetAvailablePage';

export default function SalesReportPage() {
  return (
    <NotYetAvailablePage
      title="Sales Report"
      subtitle="View Buy/Sell transaction reports."
      icon={ShoppingBag}
      statLabels={['Buy Orders', 'Sell Orders', 'Total Value', 'This Month']}
      filters={['Today', 'This Week', 'This Month']}
      explanation="Buy/Sell transaction reporting isn't available yet — this backend has no shop-scoped Buy/Sell order listing endpoint."
    />
  );
}
