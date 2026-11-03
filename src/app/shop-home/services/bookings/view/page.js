'use client';

/**
 * /shop-home/services/bookings/view/?id=… — Service History for one booking.
 *
 * Mirrors the Partner app's BookingTimelineScreen: the booking
 * ({ORDER_BASE}/repair-bookings/shop/{id}) gives the ticketId, then the same
 * calls the app makes — GET {TICKET_BASE}/tickets/{id}, /events, /invoice,
 * /notes, /solution-packs — re-read every 10s while the tab is visible.
 * Milestones come from src/lib/serviceMilestones.js (port of the app's
 * serviceMilestones.js): only finished milestones are listed; the one in
 * progress is told in the status card.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, BadgeCheck, CalendarClock, Check, Copy, Lock, Minus, ReceiptIndianRupee, Smartphone, X } from 'lucide-react';

import Icon3D from '@/components/shop-dashboard/Icon3D';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { fetchShopBookingDetail, recordTicketStatus } from '@/lib/shopDashboard';
import { shopRequest } from '@/lib/shopApi';
import { TICKET_BASE } from '@/lib/api';
import { enrichWithCatalog } from '@/lib/deviceImage';
import { guessColorHex } from '@/lib/colorSwatch';
import { bookingRef } from '@/lib/orderStages';
import { withHash } from '@/components/shop-dashboard/OrdersList';
import {
  buildMilestones, eventTime, fmtTrackTime, getTrackingSummary, labelOf, technicianExtras, timeAgo,
} from '@/lib/serviceMilestones';

const POLL_MS = 10000;
const QC_STATUS_KEY = 'QUALITY_CHECK_COMPLETED';
const listOf = (v) => (Array.isArray(v) ? v : (v?.content ?? []));
const ticketGet = (path) => shopRequest(TICKET_BASE(), path);

function fmtEventTime(v) {
  const d = new Date(v || '');
  if (!v || Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  return `${date} · ${time}`;
}

function splitTrackingId(id) {
  const s = String(id ?? '').replace(/^#/, '');
  const m = s.match(/^(\D*)(\d.*)$/);
  return m ? { prefix: m[1], digits: m[2] } : { prefix: s, digits: '' };
}

export default function BookingHistoryPage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [booking, setBooking] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [events, setEvents] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [qcSaving, setQcSaving] = useState(false);
  const [, setTick] = useState(0);
  const ticketIdRef = useRef(null);
  const fetchingRef = useRef(false);

  const load = useCallback(async () => {
    if (!id || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      if (!ticketIdRef.current) {
        const data = await fetchShopBookingDetail(id);
        const [enriched] = await enrichWithCatalog([data]).catch(() => [data]);
        setBooking(enriched || data);
        ticketIdRef.current = data?.ticketId || id;
      }
      const tid = encodeURIComponent(ticketIdRef.current);
      const [t, ev, inv, notes, packs] = await Promise.all([
        ticketGet(`/tickets/${tid}`).catch(() => null),
        ticketGet(`/tickets/${tid}/events`).catch(() => []),
        ticketGet(`/tickets/${tid}/invoice`).catch(() => null),
        ticketGet(`/tickets/${tid}/notes`).catch(() => []),
        ticketGet(`/tickets/${tid}/solution-packs`).catch(() => []),
      ]);
      setTicket(t);
      setExtras(technicianExtras(t, listOf(notes), listOf(packs)));
      setEvents(listOf(ev));
      setInvoice(inv || null);
      setError('');
    } catch (e) {
      setError(e?.message || 'Failed to load history');
    } finally {
      fetchingRef.current = false;
    }
  }, [id]);

  // Live while the tab is visible: poll every POLL_MS, re-read on return.
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    let timer = null;
    const start = () => { clearInterval(timer); timer = setInterval(load, POLL_MS); };
    load().finally(() => { if (alive) setLoading(false); });
    start();
    const onVis = () => {
      if (document.visibilityState === 'visible') { load(); start(); } else clearInterval(timer);
    };
    document.addEventListener('visibilitychange', onVis);
    const ager = setInterval(() => setTick((n) => n + 1), 30000);
    return () => {
      alive = false;
      clearInterval(timer);
      clearInterval(ager);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [id, load]);

  const ticketId = ticketIdRef.current;
  const qcEvent = events.find((e) => String(e.status || '').toUpperCase() === QC_STATUS_KEY) || null;
  const qcByOwner = ['OWNER', 'SHOP'].includes(String(qcEvent?.actor || '').toUpperCase());
  const qcBlockedBy = qcEvent || events.some((e) => String(e.status || '').toUpperCase() === 'REPAIR_COMPLETED')
    ? null : 'Repair Completed';

  async function markQualityCheckCompleted() {
    if (!window.confirm('Mark quality check completed?\n\nThis records Quality Check Completed on the customer\'s Service History and moves the booking to Ready for Delivery.')) return;
    setQcSaving(true);
    try {
      await recordTicketStatus(ticketId, QC_STATUS_KEY);
      await load();
    } catch (e) {
      window.alert(`Could not save: ${e?.message || 'Please try again.'}`);
    } finally {
      setQcSaving(false);
    }
  }

  function copyTrackingId(text) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(String(text)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  }

  const milestoneExtra = (m) => {
    if (m.key === 'QUALITY_CHECK' && m.state === 'current' && !qcEvent) {
      return (
        <button
          type="button"
          onClick={markQualityCheckCompleted}
          disabled={qcSaving || !!qcBlockedBy}
          className={`mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2 text-[11.5px] font-extrabold sm:w-auto sm:px-4 ${qcBlockedBy ? 'bg-[#F3F4F6] text-[#6B7280]' : 'bg-[#035C6C] text-white'} ${qcSaving ? 'opacity-60' : ''}`}
        >
          {qcBlockedBy ? <Lock className="h-3 w-3" /> : <BadgeCheck className="h-3.5 w-3.5" />}
          {qcSaving ? 'Saving…' : qcBlockedBy ? `Quality check after ${qcBlockedBy}` : 'Mark Quality Check Completed'}
        </button>
      );
    }
    if (m.key === 'QUALITY_CHECK' && qcEvent) {
      return <p className="mt-0.5 text-[11px] text-[#6B7280]">{qcByOwner ? 'Shop QC Completed' : 'Technician QC Completed'}</p>;
    }
    if (m.key === 'DELIVERED' && invoice) {
      return (
        <div className="mt-2 flex items-center gap-1.5 rounded-[10px] bg-[#E5F3F5] px-2.5 py-2 text-[11.5px] font-extrabold text-[#035C6C]">
          <ReceiptIndianRupee className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Invoice #{String(invoice.invoiceNo || '').replace(/^#+/, '') || '—'}
            <span className="font-medium text-[#6B7280]">  {fmtEventTime(invoice.generatedAt)}</span>
          </span>
        </div>
      );
    }
    return null;
  };

  const milestones = buildMilestones(events, extras);
  const summary = getTrackingSummary(events, milestones);
  const eta = summary.closed ? null : (ticket?.estimatedDeliveryAt || ticket?.estimatedReadyAt || null);
  const current = milestones.find((m) => m.state === 'current') || null;
  const completed = milestones.filter((m) => m.state === 'done' || (m.key === 'APPROVAL' && m.state === 'current'));
  const currentNote = current?.latest?.note && current.latest.note !== labelOf(current.latest.status) ? current.latest.note : null;

  const src = ticket || booking;
  const trackingText = ticket?.trackingId || (booking && bookingRef(booking)) || id;
  const tid = splitTrackingId(withHash(trackingText));
  const shownName = /^(.*?)(?: · ([^()]+?))?(?: \(([^)]*)\))?$/.exec(String(src?.deviceDisplayName || '').trim());
  const deviceName = shownName?.[1]?.trim() || src?.deviceModelName || src?.modelName || booking?.deviceName || 'Device';
  const modelNumber = ticket?.modelNumber || shownName?.[2]?.trim() || null;
  const specLine = [ticket?.ramLabel ? `${ticket.ramLabel} RAM` : null, ticket?.storageLabel].filter(Boolean).join(' · ')
    || booking?.ramStorage || shownName?.[3]?.trim() || null;
  const colorName = src?.color || null;
  const deviceImage = ticket?.deviceImageUrl || booking?.deviceImageUrl || null;

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-3 bg-[#F3F4F6]">
      <div className="flex items-center gap-2.5 border-b border-[#E5E7EB] bg-white px-3.5 py-3 sm:rounded-[18px] sm:border">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F3F4F6] text-[#111111]"
        >
          <ArrowLeft className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[17px] font-extrabold text-[#111111]">Service History</h1>
          <p className="truncate text-[11px] text-[#6B7280]">Track the complete journey of this device</p>
        </div>
        <span className="w-9 shrink-0" />
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-[18px] bg-white" />
          <div className="h-72 animate-pulse rounded-[18px] bg-white" />
        </div>
      ) : !booking && !ticket ? (
        error ? <ErrorBanner message={error} onRetry={load} /> : (
          <EmptyState icon={AlertTriangle} tone="muted" title="Booking not found" description="We couldn't find history for this booking." />
        )
      ) : (
        <>
          <section className="rounded-[18px] border border-[#F3F4F6] bg-white p-3 shadow-[0_3px_10px_rgba(17,17,17,0.05)]">
            <div className="flex items-center gap-3">
              <DeviceThumb url={deviceImage} />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => copyTrackingId(trackingText)}
                  className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#E5F3F5] px-2.5 py-1 text-[10.5px] font-extrabold"
                  aria-label={`Copy ticket number ${trackingText}`}
                >
                  <span className="text-[#111111]">#{tid.prefix}</span>
                  <span className="-ml-1.5 text-[#035C6C]">{tid.digits}</span>
                  <Copy className="h-3 w-3 text-[#035C6C]" aria-hidden="true" />
                  {copied ? <span className="text-[#035C6C]">Copied</span> : null}
                </button>
                <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#6B7280]">
                  Device{booking?.brandName ? ` · ${booking.brandName}` : ''}
                </p>
                <p className="line-clamp-2 text-[15px] font-extrabold leading-[19px] text-[#111111]">{deviceName}</p>
                {modelNumber ? (
                  <p className="mt-0.5 truncate text-[11.5px] text-[#6B7280]">
                    Model No. <span className="font-bold text-[#111111]">{modelNumber}</span>
                  </p>
                ) : null}
                {specLine || colorName ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-[#6B7280]">
                    {specLine ? <span>{specLine}</span> : null}
                    {colorName ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-[9px] w-[9px] rounded-full border border-[#E5E7EB]" style={{ backgroundColor: guessColorHex(colorName) }} />
                        {colorName}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {error ? (
            <div className="rounded-[14px] border border-[#FBD0D0] bg-[#FEECEC] px-3 py-2.5 text-[11px] font-semibold text-[#D63232]">{error}</div>
          ) : null}

          <section className="rounded-[18px] border border-[#F3F4F6] bg-white p-3.5 shadow-[0_3px_10px_rgba(17,17,17,0.05)]">
            <div className="flex items-start">
              <div className="min-w-0 flex-1">
                <p className={`text-[17px] font-extrabold leading-[22px] ${summary.danger ? 'text-[#F84141]' : 'text-[#035C6C]'}`}>{summary.headline}</p>
                {summary.latestLabel ? (
                  <p className="mt-0.5 truncate text-[11.5px] text-[#6B7280]">Latest: {summary.latestLabel} · {timeAgo(summary.latestAt)}</p>
                ) : null}
              </div>
              {!summary.closed ? (
                <span className="ml-2 mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#E5F3F5] px-2 py-0.5 text-[10px] font-extrabold text-[#035C6C]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#609138]" />
                  Live
                </span>
              ) : null}
            </div>
            {eta ? (
              <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[#111111]">
                <CalendarClock className="h-3.5 w-3.5 text-[#035C6C]" />
                Expected by <span className="font-extrabold">{fmtTrackTime(eta)}</span>
              </p>
            ) : null}
            {currentNote ? <p className="mt-1.5 line-clamp-2 text-xs text-[#111111]">{currentNote}</p> : null}
            {current ? milestoneExtra(current) : null}
            {completed.length ? (
              <div className="mt-3.5">
                {completed.map((m, i) => {
                  const next = completed[i + 1];
                  return (
                    <MilestoneRow
                      key={m.key}
                      m={m}
                      isLast={i === completed.length - 1}
                      nextReached={!!next && (next.state === 'done' || next.state === 'current')}
                      extra={milestoneExtra(m)}
                    />
                  );
                })}
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

function Marker({ state, danger }) {
  if (state === 'done') {
    return (
      <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${danger ? 'bg-[#F84141]' : 'bg-[#609138]'}`}>
        {danger ? <X className="h-3 w-3 text-white" strokeWidth={3} /> : <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${danger ? 'bg-[#FEECEC]' : 'bg-[#E5F3F5]'}`}>
        <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 bg-white ${danger ? 'border-[#F84141]' : 'border-[#035C6C]'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${danger ? 'bg-[#F84141]' : 'bg-[#035C6C]'}`} />
        </span>
      </span>
    );
  }
  if (state === 'missed' || state === 'stopped') {
    return (
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-dashed border-[#9CA3AF] bg-white">
        <Minus className="h-[11px] w-[11px] text-[#9CA3AF]" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="flex h-[22px] w-[22px] items-center justify-center">
      <span className="h-3 w-3 rounded-full border-2 border-[#E5E7EB] bg-white" />
    </span>
  );
}

function MilestoneRow({ m, isLast, nextReached, extra }) {
  const reached = m.state === 'done' || m.state === 'current';
  const tone = m.danger ? 'text-[#F84141]' : m.state === 'current' ? 'text-[#035C6C]' : 'text-[#111111]';
  const items = reached ? [...m.events, ...m.extras].sort((a, b) => eventTime(b) - eventTime(a)) : [];
  const doneNote = m.state === 'done' && m.doneEvent?.note && m.doneEvent.note !== labelOf(m.doneEvent.status)
    ? String(m.doneEvent.note).trim() : null;
  const notes = m.verdictOnly ? (doneNote ? [doneNote] : []) : [...new Set([doneNote, ...items
    .filter((e) => e.note && e.note !== labelOf(e.status))
    .map((e) => String(e.note).trim())].filter(Boolean))].slice(0, 3);
  const photos = [...new Set(items.flatMap((e) => (Array.isArray(e.imageUrls) ? e.imageUrls : [])))];
  const shown = photos.slice(0, 4);
  const audioEvent = items.find((e) => e.audioUrl) || null;
  const when = m.state === 'done' ? m.doneEvent?.createdAt : m.latest?.createdAt;
  const sub = m.state === 'current'
    ? (m.verdictOnly ? null : m.latest ? labelOf(m.latest.status) || 'In progress' : 'Next up')
    : m.state === 'missed' ? 'Not recorded'
      : m.state === 'stopped' ? 'Stopped — booking cancelled' : null;

  return (
    <div className="flex">
      <div className="flex w-[30px] shrink-0 flex-col items-center">
        <Marker state={m.state} danger={m.danger} />
        {!isLast ? <span className={`my-0.5 w-0.5 flex-1 ${m.state === 'done' && nextReached ? 'bg-[#609138]' : 'bg-[#E5E7EB]'}`} /> : null}
      </div>
      <div className={`min-w-0 flex-1 pl-2 ${isLast ? '' : 'pb-4'}`}>
        <p className={`flex min-h-[22px] items-center text-[13.5px] ${reached ? `font-extrabold ${tone}` : 'font-semibold text-[#9CA3AF]'}`}>{m.label}</p>
        {when && reached ? <p className="mt-px text-[10.5px] text-[#6B7280]">{fmtTrackTime(when)}</p> : null}
        {sub ? (
          <p className={`mt-0.5 text-[11.5px] ${m.state === 'current' ? `font-bold ${m.danger ? 'text-[#F84141]' : 'text-[#035C6C]'}` : 'font-medium text-[#9CA3AF]'}`}>{sub}</p>
        ) : null}
        {notes.map((n) => <p key={n} className="mt-0.5 line-clamp-3 text-[11.5px] leading-4 text-[#111111]">{n}</p>)}
        {shown.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {shown.map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="relative block">
                {/* eslint-disable-next-line @next/next/no-img-element -- technician-uploaded attachment URLs. */}
                <img src={u} alt={`${m.label} photo ${i + 1}`} className="h-[52px] w-[52px] rounded-lg bg-[#F3F4F6] object-cover" />
                {i === shown.length - 1 && photos.length > shown.length ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-[rgba(17,17,17,0.55)] text-xs font-extrabold text-white">
                    +{photos.length - shown.length}
                  </span>
                ) : null}
              </a>
            ))}
          </div>
        ) : null}
        {audioEvent ? <audio controls src={audioEvent.audioUrl} className="mt-1.5 h-8 w-full max-w-xs" /> : null}
        {extra}
      </div>
    </div>
  );
}

function DeviceThumb({ url }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#F3F4F6] bg-white">
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- device photos are arbitrary shop-catalog URLs.
        <img src={url} alt="" onError={() => setBroken(true)} className="h-14 w-14 object-contain" />
      ) : (
        <Icon3D icon={Smartphone} tone="green" size="lg" />
      )}
    </span>
  );
}
