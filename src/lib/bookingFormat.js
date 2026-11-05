/**
 * bookingFormat.js — shared display helpers for any page built on
 * fetchShopBookings() (order-service repair-bookings): Pickups, Bookings,
 * and Customers' booking-history derivation all use these, so a status
 * badge/color never disagrees between pages (see friendlyBookingStatus in
 * shopDashboard.js for the bucket logic itself — this file only formats).
 */

export const BOOKING_STATUS_BADGE = {
  Created: 'bg-[#E5F3F5] text-[#024A57]',
  'In Progress': 'bg-sky-100 text-sky-700',
  Pickup: 'bg-orange-100 text-orange-700',
  Completed: 'bg-violet-100 text-violet-700',
  Cancelled: 'bg-red-100 text-red-700',
};

export const BOOKING_STATUS_FILTERS = ['All', 'Created', 'Pickup', 'In Progress', 'Completed', 'Cancelled'];

export const SERVICE_MODE_LABEL = {
  WALK_IN: 'Walk-in',
  PICKUP: 'Pickup',
  DOORSTEP: 'On-site Service',
};

export function formatSlotTime(value) {
  if (!value) return null;
  const [h, m] = String(value).split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${period}`;
}

export function formatBookingDate(dateStr) {
  if (!dateStr) return 'Date not set';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatPickupAddress(booking) {
  const a = booking.pickupAddress;
  if (a && typeof a === 'object') {
    const parts = [a.addressLine, a.landmark, a.city, a.district, a.state, a.pincode].filter(Boolean);
    if (parts.length) return parts.join(', ');
  }
  if (booking.pickupAddressText) return booking.pickupAddressText;
  return 'Address not provided';
}

export function bookingEstimatedAmount(booking) {
  return booking.pricing?.estimatedAmount ?? booking.pricing?.finalAmount ?? null;
}
