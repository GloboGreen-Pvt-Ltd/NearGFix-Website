'use client';

/**
 * GST breakdown + invoice actions for Subscription v2 (shop web).
 *
 * GstBreakdown renders the server's `gst` object only — the client never
 * computes tax. Receipt mode (gst.applicable false) shows no tax rows.
 * InvoiceActions: invoice no, document type, authenticated PDF download,
 * WhatsApp delivery status and Retry (only when the server says canRetry).
 */

import { useState } from 'react';
import { Download, Loader2, RotateCw } from 'lucide-react';

import { BTN_LINK, Pill, Row } from '@/components/subscription/shopUi';
import { downloadInvoicePdf, retryInvoiceWhatsapp } from '@/lib/shopSubscription';
import { errorText, formatPaise } from '@/lib/subscriptionFormat';

const up = (v) => String(v || '').toUpperCase();
const pct = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${Number(n.toFixed(2))}%` : '';
};

export const docLabel = (t) => ({ TAX_INVOICE: 'Tax Invoice', PAYMENT_RECEIPT: 'Payment Receipt' }[up(t)] || (t ? String(t).replace(/_/g, ' ') : ''));

/** Short line under the breakdown. */
export function gstNote(gst) {
  if (!gst) return '';
  if (!gst.applicable) return 'Prices include all charges.';
  return `Prices are GST-inclusive.${gst.placeOfSupply ? ` Place of supply: ${gst.placeOfSupply}.` : ''}`;
}

/** Rows only — place inside a `divide-y` container. */
export function GstBreakdown({ gst, totalLabel }) {
  if (!gst) return null;
  const applicable = !!gst.applicable;
  const igst = applicable && (!!gst.interState || Number(gst.igstPaise) > 0);
  const discount = Number(gst.discountPaise) || 0;
  return (
    <>
      <Row label="Plan Price" value={formatPaise(gst.grossPaise)} />
      <Row label="Discount" value={discount > 0 ? `−${formatPaise(discount)}` : formatPaise(0)} tone={discount > 0 ? 'green' : undefined} />
      {applicable ? <Row label="Taxable Amount" value={formatPaise(gst.taxablePaise)} /> : null}
      {applicable && igst ? <Row label={`IGST ${pct(gst.igstPercent)}`} value={formatPaise(gst.igstPaise)} /> : null}
      {applicable && !igst ? <Row label={`CGST ${pct(gst.cgstPercent)}`} value={formatPaise(gst.cgstPaise)} /> : null}
      {applicable && !igst ? <Row label={`SGST ${pct(gst.sgstPercent)}`} value={formatPaise(gst.sgstPaise)} /> : null}
      <Row label={totalLabel || (applicable ? 'Total Payable' : 'Total')} value={formatPaise(gst.totalPaise)} strong />
    </>
  );
}

const WA_TONE = { SENT: 'green', PENDING: 'amber', FAILED: 'red', SKIPPED: 'gray' };
const WA_LABEL = { SENT: 'Sent', PENDING: 'Sending', FAILED: 'Failed', SKIPPED: 'Not sent' };

/**
 * `invoice` = InvoiceView (may be null); `fallback` = history-row fields
 * (invoiceId, invoiceNo, documentType, whatsappStatus). Renders nothing
 * without an invoice id.
 */
export function InvoiceActions({ invoice, fallback = {}, onUpdated, showReason = false }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const id = invoice?.id || fallback.invoiceId;
  if (!id) return null;
  const no = invoice?.invoiceNo || fallback.invoiceNo;
  const type = invoice?.documentType || fallback.documentType;
  const wa = invoice?.whatsapp || (fallback.whatsappStatus ? { status: fallback.whatsappStatus } : null);
  const waKey = up(wa?.status);

  const download = async () => {
    setBusy('pdf');
    setError('');
    try {
      await downloadInvoicePdf(id, no);
    } catch (e) {
      setError(errorText(e, 'Could not download the invoice.'));
    } finally {
      setBusy('');
    }
  };

  const retry = async () => {
    setBusy('wa');
    setError('');
    try {
      const v = await retryInvoiceWhatsapp(id);
      if (v && typeof v === 'object' && onUpdated) onUpdated(v);
    } catch (e) {
      setError(errorText(e, 'Could not resend the invoice on WhatsApp.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {no ? <span className="break-all text-xs font-bold text-[#111111]">{no}</span> : null}
        {type ? <Pill tone={up(type) === 'TAX_INVOICE' ? 'green' : 'gray'}>{docLabel(type)}</Pill> : null}
        {waKey ? (
          <span title={wa.reason || undefined}>
            <Pill tone={WA_TONE[waKey] || 'gray'}>WhatsApp: {WA_LABEL[waKey] || waKey}</Pill>
          </span>
        ) : null}
        <button type="button" onClick={download} disabled={!!busy} className={BTN_LINK}>
          {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />} Download PDF
        </button>
        {wa?.canRetry ? (
          <button type="button" onClick={retry} disabled={!!busy} className={BTN_LINK}>
            {busy === 'wa' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCw className="h-4 w-4" aria-hidden="true" />} Retry WhatsApp
          </button>
        ) : null}
      </div>
      {showReason && wa?.reason && waKey !== 'SENT' ? <p className="text-xs text-[#666666]">{wa.reason}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
