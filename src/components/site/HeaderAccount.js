'use client';

/**
 * HeaderAccount — the customer sign-in / account control for the public site
 * header. Two states, driven by customerAuth:
 *   • signed out  → a "Login" affordance that opens the customer OTP LoginModal
 *   • signed in   → an avatar + first name that opens a small account menu
 *
 * The site header previously linked "Login" straight to /management, which is the
 * ADMIN portal — wrong door for a customer. This owns the customer door instead;
 * the admin portal still lives in the footer ("Admin Portal").
 *
 * Renders three layouts via `variant`:
 *   • "desktop" (default) — compact control for header row 1 (lg+)
 *   • "mobile"            — full-width block for the disclosure panel (below lg)
 *   • "icon"              — single icon button for the mobile row-1 quick-access
 *                           cluster (below lg, alongside the hamburger); opens
 *                           the same LoginModal signed out, links to the
 *                           profile page signed in
 *
 * Hydration: the server (and the very first client render) cannot know the
 * localStorage session, so it renders the signed-out shell until mounted, then
 * subscribe() keeps it in sync with login/logout across this and other tabs.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  LayoutGrid,
  LogOut,
  MapPin,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  User,
} from 'lucide-react';

import { Button, cx } from './ui';
import LoginModal from './LoginModal';
import { logout, readCustomer, subscribe } from '@/lib/customerAuth';
import { initialsOf } from './account/ui';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

const MENU_LINKS = [
  // The account entry is the editable personal-information screen, matching
  // the customer app's “My Account” action.
  { href: '/account/profile', label: 'My Account', icon: LayoutGrid },
  { href: '/account/orders', label: 'My Orders', icon: ShoppingBag },
  { href: '/account/cart', label: 'My Cart', icon: ShoppingCart },
  { href: '/account/devices', label: 'Manage My Device', icon: Smartphone },
  { href: '/account/addresses', label: 'Manage Address', icon: MapPin },
];

function firstName(name) {
  const n = String(name || '').trim();
  if (!n) return 'Account';
  return n.split(/\s+/)[0];
}

function CustomerAvatar({ customer, className, textClassName = 'text-xs' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = customer?.profileImageUrl;

  useEffect(() => setImageFailed(false), [imageUrl]);

  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-600 font-bold text-white',
        className,
      )}
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={textClassName}>{initialsOf(customer?.fullName)}</span>
      )}
    </span>
  );
}

export default function HeaderAccount({ variant = 'desktop', size = 'md', onNavigate, className }) {
  const [mounted, setMounted] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    setCustomer(readCustomer());
    const unsub = subscribe((c) => setCustomer(c));
    return unsub;
  }, []);

  /* Close the desktop dropdown on outside click / Escape. */
  useEffect(() => {
    if (!menuOpen) return undefined;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const signedIn = mounted && Boolean(customer);
  // size='lg' (desktop only): the round icon button used in the site header.
  const large = size === 'lg';

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    if (onNavigate) onNavigate();
  };

  /* ----------------------------------------------------------------------- */
  /* Icon — single button for the mobile row-1 quick-access cluster           */
  /* ----------------------------------------------------------------------- */
  if (variant === 'icon') {
    return (
      <>
        {signedIn ? (
          <Link
            href="/account/profile"
            aria-label="My Account"
            className={cx(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-line transition hover:bg-brand-soften',
              FOCUS_RING,
              className,
            )}
          >
            <CustomerAvatar customer={customer} className="h-7 w-7" textClassName="text-[11px]" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            aria-label="Login"
            className={cx(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-line text-brand-ink transition hover:bg-brand-soften',
              FOCUS_RING,
              className,
            )}
          >
            <User className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSuccess={() => setLoginOpen(false)}
        />
      </>
    );
  }

  /* ----------------------------------------------------------------------- */
  /* Mobile — full-width block inside the header disclosure panel             */
  /* ----------------------------------------------------------------------- */
  if (variant === 'mobile') {
    if (!signedIn) {
      return (
        <>
          <Button
            variant="outline"
            size="md"
            onClick={() => setLoginOpen(true)}
            className="w-full"
          >
            Login
          </Button>
          <LoginModal
            open={loginOpen}
            onClose={() => setLoginOpen(false)}
            onSuccess={() => setLoginOpen(false)}
          />
        </>
      );
    }
    return (
      <div className="rounded-2xl border border-brand-line bg-brand-50/50 p-3">
        <div className="flex items-center gap-3">
          <CustomerAvatar customer={customer} className="h-10 w-10" textClassName="text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-brand-ink">
              {customer.fullName || 'Welcome'}
            </p>
            <p className="truncate text-xs text-brand-muted">{customer.mobile || customer.email}</p>
          </div>
        </div>
        <ul className="mt-3 flex flex-col gap-0.5">
          {MENU_LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-brand-ink',
                  'hover:bg-white',
                  FOCUS_RING,
                )}
              >
                <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={handleLogout}
          className={cx(
            'mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2',
            'text-sm font-semibold text-red-600 transition hover:bg-red-50',
            FOCUS_RING,
          )}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Log out
        </button>
      </div>
    );
  }

  /* ----------------------------------------------------------------------- */
  /* Desktop — compact control for header row 1 (lg+)                         */
  /* ----------------------------------------------------------------------- */
  if (!signedIn) {
    return (
      <>
        {large ? (
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            aria-label="Login"
            title="Login"
            className={cx(
              'hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-line bg-white text-brand-ink transition',
              'hover:bg-brand-soften lg:inline-flex',
              FOCUS_RING,
            )}
          >
            <User className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className={cx(
              'hidden items-center gap-2 rounded-xl border border-brand-line px-3 py-1.5 text-left transition',
              'hover:border-brand-300 hover:bg-brand-soften lg:inline-flex',
              FOCUS_RING,
            )}
          >
            <User className="h-5 w-5 shrink-0 text-brand-muted" aria-hidden="true" />
            <span className="text-sm font-bold text-brand-ink">Login</span>
          </button>
        )}
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onSuccess={() => setLoginOpen(false)}
        />
      </>
    );
  }

  return (
    <div ref={wrapRef} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={large ? 'My Account' : undefined}
        className={cx(
          large
            ? 'inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-line bg-white'
            : 'inline-flex items-center gap-2 rounded-xl border border-brand-line bg-white py-1.5 pl-2 pr-3',
          'text-left transition hover:border-brand-300 hover:bg-brand-soften',
          FOCUS_RING,
        )}
      >
        <CustomerAvatar customer={customer} className="h-8 w-8" />
        <span className={cx('leading-tight', large && 'sr-only')}>
          <span className="block max-w-[7rem] truncate text-[11px] font-medium text-brand-muted">
            Hello, {firstName(customer.fullName)}
          </span>
          <span className="block text-sm font-bold text-brand-ink">My Account</span>
        </span>
        <ChevronDown
          className={cx('h-4 w-4 shrink-0 text-brand-muted transition', menuOpen && 'rotate-180', large && 'hidden')}
          aria-hidden="true"
        />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-2xl border border-brand-line bg-white shadow-lift"
        >
          <div className="flex items-center gap-3 border-b border-brand-line bg-brand-50/60 px-4 py-3">
            <CustomerAvatar customer={customer} className="h-9 w-9" textClassName="text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-brand-ink">
                {customer.fullName || 'Welcome'}
              </p>
              <p className="truncate text-xs text-brand-muted">
                {customer.mobile || customer.email}
              </p>
            </div>
          </div>
          <ul className="py-1.5">
            {MENU_LINKS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className={cx(
                    'flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-brand-ink transition',
                    'hover:bg-brand-soften',
                    FOCUS_RING,
                  )}
                >
                  <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-brand-line py-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className={cx(
                'flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-red-600 transition',
                'hover:bg-red-50',
                FOCUS_RING,
              )}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
