'use client';

/**
 * /shop-home/employee/team/tasks/?id=<employeeId> — one technician's
 * "Working Record", opened from Employee Details → Quick Access → Task
 * Report (the Service Report menu page stays the shop-wide report).
 * Laid out like the Partner app's Working Record screen:
 *
 *   - This Month: month switcher + In Process (Active) / Pending (Waiting) /
 *     Completed (Finished) / Total (Overall).
 *   - Recent Pending and In Process lists, then Previous with
 *     All / Completed / In Process / Pending chips.
 *   - Each card: booked date, the work (services / issue), the current
 *     step in green, "In Service Process On <last update>", the tracking id.
 *
 * Data: GET {TICKET_BASE}/tickets (fetchTicketsPaged) filtered to tickets
 * assigned to this technician and created in the chosen month — the same
 * source and Pending / In Process / Completed buckets as Service Report.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, Inbox, RefreshCw } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { MONTHS, shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchTechnician, fetchTicketsPaged } from '@/lib/shopDashboard';
import { SERVICE_STEPS } from '@/lib/serviceTimeline';
import { ticketStageLabel } from '@/lib/ticketStatus';

const GREEN = '#035C6C';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
const STEP_LABEL = new Map(SERVICE_STEPS);
const FILTERS = ['All', 'Completed', 'In Process', 'Pending'];

/** Same buckets as Service Report. */
function bucketOf(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'CANCELLED') return 'Cancelled';
  if (['CREATED', 'QUOTED'].includes(s)) return 'Pending';
  if (['DELIVERED', 'READY', 'INVOICE_GENERATED', 'INVOICE_READY', 'DELIVERED_PROCESSING'].includes(s)) return 'Completed';
  return 'In Process';
}
function stepLabel(t) {
  const s = String(t.status || '').toUpperCase();
  if (['CREATED', 'ASSIGNED'].includes(s) && t.technicianAcceptedAt) return 'Technician Accepted Service';
  return STEP_LABEL.get(s) || ticketStageLabel(t.status);
}
const fmtDay = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
};
const fmtStamp = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? `${fmtDay(v)}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}` : '—';
};
const withHash = (v) => (v ? `#${String(v).replace(/^#+/, '')}` : '');

function Tile({ icon: Icon, label, value, sub, tone }) {
  const t = tone === 'yellow' ? 'bg-[#FFF8E1]' : 'bg-[#E5F3F5]';
  const ic = tone === 'yellow' ? 'text-[#E8A800]' : 'text-[#035C6C]';
  return (
    <div className={cx('rounded-2xl p-3.5', t)}>
      <p className={cx('flex items-center gap-1.5 text-[13px] font-bold', ic)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1.5 text-[24px] font-extrabold leading-none text-[#111111]">{value}</p>
      <p className="mt-1 text-[12.5px] text-[#667085]">{sub}</p>
    </div>
  );
}

function TaskCard({ t }) {
  return (
    <li className="relative overflow-hidden rounded-2xl border border-[#ECECEC] bg-white py-3.5 pl-5 pr-4 shadow-[0_2px_10px_rgba(16,24,40,0.05)]">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: GREEN }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-[#111111]">
          <CalendarDays className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
          {fmtDay(t.createdAt)}
        </p>
        <span className="max-w-[45%] shrink-0 truncate text-[13px] font-bold text-[#98A2B3]">{withHash(t.trackingId)}</span>
      </div>
      <p className="mt-1 truncate text-[14.5px] text-[#344054]">
        {t.repairServicesSummary || t.issueDescription || 'Service'}
        {t.deviceDisplayName ? <span className="text-[#98A2B3]"> · {t.deviceDisplayName}</span> : null}
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold" style={{ color: t.bucket === 'Pending' ? '#B45309' : GREEN }}>
            {stepLabel(t)}
          </p>
          <p className="text-[12.5px] text-[#667085]">In Service Process On {fmtStamp(t.updatedAt || t.createdAt)}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C]" aria-hidden="true">
          <RefreshCw className="h-4 w-4" />
        </span>
      </div>
    </li>
  );
}

function Empty({ title, text }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[#C7E6EA] bg-[#E5F3F5] px-4 py-7 text-center">
      <Inbox className="h-7 w-7 text-[#035C6C]" aria-hidden="true" />
      <p className="mt-2 text-[16px] font-extrabold text-[#111111]">{title}</p>
      <p className="text-[13.5px] text-[#667085]">{text}</p>
    </div>
  );
}

function SectionHead({ title, onViewAll }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[17px] font-extrabold text-[#111111]">{title}</h2>
      {onViewAll ? (
        <button type="button" onClick={onViewAll} className={cx('text-[15px] font-extrabold text-[#035C6C] hover:underline', FOCUS_RING)}>
          View all
        </button>
      ) : null}
    </div>
  );
}

export default function WorkingRecordPage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [name, setName] = useState('');
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState('All');
  const previousRef = useRef(null);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    fetchTechnician(id)
      .then((t) => alive && setName(t?.name || ''))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setError('');
    setTickets(null);
    fetchTicketsPaged()
      .then((list) => alive && setTickets(list.filter((t) => String(t.assignedTechnicianId || '') === String(id))))
      .catch((err) => {
        if (!alive) return;
        setTickets([]);
        setError(err.message || 'Could not load this employee’s work.');
      });
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  const rows = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    return (tickets || [])
      .filter((t) => {
        const d = t.createdAt ? new Date(t.createdAt) : null;
        return d && d.getFullYear() === y && d.getMonth() === m;
      })
      .map((t) => ({ ...t, bucket: bucketOf(t.status) }))
      .filter((t) => t.bucket !== 'Cancelled')
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }, [tickets, viewDate]);

  const by = (b) => rows.filter((r) => r.bucket === b);
  const pending = by('Pending');
  const inProcess = by('In Process');
  const completed = by('Completed');
  const previous = filter === 'All' ? rows : by(filter);
  const loading = tickets === null;
  const n = (list, w = 2) => (loading ? '…' : String(list.length).padStart(w, '0'));

  const showAll = (f) => {
    setFilter(f);
    previousRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
      <div className="relative flex items-center justify-center border-b border-[#ECECEC] pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className={cx('absolute left-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#E5F3F5] text-[#111111] transition hover:bg-[#E5F3F5]', FOCUS_RING)}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 px-12 text-center">
          <h1 className="text-[20px] font-extrabold text-[#111111]">Working Record</h1>
          {name ? <p className="break-words text-[12.5px] font-semibold text-[#666666]">{name}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          aria-label="Refresh"
          className={cx('absolute right-0 flex h-10 w-10 items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#035C6C] transition hover:border-[#035C6C]', FOCUS_RING)}
        >
          <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
        </button>
      </div>

      <section className="rounded-[22px] border border-[#ECECEC] bg-white p-5 shadow-[0_4px_14px_rgba(16,24,40,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-extrabold text-[#111111]">This Month</h2>
          <div className="flex items-center gap-1 rounded-full px-4 py-1.5 text-white" style={{ backgroundColor: GREEN }}>
            <span className="pr-2 text-[14.5px] font-bold">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button type="button" onClick={() => shiftMonth(setViewDate, -1)} aria-label="Previous month" className="rounded-full p-1 hover:bg-white/15">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="h-4 w-px bg-white/30" aria-hidden="true" />
            <button type="button" onClick={() => shiftMonth(setViewDate, 1)} aria-label="Next month" className="rounded-full p-1 hover:bg-white/15">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile icon={Clock} label="In Process" value={n(inProcess)} sub="Active" />
          <Tile icon={AlertCircle} label="Pending" value={n(pending)} sub="Waiting" tone="yellow" />
          <Tile icon={CheckCircle2} label="Completed" value={n(completed, 3)} sub="Finished" />
          <Tile icon={BarChart3} label="Total" value={n(rows, 3)} sub="Overall" />
        </div>
      </section>

      {error ? <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] font-semibold text-[#B42318]">{error}</p> : null}

      <section>
        <SectionHead title="Recent Pending" onViewAll={pending.length ? () => showAll('Pending') : null} />
        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-[#F3F3F3]" />
        ) : pending.length ? (
          <ul className="space-y-2.5">
            {pending.slice(0, 2).map((t) => (
              <TaskCard key={t.id} t={t} />
            ))}
          </ul>
        ) : (
          <Empty title="No pending tasks." text="You're all caught up!" />
        )}
      </section>

      <section>
        <SectionHead title="In Process" onViewAll={inProcess.length ? () => showAll('In Process') : null} />
        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-[#F3F3F3]" />
        ) : inProcess.length ? (
          <ul className="space-y-2.5">
            {inProcess.slice(0, 2).map((t) => (
              <TaskCard key={t.id} t={t} />
            ))}
          </ul>
        ) : (
          <Empty title="Nothing in process." text="No repairs are being worked on right now." />
        )}
      </section>

      <section ref={previousRef} className="scroll-mt-4">
        <SectionHead title="Previous Completed" />
        <div className="mb-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cx(
                'rounded-full border px-5 py-2 text-[14px] font-bold transition',
                FOCUS_RING,
                filter === f ? 'border-transparent bg-[#035C6C] text-white' : 'border-[#ECECEC] bg-white text-[#475467] hover:border-[#035C6C]',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-[#F3F3F3]" />
        ) : previous.length ? (
          <ul className="space-y-2.5">
            {previous.map((t) => (
              <TaskCard key={t.id} t={t} />
            ))}
          </ul>
        ) : (
          <Empty title="No tasks here." text={`No ${filter === 'All' ? '' : `${filter.toLowerCase()} `}work assigned this month.`} />
        )}
      </section>
    </div>
  );
}
