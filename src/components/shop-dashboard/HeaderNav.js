'use client';

/**
 * HeaderNav — the NearGFix Partner Dashboard's top header, replacing the old
 * left sidebar (Sidebar.js, 2026-09 redesign) with a compact header-based
 * layout: brand, mega-menu dropdowns for each nav section, global search,
 * help/notification icons, and the profile dropdown, all in one sticky bar.
 * A slim second row underneath carries the page title + breadcrumb that
 * used to live in TopNavbar.js (now folded into this file).
 *
 * Reads the exact same PARTNER_NAV/DASHBOARD_ITEM data and active-route
 * logic as MobileNavDrawer.js — one source of truth for "what's in the
 * nav" on both desktop and mobile, nothing here is a second definition.
 *
 * The search field is real (controlled input, keyboard-usable) but not
 * wired to any results — there is no existing search backend for shop
 * bookings/customers/devices to call into. It behaves like a normal text
 * field; it just doesn't filter anything yet (unchanged from the old
 * TopNavbar's own documented behavior).
 */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bell, CircleHelp, ChevronDown, Menu, Search } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { BRAND } from '@/lib/siteContent';
import { DASHBOARD_ITEM, PARTNER_NAV, resolveNavContext } from '@/lib/partnerNav';
import Breadcrumbs from './Breadcrumbs';
import ProfileDropdown from './ProfileDropdown';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

// The header's Reports dropdown shows only these 4 real PARTNER_NAV report
// items, in this exact order — everything else in that section (Revenue,
// Employee, Pickup, Booking, Delivery, Customer, Sales, Expense, Payment
// Report) is still a real, reachable page; it's just not listed in this
// particular dropdown. PARTNER_NAV itself is untouched, so
// MobileNavDrawer.js and the Reports landing page's own item list are each
// free to show a different subset (or all 13) without this filter
// affecting them.
const REPORTS_MENU_KEYS = ['overview', 'reports-service-report', 'profit-loss', 'cash-book'];

function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[#DC2626] px-1.5 text-[0.65rem] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavMenu({ section, activeItemKey, badges, openKey, setOpenKey }) {
  const ref = useRef(null);
  const open = openKey === section.key;
  const hasActive = section.items.some((item) => item.key === activeItemKey);
  const SectionIcon = section.icon;
  const wide = section.items.length > 6;

  useEffect(() => {
    if (!open) return undefined;
    function onDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpenKey(null);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpenKey(null);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpenKey]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpenKey(open ? null : section.key)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cx(
          'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition',
          FOCUS_RING,
          hasActive || open
            ? 'bg-[#F3F3F3] text-[#024A57]'
            : 'text-[#344054] hover:bg-[#F8F8F8]',
        )}
      >
        <SectionIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {section.label}
        <ChevronDown className={cx('h-3.5 w-3.5 shrink-0 text-[#98A2B3] transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className={cx(
            'absolute left-0 top-[calc(100%+0.5rem)] z-50 rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] p-2 shadow-[0_1px_3px_rgba(16,24,40,0.08),0_12px_28px_rgba(16,24,40,0.1)]',
            wide ? 'grid w-[560px] grid-cols-2 gap-0.5' : 'w-72',
          )}
        >
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = item.key === activeItemKey;
            return (
              <Link
                key={item.key}
                href={`/shop-home/${item.slug}`}
                role="menuitem"
                onClick={() => setOpenKey(null)}
                title={item.description}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  active ? 'bg-[#F3F3F3] text-[#024A57] font-semibold' : 'text-[#344054] hover:bg-[#F8F8F8]',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <NavBadge count={badges?.[item.key]} />
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function HeaderNav({ pathname, shopOwner, badges, onOpenMobileMenu }) {
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState(null);
  const { title } = resolveNavContext(pathname);
  const activeItem = PARTNER_NAV.flatMap((s) => s.items).find((item) => `/shop-home/${item.slug}` === (pathname || '').replace(/\/+$/, ''));
  const DashboardIcon = DASHBOARD_ITEM.icon;
  const dashboardActive = pathname === '/shop-home';

  return (
    <header className="sticky top-0 z-40 border-b border-[#ECECEC] bg-white/95 shadow-[0_2px_12px_rgba(17,17,17,0.04)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
          className={cx('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#344054] hover:bg-[#F8F8F8] lg:hidden', FOCUS_RING)}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <Link href="/shop-home" className="mr-2 flex shrink-0 items-center gap-2">
          <Image src={BRAND.logo} alt="" width={30} height={30} className="h-[30px] w-[30px] shrink-0 rounded-xl object-contain" />
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-extrabold leading-tight text-[#111111]">NearGFix Partner</p>
            <p className="truncate text-[0.68rem] text-[#666666]">Business Dashboard</p>
          </div>
        </Link>

        <nav aria-label="Partner dashboard" className="hidden shrink-0 items-center gap-0.5 lg:flex">
          <Link
            href={DASHBOARD_ITEM.href}
            aria-current={dashboardActive ? 'page' : undefined}
            className={cx(
              'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition',
              FOCUS_RING,
              dashboardActive
                ? 'bg-[#F3F3F3] text-[#024A57]'
                : 'text-[#344054] hover:bg-[#F8F8F8]',
            )}
          >
            <DashboardIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {DASHBOARD_ITEM.label}
          </Link>
          {PARTNER_NAV.map((section) => {
            const menuSection =
              section.key === 'reports'
                ? { ...section, items: REPORTS_MENU_KEYS.map((k) => section.items.find((i) => i.key === k)).filter(Boolean) }
                : section;
            return <NavMenu key={section.key} section={menuSection} activeItemKey={activeItem?.key} badges={badges} openKey={openKey} setOpenKey={setOpenKey} />;
          })}
        </nav>

        <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
          <div className="flex w-full max-w-sm items-center gap-2 rounded-full border border-[#D0D5DD] bg-[#F8F8F8] px-4 py-2 transition focus-within:border-brand-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100">
            <Search className="h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bookings, customers, devices..."
              aria-label="Search"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#98A2B3]"
            />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href="/faq"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Help & support (opens in a new tab)"
            className={cx('hidden h-10 w-10 items-center justify-center rounded-full text-[#666666] hover:bg-[#F8F8F8] sm:inline-flex', FOCUS_RING)}
          >
            <CircleHelp className="h-5 w-5" aria-hidden="true" />
          </a>
          <button
            type="button"
            aria-label="Notifications"
            className={cx('relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#666666] hover:bg-[#F8F8F8]', FOCUS_RING)}
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </button>

          <span className="mx-1 hidden h-6 w-px bg-[#EAECF0] sm:block" aria-hidden="true" />

          <ProfileDropdown shopOwner={shopOwner} />
        </div>
      </div>

      <div className="border-t border-[#ECECEC] px-4 py-2 sm:px-6">
        <p className="truncate text-sm font-bold leading-tight text-[#111111]">{title}</p>
        <Breadcrumbs />
      </div>
    </header>
  );
}
