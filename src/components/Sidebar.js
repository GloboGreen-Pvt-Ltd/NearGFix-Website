'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { masterApi } from '@/lib/api';
import {
  LayoutDashboard, Store, Users, CreditCard,
  Smartphone, Image as ImageIcon, Phone, HelpCircle, FileText,
  Database, Tag, Briefcase, Link2, Layers, Boxes, Wrench,
  FolderTree, Puzzle, LayoutGrid,
  ShoppingCart, ClipboardList, SlidersHorizontal, AlertTriangle, Settings2,
  ShoppingBag, Package,
  ChevronRight, ChevronDown, ChevronLeft, LogOut, X,
} from 'lucide-react';

const nav = [
  { href: '/management/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/management/shops', label: 'Shop Management', icon: Store },
  { href: '/management/user-management', label: 'User Management', icon: Users },
  // /management/users lists the staff of one selected shop — a different thing
  // from the platform-level account management above, hence the clearer label.
  { href: '/management/users', label: 'Shop Staff', icon: Users },
  {
    label: 'Master Data',
    icon: Database,
    children: [
      { href: '/management/device-categories', label: 'Categories', icon: Tag },
      { href: '/management/brands', label: 'Brands', icon: Briefcase },
      { href: '/management/category-brand-mapping', label: 'Category-Brand Mapping', icon: Link2 },
      { href: '/management/series', label: 'Series', icon: Layers },
      { href: '/management/models', label: 'Models', icon: Boxes },
      {
        href: '/management/model-compatibility',
        label: 'Model Compatibility',
        icon: Puzzle,
        // Children come from model_compatibility_types at runtime — the shop adds
        // a part type by saving a row, so this menu cannot be a code constant.
        dynamicChildren: 'compatibilityTypes',
      },
      { href: '/management/repair-services', label: 'Repair Services', icon: Wrench },
      { href: '/management/repair-categories', label: 'Repair Categories', icon: FolderTree },
      { href: '/management/category-menu', label: 'Category Menu', icon: LayoutGrid },
    ],
  },
  {
    label: 'Customer App Directory',
    icon: Smartphone,
    children: [
      { href: '/management/banners', label: 'Home Banners', icon: ImageIcon },
      { href: '/management/support-contacts', label: 'Support Contacts', icon: Phone },
      { href: '/management/faq-items', label: 'FAQ', icon: HelpCircle },
      { href: '/management/app-content', label: 'App Content (About/Terms)', icon: FileText },
    ],
  },
  {
    label: 'Sell Flow Master Data',
    icon: ShoppingCart,
    children: [
      { href: '/management/screening-questions', label: 'Screening Questions', icon: ClipboardList },
      { href: '/management/condition-categories', label: 'Condition Categories', icon: FolderTree },
      { href: '/management/condition-groups', label: 'Condition Groups', icon: SlidersHorizontal },
      { href: '/management/functional-issues', label: 'Functional Issues', icon: AlertTriangle },
      { href: '/management/device-configuration', label: 'Device Configuration', icon: Settings2 },
    ],
  },
  { href: '/management/subscriptions', label: 'Subscriptions', icon: CreditCard },
  {
    label: 'Marketplace',
    icon: ShoppingBag,
    children: [
      { href: '/management/items', label: 'Items', icon: Package },
    ],
  },
];

export default function Sidebar({ onLogout, mobileOpen = false, onCloseMobile }) {
  const pathname = usePathname();
  const [railCollapsed, setCollapsed] = useState(false);
  // Below md the sidebar is an off-canvas drawer (opened from the layout's
  // menu button), always at full width — the icon rail is tablet/desktop only.
  const collapsed = railCollapsed && !mobileOpen;

  // Accordion: only ONE group open at a time. Starts on the section that
  // contains the active route; opening another group closes the current one.
  const [open, setOpen] = useState(() => {
    for (const item of nav) {
      if (item.children?.some((c) => pathname === c.href)) return item.label;
    }
    return null;
  });

  // Part types for the Model Compatibility sub-menu. Fetched rather than listed
  // in `nav` because the shop adds a type by saving a row. A failure leaves the
  // list empty, which degrades to the plain parent link instead of a broken menu.
  const [compatibilityTypes, setCompatibilityTypes] = useState([]);
  const [subOpen, setSubOpen] = useState(null);
  const [activeType, setActiveType] = useState('');

  useEffect(() => {
    const loadTypes = () => masterApi.get('/master/model-compatibility-types')
      .then((d) => {
        const rows = Array.isArray(d) ? d : d?.content ?? [];
        setCompatibilityTypes(rows.filter((t) => t.isActive !== false));
      })
      .catch(() => {});

    loadTypes();
    // The Model Compatibility page announces edits to the type list so the menu
    // updates without a refresh. An event keeps that one-way: the page never
    // reaches into the sidebar, and a page that does not emit it costs nothing.
    window.addEventListener('ggfix:compat-types-changed', loadTypes);
    return () => window.removeEventListener('ggfix:compat-types-changed', loadTypes);
  }, []);

  // The selected type lives in ?type=, which usePathname() cannot see. Reading it
  // off the URL keeps a refresh or a pasted link highlighted; the popstate
  // listener covers browser back/forward. useSearchParams() is avoided on
  // purpose — under output:'export' it forces a Suspense boundary on every page
  // that renders this sidebar.
  useEffect(() => {
    const read = () => {
      try {
        setActiveType(new URLSearchParams(window.location.search).get('type') || '');
      } catch {
        setActiveType('');
      }
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [pathname]);

  const toggle = (label) => {
    if (collapsed) {
      // Expanding a group while collapsed first opens the rail, then the group.
      setCollapsed(false);
      setOpen(label);
      return;
    }
    setOpen((cur) => (cur === label ? null : label));
  };

  // trailingSlash:true means the served path can carry a trailing slash while
  // `nav` spells hrefs without one; compare both ends normalised so a route
  // never fails to highlight over a slash.
  const norm = (p) => String(p || '').replace(/\/+$/, '') || '/';
  const isActive = (href) => norm(pathname) === norm(String(href).split('?')[0]);
  const groupActive = (item) => item.children?.some((c) => isActive(c.href));

  /** Runtime children for a nav entry that declares `dynamicChildren`. */
  const childrenFor = (item) => (
    item.dynamicChildren === 'compatibilityTypes'
      ? compatibilityTypes.map((t) => ({
        href: `${item.href}?type=${encodeURIComponent(t.slug)}`,
        label: t.name,
        slug: t.slug,
      }))
      : []
  );

  // Landing on a parent that has a sub-menu opens it, so arriving from a link
  // does not leave the type list hidden behind a chevron.
  useEffect(() => {
    for (const group of nav) {
      const hit = group.children?.find((c) => c.dynamicChildren && isActive(c.href));
      if (hit) { setSubOpen(hit.label); return; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const itemClass = (active) =>
    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      collapsed ? 'justify-center' : ''
    } ${
      active
        ? 'bg-admin-accent text-white shadow-sm'
        : 'text-slate-300 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <>
    {mobileOpen && (
      <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onCloseMobile} aria-hidden="true" />
    )}
    <aside
      className={`${collapsed ? 'md:w-[68px]' : 'md:w-64'} fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shrink-0 bg-admin-panel border-r border-white/10 flex flex-col transition-transform duration-200 md:static md:z-auto md:max-w-none md:translate-x-0 md:transition-[width] ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand header */}
      <div className="relative flex items-center gap-3 px-4 h-16 border-b border-white/10">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 overflow-hidden">
          <Image src="/logo.png" alt="GloboGreen" width={28} height={28} className="object-contain" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">NearGFix Management Portal</p>
            <p className="truncate text-[11px] text-slate-400 leading-tight">GloboGreen · Enterprise</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 hidden md:flex h-6 w-6 items-center justify-center rounded-full bg-admin-panel border border-white/15 text-slate-300 hover:text-white hover:bg-white/10"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {nav.map((item) => {
          if (item.href) {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={itemClass(isActive(item.href))}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          }

          const GroupIcon = item.icon;
          const gActive = groupActive(item);
          const isOpen = !collapsed && open === item.label;
          return (
            <div key={item.label} className="pt-1">
              <button
                type="button"
                onClick={() => toggle(item.label)}
                aria-expanded={isOpen}
                title={collapsed ? item.label : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  gActive
                    ? 'bg-white/5 text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <GroupIcon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                  </>
                )}
              </button>
              {isOpen && (
                <div className="mt-1 ml-4 space-y-0.5 border-l border-white/10 pl-2">
                  {item.children.map((c) => {
                    const CIcon = c.icon;
                    const subs = childrenFor(c);

                    if (!subs.length) {
                      return (
                        <Link key={c.href} href={c.href} className={itemClass(isActive(c.href))}>
                          <CIcon className="h-[18px] w-[18px] shrink-0" />
                          <span className="truncate">{c.label}</span>
                        </Link>
                      );
                    }

                    const onParent = isActive(c.href);
                    const subExpanded = subOpen === c.label;
                    return (
                      <div key={c.href}>
                        {/* The label stays a link to the unfiltered list and the
                            chevron is its own button, so opening the type list
                            never forces a navigation and vice versa. */}
                        <div
                          className={`flex items-center rounded-lg transition-colors ${
                            onParent && !activeType
                              ? 'bg-admin-accent text-white shadow-sm'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <Link
                            href={c.href}
                            onClick={() => setActiveType('')}
                            className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-sm"
                          >
                            <CIcon className="h-[18px] w-[18px] shrink-0" />
                            <span className="truncate">{c.label}</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setSubOpen((cur) => (cur === c.label ? null : c.label))}
                            aria-expanded={subExpanded}
                            aria-label={`${subExpanded ? 'Collapse' : 'Expand'} ${c.label} types`}
                            className="shrink-0 px-2 py-2"
                          >
                            {subExpanded
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </div>

                        {subExpanded && (
                          <div className="mt-1 ml-4 space-y-0.5 border-l border-white/10 pl-2">
                            {subs.map((s) => (
                              <Link
                                key={s.href}
                                href={s.href}
                                onClick={() => setActiveType(s.slug)}
                                className={itemClass(onParent && activeType === s.slug)}
                              >
                                <span className="truncate">{s.label}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {onLogout && (
        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={onLogout}
            title={collapsed ? 'Log out' : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>
      )}
    </aside>
    </>
  );
}
