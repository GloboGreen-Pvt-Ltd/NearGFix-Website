'use client';

/**
 * NotificationsDropdown — the top bar's bell. There is no shop notification
 * feed endpoint in this web client, so the list is built from the shop's own
 * real data, fetched when the panel opens:
 *   - unread customer messages   GET {MARKETPLACE_BASE}/shop/chats
 *   - bookings from the last 48h GET {ORDER_BASE}/repair-bookings/shop
 *   - pickups still pending      (same bookings list)
 * The red dot counts items newer than the last time the panel was opened
 * (kept per browser in localStorage); nothing here is invented.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CalendarPlus, Loader2, MessageSquare, Truck } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { readShopOwner } from '@/lib/shopAuth';
import { fetchShopBookings, fetchShopChats, openEnquiries, pendingPickups } from '@/lib/shopDashboard';

// Per shop: a switched/other shop's 'last seen' never hides this shop's new items.
const SEEN_PREFIX = 'ggfix_notifications_seen_at';
const seenKey = () => `${SEEN_PREFIX}:${readShopOwner()?.shopId || 'none'}`;
const RECENT_MS = 48 * 60 * 60 * 1000;
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';

function readSeen() {
  try {
    return Number(localStorage.getItem(seenKey())) || 0;
  } catch {
    return 0;
  }
}

function writeSeen(ts) {
  try {
    localStorage.setItem(seenKey(), String(ts));
  } catch {
    /* storage unavailable — the dot just won't remember */
  }
}

function timeAgo(iso) {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function buildItems(bookings, chats) {
  const now = Date.now();
  const items = [];
  for (const c of openEnquiries(chats)) {
    items.push({
      key: `chat-${c.id}`,
      icon: MessageSquare,
      title: `New message from ${c.counterpartName || 'a customer'}`,
      detail: c.lastMessagePreview || `${c.unreadCount} unread`,
      at: c.lastMessageAt,
      href: `/shop-home/services/enquiries/?thread=${encodeURIComponent(c.id)}`,
    });
  }
  for (const b of bookings) {
    const t = new Date(b.createdAt).getTime();
    if (t && now - t <= RECENT_MS) {
      items.push({
        key: `booking-${b.id}`,
        icon: CalendarPlus,
        title: `New booking${b.bookingNumber ? ` #${b.bookingNumber}` : ''}`,
        detail: [b.customerName, b.deviceDisplayName || b.modelName].filter(Boolean).join(' · ') || 'Repair booking',
        at: b.createdAt,
        href: `/shop-home/services/bookings/view/details/?id=${encodeURIComponent(b.id)}`,
      });
    }
  }
  for (const b of pendingPickups(bookings)) {
    items.push({
      key: `pickup-${b.id}`,
      icon: Truck,
      title: `Pickup pending — ${b.customerName || 'Customer'}`,
      detail: b.deviceDisplayName || b.modelName || 'Device pickup',
      at: b.updatedAt || b.createdAt,
      href: '/shop-home/services/pickups',
    });
  }
  return items.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 25);
}

export default function NotificationsDropdown({ shopId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [seenAt, setSeenAt] = useState(0);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [bookings, chats] = await Promise.allSettled([fetchShopBookings(), fetchShopChats()]);
    if (bookings.status === 'rejected' && chats.status === 'rejected') {
      setError('Could not load notifications. Check your connection and try again.');
    }
    setItems(buildItems(bookings.value || [], chats.value || []));
    setLoading(false);
  }, []);

  // Load once per shop (for the dot), and again every time the panel opens.
  useEffect(() => {
    setSeenAt(readSeen());
    load();
  }, [load, shopId]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => rootRef.current && !rootRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unseen = items.filter((i) => new Date(i.at || 0).getTime() > seenAt).length;

  const toggle = () => {
    if (!open) {
      load();
      const now = Date.now();
      writeSeen(now);
      // Keep the current dots visible inside the panel; clear the bell's count.
      setTimeout(() => setSeenAt(now), 0);
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unseen ? `Notifications (${unseen} new)` : 'Notifications'}
        aria-expanded={open}
        className={cx('relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#666666] hover:bg-[#F8F8F8]', FOCUS_RING)}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unseen ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F84141] px-1 text-[10px] font-bold text-white">
            {unseen > 9 ? '9+' : unseen}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-40 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] shadow-[0_16px_40px_rgba(30,30,30,0.14)] max-sm:fixed max-sm:inset-x-4 max-sm:top-[4.25rem] max-sm:w-auto">
          <div className="flex items-center justify-between border-b border-[#ECECEC] px-4 py-3">
            <p className="text-sm font-bold text-[#111111]">Notifications</p>
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#98A2B3]" aria-hidden="true" /> : null}
          </div>
          <div className="max-h-[min(420px,calc(100dvh-8.5rem))] overflow-y-auto overscroll-contain">
            {error ? (
              <p className="px-4 py-6 text-center text-sm text-[#F84141]">{error}</p>
            ) : !items.length && !loading ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-6 w-6 text-[#D0D5DD]" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-[#344054]">You&apos;re all caught up</p>
                <p className="mt-0.5 text-xs text-[#98A2B3]">New bookings, pickups and customer messages show up here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#ECECEC]">
                {items.map((i) => (
                  <li key={i.key}>
                    <Link href={i.href} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-3 transition hover:bg-[#F3F3F3]">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3] text-[#111111]">
                        <i.icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[#111111]">{i.title}</span>
                        <span className="block truncate text-xs text-[#666666]">{i.detail}</span>
                        <span className="mt-0.5 block text-[11px] text-[#98A2B3]">{timeAgo(i.at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
