'use client';

/**
 * /shop-home/reports — landing/overview page for the Reports section.
 *
 * Didn't exist as a route before this. In the current header-based nav
 * (HeaderNav.js's desktop mega-menu, MobileNavDrawer.js's accordion) the
 * "Reports" section label only ever opens/closes its dropdown — it never
 * navigated anywhere. This page gives it a real destination, styled as a
 * pill switcher (Services/Employee/Reports) + a colored-icon card grid,
 * per a reference design.
 *
 * The Services/Employee pills link to the first real leaf item in their
 * own PARTNER_NAV section (services/book-service, employee/team) since
 * neither of those sections has its own landing page (yet) to point at
 * instead — same "always point at something real" rule the rest of this
 * dashboard follows, rather than a dead/placeholder link.
 *
 * Every row below is a real item straight from PARTNER_NAV's `reports`
 * section (src/lib/partnerNav.js) — same label, icon and href every other
 * nav destination already has (most still resolve to the shared
 * ComingSoon stub until a real page is built at that path). No new data
 * here, just a second way to reach the same destinations.
 *
 * 2026-09: trimmed to exactly 4 of the 13 real PARTNER_NAV report items
 * (REPORTS_VISIBLE_KEYS, below), shown as a 2x2 premium card grid — the
 * other 9 (Revenue, Employee, Pickup, Booking, Delivery, Customer, Sales,
 * Expense, Payment Report) are deliberately not rendered here; they're
 * still real, reachable pages (HeaderNav's dropdown and the mobile drawer
 * still list all 13, since PARTNER_NAV itself — the shared data source for
 * both of those — is untouched), just not shown on this particular page
 * anymore.
 */

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import Icon3D from '@/components/shop-dashboard/Icon3D';
import { PARTNER_NAV } from '@/lib/partnerNav';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

const SERVICES_SECTION = PARTNER_NAV.find((s) => s.key === 'services');
const EMPLOYEE_SECTION = PARTNER_NAV.find((s) => s.key === 'employee');
const REPORTS_SECTION = PARTNER_NAV.find((s) => s.key === 'reports');

// Exactly these 4 report items (same as the sidebar's Reports menu) — every other report
// item that exists in PARTNER_NAV is intentionally excluded from this page.
const REPORTS_VISIBLE_KEYS = ['overview', 'revenue', 'reports-service-report', 'cash-book'];
const REPORTS_VISIBLE_ITEMS = REPORTS_VISIBLE_KEYS.map((k) => REPORTS_SECTION.items.find((i) => i.key === k)).filter(Boolean);

// Cycled per card, matching a reference design's mint/blue/violet/teal
// tinted-card look — same cycling convention the Dashboard's Quick Nav
// widget already uses for its own tiles.
const REPORT_CARD_STYLES = [
  { bg: 'bg-[#F3F3F3]', iconTone: 'green', arrow: 'bg-white/80 text-[#035C6C] group-hover:bg-white' },
  { bg: 'bg-[#F8F8F8]', iconTone: 'blue', arrow: 'bg-white/80 text-[#2196F3] group-hover:bg-white' },
  { bg: 'bg-[#F8F8F8]', iconTone: 'violet', arrow: 'bg-white/80 text-[#8B5CF6] group-hover:bg-white' },
  { bg: 'bg-[#F8F8F8]', iconTone: 'teal', arrow: 'bg-white/80 text-[#0D9488] group-hover:bg-white' },
];

const PILLS = [
  { key: 'services', label: 'Services', icon: SERVICES_SECTION.icon, href: `/shop-home/${SERVICES_SECTION.items[0].slug}` },
  { key: 'employee', label: 'Employee', icon: EMPLOYEE_SECTION.icon, href: `/shop-home/${EMPLOYEE_SECTION.items[0].slug}` },
  { key: 'reports', label: 'Reports', icon: REPORTS_SECTION.icon, href: '/shop-home/reports' },
];

export default function ReportsLandingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Every report NearGFix tracks for your business, in one place." />

      <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[#ECECEC] bg-white p-1 [scrollbar-width:none]">
        {PILLS.map((pill) => {
          const Icon = pill.icon;
          const active = pill.key === 'reports';
          return (
            <Link
              key={pill.key}
              href={pill.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition sm:px-4',
                FOCUS_RING,
                active ? 'bg-[#024A57] text-white' : 'text-[#344054] hover:bg-[#F8F8F8]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {pill.label}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {REPORTS_VISIBLE_ITEMS.map((item, i) => {
          const Icon = item.icon;
          const style = REPORT_CARD_STYLES[i % REPORT_CARD_STYLES.length];
          return (
            <Link
              key={item.key}
              href={`/shop-home/${item.slug}`}
              title={item.description}
              className={cx(
                'group flex min-h-[92px] items-center gap-3.5 rounded-2xl border border-[#ECECEC] p-4 transition hover:-translate-y-0.5',
                style.bg,
                FOCUS_RING,
              )}
            >
              <Icon3D icon={Icon} tone={style.iconTone} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-[#111111]">{item.label}</p>
                <p className="mt-0.5 truncate text-xs text-[#666666]">{item.description}</p>
              </div>
              <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition', style.arrow)}>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
