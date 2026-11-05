'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from '@/components/PortalLink';
import Image from 'next/image';
import { usePathname } from '@/lib/portalNavigation';
import {
  ArrowRight,
  CircleHelp,
  Headset,
  Home,
  Info,
  Mail,
  MapPin,
  Menu,
  Package,
  QrCode,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Tag,
  Truck,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';

import { BRAND, SITE_NAV, CTA } from '@/lib/siteContent';
import { Button, cx, desktopNavItemClass } from './ui';
import SiteSearch from './SiteSearch';
import LocationControl from './LocationControl';
import HeaderAccount from './HeaderAccount';
import HeaderCart from './HeaderCart';
import CategoryNavMenu from './CategoryNavMenu';

// "Sell with Us" opens the seller homepage (src/app/sell-with-us); shop owners sign in from there.
const SELL_WITH_US_HREF = 'https://shop.neargfix.com/';

/**
 * Icon shown before each nav label in the mobile panel (the desktop menu row
 * is text only). Keyed by href.
 */
const NAV_ICONS = {
  '/': Home,
  '/repair': Wrench,
  '/#sell': Tag,
  '/#buy': Smartphone,
  '/nearby-shops': Store,
  '/#pickup-delivery': Truck,
  '/about': Info,
  '/faq': CircleHelp,
  '/contact': Mail,
};

/**
 * Nav items that open a device-category dropdown (CategoryNavMenu), keyed by
 * href → category-menu type. On desktop all three do; in the mobile panel only
 * Repair does, since every Sell / Buy row lands on the same home-page section
 * and an accordion there would only add a tap.
 */
const CATEGORY_MENUS = { '/repair': 'REPAIR', '/#sell': 'SELL', '/#buy': 'BUY' };

/**
 * Header menu = SITE_NAV plus "Pickup & Delivery" after Nearby Shops, which
 * opens the dedicated /pickup-delivery page. The icon key stays separate from
 * the href so the Truck icon lookup is unaffected.
 */
const HEADER_NAV = SITE_NAV.flatMap((item) =>
  item.href === '/nearby-shops'
    ? [item, { href: '/pickup-delivery', label: 'Pickup & Delivery', iconKey: '/#pickup-delivery' }]
    : [item],
);

/** Left out of the desktop menu card (none today — About, FAQ and Contact all show). */
const DESKTOP_HIDDEN_HREFS = [];

/** Trust strip, left side. Statements only — none of these are links. */
const TRUST_POINTS = [
  { label: BRAND.taglineShort, icon: ShieldCheck, show: 'flex' },
  { label: '100% Genuine Parts', icon: Settings, show: 'hidden lg:flex' },
  { label: 'Certified Technicians', icon: UserCheck, show: 'hidden xl:flex' },
  { label: 'Secure & Safe Service', icon: ShieldCheck, show: 'hidden xl:flex' },
];

/** Trust strip, right side — every one a real route. */
const UTILITY_LINKS = [
  { href: '/nearby-shops', label: 'Find nearby shops', icon: MapPin, show: 'hidden md:block' },
  { href: '/account/orders', label: 'Track Order', icon: Package, show: 'block' },
  { href: '/faq', label: 'Help', icon: CircleHelp, show: 'block' },
  { href: '/contact', label: 'Support', icon: Headset, show: 'block' },
];

/* -------------------------------------------------------------------------- */
/* Active route                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Exactly one nav item may render as active.
 *
 * Several items are in-page anchors on the home page ('/', '/#sell', '/#buy',
 * '/#repair'). usePathname() returns '/' for all of them and never includes
 * the hash, so any naive normalise-and-compare lights up all of them at once.
 *
 * The deliberate rule: an item is only ever active if its href has NO hash.
 * Hash items are section jumps, not destinations, so on the home page only
 * "Home" is highlighted.
 */
function isActive(pathname, href) {
  if (!pathname || !href) return false;
  if (href.includes('#')) return false;

  // trailingSlash: true means pathname can arrive as '/about/' or '/about'.
  const current = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
  const target = href !== '/' ? href.replace(/\/+$/, '') : '/';

  if (target === '/') return current === '/';
  return current === target || current.startsWith(`${target}/`);
}

/* -------------------------------------------------------------------------- */
/* Shared classes                                                              */
/* -------------------------------------------------------------------------- */

/* ring-brand-700: brand-500 misses the 3:1 non-text contrast floor (WCAG 1.4.11). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

/* The trust strip is green, so its focus ring is white. */
const FOCUS_RING_ON_GREEN =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700';

const ICON_BUTTON = cx(
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-line bg-white',
  'text-brand-ink transition hover:bg-brand-soften',
  FOCUS_RING,
);

/** Same left/right edges as ui.js's Container, so the header lines up with the page. */
const CONTAINER = 'mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8';

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * SiteHeader — sticky public-site header, three bands on lg+:
 *   1. green trust / utility strip
 *   2. identity + search + tools (location, cart, account, Sell with Us)
 *   3. a floating rounded menu card, with "Get the App" on its right
 *
 * The trust strip collapses (max-height + opacity) once the page has been
 * scrolled past a few pixels, row 2 gets shorter and the header gains a soft
 * shadow — a compact, still-sticky state. Purely visual: nothing remounts, so
 * no state (search query, open menu, login modal) is lost when it happens.
 * The compact lg+ height has to stay under the home page's anchor offset
 * (ANCHOR_OFFSET in app/(customer)/page.js) or section jumps land under it.
 *
 * Below lg the menu row is dropped: the menu opens from the hamburger (left of
 * the logo) into a disclosure panel, and row 2 keeps location, cart and an
 * account icon. Below md the search moves to its own full-width row.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const panelId = useId();

  const menuButtonRef = useRef(null);
  const firstPanelLinkRef = useRef(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const toggleMenu = useCallback(() => setMenuOpen((value) => !value), []);

  /* Route changes close the menu. Same-page hash jumps don't change the
   * pathname — the onClick handlers on the panel links cover that case. */
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  /* -- scroll: collapse the utility bar, compact the header ---------------- */
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* -- Escape + scroll lock ------------------------------------------------ */
  useEffect(() => {
    if (!menuOpen) return undefined;

    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      // Components inside the panel (the Repair submenu, the search listbox)
      // mark Escape handled while their own popup is open, so one press closes
      // that popup without also tearing down the menu around it.
      if (event.defaultPrevented) return;
      setMenuOpen(false);
      // Return focus to the trigger (WCAG 2.4.3).
      if (menuButtonRef.current) menuButtonRef.current.focus();
    }

    document.addEventListener('keydown', onKeyDown);

    /* The panel itself scrolls (max-h + overflow-y-auto below), so locking the
     * body is safe. */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  /* Move focus into the panel when it opens. */
  useEffect(() => {
    if (!menuOpen) return;
    if (firstPanelLinkRef.current) firstPanelLinkRef.current.focus();
  }, [menuOpen]);

  const navLinkClass = (active, size) => {
    if (size === 'lg') {
      // Mobile panel — a pill still reads well as a full-width tap target.
      return cx(
        'flex items-center gap-2.5 rounded-full px-4 py-3 text-base font-semibold transition',
        FOCUS_RING,
        active
          ? 'bg-brand-soft text-brand-700'
          : 'text-brand-muted hover:bg-brand-soften hover:text-brand-ink',
      );
    }
    // Desktop menu card — text only, underline hover, no active style (see ui.js).
    return desktopNavItemClass();
  };

  return (
    /* No overflow clipping anywhere on the header: the search listbox, the
     * account menu and the category menus are absolutely positioned children
     * and must be allowed to spill below it. */
    <header
      className={cx(
        'sticky top-0 z-50 border-b border-brand-line bg-white',
        'transition-shadow duration-200',
        scrolled && 'shadow-soft',
      )}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Row 1 — green trust / utility strip                                 */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={cx(
          'hidden overflow-hidden bg-gradient-to-r from-brand-800 via-brand-700 to-brand-600 text-white',
          'transition-[max-height,opacity] duration-200 sm:block',
          scrolled ? 'max-h-0 opacity-0' : 'max-h-9 opacity-100',
        )}
      >
        <div className={cx(CONTAINER, 'flex h-9 items-center justify-between gap-6 text-xs')}>
          <ul className="flex min-w-0 items-center font-semibold">
            {TRUST_POINTS.map(({ label, icon: Icon, show }, index) => (
              <li
                key={label}
                className={cx(
                  show,
                  'min-w-0 items-center gap-2 whitespace-nowrap',
                  index > 0 && 'ml-5 border-l border-white/25 pl-5',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">{label}</span>
              </li>
            ))}
          </ul>
          <ul className="flex shrink-0 items-center gap-5 font-medium">
            {UTILITY_LINKS.map(({ href, label, icon: Icon, show }, index) => (
              <li
                key={href}
                className={cx(show, index === 0 && 'md:border-r md:border-white/25 md:pr-5')}
              >
                <Link
                  href={href}
                  className={cx(
                    'flex items-center gap-1.5 whitespace-nowrap rounded text-white/95 transition hover:text-white hover:underline hover:underline-offset-4',
                    FOCUS_RING_ON_GREEN,
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <nav aria-label="Primary" className={CONTAINER}>
        {/* ---------------------------------------------------------------- */}
        {/* Row 2 — identity + search + tools                                 */}
        {/* ---------------------------------------------------------------- */}
        <div
          className={cx(
            'flex items-center gap-2 transition-[height] duration-200 sm:gap-3 xl:gap-4',
            scrolled ? 'h-16' : 'h-16 lg:h-[72px]',
          )}
        >
          <button
            ref={menuButtonRef}
            type="button"
            onClick={toggleMenu}
            aria-expanded={menuOpen}
            aria-controls={panelId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className={cx(ICON_BUTTON, 'lg:hidden')}
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <Link
            href="/"
            className={cx('flex shrink-0 items-center gap-2.5 rounded-2xl py-1 lg:gap-3', FOCUS_RING)}
            aria-label={`${BRAND.name} home`}
          >
            <Image
              src={BRAND.logo}
              alt={BRAND.logoAlt}
              width={56}
              height={56}
              priority
              className={cx(
                'shrink-0 rounded-full object-contain transition-[height,width] duration-200',
                scrolled ? 'h-10 w-10' : 'h-10 w-10 lg:h-12 lg:w-12',
              )}
            />
            <span className="hidden leading-none min-[380px]:block">
              <span className="block text-[22px] font-extrabold tracking-tight text-brand-ink lg:text-[26px]">
                {BRAND.name}
              </span>
              <span className="mt-1 hidden whitespace-nowrap text-[11px] font-medium text-brand-muted sm:block">
                Repair <span aria-hidden="true">•</span> Buy <span aria-hidden="true">•</span> Sell
              </span>
            </span>
          </Link>

          {/* Search — the flexible, dominant element. min-w-0 lets it shrink
              inside the flex row instead of forcing the row wider. */}
          <div className="hidden min-w-0 flex-1 md:flex lg:ml-2 xl:ml-4">
            <SiteSearch size="lg" />
          </div>

          {/* Spacer below md, where search has its own row. */}
          <div className="min-w-0 flex-1 md:hidden" aria-hidden="true" />

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 xl:gap-3">
            <LocationControl size="lg" />

            <span className="hidden h-8 w-px bg-brand-line lg:block" aria-hidden="true" />

            <HeaderCart size="lg" />

            {/* Below lg: icon-only account. lg+: round icon, with the account
                dropdown when signed in. */}
            <HeaderAccount variant="icon" className="lg:hidden" />
            <HeaderAccount size="lg" />

            {/* Business / shop-owner door — the Sell with NearGFix homepage
                (/sell-with-us). Deliberately a separate control from
                HeaderAccount. Below lg it lives in the menu panel. */}
            <Link
              href={SELL_WITH_US_HREF}
              aria-label="Sell with Us"
              title="Sell with Us"
              className={cx(
                'hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white',
                'shadow-glow transition hover:bg-brand-700 lg:inline-flex',
                FOCUS_RING,
              )}
            >
              <Store className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Search row (below md). */}
        <div className="pb-3 md:hidden">
          <SiteSearch size="lg" />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Row 3 — floating menu card (lg+)                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="hidden pb-2 lg:block">
          <div className="flex items-center justify-between gap-3 rounded-3xl border border-brand-line bg-white p-1 shadow-soft">
            <ul className="flex min-w-0 items-center gap-0.5">
              {HEADER_NAV.filter((item) => !DESKTOP_HIDDEN_HREFS.includes(item.href)).map((item) => {
                const active = isActive(pathname, item.href);
                const service = CATEGORY_MENUS[item.href];
                if (service) {
                  return (
                    <li key={`d-${item.href}-${item.label}`}>
                      <CategoryNavMenu service={service} label={item.label} href={item.href} />
                    </li>
                  );
                }
                return (
                  <li key={`d-${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={navLinkClass(active)}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <Link
              href={CTA.getApp.href}
              className={cx(
                'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-brand-100 bg-brand-50 pl-1 pr-1 text-sm font-bold text-brand-700 xl:pl-4',
                'transition hover:border-brand-200 hover:bg-brand-soft',
                FOCUS_RING,
              )}
            >
              <Sparkles className="hidden h-[18px] w-[18px] shrink-0 xl:block" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only xl:not-sr-only">Get the App</span>
              <ArrowRight className="hidden h-4 w-4 shrink-0 xl:block" aria-hidden="true" />
              <span className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-700 ring-1 ring-brand-100">
                <QrCode className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Mobile / tablet panel (below lg)                                  */}
        {/* ---------------------------------------------------------------- */}
        <div
          id={panelId}
          hidden={!menuOpen}
          className="max-h-[calc(100dvh-8rem)] overflow-y-auto overscroll-contain border-t border-brand-line pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 lg:hidden"
        >
          {/* Account — Customer Login + Sell with Us, kept visibly separate. */}
          <div>
            <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-brand-subtle">
              Account
            </p>
            <div className="flex flex-col gap-2">
              <HeaderAccount variant="mobile" onNavigate={closeMenu} />
              <Button
                href={SELL_WITH_US_HREF}
                variant="primary"
                size="md"
                icon="Store"
                iconPosition="left"
                onClick={closeMenu}
                className="w-full"
              >
                Sell with Us
              </Button>
            </div>
          </div>

          <div className="mt-5 border-t border-brand-line pt-5">
            <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-brand-subtle">
              Navigation
            </p>
            <ul className="flex flex-col gap-1">
              {HEADER_NAV.map((item, index) => {
                const active = isActive(pathname, item.href);
                if (item.href === '/repair') {
                  return (
                    <li key={`m-${item.href}-${item.label}`}>
                      <CategoryNavMenu
                        service="REPAIR"
                        label={item.label}
                        href={item.href}
                        variant="mobile"
                        active={active}
                        icon={NAV_ICONS[item.href]}
                        onNavigate={closeMenu}
                      />
                    </li>
                  );
                }
                const Icon = NAV_ICONS[item.iconKey || item.href];
                return (
                  <li key={`m-${item.href}-${item.label}`}>
                    <Link
                      ref={index === 0 ? firstPanelLinkRef : undefined}
                      href={item.href}
                      onClick={closeMenu}
                      aria-current={active ? 'page' : undefined}
                      className={navLinkClass(active, 'lg')}
                    >
                      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-5 border-t border-brand-line pt-5">
            <Link
              href={CTA.getApp.href}
              onClick={closeMenu}
              className={cx(
                'flex h-12 w-full items-center justify-between rounded-full border border-brand-100 bg-brand-50 pl-4 pr-1.5 text-base font-bold text-brand-700',
                FOCUS_RING,
              )}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                Get the App
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-brand-100">
                <QrCode className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
