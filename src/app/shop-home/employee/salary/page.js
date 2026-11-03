'use client';

/**
 * /shop-home/employee/salary — no backing endpoint exists anywhere in this
 * codebase (no salary/wage/payslip/advance field or API for employees). This
 * is a genuine data gap, not a missing UI — there is nothing to compute,
 * list, or pay out yet.
 *
 * This page used to render the shared NotYetAvailablePage component (still
 * used, unchanged, by attendance/tasks/shift-schedule/leave and 3 report
 * pages). 2026-09: given its own bespoke UI here, matching a reference
 * design specific to Salary & Payslips, without touching NotYetAvailablePage
 * or any of its other consumers. The underlying honesty is unchanged: every
 * KPI value is a literal "—" (never "0" — a real zero would claim "we
 * checked and nobody was paid," which isn't a fact this codebase has), there
 * is no invented month-over-month trend line since no such data exists, the
 * "This Month" filter is inert (nothing else to filter by), and the empty
 * state explains exactly why, in the same words as before.
 */

import { BarChart3, CalendarDays, ChevronDown, Clock, Download, Receipt, RefreshCw, Wallet } from 'lucide-react';

import { cx } from '@/components/site/ui';

/** Tiny 4-bar decorative sparkline for a KPI card's bottom-right corner — purely stylistic texture (the "faint mini growth chart" the reference asks for), never labeled with or implying a specific real value. */
function MicroBars({ className }) {
  const heights = [7, 12, 9, 16];
  return (
    <svg viewBox="0 0 40 20" className={className} aria-hidden="true">
      {heights.map((h, i) => (
        <rect key={i} x={i * 10 + 2} y={20 - h} width="6" height={h} rx="2" fill="currentColor" />
      ))}
    </svg>
  );
}

/** Small decorative empty-state graphic — a document with a rupee symbol and a soft mint circle behind it, matching a reference design. Purely decorative. */
function SalaryEmptyIllustration({ className = 'h-28 w-28' }) {
  return (
    <svg viewBox="0 0 160 140" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="slEmptyDoc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="70" r="54" fill="#EEF2F1" opacity="0.7" />
      <ellipse cx="80" cy="118" rx="34" ry="7" fill="#334155" opacity="0.08" />
      <circle cx="34" cy="40" r="4" fill="#93C5FD" />
      <circle cx="128" cy="96" r="3.5" fill="#93C5FD" />
      <g transform="translate(52,40) rotate(-4)">
        <rect x="0" y="0" width="58" height="72" rx="7" fill="url(#slEmptyDoc)" stroke="#CBD5E1" strokeWidth="1.5" />
        <rect x="10" y="12" width="38" height="4" rx="2" fill="#CBD5E1" />
        <rect x="10" y="21" width="28" height="4" rx="2" fill="#CBD5E1" />
        <rect x="10" y="30" width="32" height="4" rx="2" fill="#CBD5E1" />
      </g>
      <circle cx="103" cy="88" r="18" fill="#94A3B8" />
      <text x="103" y="93" textAnchor="middle" fontSize="15" fontWeight="800" fill="white">₹</text>
      <rect x="93" y="88" width="20" height="4" rx="2" fill="#64748B" />
    </svg>
  );
}

// Page-local pastel KPI-card styling — deliberately laid out differently
// from Leave Management's stacked (icon-above-value) cards: this page uses a
// horizontal icon-left / text-right layout with a bigger, more finance-
// specific icon, per the reference's own note that this page shouldn't look
// identical to the other employee modules.
const SALARY_STAT_STYLES = {
  green: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#035C6C] to-[#035C6C]',
    accent: 'from-[#357D89] to-[#035C6C]',
    value: 'text-[#1C3053]',
    label: 'text-[#024A57]',
    wave: 'text-[#C7E6EA]',
    glow: 'bg-[#F3F3F3]',
  },
  blue: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#38BDF8] to-[#1DA8E8]',
    accent: 'from-[#7DD3FC] to-[#1DA8E8]',
    value: 'text-[#1C3053]',
    label: 'text-[#1D6FA0]',
    wave: 'text-[#93D6F7]',
    glow: 'bg-[#93D6F7]',
  },
  orange: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#FBBF54] to-[#FF9A19]',
    accent: 'from-[#FDBA74] to-[#FF9A19]',
    value: 'text-[#1C3053]',
    label: 'text-[#9A6A27]',
    wave: 'text-[#FDD08A]',
    glow: 'bg-[#FDD08A]',
  },
  pink: {
    card: 'bg-[#F8F8F8]',
    chip: 'bg-gradient-to-br from-[#FB7185] to-[#F43F5E]',
    accent: 'from-[#FDA4AF] to-[#F43F5E]',
    value: 'text-[#1C3053]',
    label: 'text-[#9F5361]',
    wave: 'text-[#FDA4AF]',
    glow: 'bg-[#FDA4AF]',
  },
};

function CoinsGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <ellipse cx="12" cy="17" rx="8" ry="3" fill="currentColor" opacity="0.9" />
      <ellipse cx="12" cy="13" rx="8" ry="3" fill="currentColor" opacity="0.9" />
      <ellipse cx="12" cy="9" rx="8" ry="3" fill="currentColor" />
    </svg>
  );
}

function PeopleGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="8" cy="8" r="3.2" fill="currentColor" />
      <circle cx="16" cy="8" r="3.2" fill="currentColor" opacity="0.75" />
      <path d="M2 20 c0 -4.5 2.8 -7 6 -7 s6 2.5 6 7 z" fill="currentColor" />
      <path d="M12 20 c0.3 -4 3 -6.2 6 -6.2 s5.7 2.2 6 6.2 z" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

const STATS = [
  { label: 'Total Monthly Payroll', icon: CoinsGlyph, bgIcon: Receipt, tone: 'green' },
  { label: 'Employees Paid', icon: PeopleGlyph, bgIcon: PeopleGlyph, tone: 'blue' },
  { label: 'Pending Payments', icon: Clock, bgIcon: Clock, tone: 'orange' },
  { label: 'Salary Advances', icon: Wallet, bgIcon: BarChart3, tone: 'pink' },
];

function SalaryStatCard({ icon: Icon, bgIcon: BgIcon, label, tone }) {
  const s = SALARY_STAT_STYLES[tone] || SALARY_STAT_STYLES.green;

  return (
    <div
      className={cx(
        'group relative flex min-h-[170px] min-w-0 flex-col justify-between gap-3 overflow-hidden rounded-[22px] border border-[#ECECEC] p-4 transition-all sm:p-5 lg:h-[170px] duration-200 hover:-translate-y-[2px]',
        s.card,
      )}
    >
      {/* thin colored accent bar along the top edge — a small but real
          "premium dashboard" tell that this card belongs to its own tone,
          beyond just the pastel background. */}
      <span className={cx('absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r', s.accent)} aria-hidden="true" />
      <BgIcon className={cx('pointer-events-none absolute -bottom-5 -right-5 h-[88px] w-[88px] rotate-[-8deg] opacity-[0.15] transition-transform duration-300 group-hover:scale-105', s.wave)} aria-hidden="true" />

      {/* icon + title, in a row (not stacked) — a large colored square icon
          tile beside the label, per the reference's "strong colored icon
          tile on left, title beside icon" card structure. */}
      <div className="relative flex flex-col items-start gap-2.5 lg:flex-row lg:items-center">
        <span
          className={cx(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white',
            s.chip,
          )}
        >
          <Icon className="h-8 w-8" aria-hidden="true" />
        </span>
        <p className={cx('min-w-0 max-w-full text-sm font-bold lg:truncate', s.label)}>{label}</p>
      </div>

      {/* value bottom-left, micro sparkline bottom-right — "—" (unavailable)
          since no salary/payroll backend exists, never a fabricated count;
          the sparkline is purely decorative texture, not a real chart. */}
      <div className="relative flex items-end justify-between gap-2">
        <p className={cx('text-[34px] font-extrabold leading-none tracking-tight', s.value)}>—</p>
        <MicroBars className={cx('h-5 w-10 shrink-0 opacity-50', s.wave)} />
      </div>
    </div>
  );
}

export default function SalaryPayslipsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero — compact premium banner, matching a reference design's
          "white -> mint" spec. The right-side artwork is the real
          public/salary-payslip.png asset (a calendar/payslip-card/coins/
          money-bag illustration cluster), CSS-cropped via
          background-position to show only that cluster — the same file
          also has a full mockup of this banner (eyebrow/title/subtitle)
          baked into its left side with slightly different wording, so only
          the illustration portion is windowed in; the eyebrow/title/
          subtitle below are this page's real, unchanged copy, not the
          mockup's baked pixels. No white image box: the illustration is a
          plain background-image directly on the mint hero background, not
          wrapped in its own card/frame. */}
      <div
        className="relative overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-5 sm:p-7"
        style={{
          background: '#F8F8F8',
          border: '1px solid rgba(17, 150, 95, 0.10)',
        }}
      >

        <div className="relative z-20 min-w-0 md:pr-[300px] lg:pr-[330px]">
          <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.115em] text-[#035C6C]">
            <span className="h-1.5 w-4 rounded-full bg-gradient-to-r from-[#035C6C] to-[#035C6C]" aria-hidden="true" />
            Employee Management
          </span>
          <h1 className="mt-2.5 text-[30px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[34px]">
            Salary &amp; <span className="text-[#035C6C]">Payslips</span>
          </h1>
          <p className="mt-1 text-[14px] text-[#666666] sm:text-[15px] max-w-[520px]">
            Manage employee salary, advances, and monthly payslips.
          </p>
        </div>

      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATS.map((s) => (
          <SalaryStatCard key={s.label} icon={s.icon} bgIcon={s.bgIcon} label={s.label} tone={s.tone} />
        ))}
      </div>

      <section className="relative flex min-h-[300px] flex-col overflow-hidden rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8]">
        {/* A faint echo of the hero's wave/glow language along the very top
            edge of the panel, so the page reads as one connected system
            instead of "colorful hero, then a plain white box." */}

        <div className="relative z-10 flex h-[72px] items-center justify-between gap-3 border-b border-[#ECECEC] px-5 py-3.5 sm:px-6">
          {/* "This Month" is the only real option — there's no salary data
              to filter across other months, so this stays a single inert
              pill (same honest "nothing behind it yet" treatment the filter
              chips on Leave Management / Warranty use), not a working
              dropdown with nothing real to select. */}
          <button
            type="button"
            disabled
            title="There's no salary data yet to filter by month."
            className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-[14px] bg-[#F3BF23] px-[18px] text-sm font-bold text-[#1E1E1E] opacity-90 hover:bg-[#E5B11A]"
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            This Month
            <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
          </button>

          {/* Refresh/Export — understated but visibly boxed icon buttons,
              honestly disabled: there is nothing to re-fetch (no API call
              exists on this page at all) and nothing to export (no rows
              exist), so these stay real-but-inert rather than looking
              clickable with nothing behind them. */}
          <div className="flex shrink-0 items-center gap-[10px]">
            <button
              type="button"
              disabled
              title="There's no salary data yet to refresh."
              aria-label="Refresh (not available yet)"
              className="inline-flex h-[42px] w-[42px] cursor-not-allowed items-center justify-center rounded-xl border border-[#ECECEC] bg-white text-[#3F5468]"
            >
              <RefreshCw className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled
              title="There's no salary data yet to export."
              aria-label="Export (not available yet)"
              className="inline-flex h-[42px] w-[42px] cursor-not-allowed items-center justify-center rounded-xl border border-[#ECECEC] bg-white text-[#3F5468]"
            >
              <Download className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="relative z-10 flex min-h-[230px] flex-1 flex-col items-center justify-center px-6 pb-5 text-center">
          <SalaryEmptyIllustration className="h-[92px] w-[92px]" />
          <p className="mt-2.5 text-xl font-extrabold text-[#0E1C35]">Not available yet</p>
          <p className="mt-1.5 max-w-[640px] text-sm leading-relaxed text-[#6A7C91]">
            Salary and payslip tracking isn&apos;t available yet — the backend has no salary, wage, or advance data for employees.
          </p>
        </div>
      </section>
    </div>
  );
}
