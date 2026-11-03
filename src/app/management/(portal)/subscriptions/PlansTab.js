'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Pencil, Plus, Power, Save, X } from 'lucide-react';

import { subscriptionAdminApi } from '@/lib/api';
import { Button } from '@/components/PageHeader';
import PlanCard, { planIcon } from '@/components/subscription/PlanCard';
import { notifyError, notifySuccess } from '@/lib/toast';
import { asList, errorText, formatPaise, limitText, paiseToRupeesInput, rupeesToPaise } from '@/lib/subscriptionFormat';
import { Badge, ErrorNote, Field, Modal, Toggle, inputCls } from './adminUi';

const FLAGS = [
  ['serviceBookingEnabled', 'Service booking'],
  ['pickupEnabled', 'Pickup service'],
  ['whatsappEnabled', 'WhatsApp alerts'],
  ['smsEnabled', 'SMS alerts'],
  ['reportsEnabled', 'Reports'],
  ['exportEnabled', 'Export'],
  ['prioritySupportEnabled', 'Priority support'],
];
const ICON_OPTIONS = ['', 'gift', 'crown', 'gem', 'star', 'zap', 'sparkles'];

export default function PlansTab() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // plan | {} for new
  const [toggling, setToggling] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = asList(await subscriptionAdminApi.plans());
      setPlans([...list].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)));
    } catch (e) {
      setPlans([]);
      setError(errorText(e, 'Could not load plans.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleStatus = async (plan) => {
    const next = plan.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setToggling(plan.id);
    try {
      await subscriptionAdminApi.setPlanStatus(plan.id, next);
      notifySuccess(`${plan.name} ${next === 'ACTIVE' ? 'enabled' : 'disabled'}.`);
      load();
    } catch (e) {
      notifyError(errorText(e, 'Status change failed.'));
    } finally {
      setToggling('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-admin-muted">Prices are per shop for the whole term. Shops never see INACTIVE plans.</p>
        <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>
          New Plan
        </Button>
      </div>
      <ErrorNote message={error} onRetry={load} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key -- skeleton
            <div key={i} className="h-72 animate-pulse rounded-xl border border-admin-border bg-slate-100" />
          ))}
        </div>
      ) : plans.length === 0 && !error ? (
        <div className="rounded-xl border border-admin-border bg-admin-card p-10 text-center text-sm text-admin-muted">No plans defined yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <AdminPlanCard key={p.id || p.code} plan={p} busy={toggling === p.id} onEdit={() => setEditing(p)} onToggle={() => toggleStatus(p)} />
          ))}
        </div>
      )}

      {editing ? (
        <PlanEditor
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            if (saved?.id) setEditing(saved);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function Yes({ on, label }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${on ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400 line-through'}`}>
      {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}

function AdminPlanCard({ plan, busy, onEdit, onToggle }) {
  const Icon = planIcon(plan);
  const active = plan.status === 'ACTIVE';
  const free = Number(plan.pricePaise) === 0;
  return (
    <div className="flex flex-col rounded-xl border border-admin-border bg-admin-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-admin-accent/10 text-admin-accent">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold text-slate-900">{plan.name}</h3>
            <Badge value={plan.status} />
          </div>
          <p className="text-xs text-admin-muted">
            {plan.durationLabel || `${plan.durationValue ?? '—'} ${plan.durationUnit || ''}`} · <span className="font-mono">{plan.code}</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-xl font-semibold text-slate-900">{free ? 'Free' : formatPaise(plan.pricePaise)}</span>
        {!free ? <span className="text-xs text-admin-muted">per shop / term</span> : null}
      </div>
      <p className="text-xs text-admin-muted">Additional-shop discount: {Number(plan.additionalShopDiscountPct) || 0}%</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-admin-muted">Shops</dt>
        <dd className="text-right font-medium text-slate-800">{plan.shopLimit ?? 'As purchased'}</dd>
        <dt className="text-admin-muted">Employees / shop</dt>
        <dd className="text-right font-medium text-slate-800">{limitText(plan.employeeLimit)}</dd>
        <dt className="text-admin-muted">Sell orders</dt>
        <dd className="text-right font-medium text-slate-800">{limitText(plan.sellOrderLimit)}</dd>
        <dt className="text-admin-muted">Buy orders</dt>
        <dd className="text-right font-medium text-slate-800">{limitText(plan.buyOrderLimit)}</dd>
      </dl>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Yes on={plan.serviceBookingEnabled} label="Booking" />
        <Yes on={plan.pickupEnabled} label="Pickup" />
        <Yes on={plan.whatsappEnabled} label="WhatsApp" />
        <Yes on={plan.smsEnabled} label="SMS" />
        <Yes on={plan.reportsEnabled} label="Reports" />
        <Yes on={plan.exportEnabled} label="Export" />
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button icon={Pencil} onClick={onEdit}>
          Edit
        </Button>
        <Button variant={active ? 'secondary' : 'primary'} icon={Power} disabled={busy} onClick={onToggle}>
          {busy ? 'Saving…' : active ? 'Disable' : 'Enable'}
        </Button>
      </div>
    </div>
  );
}

/* --------------------------------- Editor --------------------------------- */

const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

function toDraft(p) {
  return {
    name: p.name || '',
    code: p.code || '',
    planType: p.planType || 'BASIC',
    description: p.description || '',
    price: paiseToRupeesInput(p.pricePaise ?? 0),
    currency: p.currency || 'INR',
    durationValue: p.durationValue ?? '',
    durationUnit: p.durationUnit || 'MONTHS',
    employeeLimit: p.employeeLimit ?? '',
    employeeLimitScope: p.employeeLimitScope || 'PER_SHOP',
    shopLimit: p.shopLimit ?? '',
    sellOrderLimit: p.sellOrderLimit ?? '',
    buyOrderLimit: p.buyOrderLimit ?? '',
    additionalShopDiscountPct: p.additionalShopDiscountPct ?? 0,
    status: p.status || 'INACTIVE',
    displayOrder: p.displayOrder ?? '',
    color: p.color || '',
    icon: p.icon || '',
    ...Object.fromEntries(FLAGS.map(([k]) => [k, !!p[k]])),
  };
}

function toBody(plan, d) {
  return {
    ...(plan.id ? { id: plan.id, version: plan.version } : {}),
    name: d.name.trim(),
    code: d.code.trim().toUpperCase(),
    planType: d.planType,
    description: d.description.trim() || null,
    pricePaise: rupeesToPaise(d.price),
    currency: d.currency || 'INR',
    durationValue: Number(d.durationValue),
    durationUnit: d.durationUnit,
    employeeLimit: numOrNull(d.employeeLimit),
    employeeLimitScope: d.employeeLimitScope,
    shopLimit: numOrNull(d.shopLimit),
    sellOrderLimit: numOrNull(d.sellOrderLimit),
    buyOrderLimit: numOrNull(d.buyOrderLimit),
    additionalShopDiscountPct: Number(d.additionalShopDiscountPct) || 0,
    status: d.status,
    displayOrder: numOrNull(d.displayOrder),
    color: d.color.trim() || null,
    icon: d.icon || null,
    ...Object.fromEntries(FLAGS.map(([k]) => [k, !!d[k]])),
  };
}

function validate(d) {
  if (!d.name.trim()) return 'Name is required.';
  if (!d.code.trim()) return 'Code is required.';
  if (rupeesToPaise(d.price) === null) return 'Enter a valid price (₹0 or more).';
  const dv = Number(d.durationValue);
  if (!Number.isInteger(dv) || dv < 1) return 'Duration must be a whole number ≥ 1.';
  const pct = Number(d.additionalShopDiscountPct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return 'Discount must be between 0 and 100%.';
  for (const k of ['employeeLimit', 'shopLimit', 'sellOrderLimit', 'buyOrderLimit']) {
    if (d[k] !== '' && (!Number.isInteger(Number(d[k])) || Number(d[k]) < 0)) return 'Limits must be whole numbers (blank = unlimited).';
  }
  return '';
}

function PlanEditor({ plan, onClose, onSaved }) {
  const isNew = !plan.id;
  const [draft, setDraft] = useState(() => toDraft(plan));
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e?.target ? e.target.value : e }));

  const previewPlan = useMemo(() => {
    const dv = Number(draft.durationValue) || 0;
    const unit = draft.durationUnit === 'DAYS' ? 'Day' : 'Month';
    return {
      ...plan,
      ...toBody(plan, draft),
      pricePaise: rupeesToPaise(draft.price) ?? 0,
      durationLabel: dv ? `${dv} ${unit}${dv === 1 ? '' : 's'}` : plan.durationLabel,
      features: plan.features || [],
    };
  }, [plan, draft]);

  const save = async () => {
    const msg = validate(draft);
    setError(msg);
    if (msg) return;
    setSaving(true);
    try {
      const body = toBody(plan, draft);
      const saved = isNew ? await subscriptionAdminApi.createPlan(body) : await subscriptionAdminApi.updatePlan(plan.id, body);
      notifySuccess(isNew ? 'Plan created.' : 'Plan saved.');
      if (saved && typeof saved === 'object') setDraft(toDraft(saved));
      onSaved(saved);
    } catch (e) {
      setError(errorText(e, 'Save failed.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    const next = plan.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setStatusBusy(true);
    try {
      const saved = await subscriptionAdminApi.setPlanStatus(plan.id, next);
      notifySuccess(next === 'ACTIVE' ? 'Plan activated.' : 'Plan deactivated.');
      onSaved(saved && typeof saved === 'object' && saved.id ? saved : { ...plan, status: next });
      setDraft((d) => ({ ...d, status: next }));
    } catch (e) {
      notifyError(errorText(e, 'Status change failed.'));
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <Modal
      title={isNew ? 'New plan' : `Edit plan · ${plan.name}`}
      subtitle={isNew ? 'Created plans start INACTIVE unless you choose otherwise.' : `Code ${plan.code}${plan.version != null ? ` · version ${plan.version}` : ''}`}
      size={preview ? 'max-w-6xl' : 'max-w-3xl'}
      onClose={onClose}
      footer={
        <>
          <Button icon={preview ? EyeOff : Eye} onClick={() => setPreview((v) => !v)}>
            {preview ? 'Hide Preview' : 'Preview Shop View'}
          </Button>
          {!isNew ? (
            <Button icon={Power} disabled={statusBusy} onClick={toggleStatus}>
              {statusBusy ? 'Saving…' : plan.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
          ) : null}
          <Button variant="primary" icon={Save} disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <ErrorNote message={error} />
      <div className={preview ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]' : ''}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            <input value={draft.name} onChange={set('name')} className={inputCls} />
          </Field>
          <Field label="Code" required hint={isNew ? 'e.g. BASIC_6M — cannot change later.' : 'Plan codes are permanent.'}>
            <input value={draft.code} onChange={set('code')} disabled={!isNew} className={`${inputCls} font-mono uppercase`} />
          </Field>
          <Field label="Plan type">
            <select value={draft.planType} onChange={set('planType')} className={inputCls}>
              {['TRIAL', 'BASIC', 'PREMIUM'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={draft.status} onChange={set('status')} className={inputCls}>
              {['ACTIVE', 'INACTIVE', 'COMING_SOON'].map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea rows={2} value={draft.description} onChange={set('description')} className={inputCls} />
          </Field>
          <Field label="Price per shop (₹, whole term)" required hint={`Saved as ${rupeesToPaise(draft.price) ?? '—'} paise`}>
            <input inputMode="decimal" value={draft.price} onChange={set('price')} className={inputCls} />
          </Field>
          <Field label="Currency">
            <input value={draft.currency} onChange={set('currency')} className={inputCls} />
          </Field>
          <Field label="Duration" required>
            <input type="number" min={1} value={draft.durationValue} onChange={set('durationValue')} className={inputCls} />
          </Field>
          <Field label="Duration unit">
            <select value={draft.durationUnit} onChange={set('durationUnit')} className={inputCls}>
              <option value="DAYS">Days</option>
              <option value="MONTHS">Months</option>
            </select>
          </Field>
          <Field label="Additional-shop discount (%)">
            <input type="number" min={0} max={100} step="0.01" value={draft.additionalShopDiscountPct} onChange={set('additionalShopDiscountPct')} className={inputCls} />
          </Field>
          <Field label="Display order">
            <input type="number" value={draft.displayOrder} onChange={set('displayOrder')} className={inputCls} />
          </Field>
          <Field label="Employee limit" hint="Blank = unlimited">
            <input type="number" min={0} value={draft.employeeLimit} onChange={set('employeeLimit')} className={inputCls} />
          </Field>
          <Field label="Employee limit scope">
            <select value={draft.employeeLimitScope} onChange={set('employeeLimitScope')} className={inputCls}>
              <option value="PER_SHOP">Per shop</option>
            </select>
          </Field>
          <Field label="Shop limit" hint="Blank = shops purchased">
            <input type="number" min={0} value={draft.shopLimit} onChange={set('shopLimit')} className={inputCls} />
          </Field>
          <Field label="Sell order limit" hint="Blank = unlimited">
            <input type="number" min={0} value={draft.sellOrderLimit} onChange={set('sellOrderLimit')} className={inputCls} />
          </Field>
          <Field label="Buy order limit" hint="Blank = unlimited">
            <input type="number" min={0} value={draft.buyOrderLimit} onChange={set('buyOrderLimit')} className={inputCls} />
          </Field>
          <Field label="Icon">
            <select value={draft.icon} onChange={set('icon')} className={inputCls}>
              {ICON_OPTIONS.map((i) => (
                <option key={i} value={i}>
                  {i || 'Default for plan type'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Accent color" hint="Hex, e.g. #024A57 (blank = default)">
            <div className="flex gap-2">
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : '#024A57'}
                onChange={set('color')}
                className="h-9 w-11 shrink-0 cursor-pointer rounded border border-admin-border bg-white"
                aria-label="Pick color"
              />
              <input value={draft.color} onChange={set('color')} placeholder="#024A57" className={`${inputCls} font-mono`} />
            </div>
          </Field>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            {FLAGS.map(([k, label]) => (
              <Toggle key={k} label={label} checked={draft[k]} onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))} />
            ))}
          </div>
        </div>

        {preview ? (
          <div className="mt-6 lg:mt-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-muted">Shop view preview</p>
            <div className="rounded-2xl bg-[#F8F8F8] p-3">
              <PlanCard
                plan={previewPlan}
                badge={draft.status === 'COMING_SOON' ? 'COMING_SOON' : draft.status === 'INACTIVE' ? 'INACTIVE' : 'AVAILABLE'}
                action={
                  <span className="flex w-full items-center justify-center rounded-2xl bg-[#F3BF23] px-4 py-2.5 text-sm font-bold text-[#1E1E1E]">
                    {draft.status === 'COMING_SOON' ? 'Coming Soon' : 'Choose Plan'}
                  </span>
                }
              />
            </div>
            <p className="mt-2 text-xs text-admin-muted">
              Feature lines are generated by the server from the saved flags and limits; they refresh after Save Changes.
              {draft.status === 'INACTIVE' ? ' INACTIVE plans are hidden from shops.' : ''}
            </p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
