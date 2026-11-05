'use client';

/**
 * /shop-home/employee/tasks — no generic task-assignment concept exists in
 * this backend (only repair tickets and pickup bookings, already covered
 * by Service Report and Pickup Report) — confirmed by shopDashboard.js's
 * own doc comment that "Today's Tasks has no backing concept anywhere in
 * the schema."
 *
 * This page used to render the shared NotYetAvailablePage component (still
 * used, unchanged, by expense-report/sales-report/cash-book). 2026-09: only
 * the hero/banner is now bespoke here (the real public/tasks.png asset, a
 * complete pre-composited banner), per an explicit "don't redesign the
 * stat cards/filters/empty state, only the header" instruction — those
 * three sections below are hand-copied from NotYetAvailablePage's own
 * markup verbatim (same StatCard/FilterChips/EmptyState components, same
 * literal "—" values, same inert filters), not a new design.
 */

import Image from 'next/image';
import { ListChecks } from 'lucide-react';

import StatCard from '@/components/shop-dashboard/StatCard';
import FilterChips from '@/components/shop-dashboard/FilterChips';
import EmptyState from '@/components/shop-dashboard/EmptyState';

const STAT_LABELS = ['Total Tasks', 'Pending', 'In Progress', 'Completed'];
const FILTERS = ['All', 'Pending', 'In Progress', 'Completed', 'Overdue'];
const EXPLANATION =
  "Generic task assignment isn't tracked by this backend — only repair tickets and pickup bookings exist, which are already covered by Service Report and Pickup Report.";

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero — ONE complete banner image (public/tasks.png): that asset
          already renders its own title/subtitle/icon/artwork as one
          finished scene, so it's shown directly via object-cover inside a
          single overflow-hidden rounded container, per an explicit
          "no separate text layer, no separate right-side artwork, no
          nested white box" instruction. */}
      {/* Plain grey banner (the picture banner was removed on request). */}
      <div className="rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-6 sm:p-7">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[34px]">Tasks</h1>
        <p className="mt-1 text-[14px] text-[#666666] sm:text-[15px]">Manage and monitor employee work tasks.</p>
      </div>

      {/* Everything below is unchanged from NotYetAvailablePage's own
          markup (same components, same values) — only the hero above
          replaced the shared PageHeader this page used to render through
          that component. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_LABELS.map((label) => (
          <StatCard key={label} icon={ListChecks} label={label} value="—" tone="green" />
        ))}
      </div>

      <section className="rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
        <div className="border-b border-[#ECECEC] px-4 py-4 opacity-60 sm:px-5">
          <FilterChips options={FILTERS} value={FILTERS[0]} onChange={() => {}} />
        </div>

        <EmptyState icon={ListChecks} tone="muted" title="Not available yet" description={EXPLANATION} />
      </section>
    </div>
  );
}
