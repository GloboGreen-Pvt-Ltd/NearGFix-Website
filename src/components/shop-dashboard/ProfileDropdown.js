'use client';

/**
 * ProfileDropdown — avatar + name/role trigger, opening the account menu.
 *
 * The shopAuth session can come from either real path: the original
 * email/password/OTP login() (carries { email, loginType }, never a name),
 * or the mobile Business Login flow (POST /auth/shop-login — carries
 * { mobile, name, shopName, roleLabel, loginType }, all real backend
 * fields). deriveDisplayName() prefers the real name when present, falling
 * back to something derived from email/mobile for the older path. Neither
 * path returns an avatarUrl yet, so this always falls back to initials —
 * per "do not hard-code," nothing here invents a name or picture. If
 * avatarUrl is ever added to the response, the `shopOwner?.avatarUrl`
 * branch below picks it up with no other change needed.
 */

import { useEffect, useRef, useState } from 'react';
import Link from '@/components/PortalLink';
import { useRouter } from '@/lib/portalNavigation';
import { ArrowLeftRight, ChevronDown, LogOut, Settings, Store } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { canSwitchAccount, isOwnerSession } from '@/lib/shopAccess';
import { exitOwnerMode, hasPreservedShopSession, logout } from '@/lib/shopAuth';
import BusinessLoginModal from '@/components/site/BusinessLoginModal';
import SwitchAccountSheet from './SwitchAccountSheet';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

const LOGIN_TYPE_LABEL = {
  SHOP_OWNER: 'Business Owner',
  SHOP_LOGIN: 'Business Owner',
};

/** A signed-in SHOP login (not an owner, not a /auth/me profile object). */
const isShopLogin = (s) => Boolean(s?.token) && !isOwnerSession(s);

export function deriveDisplayName(shopOwner) {
  // A shop login is the shop itself — show the shop's name, never the
  // owner's personal name (which the login response also carries).
  if (isShopLogin(shopOwner) && shopOwner.shopName) return shopOwner.shopName;
  // Real name from POST /auth/shop-login (see shopMobileAuth.js) or the
  // legacy fullName field, in that order of preference.
  if (shopOwner?.name) return shopOwner.name;
  if (shopOwner?.fullName) return shopOwner.fullName;
  if (shopOwner?.email) {
    const local = String(shopOwner.email).split('@')[0];
    if (local) {
      return local
        .replace(/[._-]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(' ');
    }
  }
  if (shopOwner?.mobile) {
    const digits = String(shopOwner.mobile).replace(/\D/g, '');
    if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    if (digits) return `+91 ${digits}`;
  }
  return 'Partner';
}

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  // A phone-number-shaped name (from the mobile-OTP path) has no letters to
  // take initials from — fall back to the last two digits instead, so the
  // avatar never shows a stray "+9".
  const firstAlpha = parts.find((p) => /[a-zA-Z]/.test(p));
  if (!firstAlpha) {
    const digits = parts.join('').replace(/\D/g, '');
    return digits.slice(-2) || '?';
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const lastAlpha = [...parts].reverse().find((p) => /[a-zA-Z]/.test(p)) || firstAlpha;
  return (firstAlpha[0] + lastAlpha[0]).toUpperCase();
}

const MENU_LINKS = [
  { href: '/shop-home/account/business-profile', label: 'Business Profile', icon: Store },
  { href: '/shop-home/account/settings', label: 'Account Settings', icon: Settings },
];

/**
 * `compact` (collapsed sidebar rail) hides the name/role/chevron and shows
 * just the avatar. `menuSide`/`menuAlign` let the sidebar's bottom-pinned
 * copy of this same trigger open its menu upward, and out to the right of a
 * narrow collapsed rail, instead of TopNavbar's default down-and-left.
 *
 * The avatar + name and the chevron beside them all open this account menu.
 * Switch Account is OWNER-only (canSwitchAccount, lib/shopAccess.js): a shop
 * login never renders the item or the sheet. The line under the name is the
 * active shop when the session has one, else the role.
 */
export default function ProfileDropdown({ shopOwner, compact = false, menuSide = 'down', menuAlign = 'right' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [ownerLoginOpen, setOwnerLoginOpen] = useState(false);
  const ownerCanSwitch = canSwitchAccount(shopOwner);
  const wrapRef = useRef(null);

  const displayName = deriveDisplayName(shopOwner);
  const roleLabel =
    shopOwner?.roleLabel || LOGIN_TYPE_LABEL[shopOwner?.loginType] || shopOwner?.loginType || 'Business Owner';
  // Owner: the active shop under their name. Shop login: its name is already the title.
  const subtitle = isShopLogin(shopOwner) ? 'Shop account' : shopOwner?.shopName || roleLabel;
  const initials = initialsOf(displayName);
  const avatarUrl = shopOwner?.avatarUrl;

  useEffect(() => {
    if (!open) return undefined;
    function onDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleLogout() {
    setOpen(false);
    // OWNER who signed in on top of a shop account: "Logout" leaves owner mode
    // only — the preserved, server-issued SHOP session becomes active again and
    // the shop's own dashboard opens directly (no OTP, no popup, no login page).
    if (isOwnerSession(shopOwner) && hasPreservedShopSession() && exitOwnerMode()) {
      router.replace('/shop-home/');
      return;
    }
    // Otherwise a full logout: clear the session, land on the plain business home
    // page. Never "?login=1" — logging out must not open the login popup.
    logout(); // clears token, session (incl. active/switched shop) and shop-scoped leftovers
    // replace(): the dashboard page isn't left as the entry Back returns to; any older
    // dashboard entry re-checks auth in DashboardShell and redirects the same way.
    router.replace('/sell-with-us/');
  }

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${displayName}${shopOwner?.shopName ? `, ${shopOwner.shopName}` : ''} — account menu`}
        title={displayName}
        className={cx(
          'flex items-center gap-2 rounded-xl border border-transparent transition hover:border-[#ECECEC] hover:bg-[#F8F8F8]',
          compact ? 'justify-center p-1' : 'py-1 pl-1 pr-2',
          FOCUS_RING,
        )}
      >
        <span
          className={cx(
            'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#035C6C] text-sm font-bold text-white',
            compact ? 'h-10 w-10' : 'h-10 w-10 sm:h-11 sm:w-11',
          )}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-supplied remote avatar, not a local asset next/image can optimise reliably.
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        {!compact ? (
          <>
            <span className="hidden text-left sm:block">
              <span className="block max-w-[9rem] truncate text-sm font-bold text-[#111111]">{displayName}</span>
              <span className="block max-w-[9rem] truncate text-xs text-[#666666]">{subtitle}</span>
            </span>
          </>
        ) : null}
      </button>
      {!compact ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Account menu"
          className={cx('ml-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] transition hover:bg-[#F8F8F8]', FOCUS_RING)}
        >
          <ChevronDown className={cx('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      ) : null}

      {open ? (
        <div
          role="menu"
          className={cx(
            'absolute z-50 max-h-[calc(100dvh-5rem)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] shadow-[0_1px_3px_rgba(16,24,40,0.08),0_12px_28px_rgba(16,24,40,0.08)]',
            menuSide === 'up' ? 'bottom-[calc(100%+0.5rem)]' : 'top-[calc(100%+0.5rem)]',
            menuAlign === 'left' ? 'left-0' : 'right-0',
          )}
        >
          <div className="flex items-center gap-3 border-b border-[#ECECEC] bg-[#F8F8F8] px-4 py-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#035C6C] text-sm font-bold text-white">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#111111]">{displayName}</p>
              <p className="truncate text-xs text-[#666666]">{subtitle}</p>
            </div>
          </div>

          <ul className="py-1.5">
            {ownerCanSwitch ? (
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setSwitcherOpen(true);
                  }}
                  className={cx('flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}
                >
                  <ArrowLeftRight className="h-4 w-4 text-[#666666]" aria-hidden="true" />
                  Switch Account
                </button>
              </li>
            ) : (
              // Shop login → sign in as the business owner (the existing Business
              // Login popup). This shop session is kept aside and comes back on owner logout.
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setOwnerLoginOpen(true);
                  }}
                  className={cx('flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}
                >
                  <ArrowLeftRight className="h-4 w-4 text-[#666666]" aria-hidden="true" />
                  Owner Login
                </button>
              </li>
            )}
            {MENU_LINKS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cx(
                    'flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F8F8F8]',
                    FOCUS_RING,
                  )}
                >
                  <Icon className="h-4 w-4 text-[#666666]" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-[#ECECEC] py-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className={cx(
                'flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-[#DC2626] transition hover:bg-red-50',
                FOCUS_RING,
              )}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      ) : null}

      {ownerCanSwitch ? <SwitchAccountSheet open={switcherOpen} shopOwner={shopOwner} onClose={() => setSwitcherOpen(false)} /> : null}
      {!ownerCanSwitch ? <BusinessLoginModal open={ownerLoginOpen} onClose={() => setOwnerLoginOpen(false)} /> : null}
    </div>
  );
}
