'use client';

/**
 * Shared controls for PageHeader banners, so every Employee / Report page
 * shows the same month picker and the same right-side summary pill.
 */

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import { cx } from '@/components/site/ui';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';

/** ‹ 📅 Oct 2026 › — white pill; `label` is the already-formatted month. */
export function MonthPicker({ label, onPrev, onNext, disabled = false }) {
  const arrow = cx(
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#111111] transition hover:bg-[#F3F3F3] disabled:cursor-not-allowed disabled:opacity-40',
    FOCUS_RING,
  );
  return (
    <div className="inline-flex h-12 items-center gap-1 rounded-full border border-[#ECECEC] bg-white px-1.5">
      <button type="button" onClick={onPrev} disabled={disabled} aria-label="Previous month" className={arrow}>
        <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
      <span className="flex min-w-[150px] items-center justify-center gap-2 px-2 text-[15px] font-bold text-[#111111]">
        <CalendarDays className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
        {label}
      </span>
      <button type="button" onClick={onNext} disabled={disabled} aria-label="Next month" className={arrow}>
        <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Right-side banner summary: green icon chip + label + value. */
export function SummaryPill({ icon: Icon, label, value }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-[18px] border border-[#ECECEC] bg-white px-4 py-3">
      {Icon ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#035C6C] text-white">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      ) : null}
      <div>
        <p className="text-[13px] font-semibold text-[#666666]">{label}</p>
        <p className="text-[20px] font-extrabold leading-tight text-[#111111]">{value}</p>
      </div>
    </div>
  );
}

/** Secondary banner button (Refresh etc.) — white pill. */
export const HEADER_BUTTON = cx(
  'inline-flex h-11 items-center gap-1.5 rounded-full border border-[#ECECEC] bg-white px-4 text-sm font-semibold text-[#111111] transition hover:border-[#035C6C] hover:text-[#035C6C] disabled:cursor-not-allowed disabled:opacity-50',
  FOCUS_RING,
);
