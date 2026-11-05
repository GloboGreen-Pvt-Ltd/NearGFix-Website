/**
 * serviceMilestones.js — web port of the Partner app's Service History
 * tracker logic (GGFIX-Partner-App/src/screens/common/serviceMilestones.js +
 * labelForStatus / withoutSupersededVerdicts from serviceHistoryPhases.js and
 * technicianExtras from BookingTimelineScreen.js). Keep in step with the app.
 *
 * A milestone is Done only when ITS OWN closing event exists; technician
 * Service Progress steps each get their own row.
 */

const STATUS_LABELS = {
  PICKUP_BOOKING_CREATED: 'Pickup Booking Created',
  PICKUP_PERSON_ASSIGNED: 'Pickup Person Assigned',
  PICKUP_ON_THE_WAY: 'Pickup Person On The Way',
  REACHED_CUSTOMER_LOCATION: 'Reached Customer Location',
  REPAIR_ESTIMATE_PROCESSING: 'Repair Estimate Processing',
  DEVICE_PICKED_UP: 'Device Picked Up',
  REACHED_SHOP: 'Pickup Person Reached Shop',
  RECEIVED_AT_SHOP: 'Device Received at Shop',
  BOOKING_CREATED_BY_SHOP: 'Booking Created by Shop',
  SERVICE_ACCEPTED: 'Service Accepted',
  BOOKING_EDITED: 'Booking Edited',
  ASSIGNED_TO_TECHNICIAN: 'Technician Assigned',
  AWAITING_TECHNICIAN_ACCEPTANCE: 'Awaiting Technician Acceptance',
  REASSIGNED_TO_TECHNICIAN: 'Re-Assigned to Technician',
  TECHNICIAN_ACCEPTED_SERVICE: 'Technician Accepted Service',
  TECHNICIAN_WORK_STARTED: 'Technician Work Started',
  TECHNICIAN_UPLOADED_DEVICE_IMAGES: 'Technician Uploaded Device Images',
  IN_REPAIR: 'Repair Work in Progress',
  TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED: 'Technician Issue Verified & Updated',
  TECHNICIAN_REESTIMATE_REQUESTED: 'Technician Re-Estimate Requested',
  RE_ESTIMATED_CONFIRMED: 'Service Re-Estimated – Awaiting Customer Approval',
  RE_ESTIMATE_APPROVED: 'Re-Estimate Approved by Customer',
  CUSTOMER_APPROVED: 'Customer Approved',
  RE_ESTIMATE_REJECTED: 'Re-Estimate Rejected by Customer',
  REPAIR_WORK_RESUMED: 'Repair Work in Progress (Resumed)',
  PARTS_REQUIRED: 'Spare Parts Waiting',
  REPAIR_COMPLETED: 'Repair Completed',
  QUALITY_CHECK_COMPLETED: 'Quality Check Completed',
  READY: 'Ready for Delivery',
  INVOICE_GENERATED: 'Invoice Generated',
  DELIVERED_PROCESSING: 'Dispatched',
  CUSTOMER_REJECTED: 'Customer Rejected',
  REPAIR_NOT_COMPLETED: 'Repair Not Completed',
  RETURN_DELIVERY: 'Return Delivery',
  DELIVERED: 'Delivered to Customer',
  CANCELLED: 'Repair Cancelled',
  TECHNICIAN_ASSIGNED: 'Technician Assigned',
  WAITING_FOR_CUSTOMER_APPROVAL: 'Service Re-Estimated – Awaiting Customer Approval',
};

const EXTRA_LABELS = {
  ISSUE_IDENTIFIED: 'Issue Identified',
  WAITING_FOR_CUSTOMER_APPROVAL: 'Awaiting Customer Approval',
  PICKUP_REQUESTED: 'Pickup Requested',
  PICKUP_ACCEPTED: 'Pickup Accepted',
  PICKUP_REASSIGNED: 'Pickup Re-assigned',
};

const PICKUP_STARTS = ['PICKUP_BOOKING_CREATED', 'PICKUP_REQUESTED'];
const PICKUP_KEYS = [
  ...PICKUP_STARTS, 'PICKUP_ACCEPTED', 'PICKUP_REASSIGNED', 'PICKUP_PERSON_ASSIGNED', 'PICKUP_ON_THE_WAY',
  'REACHED_CUSTOMER_LOCATION', 'REPAIR_ESTIMATE_PROCESSING', 'DEVICE_PICKED_UP', 'REACHED_SHOP', 'RECEIVED_AT_SHOP',
];
const RETURN_TRIGGERS = ['CUSTOMER_REJECTED', 'REPAIR_NOT_COMPLETED', 'RETURN_DELIVERY'];
const VERDICT_KEYS = ['CUSTOMER_APPROVED', 'CUSTOMER_REJECTED', 'RE_ESTIMATE_APPROVED', 'RE_ESTIMATE_REJECTED', 'REPAIR_WORK_RESUMED'];

const up = (s) => String(s || '').toUpperCase();
export const eventTime = (e) => { const t = Date.parse(e?.createdAt || ''); return Number.isNaN(t) ? 0 : t; };
const at = eventTime;

export const labelOf = (status) => STATUS_LABELS[up(status)] || EXTRA_LABELS[up(status)] || null;

/** Drops Customer Approved / Rejected verdicts that predate the latest re-estimate. */
export function withoutSupersededVerdicts(events) {
  const list = Array.isArray(events) ? events : [];
  let reAt = null;
  list.forEach((e) => {
    if (up(e?.status) !== 'RE_ESTIMATED_CONFIRMED') return;
    const t = Date.parse(e?.createdAt || '');
    if (!Number.isNaN(t) && (reAt == null || t > reAt)) reAt = t;
  });
  if (reAt == null) return list;
  return list.filter((e) => {
    if (!VERDICT_KEYS.includes(up(e?.status))) return true;
    const t = Date.parse(e?.createdAt || '');
    return Number.isNaN(t) || t >= reAt;
  });
}

const urlOf = (x) => (typeof x === 'string' ? x : x?.url || x?.uri || x?.imageUrl || null);
function parseList(raw) {
  if (Array.isArray(raw)) return raw;
  try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
const PHOTO_KEYS = ['front', 'back', 'photo3', 'photo4', 'photo5'];
function bookingPhotoUrls(ticket) {
  let v = ticket?.devicePhotosJson;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return []; }
  }
  let list;
  if (Array.isArray(v)) list = v.map(urlOf);
  else if (v && typeof v === 'object') {
    const keys = [...PHOTO_KEYS, ...Object.keys(v).filter((k) => !PHOTO_KEYS.includes(k) && !/video/i.test(k))];
    list = keys.map((k) => urlOf(v[k]));
  } else return [];
  return [...new Set(list.filter((u) => typeof u === 'string' && u.trim()))];
}

/** Technician material kept outside the event log (display only). */
export function technicianExtras(ticket, notes, packs) {
  const out = [];
  const atBooking = bookingPhotoUrls(ticket);
  if (atBooking.length) out.push({ milestone: 'BOOKED', imageUrls: atBooking });
  const photos = parseList(ticket?.technicianPhotosJson).map(urlOf).filter(Boolean);
  if (photos.length) out.push({ milestone: 'DIAGNOSED', imageUrls: photos });
  (notes || []).forEach((n) => out.push({
    milestone: 'DIAGNOSED',
    note: n.note, audioUrl: n.audioUrl || null, imageUrls: n.imageUrls || [], createdAt: n.createdAt,
  }));
  (packs || []).forEach((p) => {
    const files = parseList(p.filesJson);
    out.push({
      milestone: 'DIAGNOSED',
      createdAt: p.createdAt,
      imageUrls: files.filter((f) => (f?.type || 'image') === 'image').map(urlOf).filter(Boolean),
      audioUrl: urlOf(files.find((f) => f?.type === 'audio')) || null,
    });
  });
  return out;
}

/** Milestones with state: done · current · upcoming · missed · stopped. */
export function buildMilestones(rawEvents, extras = []) {
  const events = withoutSupersededVerdicts(rawEvents).filter((e) => e?.status);
  const byKey = {};
  events.forEach((e) => { (byKey[up(e.status)] = byKey[up(e.status)] || []).push(e); });
  Object.values(byKey).forEach((list) => list.sort((a, b) => at(a) - at(b)));
  const has = (k) => !!byKey[k];

  const pickup = PICKUP_KEYS.some(has);
  const returnPath = RETURN_TRIGGERS.some(has);
  const reEstimated = has('RE_ESTIMATED_CONFIRMED');
  const decisionLabel = has('RE_ESTIMATE_REJECTED') ? 'Re-Estimate Rejected by Customer'
    : has('RE_ESTIMATE_APPROVED') || has('CUSTOMER_APPROVED') ? 'Re-Estimate Approved by Customer'
      : has('CUSTOMER_REJECTED') ? 'Customer Rejected'
        : 'Re-Estimate Approved / Rejected by Customer';
  const inRepair = { key: 'IN_REPAIR', label: 'Repair Work in Progress', activeLabel: 'Waiting for repair to start',
    keys: ['IN_REPAIR'], doneKeys: ['IN_REPAIR'] };

  const defs = [
    { key: 'BOOKED', label: 'Booking Confirmed', activeLabel: 'Booking received',
      keys: ['BOOKING_CREATED_BY_SHOP', 'SERVICE_ACCEPTED', ...PICKUP_STARTS],
      doneKeys: ['BOOKING_CREATED_BY_SHOP', 'SERVICE_ACCEPTED', ...PICKUP_STARTS] },
    pickup ? { key: 'COLLECTED', label: 'Device Received at Shop', activeLabel: 'Pickup in progress',
      keys: PICKUP_KEYS.filter((k) => !PICKUP_STARTS.includes(k)), doneKeys: ['RECEIVED_AT_SHOP'] } : null,
    { key: 'ASSIGNED', label: 'Technician Assigned', activeLabel: 'Assigning a technician',
      keys: ['ASSIGNED_TO_TECHNICIAN', 'AWAITING_TECHNICIAN_ACCEPTANCE', 'REASSIGNED_TO_TECHNICIAN', 'TECHNICIAN_ACCEPTED_SERVICE'],
      doneKeys: ['TECHNICIAN_ACCEPTED_SERVICE'] },
    returnPath ? null : inRepair,
    { key: 'DIAGNOSED', label: 'Technician Issue Verified & Updated', activeLabel: 'Technician verifying the issue',
      keys: ['TECHNICIAN_WORK_STARTED', 'TECHNICIAN_UPLOADED_DEVICE_IMAGES', 'ISSUE_IDENTIFIED',
        'TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED',
        ...(reEstimated ? [] : ['WAITING_FOR_CUSTOMER_APPROVAL', 'CUSTOMER_APPROVED', 'CUSTOMER_REJECTED'])],
      doneKeys: ['TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED'] },
    has('TECHNICIAN_REESTIMATE_REQUESTED') ? { key: 'RE_REQUESTED', label: 'Technician Re-Estimate Requested',
      activeLabel: 'Technician requested a re-estimate',
      keys: ['TECHNICIAN_REESTIMATE_REQUESTED'], doneKeys: ['TECHNICIAN_REESTIMATE_REQUESTED'] } : null,
    reEstimated ? { key: 'RE_ESTIMATED', label: 'Service Re-Estimated – Awaiting Customer Approval',
      activeLabel: 'Re-estimating the service',
      keys: ['RE_ESTIMATED_CONFIRMED', 'WAITING_FOR_CUSTOMER_APPROVAL'], doneKeys: ['RE_ESTIMATED_CONFIRMED'] } : null,
    reEstimated ? { key: 'APPROVAL', label: decisionLabel, activeLabel: 'Awaiting customer approval',
      keys: ['RE_ESTIMATE_APPROVED', 'RE_ESTIMATE_REJECTED', 'CUSTOMER_APPROVED', 'CUSTOMER_REJECTED'],
      doneKeys: ['RE_ESTIMATE_APPROVED', 'RE_ESTIMATE_REJECTED', 'CUSTOMER_APPROVED', 'CUSTOMER_REJECTED'],
      verdictOnly: true } : null,
    has('REPAIR_WORK_RESUMED') ? { key: 'RESUMED', label: 'Repair Work in Progress (Resumed)',
      activeLabel: 'Repair resuming', keys: ['REPAIR_WORK_RESUMED'], doneKeys: ['REPAIR_WORK_RESUMED'] } : null,
    ...(returnPath ? [
      { key: 'RETURN', label: 'Return Unrepaired', activeLabel: 'Returning unrepaired', danger: true,
        keys: ['CUSTOMER_REJECTED', 'IN_REPAIR', 'PARTS_REQUIRED', 'REPAIR_NOT_COMPLETED', 'RETURN_DELIVERY'],
        doneKeys: ['RETURN_DELIVERY'] },
    ] : [
      has('PARTS_REQUIRED') ? { key: 'PARTS_REQUIRED', label: 'Spare Parts Waiting', activeLabel: 'Waiting for spare parts',
        keys: ['PARTS_REQUIRED'], doneKeys: ['PARTS_REQUIRED'] } : null,
      { key: 'REPAIR_COMPLETED', label: 'Repair Completed', activeLabel: 'Repair in progress',
        keys: ['REPAIR_COMPLETED'], doneKeys: ['REPAIR_COMPLETED'] },
      { key: 'QUALITY_CHECK', label: 'Quality Check Completed', activeLabel: 'Repaired — quality check pending',
        keys: ['QUALITY_CHECK_COMPLETED'], doneKeys: ['QUALITY_CHECK_COMPLETED'] },
      { key: 'READY', label: 'Ready for Delivery', activeLabel: 'Getting ready for delivery',
        keys: ['READY'], doneKeys: ['READY'], requires: ['QUALITY_CHECK_COMPLETED'] },
    ]),
    { key: 'DELIVERED', label: returnPath ? 'Returned to Customer' : 'Delivered',
      activeLabel: has('DELIVERED_PROCESSING') ? 'Out for delivery' : 'Ready for handover',
      keys: ['INVOICE_GENERATED', 'INVOICE_READY', 'DELIVERED_PROCESSING', 'DELIVERED'], doneKeys: ['DELIVERED'] },
  ].filter(Boolean);

  let milestones = defs.map((d) => {
    const own = d.keys.flatMap((k) => byKey[k] || []).sort((a, b) => at(a) - at(b));
    let doneEvent = d.doneKeys.map((k) => byKey[k]?.[0]).filter(Boolean).sort((a, b) => at(a) - at(b))[0] || null;
    if (doneEvent && d.requires) {
      const needed = d.requires.map((k) => byKey[k]?.[0]);
      doneEvent = needed.every(Boolean)
        ? [doneEvent, ...needed].reduce((a, b) => (at(b) > at(a) ? b : a))
        : null;
    }
    return { ...d, events: own, latest: own[own.length - 1] || null, doneEvent, extras: [] };
  });

  const cancelEvent = byKey.CANCELLED?.[0] || null;
  const lastDone = milestones.reduce((idx, m, i) => (m.doneEvent ? i : idx), -1);
  if (cancelEvent) {
    milestones = milestones
      .filter((m, i) => i <= lastDone || m.events.length > 0)
      .concat({ key: 'CANCELLED', label: 'Repair Cancelled', activeLabel: 'Repair cancelled', danger: true,
        keys: ['CANCELLED'], events: byKey.CANCELLED, latest: cancelEvent, doneEvent: cancelEvent, extras: [] });
  }
  const closed = !!cancelEvent || !!milestones[milestones.length - 1]?.doneEvent;
  const lastDoneNow = milestones.reduce((idx, m, i) => (m.doneEvent ? i : idx), -1);

  milestones = milestones.map((m, i) => {
    let state = 'upcoming';
    if (m.doneEvent) state = 'done';
    else if (i < lastDoneNow) state = cancelEvent && m.events.length ? 'stopped' : 'missed';
    else if (!closed && i === lastDoneNow + 1) state = 'current';
    return { ...m, state };
  });

  const reached = milestones.filter((m) => m.state === 'done' || m.state === 'current');
  (Array.isArray(extras) ? extras : []).forEach((x) => {
    if (!x) return;
    const home = (x.milestone && reached.find((m) => m.key === x.milestone))
      || reached.find((m) => m.state === 'current' || at(m.doneEvent) >= at(x))
      || reached[reached.length - 1];
    if (home) home.extras.push(x);
  });
  return milestones;
}

/** One-line status for the header card. */
export function getTrackingSummary(events, milestones = buildMilestones(events)) {
  const current = milestones.find((m) => m.state === 'current');
  const last = milestones[milestones.length - 1];
  const latest = current?.latest || (Array.isArray(events) ? events : [])
    .filter((e) => e?.status)
    .reduce((a, b) => (at(b) >= at(a || {}) ? b : a), null);
  const headline = current
    ? current.activeLabel
    : last?.state === 'done' ? (last.key === 'CANCELLED' ? 'Repair cancelled' : last.label) : 'Booking received';
  return {
    headline,
    danger: !!(current?.danger || (last?.danger && last.state === 'done')),
    closed: !current && last?.state === 'done',
    latestLabel: latest ? (labelOf(latest.status) || latest.note || up(latest.status).replace(/_/g, ' ')) : null,
    latestAt: latest?.createdAt || null,
    done: milestones.filter((m) => m.state === 'done').length,
    total: milestones.length,
  };
}

export function fmtTrackTime(v) {
  const t = Date.parse(v || '');
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const date = d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  return `${date} · ${time}`;
}

export function timeAgo(v) {
  const t = Date.parse(v || '');
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return fmtTrackTime(v);
}
