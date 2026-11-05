/**
 * orderStages.js — ONE definition of which booking/pickup lands in which
 * stage, shared by the dashboard's Business Overview cards and the pages
 * those cards open (Bookings, Pickups). Because both sides count with these
 * same functions over the same rows, a card that says "2" always opens a
 * list of exactly those 2.
 *
 * Inputs are the real rows the pages already load:
 *   bookings — GET {ORDER_BASE}/repair-bookings/shop
 *   tickets  — GET {TICKET_BASE}/tickets (joined on booking.ticketId, or
 *              ticket.bookingId), because Ready for Delivery / Invoice /
 *              Delivered are repair-ticket stages, not booking statuses.
 */

import { friendlyBookingStatus } from '@/lib/shopDashboard';

// Ticket-service statuses behind the delivery-side stages.
const READY_TICKET = ['READY', 'DELIVERED_PROCESSING'];
const INVOICE_TICKET = ['INVOICE_GENERATED', 'INVOICE_READY'];

// RepairBooking.status values for the pickup tabs (order-service).
const PICKUP_REQUESTED = ['PICKUP_REQUESTED'];
// Accepted by the shop and not yet at the shop.
const PICKUP_ACCEPTED = [
  'PICKUP_ACCEPTED',
  'PICKUP_PERSON_ASSIGNED',
  'PICKUP_ASSIGNED',
  'PICKUP_REASSIGNED',
  'PICKUP_ON_THE_WAY',
  'REACHED_CUSTOMER_LOCATION',
  'DEVICE_PICKED_UP',
];

const upper = (v) => String(v || '').toUpperCase();

/**
 * Booking stage: 'active' | 'ready' | 'invoice' | 'delivered' | 'returned' | 'completed' | 'cancelled'.
 * 'returned' = repair ticket CANCELLED — what the Bookings card's Return
 * button records (the ticket service has no separate returned status).
 */
export function bookingStage(row) {
  const t = upper(row.ticketStatus);
  const b = upper(row.status);
  if (t === 'DELIVERED' || b === 'DELIVERED') return 'delivered';
  if (t === 'CANCELLED') return 'returned';
  if (INVOICE_TICKET.includes(t)) return 'invoice';
  if (READY_TICKET.includes(t)) return 'ready';
  if (row.statusLabel === 'Cancelled') return 'cancelled';
  if (row.statusLabel === 'Completed') return 'completed';
  return 'active';
}

/** Pickup tabs a pickup booking belongs to (besides 'all'). */
export function pickupTabs(row) {
  const s = upper(row.status);
  const tabs = [];
  if (PICKUP_REQUESTED.includes(s)) tabs.push('requested');
  if (PICKUP_ACCEPTED.includes(s)) tabs.push('accepted');
  if (row.stage === 'ready') tabs.push('ready');
  return tabs;
}

/**
 * Bookings joined to their ticket, newest first, each with statusLabel,
 * ticket fields (ticketRef/ticketStatus/assigned technician), `stage`,
 * `isPickup` and `pickupTabs`.
 */
export function buildOrderRows(bookings, tickets) {
  const list = Array.isArray(tickets) ? tickets : [];
  const byId = new Map(list.map((t) => [String(t.id), t]));
  const byBooking = new Map(list.filter((t) => t.bookingId).map((t) => [String(t.bookingId), t]));
  return (Array.isArray(bookings) ? bookings : [])
    .map((b) => {
      const ticket = (b.ticketId && byId.get(String(b.ticketId))) || byBooking.get(String(b.id)) || null;
      const row = {
        ...b,
        ...friendlyBookingStatus(b.status),
        ticketRef: ticket?.id || b.ticketId || null,
        // The ticket's own tracking number ("GTS-138") — what the app shows.
        trackingId: ticket?.trackingId || null,
        ticketStatus: ticket?.status,
        assignedTechnicianId: ticket?.assignedTechnicianId || null,
        assignedTechnicianName: ticket?.assignedTechnicianName || b.technicianName || '',
        // Set once the ticket has an invoice (any later status, Delivered included).
        invoiceNo: ticket?.invoiceNo || null,
        hasInvoice: Boolean(ticket?.invoiceId || ticket?.invoiceNo || ticket?.invoiceGeneratedAt),
        isPickup: b.serviceMode === 'PICKUP',
      };
      row.stage = bookingStage(row);
      row.pickupTabs = row.isPickup ? pickupTabs(row) : [];
      return row;
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/**
 * On the Bookings list? A doorstep pickup joins it only once the device is
 * at the shop and its repair ticket exists — as in the Partner app, whose
 * Jobs list is the ticket book (bookingScopes.js). Until then it lives on
 * the Pickups page only.
 */
export const onBookingsList = (row) => !row.isPickup || Boolean(row.ticketRef);

/**
 * The number shown for a booking: the ticket's tracking ID ("GTS-138"), as in
 * the Partner app. A shop booking's bookingNumber is that ID plus an 8-char
 * suffix ("GTS-138-67AD4907"); without a ticket the suffix is dropped.
 */
export const bookingRef = (row) =>
  row?.trackingId || String(row?.bookingNumber || '').replace(/^(#?[A-Z]+-\d+)-[0-9A-F]{8}$/i, '$1') || row?.id || '';

/** Bookings-list stage counts — over onBookingsList rows, so each count matches its tab. */
export function countByStage(rows) {
  const list = rows.filter(onBookingsList);
  const c = { all: list.length, active: 0, ready: 0, invoice: 0, delivered: 0, returned: 0, completed: 0, cancelled: 0 };
  list.forEach((r) => {
    c[r.stage] = (c[r.stage] || 0) + 1;
  });
  return c;
}

export function countPickups(rows) {
  const pickups = rows.filter((r) => r.isPickup);
  const c = { all: pickups.length, requested: 0, accepted: 0, ready: 0 };
  pickups.forEach((r) => r.pickupTabs.forEach((t) => (c[t] += 1)));
  return c;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Tabs + per-tab header/empty copy for the Bookings page (?stage=). */
export const BOOKING_STAGE_TABS = [
  { key: 'all', label: 'Jobs', eyebrow: 'Jobs', title: (n) => plural(n, 'Job', 'Jobs'), emptyTitle: 'No jobs yet', emptyText: 'Every repair job your shop creates or receives will show up here.' },
  { key: 'active', label: 'Active', eyebrow: 'Jobs', title: (n) => plural(n, 'Job', 'Jobs'), emptyTitle: 'No active jobs', emptyText: 'Jobs that are still being worked on will appear here.' },
  { key: 'ready', label: 'Ready for Delivery', eyebrow: 'Ready for Delivery', title: (n) => `${plural(n, 'Job', 'Jobs')} Ready for Delivery`, emptyTitle: 'Nothing ready for delivery', emptyText: 'Repaired devices waiting to be handed back to the customer will appear here.' },
  { key: 'delivered', label: 'Delivered', eyebrow: 'Delivered Jobs', title: (n) => plural(n, 'Delivered Job', 'Delivered Jobs'), emptyTitle: 'No delivered jobs', emptyText: 'Jobs handed back to the customer will appear here.' },
  { key: 'returned', label: 'Return', eyebrow: 'Returned', title: (n) => plural(n, 'Returned Job', 'Returned Jobs'), emptyTitle: 'No returned jobs', emptyText: 'Devices handed back to the customer without repair will appear here.' },
  { key: 'invoice', label: 'Invoice', eyebrow: 'Invoice', title: (n) => `${plural(n, 'Job', 'Jobs')} Invoiced`, emptyTitle: 'No invoiced jobs', emptyText: 'Jobs with an invoice generated will appear here.' },
];

/** Tabs + per-tab header/empty copy for the Pickups page (?tab=). */
export const PICKUP_TABS = [
  { key: 'all', label: 'All Pickups', eyebrow: 'All Pickups', title: (n) => plural(n, 'Pickup', 'Pickups'), emptyTitle: 'No pickups yet', emptyText: 'Doorstep pickups for this shop will appear here.' },
  { key: 'requested', label: 'Pickup Request', eyebrow: 'Pickup Requests', title: (n) => plural(n, 'Pickup Request', 'Pickup Requests'), emptyTitle: 'No pickup requests', emptyText: 'New doorstep pickup requests will appear here.' },
  { key: 'accepted', label: 'Pickup Accepted', eyebrow: 'Accepted Pickups', title: (n) => plural(n, 'Accepted Pickup', 'Accepted Pickups'), emptyTitle: 'No accepted pickups', emptyText: 'Pickups you have accepted will appear here until they reach the shop.' },
  { key: 'ready', label: 'Ready for Delivery', eyebrow: 'Ready for Delivery', title: (n) => `${plural(n, 'Pickup', 'Pickups')} Ready for Delivery`, emptyTitle: 'Nothing ready for delivery', emptyText: 'Picked-up devices that are repaired and waiting to go back will appear here.' },
];

export const bookingsHref = (stage) => (stage && stage !== 'all' ? `/shop-home/services/bookings/?stage=${stage}` : '/shop-home/services/bookings/');
export const pickupsHref = (tab) => (tab && tab !== 'all' ? `/shop-home/services/pickups/?tab=${tab}` : '/shop-home/services/pickups/');

/** Read ?<param>= once on mount (window.location — no Suspense needed under static export). */
export function readQueryParam(param, allowed) {
  if (typeof window === 'undefined') return 'all';
  const v = new URLSearchParams(window.location.search).get(param);
  return v && allowed.includes(v) ? v : 'all';
}

/** Keep the selected tab in the URL so refresh/back/share keep it. */
export function writeQueryParam(param, value) {
  const url = new URL(window.location.href);
  if (!value || value === 'all') url.searchParams.delete(param);
  else url.searchParams.set(param, value);
  window.history.replaceState(null, '', url);
}
