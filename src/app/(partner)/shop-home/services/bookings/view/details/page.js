'use client';

/**
 * /shop-home/services/bookings/view/details/?id=… — Booking Details for one
 * booking, laid out like the Partner app's TicketDetailScreen (the screen a
 * job card's VIEW opens): header "Booking Details" + tracking-ID pill, then
 * one card — device hero with the status pill, CUSTOMER, DEVICE PHOTOS,
 * ACCESSORIES, MISSING / DAMAGED PARTS, WARRANTY, PRICE SUMMARY, SERVICE INFO,
 * RE-ESTIMATED, INVOICE, TECHNICIAN — and the app's bottom action bar.
 * Opened by the Bookings list's VIEW and by the dashboard's Recent Bookings.
 *
 * Data (no other calls): GET {ORDER_BASE}/repair-bookings/shop/{id}
 * (RepairBookingResponse; device names / photo / variant resolved from
 * master data with enrichWithCatalog + loadVariantOptions), and the repair
 * ticket it points at, GET /tickets/{ticketId} — status, tracking ID,
 * price items, payment, accessories, parts, photos, schedule, technician,
 * invoice number. A booking without a ticket yet shows the booking's own
 * copy of what it has.
 *
 * Actions, mapped to what the web already does: Re-Est → Book Service edit
 * mode (book-service/?edit=<ticketId>, as the Re-Quote page); Resched. →
 * RescheduleModal; Status → ServiceStatusSheet; technician Assign / Change →
 * AssignTechnicianModal; History / Receipt / Barcode → the pages under
 * ../; View Invoice / Generate → the Invoice report / generator. Edit → ../edit
 * (PATCH /tickets/{id}); IMEI "+ Add" stays disabled.
 * Not on the web, so left out: Price Revised, Re-Service, the re-estimate
 * request card, the WhatsApp confirmation card, alt. mobile / email / ID
 * proof (customer lookup) and the device security lock.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Calendar,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  Headphones,
  History,
  IndianRupee,
  ListChecks,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  QrCode,
  Receipt,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  User,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import ImagePreviewModal from '@/components/shop-dashboard/ImagePreviewModal';
import AssignTechnicianModal from '@/components/shop-dashboard/AssignTechnicianModal';
import RescheduleModal from '@/components/shop-dashboard/RescheduleModal';
import ServiceStatusSheet from '@/components/shop-dashboard/ServiceStatusSheet';
import { withHash } from '@/components/shop-dashboard/OrdersList';
import { fetchShopBookingDetail, fetchTicket } from '@/lib/shopDashboard';
import { bookingEstimatedAmount, formatPickupAddress } from '@/lib/bookingFormat';
import { priceItemsFromTicket } from '@/lib/invoice';
import { bookingRef } from '@/lib/orderStages';
import { buildTimelineGroups } from '@/lib/serviceTimeline';
import { enrichWithCatalog, getDeviceImage, loadVariantOptions, resolveMediaUrl, variantLabel } from '@/lib/deviceImage';

const TEAL = '#035C6C';
// The app's tool-tile colours (TicketDetailScreen HOME_TILE_TONES); icons sit on them at 0.8 opacity.
const TILE_TONES = ['#035C6C', '#0788C9', '#609138', '#E08E00', '#1C3053', '#F32C26', '#357D89', '#0571A8'];
const tone = (i) => `${TILE_TONES[i % TILE_TONES.length]}CC`;
// Section-header and row-icon colour indexes, as the app's ICON_TONE.
const SECTION_TONE = { CUSTOMER: 0, 'DEVICE PHOTOS': 2, ACCESSORIES: 3, 'MISSING / DAMAGED PARTS': 5, WARRANTY: 4, 'PRICE SUMMARY': 3, 'SERVICE INFO': 1, 'RE-ESTIMATED': 7, INVOICE: 0, TECHNICIAN: 4 };
const ROW_TONE = { Name: 0, Mobile: 1, Address: 4, Complaint: 3, 'Est. Time': 1, Delivery: 2, IMEI: 4, Approval: 0, Revised: 2, Services: 3, Original: 4, 'New Delivery': 7 };

// Ticket status -> label + tone (TicketDetailScreen STATUS_VARIANT / TONE).
const STATUS_VARIANT = {
  CREATED: ['Order Placed', 'amber'],
  ASSIGNED: ['Technician Assigned', 'teal'],
  IN_DIAGNOSIS: ['In Diagnosis', 'purple'],
  IN_REPAIR: ['In Service', 'purple'],
  QUOTED: ['Re-Estimated', 'amber'],
  APPROVED: ['Approved', 'teal'],
  READY: ['Ready for Delivery', 'teal'],
  RETURN_DELIVERY: ['Return Delivery', 'amber'],
  INVOICE_GENERATED: ['Billing & Delivery Invoice Generated', 'amber'],
  INVOICE_READY: ['Invoice Sent', 'amber'],
  DELIVERED_PROCESSING: ['Out of Delivery', 'amber'],
  DELIVERED: ['Delivered', 'teal'],
  CANCELLED: ['Cancelled', 'red'],
};
const TONE_STYLE = {
  amber: { bg: 'rgba(245,158,11,0.12)', fg: '#B45309', border: 'rgba(245,158,11,0.35)' },
  teal: { bg: 'rgba(3,92,108,0.12)', fg: TEAL, border: 'rgba(3,92,108,0.35)' },
  purple: { bg: 'rgba(53,125,137,0.12)', fg: TEAL, border: 'rgba(53,125,137,0.35)' },
  red: { bg: 'rgba(220,38,38,0.12)', fg: '#B91C1C', border: 'rgba(220,38,38,0.35)' },
};
// Statuses where the technician has picked the job up (app ACCEPTED_STATUSES).
const ACCEPTED_STATUSES = ['IN_DIAGNOSIS', 'IN_REPAIR', 'QUOTED', 'APPROVED', 'READY', 'INVOICE_GENERATED', 'INVOICE_READY', 'DELIVERED_PROCESSING', 'DELIVERED'];
// Re-Est is open until the repair is done (the Re-Quote page's window).
const RE_ESTIMABLE = ['CREATED', 'ASSIGNED', 'IN_DIAGNOSIS', 'QUOTED', 'APPROVED', 'IN_REPAIR'];
const PHOTO_KEYS = ['front', 'back', 'left', 'right', 'top', 'bottom'];

function humanize(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

// App fmtInstant: "Mon Jul 20 2026 1:34 pm".
function fmtInstant(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.toDateString()} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}`;
}
const fmtShortDate = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
};

// Warranty text ("3 Months", "1 Year", "15 Days") -> end date from `start`.
function warrantyEnd(start, text) {
  const d = start ? new Date(start) : null;
  const m = String(text || '').match(/(\d+)\s*(day|week|month|year)/i);
  if (!d || Number.isNaN(d.getTime()) || !m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const end = new Date(d);
  if (unit === 'day') end.setDate(end.getDate() + n);
  else if (unit === 'week') end.setDate(end.getDate() + n * 7);
  else if (unit === 'month') end.setMonth(end.getMonth() + n);
  else end.setFullYear(end.getFullYear() + n);
  return end;
}

const safeParse = (v) => {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

// Booking photos from the ticket's devicePhotosJson (app utils/bookingPhotos.js).
function photoUrlsOf(ticket) {
  const v = safeParse(ticket?.devicePhotosJson);
  const urlOf = (x) => (typeof x === 'string' ? x : x?.url || x?.uri || '');
  let list = [];
  if (Array.isArray(v)) list = v.map(urlOf);
  else if (v && typeof v === 'object') {
    const keys = [...PHOTO_KEYS, ...Object.keys(v).filter((k) => !PHOTO_KEYS.includes(k) && !/video/i.test(k))];
    list = keys.map((k) => urlOf(v[k]));
  }
  return [...new Set(list.filter((u) => typeof u === 'string' && u.trim()).map((u) => resolveMediaUrl(u) || u))];
}

// The app's paymentFromTicket: null when nothing was collected.
function paymentFromTicket(ticket, total) {
  const amount = Number(ticket?.paymentAmount);
  if (!ticket?.paymentType || !Number.isFinite(amount) || amount <= 0) return null;
  const stored = Number(ticket.balanceAmount);
  const balance = ticket.balanceAmount != null && Number.isFinite(stored) ? Math.max(0, stored) : Math.max(0, (Number(total) || 0) - amount);
  return { label: ticket.paymentType === 'FULL' ? 'Full Payment' : 'Advance Payment', amount, balance };
}

/** "#GTS-138" -> letters dark, digits teal (the app's split tracking ID). */
function TrackingText({ value }) {
  const m = String(value || '').match(/^(#?[A-Za-z-]*?)(\d[\s\S]*)?$/);
  return (
    <>
      {m ? m[1] : value}
      {m?.[2] ? <span className="text-[#035C6C]">{m[2]}</span> : null}
    </>
  );
}

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 px-3.5 pb-[7px] pt-[17px]">
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: tone(SECTION_TONE[label] ?? 0) }}>
        <Icon className="h-3 w-3 text-white" aria-hidden="true" />
      </span>
      <span className="text-[12px] font-extrabold tracking-[0.08em] text-[#111111]">{label}</span>
      <span className="h-px flex-1 bg-[#E5E7EB]" aria-hidden="true" />
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, children, full = false }) {
  return (
    <div className="flex items-start gap-2.5 py-[5px]">
      <span className="flex h-[24.5px] w-[24.5px] shrink-0 items-center justify-center rounded-[7px]" style={{ backgroundColor: tone(ROW_TONE[label] ?? 0) }}>
        <Icon className="h-3.5 w-3.5 text-white" aria-hidden="true" />
      </span>
      <span className="w-[78px] shrink-0 pt-1 text-[12px] text-[#6B7280]">{label}</span>
      <div className="flex min-w-0 flex-1 items-start gap-2 pt-1">
        <span className={cx('min-w-0 flex-1 break-words text-[12px] font-bold text-[#111111]', !full && 'line-clamp-2')}>{value}</span>
        {children}
      </div>
    </div>
  );
}

function Pill({ ok, okLabel = 'Approved', pendingLabel = 'Pending' }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#E5F3F5] px-2 py-0.5 text-[11px] font-extrabold text-[#035C6C]">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      {okLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-extrabold text-[#B45309]">
      <AlertCircle className="h-3 w-3" aria-hidden="true" />
      {pendingLabel}
    </span>
  );
}

function DisabledPill({ label, title }) {
  return (
    <span title={title} className="shrink-0 cursor-not-allowed rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-extrabold text-[#9CA3AF]">
      {label}
    </span>
  );
}

function DeviceThumb({ src }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#E5F3F5]">
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote catalog photo, not an app asset Next can optimize.
        <img src={src} alt="" onError={() => setBroken(true)} className="h-full w-full object-contain" />
      ) : (
        <Smartphone className="h-6 w-6 text-[#6B7280]" aria-hidden="true" />
      )}
    </span>
  );
}

/** One bottom-bar tile: 40px disc + label. `href` = link, `onClick` = button, `disabled` greys it with a reason. */
function ActionTile({ icon: Icon, label, color, href, onClick, disabled, title }) {
  const body = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: disabled ? '#E5E7EB' : color }}>
        <Icon className={cx('h-[18px] w-[18px]', disabled ? 'text-[#9CA3AF]' : 'text-white')} aria-hidden="true" />
      </span>
      <span className={cx('mt-1.5 max-w-full truncate text-[11px] font-extrabold', disabled ? 'text-[#9CA3AF]' : 'text-[#111111]')}>{label}</span>
    </>
  );
  const cls = cx('flex min-w-0 flex-col items-center rounded-xl px-1 py-1.5 transition', disabled ? 'cursor-not-allowed' : 'hover:bg-[#F3F4F6] active:opacity-70');
  if (href && !disabled) {
    return (
      <Link href={href} title={title || label} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} title={title || label} className={cls}>
      {body}
    </button>
  );
}

export default function BookingDetailsPage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [booking, setBooking] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [variant, setVariant] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [barOpen, setBarOpen] = useState(true);
  const [photo, setPhoto] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const closePhoto = useCallback(() => setPhoto(null), []);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    fetchShopBookingDetail(id)
      .then(async (data) => {
        if (!data) return;
        // Fill device name/photo from the master catalog, and the variant
        // label from the ram/storage option ids — the booking has only ids.
        const [[enriched], options] = await Promise.all([enrichWithCatalog([data]), loadVariantOptions()]);
        if (!alive) return;
        setBooking(enriched);
        setVariant(variantLabel(data, options));
        if (data.ticketId) {
          fetchTicket(data.ticketId)
            .then((t) => alive && setTicket(t || null))
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load this booking.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const ticketId = ticket?.id || booking?.ticketId || null;
  const ref = withHash(bookingRef({ trackingId: ticket?.trackingId, bookingNumber: booking?.bookingNumber, id: booking?.id }) || id);
  const statusKey = String(ticket?.status || '').toUpperCase();
  const delivered = statusKey === 'DELIVERED';

  // Status pill: the ticket's status as the app labels it; before a ticket
  // exists, the booking's current Service History step.
  const timelineLabel = useMemo(() => {
    if (!booking) return '';
    const current = [...buildTimelineGroups(booking).flatMap((g) => g.steps)].reverse().find((s) => s.done);
    return current?.label || humanize(booking.status) || 'Status not available';
  }, [booking]);
  const variantMeta = STATUS_VARIANT[statusKey];
  const statusLabel = variantMeta ? variantMeta[0] : statusKey ? humanize(statusKey) : timelineLabel;
  const statusTone = TONE_STYLE[variantMeta ? variantMeta[1] : 'amber'];

  const brand = booking?.brandName || '';
  const model = booking?.deviceDisplayName || booking?.modelName || ticket?.deviceDisplayName || '';
  const deviceName = model ? (brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${model}` : model) : 'Device';
  const specLine = [ticket?.modelNumber || booking?.modelNumber, variant].filter(Boolean).join(' - ');
  const image = booking ? resolveMediaUrl(ticket?.deviceImageUrl) || resolveMediaUrl(booking.deviceImageUrl) || resolveMediaUrl(booking.frontImageUrl) || getDeviceImage(booking) : null;

  const customerName = ticket?.customerName || booking?.customerName || '';
  const phone = ticket?.customerPhone || booking?.customerMobile || '';
  const phoneDigits = String(phone).replace(/\D/g, '').slice(-10);
  const address =
    ticket?.customerAddress || booking?.customerAddress || (booking?.pickupAddress || booking?.pickupAddressText ? formatPickupAddress(booking) : '');

  const photos = useMemo(() => photoUrlsOf(ticket), [ticket]);
  const accessories = String(ticket?.accessories || '')
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
  const flaggedParts = useMemo(() => {
    const list = safeParse(ticket?.missingPartsJson);
    return (Array.isArray(list) ? list : []).filter((p) => p && (p.missing || p.damage));
  }, [ticket]);

  // Price items: the ticket's, else the booking's services.
  const items = useMemo(() => {
    const fromTicket = ticket ? priceItemsFromTicket(ticket) : [];
    const list = fromTicket.length ? fromTicket : (booking?.services || []).map((s) => ({ label: s.serviceName || s.serviceCode, amount: s.estimatedPrice }));
    return list.map((i) => ({ label: i.label || i.serviceName || i.name || 'Service', amount: Number(i.amount ?? i.price ?? 0) || 0, warranty: i.warranty || '' }));
  }, [ticket, booking]);
  const itemsSum = items.reduce((sum, i) => sum + i.amount, 0);
  const total =
    ticket?.estimatedPrice != null
      ? Number(ticket.estimatedPrice)
      : booking
        ? Number(booking.finalAmount ?? booking.estimateAmount ?? bookingEstimatedAmount(booking) ?? itemsSum) || 0
        : 0;
  const payment = paymentFromTicket(ticket, total);
  const warranties = items.filter((i) => /\d/.test(i.warranty) && Number(String(i.warranty).match(/\d+/)?.[0]) > 0);
  const deliveredAt = ticket?.deliveredAt || null;

  const complaint = String(ticket?.issueDescription || booking?.issueSummary || booking?.issueDescription || '')
    .split('\n')
    .filter((l) => !/imei not provided/i.test(l))
    .join('\n')
    .trim();
  const imei = ticket?.imei || booking?.imei || '';
  const approvalRaw = String(ticket?.customerApproval ?? booking?.customerApproval ?? '').toUpperCase();
  const approved = ticket?.customerApproval === true || booking?.customerApproval === true || ['DONE', 'APPROVED', 'TRUE'].includes(approvalRaw);
  const readyAt = ticket?.estimatedReadyAt || booking?.estimatedReadyAt;
  const deliveryAt = ticket?.estimatedDeliveryAt || booking?.estimatedDeliveryAt;

  const hasInvoice = Boolean(ticket?.invoiceNo || ticket?.invoiceId || ticket?.invoiceGeneratedAt);
  const techName = ticket?.assignedTechnicianName || booking?.technicianName || '';
  const techAccepted = Boolean(techName) && ACCEPTED_STATUSES.includes(statusKey);
  const techLocked = delivered || techAccepted;
  const initials = techName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const label = [ref, deviceName].filter(Boolean).join(' · ');

  function copyRef() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(ref)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  }

  const qid = encodeURIComponent(booking?.id || id || '');
  const noTicket = 'This booking has no repair ticket yet';
  // The app's bottom bar (Edit · Re-Est · Resched. · Status; delivered: Re-Service,
  // which the web lacks), plus History · Receipt · Barcode.
  const tiles = [
    delivered ? null : { key: 'edit', label: 'Edit', icon: Pencil, href: ticketId ? `/shop-home/services/bookings/view/edit/?id=${qid}&ticket=${encodeURIComponent(ticketId)}` : null, disabled: !ticketId || statusKey === 'CANCELLED', title: ticketId ? 'Edit booking details' : noTicket },
    delivered
      ? null
      : {
          key: 'reest',
          label: 'Re-Est',
          icon: Calculator,
          href: ticketId ? `/shop-home/services/bookings/view/re-estimate/?id=${qid}&ticket=${encodeURIComponent(ticketId)}` : null,
          disabled: !ticketId || !RE_ESTIMABLE.includes(statusKey),
          title: !ticketId ? noTicket : RE_ESTIMABLE.includes(statusKey) ? 'Re-estimate this repair' : 'Re-estimate is closed once the repair is ready',
        },
    delivered ? null : { key: 'resched', label: 'Resched.', icon: CalendarClock, onClick: () => setRescheduling(true), disabled: !ticketId, title: ticketId ? 'Change the ready and delivery date & time' : noTicket },
    delivered ? null : { key: 'status', label: 'Status', icon: ListChecks, onClick: () => setStatusOpen(true), disabled: !ticketId, title: ticketId ? 'Update service status' : noTicket },
    { key: 'history', label: 'History', icon: History, href: `/shop-home/services/bookings/view/?id=${qid}` },
    { key: 'receipt', label: 'Receipt', icon: Receipt, href: `/shop-home/services/bookings/view/receipt/?id=${qid}` },
    { key: 'barcode', label: 'Barcode', icon: QrCode, href: `/shop-home/services/bookings/view/qr/?id=${qid}` },
  ].filter(Boolean);

  return (
    <div className="-mx-4 -my-5 min-h-[calc(100vh-4rem)] bg-[#F3F4F6] sm:-mx-6 sm:-my-6">
      {/* ---- Header: back · Booking Details + tracking pill · spacer ---- */}
      <div className="flex items-center border-b border-[#E5E7EB] bg-white px-3.5 pb-3 pt-2.5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB] text-[#111111] transition hover:bg-[#F3F4F6]"
        >
          <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center px-2">
          <h1 className="text-[17px] font-extrabold text-[#111111]">Booking Details</h1>
          {booking ? (
            <button
              type="button"
              onClick={copyRef}
              title="Copy tracking ID"
              className="mt-0.5 max-w-[200px] truncate rounded-full bg-[#E5F3F5] px-2.5 py-0.5 text-[11px] font-extrabold text-[#111111]"
            >
              {copied ? 'Copied' : <TrackingText value={ref} />}
            </button>
          ) : null}
        </div>
        <span className="h-9 w-9 shrink-0 lg:hidden" aria-hidden="true" />
        {booking ? (
          <span className="hidden max-w-[220px] shrink-0 items-center gap-1 truncate rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase lg:inline-flex" style={{ backgroundColor: statusTone.bg, color: statusTone.fg, borderColor: statusTone.border }}>
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className={cx('mx-auto max-w-[760px] px-4 pt-3 lg:max-w-[1440px] lg:px-6 lg:pt-4', booking ? 'pb-48 lg:pb-8' : 'pb-8')}>
        {!id ? (
          <EmptyState icon={AlertTriangle} tone="muted" title="No booking selected" description="Open a booking from Recent Bookings or the Bookings list." />
        ) : loading && !booking ? (
          <div className="h-[520px] animate-pulse rounded-[18px] border border-[#E5E7EB] bg-white" />
        ) : error ? (
          <ErrorBanner message={error} onRetry={reload} />
        ) : !booking ? (
          <EmptyState icon={AlertTriangle} tone="muted" title="Booking not found" description="We couldn't find this booking." />
        ) : (
          <div className="space-y-3 lg:space-y-4">
          <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_6px_rgba(5,54,110,0.06)]">
            {/* ---- Device hero ---- */}
            <div className="p-3">
              <div className="flex items-start gap-3">
                <DeviceThumb src={image} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[14px] font-extrabold text-[#111111]">{deviceName}</p>
                  {specLine ? <p className="truncate text-[12px] font-semibold text-[#374151]">{specLine}</p> : null}
                  {booking.color || ticket?.color ? <p className="truncate text-[12px] text-[#6B7280]">{booking.color || ticket?.color}</p> : null}
                </div>
                <div className="max-w-[160px] shrink-0 text-right lg:max-w-none">
                  <p className="text-[10px] text-[#6B7280]">Tracking ID</p>
                  <p className="truncate text-[12px] font-extrabold text-[#035C6C]">{ref}</p>
                  <p className="mt-1 text-[10px] text-[#6B7280]">Booked on</p>
                  <p className="whitespace-nowrap text-[11px] font-bold text-[#111111]">{fmtInstant(booking.createdAt) || '—'}</p>
                </div>
              </div>
              <span
                className="mt-2.5 inline-flex max-w-full items-center gap-1 rounded-full border px-[7px] py-[2px] text-[10px] font-extrabold uppercase"
                style={{ backgroundColor: statusTone.bg, color: statusTone.fg, borderColor: statusTone.border }}
              >
                {statusKey === 'CANCELLED' ? <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />}
                <span className="truncate">{statusLabel}</span>
              </span>
            </div>
          </section>

          {/* ---- Desktop toolbar (replaces the bottom bar at lg) ---- */}
          <div className="hidden flex-wrap gap-1 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-[0_1px_6px_rgba(5,54,110,0.06)] lg:flex">
            {tiles.map((t, i) => (
              <div key={t.key} className="w-[88px]"><ActionTile {...t} color={TILE_TONES[i % TILE_TONES.length]} /></div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] lg:items-start lg:gap-4">
          <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white pb-3 shadow-[0_1px_6px_rgba(5,54,110,0.06)]">
            {/* ---- Customer ---- */}
            <SectionHeader icon={User} label="CUSTOMER" />
            <div className="px-3.5">
              <DetailRow icon={User} label="Name" value={customerName || '—'} />
              <DetailRow icon={Phone} label="Mobile" value={phone || '—'}>
                {phoneDigits ? (
                  <span className="flex shrink-0 gap-1.5">
                    <a href={`tel:${phoneDigits}`} aria-label={`Call ${phone}`} title="Call" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C] hover:brightness-95">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                    <a
                      href={`https://wa.me/91${phoneDigits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`WhatsApp ${phone}`}
                      title="WhatsApp"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(37,211,102,0.14)] text-[#25D366] hover:brightness-95"
                    >
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </span>
                ) : null}
              </DetailRow>
              <DetailRow icon={MapPin} label="Address" value={address || 'None'} full />
            </div>

            {/* ---- Accessories ---- */}
            <SectionHeader icon={Headphones} label="ACCESSORIES" />
            <div className="px-3.5">
              {accessories.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {accessories.map((a) => (
                    <span key={a} className="rounded-full bg-[#E5F3F5] px-2.5 py-1 text-[12px] font-bold text-[#035C6C]">
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-[#6B7280]">No accessories received with the device.</p>
              )}
            </div>

            {/* ---- Missing / damaged parts ---- */}
            <SectionHeader icon={TriangleAlert} label="MISSING / DAMAGED PARTS" />
            <div className="space-y-1.5 px-3.5">
              {flaggedParts.length ? (
                flaggedParts.map((p, i) => (
                  <div key={p.partId || i}>
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#111111]">{p.partName || 'Part'}</span>
                      {p.damage ? <span className="rounded-full bg-[#FEECEC] px-2 py-0.5 text-[10.5px] font-extrabold text-[#D63232]">Damaged</span> : null}
                      {p.missing ? <span className="rounded-full bg-[#FFF8E1] px-2 py-0.5 text-[10.5px] font-extrabold text-[#8A6A00]">Missing</span> : null}
                    </div>
                    {p.detail ? <p className="text-[12px] text-[#6B7280]">{p.detail}</p> : null}
                  </div>
                ))
              ) : booking.missingDamageParts ? (
                <p className="whitespace-pre-line break-words text-[12px] text-[#111111]">{booking.missingDamageParts}</p>
              ) : (
                <p className="text-[12px] text-[#6B7280]">No missing or damaged parts reported.</p>
              )}
            </div>

            {/* ---- Device photos ---- */}
            {photos.length ? (
              <>
                <SectionHeader icon={Camera} label="DEVICE PHOTOS" />
                <div className="px-3.5">
                  <p className="mb-2 text-[12px] text-[#6B7280]">
                    {photos.length} photo{photos.length > 1 ? 's' : ''}
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setPhoto(u)}
                        aria-label="View device photo"
                        className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F3F4F6] hover:ring-2 hover:ring-[#035C6C]/30"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- booking photo from the media service. */}
                        <img src={u} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {/* ---- Service info ---- */}
            <SectionHeader icon={Wrench} label="SERVICE INFO" />
            <div className="px-3.5">
              <DetailRow icon={FileText} label="Complaint" value={complaint || 'Not provided'} />
              <DetailRow icon={Clock} label="Est. Time" value={fmtInstant(readyAt) || 'Not set'} />
              <DetailRow icon={Calendar} label="Delivery" value={fmtInstant(deliveryAt) || 'Not set'} />
              <DetailRow icon={ScanLine} label="IMEI" value={imei || '-'}>
                {imei ? null : <DisabledPill label="+ Add" title="Adding an IMEI after booking isn't available in the shop portal yet" />}
              </DetailRow>
              <DetailRow icon={CheckCircle2} label="Approval" value={<Pill ok={approved} />} />
            </div>

          </section>
          <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white pb-3 shadow-[0_1px_6px_rgba(5,54,110,0.06)]">
            {/* ---- Price summary ---- */}
            <SectionHeader icon={IndianRupee} label="PRICE SUMMARY" />
            <div className="px-3.5">
              <div className="divide-y divide-[#E5F3F5]">
                {items.length ? (
                  items.map((it, i) => (
                    <div key={`${it.label}-${i}`} className="flex items-center gap-2.5 py-1.5">
                      <span className="flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-md bg-[#E5F3F5] text-[11px] font-extrabold text-[#035C6C]">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#111111]">{it.label}</span>
                      <span className="shrink-0 text-[12px] font-extrabold text-[#111111]">{inr(it.amount)}</span>
                    </div>
                  ))
                ) : (
                  <p className="py-1.5 text-[12px] text-[#6B7280]">No services listed</p>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-[#E5E7EB] pt-2">
                <span className="text-[12px] font-bold text-[#111111]">Estimated Total</span>
                <span className="text-[14px] font-extrabold text-[#035C6C]">{inr(total)}</span>
              </div>
              {payment ? (
                <>
                  <div className="flex items-center justify-between py-1 text-[12px]">
                    <span className="text-[#6B7280]">{payment.label}</span>
                    <span className="font-extrabold text-[#035C6C]">− {inr(payment.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#E5F3F5] pt-1.5 text-[12px]">
                    <span className="font-bold text-[#111111]">Balance Amount</span>
                    <span className={cx('font-extrabold', payment.balance > 0 ? 'text-[#B45309]' : 'text-[#035C6C]')}>{inr(payment.balance)}</span>
                  </div>
                </>
              ) : null}
            </div>

            {/* ---- Warranty ---- */}
            <SectionHeader icon={ShieldCheck} label="WARRANTY" />
            <div className="px-3.5">
              {warranties.length ? (
                <div className="divide-y divide-[#E5F3F5]">
                  {warranties.map((w, i) => {
                    const end = deliveredAt ? warrantyEnd(deliveredAt, w.warranty) : null;
                    return (
                      <div key={`${w.label}-${i}`} className="flex items-center gap-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-[#111111]">{w.label}</p>
                          <p className="text-[11.5px] text-[#6B7280]">{deliveredAt && end ? `Valid ${fmtShortDate(deliveredAt)} – ${fmtShortDate(end)}` : 'Starts on delivery'}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#E5F3F5] px-2 py-0.5 text-[11px] font-extrabold text-[#035C6C]">{w.warranty}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-[#6B7280]">No warranty recorded for these services.</p>
              )}
            </div>

            {/* ---- Re-estimated (status QUOTED) ---- */}
            {statusKey === 'QUOTED' ? (
              <>
                <SectionHeader icon={Calculator} label="RE-ESTIMATED" />
                <div className="px-3.5">
                  <DetailRow icon={IndianRupee} label="Revised" value={inr(total)} />
                  <DetailRow icon={Wrench} label="Services" value={items.map((i) => i.label).join(', ') || '—'} />
                  {ticket?.originalEstimatedDeliveryAt ? <DetailRow icon={Calendar} label="Original" value={fmtInstant(ticket.originalEstimatedDeliveryAt)} /> : null}
                  <DetailRow icon={CalendarClock} label="New Delivery" value={fmtInstant(deliveryAt) || 'Not set'} />
                  <DetailRow icon={CheckCircle2} label="Approval" value={<Pill ok={approved} />} />
                </div>
              </>
            ) : null}

            {/* ---- Invoice (invoiced, or ready to bill) ---- */}
            {ticketId && (hasInvoice || statusKey === 'READY') ? (
              <>
                <SectionHeader icon={FileText} label="INVOICE" />
                <div className="px-3.5">
                  {hasInvoice ? (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#357D89] text-white">
                          <FileText className="h-[18px] w-[18px]" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-extrabold text-[#111111]">Invoice {ticket.invoiceNo || ''}</p>
                          {ticket.invoiceGeneratedAt ? <p className="text-[11.5px] text-[#6B7280]">Generated {fmtShortDate(ticket.invoiceGeneratedAt)}</p> : null}
                        </div>
                        {ticket.finalPrice != null ? <span className="shrink-0 text-[15px] font-extrabold text-[#035C6C]">{inr(ticket.finalPrice)}</span> : null}
                      </div>
                      <Link
                        href={`/shop-home/services/invoice/report/?ticketId=${encodeURIComponent(ticketId)}`}
                        className="mt-2.5 flex h-[42px] items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#035C6C] text-[13px] font-extrabold text-[#035C6C] transition hover:bg-[#E5F3F5]"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        View Invoice
                      </Link>
                    </>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#9CA3AF] text-[#9CA3AF]">
                        <FileText className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-extrabold text-[#111111]">No invoice yet</p>
                        <p className="text-[11.5px] text-[#6B7280]">Ready for delivery — generate the bill</p>
                      </div>
                      <Link
                        href={`/shop-home/services/invoice/generate/?ticketId=${encodeURIComponent(ticketId)}`}
                        className="shrink-0 rounded-full bg-[#035C6C] px-3.5 py-1.5 text-[12px] font-extrabold text-white transition hover:bg-[#024A57]"
                      >
                        Generate
                      </Link>
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {/* ---- Technician ---- */}
            <SectionHeader icon={Users} label="TECHNICIAN" />
            <div className="flex items-center gap-3 px-3.5">
              {techName ? (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#035C6C] text-[14px] font-extrabold text-white">{initials || 'T'}</span>
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#9CA3AF] text-[#9CA3AF]">
                  <UserPlus className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-extrabold text-[#111111]">{techName || 'Not assigned'}</p>
                {techName ? (
                  <span
                    className={cx(
                      'mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
                      techAccepted ? 'bg-[#EDF4E7] text-[#476B26]' : 'bg-[#FFF4DB] text-[#B45309]',
                    )}
                  >
                    {techAccepted ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <AlertCircle className="h-3 w-3" aria-hidden="true" />}
                    {techAccepted ? 'Accepted' : 'Waiting for acceptance'}
                  </span>
                ) : (
                  <p className="text-[11.5px] text-[#6B7280]">{delivered ? 'Delivered without a technician' : 'Assign a technician to start the repair'}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAssigning(true)}
                disabled={!ticketId || techLocked}
                title={!ticketId ? noTicket : delivered ? 'This booking is delivered' : techAccepted ? 'The technician has already accepted this job' : techName ? 'Change technician' : 'Assign a technician'}
                className={cx(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50',
                  techName ? 'border-[1.5px] border-[#035C6C] bg-white text-[#035C6C] hover:bg-[#E5F3F5]' : 'bg-[#035C6C] text-white hover:bg-[#024A57]',
                )}
              >
                {techName ? <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> : <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
                {techName ? 'Change' : 'Assign'}
              </button>
            </div>
          </section>
          </div>
          </div>
        )}
      </div>

      {/* ---- Bottom action bar (red handle toggles it, as in the app) ---- */}
      {booking ? (
        <div className="sticky bottom-0 z-20 mx-auto max-w-[760px] lg:hidden">
          <div className="rounded-t-[20px] bg-white px-3 pb-3 shadow-[0_-4px_16px_rgba(17,17,17,0.08)]">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setBarOpen((v) => !v)}
                aria-expanded={barOpen}
                aria-label={barOpen ? 'Hide actions' : 'Show actions'}
                className="-mt-3 flex h-6 w-[58px] items-center justify-center rounded-xl bg-[#F32C26] text-white"
              >
                {barOpen ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            {barOpen ? (
              <div className="mt-2 grid grid-cols-4 gap-y-1 min-[480px]:grid-cols-7">
                {tiles.map((t, i) => (
                  <ActionTile key={t.key} {...t} color={TILE_TONES[i % TILE_TONES.length]} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ImagePreviewModal open={Boolean(photo)} src={photo} title={deviceName} subtitle="Device photo" onClose={closePhoto} />
      <AssignTechnicianModal
        open={assigning}
        ticketId={ticketId}
        currentTechnicianId={ticket?.assignedTechnicianId}
        bookingLabel={label}
        onClose={() => setAssigning(false)}
        onAssigned={(t) => {
          if (t?.id) setTicket((prev) => ({ ...(prev || {}), ...t }));
        }}
      />
      <RescheduleModal
        open={rescheduling}
        ticketId={ticketId}
        bookingLabel={label}
        bookedAt={booking?.createdAt}
        durationHours={booking?.estimatedDurationHours}
        onClose={() => setRescheduling(false)}
        onSaved={(t) => {
          if (t?.id) setTicket((prev) => ({ ...(prev || {}), ...t }));
        }}
      />
      {/* Keyed per ticket so the sheet never shows another booking's steps. */}
      <ServiceStatusSheet
        key={ticketId || 'closed'}
        open={statusOpen && Boolean(ticketId)}
        ticketId={ticketId}
        bookingRef={ref}
        lifecycleStatus={ticket?.status}
        statusLabel={statusLabel}
        onClose={() => setStatusOpen(false)}
        onUpdated={reload}
      />
    </div>
  );
}
