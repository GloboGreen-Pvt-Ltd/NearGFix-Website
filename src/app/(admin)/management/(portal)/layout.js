'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { getToken, setToken, setRole } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

// Higher-level section label for the topbar (breadcrumbs/title live in-page).
// Routes are flat under /management/, so the old startsWith('/admin/master')
// style grouping is gone — the section is keyed off the first path segment.
const SECTION_BY_SLUG = {
  // Master Data
  'device-categories': 'Master Admin',
  brands: 'Master Admin',
  'category-brand-mapping': 'Master Admin',
  series: 'Master Admin',
  models: 'Master Admin',
  'repair-services': 'Master Admin',
  'repair-categories': 'Master Admin',
  'technician-work-statuses': 'Master Admin',
  // Sell Flow Master Data
  'screening-questions': 'Master Admin',
  'condition-categories': 'Master Admin',
  'condition-groups': 'Master Admin',
  'functional-issues': 'Master Admin',
  'device-configuration': 'Master Admin',
  // Customer App Directory
  banners: 'Customer App Directory',
  'support-contacts': 'Customer App Directory',
  'faq-items': 'Customer App Directory',
  'app-content': 'Customer App Directory',
  'shop-directory': 'Customer App Directory',
  // Marketplace
  items: 'Marketplace',
  // Standalone sections
  shops: 'Shop Management',
  'user-management': 'User Management',
  users: 'Shop Staff',
  subscriptions: 'Subscriptions',
};

function deriveSection(pathname) {
  if (!pathname) return 'Admin';
  const slug = pathname.split('/').filter(Boolean)[1]; // ['management', <slug>, …]
  return SECTION_BY_SLUG[slug] || 'Dashboard';
}

// Avatar initial from the JWT email/sub claim (no user endpoint needed).
function initialFromToken() {
  try {
    const t = getToken();
    const payload = JSON.parse(atob(t.split('.')[1]));
    const s = payload.email || payload.sub || 'A';
    return String(s).charAt(0).toUpperCase();
  } catch {
    return 'A';
  }
}

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* Close the phone drawer on route change. */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mounted) return;
    if (!getToken()) {
      router.replace('/management');
    }
  }, [mounted, router, pathname]);

  const handleLogout = () => {
    setToken(null);
    setRole(null);
    router.replace('/management');
  };

  const section = useMemo(() => deriveSection(pathname), [pathname]);
  const initial = mounted ? initialFromToken() : 'A';

  if (!mounted || !getToken()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-admin-dark">
        <p className="text-admin-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-admin-dark">
      <Sidebar onLogout={handleLogout} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex flex-1 min-w-0 flex-col">
        <header className="sticky top-0 z-30 h-16 shrink-0 flex items-center justify-between gap-3 border-b border-admin-border bg-white px-4 sm:px-6 md:static">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-admin-dark md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{section}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border text-slate-500 hover:bg-admin-dark hover:text-slate-700"
              aria-label="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-admin-accent text-sm font-semibold text-white" title="Account">
              {initial}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
