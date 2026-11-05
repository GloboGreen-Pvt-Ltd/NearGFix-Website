'use client';

/**
 * AccountSidebar — the persistent left rail of the "My Account" area. Mirrors the
 * app's ProfileScreen hub: a green-gradient identity card, the ACCOUNT
 * destinations (Personal Information · Cart · Manage My Device · Manage Address),
 * a MY ORDERS group (Service · Pickup · Buy · Sell · Enquiry — each opens
 * /account/orders/?tab=…, the list OrdersExperience shows), a Log out
 * button, and a small secondary group for the app's SUPPORT items (which already
 * exist as public pages, so they link out rather than duplicate).
 *
 * On lg+ it is a sticky column; below lg the layout renders it as a horizontal
 * scroller above the content (see account/layout.js), so the same nav serves
 * both without a second markup path.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  HelpCircle,
  Info,
  LifeBuoy,
  LogOut,
  MapPin,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  Truck,
  User,
  Wrench,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import { logout } from '@/lib/customerAuth';
import { initialsOf } from './ui';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

const NAV = [
  { href: '/account/profile', label: 'Personal Information', icon: User, exact: false },
  { href: '/account/cart', label: 'My Cart', icon: ShoppingCart, exact: false },
  { href: '/account/devices', label: 'Manage My Device', icon: Smartphone, exact: false },
  { href: '/account/addresses', label: 'Manage Address', icon: MapPin, exact: false },
];

// My Orders — one entry per order type; the tab rides in the URL.
const ORDER_TYPES = [
  { tab: 'service', label: 'Service', icon: Wrench },
  { tab: 'pickup', label: 'Pickup', icon: Truck },
  { tab: 'buy', label: 'Buy', icon: ShoppingBag },
  { tab: 'sell', label: 'Sell', icon: Tag },
  { tab: 'enquiry', label: 'Enquiry', icon: MessageCircle },
];

const SUPPORT = [
  { href: '/contact', label: 'Customer Support', icon: LifeBuoy },
  { href: '/faq', label: 'FAQ', icon: HelpCircle },
  { href: '/about', label: 'About Us', icon: Info },
  { href: '/terms', label: 'Terms & Conditions', icon: FileText },
];

function useIsActive() {
  const pathname = usePathname();
  const current = pathname && pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname || '/';
  return (href, exact) => {
    const target = href.replace(/\/+$/, '');
    return exact ? current === target : current === target || current.startsWith(`${target}/`);
  };
}

function SidebarAvatar({ customer }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = customer?.profileImageUrl;

  useEffect(() => setImageFailed(false), [imageUrl]);

  return (
    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-base font-extrabold">
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : initialsOf(customer?.fullName)}
    </span>
  );
}

function OrdersNavItems({ onOrders }) {
  const params = useSearchParams();
  const current = (params.get('tab') || 'service').toLowerCase();
  return ORDER_TYPES.map(({ tab, label, icon: Icon }) => {
    const active = onOrders && current === tab;
    return (
      <li key={tab} className="shrink-0 lg:shrink">
        <Link
          href={`/account/orders/?tab=${tab}`}
          aria-current={active ? 'page' : undefined}
          className={cx(
            'flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition lg:whitespace-normal',
            FOCUS_RING,
            active ? 'bg-brand-soft text-brand-700' : 'text-brand-ink hover:bg-brand-soften',
          )}
        >
          <Icon className={cx('h-4 w-4 shrink-0', active ? 'text-brand-700' : 'text-brand-600')} aria-hidden="true" />
          {label}
        </Link>
      </li>
    );
  });
}

export default function AccountSidebar({ customer }) {
  const isActive = useIsActive();

  return (
    <aside className="lg:sticky lg:top-28">
      {/* Identity card — green gradient, matching the app's profile header. */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500 p-4 text-white shadow-soft lg:p-5">
        <div className="flex items-center gap-3">
          <SidebarAvatar customer={customer} />
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold leading-tight">
              {customer?.fullName || 'Welcome User'}
            </p>
            <p className="truncate text-sm text-white/80">
              {customer?.mobile || customer?.email || ''}
            </p>
          </div>
        </div>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Verified
        </span>
      </div>

      {/* Primary account nav */}
      <nav className="mt-3 lg:mt-4" aria-label="Account">
        <p className="px-2 pb-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-brand-subtle">
          Account
        </p>
        <ul className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin] lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <li key={href} className="shrink-0 lg:shrink">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition lg:whitespace-normal',
                    FOCUS_RING,
                    active
                      ? 'bg-brand-soft text-brand-700'
                      : 'text-brand-ink hover:bg-brand-soften',
                  )}
                >
                  <Icon
                    className={cx('h-4 w-4 shrink-0', active ? 'text-brand-700' : 'text-brand-600')}
                    aria-hidden="true"
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* My Orders — Service / Pickup / Buy / Sell / Enquiry */}
      <nav className="mt-3 lg:mt-4" aria-label="My orders">
        <p className="px-2 pb-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-brand-subtle">My Orders</p>
        <ul className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin] lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          {/* useSearchParams needs a Suspense boundary under static export. */}
          <Suspense fallback={null}>
            <OrdersNavItems onOrders={isActive('/account/orders', false)} />
          </Suspense>
        </ul>
      </nav>

      {/* Secondary — support links (already live public pages) */}
      <nav className="mt-4 hidden lg:block" aria-label="Support">
        <p className="px-2 pb-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-brand-subtle">
          Help & more
        </p>
        <ul className="flex flex-col gap-0.5">
          {SUPPORT.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-brand-muted transition hover:bg-brand-soften hover:text-brand-ink',
                  FOCUS_RING,
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-brand-subtle" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <button
        type="button"
        onClick={() => logout()}
        className={cx(
          'mt-4 hidden w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 lg:flex',
          'text-sm font-semibold text-red-600 transition hover:bg-red-50',
          FOCUS_RING,
        )}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Log out
      </button>
    </aside>
  );
}
