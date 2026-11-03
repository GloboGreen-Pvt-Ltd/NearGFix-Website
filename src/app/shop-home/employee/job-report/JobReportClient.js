'use client';

/**
 * Job Report — web port of the Partner App's OwnerJobReportScreen.
 *
 * Two modes: no param lists every ticket with a technician on it;
 * `?employee=<technicianId>` (or legacy `?employeeId=&name=`) lists only that
 * technician's tickets. Same status buckets, rail, search and event-based
 * phase line as the app. No month filter — all jobs are shown.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, ChartColumn, Check, ChevronRight, CircleAlert, Clock, Inbox, Laptop,
  RefreshCw, Search, Smartphone, UserCog, WifiOff, Wrench, X,
} from 'lucide-react';

import { TICKET_BASE } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';
import { fetchTechnicians, fetchTicketsPaged } from '@/lib/shopDashboard';
import { enrichWithCatalog, resolveMediaUrl } from '@/lib/deviceImage';

const C = { green: '#035C6C', blue: '#0788C9', leaf: '#609138', red: '#F32C26', yellow: '#FAA700', muted: '#6B7280' };

function bucketize(status) {
  const s = (status || '').toUpperCase();
  if (s === 'DELIVERED' || s === 'CANCELLED') return 'COMPLETED';
  if (s === 'CREATED' || s === 'IN_DIAGNOSIS' || s === 'QUOTED') return 'PENDING';
  return 'IN_PROCESS';
}

const STATUS_LABEL = {
  CREATED: 'Booking Created',
  IN_DIAGNOSIS: 'In Diagnosis',
  QUOTED: 'Quotation Sent. Awaiting Approval',
  APPROVED: 'Customer Approved. Work Pending',
  IN_REPAIR: 'Repair Work In Progress',
  READY: 'Ready for Delivery',
  DELIVERED: 'Delivered to Customer',
  CANCELLED: 'Work Cancelled',
};
const statusLabel = (status) => {
  const s = (status || '').toUpperCase();
  return STATUS_LABEL[s] || (status ? status.replace(/_/g, ' ') : '—');
};

const CANONICAL_EVENT_ORDER = [
  'BOOKING_CREATED_BY_SHOP', 'SERVICE_ACCEPTED', 'ASSIGNED_TO_TECHNICIAN', 'AWAITING_TECHNICIAN_ACCEPTANCE',
  'REASSIGNED_TO_TECHNICIAN', 'TECHNICIAN_ACCEPTED_SERVICE', 'TECHNICIAN_WORK_STARTED',
  'TECHNICIAN_UPLOADED_DEVICE_IMAGES', 'TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED', 'RE_ESTIMATED_CONFIRMED',
  'CUSTOMER_APPROVED', 'CUSTOMER_REJECTED', 'IN_REPAIR', 'PARTS_REQUIRED', 'QUALITY_CHECK_COMPLETED',
  'REPAIR_COMPLETED', 'READY', 'DELIVERED', 'CANCELLED',
];
const EVENT_INDEX = Object.fromEntries(CANONICAL_EVENT_ORDER.map((k, i) => [k, i]));
const EVENT_LABEL = {
  BOOKING_CREATED_BY_SHOP: 'Booking Created by Shop',
  SERVICE_ACCEPTED: 'Service Accepted',
  ASSIGNED_TO_TECHNICIAN: 'Assigned to Technician',
  AWAITING_TECHNICIAN_ACCEPTANCE: 'Awaiting Technician Acceptance',
  REASSIGNED_TO_TECHNICIAN: 'Re-Assigned to Technician',
  TECHNICIAN_ACCEPTED_SERVICE: 'Technician Accepted Service',
  TECHNICIAN_WORK_STARTED: 'Technician Work Started',
  TECHNICIAN_UPLOADED_DEVICE_IMAGES: 'Technician Uploaded Device Images',
  TECHNICIAN_COMPLIANCE_ISSUE_VERIFIED_UPDATED: 'Technician Compliance Issue Verified & Updated',
  RE_ESTIMATED_CONFIRMED: 'Re-Estimated Confirmed',
  CUSTOMER_APPROVED: 'Customer Approved',
  CUSTOMER_REJECTED: 'Customer Rejected',
  IN_REPAIR: 'Repair Work In Progress',
  PARTS_REQUIRED: 'Spare Parts Waiting',
  QUALITY_CHECK_COMPLETED: 'Quality Check Completed',
  REPAIR_COMPLETED: 'Repair Completed',
  READY: 'Repair Completed',
  DELIVERED: 'Repair Completed',
  CANCELLED: 'Work Cancelled',
};
const eventLabel = (k) => (k ? EVENT_LABEL[String(k).toUpperCase()] || String(k).toUpperCase().replace(/_/g, ' ') : null);

function pickLatestEventKey(events) {
  if (!Array.isArray(events) || events.length === 0) return null;
  let bestKey = null, bestIndex = -1, bestTime = -Infinity;
  for (const e of events) {
    const k = (e?.status || '').toUpperCase();
    if (!k) continue;
    const idx = EVENT_INDEX[k];
    const t = e.createdAt ? new Date(e.createdAt).getTime() : 0;
    if (idx == null) {
      if (bestIndex === -1 && t > bestTime) { bestKey = k; bestTime = t; }
      continue;
    }
    if (idx > bestIndex || (idx === bestIndex && t > bestTime)) { bestKey = k; bestIndex = idx; bestTime = t; }
  }
  return bestKey;
}

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const timeOf = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
function ticketRef(t) {
  if (t?.trackingId) return `#${t.trackingId}`;
  const digits = String(t?.id || '').replace(/[^0-9]/g, '').slice(0, 8);
  return `#CSPEN${digits || '——'}`;
}

function statusPill(t) {
  const s = (t?.status || '').toUpperCase();
  const bk = bucketize(s);
  if (s === 'QUOTED') return { label: 'Pending Approval', color: C.yellow };
  if (bk === 'PENDING') return { label: 'Pending', color: C.red };
  if (bk === 'IN_PROCESS') return { label: 'In Process', color: C.yellow };
  if (s === 'CANCELLED') return { label: 'Cancelled', color: C.muted };
  return { label: 'Completed', color: C.leaf };
}

const LAPTOP_RE = /(laptop|notebook|macbook|chromebook|thinkpad|ideapad|vivobook|zenbook|xps|inspiron|latitude|vostro|pavilion|elitebook|probook|envy|spectre|omen|aspire|swift|predator|nitro|rog|tuf|legion|yoga|surface\s*(laptop|book)|galaxy\s*book|matebook|gram)/i;
const isLaptop = (t) => LAPTOP_RE.test([t?.deviceDisplayName, t?.brandName, t?.modelName].filter(Boolean).join(' '));
const deviceName = (t) => t?.deviceDisplayName || [t?.brandName, t?.modelName].filter(Boolean).join(' ') || 'Device';
const modelOf = (t) => String(deviceName(t)).split(/[·•|]/).map((x) => x.trim()).filter(Boolean)[0] || 'Device';
const issueText = (t) => t?.issueDescription || t?.repairServicesSummary || t?.complianceNote || 'Issue not specified';
const byRecent = (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
const amountOf = (t) => Number(t?.finalPrice ?? t?.estimatedPrice ?? t?.estimatedTotal) || 0;
const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

const RAIL = [
  { key: 'All', label: 'All', tone: C.green, Icon: ChartColumn },
  { key: 'IN_PROCESS', label: 'In Process', tone: C.yellow, Icon: RefreshCw },
  { key: 'PENDING', label: 'Pending', tone: C.red, Icon: CircleAlert },
  { key: 'COMPLETED', label: 'Completed', tone: C.leaf, Icon: Check },
];

export default function JobReportClient() {
  const router = useRouter();
  const params = useSearchParams();
  const employeeId = params.get('employee') || params.get('employeeId') || '';
  const employeeName = params.get('name') || '';
  const allMode = !employeeId && !employeeName;

  const [list, setList] = useState([]);
  const [techNameById, setTechNameById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [eventStatusById, setEventStatusById] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tickets, techs] = await Promise.all([fetchTicketsPaged(), fetchTechnicians().catch(() => [])]);
      const mine = (tickets || []).filter((t) => (allMode
        ? !!t.assignedTechnicianId
        : (employeeId && t.assignedTechnicianId === employeeId) || (employeeName && t.assignedTechnicianName === employeeName)));
      setTechNameById(Object.fromEntries((techs || []).map((x) => [x.id, x.name])));
      setList(mine);
      setError(false);
      enrichWithCatalog(mine).then(setList).catch(() => {});
    } catch {
      setError(true);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [allMode, employeeId, employeeName]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { All: list.length, PENDING: 0, IN_PROCESS: 0, COMPLETED: 0 };
    list.forEach((b) => { c[bucketize(b.status)] += 1; });
    return c;
  }, [list]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...list].sort(byRecent)
      .filter((t) => filter === 'All' || bucketize(t.status) === filter)
      .filter((t) => !q || [ticketRef(t), deviceName(t), t.customerName, t.customerPhone, issueText(t), techNameById[t.assignedTechnicianId]]
        .some((v) => v && String(v).toLowerCase().includes(q)));
  }, [list, filter, query, techNameById]);

  const displayedKey = useMemo(() => shown.slice(0, 30).map((t) => t.id).filter(Boolean).join('|'), [shown]);
  useEffect(() => {
    const ids = displayedKey ? displayedKey.split('|') : [];
    if (!ids.length) return undefined;
    let active = true;
    (async () => {
      const updates = {};
      await Promise.all(ids.map(async (id) => {
        try {
          const key = pickLatestEventKey(await shopRequest(TICKET_BASE(), `/tickets/${encodeURIComponent(id)}/events`));
          if (key) updates[id] = key;
        } catch { /* macro status fallback */ }
      }));
      if (active && Object.keys(updates).length) setEventStatusById((prev) => ({ ...prev, ...updates }));
    })();
    return () => { active = false; };
  }, [displayedKey]);

  const subtitle = allMode ? 'Working Jobs' : (employeeName || techNameById[employeeId] || 'Technician');
  const filterLabel = RAIL.find((r) => r.key === filter)?.label || 'All';

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6] hover:bg-gray-200">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="truncate text-[17px] font-extrabold text-[#111]">{allMode ? 'Job Report' : 'Job Record'}</h1>
            <p className="truncate text-[11px] font-bold text-gray-500">{subtitle} · {shown.length} {shown.length === 1 ? 'job' : 'jobs'}</p>
          </div>
          <div className="hidden w-80 md:block">
            <SearchInput value={query} onChange={setQuery} allMode={allMode} />
          </div>
          <button
            type="button"
            onClick={() => { if (searchOpen) setQuery(''); setSearchOpen((v) => !v); }}
            aria-label={searchOpen ? 'Close search' : 'Search jobs'}
            className={`flex h-9 w-9 items-center justify-center rounded-full md:hidden ${searchOpen ? 'bg-[#035C6C] text-white' : 'bg-[#E5F3F5] text-[#035C6C]'}`}
          >
            <Search size={16} />
          </button>
        </div>
        {searchOpen || query ? (
          <div className="px-4 pb-3 md:hidden"><SearchInput value={query} onChange={setQuery} allMode={allMode} autoFocus /></div>
        ) : null}
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        <nav className="sticky top-[61px] h-[calc(100vh-61px)] w-[78px] shrink-0 overflow-y-auto border-r border-gray-200 bg-white px-1.5 py-1.5 sm:w-[104px] lg:w-[120px]" aria-label="Job status">
          {RAIL.map(({ key, label, tone, Icon }) => {
            const active = filter === key;
            const n = counts[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(key)}
                className="my-1 flex w-full flex-col items-center rounded-[14px] px-1 py-2.5 transition hover:shadow"
                style={{ background: `linear-gradient(#fff, ${tone}${active ? '24' : '10'})`, border: `${active ? 1.5 : 1}px solid ${active ? tone : `${tone}22`}` }}
              >
                <span className="relative">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: tone }}>
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border bg-white px-1 text-[10px] font-extrabold" style={{ borderColor: tone, color: tone }}>
                    {n > 99 ? '99+' : n}
                  </span>
                </span>
                <span className={`mt-1.5 text-center text-[11px] leading-tight ${active ? 'font-extrabold' : 'font-bold'}`} style={{ color: tone }}>{label}</span>
              </button>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 p-2.5 sm:p-4">
          {loading && list.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-xs text-gray-500">
              <RefreshCw size={18} className="animate-spin text-[#035C6C]" /> Loading jobs…
            </div>
          ) : error && list.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-4 py-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F32C26] text-white"><WifiOff size={20} /></span>
              <p className="text-sm font-extrabold">Couldn&apos;t load jobs</p>
              <p className="text-xs text-gray-500">Check your connection and try again.</p>
              <button type="button" onClick={load} className="mt-1.5 rounded-full bg-[#035C6C] px-5 py-2 text-xs font-bold text-white">Retry</button>
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-xs text-gray-500">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#035C6C] text-white"><Inbox size={20} /></span>
              {query.trim() ? `No jobs match "${query.trim()}".` : filter === 'All' ? 'No jobs yet.' : `No ${filterLabel.toLowerCase()} jobs.`}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {shown.map((t) => (
                <ReportTile
                  key={t.id}
                  ticket={t}
                  phase={eventLabel(eventStatusById[t.id]) || statusLabel(t.status)}
                  technician={allMode ? (techNameById[t.assignedTechnicianId] || t.assignedTechnicianName || 'Technician') : null}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SearchInput({ value, onChange, allMode, autoFocus }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-[#F3F4F6] px-3 py-2">
      <Search size={15} className="text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        placeholder={allMode ? 'Search job, device, customer, technician' : 'Search job, device, customer'}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      {value ? <button type="button" aria-label="Clear search" onClick={() => onChange('')}><X size={15} className="text-gray-500" /></button> : null}
    </div>
  );
}

function DeviceImage({ ticket }) {
  const src = resolveMediaUrl(ticket.deviceImageUrl || ticket.modelImageUrl);
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="h-[76%] w-[76%] object-contain" onError={() => setFailed(true)} />;
  }
  const laptop = isLaptop(ticket);
  const DevIcon = laptop ? Laptop : Smartphone;
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ background: laptop ? C.blue : C.green }}>
      <DevIcon size={26} strokeWidth={2.1} />
    </span>
  );
}

function ReportTile({ ticket, phase, technician }) {
  const pill = statusPill(ticket);
  const done = pill.label === 'Completed' || pill.label === 'Cancelled';
  const when = done ? (ticket.updatedAt || ticket.createdAt) : ticket.createdAt;
  const amount = amountOf(ticket);
  const bookingId = ticket.repairBookingId || ticket.bookingId || ticket.id;
  const href = `/shop-home/services/bookings/view/details/?id=${encodeURIComponent(bookingId)}`;
  const historyHref = `/shop-home/services/bookings/view/?id=${encodeURIComponent(bookingId)}`;
  return (
    <div className="flex overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:shadow-md">
      <Link href={href} className="relative flex w-[116px] shrink-0 items-center justify-center border-r border-gray-200 sm:w-[140px]" aria-label={`${modelOf(ticket)}, ${ticketRef(ticket)}, ${pill.label}`}>
        <DeviceImage ticket={ticket} />
        <span className="absolute left-0 top-0 max-w-[78%] truncate rounded-br-xl px-2 py-1 text-[10px] font-extrabold text-white" style={{ background: pill.color }}>{pill.label}</span>
        <span className="absolute bottom-1.5 right-1.5 rounded-[10px] border-[1.5px] border-[#035C6C] bg-white px-2.5 py-0.5 text-[11px] font-extrabold text-[#035C6C]">VIEW</span>
      </Link>
      <div className="min-w-0 flex-1 px-3 pb-2.5">
        <Link href={href} className="block">
          <div className="mt-2 flex items-center gap-2">
            <span className="flex-1 truncate text-[11px] font-extrabold text-[#035C6C]">{ticketRef(ticket)}</span>
            {amount > 0 ? <span className="rounded-lg bg-[#035C6C] px-2 py-0.5 text-[13px] font-extrabold text-white">{inr(amount)}</span> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs font-extrabold leading-4 text-[#111]">{modelOf(ticket)}</p>
          <p className="mt-0.5 truncate text-xs text-gray-500">{ticket.customerName || '-'}</p>
          {technician ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500"><UserCog size={11} className="shrink-0" /><span className="truncate">{technician}</span></p>
          ) : null}
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500"><Wrench size={11} className="shrink-0" /><span className="truncate">{issueText(ticket)}</span></p>
          <p className="mt-0.5 text-[11px] text-gray-500">{formatDate(when)}{timeOf(when) ? `  ${timeOf(when)}` : ''}</p>
        </Link>
        <Link href={historyHref} className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-lg bg-[#E5F3F5] px-1.5 py-0.5 text-[11px] font-bold text-[#035C6C]" aria-label={`Status: ${phase}. View history`}>
          <Clock size={11} className="shrink-0" /><span className="truncate">{phase}</span><ChevronRight size={12} className="shrink-0" />
        </Link>
      </div>
    </div>
  );
}
