/**
 * shopDashboard.js — real data for /shop-home (the Partner Dashboard).
 *
 * No single backend endpoint aggregates "today's KPIs" for a shop, so this
 * module fetches the few real endpoints that do exist and computes the
 * dashboard tiles client-side. Endpoints used (all shop-scoped from the JWT,
 * no shopId param):
 *   - GET {ORDER_BASE}/repair-bookings/shop      (order-service)
 *   - GET {TICKET_BASE}/tickets/counts           (ticket-service)
 *   - GET {TICKET_BASE}/tickets?page=&size=      (ticket-service, paginated)
 *   - GET {TICKET_BASE}/technicians              (ticket-service)
 *   - GET {MARKETPLACE_BASE}/shop/chats          (marketplace-service)
 *
 * None of these has a date filter, so "today" / "yesterday" / "last 7 days"
 * are computed here from each row's createdAt/paymentPaidAt in the browser's
 * local time zone.
 */

import { ORDER_BASE, TICKET_BASE, MARKETPLACE_BASE } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';

// Ticket.status values that precede the repair actually being handed back —
// see TicketService.getCountsByShop (ticket-service). Mirrors the mobile
// owner app's own "Active Repairs" / "Ready for Delivery" grouping so the
// two surfaces never disagree.
export const ACTIVE_REPAIR_STATUSES = ['CREATED', 'IN_DIAGNOSIS', 'QUOTED', 'APPROVED', 'IN_REPAIR'];
export const READY_FOR_DELIVERY_STATUSES = ['READY', 'INVOICE_GENERATED', 'INVOICE_READY', 'DELIVERED_PROCESSING'];

// RepairBooking.status values before the device has actually left the
// customer (DEVICE_PICKED_UP onward it's no longer "pending").
const PENDING_PICKUP_STATUSES = [
  'PICKUP_REQUESTED',
  'PICKUP_ACCEPTED',
  'PICKUP_PERSON_ASSIGNED',
  'PICKUP_ASSIGNED',
  'PICKUP_REASSIGNED',
  'PICKUP_ON_THE_WAY',
  'REACHED_CUSTOMER_LOCATION',
  'REPAIR_ESTIMATE_PROCESSING',
];

export async function fetchShopBookings() {
  const list = await shopRequest(ORDER_BASE(), '/repair-bookings/shop');
  return Array.isArray(list) ? list : [];
}

/**
 * Single booking, including its `events` timeline — GET
 * {ORDER_BASE}/repair-bookings/shop/{id} (order-service
 * RepairBookingController.getForShop, "Single booking lookup scoped to the
 * caller's shop"). Confirmed against the backend source: this is the
 * shop-owner-authorized counterpart of GET /repair-bookings/{id} (which is
 * CUSTOMER-only and 403s a shop token) — do not switch this back to the
 * no-/shop path.
 */
export async function fetchShopBookingDetail(id) {
  return shopRequest(ORDER_BASE(), `/repair-bookings/shop/${encodeURIComponent(id)}`);
}

export async function fetchTicketCounts() {
  const counts = await shopRequest(TICKET_BASE(), '/tickets/counts');
  return counts && typeof counts === 'object' ? counts : {};
}

export async function fetchShopChats() {
  const list = await shopRequest(MARKETPLACE_BASE(), '/shop/chats');
  return Array.isArray(list) ? list : [];
}

export async function fetchTechnicians() {
  const list = await shopRequest(TICKET_BASE(), '/technicians');
  return Array.isArray(list) ? list : [];
}

/*
 * One employee's own records (ticket-service TechnicianController — the calls
 * the Partner app's Employee Details screen makes):
 *   GET /technicians/{id}                         TechnicianResponse (incl. defaultCheckIn/Out, photoUrl, dateOfJoin)
 *   GET /technicians/{id}/attendance?month&year   AttendanceSummaryResponse (presentDays, leaveDays, permissionCount, lateHours, dailyRecords)
 *   GET /technicians/{id}/leaves?month&year       LeaveRequestResponse[]
 *   GET /technicians/{id}/advances                SalaryAdvanceResponse[]
 * month is 1–12.
 */
const techPath = (id) => `/technicians/${encodeURIComponent(id)}`;

export async function fetchTechnician(id) {
  return shopRequest(TICKET_BASE(), techPath(id));
}

export async function fetchTechnicianAttendance(id, month, year) {
  return shopRequest(TICKET_BASE(), `${techPath(id)}/attendance?month=${month}&year=${year}`);
}

/** One day's attendance — GET /technicians/{id}/attendance/day?date=YYYY-MM-DD (AttendanceRecordResponse). */
export async function fetchTechnicianAttendanceDay(id, date) {
  return shopRequest(TICKET_BASE(), `${techPath(id)}/attendance/day?date=${encodeURIComponent(date)}`);
}

export async function fetchTechnicianLeaves(id, { month, year } = {}) {
  const q = month && year ? `?month=${month}&year=${year}` : '';
  const list = await shopRequest(TICKET_BASE(), `${techPath(id)}/leaves${q}`);
  return Array.isArray(list) ? list : [];
}

export async function fetchTechnicianAdvances(id) {
  const list = await shopRequest(TICKET_BASE(), `${techPath(id)}/advances`);
  return Array.isArray(list) ? list : [];
}

/** GET /technicians/{id}/payslips?year — PayslipResponse[] (month, presentDays, netSalary, netWage…). */
export async function fetchTechnicianPayslips(id, year) {
  const list = await shopRequest(TICKET_BASE(), `${techPath(id)}/payslips?year=${year}`);
  return Array.isArray(list) ? list : [];
}

/** POST /technicians/{id}/leaves — CreateLeaveRequest { leaveType, startDate, endDate, totalDays, reason }. */
export async function createTechnicianLeave(id, body) {
  return shopRequest(TICKET_BASE(), `${techPath(id)}/leaves`, { method: 'POST', body: JSON.stringify(body) });
}

/** GET /technicians/leaves?status= — every employee's leave requests (status optional: PENDING/APPROVED/REJECTED). */
export async function fetchAllLeaves(status) {
  const list = await shopRequest(TICKET_BASE(), `/technicians/leaves${status ? `?status=${encodeURIComponent(status)}` : ''}`);
  return Array.isArray(list) ? list : [];
}

/** PATCH …/leaves/{leaveId}/approve | /reject with LeaveStatusUpdateRequest. */
export async function decideLeave(technicianId, leaveId, approve, { remarks, rejectionReason } = {}) {
  const action = approve ? 'approve' : 'reject';
  return shopRequest(TICKET_BASE(), `${techPath(technicianId)}/leaves/${encodeURIComponent(leaveId)}/${action}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: approve ? 'APPROVED' : 'REJECTED', remarks: remarks || null, rejectionReason: rejectionReason || null }),
  });
}

/** PATCH /technicians/{id} — UpdateTechnicianRequest (only the fields given change). */
export async function updateTechnician(id, body) {
  return shopRequest(TICKET_BASE(), techPath(id), { method: 'PATCH', body: JSON.stringify(body) });
}

/** DELETE /technicians/{id}. */
export async function deleteTechnician(id) {
  return shopRequest(TICKET_BASE(), techPath(id), { method: 'DELETE' });
}

/**
 * Assign a technician to a repair ticket — PATCH {TICKET_BASE}/tickets/{id}
 * (ticket-service "Patch ticket (currently supports technician assignment
 * and simple fields)"; body is a field map, keyed like TicketResponse's own
 * assignedTechnicianId). The returned ticket is checked: if the backend
 * didn't actually record this technician, this throws instead of letting
 * the UI report a success that didn't happen.
 */
export async function assignTicketTechnician(ticketId, technicianId) {
  const ticket = await shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ assignedTechnicianId: technicianId }),
  });
  if (ticket && ticket.assignedTechnicianId && String(ticket.assignedTechnicianId) !== String(technicianId)) {
    throw new Error('The ticket service did not record this technician. Please try again.');
  }
  if (ticket && !ticket.assignedTechnicianId) {
    throw new Error('The ticket service returned no assigned technician — the assignment was not saved.');
  }
  return ticket;
}

/** One repair ticket — GET {TICKET_BASE}/tickets/{id} (TicketResponse). */
export async function fetchTicket(ticketId) {
  return shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}`);
}

/** A ticket's Service History timeline — GET {TICKET_BASE}/tickets/{id}/events. */
export async function fetchTicketEvents(ticketId) {
  const rows = await shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}/events`);
  return Array.isArray(rows) ? rows : [];
}

/**
 * Record a service-status step — POST {TICKET_BASE}/tickets/{id}/progress-events,
 * the call the Partner app's Update Service Status sheet makes. actor=OWNER
 * marks it as a deliberate shop-side action; the backend writes the timeline
 * row and advances ticket.status to match (e.g. READY).
 */
export async function recordTicketStatus(ticketId, statusKey) {
  return shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}/progress-events`, {
    method: 'POST',
    body: JSON.stringify({ statusKey, actor: 'OWNER' }),
  });
}

/** Full TicketRequest re-sent from a loaded ticket — PUT /tickets/{id} rewrites every field it carries. */
function ticketRequestBody(ticket) {
  return {
    customerId: ticket.customerId,
    customerName: ticket.customerName ?? null,
    customerPhone: ticket.customerPhone ?? null,
    brandId: ticket.brandId ?? null,
    modelId: ticket.modelId ?? null,
    ramOptionId: ticket.ramOptionId ?? null,
    storageOptionId: ticket.storageOptionId ?? null,
    color: ticket.color ?? null,
    imei: ticket.imei ?? null,
    issueDescription: ticket.issueDescription ?? null,
    issueAudioUrl: ticket.issueAudioUrl ?? null,
    estimatedPrice: ticket.estimatedPrice ?? null,
    paymentType: ticket.paymentType ?? null,
    paymentAmount: ticket.paymentAmount ?? null,
    deviceDisplayName: ticket.deviceDisplayName ?? null,
    deviceImageUrl: ticket.deviceImageUrl ?? null,
    repairServicesSummary: ticket.repairServicesSummary ?? null,
    priceItemsJson: ticket.priceItemsJson ?? null,
    missingPartsJson: ticket.missingPartsJson ?? null,
    devicePhotosJson: ticket.devicePhotosJson ?? null,
    deviceSecurityType: ticket.deviceSecurityType || 'NONE',
    deviceSecurityValue: ticket.deviceSecurityValue ?? null,
    customerApproval: ticket.customerApproval ?? null,
    estimatedReadyAt: ticket.estimatedReadyAt ?? null,
    estimatedDeliveryAt: ticket.estimatedDeliveryAt ?? null,
  };
}

/**
 * Re-Schedule — save a new estimated ready / delivery time on the repair
 * ticket: GET it fresh, then PUT {TICKET_BASE}/tickets/{id} with every other
 * field unchanged. Dates are ISO strings (or null to clear); a date left
 * undefined keeps its saved value. Status is not touched. Returns the
 * updated TicketResponse.
 */
export async function updateTicketSchedule(ticketId, { estimatedReadyAt, estimatedDeliveryAt }) {
  const ticket = await fetchTicket(ticketId);
  if (!ticket?.id) throw new Error('Repair ticket not found.');
  const body = ticketRequestBody(ticket);
  if (estimatedReadyAt !== undefined) body.estimatedReadyAt = estimatedReadyAt;
  if (estimatedDeliveryAt !== undefined) body.estimatedDeliveryAt = estimatedDeliveryAt;
  return shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticket.id)}`, { method: 'PUT', body: JSON.stringify(body) });
}

/**
 * Save a re-estimate — the same two calls the Partner app's edit flow makes
 * (ServiceBookingDevicesListScreen, editMode):
 *   1. PUT {TICKET_BASE}/tickets/{id} with the full TicketRequest. PUT
 *      rewrites every field it carries (device, lock, photos, payment...), so
 *      everything is re-sent from the freshly loaded `ticket` and only the
 *      price lines, estimate, services summary and approval change. The
 *      backend emits RE_ESTIMATED_CONFIRMED and moves the ticket to QUOTED
 *      when the price or line items changed.
 *   2. PATCH {TICKET_BASE}/tickets/{id}/status?status=QUOTED — what the app
 *      sends too, for statuses the backend's own move skips. Not fatal: the
 *      re-estimate is already saved by then.
 * `items` are { id, code, label, amount, warranty } — the priceItemsJson shape
 * the app writes.
 */
export async function reEstimateTicket(ticket, { items, customerApproval }) {
  const total = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const body = {
    customerId: ticket.customerId,
    customerName: ticket.customerName ?? null,
    customerPhone: ticket.customerPhone ?? null,
    brandId: ticket.brandId ?? null,
    modelId: ticket.modelId ?? null,
    ramOptionId: ticket.ramOptionId ?? null,
    storageOptionId: ticket.storageOptionId ?? null,
    color: ticket.color ?? null,
    imei: ticket.imei ?? null,
    issueDescription: ticket.issueDescription ?? null,
    issueAudioUrl: ticket.issueAudioUrl ?? null,
    estimatedPrice: total,
    paymentType: ticket.paymentType ?? null,
    paymentAmount: ticket.paymentAmount ?? null,
    deviceDisplayName: ticket.deviceDisplayName ?? null,
    deviceImageUrl: ticket.deviceImageUrl ?? null,
    repairServicesSummary: items.map((it) => it.label).filter(Boolean).join(', ') || null,
    priceItemsJson: items.length ? JSON.stringify(items) : null,
    missingPartsJson: ticket.missingPartsJson ?? null,
    devicePhotosJson: ticket.devicePhotosJson ?? null,
    deviceSecurityType: ticket.deviceSecurityType || 'NONE',
    deviceSecurityValue: ticket.deviceSecurityValue ?? null,
    customerApproval: customerApproval ?? null,
    estimatedReadyAt: ticket.estimatedReadyAt ?? null,
    estimatedDeliveryAt: ticket.estimatedDeliveryAt ?? null,
  };
  const id = encodeURIComponent(ticket.id);
  const saved = await shopRequest(TICKET_BASE(), `/tickets/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  try {
    await shopRequest(TICKET_BASE(), `/tickets/${id}/status?status=QUOTED`, { method: 'PATCH' });
  } catch {
    // Re-estimate is saved; only the status move failed.
  }
  return saved;
}

/**
 * Pages through GET /tickets (Spring Page<TicketResponse>) collecting rows,
 * bounded by maxPages so a shop with an unusually large ticket history can't
 * hang the dashboard load. There is no date-range param on this endpoint, so
 * "today's revenue" below is only as complete as this sweep — a real
 * GET /tickets/revenue?date= would replace this if it's ever added.
 */
export async function fetchTicketsPaged({ maxPages = 10, size = 200 } = {}) {
  let all = [];
  for (let page = 0; page < maxPages; page += 1) {
    const data = await shopRequest(TICKET_BASE(), `/tickets?page=${page}&size=${size}`);
    const content = Array.isArray(data?.content) ? data.content : [];
    all = all.concat(content);
    if (data?.last !== false || content.length === 0) break;
  }
  return all;
}

function dayKey(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toDateString();
}

export function isToday(iso) {
  return dayKey(iso) === new Date().toDateString();
}

export function isYesterday(iso) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return dayKey(iso) === y.toDateString();
}

/** "+12% from yesterday" / "New today" / null — never invents a number when there's nothing to compare. */
export function trendFromYesterday(today, yesterday) {
  if (yesterday > 0) {
    const pct = Math.round(((today - yesterday) / yesterday) * 100);
    if (pct === 0) return 'Same as yesterday';
    return `${pct > 0 ? '+' : ''}${pct}% from yesterday`;
  }
  return today > 0 ? 'New today' : null;
}

export function sumActiveRepairs(counts) {
  return ACTIVE_REPAIR_STATUSES.reduce((sum, key) => sum + Number(counts[key] || 0), 0);
}

export function sumReadyForDelivery(counts) {
  return READY_FOR_DELIVERY_STATUSES.reduce((sum, key) => sum + Number(counts[key] || 0), 0);
}

export function pendingPickups(bookings) {
  return bookings.filter((b) => b.serviceMode === 'PICKUP' && PENDING_PICKUP_STATUSES.includes(b.status));
}

export function openEnquiries(chats) {
  return chats.filter((c) => Number(c.unreadCount || 0) > 0);
}

export function completionRate(counts) {
  const total = Number(counts.total || 0) - Number(counts.CANCELLED || 0);
  if (total <= 0) return 0;
  return Math.round((Number(counts.DELIVERED || 0) / total) * 100);
}

/** Last 7 days (oldest first, today last), bucketed by booking createdAt. */
export function weeklyBookings(bookings) {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: d.toDateString(), day: d.toLocaleDateString(undefined, { weekday: 'narrow' }), count: 0, today: i === 0 });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  bookings.forEach((b) => {
    const key = dayKey(b.createdAt);
    const bucket = key && byKey.get(key);
    if (bucket) bucket.count += 1;
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  return days.map((d) => ({ day: d.day, today: d.today, value: d.count > 0 ? Math.max(0.08, d.count / max) : 0, count: d.count }));
}

function formatTime(localTime) {
  if (!localTime) return null;
  const [h, m] = String(localTime).split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m || 0).padStart(2, '0')} ${period}`;
}

/** The soonest upcoming pending pickup, or null if there isn't one. */
export function nextPickup(bookings) {
  const pending = pendingPickups(bookings).filter((b) => b.pickupDate);
  if (pending.length === 0) return null;
  pending.sort((a, b) => {
    const da = `${a.pickupDate}T${a.pickupSlotStart || '00:00'}`;
    const db = `${b.pickupDate}T${b.pickupSlotStart || '00:00'}`;
    return da.localeCompare(db);
  });
  const b = pending[0];
  const start = formatTime(b.pickupSlotStart);
  const end = formatTime(b.pickupSlotEnd);
  return {
    title: `Pickup — ${b.customerName || 'Customer'}`,
    subtitle: b.issueSummary || 'Device pickup',
    time: start && end ? `${start} – ${end}` : start || 'Time not set',
  };
}

/** Most recent bookings, newest first. */
export function recentBookings(bookings, limit = 4) {
  return [...bookings]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit)
    .map((b) => ({ ...b, ...friendlyBookingStatus(b.status) }));
}

/**
 * The full repair-booking status machine has ~15 values across the pickup
 * and enquiry flows (see order-service RepairBooking.status). The dashboard
 * card only has room for a short badge, so this buckets them into the same
 * four groups the original design mock used, defaulting anything
 * unrecognised to "In Progress" rather than throwing.
 */
export function friendlyBookingStatus(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'CANCELLED') return { statusLabel: 'Cancelled' };
  if (['DELIVERED', 'RECEIVED_AT_SHOP', 'DEVICE_PICKED_UP'].includes(s)) return { statusLabel: 'Completed' };
  if (s.startsWith('PICKUP') || s === 'REACHED_CUSTOMER_LOCATION' || s === 'REACHED_SHOP') return { statusLabel: 'Pickup' };
  if (['ORDER_PLACED', 'CREATED', 'SERVICE_ACCEPTED'].includes(s)) return { statusLabel: 'Created' };
  return { statusLabel: 'In Progress' };
}

/**
 * Technicians who currently have an open job, most-recently-updated first.
 * Joins on assignedTechnicianId first; falls back to a name match since
 * technician-id joins have drifted from the id in other parts of this
 * codebase (see repair_bookings.assignedPickupPersonId) — cheap insurance
 * against the same drift here.
 */
export function teamActivity(technicians, tickets, limit = 5) {
  const open = tickets.filter((t) => ACTIVE_REPAIR_STATUSES.includes(t.status));
  const rows = technicians
    .map((tech) => {
      const jobs = open
        .filter((t) => t.assignedTechnicianId === tech.id || t.assignedTechnicianName === tech.name)
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      const job = jobs[0];
      if (!job) return null;
      return {
        name: tech.name || 'Technician',
        task: job.deviceDisplayName ? `${job.deviceDisplayName} — ${job.issueDescription || 'repair'}` : job.issueDescription || 'Repair in progress',
        status: ['IN_REPAIR', 'IN_DIAGNOSIS'].includes(job.status) ? 'In Progress' : 'Pending',
        updatedAt: job.updatedAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    .slice(0, limit);
  return rows;
}

export function todaysRevenue(tickets) {
  return tickets
    .filter((t) => t.paymentPaidAt && isToday(t.paymentPaidAt))
    .reduce((sum, t) => sum + Number(t.paymentAmount || 0), 0);
}

export function yesterdaysRevenue(tickets) {
  return tickets
    .filter((t) => t.paymentPaidAt && isYesterday(t.paymentPaidAt))
    .reduce((sum, t) => sum + Number(t.paymentAmount || 0), 0);
}
