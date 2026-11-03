'use client';

/**
 * /shop-home/services/bookings/view/edit/?id=<booking>&ticket=<ticket> — Edit Booking.
 *
 * Mirrors the Partner app's EditBookingScreen: booking DETAILS only (customer,
 * issue notes, IMEI, missing / damaged parts, device security). It never
 * touches status, prices, technician or schedule. Save PATCHes only the changed
 * fields to /tickets/{id}; alternative mobile / email go to POST /customers
 * (upsert by mobile); one BOOKING_EDITED history row names what changed.
 * Device model, photos and ID proof are still edited from the app only.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, IdCard, Lock, Loader2, Mail, MapPin, Pencil, Phone, Smartphone, User } from 'lucide-react';

import { cx } from '@/components/site/ui';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { TICKET_BASE } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';
import { fetchTicket } from '@/lib/shopDashboard';
import { priceItemsFromTicket } from '@/lib/invoice';
import { bookingRef } from '@/lib/orderStages';
import { resolveMediaUrl } from '@/lib/deviceImage';
import { notifyError, notifySuccess } from '@/lib/toast';

const TEAL = '#035C6C';
const PARTS = [
  { id: 'DISPLAY', name: 'Display' },
  { id: 'BACK_PANEL', name: 'Back Panel' },
  { id: 'SIM_TRAY', name: 'SIM Card Tray' },
  { id: 'BUTTONS', name: 'Buttons' },
  { id: 'CHARGING_PORT', name: 'Charging Port' },
  { id: 'CAMERA', name: 'Camera' },
  { id: 'SPEAKER', name: 'Speaker' },
];
const LOCKS = [['NONE', 'None'], ['PIN', 'PIN'], ['PATTERN', 'Pattern'], ['PASSWORD', 'Password'], ['ACCOUNT', 'Account Lock']];

const parseJson = (v, fb) => {
  if (v && typeof v === 'object') return v;
  try { return v ? JSON.parse(v) : fb; } catch { return fb; }
};
const normMobile = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
};
const itemLabel = (x) => String(x?.label || x?.serviceName || x?.name || '').trim();
const splitIssueText = (text, labels) => {
  const notes = {};
  const rest = [];
  String(text || '').split('\n').forEach((line) => {
    const l = labels.find((lb) => lb && line.startsWith(`${lb}: `));
    if (l && notes[l] === undefined) notes[l] = line.slice(l.length + 2);
    else rest.push(line);
  });
  return { notes, rest: rest.join('\n').trim() };
};
const joinIssueText = (labels, notes, rest) => [
  ...labels.map((l) => (notes?.[l]?.trim() ? `${l}: ${notes[l].trim()}` : '')),
  String(rest || '').trim(),
].filter(Boolean).join('\n');
const seedParts = (list) => {
  const seed = {};
  for (const p of Array.isArray(list) ? list : []) {
    if (!p) continue;
    const name = String(p.partName || p.name || '').trim();
    const key = p.partId || p.id || PARTS.find((x) => x.name.toLowerCase() === name.toLowerCase())?.id;
    if (key) seed[key] = { missing: !!p.missing && !p.damage, damage: !!p.damage, detail: p.detail || '', ...(name ? { name } : {}) };
  }
  return seed;
};
const flaggedParts = (s = {}) => {
  const row = (id, name) => ({ partId: id, partName: name, missing: !!s[id].missing, damage: !!s[id].damage, detail: String(s[id].detail || '').trim() || null });
  const flagged = (id) => s[id]?.missing || s[id]?.damage;
  return [
    ...PARTS.filter((p) => flagged(p.id)).map((p) => row(p.id, p.name)),
    ...Object.keys(s).filter((id) => !PARTS.some((p) => p.id === id) && flagged(id)).map((id) => row(id, s[id].name || id)),
  ];
};

const REASONS = ['Price Correction', 'Customer Discount', 'Spare Part Price Change', 'Service Cancelled', 'Other'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const amountOf = (m) => Number(m?.amount ?? m?.price ?? 0) || 0;
// Same identity the server checks: id, else code, else label (lower-case).
const identityOf = (m) => {
  for (const k of ['id', 'serviceId', 'code', 'serviceCode', 'label', 'serviceName']) {
    const v = m?.[k];
    if (v != null && String(v).trim() && String(v).toUpperCase() !== 'OTHER') return String(v).trim().toLowerCase();
  }
  return '';
};

// tickets.payment_type CHECK values (Partner app PAYMENT_MODES).
const PAY_MODES = [
  { value: 'ADVANCE', label: 'Advance Payment', hint: 'Deposit now, balance on delivery' },
  { value: 'FULL', label: 'Full Payment', hint: 'Whole bill settled up front' },
];

const INPUT = 'w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none placeholder:text-[#9CA3AF] focus:border-[#035C6C]';

const fmtDateTime = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
};

// Partner app EditBookingScreen pieces: Card, SectionTitle, Field, FoldRow, InfoRow.
function Card({ children }) {
  return <section className="rounded-[14px] border border-[#E5E7EB] bg-white p-3">{children}</section>;
}

function SectionTitle({ title, hint, action, onAction }) {
  return (
    <div className="mb-2 mt-4 flex items-center">
      <h2 className="flex-1 text-[13.5px] font-extrabold text-[#111111]">{title}{hint ? <span className="ml-1 text-xs font-medium text-[#9CA3AF]">{hint}</span> : null}</h2>
      {action ? (
        <button type="button" onClick={onAction} className="flex items-center text-[12.5px] font-extrabold text-[#035C6C] hover:opacity-70">
          <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />{action}
        </button>
      ) : null}
    </div>
  );
}

function Field({ icon: Icon, value, onChange, error, tall, ...props }) {
  const Tag = tall ? 'textarea' : 'input';
  return (
    <div>
      <div className={cx('flex rounded-xl border bg-white px-3', tall ? 'min-h-[76px] items-start py-3' : 'h-[46px] items-center', error ? 'border-[#FECACA]' : 'border-[#E5E7EB] focus-within:border-[#035C6C]')}>
        <Icon className="h-[18px] w-[18px] shrink-0 text-[#111111]" strokeWidth={1.75} aria-hidden="true" />
        <Tag {...props} rows={tall ? 2 : undefined} value={value} onChange={(e) => onChange(e.target.value)} className="ml-2.5 w-full resize-none bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#9CA3AF]" />
      </div>
      {error ? <p className="mt-1 text-[11.5px] text-[#DC2626]">{error}</p> : null}
    </div>
  );
}

function CustomerLine({ icon: Icon, value, empty }) {
  return (
    <p className="mt-2 flex items-start pl-[42px] text-xs text-[#6B7280]">
      <Icon className="mr-1.5 mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className={value ? 'text-[#111111]' : 'text-[#9CA3AF]'}>{value || empty}</span>
    </p>
  );
}

function FoldRow({ title, right, rightColor, open, onClick, icon: Icon }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center px-3 py-3.5 text-left hover:bg-[#F9FAFB]">
      {Icon ? <Icon className="mr-2 h-[15px] w-[15px] text-[#111111]" aria-hidden="true" /> : null}
      <span className="flex-1 truncate text-[13.5px] font-bold text-[#111111]">{title}</span>
      <span className="mr-1.5 text-xs font-bold" style={{ color: rightColor }}>{right}</span>
      <ChevronDown className={cx('h-4 w-4 text-[#6B7280] transition', open && 'rotate-180')} aria-hidden="true" />
    </button>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <div className={cx('flex items-center py-2', !last && 'border-b border-[#F3F4F6]')}>
      <span className="w-[104px] truncate text-xs text-[#6B7280]">{label}</span>
      <span className="flex-1 truncate text-[13px] font-bold text-[#111111]">{value}</span>
    </div>
  );
}

export default function EditBookingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const bookingId = params.get('id') || '';
  const ticketId = params.get('ticket') || '';
  const backHref = `/shop-home/services/bookings/view/details/?id=${encodeURIComponent(bookingId)}`;

  const [ticket, setTicket] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [revOpen, setRevOpen] = useState(false);
  const [prices, setPrices] = useState({});
  const [cancelled, setCancelled] = useState({});
  const [reason, setReason] = useState('');
  const [revNotes, setRevNotes] = useState('');
  const [approvedNow, setApprovedNow] = useState(false);
  const [revSaving, setRevSaving] = useState(false);
  const originalRef = useRef(null);

  const load = useCallback(async () => {
    if (!ticketId) { setLoadError('This booking has no repair ticket yet.'); setLoading(false); return; }
    setLoading(true);
    setLoadError('');
    try {
      const t = await fetchTicket(ticketId);
      const labels = priceItemsFromTicket(t).map(itemLabel).filter(Boolean);
      const split = splitIssueText(t.issueDescription, labels);
      const initial = {
        customerName: t.customerName || '',
        customerPhone: normMobile(t.customerPhone),
        customerAltPhone: '',
        customerEmail: '',
        customerAddress: t.customerAddress || '',
        imei: t.imei || '',
        issueNotes: split.notes,
        issueDescription: split.rest,
        missingParts: seedParts(parseJson(t.missingPartsJson, [])),
        lockType: String(t.deviceSecurityType || 'NONE').toUpperCase(),
        lockValue: t.deviceSecurityValue || '',
        paymentType: t.paymentType || '',
        paymentAmount: Number(t.paymentAmount) > 0 ? String(Number(t.paymentAmount)) : '',
      };
      originalRef.current = initial;
      setTicket(t);
      setForm(initial);
      // Alt mobile / email (and address when the booking has none) live on the customer record.
      if (initial.customerPhone.length === 10) {
        shopRequest(TICKET_BASE(), `/customers/lookup?mobile=${initial.customerPhone}`)
          .then((c) => {
            if (!c || !originalRef.current) return;
            const fill = Object.fromEntries(Object.entries({
              customerAltPhone: normMobile(c.alternatePhone),
              customerEmail: c.email || '',
              customerAddress: initial.customerAddress
                || [c.addressLine, c.area || c.locality, c.taluk, c.district || c.city, c.pincode].filter(Boolean).join(', ')
                || c.address || '',
            }).filter(([, v]) => v));
            originalRef.current = { ...originalRef.current, ...fill };
            setForm((f) => {
              if (!f) return f;
              const next = { ...f };
              Object.entries(fill).forEach(([k, v]) => { if (!next[k]) next[k] = v; });
              return next;
            });
          })
          .catch(() => {});
      }
    } catch (e) {
      setLoadError(e?.message || 'Could not load this booking.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: typeof v === 'function' ? v(f[k]) : v }));
  const issueItems = useMemo(() => (ticket ? priceItemsFromTicket(ticket).filter((x) => itemLabel(x)) : []), [ticket]);
  const issueLabels = useMemo(() => issueItems.map(itemLabel), [issueItems]);
  const status = String(ticket?.status || '').toUpperCase();
  const locked = status === 'DELIVERED' || status === 'CANCELLED';

  const diff = useMemo(() => {
    const o = originalRef.current;
    if (!form || !o) return { body: {}, labels: [] };
    const body = {};
    const labels = [];
    if (form.customerName.trim() !== o.customerName.trim()) { body.customerName = form.customerName.trim(); labels.push('Customer name'); }
    if (normMobile(form.customerPhone) !== o.customerPhone) { body.customerPhone = normMobile(form.customerPhone); labels.push('Customer mobile'); }
    if (normMobile(form.customerAltPhone) !== normMobile(o.customerAltPhone)) labels.push('Alternative mobile');
    if (form.customerEmail.trim() !== o.customerEmail.trim()) labels.push('Customer email');
    if (form.customerAddress.trim() !== o.customerAddress.trim()) { body.customerAddress = form.customerAddress.trim(); labels.push('Customer address'); }
    const imei = form.imei.replace(/\D/g, '');
    if (imei !== String(o.imei || '').replace(/\D/g, '')) { body.imei = imei; labels.push(o.imei ? 'IMEI updated' : 'IMEI added'); }
    const issueText = joinIssueText(issueLabels, form.issueNotes, form.issueDescription);
    if (issueText !== joinIssueText(issueLabels, o.issueNotes, o.issueDescription)) { body.issueDescription = issueText; labels.push('Issue notes'); }
    const partsNow = JSON.stringify(flaggedParts(form.missingParts));
    if (partsNow !== JSON.stringify(flaggedParts(o.missingParts))) { body.missingPartsJson = partsNow; labels.push('Missing / damaged parts'); }
    if (form.lockType !== o.lockType || form.lockValue !== o.lockValue) {
      body.deviceSecurityType = form.lockType;
      body.deviceSecurityValue = form.lockType === 'NONE' ? null : form.lockValue;
      labels.push('Device security');
    }
    const payAmt = form.paymentType ? Number(form.paymentAmount) || 0 : 0;
    if (form.paymentType !== o.paymentType || payAmt !== (Number(o.paymentAmount) || 0)) {
      body.paymentType = form.paymentType || null;
      body.paymentAmount = form.paymentType ? payAmt : null;
      labels.push('Payment');
    }
    return { body, labels };
  }, [form, issueLabels]);

  const dirty = diff.labels.length > 0;
  const imeiDigits = (form?.imei || '').replace(/\D/g, '');
  const altDigits = normMobile(form?.customerAltPhone);
  const emailTrim = (form?.customerEmail || '').trim();
  const errors = form ? {
    name: !form.customerName.trim() ? 'Customer name is required.' : '',
    phone: normMobile(form.customerPhone).length !== 10 ? 'Enter a 10-digit mobile number.' : '',
    alt: !altDigits ? ''
      : altDigits.length !== 10 ? 'Enter all 10 digits.'
      : !/^[6-9]\d{9}$/.test(altDigits) ? 'Mobile numbers start with 6, 7, 8 or 9.'
      : altDigits === normMobile(form.customerPhone) ? 'Must be different from the mobile number.' : '',
    email: emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim) ? 'Enter a valid email address.' : '',
    pay: !form.paymentType ? ''
      : !(Number(form.paymentAmount) > 0) ? `Enter the amount collected for ${PAY_MODES.find((m) => m.value === form.paymentType)?.label}.`
      : ticket && Number(form.paymentAmount) > (Number(ticket.estimatedPrice) || 0) ? `Amount can't be more than the estimate ${inr(ticket.estimatedPrice)}.` : '',
    imei: imeiDigits && (imeiDigits.length < 14 || imeiDigits.length > 17) ? 'IMEI must be 14–17 digits.' : '',
  } : {};
  const hasError = Object.values(errors).some(Boolean);
  const canSave = dirty && !saving && !hasError && !locked;

  async function save() {
    if (!dirty) { notifyError(null, 'Nothing has been changed.'); return; }
    if (!canSave) return;
    const o = originalRef.current;
    const isBulk = /-[A-Z]{1,2}$/.test(String(ticket?.trackingId || ''));
    if (isBulk && (diff.body.customerName !== undefined || diff.body.customerPhone !== undefined)
      && !window.confirm(`This booking has other devices. The new customer details are saved on #${ticket.trackingId} only.`)) return;
    setSaving(true);
    try {
      const altChanged = altDigits !== normMobile(o.customerAltPhone);
      const emailChanged = emailTrim !== o.customerEmail.trim();
      if ((altChanged && altDigits) || (emailChanged && emailTrim) || diff.body.customerAddress) {
        await shopRequest(TICKET_BASE(), '/customers', {
          method: 'POST',
          body: JSON.stringify({
            name: form.customerName.trim(),
            phone: normMobile(form.customerPhone),
            alternatePhone: altDigits || null,
            email: emailTrim || null,
            address: diff.body.customerAddress || null,
          }),
        });
      }
      const res = Object.keys(diff.body).length
        ? await shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}`, { method: 'PATCH', body: JSON.stringify(diff.body) })
        : null;
      // Only claim success for what the server actually stored.
      const normJson = (v) => {
        const x = parseJson(v, null);
        return JSON.stringify(x && typeof x === 'object' && !Object.keys(x).length ? null : x);
      };
      const norm = (k, v) => (/Json$/.test(k) ? normJson(v) : String(v ?? ''));
      const missed = ['customerName', 'customerPhone', 'customerAddress', 'issueDescription', 'imei', 'deviceSecurityType', 'missingPartsJson']
        .filter((k) => diff.body[k] !== undefined && res && k in res && norm(k, res[k]) !== norm(k, diff.body[k]));
      if (missed.length) {
        notifyError(null, 'The server did not accept some changes yet. Please update the server and try again.');
        return;
      }
      shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}/progress-events`, {
        method: 'POST',
        body: JSON.stringify({ statusKey: 'BOOKING_EDITED', note: `Booking Edited — ${diff.labels.join(', ')}`, actor: 'SHOP' }),
      }).catch(() => {});
      notifySuccess('Booking details updated successfully.');
      router.push(backHref);
    } catch (e) {
      notifyError(e, 'Could not update the booking.');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm('Discard changes? Your edits will not be saved.')) return;
    router.push(backHref);
  }

  const setPart = (id, patch) => set('missingParts', (m) => ({ ...m, [id]: { ...(m?.[id] || {}), ...patch } }));

  // Price revision: Partner app PriceRevisedScreen, POST /tickets/{id}/price-revision.
  const lineItems = (() => {
    const parsed = parseJson(ticket?.priceItemsJson, null);
    return Array.isArray(parsed) ? parsed : ticket ? priceItemsFromTicket(ticket) : [];
  })();
  const currentTotal = ticket ? Number(ticket.estimatedPrice ?? lineItems.reduce((a, m) => a + amountOf(m), 0)) || 0 : 0;
  const revRows = lineItems.map((m, i) => {
    const old = amountOf(m);
    const raw = prices[i] ?? '';
    const isCancelled = !!cancelled[i];
    const blank = raw.trim() === '';
    const valid = blank || Number(raw) >= 0;
    const next = isCancelled ? 0 : blank || !valid ? old : Number(raw);
    return { m, i, old, raw, valid, next, isCancelled, changed: isCancelled || (!blank && valid && Number(raw) !== old) };
  });
  const revChanges = revRows.filter((x) => x.changed);
  const proposed = Math.max(0, currentTotal + revRows.reduce((a, x) => a + (x.isCancelled ? -x.old : x.valid ? x.next - x.old : 0), 0));
  const increase = revRows.some((x) => !x.isCancelled && x.valid && x.next > x.old);
  const needsApproval = increase || revRows.some((x) => x.isCancelled);
  const revInvalid = revRows.filter((x) => !x.isCancelled && !x.valid);
  const allCancelled = revRows.length > 0 && revRows.every((x) => x.isCancelled);
  const notesOk = reason !== 'Other' || revNotes.trim().length >= 3;
  const canRevise = revChanges.length > 0 && !revInvalid.length && !allCancelled && !!reason && notesOk && !revSaving && !locked;
  const revHint = !revChanges.length ? 'Change a price or cancel a service.'
    : revInvalid.length ? `Enter a valid price for ${itemLabel(revInvalid[0].m) || 'the service'}.`
    : allCancelled ? 'At least one service must stay on the booking.'
    : !reason ? 'Select the reason for the revision.'
    : !notesOk ? 'Add a note for "Other".' : '';
  const payment = (() => {
    const paid = Number(ticket?.paymentAmount);
    if (!ticket?.paymentType || !Number.isFinite(paid) || paid <= 0) return null;
    const stored = Number(ticket.balanceAmount);
    return {
      label: ticket.paymentType === 'FULL' ? 'Full Payment' : 'Advance Payment',
      mode: ticket.paymentStatus === 'PENDING' ? 'Pending' : 'Paid',
      paid,
      balance: ticket.balanceAmount != null && Number.isFinite(stored) ? stored : Math.max(0, currentTotal - paid),
    };
  })();

  function resetRevision() {
    setPrices({}); setCancelled({}); setReason(''); setRevNotes(''); setApprovedNow(false); setRevOpen(false);
  }
  function toggleCancel(i, label) {
    if (cancelled[i]) { setCancelled((c) => { const n = { ...c }; delete n[i]; return n; }); return; }
    if (!window.confirm(`Cancel this service? ${label || 'It'} will be removed from the estimate. Its price stays in the history.`)) return;
    setCancelled((c) => ({ ...c, [i]: true }));
    if (!reason) setReason('Service Cancelled');
  }
  async function submitRevision() {
    if (!canRevise) return;
    setRevSaving(true);
    try {
      await shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}/price-revision`, {
        method: 'POST',
        body: JSON.stringify({
          changes: revChanges.map((x) => ({ index: x.i, identity: identityOf(x.m), oldAmount: x.old, newAmount: x.isCancelled ? null : Number(x.raw), cancel: x.isCancelled })),
          reason,
          notes: revNotes.trim() || null,
          customerApproved: needsApproval ? approvedNow : null,
        }),
      });
      notifySuccess(needsApproval && !approvedNow ? 'Price revised — waiting for customer approval.' : 'Booking estimate updated.');
      resetRevision();
      load();
    } catch (e) {
      notifyError(e, 'Could not revise the price.');
      if (e?.status === 409) load();
    } finally {
      setRevSaving(false);
    }
  }

  const flaggedCount = form ? flaggedParts(form.missingParts).length : 0;
  const lockSaved = !!form && form.lockType !== 'NONE' && !!form.lockValue;
  const lockLabel = (k) => LOCKS.find(([x]) => x === k)?.[1] || k;
  const deviceName = String(ticket?.deviceDisplayName || ticket?.modelName || 'Device').split(' (')[0].split(' · ')[0];
  const deviceSpec = [ticket?.ramLabel, ticket?.storageLabel, ticket?.color].filter(Boolean).join(' · ');
  const techName = String(ticket?.assignedTechnicianName || ticket?.technicianName || '').trim();

  return (
    <div className="min-h-full bg-[#F3F4F6] pb-28">
      <div className="border-b border-[#E5E7EB] bg-white px-4 py-2.5">
        <div className="mx-auto flex max-w-[1440px] items-center">
          <button type="button" onClick={cancel} aria-label="Go back" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB]">
            <ArrowLeft className="h-[18px] w-[18px] text-[#111111]" aria-hidden="true" />
          </button>
          <div className="flex-1 px-2 text-center">
            <h1 className="text-[17px] font-extrabold text-[#111111]">Edit Booking</h1>
            <p className="truncate text-[11px] text-[#6B7280]">Update booking details{ticket ? ` · #${bookingRef(ticket)}` : ''}</p>
          </div>
          <span className="w-9" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1440px] px-4 pt-3 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#6B7280]"><Loader2 className="h-4 w-4 animate-spin" /> Loading booking…</div>
        ) : loadError ? (
          <ErrorBanner message={loadError} onRetry={ticketId ? load : undefined} />
        ) : form ? (
          <>
            {locked ? <div className="mb-3"><ErrorBanner message={`This booking is ${status.toLowerCase()} and can no longer be edited.`} /></div> : null}
            <fieldset disabled={locked || saving} className="grid gap-x-5 lg:grid-cols-2">
              <div>
                <Card>
                  <div className="flex items-center">
                    <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[#F3F4F6]">
                      {ticket.deviceImageUrl ? <img src={resolveMediaUrl(ticket.deviceImageUrl)} alt="" className="h-[88%] w-[88%] object-contain" /> : <Smartphone className="h-6 w-6 text-[#6B7280]" />}
                    </span>
                    <div className="ml-2.5 min-w-0 flex-1">
                      <p className="line-clamp-2 text-[14.5px] font-extrabold text-[#111111]">{deviceName}</p>
                      {deviceSpec ? <p className="truncate text-xs text-[#6B7280]">{deviceSpec}</p> : null}
                    </div>
                  </div>
                </Card>

                <SectionTitle title="Customer Details" action={custOpen ? null : 'Edit'} onAction={() => setCustOpen(true)} />
                <Card>
                  {custOpen ? (
                    <div className="space-y-2.5">
                      <Field icon={User} value={form.customerName} onChange={(v) => set('customerName', v)} placeholder="Customer name" error={errors.name} />
                      <Field icon={Phone} value={form.customerPhone} onChange={(v) => set('customerPhone', v.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" inputMode="numeric" error={errors.phone} />
                      <Field icon={Phone} value={form.customerAltPhone} onChange={(v) => set('customerAltPhone', v.replace(/\D/g, '').slice(0, 10))} placeholder="Enter alternative mobile number (optional)" inputMode="numeric" error={errors.alt} />
                      <Field icon={Mail} value={form.customerEmail} onChange={(v) => set('customerEmail', v)} placeholder="Email address (optional)" type="email" error={errors.email} />
                      <Field icon={MapPin} value={form.customerAddress} onChange={(v) => set('customerAddress', v)} placeholder="House No, Street, Area, City, Pincode (optional)" tall />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E5F3F5]"><User className="h-4 w-4 text-[#035C6C]" /></span>
                        <p className="ml-2.5 flex-1 truncate text-sm font-extrabold text-[#111111]">
                          {form.customerName || '—'}
                          <span className="font-medium text-[#6B7280]">{form.customerPhone ? `  ·  ${form.customerPhone}` : ''}{form.customerAltPhone ? `  ·  Alt ${form.customerAltPhone}` : ''}</span>
                        </p>
                      </div>
                      <CustomerLine icon={Mail} value={form.customerEmail} empty="No email" />
                      <CustomerLine icon={MapPin} value={form.customerAddress} empty="No address" />
                    </>
                  )}
                </Card>

                <SectionTitle title="IMEI Number" hint="(Optional)" />
                <Card>
                  <Field icon={IdCard} value={form.imei} onChange={(v) => set('imei', v.replace(/\D/g, '').slice(0, 17))} placeholder="Enter 15-digit IMEI" inputMode="numeric" error={errors.imei} />
                </Card>
                {issueItems.length ? (
                  <>
                    <SectionTitle title="Issues" hint={`(${issueItems.length})`} />
                    <Card>
                      {issueItems.map((x, idx) => {
                        const l = itemLabel(x);
                        return (
                          <div key={`${l}-${idx}`} className={idx ? 'mt-3' : ''}>
                            <div className="mb-1.5 flex items-center">
                              <p className="flex-1 text-[13.5px] font-bold text-[#111111]">{idx + 1}. {l}</p>
                            </div>
                            <input className={cx(INPUT, 'h-[42px] rounded-[10px]')} maxLength={200} placeholder="Additional notes (optional)" value={form.issueNotes?.[l] || ''} onChange={(e) => set('issueNotes', (n) => ({ ...n, [l]: e.target.value }))} />
                          </div>
                        );
                      })}
                    </Card>
                  </>
                ) : null}

                <SectionTitle title="Payment" hint="(Optional)" />
                <Card>
                  <div>
                    <p className="text-[13px] font-extrabold text-[#111111]">Payment Mode</p>
                    <select className={cx(INPUT, 'mt-1.5')} value={form.paymentType} onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, paymentType: v, paymentAmount: !v ? '' : v === 'FULL' ? String(currentTotal) : f.paymentAmount }));
                    }}>
                      <option value="">Select payment mode</option>
                      {PAY_MODES.map((m) => <option key={m.value} value={m.value}>{m.label} — {m.hint}</option>)}
                    </select>
                    <p className="mt-1 text-[11.5px] text-[#6B7280]">Pick a mode to record money collected now. Leave it blank if the customer pays on delivery.</p>
                    {form.paymentType ? (
                      <div className="mt-2">
                        <input className={cx(INPUT, errors.pay && 'border-[#FECACA]')} inputMode="numeric" placeholder="Amount collected (₹)" value={form.paymentAmount}
                          onChange={(e) => set('paymentAmount', e.target.value.replace(/[^\d.]/g, ''))} />
                        {errors.pay ? <p className="mt-1 text-[11.5px] text-[#DC2626]">{errors.pay}</p>
                          : <p className="mt-1 text-[11.5px] text-[#6B7280]">Balance due: {inr(Math.max(0, currentTotal - (Number(form.paymentAmount) || 0)))}</p>}
                      </div>
                    ) : null}
                  </div>
                </Card>

              </div>

              <div>
                <SectionTitle title="Price & Payment" action={revOpen || !lineItems.length || locked ? null : 'Revise Price'} onAction={() => setRevOpen(true)} />
                <Card>
                  {revRows.map((x) => (
                    <div key={x.i} className="flex items-center gap-2 border-b border-[#F3F4F6] py-2 last:border-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[10px] font-extrabold text-[#035C6C]">{x.i + 1}</span>
                      <span className={cx('flex-1 truncate text-[13px] font-bold', x.isCancelled ? 'text-[#9CA3AF] line-through' : 'text-[#111111]')}>{itemLabel(x.m) || 'Service'}</span>
                      {revOpen ? (
                        <>
                          <span className="text-xs text-[#9CA3AF]">{inr(x.old)}</span>
                          <input disabled={x.isCancelled || revSaving} inputMode="numeric" placeholder="New ₹" value={x.raw} onChange={(e) => setPrices((m) => ({ ...m, [x.i]: e.target.value.replace(/[^\d.]/g, '') }))}
                            className={cx('h-8 w-24 rounded-lg border px-2 text-right text-[13px] outline-none', x.valid ? 'border-[#E5E7EB] focus:border-[#035C6C]' : 'border-[#FECACA]')} />
                          <button type="button" disabled={revSaving} onClick={() => toggleCancel(x.i, itemLabel(x.m))}
                            className={cx('rounded-full border px-2.5 py-1 text-[11px] font-bold', x.isCancelled ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]' : 'border-[#E5E7EB] text-[#6B7280]')}>
                            {x.isCancelled ? 'Undo' : 'Cancel'}
                          </button>
                        </>
                      ) : <span className="text-[13px] font-extrabold text-[#111111]">{inr(x.old)}</span>}
                    </div>
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t border-[#E5E7EB] pt-2.5">
                    <span className="text-[13px] font-bold text-[#6B7280]">Estimated Total</span>
                    <span className="text-[15px] font-extrabold text-[#035C6C]">
                      {revOpen && revChanges.length ? <><span className="mr-1.5 text-xs text-[#9CA3AF] line-through">{inr(currentTotal)}</span>{inr(proposed)}</> : inr(currentTotal)}
                    </span>
                  </div>
                  {payment ? (
                    <div className="mt-2.5 space-y-1.5 rounded-xl bg-[#F9FAFB] p-2.5 text-[12.5px]">
                      <div className="flex justify-between"><span className="text-[#6B7280]">Payment</span><span className="font-bold text-[#111111]">{payment.label} · {payment.mode}</span></div>
                      <div className="flex justify-between"><span className="text-[#6B7280]">Paid</span><span className="font-bold text-[#047857]">{inr(payment.paid)}</span></div>
                      <div className="flex justify-between"><span className="text-[#6B7280]">Balance</span><span className={cx('font-extrabold', payment.balance > 0 ? 'text-[#DC2626]' : 'text-[#047857]')}>{inr(payment.balance)}</span></div>
                    </div>
                  ) : <p className="mt-2.5 rounded-xl bg-[#F9FAFB] p-2.5 text-[12.5px] text-[#6B7280]">No advance collected — full amount due at delivery.</p>}
                  {revOpen ? (
                    <div className="mt-3 space-y-2.5 border-t border-[#E5E7EB] pt-3">
                      <p className="text-xs font-bold text-[#6B7280]">Reason for revision <span className="text-[#DC2626]">*</span></p>
                      <div className="flex flex-wrap gap-1.5">
                        {REASONS.map((x) => (
                          <button key={x} type="button" onClick={() => setReason(x)} className={cx('rounded-full border px-3 py-1.5 text-xs font-bold', reason === x ? 'border-[#035C6C] bg-[#E5F3F5] text-[#035C6C]' : 'border-[#E5E7EB] text-[#6B7280]')}>{x}</button>
                        ))}
                      </div>
                      <input className={INPUT} maxLength={200} placeholder={reason === 'Other' ? 'Note (required)' : 'Note (optional)'} value={revNotes} onChange={(e) => setRevNotes(e.target.value)} />
                      {needsApproval ? (
                        <label className="flex items-start gap-2 rounded-xl border border-[#E5E7EB] p-2.5 text-xs text-[#111111]">
                          <input type="checkbox" className="mt-0.5 accent-[#035C6C]" checked={approvedNow} onChange={(e) => setApprovedNow(e.target.checked)} />
                          {approvedNow ? `Customer approved ${inr(currentTotal)} → ${inr(proposed)}.` : 'A higher price or cancelled service needs fresh approval — leave unticked to wait for the customer.'}
                        </label>
                      ) : null}
                      {revHint ? <p className="text-xs text-[#6B7280]">{revHint}</p> : null}
                      <div className="flex justify-end gap-2">
                        <button type="button" disabled={revSaving} onClick={resetRevision} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-xs font-bold text-[#111111] hover:bg-[#F3F4F6]">Discard</button>
                        <button type="button" disabled={!canRevise} onClick={submitRevision} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-50" style={{ backgroundColor: TEAL }}>
                          {revSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save Price Revision
                        </button>
                      </div>
                    </div>
                  ) : null}
                </Card>

                <SectionTitle title="More Details" />
                <div className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
                  <FoldRow title="Missing / Damaged Parts" right={flaggedCount ? `${flaggedCount} Part${flaggedCount === 1 ? '' : 's'} Flagged` : 'None'} rightColor={flaggedCount ? '#DC2626' : '#6B7280'} open={partsOpen} onClick={() => setPartsOpen((v) => !v)} />
                  {partsOpen ? (
                    <div className="space-y-2 px-3 pb-3">
                      {PARTS.map((p) => {
                        const s = form.missingParts?.[p.id] || {};
                        return (
                          <div key={p.id} className="rounded-xl border border-[#E5E7EB] p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[13px] font-bold text-[#111111]">{p.name}</span>
                              <div className="flex gap-1.5">
                                {[['missing', 'Missing'], ['damage', 'Damaged']].map(([k, lbl]) => (
                                  <button key={k} type="button" onClick={() => setPart(p.id, { missing: k === 'missing' ? !s.missing : false, damage: k === 'damage' ? !s.damage : false })}
                                    className={cx('rounded-full border px-3 py-1 text-xs font-bold', s[k] ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]' : 'border-[#E5E7EB] text-[#6B7280]')}>
                                    {lbl}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {s.missing || s.damage ? <input className={cx(INPUT, 'mt-2')} placeholder="Remark (optional)" value={s.detail || ''} onChange={(e) => setPart(p.id, { detail: e.target.value })} /> : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="h-px bg-[#E5E7EB]" />
                  <FoldRow title="Device Security" icon={Lock} right={lockSaved ? `${lockLabel(form.lockType)} — Saved` : 'None'} rightColor={lockSaved ? TEAL : '#6B7280'} open={lockOpen} onClick={() => setLockOpen((v) => !v)} />
                  {lockOpen ? (
                    <div className="space-y-2.5 px-3 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {LOCKS.filter(([k]) => k !== 'NONE').map(([k, lbl]) => (
                          <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, lockType: k, lockValue: k === f.lockType ? f.lockValue : '' }))}
                            className={cx('rounded-full border px-3.5 py-2 text-[12.5px] font-extrabold', form.lockType === k ? 'border-[#035C6C] bg-[#E5F3F5] text-[#035C6C]' : 'border-[#E5E7EB] text-[#6B7280]')}>
                            {lbl}
                          </button>
                        ))}
                        {lockSaved ? (
                          <button type="button" onClick={() => setForm((f) => ({ ...f, lockType: 'NONE', lockValue: '' }))} className="rounded-full border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2 text-[12.5px] font-extrabold text-[#DC2626]">Clear Security</button>
                        ) : null}
                      </div>
                      {form.lockType !== 'NONE' ? (
                        <Field icon={Lock} value={form.lockValue} onChange={(v) => set('lockValue', v)} placeholder={form.lockType === 'PATTERN' ? 'Pattern (e.g. 1-2-3-6-9)' : `Enter ${lockLabel(form.lockType)}`} inputMode={form.lockType === 'PIN' ? 'numeric' : undefined} />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <SectionTitle title="Booking Info" hint="(not editable here)" />
                <Card>
                  <InfoRow label="Booking" value={`#${bookingRef(ticket)}`} />
                  <InfoRow label="Booked on" value={fmtDateTime(ticket.createdAt)} />
                  <InfoRow label="Status" value={status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())} />
                  <InfoRow label="Technician" value={techName ? `Assigned (${techName})` : ticket.assignedTechnicianId ? 'Assigned' : 'Not Assigned'} />
                  <InfoRow label="Estimated Cost" value={ticket.estimatedPrice != null ? `₹${Number(ticket.estimatedPrice).toLocaleString('en-IN')}` : 'Not Estimated'} />
                  <InfoRow label="Delivery On" value={fmtDateTime(ticket.estimatedDeliveryAt)} last />
                </Card>
              </div>
            </fieldset>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E7EB] bg-white px-4 py-3 lg:sticky lg:mt-4 lg:rounded-[14px] lg:border">
              <div className="mx-auto flex max-w-[1440px] items-center justify-end gap-2">
                {dirty ? <span className="mr-auto hidden text-xs text-[#6B7280] sm:block">Changed: {diff.labels.join(', ')}</span> : null}
                <button type="button" onClick={cancel} className="flex-1 rounded-xl border border-[#E5E7EB] px-5 py-2.5 text-sm font-bold text-[#111111] hover:bg-[#F3F4F6] lg:flex-none">Cancel</button>
                <button type="button" onClick={save} disabled={!canSave}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 lg:flex-none" style={{ backgroundColor: TEAL }}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Changes
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
