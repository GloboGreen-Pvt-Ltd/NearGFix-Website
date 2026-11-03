'use client';

/**
 * MobileNavDrawer — the Partner Dashboard's mobile navigation, a slide-in
 * drawer over a backdrop. This is what Sidebar.js used to be before the
 * 2026-09 header-nav redesign moved desktop navigation into HeaderNav's
 * mega-menu dropdowns; on mobile a slide-in drawer is still the clearest
 * pattern (a mega-menu doesn't fit a narrow viewport), so this file keeps
 * exactly the same NavList/SidebarSection/SidebarFooter pieces Sidebar.js
 * already had, just with the desktop-only `collapsed` branch removed — the
 * drawer is always full-width, so that branch was permanently dead here.
 *
 * Reads the same PARTNER_NAV data and the same active-route logic HeaderNav
 * uses (src/lib/partnerNav.js) — one source of truth for "what's in the
 * nav" and "what's active right now" on both desktop and mobile.
 *
 * `badges` (optional, keyed by nav-item `key`) is real, fetched data — see
 * DashboardShell for where the counts come from and why a handful of items
 * (Leave Management, Notifications) never get one: there is no backend
 * endpoint yet to compute those two honestly.
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, CircleHelp, Settings as SettingsIcon, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { BRAND } from '@/lib/siteContent';
import { DASHBOARD_ITEM, PARTNER_NAV, resolveNavContext } from '@/lib/partnerNav';
import ProfileDropdown from './ProfileDropdown';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';
const OPEN_SECTION_STORAGE_KEY = 'ggfix_partner_sidebar_open_section';

const settingsSection = PARTNER_NAV.find((section) => section.key === 'settings');

function NavBadge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[#DC2626] px-1.5 text-[0.65rem] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function DashboardLink({ active, onNavigate }) {
  const Icon = DASHBOARD_ITEM.icon;
  return (
    <Link
      href={DASHBOARD_ITEM.href}
      onClick={onNavigate}
      aria-label={DASHBOARD_ITEM.label}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
        FOCUS_RING,
        active
          ? "bg-[#F3F3F3] text-[#024A57] before:absolute before:-left-2.5 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-[#024A57] before:content-['']"
          : 'text-[#344054] hover:bg-[#F8F8F8]',
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className="truncate">{DASHBOARD_ITEM.label}</span>
    </Link>
  );
}

function NavSection({ section, open, onToggle, activeItemKey, onNavigate, badges }) {
  const hasActive = section.items.some((item) => item.key === activeItemKey);
  const SectionIcon = section.icon;
  const listId = `mobile-nav-section-${section.key}`;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={listId}
        className={cx(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition',
          FOCUS_RING,
          hasActive && !open ? 'text-[#024A57]' : 'text-[#111111] hover:bg-[#F8F8F8]',
        )}
      >
        <SectionIcon className="h-[18px] w-[18px] shrink-0 text-[#666666]" aria-hidden="true" />
        <span className="flex-1 truncate uppercase tracking-wide text-xs">{section.label}</span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-[#98A2B3] transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      <div id={listId} className={cx('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <ul className="ml-[1.55rem] mt-0.5 space-y-0.5 border-l border-[#ECECEC] py-1 pl-3">
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = item.key === activeItemKey;
              return (
                <li key={item.key}>
                  <Link
                    href={`/shop-home/${item.slug}`}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={item.description}
                    className={cx(
                      'relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition',
                      FOCUS_RING,
                      active
                        ? "bg-[#F3F3F3] text-[#024A57] font-semibold before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-[#024A57] before:content-['']"
                        : 'text-[#475467] hover:bg-[#F8F8F8] hover:text-[#111111]',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                    <NavBadge count={badges?.[item.key]} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DrawerFooter({ onNavigate, shopOwner }) {
  const firstSettingsHref = `/shop-home/${settingsSection.items[0].slug}`;

  return (
    <div className="shrink-0 border-t border-[#ECECEC] px-2.5 py-2.5">
      <div className="flex items-center gap-1">
        <a
          href="/faq"
          target="_blank"
          rel="noopener noreferrer"
          title="Help & Support"
          aria-label="Help & Support (opens in a new tab)"
          className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#666666] transition hover:bg-[#F8F8F8] hover:text-[#024A57]', FOCUS_RING)}
        >
          <CircleHelp className="h-[18px] w-[18px]" aria-hidden="true" />
        </a>
        <Link
          href={firstSettingsHref}
          onClick={onNavigate}
          title="Settings"
          aria-label="Settings"
          className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#666666] transition hover:bg-[#F8F8F8] hover:text-[#024A57]', FOCUS_RING)}
        >
          <SettingsIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-1.5">
        <ProfileDropdown shopOwner={shopOwner} menuSide="up" />
      </div>
    </div>
  );
}

export default function MobileNavDrawer({ mobileOpen, onCloseMobile, shopOwner, badges }) {
  const pathname = usePathname();
  const { sectionKey: activeSectionKey } = resolveNavContext(pathname);
  const activeItem = PARTNER_NAV.flatMap((s) => s.items).find((item) => `/shop-home/${item.slug}` === (pathname || '').replace(/\/+$/, ''));

  const [openSection, setOpenSection] = useState(() => {
    if (activeSectionKey) return activeSectionKey;
    try {
      return window.localStorage.getItem(OPEN_SECTION_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (activeSectionKey) setOpenSection(activeSectionKey);
  }, [activeSectionKey]);

  useEffect(() => {
    try {
      if (openSection) window.localStorage.setItem(OPEN_SECTION_STORAGE_KEY, openSection);
      else window.localStorage.removeItem(OPEN_SECTION_STORAGE_KEY);
    } catch {
      // Private-browsing/storage-disabled — expand state just won't persist.
    }
  }, [openSection]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') onCloseMobile();
    }
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, onCloseMobile]);

  const toggleSection = (key) => setOpenSection((current) => (current === key ? null : key));

  return (
    <div className={cx('fixed inset-0 z-50 lg:hidden', !mobileOpen && 'pointer-events-none')} aria-hidden={!mobileOpen}>
      <div
        onClick={onCloseMobile}
        className={cx('absolute inset-0 bg-[#101828]/50 transition-opacity duration-200', mobileOpen ? 'opacity-100' : 'opacity-0')}
      />
      <div
        className={cx(
          'absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col bg-white shadow-lift transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2.5 border-b border-[#ECECEC] px-4 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Image src={BRAND.logo} alt="" width={30} height={30} className="h-[30px] w-[30px] shrink-0 rounded-xl object-contain" />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold leading-tight text-[#111111]">NearGFix Partner</p>
              {shopOwner?.shopName ? <p className="truncate text-[0.68rem] font-semibold text-[#024A57]">{shopOwner.shopName}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className={cx('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#666666] hover:bg-[#F8F8F8]', FOCUS_RING)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <div className="flex-1 px-2.5 py-3">
            <DashboardLink active={pathname === '/shop-home'} onNavigate={onCloseMobile} />
            {PARTNER_NAV.map((section) => (
              <NavSection
                key={section.key}
                section={section}
                open={openSection === section.key}
                onToggle={() => toggleSection(section.key)}
                activeItemKey={activeItem?.key}
                onNavigate={onCloseMobile}
                badges={badges}
              />
            ))}
          </div>
          <DrawerFooter onNavigate={onCloseMobile} shopOwner={shopOwner} />
        </div>
      </div>
    </div>
  );
}
