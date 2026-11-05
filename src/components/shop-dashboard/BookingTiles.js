'use client';

/**
 * BookingTiles — the Bookings / Invoice / Pickups list chrome and cards, built
 * like the Partner app's Jobs screen (GGFIX-Partner-App
 * src/screens/owner/AllBooking/JobsScreen.js) — same sizes and colours:
 *
 *   BookingsShell     white page: header bar, optional search, then the
 *                     left rail beside the list
 *   BookingsHeader    back · EYEBROW / count title centred on the bar ·
 *                     search toggle · refresh (· Filters, Pickups only)
 *   BookingsSearch    the app's SearchBar, shown only while Search is open
 *                     (or a query is set); closing it clears the query
 *   StageRail         the app's left scope menu: rail width, tile, colour
 *                     disc, count badge and selected style per window width
 *                     (JobsScreen railW + ReportRail railSizes)
 *   BookingTilesGrid  one centred column (max 720px) of row cards below md;
 *                     a grid of ~264–360px tiles (square photo on top) from md
 *   BookingTile       status tag on the photo, tracking ID + amount chip,
 *                     device, customer, date · time, then VIEW + round icons
 *   PickupTile        the app's pickup card: truck panel, status tag, VIEW,
 *                     ref · pickup person, services, customer, address,
 *                     date · time, call · copy; a tap opens PickupActionSheet
 *
 * Used by BookingsBoard and the Pickups page. The Re-Quote / Service Report
 * pages keep OrdersList.js's OrderCard and chrome, which this file doesn't change.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from '@/components/PortalLink';
import { useRouter } from '@/lib/portalNavigation';
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Copy,
  FileText,
  History,
  Loader2,
  Pencil,
  Phone,
  QrCode,
  Receipt,
  ReceiptText,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Truck,
  UserCog,
  X,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import ImagePreviewModal from '@/components/shop-dashboard/ImagePreviewModal';
import { orderBadgeText, withHash } from '@/components/shop-dashboard/OrdersList';
import { bookingEstimatedAmount, formatPickupAddress, formatSlotTime } from '@/lib/bookingFormat';
import { notifyError, notifySuccess } from '@/lib/toast';
import { bookingRef } from '@/lib/orderStages';
import { getDeviceImage, resolveMediaUrl } from '@/lib/deviceImage';

/* -------------------------------------------------------------------------- */
/* Status tag                                                                  */
/* -------------------------------------------------------------------------- */

// The app's badge text colours (JobsScreen TONE_STYLE.fg); its blue / purple /
// green tones all render Partner teal, so they collapse into one here.
const TONE = { amber: '#B45309', teal: '#035C6C', red: '#B91C1C' };

// Ticket status -> app label + tone (JobsScreen STATUS_VARIANT).
const TICKET_TAG = {
  CREATED: ['Service Accepted', 'amber'],
  ASSIGNED: ['Technician Assigned', 'teal'],
  IN_DIAGNOSIS: ['In Diagnosis', 'teal'],
  IN_REPAIR: ['In Service Process', 'teal'],
  QUOTED: ['Re-Estimated', 'amber'],
  APPROVED: ['Customer Approved', 'teal'],
  READY: ['Ready for Delivery', 'teal'],
  INVOICE_GENERATED: ['Invoice Generated', 'amber'],
  INVOICE_READY: ['Invoice Ready', 'amber'],
  DELIVERED_PROCESSING: ['Dispatched', 'amber'],
  DELIVERED: ['Delivered', 'teal'],
  CANCELLED: ['Cancelled', 'red'],
  RETURNED: ['Returned', 'red'],
};

// Booking (order-service) status, for bookings without a ticket yet
// (JobsScreen PICKUP_STATUS_VARIANT).
const BOOKING_TAG = {
  ORDER_PLACED: ['New Request', 'amber'],
  PICKUP_REQUESTED: ['Pickup Requested', 'amber'],
  PICKUP_ACCEPTED: ['Pickup Accepted', 'teal'],
  ORDER_SERVICE_CONFIRMED: ['Confirmed', 'teal'],
  PICKUP_PERSON_ASSIGNED: ['Pickup Assigned', 'teal'],
  PICKUP_ASSIGNED: ['Pickup Assigned', 'teal'],
  PICKUP_ON_THE_WAY: ['On The Way', 'teal'],
  REACHED_CUSTOMER_LOCATION: ['At Customer', 'teal'],
  REPAIR_ESTIMATE_PROCESSING: ['Estimate Submitted', 'amber'],
  DEVICE_PICKED_UP: ['Device Picked Up', 'teal'],
  PICKED_UP: ['Device Picked Up', 'teal'],
  REACHED_SHOP: ['Reached Shop', 'teal'],
  ACCEPTED: ['Accepted', 'teal'],
  IN_TRANSIT: ['In Transit', 'teal'],
  COMPLETED: ['Completed', 'teal'],
  CANCELLED: ['Cancelled', 'red'],
};

// Anything unmapped: the raw status text, toned by its friendlyBookingStatus bucket.
const BUCKET_TONE = { Created: 'amber', Pickup: 'amber', 'In Progress': 'teal', Completed: 'teal', Cancelled: 'red' };

function statusTag(row) {
  // 'returned' = ticket CANCELLED (what the web's Return records).
  if (row.stage === 'returned') return { label: 'Returned', color: TONE.red };
  const t = String(row.ticketStatus || '').toUpperCase();
  const meta = t ? TICKET_TAG[t] : BOOKING_TAG[String(row.status || '').toUpperCase()];
  if (meta) return { label: meta[0], color: TONE[meta[1]] };
  return { label: orderBadgeText(row) || 'Pending', color: TONE[BUCKET_TONE[row.statusLabel]] || TONE.amber };
}

// App card dates: "03 Nov 2026" · "09:05 AM".
function formatDate(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}
function formatTime(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
}

/* -------------------------------------------------------------------------- */
/* Page chrome                                                                 */
/* -------------------------------------------------------------------------- */

/** Full-bleed white page under the dashboard navbar, as the app screen. */
export function BookingsShell({ header, search, rail, children }) {
  return (
    <div className="-mx-4 -my-5 flex min-h-[calc(100vh-4rem)] flex-col bg-white sm:-mx-6 sm:-my-6">
      <div className="border-b border-[#E5E7EB] bg-white px-3.5 pb-3 pt-2">{header}</div>
      {search ? <div className="mt-2.5 px-4">{search}</div> : null}
      {/* Left: stage rail · right: the bookings list. */}
      <div className="flex flex-1">
        {rail}
        <div className="min-w-0 flex-1 px-2.5 pb-4 pt-2.5">{children}</div>
      </div>
    </div>
  );
}

function HeaderButton({ label, active, onClick, className, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:opacity-80',
        active ? 'bg-[#035C6C] text-white' : 'bg-[#E5F3F5] text-[#035C6C] hover:bg-[#C7E6EA]',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** The app header: back left, title block centred on the bar (not between the buttons), buttons right. */
export function BookingsHeader({ eyebrow, title, loading, onRefresh, searchOpen, onToggleSearch, filtersOpen, filtersActive, onToggleFilters }) {
  const router = useRouter();
  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Back"
        className="mr-2.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[#111111] transition hover:bg-[#E5E7EB] active:opacity-70"
      >
        <ArrowLeft className="h-[19px] w-[19px]" aria-hidden="true" />
      </button>
      <div className="pointer-events-none absolute inset-x-0 -inset-y-1 flex flex-col items-center justify-center px-24">
        <p className="w-full truncate text-center text-[11px] font-bold uppercase tracking-widest text-[#6B7280]">{eyebrow}</p>
        <h1 className="mt-0.5 w-full truncate text-center text-[17px] font-extrabold text-[#111111]">{title}</h1>
      </div>
      <div className="flex-1" />
      <HeaderButton label={searchOpen ? 'Close search' : 'Search bookings'} active={searchOpen} onClick={onToggleSearch}>
        <Search className="h-4 w-4" aria-hidden="true" />
      </HeaderButton>
      <HeaderButton label="Refresh" onClick={onRefresh} className="ml-2">
        <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
      </HeaderButton>
      {/* Pickups only: its status + pickup-date filters (the Bookings page has none). */}
      {onToggleFilters ? (
        <HeaderButton label="Filters" active={filtersOpen} onClick={onToggleFilters} className="relative ml-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {filtersActive ? <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#FAA700]" aria-hidden="true" /> : null}
        </HeaderButton>
      ) : null}
    </div>
  );
}

/** The app's SearchBar (48px, 52px from md; 18px radius; soft shadow). Focuses itself when it opens. */
export function BookingsSearch({ value, onChange }) {
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <label className="flex h-12 items-center rounded-[18px] border border-[#E5E7EB] bg-white px-4 shadow-[0_2px_6px_rgba(17,17,17,0.06)] transition focus-within:border-[#035C6C] md:h-[52px]">
      <Search className="h-[18px] w-[18px] shrink-0 text-[#6B7280] min-[430px]:h-[19px] min-[430px]:w-[19px] md:h-5 md:w-5" aria-hidden="true" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by Tracking ID, Customer name, Mobile…"
        aria-label="Search by tracking ID, customer name or mobile"
        className="ml-2.5 min-w-0 flex-1 bg-transparent text-[15px] text-[#111111] outline-none placeholder:text-[#6B7280] min-[430px]:text-[16px]"
      />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280] hover:text-[#111111]">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}

// Window width, like the app's useWindowDimensions (the rail sizes by it).
function useWindowWidth() {
  const [width, setWidth] = useState(1024);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

// JobsScreen's railW + ReportRail's railSizes, same breakpoints and numbers.
function railGeometry(winW) {
  const width = winW >= 680 ? 104 : winW < 360 ? 70 : 78;
  if (winW < 360) return { width, font: 9.5, line: 12, disc: 30, icon: 14, badge: 9 };
  if (winW < 400) return { width, font: 10.5, line: 13, disc: 34, icon: 16, badge: 9 };
  if (winW < 600) return { width, font: 11, line: 14, disc: 34, icon: 16, badge: 9.5 };
  if (winW < 900) return { width, font: 12, line: 15, disc: 38, icon: 17, badge: 10 };
  return { width, font: 13, line: 16, disc: 40, icon: 18, badge: 10.5 };
}

/**
 * The app's left scope menu — on every width, phones included. `items`:
 * { key, label, icon, tone, href? }; an item with `href` is a link to another
 * page (never "selected" here). Each tile fades from white to a tint of its
 * tone (~14% selected, ~6% idle) under a soft tone shadow; the selected one
 * gets a 1.5px tone border. The count badge sits on the disc's top-right.
 */
export function StageRail({ items, value, onChange, counts, loading, ariaLabel }) {
  const g = railGeometry(useWindowWidth());
  return (
    <nav aria-label={ariaLabel} className="shrink-0 border-r border-[#E5E7EB] bg-white" style={{ width: g.width }}>
      <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto px-[5px] py-1.5 [scrollbar-width:none]">
        {items.map(({ key, label, icon: Icon, tone, href }) => {
          const active = !href && value === key;
          const count = loading ? '…' : counts[key] ?? 0;
          const cls = 'my-1 flex w-full flex-col items-center rounded-[14px] px-[3px] py-[9px] transition hover:brightness-[0.98] active:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#035C6C]/15';
          const style = {
            backgroundImage: `linear-gradient(#FFFFFF, ${tone}${active ? '24' : '10'})`,
            border: `${active ? 1.5 : 1}px solid ${active ? tone : `${tone}22`}`,
            boxShadow: `0 2px 4px ${tone}${active ? '1F' : '0F'}`,
          };
          const body = (
            <>
              <span className="relative">
                <span className="flex items-center justify-center rounded-full" style={{ width: g.disc, height: g.disc, backgroundColor: tone }}>
                  {Icon ? <Icon size={g.icon} color="#FFFFFF" strokeWidth={2.2} aria-hidden="true" /> : null}
                </span>
                <span
                  className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border bg-white px-[3px] font-extrabold leading-none"
                  style={{ borderColor: tone, color: tone, fontSize: g.badge }}
                  aria-hidden="true"
                >
                  {count}
                </span>
              </span>
              <span
                className={cx('mt-[5px] line-clamp-2 text-center', active ? 'font-extrabold' : 'font-bold')}
                style={{ color: tone, fontSize: g.font, lineHeight: `${g.line}px` }}
                aria-hidden="true"
              >
                {label}
              </span>
            </>
          );
          return href ? (
            <Link key={key} href={href} aria-label={`${label}, ${count}`} title={label} className={cls} style={style}>
              {body}
            </Link>
          ) : (
            <button key={key} type="button" onClick={() => onChange(key)} aria-pressed={active} aria-label={`${label}, ${count}`} title={label} className={cls} style={style}>
              {body}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Below md: one centred column (app: max 720px). md+: tiles of ~264–360px, as many as fit. */
export function BookingTilesGrid({ children }) {
  return <div className="mx-auto grid w-full max-w-[720px] grid-cols-1 gap-3 md:max-w-none md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">{children}</div>;
}

/** The app's first-load Loader. */
export function BookingsLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="h-7 w-7 animate-spin text-[#035C6C]" aria-hidden="true" />
      <p className="mt-2.5 text-[13px] font-semibold text-[#6B7280]">Loading bookings...</p>
    </div>
  );
}

/** The app's EmptyState: ClipboardList disc, title, description, optional action. */
export function BookingsEmpty({ title, text, action }) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C]">
        <ClipboardList className="h-[26px] w-[26px]" aria-hidden="true" />
      </span>
      <p className="mt-3.5 text-[16px] font-extrabold text-[#111111]">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-[#6B7280]">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

// The app card's icon row: one brand colour per icon at 0.8 opacity ("CC").
// Assign / Re-Schedule / Invoice are web-only actions, in the same palette.
const ICON_TONE = {
  history: '#035C6CCC',
  receipt: '#E08E00CC',
  barcode: '#1C3053CC',
  call: '#609138CC',
  assign: '#0788C9CC',
  reschedule: '#357D89CC',
  reestimate: '#FAA700CC',
  invoice: '#E08E00CC',
};

// 26px discs with a 12px white icon, as the app's.
function IconAction({ icon: Icon, label, tone, href, onClick, disabled, title }) {
  const cls = cx(
    'inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full transition',
    disabled ? 'cursor-not-allowed bg-[#E5E7EB] text-[#9CA3AF]' : 'text-white hover:brightness-110 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C]/40',
  );
  const style = disabled ? undefined : { backgroundColor: tone };
  const icon = <Icon className="h-3.5 w-3.5" aria-hidden="true" />;
  if (href && !disabled) {
    return href.startsWith('tel:') ? (
      <a href={href} aria-label={label} title={title || label} className={cls} style={style}>
        {icon}
      </a>
    ) : (
      <Link href={href} aria-label={label} title={title || label} className={cls} style={style}>
        {icon}
      </Link>
    );
  }
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} aria-label={label} title={title || label} className={cls} style={style}>
      {icon}
    </button>
  );
}

/**
 * One booking, as the app's job tile: below md the row card (116px photo
 * panel left, details right), from md the product tile (square photo on top).
 * Same data and actions as before: `onOpenStatus` makes the card body (and
 * the status tag) open Update Service Status, only for rows with a repair
 * ticket. Variant / colour, mobile and technician sit in tooltips, since the
 * app card doesn't print them.
 */
export function BookingTile({ row, variant, onAssign, onOpenStatus, onReschedule, reEstimateHref, invoiceView = false }) {
  const [previewing, setPreviewing] = useState(false);
  const closePreview = useCallback(() => setPreviewing(false), []);
  const id = encodeURIComponent(row.id);
  const ref = withHash(bookingRef(row));
  const model = row.deviceDisplayName || row.modelName || '';
  const brand = row.brandName || '';
  const deviceName = model ? (brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${model}` : model) : 'Device not specified';
  const specs = [variant, row.color].filter(Boolean).join(' · ');
  const amount = row.finalAmount ?? row.estimateAmount ?? bookingEstimatedAmount(row);
  const tag = statusTag(row);
  const image = resolveMediaUrl(row.deviceImageUrl) || resolveMediaUrl(row.frontImageUrl) || getDeviceImage(row);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [image]);
  const hasImage = Boolean(image) && !broken;
  const mobile = row.customerMobile || '';
  const tech = row.assignedTechnicianName || '';
  const openStatus = onOpenStatus && row.ticketRef ? onOpenStatus : undefined;
  const dateStr = formatDate(row.createdAt);
  const timeStr = formatTime(row.createdAt);

  // A click anywhere on the card body opens the status sheet; the body's own
  // buttons (photo, status tag) and text selections are left alone.
  function onBodyClick(e) {
    const hit = e.target.closest('a, button');
    if (hit && e.currentTarget.contains(hit)) return;
    if (window.getSelection?.()?.toString()) return;
    openStatus();
  }

  const tagCls = 'absolute left-0 top-0 max-w-[78%] truncate rounded-br-xl px-2 py-1 text-[9.5px] font-extrabold leading-tight text-white';

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
      <div
        onClick={openStatus ? onBodyClick : undefined}
        className={cx('flex min-w-0 flex-1 flex-row md:flex-col', openStatus && 'cursor-pointer transition-colors hover:bg-[#F9FAFB]')}
      >
        {/* Photo panel: 116px on the left below md, a square on top from md. */}
        <div className="relative flex min-h-[116px] w-[116px] shrink-0 items-center justify-center self-stretch overflow-hidden border-r border-[#E5E7EB] md:aspect-[4/3] md:min-h-0 md:w-full md:border-r-0">
          {hasImage ? (
            <button
              type="button"
              onClick={() => setPreviewing(true)}
              aria-label="Preview device image"
              title="Preview device image"
              className="absolute inset-0 flex cursor-zoom-in items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#035C6C]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- device photos are arbitrary catalog URLs, not app assets Next can optimize. */}
              <img src={image} alt="" loading="lazy" onError={() => setBroken(true)} className="h-[88%] w-[88%] object-contain" />
            </button>
          ) : (
            <Smartphone className="h-10 w-10 text-[#035C6C]" aria-hidden="true" />
          )}
          {/* Status tag, top-left corner. */}
          {openStatus ? (
            <button
              type="button"
              onClick={openStatus}
              aria-label={`${tag.label} — update service status for ${ref}`}
              title="Update service status"
              className={cx(tagCls, 'transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C]/40')}
              style={{ backgroundColor: tag.color }}
            >
              {tag.label}
            </button>
          ) : (
            <span className={tagCls} style={{ backgroundColor: tag.color }} title={tag.label}>
              {tag.label}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 px-2.5 pb-2 md:px-2">
          {/* Tracking ID (left) · amount chip (right). */}
          <div className="mt-2 flex items-center">
            <p className="min-w-0 flex-1 truncate text-[11px] font-extrabold text-[#035C6C]" title={ref}>
              {ref}
            </p>
            {amount != null ? (
              <span className="ml-1.5 shrink-0 rounded-lg bg-[#035C6C] px-2 py-[3px] text-[14px] font-extrabold leading-tight text-white">₹{Number(amount).toLocaleString('en-IN')}</span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] font-extrabold leading-4 text-[#111111]" title={[deviceName, specs].filter(Boolean).join(' · ')}>
            {deviceName}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-[#6B7280]" title={[row.customerName, mobile].filter(Boolean).join(' · ')}>
            {row.customerName || '-'}
          </p>
          {/* Date left, time right. */}
          {dateStr || timeStr ? (
            <div className="mt-px flex items-center justify-between text-[11px] text-[#6B7280]">
              <span className="truncate">{dateStr}</span>
              <span className="ml-1.5 shrink-0">{timeStr}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* VIEW (Details) · History · Receipt · Barcode · Assign · Re-Schedule (Bookings) / Re-Est (Pickups) · Call — Invoice page: VIEW · History · Invoice. */}
      {/* Spread across the full card width so the row uses its space (no bunching on the left). */}
      <div className="flex items-center justify-between gap-1 border-t border-[#E5E7EB] px-2.5 py-2">
        <Link
          href={`/shop-home/services/bookings/view/details/?id=${id}`}
          aria-label="View booking details"
          title="Details"
          className="inline-flex h-[30px] shrink-0 items-center rounded-[10px] border-[1.5px] border-[#035C6C] bg-white px-3 text-[11.5px] font-extrabold text-[#035C6C] transition hover:bg-[#E5F3F5] active:opacity-70"
        >
          VIEW
        </Link>
        <IconAction icon={History} label="History" tone={ICON_TONE.history} href={`/shop-home/services/bookings/view/?id=${id}`} />
        {invoiceView ? null : <IconAction icon={Receipt} label="Receipt" tone={ICON_TONE.receipt} href={`/shop-home/services/bookings/view/receipt/?id=${id}`} />}
        {invoiceView ? null : <IconAction icon={QrCode} label="Barcode" tone={ICON_TONE.barcode} href={`/shop-home/services/bookings/view/qr/?id=${id}`} />}
        {invoiceView && row.ticketRef ? (
          <IconAction icon={ReceiptText} label="Invoice" tone={ICON_TONE.invoice} href={`/shop-home/services/invoice/report/?ticketId=${encodeURIComponent(row.ticketRef)}`} />
        ) : null}
        {invoiceView || !onAssign ? null : (
          <IconAction
            icon={UserCog}
            label={tech ? 'Reassign technician' : 'Assign technician'}
            tone={ICON_TONE.assign}
            onClick={onAssign}
            disabled={!row.ticketRef}
            title={
              row.ticketRef
                ? tech
                  ? `Reassign technician (now: ${tech})`
                  : 'Assign a technician to this repair (not assigned yet)'
                : 'This booking has no repair ticket yet — a technician can be assigned once the device is received and its ticket is created'
            }
          />
        )}
        {onReschedule ? (
          <IconAction
            icon={CalendarClock}
            label="Re-Schedule"
            tone={ICON_TONE.reschedule}
            onClick={onReschedule}
            disabled={!row.ticketRef}
            title={row.ticketRef ? 'Re-Schedule: change the ready and delivery date & time' : 'This booking has no repair ticket yet'}
          />
        ) : null}
        {reEstimateHref ? <IconAction icon={Pencil} label="Re-Estimate" tone={ICON_TONE.reestimate} href={reEstimateHref} /> : null}
        {mobile && !invoiceView ? (
          <IconAction
            icon={Copy}
            label={`Copy ${mobile}`}
            tone={ICON_TONE.copy || '#6B7280'}
            onClick={() => {
              navigator.clipboard?.writeText(mobile).then(
                () => notifySuccess(`Mobile number ${mobile} copied.`),
                () => notifyError('Could not copy the mobile number.'),
              );
            }}
          />
        ) : null}
        {mobile ? <IconAction icon={Phone} label={`Call ${mobile}`} tone={ICON_TONE.call} href={`tel:${mobile}`} /> : null}
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

/* -------------------------------------------------------------------------- */
/* Pickup card                                                                 */
/* -------------------------------------------------------------------------- */

const humanize = (s) =>
  String(s || '')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Pickup rows are tagged by their booking (order-service) status, as the app's
// pickup card (PICKUP_STATUS_VARIANT); unmapped ones show the raw status in amber.
function pickupTag(row) {
  const meta = BOOKING_TAG[String(row.status || '').toUpperCase()];
  return meta ? { label: meta[0], color: TONE[meta[1]] } : { label: humanize(row.status) || 'Pending', color: TONE.amber };
}

// The pickup card's call / copy buttons: 26px light-teal discs, teal icon.
const SOFT_DISC = 'inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C] transition hover:bg-[#C7E6EA] active:opacity-70';

/**
 * One doorstep pickup, as the app's pickup card (JobsScreen renderPickup): a
 * light-teal truck panel with the status tag and a VIEW pill, then ref ·
 * pickup person, services, customer, address, date · time and call · copy.
 * A click anywhere (or VIEW) opens the pickup's action sheet (`onOpenMenu`).
 */
export function PickupTile({ row, onOpenMenu }) {
  const ref = withHash(bookingRef(row));
  const tag = pickupTag(row);
  const person = row.assignedPickupPersonName || row.pickupPersonName || '';
  const services = Array.isArray(row.services) ? row.services.map((s) => s?.serviceName || s?.serviceCode).filter(Boolean).join(', ') : '';
  const device = row.deviceDisplayName || row.modelName || '';
  const address = row.pickupAddress || row.pickupAddressText ? formatPickupAddress(row) : '';
  const dateStr = formatDate(row.createdAt || row.bookingDate || row.pickupDate);
  const timeStr = formatTime(row.createdAt);
  const slot = row.pickupSlotStart ? [formatSlotTime(row.pickupSlotStart), formatSlotTime(row.pickupSlotEnd)].filter(Boolean).join(' – ') : '';
  const pickupWhen = row.pickupDate ? `Pickup ${formatDate(row.pickupDate)}${slot ? ` · ${slot}` : ''}` : '';
  const mobile = row.customerMobile || '';

  function onCardClick(e) {
    const hit = e.target.closest('a, button');
    if (hit && e.currentTarget.contains(hit)) return;
    if (window.getSelection?.()?.toString()) return;
    onOpenMenu();
  }

  async function copyMobile() {
    try {
      await navigator.clipboard.writeText(String(mobile));
      notifySuccess(`${mobile} copied.`);
    } catch (err) {
      notifyError(err, 'Could not copy the number.');
    }
  }

  return (
    <article
      onClick={onCardClick}
      className="flex min-w-0 cursor-pointer flex-row overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white transition-colors hover:bg-[#F9FAFB] md:flex-col"
    >
      {/* Truck panel: 116px on the left below md, a square on top from md. */}
      <div className="relative flex min-h-[116px] w-[116px] shrink-0 items-center justify-center self-stretch overflow-hidden border-r border-[#E5E7EB] bg-[#E5F3F5] md:aspect-[4/3] md:min-h-0 md:w-full md:border-r-0">
        <Truck className="h-[34px] w-[34px] text-[#035C6C] md:h-11 md:w-11" aria-hidden="true" />
        <span
          className="absolute left-0 top-0 max-w-[86%] truncate rounded-br-xl px-2 py-1 text-[9.5px] font-extrabold leading-tight text-white"
          style={{ backgroundColor: tag.color }}
          title={tag.label}
        >
          {tag.label}
        </span>
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={`Pickup actions for ${ref}`}
          className="absolute bottom-1.5 right-1.5 rounded-[10px] border-[1.5px] border-[#035C6C] bg-white px-2.5 py-[3px] text-[11px] font-extrabold text-[#035C6C] transition hover:bg-[#E5F3F5] md:bottom-2 md:right-2 md:px-3.5 md:py-[5px] md:text-[12px]"
        >
          VIEW
        </button>
      </div>

      <div className="min-w-0 flex-1 px-2.5 pb-2 md:px-2">
        {/* Ref (left) · pickup person (right). */}
        <div className="mt-2 flex items-center">
          <p className="min-w-0 flex-1 truncate text-[11px] font-extrabold text-[#035C6C]" title={ref}>
            {ref}
          </p>
          <span
            className={cx('ml-1.5 max-w-[55%] truncate text-[11px] font-extrabold', person ? 'text-[#15803D]' : 'text-[#9CA3AF]')}
            title={person ? `Pickup person: ${person}` : 'No pickup person assigned'}
          >
            {person || 'Not assigned'}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] font-extrabold leading-4 text-[#111111]" title={[services || row.issueSummary, device].filter(Boolean).join(' · ')}>
          {services || row.issueSummary || 'Repair Pickup'}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-[#6B7280]">{row.customerName || '-'}</p>
        {address ? (
          <p className="mt-px truncate text-[11px] text-[#6B7280]" title={address}>
            {address}
          </p>
        ) : null}
        {dateStr || timeStr ? (
          <div className="mt-px flex items-center justify-between text-[11px] text-[#6B7280]" title={pickupWhen || undefined}>
            <span className="truncate">{dateStr}</span>
            <span className="ml-1.5 shrink-0">{timeStr}</span>
          </div>
        ) : null}
        {/* Call (left) + copy (right), on the line after date / time. */}
        {mobile ? (
          <div className="mt-1 flex items-center justify-between">
            <a href={`tel:${mobile}`} aria-label={`Call ${mobile}`} title={`Call ${mobile}`} className={SOFT_DISC}>
              <Phone className="h-3 w-3" aria-hidden="true" />
            </a>
            <button type="button" onClick={copyMobile} aria-label={`Copy mobile number ${mobile}`} title={`Copy ${mobile}`} className={SOFT_DISC}>
              <Copy className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * The app's pickup action sheet (bottom sheet on phones, centred from sm):
 * customer + ref, then tool-tile discs with labels. The actions are this
 * page's own — Assign (technician, once a ticket exists) · History · Receipt
 * · Barcode · Details · Re-Est — in the app's tile colours.
 */
export function PickupActionSheet({ row, onClose, onAssign }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!row) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [row, onClose]);

  if (!row || typeof document === 'undefined') return null;

  const id = encodeURIComponent(row.id);
  const ref = withHash(bookingRef(row));
  const tech = row.assignedTechnicianName || '';
  const actions = [
    {
      key: 'assign',
      label: tech ? 'Reassign' : 'Assign',
      icon: UserCog,
      color: '#5E9440',
      onClick: () => onAssign(row),
      disabled: !row.ticketRef,
      title: row.ticketRef
        ? tech
          ? `Reassign technician (now: ${tech})`
          : 'Assign a technician to this repair'
        : 'This booking has no repair ticket yet — a technician can be assigned once the device is received and its ticket is created',
    },
    { key: 'history', label: 'History', icon: History, color: '#3B82F6', href: `/shop-home/services/bookings/view/?id=${id}` },
    { key: 'receipt', label: 'Receipt', icon: Receipt, color: '#357D89', href: `/shop-home/services/bookings/view/receipt/?id=${id}` },
    { key: 'barcode', label: 'Barcode', icon: QrCode, color: '#1C3053', href: `/shop-home/services/bookings/view/qr/?id=${id}` },
    { key: 'details', label: 'Details', icon: FileText, color: '#6B7280', href: `/shop-home/services/bookings/view/details/?id=${id}` },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(17,17,17,0.45)] sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Pickup actions for ${ref}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] rounded-t-3xl bg-white px-4 pb-5 pt-2.5 outline-none sm:rounded-3xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E5E7EB]" aria-hidden="true" />
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-extrabold text-[#111111]">{row.customerName || 'Pickup'}</p>
            <p className="mb-2.5 mt-0.5 truncate text-[12px] text-[#6B7280]">{ref}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280] hover:text-[#111111]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-y-1 min-[480px]:grid-cols-6">
          {actions.map(({ key, label, icon: Icon, color, href, onClick, disabled, title }) => {
            const cls = cx('flex min-w-0 flex-col items-center rounded-xl px-1 py-2 transition', disabled ? 'cursor-not-allowed' : 'hover:bg-[#F3F4F6] active:opacity-70');
            const body = (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: disabled ? '#E5E7EB' : color }}>
                  <Icon className={cx('h-[19px] w-[19px]', disabled ? 'text-[#9CA3AF]' : 'text-white')} aria-hidden="true" />
                </span>
                <span className={cx('mt-1.5 max-w-full truncate text-center text-[12px] font-semibold', disabled ? 'text-[#9CA3AF]' : 'text-[#111111]')}>{label}</span>
              </>
            );
            return href ? (
              <Link key={key} href={href} title={title || label} className={cls}>
                {body}
              </Link>
            ) : (
              <button key={key} type="button" onClick={disabled ? undefined : onClick} disabled={disabled} title={title || label} className={cls}>
                {body}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
