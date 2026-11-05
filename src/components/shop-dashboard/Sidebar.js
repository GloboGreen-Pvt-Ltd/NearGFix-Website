'use client';

/**
 * Sidebar — the NearGFix Partner Dashboard left navigation (DashboardShell).
 *
 * Menu, top to bottom: Dashboard · Services ▾ · Buy · Sell · Employee ▾ ·
 * Customers · Enquiries · Reports ▾ · Settings ▾, then Help & Support.
 * Everything comes from lib/partnerNav.js (same routes as before); Customers,
 * Enquiries and Marketplace are direct shortcuts to their existing Services
 * pages, and Sell opens the Sell a Device flow. Nav badges (pickups / bookings / enquiries) are the shell's.
 *
 * Three renders of the same content:
 *   lg+     full 240px sidebar, sticky, full height
 *   md–lg   76px icon rail (section icons open the full list in a flyout)
 *   < md    slide-in drawer, opened from the top bar's menu button
 */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, CircleHelp, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { BRAND } from '@/lib/siteContent';
import { DASHBOARD_ITEM, PARTNER_NAV, PARTNER_NAV_FLAT, resolveNavContext } from '@/lib/partnerNav';
import { isOwnerSession } from '@/lib/shopAccess';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';

const itemByKey = (key) => PARTNER_NAV_FLAT.find((i) => i.key === key);
const sectionByKey = (key) => PARTNER_NAV.find((s) => s.key === key);

// Sidebar order: direct links and collapsible sections.
const MENU = [
  { type: 'dashboard' },
  { type: 'link', key: 'overview' },
  { type: 'section', key: 'services' },
  { type: 'link', key: 'marketplace' },
  { type: 'link', key: 'sell' },
  { type: 'section', key: 'employee' },
  { type: 'link', key: 'customers' },
  { type: 'link', key: 'enquiries' },
  { type: 'section', key: 'reports' },
  { type: 'section', key: 'settings' },
];

const ROW = 'relative flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-[14px] font-semibold transition';
const ROW_ACTIVE = 'bg-[#F3F3F3] text-[#035C6C]';
const ROW_IDLE = 'text-[#111111] hover:bg-[#F3F3F3]';

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[#F84141] px-1.5 text-[0.65rem] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function Brand({ collapsed, shopOwner }) {
  return (
    <Link href="/shop-home" className={cx('flex items-center gap-2.5 px-4 py-4', collapsed && 'justify-center px-2')}>
      <Image src={BRAND.logo} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-contain" />
      {!collapsed ? (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-extrabold text-[#111111]">NearGFix Partner</span>
          <span className="block truncate text-[12px] text-[#666666]">Business Dashboard</span>
          {shopOwner?.shopName ? <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#035C6C]">{shopOwner.shopName}</span> : null}
        </span>
      ) : null}
    </Link>
  );
}

function NavLink({ href, label, icon: Icon, active, collapsed, badge, onNavigate }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cx(ROW, collapsed && 'justify-center px-0', FOCUS_RING, active ? ROW_ACTIVE : ROW_IDLE)}
    >
      <Icon className={cx('h-[19px] w-[19px] shrink-0', active ? 'text-[#035C6C]' : 'text-[#666666]')} aria-hidden="true" />
      {!collapsed ? <span className="truncate">{label}</span> : null}
      {!collapsed ? <Badge count={badge} /> : badge ? <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-[#F84141]" aria-hidden="true" /> : null}
    </Link>
  );
}

function Section({ section, open, onToggle, activeKey, directKeys = [], badges, onNavigate }) {
  const Icon = section.icon;
  // A page that has its own top-level shortcut (Customers, Enquiries, Buy) lights up that row, not this section.
  const hasActive = !directKeys.includes(activeKey) && section.items.some((i) => i.key === activeKey);
  const sectionBadge = section.items.reduce((n, i) => n + (badges?.[i.key] || 0), 0);
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className={cx(ROW, FOCUS_RING, hasActive && !open ? ROW_ACTIVE : ROW_IDLE)}>
        <Icon className={cx('h-[19px] w-[19px] shrink-0', hasActive ? 'text-[#035C6C]' : 'text-[#666666]')} aria-hidden="true" />
        <span className="flex-1 truncate text-left">{section.label}</span>
        {!open ? <Badge count={sectionBadge} /> : null}
        <ChevronDown className={cx('h-4 w-4 shrink-0 text-[#98A2B3] transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div className={cx('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <ul className="ml-[1.35rem] mt-0.5 space-y-0.5 border-l border-[#ECECEC] py-1 pl-3">
            {section.items.map((item) => {
              const ItemIcon = item.icon;
              const active = item.key === activeKey;
              return (
                <li key={item.key}>
                  <Link
                    href={`/shop-home/${item.slug}`}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] font-medium transition',
                      FOCUS_RING,
                      active ? 'bg-[#F3F3F3] font-semibold text-[#035C6C]' : 'text-[#475467] hover:bg-[#F3F3F3] hover:text-[#111111]',
                    )}
                  >
                    <ItemIcon className={cx('h-4 w-4 shrink-0', active ? 'text-[#035C6C]' : 'text-[#98A2B3]')} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                    <Badge count={badges?.[item.key]} />
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

/** Icon-rail section: the section icon opens its items in a flyout to the right. */
function RailSection({ section, activeKey, directKeys = [], badges }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const Icon = section.icon;
  // A page that has its own top-level shortcut (Customers, Enquiries, Buy) lights up that row, not this section.
  const hasActive = !directKeys.includes(activeKey) && section.items.some((i) => i.key === activeKey);
  const hasBadge = section.items.some((i) => badges?.[i.key]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={section.label}
        aria-label={section.label}
        aria-expanded={open}
        className={cx(ROW, 'justify-center px-0', FOCUS_RING, hasActive || open ? ROW_ACTIVE : ROW_IDLE)}
      >
        <Icon className={cx('h-[19px] w-[19px]', hasActive || open ? 'text-[#035C6C]' : 'text-[#666666]')} aria-hidden="true" />
        {hasBadge ? <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-[#F84141]" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div className="absolute left-[calc(100%+10px)] top-0 z-50 w-60 rounded-[14px] border border-[#ECECEC] bg-[#F8F8F8] p-2 shadow-[0_12px_32px_rgba(16,24,40,0.12)]">
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-[#98A2B3]">{section.label}</p>
          {section.items.map((item) => {
            const ItemIcon = item.icon;
            const active = item.key === activeKey;
            return (
              <Link
                key={item.key}
                href={`/shop-home/${item.slug}`}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] font-medium transition',
                  active ? 'bg-[#F3F3F3] font-semibold text-[#035C6C]' : 'text-[#475467] hover:bg-[#F3F3F3] hover:text-[#111111]',
                )}
              >
                <ItemIcon className={cx('h-4 w-4 shrink-0', active ? 'text-[#035C6C]' : 'text-[#98A2B3]')} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
                <Badge count={badges?.[item.key]} />
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function Sidebar({ mobileOpen, onCloseMobile, shopOwner, badges }) {
  const pathname = usePathname();
  const clean = (pathname || '').replace(/\/+$/, '') || '/shop-home';
  const { sectionKey } = resolveNavContext(pathname);
  // Every Sell a Device step (select-brand through listed) keeps Sell highlighted;
  // Buy's details and cart pages keep Buy highlighted.
  const activeKey =
    PARTNER_NAV_FLAT.find((i) => i.href === clean)?.key ||
    (clean.startsWith('/shop-home/sell/') ? 'sell' : clean.startsWith('/shop-home/services/marketplace/') ? 'marketplace' : undefined);

  // Open the section holding the current page; a direct shortcut (Customers/Enquiries/Marketplace) keeps its section closed.
  const directKeys = MENU.filter((m) => m.type === 'link').map((m) => m.key);
  const activeSection = directKeys.includes(activeKey) ? null : sectionKey;
  const [openSection, setOpenSection] = useState(activeSection);
  useEffect(() => {
    if (activeSection) setOpenSection(activeSection);
  }, [activeSection]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onCloseMobile();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen, onCloseMobile]);

  const toggle = (key) => setOpenSection((cur) => (cur === key ? null : key));

  function menu({ collapsed, onNavigate }) {
    return MENU.map((m) => {
      if (m.type === 'dashboard') {
        return <NavLink key="dashboard" href={DASHBOARD_ITEM.href} label={DASHBOARD_ITEM.label} icon={DASHBOARD_ITEM.icon} active={clean === '/shop-home'} collapsed={collapsed} onNavigate={onNavigate} />;
      }
      if (m.type === 'link') {
        const item = itemByKey(m.key);
        if (!item) return null;
        return <NavLink key={item.key} href={item.href} label={item.label} icon={item.icon} active={activeKey === item.key} collapsed={collapsed} badge={badges?.[item.key]} onNavigate={onNavigate} />;
      }
      const fullSection = sectionByKey(m.key);
      if (!fullSection) return null;
      // Owner-only items (e.g. Subscription & Plan) are never rendered for a shop login.
      const owner = isOwnerSession(shopOwner);
      // inSection:false items (Customers, Enquiries, Buy, Sell) live only as their own top-level links.
      const section = { ...fullSection, items: fullSection.items.filter((i) => (owner || !i.ownerOnly) && i.inSection !== false) };
      return collapsed ? (
        <RailSection key={section.key} section={section} activeKey={activeKey} directKeys={directKeys} badges={badges} />
      ) : (
        <Section key={section.key} section={section} open={openSection === section.key} onToggle={() => toggle(section.key)} activeKey={activeKey} directKeys={directKeys} badges={badges} onNavigate={onNavigate} />
      );
    });
  }

  function footer({ collapsed, onNavigate }) {
    return (
      <div className="shrink-0 border-t border-[#ECECEC] p-2.5">
        <a
          href="/faq"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          title={collapsed ? 'Help & Support' : undefined}
          aria-label={collapsed ? 'Help & Support (opens in a new tab)' : undefined}
          className={cx(ROW, collapsed && 'justify-center px-0', FOCUS_RING, ROW_IDLE)}
        >
          <CircleHelp className="h-[19px] w-[19px] shrink-0 text-[#666666]" aria-hidden="true" />
          {!collapsed ? <span className="truncate">Help &amp; Support</span> : null}
        </a>
      </div>
    );
  }

  return (
    <>
      {/* lg+: full sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-[#ECECEC] bg-white lg:flex">
        <div className="shrink-0 border-b border-[#ECECEC]">
          <Brand shopOwner={shopOwner} />
        </div>
        <nav aria-label="Partner dashboard" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2.5 py-3">
          {menu({ collapsed: false })}
        </nav>
        {footer({ collapsed: false })}
      </aside>

      {/* md–lg: icon rail */}
      <aside className="sticky top-0 z-40 hidden h-screen w-[76px] shrink-0 flex-col border-r border-[#ECECEC] bg-white [@media(min-width:768px)_and_(max-width:1023px)_and_(min-height:560px)]:flex">
        <div className="shrink-0 border-b border-[#ECECEC]">
          <Brand collapsed />
        </div>
        <nav aria-label="Partner dashboard" className="min-h-0 flex-1 space-y-1 px-2.5 py-3">
          {menu({ collapsed: true })}
        </nav>
        {footer({ collapsed: true })}
      </aside>

      {/* < md: drawer */}
      <div className={cx('fixed inset-0 z-50 lg:hidden [@media(min-width:768px)_and_(min-height:560px)]:hidden', !mobileOpen && 'pointer-events-none')} aria-hidden={!mobileOpen}>
        <div onClick={onCloseMobile} className={cx('absolute inset-0 bg-[#1E1E1E]/50 transition-opacity duration-200', mobileOpen ? 'opacity-100' : 'opacity-0')} />
        <div
          className={cx(
            'absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col bg-white shadow-[0_24px_60px_rgba(16,24,40,0.25)] transition-transform duration-200',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#ECECEC] pr-2">
            <div className="min-w-0 flex-1">
              <Brand shopOwner={shopOwner} />
            </div>
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close menu"
              className={cx('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#666666] hover:bg-[#F3F3F3]', FOCUS_RING)}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Partner dashboard" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2.5 py-3">
            {menu({ collapsed: false, onNavigate: onCloseMobile })}
          </nav>
          {footer({ collapsed: false, onNavigate: onCloseMobile })}
        </div>
      </div>
    </>
  );
}
