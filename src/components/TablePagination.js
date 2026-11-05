'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { pageBounds } from '@/lib/pagination';

export const PAGE_SIZES = [10, 50, 100, 500, 1000];

/**
 * The shared table footer: rows-per-page, a live count, and Previous / page / Next.
 *
 * The page indicator is a text box rather than a label, so reaching page 25 of 323
 * is one keystroke instead of twenty-four clicks on Next.
 *
 * Stateless about which page is current — the owning table holds that, since it is
 * what slices the rows.
 */
export default function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizes = PAGE_SIZES,
  className = 'flex flex-wrap items-center justify-between gap-3 border-t border-admin-border px-4 py-3',
}) {
  const { pageCount, safePage, start, end } = pageBounds(total, page, pageSize);

  // The page box needs its own draft state: mid-typing it may hold '' or a number
  // past the last page, neither of which is somewhere to jump to yet.
  const [pageInput, setPageInput] = useState('1');

  // Follow the real page whenever it moves for any other reason — Previous/Next, a
  // search that shrinks the results, a change of page size.
  useEffect(() => { setPageInput(String(safePage + 1)); }, [safePage]);

  /**
   * Apply whatever is in the page box. Out-of-range numbers are clamped rather than
   * refused — typing 900 of 323 means "the end", and silently doing nothing reads
   * as a broken control. Anything unparseable snaps back to the current page.
   */
  const commitPage = () => {
    const n = parseInt(pageInput, 10);
    if (!Number.isFinite(n)) { setPageInput(String(safePage + 1)); return; }
    const clamped = Math.min(Math.max(n, 1), pageCount);
    onPageChange(clamped - 1);
    setPageInput(String(clamped));
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-admin-muted">
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-lg border border-admin-border bg-white px-2 py-1 text-slate-700 focus:border-admin-accent focus:outline-none"
        >
          {pageSizes.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
        <span className="sm:ml-1">
          Showing {total ? start + 1 : 0} to {end} of {total} entries
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 0}
          className="flex items-center gap-1 rounded-lg border border-admin-border px-3 py-1.5 text-sm text-slate-600 hover:bg-admin-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        {/* Typeable page box: jump straight to a page instead of clicking Next
            twenty-four times to reach 25 of 323. */}
        <div className="flex items-center gap-1.5 rounded-lg bg-admin-dark px-2 py-1 text-sm font-medium text-slate-700">
          <input
            type="text"
            inputMode="numeric"
            aria-label={`Page number, 1 to ${pageCount}`}
            title="Type a page number, then press Enter"
            value={pageInput}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitPage(); }
              else if (e.key === 'Escape') { setPageInput(String(safePage + 1)); e.currentTarget.blur(); }
            }}
            onBlur={commitPage}
            style={{ width: `${Math.max(2, String(pageCount).length) + 1}ch` }}
            className="rounded border border-admin-border bg-white px-1 py-0.5 text-center tabular-nums text-slate-800 focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20"
          />
          <span className="text-admin-muted">/ {pageCount}</span>
        </div>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= pageCount - 1}
          className="flex items-center gap-1 rounded-lg border border-admin-border px-3 py-1.5 text-sm text-slate-600 hover:bg-admin-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
