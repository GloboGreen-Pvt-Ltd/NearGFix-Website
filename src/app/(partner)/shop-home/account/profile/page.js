'use client';

/**
 * /shop-home/account/profile — "My Profile".
 *
 * Real data only: every field here comes straight from the signed-in
 * shopAuth session (see src/lib/shopAuth.js) — a genuine name, shop name,
 * email and mobile number for a real logged-in shop owner, since Business
 * Login now authenticates for real (see src/lib/shopMobileAuth.js).
 *
 * The reference layout this was styled after also shows Location,
 * Department, "Joined" date, and Timezone/Language preferences — none of
 * those exist in the current session shape (no backend field for them is
 * captured here), so they're left out rather than shown as empty/fake
 * inputs. The "Edit Profile" action links to Account Settings, which is
 * still a stub — there's no real update-profile endpoint wired yet, so
 * fields here are a read-only display, not an active form.
 *
 * This is a real page under src/app/shop-home/account/profile/, so it takes
 * routing priority over the src/app/shop-home/[...slug] catch-all's
 * "Coming soon" stub for this exact path automatically.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, Mail, Pencil, Phone, ShieldCheck, Store, User } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { readShopOwner, subscribe } from '@/lib/shopAuth';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import { deriveDisplayName, initialsOf } from '@/components/shop-dashboard/ProfileDropdown';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

function formatMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return digits ? `+91 ${digits}` : null;
}

function Field({ label, icon: Icon, value }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-semibold text-[#344054]">{label}</label>
      <div className="flex items-center gap-2.5 rounded-xl border border-[#D0D5DD] bg-[#F8F8F8] px-3.5 py-2.5 text-sm font-medium text-[#111111]">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#666666]" aria-hidden="true" /> : null}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [shopOwner, setShopOwner] = useState(null);

  useEffect(() => {
    setShopOwner(readShopOwner());
    const unsub = subscribe((session) => setShopOwner(session));
    return unsub;
  }, []);

  const name = shopOwner ? deriveDisplayName(shopOwner) : '';
  const initials = initialsOf(name);
  const mobile = formatMobile(shopOwner?.mobile);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal information"
        action={
          <Link
            href="/shop-home/account/settings"
            className={cx(
              'inline-flex items-center gap-1.5 rounded-xl bg-[#101828] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D2939]',
              FOCUS_RING,
            )}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit Profile
          </Link>
        }
      />

      {/* ---- Banner + Personal Information card ---------------------------- */}
      <section className="overflow-hidden rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
        {/* Gradient identity banner */}
        <div className="relative overflow-hidden bg-[#F8F8F8] px-5 py-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white ring-4 ring-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-bold text-[#111111]">{name}</p>
              {shopOwner?.roleLabel ? <p className="text-sm text-[#344054]">{shopOwner.roleLabel}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#475467]">
                {shopOwner?.email ? (
                  <span className="flex min-w-0 items-center gap-1.5 break-all">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {shopOwner.email}
                  </span>
                ) : null}
                {shopOwner?.shopName ? (
                  <span className="flex min-w-0 items-center gap-1.5 break-words">
                    <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {shopOwner.shopName}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="border-t border-[#ECECEC] p-5 sm:p-8">
          <h2 className="mb-5 text-base font-bold text-[#111111]">Personal Information</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full Name" icon={User} value={name} />
            <Field label="Email Address" icon={Mail} value={shopOwner?.email} />
            <Field label="Mobile Number" icon={Phone} value={mobile} />
            <Field label="Business" icon={Store} value={shopOwner?.shopName} />
            <Field label="Role" icon={ShieldCheck} value={shopOwner?.roleLabel} />
          </div>
        </div>
      </section>

      {/* ---- Privacy note -------------------------------------------------- */}
      <div className="flex items-start gap-3 rounded-2xl bg-[#F3F3F3] p-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#024A57]">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold text-[#111111]">Your information is safe with us</p>
          <p className="mt-0.5 text-sm text-[#023A44]">
            Your contact details stay private and are only used for service updates.
          </p>
        </div>
      </div>
    </div>
  );
}
