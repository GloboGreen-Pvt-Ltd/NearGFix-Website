'use client';

/**
 * /shop-home/services/invoice — bookings with an invoice generated (the
 * 'invoice' stage in lib/orderStages.js). Same list, cards and actions as
 * Bookings (components/shop-dashboard/BookingsBoard.js), without stage tabs.
 */

import BookingsBoard from '@/components/shop-dashboard/BookingsBoard';

export default function InvoicePage() {
  return <BookingsBoard fixedStage="invoice" />;
}
