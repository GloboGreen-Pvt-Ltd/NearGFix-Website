'use client';

/**
 * /shop-home/services/bookings/view/re-estimate/?id=<booking>&ticket=<ticket> — Re-Estimate.
 *
 * Mirrors the Partner app's ReEstimateScreen: ADDITIONAL issues found during
 * repair, priced on top of the current estimate. Original services stay
 * read-only. One POST /tickets/{id}/re-estimate (items, reason,
 * estimatedDeliveryAt, customerApproved) — the server moves the status by its
 * own re-estimate rules. Supporting photos are added from the app only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, Circle, CircleCheck, Clock, Loader2, MessageSquarePlus, Search, Wrench, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { IssueCheckRow, IssueSheet, IssueTile, SelectedIssueRow } from '@/components/shop-dashboard/RepairIssuePieces';
import { iconForRepairCategory, iconForRepairService } from '@/lib/repairIcons';
import { TICKET_BASE, masterApi } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';
import { fetchTicket } from '@/lib/shopDashboard';
import { priceItemsFromTicket } from '@/lib/invoice';
import { bookingRef } from '@/lib/orderStages';
import { notifyError, notifySuccess } from '@/lib/toast';

const TEAL = '#035C6C';
const RE_ESTIMABLE = ['CREATED', 'ASSIGNED', 'IN_DIAGNOSIS', 'QUOTED', 'APPROVED', 'IN_REPAIR'];
const SERVICE_CHARGE_CODE = 'SERVICE_CHARGE';
// Extra repair time on top of the current estimate (0 = keep the delivery time).
const EXTRA_HOURS = [0, 1, 2, 3, 4, 6, 12, 24, 48];
const INPUT = 'w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none placeholder:text-[#9CA3AF] focus:border-[#035C6C]';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const unwrap = (list) => (Array.isArray(list) ? list : list?.content ?? list?.data ?? []);
const fmtDateTime = (d) => {
  const x = d ? (d instanceof Date ? d : new Date(d)) : null;
  if (!x || Number.isNaN(x.getTime())) return '—';
  return `${x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${x.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
};
const nameOf = (s) => String(s?.name || s?.serviceName || '').trim();
const ISSUE_FIRST_TILES = 8;
// Partner app TILE_ORDER: these groups first, the rest in catalogue order.
const ISSUE_TILE_ORDER = [/dead|no power/i, /display|screen/i, /battery/i, /motherboard|mainboard|sub-?board/i, /network/i, /security/i];
const issueTileRank = (name) => {
  const i = ISSUE_TILE_ORDER.findIndex((re) => re.test(String(name || '')));
  return i === -1 ? ISSUE_TILE_ORDER.length : i;
};

function Card({ children }) {
  return <section className="rounded-[14px] border border-[#E5E7EB] bg-white p-3">{children}</section>;
}
function SectionTitle({ title, hint }) {
  return <h2 className="mb-2 mt-4 text-[13.5px] font-extrabold text-[#111111]">{title}{hint ? <span className="ml-1 text-xs font-medium text-[#9CA3AF]">{hint}</span> : null}</h2>;
}

export default function ReEstimatePage() {
  const router = useRouter();
  const params = useSearchParams();
  const bookingId = params.get('id') || '';
  const ticketId = params.get('ticket') || '';
  const backHref = `/shop-home/services/bookings/view/details/?id=${encodeURIComponent(bookingId)}`;

  const [ticket, setTicket] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [mainCats, setMainCats] = useState([]);
  const [grouped, setGrouped] = useState([]);
  const [sheetId, setSheetId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [added, setAdded] = useState([]); // { key, serviceId, serviceCode, serviceName, group, price, charge, warranty, note }
  const [query, setQuery] = useState('');
  const [otherName, setOtherName] = useState('');
  const [reason, setReason] = useState('');
  const [extraHours, setExtraHours] = useState(0);
  const [approvedNow, setApprovedNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) { setLoadError('This booking has no repair ticket yet.'); setLoading(false); return; }
    setLoading(true);
    setLoadError('');
    try {
      const [t, svcs, cats] = await Promise.all([
        fetchTicket(ticketId),
        masterApi.get('/master/repair-services').then(unwrap).catch(() => []),
        masterApi.get('/master/repair-categories').then(unwrap).catch(() => []),
      ]);
      setTicket(t);
      setCatalog(Array.isArray(svcs) ? svcs : []);
      setMainCats(Array.isArray(cats) ? cats : []);
      // Device-category issue groups (as the app's RepairIssuesPicker): model → categoryId → grouped.
      if (t.brandId && t.modelId) {
        try {
          const models = unwrap(await masterApi.get(`/master/brands/${encodeURIComponent(t.brandId)}/models`));
          const m = models.find((x) => x.id === t.modelId);
          if (m?.categoryId) {
            const g = unwrap(await masterApi.get(`/master/repair-services/grouped?deviceCategoryId=${encodeURIComponent(m.categoryId)}`));
            setGrouped(Array.isArray(g) ? g : []);
          }
        } catch { /* falls back to grouping by repair category */ }
      }
    } catch (e) {
      setLoadError(e?.message || 'Could not load this booking.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  const original = useMemo(() => (ticket ? priceItemsFromTicket(ticket) : []), [ticket]);
  const originalTotal = ticket ? Number(ticket.estimatedPrice ?? original.reduce((a, i) => a + (Number(i.amount) || 0), 0)) || 0 : 0;
  const takenIds = useMemo(() => new Set([...original.map((i) => i.id || i.serviceId), ...added.map((x) => x.serviceId)].filter(Boolean)), [original, added]);
  const originalIds = useMemo(() => new Set(original.map((i) => i.id || i.serviceId).filter(Boolean)), [original]);
  const groups = useMemo(() => {
    let list;
    if (grouped.length) {
      const byId = new Map(catalog.map((x) => [x.id, x]));
      list = grouped.map((g) => ({ id: g.id, name: g.name, services: (g.issues || []).map((i) => byId.get(i.id) || i).filter((x) => x?.id) }));
    } else {
      const catName = Object.fromEntries(mainCats.map((c) => [c.id, c.name]));
      const byCat = new Map();
      catalog.forEach((x) => {
        if (!x?.id) return;
        const key = x.categoryId || '__other__';
        if (!byCat.has(key)) byCat.set(key, { id: key, name: catName[key] || 'Other', services: [] });
        byCat.get(key).services.push(x);
      });
      list = Array.from(byCat.values());
    }
    return list
      .map((g, i) => ({ ...g, i, services: g.services.filter((x) => !originalIds.has(x.id)) }))
      .filter((g) => g.services.length)
      .sort((a, b) => issueTileRank(a.name) - issueTileRank(b.name) || a.i - b.i);
  }, [grouped, catalog, mainCats, originalIds]);
  const q = query.trim().toLowerCase();
  const matches = q
    ? groups.flatMap((g) => g.services.filter((x) => nameOf(x).toLowerCase().includes(q) || g.name.toLowerCase().includes(q)).map((x) => ({ x, group: g.name }))).slice(0, 30)
    : [];
  const sheetGroup = sheetId ? groups.find((g) => g.id === sheetId) || null : null;
  const visibleGroups = showAll ? groups : groups.slice(0, ISSUE_FIRST_TILES);
  const addOther = (name) => { if (name.trim()) addItem({ serviceId: null, serviceCode: 'OTHER', serviceName: name.trim(), group: 'Other Issue' }); };
  const toggleIssue = (svc, group) => {
    if (takenIds.has(svc.id)) setAdded((a) => a.filter((x) => x.serviceId !== svc.id));
    else addItem({ serviceId: svc.id, serviceCode: svc.code || svc.serviceCode || null, serviceName: nameOf(svc), group });
  };

  const extra = added.reduce((a, x) => a + (Number(x.price) || 0) + (Number(x.charge) || 0), 0);
  const unpriced = added.filter((x) => String(x.price).trim() === '' || !(Number(x.price) >= 0));
  const revisedTotal = originalTotal + extra;
  const now = useMemo(() => new Date(), []);
  const currentDelivery = ticket?.estimatedDeliveryAt ? new Date(ticket.estimatedDeliveryAt) : null;
  const proposedDelivery = extraHours > 0
    ? new Date(Math.max(now.getTime(), currentDelivery ? currentDelivery.getTime() : now.getTime()) + extraHours * 3600000)
    : null;
  const status = String(ticket?.status || '').toUpperCase();
  const closed = !!ticket && !RE_ESTIMABLE.includes(status);
  const reasonText = [
    ...added.map((x) => (x.note?.trim() ? `${x.serviceName}: ${x.note.trim()}` : '')),
    reason.trim(),
  ].filter(Boolean).join('\n') || `Additional work: ${added.filter((x) => x.serviceCode !== SERVICE_CHARGE_CODE).map((x) => x.serviceName).join(', ')}`;
  const canSubmit = added.length > 0 && unpriced.length === 0 && !saving && !closed;
  const hint = !added.length ? 'Add at least one additional issue.'
    : unpriced.length ? `Enter a price for ${unpriced[0].serviceName}.` : '';
  const dirty = added.length > 0 || !!reason.trim();

  const addItem = (item) => setAdded((a) => [...a, { key: `${Date.now()}-${a.length}`, price: '', charge: '', warranty: '', note: '', ...item }]);
  const patchItem = (key, patch) => setAdded((a) => a.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function submit() {
    if (!canSubmit) { setTried(true); return; }
    setSaving(true);
    try {
      await shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(ticketId)}/re-estimate`, {
        method: 'POST',
        body: JSON.stringify({
          // Each issue's service charge is its own line, as in the Partner app.
          items: added.flatMap((x) => {
            const line = { id: x.serviceId || null, code: x.serviceCode || null, label: x.serviceName, amount: Number(x.price) || 0, warranty: x.warranty ? `${x.warranty} months` : null };
            const charge = Number(x.charge) || 0;
            return charge > 0 ? [line, { id: null, code: SERVICE_CHARGE_CODE, label: `Service Charge – ${x.serviceName}`, amount: charge, warranty: null }] : [line];
          }),
          reason: reasonText,
          imagesJson: null,
          estimatedDeliveryAt: proposedDelivery ? proposedDelivery.toISOString() : null,
          customerApproved: approvedNow,
        }),
      });
      notifySuccess(approvedNow ? 'Re-estimate submitted — approved by the customer.' : 'Re-estimate submitted — waiting for customer approval.');
      router.push(backHref);
    } catch (e) {
      notifyError(e, e?.status === 409 ? "Another re-estimate is already waiting for the customer's decision." : 'Could not submit the re-estimate.');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm('Discard re-estimate? The additional issues will not be saved.')) return;
    router.push(backHref);
  }

  const deviceName = String(ticket?.deviceDisplayName || ticket?.modelName || 'Device').split(' (')[0].split(' · ')[0];

  return (
    <div className="min-h-full bg-[#F3F4F6] pb-28">
      <div className="border-b border-[#E5E7EB] bg-white px-4 py-2.5">
        <div className="mx-auto flex max-w-[1440px] items-center">
          <button type="button" onClick={cancel} aria-label="Go back" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6] hover:bg-[#E5E7EB]">
            <ArrowLeft className="h-[18px] w-[18px] text-[#111111]" aria-hidden="true" />
          </button>
          <div className="flex-1 px-2 text-center">
            <h1 className="text-[17px] font-extrabold text-[#111111]">Re-Estimate</h1>
            <p className="truncate text-[11px] text-[#6B7280]">{ticket ? `#${bookingRef(ticket)} · ${deviceName}` : ''}</p>
          </div>
          <span className="w-9" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1440px] px-4 pt-3 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#6B7280]"><Loader2 className="h-4 w-4 animate-spin" /> Loading booking…</div>
        ) : loadError ? (
          <ErrorBanner message={loadError} onRetry={ticketId ? load : undefined} />
        ) : ticket ? (
          <>
            {closed ? <div className="mb-3"><ErrorBanner message="Re-estimate is closed once the repair is ready." /></div> : null}
            <div className="grid gap-x-5 lg:grid-cols-2">
              <div>
                <SectionTitle title="Original Estimate" hint="(read-only)" />
                <Card>
                  {original.map((i, idx) => (
                    <div key={idx} className="flex items-center justify-between border-b border-[#F3F4F6] py-2 text-[13px] last:border-0">
                      <span className="font-bold text-[#111111]">{idx + 1}. {i.label || i.serviceName || 'Service'}</span>
                      <span className="font-extrabold text-[#111111]">{inr(i.amount)}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex justify-between border-t border-[#E5E7EB] pt-2.5 text-[13px]">
                    <span className="font-bold text-[#6B7280]">Original Estimated Cost</span>
                    <span className="font-extrabold text-[#111111]">{inr(originalTotal)}</span>
                  </div>
                </Card>

                <SectionTitle title="Additional Issues" hint={added.length ? `(${added.length})` : null} />
                <Card>
                  <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 focus-within:border-[#035C6C]">
                    <Search className="h-[17px] w-[17px] shrink-0 text-[#6B7280]" aria-hidden="true" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} disabled={closed} placeholder="Search issue (e.g. display, battery)" aria-label="Search repair issue"
                      className="min-w-0 flex-1 bg-transparent text-base text-[#111111] outline-none placeholder:text-[#9CA3AF] sm:text-[13.5px]" />
                    {query ? (
                      <button type="button" onClick={() => setQuery('')} aria-label="Clear issue search" className="rounded-full p-0.5 text-[#6B7280]"><X className="h-4 w-4" aria-hidden="true" /></button>
                    ) : null}
                  </label>

                  {q ? (
                    <div className="mt-2 grid grid-cols-1 gap-1.5">
                      {matches.map(({ x, group }) => (
                        <IssueCheckRow key={x.id} name={nameOf(x)} sub={group} Icon={iconForRepairService(nameOf(x), group)} on={takenIds.has(x.id)} onClick={() => !closed && toggleIssue(x, group)} />
                      ))}
                      {!matches.length ? (
                        <button type="button" disabled={closed} onClick={() => { addOther(query); setQuery(''); }}
                          className="flex min-h-[46px] w-full items-center gap-2.5 rounded-xl border border-dashed border-[#035C6C] bg-[#E5F3F5] px-3 text-left text-[13px] text-[#111111]">
                          <MessageSquarePlus className="h-[18px] w-[18px] shrink-0 text-[#035C6C]" strokeWidth={1.75} aria-hidden="true" />
                          <span className="min-w-0 flex-1">No matching issue — add <span className="font-extrabold">“{query.trim()}”</span> as Other Issue</span>
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
                        {visibleGroups.map((g) => (
                          <IssueTile key={g.id} name={g.name} Icon={iconForRepairCategory(g.name)} picked={g.services.filter((x) => takenIds.has(x.id)).length} onClick={() => !closed && setSheetId(g.id)} />
                        ))}
                        <IssueTile name="Other Issue" Icon={MessageSquarePlus} picked={added.filter((x) => !x.serviceId).length} onClick={() => !closed && setSheetId('__other__')} />
                      </div>
                      {groups.length > ISSUE_FIRST_TILES ? (
                        <button type="button" onClick={() => setShowAll((v) => !v)} className="mx-auto mt-1 flex items-center gap-0.5 rounded-md py-1 text-[12.5px] font-bold text-[#035C6C]">
                          {showAll ? 'Show less' : `View All (${groups.length})`}
                          <ChevronDown className={cx('h-3.5 w-3.5 transition', showAll && 'rotate-180')} aria-hidden="true" />
                        </button>
                      ) : null}
                      {!groups.length ? <p className="mt-2 text-xs text-[#98A2B3]">No repair issues are set up for this device yet — use Other Issue.</p> : null}
                    </>
                  )}

                  {added.length ? (
                    <div className="pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[13px] font-extrabold text-[#111111]">Selected Services ({added.length})</p>
                        <p className={cx('text-[13px] font-extrabold', extra > 0 ? 'text-[#035C6C]' : 'text-[#6B7280]')}>{extra > 0 ? inr(extra) : 'Not Estimated'}</p>
                      </div>
                      <div className="space-y-2">
                        {added.map((x) => (
                          <div key={x.key} className={cx('rounded-[14px]', tried && unpriced.includes(x) && 'ring-1 ring-[#FECACA]')}>
                            <SelectedIssueRow
                              name={x.serviceName}
                              sub={x.group}
                              Icon={x.serviceId ? iconForRepairService(x.serviceName, x.group || '') : MessageSquarePlus}
                              price={x.price}
                              charge={x.charge}
                              warranty={x.warranty}
                              note={x.note}
                              onPrice={(v) => patchItem(x.key, { price: v })}
                              onCharge={(v) => patchItem(x.key, { charge: v })}
                              onWarranty={(v) => patchItem(x.key, { warranty: v })}
                              onNote={(v) => patchItem(x.key, { note: v })}
                              onRemove={() => setAdded((a) => a.filter((y) => y.key !== x.key))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Card>

                {sheetGroup ? (
                  <IssueSheet title={sheetGroup.name} Icon={iconForRepairCategory(sheetGroup.name)} onClose={() => setSheetId(null)}>
                    {sheetGroup.services.map((x) => (
                      <IssueCheckRow key={x.id} name={nameOf(x)} Icon={iconForRepairService(nameOf(x), sheetGroup.name)} on={takenIds.has(x.id)}
                        onClick={() => { toggleIssue(x, sheetGroup.name); setSheetId(null); }} />
                    ))}
                  </IssueSheet>
                ) : sheetId === '__other__' ? (
                  <IssueSheet title="Other Issue" Icon={MessageSquarePlus} onClose={() => setSheetId(null)}>
                    <form onSubmit={(e) => { e.preventDefault(); addOther(otherName); setOtherName(''); setSheetId(null); }} className="flex gap-2 p-0.5">
                      <input autoFocus className={INPUT} placeholder="Describe the issue (e.g. Face ID not working)" value={otherName} onChange={(e) => setOtherName(e.target.value)} />
                      <button type="submit" disabled={!otherName.trim()} className="shrink-0 rounded-xl bg-[#035C6C] px-4 text-xs font-bold text-white disabled:opacity-50">Add</button>
                    </form>
                  </IssueSheet>
                ) : null}

                <SectionTitle title="Notes" hint="(Optional)" />
                <Card>
                  <textarea rows={3} className={cx(INPUT, 'resize-none')} placeholder="Why is extra work needed?" value={reason} onChange={(e) => setReason(e.target.value)} disabled={closed} />
                </Card>
              </div>

              <div>
                <SectionTitle title="Extra Repair Time" />
                <Card>
                  <div className="flex flex-wrap gap-1.5">
                    {EXTRA_HOURS.map((h) => (
                      <button key={h} type="button" onClick={() => setExtraHours(h)} disabled={closed}
                        className={cx('rounded-full border px-3 py-1.5 text-xs font-bold', extraHours === h ? 'border-[#035C6C] bg-[#E5F3F5] text-[#035C6C]' : 'border-[#E5E7EB] text-[#6B7280]')}>
                        {h === 0 ? 'No change' : `+${h}h`}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 space-y-1.5 text-[12.5px]">
                    <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[#6B7280]"><Clock className="h-3.5 w-3.5" />Current delivery</span><span className="font-bold text-[#111111]">{fmtDateTime(currentDelivery)}</span></div>
                    {proposedDelivery ? <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[#B45309]"><Clock className="h-3.5 w-3.5" />Proposed delivery</span><span className="font-bold text-[#B45309]">{fmtDateTime(proposedDelivery)}</span></div> : null}
                  </div>
                </Card>

                <SectionTitle title="Revised Estimate" />
                <Card>
                  <div className="space-y-1.5 text-[13px]">
                    <div className="flex justify-between"><span className="text-[#6B7280]">Original Estimated Cost</span><span className="font-bold">{inr(originalTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-[#6B7280]">Additional</span><span className="font-bold text-[#B45309]">+ {inr(extra)}</span></div>
                    <div className="flex justify-between border-t border-[#E5E7EB] pt-2"><span className="font-bold text-[#111111]">Revised Total</span><span className="text-[15px] font-extrabold text-[#035C6C]">{inr(revisedTotal)}</span></div>
                  </div>
                  <button type="button" onClick={() => setApprovedNow((v) => !v)} disabled={closed}
                    className={cx('mt-3 flex w-full items-start gap-2 rounded-xl border p-2.5 text-left', approvedNow ? 'border-[#C7E6EA] bg-[#E5F3F5]' : 'border-[#E5E7EB]')}>
                    {approvedNow ? <CircleCheck className="h-5 w-5 shrink-0 text-[#035C6C]" /> : <Circle className="h-5 w-5 shrink-0 text-[#D1D5DB]" />}
                    <span>
                      <span className="block text-[13px] font-bold text-[#111111]">Customer approved at the counter</span>
                      <span className="block text-xs text-[#6B7280]">{approvedNow ? `Approved ${inr(originalTotal)} → ${inr(revisedTotal)}.` : 'Leave unticked to wait for the customer’s approval.'}</span>
                    </span>
                  </button>
                </Card>
              </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E7EB] bg-white px-4 py-3 lg:sticky lg:mt-4 lg:rounded-[14px] lg:border">
              <div className="mx-auto flex max-w-[1440px] items-center justify-end gap-2">
                {tried && hint ? <span className="mr-auto text-xs font-semibold text-[#DC2626]">{hint}</span> : null}
                <button type="button" onClick={cancel} className="flex-1 rounded-xl border border-[#E5E7EB] px-5 py-2.5 text-sm font-bold text-[#111111] hover:bg-[#F3F4F6] lg:flex-none">Cancel</button>
                <button type="button" onClick={submit} disabled={saving || closed}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 lg:flex-none" style={{ backgroundColor: TEAL }}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit Re-Estimate
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
