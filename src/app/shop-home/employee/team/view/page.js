'use client';

/**
 * /shop-home/employee/team/view/?id=… — Employee Details for one technician /
 * pickup person, opened from the Employee Management roster. Laid out like
 * the Partner app's Employee Details screen, with live data from the
 * ticket-service TechnicianController (helpers in src/lib/shopDashboard.js):
 *
 *   - Profile, Check In / Check Out, info card
 *       GET /technicians/{id} — name, roleLabel, isAvailable, phone, email,
 *       photoUrl, defaultCheckIn / defaultCheckOut, dateOfJoin, userId (a
 *       linked user = Staff App Login enabled). Falls back to the roster
 *       list (GET /technicians) if the single read fails.
 *   - This Month (month switcher)
 *       GET /technicians/{id}/attendance?month&year — presentDays,
 *       leaveDays, permissionCount, lateHours.
 *   - Recent Salary Advance   GET /technicians/{id}/advances (latest 3)
 *   - Recent Leave Request    GET /technicians/{id}/leaves (latest 3, not PERMISSION)
 *   - Recent Permission       same list, leaveType PERMISSION (latest 3)
 *
 * Quick Access is role-based (Technician: Task Report; Pickup Person:
 * Pickup Report; other staff: neither); Daily Shift Schedule, Monthly
 * Summary and the Task / Pickup reports open for this employee, as do Leave
 * Report, Salary Report and Edit Profile.
 * Department isn't stored on the record; like the app it reads "Pickup" for
 * pickup staff and "Service" for everyone else.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Hand,
  Inbox,
  Laptop,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  PencilLine,
  Smartphone,
  Sun,
  SunDim,
  Truck,
  User,
  Wallet,
  Wrench,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import { MONTHS, shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import {
  fetchTechnician,
  fetchTechnicianAdvances,
  fetchTechnicianAttendance,
  fetchTechnicianLeaves,
  fetchTechnicians,
} from '@/lib/shopDashboard';
import { resolveMediaUrl } from '@/lib/deviceImage';

const DASH = '—';
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
const CARD = 'rounded-[22px] border border-[#ECECEC] bg-white';

const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
/** "09:30:00" / "09:30" / ISO -> "09:30". */
function hhmm(value) {
  if (!value) return DASH;
  const m = String(value).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : DASH;
}
const pad2 = (n) => String(Number(n) || 0).padStart(2, '0');
const fmtDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : DASH;
};
const money = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
const humanize = (s) =>
  String(s || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

const STATUS_TONE = {
  APPROVED: 'bg-[#E5F3F5] text-[#024A57]',
  PAID: 'bg-[#E5F3F5] text-[#024A57]',
  PENDING: 'bg-[#FFF6E0] text-[#B54708]',
  REJECTED: 'bg-[#FEF2F2] text-[#B42318]',
  CANCELLED: 'bg-[#F3F3F3] text-[#667085]',
};

function Avatar({ url, active }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="relative shrink-0">
      <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#E5F3F5] text-[#035C6C]">
        {url && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- employee photo from the media service.
          <img src={url} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        ) : (
          <User className="h-11 w-11" fill="currentColor" aria-hidden="true" />
        )}
      </span>
      <span className={cx('absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border-[3px] border-white', active ? 'bg-[#035C6C]' : 'bg-[#98A2B3]')} aria-hidden="true" />
    </span>
  );
}

function TimeCard({ icon: Icon, label, value, tone }) {
  const t = tone === 'red' ? { chip: 'bg-[#FFF6DB] text-[#F5B000]', value: 'text-[#E53935]' } : { chip: 'bg-[#E5F3F5] text-[#035C6C]', value: 'text-[#035C6C]' };
  return (
    <div className={cx(CARD, 'flex min-w-0 flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:gap-4')}>
      <span className={cx('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', t.chip)}>
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-[#667085]">{label}</p>
        <p className={cx('text-[20px] font-extrabold leading-tight sm:text-[24px]', t.value)}>{value}</p>
      </div>
    </div>
  );
}

function QuickTile({ icon: Icon, label, href, disabled, title }) {
  const inner = (
    <>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C]">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="text-[13.5px] font-bold leading-snug text-[#111111]">{label}</span>
    </>
  );
  const cls = 'flex min-w-0 flex-col items-center gap-2.5 break-words rounded-[20px] border border-[#ECECEC] bg-white px-2 py-5 text-center transition';
  if (disabled || !href) {
    return (
      <span title={title} className={cx(cls, 'cursor-not-allowed opacity-60')}>
        {inner}
      </span>
    );
  }
  return (
    <Link href={href} className={cx(cls, 'hover:border-[#035C6C] hover:shadow-sm', FOCUS_RING)}>
      {inner}
    </Link>
  );
}

function StatTile({ icon: Icon, value, label, tone }) {
  const bg = tone === 'yellow' ? 'bg-[#FFF8E1]' : 'bg-[#E5F3F5]';
  const ic = tone === 'yellow' ? 'text-[#F5B000]' : 'text-[#035C6C]';
  return (
    <div className={cx('rounded-2xl p-3.5', bg)}>
      <Icon className={cx('h-5 w-5', ic)} aria-hidden="true" />
      <p className="mt-2.5 text-[22px] font-extrabold leading-none text-[#111111]">{value}</p>
      <p className="mt-1.5 text-[13px] text-[#667085]">{label}</p>
    </div>
  );
}

function EmptyRow({ icon: Icon, title, text }) {
  return (
    <div className={cx(CARD, 'flex items-center gap-4 p-4')}>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C]">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 text-center">
        <p className="text-[16px] font-extrabold text-[#111111]">{title}</p>
        <p className="text-[13.5px] text-[#667085]">{text}</p>
      </div>
    </div>
  );
}

function InfoCell({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E5F3F5] text-[#035C6C]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] text-[#667085]">{label}</p>
        <p className="truncate text-[16px] font-bold text-[#111111]">{value || DASH}</p>
      </div>
    </div>
  );
}

export default function EmployeeDetailsPage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [tech, setTech] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [advances, setAdvances] = useState([]);
  const [leaves, setLeaves] = useState([]);

  // Employee record (single read, roster list as a fallback) + advances + leaves.
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    fetchTechnician(id)
      .catch(() => fetchTechnicians().then((rows) => rows.find((t) => String(t.id) === String(id)) || null))
      .then((t) => alive && setTech(t || null))
      .catch((err) => alive && setError(err.message || 'Could not load this employee.'))
      .finally(() => alive && setLoading(false));
    fetchTechnicianAdvances(id)
      .then((rows) => alive && setAdvances(rows))
      .catch(() => {});
    fetchTechnicianLeaves(id)
      .then((rows) => alive && setLeaves(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  // This Month — attendance summary for the chosen month.
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setSummaryLoading(true);
    setSummary(null);
    fetchTechnicianAttendance(id, viewDate.getMonth() + 1, viewDate.getFullYear())
      .then((s) => alive && setSummary(s || null))
      .catch(() => alive && setSummary(null))
      .finally(() => alive && setSummaryLoading(false));
    return () => {
      alive = false;
    };
  }, [id, viewDate]);

  const active = tech?.isAvailable !== false;
  const role = tech?.roleLabel || 'Technician';
  const isPickup = /pickup/i.test(role);
  const employeeCode = useMemo(() => (tech?.id ? `EM-${String(tech.id).replace(/-/g, '').slice(0, 8).toUpperCase()}` : DASH), [tech]);
  const totalDays = daysInMonth(viewDate);
  const present = Number(summary?.presentDays) || 0;
  const pct = Math.min(100, Math.round((present / totalDays) * 100));
  const loadingMark = (v) => (summaryLoading ? '…' : v);

  const recentAdvances = useMemo(
    () => [...advances].sort((a, b) => new Date(b.requestedAt || b.advanceDate || 0) - new Date(a.requestedAt || a.advanceDate || 0)).slice(0, 3),
    [advances],
  );
  // Permissions are leave requests of type PERMISSION — shown in their own card.
  const [recentLeaves, recentPermissions] = useMemo(() => {
    const sorted = [...leaves].sort((a, b) => new Date(b.requestedAt || b.startDate || 0) - new Date(a.requestedAt || a.startDate || 0));
    const isPermission = (l) => String(l.leaveType || '').toUpperCase() === 'PERMISSION';
    return [sorted.filter((l) => !isPermission(l)).slice(0, 3), sorted.filter(isPermission).slice(0, 3)];
  }, [leaves]);

  // Quick Access by role: technicians get Task Report (Working Record), pickup
  // staff get Pickup Report, other staff neither — each this employee's own page.
  const roleKind = isPickup ? 'pickup' : /tech/i.test(role) ? 'technician' : 'staff';
  const enc = encodeURIComponent;
  const quickLinks = [
    { label: 'Daily Shift Schedule', icon: Clock, href: `/shop-home/employee/shift-schedule/day/?id=${enc(id || '')}` },
    { label: 'Monthly Summary', icon: CalendarDays, href: `/shop-home/employee/attendance/view/?id=${enc(id || '')}` },
    { label: 'Leave Report', icon: Briefcase, href: `/shop-home/employee/leave/view/?id=${enc(id || '')}` },
    roleKind === 'technician' ? { label: 'Task Report', icon: Laptop, href: `/shop-home/employee/team/tasks/?id=${enc(id || '')}` } : null,
    roleKind === 'pickup' ? { label: 'Pickup Report', icon: Truck, href: `/shop-home/employee/team/pickups/?id=${enc(id || '')}` } : null,
    { label: 'Salary Report', icon: FileText, href: `/shop-home/employee/salary/view/?id=${enc(id || '')}` },
    { label: 'Edit Profile', icon: PencilLine, href: `/shop-home/employee/team/edit/?id=${enc(id || '')}` },
  ].filter(Boolean);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      {/* Header */}
      <div className="relative flex items-center justify-center border-b border-[#ECECEC] pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className={cx('absolute left-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#E5F3F5] text-[#111111] transition hover:bg-[#E5F3F5]', FOCUS_RING)}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-[20px] font-extrabold text-[#111111]">Employee Details</h1>
        <span className="absolute right-0 flex h-11 w-11 items-center justify-center text-[#035C6C] opacity-60" title="More actions aren’t available yet" aria-hidden="true">
          <MoreVertical className="h-5 w-5" />
        </span>
      </div>

      {!id ? (
        <EmptyState icon={AlertTriangle} tone="muted" title="No employee selected" description="Open an employee from Team." />
      ) : loading ? (
        <div className="space-y-4">
          <div className="h-36 animate-pulse rounded-[22px] bg-[#F3F3F3]" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="h-24 animate-pulse rounded-[22px] bg-[#F3F3F3]" />
            <div className="h-24 animate-pulse rounded-[22px] bg-[#F3F3F3]" />
          </div>
          <div className="h-64 animate-pulse rounded-[22px] bg-[#F3F3F3]" />
        </div>
      ) : error || !tech ? (
        <EmptyState icon={AlertTriangle} tone="muted" title="Employee not found" description={error || 'We couldn’t find this employee.'} />
      ) : (
        <>
          {/* Profile */}
          <section className={cx(CARD, 'flex items-start gap-4 p-4 sm:gap-5 sm:p-5')}>
            <Avatar url={resolveMediaUrl(tech.photoUrl)} active={active} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 max-w-full truncate text-[22px] font-extrabold text-[#111111] sm:text-[24px]">{tech.name || 'Unnamed'}</h2>
                <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold', active ? 'bg-[#E5F3F5] text-[#035C6C]' : 'bg-[#F3F3F3] text-[#667085]')}>
                  <span className={cx('h-2.5 w-2.5 rounded-full', active ? 'bg-[#035C6C]' : 'bg-[#98A2B3]')} aria-hidden="true" />
                  {active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#E5F3F5] px-3 py-1 text-[14px] font-bold text-[#035C6C]">
                <Wrench className="h-4 w-4" aria-hidden="true" />
                {role}
              </span>
              <p className="mt-2 text-[14px] tracking-wide text-[#667085]">ID: {employeeCode}</p>
            </div>
          </section>

          {/* Check in / out */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <TimeCard icon={SunDim} label="Check In" value={hhmm(tech.defaultCheckIn)} />
            <TimeCard icon={Sun} label="Check Out" value={hhmm(tech.defaultCheckOut)} tone="red" />
          </div>

          {/* Quick access */}
          <section>
            <h3 className="mb-3 text-[18px] font-extrabold text-[#111111]">Quick Access</h3>
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
              {quickLinks.map((q) => (
                <QuickTile key={q.label} {...q} />
              ))}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* This month */}
            <section className={cx(CARD, 'p-5')}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[18px] font-bold text-[#111111]">This Month</h3>
                <div className="flex items-center gap-1 rounded-full bg-[#E5F3F5] px-1.5 py-1">
                  <button type="button" onClick={() => shiftMonth(setViewDate, -1)} aria-label="Previous month" className={cx('rounded-full p-1 text-[#035C6C] hover:bg-white', FOCUS_RING)}>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="flex items-center gap-1.5 px-1 text-[15px] font-bold text-[#035C6C]">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    {MONTHS[viewDate.getMonth()].slice(0, 3)} {viewDate.getFullYear()}
                  </span>
                  <button type="button" onClick={() => shiftMonth(setViewDate, 1)} aria-label="Next month" className={cx('rounded-full p-1 text-[#035C6C] hover:bg-white', FOCUS_RING)}>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#ECECEC]">
                <div className="h-full rounded-full bg-[#035C6C] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[15px]">
                <span className="font-bold text-[#035C6C]">{loadingMark(present)} Present</span>
                <span className="text-[#667085]">
                  {loadingMark(present)}/{totalDays}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile icon={CalendarDays} value={loadingMark(present)} label="Present" />
                <StatTile icon={Briefcase} value={loadingMark(pad2(summary?.leaveDays))} label="Leave" tone="yellow" />
                <StatTile icon={CalendarDays} value={loadingMark(pad2(summary?.permissionCount))} label="Permission" />
                <StatTile icon={Clock} value={loadingMark(summary?.lateHours || '0')} label="Late Hrs" />
              </div>
            </section>

            {/* Info */}
            <section className={cx(CARD, 'grid grid-cols-1 gap-5 p-5 sm:grid-cols-2')}>
              <InfoCell icon={Smartphone} label="Role" value={role} />
              <InfoCell icon={Mail} label="Email" value={tech.email} />
              <InfoCell icon={Phone} label="Phone" value={tech.phone || tech.mobile} />
              <InfoCell icon={MapPin} label="Department" value={isPickup ? 'Pickup' : 'Service'} />
              <InfoCell icon={Smartphone} label="Staff App Login" value={tech.userId ? 'Enabled' : 'Disabled'} />
              <InfoCell icon={CalendarDays} label="Date of Joining" value={tech.dateOfJoin ? fmtDate(tech.dateOfJoin) : DASH} />
            </section>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Salary advances */}
            <section>
              <h3 className="mb-3 text-[18px] font-extrabold text-[#111111]">Recent Salary Advance</h3>
              {recentAdvances.length ? (
                <div className={cx(CARD, 'divide-y divide-[#ECECEC]')}>
                  {recentAdvances.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C]">
                        <Wallet className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-[#111111]">{money(a.amount)}</p>
                        <p className="truncate text-[12.5px] text-[#667085]">
                          {fmtDate(a.advanceDate || a.requestedAt)}
                          {a.notes ? ` · ${a.notes}` : ''}
                        </p>
                      </div>
                      <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold', STATUS_TONE[String(a.status).toUpperCase()] || 'bg-[#F3F3F3] text-[#667085]')}>
                        {humanize(a.status) || DASH}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyRow icon={Wallet} title="No advances" text="No salary advance has been requested yet." />
              )}
            </section>

            {/* Leave requests, then permissions (leave type PERMISSION) */}
            {[
              { title: 'Recent Leave Request', rows: recentLeaves, icon: ClipboardList, emptyIcon: Inbox, emptyTitle: 'No leave requests', emptyText: 'This employee has no leave requests.' },
              { title: 'Recent Permission', rows: recentPermissions, icon: Hand, emptyIcon: Hand, emptyTitle: 'No permissions', emptyText: 'This employee hasn’t requested any permission yet.' },
            ].map((box) => (
              <section key={box.title}>
                <h3 className="mb-3 text-[18px] font-extrabold text-[#111111]">{box.title}</h3>
                {box.rows.length ? (
                  <div className={cx(CARD, 'divide-y divide-[#ECECEC]')}>
                    {box.rows.map((l) => (
                      <div key={l.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C]">
                          <box.icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-bold text-[#111111]">{humanize(l.leaveType) || 'Leave'}</p>
                          <p className="truncate text-[12.5px] text-[#667085]">
                            {fmtDate(l.startDate)}
                            {l.endDate && l.endDate !== l.startDate ? ` – ${fmtDate(l.endDate)}` : ''}
                            {l.appliedDaysLabel ? ` · ${l.appliedDaysLabel}` : l.totalDays ? ` · ${l.totalDays} day${Number(l.totalDays) === 1 ? '' : 's'}` : ''}
                            {l.reason ? ` · ${l.reason}` : ''}
                          </p>
                        </div>
                        <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold', STATUS_TONE[String(l.status).toUpperCase()] || 'bg-[#F3F3F3] text-[#667085]')}>
                          {humanize(l.status) || DASH}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyRow icon={box.emptyIcon} title={box.emptyTitle} text={box.emptyText} />
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
