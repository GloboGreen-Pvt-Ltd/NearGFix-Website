'use client';

/**
 * /shop-home/employee/leave/view/?id=<employeeId> — one employee's "Leave
 * details", as in the Partner app: This Month (month switcher + Leave /
 * Processing / Rejected / Approved totals), Apply for leave, Recent Leave
 * and Previous Leave (All / Approved / Processing / Rejected).
 *
 * Data (ticket-service, helpers in src/lib/shopDashboard.js):
 *   - GET  /technicians/{id}/leaves?month&year  — this month's totals
 *   - GET  /technicians/{id}/leaves             — every request (lists)
 *   - POST /technicians/{id}/leaves             — Apply for leave
 *   - PATCH …/leaves/{leaveId}/approve|reject   — Approve / Reject on a
 *     pending (Processing) request
 * The backend's PENDING status is shown as "Processing", as in the app.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Hourglass, Inbox, Loader2, Plus, X, XCircle } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { MONTHS, shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { createTechnicianLeave, decideLeave, fetchTechnician, fetchTechnicianLeaves } from '@/lib/shopDashboard';
import { notifyError, notifySuccess } from '@/lib/toast';

const DARK = '#035C6C';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
const LEAVE_TYPES = [
  { value: 'CASUAL_LEAVE', label: 'Casual Leave' },
  { value: 'SICK_LEAVE', label: 'Sick Leave' },
  { value: 'EMERGENCY_LEAVE', label: 'Emergency Leave' },
  { value: 'PERMISSION', label: 'Permission' },
  { value: 'HALF_DAY', label: 'Half Day' },
  { value: 'OTHER', label: 'Other' },
];
const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PENDING', label: 'Processing' },
  { key: 'REJECTED', label: 'Rejected' },
];
const STATUS_STYLE = {
  PENDING: { label: 'Processing', cls: 'bg-[#FFF8E1] text-[#B45309]' },
  APPROVED: { label: 'Approved', cls: 'bg-[#E5F3F5] text-[#035C6C]' },
  REJECTED: { label: 'Rejected', cls: 'bg-[#FEF2F2] text-[#C81E1E]' },
};

const pad2 = (n) => String(Number(n) || 0).padStart(2, '0');
const upper = (v) => String(v || '').toUpperCase();
const typeLabel = (t) => LEAVE_TYPES.find((x) => x.value === upper(t))?.label || String(t || 'Leave').replace(/_/g, ' ');
const fmtDate = (v) => {
  const d = v ? new Date(`${String(v).slice(0, 10)}T00:00:00`) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
};
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const newest = (a, b) => new Date(b.requestedAt || b.startDate || 0) - new Date(a.requestedAt || a.startDate || 0);

function SummaryTile({ icon: Icon, label, value, tone }) {
  const t = {
    green: 'bg-[#E5F3F5] text-[#035C6C]',
    yellow: 'bg-[#FFFAEB] text-[#C2410C]',
    red: 'bg-[#FEF2F2] text-[#C81E1E]',
  }[tone];
  return (
    <div className={cx('min-w-0 rounded-2xl p-3 sm:p-4', t)}>
      <p className="flex min-w-0 items-center gap-2 text-[14px] font-bold sm:text-[15px]">
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-2 text-[28px] font-extrabold leading-none text-[#111111]">{value}</p>
      <p className="mt-1.5 text-[13.5px] text-[#667085]">Total</p>
    </div>
  );
}

function LeaveCard({ leave, onDecide, deciding }) {
  const st = STATUS_STYLE[upper(leave.status)] || { label: leave.status || '—', cls: 'bg-[#F3F3F3] text-[#667085]' };
  const range = leave.endDate && leave.endDate !== leave.startDate ? `${fmtDate(leave.startDate)} – ${fmtDate(leave.endDate)}` : fmtDate(leave.startDate);
  const days = leave.appliedDaysLabel || (leave.totalDays ? `${leave.totalDays} day${Number(leave.totalDays) === 1 ? '' : 's'}` : '');
  return (
    <li className="rounded-2xl border border-[#C7E6EA] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[16px] font-extrabold text-[#111111]">{typeLabel(leave.leaveType)}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-[#667085]">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {range}
            {days ? ` · ${days}` : ''}
          </p>
        </div>
        <span className={cx('rounded-full px-3 py-1 text-[12px] font-bold', st.cls)}>{st.label}</span>
      </div>
      {leave.reason ? <p className="mt-2 break-words text-[13.5px] text-[#344054]">{leave.reason}</p> : null}
      {upper(leave.status) === 'REJECTED' && leave.rejectionReason ? (
        <p className="mt-1 text-[12.5px] text-[#C81E1E]">Reason: {leave.rejectionReason}</p>
      ) : null}
      {upper(leave.status) === 'PENDING' && onDecide ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onDecide(leave, true)}
            disabled={deciding}
            className={cx('inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold text-white transition disabled:opacity-60', FOCUS_RING)}
            style={{ backgroundColor: DARK }}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Approve
          </button>
          <button
            type="button"
            onClick={() => onDecide(leave, false)}
            disabled={deciding}
            className={cx('inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#FDA29B] bg-white px-3.5 text-[13px] font-bold text-[#C81E1E] transition hover:bg-[#FEF2F2] disabled:opacity-60', FOCUS_RING)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Reject
          </button>
        </div>
      ) : null}
    </li>
  );
}

function EmptyBox({ icon: Icon, title, text }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[#C7E6EA] bg-[#E5F3F5] px-4 py-10 text-center">
      <Icon className="h-10 w-10" style={{ color: DARK }} aria-hidden="true" />
      <p className="mt-3 text-[17px] font-extrabold text-[#111111]">{title}</p>
      <p className="mt-1 text-[14px] text-[#667085]">{text}</p>
    </div>
  );
}

function ApplyLeaveModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({ leaveType: 'CASUAL_LEAVE', startDate: todayIso(), endDate: todayIso(), reason: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (open) {
      setForm({ leaveType: 'CASUAL_LEAVE', startDate: todayIso(), endDate: todayIso(), reason: '' });
      setErr('');
    }
  }, [open]);
  if (!open) return null;

  const single = ['HALF_DAY', 'PERMISSION'].includes(form.leaveType);
  const end = single ? form.startDate : form.endDate;
  const span = form.startDate && end ? Math.round((new Date(end) - new Date(form.startDate)) / 86400000) + 1 : 0;
  const totalDays = form.leaveType === 'HALF_DAY' ? 0.5 : span;

  async function submit() {
    if (!form.startDate || !end || span < 1) {
      setErr('Pick a valid start and end date.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await onSubmit({ leaveType: form.leaveType, startDate: form.startDate, endDate: end, totalDays, reason: form.reason.trim() || null });
      onClose();
    } catch (e) {
      setErr(e?.message || 'Could not apply for leave.');
    } finally {
      setSaving(false);
    }
  }

  const input = 'mt-1.5 w-full min-w-0 rounded-xl border border-[#ECECEC] bg-white px-3 py-2.5 text-[14px] text-[#111111] focus:border-[#035C6C] focus:outline-none';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111111]/60 p-4" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Apply for leave" onClick={(e) => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-[22px] bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-[18px] font-extrabold text-[#111111]">Apply for leave</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <label className="mt-4 block text-[12.5px] font-bold text-[#667085]">
          Leave type
          <select value={form.leaveType} onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))} className={input}>
            {LEAVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <div className={cx('mt-3 grid gap-3', single ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
          <label className="block text-[12.5px] font-bold text-[#667085]">
            {single ? 'Date' : 'From'}
            <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate }))} className={input} />
          </label>
          {single ? null : (
            <label className="block text-[12.5px] font-bold text-[#667085]">
              To
              <input type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className={input} />
            </label>
          )}
        </div>
        <p className="mt-2 text-[12.5px] font-semibold" style={{ color: DARK }}>
          {totalDays > 0 ? `${totalDays} day${totalDays === 1 ? '' : 's'}` : ''}
        </p>
        <label className="mt-2 block text-[12.5px] font-bold text-[#667085]">
          Reason
          <textarea rows={3} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Optional" className={input} />
        </label>
        {err ? <p className="mt-2 text-[13px] font-semibold text-[#C81E1E]">{err}</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: DARK }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {saving ? 'Submitting…' : 'Submit request'}
        </button>
      </div>
    </div>
  );
}

export default function EmployeeLeavePage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [name, setName] = useState('');
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [monthRows, setMonthRows] = useState(null);
  const [allRows, setAllRows] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [applyOpen, setApplyOpen] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

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
    setAllRows(null);
    fetchTechnicianLeaves(id)
      .then((rows) => alive && setAllRows(rows))
      .catch(() => alive && setAllRows([]));
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setMonthRows(null);
    fetchTechnicianLeaves(id, { month: viewDate.getMonth() + 1, year: viewDate.getFullYear() })
      .then((rows) => alive && setMonthRows(rows))
      .catch(() => alive && setMonthRows([]));
    return () => {
      alive = false;
    };
  }, [id, viewDate, reloadKey]);

  const count = (st) => (monthRows ? pad2(monthRows.filter((r) => upper(r.status) === st).length) : '…');
  const sorted = useMemo(() => [...(allRows || [])].sort(newest), [allRows]);
  const recent = sorted.slice(0, 3);
  const previous = useMemo(() => (filter === 'ALL' ? sorted : sorted.filter((r) => upper(r.status) === filter)), [sorted, filter]);

  async function apply(body) {
    await createTechnicianLeave(id, body);
    notifySuccess('Leave request submitted');
    reload();
  }

  async function decide(leave, approve) {
    let rejectionReason = null;
    if (!approve) {
      rejectionReason = window.prompt('Reason for rejecting this leave? (optional)') ?? null;
      if (rejectionReason === null) return;
    }
    setDeciding(true);
    try {
      await decideLeave(id, leave.id, approve, { rejectionReason });
      notifySuccess(approve ? 'Leave approved' : 'Leave rejected');
      reload();
    } catch (e) {
      notifyError(e, 'Could not update this leave request.');
    } finally {
      setDeciding(false);
    }
  }

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
          <h1 className="text-[20px] font-extrabold text-[#111111]">Leave details</h1>
          {name ? <p className="break-words text-[12.5px] font-semibold text-[#666666]">{name}</p> : null}
        </div>
      </div>

      <section className="rounded-[24px] border border-[#ECECEC] bg-white p-5 shadow-[0_4px_14px_rgba(16,24,40,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[18px] font-extrabold text-[#111111]">This Month</h2>
          <div className="flex items-center gap-1 rounded-full px-4 py-2 text-white" style={{ backgroundColor: DARK }}>
            <span className="pr-2 text-[15px] font-bold">
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
          <SummaryTile icon={CalendarDays} label="Leave" value={monthRows ? pad2(monthRows.length) : '…'} tone="green" />
          <SummaryTile icon={Hourglass} label="Processing" value={count('PENDING')} tone="yellow" />
          <SummaryTile icon={XCircle} label="Rejected" value={count('REJECTED')} tone="red" />
          <SummaryTile icon={CheckCircle2} label="Approved" value={count('APPROVED')} tone="green" />
        </div>
      </section>

      <button
        type="button"
        onClick={() => setApplyOpen(true)}
        className={cx('inline-flex h-14 w-full items-center justify-center gap-3 rounded-[20px] text-[17px] font-extrabold text-white transition hover:opacity-95', FOCUS_RING)}
        style={{ backgroundColor: DARK }}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        Apply for leave
      </button>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-extrabold text-[#111111]">Recent Leave</h2>
          <a href="#previous-leave" className="text-[15px] font-extrabold" style={{ color: DARK }}>
            View all
          </a>
        </div>
        {allRows === null ? (
          <div className="h-28 animate-pulse rounded-2xl bg-[#F3F3F3]" />
        ) : recent.length ? (
          <ul className="space-y-2.5">
            {recent.map((l) => (
              <LeaveCard key={l.id} leave={l} onDecide={decide} deciding={deciding} />
            ))}
          </ul>
        ) : (
          <EmptyBox icon={Inbox} title="No recent leave." text="You're all caught up!" />
        )}
      </section>

      <section id="previous-leave" className="scroll-mt-4">
        <h2 className="mb-3 text-[18px] font-extrabold text-[#111111]">Previous Leave</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cx(
                'rounded-full border px-5 py-2 text-[14.5px] font-bold transition',
                FOCUS_RING,
                filter === f.key ? 'border-transparent text-white' : 'border-[#C7E6EA] bg-white text-[#475467] hover:border-[#035C6C]',
              )}
              style={filter === f.key ? { backgroundColor: DARK } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>
        {allRows === null ? (
          <div className="h-28 animate-pulse rounded-2xl bg-[#F3F3F3]" />
        ) : previous.length ? (
          <ul className="space-y-2.5">
            {previous.map((l) => (
              <LeaveCard key={l.id} leave={l} onDecide={decide} deciding={deciding} />
            ))}
          </ul>
        ) : (
          <EmptyBox icon={CalendarDays} title="No previous leave requests." text={filter === 'ALL' ? "Looks like there aren't any requests yet." : 'Nothing with this status.'} />
        )}
      </section>

      <ApplyLeaveModal open={applyOpen} onClose={() => setApplyOpen(false)} onSubmit={apply} />
    </div>
  );
}
