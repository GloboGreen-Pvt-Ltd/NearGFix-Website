'use client';

/**
 * /shop-home/employee/shift-schedule — no backing endpoint exists anywhere
 * in this codebase (no shift/schedule/default-check-in-out field or API).
 *
 * This page used to render the shared NotYetAvailablePage component (still
 * used, unchanged, by tasks and the 3 report pages). 2026-09: given its own
 * bespoke UI here, matching a reference design specific to Shift
 * Management — deliberately structured differently from the Attendance/
 * Permission pages (their own bespoke conversions) so this page has its own
 * scheduling-focused identity rather than reading as a reskin. The
 * underlying honesty is unchanged: every summary value is a literal "—"
 * (never "0" or an invented count — there is no shift/schedule data source
 * at all, not a real zero), the "Today" pill is inert (nothing else to
 * switch to), and the empty state explains exactly why, in the same words
 * as before.
 */

import Image from 'next/image';
import { CalendarDays, Clock, Leaf, LogIn, LogOut, Users } from 'lucide-react';

import { cx } from '@/components/site/ui';

const DASH = '—';

// Icon + tint + watermark per summary card — four distinct identities
// (green/blue/orange/purple), per the reference design's explicit "do not
// use the same icon/color for all four cards" instruction.
const SUMMARY_CARDS = [
  {
    key: 'scheduled',
    label: 'Employees Scheduled Today',
    helper: 'Employees scheduled today',
    icon: Users,
    watermark: Users,
    tint: 'bg-[#F3F3F3]',
    iconTone: 'bg-gradient-to-br from-[#18B96A] to-[#035C6C]',
    valueColor: 'text-[#1C3053]',
    watermarkColor: 'text-[#035C6C]',
  },
  {
    key: 'checked-in',
    label: 'Checked In',
    helper: 'Employees who checked in today',
    icon: LogIn,
    watermark: Users,
    tint: 'bg-[#F8F8F8]',
    iconTone: 'bg-gradient-to-br from-[#5EB6FA] to-[#2196F3]',
    valueColor: 'text-[#1C3053]',
    watermarkColor: 'text-[#2196F3]',
  },
  {
    key: 'checked-out',
    label: 'Checked Out',
    helper: 'Employees who checked out today',
    icon: LogOut,
    watermark: Users,
    tint: 'bg-[#F8F8F8]',
    iconTone: 'bg-gradient-to-br from-[#FFB35C] to-[#FF9C1A]',
    valueColor: 'text-[#1C3053]',
    watermarkColor: 'text-[#FF9C1A]',
  },
  {
    key: 'not-started',
    label: 'Not Started',
    helper: 'Employees yet to start their shift',
    icon: Clock,
    watermark: Users,
    tint: 'bg-[#F8F8F8]',
    iconTone: 'bg-gradient-to-br from-[#A78BFA] to-[#8A5CF5]',
    valueColor: 'text-[#1C3053]',
    watermarkColor: 'text-[#8A5CF5]',
  },
];

export default function ShiftManagementPage() {
  return (
    <div className="flex flex-col gap-[18px]">
      {/* Hero — ONE complete banner image
          (public/images/shift-management-banner.png): the newest asset for
          this page, cropped down from public/shift-management.png (which
          had ~200px of blank canvas margin above/below the real card,
          same issue found and fixed on Service Report's banner) so cover
          can fill the hero edge to edge without cropping into the title or
          artwork. That asset already renders its own title/subtitle/icon/
          artwork as one finished scene, so no HTML title/subtitle is
          duplicated on top of it. Border/radius/shadow live on this one
          outer box only. */}
      {/* Plain grey banner (the picture banner was removed on request). */}
      <div className="rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-6 sm:p-7">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[34px]">Shift Management</h1>
        <p className="mt-1 text-[14px] text-[#666666] sm:text-[15px]">View employee schedules and daily working hours.</p>
      </div>

      {/* ---- Summary cards -------------------------------------------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY_CARDS.map((card) => (
          <div
            key={card.key}
            className={cx(
              'relative flex h-[145px] flex-col overflow-hidden rounded-[20px] border border-[#ECECEC] p-5',
              card.tint,
            )}
          >
            <card.watermark className={cx('pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 opacity-20', card.watermarkColor)} aria-hidden="true" />
            <span className={cx('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white', card.iconTone)}>
              <card.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className={cx('relative mt-3 text-[15px] font-bold leading-tight', card.valueColor)}>{card.label}</p>
            <p className={cx('relative mt-1.5 text-[26px] font-extrabold leading-none', card.valueColor)}>{DASH}</p>
            <p className="relative mt-auto pt-2 text-xs text-[#6D7D94]">{card.helper}</p>
          </div>
        ))}
      </div>

      {/* ---- Today panel ------------------------------------------------ */}
      <section className="overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8]">
        <div className="border-b border-[#ECECEC] px-5 py-4 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#18B96A] to-[#035C6C] px-4 py-2 text-sm font-bold text-white">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Today
          </span>
        </div>

        <div className="flex flex-col items-center px-5 py-14 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="pointer-events-none absolute inset-0 rounded-full bg-[#F3F0FE]" aria-hidden="true" />
            <Leaf className="pointer-events-none absolute -left-2 top-1 h-4 w-4 -rotate-45 text-[#035C6C]/60" aria-hidden="true" />
            <Leaf className="pointer-events-none absolute -right-2 bottom-1 h-4 w-4 rotate-[135deg] text-[#035C6C]/60" aria-hidden="true" />
            <Clock className="relative h-8 w-8 text-[#8A5CF5]" aria-hidden="true" />
          </div>
          <p className="mt-4 text-[17px] font-bold text-[#1C3053]">Not available yet</p>
          <p className="mt-1.5 max-w-[430px] text-[13px] leading-relaxed text-[#6D7D94] sm:text-[14px]">
            Shift scheduling isn&apos;t available yet — this backend has no shift/schedule data for employees.
          </p>
        </div>
      </section>
    </div>
  );
}
