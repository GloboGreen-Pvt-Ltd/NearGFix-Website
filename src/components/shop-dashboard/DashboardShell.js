'use client';

/**
 * DashboardShell — the Partner Dashboard's layout chrome (header nav +
 * mobile drawer) plus its auth guard, shared across every route under
 * /shop-home/* via src/app/shop-home/layout.js.
 *
 * 2026-09-30: left-sidebar layout (Sidebar.js: full sidebar on desktop, icon
 * rail on tablet, drawer on phones) + TopNavbar.js (title, breadcrumb,
 * search, help, notifications, profile) over the page content. The former
 * header-only nav (HeaderNav.js / MobileNavDrawer.js) is no longer mounted.
 *
 * The guard is the exact same check src/app/shop-home/page.js used to do
 * itself (isLoggedIn() from src/lib/shopAuth.js, redirect to
 * the business home page, /sell-with-us/, if absent) — moved up to the layout so it protects every
 * dashboard route once, instead of being duplicated across ~30 pages.
 *
 * Nav badges (Pickups / Bookings / Enquiries) are fetched once here — not
 * per-page — since the header persists across navigation. Each of the
 * calls is independently caught so one failing endpoint doesn't
 * blank every badge. Leave Management and Notifications intentionally never
 * get a badge: there is no backend endpoint in this web client to compute
 * either count for real, and a fabricated number is worse than none.
 *
 * Switching shop (SwitchAccountSheet -> switchShop) swaps the stored token
 * and emits a new session. The badges re-fetch and <main> is keyed on the
 * active shopId, so the current page remounts and loads that shop's data —
 * nothing from the previous shop stays on screen.
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { canOpenRoute } from '@/lib/shopAccess';
import { isLoggedIn, readShopOwner, subscribe } from '@/lib/shopAuth';
import { fetchShopBookings, fetchShopChats, fetchTicketCounts, openEnquiries, pendingPickups, sumActiveRepairs } from '@/lib/shopDashboard';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';

export default function DashboardShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [shopOwner, setShopOwner] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badges, setBadges] = useState({});

  useEffect(() => {
    setMounted(true);
    setShopOwner(readShopOwner());
    const unsub = subscribe((session) => setShopOwner(session));
    return unsub;
  }, []);

  useEffect(() => {
    if (!mounted || !isLoggedIn()) return;
    let alive = true;
    setBadges({}); // no stale counts from a previous shop while these load

    fetchShopBookings()
      .then((bookings) => {
        if (!alive) return;
        setBadges((b) => ({ ...b, pickups: pendingPickups(bookings).length }));
      })
      .catch(() => {});

    fetchTicketCounts()
      .then((counts) => {
        if (!alive) return;
        setBadges((b) => ({ ...b, bookings: sumActiveRepairs(counts) }));
      })
      .catch(() => {});

    fetchShopChats()
      .then((chats) => {
        if (!alive) return;
        setBadges((b) => ({ ...b, enquiries: openEnquiries(chats).length }));
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [mounted, shopOwner?.shopId]);

  useEffect(() => {
    if (!mounted) return;
    // Signed out (logout, expired session, Back after logout): the plain business
    // home page — the login popup is never opened automatically.
    if (!isLoggedIn()) router.replace('/sell-with-us/');
  }, [mounted, router]);

  // Owner-only pages (lib/shopAccess.js): a shop login that opens one by URL goes to its dashboard.
  const routeAllowed = !mounted || canOpenRoute(readShopOwner(), pathname);
  useEffect(() => {
    if (mounted && isLoggedIn() && !routeAllowed) router.replace('/shop-home');
  }, [mounted, routeAllowed, router]);

  /* Close the mobile drawer on route change. */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!mounted || !isLoggedIn() || !routeAllowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" aria-hidden="true" />
      </div>
    );
  }

  // Every dashboard page: pure white page, neutral grey (#F8F8F8 / #F3F3F3) cards.
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} shopOwner={shopOwner} badges={badges} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar pathname={pathname} shopOwner={shopOwner} badges={badges} onOpenMobileMenu={() => setMobileOpen(true)} />

      <main key={`${shopOwner?.shopId || 'shop'}:${shopOwner?.loginScope || ''}`} className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
        {children}
      </main>
      </div>
    </div>
  );
}
