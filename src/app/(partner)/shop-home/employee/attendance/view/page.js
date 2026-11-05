'use client';

/**
 * /shop-home/employee/attendance/view/?id=<employeeId> — one employee's
 * Attendance, opened from Employee Details → Quick Access → Monthly Summary.
 * Laid out like the Partner app's Attendance screen:
 *
 *   - Attendance Overview: month switcher, five rings (Present, Late hrs,
 *     Permission, Leaves, Holidays) and a Sun–Sat calendar — Sundays red with
 *     a week-off dot, today circled, each day dotted by its record's status
 *     (leave / late / permission / holiday), plus the legend.
 *   - Attendance Monthly: the month's daily records (check-in, check-out,
 *     hours, status), newest first.
 *
 * Data: GET {TICKET_BASE}/technicians/{id}/attendance?month&year
 * (AttendanceSummaryResponse: presentDays, lateHours, permissionCount,
 * leaveDays, holidayCount, dailyRecords[]) via fetchTechnicianAttendance();
 * the name comes from GET /technicians/{id}.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, LogIn, LogOut } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { MONTHS, shiftMonth } from '@/components/shop-dashboard/MonthSwitcher';
import { fetchTechnician, fetchTechnicianAttendance } from '@/lib/shopDashboard';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
const DARK = '#035C6C';
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Status -> calendar dot colour (legend order as in the app).
const LEGEND = [
  { key: 'leave', label: 'Leave', color: '#0F9488' },
  { key: 'late', label: 'Late', color: '#F59E0B' },
  { key: 'permission', label: 'Permission', color: '#F59E0B' },
  { key: 'weekoff', label: 'Week off', color: '#7FBFB5' },
  { key: 'holiday', label: 'Holiday', color: DARK },
];
const DOT = Object.fromEntries(LEGEND.map((l) => [l.key, l.color]));

/** A daily record's status (any backend spelling) -> legend key, 'present', or null. */
function statusKey(record) {
  const s = String(record?.status || '').toUpperCase();
  if (s.includes('LEAVE')) return 'leave';
  if (s.includes('HOLIDAY')) return 'holiday';
  if (s.includes('WEEK')) return 'weekoff';
  if (s.includes('PERMISSION')) return 'permission';
  if (s.includes('LATE') || Number(record?.lateMinutes) > 0) return 'late';
  if (s.includes('PRESENT')) return 'present';
  return null;
}

const pad2 = (n) => String(Number(n) || 0).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function hhmm(value) {
  if (!value) return '—';
  if (/T/.test(String(value))) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  const m = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!m) return '—';
  const h = Number(m[1]);
  return `${pad2(h % 12 === 0 ? 12 : h % 12)}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
const humanize = (v) =>
  String(v || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

function Ring({ value, label, color }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[5px] bg-white text-[20px] font-extrabold text-[#111111] sm:h-[88px] sm:w-[88px] sm:text-[22px]" style={{ borderColor: color }}>
        {value}
      </span>
      <span className="text-[13.5px] font-semibold" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

export default function EmployeeAttendancePage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [name, setName] = useState('');
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setLoading(true);
    setError('');
    setSummary(null);
    fetchTechnicianAttendance(id, viewDate.getMonth() + 1, viewDate.getFullYear())
      .then((s) => alive && setSummary(s || null))
      .catch((err) => alive && setError(err.message || 'Could not load attendance.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, viewDate]);

  const records = useMemo(() => (Array.isArray(summary?.dailyRecords) ? summary.dailyRecords : []), [summary]);
  const byDay = useMemo(() => {
    const m = new Map();
    records.forEach((r) => {
      const key = String(r.date || '').slice(0, 10);
      if (key) m.set(key, r);
    });
    return m;
  }, [records]);

  // Calendar cells: leading blanks to the first weekday, then each day.
  const cells = useMemo(() => {
    const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const days = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  }, [viewDate]);

  const today = isoDay(new Date());
  const v = (n) => (loading ? '…' : n);
  const late = summary?.lateHours ? String(summary.lateHours).replace(/\s*hrs?$/i, '') : '0';
  const monthLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  const sortedRecords = useMemo(() => [...records].sort((a, b) => String(b.date).localeCompare(String(a.date))), [records]);

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
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
        <div className="min-w-0 px-12 text-center">
          <h1 className="text-[20px] font-extrabold text-[#111111]">Attendance</h1>
          {name ? <p className="break-words text-[12.5px] font-semibold text-[#666666]">{name}</p> : null}
        </div>
      </div>

      {error ? <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] font-semibold text-[#B42318]">{error}</p> : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Overview */}
        <section className="rounded-[24px] border border-[#ECECEC] bg-white p-5 shadow-[0_4px_14px_rgba(16,24,40,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] font-extrabold text-[#111111]">Attendance Overview</h2>
            <div className="flex items-center gap-1 rounded-full px-4 py-2 text-white" style={{ backgroundColor: DARK }}>
              <span className="pr-2 text-[15px] font-bold">{monthLabel}</span>
              <button type="button" onClick={() => shiftMonth(setViewDate, -1)} aria-label="Previous month" className={cx('rounded-full p-1 hover:bg-white/15', FOCUS_RING)}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="h-4 w-px bg-white/30" aria-hidden="true" />
              <button type="button" onClick={() => shiftMonth(setViewDate, 1)} aria-label="Next month" className={cx('rounded-full p-1 hover:bg-white/15', FOCUS_RING)}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-between gap-3">
            <Ring value={v(Number(summary?.presentDays) || 0)} label="Present" color={DARK} />
            <Ring value={v(`${late} Hrs`)} label="Late" color="#F59E0B" />
            <Ring value={v(pad2(summary?.permissionCount))} label="Permission" color="#F59E0B" />
            <Ring value={v(pad2(summary?.leaveDays))} label="Leaves" color="#0F9488" />
            <Ring value={v(pad2(summary?.holidayCount))} label="Holidays" color={DARK} />
          </div>

          <div className="mt-6 grid grid-cols-7 text-center">
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={cx('pb-3 text-[13.5px] font-extrabold', i === 0 ? 'text-[#DC2626]' : 'text-[#111111]')}>
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={`b${i}`} />;
              const key = isoDay(d);
              const rec = byDay.get(key);
              const sunday = d.getDay() === 0;
              const st = statusKey(rec) || (sunday ? 'weekoff' : null);
              const dot = st && st !== 'present' ? DOT[st] : null;
              const isToday = key === today;
              return (
                <div key={key} className="flex h-12 min-w-0 flex-col items-center justify-start pt-1 sm:h-14" title={rec?.status ? humanize(rec.status) : sunday ? 'Week off' : undefined}>
                  <span
                    className={cx(
                      'flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-bold sm:h-10 sm:w-10 sm:text-[16px]',
                      sunday ? 'text-[#DC2626]' : 'text-[#111111]',
                      isToday && 'bg-[#E5F3F5] text-[#035C6C]',
                      st === 'present' && !isToday && 'bg-[#035C6C] text-white',
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {dot ? <span className="mt-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: dot }} aria-hidden="true" /> : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {LEGEND.map((l) => (
              <span key={l.key} className="inline-flex items-center gap-1.5 text-[13px] text-[#344054]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} aria-hidden="true" />
                {l.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[13px] text-[#344054]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#035C6C]" aria-hidden="true" />
              Present (filled)
            </span>
          </div>
        </section>

        {/* Monthly records */}
        <section className="rounded-[24px] border border-[#ECECEC] bg-white p-5 shadow-[0_4px_14px_rgba(16,24,40,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] font-extrabold text-[#111111]">Attendance Monthly</h2>
            <div className="flex items-center gap-3">
              <span className="text-[15px] font-bold" style={{ color: DARK }}>
                {monthLabel}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: DARK }} aria-hidden="true">
                <CalendarDays className="h-5 w-5" />
              </span>
            </div>
          </div>

          {loading ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#F3F3F3]" />
              ))}
            </div>
          ) : sortedRecords.length === 0 ? (
            <p className="py-10 text-center text-[14.5px] text-[#667085]">No attendance records for this month.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {sortedRecords.map((r) => {
                const d = r.date ? new Date(`${String(r.date).slice(0, 10)}T00:00:00`) : null;
                const st = statusKey(r);
                return (
                  <li key={r.date} className="flex items-center gap-3 rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] px-3.5 py-3">
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-center">
                      <span className="text-[16px] font-extrabold leading-none text-[#111111]">{d ? d.getDate() : '—'}</span>
                      <span className="text-[10.5px] font-bold uppercase text-[#667085]">{r.dayLabel || (d ? d.toLocaleDateString('en-US', { weekday: 'short' }) : '')}</span>
                    </span>
                    <div className="min-w-0 flex-1 text-[13px] text-[#344054]">
                      <p className="flex flex-wrap items-center gap-x-3">
                        <span className="inline-flex items-center gap-1">
                          <LogIn className="h-3.5 w-3.5 text-[#035C6C]" aria-hidden="true" />
                          {hhmm(r.checkInTime)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <LogOut className="h-3.5 w-3.5 text-[#B42318]" aria-hidden="true" />
                          {hhmm(r.checkOutTime)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#667085]">
                        {r.workingHours ? `Worked ${r.workingHours}` : 'Hours not recorded'}
                        {Number(r.lateMinutes) > 0 ? ` · ${r.lateMinutes} min late` : ''}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold text-white"
                      style={{ backgroundColor: st && st !== 'present' ? DOT[st] : DARK }}
                    >
                      {humanize(r.status) || '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
