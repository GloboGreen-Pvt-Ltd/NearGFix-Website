'use client';

/**
 * /shop-home/employee/shift-schedule/day/?id=<employeeId> — "Shift details"
 * for one employee, opened from Employee Details → Quick Access → Daily
 * Shift Schedule. Laid out like the Partner app's Shift details screen:
 * the selected date (day number, weekday, month), a Today button, a Mon–Sun
 * week strip (selected day dark green, Sunday red) and an hourly timeline
 * from 09:00 round the clock.
 *
 * Live data (ticket-service, helpers in src/lib/shopDashboard.js):
 *   - GET /technicians/{id} — name, role and the employee's shift
 *     (defaultCheckIn → defaultCheckOut), drawn as a block on the timeline
 *     for working days (Sunday is the weekly off, shown red as in the app).
 *   - GET /technicians/{id}/attendance/day?date= — that day's actual check-in
 *     / check-out, status and late minutes, shown above the timeline and as
 *     markers on it.
 * On today's date a red "now" line marks the current time.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from '@/lib/portalNavigation';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Info, LogIn, LogOut } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { fetchTechnician, fetchTechnicianAttendanceDay, fetchTechnicians } from '@/lib/shopDashboard';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
const START_HOUR = 9; // the app's timeline starts at 09:00
const HOURS = Array.from({ length: 25 }, (_, i) => (START_HOUR + i) % 24); // 09:00 … 09:00 next day
const ROW_PX = 64;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday of the week containing d. */
const weekStart = (d) => addDays(d, -((d.getDay() + 6) % 7));
const pad = (n) => String(n).padStart(2, '0');
/** 13 -> "01:00" + "PM", as on the app's time pills. */
const hourLabel = (h) => ({ time: `${pad(h % 12 === 0 ? 12 : h % 12)}:00`, meridiem: h < 12 ? 'AM' : 'PM' });
/** "09:30" / "09:30:00" / ISO -> { h, m } (local), or null. */
function parseTime(value) {
  if (!value) return null;
  if (/T/.test(String(value))) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : { h: d.getHours(), m: d.getMinutes() };
  }
  const m = String(value).match(/(\d{1,2}):(\d{2})/);
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
}
const fmtTime = (t) => (t ? `${pad(t.h % 12 === 0 ? 12 : t.h % 12)}:${pad(t.m)} ${t.h < 12 ? 'AM' : 'PM'}` : '—');
/** Rows below the 09:00 start (fractional). */
const rowOf = (t) => ((t.h - START_HOUR + 24) % 24) + t.m / 60;
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const humanize = (v) =>
  String(v || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

export default function EmployeeShiftDayPage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [employee, setEmployee] = useState(null);
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    fetchTechnician(id)
      .catch(() => fetchTechnicians().then((rows) => (Array.isArray(rows) ? rows : []).find((r) => String(r.id) === String(id)) || null))
      .then((t) => {
        if (!alive) return;
        setEmployee(
          t
            ? { name: t.name || 'Unnamed', role: t.roleLabel || 'Technician', checkIn: parseTime(t.defaultCheckIn), checkOut: parseTime(t.defaultCheckOut) }
            : null,
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  // The selected day's actual attendance.
  const [record, setRecord] = useState(null);
  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setRecord(null);
    fetchTechnicianAttendanceDay(id, isoDate(selected))
      .then((r) => alive && setRecord(r || null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id, selected]);

  // Keep the "now" line moving.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => {
    const monday = weekStart(selected);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [selected]);

  const today = startOfDay(now);
  const isToday = sameDay(selected, today);
  // Offset of the current time inside a 09:00-based day, in rows.
  const nowRow = ((now.getHours() - START_HOUR + 24) % 24) + now.getMinutes() / 60;
  const weeklyOff = selected.getDay() === 0;
  const shiftIn = employee?.checkIn;
  const shiftOut = employee?.checkOut;
  const hasShift = Boolean(shiftIn && shiftOut) && !weeklyOff;
  const shiftTop = hasShift ? rowOf(shiftIn) : 0;
  const shiftRows = hasShift ? Math.max(0.5, (rowOf(shiftOut) - rowOf(shiftIn) + 24) % 24 || 24) : 0;
  const actualIn = parseTime(record?.checkInTime);
  const actualOut = parseTime(record?.checkOutTime);

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col">
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
          <h1 className="text-[20px] font-extrabold text-[#111111]">Shift details</h1>
          {employee ? (
            <p className="break-words text-[12.5px] font-semibold text-[#666666]">
              {employee.name} · {employee.role}
            </p>
          ) : null}
        </div>
      </div>

      {/* Date + Today */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-[30px] font-extrabold leading-none text-[#035C6C]">{selected.getDate()}</span>
          <div>
            <p className="text-[17px] font-bold text-[#111111]">{selected.toLocaleDateString('en-US', { weekday: 'long' })}</p>
            <p className="text-[13.5px] text-[#666666]">{selected.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelected(addDays(selected, -7))}
            aria-label="Previous week"
            className={cx('flex h-10 w-10 items-center justify-center rounded-xl border border-[#ECECEC] bg-white text-[#344054] transition hover:border-[#035C6C] hover:text-[#035C6C]', FOCUS_RING)}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setSelected(today)}
            className={cx(
              'inline-flex h-10 items-center gap-2 rounded-xl border-2 border-[#035C6C] bg-white px-4 text-[14px] font-bold text-[#035C6C] transition hover:bg-[#E5F3F5]',
              FOCUS_RING,
            )}
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Today
          </button>
          <button
            type="button"
            onClick={() => setSelected(addDays(selected, 7))}
            aria-label="Next week"
            className={cx('flex h-10 w-10 items-center justify-center rounded-xl border border-[#ECECEC] bg-white text-[#344054] transition hover:border-[#035C6C] hover:text-[#035C6C]', FOCUS_RING)}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Week strip */}
      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2" role="tablist" aria-label="Week">
        {days.map((d) => {
          const on = sameDay(d, selected);
          const sunday = d.getDay() === 0;
          return (
            <button
              key={d.toISOString()}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSelected(d)}
              className={cx(
                'flex min-w-0 flex-col items-center rounded-2xl border py-2.5 transition',
                FOCUS_RING,
                sunday
                  ? 'border-[#DC2626] bg-[#DC2626] text-white hover:bg-[#C81E1E]'
                  : on
                    ? 'border-[#035C6C] bg-[#035C6C] text-white'
                    : 'border-[#ECECEC] bg-white text-[#111111] hover:border-[#035C6C]',
                sunday && on && 'ring-2 ring-[#035C6C] ring-offset-2',
              )}
            >
              <span className={cx('text-[13px] font-semibold', sunday || on ? 'text-white/90' : 'text-[#666666]')}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className="text-[18px] font-extrabold">{pad(d.getDate())}</span>
              {sameDay(d, today) && !on ? <span className="mt-0.5 h-1 w-1 rounded-full bg-current" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      {weeklyOff ? (
        <p className="mt-3 rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12.5px] font-semibold text-[#B42318]">Sunday — weekly off.</p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Shift', value: shiftIn && shiftOut ? `${fmtTime(shiftIn)} – ${fmtTime(shiftOut)}` : 'Not set' },
          { label: 'Checked in', value: fmtTime(actualIn), tone: actualIn ? 'text-[#035C6C]' : '' },
          { label: 'Checked out', value: fmtTime(actualOut), tone: actualOut ? 'text-[#B42318]' : '' },
          {
            label: 'Status',
            value: record?.status ? humanize(record.status) + (Number(record.lateMinutes) > 0 ? ` · ${record.lateMinutes} min late` : '') : '—',
          },
        ].map((c) => (
          <div key={c.label} className="min-w-0 rounded-xl border border-[#ECECEC] bg-[#F8F8F8] px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#667085]">{c.label}</p>
            <p className={cx('text-[13.5px] font-bold text-[#111111]', c.tone)}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative mt-4" style={{ height: HOURS.length * ROW_PX }}>
        {/* dashed spine */}
        <span className="absolute bottom-0 top-0 border-l-2 border-dashed border-[#9FDDAE]" style={{ left: 105 }} aria-hidden="true" />
        {HOURS.map((h, i) => {
          const { time, meridiem } = hourLabel(h);
          return (
            <div key={i} className="absolute left-0 right-0 flex items-center" style={{ top: i * ROW_PX, height: ROW_PX }}>
              <span className="flex w-[86px] shrink-0 items-baseline justify-center gap-1 rounded-full border border-[#C7E6EA] bg-[#E5F3F5] py-1.5 text-[14px] font-bold text-[#035C6C]">
                {time}
                <span className="text-[10px] font-semibold text-[#035C6C]/70">{meridiem}</span>
              </span>
              <span className="ml-[13px] h-3 w-3 shrink-0 rounded-full bg-[#035C6C]" aria-hidden="true" />
              <span className="ml-4 flex-1 border-t border-dotted border-[#C7E6EA]" aria-hidden="true" />
            </div>
          );
        })}
        {hasShift ? (
          <div
            className="absolute left-[140px] right-2 overflow-hidden rounded-2xl border border-[#035C6C]/25 bg-[#E5F3F5] px-4 py-2.5"
            style={{ top: shiftTop * ROW_PX + ROW_PX / 2, height: shiftRows * ROW_PX }}
          >
            <span className="absolute inset-y-0 left-0 w-1.5 bg-[#035C6C]" aria-hidden="true" />
            <p className="truncate text-[14px] font-extrabold text-[#035C6C]">{employee?.name ? `${employee.name}'s shift` : 'Shift'}</p>
            <p className="text-[12.5px] font-semibold text-[#035C6C]/80">
              {fmtTime(shiftIn)} – {fmtTime(shiftOut)}
              {record?.workingHours ? ` · worked ${record.workingHours}` : ''}
            </p>
          </div>
        ) : null}
        {[
          { t: actualIn, label: 'Check in', icon: LogIn, cls: 'bg-[#035C6C]' },
          { t: actualOut, label: 'Check out', icon: LogOut, cls: 'bg-[#B42318]' },
        ]
          .filter((m) => m.t)
          .map((m) => (
            <div key={m.label} className="pointer-events-none absolute right-4 flex items-center" style={{ top: rowOf(m.t) * ROW_PX + ROW_PX / 2 - 12 }}>
              <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold text-white shadow', m.cls)}>
                <m.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {m.label} {fmtTime(m.t)}
              </span>
            </div>
          ))}
        {isToday ? (
          <div className="pointer-events-none absolute left-[100px] right-0 flex items-center" style={{ top: nowRow * ROW_PX + ROW_PX / 2 - 1 }} aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-[#DC2626]" />
            <span className="h-0.5 flex-1 bg-[#DC2626]" />
            <span className="ml-2 rounded-md bg-[#DC2626] px-1.5 py-0.5 text-[10.5px] font-bold text-white">
              {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ) : null}
      </div>

      {employee && !(shiftIn && shiftOut) ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-[#ECECEC] bg-[#F8F8F8] px-3 py-2.5 text-[12.5px] text-[#666666]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#035C6C]" aria-hidden="true" />
          No default check-in / check-out time is set for this employee, so there&apos;s no shift to draw.
        </p>
      ) : null}
    </div>
  );
}
