'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarPlus, Eye, Loader2, Receipt, Search, ShieldCheck, Store, XCircle } from 'lucide-react';

import { authApi, subscriptionAdminApi } from '@/lib/api';
import { Button } from '@/components/PageHeader';
import { notifyError, notifySuccess } from '@/lib/toast';
import { asList, errorText, formatDate, formatDateTime, formatPaise } from '@/lib/subscriptionFormat';
import { ActionMenu, Badge, DefList, Drawer, ErrorNote, Field, FilterChips, Modal, Table, inputCls, shortId, useDebounced } from './adminUi';

const FILTERS = ['ALL', 'TRIAL', 'ACTIVE', 'PENDING', 'EXPIRING', 'EXPIRED', 'CANCELLED'].map((v) => ({
  value: v,
  label: v === 'ALL' ? 'All' : v.charAt(0) + v.slice(1).toLowerCase(),
}));

function usageText(u) {
  if (u === null || u === undefined || u === '') return '—';
  if (typeof u === 'object') {
    const used = u.used ?? u.employeesUsed ?? u.count;
    const limit = u.limit ?? u.employeeLimit;
    return `${used ?? '—'} / ${limit ?? '∞'}`;
  }
  return String(u);
}

export default function SubscriptionsTab() {
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(null); // { row, tab }
  const [extendRow, setExtendRow] = useState(null);
  const [cancelRow, setCancelRow] = useState(null);
  const [manual, setManual] = useState(null); // {} | { ownerUserId, ownerName }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(asList(await subscriptionAdminApi.subscriptions(status, q)));
    } catch (e) {
      setRows([]);
      setError(errorText(e, 'Could not load subscriptions.'));
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: 'owner',
      label: 'Owner',
      render: (r) => (
        <div className="min-w-[140px]">
          <p className="font-medium text-slate-900">{r.ownerName || shortId(r.ownerUserId)}</p>
          <p className="text-xs text-admin-muted">{r.ownerPhone || '—'}</p>
        </div>
      ),
    },
    { key: 'businessName', label: 'Business', render: (r) => r.businessName || '—' },
    {
      key: 'plan',
      label: 'Plan',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">
            {r.planName || r.planCode || '—'}
            {r.legacy ? <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">Legacy</span> : null}
          </p>
          <p className="text-xs text-admin-muted">{r.durationLabel || r.planCode || ''}</p>
        </div>
      ),
    },
    { key: 'shopCount', label: 'Shops', align: 'right', render: (r) => r.shopCount ?? '—' },
    { key: 'employeeUsage', label: 'Employees', render: (r) => usageText(r.employeeUsage) },
    { key: 'startedAt', label: 'Started', render: (r) => formatDate(r.startedAt) },
    { key: 'endsAt', label: 'Ends', render: (r) => formatDate(r.endsAt) },
    { key: 'daysRemaining', label: 'Days Left', align: 'right', render: (r) => r.daysRemaining ?? '—' },
    { key: 'amountPaidPaise', label: 'Amount Paid', align: 'right', render: (r) => formatPaise(r.amountPaidPaise) },
    { key: 'paymentStatus', label: 'Payment', render: (r) => <Badge value={r.paymentStatus} /> },
    { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
    {
      key: 'actions',
      label: '',
      sticky: true,
      render: (r) => (
        <ActionMenu
          items={[
            { label: 'View Subscription', icon: Eye, onClick: () => setDrawer({ row: r, tab: 'overview' }) },
            { label: 'View Shops', icon: Store, onClick: () => setDrawer({ row: r, tab: 'shops' }) },
            { label: 'View Payments', icon: Receipt, onClick: () => setDrawer({ row: r, tab: 'payments' }) },
            { label: 'Extend', icon: CalendarPlus, onClick: () => setExtendRow(r), disabled: String(r.status).toUpperCase() === 'CANCELLED' },
            { label: 'Manual Activation', icon: ShieldCheck, onClick: () => setManual({ ownerUserId: r.ownerUserId, ownerName: r.ownerName || r.businessName }) },
            { label: 'Cancel', icon: XCircle, danger: true, onClick: () => setCancelRow(r), disabled: ['CANCELLED', 'EXPIRED'].includes(String(r.status).toUpperCase()) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips options={FILTERS} value={status} onChange={setStatus} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search owner, business, phone…"
              className={`${inputCls} pl-9`}
            />
          </div>
          <Button variant="primary" icon={ShieldCheck} onClick={() => setManual({})}>
            Manual Activation
          </Button>
        </div>
      </div>

      <ErrorNote message={error} onRetry={load} />
      <Table columns={columns} rows={rows} loading={loading} empty="No subscriptions match this filter." />

      {drawer ? <DetailDrawer row={drawer.row} initialTab={drawer.tab} onClose={() => setDrawer(null)} /> : null}
      {extendRow ? <ExtendModal row={extendRow} onClose={() => setExtendRow(null)} onDone={load} /> : null}
      {cancelRow ? <CancelModal row={cancelRow} onClose={() => setCancelRow(null)} onDone={load} /> : null}
      {manual ? <ManualActivateModal preset={manual} onClose={() => setManual(null)} onDone={load} /> : null}
    </div>
  );
}

/* ------------------------------ Detail drawer ------------------------------ */

function DetailDrawer({ row, initialTab, onClose }) {
  const [tab, setTab] = useState(initialTab);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDetail(await subscriptionAdminApi.subscription(row.id));
    } catch (e) {
      setError(errorText(e, 'Could not load subscription detail.'));
    } finally {
      setLoading(false);
    }
  }, [row.id]);

  useEffect(() => {
    load();
  }, [load]);

  const d = { ...row, ...(detail?.subscription || {}), ...(detail || {}) };
  const shops = asList(detail?.shops);
  const payments = asList(detail?.payments);
  const orders = asList(detail?.orders);
  const tabs = [
    ['overview', 'Overview'],
    ['shops', `Shops (${shops.length})`],
    ['payments', `Payments (${payments.length})`],
    ['orders', `Orders (${orders.length})`],
  ];

  return (
    <Drawer title={`${d.planName || d.planCode || 'Subscription'}${d.durationLabel ? ` · ${d.durationLabel}` : ''}`} subtitle={`${d.businessName || d.ownerName || ''} · ${d.id || ''}`} onClose={onClose}>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-admin-border">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium ${tab === k ? 'border-b-2 border-admin-accent text-admin-accent' : 'text-admin-muted hover:text-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorNote message={error} onRetry={load} />
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-admin-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : tab === 'overview' ? (
        <DefList
          items={[
            ['Status', <Badge key="s" value={d.status} />],
            ['Payment', <Badge key="p" value={d.paymentStatus} />],
            ['Plan code', d.planCode],
            ['Source', d.source],
            ['Owner', d.ownerName],
            ['Owner phone', d.ownerPhone],
            ['Owner ID', d.ownerUserId],
            ['Business', d.businessName],
            ['Shops', d.shopCount],
            ['Employees', usageText(d.employeeUsage)],
            ['Started', formatDateTime(d.startedAt)],
            ['Ends', formatDateTime(d.endsAt)],
            ['Days remaining', d.daysRemaining],
            ['Amount paid', formatPaise(d.amountPaidPaise)],
            ['Legacy', d.legacy ? 'Yes' : 'No'],
          ]}
        />
      ) : tab === 'shops' ? (
        <Table
          columns={[
            { key: 'name', label: 'Shop', render: (s) => s.name || s.shopName || shortId(s.shopId) },
            { key: 'startsAt', label: 'Starts', render: (s) => formatDate(s.startsAt) },
            { key: 'endsAt', label: 'Ends', render: (s) => formatDate(s.endsAt) },
            { key: 'status', label: 'Status', render: (s) => <Badge value={s.status} /> },
          ]}
          rows={shops}
          rowKey={(s, i) => s.shopId || s.id || i}
          empty="No shops on this subscription."
        />
      ) : tab === 'payments' ? (
        <Table
          columns={[
            { key: 'paidAt', label: 'Paid', render: (p) => formatDateTime(p.paidAt) },
            { key: 'amountPaise', label: 'Amount', align: 'right', render: (p) => formatPaise(p.amountPaise) },
            { key: 'method', label: 'Method', render: (p) => p.method || p.paymentMethod || '—' },
            { key: 'status', label: 'Status', render: (p) => <Badge value={p.status} /> },
            { key: 'receiptNo', label: 'Receipt', render: (p) => p.receiptNo || '—' },
            { key: 'rzp', label: 'Razorpay Payment', render: (p) => <span className="font-mono text-xs">{p.razorpayPaymentId || '—'}</span> },
          ]}
          rows={payments}
          rowKey={(p, i) => p.paymentId || p.id || i}
          empty="No payments recorded (trial or manual activation)."
        />
      ) : (
        <Table
          columns={[
            { key: 'orderNo', label: 'Order', render: (o) => o.orderNo || shortId(o.id) },
            { key: 'createdAt', label: 'Created', render: (o) => formatDateTime(o.createdAt) },
            { key: 'channel', label: 'Channel', render: (o) => o.channel || '—' },
            { key: 'totalPaise', label: 'Total', align: 'right', render: (o) => formatPaise(o.totalPaise) },
            { key: 'status', label: 'Status', render: (o) => <Badge value={o.status} /> },
            { key: 'failureReason', label: 'Note', wrap: true, render: (o) => o.failureReason || '—' },
          ]}
          rows={orders}
          rowKey={(o, i) => o.id || i}
          empty="No orders."
        />
      )}
    </Drawer>
  );
}

/* --------------------------------- Extend --------------------------------- */

function ExtendModal({ row, onClose, onDone }) {
  const [unit, setUnit] = useState('days');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const valid = Number.isInteger(n) && n > 0 && reason.trim().length > 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await subscriptionAdminApi.extend(row.id, { [unit]: n, reason: reason.trim() });
      notifySuccess('Subscription extended.');
      onClose();
      onDone();
    } catch (e) {
      notifyError(errorText(e, 'Extend failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Extend subscription"
      subtitle={`${row.businessName || row.ownerName || ''} · ${row.planName || ''} · ends ${formatDate(row.endsAt)}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" icon={CalendarPlus} disabled={!valid || busy} onClick={submit}>
            {busy ? 'Extending…' : 'Extend'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Extend by" required>
          <input type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Unit">
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
            <option value="days">Days</option>
            <option value="months">Months</option>
          </select>
        </Field>
        <Field label="Reason" required className="sm:col-span-2" hint="Recorded in the audit log.">
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
        </Field>
      </div>
    </Modal>
  );
}

/* --------------------------------- Cancel --------------------------------- */

function CancelModal({ row, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = reason.trim().length > 0 && confirm;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await subscriptionAdminApi.cancel(row.id, reason.trim());
      notifySuccess('Subscription cancelled.');
      onClose();
      onDone();
    } catch (e) {
      notifyError(errorText(e, 'Cancel failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Cancel subscription"
      subtitle={`${row.businessName || row.ownerName || ''} · ${row.planName || ''}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Keep subscription</Button>
          <Button variant="danger" icon={XCircle} disabled={!valid || busy} onClick={submit}>
            {busy ? 'Cancelling…' : 'Cancel subscription'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Shops on this subscription lose plan access immediately. No refund is issued here — use Payments → Refund if needed.
        </p>
        <Field label="Reason" required hint="Recorded in the audit log.">
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
        </Field>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
          I understand this cancels the subscription for all its shops.
        </label>
      </div>
    </Modal>
  );
}

/* ---------------------------- Manual activation ---------------------------- */

function ManualActivateModal({ preset, onClose, onDone }) {
  const [owners, setOwners] = useState([]);
  const [ownerQuery, setOwnerQuery] = useState('');
  const [owner, setOwner] = useState(preset?.ownerUserId ? { id: preset.ownerUserId, name: preset.ownerName } : null);
  const [plans, setPlans] = useState([]);
  const [planCode, setPlanCode] = useState('');
  const [locations, setLocations] = useState(null); // null = not loaded / failed
  const [shopIds, setShopIds] = useState([]);
  const [manualIds, setManualIds] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    subscriptionAdminApi
      .plans()
      .then((p) => setPlans(asList(p)))
      .catch((e) => setLoadError(errorText(e, 'Could not load plans.')));
    if (!preset?.ownerUserId) {
      authApi
        .get('/auth/shop-owners')
        .then((list) => setOwners(asList(list)))
        .catch((e) => setLoadError(errorText(e, 'Could not load shop owners.')));
    }
  }, [preset?.ownerUserId]);

  useEffect(() => {
    if (!owner?.id) return;
    setLocations(null);
    setShopIds([]);
    authApi
      .get(`/auth/shop-owners/${owner.id}`)
      .then((o) => setLocations(asList(o?.locations)))
      .catch(() => setLocations([]));
  }, [owner?.id]);

  const ownerMatches = useMemo(() => {
    const term = ownerQuery.trim().toLowerCase();
    if (!term) return owners.slice(0, 8);
    return owners.filter((o) => [o.name, o.email, o.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))).slice(0, 8);
  }, [owners, ownerQuery]);

  const typedIds = manualIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const allIds = Array.from(new Set([...shopIds, ...typedIds]));
  const valid = owner?.id && planCode && allIds.length > 0 && reason.trim().length > 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await subscriptionAdminApi.manualActivate({ ownerUserId: owner.id, planCode, shopIds: allIds, reason: reason.trim() });
      notifySuccess('Subscription manually activated (no payment recorded).');
      onClose();
      onDone();
    } catch (e) {
      notifyError(errorText(e, 'Manual activation failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Manual Activation"
      subtitle="Activate a plan for an owner without an online payment."
      size="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" icon={ShieldCheck} disabled={!valid || busy} onClick={submit}>
            {busy ? 'Activating…' : 'Activate without payment'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>No payment recorded.</strong> This creates a MANUAL subscription with no Razorpay payment or receipt. It is audit-logged with your
            reason.
          </span>
        </div>
        <ErrorNote message={loadError} />

        <Field label="Owner" required>
          {owner ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-admin-border bg-slate-50 px-3 py-2 text-sm">
              <span className="min-w-0 break-words">
                <span className="font-medium text-slate-900">{owner.name || 'Owner'}</span>
                <span className="ml-2 font-mono text-xs text-admin-muted">{owner.id}</span>
              </span>
              {!preset?.ownerUserId ? (
                <button type="button" className="shrink-0 text-xs font-semibold text-admin-accent" onClick={() => setOwner(null)}>
                  Change
                </button>
              ) : null}
            </div>
          ) : (
            <div>
              <input value={ownerQuery} onChange={(e) => setOwnerQuery(e.target.value)} placeholder="Search name, phone or email" className={inputCls} />
              <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-admin-border">
                {ownerMatches.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-admin-muted">{owners.length ? 'No owners match.' : 'Loading owners…'}</p>
                ) : (
                  ownerMatches.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setOwner({ id: o.id, name: o.name })}
                      className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
                    >
                      <span className="min-w-0 break-words font-medium text-slate-800">{o.name || '—'}</span>
                      <span className="shrink-0 text-xs text-admin-muted">{o.phone || o.email || ''}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </Field>

        <Field label="Plan" required>
          <select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className={inputCls}>
            <option value="">Select a plan…</option>
            {plans.map((p) => (
              <option key={p.id || p.code} value={p.code}>
                {p.name} · {p.durationLabel || p.code} ({p.code}){p.status && p.status !== 'ACTIVE' ? ` — ${p.status}` : ''}
              </option>
            ))}
          </select>
        </Field>

        {owner?.id ? (
          <Field label="Shops" required hint="Tick the owner's shops to cover, or paste shop IDs below.">
            {locations === null ? (
              <p className="flex items-center gap-2 text-xs text-admin-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading shops…
              </p>
            ) : locations.length === 0 ? (
              <p className="text-xs text-admin-muted">No shops found for this owner — paste shop IDs below.</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {locations.map((l) => (
                  <label key={l.id} className="flex items-start gap-2 rounded-lg border border-admin-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={shopIds.includes(l.id)}
                      onChange={(e) => setShopIds((ids) => (e.target.checked ? [...ids, l.id] : ids.filter((x) => x !== l.id)))}
                    />
                    <span className="min-w-0">
                      <span className="block break-words font-medium text-slate-800">{l.name || 'Shop'}</span>
                      <span className="block break-words text-xs text-admin-muted">{[l.area, l.district].filter(Boolean).join(', ') || shortId(l.id)}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <textarea
              rows={2}
              value={manualIds}
              onChange={(e) => setManualIds(e.target.value)}
              placeholder="Optional: extra shop IDs (comma or newline separated)"
              className={`${inputCls} mt-2 font-mono text-xs`}
            />
          </Field>
        ) : null}

        <Field label="Reason" required hint="Mandatory — recorded in the audit log.">
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
        </Field>
        <p className="text-xs text-admin-muted">{allIds.length} shop{allIds.length === 1 ? '' : 's'} selected.</p>
      </div>
    </Modal>
  );
}
