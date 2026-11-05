/**
 * invoice.js — the Partner app's invoice flow on the web (ported from
 * InvoiceGeneratorScreen / DeliveryInvoiceReportScreen / DeliveryInvoiceScreen).
 *
 * Endpoints (ticket-service):
 *   GET  {TICKET_BASE}/tickets/{id}/invoice          InvoiceResponse (404 = none yet)
 *   POST {TICKET_BASE}/tickets/{id}/invoice          InvoiceRequest -> InvoiceResponse
 *        (the server posts any credit to the customer's Cash Book account and
 *        returns creditLedgerEntryId when it did)
 *   POST {TICKET_BASE}/tickets/{id}/progress-events  { statusKey, note?, actor }
 *   GET  {TICKET_BASE}/tickets/{id}/events           Service History rows
 *   GET  {TICKET_BASE}/customers/lookup?mobile=      customer (address fallback)
 *
 * Every formula below is the app's, unchanged, so a bill generated on the web
 * and one generated in the app say the same thing.
 */

import { TICKET_BASE } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';
import { normalizeLedgerPhone } from '@/lib/cashBook';

/* ------------------------------------------------------------------ API */

export async function fetchInvoice(ticketId) {
  try {
    return (await shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}/invoice`)) || null;
  } catch (err) {
    if (err?.status === 404) return null;
    throw err;
  }
}

export async function saveInvoice(ticketId, body) {
  return shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}/invoice`, { method: 'POST', body: JSON.stringify(body) });
}

/** Record a Service History step (idempotent server-side). */
export async function recordProgress(ticketId, statusKey, { note, actor = 'OWNER' } = {}) {
  return shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}/progress-events`, {
    method: 'POST',
    body: JSON.stringify({ statusKey, actor, ...(note ? { note } : {}) }),
  });
}

export async function fetchEvents(ticketId) {
  const ev = await shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}/events`);
  return Array.isArray(ev) ? ev : ev?.content ?? [];
}

export async function lookupCustomer(mobile) {
  return shopRequest(TICKET_BASE(), `/customers/lookup?mobile=${encodeURIComponent(mobile)}`);
}

/* ------------------------------------------------------- Service History */

const doneKeys = (events) => new Set((events || []).map((e) => String(e.status || '').toUpperCase()));

/**
 * The step a new invoice is waiting on, or null. "Invoice Generated" follows
 * Ready for Delivery (repaired) or Return Delivery (returned unrepaired).
 */
export function invoiceBlockedBy(events) {
  const done = doneKeys(events);
  return done.has('READY') || done.has('RETURN_DELIVERY') ? null : 'Ready for Delivery';
}

/** Billing & handover steps after the invoice, in the backend's lifecycle order. */
export const HANDOFF_STEPS = [
  { key: 'INVOICE_GENERATED', label: 'Invoice Generated', hint: 'Recorded automatically when the invoice is generated.' },
  { key: 'INVOICE_READY', label: 'Invoice Ready', hint: 'Mark when the invoice is finalized and ready for customer payment.' },
  { key: 'DELIVERED_PROCESSING', label: 'Delivered to Customer Processing', hint: 'The handover has started but the customer has not received the device yet.' },
  {
    key: 'DELIVERED',
    label: 'Delivered to Customer',
    hint: 'Final step — only once the customer has physically received the device.',
    confirm: 'This marks the booking as DELIVERED — the terminal state. Only confirm once the customer has physically received the device.',
  },
];
export const handoffDone = (events) => {
  const done = doneKeys(events);
  return Object.fromEntries(HANDOFF_STEPS.map((s) => [s.key, done.has(s.key)]));
};

/* --------------------------------------------------------------- Helpers */

export const TAX_MODES = [
  { value: 'WITHOUT', label: 'Without' },
  { value: 'INCLUSIVE', label: 'Inclusive' },
  { value: 'EXCLUSIVE', label: 'Exclusive' },
];
export const GST_OPTIONS = [0, 3, 5, 12, 18, 28];

export const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (s) => {
  const n = Number(String(s ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
/** YYYY-MM-DD in the local calendar (not UTC). */
export function toApiDate(d) {
  const x = d instanceof Date ? d : new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
export const isValidPhone = (v) => normalizeLedgerPhone(v).length === 10;

export function safeJson(s, fallback) {
  if (!s) return fallback;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function priceItemsFromTicket(ticket) {
  if (Array.isArray(ticket?.priceItems)) return ticket.priceItems;
  const parsed = safeJson(ticket?.priceItemsJson, null);
  if (parsed) return parsed;
  return ticket?.services?.map?.((s) => ({ id: s.id, label: s.serviceName, amount: s.price })) || [];
}

/** Indian-numbering words (lakh / crore). */
export function numberToIndianWords(num) {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return '';
  const n = Math.round(Number(num));
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ` ${ones[x % 10]}` : ''));
  const three = (x) => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return (h ? `${ones[h]} Hundred${r ? ' and ' : ''}` : '') + (r ? two(r) : '');
  };
  let s = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thou = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) s += `${two(crore)} Crore `;
  if (lakh) s += `${two(lakh)} Lakh `;
  if (thou) s += `${two(thou)} Thousand `;
  if (rest) s += three(rest);
  return s.trim();
}

/* ------------------------------------------------- Generator calculations */

export function computeTotals({ serviceCharges, discount, spareLines, gstPercent, taxMode }) {
  const sc = Number(serviceCharges) || 0;
  const disc = Number(discount) || 0;
  const totalRepairAmount = spareLines.reduce((s, r) => s + (Number(r.rate) || 0) * (Number(r.qty) || 1), 0);
  const spareUtility = spareLines.reduce((s, r) => s + (Number(r.taxableValue) || 0) * (Number(r.qty) || 1), 0);
  const amount2plus3 = sc + spareUtility - disc;
  const gst = Number(gstPercent) || 0;
  let baseAmount;
  let totalGst;
  let finalPayable;
  if (taxMode === 'INCLUSIVE') {
    baseAmount = gst > 0 ? amount2plus3 / (1 + gst / 100) : amount2plus3;
    totalGst = amount2plus3 - baseAmount;
    finalPayable = amount2plus3;
  } else if (taxMode === 'EXCLUSIVE') {
    baseAmount = amount2plus3;
    totalGst = amount2plus3 * (gst / 100);
    finalPayable = amount2plus3 + totalGst;
  } else {
    baseAmount = amount2plus3;
    totalGst = 0;
    finalPayable = amount2plus3;
  }
  return { serviceCharges: sc, discount: disc, totalRepairAmount, spareUtility, amount2plus3, baseAmount, totalGst, finalPayable };
}

/** Per-row CGST/SGST table (rows A = service charges, B… = spares). */
export function computeChargesSummary({ taxMode, gstPercent, serviceCharges, spareLines }) {
  const gst = Number(gstPercent) || 0;
  const halfRate = gst / 200;
  const buildRow = (label, gross) => {
    let base;
    let totalGstRow;
    let total;
    if (taxMode === 'INCLUSIVE') {
      base = gst > 0 ? gross / (1 + gst / 100) : gross;
      totalGstRow = +(gross - base).toFixed(2);
      total = +gross.toFixed(2);
    } else {
      base = gross;
      totalGstRow = +(base * (gst / 100)).toFixed(2);
      total = +(base + totalGstRow).toFixed(2);
    }
    const cgst = +(base * halfRate).toFixed(2);
    const sgst = +(base * halfRate).toFixed(2);
    return { label, base: +base.toFixed(2), cgst, sgst, rounded: +(cgst + sgst - totalGstRow).toFixed(2), totalGst: totalGstRow, total };
  };
  const rows = [];
  if (serviceCharges > 0) rows.push(buildRow('A', serviceCharges));
  spareLines.forEach((sp, i) => {
    const gross = (Number(sp.taxableValue) || 0) * (Number(sp.qty) || 1);
    if (gross > 0) rows.push(buildRow(String.fromCharCode(66 + i), gross));
  });
  return rows;
}

/** Advance → net → paid now → credit, clamped like the server does. */
export function computePayment(finalPayable, advancePaid, paidNowStr) {
  const advance = Math.min(Math.max(advancePaid, 0), Math.max(finalPayable, 0));
  const netPayable = Math.max(0, finalPayable - advance);
  const paidNow = Math.min(money(paidNowStr), netPayable);
  const credit = Math.max(0, netPayable - paidNow);
  return { finalPayable, advance, netPayable, paidNow, credit, settled: credit <= 0 };
}

/* ---------------------------------------------------- Report calculations */

/** Per-line and total breakdowns for the Deliver Invoice report. */
export function invoiceBreakdown(invoice) {
  const spareLines = safeJson(invoice.spareLinesJson, []);
  const serviceLines = safeJson(invoice.serviceLinesJson, []);
  const gstPct = Number(invoice.gstPercent) || 0;
  const halfGst = gstPct / 2;
  const breakRow = (gross) => {
    if (invoice.taxMode === 'WITHOUT' || gstPct === 0) return { base: +gross.toFixed(2), cgst: 0, sgst: 0, totalGst: 0, total: +gross.toFixed(2) };
    if (invoice.taxMode === 'INCLUSIVE') {
      const base = gross / (1 + gstPct / 100);
      const cgst = +(base * (halfGst / 100)).toFixed(2);
      const sgst = +(base * (halfGst / 100)).toFixed(2);
      return { base: +base.toFixed(2), cgst, sgst, totalGst: +(gross - base).toFixed(2), total: +gross.toFixed(2) };
    }
    const cgst = +(gross * (halfGst / 100)).toFixed(2);
    const sgst = +(gross * (halfGst / 100)).toFixed(2);
    const t = +(gross * (gstPct / 100)).toFixed(2);
    return { base: +gross.toFixed(2), cgst, sgst, totalGst: t, total: +(gross + t).toFixed(2) };
  };
  // Prefer the breakdown the generator stored on each line.
  const breakLine = (row, fallbackGross) => {
    if (row && (row.totalGst !== undefined || row.cgst !== undefined || row.totalAmount !== undefined)) {
      const cgst = Number(row.cgst) || 0;
      const sgst = Number(row.sgst) || 0;
      const totalGst = Number(row.totalGst) || 0;
      const total = Number(row.totalAmount) || fallbackGross;
      return { base: +(total - totalGst).toFixed(2), cgst, sgst, totalGst, total };
    }
    return breakRow(fallbackGross);
  };
  const accumulate = (rows) =>
    rows.reduce(
      (a, b) => ({
        base: +(a.base + b.base).toFixed(2),
        cgst: +(a.cgst + b.cgst).toFixed(2),
        sgst: +(a.sgst + b.sgst).toFixed(2),
        totalGst: +(a.totalGst + b.totalGst).toFixed(2),
        total: +(a.total + b.total).toFixed(2),
      }),
      { base: 0, cgst: 0, sgst: 0, totalGst: 0, total: 0 },
    );
  const serviceBreaks = serviceLines.map((r) => breakLine(r, Number(r.totalAmount) || Number(r.rate) || 0));
  const spareBreaks = spareLines.map((r) => breakLine(r, Number(r.totalAmount) || (Number(r.taxableValue) || 0) * (Number(r.qty) || 1)));
  const service = accumulate(serviceBreaks);
  const spares = accumulate(spareBreaks);
  const grand = accumulate([service, spares]);
  return {
    spareLines,
    serviceLines,
    serviceBreaks,
    spareBreaks,
    service,
    spares,
    grand,
    serviceGross: serviceLines.reduce((s, r) => s + (Number(r.taxableValue) || Number(r.rate) || 0), 0),
    spareGross: spareLines.reduce((s, r) => s + (Number(r.taxableValue) || 0) * (Number(r.qty) || 1), 0),
  };
}

export function invoicePayment(invoice) {
  const advancePaid = Number(invoice.advancePaid) || 0;
  const amountPaid = Number(invoice.amountPaid) || 0;
  const creditAmount = Number(invoice.creditAmount) || 0;
  const netPayable = Number(invoice.netPayableAmount) || Math.max(0, (Number(invoice.finalPayableAmount) || 0) - advancePaid);
  return { advancePaid, amountPaid, creditAmount, netPayable, shown: advancePaid > 0 || amountPaid > 0 || creditAmount > 0 };
}

/* --------------------------------------------------------- Printable HTML */

const esc = (v) =>
  v === null || v === undefined ? '' : String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A4 tax invoice (the app's shared PDF layout). */
export function buildInvoiceHtml({ invoice, ticket, shopName, shopMobile, shopAddress, shopGst, ownerName, customerName, customerAddress, trackingId }) {
  const b = invoiceBreakdown(invoice);
  const p = invoicePayment(invoice);
  const fileTitle = `Mobile_service_Invoice_${String(invoice.invoiceNo || trackingId).replace(/[^A-Za-z0-9_-]+/g, '_')}`;
  const serviceRows = b.serviceLines
    .map((row, i) => {
      const br = b.serviceBreaks[i];
      return `<tr><td>${esc(row.slNo || i + 1)}</td><td>${esc(row.description)}</td><td class="r">${fmt(row.rate)}</td><td class="r">${fmt(br.base)}</td><td class="r">${fmt(br.cgst)}</td><td class="r">${fmt(br.sgst)}</td><td class="r b">${fmt(br.totalGst)}</td><td class="r b">${fmt(br.total)}</td></tr>`;
    })
    .join('');
  const spareRows = b.spareLines
    .map((row, i) => {
      const br = b.spareBreaks[i];
      return `<tr><td>${esc(row.slNo || i + 1)}</td><td>${esc(row.description)}</td><td>${esc(row.warranty || '—')}</td><td class="r">${Number(row.qty || 1).toFixed(2)}</td><td class="r">${fmt(row.rate)}</td><td class="r">${fmt(br.base)}</td><td class="r">${fmt(br.cgst)}</td><td class="r">${fmt(br.sgst)}</td><td class="r b">${fmt(br.totalGst)}</td><td class="r b">${fmt(br.total)}</td></tr>`;
    })
    .join('');
  const total = Number(invoice.finalPayableAmount) || 0;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${esc(fileTitle)}</title><style>
@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;margin:0;color:#172117;font-size:10.5px;line-height:1.4}
.page{max-width:760px;margin:0 auto;padding:10px 14px}
.head{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 12px 12px 14px;border-left:4px solid #035C6C;border-bottom:2px solid #035C6C;background:#E5F3F5;border-radius:6px 6px 0 0}
.brand{font-size:19px;font-weight:900;color:#035C6C}.sub{font-size:10.5px;margin-top:2px;font-weight:600}
.pill{display:inline-block;background:#E5F3F5;color:#035C6C;border:1px solid #7ED957;padding:2px 9px;border-radius:999px;font-size:9px;letter-spacing:.5px;font-weight:800;text-transform:uppercase}
.meta{display:flex;border:1px solid #E2E8E2;border-top:0;border-radius:0 0 6px 6px;background:#E5F3F5}.meta .col{flex:1;padding:6px 10px;border-right:1px solid #E2E8E2}.meta .col:last-child{border-right:0}
.k{font-size:8.5px;color:#667066;letter-spacing:.35px;font-weight:800;text-transform:uppercase}.v{font-size:11px;font-weight:800;margin-top:1px}
.card{border:1px solid #E2E8E2;border-radius:6px;padding:8px 12px;margin-top:8px}
.sec{font-size:9.5px;font-weight:900;color:#035C6C;letter-spacing:.6px;text-transform:uppercase;margin-bottom:5px;border-left:3px solid #035C6C;padding-left:6px}
.tofrom{display:flex;gap:12px}.tofrom>div{flex:1}.lbl{color:#667066;font-size:9px;font-weight:800;text-transform:uppercase}.nm{font-size:12px;font-weight:900;margin-top:2px}.ln{font-size:10.5px;color:#667066;margin-top:1px}
table{width:100%;border-collapse:collapse;font-size:10px;border:1px solid #E2E8E2}th,td{padding:5px 7px;vertical-align:top}
th{background:#E5F3F5;color:#035C6C;font-size:8.5px;text-transform:uppercase;text-align:left;border-bottom:1px solid #E2E8E2}th.r,.r{text-align:right}.b{font-weight:800}
tbody tr+tr td{border-top:1px solid #EFF5EE}.totalrow td{background:#E5F3F5;font-weight:800;color:#035C6C;border-top:2px solid #E5F3F5}
.row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px}.row.sep{border-top:1px dashed #E2E8E2;margin-top:3px;padding-top:5px}
.final{margin-top:6px;background:#035C6C;color:#fff;padding:9px 14px;border-radius:8px;display:flex;justify-content:space-between}.final .amt{font-size:16px;font-weight:900}
.words{font-size:10px;color:#667066;margin-top:5px;font-style:italic}
.sigs{margin-top:10px;display:flex;justify-content:space-between;padding:8px 12px;border:1px solid #E2E8E2;border-radius:6px;background:#E5F3F5;font-size:10.5px}
.decl{margin-top:8px;padding:6px 12px;background:#FFFBEB;border:1px dashed #FDE68A;border-radius:6px;font-size:9.5px;color:#92400E}
.thank{margin-top:6px;text-align:center;font-size:9.5px;color:#667066;font-style:italic}
</style></head><body><div class="page">
<div class="head"><div><span class="pill">Tax Invoice</span><div class="brand" style="margin-top:4px">${esc(shopName)}</div>${ownerName ? `<div class="sub">${esc(ownerName)}${shopMobile ? ` · ${esc(shopMobile)}` : ''}</div>` : shopMobile ? `<div class="sub">${esc(shopMobile)}</div>` : ''}</div><div><span class="pill" style="background:#fff">Original Copy</span></div></div>
<div class="meta"><div class="col"><div class="k">Invoice No</div><div class="v">${esc(invoice.invoiceNo)}</div></div><div class="col"><div class="k">Ticket Date</div><div class="v">${formatDateTime(invoice.ticketDate)}</div></div><div class="col"><div class="k">Delivery Date</div><div class="v">${formatDateTime(invoice.generatedAt || invoice.deliveryDate)}</div></div>${shopGst ? `<div class="col"><div class="k">GSTIN</div><div class="v">${esc(shopGst)}</div></div>` : ''}</div>
<div class="card"><div class="sec">Parties</div><div class="tofrom"><div><div class="lbl">Billed To</div><div class="nm">${esc(customerName || '—')}</div>${ticket?.customerPhone ? `<div class="ln">Mobile · ${esc(ticket.customerPhone)}</div>` : ''}<div class="ln">Address · ${esc(customerAddress || '—')}</div></div><div style="text-align:right"><div class="lbl">Issued By</div><div class="nm">${esc(shopName)}</div>${shopMobile ? `<div class="ln">Mobile · ${esc(shopMobile)}</div>` : ''}${shopAddress ? `<div class="ln">${esc(shopAddress)}</div>` : ''}${shopGst ? `<div class="ln">GSTIN · ${esc(shopGst)}</div>` : ''}</div></div></div>
<div class="card"><div class="sec">(A) Service</div><table><thead><tr><th>Sl</th><th>Description</th><th class="r">Rate (₹)</th><th class="r">Taxable Value (₹)</th><th class="r">CGST (₹)</th><th class="r">SGST (₹)</th><th class="r">Total GST (₹)</th><th class="r">Total (₹)</th></tr></thead><tbody>${serviceRows || '<tr><td colspan="8" style="text-align:center;color:#8FA08F">—</td></tr>'}<tr class="totalrow"><td></td><td>Total Amount (₹)</td><td class="r">${fmt(b.serviceGross)}</td><td class="r">${fmt(b.service.base)}</td><td class="r">${fmt(b.service.cgst)}</td><td class="r">${fmt(b.service.sgst)}</td><td class="r">${fmt(b.service.totalGst)}</td><td class="r">${fmt(b.service.total)}</td></tr></tbody></table></div>
<div class="card"><div class="sec">(B) Spares</div><table><thead><tr><th>Sl</th><th>Description</th><th>Warranty</th><th class="r">Qty</th><th class="r">Rate (₹)</th><th class="r">Taxable Value (₹)</th><th class="r">CGST (₹)</th><th class="r">SGST (₹)</th><th class="r">Total GST (₹)</th><th class="r">Total (₹)</th></tr></thead><tbody>${spareRows || '<tr><td colspan="10" style="text-align:center;color:#8FA08F">—</td></tr>'}<tr class="totalrow"><td></td><td>Total Amount (₹)</td><td></td><td></td><td class="r">${fmt(b.spareGross)}</td><td class="r">${fmt(b.spares.base)}</td><td class="r">${fmt(b.spares.cgst)}</td><td class="r">${fmt(b.spares.sgst)}</td><td class="r">${fmt(b.spares.totalGst)}</td><td class="r">${fmt(b.spares.total)}</td></tr></tbody></table></div>
<div class="card"><div class="sec">Tax Summary</div><table><thead><tr><th>Sl</th><th>Description</th><th class="r">Taxable Value (₹)</th><th class="r">CGST (₹)</th><th class="r">SGST (₹)</th><th class="r">Total GST (₹)</th><th class="r">Total (₹)</th></tr></thead><tbody><tr><td>1</td><td>Service</td><td class="r">${fmt(b.service.base)}</td><td class="r">${fmt(b.service.cgst)}</td><td class="r">${fmt(b.service.sgst)}</td><td class="r">${fmt(b.service.totalGst)}</td><td class="r b">${fmt(b.service.total)}</td></tr><tr><td>2</td><td>Spares</td><td class="r">${fmt(b.spares.base)}</td><td class="r">${fmt(b.spares.cgst)}</td><td class="r">${fmt(b.spares.sgst)}</td><td class="r">${fmt(b.spares.totalGst)}</td><td class="r b">${fmt(b.spares.total)}</td></tr><tr class="totalrow"><td></td><td>Total payable by customer (₹)</td><td class="r">${fmt(b.grand.base)}</td><td class="r">${fmt(b.grand.cgst)}</td><td class="r">${fmt(b.grand.sgst)}</td><td class="r">${fmt(b.grand.totalGst)}</td><td class="r">${fmt(b.grand.total)}</td></tr></tbody></table></div>
<div class="card"><div class="sec">Total Payable Summary</div><div class="row"><span>Taxable Amount</span><b>₹${fmt(b.grand.base)}</b></div><div class="row"><span>Total GST Tax (₹)</span><b>₹${fmt(b.grand.totalGst)}</b></div><div class="row sep"><span>Discount</span><b style="color:#b45309">− ₹${fmt(invoice.discount)}</b></div><div class="final"><b>Invoice Total</b><span class="amt">₹${fmt(total)}</span></div>${invoice.amountInWords ? `<div class="words">In words : ${esc(invoice.amountInWords)}</div>` : ''}
${p.shown ? `${p.advancePaid > 0 ? `<div class="row sep"><span>Advance Already Paid</span><b style="color:#b45309">− ₹${fmt(p.advancePaid)}</b></div>` : ''}<div class="row"><span>Net Payable</span><b>₹${fmt(p.netPayable)}</b></div>${p.amountPaid > 0 ? `<div class="row"><span>Amount Paid</span><b style="color:#b45309">− ₹${fmt(p.amountPaid)}</b></div>` : ''}<div class="final" style="background:${p.creditAmount > 0 ? '#fef3c7' : '#E5F3F5'};color:${p.creditAmount > 0 ? '#b45309' : '#035C6C'}"><b>${p.creditAmount > 0 ? 'Credit / Balance Payable' : 'Balance Payable'}</b><span class="amt">₹${fmt(p.creditAmount)}</span></div>${p.creditAmount > 0 && invoice.paymentNote ? `<div class="words">Note : ${esc(invoice.paymentNote)}</div>` : ''}` : ''}</div>
<div class="sigs"><div><b>Customer Signature :</b> ${esc(customerName || '—')}</div><div style="text-align:right"><b>Authorised Signatory :</b> ${esc(shopName)}${ownerName ? ` · ${esc(ownerName)}` : ''}</div></div>
<div class="decl"><b>Declaration :</b> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</div>
<div class="thank">Thank you for choosing ${esc(shopName)}</div></div></body></html>`;
}
