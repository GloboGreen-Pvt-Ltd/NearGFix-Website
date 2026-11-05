'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, FileText, Loader2, Printer, RotateCcw, Search } from 'lucide-react';

import { subscriptionAdminApi } from '@/lib/api';
import { Button } from '@/components/PageHeader';
import ReceiptView from '@/components/subscription/ReceiptView';
import { notifyError, notifySuccess } from '@/lib/toast';
import { asList, errorText, formatDateTime, formatPaise, rupeesToPaise } from '@/lib/subscriptionFormat';
import { ActionMenu, Badge, DefList, ErrorNote, Field, Modal, Table, inputCls, useDebounced } from './adminUi';

// Razorpay payment states (upper-cased by the service).
const STATUSES = ['', 'CAPTURED', 'AUTHORIZED', 'FAILED', 'REFUNDED', 'PENDING'];

export default function PaymentsTab() {
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [receiptOf, setReceiptOf] = useState(null);
  const [refundOf, setRefundOf] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(asList(await subscriptionAdminApi.payments(status, q)));
    } catch (e) {
      setRows([]);
      setError(errorText(e, 'Could not load payments.'));
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    { key: 'paidAt', label: 'Paid', render: (r) => formatDateTime(r.paidAt) },
    {
      key: 'owner',
      label: 'Owner / Business',
      render: (r) => (
        <div className="min-w-[140px]">
          <p className="font-medium text-slate-900">{r.businessName || '—'}</p>
          <p className="text-xs text-admin-muted">{r.ownerName || ''}</p>
        </div>
      ),
    },
    { key: 'planName', label: 'Plan', render: (r) => r.planName || '—' },
    { key: 'amountPaise', label: 'Amount', align: 'right', render: (r) => <span className="font-medium text-slate-900">{formatPaise(r.amountPaise)}</span> },
    { key: 'method', label: 'Method', render: (r) => r.method || '—' },
    { key: 'status', label: 'Payment', render: (r) => <Badge value={r.status} /> },
    { key: 'activationStatus', label: 'Activation', render: (r) => <Badge value={r.activationStatus} /> },
    { key: 'orderNo', label: 'Order', render: (r) => r.orderNo || '—' },
    { key: 'receiptNo', label: 'Receipt', render: (r) => r.receiptNo || '—' },
    { key: 'rzp', label: 'Razorpay Payment', render: (r) => <span className="font-mono text-xs">{r.razorpayPaymentId || '—'}</span> },
    {
      key: 'actions',
      label: '',
      sticky: true,
      render: (r) => (
        <ActionMenu
          items={[
            { label: 'View details', icon: Eye, onClick: () => setDetail(r) },
            { label: 'View receipt', icon: FileText, onClick: () => setReceiptOf(r), disabled: !r.receiptNo },
            { label: 'Refund', icon: RotateCcw, danger: true, onClick: () => setRefundOf(r), disabled: String(r.status).toUpperCase() !== 'CAPTURED' },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search owner, business, order, payment ID…" className={`${inputCls} pl-9`} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} sm:w-48`}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s.charAt(0) + s.slice(1).toLowerCase() : 'All statuses'}
            </option>
          ))}
        </select>
      </div>

      <ErrorNote message={error} onRetry={load} />
      <Table columns={columns} rows={rows} loading={loading} rowKey={(r, i) => r.paymentId || i} empty="No payments found." />

      {detail ? (
        <Modal title={`Payment · ${detail.orderNo || detail.paymentId}`} size="max-w-2xl" onClose={() => setDetail(null)}>
          <DefList
            items={[
              ['Payment ID', detail.paymentId],
              ['Order No', detail.orderNo],
              ['Razorpay order', <span key="o" className="break-all font-mono text-xs">{detail.razorpayOrderId || '—'}</span>],
              ['Razorpay payment', <span key="p" className="break-all font-mono text-xs">{detail.razorpayPaymentId || '—'}</span>],
              ['Owner', detail.ownerName],
              ['Business', detail.businessName],
              ['Plan', detail.planName],
              ['Amount', formatPaise(detail.amountPaise)],
              ['Method', detail.method],
              ['Paid at', formatDateTime(detail.paidAt)],
              ['Payment status', <Badge key="s" value={detail.status} />],
              ['Activation', <Badge key="a" value={detail.activationStatus} />],
              ['Receipt No', detail.receiptNo],
            ]}
          />
        </Modal>
      ) : null}
      {receiptOf ? <ReceiptModal payment={receiptOf} onClose={() => setReceiptOf(null)} /> : null}
      {refundOf ? <RefundModal payment={refundOf} onClose={() => setRefundOf(null)} onDone={load} /> : null}
    </div>
  );
}

function ReceiptModal({ payment, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    subscriptionAdminApi
      .receipt(payment.paymentId)
      .then(setReceipt)
      .catch((e) => setError(errorText(e, 'Could not load the receipt.')));
  }, [payment.paymentId]);

  return (
    <Modal
      title={`Receipt ${payment.receiptNo || ''}`}
      size="max-w-4xl"
      onClose={onClose}
      footer={
        receipt ? (
          <Button icon={Printer} onClick={() => window.print()}>
            Print
          </Button>
        ) : null
      }
    >
      <ErrorNote message={error} />
      {!receipt && !error ? (
        <p className="flex items-center gap-2 py-8 text-sm text-admin-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
        </p>
      ) : null}
      {receipt ? (
        <div id="subscription-receipt-print">
          <ReceiptView receipt={receipt} />
        </div>
      ) : null}
      <style>{`@media print { body * { visibility: hidden !important; } #subscription-receipt-print, #subscription-receipt-print * { visibility: visible !important; } #subscription-receipt-print { position: absolute; inset: 0 auto auto 0; width: 100%; } }`}</style>
    </Modal>
  );
}

function RefundModal({ payment, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const partial = amount.trim() !== '';
  const amountPaise = partial ? rupeesToPaise(amount) : null;
  const amountInvalid = partial && (amountPaise === null || amountPaise <= 0 || amountPaise > Number(payment.amountPaise));
  const valid = reason.trim() && confirm && !amountInvalid;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await subscriptionAdminApi.refund(payment.paymentId, { ...(partial ? { amountPaise } : {}), reason: reason.trim() });
      notifySuccess('Refund requested with Razorpay.');
      onClose();
      onDone();
    } catch (e) {
      notifyError(errorText(e, 'Refund failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Refund payment"
      subtitle={`${payment.businessName || payment.ownerName || ''} · ${payment.orderNo || ''} · paid ${formatPaise(payment.amountPaise)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="danger" icon={RotateCcw} disabled={!valid || busy} onClick={submit}>
            {busy ? 'Refunding…' : `Refund ${partial && amountPaise ? formatPaise(amountPaise) : 'in full'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          The refund is issued through Razorpay to the original UPI source and cannot be undone. The subscription is not cancelled automatically.
        </p>
        <Field label="Refund amount (₹)" hint={`Leave blank for a full refund of ${formatPaise(payment.amountPaise)}.`}>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
        </Field>
        {amountInvalid ? <p className="text-xs text-red-600">Enter an amount between ₹0.01 and the amount paid.</p> : null}
        <Field label="Reason" required hint="Recorded in the audit log.">
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
        </Field>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
          I confirm this refund.
        </label>
      </div>
    </Modal>
  );
}
