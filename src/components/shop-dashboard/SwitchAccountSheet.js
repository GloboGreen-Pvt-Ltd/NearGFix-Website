'use client';

/**
 * SwitchAccountSheet — "Switch Account": the signed-in owner, their shops,
 * and Add Shop. Web counterpart of the Partner app's shop switcher
 * (MyAccountScreen), same rules:
 *
 *   - Shops come from GET /auth/me `locations` (fresh on every open), falling
 *     back to the session's `shops` from login. The active one is
 *     session.shopId and shows a check.
 *   - Picking another shop calls switchShop() (POST /auth/switch-shop), which
 *     swaps the stored token; DashboardShell remounts the page on the new
 *     shopId so every count and list is re-fetched for that shop.
 *   - A shop-mobile login (loginScope SHOP) is locked to its shop by the
 *     backend — only that shop is listed, and switching / Add Shop are
 *     hidden, as in the app.
 *   - Add Shop opens the existing Business Profile → Add Business Location
 *     form.
 *
 * Bottom sheet on phones, centered dialog from sm up. Portalled to <body>:
 * the header it opens from has a backdrop-filter, which would otherwise make
 * this fixed overlay position itself inside the header bar.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Check, ChevronRight, Loader2, Plus, Store } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { switchShop } from '@/lib/shopAuth';
import { fetchMyProfile } from '@/lib/shopProfile';
import { notifyError } from '@/lib/toast';
import { deriveDisplayName, initialsOf } from './ProfileDropdown';

export default function SwitchAccountSheet({ open, shopOwner, onClose }) {
  const [shown, setShown] = useState(false);
  const [profile, setProfile] = useState(null);
  const [switchingId, setSwitchingId] = useState(null);

  const shopScoped = String(shopOwner?.loginScope || '').toUpperCase() === 'SHOP';
  const canAddShop = !shopScoped && (shopOwner?.roles || []).includes('SHOP_OWNER');

  useEffect(() => {
    if (!open) {
      setShown(false);
      return undefined;
    }
    setSwitchingId(null);
    let alive = true;
    fetchMyProfile()
      .then((me) => alive && setProfile(me))
      .catch(() => {});
    const raf = requestAnimationFrame(() => setShown(true));
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !switchingId && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, switchingId, onClose]);

  if (!open) return null;

  const activeId = String(shopOwner?.shopId || '');
  const sessionShops = Array.isArray(shopOwner?.shops) ? shopOwner.shops : [];
  const liveShops = Array.isArray(profile?.locations) && profile.locations.length ? profile.locations : null;
  // A shop-scoped session never lists the owner's other shops.
  const shops = (shopScoped ? sessionShops.filter((s) => String(s.id) === activeId) : liveShops || sessionShops).filter((s) => s?.id);

  const name = profile?.name || deriveDisplayName(shopOwner);
  const avatarUrl = profile?.avatarUrl || shopOwner?.avatarUrl;
  const activeShop = shops.find((s) => String(s.id) === activeId);
  const businessName = shopOwner?.shopName || activeShop?.name || '';

  async function pick(shop) {
    const id = String(shop.id);
    if (switchingId || id === activeId) return;
    setSwitchingId(id);
    try {
      await switchShop(id);
      onClose();
    } catch (err) {
      notifyError(err, 'Could not switch shop. Please try again.');
    } finally {
      setSwitchingId(null);
    }
  }

  return createPortal(
    <div
      className={cx(
        'fixed inset-0 z-[70] flex items-end justify-center bg-[#0B1739]/50 transition-opacity duration-200 sm:items-center sm:p-4',
        shown ? 'opacity-100' : 'opacity-0',
      )}
      onMouseDown={() => !switchingId && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="switch-account-title"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          'flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[30px] pb-[env(safe-area-inset-bottom)] sm:pb-0 bg-white transition-transform duration-300 ease-out sm:max-w-[540px] sm:rounded-[28px]',
          shown ? 'translate-y-0' : 'translate-y-full sm:translate-y-4',
        )}
      >
        <span className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-[#F3F3F3]" aria-hidden="true" />
        <div className="relative flex items-center justify-center px-5 pb-3 pt-3">
          <h2 id="switch-account-title" className="text-[17px] font-extrabold text-[#111111]">
            Switch Account
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(switchingId)}
            className="absolute right-5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[15px] font-extrabold text-[#024A57] transition hover:bg-[#F3F3F3] disabled:opacity-50"
          >
            Done
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-6 sm:px-6">
          {/* Current account */}
          <div className="flex items-center gap-3.5 border-b border-[#ECECEC] py-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#024A57] text-[17px] font-extrabold text-white">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-supplied remote avatar.
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initialsOf(name)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-extrabold text-[#111111]">{name}</p>
              {businessName ? <p className="truncate text-[13.5px] text-[#666666]">{businessName}</p> : null}
            </div>
          </div>

          {/* Your shops */}
          <p className="mb-1 mt-5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#666666]">Your Shops</p>
          <ul className="divide-y divide-[#ECECEC]">
            {shops.map((s) => {
              const active = String(s.id) === activeId;
              const busy = switchingId === String(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    disabled={active || Boolean(switchingId) || shopScoped}
                    aria-current={active ? 'true' : undefined}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-xl px-1.5 py-3.5 text-left transition',
                      active ? 'cursor-default' : 'hover:bg-[#F8F8F8] disabled:cursor-not-allowed',
                      switchingId && !busy && !active && 'opacity-50',
                    )}
                  >
                    <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', active ? 'bg-[#F3F3F3] text-[#024A57]' : 'bg-[#F3F3F3] text-[#3F7F41]')}>
                      <Store className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-[#111111]">{s.name || 'Shop'}</span>
                      {s.slug ? <span className="block truncate text-[12.5px] text-[#8FA08F]">{s.slug}</span> : null}
                    </span>
                    {busy ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#024A57]" aria-label="Switching" />
                    ) : active ? (
                      <Check className="h-5 w-5 shrink-0 text-[#024A57]" strokeWidth={3} aria-label="Current shop" />
                    ) : shopScoped ? null : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-[#98A2B3]" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}

            {canAddShop ? (
              <li>
                <Link
                  href="/shop-home/account/business-profile/?add=1"
                  onClick={onClose}
                  className="flex w-full items-center gap-3 rounded-xl px-1.5 py-3.5 transition hover:bg-[#F8F8F8]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-[#ECECEC] text-[#024A57]">
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-bold text-[#024A57]">Add Shop</span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[#98A2B3]" aria-hidden="true" />
                </Link>
              </li>
            ) : null}
          </ul>

          {shopScoped ? (
            <p className="mt-3 rounded-xl bg-[#F8F8F8] px-3.5 py-3 text-[12.5px] text-[#666666]">
              You signed in with this shop&apos;s mobile number, so this session is limited to this shop. Sign in with your personal mobile number to switch between
              your shops.
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
