'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileText, KeyRound, Save, ScrollText } from 'lucide-react';

import { subscriptionAdminApi } from '@/lib/api';
import { Button } from '@/components/PageHeader';
import { notifySuccess } from '@/lib/toast';
import { asList, errorText, formatDateTime } from '@/lib/subscriptionFormat';
import { Badge, ErrorNote, Field, Table, Toggle, inputBase, inputCls, shortId } from './adminUi';

// Only these keys are ever sent back; Razorpay mode/status/key are read-only
// and secrets never exist on this client (server env only).
const NUMBER_KEYS = [
  ['taxPercent', 'Tax %', 'Inclusive in the price; 0 = no tax line.'],
  ['trialDays', 'Trial length (days)'],
  ['trialMaxShops', 'Trial max shops'],
  ['renewalReminderDays', 'Renewal reminder (days before end)'],
  ['expiryAlertDays', 'Expiry alert (days before end)'],
  ['paymentRetryLimit', 'Payment retry limit'],
  ['gracePeriodDays', 'Grace period (days)'],
  ['quoteTtlMinutes', 'Quote validity (minutes)'],
];
const BOOL_KEYS = ['trialOncePerOrg', 'webCheckoutEnabled', 'androidCheckoutEnabled', 'iosCheckoutEnabled'];
const TEXT_KEYS = ['receiptBusinessName', 'receiptAddress', 'receiptGstin', 'receiptEmail', 'receiptPhone'];
// GST invoice keys — sent only when the server already reports them, so an
// older subscription-service keeps today's exact settings payload.
const INVOICE_TEXT_KEYS = ['receiptState', 'receiptStateCode', 'receiptSac', 'invoicePrefix', 'invoiceWhatsappTemplate'];
const INVOICE_BOOL_KEYS = ['invoiceWhatsappEnabled'];
const invoiceKeysSupported = (s) => !!s && [...INVOICE_TEXT_KEYS, ...INVOICE_BOOL_KEYS].some((k) => k in s);

function pickEditable(s) {
  const out = {};
  NUMBER_KEYS.forEach(([k]) => {
    out[k] = s?.[k] ?? '';
  });
  BOOL_KEYS.forEach((k) => {
    out[k] = !!s?.[k];
  });
  TEXT_KEYS.forEach((k) => {
    out[k] = s?.[k] ?? '';
  });
  INVOICE_TEXT_KEYS.forEach((k) => {
    out[k] = s?.[k] ?? '';
  });
  INVOICE_BOOL_KEYS.forEach((k) => {
    out[k] = !!s?.[k];
  });
  return out;
}

export default function SettingsTab() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await subscriptionAdminApi.settings();
      setSettings(s);
      setForm(pickEditable(s));
    } catch (e) {
      setError(errorText(e, 'Could not load settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    for (const [k, label] of NUMBER_KEYS) {
      const v = Number(form[k]);
      if (form[k] === '' || !Number.isFinite(v) || v < 0) {
        setError(`${label}: enter a number ≥ 0.`);
        return;
      }
    }
    const invoiceOn = invoiceKeysSupported(settings);
    if (invoiceOn) {
      const code = String(form.receiptStateCode || '').trim();
      const sac = String(form.receiptSac || '').trim();
      const prefix = String(form.invoicePrefix || '').trim();
      if (code && !/^\d{2}$/.test(code)) {
        setError('State code: enter the 2-digit GST state code.');
        return;
      }
      if (sac && !/^\d{4,8}$/.test(sac)) {
        setError('SAC: enter digits only, exactly as on the GST registration.');
        return;
      }
      if (prefix && !/^[A-Za-z0-9]{1,4}$/.test(prefix)) {
        setError('Invoice prefix: up to 4 letters or digits (invoice numbers must stay within 16 characters).');
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        ...Object.fromEntries(NUMBER_KEYS.map(([k]) => [k, Number(form[k])])),
        ...Object.fromEntries(BOOL_KEYS.map((k) => [k, !!form[k]])),
        ...Object.fromEntries(TEXT_KEYS.map((k) => [k, String(form[k] || '').trim() || null])),
        ...(invoiceOn
          ? {
              ...Object.fromEntries(INVOICE_BOOL_KEYS.map((k) => [k, !!form[k]])),
              ...Object.fromEntries(INVOICE_TEXT_KEYS.map((k) => [k, String(form[k] || '').trim() || null])),
            }
          : {}),
      };
      const saved = await subscriptionAdminApi.saveSettings(body);
      if (saved && typeof saved === 'object') {
        setSettings(saved);
        setForm(pickEditable(saved));
      }
      notifySuccess('Subscription settings saved.');
    } catch (e) {
      setError(errorText(e, 'Could not save settings.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <ErrorNote message={error} onRetry={settings ? undefined : load} />
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key -- skeleton
            <div key={i} className="h-44 animate-pulse rounded-xl border border-admin-border bg-slate-100" />
          ))}
        </div>
      ) : form ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Razorpay (read-only)" icon={KeyRound}>
              <div className="space-y-2 text-sm">
                <Line label="Mode" value={<Badge value={settings.razorpayMode} />} />
                <Line label="API keys configured" value={<Badge value={settings.razorpayConfigured ? 'ACTIVE' : 'UNCONFIGURED'}>{settings.razorpayConfigured ? 'Configured' : 'Not configured'}</Badge>} />
                <Line label="Webhook secret" value={<Badge value={settings.webhookConfigured ? 'ACTIVE' : 'UNCONFIGURED'}>{settings.webhookConfigured ? 'Configured' : 'Not configured'}</Badge>} />
                <Line label="Key ID" value={<span className="font-mono text-xs">{settings.keyIdMasked || '—'}</span>} />
              </div>
              <p className="mt-3 text-xs text-admin-muted">
                Keys and secrets are set only in the server environment (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET) and are never shown or
                edited here.
              </p>
            </Card>

            <Card title="Checkout channels">
              <div className="space-y-2">
                <Toggle label="Web (shop dashboard)" hint="Razorpay UPI checkout on the website." checked={form.webCheckoutEnabled} onChange={set('webCheckoutEnabled')} />
                <Toggle label="Android in-app" checked={form.androidCheckoutEnabled} onChange={set('androidCheckoutEnabled')} />
                <Toggle label="iOS in-app" checked={form.iosCheckoutEnabled} onChange={set('iosCheckoutEnabled')} />
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Keep Android / iOS in-app checkout OFF until Google Play and App Store billing rules for this digital subscription have been verified.
              </p>
            </Card>

            <Card title="Tax, trial & billing rules">
              <div className="grid gap-3 sm:grid-cols-2">
                {NUMBER_KEYS.map(([k, label, hint]) => (
                  <Field key={k} label={label} hint={hint}>
                    <input type="number" min={0} step={k === 'taxPercent' ? '0.01' : '1'} value={form[k]} onChange={set(k)} className={inputCls} />
                  </Field>
                ))}
                <div className="sm:col-span-2">
                  <Toggle label="Trial once per organisation" checked={form.trialOncePerOrg} onChange={set('trialOncePerOrg')} />
                </div>
              </div>
              <p className="mt-2 text-xs text-admin-muted">Tax is always inclusive ({settings.taxInclusive === false ? 'server reports exclusive' : 'price stays the payable total'}).</p>
            </Card>

            <Card title="Receipt business details">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Business name" className="sm:col-span-2">
                  <input value={form.receiptBusinessName} onChange={set('receiptBusinessName')} className={inputCls} />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <textarea rows={2} value={form.receiptAddress} onChange={set('receiptAddress')} className={inputCls} />
                </Field>
                <Field label="GSTIN (optional)" hint="Leave blank unless registered. Receipts become “Tax Invoice” only with a GSTIN and tax % > 0.">
                  <input value={form.receiptGstin} onChange={set('receiptGstin')} className={`${inputCls} font-mono uppercase`} />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.receiptEmail} onChange={set('receiptEmail')} className={inputCls} />
                </Field>
                <Field label="Phone">
                  <input value={form.receiptPhone} onChange={set('receiptPhone')} className={inputCls} />
                </Field>
              </div>
            </Card>

            {invoiceKeysSupported(settings) ? (
              <Card title="GST invoice & WhatsApp delivery" icon={FileText}>
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  GST invoices are issued only when the GSTIN is set and GST % &gt; 0; otherwise a Payment Receipt is issued with no tax rows. GSTIN and SAC must be copied
                  from the company&apos;s GST registration — never enter placeholder values. Leave a field blank if it is not known.
                </p>
                <p className="mb-3 text-xs text-admin-muted">
                  With the values below, new payments get a{' '}
                  <span className="font-semibold text-slate-800">
                    {String(form.receiptGstin || '').trim() && Number(form.taxPercent) > 0 ? 'Tax Invoice' : 'Payment Receipt'}
                  </span>
                  .
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="State" hint="Supplier state as registered for GST, e.g. Tamil Nadu.">
                    <input value={form.receiptState} onChange={set('receiptState')} className={inputCls} />
                  </Field>
                  <Field label="State code" hint="2-digit GST state code (first 2 digits of the GSTIN).">
                    <input value={form.receiptStateCode} onChange={set('receiptStateCode')} inputMode="numeric" maxLength={2} className={`${inputCls} font-mono`} />
                  </Field>
                  <Field label="SAC" hint="From the GST registration only — blank if not known.">
                    <input value={form.receiptSac} onChange={set('receiptSac')} inputMode="numeric" maxLength={8} className={`${inputCls} font-mono`} />
                  </Field>
                  <Field label="Invoice prefix" hint="Up to 4 characters, e.g. NGF → NGF/26-27/00001.">
                    <input value={form.invoicePrefix} onChange={set('invoicePrefix')} maxLength={4} className={`${inputCls} font-mono uppercase`} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Toggle
                      label="Send invoices on WhatsApp"
                      hint="Needs the BotBee template approved and BotBee enabled on the server; otherwise delivery is skipped."
                      checked={form.invoiceWhatsappEnabled}
                      onChange={set('invoiceWhatsappEnabled')}
                    />
                  </div>
                  <Field label="WhatsApp template name" hint="Approved BotBee template, e.g. neargfix_subscription_paid." className="sm:col-span-2">
                    <input value={form.invoiceWhatsappTemplate} onChange={set('invoiceWhatsappTemplate')} className={`${inputCls} font-mono`} />
                  </Field>
                </div>
              </Card>
            ) : null}
          </div>
          <div className="flex justify-end">
            <Button variant="primary" icon={Save} disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save Settings'}
            </Button>
          </div>
        </>
      ) : null}

      <AuditLogs />
    </div>
  );
}

function Card({ title, icon: Icon, children }) {
  return (
    <section className="rounded-xl border border-admin-border bg-admin-card p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        {Icon ? <Icon className="h-4 w-4 text-admin-accent" /> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-admin-muted">{label}</span>
      <span className="min-w-0 break-all text-right">{value}</span>
    </div>
  );
}

function detailsText(d) {
  if (d === null || d === undefined || d === '') return '—';
  if (typeof d === 'string') return d;
  try {
    return JSON.stringify(d);
  } catch {
    return String(d);
  }
}

function AuditLogs() {
  const [limit, setLimit] = useState(100);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(asList(await subscriptionAdminApi.auditLogs(limit)));
    } catch (e) {
      setRows([]);
      setError(errorText(e, 'Could not load audit logs.'));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ScrollText className="h-4 w-4 text-admin-accent" /> Audit Logs
        </h3>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className={`${inputBase} w-36`}>
          {[50, 100, 250, 500].map((n) => (
            <option key={n} value={n}>
              Last {n}
            </option>
          ))}
        </select>
      </div>
      <ErrorNote message={error} onRetry={load} />
      <Table
        loading={loading}
        rows={rows}
        empty="No audit entries yet."
        columns={[
          { key: 'at', label: 'When', render: (r) => formatDateTime(r.at) },
          {
            key: 'actor',
            label: 'Actor',
            render: (r) => (
              <span>
                <span className="font-mono text-xs">{shortId(r.actorUserId)}</span>
                {r.actorRole ? <span className="ml-1.5 text-xs text-admin-muted">{r.actorRole}</span> : null}
              </span>
            ),
          },
          { key: 'action', label: 'Action', render: (r) => <span className="font-medium text-slate-900">{r.action || '—'}</span> },
          {
            key: 'entity',
            label: 'Entity',
            render: (r) => (
              <span>
                {r.entityType || '—'} <span className="font-mono text-xs text-admin-muted">{shortId(r.entityId)}</span>
              </span>
            ),
          },
          {
            key: 'details',
            label: 'Details',
            wrap: true,
            render: (r) => <span className="block max-w-md break-words text-xs text-slate-600">{detailsText(r.details)}</span>,
          },
        ]}
      />
    </section>
  );
}
