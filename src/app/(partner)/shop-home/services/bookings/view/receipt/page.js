'use client';

/**
 * /shop-home/services/bookings/view/receipt/?id=… — Booking Receipt, laid out
 * like the Partner app's booking-confirmation card — the one the app shares
 * on WhatsApp (service-booking-shop/BookingConfirmCard.js): shop + "Service
 * Booking Confirmed" badge, Booking ID card (booked on, status), greeting +
 * customer mobile, device card (photo, name, variant · colour, IMEI; Repair
 * Services with prices + warranty, Service Charge, issue, accessories,
 * missing / damaged parts; estimated delivery band), Payment Summary, Shop
 * Contact and the "Thank you … Powered by NearGFix" footer.
 *
 * Data (the same reads the Details / QR pages make):
 *   - booking   GET {ORDER_BASE}/repair-bookings/shop/{id}, filled from master
 *               data (enrichWithCatalog + loadVariantOptions).
 *   - ticket    GET /tickets/{ticketId} once the booking has one — tracking ID,
 *               status, price items (warranty, service charge), accessories,
 *               parts, payment, estimated delivery. The booking's own copy
 *               fills in before a ticket exists.
 *   - shop      GET {AUTH_BASE}/auth/shops/{shopId}/public (name, photo, number;
 *               the app's fixed receipt number when the shop has none).
 * Share to WhatsApp sends the booking-confirmed text below to the customer;
 * Print prints only the card; QR Print opens the Barcode page.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from '@/components/PortalLink';
import { useRouter, useSearchParams } from '@/lib/portalNavigation';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Handshake,
  Headphones,
  Laptop,
  MessageSquareText,
  Palette,
  Phone,
  Printer,
  QrCode,
  ScanLine,
  Smartphone,
  Tablet,
  Ticket,
  TriangleAlert,
  Wallet,
  Watch,
  Wrench,
} from 'lucide-react';

import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { fetchShopBookingDetail, fetchTicket } from '@/lib/shopDashboard';
import { bookingEstimatedAmount } from '@/lib/bookingFormat';
import { priceItemsFromTicket } from '@/lib/invoice';
import { bookingRef } from '@/lib/orderStages';
import { enrichWithCatalog, getDeviceImage, loadVariantOptions, resolveMediaUrl, variantLabel } from '@/lib/deviceImage';
import { readShopOwner } from '@/lib/shopAuth';
import { receiptPng } from '@/lib/receiptImage';
import { notifyError, notifySuccess } from '@/lib/toast';
import { getShopPublic } from '@/lib/repairBooking';

// The app card's palette (BookingConfirmCard).
const GREEN = '#01AC77';
const GREEN_DARK = '#03714F';
const NAVY = '#05366E';
const MINT = '#E6F7F1';
const AMBER = '#B45309';
// The app's fixed receipt number, printed when the shop has none (ReceiptCard RECEIPT_SHOP_NUMBER).
const RECEIPT_SHOP_NUMBER = '9500824814';

// Status -> receipt label (ReceiptCard RECEIPT_STATUS_LABEL).
const STATUS_LABEL = {
  CREATED: 'Order Placed',
  ASSIGNED: 'Technician Assigned',
  IN_DIAGNOSIS: 'In Diagnosis',
  IN_REPAIR: 'In Service Process',
  QUOTED: 'Re-Estimated',
  APPROVED: 'Customer Approved',
  READY: 'Ready for Delivery',
  INVOICE_GENERATED: 'Invoice Generated',
  INVOICE_READY: 'Invoice Ready',
  DELIVERED_PROCESSING: 'Dispatched',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};
function statusLabelOf(status) {
  const key = String(status || '').toUpperCase();
  if (!key) return 'Order Placed';
  return STATUS_LABEL[key] || key.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// "₹2,500" (up to 2 decimals, as the app card).
const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// "31 Oct 2026, 11:47 PM" in IST — the app's readyWhen(iso, true), formatted by hand.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function readyWhen(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const t = new Date(d.getTime() + 330 * 60000);
  const h = t.getUTCHours();
  return `${String(t.getUTCDate()).padStart(2, '0')} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}, ${h % 12 || 12}:${String(t.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// "Moto g54 5G · XT2343 (8GB / 128GB)" -> name / model no. / RAM-storage (ReceiptCard deviceNameParts).
function deviceNameParts(raw) {
  const str = String(raw || '').trim();
  const m = /^(.*?)(?: · ([^()]+?))?(?: \(([^)]*)\))?$/.exec(str);
  return { deviceName: (m?.[1] || str).trim() || '', modelNumber: m?.[2]?.trim() || '', ramStorage: m?.[3]?.trim() || '' };
}

const isServiceCharge = (x) => String(x?.code || x?.serviceCode || '').toUpperCase() === 'SERVICE_CHARGE';

// Flagged parts -> "Back Glass (Damaged – cracked), …" (BookingConfirmCard partsText).
function partsText(v) {
  let list = v;
  if (typeof v === 'string') {
    try {
      list = JSON.parse(v);
    } catch {
      list = [];
    }
  }
  return (Array.isArray(list) ? list : [])
    .filter((p) => p && (p.missing || p.damage))
    .map((p) => `${p.partName || p.name || p.partId} (${p.damage ? 'Damaged' : 'Missing'}${p.detail ? ` – ${p.detail}` : ''})`)
    .join(', ');
}

function categoryIcon(name) {
  const s = String(name || '').toLowerCase();
  if (/laptop|notebook|macbook/.test(s)) return Laptop;
  if (/tablet|ipad|tab\b/.test(s)) return Tablet;
  if (/watch/.test(s)) return Watch;
  if (/audio|headphone|earbud|speaker/.test(s)) return Headphones;
  return Smartphone;
}

// Prints only the card (and drops the page chrome) — the browser's Print / Save as PDF.
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #booking-receipt, #booking-receipt * { visibility: visible !important; }
  #booking-receipt { position: absolute; left: 0; top: 0; width: 100%; max-width: 720px; box-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .receipt-no-print { display: none !important; }
}
`;

function ShopLogo({ name, src, size }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return src && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element -- shop photo from the media service.
    <img src={src} alt="" onError={() => setBroken(true)} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full font-extrabold text-white" style={{ width: size, height: size, backgroundColor: GREEN, fontSize: size * 0.46 }}>
      {String(name || 'S').trim()[0]?.toUpperCase() || 'S'}
    </span>
  );
}

function DevicePhoto({ src, icon: Icon }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const ok = src && !broken;
  return (
    <span className="flex h-[92px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#EEF1F0]" style={{ backgroundColor: ok ? '#FFFFFF' : MINT }}>
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element -- device photo from the catalog / media service.
        <img src={src} alt="" onError={() => setBroken(true)} className="h-[86px] w-[70px] object-contain" />
      ) : (
        <Icon className="h-9 w-9" style={{ color: GREEN }} strokeWidth={1.5} aria-hidden="true" />
      )}
    </span>
  );
}

function SectionTitle({ icon: Icon, title }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-[11px] font-extrabold tracking-[0.06em]" style={{ color: NAVY }}>
      <Icon className="h-4 w-4" style={{ color: GREEN }} strokeWidth={2.2} aria-hidden="true" />
      {title}
    </p>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="mt-2.5 flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GREEN }} strokeWidth={2.2} aria-hidden="true" />
      <span className="w-[130px] shrink-0 text-[12.5px] text-[#6B7280]">{label}</span>
      <span className="min-w-0 flex-1 break-words text-[13px] font-bold" style={{ color: NAVY }}>
        {value}
      </span>
    </div>
  );
}

function MoneyRow({ label, value, bold, color = NAVY }) {
  return (
    <div className="mt-1 flex items-center gap-3">
      <span className={bold ? 'flex-1 text-[14px] font-extrabold' : 'flex-1 text-[13.5px] font-semibold text-[#6B7280]'} style={bold ? { color: NAVY } : undefined}>
        {label}
      </span>
      <span className={bold ? 'text-[17px] font-extrabold' : 'text-[14px] font-extrabold'} style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export default function BookingReceiptPage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [booking, setBooking] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [otherNumber, setOtherNumber] = useState('');
  const [variant, setVariant] = useState('');
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    fetchShopBookingDetail(id)
      .then(async (data) => {
        if (!data) return;
        const [[enriched], options] = await Promise.all([enrichWithCatalog([data]), loadVariantOptions()]);
        // The ticket fills the card's ticket-side fields; a failed read never hides the receipt.
        const tk = data.ticketId ? await fetchTicket(data.ticketId).catch(() => null) : null;
        if (!alive) return;
        setBooking(enriched);
        setTicket(tk);
        setVariant(variantLabel(data, options));
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

  // The signed-in shop's public record — the card's shop header and contact.
  useEffect(() => {
    const shopId = readShopOwner()?.shopId;
    if (!shopId) return undefined;
    let alive = true;
    getShopPublic(shopId).then((data) => alive && data && setShop(data));
    return () => {
      alive = false;
    };
  }, []);

  // Everything the card and the WhatsApp text show, ticket first, booking as fallback.
  const card = useMemo(() => {
    if (!booking) return null;
    const parts = deviceNameParts(ticket?.deviceDisplayName);
    const brand = booking.brandName || '';
    const model = String(booking.deviceDisplayName || booking.modelName || '').split(' · ')[0].trim() || parts.deviceName;
    const deviceName = model ? (brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${model}` : model) : 'Device';
    const items = ticket ? priceItemsFromTicket(ticket) : [];
    const lines = items.length
      ? items.filter((i) => !isServiceCharge(i)).map((i) => ({ name: i.label || i.serviceName || i.name || 'Service', amount: Number(i.amount ?? i.price) || 0, warranty: i.warranty || '' }))
      : (booking.services || []).map((s) => ({ name: s.serviceName || s.serviceCode || 'Service', amount: s.estimatedPrice != null ? Number(s.estimatedPrice) || 0 : null, warranty: s.warranty || '' }));
    const serviceCharge = items.filter(isServiceCharge).reduce((n, i) => n + (Number(i.amount ?? i.price) || 0), 0);
    const itemsSum = items.reduce((n, i) => n + (Number(i.amount ?? i.price) || 0), 0);
    const total =
      ticket?.estimatedPrice != null
        ? Number(ticket.estimatedPrice) || 0
        : Number(booking.finalAmount ?? booking.estimateAmount ?? bookingEstimatedAmount(booking) ?? (itemsSum || lines.reduce((n, l) => n + (l.amount || 0), 0))) || 0;
    // Payment as the app reads it (null = nothing collected).
    const src = ticket?.paymentType ? ticket : booking;
    const paidAmount = Number(src?.paymentAmount);
    const payment =
      src?.paymentType && Number.isFinite(paidAmount) && paidAmount > 0
        ? { amount: paidAmount, balance: src.balanceAmount != null && Number.isFinite(Number(src.balanceAmount)) ? Number(src.balanceAmount) : null }
        : null;
    const paid = payment ? payment.amount : 0;
    const balance = payment && payment.balance != null ? Math.max(0, payment.balance) : Math.max(0, total - paid);
    const names = lines.map((l) => l.name).join(', ');
    const rawComplaint = String(ticket?.issueDescription || booking.issueDescription || '')
      .split('\n')
      .filter((l) => !/imei not provided/i.test(l))
      .join(' ')
      .trim();
    const accessories = ticket?.accessories || (Array.isArray(booking.accessories) ? booking.accessories.join(', ') : booking.accessories) || '';
    const shopName = shop?.shopName || shop?.name || 'Your Shop';
    return {
      shopName,
      shopImage: resolveMediaUrl(shop?.frontImageUrl || shop?.bannerImageUrl || shop?.logoUrl || shop?.imageUrl),
      shopPhone: shop?.mobile || shop?.phone || shop?.contactNumber || RECEIPT_SHOP_NUMBER,
      tid: String(bookingRef({ trackingId: ticket?.trackingId, bookingNumber: booking.bookingNumber, id: booking.id }) || id || '').replace(/^#+/, ''),
      bookedOn: readyWhen(booking.createdAt || ticket?.createdAt),
      statusLabel: statusLabelOf(ticket?.status || booking.status),
      customerName: ticket?.customerName || booking.customerName || 'Customer',
      customerPhone: booking.customerMobile || ticket?.customerPhone || '',
      altPhone: ticket?.customerAlternatePhone || booking.alternatePhone || '',
      deviceName,
      modelNumber: parts.modelNumber || ticket?.modelNumber || booking.modelNumber || '',
      ramStorage: parts.ramStorage || variant || booking.ramStorage || '',
      color: ticket?.color || booking.color || '',
      imei: ticket?.imei || booking.imei || '',
      serialNumber: ticket?.serialNumber || '',
      image: resolveMediaUrl(ticket?.deviceImageUrl) || resolveMediaUrl(booking.deviceImageUrl) || resolveMediaUrl(booking.frontImageUrl) || getDeviceImage(booking),
      icon: categoryIcon(booking.categoryName || ticket?.deviceCategory || deviceName),
      lines,
      names,
      serviceCharge,
      complaint: rawComplaint && rawComplaint !== names ? rawComplaint : '',
      accessories,
      parts: partsText(ticket?.missingPartsJson) || booking.missingDamageParts || '',
      delivery: readyWhen(ticket?.estimatedDeliveryAt || booking.estimatedDeliveryAt),
      total,
      paid,
      balance,
    };
  }, [booking, ticket, shop, variant, id]);

  // The WhatsApp text, line for line in the booking-confirmed format; lines with no value are left out.
  function receiptText() {
    const c = card;
    return [
      `✅ ${c.shopName} | Service Booking Confirmed`,
      '',
      `▪ Customer: ${c.customerName}${c.customerPhone ? ` (${c.customerPhone})` : ''}`,
      c.tid ? `▪ Booking ID: ${c.tid}` : null,
      c.bookedOn ? `▪ Booked on: ${c.bookedOn}` : null,
      `▪ Status: ${c.statusLabel}`,
      '',
      `▪ Device: ${c.deviceName}`,
      c.modelNumber ? `   Model No: ${c.modelNumber}` : null,
      c.ramStorage ? `   RAM / Storage: ${c.ramStorage}` : null,
      c.color ? `   Color: ${c.color}` : null,
      c.names ? `▪ Service: ${c.names}` : null,
      ...c.lines.map((l, i) => `   ${i + 1}. ${l.name}${l.amount != null ? ` – ${inr(l.amount)}` : ''}${l.warranty ? ` (Warranty: ${l.warranty})` : ''}`),
      c.serviceCharge > 0 ? `   Service Charge – ${inr(c.serviceCharge)}` : null,
      c.delivery ? `⏰ Estimated Delivery: ${c.delivery}` : null,
      '',
      `₹ Estimated Cost: ${inr(c.total)}`,
      `☎ Shop Number: ${c.shopPhone}`,
      '',
      `Thank you for choosing ${c.shopName}! ♥`,
      'Powered by NearGFix',
    ]
      .filter((l) => l !== null)
      .join('\n');
  }

  // Opens WhatsApp with the receipt text ready for the picked number (wa.me can't
  // send by itself — the shop taps Send; WhatsApp Business API sending is off).
  // The receipt image goes on the clipboard (a WhatsApp link can carry text
  // only) — the chat opens with the text, and Ctrl+V there attaches the image.
  async function sendWhatsApp(number) {
    const digits = String(number || '').replace(/\D/g, '');
    const to = digits.length === 10 ? `91${digits}` : digits;
    setShareOpen(false);
    let copied = false;
    const pngPromise = receiptPng(card);
    try {
      // ClipboardItem takes the pending PNG, so the write starts inside the click.
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngPromise.then((b) => b || Promise.reject(new Error('no image'))) })]);
        copied = true;
      }
    } catch { /* fall back to a download */ }
    try {
      const blob = copied ? null : await pngPromise;
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Receipt-${card.tid || 'booking'}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
    } catch { /* text still goes */ }
    const url = `https://web.whatsapp.com/send?phone=${to}&text=${encodeURIComponent(receiptText())}`;
    // Opened only after the copy: a new tab takes focus and the browser then refuses clipboard writes.
    window.open(url, '_blank');
    if (copied) notifySuccess('Receipt image copied — press Ctrl+V in the WhatsApp chat to attach it, then Send.', { duration: 8000 });
    else notifyError(null, 'Receipt image downloaded — attach it in the WhatsApp chat.');
  }
  function shareWhatsApp() {
    if (!card) return;
    setOtherNumber('');
    setShareOpen(true);
  }

  const DeviceIcon = card?.icon || Smartphone;

  return (
    <div className="-mx-4 -my-5 min-h-[calc(100vh-4rem)] bg-[#F3F4F6] sm:-mx-6 sm:-my-6">
      <style>{PRINT_CSS}</style>
      {/* Header: back · Receipt · Print */}
      <div className="receipt-no-print flex items-center gap-3 border-b border-[#E5E7EB] bg-white px-3.5 pb-3 pt-2.5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB] text-[#111111] transition hover:bg-[#F3F4F6]"
        >
          <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 text-center text-[17px] font-extrabold text-[#111111]">Receipt</h1>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!card}
          aria-label="Print receipt"
          title="Print / Save as PDF"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C] transition hover:bg-[#C7E6EA] disabled:opacity-50"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mx-auto w-full max-w-[720px] px-3.5 pb-10 pt-4 lg:max-w-[1140px] lg:px-6">
        {!id ? (
          <EmptyState icon={TriangleAlert} tone="muted" title="No booking selected" description="Open a booking from the Bookings list." />
        ) : loading ? (
          <div className="h-[640px] animate-pulse rounded-2xl bg-white" />
        ) : error ? (
          <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !card ? (
          <EmptyState icon={TriangleAlert} tone="muted" title="Booking not found" description="We couldn't find this booking." />
        ) : (
          <div className="lg:flex lg:items-start lg:gap-6">
            <article id="booking-receipt" className="min-w-0 rounded-xl lg:w-[794px] lg:max-w-full lg:shrink lg:border lg:border-[#E5E7EB] lg:p-8 bg-white p-4 shadow-[0_6px_20px_rgba(17,17,17,0.06)] sm:p-5">
              {/* Header — shop logo + name · Service Booking Confirmed */}
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <ShopLogo name={card.shopName} src={card.shopImage} size={40} />
                  <p className="min-w-0 break-words text-[19px] font-extrabold leading-tight" style={{ color: NAVY }}>
                    {card.shopName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-2xl px-2.5 py-2" style={{ backgroundColor: MINT }}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: GREEN }}>
                    <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[10.5px] font-semibold leading-tight" style={{ color: NAVY }}>
                      Service Booking
                    </span>
                    <span className="block text-[15px] font-extrabold leading-tight" style={{ color: NAVY }}>
                      Confirmed
                    </span>
                  </span>
                </div>
              </div>

              {/* Booking ID + status · booked on */}
              <div className="mt-3.5 flex items-center gap-3 rounded-2xl border border-[#EEF1F0] bg-[#F6FBF9] px-3.5 py-2.5">
                <Ticket className="h-5 w-5 shrink-0" style={{ color: GREEN }} strokeWidth={2.2} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-[#6B7280]">Booking ID</p>
                  <p className="break-all text-[16px] font-extrabold" style={{ color: NAVY }}>
                    {card.tid || '—'}
                  </p>
                  {card.bookedOn ? <p className="text-[11.5px] text-[#6B7280]">Booked on {card.bookedOn}</p> : null}
                </div>
                <span className="shrink-0 rounded-full px-3 py-1 text-[12px] font-extrabold" style={{ backgroundColor: MINT, color: GREEN_DARK }}>
                  {card.statusLabel}
                </span>
              </div>

              {/* Greeting + customer contact */}
              <p className="mt-3.5 text-[16px]" style={{ color: NAVY }}>
                Dear <b className="font-extrabold">{card.customerName}</b>,
              </p>
              <p className="mt-0.5 text-[13px] leading-[18px] text-[#374151]">
                Your device repair booking has been successfully registered with{' '}
                <b className="font-extrabold" style={{ color: GREEN }}>
                  {card.shopName}
                </b>
                .
              </p>
              {card.customerPhone || card.altPhone ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    ['Mobile', card.customerPhone],
                    ['Alt. Mobile', card.altPhone],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-[#EEF1F0] bg-[#F6FBF9] px-2.5 py-1">
                        <Phone className="h-3 w-3" style={{ color: GREEN }} strokeWidth={2.4} aria-hidden="true" />
                        <span className="text-[11.5px] text-[#6B7280]">{k}</span>
                        <span className="text-[12.5px] font-extrabold" style={{ color: NAVY }}>
                          {v}
                        </span>
                      </span>
                    ))}
                </div>
              ) : null}

              {/* Device card: details + photo, repair services, delivery */}
              <div className="mt-3.5 overflow-hidden rounded-2xl border border-[#EEF1F0]">
                <div className="flex items-center gap-3.5 p-3.5">
                  <DevicePhoto src={card.image} icon={DeviceIcon} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold tracking-[0.06em] text-[#6B7280]">DEVICE</p>
                    <p className="mt-0.5 break-words text-[18px] font-extrabold leading-tight" style={{ color: NAVY }}>
                      {card.deviceName}
                    </p>
                    {card.ramStorage || card.color ? (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[#374151]">
                        <Palette className="h-3.5 w-3.5 shrink-0" style={{ color: GREEN }} strokeWidth={2.2} aria-hidden="true" />
                        <span className="min-w-0 break-words">{[card.ramStorage, card.color].filter(Boolean).join(' · ')}</span>
                      </p>
                    ) : null}
                    {card.imei || card.serialNumber ? (
                      <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[#374151]">
                        <ScanLine className="h-3.5 w-3.5 shrink-0" style={{ color: GREEN }} strokeWidth={2.2} aria-hidden="true" />
                        <span className="min-w-0 break-all">{card.imei ? `IMEI ${card.imei}` : `S/N ${card.serialNumber}`}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-[#EEF1F0] px-3.5 py-3">
                  <SectionTitle icon={Wrench} title="REPAIR SERVICES" />
                  {card.lines.length ? (
                    card.lines.map((s, j) => (
                      <div key={`${s.name}-${j}`} className="mt-2 flex items-start gap-2.5 first:mt-0">
                        <span className="mt-px flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold" style={{ backgroundColor: MINT, color: GREEN_DARK }}>
                          {j + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-[14px] font-extrabold" style={{ color: NAVY }}>
                            {s.name}
                          </p>
                          {s.warranty ? <p className="text-[11.5px] text-[#6B7280]">Warranty: {s.warranty}</p> : null}
                        </div>
                        {s.amount != null ? (
                          <span className="shrink-0 text-[14px] font-extrabold" style={{ color: NAVY }}>
                            {inr(s.amount)}
                          </span>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] text-[#6B7280]">No services listed</p>
                  )}
                  {card.serviceCharge > 0 ? (
                    <div className="mt-2 flex items-center">
                      <span className="ml-[31px] flex-1 text-[13.5px] font-semibold text-[#6B7280]">Service Charge</span>
                      <span className="text-[14px] font-extrabold" style={{ color: NAVY }}>
                        {inr(card.serviceCharge)}
                      </span>
                    </div>
                  ) : null}
                  {card.complaint ? <Detail icon={MessageSquareText} label="Issue Description" value={card.complaint} /> : null}
                  <Detail icon={Headphones} label="Accessories" value={card.accessories || 'None'} />
                  <Detail icon={TriangleAlert} label="Missing / Damaged Parts" value={card.parts || 'None'} />
                </div>

                <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ backgroundColor: MINT }}>
                  <CalendarClock className="h-5 w-5 shrink-0" style={{ color: GREEN_DARK }} strokeWidth={2.2} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-extrabold tracking-[0.06em]" style={{ color: GREEN_DARK }}>
                      ESTIMATED DELIVERY DATE &amp; TIME
                    </p>
                    <p className="text-[16px] font-extrabold" style={{ color: NAVY }}>
                      {card.delivery || 'To Be Confirmed'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment summary */}
              <div className="mt-3.5 rounded-2xl border border-[#EEF1F0] px-3.5 py-3">
                <SectionTitle icon={Wallet} title="PAYMENT SUMMARY" />
                <MoneyRow label="Estimated Repair Total" value={inr(card.total)} />
                <MoneyRow label="Amount Paid" value={inr(card.paid)} />
                <div className="my-2 h-px bg-[#EEF1F0]" />
                <MoneyRow label="Balance Amount" value={inr(card.balance)} bold color={card.balance > 0 ? AMBER : GREEN_DARK} />
              </div>

              {/* Shop contact */}
              <div className="mt-3.5 flex items-center gap-3 rounded-2xl border border-[#EEF1F0] px-3.5 py-3">
                <ShopLogo name={card.shopName} src={card.shopImage} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-[#6B7280]">Shop Contact</p>
                  <p className="break-words text-[14px] font-extrabold" style={{ color: NAVY }}>
                    {card.shopName}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: GREEN }}>
                    <Phone className="h-3.5 w-3.5 text-white" strokeWidth={2.4} aria-hidden="true" />
                  </span>
                  <span className="text-[15px] font-extrabold" style={{ color: NAVY }}>
                    {card.shopPhone}
                  </span>
                </span>
              </div>

              {/* Footer — thank you (dark green) · Powered by NearGFix (white, curved) */}
              <div className="relative mt-3.5 flex h-[62px] items-center overflow-hidden rounded-2xl" style={{ backgroundColor: GREEN_DARK }}>
                <Handshake className="ml-3.5 h-6 w-6 shrink-0 text-white" strokeWidth={1.8} aria-hidden="true" />
                <div className="ml-2.5 mr-[150px] min-w-0 flex-1">
                  <p className="truncate text-[13px] text-white">
                    Thank you for choosing <b className="font-extrabold">{card.shopName}</b>!
                  </p>
                  <p className="text-[11.5px] text-white/90">Your trust means a lot to us. 💚</p>
                </div>
                <span className="absolute bottom-0 right-0 top-0 w-[150px] rounded-tl-[52px]" style={{ backgroundColor: GREEN }} aria-hidden="true" />
                <span className="absolute bottom-0 right-0 top-0 flex w-[142px] flex-col items-center justify-center rounded-tl-[52px] bg-white pl-2">
                  <span className="text-[10px] text-[#6B7280]">Powered by</span>
                  <span className="mt-0.5 flex items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static brand logo. */}
                    <img src="/logo.png" alt="" className="h-5 w-5 object-contain" />
                    <span className="text-[16px] font-extrabold" style={{ color: NAVY }}>
                      NearGFix
                    </span>
                  </span>
                </span>
              </div>
            </article>

            {shareOpen && card ? (
              <div className="receipt-no-print fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setShareOpen(false)}>
                <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
                  <p className="text-[16px] font-extrabold text-[#111111]">Share to WhatsApp</p>
                  <p className="mt-0.5 text-xs text-[#6B7280]">Pick the number to send the booking receipt to.</p>
                  <div className="mt-4 space-y-2">
                    {[['Mobile Number', card.customerPhone], ['Alternative Mobile Number', card.altPhone]].filter(([, v]) => String(v || '').replace(/\D/g, '').length >= 10).map(([k, v]) => (
                      <button key={k} type="button" onClick={() => sendWhatsApp(v)} className="flex w-full items-center gap-3 rounded-xl border border-[#E5E7EB] p-3 text-left hover:border-[#035C6C] hover:bg-[#E5F3F5]">
                        <Phone className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
                        <span className="flex-1"><span className="block text-[11.5px] text-[#6B7280]">{k}</span><span className="block text-[14px] font-extrabold text-[#111111]">{v}</span></span>
                        <span className="text-xs font-bold text-[#035C6C]">Send</span>
                      </button>
                    ))}
                    <div className="flex gap-2">
                      <input value={otherNumber} onChange={(e) => setOtherNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="Other 10-digit number"
                        className="h-11 flex-1 rounded-xl border border-[#E5E7EB] px-3 text-sm outline-none focus:border-[#035C6C]" />
                      <button type="button" disabled={!/^[6-9]\d{9}$/.test(otherNumber)} onClick={() => sendWhatsApp(otherNumber)} className="rounded-xl bg-[#035C6C] px-4 text-sm font-bold text-white disabled:opacity-50">Send</button>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShareOpen(false)} className="mt-4 w-full rounded-xl border border-[#E5E7EB] py-2.5 text-sm font-bold text-[#111111] hover:bg-[#F3F4F6]">Cancel</button>
                </div>
              </div>
            ) : null}
            {/* Actions: Share to WhatsApp · Print · QR Print */}
            <div className="receipt-no-print mt-3 space-y-2.5 lg:sticky lg:top-4 lg:mt-0 lg:w-[280px] lg:shrink-0 lg:rounded-xl lg:border lg:border-[#E5E7EB] lg:bg-white lg:p-4 lg:shadow-[0_1px_6px_rgba(5,54,110,0.06)]">
              <button
                type="button"
                onClick={shareWhatsApp}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#035C6C] px-5 text-[14.5px] font-bold text-white transition hover:bg-[#024A57]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.75-.71 2-1.4.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.43-9.44 9.43m8.03-17.46A11.3 11.3 0 0 0 12.05.7C5.8.7.7 5.79.7 12.05c0 2 .52 3.95 1.52 5.67L.6 23.3l5.72-1.5a11.3 11.3 0 0 0 5.72 1.46h.01c6.25 0 11.35-5.1 11.35-11.35 0-3.03-1.18-5.88-3.32-8.02" />
                </svg>
                Share to WhatsApp
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#035C6C] bg-white text-[13.5px] font-extrabold text-[#035C6C] transition hover:bg-[#E5F3F5]"
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Print
                </button>
                <Link
                  href={`/shop-home/services/bookings/view/qr/?id=${encodeURIComponent(booking?.id || id)}`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#B45309] bg-[#FFF0D2] text-[13.5px] font-extrabold text-[#B45309] transition hover:brightness-95"
                >
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                  QR Print
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
