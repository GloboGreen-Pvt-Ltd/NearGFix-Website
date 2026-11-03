/**
 * serviceTimeline.js — repair-booking event timeline for the shop-side
 * Service History page (src/app/shop-home/services/bookings/[id]/page.js).
 *
 * SERVICE_STEPS below is the same canonical event-key -> label table the
 * customer app already renders (see the Timeline() function in
 * src/components/site/account/OrdersExperience.js) — copied rather than
 * imported so this shop-dashboard page doesn't reach into a customer-facing
 * component file. Keep the two in sync if the backend ever adds or renames
 * an event key.
 *
 * A booking's `events` array (each `{status, createdAt, note, audioUrl,
 * imageUrls}`) only comes back from the single-booking detail fetch, not the
 * shop's booking list — see fetchShopBookingDetail() in shopDashboard.js.
 */

export const SERVICE_STEPS = [
  ['PICKUP_BOOKING_CREATED', 'Pickup Booking Created'],
  ['PICKUP_REQUESTED', 'Pickup Requested'],
  ['PICKUP_PERSON_ASSIGNED', 'Pickup Person Assigned'],
  ['PICKUP_ASSIGNED', 'Pickup Person Assigned'],
  ['PICKUP_ON_THE_WAY', 'Pickup Person On The Way'],
  ['REACHED_CUSTOMER_LOCATION', 'Reached Customer Location'],
  ['REPAIR_ESTIMATE_PROCESSING', 'Repair Estimate Processing'],
  ['DEVICE_PICKED_UP', 'Device Picked Up'],
  ['PICKED_UP', 'Device Picked Up'],
  ['REACHED_SHOP', 'Pickup Person Reached Shop'],
  ['RECEIVED_AT_SHOP', 'Device Received at Shop'],
  ['BOOKING_CREATED_BY_SHOP', 'Booking Created by Shop'],
  ['SERVICE_ACCEPTED', 'Service Accepted'],
  ['ASSIGNED_TO_TECHNICIAN', 'Assigned to Technician'],
  ['AWAITING_TECHNICIAN_ACCEPTANCE', 'Awaiting Technician Acceptance'],
  ['REASSIGNED_TO_TECHNICIAN', 'Re-assigned to Technician'],
  ['TECHNICIAN_ACCEPTED_SERVICE', 'Technician Accepted Service'],
  ['TECHNICIAN_WORK_STARTED', 'Technician Work Started'],
  ['TECHNICIAN_UPLOADED_DEVICE_IMAGES', 'Technician Uploaded Device Images'],
  ['TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED', 'Technician Issue Verified & Updated'],
  ['RE_ESTIMATED_CONFIRMED', 'Service Re-estimated'],
  ['CUSTOMER_APPROVED', 'Customer Approved'],
  ['CUSTOMER_REJECTED', 'Customer Rejected'],
  ['IN_REPAIR', 'Repair Work In Progress'],
  ['PARTS_REQUIRED', 'Spare Parts Waiting'],
  ['QUALITY_CHECK_COMPLETED', 'Quality Check Completed'],
  ['REPAIR_COMPLETED', 'Repair Completed'],
  ['INVOICE_GENERATED', 'Invoice Generated'],
  ['READY', 'Ready for Delivery'],
  ['RETURN_DELIVERY', 'Return Delivery'],
  ['DELIVERED', 'Delivered to Customer'],
  ['CANCELLED', 'Repair Cancelled'],
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/** Most-recent event per status key (first one wins if a status repeats). */
export function eventsByStatus(booking) {
  const map = {};
  asArray(booking?.events).forEach((event) => {
    const key = String(event?.status || '').toUpperCase();
    if (key && !map[key]) map[key] = event;
  });
  return map;
}

/** The single most recent event overall, or null if there are none yet. */
export function latestEvent(booking) {
  const events = asArray(booking?.events)
    .slice()
    .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime());
  return events[0] || null;
}

/**
 * Every canonical step (CANCELLED only included when it actually happened),
 * each flagged with its matching event and done/upcoming state — the shop
 * History page renders this list top to bottom exactly as returned.
 */
export function buildTimelineSteps(booking) {
  const byStatus = eventsByStatus(booking);
  const latest = String(latestEvent(booking)?.status || '').toUpperCase();
  return SERVICE_STEPS.filter(([key]) => key !== 'CANCELLED' || byStatus.CANCELLED).map(([key, label]) => {
    const event = byStatus[key] || null;
    return { key, label, event, done: Boolean(event), current: Boolean(event) && key === latest };
  });
}

export function completedStepCount(booking) {
  return buildTimelineSteps(booking).filter((s) => s.done).length;
}

export function eventCount(booking) {
  return asArray(booking?.events).length;
}

/**
 * SERVICE_STEPS grouped into the same broad phases the shop mobile app's
 * Service History screen headers with ("Shop Service", "In Process", ...).
 * The backend has no phase field of its own — this is a client-side
 * regrouping of the real per-status events, same spirit as
 * shopDashboard.js's friendlyBookingStatus() bucketing raw statuses for
 * display.
 */
export const SERVICE_PHASES = [
  { key: 'PICKUP', label: 'Device Pickup', steps: ['PICKUP_BOOKING_CREATED', 'PICKUP_REQUESTED', 'PICKUP_PERSON_ASSIGNED', 'PICKUP_ASSIGNED', 'PICKUP_ON_THE_WAY', 'REACHED_CUSTOMER_LOCATION', 'REPAIR_ESTIMATE_PROCESSING', 'DEVICE_PICKED_UP', 'PICKED_UP', 'REACHED_SHOP', 'RECEIVED_AT_SHOP'] },
  { key: 'SHOP_SERVICE', label: 'Shop Service', steps: ['BOOKING_CREATED_BY_SHOP', 'SERVICE_ACCEPTED', 'ASSIGNED_TO_TECHNICIAN', 'AWAITING_TECHNICIAN_ACCEPTANCE', 'REASSIGNED_TO_TECHNICIAN'] },
  { key: 'IN_PROCESS', label: 'In Process', steps: ['TECHNICIAN_ACCEPTED_SERVICE', 'TECHNICIAN_WORK_STARTED', 'TECHNICIAN_UPLOADED_DEVICE_IMAGES', 'TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED', 'RE_ESTIMATED_CONFIRMED', 'CUSTOMER_APPROVED', 'CUSTOMER_REJECTED', 'IN_REPAIR', 'PARTS_REQUIRED'] },
  { key: 'QUALITY_DELIVERY', label: 'Quality & Delivery', steps: ['QUALITY_CHECK_COMPLETED', 'REPAIR_COMPLETED', 'INVOICE_GENERATED', 'READY', 'RETURN_DELIVERY', 'DELIVERED'] },
  { key: 'CANCELLED', label: 'Cancelled', steps: ['CANCELLED'] },
];

/**
 * SERVICE_PHASES with each phase's real steps attached and a rolled-up
 * status ('done' | 'active' | 'upcoming') from how many of its steps have a
 * matching event. Phases with no matching steps at all (e.g. Cancelled, when
 * the booking wasn't) are left out entirely.
 */
// Second keys for a step the app shows once — listed only when they carry an event.
const ALIAS_STEPS = { PICKUP_ASSIGNED: 'PICKUP_PERSON_ASSIGNED', PICKED_UP: 'DEVICE_PICKED_UP' };

export function buildTimelineGroups(booking) {
  const all = buildTimelineSteps(booking);
  const byKey = new Map(all.map((s) => [s.key, s]));
  const steps = all.filter((s) => {
    const primary = ALIAS_STEPS[s.key];
    if (!primary) return true;
    return s.done && !byKey.get(primary)?.done;
  });
  // A walk-in (shop-created) booking never has a pickup leg — as in the app, it starts at "Booking Created by Shop".
  const hasPickup = steps.some((s) => s.done && SERVICE_PHASES[0].steps.includes(s.key));
  const shopCreated = Boolean(byKey.get('BOOKING_CREATED_BY_SHOP')?.done);
  const stepByKey = new Map(steps.map((s) => [s.key, s]));
  return SERVICE_PHASES.map((phase) => {
    if (phase.key === 'PICKUP' && shopCreated && !hasPickup) return null;
    const groupSteps = phase.steps.map((key) => stepByKey.get(key)).filter(Boolean);
    if (!groupSteps.length) return null;
    const doneCount = groupSteps.filter((s) => s.done).length;
    const status = doneCount === 0 ? 'upcoming' : doneCount === groupSteps.length ? 'done' : 'active';
    return { key: phase.key, label: phase.label, steps: groupSteps, status };
  }).filter(Boolean);
}
