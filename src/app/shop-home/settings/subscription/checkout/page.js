'use client';

/**
 * /shop-home/settings/subscription/checkout — NearGFix Subscription v2
 * purchase flow, one column, step in the URL (?step=plan|shops|summary|pay|
 * confirm|success) and selections in sessionStorage (survives reloads and
 * the "add new shop" detour). Nothing is activated until the server says
 * so: paid plans only show success after /payment/verify or
 * /payment/status returns ACTIVATED; the trial after /trial/activate.
 * On entry, any unfinished order is reconciled via /payment/status before
 * a new attempt is allowed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Check, Clock, CreditCard, Loader2, Plus, RefreshCw, Store } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import SearchField from '@/components/shop-dashboard/SearchField';
import PlanCard from '@/components/subscription/PlanCard';
import { GstBreakdown, gstNote } from '@/components/subscription/GstInvoice';
import { BTN_LINK, BTN_PRIMARY, BTN_SECONDARY, Card, Notice, Pill, Row, SkeletonCard, SUB_BASE, checkoutHref } from '@/components/subscription/shopUi';
import { fetchMyProfile } from '@/lib/shopProfile';
import {
  activateTrial,
  cancelPaymentOrder,
  fetchEligibleShops,
  fetchPaymentStatus,
  fetchQuote,
  fetchQuotePreview,
  fetchSubscriptionCatalog,
  fetchSubscriptionMe,
} from '@/lib/shopSubscription';
import {
  OPEN_ORDER_STATUSES,
  clearCheckoutState,
  errorText,
  formatDate,
  formatPaise,
  readCheckoutState,
  writeCheckoutState,
} from '@/lib/subscriptionFormat';
import PayStep, { SuccessStep } from './PayStep';

const up = (v) => String(v || '').toUpperCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTrialPlan = (p) => up(p?.planType) === 'TRIAL';

export default function CheckoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const rawStep = params.get('step') || 'plan';
  const urlPlan = params.get('plan') || '';
  const urlOrder = params.get('order') || '';

  const [catalog, setCatalog] = useState(null);
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [booted, setBooted] = useState(false);
  const [cs, setCs] = useState({});
  const [gate, setGate] = useState({ state: 'checking' });
  const [activeOrder, setActiveOrder] = useState(null);

  const update = useCallback((patch) => setCs(writeCheckoutState(patch)), []);

  const boot = useCallback(async () => {
    setLoadError('');
    setBooted(false);
    setCs(readCheckoutState());
    const [c, m, p] = await Promise.allSettled([fetchSubscriptionCatalog(), fetchSubscriptionMe(), fetchMyProfile()]);
    if (c.status === 'fulfilled') setCatalog(c.value);
    if (m.status === 'fulfilled') setMe(m.value);
    if (p.status === 'fulfilled') setProfile(p.value);
    const failed = [c, m].find((r) => r.status === 'rejected');
    if (failed) setLoadError(errorText(failed.reason, 'Could not load subscription details.'));
    setBooted(true);
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  // A plan picked from the overview arrives in the URL; a different plan resets the order/consent.
  useEffect(() => {
    if (!booted || !urlPlan) return;
    const s = readCheckoutState();
    if (s.planCode !== urlPlan) update({ planCode: urlPlan, orderId: null, termsAccepted: false, replaceAck: false });
  }, [booted, urlPlan, update]);

  const plans = useMemo(() => (Array.isArray(catalog?.plans) ? catalog.plans : []), [catalog]);
  const planCode = urlPlan || cs.planCode || '';
  const plan = plans.find((p) => p.code === planCode) || null;
  const trial = isTrialPlan(plan);
  // Trial has no summary/pay; paid plans have no confirm step.
  const step = trial && (rawStep === 'summary' || rawStep === 'pay') ? 'confirm' : !trial && rawStep === 'confirm' ? 'summary' : rawStep;
  const shopIds = useMemo(() => (Array.isArray(cs.shopIds) ? cs.shopIds : []), [cs.shopIds]);
  const shopNames = cs.shopNames || {};
  const checkout = catalog?.checkout || {};
  const payAvailable = !!(checkout.webEnabled && checkout.configured);

  const go = useCallback((next, extra = {}) => router.push(checkoutHref({ step: next, plan: planCode, ...extra })), [router, planCode]);

  const onActivated = useCallback(
    (order) => {
      setActiveOrder(order);
      clearCheckoutState();
      setCs({});
      router.replace(checkoutHref({ step: 'success', order: order.id }));
    },
    [router],
  );

  // Reconcile any unfinished order before a new attempt is allowed.
  const runGate = useCallback(async () => {
    if (!me) return;
    const candidate = urlOrder || me.pendingOrder?.id || readCheckoutState().orderId;
    if (!candidate) {
      setGate({ state: 'clear' });
      return;
    }
    setGate({ state: 'checking' });
    let order = null;
    let err = null;
    for (let i = 0; i < 3; i += 1) {
      try {
        order = (await fetchPaymentStatus(candidate))?.order || null;
        err = null;
      } catch (e) {
        err = e;
      }
      if (order && up(order.status) !== 'PAID') break;
      if (i < 2) await sleep(2000);
    }
    if (!order) {
      setGate({ state: 'error', message: errorText(err, 'Could not check your previous payment.') });
      return;
    }
    const st = up(order.status);
    if (st === 'ACTIVATED') {
      onActivated(order);
      return;
    }
    if (OPEN_ORDER_STATUSES.includes(st)) {
      setActiveOrder(order);
      setGate({ state: 'open', order });
      return;
    }
    if (readCheckoutState().orderId === candidate) update({ orderId: null });
    setActiveOrder(null);
    setGate({ state: 'clear' });
  }, [me, urlOrder, onActivated, update]);

  useEffect(() => {
    if (!me || step === 'success') return;
    runGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconcile once per load, not on every step change
  }, [me]);

  const selectPlan = (p) => {
    update({ planCode: p.code, orderId: null, termsAccepted: false, replaceAck: false });
    router.push(checkoutHref({ step: 'shops', plan: p.code }));
  };

  const resumeOrder = (order) => {
    update({
      planCode: order.planCode,
      shopIds: order.shopIds || (order.shops || []).map((s) => s.shopId),
      shopNames: Object.fromEntries((order.shops || []).map((s) => [s.shopId, s.name])),
      orderId: order.id,
      termsAccepted: true,
    });
    router.push(checkoutHref({ step: 'pay', plan: order.planCode, order: order.id }));
  };

  const steps = trial
    ? [['plan', 'Plan'], ['shops', 'Shops'], ['confirm', 'Confirm']]
    : [['plan', 'Plan'], ['shops', 'Shops'], ['summary', 'Summary'], ['pay', 'Pay']];

  let body;
  if (!booted) body = <SkeletonCard lines={6} />;
  else if (loadError)
    body = (
      <Notice tone="red" icon={AlertTriangle}>
        {loadError}
        <button type="button" onClick={boot} className={cx(BTN_LINK, 'ml-2')}>
          Retry
        </button>
      </Notice>
    );
  else if (step === 'success') body = <SuccessStep orderId={urlOrder} trial={params.get('trial') === '1'} initialOrder={activeOrder} />;
  else if (gate.state === 'checking')
    body = (
      <Card>
        <p className="flex items-center gap-2 text-sm text-[#666666]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking for an unfinished payment…
        </p>
      </Card>
    );
  else if (gate.state === 'error')
    body = (
      <Notice tone="red" icon={AlertTriangle}>
        <p>{gate.message} A new payment can’t start until the previous one is checked.</p>
        <button type="button" onClick={runGate} className={cx(BTN_LINK, 'mt-2')}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Check again
        </button>
      </Notice>
    );
  else if (gate.state === 'open' && step !== 'pay')
    body = (
      <PendingOrderPanel
        order={gate.order}
        onResume={() => resumeOrder(gate.order)}
        onRecheck={runGate}
        onCancelled={() => {
          update({ orderId: null });
          setActiveOrder(null);
          setGate({ state: 'clear' });
        }}
      />
    );
  else if (step === 'plan' || !plan)
    body = (
      <PlanStep
        plans={plans}
        me={me}
        payAvailable={payAvailable}
        selected={planCode}
        missing={!!planCode && !plan && step !== 'plan'}
        onSelect={selectPlan}
      />
    );
  else if (step === 'shops')
    body = (
      <ShopsStep
        plan={plan}
        trial={trial}
        selected={shopIds}
        onChange={(ids, names) => update({ shopIds: ids, shopNames: { ...shopNames, ...names }, orderId: null })}
        onBack={() => go('plan')}
        onNext={() => go(trial ? 'confirm' : 'summary')}
      />
    );
  else if (!shopIds.length && !(step === 'pay' && activeOrder))
    body = (
      <Notice tone="amber" icon={Store}>
        Select at least one shop first.
        <button type="button" onClick={() => go('shops')} className={cx(BTN_LINK, 'ml-2')}>
          Select shops
        </button>
      </Notice>
    );
  else if (step === 'confirm')
    body = <TrialConfirmStep plan={plan} shopIds={shopIds} shopNames={shopNames} onBack={() => go('shops')} onDone={() => { clearCheckoutState(); router.replace(checkoutHref({ step: 'success', trial: '1' })); }} />;
  else if (step === 'summary')
    body = (
      <SummaryStep
        plan={plan}
        shopIds={shopIds}
        shopNames={shopNames}
        profile={profile}
        cs={cs}
        payAvailable={payAvailable}
        onChangePlan={() => go('plan')}
        onEditShops={() => go('shops')}
        onContinue={(replaceAck) => {
          update({ termsAccepted: true, replaceAck });
          go('pay');
        }}
      />
    );
  else if (step === 'pay')
    body = (
      <PayStep
        plan={plan}
        shopIds={shopIds}
        shopNames={shopNames}
        termsOk={!!cs.termsAccepted}
        replaceAck={!!cs.replaceAck}
        payAvailable={payAvailable}
        activeOrder={activeOrder}
        setActiveOrder={setActiveOrder}
        onOrderCreated={(o) => update({ orderId: o.id })}
        onOrderClosed={() => {
          update({ orderId: null });
          setGate({ state: 'clear' });
        }}
        onActivated={onActivated}
        onBack={() => go('summary')}
      />
    );
  else body = <PlanStep plans={plans} me={me} payAvailable={payAvailable} selected={planCode} onSelect={selectPlan} />;

  const showSteps = booted && !loadError && step !== 'success' && gate.state !== 'open';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={step === 'success' ? 'Subscription' : 'Choose your plan'}
        subtitle={
          step === 'success'
            ? 'Activation confirmed by NearGFix.'
            : plan && step !== 'plan'
              ? `${plan.name}${plan.durationLabel ? ` · ${plan.durationLabel}` : ''}`
              : 'Pay securely with UPI. Your plan starts only after payment is confirmed.'
        }
        action={
          <Link href={`${SUB_BASE}/`} className={BTN_SECONDARY}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Subscription
          </Link>
        }
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        {showSteps ? <StepBar steps={steps} current={step === 'plan' || !plan ? 'plan' : step} /> : null}
        {booted && catalog && !payAvailable && !trial && step !== 'success' ? (
          <Notice tone="gray" icon={CreditCard}>
            Online payment is not available yet. Paid plans can’t be purchased right now — please check back soon.
          </Notice>
        ) : null}
        {body}
      </div>
    </div>
  );
}

/* --------------------------------- Pieces --------------------------------- */

function StepBar({ steps, current }) {
  const idx = Math.max(0, steps.findIndex(([k]) => k === current));
  return (
    <ol className="flex items-center gap-1.5" aria-label="Checkout steps">
      {steps.map(([k, label], i) => (
        <li key={k} className="flex min-w-0 flex-1 items-center gap-1.5">
          <span
            className={cx(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              i < idx ? 'bg-[#024A57] text-white' : i === idx ? 'bg-[#F3BF23] text-[#1E1E1E]' : 'bg-[#F3F3F3] text-[#98A2B3]',
            )}
            aria-current={i === idx ? 'step' : undefined}
          >
            {i < idx ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
          </span>
          <span className={cx('hidden truncate text-xs font-bold sm:block', i === idx ? 'text-[#111111]' : 'text-[#98A2B3]')}>{label}</span>
          {i < steps.length - 1 ? <span className="h-px min-w-[12px] flex-1 bg-[#ECECEC]" /> : null}
        </li>
      ))}
    </ol>
  );
}

function PendingOrderPanel({ order, onResume, onRecheck, onCancelled }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const st = up(order.status);

  const cancel = async () => {
    setBusy(true);
    setMsg('');
    try {
      const o = await cancelPaymentOrder(order.id, 'Owner started a new checkout');
      if (up(o?.status) === 'CANCELLED') onCancelled();
      else setMsg('Razorpay shows a payment on this order, so it was not cancelled. Check its status instead.');
    } catch (e) {
      setMsg(errorText(e, 'Could not cancel this order.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Unfinished payment" subtitle="Finish or cancel it before starting a new one.">
      <Notice tone="amber" icon={Clock}>
        {st === 'PAID' ? 'Payment received — activation is still being confirmed.' : 'This order has not been paid yet.'}
      </Notice>
      <div className="mt-3 divide-y divide-[#ECECEC]">
        <Row label="Order" value={order.orderNo || order.id} />
        <Row label="Plan" value={`${order.planName || order.planCode}${order.durationLabel ? ` · ${order.durationLabel}` : ''}`} />
        <Row label="Shops" value={(order.shops || []).map((s) => s.name).join(', ') || (order.shopIds || []).length} />
        <Row label="Amount" value={formatPaise(order.totalPaise)} strong />
        <Row label="Status" value={<Pill status={order.status} />} />
      </div>
      {msg ? <p className="mt-3 text-sm text-red-600">{msg}</p> : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={onRecheck} className={BTN_SECONDARY}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Check again
        </button>
        {st !== 'PAID' ? (
          <>
            <button type="button" onClick={cancel} disabled={busy} className={BTN_SECONDARY}>
              {busy ? 'Cancelling…' : 'Cancel order'}
            </button>
            <button type="button" onClick={onResume} className={BTN_PRIMARY}>
              Resume payment
            </button>
          </>
        ) : null}
      </div>
    </Card>
  );
}

function PlanStep({ plans, me, payAvailable, selected, missing, onSelect }) {
  const current = me?.subscription;
  const live = ['ACTIVE', 'TRIAL'].includes(up(current?.status));
  const visible = plans.filter((p) => !isTrialPlan(p) || me?.trialAvailable || p.code === current?.planCode);
  return (
    <div className="flex flex-col gap-4">
      {missing ? <Notice tone="amber" icon={AlertTriangle}>That plan is no longer available. Please choose another.</Notice> : null}
      {visible.length === 0 ? (
        <Card>
          <p className="text-sm text-[#666666]">No plans are available right now.</p>
        </Card>
      ) : null}
      {visible.map((p) => {
        const soon = up(p.status) === 'COMING_SOON';
        const isCurrent = p.code === current?.planCode;
        const badge = soon ? 'COMING_SOON' : isCurrent ? (live ? 'CURRENT' : 'EXPIRED') : 'AVAILABLE';
        const trial = isTrialPlan(p);
        const blocked = soon || !p.purchasable || (trial ? !me?.trialAvailable : !payAvailable);
        return (
          <PlanCard
            key={p.code}
            plan={p}
            badge={badge}
            selected={selected === p.code}
            action={
              <button type="button" disabled={blocked} onClick={() => onSelect(p)} className={cx(BTN_PRIMARY, 'w-full')}>
                {soon ? 'Coming Soon' : trial ? 'Start Free Trial' : isCurrent ? 'Renew this plan' : 'Select Plan'}
              </button>
            }
          />
        );
      })}
    </div>
  );
}

function locationText(loc) {
  if (!loc) return '';
  if (typeof loc === 'string') return loc;
  return [loc.area, loc.city, loc.district, loc.state].filter(Boolean).join(', ');
}

function ShopsStep({ plan, trial, selected, onChange, onBack, onNext }) {
  const [shops, setShops] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const max = plan.shopLimit ?? null;

  const load = useCallback(() => {
    setError('');
    setShops(null);
    fetchEligibleShops()
      .then(setShops)
      .catch((e) => {
        setShops([]);
        setError(errorText(e, 'Could not load your shops.'));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => shops || [], [shops]);
  const eligible = list.filter((s) => s.selectable !== false);
  const validSelected = shops ? selected.filter((id) => eligible.some((s) => s.shopId === id)) : selected;

  // Drop selections that are no longer selectable once the list is known.
  useEffect(() => {
    if (shops && validSelected.length !== selected.length) onChange(validSelected, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the server list arrives
  }, [shops]);

  const nameMap = (ids) => Object.fromEntries(ids.map((id) => [id, list.find((s) => s.shopId === id)?.name || '']));
  const setIds = (ids) => onChange(ids, nameMap(ids));
  const toggle = (id) => {
    if (validSelected.includes(id)) setIds(validSelected.filter((x) => x !== id));
    else if (max == null || validSelected.length < max) setIds([...validSelected, id]);
  };
  const selectAll = () => setIds(eligible.slice(0, max ?? eligible.length).map((s) => s.shopId));

  const count = validSelected.length;
  useEffect(() => {
    if (trial || count < 1) {
      setEstimate(null);
      return undefined;
    }
    let alive = true;
    setEstimating(true);
    const t = setTimeout(() => {
      fetchQuotePreview(plan.code, count)
        .then((q) => alive && setEstimate(q))
        .catch(() => alive && setEstimate(null))
        .finally(() => alive && setEstimating(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [plan.code, count, trial]);

  const term = query.trim().toLowerCase();
  const filtered = term
    ? list.filter((s) => [s.name, s.shopCode, locationText(s.location)].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)))
    : list;
  const addShopHref = `/shop-home/account/business-profile/?add=1&returnTo=${encodeURIComponent(checkoutHref({ step: 'shops', plan: plan.code }))}`;

  return (
    <Card
      title="Select Shops"
      subtitle={max != null ? `Choose up to ${max} shop${max === 1 ? '' : 's'} for ${plan.name}.` : `Choose the shops to cover with ${plan.name}.`}
      action={
        <Link href={addShopHref} className={BTN_LINK}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add new shop
        </Link>
      }
    >
      <SearchField value={query} onChange={setQuery} placeholder="Search by name, code or location" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#111111]">
          {count} selected{max != null ? ` of ${max} max` : ''}
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={selectAll} disabled={!eligible.length} className={BTN_LINK}>
            Select all eligible
          </button>
          <button type="button" onClick={() => setIds([])} disabled={!count} className={BTN_LINK}>
            Clear
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3">
          <Notice tone="red" icon={AlertTriangle}>
            {error}
            <button type="button" onClick={load} className={cx(BTN_LINK, 'ml-2')}>
              Retry
            </button>
          </Notice>
        </div>
      ) : null}

      <ul className="mt-3 flex flex-col gap-2">
        {!shops
          ? [0, 1, 2].map((i) => <li key={i} className="h-16 animate-pulse rounded-2xl bg-[#F3F3F3]" />)
          : filtered.map((s) => {
              const checked = validSelected.includes(s.shopId);
              const disabled = s.selectable === false || (!checked && max != null && count >= max);
              const cov = s.coverage || {};
              return (
                <li key={s.shopId}>
                  <label
                    className={cx(
                      'flex items-start gap-3 rounded-2xl border px-4 py-3 transition',
                      checked ? 'border-[#024A57] bg-[#E5F3F5]' : 'border-[#ECECEC] bg-white',
                      disabled && !checked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-[#F8F8F8]',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-[#024A57]"
                      checked={checked}
                      disabled={disabled && !checked}
                      onChange={() => toggle(s.shopId)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="break-words text-sm font-bold text-[#111111]">{s.name || 'Shop'}</span>
                        {s.shopCode ? <span className="rounded bg-[#F3F3F3] px-1.5 py-0.5 font-mono text-[0.68rem] text-[#444444]">{s.shopCode}</span> : null}
                      </span>
                      {locationText(s.location) ? <span className="mt-0.5 block break-words text-xs text-[#666666]">{locationText(s.location)}</span> : null}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#666666]">
                        <Pill status={cov.status || 'NONE'}>{cov.status && up(cov.status) !== 'NONE' ? up(cov.status) : 'Not covered'}</Pill>
                        {cov.planName ? <span>{cov.planName}</span> : null}
                        {cov.endsAt ? <span>until {formatDate(cov.endsAt)}</span> : null}
                      </span>
                      {s.selectable === false && s.reason ? <span className="mt-1 block text-xs text-amber-700">{s.reason}</span> : null}
                    </span>
                  </label>
                </li>
              );
            })}
        {shops && filtered.length === 0 && !error ? (
          <li className="rounded-2xl border border-dashed border-[#ECECEC] px-4 py-6 text-center text-sm text-[#666666]">
            {list.length ? 'No shops match your search.' : 'No shops found on your account yet.'}
          </li>
        ) : null}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F8F8F8] px-4 py-3">
        <p className="text-sm text-[#666666]">
          {trial ? 'Free trial' : `Estimate for ${count} shop${count === 1 ? '' : 's'}`}
        </p>
        <p className="text-lg font-extrabold text-[#111111]">
          {trial ? formatPaise(0) : count < 1 ? '—' : estimating && !estimate ? '…' : estimate ? formatPaise(estimate.totalPaise) : '—'}
        </p>
      </div>
      {!trial && estimate && Number(estimate.discountPaise) > 0 ? (
        <p className="mt-1.5 text-xs text-[#024A57]">You save {formatPaise(estimate.discountPaise)} on additional shops.</p>
      ) : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onBack} className={BTN_SECONDARY}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Change Plan
        </button>
        <button type="button" onClick={onNext} disabled={count < 1} className={BTN_PRIMARY}>
          Continue
        </button>
      </div>
    </Card>
  );
}

function TermsCheckbox({ checked, onChange }) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-[#111111]">
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#024A57]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        I have read and agree to the{' '}
        <a href="/terms/" target="_blank" rel="noopener noreferrer" className="font-bold text-[#024A57] underline">
          Subscription Terms
        </a>
        .
      </span>
    </label>
  );
}

function SummaryStep({ plan, shopIds, shopNames, profile, cs, payAvailable, onChangePlan, onEditShops, onContinue }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [terms, setTerms] = useState(!!cs.termsAccepted);
  const [replaceAck, setReplaceAck] = useState(!!cs.replaceAck);
  const idsKey = shopIds.join(',');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setQuote(await fetchQuote(plan.code, idsKey.split(',').filter(Boolean)));
    } catch (e) {
      setQuote(null);
      setError(errorText(e, 'Could not prepare your order summary.'));
    } finally {
      setLoading(false);
    }
  }, [plan.code, idsKey]);

  useEffect(() => {
    load();
  }, [load]);

  const business = profile?.businessName || profile?.locations?.[0]?.name;
  const names = shopIds.map((id) => shopNames[id]).filter(Boolean);
  const ready = quote && terms && (!quote.replacesCurrent || replaceAck) && payAvailable;

  return (
    <Card
      title="Order Summary"
      action={
        <button type="button" onClick={load} disabled={loading} className={BTN_LINK}>
          <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" /> Refresh
        </button>
      }
    >
      {error ? (
        <Notice tone="red" icon={AlertTriangle}>
          {error}
        </Notice>
      ) : null}
      {loading && !quote ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-[#F3F3F3]" />
          ))}
        </div>
      ) : quote ? (
        <div className={cx(loading && 'opacity-60')}>
          <div className="divide-y divide-[#ECECEC]">
            <Row label="Owner" value={profile?.name || '—'} />
            {business ? <Row label="Business" value={business} /> : null}
            <Row
              label="Plan"
              value={
                <span className="inline-flex flex-wrap items-center justify-end gap-2">
                  {quote.planName || plan.name}
                  {quote.durationLabel ? ` · ${quote.durationLabel}` : ''}
                  {quote.purpose ? <Pill tone={quote.purpose === 'RENEW' ? 'blue' : 'green'}>{quote.purpose}</Pill> : null}
                </span>
              }
            />
            <Row label="Shops" value={`${quote.shopCount ?? shopIds.length}${names.length ? ` — ${names.join(', ')}` : ''}`} />
            <Row label="Starts" value={formatDate(quote.startsAt)} />
            <Row label="Ends" value={formatDate(quote.endsAt)} />
          </div>

          <div className="mt-4 rounded-2xl bg-[#F8F8F8] px-4 py-2">
            <div className="divide-y divide-[#ECECEC]">
              <Row label="First shop" value={formatPaise(quote.firstShopPaise)} />
              {Number(quote.additionalShopsCount) > 0 ? (
                <Row
                  label={`Additional shops (${quote.additionalShopsCount} × ${formatPaise(quote.additionalShopUnitPaise)})`}
                  value={formatPaise(quote.additionalShopsTotalPaise)}
                />
              ) : null}
              {quote.gst ? (
                <GstBreakdown gst={quote.gst} />
              ) : (
                <>
                  {Number(quote.discountPaise) > 0 ? (
                    <Row label={`Multi-shop discount (${quote.additionalShopDiscountPct}%, included)`} value={`−${formatPaise(quote.discountPaise)}`} tone="green" />
                  ) : null}
                  <Row label="Subtotal" value={formatPaise(quote.subtotalPaise)} />
                  {Number(quote.taxPercent) > 0 ? <Row label={`Includes tax (${quote.taxPercent}%)`} value={formatPaise(quote.taxPaise)} /> : null}
                  <Row label="Final payable" value={formatPaise(quote.totalPaise)} strong />
                </>
              )}
            </div>
          </div>
          {quote.gst ? <p className="mt-2 text-xs text-[#666666]">{gstNote(quote.gst)}</p> : null}
          {quote.renewalPricePaise != null ? (
            <p className="mt-2 text-xs text-[#666666]">Renewal price at the end of this term: {formatPaise(quote.renewalPricePaise)} (at current prices).</p>
          ) : null}

          {quote.replacesCurrent ? (
            <div className="mt-4 space-y-3">
              <Notice tone="amber" icon={AlertTriangle}>
                {quote.notice || 'Your current plan ends as soon as this one is activated. Unused time is not credited.'}
              </Notice>
              <label className="flex items-start gap-2.5 text-sm text-[#111111]">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#024A57]" checked={replaceAck} onChange={(e) => setReplaceAck(e.target.checked)} />
                <span>I understand my current plan will end now with no credit.</span>
              </label>
            </div>
          ) : null}

          <div className="mt-4">
            <TermsCheckbox checked={terms} onChange={setTerms} />
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onChangePlan} className={BTN_SECONDARY}>
          Change Plan
        </button>
        <button type="button" onClick={onEditShops} className={BTN_SECONDARY}>
          Edit Shops
        </button>
      </div>
      <button type="button" disabled={!ready || loading} onClick={() => onContinue(!!quote?.replacesCurrent && replaceAck)} className={cx(BTN_PRIMARY, 'mt-2 w-full')}>
        {quote ? `Continue to pay ${formatPaise(quote.totalPaise)}` : 'Continue'}
      </button>
      {!payAvailable ? <p className="mt-2 text-center text-xs text-[#666666]">Online payment is not available yet.</p> : null}
    </Card>
  );
}

function TrialConfirmStep({ plan, shopIds, shopNames, onBack, onDone }) {
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const names = shopIds.map((id) => shopNames[id]).filter(Boolean);

  const activate = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await activateTrial(shopIds);
      const st = up(res?.subscription?.status);
      if (st === 'TRIAL' || st === 'ACTIVE') onDone();
      else setError('The trial could not be confirmed. Please refresh and check your subscription.');
    } catch (e) {
      setError(errorText(e, 'Could not start the free trial.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Confirm Free Trial" subtitle="No payment needed.">
      <div className="divide-y divide-[#ECECEC]">
        <Row label="Plan" value={`${plan.name}${plan.durationLabel ? ` · ${plan.durationLabel}` : ''}`} />
        <Row label="Shops" value={`${shopIds.length}${names.length ? ` — ${names.join(', ')}` : ''}`} />
        <Row label="Price" value={formatPaise(0)} strong />
      </div>
      {Array.isArray(plan.features) && plan.features.length ? (
        <ul className="mt-3 space-y-1.5">
          {plan.features.map((f, i) => (
            // eslint-disable-next-line react/no-array-index-key -- server display lines
            <li key={i} className="flex items-start gap-2 text-sm text-[#111111]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#024A57]" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4">
        <TermsCheckbox checked={terms} onChange={setTerms} />
      </div>
      {error ? (
        <div className="mt-3">
          <Notice tone="red" icon={AlertTriangle}>
            {error}
          </Notice>
        </div>
      ) : null}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onBack} className={BTN_SECONDARY}>
          Edit Shops
        </button>
        <button type="button" onClick={activate} disabled={!terms || busy} className={BTN_PRIMARY}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? 'Activating…' : 'Activate Free Trial'}
        </button>
      </div>
    </Card>
  );
}
