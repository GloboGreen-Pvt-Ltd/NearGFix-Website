'use client';

/**
 * Leave / Permission requests board — web port of the Partner app's
 * OwnerLeaveRequestsScreen (Dashboard → Leave, and → Permissions with
 * kind PERMISSION). Permission requests are leave rows with leaveType
 * PERMISSION; each list leaves out the other's rows, as in the app.
 *
 * Data (ticket-service, same calls as the app):
 *   - GET   /technicians/leaves/pending, /technicians/leaves?status=APPROVED|REJECTED
 *   - PATCH /technicians/{technicianId}/leaves/{leaveId}  { status }
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CalendarDays, CircleCheck, CircleX, ClipboardList, Clock, FileText,
  RefreshCw, Search, User, WifiOff, X,
} from 'lucide-react';

import { TICKET_BASE } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';
import { notifyError } from '@/lib/toast';

const RC = { teal: '#035C6C', orange: '#FAA700', green: '#609138', red: '#F32C26' };
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const STATUS_META = {
  ALL: { label: 'All', tone: RC.teal, Icon: ClipboardList },
  PENDING: { label: 'Pending', tone: RC.orange, Icon: Clock },
  APPROVED: { label: 'Approved', tone: RC.green, Icon: CircleCheck },
  REJECTED: { label: 'Rejected', tone: RC.red, Icon: CircleX },
};
const RAIL_KEYS = ['ALL', ...STATUSES];
const endpointFor = (st) => (st === 'PENDING' ? '/technicians/leaves/pending' : `/technicians/leaves?status=${st}`);

const AVATAR_TONES = ['#035C6C', '#0788C9', '#609138', '#FAA700', '#1C3053', '#F32C26'];
function toneFor(key) {
  const str = String(key || '');
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const dateRange = (l) => (!l.endDate || l.endDate === l.startDate ? formatDate(l.startDate) : `${formatDate(l.startDate)} – ${formatDate(l.endDate)}`);
const typeLabel = (t) => (t ? String(t).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : null);
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const KINDS = {
  LEAVE: { title: 'Leave Requests', noun: 'leave requests', emptyPending: 'New leave requests from your team will appear here.' },
  PERMISSION: { title: 'Permission Requests', noun: 'permission requests', emptyPending: 'New permission requests from your team will appear here.' },
};
const isPermission = (l) => String(l?.leaveType || '').toUpperCase() === 'PERMISSION';

export default function LeaveRequestsBoard({ kind = 'LEAVE' }) {
  const copy = KINDS[kind] || KINDS.LEAVE;
  const router = useRouter();
  const [lists, setLists] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [status, setStatus] = useState('ALL');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(STATUSES.map((st) => shopRequest(TICKET_BASE(), endpointFor(st))
        .then((res) => ({ st, rows: (Array.isArray(res) ? res : []).filter((l) => isPermission(l) === (kind === 'PERMISSION')) }))
        .catch((e) => ({ st, rows: [], err: e || {} }))));
      const next = {};
      results.forEach((r) => { next[r.st] = r.rows; });
      setLists(next);
      const failed = results.find((r) => r.err);
      if (failed) setError(failed.err.message || `Failed to load ${copy.title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [kind, copy]);

  useEffect(() => { load(); }, [load]);

  const respond = async (item, decision) => {
    setActionId(item.id);
    try {
      await shopRequest(TICKET_BASE(), `/technicians/${encodeURIComponent(item.technicianId)}/leaves/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: decision }),
      });
      load();
    } catch (e) {
      notifyError(e, `Failed to ${decision.toLowerCase()}`);
    } finally {
      setActionId(null);
    }
  };

  const entries = useMemo(
    () => STATUSES.flatMap((st) => (lists[st] || []).map((item) => ({ id: `${st}:${item.id}`, st, item }))),
    [lists],
  );
  const counts = useMemo(() => {
    const c = { ALL: entries.length };
    STATUSES.forEach((st) => { c[st] = (lists[st] || []).length; });
    return c;
  }, [entries, lists]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => (status === 'ALL' || e.st === status)
      && (!q || [e.item.technicianName, e.item.reason].some((v) => v && String(v).toLowerCase().includes(q))));
  }, [entries, status, query]);

  const q = query.trim();
  const activeMeta = STATUS_META[status];
  const emptyText = q
    ? `No ${copy.noun} match "${q}".`
    : status === 'PENDING' ? copy.emptyPending
      : status === 'ALL' ? `No ${copy.noun} to show.`
        : `No ${activeMeta.label.toLowerCase()} ${copy.noun} to show.`;

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3F4F6] hover:bg-gray-200">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="truncate text-[17px] font-extrabold text-[#111]">{copy.title}</h1>
            <p className="truncate text-[11px] font-bold text-gray-500">{loading && entries.length === 0 ? 'All employees' : `All employees · ${counts.PENDING} pending`}</p>
          </div>
          <div className="hidden w-80 md:block">
            <SearchInput value={query} onChange={setQuery} />
          </div>
          <button
            type="button"
            onClick={() => { if (searchOpen) setQuery(''); setSearchOpen((v) => !v); }}
            aria-label={searchOpen ? 'Close search' : 'Search requests'}
            className={`flex h-9 w-9 items-center justify-center rounded-full md:hidden ${searchOpen ? 'bg-[#035C6C] text-white' : 'bg-[#E5F3F5] text-[#035C6C]'}`}
          >
            <Search size={16} />
          </button>
        </div>
        {searchOpen || query ? (
          <div className="px-4 pb-3 md:hidden"><SearchInput value={query} onChange={setQuery} autoFocus /></div>
        ) : null}
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        <nav className="sticky top-[61px] h-[calc(100vh-61px)] w-[78px] shrink-0 overflow-y-auto border-r border-gray-200 bg-white px-1.5 py-1.5 sm:w-[104px] lg:w-[120px]" aria-label="Request status">
          {RAIL_KEYS.map((key) => {
            const { label, tone, Icon } = STATUS_META[key];
            const active = status === key;
            const n = counts[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatus(key)}
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
          {error && shown.length > 0 ? (
            <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-[#F9C5C3] bg-[#FDEBEA] px-3 py-2">
              <p className="min-w-0 flex-1 text-[11.5px] font-semibold text-[#F32C26]">{error}</p>
              <button type="button" onClick={load} className="text-xs font-extrabold text-[#035C6C]">Retry</button>
            </div>
          ) : null}
          {loading && entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-xs text-gray-500">
              <RefreshCw size={18} className="animate-spin text-[#035C6C]" /> Loading {copy.title.toLowerCase()}…
            </div>
          ) : error && shown.length === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-4 py-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F32C26] text-white"><WifiOff size={20} /></span>
              <p className="text-sm font-extrabold">Couldn&apos;t load {copy.noun}</p>
              <p className="text-xs text-gray-500">{error}</p>
              <button type="button" onClick={load} className="mt-1.5 rounded-full bg-[#035C6C] px-5 py-2 text-xs font-bold text-white">Retry</button>
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-xs text-gray-500">
              <span className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ background: activeMeta.tone }}><activeMeta.Icon size={20} /></span>
              {emptyText}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {shown.map((e) => (
                <RequestTile key={e.id} entry={e} kind={kind} actionId={actionId} onRespond={respond} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SearchInput({ value, onChange, autoFocus }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-[#F3F4F6] px-3 py-2">
      <Search size={15} className="text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Search employee or reason"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      {value ? <button type="button" aria-label="Clear search" onClick={() => onChange('')}><X size={15} className="text-gray-500" /></button> : null}
    </div>
  );
}

function RequestTile({ entry, kind, actionId, onRespond }) {
  const { item, st } = entry;
  const meta = STATUS_META[st];
  const name = item.technicianName ?? 'Employee';
  const ini = initials(item.technicianName);
  const acting = actionId === item.id;
  const busy = actionId != null;
  // A permission is part of a day — its window is in the reason.
  const showDays = item.appliedDaysLabel && kind !== 'PERMISSION';
  const type = kind === 'LEAVE' ? typeLabel(item.leaveType) : null;
  return (
    <div className="flex overflow-hidden rounded-2xl border border-gray-200 bg-white" aria-label={`${name}, ${dateRange(item)}, ${meta.label}`}>
      <div className="relative flex w-[92px] shrink-0 items-center justify-center border-r border-gray-200 sm:w-[110px]">
        <span className="flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-extrabold text-white" style={{ background: toneFor(item.technicianId || name) }}>
          {ini || <User size={24} />}
        </span>
        <span className="absolute left-0 top-0 max-w-[90%] truncate rounded-br-xl px-2 py-1 text-[10px] font-extrabold text-white" style={{ background: meta.tone }}>{meta.label}</span>
      </div>
      <div className="min-w-0 flex-1 px-3 pb-2.5">
        <p className="mt-2 line-clamp-2 text-[11px] font-extrabold text-[#035C6C]">{dateRange(item)}</p>
        <Link href={`/shop-home/employee/leave/view/?id=${encodeURIComponent(item.technicianId || '')}`} className="mt-1 line-clamp-2 text-xs font-extrabold leading-4 text-[#111] hover:underline">{name}</Link>
        {type ? <p className="mt-0.5 truncate text-xs text-gray-500">{type}</p> : null}
        {item.reason ? (
          <p className="mt-0.5 flex items-start gap-1 text-[11px] text-gray-500"><FileText size={11} className="mt-0.5 shrink-0" /><span className="line-clamp-3 break-words">{item.reason}</span></p>
        ) : null}
        {showDays ? (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500"><Clock size={11} className="shrink-0" /><span className="truncate">{item.appliedDaysLabel}</span></p>
        ) : null}
        {item.requestedAt ? (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500"><CalendarDays size={11} className="shrink-0" /><span className="truncate">Requested {formatDate(item.requestedAt)}</span></p>
        ) : null}
        {st === 'PENDING' ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onRespond(item, 'APPROVED')}
              disabled={busy}
              aria-label={`Approve ${name}`}
              className={`flex min-h-[34px] min-w-[84px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#035C6C] px-2 text-xs font-extrabold text-white hover:bg-[#024A57] ${busy && !acting ? 'opacity-60' : ''}`}
            >
              {acting ? <RefreshCw size={14} className="animate-spin" /> : <CircleCheck size={14} />} Approve
            </button>
            <button
              type="button"
              onClick={() => onRespond(item, 'REJECTED')}
              disabled={busy}
              aria-label={`Reject ${name}`}
              className={`flex min-h-[34px] min-w-[84px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#F9C5C3] bg-[#FDEBEA] px-2 text-xs font-extrabold text-[#F32C26] ${busy && !acting ? 'opacity-60' : ''}`}
            >
              <CircleX size={14} /> Reject
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
