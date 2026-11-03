/**
 * ticketStatus.js — shared status vocabulary for ticket-service-backed
 * pages (Service Status, Delivery, Requote). Built on the exact raw status
 * strings shopDashboard.js already buckets for the dashboard's own tiles
 * (ACTIVE_REPAIR_STATUSES / READY_FOR_DELIVERY_STATUSES) — one definition
 * of what each ticket status means, reused, not re-invented per page.
 *
 * The requested repair-progress timeline named ten stages, including
 * "Device Received" and "Quality Check" — neither has a corresponding
 * backend ticket status anywhere in this codebase (confirmed by reading
 * every real ticket-status reference: CREATED, IN_DIAGNOSIS, QUOTED,
 * APPROVED, IN_REPAIR, READY, INVOICE_GENERATED, INVOICE_READY,
 * DELIVERED_PROCESSING, DELIVERED, CANCELLED). Those two stages are left
 * out here rather than added as a step nothing could ever actually reach.
 */

export const TICKET_STAGES = [
  { key: 'CREATED', label: 'Booking Received' },
  { key: 'IN_DIAGNOSIS', label: 'Diagnosis' },
  { key: 'QUOTED', label: 'Quote Pending' },
  { key: 'APPROVED', label: 'Quote Approved' },
  { key: 'IN_REPAIR', label: 'Repair In Progress' },
  { key: 'READY', label: 'Ready for Delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
];

const STAGE_INDEX = new Map(TICKET_STAGES.map((stage, i) => [stage.key, i]));

// Real statuses with no dedicated timeline step of their own fold onto the
// nearest one that already exists, so every real row still lands somewhere.
const STATUS_ALIASES = {
  INVOICE_GENERATED: 'READY',
  INVOICE_READY: 'READY',
  DELIVERED_PROCESSING: 'READY',
};

export function ticketStageKey(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'CANCELLED') return 'CANCELLED';
  if (STAGE_INDEX.has(s)) return s;
  if (STATUS_ALIASES[s]) return STATUS_ALIASES[s];
  return null;
}

export function ticketStageLabel(status) {
  if (String(status || '').toUpperCase() === 'CANCELLED') return 'Cancelled';
  const key = ticketStageKey(status);
  const stage = TICKET_STAGES.find((s) => s.key === key);
  return stage?.label || status || 'Unknown';
}

/** Index into TICKET_STAGES, or -1 for Cancelled/unrecognised (no progress to show). */
export function ticketStageProgress(status) {
  const key = ticketStageKey(status);
  if (!key || key === 'CANCELLED') return -1;
  return STAGE_INDEX.get(key) ?? -1;
}

export const TICKET_STAGE_BADGE = {
  'Booking Received': 'bg-sky-100 text-sky-700',
  Diagnosis: 'bg-blue-100 text-blue-700',
  'Quote Pending': 'bg-amber-100 text-amber-700',
  'Quote Approved': 'bg-teal-100 text-teal-700',
  'Repair In Progress': 'bg-orange-100 text-orange-700',
  'Ready for Delivery': 'bg-violet-100 text-violet-700',
  Delivered: 'bg-[#E5F3F5] text-[#024A57]',
  Cancelled: 'bg-red-100 text-red-700',
};
