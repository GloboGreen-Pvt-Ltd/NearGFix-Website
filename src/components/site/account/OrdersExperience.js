'use client';

/**
 * Customer My Orders web experience.
 *
 * This is deliberately driven by the same APIs and response fields as the
 * customer app's MyOrdersScreen and its child screens. A card starts with the
 * unified customer_orders row, then safely enriches itself from a repair
 * booking, service ticket, or sell order as appropriate. That keeps the web
 * view useful for older/order rows with sparse payloads while never inventing
 * device, shop, price, or status information.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  IndianRupee,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Store,
  Tag,
  Truck,
  Wrench,
  X,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import { masterApi } from '@/lib/api';
import {
  cancelSellOrder,
  formatAddress,
  formatDate,
  formatINR,
  getRepairBooking,
  getSellOrder,
  getServiceTicket,
  getShopPublic,
  listAddresses,
  listMyOrders,
  listPickupSlots,
  rescheduleRepairBooking,
} from '@/lib/customerAccount';
import { notifyError, notifySuccess } from '@/lib/toast';
import {
  AccountEmpty,
  AccountError,
  AccountLoader,
  AccountPageHeader,
  Chip,
  Panel,
  StatusPill,
  humanizeStatus,
} from '@/components/site/account/ui';

const TABS = [
  { key: 'Service', label: 'Service', icon: Wrench, types: ['REPAIR', 'PICKUP'] },
  { key: 'Pickup', label: 'Pickup', icon: Truck, types: ['PICKUP'] },
  { key: 'Buy', label: 'Buy', icon: ShoppingBag, types: ['BUY'] },
  { key: 'Sell', label: 'Sell', icon: Tag, types: ['SELL'] },
  { key: 'Enquiry', label: 'Enquiry', icon: MessageCircle, types: ['ENQUIRY'] },
];

const STATUSES = [
  { label: 'Active', value: 'Pending' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Cancelled', value: 'Cancelled' },
];

const TYPE_ICON = {
  REPAIR: Wrench,
  PICKUP: Truck,
  BUY: ShoppingBag,
  SELL: Tag,
  ENQUIRY: MessageCircle,
};

const REPAIR_TYPES = new Set(['REPAIR', 'PICKUP', 'ENQUIRY']);
const RESCHEDULABLE_STATUSES = new Set([
  'PENDING',
  'ORDER_PLACED',
  'PICKUP_REQUESTED',
  'PICKUP_ACCEPTED',
  'ORDER_SERVICE_CONFIRMED',
  'SERVICE_ACCEPTED',
]);
const SELL_EDITABLE_STATUSES = new Set(['PENDING', 'PENDING_QUOTATION', 'AWAITING_QUOTATION', 'DRAFT']);

// This is the same canonical service rail used by the customer app. The
// backend sends event keys, while this table owns their human labels/order.
const SERVICE_STEPS = [
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

const PICKUP_STEPS = [
  ['PICKUP_REQUESTED', 'Pickup Requested', ['ORDER_PLACED', 'PICKUP_BOOKING_CREATED']],
  ['PICKUP_ACCEPTED', 'Pickup Accepted', ['ORDER_SERVICE_CONFIRMED', 'SERVICE_ACCEPTED']],
  ['PICKUP_PERSON_ASSIGNED', 'Pickup Person Assigned', ['PICKUP_ASSIGNED', 'PICKUP_REASSIGNED']],
  ['PICKUP_ON_THE_WAY', 'Pickup Person On The Way', []],
  ['REACHED_CUSTOMER_LOCATION', 'Reached Customer Location', []],
  ['REPAIR_ESTIMATE_PROCESSING', 'Repair Estimate Processing', ['ESTIMATE_PROCESSING', 'ESTIMATE_SUBMITTED']],
  ['DEVICE_PICKED_UP', 'Device Picked Up', ['PICKED_UP', 'DEVICE_RECEIVED']],
  ['REACHED_SHOP', 'Reached Shop', ['DEVICE_DELIVERY_TO_SHOP']],
];

const WARRANTY_LABELS = {
  lt_3: 'Less than 3 months',
  '3_6': '3 – 6 months',
  '6_11': '6 – 11 months',
  gt_11: 'More than 11 months',
};

const unwrap = (value) => (Array.isArray(value) ? value : value?.content || value?.data || []);
const asArray = (value) => (Array.isArray(value) ? value : []);
const idKey = (id) => (id == null ? '' : String(id));
const sameId = (a, b) => idKey(a) && idKey(a) === idKey(b);

function jsonValue(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function money(value, decimals = false) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('en-IN', decimals
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : undefined);
}

function time(value) {
  return value ? String(value).slice(0, 5) : '';
}

function timeRange(start, end) {
  const a = time(start);
  const b = time(end);
  return [a, b].filter(Boolean).join(' – ');
}

function normalizeImageUrl(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('data:')) return value;

  // Cloudinary frequently serves source-model assets as AVIF/HEIC. The web
  // picker uses the same jpeg delivery transform so the visual works in every
  // browser where the rest of this public site is supported.
  if (/^https?:\/\/res\.cloudinary\.com\//i.test(value) && /\.(avif|heic)(?:[?#].*)?$/i.test(value)) {
    const marker = '/upload/';
    const at = value.indexOf(marker);
    if (at >= 0) {
      const after = value.slice(at + marker.length);
      if (!after.startsWith('f_jpg/')) return `${value.slice(0, at + marker.length)}f_jpg/${after}`;
    }
  }
  return value;
}

function masterImage(item) {
  if (!item) return null;
  return normalizeImageUrl(item.imageUrl || item.deviceImageUrl)
    || (item.imageBase64 ? `data:image/png;base64,${item.imageBase64}` : null);
}

function bookingRef(order) {
  return order?.payload?.bookingId || order?.referenceId || null;
}

function sellRef(order) {
  return order?.payload?.sellOrderId || order?.referenceId || null;
}

function ticketRef(order) {
  return order?.payload?.ticketId || null;
}

function isRepairOrder(order) {
  return REPAIR_TYPES.has(String(order?.orderType || '').toUpperCase());
}

function isPickup(order, data) {
  return String(order?.orderType || '').toUpperCase() === 'PICKUP'
    || String(order?.payload?.serviceMode || data?.raw?.serviceMode || '').toUpperCase() === 'PICKUP'
    || Boolean(data?.raw?.pickupAddressId || data?.raw?.pickupDate || data?.raw?.pickupSlotStart);
}

function isReschedulable(order, data) {
  if (!isPickup(order, data)) return false;
  const live = String(order?.phaseStatus || data?.raw?.status || order?.status || '').toUpperCase();
  return !live || RESCHEDULABLE_STATUSES.has(live);
}

function visibleStatus(order, data) {
  if (isRepairOrder(order) && order?.phaseLabel) return order.phaseLabel;
  return data?.raw?.status || order?.phaseLabel || order?.status;
}

function orderTitle(order, data) {
  const payload = order?.payload || {};
  return data?.name
    || payload.deviceName
    || payload.modelName
    || payload.title
    || `${humanizeStatus(order?.orderType) || 'Order'} order`;
}

function deviceSpecs(order, data) {
  if (data?.specs) return data.specs;
  const p = order?.payload || {};
  return [p.color, p.ramLabel && p.storageLabel ? `${p.ramLabel} / ${p.storageLabel}` : p.storageLabel]
    .filter(Boolean)
    .join(' · ');
}

function cleanIssueSummary(value) {
  if (!value) return '';
  return String(value)
    .replace(/^issue\s*[:\-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function orderDescriptor(order) {
  const ticketId = ticketRef(order);
  if (ticketId) return { kind: 'ticket', id: ticketId, cacheKey: `ticket:${ticketId}` };
  if (String(order?.orderType || '').toUpperCase() === 'SELL') {
    const id = sellRef(order);
    return id ? { kind: 'sell', id, cacheKey: `sell:${id}` } : { kind: 'generic', id: order?.id, cacheKey: `order:${order?.id}` };
  }
  if (isRepairOrder(order)) {
    const id = bookingRef(order);
    return id ? { kind: 'booking', id, cacheKey: `booking:${id}` } : { kind: 'generic', id: order?.id, cacheKey: `order:${order?.id}` };
  }
  return { kind: 'generic', id: order?.id, cacheKey: `order:${order?.id}` };
}

function ServiceIcon({ type, className }) {
  const Icon = TYPE_ICON[String(type || '').toUpperCase()] || Package;
  return <Icon className={className} aria-hidden="true" />;
}

function ImageOrIcon({ src, type, alt, className = '', iconClassName = 'h-5 w-5' }) {
  const [failed, setFailed] = useState(false);
  const image = src && !failed ? src : null;
  return (
    <span className={cx('relative flex shrink-0 items-center justify-center overflow-hidden bg-brand-soft text-brand-700', className)}>
      {image ? (
        <img
          src={image}
          alt={alt || ''}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <ServiceIcon type={type} className={iconClassName} />
      )}
    </span>
  );
}

function ActionButton({ icon: Icon, children, onClick, disabled = false, tone = 'brand' }) {
  const palette = tone === 'accent' ? 'text-amber-700 hover:bg-amber-50' : 'text-brand-700 hover:bg-brand-50';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onClick?.();
      }}
      className={cx(
        'inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[0.7rem] font-bold transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
        disabled ? 'cursor-not-allowed text-brand-subtle opacity-55' : palette,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

function OrderCard({ order, data, onOpen, tab }) {
  const services = data?.services || asArray(order?.payload?.services);
  const title = orderTitle(order, data);
  const specs = deviceSpecs(order, data);
  const status = (tab === 'Service' || tab === 'Pickup') && order?.phaseLabel
    ? order.phaseLabel
    : (data?.raw?.status || order?.status);
  const orderType = String(order?.orderType || '').toUpperCase();
  const repair = isRepairOrder(order);
  const pickup = isPickup(order, data);
  const canReschedule = isReschedulable(order, data);

  const open = (view = 'details') => onOpen(order, view);
  return (
    <Panel
      role="button"
      tabIndex={0}
      onClick={() => open('details')}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open('details');
        }
      }}
      className="cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:p-5"
    >
      <div className="flex items-start gap-3.5">
        <ImageOrIcon
          src={data?.image}
          alt={title}
          type={orderType}
          className="h-12 w-12 rounded-2xl border border-brand-100"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[0.95rem] font-bold text-brand-ink">{title}</p>
              <p className="mt-0.5 truncate text-xs text-brand-muted">
                {order?.orderNumber ? `#${String(order.orderNumber).replace(/^#/, '')}` : ''}
                {specs ? `${order?.orderNumber ? ' · ' : ''}${specs}` : ''}
              </p>
              {orderType === 'SERVICE' && services.length ? null : repair && services.length ? (
                <span className="mt-2 inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-[0.65rem] font-bold text-brand-700">
                  {services.length} service{services.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
            {status ? <StatusPill status={order?.phaseStatus || data?.raw?.status || order?.status} label={status} /> : null}
          </div>
        </div>
      </div>

      {services.length ? (
        <div className="mt-3 border-t border-brand-line pt-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-brand-subtle">Booked services</p>
          <ul className="mt-1.5 space-y-0.5">
            {services.slice(0, 3).map((service, index) => (
              <li key={`${service?.serviceCode || service?.serviceName || service?.name || 'service'}-${index}`} className="truncate text-sm text-brand-ink">
                {index + 1}. {service?.serviceName || service?.name || service?.serviceCode || 'Service'}
              </li>
            ))}
          </ul>
          {services.length > 3 ? <p className="mt-1 text-xs font-semibold text-brand-700">+ {services.length - 3} more</p> : null}
        </div>
      ) : data?.issueSummary ? (
        <p className="mt-3 line-clamp-2 border-t border-brand-line pt-3 text-sm text-brand-muted">{data.issueSummary}</p>
      ) : null}

      {data?.shop?.name || order?.payload?.shopName ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-brand-muted">
          <Store className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <span className="truncate">{data?.shop?.name || order.payload.shopName}</span>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between border-t border-brand-line pt-3">
        {order?.totalAmount != null && Number(order.totalAmount) > 0 ? (
          <span className="inline-flex items-center gap-0.5 text-sm font-bold text-brand-ink">
            <IndianRupee className="h-4 w-4" aria-hidden="true" />
            {formatINR(order.totalAmount)}
          </span>
        ) : (
          <span className="text-xs text-brand-muted">{orderType === 'SELL' ? 'Awaiting quotation' : 'Amount quoted by shop'}</span>
        )}
        <span className="text-xs text-brand-muted">{formatDate(order?.createdAt)}</span>
      </div>

      {repair && tab === 'Service' ? (
        <div className="mt-3 grid grid-cols-2 gap-1 border-t border-brand-line pt-2 sm:grid-cols-4">
          <ActionButton icon={FileText} onClick={() => open('details')}>Details</ActionButton>
          {data?.kind === 'booking' ? (
            <ActionButton icon={Clock} tone="accent" onClick={() => open('timeline')}>
              History
            </ActionButton>
          ) : (
            <ActionButton icon={Clock} disabled>History</ActionButton>
          )}
          {pickup && canReschedule ? (
            <ActionButton icon={CalendarClock} tone="accent" onClick={() => open('reschedule')}>Re-schedule</ActionButton>
          ) : (
            <ActionButton icon={Receipt} disabled={data?.kind !== 'booking'} onClick={() => open('receipt')}>Receipt</ActionButton>
          )}
          <ActionButton
            icon={ReceiptText}
            disabled={data?.kind !== 'booking' || String(order?.status || '').toUpperCase() !== 'COMPLETED'}
            onClick={() => open('invoice')}
          >
            Invoice
          </ActionButton>
        </div>
      ) : repair ? (
        <div className="mt-3 grid grid-cols-3 gap-1 border-t border-brand-line pt-2">
          <ActionButton icon={FileText} onClick={() => open('details')}>Details</ActionButton>
          {data?.kind === 'booking' ? (
            <ActionButton icon={Clock} tone="accent" onClick={() => open('timeline')}>Track</ActionButton>
          ) : <ActionButton icon={Clock} disabled>Track</ActionButton>}
          {tab === 'Pickup' && pickup && canReschedule ? (
            <ActionButton icon={CalendarClock} tone="accent" onClick={() => open('reschedule')}>Re-schedule</ActionButton>
          ) : (
            <ActionButton icon={Receipt} disabled={data?.kind !== 'booking'} onClick={() => open('receipt')}>Receipt</ActionButton>
          )}
        </div>
      ) : orderType === 'SELL' ? (
        <div className="mt-3 flex items-center justify-end border-t border-brand-line pt-3 text-sm font-bold text-brand-700">
          View sell request <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
        </div>
      ) : null}
    </Panel>
  );
}

function DetailSection({ title, icon: Icon, children, className }) {
  return (
    <section className={cx('rounded-2xl border border-brand-line bg-white p-4 shadow-soft', className)}>
      {title ? (
        <div className="mb-3 flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" /> : null}
          <h3 className="text-sm font-bold text-brand-ink">{title}</h3>
        </div>
      ) : null}
      {children}
    </section>
  );
}

function InfoLine({ label, value, success = false }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-line py-2 last:border-0 last:pb-0">
      <span className="shrink-0 text-xs text-brand-muted">{label}</span>
      <span className={cx('min-w-0 break-words text-right text-sm font-semibold text-brand-ink', success && 'text-brand-700')}>{value}</span>
    </div>
  );
}

function DeviceSummary({ order, data }) {
  const title = orderTitle(order, data);
  return (
    <DetailSection>
      <div className="flex items-center gap-4">
        <ImageOrIcon
          src={data?.image}
          alt={title}
          type={order?.orderType}
          className="h-20 w-20 rounded-2xl border border-brand-line bg-brand-50"
          iconClassName="h-8 w-8"
        />
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold text-brand-ink">{title}</p>
          {deviceSpecs(order, data) ? <p className="mt-1 text-sm text-brand-muted">{deviceSpecs(order, data)}</p> : null}
          {data?.raw?.imei ? <p className="mt-1 text-xs text-brand-muted">IMEI: {data.raw.imei}</p> : null}
        </div>
      </div>
    </DetailSection>
  );
}

function ServiceLines({ services, total, label = 'Estimated repair amount' }) {
  if (!services?.length && total == null) return null;
  const derived = total != null
    ? Number(total)
    : services.reduce((sum, service) => sum + Number(service?.estimatedPrice || 0), 0);
  return (
    <DetailSection title="Price summary" icon={IndianRupee}>
      {services?.map((service, index) => (
        <div key={`${service?.serviceCode || service?.serviceName || 'item'}-${index}`} className="flex items-center justify-between gap-3 py-1.5 text-sm">
          <span className="min-w-0 truncate text-brand-ink">{index + 1}. {service?.serviceName || service?.name || service?.serviceCode || 'Service'}</span>
          {service?.estimatedPrice != null ? <span className="shrink-0 font-semibold text-brand-ink">₹{money(service.estimatedPrice)}</span> : null}
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between border-t border-brand-line pt-3">
        <span className="text-sm font-bold text-brand-ink">{label}</span>
        <span className="text-base font-extrabold text-brand-700">₹{money(derived)}</span>
      </div>
    </DetailSection>
  );
}

function MediaStrip({ title, photos }) {
  const usable = photos.filter((photo) => photo?.url);
  if (!usable.length) return null;
  return (
    <DetailSection title={title}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {usable.map((photo) => (
          <a
            key={photo.key}
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-xl border border-brand-line bg-brand-50"
          >
            {photo.video ? (
              <div className="flex aspect-[4/3] items-center justify-center text-brand-700"><FileText className="h-7 w-7" /></div>
            ) : (
              <img src={photo.url} alt={photo.label} className="aspect-[4/3] w-full object-cover transition duration-200 group-hover:scale-105" />
            )}
            <p className="truncate border-t border-brand-line bg-white px-2 py-1.5 text-center text-[0.68rem] font-semibold text-brand-muted">{photo.label}</p>
          </a>
        ))}
      </div>
    </DetailSection>
  );
}

function BookingDetails({ order, data }) {
  const booking = data.raw || {};
  const services = data.services || [];
  const devicePhotos = [
    { key: 'front', label: 'Front side', url: booking.frontImageUrl },
    { key: 'back', label: 'Back side', url: booking.backImageUrl },
    { key: 'video', label: 'Full coverage video', url: booking.videoUrl, video: true },
  ];
  const technicianPhotos = asArray(booking.technicianPhotos).map((url, index) => ({
    key: `technician-${index}`,
    label: `Technician photo ${index + 1}`,
    url,
  }));
  const approved = String(booking.customerApproval || '').toUpperCase() === 'DONE';
  const pickupDate = booking.pickupDate ? formatDate(booking.pickupDate) : '';
  const pickupSchedule = [pickupDate, timeRange(booking.pickupSlotStart, booking.pickupSlotEnd)].filter(Boolean).join(' · ');
  const issue = cleanIssueSummary(data.issueSummary || booking.issueSummary || booking.issueDescription);
  const complianceEvent = asArray(booking.events).find(
    (event) => String(event?.status || '').toUpperCase() === 'TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED',
  );

  return (
    <div className="space-y-3">
      <DeviceSummary order={order} data={data} />
      <MediaStrip title="Device photos" photos={devicePhotos} />
      <ServiceLines services={services} total={booking.finalAmount ?? booking.estimateAmount ?? order?.totalAmount} />
      <DetailSection title="Repair details" icon={FileText}>
        <InfoLine label="Complaint issue" value={issue} />
        <InfoLine
          label="Estimated completion"
          value={booking.estimatedReadyAt ? `${formatDateTime(booking.estimatedReadyAt)}${booking.estimatedDurationHours ? ` · ${booking.estimatedDurationHours} hr` : ''}` : ''}
        />
        <InfoLine label="Estimated delivery" value={formatDateTime(booking.estimatedDeliveryAt)} />
        <InfoLine label="Customer approval" value={approved ? 'Approved' : booking.customerApproval || 'Pending'} success={approved} />
      </DetailSection>
      {booking.deviceSecurityType || booking.devicePin || booking.missingDamageParts ? (
        <DetailSection title="Device security" icon={CheckCircle2}>
          <InfoLine
            label="PIN / pattern"
            value={booking.devicePin ? `${booking.deviceSecurityType ? `${booking.deviceSecurityType} · ` : ''}${booking.devicePin}` : 'Not provided'}
          />
          <InfoLine label="Missing or damaged parts" value={booking.missingDamageParts || 'Nil'} />
        </DetailSection>
      ) : null}
      {booking.technicianName || booking.technicianCode || technicianPhotos.length ? (
        <>
          <DetailSection title="Technician" icon={Wrench}>
            <InfoLine label="Assigned to" value={[booking.technicianName, booking.technicianCode].filter(Boolean).join(' · ')} />
          </DetailSection>
          <MediaStrip title="Technician photos" photos={technicianPhotos} />
        </>
      ) : null}
      {complianceEvent?.note || complianceEvent?.audioUrl || complianceEvent?.imageUrls?.length ? (
        <DetailSection title="Issue verified & updated" icon={CheckCircle2}>
          {complianceEvent.note ? <p className="text-sm leading-6 text-brand-ink">{complianceEvent.note}</p> : null}
          {complianceEvent.audioUrl ? <audio className="mt-3 w-full" controls src={complianceEvent.audioUrl}>Your browser cannot play this voice note.</audio> : null}
          {asArray(complianceEvent.imageUrls).length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {complianceEvent.imageUrls.map((url, index) => <img key={url || index} src={url} alt={`Verification attachment ${index + 1}`} className="aspect-square rounded-lg object-cover" />)}
            </div>
          ) : null}
        </DetailSection>
      ) : null}
      {data.address || booking.pickupAddressText ? (
        <DetailSection title="Pickup address" icon={MapPin}>
          {data.address ? (
            <>
              <p className="text-sm font-bold text-brand-ink">{[data.address.fullName, data.address.mobile].filter(Boolean).join(' · ')}</p>
              <p className="mt-1 text-sm leading-6 text-brand-muted">{formatAddress(data.address)}</p>
            </>
          ) : <p className="text-sm leading-6 text-brand-muted">{booking.pickupAddressText}</p>}
        </DetailSection>
      ) : null}
      {data.shop || pickupSchedule ? (
        <DetailSection title="Shop & schedule" icon={Store}>
          {data.shop?.name ? <p className="text-sm font-bold text-brand-ink">{data.shop.name}</p> : null}
          {data.shop?.address ? <p className="mt-1 text-sm leading-6 text-brand-muted">{data.shop.address}</p> : null}
          {data.shop?.phone || data.shop?.mobile ? <p className="mt-1 inline-flex items-center gap-1 text-sm text-brand-muted"><Phone className="h-3.5 w-3.5" />{data.shop.phone || data.shop.mobile}</p> : null}
          {pickupSchedule ? <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-bold text-brand-700">Pickup: {pickupSchedule}</p> : null}
        </DetailSection>
      ) : null}
    </div>
  );
}

function parseTicketItems(ticket) {
  const parsed = jsonValue(ticket?.priceItemsJson, []);
  if (Array.isArray(parsed)) {
    return parsed.map((item) => ({
      serviceName: item?.serviceName || item?.name || item?.label || item?.description || 'Service',
      estimatedPrice: item?.estimatedPrice ?? item?.price ?? item?.amount ?? item?.total,
    }));
  }
  if (ticket?.repairServicesSummary) {
    return String(ticket.repairServicesSummary).split(',').map((name) => ({ serviceName: name.trim() })).filter((item) => item.serviceName);
  }
  return [];
}

function TicketDetails({ order, data }) {
  const ticket = data.raw || {};
  const photos = jsonValue(ticket.devicePhotosJson, {});
  const technicianPhotos = jsonValue(ticket.technicianPhotosJson, []);
  const devicePhotos = Object.entries(photos && typeof photos === 'object' ? photos : {}).map(([key, url]) => ({
    key,
    label: humanizeStatus(key),
    url,
  }));
  const techPhotos = asArray(technicianPhotos).map((url, index) => ({ key: `tech-${index}`, label: `Technician photo ${index + 1}`, url }));
  const services = parseTicketItems(ticket);
  const approved = ticket.customerApproval === true;
  const missing = jsonValue(ticket.missingPartsJson, ticket.missingPartsJson);
  const missingText = Array.isArray(missing)
    ? missing.map((item) => item?.label || item?.name || item).filter(Boolean).join(', ')
    : typeof missing === 'object' && missing ? Object.values(missing).filter(Boolean).join(', ')
      : missing;

  return (
    <div className="space-y-3">
      <DeviceSummary order={order} data={data} />
      <MediaStrip title="Device photos" photos={devicePhotos} />
      <ServiceLines services={services} total={ticket.finalPrice ?? ticket.estimatedPrice ?? order?.totalAmount} />
      <DetailSection title="Service details" icon={FileText}>
        <InfoLine label="Tracking ID" value={ticket.trackingId} />
        <InfoLine label="Complaint issue" value={cleanIssueSummary(ticket.issueDescription)} />
        <InfoLine label="Estimated completion" value={formatDateTime(ticket.estimatedReadyAt)} />
        <InfoLine label="Estimated delivery" value={formatDateTime(ticket.estimatedDeliveryAt)} />
        <InfoLine label="Customer approval" value={approved ? 'Approved' : 'Pending'} success={approved} />
      </DetailSection>
      {ticket.deviceSecurityType || missingText ? (
        <DetailSection title="Device security" icon={CheckCircle2}>
          <InfoLine label="Security type" value={ticket.deviceSecurityType} />
          <InfoLine label="Missing or damaged parts" value={missingText || 'Nil'} />
        </DetailSection>
      ) : null}
      {ticket.assignedTechnicianName || techPhotos.length ? (
        <>
          <DetailSection title="Technician" icon={Wrench}>
            <InfoLine label="Assigned to" value={[ticket.assignedTechnicianName, ticket.assignedTechnicianCode].filter(Boolean).join(' · ')} />
          </DetailSection>
          <MediaStrip title="Technician photos" photos={techPhotos} />
        </>
      ) : null}
      {ticket.complianceNote || ticket.complianceAudioUrl || asArray(ticket.complianceImageUrls).length ? (
        <DetailSection title="Issue verified & updated" icon={CheckCircle2}>
          {ticket.complianceNote ? <p className="text-sm leading-6 text-brand-ink">{ticket.complianceNote}</p> : null}
          {ticket.complianceAudioUrl ? <audio className="mt-3 w-full" controls src={ticket.complianceAudioUrl}>Your browser cannot play this voice note.</audio> : null}
          {asArray(ticket.complianceImageUrls).length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {ticket.complianceImageUrls.map((url, index) => <img key={url || index} src={url} alt={`Verification attachment ${index + 1}`} className="aspect-square rounded-lg object-cover" />)}
            </div>
          ) : null}
        </DetailSection>
      ) : null}
      {ticket.customerAddress || data.shop ? (
        <DetailSection title="Shop & customer details" icon={Store}>
          {data.shop?.name ? <p className="text-sm font-bold text-brand-ink">{data.shop.name}</p> : null}
          {data.shop?.address ? <p className="mt-1 text-sm text-brand-muted">{data.shop.address}</p> : null}
          {ticket.customerAddress ? <p className="mt-3 border-t border-brand-line pt-3 text-sm text-brand-muted">{ticket.customerAddress}</p> : null}
        </DetailSection>
      ) : null}
    </div>
  );
}

function BulletList({ title, values }) {
  const rows = asArray(values).filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((value, index) => (
          <li key={index} className="flex gap-2 text-sm leading-5 text-brand-ink">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
            <span>{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SellDetails({ order, data, onCancel, cancelling }) {
  const sell = data.raw || {};
  const images = sell.images || {};
  const photos = [
    ['front', 'Front side'],
    ['back', 'Back side'],
    ['side', 'Side'],
    ['camera', 'Camera'],
    ['other', 'Other'],
  ].map(([key, label]) => ({ key, label, url: images[key] }));
  const isEditable = SELL_EDITABLE_STATUSES.has(String(sell.status || order.status || '').toUpperCase());
  const assessment = [
    ...asArray(sell.screeningAnswers).map((row) => [row?.answer, row?.question].filter(Boolean).join(' · ')),
    ...asArray(sell.conditions).map((row) => [row?.optionLabel, row?.groupName].filter(Boolean).join(' · ')),
  ];
  const accessories = asArray(sell.accessories).map((row) => row?.label || row?.accessoryCode).filter(Boolean);
  const quoteRows = asArray(sell.quotations);

  return (
    <div className="space-y-3">
      <DeviceSummary order={order} data={data} />
      <MediaStrip title="Device photos" photos={photos} />
      <DetailSection title="Device summary" icon={Smartphone}>
        <InfoLine label="Condition" value={sell.deviceConditionSummary || (String(sell.workingCondition || '').toUpperCase() === 'DEAD' ? 'Unknown condition' : sell.workingCondition || 'Good')} />
        <InfoLine label="Color" value={sell.color} />
        <InfoLine label="IMEI" value={sell.imei} />
        <InfoLine label="Warranty" value={WARRANTY_LABELS[sell.warrantyCode] || sell.warrantyCode} />
        <BulletList title="Assessment" values={assessment} />
        <BulletList title="Accessories" values={accessories} />
      </DetailSection>
      {quoteRows.length ? (
        <DetailSection title="Shop quotations" icon={IndianRupee}>
          <div className="space-y-2">
            {quoteRows.map((quote) => (
              <div key={quote.id || `${quote.shopName}-${quote.quotationPrice}`} className="rounded-xl border border-brand-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-brand-ink">{quote.shopName || 'Repair shop'}</p>
                    {quote.shopCity ? <p className="mt-0.5 text-xs text-brand-muted">{quote.shopCity}</p> : null}
                  </div>
                  <span className="shrink-0 font-extrabold text-brand-700">₹{money(quote.quotationPrice)}</span>
                </div>
                {quote.note ? <p className="mt-2 text-sm text-brand-muted">{quote.note}</p> : null}
                {quote.status ? <StatusPill className="mt-2" status={quote.status} /> : null}
              </div>
            ))}
          </div>
        </DetailSection>
      ) : null}
      {data.address ? (
        <DetailSection title="Pickup address" icon={MapPin}>
          <p className="text-sm font-bold text-brand-ink">{[data.address.fullName, data.address.mobile].filter(Boolean).join(' · ')}</p>
          <p className="mt-1 text-sm leading-6 text-brand-muted">{formatAddress(data.address)}</p>
        </DetailSection>
      ) : null}
      {isEditable ? (
        <DetailSection className="border-red-200 bg-red-50/40" title="Manage request">
          <p className="text-sm text-brand-muted">You can withdraw this sell request while no quotation has been confirmed.</p>
          <button
            type="button"
            disabled={cancelling}
            onClick={onCancel}
            className="mt-3 inline-flex items-center rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
          >
            {cancelling ? 'Cancelling…' : 'Cancel sell request'}
          </button>
        </DetailSection>
      ) : null}
    </div>
  );
}

function GenericDetails({ order, data }) {
  const payload = order?.payload || {};
  const items = asArray(payload.items);
  return (
    <div className="space-y-3">
      <DeviceSummary order={order} data={data} />
      {items.length ? (
        <DetailSection title="Items" icon={ShoppingBag}>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={`${item?.productId || item?.title || 'item'}-${index}`} className="flex items-center justify-between gap-4 text-sm">
                <span className="min-w-0 break-words text-brand-ink">{item?.title || item?.name || 'Item'}{item?.quantity ? ` × ${item.quantity}` : ''}</span>
                {item?.price != null ? <span className="shrink-0 font-semibold text-brand-ink">₹{money(item.price)}</span> : null}
              </div>
            ))}
          </div>
        </DetailSection>
      ) : (
        <DetailSection title="Order details" icon={Package}>
          <InfoLine label="Order number" value={order?.orderNumber} />
          <InfoLine label="Status" value={visibleStatus(order, data)} />
          <InfoLine label="Placed on" value={formatDateTime(order?.createdAt)} />
          {order?.totalAmount != null ? <InfoLine label="Amount" value={`₹${money(order.totalAmount)}`} /> : null}
        </DetailSection>
      )}
    </div>
  );
}

function Timeline({ order, data }) {
  const booking = data.raw || {};
  const eventByStatus = {};
  asArray(booking.events).forEach((event) => {
    const key = String(event?.status || '').toUpperCase();
    if (key && !eventByStatus[key]) eventByStatus[key] = event;
  });
  const events = asArray(booking.events).slice().sort(
    (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime(),
  );
  const latest = String(events[0]?.status || '').toUpperCase();
  const pickup = isPickup(order, data);
  const rows = pickup ? PICKUP_STEPS : SERVICE_STEPS.map(([key, label]) => [key, label, []]);
  const visibleRows = pickup
    ? rows
    : rows.filter(([key]) => eventByStatus[key] || key === latest);
  const fallbackRows = visibleRows.length ? visibleRows : rows.slice(0, 1);

  return (
    <div className="space-y-3">
      <DetailSection>
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Tracking ID</p>
        <p className="mt-1 text-base font-extrabold text-brand-ink">{booking.bookingNumber || order?.orderNumber || '—'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-brand-muted">Current:</span>
          <StatusPill status={order?.phaseStatus || booking.status || order?.status} label={visibleStatus(order, data)} />
        </div>
        <p className="mt-2 text-xs text-brand-muted">Live progress is refreshed every 10 seconds while this view is open.</p>
      </DetailSection>
      <DetailSection title={pickup ? 'Pickup progress' : 'Service history'} icon={pickup ? Truck : Clock}>
        <div>
          {fallbackRows.map(([key, label, aliases], index) => {
            const event = eventByStatus[key] || asArray(aliases).map((alias) => eventByStatus[alias]).find(Boolean);
            const complete = Boolean(event);
            const current = latest === key || asArray(aliases).includes(latest);
            const last = index === fallbackRows.length - 1;
            return (
              <div key={`${key}-${index}`} className="flex gap-3">
                <div className="flex w-5 shrink-0 flex-col items-center">
                  <span className={cx('mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2', complete ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-strong bg-white')}>
                    {complete ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-brand-strong" />}
                  </span>
                  {!last ? <span className={cx('my-1 min-h-8 w-0.5 flex-1 rounded-full', complete ? 'bg-brand-500' : 'bg-brand-line')} /> : null}
                </div>
                <div className="min-w-0 flex-1 pb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cx('text-sm', complete ? 'font-bold text-brand-ink' : 'font-semibold text-brand-muted')}>{label}</p>
                    {current && complete ? <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-brand-700">Now</span> : null}
                  </div>
                  {event?.createdAt ? <p className="mt-1 text-xs text-brand-muted">{formatDateTime(event.createdAt)}</p> : null}
                  {event?.note && event.note !== label ? <p className="mt-1 text-sm leading-5 text-brand-ink">{event.note}</p> : null}
                  {event?.audioUrl ? <audio className="mt-2 w-full" controls src={event.audioUrl}>Your browser cannot play this voice note.</audio> : null}
                  {asArray(event?.imageUrls).length ? (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {event.imageUrls.map((url, imageIndex) => <img key={url || imageIndex} src={url} alt={`Timeline attachment ${imageIndex + 1}`} className="aspect-square rounded-lg object-cover" />)}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </DetailSection>
    </div>
  );
}

function ReceiptView({ order, data }) {
  const booking = data.raw || {};
  const approved = String(booking.customerApproval || '').toUpperCase() === 'DONE';
  return (
    <div className="space-y-3">
      <DetailSection className="border-brand-200 bg-brand-50/50">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-700"><CheckCircle2 className="h-6 w-6" /></span>
          <div>
            <p className="font-extrabold text-brand-ink">Booking receipt</p>
            <p className="mt-0.5 text-xs text-brand-muted">{formatDateTime(booking.createdAt || order?.createdAt)}</p>
          </div>
        </div>
      </DetailSection>
      <DeviceSummary order={order} data={data} />
      <ServiceLines services={data.services || []} total={booking.estimateAmount ?? order?.totalAmount} />
      <DetailSection title="Service details" icon={FileText}>
        <InfoLine label="Booking number" value={booking.bookingNumber || order?.orderNumber} />
        <InfoLine label="Complaint issue" value={cleanIssueSummary(data.issueSummary || booking.issueSummary)} />
        <InfoLine
          label="Estimated completion"
          value={booking.estimatedReadyAt ? `${formatDateTime(booking.estimatedReadyAt)}${booking.estimatedDurationHours ? ` · ${booking.estimatedDurationHours} hr` : ''}` : ''}
        />
        <InfoLine label="Estimated delivery" value={formatDateTime(booking.estimatedDeliveryAt)} />
        <InfoLine label="Customer approval" value={approved ? 'Approved' : booking.customerApproval || 'Pending'} success={approved} />
      </DetailSection>
    </div>
  );
}

function Invoice({ order, data }) {
  const booking = data.raw || {};
  const services = data.services || [];
  const GST = 0.18;
  const rows = services.map((service) => {
    const gross = Number(service?.estimatedPrice || 0);
    const taxable = gross / (1 + GST);
    return {
      name: service?.serviceName || service?.name || service?.serviceCode || 'Service',
      gross,
      taxable,
      cgst: taxable * (GST / 2),
      sgst: taxable * (GST / 2),
    };
  });
  const total = rows.reduce((sum, row) => sum + row.gross, 0);
  const invoiceNo = String(booking.bookingNumber || order?.orderNumber || booking.id || '').replace(/^#/, '');
  const customer = data.address || {};
  return (
    <div className="space-y-3">
      <DetailSection className="print:border-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-extrabold text-brand-700">{data.shop?.name || 'Repair shop'}</p>
            {data.shop?.phone ? <p className="mt-1 text-xs text-brand-muted">{data.shop.phone}</p> : null}
            {data.shop?.address ? <p className="mt-1 max-w-sm text-xs leading-5 text-brand-muted">{data.shop.address}</p> : null}
          </div>
          <span className="rounded-lg bg-brand-soft px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wide text-brand-700">Original for recipient</span>
        </div>
        <div className="my-3 border-t border-brand-line" />
        <h3 className="text-center text-base font-extrabold text-brand-ink">Invoice receipt</h3>
        <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
          <div><p className="text-brand-muted">Invoice no.</p><p className="mt-0.5 font-bold text-brand-ink">{invoiceNo || '—'}</p></div>
          <div><p className="text-brand-muted">Invoice date</p><p className="mt-0.5 font-bold text-brand-ink">{formatDate(booking.createdAt || order?.createdAt) || '—'}</p></div>
          <div><p className="text-brand-muted">Delivery date</p><p className="mt-0.5 font-bold text-brand-ink">{formatDate(booking.estimatedDeliveryAt) || '—'}</p></div>
        </div>
      </DetailSection>
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailSection title="Bill to">
          <p className="text-sm font-bold text-brand-ink">{customer.fullName || 'Customer'}</p>
          {customer.mobile ? <p className="mt-1 text-xs text-brand-muted">{customer.mobile}</p> : null}
          {data.address ? <p className="mt-1 text-xs leading-5 text-brand-muted">{formatAddress(data.address)}</p> : null}
        </DetailSection>
        <DetailSection title="From">
          <p className="text-sm font-bold text-brand-ink">{data.shop?.name || 'Repair shop'}</p>
          {data.shop?.phone ? <p className="mt-1 text-xs text-brand-muted">{data.shop.phone}</p> : null}
          {data.shop?.address ? <p className="mt-1 text-xs leading-5 text-brand-muted">{data.shop.address}</p> : null}
        </DetailSection>
      </div>
      <DeviceSummary order={order} data={data} />
      <DetailSection title="Tax invoice — services">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-xs">
              <thead><tr className="border-b border-brand-line bg-brand-50 text-brand-muted"><th className="p-2">#</th><th className="p-2">Description</th><th className="p-2 text-right">Taxable</th><th className="p-2 text-right">CGST</th><th className="p-2 text-right">SGST</th><th className="p-2 text-right">Amount</th></tr></thead>
              <tbody>
                {rows.map((row, index) => <tr key={`${row.name}-${index}`} className="border-b border-brand-line"><td className="p-2">{index + 1}</td><td className="p-2 font-medium text-brand-ink">{row.name}</td><td className="p-2 text-right">{money(row.taxable, true)}</td><td className="p-2 text-right">{money(row.cgst, true)}</td><td className="p-2 text-right">{money(row.sgst, true)}</td><td className="p-2 text-right font-bold">{money(row.gross, true)}</td></tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-brand-muted">No billed services yet.</p>}
        <div className="mt-3 flex items-center justify-between border-t border-brand-line pt-3">
          <p className="font-bold text-brand-ink">Grand total (incl. GST)</p>
          <p className="text-lg font-extrabold text-brand-700">₹{money(total, true)}</p>
        </div>
      </DetailSection>
      <p className="px-2 text-center text-[0.68rem] leading-4 text-brand-muted">This system-generated invoice uses the same GST-inclusive calculation as the customer app: 18% GST split into CGST 9% and SGST 9%.</p>
    </div>
  );
}

function nextSevenDays() {
  const days = [];
  const today = new Date();
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    days.push(day);
  }
  return days;
}

function sameSlot(a, b) {
  return Boolean(a && b)
    && time(a.startTime || a.pickupSlotStart) === time(b.startTime || b.pickupSlotStart)
    && time(a.endTime || a.pickupSlotEnd) === time(b.endTime || b.pickupSlotEnd);
}

function Reschedule({ data, onSubmit, saving }) {
  const booking = data.raw || {};
  const [days] = useState(nextSevenDays);
  const currentDate = String(booking.pickupDate || '').slice(0, 10);
  const prefilledIndex = days.findIndex((day) => day.toISOString().slice(0, 10) === currentDate);
  const [dayIndex, setDayIndex] = useState(prefilledIndex >= 0 ? prefilledIndex : 0);
  const [slot, setSlot] = useState(booking.pickupSlotStart ? { startTime: booking.pickupSlotStart, endTime: booking.pickupSlotEnd } : null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(Boolean(booking.shopId));
  const [slotError, setSlotError] = useState('');

  useEffect(() => {
    let active = true;
    if (!booking.shopId) {
      setLoadingSlots(false);
      return undefined;
    }
    (async () => {
      try {
        const result = await listPickupSlots(booking.shopId);
        if (active) setSlots(asArray(result));
      } catch (error) {
        if (active) setSlotError(error?.message || 'Could not load shop slots.');
      } finally {
        if (active) setLoadingSlots(false);
      }
    })();
    return () => { active = false; };
  }, [booking.shopId]);

  const selectedDay = days[dayIndex];
  const isoDay = ((selectedDay.getDay() + 6) % 7) + 1;
  const configured = slots.filter((item) => item?.dayOfWeek == null || Number(item.dayOfWeek) === isoDay);
  const displaySlots = configured.length ? configured : (slots.length ? [] : [
    { startTime: '09:00', endTime: '11:00' },
    { startTime: '11:00', endTime: '13:00' },
    { startTime: '13:00', endTime: '15:00' },
    { startTime: '15:00', endTime: '17:00' },
    { startTime: '17:00', endTime: '19:00' },
  ]);

  return (
    <div className="space-y-3">
      <DetailSection title="Re-schedule pickup" icon={CalendarClock}>
        <p className="text-sm leading-6 text-brand-muted">Choose a new pickup date and one of the shop’s available time slots.</p>
        {data.shop?.name ? <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-bold text-brand-700">{data.shop.name}</p> : null}
      </DetailSection>
      <DetailSection title="Choose pickup date">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day, index) => {
            const active = index === dayIndex;
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => { setDayIndex(index); setSlot(null); }}
                className={cx('min-w-[4.25rem] rounded-2xl border px-3 py-2.5 text-center transition', active ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-line bg-white text-brand-ink hover:border-brand-300')}
              >
                <span className={cx('block text-[0.62rem] font-bold uppercase tracking-wide', active ? 'text-white/85' : 'text-brand-muted')}>
                  {day.toLocaleDateString('en-IN', { weekday: 'short' })}
                </span>
                <span className="mt-0.5 block text-lg font-extrabold">{day.getDate()}</span>
                <span className={cx('block text-[0.62rem]', active ? 'text-white/85' : 'text-brand-muted')}>
                  {day.toLocaleDateString('en-IN', { month: 'short' })}
                </span>
              </button>
            );
          })}
        </div>
      </DetailSection>
      <DetailSection title="Pick a time slot" icon={Clock}>
        {loadingSlots ? <div className="flex items-center gap-2 py-4 text-sm text-brand-muted"><Loader2 className="h-4 w-4 animate-spin" />Loading slots…</div> : null}
        {slotError ? <p className="text-sm text-red-700">{slotError}</p> : null}
        {!loadingSlots && !slotError && !displaySlots.length ? <p className="text-sm text-brand-muted">This shop has no pickup slots for this date.</p> : null}
        <div className="grid grid-cols-2 gap-2">
          {displaySlots.map((candidate, index) => {
            const active = sameSlot(slot, candidate);
            return (
              <button
                key={candidate.id || `${candidate.startTime}-${candidate.endTime}-${index}`}
                type="button"
                onClick={() => setSlot(candidate)}
                className={cx('rounded-xl border px-3 py-3 text-sm font-bold transition', active ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-line bg-white text-brand-ink hover:border-brand-300')}
              >
                {timeRange(candidate.startTime, candidate.endTime)}
              </button>
            );
          })}
        </div>
      </DetailSection>
      <button
        type="button"
        disabled={!slot || saving}
        onClick={() => onSubmit({
          pickupDate: selectedDay.toISOString().slice(0, 10),
          pickupSlotStart: slot?.startTime,
          pickupSlotEnd: slot?.endTime,
        })}
        className="inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-300"
      >
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Confirm re-schedule'}
      </button>
    </div>
  );
}

function OrderDrawer({ selected, onClose, onViewChange, onRefresh, onReschedule, onCancelSell, saving }) {
  useEffect(() => {
    if (!selected) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [selected]);

  useEffect(() => {
    if (!selected || selected.view !== 'timeline' || selected.data?.kind !== 'booking') return undefined;
    const timer = window.setInterval(onRefresh, 10000);
    return () => window.clearInterval(timer);
  }, [onRefresh, selected]);

  if (!selected) return null;
  const { order, data, loading, error, view } = selected;
  const title = view === 'timeline'
    ? (isPickup(order, data) ? 'Pickup status' : 'Service history')
    : view === 'receipt' ? 'Receipt'
      : view === 'invoice' ? 'Invoice receipt'
        : view === 'reschedule' ? 'Re-schedule pickup'
          : String(order?.orderType || '').toUpperCase() === 'SELL' ? 'Sell request details' : 'Order details';

  let content = null;
  if (loading) {
    content = <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-brand-muted"><Loader2 className="h-5 w-5 animate-spin text-brand-600" />Loading order details…</div>;
  } else if (error) {
    content = <div className="py-12 text-center"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={onRefresh} className="mt-3 text-sm font-bold text-brand-700">Try again</button></div>;
  } else if (!data) {
    content = <div className="py-12 text-center text-sm text-brand-muted">Order details are unavailable.</div>;
  } else if (view === 'timeline') {
    content = <Timeline order={order} data={data} />;
  } else if (view === 'receipt') {
    content = <ReceiptView order={order} data={data} />;
  } else if (view === 'invoice') {
    content = <Invoice order={order} data={data} />;
  } else if (view === 'reschedule') {
    content = <Reschedule data={data} onSubmit={onReschedule} saving={saving} />;
  } else if (data.kind === 'sell') {
    content = <SellDetails order={order} data={data} onCancel={onCancelSell} cancelling={saving} />;
  } else if (data.kind === 'ticket') {
    content = <TicketDetails order={order} data={data} />;
  } else if (data.kind === 'booking') {
    content = <BookingDetails order={order} data={data} />;
  } else {
    content = <GenericDetails order={order} data={data} />;
  }

  const booking = data?.kind === 'booking';
  const pickup = isPickup(order, data);
  return (
    <div className="fixed inset-0 z-[80] bg-brand-ink/55 p-0 sm:p-5" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className="ml-auto flex h-full w-full max-w-3xl flex-col bg-brand-page shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-brand-line bg-white px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-600">My orders</p>
            <h2 className="mt-1 break-words text-lg font-extrabold text-brand-ink sm:text-xl">{title}</h2>
            {order?.orderNumber ? <p className="mt-1 text-xs text-brand-muted">#{String(order.orderNumber).replace(/^#/, '')}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close order details" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-line bg-white text-brand-muted transition hover:bg-brand-soften hover:text-brand-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">
          {content}
        </div>
        {data && !loading && !error ? (
          <div className="flex flex-wrap gap-2 border-t border-brand-line bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            {view !== 'details' ? <button type="button" onClick={() => onViewChange('details')} className="rounded-xl border border-brand-line px-3 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-soften">View details</button> : null}
            {booking ? <button type="button" onClick={() => onViewChange('timeline')} className="rounded-xl border border-brand-line px-3 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-soften">{pickup ? 'Track pickup' : 'History'}</button> : null}
            {booking ? <button type="button" onClick={() => onViewChange('receipt')} className="rounded-xl border border-brand-line px-3 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-soften">Receipt</button> : null}
            {booking && String(order?.status || '').toUpperCase() === 'COMPLETED' ? <button type="button" onClick={() => onViewChange('invoice')} className="rounded-xl border border-brand-line px-3 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-soften">Invoice</button> : null}
            {booking && isReschedulable(order, data) ? <button type="button" onClick={() => onViewChange('reschedule')} className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-brand-700">Re-schedule</button> : null}
            <button type="button" onClick={onRefresh} className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50"><RefreshCw className="h-4 w-4" />Refresh</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function OrdersExperience() {
  // The order type comes from the sidebar's My Orders links (?tab=service|pickup|buy|sell|enquiry).
  const tabParam = (useSearchParams().get('tab') || '').toLowerCase();
  const tab = TABS.find((item) => item.key.toLowerCase() === tabParam)?.key || 'Service';
  const tabConfig = TABS.find((item) => item.key === tab) || TABS[0];
  const [status, setStatus] = useState('Pending');
  const [orders, setOrders] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const masterCache = useRef(null);
  const modelsByBrand = useRef(new Map());
  const shopCache = useRef(new Map());
  const addressCache = useRef(null);
  const resourceCache = useRef(new Map());
  const selectionId = useRef(0);

  const loadMaster = useCallback(async () => {
    if (!masterCache.current) {
      masterCache.current = Promise.all([
        masterApi.get('/master/brands').catch(() => []),
        masterApi.get('/master/ram-options').catch(() => []),
        masterApi.get('/master/storage-options').catch(() => []),
      ]).then(([brands, rams, storages]) => ({
        brandById: new Map(unwrap(brands).map((item) => [idKey(item?.id), item])),
        ramById: new Map(unwrap(rams).map((item) => [idKey(item?.id), item])),
        storageById: new Map(unwrap(storages).map((item) => [idKey(item?.id), item])),
      }));
    }
    return masterCache.current;
  }, []);

  const loadModel = useCallback(async (brandId, modelId) => {
    if (!brandId || !modelId) return null;
    const key = idKey(brandId);
    if (!modelsByBrand.current.has(key)) {
      modelsByBrand.current.set(
        key,
        masterApi.get(`/master/brands/${encodeURIComponent(brandId)}/models`)
          .then(unwrap)
          .catch(() => []),
      );
    }
    const models = await modelsByBrand.current.get(key);
    return asArray(models).find((model) => sameId(model?.id, modelId)) || null;
  }, []);

  const loadShop = useCallback(async (shopId) => {
    if (!shopId) return null;
    const key = idKey(shopId);
    if (!shopCache.current.has(key)) shopCache.current.set(key, getShopPublic(shopId));
    return shopCache.current.get(key);
  }, []);

  const loadAddresses = useCallback(async () => {
    if (!addressCache.current) addressCache.current = listAddresses().catch(() => []);
    return addressCache.current;
  }, []);

  const loadResource = useCallback(async (order, force = false) => {
    const descriptor = orderDescriptor(order);
    if (force) resourceCache.current.delete(descriptor.cacheKey);
    if (!resourceCache.current.has(descriptor.cacheKey)) {
      const request = descriptor.kind === 'booking'
        ? getRepairBooking(descriptor.id)
        : descriptor.kind === 'sell'
          ? getSellOrder(descriptor.id)
          : descriptor.kind === 'ticket'
            ? getServiceTicket(descriptor.id)
            : Promise.resolve(order);
      resourceCache.current.set(descriptor.cacheKey, request);
    }
    try {
      return { descriptor, raw: await resourceCache.current.get(descriptor.cacheKey) };
    } catch (requestError) {
      resourceCache.current.delete(descriptor.cacheKey);
      throw requestError;
    }
  }, []);

  const buildOrderData = useCallback(async (order, { includeAddress = false, force = false } = {}) => {
    const { descriptor, raw } = await loadResource(order, force);
    const payload = order?.payload || {};
    const source = raw || {};
    const brandId = source.brandId || payload.brandId;
    const modelId = source.modelId || payload.modelId;
    const ramId = source.ramOptionId || payload.ramOptionId;
    const storageId = source.storageOptionId || payload.storageOptionId;
    const [master, model] = await Promise.all([loadMaster(), loadModel(brandId, modelId)]);
    const brand = master.brandById.get(idKey(brandId));
    const ram = master.ramById.get(idKey(ramId));
    const storage = master.storageById.get(idKey(storageId));
    const specs = [brand?.name, source.color || payload.color, [ram?.label, storage?.label].filter(Boolean).join(' / ')]
      .filter(Boolean)
      .join(' · ');
    const services = descriptor.kind === 'ticket'
      ? parseTicketItems(source)
      : (asArray(source.services).length ? asArray(source.services) : asArray(payload.services));
    const shopId = source.shopId || order?.shopId || payload.shopId;
    const addressId = source.pickupAddressId || source.addressId || payload.pickupAddressId || payload.addressId;
    const [shop, addresses] = await Promise.all([
      loadShop(shopId),
      includeAddress && addressId ? loadAddresses() : Promise.resolve([]),
    ]);
    const address = asArray(addresses).find((item) => sameId(item?.id, addressId)) || source.address || null;
    const ticketImage = normalizeImageUrl(source.deviceImageUrl);
    return {
      kind: descriptor.kind,
      id: descriptor.id,
      raw: source,
      name: source.deviceDisplayName || source.modelName || model?.name || payload.modelName || payload.deviceName || payload.title,
      image: ticketImage || masterImage(model),
      specs,
      services,
      issueSummary: cleanIssueSummary(source.issueSummary || source.issueDescription || payload.issueSummary),
      shop,
      address,
      model,
      brand,
      ram,
      storage,
    };
  }, [loadAddresses, loadMaster, loadModel, loadResource, loadShop]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const config = TABS.find((item) => item.key === tab) || TABS[0];
        const lists = await Promise.all(config.types.map((orderType) => listMyOrders({ orderType, status })));
        if (!active) return;
        const unique = new Map();
        lists.flat().forEach((order) => {
          if (order?.id != null && !unique.has(idKey(order.id))) unique.set(idKey(order.id), order);
        });
        const merged = [...unique.values()].sort(
          (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime(),
        );
        setOrders(merged);
      } catch (requestError) {
        if (!active) return;
        setOrders([]);
        setDetails({});
        setError(requestError?.message || 'Could not load your orders.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [reloadKey, status, tab]);

  // Cards are deliberately rendered before enrichment completes. That mirrors
  // the app's progressive list and means a transient master/shop failure never
  // hides an otherwise valid customer order.
  useEffect(() => {
    let active = true;
    if (!orders.length) {
      setDetails({});
      return undefined;
    }
    (async () => {
      const rows = await Promise.all(orders.map(async (order) => {
        try {
          return [idKey(order.id), await buildOrderData(order)];
        } catch {
          return [idKey(order.id), null];
        }
      }));
      if (!active) return;
      const next = {};
      rows.forEach(([key, data]) => { if (data) next[key] = data; });
      setDetails(next);
    })();
    return () => { active = false; };
  }, [buildOrderData, orders]);

  const openOrder = useCallback(async (order, view = 'details', force = false) => {
    const request = ++selectionId.current;
    const cached = details[idKey(order?.id)] || null;
    setSelected({ order, view, data: cached, loading: true, error: '' });
    try {
      const data = await buildOrderData(order, { includeAddress: true, force });
      if (selectionId.current !== request) return;
      setSelected((current) => current && current.order?.id === order?.id ? { ...current, data, loading: false, error: '' } : current);
    } catch (requestError) {
      if (selectionId.current !== request) return;
      setSelected((current) => current && current.order?.id === order?.id ? { ...current, loading: false, error: requestError?.message || 'Could not load order details.' } : current);
    }
  }, [buildOrderData, details]);

  const closeOrder = useCallback(() => {
    selectionId.current += 1;
    setSelected(null);
  }, []);

  const refreshSelected = useCallback(() => {
    if (!selected?.order) return;
    openOrder(selected.order, selected.view, true);
  }, [openOrder, selected]);

  const changeView = useCallback((view) => {
    setSelected((current) => current ? { ...current, view } : current);
  }, []);

  const reschedule = useCallback(async (payload) => {
    const bookingId = selected?.data?.id || bookingRef(selected?.order);
    if (!bookingId) return;
    setSaving(true);
    try {
      await rescheduleRepairBooking(bookingId, payload);
      const data = await buildOrderData(selected.order, { includeAddress: true, force: true });
      setSelected((current) => current ? { ...current, data, view: 'details', loading: false } : current);
      notifySuccess(`Pickup re-scheduled for ${formatDate(payload.pickupDate)}${timeRange(payload.pickupSlotStart, payload.pickupSlotEnd) ? ` · ${timeRange(payload.pickupSlotStart, payload.pickupSlotEnd)}` : ''}.`);
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      notifyError(requestError, 'Could not re-schedule this pickup.');
    } finally {
      setSaving(false);
    }
  }, [buildOrderData, selected]);

  const cancelSell = useCallback(async () => {
    const id = selected?.data?.id || sellRef(selected?.order);
    if (!id || !selected?.order) return;
    if (typeof window !== 'undefined' && !window.confirm('Cancel this sell request? You can submit a new request anytime.')) return;
    setSaving(true);
    try {
      await cancelSellOrder(id);
      const data = await buildOrderData(selected.order, { includeAddress: true, force: true });
      setSelected((current) => current ? { ...current, data } : current);
      notifySuccess('Your sell request has been cancelled.');
      setReloadKey((key) => key + 1);
    } catch (requestError) {
      notifyError(requestError, 'Could not cancel this sell request.');
    } finally {
      setSaving(false);
    }
  }, [buildOrderData, selected]);

  const retry = () => setReloadKey((key) => key + 1);
  const statusLabel = STATUSES.find((item) => item.value === status)?.label || status;

  return (
    <div>
      <AccountPageHeader eyebrow="My Orders" title={`${tabConfig.label} orders`} subtitle="Pick Service, Pickup, Buy, Sell or Enquiry from My Orders on the left." />
      <div className="mt-5 flex flex-wrap gap-2">
        {STATUSES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setStatus(item.value)}
            aria-pressed={status === item.value}
            className={cx(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition [@media(pointer:coarse)]:py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
              status === item.value ? 'bg-brand-ink text-white' : 'border border-brand-line bg-white text-brand-muted hover:text-brand-ink',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {loading ? <AccountLoader label="Loading your orders…" /> : null}
        {!loading && error ? <AccountError message={error} onRetry={retry} /> : null}
        {!loading && !error && !orders.length ? (
          <AccountEmpty
            icon={Package}
            title={`No ${tab.toLowerCase()} orders`}
            description={`You don't have any ${statusLabel.toLowerCase()} ${tab.toLowerCase()} orders yet.`}
          />
        ) : null}
        {!loading && !error && orders.length ? (
          <div className="grid grid-cols-1 gap-4">
            {orders.map((order) => <OrderCard key={order.id} order={order} data={details[idKey(order.id)]} onOpen={openOrder} tab={tab} />)}
          </div>
        ) : null}
      </div>
      <OrderDrawer
        selected={selected}
        onClose={closeOrder}
        onViewChange={changeView}
        onRefresh={refreshSelected}
        onReschedule={reschedule}
        onCancelSell={cancelSell}
        saving={saving}
      />
    </div>
  );
}
