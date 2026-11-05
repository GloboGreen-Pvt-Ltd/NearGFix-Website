'use client';

/**
 * /shop-home — the NearGFix Partner Dashboard home page.
 *
 * The auth guard and chrome (header nav) live in src/app/shop-home/layout.js
 * -> DashboardShell, shared across every /shop-home/* route — this file is
 * just the Dashboard's own content:
 *
 *   Banner carousel (admin banners from /master/banners, auto-scrolling)
 *   Repair / Buy / Sell quick-action cards
 *   Business Overview — 7 status cards
 *   Buying (Marketplace feed) · Selling (this shop's listings) · Recent Bookings
 *
 * Every number is real data, fetched with the shop-owner's own token
 * (src/lib/shopApi.js) — see shopDashboard.js for the endpoints.
 */

import { useEffect, useState } from 'react';
import Link from '@/components/PortalLink';
import { useRouter } from '@/lib/portalNavigation';
import { ArrowDown, ArrowRight, ArrowUp, Bike, Box, CalendarDays, ChevronDown, ClipboardCheck, ClipboardList, Clock, ShoppingCart, Smartphone, Store, Tag, Truck, User, Wrench } from 'lucide-react';

import { cx } from '@/components/site/ui';
import HeroCarousel from '@/components/site/HeroCarousel';
import { BUY_HREF, awaitingQuote, formatRupees, loadBuyFeed, priceOf, rememberBuyItem, sellerLabel } from '@/lib/buyFlow';
import { loadCatalog, resolveMediaUrl } from '@/lib/deviceImage';
import { fetchMySellListings, sellBrandHref } from '@/lib/sellFlow';
import { bookingRef, bookingsHref, buildOrderRows, countByStage, countPickups, onBookingsList, pickupsHref } from '@/lib/orderStages';
import { fetchShopBookings, fetchTicketsPaged, isToday, isYesterday } from '@/lib/shopDashboard';

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                 */
/* -------------------------------------------------------------------------- */

const DASH = '—';

/** "12%" up/down badge from today-vs-yesterday counts, or null when there's nothing to compare. */
function dayOverDay(today, yesterday) {
  if (!yesterday) return null;
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return { up: pct >= 0, text: `${Math.abs(pct)}%` };
}

function formatDate(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

/* -------------------------------------------------------------------------- */
/* Repair / Buy / Sell                                                         */
/* -------------------------------------------------------------------------- */

// Each card opens an existing flow: Repair -> Book Service (its first step is
// Customer Details), Buy -> Marketplace, Sell -> the Sell flow's first step.
// Photos are transparent cut-outs: public/images/card-repair.png, card-buy.png, card-sell.png.
const QUICK_ACTIONS = [
  {
    key: 'repair',
    title: 'Repair',
    subtitle: 'Fix Your Device',
    href: '/shop-home/services/book-service/',
    icon: Wrench,
    image: '/images/card-repair.png',
    card: 'bg-[#E5F3F5] border-[#C7E6EA]',
    chip: 'bg-[#035C6C] text-white',
    arrow: 'text-[#035C6C]',
  },
  {
    key: 'buy',
    title: 'Buy',
    subtitle: 'New & Used',
    href: '/shop-home/services/marketplace/',
    icon: ShoppingCart,
    image: '/images/card-buy.png',
    card: 'bg-[#EAF6FC] border-[#CDE9F7]',
    chip: 'bg-[#0788C9] text-white',
    arrow: 'text-[#0788C9]',
  },
  {
    key: 'sell',
    title: 'Sell',
    subtitle: 'Get Best Price',
    href: sellBrandHref(),
    icon: Tag,
    image: '/images/card-sell.png',
    card: 'bg-[#FFF8E5] border-[#FFE7A8]',
    chip: 'bg-[#FAA700] text-[#111111]',
    arrow: 'text-[#B87A00]',
  },
];

/* -------------------------------------------------------------------------- */
/* Buying                                                                      */
/* -------------------------------------------------------------------------- */

// Buying shows the first listings of the Marketplace's buy feed
// (lib/buyFlow.js loadBuyFeed — nearby peer listings, then catalogue
// products).
// An item is { key, title, subtitle?, price?, image, href? | onClick? };
// with no items (or while loading) the section shows grey placeholder slots.
const PLACEHOLDER_SLOTS = 5;

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';

/** White panel with a title row and an optional "View all" link — shared by every dashboard section. */
function Panel({ title, subtitle, viewAllHref, action, children }) {
  return (
    <section className="min-w-0 rounded-[18px] border border-[#E5E7EB] bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[18px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[20px]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[13px] text-[#6B7280]">{subtitle}</p> : null}
        </div>
        {action}
        {viewAllHref ? (
          <Link href={viewAllHref} className={cx('inline-flex shrink-0 items-center gap-1 rounded-md text-[13.5px] font-bold text-[#035C6C] hover:underline', FOCUS_RING)}>
            View all
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// The Partner App's Home "Nearby Deals" tile (DashboardNearbyDeals.tsx),
// one-for-one: white image panel (photo at 74%, never cropped) with the
// condition tag top-left and a VIEW pill bottom-right, then price pill,
// two-line name, spec line and seller. Fixed-width cards in a row that
// scrolls sideways inside the panel when they don't fit (phones).
function DealImage({ uri, tag }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative flex aspect-[11/10] items-center justify-center bg-white">
      {uri && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote listing/catalogue photo.
        <img src={uri} alt="" loading="lazy" onError={() => setBroken(true)} className="h-[74%] w-[74%] object-contain" />
      ) : (
        <Smartphone className="h-7 w-7 text-[#035C6C]" aria-hidden="true" />
      )}
      {tag ? (
        <span className="absolute left-0 top-0 max-w-[86%] truncate rounded-br-[10px] bg-[#035C6C] px-[7px] py-[3px] text-[9px] font-extrabold text-white">{tag}</span>
      ) : null}
      <span className="pointer-events-none absolute bottom-[5px] right-[5px] rounded-[9px] border-[1.5px] border-[#035C6C] bg-white px-2 py-0.5 text-[10px] font-extrabold text-[#035C6C]">VIEW</span>
    </div>
  );
}

function DealCard({ item }) {
  if (!item.title) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
        <div className="flex aspect-[11/10] items-center justify-center">
          <span className="h-[74%] w-[74%] animate-pulse rounded-xl bg-[#F3F4F6]" />
        </div>
        <div className="px-[7px] pb-[7px] pt-1.5">
          <span className="block h-4 w-1/2 rounded bg-[#F3F4F6]" />
          <span className="mt-1.5 block h-3 w-4/5 rounded bg-[#F3F4F6]" />
          <span className="mt-1 block h-2.5 w-2/3 rounded bg-[#F3F4F6]" />
        </div>
      </div>
    );
  }
  const SellerIcon = item.isCustomer ? User : Store;
  return (
    <div className="h-full overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white transition group-hover:border-[#C7E6EA] group-hover:shadow-[0_6px_16px_rgba(16,24,40,0.08)]">
      <DealImage uri={item.image} tag={item.tag} />
      <div className="px-[7px] pb-[7px]">
        {item.price ? (
          <span
            className={cx(
              'mt-1.5 inline-block max-w-full truncate rounded-[7px] px-1.5 py-0.5 font-extrabold',
              item.quote ? 'bg-[#E5F3F5] text-[9px] text-[#035C6C]' : 'bg-[#035C6C] text-[12px] text-white',
            )}
          >
            {item.price}
          </span>
        ) : null}
        <p className="mt-1 line-clamp-2 text-[12px] font-extrabold leading-4 text-[#111111]">{item.title}</p>
        {item.spec ? <p className="mt-px truncate text-[10.5px] text-[#6B7280]">{item.spec}</p> : null}
        {item.seller ? (
          <p className="mt-0.5 flex items-center gap-[3px] text-[10.5px] text-[#6B7280]">
            <SellerIcon className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.seller}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ShowcaseSection({ title, subtitle, items = [], viewAllHref, emptyText, emptyAction }) {
  const slots = items.length ? items : Array.from({ length: PLACEHOLDER_SLOTS }, (_, i) => ({ key: `slot-${i}` }));
  const cell = 'group w-[128px] shrink-0 snap-start rounded-[14px] text-left sm:w-[156px] lg:w-[170px]';
  return (
    <Panel title={title} subtitle={subtitle} viewAllHref={viewAllHref}>
      {emptyText ? (
        <div className="flex flex-col items-center gap-2 rounded-[14px] bg-[#F3F4F6] px-4 py-6 text-center">
          <p className="text-[13.5px] text-[#6B7280]">{emptyText}</p>
          {emptyAction}
        </div>
      ) : (
        <div className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {slots.map((item) => {
            const label = item.title ? `${item.title}${item.spec ? `, ${item.spec}` : ''}${item.seller ? `, ${item.seller}` : ''}` : undefined;
            if (item.href) {
              return (
                <Link key={item.key} href={item.href} aria-label={label} className={cx(cell, FOCUS_RING)}>
                  <DealCard item={item} />
                </Link>
              );
            }
            if (item.onClick) {
              return (
                <button key={item.key} type="button" onClick={item.onClick} aria-label={label} className={cx(cell, FOCUS_RING)}>
                  <DealCard item={item} />
                </button>
              );
            }
            return (
              <div key={item.key} className={cell}>
                <DealCard item={item} />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// Three across at every width. Text sits top-left, the cut-out photo
// bottom-right, sized so the two never overlap on a 360px phone.
function QuickActionCards() {
  return (
    <section aria-label="Quick actions" className="grid grid-cols-3 gap-2.5 sm:gap-4">
      {QUICK_ACTIONS.map(({ key, title, subtitle, href, icon: Icon, image, card, chip, arrow }) => (
        <Link
          key={key}
          href={href}
          aria-label={`${title} — ${subtitle}`}
          className={cx(
            'group relative flex h-[148px] min-w-0 flex-col overflow-hidden rounded-[16px] border p-3 transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(16,24,40,0.08)] sm:h-[150px] sm:rounded-[18px] sm:p-4 lg:h-[160px]',
            card,
            FOCUS_RING,
          )}
        >
          {/* Transparent cut-out photo (public/images/card-*.png), whole and uncropped, bottom-right. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- static public photo. */}
          <img
            src={image}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="pointer-events-none absolute bottom-1.5 right-1.5 h-[34%] w-[58%] origin-bottom-right object-contain object-right-bottom drop-shadow-[0_8px_14px_rgba(16,24,40,0.18)] transition group-hover:scale-[1.04] sm:bottom-2 sm:right-3 sm:h-[58%] sm:w-[48%]"
          />
          <div className="relative flex items-start justify-between">
            <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl sm:h-11 sm:w-11', chip)}>
              <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" />
            </span>
            <span className={cx('flex h-7 w-7 items-center justify-center rounded-full bg-white transition group-hover:translate-x-0.5 sm:h-8 sm:w-8', arrow)}>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="relative mt-1.5 max-w-full sm:mt-3 sm:max-w-[55%]">
            <p className="truncate text-[15px] font-extrabold leading-tight text-[#1C3053] sm:text-[18px]">{title}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-[#6B7280] sm:text-[13px]">{subtitle}</p>
          </div>
        </Link>
      ))}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Recent Bookings                                                             */
/* -------------------------------------------------------------------------- */

const STATUS_BADGE = {
  Created: 'bg-[#E5F3F5] text-[#035C6C]',
  'In Progress': 'bg-[#EAF6FC] text-[#0788C9]',
  Pickup: 'bg-[#FFF8E5] text-[#8C5A00]',
  Completed: 'bg-[#EEF5E9] text-[#4B7A2B]',
  Cancelled: 'bg-[#FEECEB] text-[#C4221D]',
};
const RECENT_LIMIT = 6;

// Newest bookings first (buildOrderRows already sorts by createdAt). One
// column on phones/tablets, two on desktop so six rows take three lines.
function RecentBookings({ rows, loading }) {
  return (
    <Panel title="Recent Jobs" subtitle="Latest repair jobs at your shop." viewAllHref={bookingsHref('all')}>
      {loading ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="block h-[58px] animate-pulse rounded-[12px] bg-[#F3F4F6]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[14px] bg-[#F3F4F6] px-4 py-6 text-center">
          <p className="text-[13.5px] text-[#6B7280]">No jobs yet. New jobs will appear here.</p>
          <Link href="/shop-home/services/book-service/" className={cx('rounded-md text-[13.5px] font-bold text-[#035C6C] hover:underline', FOCUS_RING)}>
            Book a service
          </Link>
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {rows.slice(0, RECENT_LIMIT).map((b) => (
            <Link
              key={b.id}
              href={`/shop-home/services/bookings/view/?id=${encodeURIComponent(b.id)}`}
              className={cx('flex min-w-0 items-center gap-3 rounded-[12px] border border-[#E5E7EB] px-3 py-2.5 transition hover:border-[#C7E6EA] hover:bg-[#F8FBFB]', FOCUS_RING)}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5]">
                <Wrench className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-[#111111]">
                  {b.customerName || 'Customer'}
                  {bookingRef(b) ? <span className="ml-1.5 text-[12px] font-semibold text-[#9CA3AF]">#{String(bookingRef(b)).replace(/^#/, '')}</span> : null}
                </p>
                <p className="truncate text-[12px] text-[#6B7280]">
                  {b.deviceDisplayName || b.modelName || 'Device'} · {b.services?.[0]?.serviceName || b.issueSummary || 'Service booking'}
                  {b.createdAt ? ` · ${formatDate(b.createdAt)}` : ''}
                </p>
              </div>
              <span className={cx('shrink-0 rounded-full px-2 py-1 text-[11px] font-bold', STATUS_BADGE[b.statusLabel] || 'bg-[#F3F4F6] text-[#6B7280]')}>
                {b.statusLabel}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Business Overview                                                           */
/* -------------------------------------------------------------------------- */

// Brand sheet colours (Partner App Home Overview): teal, bright blue, navy, red, orange.
const KPI_TONES = {
  mint: { card: 'bg-white border-[#E5E7EB]', icon: 'bg-[#035C6C]', arrow: 'text-[#035C6C]' },
  blue: { card: 'bg-white border-[#E5E7EB]', icon: 'bg-[#0788C9]', arrow: 'text-[#0788C9]' },
  violet: { card: 'bg-white border-[#E5E7EB]', icon: 'bg-[#1C3053]', arrow: 'text-[#1C3053]' },
  red: { card: 'bg-[#FEF1F0] border-[#FBD5D3]', icon: 'bg-[#F32C26]', arrow: 'text-[#F32C26]' },
  orange: { card: 'bg-white border-[#E5E7EB]', icon: 'bg-[#FAA700]', arrow: 'text-[#B87A00]' },
};

// Every card is the same height; the label may wrap to two lines.
function KpiCard({ icon: Icon, label, value, trend, trendTitle, tone, href }) {
  const t = KPI_TONES[tone] || KPI_TONES.mint;
  return (
    <Link
      href={href}
      className={cx(
        'group relative flex h-[128px] min-w-0 flex-col rounded-[14px] border p-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(16,24,40,0.08)]',
        t.card,
        FOCUS_RING,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone === 'orange' ? 'text-[#111111]' : 'text-white', t.icon)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {trend ? (
          <span
            title={trendTitle}
            className={cx(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-bold',
              trend.up ? 'bg-[#F3F3F3] text-[#024A57]' : 'bg-[#FFE4E8] text-[#C01048]',
            )}
          >
            {trend.up ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
            {trend.text}
          </span>
        ) : null}
      </div>
      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[26px] font-extrabold leading-none tracking-tight text-[#111111]">{value}</p>
          <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-tight text-[#374151]">{label}</p>
        </div>
        <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] transition group-hover:translate-x-0.5', t.arrow)}>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

const EMPTY_DATA = { bookings: [], tickets: [] };

export default function ShopHomePage() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  // Set after mount: the page is prerendered, so "today" must come from the
  // viewer's clock, not the build machine's.
  const [todayLabel, setTodayLabel] = useState('');

  useEffect(() => {
    setTodayLabel(`Today, ${formatDate(new Date().toISOString())}`);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [bookingsRes, ticketsRes] = await Promise.allSettled([fetchShopBookings(), fetchTicketsPaged()]);
      if (cancelled) return;
      setData({
        bookings: bookingsRes.status === 'fulfilled' ? bookingsRes.value : [],
        tickets: ticketsRes.status === 'fulfilled' ? ticketsRes.value : [],
      });
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Buying: the first few rows of the Marketplace feed, given brand/model
  // names and a photo from the catalogue exactly as the Marketplace page does,
  // so the details page it hands off to has the same fields.
  // null = still loading.
  const router = useRouter();
  const [buyRows, setBuyRows] = useState(null);

  useEffect(() => {
    let alive = true;
    loadBuyFeed()
      .then(async (feed) => {
        const top = feed.items.slice(0, PLACEHOLDER_SLOTS);
        const cat = await loadCatalog(top.map((it) => it.brandId).filter(Boolean)).catch(() => null);
        if (!alive) return;
        setBuyRows(
          top.map((it) => {
            const model = it.modelId ? cat?.modelsById.get(String(it.modelId)) : null;
            const brandId = it.brandId || model?.brandId || null;
            const brand = brandId ? cat?.brands.get(String(brandId)) : null;
            return {
              ...it,
              brandId,
              brandName: brand?.name || null,
              modelName: model?.name || null,
              image: it.productImage || resolveMediaUrl(model?.imageUrl) || null,
            };
          }),
        );
      })
      .catch(() => alive && setBuyRows([]));
    return () => {
      alive = false;
    };
  }, []);

  // Selling: this shop's own SELL listings (same source as the Sell page's
  // "Your listed products"). null = still loading.
  const [sellRows, setSellRows] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchMySellListings()
      .then((rows) => alive && setSellRows(rows.slice(0, PLACEHOLDER_SLOTS)))
      .catch(() => alive && setSellRows([]));
    return () => {
      alive = false;
    };
  }, []);

  const sellItems = (sellRows || []).map((p) => ({
    key: p.id,
    title: String(p.title || p.productName || [p.brandName, p.modelName].filter(Boolean).join(' ')).trim() || 'Device',
    tag: p.conditionLabel || p.condition || null,
    spec: [p.conditionLabel || p.condition, p.description].filter(Boolean).join(' · '),
    price: Number(p.price) > 0 ? formatRupees(Number(p.price)) : null,
    seller: p.shopName || 'Your shop',
    image: p.image,
    href: sellBrandHref(),
  }));

  const buyItems = (buyRows || []).map((it) => ({
    key: it._key,
    title: it.productName || 'Device',
    tag: it.condition || null,
    spec: [it.condition, it.description].filter(Boolean).join(' · '),
    price: awaitingQuote(it) ? 'Open for quotation' : priceOf(it) > 0 ? formatRupees(priceOf(it)) : null,
    quote: awaitingQuote(it),
    seller: sellerLabel(it),
    isCustomer: it.sellerType === 'CUSTOMER',
    image: it.image,
    onClick: () => {
      rememberBuyItem(it);
      router.push(BUY_HREF.details);
    },
  }));

  const { bookings, tickets } = data;

  // Every card counts with lib/orderStages.js over the same bookings+tickets
  // join the Bookings/Pickups pages use, and links to the matching tab — so
  // the number on a card is exactly the number of rows it opens.
  const orderRows = buildOrderRows(bookings, tickets);
  const stageCounts = countByStage(orderRows);
  const pickupCounts = countPickups(orderRows);
  const pickupRows = orderRows.filter((r) => r.isPickup);
  const deliveredRows = orderRows.filter((r) => r.stage === 'delivered');

  // Day-over-day badges only where the rows carry the date that makes the
  // comparison real; stage-only counts have no history, so they show no
  // badge rather than an invented one.
  // Service Orders counts the Bookings list (onBookingsList), so its trend does too.
  const listRows = orderRows.filter(onBookingsList);
  const ordersTrend = dayOverDay(listRows.filter((b) => isToday(b.createdAt)).length, listRows.filter((b) => isYesterday(b.createdAt)).length);
  const requestsTrend = dayOverDay(pickupRows.filter((b) => isToday(b.createdAt)).length, pickupRows.filter((b) => isYesterday(b.createdAt)).length);
  const deliveredTrend = dayOverDay(deliveredRows.filter((b) => isToday(b.updatedAt)).length, deliveredRows.filter((b) => isYesterday(b.updatedAt)).length);

  const v = (n) => (loading ? DASH : String(n));
  const kpis = [
    { key: 'orders', label: 'Service Orders', value: v(stageCounts.all), icon: ClipboardList, tone: 'mint', href: bookingsHref('all'), trend: ordersTrend, trendTitle: 'Bookings created today vs yesterday' },
    { key: 'active', label: 'Active Jobs', value: v(stageCounts.active), icon: Clock, tone: 'blue', href: bookingsHref('active') },
    { key: 'queue', label: 'Pickup Queue', value: v(pickupCounts.all), icon: Truck, tone: 'violet', href: pickupsHref('all') },
    { key: 'requests', label: 'Pickup Requests', value: v(pickupCounts.requested), icon: Box, tone: 'red', href: pickupsHref('requested'), trend: requestsTrend, trendTitle: 'Pickup bookings created today vs yesterday' },
    { key: 'confirmed', label: 'Pickup Confirmed', value: v(pickupCounts.accepted), icon: ClipboardCheck, tone: 'mint', href: pickupsHref('accepted') },
    { key: 'delivery-requests', label: 'Delivery Requests', value: v(stageCounts.ready), icon: Bike, tone: 'orange', href: bookingsHref('ready') },
    { key: 'delivered', label: 'Delivery Completed', value: v(stageCounts.delivered), icon: Truck, tone: 'blue', href: bookingsHref('delivered'), trend: deliveredTrend, trendTitle: 'Bookings delivered today vs yesterday' },
  ];

  return (
    <div className="-m-4 min-w-0 space-y-4 overflow-x-clip bg-[#F3F4F6] p-4 sm:-m-6 sm:space-y-5 sm:p-6">
      {/* Admin-managed banners (GET /master/banners), auto-scrolling — the same HeroCarousel as the public home page. */}
      <HeroCarousel height="short" className="mx-auto w-full max-w-[1000px]" />

      <QuickActionCards />

      {/* ---- Business Overview ------------------------------------------- */}
      {/* 2 columns on phones (the 7th card spans both), 4 on tablets/laptops, all 7 in one row from 1360px. */}
      <Panel
        title="Business Overview"
        subtitle="Real-time snapshot of your operations."
        action={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span
              title="Figures shown are for today"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 text-[13px] font-semibold text-[#111111]"
            >
              <CalendarDays className="h-4 w-4 text-[#6B7280]" aria-hidden="true" />
              {todayLabel || 'Today'}
              <ChevronDown className="h-4 w-4 text-[#9CA3AF]" aria-hidden="true" />
            </span>
            <Link
              href="/shop-home/reports"
              className={cx('inline-flex h-9 items-center gap-2 rounded-xl bg-[#035C6C] px-3.5 text-[13px] font-bold text-white transition hover:bg-[#024A57]', FOCUS_RING)}
            >
              View Reports
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 min-[1360px]:grid-cols-7 max-sm:[&>*:last-child]:col-span-2">
          {kpis.map((k) => (
            <KpiCard key={k.key} {...k} />
          ))}
        </div>
      </Panel>

      {/* ---- Buying (Marketplace feed) ----------------------------------- */}
      <ShowcaseSection
        title="Buying"
        subtitle="Devices and products to buy."
        items={buyItems}
        viewAllHref={BUY_HREF.list}
        emptyText={buyRows && !buyRows.length ? 'No listings to buy near you yet.' : undefined}
      />

      {/* ---- Selling (this shop's listings) ------------------------------ */}
      <ShowcaseSection
        title="Selling"
        subtitle="Devices your shop has listed for sale."
        items={sellItems}
        viewAllHref={sellBrandHref()}
        emptyText={sellRows && !sellRows.length ? 'You have not listed any devices yet.' : undefined}
        emptyAction={
          <Link href={sellBrandHref()} className={cx('rounded-md text-[13.5px] font-bold text-[#035C6C] hover:underline', FOCUS_RING)}>
            Sell a device
          </Link>
        }
      />

      {/* ---- Recent Bookings --------------------------------------------- */}
      <RecentBookings rows={orderRows} loading={loading} />
    </div>
  );
}
