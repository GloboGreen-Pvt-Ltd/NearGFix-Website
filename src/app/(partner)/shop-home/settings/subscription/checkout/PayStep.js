'use client';

/**
 * Pay + Success steps of the Subscription v2 checkout.
 *
 * Pay: POST /purchase (channel WEB) → POST /payment/order → Razorpay
 * Checkout (loaded on demand) with the SERVER-returned key, order id,
 * amount and UPI-only method/config. The Razorpay handler result is never
 * trusted: it is sent to /payment/verify and, if that does not say
 * ACTIVATED, /payment/status is polled. Closing the modal rechecks status.
 * No Razorpay secret ever exists on this client.
 *
 * Success: rendered only after /payment/status (or /me for the trial)
 * confirms activation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from '@/components/PortalLink';
import { AlertTriangle, CheckCircle2, Clock, FileText, Home, Loader2, RefreshCw, ShieldCheck, Smartphone, XCircle } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { BTN_LINK, BTN_PRIMARY, BTN_SECONDARY, Card, Notice, Pill, Row, SkeletonCard, SUB_BASE } from '@/components/subscription/shopUi';
import { GstBreakdown, InvoiceActions, gstNote } from '@/components/subscription/GstInvoice';
import {
  cancelPaymentOrder,
  createPaymentOrder,
  fetchInvoiceByOrder,
  fetchPaymentHistory,
  fetchPaymentStatus,
  fetchQuote,
  fetchSubscriptionMe,
  purchaseSubscription,
  verifyPayment,
} from '@/lib/shopSubscription';
import { errorText, formatDate, formatDateTime, formatPaise, loadRazorpayCheckout } from '@/lib/subscriptionFormat';

const up = (v) => String(v || '').toUpperCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAYABLE = ['CREATED', 'AWAITING_PAYMENT'];

const PHASES = {
  idle: null,
  creating: { label: 'Creating Order', tone: 'gray', icon: Loader2, spin: true },
  awaiting: { label: 'Awaiting Payment', tone: 'amber', icon: Smartphone },
  processing: { label: 'Payment Processing', tone: 'amber', icon: Loader2, spin: true },
  success: { label: 'Successful', tone: 'green', icon: CheckCircle2 },
  failed: { label: 'Failed', tone: 'red', icon: XCircle },
  cancelled: { label: 'Cancelled', tone: 'gray', icon: XCircle },
  pending: { label: 'Verification Pending', tone: 'amber', icon: Clock },
  error: { label: 'Failed', tone: 'red', icon: AlertTriangle },
};

export default function PayStep({
  plan,
  shopIds,
  shopNames,
  termsOk,
  replaceAck,
  payAvailable,
  activeOrder,
  setActiveOrder,
  onOrderCreated,
  onOrderClosed,
  onActivated,
  onBack,
}) {
  const openOrder = activeOrder && ['CREATED', 'AWAITING_PAYMENT', 'PAID'].includes(up(activeOrder.status)) ? activeOrder : null;
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [phase, setPhase] = useState(openOrder && up(openOrder.status) === 'PAID' ? 'processing' : 'idle');
  const [message, setMessage] = useState('');
  const settled = useRef(false);
  const failure = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // No open order yet → the button amount comes from a fresh server quote.
  const idsKey = shopIds.join(',');
  useEffect(() => {
    if (openOrder || !plan || !idsKey) return undefined;
    let ok = true;
    setQuoteError('');
    fetchQuote(plan.code, idsKey.split(','))
      .then((q) => ok && setQuote(q))
      .catch((e) => ok && setQuoteError(errorText(e, 'Could not get the payable amount.')));
    return () => {
      ok = false;
    };
  }, [openOrder, plan, idsKey]);

  const closed = (o, nextPhase, msg) => {
    setActiveOrder(o);
    onOrderClosed();
    setPhase(nextPhase);
    setMessage(msg);
  };

  /** Poll /payment/status until the server reaches a final state. */
  const reconcile = useCallback(
    async (orderId, tries = 8) => {
      setPhase('processing');
      setMessage('Confirming your payment with Razorpay…');
      for (let i = 0; i < tries; i += 1) {
        try {
          const o = (await fetchPaymentStatus(orderId))?.order;
          if (!alive.current) return;
          const st = up(o?.status);
          if (st === 'ACTIVATED') {
            onActivated(o);
            return;
          }
          if (st === 'FAILED') {
            closed(o, 'failed', o.failureReason || 'The payment failed. No subscription was activated.');
            return;
          }
          if (st === 'CANCELLED' || st === 'EXPIRED') {
            closed(o, 'cancelled', 'This order was closed without payment. You can start a new payment.');
            return;
          }
          if (o) setActiveOrder(o);
        } catch {
          /* transient — keep polling */
        }
        if (i < tries - 1) await sleep(3000);
      }
      if (!alive.current) return;
      setPhase('pending');
      setMessage('We haven’t received confirmation yet. If money left your account, the plan activates automatically once Razorpay confirms — check again in a minute.');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable callbacks from the parent
    [onActivated, setActiveOrder],
  );

  // A resumed order that is already PAID only needs activation confirmed.
  useEffect(() => {
    if (openOrder && up(openOrder.status) === 'PAID') reconcile(openOrder.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  const afterDismiss = async (orderId) => {
    setPhase('processing');
    setMessage('Checking payment status…');
    try {
      const o = (await fetchPaymentStatus(orderId))?.order;
      if (!alive.current) return;
      const st = up(o?.status);
      if (st === 'ACTIVATED') return onActivated(o);
      if (st === 'PAID') return reconcile(orderId);
      if (st === 'FAILED') return closed(o, 'failed', o.failureReason || 'The payment failed.');
      if (st === 'CANCELLED' || st === 'EXPIRED') return closed(o, 'cancelled', 'This order was closed. You can start a new payment.');
      if (o) setActiveOrder(o);
      if (failure.current) {
        setPhase('failed');
        setMessage(failure.current.description || 'The payment failed. You can try again.');
      } else {
        setPhase('cancelled');
        setMessage('Payment window closed before payment. Your order is kept — tap Pay to try again.');
      }
    } catch (e) {
      if (!alive.current) return;
      setPhase('pending');
      setMessage(errorText(e, 'Could not confirm the payment status.'));
    }
    return undefined;
  };

  const verify = async (orderId, resp) => {
    setPhase('processing');
    setMessage('Verifying your payment…');
    try {
      const res = await verifyPayment({
        orderId,
        razorpayOrderId: resp?.razorpay_order_id,
        razorpayPaymentId: resp?.razorpay_payment_id,
        razorpaySignature: resp?.razorpay_signature,
      });
      if (!alive.current) return;
      if (res?.order) setActiveOrder(res.order);
      if (up(res?.order?.status) === 'ACTIVATED') {
        onActivated(res.order);
        return;
      }
    } catch {
      /* never trust the callback — fall through to a server status check */
    }
    if (alive.current) reconcile(orderId);
  };

  const startPayment = async () => {
    settled.current = false;
    failure.current = null;
    setMessage('');
    setPhase('creating');
    try {
      let order = openOrder && PAYABLE.includes(up(openOrder.status)) ? openOrder : null;
      if (!order) {
        order = await purchaseSubscription(plan.code, shopIds);
        if (!alive.current) return;
        setActiveOrder(order);
        onOrderCreated(order);
        const st = up(order?.status);
        if (st === 'ACTIVATED') return onActivated(order);
        if (st === 'PAID') return reconcile(order.id);
      }
      const po = await createPaymentOrder(order.id);
      const Razorpay = await loadRazorpayCheckout();
      if (!alive.current) return;
      if (!po?.keyId || !po?.razorpayOrderId) throw new Error('The payment gateway is not configured yet. Please try again later.');
      setActiveOrder({ ...order, status: 'AWAITING_PAYMENT', razorpayOrderId: po.razorpayOrderId });
      setPhase('awaiting');
      setMessage('Complete the payment in the UPI window.');
      const rz = new Razorpay({
        key: po.keyId,
        amount: po.amount,
        currency: po.currency,
        name: po.name,
        description: po.description,
        order_id: po.razorpayOrderId,
        prefill: po.prefill,
        notes: po.notes,
        ...(po.checkout?.method ? { method: po.checkout.method } : {}),
        ...(po.checkout?.config ? { config: po.checkout.config } : {}),
        theme: { color: '#024A57' },
        handler: (resp) => {
          settled.current = true;
          verify(order.id, resp);
        },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            if (settled.current) return;
            settled.current = true;
            afterDismiss(order.id);
          },
        },
      });
      rz.on('payment.failed', (resp) => {
        failure.current = resp?.error || {};
        setPhase('failed');
        setMessage(resp?.error?.description || 'The payment failed. You can retry in the UPI window or close it.');
      });
      rz.open();
    } catch (e) {
      if (!alive.current) return;
      setPhase('error');
      setMessage(errorText(e, 'Could not start the payment.'));
    }
    return undefined;
  };

  const cancelOrder = async () => {
    if (!openOrder) return;
    setPhase('processing');
    setMessage('Cancelling order…');
    try {
      const o = await cancelPaymentOrder(openOrder.id, 'Cancelled by owner before payment');
      if (up(o?.status) === 'CANCELLED') closed(o, 'cancelled', 'Order cancelled. No payment was taken.');
      else reconcile(openOrder.id, 3);
    } catch (e) {
      setPhase('error');
      setMessage(errorText(e, 'Could not cancel this order.'));
    }
  };

  // Consent from the Order Summary is required before a NEW order (a resumed order already has it).
  if (!openOrder && (!termsOk || (quote?.replacesCurrent && !replaceAck))) {
    return (
      <Notice tone="amber" icon={AlertTriangle}>
        Please review the Order Summary and accept the Subscription Terms first.
        <button type="button" onClick={onBack} className={cx(BTN_LINK, 'ml-2')}>
          Go to Order Summary
        </button>
      </Notice>
    );
  }

  const amountPaise = openOrder?.totalPaise ?? quote?.totalPaise;
  const shopsText = openOrder
    ? (openOrder.shops || []).map((s) => s.name).join(', ') || `${(openOrder.shopIds || []).length} shops`
    : shopIds.map((id) => shopNames[id]).filter(Boolean).join(', ') || `${shopIds.length} shops`;
  const busy = ['creating', 'awaiting', 'processing'].includes(phase);
  const blocked = phase === 'pending' || (openOrder && up(openOrder.status) === 'PAID');
  const ph = PHASES[phase];
  const PhaseIcon = ph?.icon;

  return (
    <Card title="Pay via UPI" subtitle="Google Pay, PhonePe, Paytm, BHIM or any UPI app.">
      <div className="divide-y divide-[#ECECEC]">
        <Row label="Plan" value={`${openOrder?.planName || plan?.name || '—'}${(openOrder?.durationLabel || plan?.durationLabel) ? ` · ${openOrder?.durationLabel || plan?.durationLabel}` : ''}`} />
        <Row label="Shops" value={shopsText} />
        {openOrder?.orderNo ? <Row label="Order" value={openOrder.orderNo} /> : null}
        <Row label="Amount payable" value={amountPaise != null ? formatPaise(amountPaise) : '…'} strong />
      </div>
      {!openOrder && quote?.gst ? (
        <div className="mt-3 rounded-2xl bg-[#F8F8F8] px-4 py-2">
          <div className="divide-y divide-[#ECECEC]">
            <GstBreakdown gst={quote.gst} />
          </div>
          <p className="pb-1 pt-1.5 text-xs text-[#666666]">{gstNote(quote.gst)}</p>
        </div>
      ) : null}

      {quoteError && !openOrder ? (
        <div className="mt-3">
          <Notice tone="red" icon={AlertTriangle}>
            {quoteError}
          </Notice>
        </div>
      ) : null}

      {ph ? (
        <div className="mt-4">
          <Notice tone={ph.tone} icon={PhaseIcon}>
            <p className="font-bold">{ph.label}</p>
            {message ? <p className="mt-0.5">{message}</p> : null}
          </Notice>
        </div>
      ) : null}

      <button
        type="button"
        onClick={startPayment}
        disabled={!payAvailable || busy || blocked || amountPaise == null}
        className={cx(BTN_PRIMARY, 'mt-5 w-full py-3.5 text-base')}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
        {amountPaise != null ? `Pay ${formatPaise(amountPaise)} via UPI` : 'Pay via UPI'}
      </button>
      {!payAvailable ? <p className="mt-2 text-center text-xs text-[#666666]">Online payment is not available yet.</p> : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {!openOrder ? (
          <button type="button" onClick={onBack} disabled={busy} className={BTN_LINK}>
            Back to summary
          </button>
        ) : (
          <button type="button" onClick={cancelOrder} disabled={busy || blocked} className={BTN_LINK}>
            Cancel this order
          </button>
        )}
        {openOrder && (phase === 'pending' || phase === 'cancelled' || phase === 'failed' || phase === 'idle') ? (
          <button type="button" onClick={() => reconcile(openOrder.id, 3)} disabled={busy} className={BTN_LINK}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Check payment status
          </button>
        ) : null}
      </div>
      <p className="mt-4 text-xs text-[#98A2B3]">
        Payments are processed by Razorpay. Your plan is activated only after the payment is verified by NearGFix.
      </p>
    </Card>
  );
}

/* --------------------------------- Success -------------------------------- */

export function SuccessStep({ orderId, trial, initialOrder }) {
  const [order, setOrder] = useState(initialOrder && initialOrder.id === orderId ? initialOrder : null);
  const [me, setMe] = useState(null);
  const [paymentId, setPaymentId] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | notyet | error
  const [error, setError] = useState('');

  // The invoice is issued just after activation: 404 → retry a few times;
  // any other error (e.g. older server) just leaves the invoice UI hidden.
  const loadInvoice = useCallback(async (oid) => {
    for (let i = 0; i < 5; i += 1) {
      try {
        const v = await fetchInvoiceByOrder(oid);
        if (v && typeof v === 'object' && v.id) setInvoice(v);
        return;
      } catch (e) {
        if (e?.status !== 404 || i === 4) return;
        await sleep(2500);
      }
    }
  }, []);

  const load = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      if (trial) {
        const m = await fetchSubscriptionMe();
        setMe(m);
        setState(up(m?.subscription?.status) === 'TRIAL' ? 'ok' : 'notyet');
        return;
      }
      if (!orderId) {
        setState('error');
        setError('No order to show.');
        return;
      }
      const o = (await fetchPaymentStatus(orderId))?.order;
      setOrder(o || null);
      if (up(o?.status) !== 'ACTIVATED') {
        setState('notyet');
        return;
      }
      setState('ok');
      fetchPaymentHistory()
        .then((list) => setPaymentId(list.find((p) => p.orderId === orderId)?.paymentId || ''))
        .catch(() => {});
      loadInvoice(orderId);
    } catch (e) {
      setState('error');
      setError(errorText(e, 'Could not confirm your subscription.'));
    }
  }, [orderId, trial, loadInvoice]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'loading') return <SkeletonCard lines={6} />;
  if (state === 'error' || state === 'notyet') {
    return (
      <Card>
        <Notice tone={state === 'error' ? 'red' : 'amber'} icon={state === 'error' ? AlertTriangle : Clock}>
          {state === 'error' ? error : trial ? 'Your free trial is not active yet.' : `This payment is not confirmed yet (status: ${up(order?.status) || 'unknown'}).`}
        </Notice>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={load} className={BTN_SECONDARY}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Check again
          </button>
          <Link href={`${SUB_BASE}/`} className={BTN_PRIMARY}>
            View Subscription
          </Link>
        </div>
      </Card>
    );
  }

  const sub = me?.subscription;
  const rows = trial
    ? [
        ['Plan', `${sub?.planName || 'Free Trial'}${sub?.durationLabel ? ` · ${sub.durationLabel}` : ''}`],
        ['Shops activated', (me?.shops || []).map((s) => s.name).join(', ') || sub?.shopCount || '—'],
        ['Amount', formatPaise(0)],
        ['Subscription status', <Pill key="s" status={sub?.status} />],
        ['Started', formatDateTime(sub?.startedAt)],
        ['Valid until', formatDate(sub?.endsAt)],
      ]
    : [
        ['Plan', `${order.planName || order.planCode}${order.durationLabel ? ` · ${order.durationLabel}` : ''}`],
        ['Shops activated', (order.shops || []).map((s) => s.name).join(', ') || (order.shopIds || []).length],
        ['Amount paid', formatPaise(order.totalPaise)],
        ['Payment method', order.paymentMethod || 'UPI'],
        ['Payment status', <Pill key="p" status="PAID">Paid</Pill>],
        ['Subscription status', <Pill key="s" status="ACTIVE">Active</Pill>],
        ['Order', order.orderNo || order.id],
        ['Razorpay payment ID', <span key="r" className="break-all font-mono text-xs">{order.razorpayPaymentId || '—'}</span>],
        ['Paid at', formatDateTime(order.paidAt)],
        ['Activated at', formatDateTime(order.activatedAt)],
      ];

  return (
    <Card>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E5F3F5] text-[#024A57]">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-2xl font-extrabold text-[#111111]">{trial ? 'Free Trial Activated!' : 'Subscription Activated!'}</h2>
        <p className="mt-1 text-sm text-[#666666]">{trial ? 'Your shops are on the free trial now.' : 'Payment verified and your plan is live.'}</p>
      </div>
      <div className="mt-5 divide-y divide-[#ECECEC]">
        {rows.map(([k, v]) => (
          <Row key={k} label={k} value={v} />
        ))}
      </div>
      {!trial && invoice?.gst ? (
        <div className="mt-4 rounded-2xl bg-[#F8F8F8] px-4 py-2">
          <div className="divide-y divide-[#ECECEC]">
            <GstBreakdown gst={invoice.gst} totalLabel="Total Paid" />
          </div>
          <p className="pb-1 pt-1.5 text-xs text-[#666666]">{gstNote(invoice.gst)}</p>
        </div>
      ) : null}
      {!trial && invoice ? (
        <div className="mt-4 rounded-2xl border border-[#ECECEC] px-4 py-3">
          <p className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-wide text-[#666666]">{invoice.title || 'Invoice'}</p>
          <InvoiceActions invoice={invoice} onUpdated={setInvoice} showReason />
        </div>
      ) : null}
      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        <Link href={`${SUB_BASE}/`} className={BTN_PRIMARY}>
          View Subscription
        </Link>
        {!trial ? (
          paymentId ? (
            <Link href={`${SUB_BASE}/receipt/?id=${encodeURIComponent(paymentId)}${invoice?.id ? `&invoice=${encodeURIComponent(invoice.id)}` : ''}`} className={BTN_SECONDARY}>
              <FileText className="h-4 w-4" aria-hidden="true" /> Download Receipt
            </Link>
          ) : (
            <button type="button" disabled className={BTN_SECONDARY} title="The receipt appears once the payment is recorded">
              <FileText className="h-4 w-4" aria-hidden="true" /> Receipt pending
            </button>
          )
        ) : null}
        <Link href="/shop-home/" className={BTN_SECONDARY}>
          <Home className="h-4 w-4" aria-hidden="true" /> Go to Dashboard
        </Link>
      </div>
    </Card>
  );
}
