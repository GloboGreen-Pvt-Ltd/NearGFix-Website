'use client';

/**
 * /shop-home/services/bookings/?stage=<all|active|ready|delivered>
 *
 * All repair/service bookings — see components/shop-dashboard/BookingsBoard.js.
 * Invoiced bookings have their own page (../invoice).
 */

import BookingsBoard from '@/components/shop-dashboard/BookingsBoard';

export default function BookingsPage() {
  return <BookingsBoard />;
}
