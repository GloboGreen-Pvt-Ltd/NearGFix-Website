'use client';

/**
 * OrdersList — the shared pieces behind the Bookings and Pickups pages (both
 * opened from the dashboard's Business Overview cards):
 *
 *   useOrderRows()   bookings + tickets + master data -> joined rows
 *                    (lib/orderStages.js), plus assign-merge + reload
 *   OrdersShell      page background + 1400px container
 *   OrdersHeader     back · EYEBROW / title · refresh · Filters
 *   OrdersSearch     Tracking ID / customer / mobile search field
 *   StageTabs        selectable stage pills with live counts
 *   OrdersEmpty      centered pale-green empty state
 *   OrderCard        one booking/pickup: device, customer, status, actions;
 *                    the device photo opens ImagePreviewModal, and when the
 *                    page passes onOpenStatus a tap on the card body (or its
 *                    status block) opens Update Service Status
 *
 * The pages only choose which rows to show, which tab is selected and what
 * the header says.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Calculator,
  ChevronDown,
  ClipboardList,
  FileText,
  History,
  MapPin,
  QrCode,
  Receipt,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Undo2,
  UserCog,
  X,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import ImagePreviewModal from '@/components/shop-dashboard/ImagePreviewModal';
import { fetchShopBookings, fetchTicketsPaged, recordTicketStatus } from '@/lib/shopDashboard';
import { notifyError, notifySuccess } from '@/lib/toast';
import { bookingEstimatedAmount, formatPickupAddress, formatSlotTime } from '@/lib/bookingFormat';
import { enrichWithCatalog, getDeviceImage, loadVariantOptions, resolveMediaUrl } from '@/lib/deviceImage';

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

export function useOrderRows() {
  const [bookings, setBookings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([fetchShopBookings(), fetchTicketsPaged().catch(() => []), loadVariantOptions()])
      .then(async ([list, ticketList, opts]) => {
        const enriched = await enrichWithCatalog(list);
        if (!alive) return;
        setBookings(enriched);
        setTickets(ticketList);
        setOptions(opts);
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Could not load bookings.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Merge a PATCHed ticket back in so cards reflect a new technician at once.
  function mergeTicket(ticket) {
    if (!ticket?.id) return;
    setTickets((prev) =>
      prev.some((t) => String(t.id) === String(ticket.id))
        ? prev.map((t) => (String(t.id) === String(ticket.id) ? { ...t, ...ticket } : t))
        : [...prev, ticket],
    );
  }

  return { bookings, tickets, options, loading, error, reload: () => setReloadKey((k) => k + 1), mergeTicket };
}

/** Tracking ID / customer / mobile / device match — real search over loaded rows. */
export function matchesQuery(row, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return [row.bookingNumber, row.customerName, row.customerMobile, row.deviceDisplayName || row.modelName, row.brandName].some((v) =>
    String(v || '').toLowerCase().includes(q),
  );
}

export const withHash = (ref) => {
  const s = String(ref ?? '').trim().replace(/^#+/, '');
  return s ? `#${s}` : '';
};

/* -------------------------------------------------------------------------- */
/* Page chrome                                                                 */
/* -------------------------------------------------------------------------- */

export function OrdersShell({ children }) {
  return (
    <div className="-m-4 min-h-full bg-white p-4 sm:-m-6 sm:p-6">
      <div className="mx-auto max-w-[1400px] space-y-4">{children}</div>
    </div>
  );
}

export function OrdersHeader({ eyebrow, title, loading, onRefresh, filtersOpen, filtersActive, onToggleFilters }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Back"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#111111] transition hover:border-[#035C6C] hover:text-[#035C6C]"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#035C6C]">{eyebrow}</p>
        <h1 className="truncate text-[24px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[28px]">{title}</h1>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        aria-label="Refresh"
        title="Refresh"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[#ECECEC] bg-[#F8F8F8] text-[#035C6C] transition hover:border-[#035C6C]"
      >
        <RefreshCw className={cx('h-[18px] w-[18px]', loading && 'animate-spin')} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onToggleFilters}
        aria-expanded={filtersOpen}
        className={cx(
          'inline-flex h-11 shrink-0 items-center gap-2 rounded-[14px] border px-4 text-[14px] font-bold transition',
          filtersOpen || filtersActive ? 'border-[#035C6C] bg-[#F3F3F3] text-[#024A57]' : 'border-[#ECECEC] bg-white text-[#111111] hover:border-[#035C6C]',
        )}
      >
        <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
        <span className="hidden sm:inline">Filters</span>
        {filtersActive ? <span className="h-2 w-2 rounded-full bg-[#035C6C]" aria-hidden="true" /> : null}
      </button>
    </div>
  );
}

export function OrdersSearch({ value, onChange }) {
  return (
    <label className="flex h-14 items-center gap-3 rounded-[16px] border border-[#ECECEC] bg-[#F8F8F8] px-4 transition focus-within:border-[#035C6C] focus-within:ring-4 focus-within:ring-[#035C6C]/10">
      <Search className="h-5 w-5 shrink-0 text-[#98A2B3]" aria-hidden="true" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by Tracking ID, Customer name, Mobile..."
        aria-label="Search by tracking ID, customer name or mobile"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-[#111111] outline-none placeholder:text-[#98A2B3]"
      />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="-mr-2 shrink-0 rounded-full p-2 text-[#98A2B3] hover:text-[#344054]">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}

/** Two columns on phones (like the app), one wrapping row from sm up. */
export function StageTabs({ tabs, value, onChange, counts, loading, ariaLabel }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
      {tabs.map(({ key, label, icon: Icon }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(key)}
            className={cx(
              'inline-flex min-w-0 items-center gap-2 rounded-full border-[1.5px] px-4 py-2.5 text-[13.5px] font-bold transition',
              selected ? 'border-[#035C6C] bg-[#F3F3F3] text-[#024A57]' : 'border-[#ECECEC] bg-white text-[#344054] hover:border-[#ECECEC]',
            )}
          >
            {Icon ? <Icon className={cx('h-4 w-4 shrink-0', selected ? 'text-[#035C6C]' : 'text-[#98A2B3]')} aria-hidden="true" /> : null}
            <span className="truncate">{label}</span>
            <span className={cx('ml-auto shrink-0 rounded-full px-1.5 text-[12px] sm:ml-0', selected ? 'bg-[#035C6C] text-white' : 'bg-[#F3F3F3] text-[#475467]')}>
              {loading ? '…' : counts[key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function OrdersEmpty({ icon: Icon = ClipboardList, title, text, action }) {
  return (
    <div className="flex flex-col items-center rounded-[20px] border border-[#ECECEC] bg-[#F8F8F8] px-4 py-16 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F3F3F3] text-[#035C6C]">
        <Icon className="h-9 w-9" aria-hidden="true" />
      </span>
      <p className="mt-4 text-[17px] font-extrabold text-[#111111]">{title}</p>
      <p className="mt-1 max-w-md text-[13.5px] text-[#666666]">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function OrdersSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[190px] animate-pulse rounded-[18px] border border-[#ECECEC] bg-[#F8F8F8]" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

// Badge colour per stage / friendlyBookingStatus bucket; the badge TEXT is the
// real raw status (ticket status once a ticket exists, else the booking's).
const STAGE_BADGE = {
  ready: 'bg-[#FEF0C7] text-[#B54708]',
  invoice: 'bg-[#F4EBFF] text-[#6941C6]',
  delivered: 'bg-[#F3F3F3] text-[#024A57]',
  returned: 'bg-[#FFE4E8] text-[#C01048]',
};
const BUCKET_BADGE = {
  Created: 'bg-[#F3F3F3] text-[#024A57]',
  'In Progress': 'bg-[#E0F0FF] text-[#175CD3]',
  Pickup: 'bg-[#FEF0C7] text-[#B54708]',
  Completed: 'bg-[#F4EBFF] text-[#6941C6]',
  Cancelled: 'bg-[#FFE4E8] text-[#C01048]',
};

const humanize = (s) =>
  String(s || '')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** The card's badge text ("In Repair"; the badge itself renders it uppercase) — also the status sheet's label. */
export function orderBadgeText(row) {
  if (row?.stage === 'returned') return 'Returned';
  return humanize(row?.ticketStatus || row?.status) || row?.statusLabel || '';
}

function formatDay(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}
function formatTime(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
}

/**
 * Fixed device-photo box (the image is contained, never sized by the file).
 * `sizeClass` replaces the default box size + padding; `onPreview` makes the
 * box a button, but only while there is an image that actually loaded.
 */
export function DeviceThumb({ url, sizeClass = 'h-[88px] w-[72px] p-2 sm:h-[96px] sm:w-[84px]', onPreview }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  const hasImage = Boolean(url) && !broken;
  const boxCls = cx('flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F8F8F8]', sizeClass);
  const content = hasImage ? (
    // eslint-disable-next-line @next/next/no-img-element -- device photos are arbitrary catalog URLs, not app assets Next can optimize.
    <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-contain object-center" />
  ) : (
    <Smartphone className="h-8 w-8 text-[#035C6C]/50" aria-hidden="true" />
  );
  if (hasImage && onPreview) {
    return (
      <button
        type="button"
        onClick={onPreview}
        aria-label="Preview device image"
        title="Preview device image"
        className={cx(boxCls, 'cursor-zoom-in transition hover:ring-2 hover:ring-[#035C6C]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C]')}
      >
        {content}
      </button>
    );
  }
  return <span className={boxCls}>{content}</span>;
}

function ActionButton({ icon: Icon, label, href, onClick, disabled, title }) {
  const className = cx(
    'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-bold transition sm:flex-none',
    disabled
      ? 'cursor-not-allowed border-[#ECECEC] bg-[#F8F8F8] text-[#98A2B3]'
      : 'border-[#ECECEC] bg-white text-[#111111] hover:border-[#035C6C] hover:bg-[#F8F8F8] hover:text-[#035C6C]',
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={className} title={title}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} aria-disabled={disabled} title={title} className={className}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function DetailRow({ label, children }) {
  return (
    <p className="flex min-w-0 items-start gap-3">
      <span className="w-[72px] shrink-0 text-[12.5px] font-semibold text-[#98A2B3]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-[#111111]">{children}</span>
    </p>
  );
}

// With onOpen it's a button (badge gets a chevron) that opens Update Service Status.
function StatusBlock({ badgeText, badgeCls, createdAt, amount, className, onOpen, openLabel }) {
  const cls = cx('shrink-0 flex-col items-end gap-1 text-right', className);
  const body = (
    <>
      <span
        className={cx(
          'max-w-[120px] items-center gap-1 rounded-full px-2.5 py-1 text-[11px] sm:max-w-[180px] font-extrabold uppercase tracking-wide',
          onOpen ? 'inline-flex' : 'truncate',
          badgeCls,
        )}
        title={badgeText}
      >
        {onOpen ? (
          <>
            <span className="truncate">{badgeText}</span>
            <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
          </>
        ) : (
          badgeText
        )}
      </span>
      <span className="text-[13px] font-semibold text-[#344054]">{formatDay(createdAt)}</span>
      <span className="text-[12px] text-[#666666]">{formatTime(createdAt)}</span>
      {amount != null ? <span className="text-[14px] font-extrabold text-[#111111]">₹{Number(amount).toLocaleString('en-IN')}</span> : null}
    </>
  );
  if (!onOpen) return <div className={cls}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={openLabel}
      title="Update service status"
      className={cx(cls, '-m-1.5 rounded-xl p-1.5 transition hover:bg-[#F3F3F3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#035C6C]/15')}
    >
      {body}
    </button>
  );
}

/**
 * `onOpenStatus` (optional) makes the card body and status block open Update
 * Service Status — only for rows with a repair ticket, since the sheet works
 * on one.
 */
export function OrderCard({ row, variant, onAssign, onOpenStatus, onReturned, onReschedule, invoiceView = false, showReEstimate = true }) {
  const [previewing, setPreviewing] = useState(false);
  const closePreview = useCallback(() => setPreviewing(false), []);
  const id = encodeURIComponent(row.id);
  const ref = withHash(row.bookingNumber || row.id);
  const services = Array.isArray(row.services) ? row.services : [];
  const model = row.deviceDisplayName || row.modelName || '';
  const brand = row.brandName || '';
  const deviceName = model ? (brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${model}` : model) : 'Device not specified';
  const servicesText = services.length ? services.map((s) => s.serviceName || s.serviceCode).filter(Boolean).join(', ') : row.issueSummary || '';
  const amount = row.finalAmount ?? row.estimateAmount ?? bookingEstimatedAmount(row);
  const badgeText = orderBadgeText(row);
  const badgeCls = STAGE_BADGE[row.stage] || BUCKET_BADGE[row.statusLabel] || 'bg-[#F3F3F3] text-[#475467]';
  const image = resolveMediaUrl(row.deviceImageUrl) || resolveMediaUrl(row.frontImageUrl) || getDeviceImage(row);
  const slot = row.pickupSlotStart ? [formatSlotTime(row.pickupSlotStart), formatSlotTime(row.pickupSlotEnd)].filter(Boolean).join(' – ') : '';
  const address = row.isPickup && (row.pickupAddress || row.pickupAddressText) ? formatPickupAddress(row) : '';
  const openStatus = onOpenStatus && row.ticketRef ? onOpenStatus : undefined;
  const statusProps = { badgeText, badgeCls, createdAt: row.createdAt, amount, onOpen: openStatus, openLabel: `Update service status for ${ref}` };

  // Return = hand the device back unrepaired. The ticket service has no
  // "returned" status, so this records CANCELLED (the status sheet's own
  // "Repair Cancelled" step). Not offered once delivered or already cancelled.
  const [returning, setReturning] = useState(false);
  const ticketState = String(row.ticketStatus || '').toUpperCase();
  const returnClosed = ticketState === 'DELIVERED' || ticketState === 'CANCELLED';
  async function onReturn() {
    if (!row.ticketRef || returnClosed || returning) return;
    if (!window.confirm(`Return ${deviceName} (${ref}) to the customer without repair? The repair will be marked as cancelled.`)) return;
    setReturning(true);
    try {
      await recordTicketStatus(row.ticketRef, 'CANCELLED');
      notifySuccess('Device marked as returned');
      onReturned?.(row.ticketRef);
    } catch (err) {
      notifyError(err, 'Could not mark the device as returned.');
    } finally {
      setReturning(false);
    }
  }

  // As in the app, a tap anywhere on the card body opens the status sheet. The
  // body's own links/buttons (photo, phone, status block) and text selections
  // are left alone; the status block stays the keyboard-reachable way in.
  function onBodyClick(e) {
    const hit = e.target.closest('a, button');
    if (hit && e.currentTarget.contains(hit)) return;
    if (window.getSelection?.()?.toString()) return;
    openStatus();
  }

  return (
    <article className="overflow-hidden rounded-[18px] border border-[#ECECEC] bg-[#F8F8F8] transition">
      <div
        onClick={openStatus ? onBodyClick : undefined}
        className={cx(
          'grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] lg:items-center',
          openStatus && 'cursor-pointer transition-colors hover:bg-[#F3F3F3]',
        )}
      >
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <DeviceThumb url={image} sizeClass="h-16 w-16 p-1.5 sm:h-[70px] sm:w-[70px]" onPreview={() => setPreviewing(true)} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold tracking-wide text-[#035C6C]">{ref}</p>
            <p className="mt-0.5 truncate text-[16px] font-extrabold text-[#111111]" title={deviceName}>
              {deviceName}
            </p>
            {variant ? <p className="truncate text-[13px] text-[#475467]">{variant}</p> : null}
            {row.color ? (
              <p className="truncate text-[13px] text-[#666666]">
                Color: <span className="font-semibold text-[#344054]">{row.color}</span>
              </p>
            ) : null}
          </div>
          <StatusBlock className="flex lg:hidden" {...statusProps} />
        </div>

        <div className="min-w-0 space-y-1.5 rounded-2xl bg-[#F8F8F8] p-3.5 lg:bg-transparent lg:p-0">
          <DetailRow label="Customer">{row.customerName || 'Not available'}</DetailRow>
          <DetailRow label="Mobile">
            {row.customerMobile ? (
              <a href={`tel:${row.customerMobile}`} className="text-[#035C6C] hover:underline">
                {row.customerMobile}
              </a>
            ) : (
              <span className="text-[#98A2B3]">Not available</span>
            )}
          </DetailRow>
          <DetailRow label="Services">{servicesText || <span className="text-[#98A2B3]">Not listed</span>}</DetailRow>
          <DetailRow label="Technician">{row.assignedTechnicianName || <span className="font-semibold text-[#98A2B3]">Not assigned</span>}</DetailRow>
        </div>

        <StatusBlock className="hidden lg:flex" {...statusProps} />
      </div>

      {row.isPickup && (row.pickupDate || address) ? (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-dashed border-[#ECECEC] px-4 py-2.5 text-[12.5px] text-[#475467] sm:px-5">
          {row.pickupDate ? (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-[#035C6C]" aria-hidden="true" />
              Pickup {formatDay(row.pickupDate)}
              {slot ? ` · ${slot}` : ''}
            </span>
          ) : null}
          {address ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#035C6C]" aria-hidden="true" />
              <span className="truncate">{address}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-[#ECECEC] bg-[#F8F8F8] px-4 py-3 sm:px-5">
        {invoiceView ? null : (
          <ActionButton
            icon={UserCog}
            label={row.assignedTechnicianName ? 'Reassign' : 'Assign'}
            onClick={onAssign}
            disabled={!row.ticketRef}
            title={
              row.ticketRef
                ? 'Assign a technician to this repair'
                : 'This booking has no repair ticket yet — a technician can be assigned once the device is received and its ticket is created'
            }
          />
        )}
        <ActionButton icon={History} label="History" href={`/shop-home/services/bookings/view/?id=${id}`} />
        {/* Invoices page: History · Invoice · Details. */}
        {invoiceView ? null : <ActionButton icon={Receipt} label="Receipt" href={`/shop-home/services/bookings/view/receipt/?id=${id}`} />}
        {invoiceView ? null : <ActionButton icon={QrCode} label="Barcode" href={`/shop-home/services/bookings/view/qr/?id=${id}`} />}
        {invoiceView && row.ticketRef ? (
          <ActionButton icon={ReceiptText} label="Invoice" href={`/shop-home/services/invoice/report/?ticketId=${encodeURIComponent(row.ticketRef)}`} />
        ) : null}
        <ActionButton icon={FileText} label="Details" href={`/shop-home/services/bookings/view/details/?id=${id}`} />
        {onReschedule ? (
          <ActionButton
            icon={CalendarClock}
            label="Re-Schedule"
            onClick={onReschedule}
            disabled={!row.ticketRef}
            title={row.ticketRef ? 'Change the ready and delivery date & time' : 'This booking has no repair ticket yet'}
          />
        ) : null}
        {showReEstimate ? <ActionButton icon={Calculator} label="Re-Est" href="/shop-home/services/bookings/" /> : null}
        {onReturned ? (
          <ActionButton
            icon={Undo2}
            label={returning ? 'Returning…' : 'Return'}
            onClick={onReturn}
            disabled={!row.ticketRef || returnClosed || returning}
            title={
              !row.ticketRef
                ? 'This booking has no repair ticket yet'
                : returnClosed
                  ? 'This repair is already delivered or cancelled'
                  : 'Return the device to the customer without repair'
            }
          />
        ) : null}
      </div>

      <ImagePreviewModal
        open={previewing}
        src={image}
        title={model ? deviceName : brand || 'Device'}
        subtitle={[variant, row.color].filter(Boolean).join(' • ')}
        onClose={closePreview}
      />
    </article>
  );
}
