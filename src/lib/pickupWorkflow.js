/**
 * pickupWorkflow.js — shop-side pickup lifecycle actions.
 *
 *   PENDING -> ACCEPTED -> ASSIGNED -> PICKUP_STARTED -> PICKED_UP -> COMPLETED
 *   PENDING -> CANCELLED, ACCEPTED -> CANCELLED, ASSIGNED -> REASSIGNED
 *
 * This repo is a frontend-only client (output:'export'; every request goes
 * to api.neargfix.com) — the backend lives in a separate service this codebase
 * does not contain. None of the six endpoints below are confirmed to exist
 * in order-service yet, so calls here WILL fail (404/405) until the backend
 * ships them. That failure must reach the caller as a real error — nothing
 * in this file (or its callers) may mark a booking as accepted/assigned/etc.
 * without a genuine 2xx response.
 *
 * assign-pickup is the one call with a confirmed real precedent: the mobile
 * Partner App already posts the same {pickupPersonId, pickupPersonName,
 * pickupPersonPhone} payload to POST /repair-bookings/:id/assign-pickup
 * (src/screens/owner/AllBooking/BookingActionSheets.js, PickupPersonPickerSheet,
 * same order-service). This module still calls PATCH per this feature's
 * spec — if that 405s in practice, switching the method here is the fix.
 *
 * pickup/picked-up is not one of the five endpoints the spec named (the
 * PENDING..COMPLETED chain has six states but only five endpoints were
 * given) — added here, same URL convention, so PICKUP_STARTED -> PICKED_UP
 * has somewhere to go.
 */

import { ORDER_BASE } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';

export function acceptPickup(id) {
  return shopRequest(ORDER_BASE(), `/repair-bookings/${id}/pickup/accept`, { method: 'PATCH' });
}

export function assignPickupPerson(id, { pickupPersonId, pickupPersonName, pickupPersonPhone }) {
  return shopRequest(ORDER_BASE(), `/repair-bookings/${id}/assign-pickup`, {
    method: 'PATCH',
    body: JSON.stringify({ pickupPersonId, pickupPersonName, pickupPersonPhone }),
  });
}

export function startPickup(id) {
  return shopRequest(ORDER_BASE(), `/repair-bookings/${id}/pickup/start`, { method: 'PATCH' });
}

export function markPickedUp(id) {
  return shopRequest(ORDER_BASE(), `/repair-bookings/${id}/pickup/picked-up`, { method: 'PATCH' });
}

export function completePickup(id) {
  return shopRequest(ORDER_BASE(), `/repair-bookings/${id}/pickup/complete`, { method: 'PATCH' });
}

export function cancelPickup(id) {
  return shopRequest(ORDER_BASE(), `/repair-bookings/${id}/pickup/cancel`, { method: 'PATCH' });
}

const PENDING_STATUSES = ['PICKUP_REQUESTED', 'PICKUP_BOOKING_CREATED', 'ORDER_PLACED', 'BOOKING_CREATED_BY_SHOP', 'PENDING'];
const ACCEPTED_STATUSES = ['PICKUP_ACCEPTED', 'ACCEPTED'];
const ASSIGNED_STATUSES = ['PICKUP_PERSON_ASSIGNED', 'PICKUP_ASSIGNED', 'PICKUP_REASSIGNED', 'ASSIGNED', 'REASSIGNED'];
const STARTED_STATUSES = ['PICKUP_ON_THE_WAY', 'REACHED_CUSTOMER_LOCATION', 'REPAIR_ESTIMATE_PROCESSING', 'PICKUP_STARTED'];
const PICKED_UP_STATUSES = ['DEVICE_PICKED_UP', 'PICKED_UP'];
const COMPLETED_STATUSES = ['REACHED_SHOP', 'RECEIVED_AT_SHOP', 'COMPLETED', 'DELIVERED'];

/**
 * Buckets a booking's raw order-service status into the six-stage workflow
 * this page's action buttons key off. Returns null for anything unrecognised
 * so the UI can show a plain status badge instead of guessing which action
 * is safe to offer.
 */
export function pickupWorkflowStatus(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'CANCELLED') return 'CANCELLED';
  if (PENDING_STATUSES.includes(s)) return 'PENDING';
  if (ACCEPTED_STATUSES.includes(s)) return 'ACCEPTED';
  if (ASSIGNED_STATUSES.includes(s)) return 'ASSIGNED';
  if (STARTED_STATUSES.includes(s)) return 'PICKUP_STARTED';
  if (PICKED_UP_STATUSES.includes(s)) return 'PICKED_UP';
  if (COMPLETED_STATUSES.includes(s)) return 'COMPLETED';
  return null;
}

export const WORKFLOW_LABEL = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  ASSIGNED: 'Assigned',
  PICKUP_STARTED: 'Pickup Started',
  PICKED_UP: 'Picked Up',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const WORKFLOW_BADGE = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-sky-100 text-sky-700',
  ASSIGNED: 'bg-orange-100 text-orange-700',
  PICKUP_STARTED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-violet-100 text-violet-700',
  COMPLETED: 'bg-[#E5F3F5] text-[#024A57]',
  CANCELLED: 'bg-red-100 text-red-700',
};
