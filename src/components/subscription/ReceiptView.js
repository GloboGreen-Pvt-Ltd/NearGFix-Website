/**
 * ReceiptView — renders the server's Receipt JSON (Subscription v2) as a
 * printable document. Shared by the shop receipt route and the management
 * Payments tab. Title is "Tax Invoice" ONLY when the server says
 * isTaxInvoice; otherwise it is the server documentTitle (a plain receipt).
 * GSTIN is printed only when the server returns one — never invented.
 * Optional `invoice` (InvoiceView): adds the invoice no, supplier SAC/state
 * and the server GST breakdown (no tax rows in receipt mode).
 */

import { GstBreakdown, gstNote } from '@/components/subscription/GstInvoice';
import { formatDate, formatDateTime, formatPaise } from '@/lib/subscriptionFormat';

const ISSUER = 'Globogreen System & Technology Private Limited';

function Row({ label, value, strong }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="min-w-0 flex-1 text-[#666666]">{label}</span>
      <span className={`min-w-0 max-w-[65%] break-words text-right ${strong ? 'font-extrabold text-[#111111]' : 'font-medium text-[#111111]'}`}>{value}</span>
    </div>
  );
}

export default function ReceiptView({ receipt, invoice }) {
  if (!receipt) return null;
  const gst = invoice?.gst || null;
  const supplier = invoice?.supplier || {};
  const billTo = invoice?.billTo || {};
  const taxInvoice = gst ? !!gst.applicable : !!receipt.isTaxInvoice;
  const issuer = receipt.issuedBy || {};
  const owner = receipt.owner || {};
  const lines = Array.isArray(receipt.lines) ? receipt.lines : [];
  const shops = Array.isArray(receipt.shops) ? receipt.shops : [];
  const title = invoice?.title || (receipt.isTaxInvoice ? 'Tax Invoice' : receipt.documentTitle || 'NearGFix Subscription Receipt');
  const gstin = issuer.gstin || supplier.gstin;
  const taxPct = Number(receipt.taxPercent) || 0;

  return (
    <article className="mx-auto w-full max-w-3xl rounded-2xl border border-[#ECECEC] bg-white p-5 text-[#111111] sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
      <header className="flex flex-col gap-4 border-b border-[#ECECEC] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#024A57]">{title}</p>
          <p className="mt-1 break-words text-lg font-extrabold">{issuer.name || ISSUER}</p>
          {issuer.address ? <p className="mt-1 whitespace-pre-line text-sm text-[#666666]">{issuer.address}</p> : null}
          <p className="mt-1 text-sm text-[#666666]">{[issuer.email, issuer.phone].filter(Boolean).join(' · ')}</p>
          {gstin ? <p className="mt-1 text-sm font-semibold">GSTIN: {gstin}</p> : null}
          {supplier.state ? (
            <p className="text-sm text-[#666666]">
              State: {supplier.state}
              {supplier.stateCode ? ` (${supplier.stateCode})` : ''}
            </p>
          ) : null}
          {supplier.sac ? <p className="text-sm text-[#666666]">SAC: {supplier.sac}</p> : null}
        </div>
        <div className="shrink-0 text-sm sm:text-right">
          {invoice?.invoiceNo ? <p><span className="text-[#666666]">Invoice No: </span><span className="font-bold">{invoice.invoiceNo}</span></p> : null}
          <p><span className="text-[#666666]">Receipt No: </span><span className="font-bold">{receipt.receiptNo || '—'}</span></p>
          <p><span className="text-[#666666]">Order No: </span><span className="font-semibold">{receipt.orderNo || '—'}</span></p>
          <p><span className="text-[#666666]">Paid on: </span><span className="font-semibold">{formatDateTime(receipt.paidAt)}</span></p>
          <p><span className="text-[#666666]">Status: </span><span className="font-semibold">{receipt.status || '—'}</span></p>
        </div>
      </header>

      <section className="grid gap-5 border-b border-[#ECECEC] py-5 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[#666666]">Billed to</p>
          <p className="mt-1 break-words font-bold">{owner.businessName || owner.name || '—'}</p>
          {owner.businessName && owner.name ? <p className="text-sm">{owner.name}</p> : null}
          <p className="break-words text-sm text-[#666666]">{[owner.phone, owner.email].filter(Boolean).join(' · ')}</p>
          {billTo.gstin ? <p className="text-sm font-semibold">GSTIN: {billTo.gstin}</p> : null}
          {gst?.placeOfSupply ? <p className="text-sm text-[#666666]">Place of supply: {gst.placeOfSupply}</p> : null}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[#666666]">Subscription</p>
          <p className="mt-1 break-words font-bold">
            {receipt.planName || '—'}
            {receipt.durationLabel ? ` · ${receipt.durationLabel}` : ''}
          </p>
          <p className="text-sm text-[#666666]">
            {formatDate(receipt.startsAt)} – {formatDate(receipt.endsAt)}
          </p>
          {receipt.subscriptionId ? <p className="break-all text-xs text-[#98A2B3]">ID: {receipt.subscriptionId}</p> : null}
        </div>
      </section>

      {shops.length > 0 ? (
        <section className="border-b border-[#ECECEC] py-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#666666]">Shops covered ({shops.length})</p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {shops.map((s, i) => (
              // eslint-disable-next-line react/no-array-index-key -- names only, no ids in the receipt
              <li key={i} className="break-words">• {typeof s === 'string' ? s : s?.name || '—'}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="py-5">
        <div className="divide-y divide-[#F3F3F3]">
          {lines.map((l, i) => (
            // eslint-disable-next-line react/no-array-index-key -- server lines have no id
            <Row key={i} label={l.label} value={formatPaise(l.amountPaise)} />
          ))}
        </div>
        {gst ? (
          <>
            <div className="mt-2 divide-y divide-[#F3F3F3] border-t border-[#ECECEC] pt-1">
              <GstBreakdown gst={gst} totalLabel={`Total paid${receipt.currency ? ` (${receipt.currency})` : ''}`} />
            </div>
            <p className="pt-2 text-xs text-[#666666]">{gstNote(gst)}</p>
          </>
        ) : (
          <>
            {Number(receipt.discountPaise) > 0 ? <Row label="Multi-shop discount (included above)" value={`−${formatPaise(receipt.discountPaise)}`} /> : null}
            {taxPct > 0 ? <Row label={`Includes tax (${taxPct}%)`} value={formatPaise(receipt.taxPaise)} /> : null}
            <div className="mt-2 border-t border-[#ECECEC] pt-2">
              <Row label={`Total paid${receipt.currency ? ` (${receipt.currency})` : ''}`} value={formatPaise(receipt.totalPaise)} strong />
            </div>
          </>
        )}
      </section>

      <footer className="border-t border-[#ECECEC] pt-4 text-sm">
        <Row label="Payment method" value={receipt.paymentMethod || '—'} />
        <Row label="Razorpay payment ID" value={<span className="break-all font-mono text-xs">{receipt.razorpayPaymentId || '—'}</span>} />
        <p className="mt-4 text-xs text-[#98A2B3]">
          {taxInvoice ? 'This is a computer-generated tax invoice.' : 'This is a computer-generated payment receipt and not a tax invoice.'}
        </p>
      </footer>
    </article>
  );
}
