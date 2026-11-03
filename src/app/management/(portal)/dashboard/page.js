'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Store, CheckCircle2, XCircle, Tag, Briefcase, Boxes, ChevronRight,
  PlusCircle, Users,
} from 'lucide-react';
import { masterApi, authApi } from '@/lib/api';
import { getToken } from '@/lib/auth';

const asArray = (d) => (Array.isArray(d) ? d : d?.content ?? []);

// Fixed hue-per-category assignment, keyed by category id so a colour always
// tracks the same category rather than shuffling when the count-sorted rank
// changes on reload.
const CATEGORY_COLORS = ['bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-brand-500', 'bg-rose-500', 'bg-cyan-500'];

function greetingName() {
  try {
    const payload = JSON.parse(atob(getToken().split('.')[1]));
    const local = String(payload.email || payload.sub || '').split('@')[0];
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Admin';
  } catch {
    return 'Admin';
  }
}

const OVERVIEW_TINTS = {
  blue: { bg: 'from-sky-50 to-white', iconBg: 'bg-sky-100', iconText: 'text-sky-600', watermark: 'text-sky-900/[0.06]' },
  green: { bg: 'from-brand-50 to-white', iconBg: 'bg-brand-100', iconText: 'text-brand-600', watermark: 'text-brand-900/[0.06]' },
  red: { bg: 'from-rose-50 to-white', iconBg: 'bg-rose-100', iconText: 'text-rose-600', watermark: 'text-rose-900/[0.06]' },
};

function OverviewCard({ title, value, caption, href, icon: Icon, tint }) {
  const t = OVERVIEW_TINTS[tint];
  return (
    <Link
      href={href}
      className={`group relative block overflow-hidden rounded-xl border border-admin-border bg-gradient-to-br ${t.bg} p-5 transition-shadow hover:shadow-md`}
    >
      <Icon className={`pointer-events-none absolute -bottom-3 -right-3 h-24 w-24 ${t.watermark}`} strokeWidth={1.5} />
      <div className="relative flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${t.iconBg}`}>
          <Icon className={`h-5 w-5 ${t.iconText}`} />
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-400 transition-colors group-hover:text-slate-600">
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
      <p className="relative mt-4 text-sm text-admin-muted">{title}</p>
      <p className="relative text-2xl font-semibold text-slate-900">{value}</p>
      {caption && <p className="relative mt-0.5 text-xs text-admin-muted">{caption}</p>}
    </Link>
  );
}

const MASTER_ACCENTS = {
  indigo: { border: 'border-l-indigo-500', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600' },
  amber: { border: 'border-l-amber-500', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
};

function MasterDataCard({ title, value, caption, href, icon: Icon, accent, action }) {
  const a = MASTER_ACCENTS[accent];
  return (
    <div className={`flex items-center gap-4 rounded-xl border border-admin-border ${a.border} border-l-4 bg-admin-card p-5 shadow-sm transition-shadow hover:shadow-md`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.iconBg}`}>
        <Icon className={`h-5 w-5 ${a.iconText}`} />
      </div>
      <Link href={href} className="min-w-0 flex-1">
        <p className="text-sm text-slate-700">{title}</p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        {caption && <p className="text-xs text-admin-muted">{caption}</p>}
      </Link>
      {action || (
        <Link
          href={href}
          aria-label={`View ${title}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-admin-border text-slate-400 hover:bg-admin-dark hover:text-slate-600"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

// Donut built from two stroke-dashed circles rather than a chart library —
// the whole dashboard is five numbers, not worth a dependency for.
function ShopsSummaryRing({ active, inactive }) {
  const total = active + inactive;
  const size = 152;
  const strokeWidth = 16;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = active > 0 && inactive > 0 ? 3 : 0;
  const activeLen = total > 0 ? Math.max(0, (active / total) * circumference - gap) : 0;
  const inactiveLen = total > 0 ? Math.max(0, circumference - activeLen - gap) : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${active} active, ${inactive} inactive shops`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      {active > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#035C6C" strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${activeLen} ${circumference - activeLen}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      {inactive > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="#EF4444" strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${inactiveLen} ${circumference - inactiveLen}`}
          strokeDashoffset={-(activeLen + gap)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900" style={{ fontSize: 26, fontWeight: 600 }}>
        {total}
      </text>
      <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle" className="fill-admin-muted" style={{ fontSize: 12 }}>
        Total
      </text>
    </svg>
  );
}

function DashboardCard({ title, action, children }) {
  return (
    <div className="flex flex-col rounded-xl border border-admin-border bg-admin-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [name, setName] = useState('Admin');
  const [stats, setStats] = useState({
    shopsTotal: 0,
    shopsActive: 0,
    shopsInactive: 0,
    categoriesCount: 0,
    brandsCount: 0,
    error: null,
  });
  const [categories, setCategories] = useState([]);
  // Kept out of `stats` because it lands on its own schedule: the shop and brand
  // numbers are three small requests, the model list is one big one, and it also
  // feeds the Top Categories breakdown once it and `categories` are both in.
  const [modelRows, setModelRows] = useState({ rows: null, loading: true, failed: false });

  useEffect(() => { setName(greetingName()); }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const [shopsR, catsR, brandsR] = await Promise.allSettled([
          authApi.get('/auth/shops'), // has isActive/status (shop-service /shops does not)
          masterApi.get('/master/device-categories'),
          masterApi.get('/master/brands'),
        ]);

        const shops = shopsR.status === 'fulfilled' ? asArray(shopsR.value) : [];
        const cats = catsR.status === 'fulfilled' ? asArray(catsR.value) : [];
        const brands = brandsR.status === 'fulfilled' ? asArray(brandsR.value) : [];

        const total = shops.length;
        const active = shops.filter(
          (s) => s.isActive === true || s.active === true || s.status === 'ACTIVE'
        ).length;

        setCategories(cats);
        setStats((s) => ({
          ...s,
          shopsTotal: total,
          shopsActive: active,
          shopsInactive: total - active,
          categoriesCount: cats.length,
          brandsCount: brands.length,
          error: null,
        }));
      } catch (e) {
        setStats((s) => ({ ...s, error: e.message }));
      }
    };
    run();
  }, []);

  /**
   * Every model, loaded automatically.
   *
   * This used to be a Count button, because a total meant pulling every brand's
   * FULL model list — ~55 requests and tens of MB, most of it base64 images stored
   * inline on the rows, which exhausted master-data's 384 MB heap and took the
   * service down on each dashboard visit.
   *
   * GET /master/models is a projection with those images stripped, so the whole
   * catalogue is now ONE request: 3226 models measured 1.4 MB in 0.44s against the
   * live backend on 2026-08-20. That is well within what a dashboard tile can
   * fetch on its own, so the button is gone. The rows carry categoryId directly
   * (ModelListItem), so the Top Categories breakdown below is a client-side
   * group-by over data already on the page — no extra request.
   */
  const loadModels = async () => {
    setModelRows({ rows: null, loading: true, failed: false });
    try {
      const rows = await masterApi.get('/master/models');
      setModelRows({ rows: asArray(rows), loading: false, failed: false });
    } catch {
      // Deliberately not folded into stats.error: the other tiles are fine, and a
      // page-wide "check your backend URLs" banner would misdescribe the problem.
      setModelRows({ rows: null, loading: false, failed: true });
    }
  };
  useEffect(() => { loadModels(); }, []);

  const colorByCategoryId = useMemo(() => {
    const map = new Map();
    categories.forEach((c, i) => map.set(c.id, CATEGORY_COLORS[i % CATEGORY_COLORS.length]));
    return map;
  }, [categories]);

  const topCategories = useMemo(() => {
    if (!modelRows.rows || !categories.length) return [];
    const counts = new Map();
    for (const m of modelRows.rows) {
      if (!m.categoryId) continue;
      counts.set(m.categoryId, (counts.get(m.categoryId) || 0) + 1);
    }
    return categories
      .map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) || 0 }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 5);
  }, [modelRows.rows, categories]);

  const maxCategoryCount = topCategories[0]?.count || 1;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Welcome back, {name}! 👋</h1>
        <p className="mt-1 text-sm text-admin-muted">Here&apos;s what&apos;s happening with your platform today.</p>
      </div>

      {stats.error && (
        <p className="mb-4 text-sm text-red-600">
          Some data could not be loaded. Check backend URLs in .env.local. {stats.error}
        </p>
      )}

      {/* Shops Overview */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-muted">Shops Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <OverviewCard title="Total Shops" value={stats.shopsTotal} caption="All registered shops" href="/management/shops" icon={Store} tint="blue" />
          <OverviewCard title="Active Shops" value={stats.shopsActive} caption="Currently active" href="/management/shops" icon={CheckCircle2} tint="green" />
          <OverviewCard title="Inactive Shops" value={stats.shopsInactive} caption="Currently inactive" href="/management/shops" icon={XCircle} tint="red" />
        </div>
      </section>

      {/* Master Data */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-muted">Master Data</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <MasterDataCard title="Categories" value={stats.categoriesCount} caption="Product categories" href="/management/device-categories" icon={Tag} accent="indigo" />
          <MasterDataCard title="Brands" value={stats.brandsCount} caption="Registered brands" href="/management/brands" icon={Briefcase} accent="amber" />
          <MasterDataCard
            title="Models"
            value={modelRows.loading ? '…' : modelRows.failed ? '—' : modelRows.rows.length.toLocaleString()}
            caption="Available models"
            href="/management/models"
            icon={Boxes}
            accent="indigo"
            action={modelRows.failed ? (
              <button
                type="button"
                onClick={loadModels}
                title="Could not reach master-data. Try again."
                className="shrink-0 rounded-lg border border-admin-border px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-admin-dark"
              >
                Retry
              </button>
            ) : null}
          />
        </div>
      </section>

      {/* Summary row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <DashboardCard title="Shops Summary">
          <div className="flex flex-1 flex-col items-center gap-6 sm:flex-row">
            <ShopsSummaryRing active={stats.shopsActive} inactive={stats.shopsInactive} />
            <div className="flex-1 space-y-3 self-stretch text-sm sm:self-auto">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                  Active Shops
                </span>
                <span className="font-semibold text-slate-900">{stats.shopsActive}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  Inactive Shops
                </span>
                <span className="font-semibold text-slate-900">{stats.shopsInactive}</span>
              </div>
            </div>
          </div>
          <Link href="/management/shops" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-admin-accent hover:underline">
            View all shops <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </DashboardCard>

        <DashboardCard
          title="Top Categories"
          action={<Link href="/management/device-categories" className="text-sm font-medium text-admin-accent hover:underline">View all</Link>}
        >
          {topCategories.length === 0 ? (
            <p className="text-sm text-admin-muted">
              {modelRows.loading ? 'Loading…' : 'No category data yet.'}
            </p>
          ) : (
            <ul className="space-y-4">
              {topCategories.map((c) => (
                <li key={c.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-slate-700">{c.name}</span>
                    <span className="font-medium text-slate-900">{c.count.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-admin-dark">
                    <div
                      className={`h-full rounded-full ${colorByCategoryId.get(c.id)}`}
                      style={{ width: `${Math.max(4, (c.count / maxCategoryCount) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        {/* No backend activity/audit log exists yet to back a real "Recent
            Activity" feed, so this slot surfaces the actions an admin actually
            comes to the dashboard to take, rather than inventing fake events. */}
        <DashboardCard title="Quick Actions">
          <ul className="space-y-2">
            {[
              { label: 'Add Shop', href: '/management/shops/new', icon: Store, iconClass: 'bg-sky-100 text-sky-600' },
              { label: 'Add Brand', href: '/management/brands', icon: Briefcase, iconClass: 'bg-amber-100 text-amber-600' },
              { label: 'Add Model', href: '/management/models', icon: Boxes, iconClass: 'bg-indigo-100 text-indigo-600' },
              { label: 'Manage Users', href: '/management/user-management', icon: Users, iconClass: 'bg-violet-100 text-violet-600' },
            ].map(({ label, href, icon: Icon, iconClass }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 transition-colors hover:bg-admin-dark"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
                  <PlusCircle className="h-4 w-4 text-slate-300 transition-colors group-hover:text-admin-accent" />
                </Link>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>
    </div>
  );
}
