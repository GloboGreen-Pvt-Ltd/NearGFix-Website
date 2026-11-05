'use client';

/**
 * /shop-home/settings/subscription — NearGFix Subscription v2 overview.
 *
 * Real data only (no mock, no hardcoded prices/features):
 *   GET /subscriptions/me              current plan, shops, entitlements, usage, pending order
 *   GET /subscriptions/catalog         purchasable plans (server-built `features`) + checkout flags
 *   GET /subscriptions/payment/history payments with receipt links
 *   GET /subscriptions/invoices        invoice no / PDF / WhatsApp status (optional — hidden on 404)
 * Buying, renewing, upgrading and the free trial happen in ./checkout
 * (Select Plan → Select Shops → Order Summary → Pay via Razorpay UPI).
 * Money is integer paise formatted by formatPaise(); the amount shown in
 * Current Plan is the ACTUAL historical amount paid (amountPaidPaise).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/PortalLink';
import { useRouter } from '@/lib/portalNavigation';
import { AlertTriangle, ArrowUpCircle, Clock, CreditCard, Crown, FileText, RefreshCw, RotateCw, Store } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import PlanCard from '@/components/subscription/PlanCard';
import { InvoiceActions } from '@/components/subscription/GstInvoice';
import {
  BTN_LINK,
  BTN_PRIMARY,
  BTN_SECONDARY,
  Card,
  ENTITLEMENT_LABELS,
  Notice,
  Pill,
  Row,
  SkeletonCard,
  SUB_BASE,
  checkoutHref,
} from '@/components/subscription/shopUi';
import { fetchInvoices, fetchPaymentHistory, fetchSubscriptionCatalog, fetchSubscriptionMe } from '@/lib/shopSubscription';
import { OPEN_ORDER_STATUSES, errorText, formatDate, formatDateTime, formatPaise, limitText, writeCheckoutState } from '@/lib/subscriptionFormat';

const LIVE = ['ACTIVE', 'TRIAL'];

export default function SubscriptionPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [history, setHistory] = useState(null);
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const [m, c, h, inv] = await Promise.allSettled([fetchSubscriptionMe(), fetchSubscriptionCatalog(), fetchPaymentHistory(), fetchInvoices()]);
    setMe(m.status === 'fulfilled' ? m.value : null);
    setCatalog(c.status === 'fulfilled' ? c.value : null);
    setHistory(h.status === 'fulfilled' ? h.value : null);
    // Invoices are optional (older server → 404): failure just hides the invoice UI.
    setInvoices(inv.status === 'fulfilled' ? inv.value : null);
    setErrors({
      me: m.status === 'rejected' ? errorText(m.reason, 'Could not load your subscription.') : '',
      catalog: c.status === 'rejected' ? errorText(c.reason, 'Could not load plans.') : '',
      history: h.status === 'rejected' ? errorText(h.reason, 'Could not load payment history.') : '',
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sub = me?.subscription || null;
  const status = String(sub?.status || 'NONE').toUpperCase();
  const hasPlan = sub && status !== 'NONE';
  const isPaid = hasPlan && status !== 'TRIAL' && Number(sub.amountPaidPaise) > 0;
  const plans = Array.isArray(catalog?.plans) ? catalog.plans : [];
  const checkout = catalog?.checkout || {};
  const payAvailable = !!(checkout.webEnabled && checkout.configured);
  const currentCatalogPlan = plans.find((p) => p.code === sub?.planCode);
  const canRenew = isPaid && currentCatalogPlan?.purchasable && !sub?.legacy;
  const pending = me?.pendingOrder && OPEN_ORDER_STATUSES.includes(String(me.pendingOrder.status).toUpperCase()) ? me.pendingOrder : null;

  // Pre-select the currently covered shops, then open checkout for this plan.
  const startCheckout = (planCode, preselectCurrent) => {
    const shopIds = preselectCurrent ? (me?.shops || []).map((s) => s.shopId).filter(Boolean) : undefined;
    writeCheckoutState({ planCode, ...(shopIds ? { shopIds } : {}), orderId: null, termsAccepted: false, replaceAck: false });
    router.push(checkoutHref({ plan: planCode, step: planCode ? 'shops' : 'plan' }));
  };

  const badgeFor = (p) => {
    if (String(p.status).toUpperCase() === 'COMING_SOON') return 'COMING_SOON';
    if (p.code === sub?.planCode) return LIVE.includes(status) ? 'CURRENT' : 'EXPIRED';
    return 'AVAILABLE';
  };

  const actionFor = (p) => {
    const badge = badgeFor(p);
    const isTrial = String(p.planType).toUpperCase() === 'TRIAL';
    if (badge === 'COMING_SOON') return <button type="button" disabled className={cx(BTN_SECONDARY, 'w-full')}>Coming Soon</button>;
    if (isTrial) {
      if (badge === 'CURRENT') return <button type="button" disabled className={cx(BTN_SECONDARY, 'w-full')}>Trial active</button>;
      return me?.trialAvailable ? (
        <button type="button" onClick={() => startCheckout(p.code)} className={cx(BTN_PRIMARY, 'w-full')}>Start Free Trial</button>
      ) : (
        <button type="button" disabled className={cx(BTN_SECONDARY, 'w-full')}>Trial already used</button>
      );
    }
    const label = badge === 'CURRENT' ? 'Renew Plan' : isPaid && LIVE.includes(status) ? 'Switch to this plan' : 'Choose Plan';
    return (
      <button type="button" disabled={!payAvailable || !p.purchasable} onClick={() => startCheckout(p.code, badge === 'CURRENT' || badge === 'EXPIRED')} className={cx(BTN_PRIMARY, 'w-full')}>
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Subscription & Plan"
        subtitle="Your NearGFix plan, covered shops, payments and receipts."
        action={
          <>
            <button type="button" onClick={load} className={BTN_SECONDARY} aria-label="Refresh">
              <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canRenew ? (
              <button type="button" disabled={!payAvailable} onClick={() => startCheckout(sub.planCode, true)} className={BTN_SECONDARY}>
                <RotateCw className="h-4 w-4" aria-hidden="true" /> Renew
              </button>
            ) : null}
            <button type="button" disabled={!plans.length} onClick={() => startCheckout(null)} className={BTN_PRIMARY}>
              <ArrowUpCircle className="h-4 w-4" aria-hidden="true" /> {hasPlan ? 'Upgrade' : 'Choose a Plan'}
            </button>
          </>
        }
      />

      {errors.me ? <Notice tone="red" icon={AlertTriangle}>{errors.me}</Notice> : null}

      {pending ? (
        <Notice tone="amber" icon={Clock}>
          <p className="font-bold">A payment is in progress</p>
          <p className="mt-0.5">
            Order {pending.orderNo || ''} for {pending.planName || 'a plan'} · {formatPaise(pending.totalPaise)} is not confirmed yet. Check its status before starting a new
            payment.
          </p>
          <Link href={checkoutHref({ step: 'pay', order: pending.id })} className={cx(BTN_LINK, 'mt-2')}>
            Check payment status →
          </Link>
        </Notice>
      ) : null}

      {!loading && catalog && !payAvailable ? (
        <Notice tone="gray" icon={CreditCard}>
          Online payment is not available yet. You can still view plans{me?.trialAvailable ? ' and start the free trial' : ''}; paid plans will open for purchase soon.
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.6fr)] xl:items-start">
        {/* Left: current plan, details, shops */}
        <div className="flex min-w-0 flex-col gap-5">
          {loading ? (
            <SkeletonCard lines={6} />
          ) : hasPlan ? (
            <CurrentPlan sub={sub} status={status} />
          ) : !errors.me ? (
            <Card>
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3F3F3] text-[#666666]">
                  <Crown className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-[#111111]">No active plan</p>
                  <p className="mt-1 text-sm text-[#666666]">
                    {me?.trialAvailable ? 'Start the free trial or choose a plan for your shops.' : 'Choose a plan to cover your shops.'}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {!loading && hasPlan ? <PlanDetails sub={sub} me={me} /> : null}
          {!loading && hasPlan ? <ManageShops shops={me?.shops || []} canRenew={canRenew && payAvailable} onRenew={() => startCheckout(sub.planCode, true)} /> : null}
        </div>

        {/* Right: plans + payment history */}
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.08em] text-[#666666]">Available Plans</p>
            {errors.catalog ? <Notice tone="red" icon={AlertTriangle}>{errors.catalog}</Notice> : null}
            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SkeletonCard lines={6} />
                <SkeletonCard lines={6} />
              </div>
            ) : plans.length === 0 && !errors.catalog ? (
              <Card>
                <p className="text-sm text-[#666666]">No plans are available right now.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {plans.map((p) => (
                  <PlanCard key={p.code} plan={p} badge={badgeFor(p)} selected={badgeFor(p) === 'CURRENT'} action={actionFor(p)} />
                ))}
              </div>
            )}
          </div>

          <PaymentHistory
            rows={history}
            invoices={invoices}
            loading={loading}
            error={errors.history}
            onInvoiceUpdated={(v) => setInvoices((list) => (list || []).map((i) => (i.id === v.id ? v : i)))}
          />
        </div>
      </div>
    </div>
  );
}

function CurrentPlan({ sub, status }) {
  const trial = status === 'TRIAL';
  return (
    <Card className="bg-[#F8F8F8]">
      <div className="flex items-start gap-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#024A57]">
          <Crown className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[#666666]">Current Plan</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <p className="break-words text-lg font-extrabold text-[#111111]">
              {sub.planName || sub.planCode}
              {sub.durationLabel ? <span className="text-sm font-semibold text-[#666666]"> · {sub.durationLabel}</span> : null}
            </p>
            <Pill status={status} />
          </div>
          {sub.legacy ? <p className="mt-1 text-xs text-[#98A2B3]">Legacy plan — kept with its original limits until it ends.</p> : null}
        </div>
      </div>
      <div className="mt-4 divide-y divide-[#ECECEC] rounded-2xl bg-white px-4">
        <Row label="Status" value={status.replace(/_/g, ' ')} tone={LIVE.includes(status) ? 'green' : 'red'} />
        <Row label="Started" value={formatDate(sub.startedAt)} />
        <Row label="Valid until" value={formatDate(sub.endsAt)} />
        <Row label="Amount paid" value={trial && !Number(sub.amountPaidPaise) ? `${formatPaise(0)} (Free Trial)` : formatPaise(sub.amountPaidPaise)} strong />
      </div>
    </Card>
  );
}

function PlanDetails({ sub, me }) {
  const ent = me?.entitlements || {};
  const usage = me?.usage || {};
  const shopsCovered = sub.shopCount ?? usage.shopsUsed ?? (me?.shops || []).length;
  const enabled = ENTITLEMENT_LABELS.filter(([k]) => ent[k]);
  const days = sub.daysRemaining;
  return (
    <Card title="Plan Details">
      <div className="divide-y divide-[#ECECEC]">
        <Row label="Started" value={formatDate(sub.startedAt)} />
        <Row label="Expires" value={formatDate(sub.endsAt)} />
        <Row label="Days remaining" value={days != null ? `${days} day${days === 1 ? '' : 's'}` : '—'} tone={days != null && days <= 7 ? 'red' : undefined} />
        <Row label="Shops covered" value={`${shopsCovered ?? '—'}${ent.shopLimit != null ? ` of ${ent.shopLimit}` : ''}`} />
        <Row
          label="Employees used"
          value={`${usage.employeesUsedMaxPerShop ?? '—'} of ${limitText(ent.employeeLimit)}${ent.employeeLimitScope === 'PER_SHOP' ? ' per shop' : ''}`}
        />
        <Row label="Sell orders" value={`${usage.sellOrdersUsed ?? '—'} of ${limitText(ent.sellOrderLimit)}`} />
        <Row label="Buy orders" value={limitText(ent.buyOrderLimit)} />
        <Row label="Pickup service" value={ent.pickupEnabled ? 'Enabled' : 'Not included'} tone={ent.pickupEnabled ? 'green' : undefined} />
      </div>
      <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-wide text-[#666666]">Enabled features</p>
      {enabled.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {enabled.map(([k, label]) => (
            <Pill key={k} tone="green">{label}</Pill>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-[#666666]">No paid features on this plan.</p>
      )}
    </Card>
  );
}

function ManageShops({ shops, canRenew, onRenew }) {
  return (
    <Card
      title="Manage Shops"
      subtitle={`${shops.length} shop${shops.length === 1 ? '' : 's'} on this subscription`}
      action={
        <Link href="/shop-home/account/business-profile/" className={BTN_LINK}>
          <Store className="h-4 w-4" aria-hidden="true" /> Business locations
        </Link>
      }
    >
      {shops.length === 0 ? (
        <p className="text-sm text-[#666666]">No shops are linked to this subscription.</p>
      ) : (
        <ul className="divide-y divide-[#ECECEC]">
          {shops.map((s) => (
            <li key={s.shopId} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-[#111111]">{s.name || 'Shop'}</p>
                <p className="text-xs text-[#666666]">
                  {formatDate(s.startsAt)} – {formatDate(s.endsAt)}
                </p>
              </div>
              <span className="shrink-0">
                <Pill status={s.status} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {canRenew ? (
        <button type="button" onClick={onRenew} className={cx(BTN_SECONDARY, 'mt-4 w-full')}>
          <RotateCw className="h-4 w-4" aria-hidden="true" /> Renew or change covered shops
        </button>
      ) : null}
    </Card>
  );
}

// History row → its InvoiceView (by invoiceId, else Razorpay payment id / order no).
function invoiceFor(p, invoices) {
  if (!Array.isArray(invoices)) return null;
  return (
    invoices.find((i) => p.invoiceId && i.id === p.invoiceId) ||
    invoices.find((i) => p.razorpayPaymentId && i.payment?.razorpayPaymentId === p.razorpayPaymentId) ||
    invoices.find((i) => p.orderNo && i.payment?.orderNo === p.orderNo) ||
    null
  );
}

function PaymentHistory({ rows, invoices, loading, error, onInvoiceUpdated }) {
  const list = Array.isArray(rows) ? rows : [];
  return (
    <Card title="Payment History">
      {error ? <Notice tone="red" icon={AlertTriangle}>{error}</Notice> : null}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-[#F3F3F3]" />
          ))}
        </div>
      ) : list.length === 0 && !error ? (
        <p className="text-sm text-[#666666]">No payments yet.</p>
      ) : (
        <ul className="divide-y divide-[#ECECEC]">
          {list.map((p) => {
            const inv = invoiceFor(p, invoices);
            const invoiceId = inv?.id || p.invoiceId;
            return (
            <li key={p.paymentId || p.orderId} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words text-sm font-bold text-[#111111]">
                    {p.planName || '—'}
                    {p.durationLabel ? ` · ${p.durationLabel}` : ''}
                  </p>
                  <Pill status={p.status} />
                </div>
                <p className="mt-0.5 text-xs text-[#666666]">
                  {formatDateTime(p.paidAt)} · {p.shopCount ?? '—'} shop{p.shopCount === 1 ? '' : 's'} · {p.method || 'UPI'}
                  {p.orderNo ? ` · ${p.orderNo}` : ''}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="text-base font-extrabold text-[#111111]">{formatPaise(p.amountPaise)}</p>
                {p.paymentId && p.receiptNo ? (
                  <Link
                    href={`${SUB_BASE}/receipt/?id=${encodeURIComponent(p.paymentId)}${invoiceId ? `&invoice=${encodeURIComponent(invoiceId)}` : ''}`}
                    className={BTN_LINK}
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" /> Receipt
                  </Link>
                ) : null}
              </div>
              {invoiceId ? (
                <div className="sm:col-span-2">
                  <InvoiceActions invoice={inv} fallback={p} onUpdated={onInvoiceUpdated} />
                </div>
              ) : null}
            </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
