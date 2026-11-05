'use client';

/**
 * /shop-home/services/bookings/view/qr/?id=… — QR E-Print for one booking.
 *
 * This is what the Bookings list's "Barcode" action opens (previously a
 * disabled placeholder — there's no barcode/label-printing endpoint on the
 * backend, but a QR slip needs no backend at all: it's a client-side render
 * of data this page already has, same as the shop's own "My QR Code" tab in
 * account/settings/page.js, which already uses the same `qrcode` package
 * this file uses.
 *
 * The QR encodes the booking's tracking number as plain text (there's no
 * public, unauthenticated "scan to view" URL for a booking anywhere in this
 * backend) — scanning it just hands a counter clerk the tracking number, the
 * same thing the "Present this QR code at the service counter" copy asks
 * for. Print is real — a real print window sized to the label — not a
 * decorative button.
 *
 * Data: the booking (GET repair-bookings/shop/{id}) filled from master data
 * (enrichWithCatalog: brand, model name, model photo), then its repair
 * ticket (GET /tickets/{id}) only to fill gaps — tracking no., device name,
 * customer, security value, created date. The label follows the Partner
 * app's (BarcodePrintScreen / LabelPreview): service number on top, QR left
 * with brand+model / customer / security right, booking date + time at the
 * bottom. Page Setup offers the app's two label stocks (BarCode 38 x 25 mm,
 * BarCode1 50 x 25 mm); the picked one is previewed and is what prints.
 *
 * Layout (2026-11-03) mirrors the app's BarcodePrintScreen: header "QR
 * E-Print", Booking card (photo, device, variant, services pill; Tracking ID
 * with Copy, Customer, Services, Device Lock), QR Label card (stock + live
 * label preview, Page Setup chips) and a sticky "Print QR Slip" bar. The
 * tracking number shown/printed is the short ticket ID (bookingRef); the QR
 * still encodes the booking number, as before.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from '@/lib/portalNavigation';
import QRCode from 'qrcode';
import { AlertTriangle, Check, ChevronLeft, Copy, Printer, QrCode, Wrench } from 'lucide-react';

import { cx } from '@/components/site/ui';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import ImagePreviewModal from '@/components/shop-dashboard/ImagePreviewModal';
import { DeviceThumb } from '@/components/shop-dashboard/OrdersList';
import { enrichWithCatalog, resolveMediaUrl } from '@/lib/deviceImage';
import { fetchShopBookingDetail, fetchTicket } from '@/lib/shopDashboard';
import { bookingRef } from '@/lib/orderStages';
import { notifyError } from '@/lib/toast';

// Page Setup presets — the Partner app's services/printer/labelPresets.js.
// Names and sizes mirror the TVS LP-46 Dlite driver's own stock list
// ("BarCode (38.0mm x 25.0mm)", "BarCode1 (50.0mm x 25.0mm)"). The shop picks
// the stock loaded in the printer; the pick is remembered in this browser,
// as the app remembers it on the device.
const LABEL_PRESETS = [
  { id: 'barcode', name: 'BarCode', widthMm: 38, heightMm: 25 },
  { id: 'barcode1', name: 'BarCode1', widthMm: 50, heightMm: 25 },
];
const DEFAULT_PRESET = LABEL_PRESETS[0];
const PRESET_STORAGE_KEY = 'ggfix.labelPreset';
const getPreset = (id) => LABEL_PRESETS.find((p) => p.id === id) || DEFAULT_PRESET;
/** "38.0 mm × 25.0 mm" */
const presetSizeText = (p) => `${p.widthMm.toFixed(1)} mm × ${p.heightMm.toFixed(1)} mm`;

// Minimal monochrome pictograms drawn as raw SVG markup (not React
// components — this string is written into a separate print window's
// document, not rendered through React) so the printed label needs no
// external icon font or asset: pure black fill/stroke, no gradients or
// gray, per the thermal-printer requirements below.
const PRINT_ICON_PERSON = '<svg viewBox="0 0 24 24" width="8" height="8"><circle cx="12" cy="8" r="4" fill="#000"/><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="#000"/></svg>';
const PRINT_ICON_LOCK = '<svg viewBox="0 0 24 24" width="8" height="8"><rect x="5" y="11" width="14" height="10" rx="2" fill="#000"/><path d="M8 11V7a4 4 0 018 0v4" stroke="#000" stroke-width="2" fill="none"/></svg>';
const PRINT_ICON_SMARTPHONE = '<svg viewBox="0 0 24 24" width="8" height="8"><rect x="6" y="2" width="12" height="20" rx="2" fill="#000"/><rect x="9.5" y="18" width="5" height="1.4" rx="0.7" fill="#fff"/></svg>';

// One stylesheet for the printed label and the on-screen preview, so the
// preview is the label itself, not an approximation of it. Three fixed
// zones: service number (top), QR + three detail rows (body), booking date
// + time (bottom) — no headings, pure black, everything on one line except
// a long brand + model, which may take two. The size comes from the preset
// (--ggl-w / --ggl-h, set on each label by labelMarkup).
const LABEL_CSS = `
  .ggl { width: var(--ggl-w); height: var(--ggl-h); padding: 1mm 1.4mm; display: flex; flex-direction: column; justify-content: space-between; gap: 0.5mm; overflow: hidden; box-sizing: border-box; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ggl * { box-sizing: border-box; }
  .ggl p { margin: 0; color: #000; }
  .ggl-no { text-align: center; font-size: 9px; font-weight: 800; letter-spacing: 0.2px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ggl-body { display: flex; align-items: center; gap: 1.2mm; flex: 1; min-height: 0; }
  .ggl-body img { display: block; width: 15mm; height: 15mm; flex-shrink: 0; image-rendering: pixelated; }
  .ggl-rows { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.7mm; }
  .ggl-row { display: flex; align-items: center; gap: 0.9mm; font-size: 6.5px; font-weight: 700; line-height: 1.15; }
  .ggl-row svg { flex-shrink: 0; }
  .ggl-row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ggl-row.ggl-device { font-weight: 800; }
  .ggl-row.ggl-device span { white-space: normal; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .ggl-date { text-align: center; font-size: 6.5px; font-weight: 700; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

// On-screen preview: the real-size label scaled up, ratio kept exactly to the
// preset (the wrapper carries the same --ggl-w / --ggl-h as the label).
const PREVIEW_CSS = `
  .ggl-preview { --ggl-scale: 1.25; width: calc(var(--ggl-w) * var(--ggl-scale)); height: calc(var(--ggl-h) * var(--ggl-scale)); overflow: hidden; }
  .ggl-preview > .ggl { transform: scale(var(--ggl-scale)); transform-origin: top left; }
  @media (min-width: 1024px) { .ggl-preview { --ggl-scale: 1.5; } }
`;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** One label's markup at the preset's size — every value escaped; shared by print and preview. */
function labelMarkup({ preset, qrSrc, trackingNo, brandModel, customerName, security, createdOn }) {
  return `<div class="ggl" style="--ggl-w:${preset.widthMm}mm;--ggl-h:${preset.heightMm}mm">
    <p class="ggl-no">${escapeHtml(trackingNo)}</p>
    <div class="ggl-body">
      <img src="${escapeHtml(qrSrc)}" alt="QR code" />
      <div class="ggl-rows">
        <p class="ggl-row ggl-device">${PRINT_ICON_SMARTPHONE}<span>${escapeHtml(brandModel)}</span></p>
        <p class="ggl-row">${PRINT_ICON_PERSON}<span>${escapeHtml(customerName)}</span></p>
        <p class="ggl-row">${PRINT_ICON_LOCK}<span>${escapeHtml(security)}</span></p>
      </div>
    </div>
    <p class="ggl-date">${createdOn ? `${escapeHtml(createdOn.date)}&nbsp;&nbsp;${escapeHtml(createdOn.time)}` : ''}</p>
  </div>`;
}

// Same as the Partner app's BarcodePrintScreen: "PIN · 1234", "Password · x",
// "Pattern · 1,2,3,6" (kept as stored so it can be redrawn), else "None".
function formatSecurity(type, value) {
  const t = String(type || 'NONE').toUpperCase();
  if (t === 'NONE') return 'None';
  const label = t === 'PIN' ? 'PIN' : t === 'PASSWORD' ? 'Password' : t === 'PATTERN' ? 'Pattern' : t.charAt(0) + t.slice(1).toLowerCase();
  const v = value == null ? '' : String(value).trim();
  return v ? `${label} · ${v}` : label;
}

// Booking's created-on stamp, as the app prints it: { date: "Fri, 2 Oct 2026", time: "4:07 PM" }.
function fmtCreatedOn(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const mo = d.toLocaleDateString('en-US', { month: 'short' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return { date: `${wd}, ${d.getDate()} ${mo} ${d.getFullYear()}`, time };
}

/** "Brand Model", without repeating a brand the model name already starts with. */
function joinBrandModel(brand, model) {
  const b = String(brand || '').trim();
  const m = String(model || '').trim();
  if (!m) return b;
  return b && !m.toLowerCase().startsWith(b.toLowerCase()) ? `${b} ${m}` : m;
}

export default function BookingQrPage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [booking, setBooking] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [printQrDataUrl, setPrintQrDataUrl] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const closePreview = useCallback(() => setPreviewing(false), []);
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const preset = getPreset(presetId);

  // Read after mount (not in the initializer) so the server render and the
  // first client render agree; storage may be blocked, which just means 38 x 25.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PRESET_STORAGE_KEY);
      if (saved) setPresetId(getPreset(saved).id);
    } catch {}
  }, []);

  function choosePreset(id) {
    setPresetId(id);
    try {
      window.localStorage.setItem(PRESET_STORAGE_KEY, id);
    } catch {}
  }

  useEffect(() => {
    setBooking(null);
    setTicket(null);
    setPreviewing(false);
    setError('');
    if (!id) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    fetchShopBookingDetail(id)
      .then(async (data) => {
        if (!data) return;
        const [enriched] = await enrichWithCatalog([data]).catch(() => [data]);
        // The ticket only fills gaps, so a failed read never hides the slip.
        const tk = enriched.ticketId ? await fetchTicket(enriched.ticketId).catch(() => null) : null;
        if (!alive) return;
        setBooking(enriched);
        setTicket(tk);
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

  // What the QR encodes — unchanged: the booking number as stored, else its id.
  const qrValue = booking?.bookingNumber || booking?.id || id;
  // Shown/printed text: the short ticket ID ("GTS-138"), never "##…".
  const trackingNo = String(bookingRef({ trackingId: ticket?.trackingId, bookingNumber: booking?.bookingNumber, id: booking?.id }) || id || '')
    .trim()
    .replace(/^#+/, '');
  const [tidPrefix, tidDigits] = (() => {
    const m = trackingNo.match(/^([A-Za-z-]*?)(\d[\s\S]*)?$/);
    return m ? [m[1], m[2] || ''] : [trackingNo, ''];
  })();
  const services = Array.isArray(booking?.services) ? booking.services : [];
  const servicesText = services.map((s) => s.serviceName || s.serviceCode).filter(Boolean).join(', ') || '—';
  const serviceCountLabel = services.length ? `${services.length} service${services.length === 1 ? '' : 's'} added` : '';
  const ticketModel = String(ticket?.deviceDisplayName || '').split(' · ')[0].trim();
  const brandModel = joinBrandModel(booking?.brandName, booking?.deviceDisplayName || booking?.modelName || ticketModel) || 'Device not specified';
  const variant = [booking?.ramStorage, booking?.color].filter(Boolean).join(' · ');
  const customerName = booking?.customerName || ticket?.customerName || 'Not available';
  const customerPhone = booking?.customerMobile || ticket?.customerPhone || '';
  const security = formatSecurity(booking?.deviceSecurityType || ticket?.deviceSecurityType, booking?.devicePin || ticket?.deviceSecurityValue);
  const createdOn = fmtCreatedOn(booking?.createdAt || ticket?.createdAt);
  const deviceImage = resolveMediaUrl(booking?.deviceImageUrl) || resolveMediaUrl(ticket?.deviceImageUrl) || resolveMediaUrl(booking?.brandImageUrl);
  const label = { trackingNo, brandModel, customerName, security, createdOn };

  // The label's QR: pure black modules with a generous quiet zone, as a
  // thermal printer needs (no dark-green-as-gray dithering). Preview = print.
  useEffect(() => {
    setPrintQrDataUrl('');
    if (!qrValue) return undefined;
    let cancelled = false;
    QRCode.toDataURL(String(qrValue), { width: 320, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } })
      .then((url) => {
        if (!cancelled) setPrintQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [qrValue]);

  function copyTrackingId() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(trackingNo)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  }

  function printSlip() {
    if (!printQrDataUrl) return;
    const slip = labelMarkup({ ...label, preset, qrSrc: printQrDataUrl });
    const win = window.open('', '_blank', 'width=420,height=320');
    if (!win) {
      notifyError('Allow pop-ups to print this slip.');
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Service Slip — ${escapeHtml(trackingNo)}</title>
      <style>
        @page { size: ${preset.widthMm}mm ${preset.heightMm}mm; margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; width: ${preset.widthMm}mm; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .ggl { page-break-after: always; }
        .ggl:last-child { page-break-after: auto; }
        ${LABEL_CSS}
      </style></head><body>${slip}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  return (
    <div className="-mx-4 -my-5 flex min-h-[calc(100vh-4rem)] flex-col bg-[#F3F4F6] sm:-mx-6 sm:-my-6">
      <style dangerouslySetInnerHTML={{ __html: LABEL_CSS + PREVIEW_CSS }} />
      {/* Header: back · QR E-Print / subtitle */}
      <div className="border-b border-[#E5E7EB] bg-white px-3.5 pb-3 pt-2.5">
        <div className="mx-auto flex max-w-[640px] lg:max-w-[1200px] items-center">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="mr-2.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F3F4F6] text-[#111111] transition hover:bg-[#E5E7EB]"
          >
            <ChevronLeft className="h-[19px] w-[19px]" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-extrabold text-[#111111]">QR E-Print</h1>
            <p className="mt-0.5 text-[11px] text-[#6B7280]">Generate and print a QR slip for easy tracking</p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[640px] lg:max-w-[1200px] flex-1 px-3.5 pb-6 pt-3">
        {loading ? (
          <div className="space-y-2.5">
            <div className="h-56 animate-pulse rounded-[18px] bg-white" />
            <div className="h-48 animate-pulse rounded-[18px] bg-white" />
          </div>
        ) : error ? (
          <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !booking ? (
          <EmptyState icon={AlertTriangle} tone="muted" title="Booking not found" description="We couldn't find this booking." />
        ) : (
          <div className="mx-auto max-w-[640px]">
            {/* Booking card: photo, device, variant, services; then tracking ID / customer / services / device lock */}
            <section className={CARD}>
              <div className="flex items-center">
                <DeviceThumb url={deviceImage} sizeClass="mr-3 h-16 w-[60px] rounded-[14px] border border-[#F3F4F6] bg-white p-1" onPreview={() => setPreviewing(true)} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#6B7280]">Booking</p>
                  <p className="mt-px break-words text-[15px] font-extrabold leading-[19px] text-[#111111]">{brandModel}</p>
                  {variant ? <p className="mt-0.5 text-[11px] text-[#6B7280]">{variant}</p> : null}
                  {serviceCountLabel ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#E5F3F5] px-2 py-[3px] text-[10px] font-extrabold text-[#035C6C]">
                      <Wrench className="h-2.5 w-2.5" aria-hidden="true" />
                      {serviceCountLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="mt-2.5 border-t border-[#F3F4F6]">
                <DetailRow label="Tracking ID">
                  <span className="flex items-center justify-end">
                    <span className="text-[13px] font-extrabold tracking-[0.2px]">
                      <span className="text-[#111111]">#{tidPrefix}</span>
                      <span className="text-[#035C6C]">{tidDigits}</span>
                    </span>
                    <button
                      type="button"
                      onClick={copyTrackingId}
                      className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#E5F3F5] px-2 py-1 text-[10px] font-extrabold text-[#035C6C] transition hover:bg-[#C7E6EA]"
                    >
                      <Copy className="h-[11px] w-[11px]" aria-hidden="true" />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </span>
                </DetailRow>
                <DetailRow label="Customer">
                  {[customerName, customerPhone].filter((v) => v && v !== 'Not available').join(' · ') || '—'}
                </DetailRow>
                <DetailRow label="Services">
                  {servicesText}
                </DetailRow>
                <DetailRow label="Device Lock" last>
                  {security}
                </DetailRow>
              </div>
            </section>

            {/* QR label preview — the printed label's own markup, at the chosen stock */}
            <section className={cx(CARD, 'mt-2.5')}>
              <div className="flex items-center">
                <span className="mr-[9px] flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[#E5F3F5] text-[#035C6C]">
                  <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold text-[#111111]">QR Label</p>
                  <p className="mt-px text-[11px] text-[#6B7280]">
                    {preset.name} · {presetSizeText(preset)}
                  </p>
                </div>
              </div>
              <div className="mb-1 mt-3 flex justify-center">
                <LabelPreview preset={preset} markup={printQrDataUrl ? labelMarkup({ ...label, preset, qrSrc: printQrDataUrl }) : ''} trackingNo={trackingNo} />
              </div>
              {/* Page Setup: the label stock loaded in the printer (remembered in this browser). */}
              <div role="radiogroup" aria-label="Page setup — label size" className="mt-3 grid grid-cols-2 gap-2 border-t border-[#F3F4F6] pt-3">
                {LABEL_PRESETS.map((p) => {
                  const selected = p.id === preset.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => choosePreset(p.id)}
                      className={cx(
                        'flex min-w-0 items-center gap-2 rounded-xl border-[1.5px] px-2.5 py-2 text-left transition',
                        selected ? 'border-[#035C6C] bg-[#E5F3F5]' : 'border-[#E5E7EB] bg-white hover:border-[#C7E6EA]',
                      )}
                    >
                      {selected ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#035C6C] text-white">
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                        </span>
                      ) : (
                        <span className="h-5 w-5 shrink-0 rounded-full border-2 border-[#D1D5DB]" aria-hidden="true" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-extrabold text-[#111111]">{p.name}</span>
                        <span className="block truncate text-[11px] text-[#6B7280]">{presetSizeText(p)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Sticky action bar: Print QR Slip */}
      {booking ? (
        <div className="sticky bottom-0 z-20 border-t border-[#E5E7EB] bg-white/95 px-3.5 py-2.5">
          <div className="mx-auto max-w-[640px]">
            <button
              type="button"
              onClick={printSlip}
              disabled={!printQrDataUrl}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#035C6C] to-[#035C6C] py-[13px] text-[13px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-70"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print QR Slip
            </button>
          </div>
        </div>
      ) : null}

      <ImagePreviewModal
        open={previewing}
        src={deviceImage}
        title={brandModel}
        subtitle={[trackingNo ? `#${trackingNo}` : '', booking?.color].filter(Boolean).join(' • ')}
        onClose={closePreview}
      />
    </div>
  );
}

// The app's white cards: radius 18, padding 12, hairline border, soft shadow.
const CARD = 'rounded-xl border border-[#F3F4F6] bg-white p-3 shadow-[0_3px_10px_rgba(17,17,17,0.05)]';

// The printed label's own markup + CSS (escaped values and the generated
// data: QR only), scaled up — so the preview can't drift from the print.
// LABEL_CSS + PREVIEW_CSS are injected once at the top of the page.
function LabelPreview({ preset, markup, trackingNo }) {
  const size = { '--ggl-w': `${preset.widthMm}mm`, '--ggl-h': `${preset.heightMm}mm` };
  return markup ? (
    <span
      role="img"
      aria-label={`${preset.name} label preview for ${trackingNo}`}
      style={size}
      className="ggl-preview block shrink-0 rounded-md bg-white ring-[1.5px] ring-[#111111]"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  ) : (
    <span style={size} className="ggl-preview flex shrink-0 items-center justify-center rounded-md bg-white text-xs text-[#9CA3AF] ring-[1.5px] ring-[#E5E7EB]">
      Generating…
    </span>
  );
}

// Booking-card line: label left, the full value right (wraps).
function DetailRow({ label, children, last }) {
  return (
    <div className={cx('flex items-center py-[7px]', !last && 'border-b border-[#F3F4F6]')}>
      <span className="w-[78px] shrink-0 text-[11px] font-semibold text-[#6B7280]">{label}</span>
      <div className="min-w-0 flex-1 break-words text-right text-[12px] font-bold text-[#111111]">{children}</div>
    </div>
  );
}
