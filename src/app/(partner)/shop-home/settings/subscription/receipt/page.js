'use client';

/**
 * /shop-home/settings/subscription/receipt?id=<paymentId> — printable
 * NearGFix subscription receipt from GET /subscriptions/receipts/{paymentId}.
 * Print / Save as PDF uses the browser print dialog; the print stylesheet
 * hides the dashboard chrome so only the receipt is printed.
 * Optional &invoice=<invoiceId> (or a match in GET /subscriptions/invoices)
 * adds the GST breakdown, PDF download and WhatsApp status; a server
 * without invoices keeps the plain receipt.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Printer } from 'lucide-react';

import ReceiptView from '@/components/subscription/ReceiptView';
import { InvoiceActions } from '@/components/subscription/GstInvoice';
import { BTN_PRIMARY, BTN_SECONDARY, Notice, SkeletonCard, SUB_BASE } from '@/components/subscription/shopUi';
import { fetchInvoice, fetchInvoices, fetchReceipt } from '@/lib/shopSubscription';
import { errorText } from '@/lib/subscriptionFormat';

const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #subscription-receipt-print, #subscription-receipt-print * { visibility: visible !important; }
  #subscription-receipt-print { position: absolute; left: 0; top: 0; width: 100%; }
  @page { margin: 14mm; }
}`;

export default function ReceiptPage() {
  const params = useSearchParams();
  const id = params.get('id') || '';
  const invoiceId = params.get('invoice') || '';
  const [receipt, setReceipt] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setReceipt(null);
    setInvoice(null);
    if (!id) {
      setError('No receipt selected.');
      return;
    }
    let r;
    try {
      r = await fetchReceipt(id);
      setReceipt(r);
    } catch (e) {
      setError(errorText(e, 'Could not load this receipt.'));
      return;
    }
    // Invoice is optional — any failure keeps the plain receipt.
    try {
      if (invoiceId) {
        setInvoice(await fetchInvoice(invoiceId));
      } else {
        const list = await fetchInvoices();
        setInvoice(
          list.find((i) => r?.razorpayPaymentId && i.payment?.razorpayPaymentId === r.razorpayPaymentId) ||
            list.find((i) => r?.orderNo && i.payment?.orderNo === r.orderNo) ||
            null,
        );
      }
    } catch {
      setInvoice(null);
    }
  }, [id, invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`${SUB_BASE}/`} className={BTN_SECONDARY}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Subscription
        </Link>
        <button type="button" onClick={() => window.print()} disabled={!receipt} className={BTN_PRIMARY}>
          <Printer className="h-4 w-4" aria-hidden="true" /> Print / Save as PDF
        </button>
      </div>

      {error ? (
        <Notice tone="red" icon={AlertTriangle}>
          {error}
          {id ? (
            <button type="button" onClick={load} className="ml-2 font-bold underline">
              Retry
            </button>
          ) : null}
        </Notice>
      ) : null}
      {receipt && invoice?.id ? (
        <div className="rounded-2xl border border-[#ECECEC] bg-white px-4 py-3 print:hidden">
          <InvoiceActions invoice={invoice} onUpdated={setInvoice} showReason />
        </div>
      ) : null}
      {!receipt && !error ? <SkeletonCard lines={8} /> : null}
      {receipt ? (
        <div id="subscription-receipt-print">
          <ReceiptView receipt={receipt} invoice={invoice?.id ? invoice : null} />
        </div>
      ) : null}
    </div>
  );
}
