'use client';

/**
 * /shop-home/employee/team/new — "Add Staff" screen, matching the real
 * NearGFix Staff mobile app screen of the same name (screenshot supplied
 * 2026-09). Reached from the Employees list's "+ Add Employee" button.
 *
 * `TECHNICIAN_BASE` (src/lib/api.js, `https://api.ggfix.in/technician`) is
 * defined but has never been called anywhere in this web codebase — a live
 * probe confirmed it's a real, auth-protected service (403, not 404), so
 * the mobile app's real Add Staff/create-employee flow almost certainly
 * talks to it. Nothing here is confirmed yet for THIS web app, so:
 *   - "New Staff" navigates to the real create-employee form
 *     (/team/new/create) — that page's own Create action stays disabled
 *     until the real endpoint is confirmed.
 *   - The "find existing" search is a real, working input, but honestly
 *     inert — there is no confirmed search-existing-staff-by-phone
 *     endpoint yet, so it doesn't silently pretend to search.
 */

import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, UserPlus } from 'lucide-react';

import { cx } from '@/components/site/ui';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

export default function AddStaffPage() {
  const router = useRouter();

  return (
    // Full 1320px desktop width throughout — header, card, and search bar
    // all share the same width, matching the Employees list and Create
    // Employee form (no separate narrower inner wrapper).
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#344054] transition hover:border-[#024A57] hover:text-[#024A57]', FOCUS_RING)}
        >
          <ArrowLeft className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight text-[#1C3053]">Add Staff</h1>
      </div>

      <button
        type="button"
        onClick={() => router.push('/shop-home/employee/team/new/create')}
        className={cx(
          'flex flex-col items-center gap-2 rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-7 text-center transition hover:border-[#035C6C]',
          FOCUS_RING,
        )}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F3F3F3] text-[#035C6C]">
          <UserPlus className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="text-base font-extrabold text-[#1C3053]">New Staff</span>
        <span className="text-sm text-[#666666]">Add a new employee to your shop</span>
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[#F3F3F3]" aria-hidden="true" />
        <span className="text-xs font-semibold text-[#98A2B3]">or find existing</span>
        <span className="h-px flex-1 bg-[#F3F3F3]" aria-hidden="true" />
      </div>

      {/* Real, working input — but honestly inert: no confirmed
          search-existing-staff endpoint yet, so typing here doesn't
          pretend to filter anything real. */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" aria-hidden="true" />
        <input
          type="text"
          disabled
          title="Finding an existing employee isn't available yet — there's no confirmed search endpoint for this."
          placeholder="Search by name or phone number"
          className="w-full cursor-not-allowed rounded-full border border-[#D0D5DD] bg-[#F8F8F8] py-3 pl-11 pr-4 text-sm text-[#98A2B3] placeholder:text-[#98A2B3]"
        />
      </div>
    </div>
  );
}
