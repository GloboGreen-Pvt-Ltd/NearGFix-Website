/**
 * customerDirectory.js — the shop's own previously-booked-customer list,
 * derived client-side from GET {ORDER_BASE}/repair-bookings/shop
 * (fetchShopBookings(), src/lib/shopDashboard.js).
 *
 * There is no dedicated customer-roster or customer-search-by-name endpoint
 * anywhere in this backend reachable from a shop-owner session — confirmed
 * by a full-tree investigation. Every customer-shaped path that does exist
 * (`{USER_BASE}/customer/addresses`, `{TICKET_BASE}/tickets/customer/{id}`)
 * is a customer *self-service* endpoint, authenticated with the customer's
 * own bearer token, not the shop's. There is also no ID-proof/KYC field on
 * any customer-shaped data this client can reach — the shop's own KYC
 * (shopKyc.js) is a completely different, unrelated thing.
 *
 * So "search existing customer" anywhere in this app means "search
 * customers who have booked with this shop before," built from the same
 * booking feed the Customers and Bookings pages already use — never a real
 * backend directory lookup, and never an ID-proof preview. This module is
 * the ONE place that derivation happens, so the Customers page and Book
 * Service's customer search both see identical results instead of two
 * slightly-different reimplementations.
 */

import { formatPickupAddress } from './bookingFormat';

export function deriveCustomers(bookings) {
  const map = new Map();
  bookings.forEach((b) => {
    const key = (b.customerMobile || b.customerName || 'unknown').toLowerCase().trim();
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: b.customerName || 'Customer',
        phone: b.customerMobile || '',
        email: b.customerEmail || '',
        address: '',
        addressBooking: null,
        bookings: [],
      });
    }
    const c = map.get(key);
    if (!c.name && b.customerName) c.name = b.customerName;
    if (!c.phone && b.customerMobile) c.phone = b.customerMobile;
    if (!c.email && b.customerEmail) c.email = b.customerEmail;
    if (!c.address && b.pickupAddress) {
      c.address = formatPickupAddress(b);
      c.addressBooking = b;
    }
    c.bookings.push(b);
  });

  return Array.from(map.values()).map((c) => {
    const sorted = [...c.bookings].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const first = [...c.bookings].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))[0];
    return {
      ...c,
      totalBookings: c.bookings.length,
      lastServiceAt: sorted[0]?.createdAt || null,
      firstServiceAt: first?.createdAt || null,
      lastBooking: sorted[0] || null,
    };
  });
}
