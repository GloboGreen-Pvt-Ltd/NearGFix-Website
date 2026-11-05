'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Loader2, Minus, Plus, Save } from 'lucide-react';

import { subscriptionAdminApi } from '@/lib/api';
import { Button } from '@/components/PageHeader';
import { notifySuccess } from '@/lib/toast';
import { asList, errorText, formatPaise, paiseToRupeesInput, rupeesToPaise } from '@/lib/subscriptionFormat';
import { ErrorNote, Field, inputBase, inputCls, useDebounced } from './adminUi';

// Paid plans shops can buy or will see (INACTIVE/legacy rows are edited in the Plans tab).
const isPaid = (p) => String(p.planType || '').toUpperCase() !== 'TRIAL' && String(p.status || '').toUpperCase() !== 'INACTIVE';

export default function PricingTab() {
  const [plans, setPlans] = useState([]);
  const [edits, setEdits] = useState({}); // planId -> { price, pct }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = asList(await subscriptionAdminApi.plans())
        .filter(isPaid)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
      setPlans(list);
      setEdits(Object.fromEntries(list.map((p) => [p.id, { price: paiseToRupeesInput(p.pricePaise), pct: String(p.additionalShopDiscountPct ?? 0) }])));
    } catch (e) {
      setError(errorText(e, 'Could not load plans.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changed = plans.filter((p) => {
    const e = edits[p.id];
    return e && (rupeesToPaise(e.price) !== Number(p.pricePaise) || Number(e.pct) !== Number(p.additionalShopDiscountPct ?? 0));
  });
  const invalid = plans.some((p) => {
    const e = edits[p.id];
    const pct = Number(e?.pct);
    return !e || rupeesToPaise(e.price) === null || !Number.isFinite(pct) || pct < 0 || pct > 100;
  });

  const save = async () => {
    if (invalid || changed.length === 0) return;
    setSaving(true);
    setError('');
    try {
      await subscriptionAdminApi.updatePricing(
        changed.map((p) => ({ planId: p.id, pricePaise: rupeesToPaise(edits[p.id].price), additionalShopDiscountPct: Number(edits[p.id].pct) })),
      );
      notifySuccess('Pricing updated. New quotes use the new prices; existing subscriptions are unchanged.');
      load();
    } catch (e) {
      setError(errorText(e, 'Could not save pricing.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)] xl:items-start">
      <section className="rounded-xl border border-admin-border bg-admin-card shadow-sm">
        <div className="border-b border-admin-border px-4 py-3 sm:px-5">
          <h3 className="text-sm font-semibold text-slate-900">Plan prices &amp; additional-shop discounts</h3>
          <p className="text-xs text-admin-muted">Price is per shop for the whole term. The discount applies to every shop after the first.</p>
        </div>
        <div className="p-4 sm:p-5">
          <ErrorNote message={error} onRetry={plans.length ? undefined : load} />
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key -- skeleton
                <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <p className="py-6 text-center text-sm text-admin-muted">No paid plans found.</p>
          ) : (
            <div className="divide-y divide-admin-border">
              {plans.map((p) => {
                const e = edits[p.id] || {};
                return (
                  <div key={p.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_150px_120px] sm:items-end">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {p.name} · {p.durationLabel || p.code}
                      </p>
                      <p className="text-xs text-admin-muted">
                        <span className="font-mono">{p.code}</span> · now {formatPaise(p.pricePaise)} · {Number(p.additionalShopDiscountPct) || 0}% off
                      </p>
                    </div>
                    <Field label="Price (₹)">
                      <input
                        inputMode="decimal"
                        value={e.price ?? ''}
                        onChange={(ev) => setEdits((s) => ({ ...s, [p.id]: { ...s[p.id], price: ev.target.value } }))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Discount %">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={e.pct ?? ''}
                        onChange={(ev) => setEdits((s) => ({ ...s, [p.id]: { ...s[p.id], pct: ev.target.value } }))}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-admin-muted">
              {invalid ? 'Fix invalid values (price ≥ ₹0, discount 0–100%).' : changed.length ? `${changed.length} plan(s) changed.` : 'No unsaved changes.'}
            </p>
            <Button variant="primary" icon={Save} disabled={saving || invalid || changed.length === 0} onClick={save}>
              {saving ? 'Saving…' : 'Save Pricing'}
            </Button>
          </div>
        </div>
      </section>

      <QuoteCalculator plans={plans} />
    </div>
  );
}

function QuoteCalculator({ plans }) {
  const [planCode, setPlanCode] = useState('');
  const [shops, setShops] = useState(1);
  const debouncedShops = useDebounced(shops, 300);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!planCode && plans.length) setPlanCode(plans[0].code);
  }, [plans, planCode]);

  useEffect(() => {
    const n = Number(debouncedShops);
    if (!planCode || !Number.isInteger(n) || n < 1) {
      setQuote(null);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError('');
    subscriptionAdminApi
      .quotePreview(planCode, n)
      .then((q) => alive && setQuote(q))
      .catch((e) => {
        if (!alive) return;
        setQuote(null);
        setError(errorText(e, 'Could not get a quote.'));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [planCode, debouncedShops]);

  const rows = useMemo(
    () =>
      quote
        ? [
            ['First Shop Charge', formatPaise(quote.firstShopPaise)],
            ['Additional Shop Unit Price', formatPaise(quote.additionalShopUnitPaise)],
            [`Additional Shops Total (${quote.additionalShopsCount ?? 0})`, formatPaise(quote.additionalShopsTotalPaise)],
            [`Discount Saved (${quote.additionalShopDiscountPct ?? 0}%)`, formatPaise(quote.discountPaise)],
            Number(quote.taxPercent) > 0 ? [`Includes tax (${quote.taxPercent}%)`, formatPaise(quote.taxPaise)] : null,
          ].filter(Boolean)
        : [],
    [quote],
  );

  return (
    <section className="rounded-xl border border-admin-border bg-admin-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Calculator className="h-5 w-5 text-admin-accent" />
        <h3 className="text-sm font-semibold text-slate-900">Live price calculator</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field label="Plan">
          <select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className={inputCls}>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} · {p.durationLabel || p.code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Shops">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Fewer shops" onClick={() => setShops((n) => Math.max(1, Number(n) - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border bg-white hover:bg-slate-50">
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              min={1}
              value={shops}
              onChange={(e) => setShops(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className={`${inputBase} w-16 text-center`}
            />
            <button type="button" aria-label="More shops" onClick={() => setShops((n) => Number(n) + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border bg-white hover:bg-slate-50">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </Field>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 p-3">
        <ErrorNote message={error} />
        {loading && !quote ? (
          <p className="flex items-center gap-2 py-4 text-sm text-admin-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculating…
          </p>
        ) : quote ? (
          <>
            <dl className={`space-y-1.5 text-sm ${loading ? 'opacity-60' : ''}`}>
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3">
                  <dt className="text-admin-muted">{k}</dt>
                  <dd className="shrink-0 font-medium text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-admin-border pt-3">
              <span className="text-sm font-semibold text-slate-900">Final Total</span>
              <span className="text-xl font-semibold text-slate-900">{formatPaise(quote.totalPaise)}</span>
            </div>
            <p className="mt-2 text-xs text-admin-muted">Quoted by the server from saved prices (unsaved edits are not included).</p>
          </>
        ) : !error ? (
          <p className="py-4 text-sm text-admin-muted">Pick a plan to see the quote.</p>
        ) : null}
      </div>
    </section>
  );
}
