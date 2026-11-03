'use client';

/**
 * MonthSwitcher — the "This Month" heading + pill month-switcher used by
 * every report page under /shop-home/reports and /shop-home/employee/
 * {service,pickup}-report. Extracted here because it was duplicated
 * byte-for-byte across ServiceReportClient.js/PickupReportClient.js and
 * was about to be needed in ~10 more report pages — genuine duplication,
 * not a premature abstraction.
 *
 * Purely presentational: the caller owns `viewDate` state and the
 * prev/next handlers (both report pages already had this shape, this
 * component just renders it).
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cx } from '@/components/site/ui';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MonthSwitcher({ viewDate, onPrev, onNext, label = 'This Month' }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-bold text-[#111111]">{label}</p>
      <div className="inline-flex items-center gap-0.5 rounded-full bg-[#024A57] p-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous month"
          className={cx('flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/15 xl:h-7 xl:w-7', FOCUS_RING)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="px-2 text-sm font-bold text-white">
          {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
        </span>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next month"
          className={cx('flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/15 xl:h-7 xl:w-7', FOCUS_RING)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Standard prev/next month handlers — every caller wires these to a `[viewDate, setViewDate]` pair the same way. */
export function shiftMonth(setViewDate, delta) {
  setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
}
