'use client';

/**
 * TopNavbar — sticky header for the Partner Dashboard shell.
 *
 * The search field is real (controlled input, keyboard-usable) but not
 * wired to any results — there is no existing search backend for shop
 * bookings/customers/devices to call into, and the brief is explicit not to
 * fabricate one. It behaves like a normal text field; it just doesn't filter
 * anything yet.
 */

import { useState } from 'react';
import Link from 'next/link';
import { CircleHelp, Menu, MessageSquare, Search } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { resolveNavContext } from '@/lib/partnerNav';
import Breadcrumbs from './Breadcrumbs';
import NotificationsDropdown from './NotificationsDropdown';
import ProfileDropdown from './ProfileDropdown';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

export default function TopNavbar({ pathname, onOpenMobileMenu, shopOwner, badges }) {
  const unreadEnquiries = badges?.enquiries || 0;
  const [query, setQuery] = useState('');
  const { title } = resolveNavContext(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-[#ECECEC] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open menu"
          className={cx('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#344054] hover:bg-[#F8F8F8] lg:hidden [@media(min-width:768px)_and_(min-height:560px)]:hidden', FOCUS_RING)}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="min-w-0 shrink-0">
          <p className="truncate text-base font-bold leading-tight text-[#111111]">{title}</p>
          <div className="hidden sm:block">
            <Breadcrumbs />
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-[#D0D5DD] bg-[#F8F8F8] px-3.5 py-2 transition focus-within:border-brand-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100">
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
          <Link
            href="/shop-home/services/enquiries"
            aria-label={unreadEnquiries ? `Enquiries (${unreadEnquiries} unread)` : 'Enquiries'}
            title="Enquiries"
            className={cx(
              'relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#F8F8F8]',
              pathname?.startsWith('/shop-home/services/enquiries') ? 'bg-[#F3F3F3] text-[#035C6C]' : 'text-[#666666]',
              FOCUS_RING,
            )}
          >
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
            {unreadEnquiries ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F84141] px-1 text-[10px] font-bold text-white">
                {unreadEnquiries > 9 ? '9+' : unreadEnquiries}
              </span>
            ) : null}
          </Link>
          <NotificationsDropdown shopId={shopOwner?.shopId} />

          <span className="mx-1 hidden h-6 w-px bg-[#EAECF0] sm:block" aria-hidden="true" />

          <ProfileDropdown shopOwner={shopOwner} />
        </div>
      </div>
    </header>
  );
}
