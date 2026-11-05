'use client';

/**
 * /shop-home/services/warranty — warranty claims & rework requests.
 *
 * There is no backend concept of a warranty claim or rework request
 * anywhere in this codebase — no ticket/booking field, no status value, no
 * endpoint (confirmed by a full-tree search; the only "warranty" hits
 * anywhere are marketing copy and the unrelated Sell/marketplace device
 * warranty term). This is a genuine data gap, not a missing UI: there is
 * nothing to filter, list, or approve/reject yet.
 *
 * Per the brief's own rule ("do not use mock data in production pages" /
 * "show real read-only tracking data rather than fake buttons"), this page
 * is an honest, properly designed empty state — real header, real (dashed)
 * stat tiles, real filter chips that are simply inert because there is
 * nothing behind them, and a Refresh button that's honestly disabled (with
 * an explanatory tooltip) rather than a no-op that pretends to reload
 * something — rather than either a generic "Coming soon" stub or an
 * invented list of fake claims.
 *
 * 2026-09: UI-only redesign to match the premium soft-3D NearGFix visual
 * language used across the other redesigned Partner Dashboard pages — the
 * "no data yet" logic above, the STATS/FILTERS content, and every value
 * shown ("—") are unchanged.
 */

import { RefreshCw, Repeat, ShieldCheck, ClipboardCheck } from 'lucide-react';

import { cx } from '@/components/site/ui';
import FilterChips from '@/components/shop-dashboard/FilterChips';

const STATS = [
  { label: 'Total Requests', icon: ShieldCheck, bgIcon: ShieldCheck, tone: 'green' },
  { label: 'Warranty Claims', icon: ShieldCheck, bgIcon: ShieldCheck, tone: 'blue' },
  { label: 'Rework Requests', icon: Repeat, bgIcon: Repeat, tone: 'orange' },
  { label: 'Completed', icon: ClipboardCheck, bgIcon: ClipboardCheck, tone: 'purple' },
];

const FILTERS = ['All', 'Warranty', 'Rework', 'Pending', 'Approved', 'Rejected', 'Completed'];

/** Small decorative empty-state graphic — a document + shield/check badge with a soft mint circle behind it, matching a reference design. Purely decorative. */
function WarrantyEmptyIllustration() {
  return (
    <svg viewBox="0 0 200 160" className="h-32 w-32" aria-hidden="true">
      <defs>
        <linearGradient id="wrEmptyDoc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="wrEmptyBadge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="80" r="66" fill="#E5F3F5" opacity="0.55" />
      <circle cx="100" cy="80" r="40" fill="#EAF5FF" opacity="0.6" />
      <ellipse cx="100" cy="138" rx="42" ry="8" fill="#024A57" opacity="0.08" />
      <circle cx="36" cy="44" r="4" fill="#C7E6EA" />
      <circle cx="162" cy="102" r="3.5" fill="#C7E6EA" />
      <ellipse cx="164" cy="46" rx="16" ry="9" fill="#BFE8FF" opacity="0.7" />

      <g transform="translate(64,42) rotate(-6)">
        <rect x="0" y="0" width="60" height="76" rx="8" fill="url(#wrEmptyDoc)" stroke="#CBD5E1" strokeWidth="1.5" />
        <rect x="12" y="14" width="36" height="4" rx="2" fill="#CBD5E1" />
        <rect x="12" y="24" width="28" height="4" rx="2" fill="#CBD5E1" />
        <rect x="12" y="34" width="32" height="4" rx="2" fill="#CBD5E1" />
      </g>

      <g transform="translate(90,66)">
        <path d="M0 -22 c12 0 22 6 22 6 v18 c0 15 -22 26 -22 26 s-22 -11 -22 -26 v-18 s10 -6 22 -6 z" fill="url(#wrEmptyBadge)" />
        <path d="M-9 0 l7 7 l13 -15" stroke="white" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// Page-local pastel KPI-card styling — not the shared StatCard (used by ~10
// other pages, unaffected): matches a reference design's pastel-gradient +
// glossy circular icon chip + large translucent background-glyph treatment,
// same approach as the redesigned Delivery/Pickups/Requote/Bookings pages.
const WARRANTY_STAT_STYLES = {
  green: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#035C6C] to-[#035C6C]',
    value: 'text-[#1C3053]',
    label: 'text-[#024A57]',
    wave: 'text-[#C7E6EA]',
    glow: 'bg-[#F3F3F3]',
  },
  blue: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#38BDF8] to-[#1DA8E8]',
    value: 'text-[#1C3053]',
    label: 'text-[#1D6FA0]',
    wave: 'text-[#93D6F7]',
    glow: 'bg-[#93D6F7]',
  },
  orange: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#FB923C] to-[#FF7A1A]',
    value: 'text-[#1C3053]',
    label: 'text-[#9A5B27]',
    wave: 'text-[#FDBA74]',
    glow: 'bg-[#FDBA74]',
  },
  purple: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#A78BFA] to-[#8B5CF6]',
    value: 'text-[#1C3053]',
    label: 'text-[#6D5A9E]',
    wave: 'text-[#C4B5FD]',
    glow: 'bg-[#C4B5FD]',
  },
};

function WarrantyStatCard({ icon: Icon, bgIcon: BgIcon, label, tone }) {
  const s = WARRANTY_STAT_STYLES[tone] || WARRANTY_STAT_STYLES.green;
  return (
    <div
      className={cx(
        'relative flex h-[178px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#ECECEC] p-4 sm:p-5',
        s.card,
      )}
    >
      <BgIcon className={cx('pointer-events-none absolute -bottom-7 -right-7 h-32 w-32 rotate-[-10deg] opacity-[0.28]', s.wave)} aria-hidden="true" />

      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
        <span
          className={cx(
            'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white',
            s.chip,
          )}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      </span>

      {/* "—" (unavailable) — same as before, never a fabricated count */}
      <p className={cx('relative mt-4 text-[30px] font-extrabold leading-none tracking-tight sm:text-[32px]', s.value)}>—</p>
      <p className={cx('relative mt-1.5 text-sm font-semibold', s.label)}>{label}</p>
    </div>
  );
}

export default function WarrantyReworkPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero — soft mint gradient banner with layered abstract waves + a
          decorative "WARRANTY" clipboard/shield/phone/wrench/gear/boxes
          illustration on the far right, matching the same premium design
          system as the other redesigned Partner Dashboard pages.
          Title/subtitle are the exact same content this page always had. */}
      <div className="relative overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-6 sm:p-7">

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[34px]">Warranty / Rework</h1>
            <p className="mt-1 text-[14px] text-[#666666] sm:text-[15px]">Manage warranty claims and rework repair requests.</p>
          </div>
          <button
            type="button"
            disabled
            title="No warranty or rework data source exists yet to refresh"
            aria-label="Refresh — not yet available"
            className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full border border-[#ECECEC] bg-white px-4 py-2.5 text-sm font-semibold text-[#98A2B3]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>

      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STATS.map((s) => (
          <WarrantyStatCard key={s.label} icon={s.icon} bgIcon={s.bgIcon} label={s.label} tone={s.tone} />
        ))}
      </div>

      <section className="flex min-h-[340px] flex-col overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8]">
        <div className="border-b border-[#ECECEC] px-5 py-5 opacity-60 sm:px-6">
          <FilterChips options={FILTERS} value="All" onChange={() => {}} />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <WarrantyEmptyIllustration />
          <p className="mt-4 max-w-[560px] text-lg font-bold text-[#1C3053]">Warranty and rework tracking isn&apos;t available yet</p>
          <p className="mt-2 max-w-[560px] text-sm leading-relaxed text-[#666666]">
            This backend has not started providing warranty or rework request data yet, so details may not be available. Nothing is being hidden or
            filtered; there&apos;s simply nothing to show until that&apos;s active.
          </p>
        </div>
      </section>
    </div>
  );
}
