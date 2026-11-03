'use client';

/**
 * /shop-home/services/invoice/report/?ticketId=… — Deliver Invoice, laid out
 * like the Partner app's DeliveryInvoiceReportScreen:
 *
 *   - Header: back · "Deliver Invoice" / #invoiceNo · Download · Share ·
 *     Print (Download / Print open the A4 invoice — the app's PDF layout,
 *     lib/invoice.js buildInvoiceHtml — and print it: "Save as PDF").
 *   - Summary (invoice total, status, delivery date, Edit Invoice), Shop
 *     Details, Customer & Device, Repair Items (A · Service Charges, B ·
 *     Spare Parts, each line expandable to its GST split), Tax & Payment,
 *     Declaration.
 *   - Bottom bar: Preview PDF, and Confirm Delivery while the booking is Out
 *     for Delivery (records "Delivered to Customer").
 *   - Billing & Handover (web): Invoice Ready → Delivered Processing →
 *     Delivered, each POST /tickets/{id}/progress-events, in order.
 *
 * Data: GET /tickets/{id}, GET /tickets/{id}/invoice, GET /tickets/{id}/events,
 * the shop's public card (GET /auth/shops/{shopId}/public) and, when the
 * ticket has no address, GET /customers/lookup?mobile=. The app's Delete
 * Invoice isn't offered: the web has no invoice-delete call.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleCheckBig,
  Download,
  Eye,
  FileText,
  ListChecks,
  Loader2,
  Pencil,
  Printer,
  Share2,
  Smartphone,
  Store,
  Truck,
  UserRound,
  Wrench,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import { withHash } from '@/components/shop-dashboard/OrdersList';
import { fetchTicket } from '@/lib/shopDashboard';
import { getShopPublic } from '@/lib/repairBooking';
import { readShopOwner } from '@/lib/shopAuth';
import { bookingRef } from '@/lib/orderStages';
import {
  HANDOFF_STEPS,
  buildInvoiceHtml,
  fetchEvents,
  fetchInvoice,
  fmt,
  formatDateTime,
  handoffDone,
  invoiceBreakdown,
  invoicePayment,
  lookupCustomer,
  recordProgress,
} from '@/lib/invoice';
import { notifyError, notifySuccess } from '@/lib/toast';

const TEAL = '#035C6C';
const AMBER = '#B45309';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
// The app's cards: white, radius 16, padding 16, soft shadow.
const CARD = 'mt-3 rounded-2xl bg-white p-4 shadow-[0_10px_18px_rgba(17,17,17,0.08)]';
// Edit Invoice is offered until the device has left the shop (app rule).
const EDIT_CLOSED = ['DELIVERED_PROCESSING', 'DELIVERED', 'CANCELLED', 'RETURNED'];
const STATUS_LABEL = {
  READY: 'Ready for Delivery',
  RETURN_DELIVERY: 'Return Delivery',
  INVOICE_GENERATED: 'Invoice Generated',
  INVOICE_READY: 'Invoice Sent',
  DELIVERED_PROCESSING: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};
const humanize = (s) =>
  String(s || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
// "02 Oct 2026"
const shortDate = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
};

function CardTitle({ icon: Icon, title, right }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C]">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 text-[14px] font-extrabold text-[#111111]">{title}</p>
      {right}
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <p className="flex gap-1 text-[10.5px]">
      <span className="w-[84px] shrink-0 text-[#6B7280]">{label}</span>
      <span className="text-[#6B7280]">:</span>
      <span className="min-w-0 break-words font-bold text-[#111111]">{value || '—'}</span>
    </p>
  );
}

function KV({ label, value }) {
  if (!value) return null;
  return (
    <p className="flex gap-2 py-0.5 text-[11.5px]">
      <span className="w-[72px] shrink-0 text-[#6B7280]">{label}</span>
      <span className="min-w-0 flex-1 break-words font-semibold text-[#111111]">{value}</span>
    </p>
  );
}

function Line({ label, value, color, bold }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-[12px]">
      <span className="text-[#6B7280]">{label}</span>
      <span className={bold ? 'font-extrabold' : 'font-bold'} style={{ color: color || '#111111' }}>
        {value}
      </span>
    </div>
  );
}

/** One repair item: title, meta, total; the chevron opens its GST split. */
function ItemRow({ title, meta, br, open, onToggle }) {
  return (
    <div className="border-b border-[#F3F4F6] py-2 last:border-b-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[12.5px] font-bold text-[#111111]">{title || '—'}</span>
          <span className="block text-[11px] text-[#6B7280]">{meta}</span>
        </span>
        <span className="shrink-0 text-[12.5px] font-extrabold text-[#111111]">₹{fmt(br.total)}</span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-[#6B7280] transition', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open ? (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-[#F8FAFB] p-2.5 text-[11.5px] sm:grid-cols-4">
          <span className="text-[#6B7280]">
            Taxable <b className="block text-[#111111]">₹{fmt(br.base)}</b>
          </span>
          <span className="text-[#6B7280]">
            CGST <b className="block text-[#111111]">₹{fmt(br.cgst)}</b>
          </span>
          <span className="text-[#6B7280]">
            SGST <b className="block text-[#111111]">₹{fmt(br.sgst)}</b>
          </span>
          <span className="text-[#6B7280]">
            Total GST <b className="block text-[#111111]">₹{fmt(br.totalGst)}</b>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SubHeader({ title, total }) {
  return (
    <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-1.5 pt-1 text-[11px] font-extrabold text-[#035C6C]">
      <span>{title}</span>
      <span>₹{fmt(total)}</span>
    </div>
  );
}

export default function DeliverInvoicePage() {
  const ticketId = useSearchParams().get('ticketId');
  const router = useRouter();
  const [ticket, setTicket] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [events, setEvents] = useState([]);
  const [shop, setShop] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyStep, setBusyStep] = useState(null);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError('');
    try {
      const [t, inv, ev] = await Promise.all([fetchTicket(ticketId), fetchInvoice(ticketId), fetchEvents(ticketId).catch(() => [])]);
      setTicket(t || {});
      setInvoice(inv || null);
      setEvents(ev);
      if (t?.shopId) getShopPublic(t.shopId).then((s) => setShop(s || null));
      if (t?.customerPhone && !t?.customerAddress) {
        lookupCustomer(t.customerPhone)
          .then((c) => setCustomer(c || null))
          .catch(() => {});
      }
    } catch (err) {
      setError(err.message || 'Could not load the invoice.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  const owner = useMemo(() => readShopOwner() || {}, []);
  const shopName = shop?.name || shop?.shopName || ticket?.shopName || 'NearGFix Service Center';
  const shopMobile = shop?.mobile || owner?.phone || '';
  const shopAddress = shop?.address || ticket?.shopAddress || '';
  const shopGst = shop?.gstNumber || invoice?.gstNo || '';
  const ownerName = owner?.name || owner?.ownerName || '';
  const customerName = ticket?.customerName || '';
  // Short ticket ID ("#GTS-138"): the ticket's trackingId, else its booking number without the suffix.
  const trackingId = withHash((ticket && bookingRef(ticket)) || invoice?.invoiceNo || ticketId);
  const composedAddr = customer
    ? [customer.addressLine, customer.area || customer.locality, customer.district || customer.city, customer.state, customer.pincode].filter((p) => p && String(p).trim()).join(', ')
    : '';
  const customerAddress = ticket?.customerAddress || customer?.address || composedAddr || '';

  const b = useMemo(() => (invoice ? invoiceBreakdown(invoice) : null), [invoice]);
  const p = useMemo(() => (invoice ? invoicePayment(invoice) : null), [invoice]);
  const done = useMemo(() => handoffDone(events), [events]);

  const html = () => buildInvoiceHtml({ invoice, ticket, shopName, shopMobile, shopAddress, shopGst, ownerName, customerName, customerAddress, trackingId });

  // The A4 invoice in its own window; print = the browser's Print / Save as PDF.
  function openInvoice(print) {
    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) {
      notifyError('Allow pop-ups to print or save the invoice.');
      return;
    }
    win.document.write(html());
    win.document.close();
    win.focus();
    if (print) setTimeout(() => win.print(), 300);
  }
  const printInvoice = () => openInvoice(true);

  function shareInvoice() {
    const digits = String(ticket?.customerPhone || '').replace(/\D/g, '').slice(-10);
    const lines = [
      `🧾 *Invoice ${invoice.invoiceNo}* — ${shopName}`,
      `Tracking ID: ${trackingId}`,
      `Invoice Total: ₹${fmt(invoice.finalPayableAmount)}`,
      p.shown ? `Balance Payable: ₹${fmt(p.creditAmount)}` : null,
      invoice.amountInWords || null,
    ].filter(Boolean);
    window.open(`https://wa.me/${digits.length === 10 ? `91${digits}` : ''}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener,noreferrer');
  }

  async function submitStep(step) {
    const idx = HANDOFF_STEPS.findIndex((s) => s.key === step.key);
    const prev = HANDOFF_STEPS[idx - 1];
    if (prev && !done[prev.key]) {
      notifyError(`Mark "${prev.label}" before recording "${step.label}".`);
      return;
    }
    if (!window.confirm(step.confirm || `Record "${step.label}" for this booking?`)) return;
    setBusyStep(step.key);
    try {
      await recordProgress(ticketId, step.key);
      notifySuccess(`"${step.label}" recorded.`);
      setEvents(await fetchEvents(ticketId).catch(() => events));
    } catch (err) {
      notifyError(err, 'Could not save this step.');
    } finally {
      setBusyStep(null);
    }
  }


  const [openItems, setOpenItems] = useState({});
  const toggleItem = (key) => setOpenItems((o) => ({ ...o, [key]: !o[key] }));
  const statusKey = String(ticket?.status || '').toUpperCase();
  const statusText = STATUS_LABEL[statusKey] || humanize(statusKey);
  const gstPct = Number(invoice?.gstPercent) || 0;
  const gstApplied = invoice && invoice.taxMode !== 'WITHOUT' && gstPct > 0;
  const deviceName = ticket?.deviceDisplayName || ticket?.deviceModelName || ticket?.modelName || '';
  const deliverStep = HANDOFF_STEPS.find((s) => s.key === 'DELIVERED');
  const canConfirmDelivery = statusKey === 'DELIVERED_PROCESSING' && !done.DELIVERED;
  const headerBtn = cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C] transition hover:bg-[#C7E6EA]', FOCUS_RING);

  return (
    <div className="-mx-4 -my-5 min-h-[calc(100vh-4rem)] bg-[#F3F4F6] sm:-mx-6 sm:-my-6">
      {/* Header: back · Deliver Invoice / #invoiceNo · Download · Share · Print */}
      <div className="flex items-center gap-2.5 border-b border-[#E5E7EB] bg-white px-3.5 pb-3 pt-2.5">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[#111111] transition hover:bg-[#E5E7EB]', FOCUS_RING)}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-extrabold text-[#111111]">Deliver Invoice</h1>
          {invoice ? <p className="truncate text-[11.5px] font-extrabold text-[#035C6C]">{withHash(invoice.invoiceNo)}</p> : null}
        </div>
        {invoice ? (
          <>
            <button type="button" onClick={printInvoice} aria-label="Download invoice" title="Download (Save as PDF)" className={headerBtn}>
              <Download className="h-[17px] w-[17px]" aria-hidden="true" />
            </button>
            <button type="button" onClick={shareInvoice} aria-label="Share invoice on WhatsApp" title="Share on WhatsApp" className={headerBtn}>
              <Share2 className="h-[17px] w-[17px]" aria-hidden="true" />
            </button>
            <button type="button" onClick={printInvoice} aria-label="Print invoice" title="Print" className={headerBtn}>
              <Printer className="h-[17px] w-[17px]" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      <div className={cx('mx-auto w-full max-w-[760px] px-3.5 pt-0.5', invoice ? 'pb-28' : 'pb-8')}>
        {!ticketId ? (
          <p className="mt-4 text-[14px] text-[#6B7280]">Open an invoice from a booking.</p>
        ) : loading ? (
          <div className="mt-3 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] font-semibold text-[#B42318]">{error}</p>
        ) : !invoice ? (
          <div className="mt-3 flex flex-col items-center rounded-2xl bg-[#E5F3F5] px-6 py-12 text-center">
            <p className="text-[16px] font-extrabold text-[#111111]">No invoice generated yet</p>
            <p className="mt-1 text-[13.5px] text-[#6B7280]">Create one with the Invoice Generator.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => router.back()}
                className={cx('inline-flex h-11 items-center rounded-2xl border-[1.5px] border-[#035C6C] bg-white px-5 text-[14px] font-extrabold text-[#035C6C]', FOCUS_RING)}
              >
                Go Back
              </button>
              <Link
                href={`/shop-home/services/invoice/generate/?ticketId=${encodeURIComponent(ticketId)}`}
                className={cx('inline-flex h-11 items-center gap-2 rounded-2xl bg-[#035C6C] px-6 text-[14px] font-extrabold text-white', FOCUS_RING)}
              >
                Open Invoice Generator
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 1 · Summary */}
            <section className="mt-3 rounded-2xl bg-[#E5F3F5] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.1em] text-[#6B7280]">INVOICE TOTAL</p>
                  <p className="text-[24px] font-extrabold leading-tight text-[#111111]">₹{fmt(invoice.finalPayableAmount)}</p>
                </div>
                {statusText ? (
                  <span
                    className={cx('rounded-full px-2.5 py-1 text-[11px] font-extrabold', statusKey === 'DELIVERED' ? 'bg-[#EAF3E2] text-[#609138]' : 'bg-white text-[#035C6C]')}
                  >
                    {statusText}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[12px] text-[#6B7280]">
                Delivery Date <b className="text-[#111111]">{shortDate(invoice.generatedAt || invoice.deliveryDate)}</b>
                <span className="mx-1.5 text-[#C7E6EA]">|</span>
                Tracking ID <b className="text-[#111111]">{trackingId}</b>
              </p>
              {!EDIT_CLOSED.includes(statusKey) ? (
                <Link
                  href={`/shop-home/services/invoice/generate/?ticketId=${encodeURIComponent(ticketId)}`}
                  className={cx('mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-[12.5px] font-extrabold text-[#035C6C] transition hover:bg-[#F3F4F6]', FOCUS_RING)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit Invoice
                </Link>
              ) : null}
            </section>

            {/* 2 · Shop details */}
            <section className={CARD}>
              <CardTitle icon={Store} title="Shop Details" right={<span className="text-[10.5px] font-bold text-[#6B7280]">Original for Deliver Receipt</span>} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="break-words text-[16px] font-extrabold text-[#035C6C]">{shopName}</p>
                  {ownerName ? <p className="text-[12px] font-semibold text-[#374151]">{ownerName}</p> : null}
                  {shopMobile ? <p className="mt-1 text-[11.5px] text-[#6B7280]">Mobile: {shopMobile}</p> : null}
                  {shopAddress ? <p className="break-words text-[11.5px] text-[#6B7280]">{shopAddress}</p> : null}
                  {shopGst ? <p className="text-[11.5px] font-semibold text-[#111111]">GSTIN: {shopGst}</p> : null}
                </div>
                <div className="border-t border-[#E5E7EB] pt-2.5 sm:border-t-0 sm:pt-0">
                  <Meta label="Invoice No" value={invoice.invoiceNo} />
                  <Meta label="Ticket Date" value={formatDateTime(invoice.ticketDate)} />
                  <Meta label="Delivery Date" value={formatDateTime(invoice.generatedAt || invoice.deliveryDate)} />
                </div>
              </div>
            </section>

            {/* 3 · Customer & device */}
            <section className={CARD}>
              <CardTitle icon={UserRound} title="Customer & Device" />
              <p className="text-[14px] font-extrabold text-[#111111]">{customerName || '—'}</p>
              <KV label="Mobile" value={ticket?.customerPhone} />
              <KV label="Alt. Mobile" value={customer?.alternatePhone || customer?.altPhone} />
              <KV label="Address" value={customerAddress} />
              <div className="my-2.5 h-px bg-[#E5E7EB]" />
              <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-[#111111]">
                <Smartphone className="h-4 w-4 shrink-0 text-[#035C6C]" aria-hidden="true" />
                {deviceName || 'Device'}
              </p>
              <KV label="Category" value={ticket?.deviceCategory || ticket?.categoryName} />
              <KV label="Brand" value={ticket?.brandName} />
              <KV label="Model No" value={ticket?.modelNumber} />
              <KV label="Variant" value={ticket?.variant || ticket?.ramStorage} />
              <KV label="IMEI" value={ticket?.imei} />
              <KV label="Serial No" value={ticket?.serialNumber} />
              <KV label="Complaint" value={ticket?.issueDescription} />
            </section>

            {/* 4 · Repair items */}
            <section className={CARD}>
              <CardTitle icon={Wrench} title="Repair Items" />
              <SubHeader title="A · Service Charges" total={b.service.total} />
              {b.serviceLines.length ? (
                b.serviceLines.map((r, i) => (
                  <ItemRow
                    key={`s${i}`}
                    title={r.description}
                    meta={`Rate ₹${fmt(r.rate)} · GST ₹${fmt(b.serviceBreaks[i].totalGst)}`}
                    br={b.serviceBreaks[i]}
                    open={!!openItems[`s${i}`]}
                    onToggle={() => toggleItem(`s${i}`)}
                  />
                ))
              ) : (
                <p className="py-2 text-[12px] text-[#9CA3AF]">No service charges</p>
              )}
              <div className="mt-3">
                <SubHeader title="B · Spare Parts" total={b.spares.total} />
                {b.spareLines.length ? (
                  b.spareLines.map((r, i) => (
                    <ItemRow
                      key={`p${i}`}
                      title={r.description}
                      meta={[`${Number(r.qty || 1)} × ₹${fmt(r.rate)}`, r.warranty].filter(Boolean).join(' · ')}
                      br={b.spareBreaks[i]}
                      open={!!openItems[`p${i}`]}
                      onToggle={() => toggleItem(`p${i}`)}
                    />
                  ))
                ) : (
                  <p className="py-2 text-[12px] text-[#9CA3AF]">No spare parts</p>
                )}
              </div>
            </section>

            {/* 5 · Tax & payment */}
            <section className={CARD}>
              <CardTitle icon={FileText} title="Tax & Payment" />
              <Line label="Taxable Amount" value={`₹${fmt(b.grand.base)}`} />
              {gstApplied ? (
                <>
                  <Line label={`CGST (${gstPct / 2}%)`} value={`₹${fmt(b.grand.cgst)}`} />
                  <Line label={`SGST (${gstPct / 2}%)`} value={`₹${fmt(b.grand.sgst)}`} />
                </>
              ) : (
                <Line label="GST" value="Not applied" />
              )}
              {Number(invoice.discount) > 0 ? <Line label="Discount" value={`− ₹${fmt(invoice.discount)}`} color={AMBER} /> : null}
              <div className="mt-2 flex items-center justify-between rounded-xl bg-[#035C6C] px-4 py-3 text-white">
                <span className="text-[13px] font-extrabold">Invoice Total</span>
                <span className="text-[17px] font-extrabold">₹{fmt(invoice.finalPayableAmount)}</span>
              </div>
              {invoice.amountInWords ? <p className="mt-2 text-[11px] italic text-[#6B7280]">In words: {invoice.amountInWords}</p> : null}
              <div className="mt-3 border-t border-[#E5E7EB] pt-2">
                {p.shown ? (
                  <>
                    {p.advancePaid > 0 ? (
                      <>
                        <Line label="Advance Paid" value={`₹${fmt(p.advancePaid)}`} />
                        <Line label="Net Payable" value={`₹${fmt(p.netPayable)}`} />
                      </>
                    ) : null}
                    <Line label="Amount Paid" value={`₹${fmt(p.advancePaid + p.amountPaid)}`} />
                    <Line label="Balance Payable" value={`₹${fmt(p.creditAmount)}`} color={p.creditAmount > 0 ? AMBER : TEAL} bold />
                    <span
                      className={cx(
                        'mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold',
                        p.creditAmount > 0 ? 'bg-[#FEF3C7] text-[#B45309]' : 'bg-[#EAF3E2] text-[#609138]',
                      )}
                    >
                      {p.creditAmount > 0 ? <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" /> : <CircleCheckBig className="h-3.5 w-3.5" aria-hidden="true" />}
                      {p.creditAmount > 0 ? `Balance due ₹${fmt(p.creditAmount)}` : 'Payment Completed'}
                    </span>
                    {invoice.paymentNote ? <p className="mt-2 text-[11.5px] italic text-[#6B7280]">Note: {invoice.paymentNote}</p> : null}
                  </>
                ) : (
                  <p className="py-1 text-[12px] text-[#6B7280]">No payment recorded on this invoice.</p>
                )}
              </div>
            </section>

            {/* 6 · Declaration */}
            <p className="mt-3 px-1 text-[10.5px] text-[#6B7280]">
              <b>Declaration:</b> We declare that this invoice reflects the actual service charges and spare parts used for the above-mentioned device, and all the
              particulars stated above are true and correct.
            </p>

            {/* Billing & handover (web): each step in order */}
            <section className={CARD}>
              <CardTitle icon={ListChecks} title="Billing & Handover" />
              <p className="mb-3 text-[12px] text-[#6B7280]">Record each step as it happens: Invoice Generated → Invoice Ready → Delivered Processing → Delivered to Customer.</p>
              <div className="space-y-2">
                {HANDOFF_STEPS.map((step) => {
                  const isDone = !!done[step.key];
                  const busy = busyStep === step.key;
                  const auto = step.key === 'INVOICE_GENERATED';
                  return (
                    <button
                      key={step.key}
                      type="button"
                      disabled={isDone || busy || auto}
                      onClick={() => submitStep(step)}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-2xl border-[1.5px] p-3 text-left transition',
                        FOCUS_RING,
                        isDone ? 'border-[#035C6C] bg-[#E5F3F5]' : 'border-[#E5E7EB] bg-white hover:border-[#035C6C]',
                        auto && !isDone && 'cursor-default opacity-70',
                      )}
                    >
                      <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', isDone ? 'bg-[#035C6C] text-white' : 'bg-[#E5F3F5] text-[#035C6C]')}>
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cx('block text-[14px] font-extrabold', isDone ? 'text-[#035C6C]' : 'text-[#111111]')}>{step.label}</span>
                        <span className="block text-[12px] text-[#6B7280]">{step.hint}</span>
                      </span>
                      <span
                        className={cx(
                          'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold tracking-wide',
                          isDone ? 'bg-[#035C6C] text-white' : 'bg-[#E5F3F5] text-[#035C6C]',
                        )}
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                        {isDone ? 'DONE' : busy ? 'SAVING' : auto ? 'AUTO' : 'SUBMIT'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Bottom bar: Preview PDF · Confirm Delivery (Out for Delivery only) */}
      {invoice ? (
        <div className="sticky bottom-0 z-20 border-t border-[#E5E7EB] bg-white px-3.5 py-3">
          <div className="mx-auto flex max-w-[760px] gap-2.5">
            <button
              type="button"
              onClick={() => openInvoice(false)}
              className={cx('inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#035C6C] bg-white text-[14px] font-extrabold text-[#035C6C] transition hover:bg-[#E5F3F5]', FOCUS_RING)}
            >
              <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
              Preview PDF
            </button>
            {canConfirmDelivery && deliverStep ? (
              <button
                type="button"
                onClick={() => submitStep(deliverStep)}
                disabled={busyStep === 'DELIVERED'}
                className={cx('inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#035C6C] text-[14px] font-extrabold text-white transition hover:bg-[#024A57] disabled:opacity-60', FOCUS_RING)}
              >
                {busyStep === 'DELIVERED' ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" /> : <Truck className="h-[18px] w-[18px]" aria-hidden="true" />}
                Confirm Delivery
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
