'use client';

/**
 * /shop-home/services/marketplace — Buy, the Partner app's Buy tab
 * (OwnerBuyListingScreen) on the web.
 *
 * Feed (lib/buyFlow.js): nearby peer listings from customers and shops within
 * 20 km of this shop (GET /marketplace/buy/nearby, nearest first) followed by
 * catalogue products (GET /marketplace/products?status=ACTIVE), without this
 * shop's own rows; seller names and cities from GET /shops.
 *
 * Top to bottom: header with the cart (badge = total quantity), search +
 * Filters (sort: Recommended / Nearest / price; seller: all / shops /
 * customers), category cards (the admin's BUY Category Menu, else the device
 * categories), the admin's "Buy" banners (else the app's Nearby Deals card),
 * the trust strip, then — while nothing narrows the list — the app's Flash
 * Deals and Trending Near You rails above the full grid.
 *
 * Categories: a listing carries its own categoryId; a catalogue product is
 * placed by its model's categoryId (the app leaves products under All only).
 * ?category=<CODE> preselects one — read from window.location so the static
 * export needs no Suspense boundary, kept in the URL with replaceState.
 *
 * Card actions, as in the app: View Details (the details page); Add to cart
 * for a catalogue product (POST /customer/cart); Contact for a peer listing.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/PortalLink';
import { useRouter } from '@/lib/portalNavigation';
import {
  BadgeCheck,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Laptop,
  LayoutGrid,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Lock,
  Truck,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Store,
  Tablet,
  Watch,
  Wrench,
  X,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import {
  BUY_HREF,
  BUY_RADIUS_KM,
  addToCart,
  awaitingQuote,
  cartQuantity,
  contactPhoneOf,
  fetchBuyBanners,
  fetchMaster,
  formatRupees,
  getCart,
  isSparePart,
  loadBuyFeed,
  placeOf,
  priceOf,
  rememberBuyItem,
  sellerLabel,
  telHref,
} from '@/lib/buyFlow';
import { loadCatalog, resolveMediaUrl } from '@/lib/deviceImage';
import { DEVICE_CATEGORIES, sortDeviceCategories } from '@/lib/siteContent';
import { notifyError, notifySuccess, toast } from '@/lib/toast';

const CATEGORY_ICONS = {
  MOBILE: Smartphone,
  TABLET: Tablet,
  LAPTOP: Laptop,
  SMARTWATCHES: Watch,
  AUDIO_DEVICE: Headphones,
};

// Soft per-category card tints (All first), cycled by position.
const TINTS = ['bg-[#F3F3F3]', 'bg-[#EEF7FF]', 'bg-[#F5EFFF]', 'bg-[#FFF0F2]', 'bg-[#FFF5E8]', 'bg-[#F3F3F3]', 'bg-[#F3F3F3]'];

// The app's trust strip.
const BENEFITS = [
  { icon: ShieldCheck, title: 'Verified Sellers', subtitle: '100% Trusted', card: 'from-[#E5F3F5] to-[#CFF2DA]', chip: 'from-[#035C6C] to-[#035C6C]', text: 'text-[#024A57]' },
  { icon: BadgePercent, title: 'Best Prices', subtitle: 'Great Discounts', card: 'from-[#EEF5FF] to-[#D6E7FF]', chip: 'from-[#5EA2FF] to-[#1570EF]', text: 'text-[#175CD3]' },
  { icon: RotateCcw, title: 'Easy Returns', subtitle: '7 Days Policy', card: 'from-[#FFF6EA] to-[#FFE3BF]', chip: 'from-[#FDB022] to-[#F79009]', text: 'text-[#B54708]' },
  { icon: BadgeCheck, title: 'Warranty', subtitle: 'Brand Warranty', card: 'from-[#F5EFFF] to-[#E4D6FF]', chip: 'from-[#A48AFB] to-[#7F56D9]', text: 'text-[#6941C6]' },
  { icon: Lock, title: 'Secure Payments', subtitle: 'Safe checkout', card: 'from-[#E8FAF8] to-[#C8F1EC]', chip: 'from-[#2ED3B7] to-[#0E9384]', text: 'text-[#107569]' },
  { icon: Truck, title: 'Fast Delivery', subtitle: 'Quick doorstep handover', card: 'from-[#FFF0F3] to-[#FFD9E1]', chip: 'from-[#FD6F8E] to-[#E31B54]', text: 'text-[#C01048]' },
];

const SORTS = [
  { value: 'default', label: 'Recommended' },
  { value: 'nearest', label: 'Nearest first' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

const SELLERS = [
  { value: 'ALL', label: 'All Sellers' },
  { value: 'SHOP', label: 'Shops' },
  { value: 'CUSTOMER', label: 'Customers' },
];

const CONTROL = 'rounded-[14px] border border-[#ECECEC] bg-[#F8F8F8]';
const RAIL_SIZE = 10;

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** `src` is one URL or a list tried in order — a broken photo falls through to the next, then the icon. */
function Img({ src, fallbackIcon: Fallback, className = 'h-full w-full', iconClassName = 'h-10 w-10' }) {
  const list = (Array.isArray(src) ? src : [src]).filter(Boolean);
  const listKey = list.join('|');
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [listKey]);
  const current = list[index];
  if (!current) return <Fallback className={cx(iconClassName, 'text-[#035C6C]/50')} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element -- remote catalog photos, not app assets Next can optimize.
  return <img src={current} alt="" loading="lazy" onError={() => setIndex((i) => i + 1)} className={cx('object-contain object-center', className)} />;
}

const fallbackIconFor = (item) => (isSparePart(item) ? Wrench : CATEGORY_ICONS[item.categoryCode] || Smartphone);

/* -------------------------------------------------------------------------- */
/* Banner                                                                      */
/* -------------------------------------------------------------------------- */

/** The admin's Buy banners (each at its own aspect ratio), else the app's Nearby Deals card. */
function BuyBanner({ banners, onBroken, onBrowse }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;
  const current = Math.min(index, Math.max(count - 1, 0));

  useEffect(() => {
    if (count < 2 || paused || prefersReducedMotion()) return undefined;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), 3500);
    return () => clearTimeout(t);
  }, [count, current, paused]);

  if (!count) {
    return (
      <section aria-label="Nearby deals" className="flex flex-col gap-4 overflow-hidden rounded-[18px] border border-[#ECECEC] bg-gradient-to-br from-[#E5F3F5] via-white to-white p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#035C6C] px-2.5 py-1 text-[11px] font-extrabold tracking-wider text-white">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            NEARBY DEALS
          </span>
          <h2 className="mt-3 text-[20px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[22px]">Buy refurbished &amp; spares</h2>
          <p className="mt-1 text-[14px] text-[#666666]">From verified shops &amp; customers within your area.</p>
        </div>
        <button
          type="button"
          onClick={onBrowse}
          className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-xl bg-[#F3BF23] px-4 text-[13.5px] font-bold text-[#1E1E1E] transition hover:bg-[#E5B11A] sm:self-center"
        >
          Browse all
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    );
  }

  // A banner with a web link opens it; any other banner browses the full list.
  const b = banners[current];
  const openBanner = () => {
    if (b?.link && /^https?:\/\//i.test(b.link)) window.open(b.link, '_blank', 'noopener,noreferrer');
    else onBrowse();
  };

  return (
    <section aria-label="Buy offers" className="flex w-full flex-col items-center" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <button
        type="button"
        onClick={openBanner}
        aria-label="Open offer"
        className="grid w-full overflow-hidden rounded-[20px] border border-[#ECECEC] bg-[#F8F8F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2"
      >
        {banners.map((x, i) => (
          <span
            key={x.id || x.src}
            aria-hidden={i === current ? undefined : 'true'}
            className={cx(
              'col-start-1 row-start-1 flex transition-opacity duration-700 motion-reduce:transition-none',
              i === current ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            {/* Whole picture at its own shape — the hero column sets the width. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- admin banner from the media service, not an app asset. */}
            <img src={x.src} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" onError={() => onBroken(x.id)} className="block h-auto w-full" />
          </span>
        ))}
      </button>
      {count > 1 ? (
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          {banners.map((x, i) => (
            <button
              key={x.id || x.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show banner ${i + 1} of ${count}`}
              aria-current={i === current ? 'true' : undefined}
              className={cx('h-1.5 rounded-full transition-all', i === current ? 'w-[18px] bg-[#035C6C]' : 'w-1.5 bg-[#ECECEC] hover:bg-[#98A2B3]')}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Six trust cards (2 × 3): tinted gradient, solid icon chip beside the text, faint watermark icon. */
function Benefits() {
  return (
    <section aria-label="Why buy here" className="grid flex-1 grid-cols-2 gap-2.5">
      {BENEFITS.map(({ icon: Icon, title, subtitle, card, chip, text }) => (
        <div key={title} className={cx('relative flex items-center gap-3 overflow-hidden rounded-[16px] bg-gradient-to-br px-3.5 py-3', card)}>
          <Icon className={cx('pointer-events-none absolute -bottom-3 -right-3 h-16 w-16 opacity-[0.12]', text)} aria-hidden="true" />
          <span className={cx('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md', chip)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="relative min-w-0">
            <span className="block truncate text-[14px] font-extrabold text-[#111111]">{title}</span>
            <span className={cx('block truncate text-[12px] font-semibold', text)}>{subtitle}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

/** One horizontally scrolling row with prev/next buttons (swipe on touch). */
function HScroll({ children, label }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    const next = { start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 };
    // Only set when it changes, so re-checking after a render can't loop.
    setEdge((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
  };
  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  });
  const go = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' });
  const btn =
    'absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#111111] shadow-md transition hover:border-[#035C6C] hover:text-[#035C6C] sm:flex';
  return (
    <div className="relative">
      {!edge.start ? (
        <button type="button" onClick={() => go(-1)} aria-label={`Scroll ${label} left`} className={cx(btn, '-left-3')}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
      <div ref={ref} onScroll={update} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:thin]">
        {children}
      </div>
      {!edge.end ? (
        <button type="button" onClick={() => go(1)} aria-label={`Scroll ${label} right`} className={cx(btn, '-right-3')}>
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cards                                                                       */
/* -------------------------------------------------------------------------- */

function PriceTag({ item, className }) {
  if (awaitingQuote(item)) return <span className={cx('font-extrabold text-[#B54708]', className)}>Awaiting quote</span>;
  const price = priceOf(item);
  return <span className={cx('font-extrabold text-[#024A57]', className)}>{price > 0 ? formatRupees(price) : '—'}</span>;
}

function SellerBadge({ item }) {
  const customer = item.sellerType === 'CUSTOMER';
  return (
    <span className={cx('rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide shadow-sm', customer ? 'bg-[#EEF4FF] text-[#3538CD]' : 'bg-white text-[#024A57]')}>
      {customer ? 'Customer' : 'Shop'}
    </span>
  );
}

/** The browsing card — the app's list card: photo, seller, name, condition, place, distance, price and two actions. */
function BuyCard({ item, onOpen, onAdd, onContact, adding }) {
  const name = item.productName || 'Untitled';
  const place = placeOf(item);
  const product = item.source === 'product';
  return (
    <article className="flex flex-col overflow-hidden rounded-[18px] border border-[#ECECEC] bg-[#F8F8F8] transition hover:-translate-y-0.5 hover:border-[#D0D5DD]">
      <button type="button" onClick={onOpen} aria-label={`View details of ${name}`} className="relative flex h-28 items-center justify-center bg-white p-2.5">
        <Img src={item.images} fallbackIcon={fallbackIconFor(item)} iconClassName="h-12 w-12" />
        <span className="absolute left-3 top-3">
          <SellerBadge item={item} />
        </span>
        {isSparePart(item) ? (
          <span className="absolute right-3 top-3 rounded-full bg-[#FFF5E8] px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#B54708]">Spare part</span>
        ) : null}
      </button>
      <div className="flex flex-1 flex-col p-2.5">
        {item.brandName ? <p className="text-[11.5px] font-bold uppercase tracking-wide text-[#035C6C]">{item.brandName}</p> : null}
        <p className="line-clamp-2 text-[14px] font-bold leading-snug text-[#111111]" title={name}>
          {name}
        </p>
        {item.condition ? (
          <span className="mt-1.5 self-start rounded-md bg-[#F3F3F3] px-1.5 py-0.5 text-[11px] font-semibold text-[#475467]">{item.condition}</span>
        ) : null}
        {item.shopName ? (
          <p className="mt-2 flex items-center gap-1 truncate text-[12px] text-[#666666]">
            <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.shopName}</span>
          </p>
        ) : null}
        {place || item.distanceKm != null ? (
          <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-[#666666]">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{place || 'Nearby'}</span>
            {item.distanceKm != null ? <span className="shrink-0 font-semibold text-[#344054]">· {item.distanceKm} km</span> : null}
          </p>
        ) : null}
        <p className="mt-auto pt-2 text-[15px]">
          <PriceTag item={item} />
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-xl border border-[#ECECEC] bg-white px-2 text-[12.5px] font-bold text-[#111111] transition hover:border-[#035C6C] hover:text-[#035C6C]"
          >
            View Details
          </button>
          {product ? (
            <button
              type="button"
              onClick={onAdd}
              disabled={adding}
              aria-label={`Add ${name} to cart`}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#035C6C] px-2 text-[12.5px] font-bold text-white transition hover:bg-[#024A57] disabled:opacity-60"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShoppingCart className="h-4 w-4" aria-hidden="true" />}
              Add
            </button>
          ) : (
            <button
              type="button"
              onClick={onContact}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#035C6C] px-2 text-[12.5px] font-bold text-white transition hover:bg-[#024A57]"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Contact
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/** A rail card — the app's Deal / Trending card. A catalogue product gets a quick "+" (add to cart). */
function RailCard({ item, onOpen, onAdd, adding }) {
  const name = item.productName || 'Untitled';
  const sub = [item.condition, item.description].filter(Boolean).join(' · ');
  return (
    <div className="relative w-[150px] shrink-0 snap-start">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col overflow-hidden rounded-[16px] border border-[#ECECEC] bg-white text-left transition hover:border-[#D0D5DD]"
      >
        <span className="flex h-20 w-full items-center justify-center bg-[#F8F8F8] p-2">
          <Img src={item.images} fallbackIcon={fallbackIconFor(item)} iconClassName="h-9 w-9" />
        </span>
        <span className="flex flex-1 flex-col p-3">
          <span className="line-clamp-2 text-[13px] font-bold leading-snug text-[#111111]">{name}</span>
          {sub ? <span className="mt-0.5 truncate text-[11.5px] text-[#666666]">{sub}</span> : null}
          <span className="mt-1 truncate text-[11.5px] font-semibold text-[#475467]">{sellerLabel(item)}</span>
          <span className="mt-auto flex items-end justify-between gap-2 pt-2">
            <PriceTag item={item} className="text-[14.5px]" />
            {item.distanceKm != null ? (
              <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-[#666666]">
                <Navigation className="h-3 w-3" aria-hidden="true" />
                {item.distanceKm} km
              </span>
            ) : null}
          </span>
        </span>
      </button>
      {item.source === 'product' ? (
        <button
          type="button"
          onClick={onAdd}
          disabled={adding}
          aria-label={`Add ${name} to cart`}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#035C6C] text-white shadow-sm transition hover:bg-[#024A57] disabled:opacity-60"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        </button>
      ) : null}
    </div>
  );
}

function Rail({ title, items, onViewAll, renderItem }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold tracking-tight text-[#111111]">{title}</h2>
        <button type="button" onClick={onViewAll} className="inline-flex items-center gap-0.5 text-[13px] font-bold text-[#035C6C] hover:underline">
          View all
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">{items.map(renderItem)}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function MarketplacePage() {
  const router = useRouter();
  const gridRef = useRef(null);
  const [categories, setCategories] = useState(() => (Array.isArray(DEVICE_CATEGORIES) ? DEVICE_CATEGORIES : []));
  const [items, setItems] = useState([]);
  const [located, setLocated] = useState(true);
  const [catalog, setCatalog] = useState({ brands: new Map(), modelsById: new Map() });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState('ALL');
  const [query, setQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [sort, setSort] = useState('default');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [banners, setBanners] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('category');
    if (code) setActive(code.toUpperCase());
  }, []);

  // Category cards = the BUY rows of the admin's Category Menu (active, by
  // sortOrder, with their own images), each matched to its device category by
  // name ("Buy Mobile" -> Mobile). null = not loaded / failed, in which case
  // the device categories themselves are the cards.
  const [buyMenu, setBuyMenu] = useState(null);
  useEffect(() => {
    fetchMaster('/master/category-menu')
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        setBuyMenu(
          rows
            .filter((r) => String(r.categoryType).toUpperCase() === 'BUY' && r.isActive !== false)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        );
      })
      .catch(() => {});
    fetchMaster('/master/device-categories')
      .then((rows) => {
        if (!Array.isArray(rows) || !rows.length) return;
        const list = sortDeviceCategories(rows.filter((c) => c.isActive !== false));
        if (Array.isArray(list) && list.length) setCategories(list);
      })
      .catch(() => {});
    fetchBuyBanners().then(setBanners);
    getCart()
      .then((rows) => setCartCount(cartQuantity(rows)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    loadBuyFeed()
      .then(async (feed) => {
        const cat = await loadCatalog(feed.items.map((it) => it.brandId).filter(Boolean));
        if (!alive) return;
        setItems(feed.items);
        setLocated(feed.located);
        setCatalog(cat);
      })
      .catch((err) => alive && setError(err.message || 'Failed to load listings'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  function selectCategory(code) {
    setActive(code);
    setBrandFilter('');
    const url = new URL(window.location.href);
    if (code === 'ALL') url.searchParams.delete('category');
    else url.searchParams.set('category', code);
    window.history.replaceState(null, '', url);
  }

  // Brand, model name, category and a photo for each row from the master catalogue.
  const rows = useMemo(() => {
    const sameId = (a, b) => a != null && b != null && String(a).toLowerCase() === String(b).toLowerCase();
    return items.map((it) => {
      const model = it.modelId ? catalog.modelsById.get(String(it.modelId)) : null;
      const brandId = it.brandId || model?.brandId || null;
      const brand = brandId ? catalog.brands.get(String(brandId)) : null;
      // A listing's categoryId may be the device category's id, code or name;
      // when it matches nothing, its model's category places it instead.
      const matchCategory = (v) =>
        v == null || v === ''
          ? null
          : categories.find((c) => sameId(c.id, v) || sameId(c.code, v) || sameId(c.name, v)) || null;
      const category = matchCategory(it.categoryId) || matchCategory(it.categoryCode) || matchCategory(it.category) || matchCategory(model?.categoryId);
      const modelImage = resolveMediaUrl(model?.imageUrl) || (model?.imageBase64 ? `data:image/png;base64,${model.imageBase64}` : null);
      // Seller photo first, then any extra photos, then the catalogue model photo.
      const images = [...new Set([it.productImage, ...(Array.isArray(it.extraImageUrls) ? it.extraImageUrls : []), modelImage].filter(Boolean))];
      return {
        ...it,
        brandId,
        brandName: brand?.name || null,
        modelName: model?.name || null,
        categoryCode: category?.code || null,
        image: images[0] || null,
        images,
      };
    });
  }, [items, catalog, categories]);

  const counts = useMemo(() => {
    const c = { ALL: rows.length };
    rows.forEach((r) => {
      if (r.categoryCode) c[r.categoryCode] = (c[r.categoryCode] || 0) + 1;
    });
    return c;
  }, [rows]);

  const inCategory = useMemo(() => rows.filter((r) => active === 'ALL' || r.categoryCode === active), [rows, active]);

  // Brand options come from what's actually listed in this category.
  const brandOptions = useMemo(() => {
    const m = new Map();
    inCategory.forEach((r) => r.brandId && r.brandName && m.set(String(r.brandId), r.brandName));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [inCategory]);

  // The app's search: every word must appear somewhere on the card.
  const visible = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = inCategory.filter((r) => {
      if (brandFilter && String(r.brandId) !== brandFilter) return false;
      if (sellerFilter !== 'ALL' && (r.sellerType === 'CUSTOMER' ? 'CUSTOMER' : 'SHOP') !== sellerFilter) return false;
      if (!terms.length) return true;
      const hay = [
        r.productName, r.condition, r.description, r.shopName, r.city, r.state, r.address, r.brandName, r.modelName,
        isSparePart(r) ? 'spare part spares' : null,
        r.sellerType === 'CUSTOMER' ? 'customer' : 'shop',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    if (sort === 'price_asc') return [...list].sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === 'price_desc') return [...list].sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === 'nearest') return [...list].sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    return list; // Recommended: nearby listings (nearest first), then catalogue products
  }, [inCategory, query, brandFilter, sellerFilter, sort]);

  const browsing = active !== 'ALL' || Boolean(brandFilter) || Boolean(query.trim());
  const flashDeals = visible.slice(0, RAIL_SIZE);
  const trending = visible.some((r) => r.distanceKm != null)
    ? [...visible].sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)).slice(0, RAIL_SIZE)
    : [];

  const activeCategory = categories.find((c) => c.code === active);
  const brandName = brandOptions.find(([id]) => id === brandFilter)?.[1];
  const sectionName = activeCategory?.name || brandName || (query.trim() ? 'Search results' : 'All Items');
  const activeFilters = (brandFilter ? 1 : 0) + (sellerFilter !== 'ALL' ? 1 : 0) + (sort !== 'default' ? 1 : 0);
  const menuTabs = useMemo(() => {
    if (!buyMenu) return null;
    const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return buyMenu.map((m) => {
      const label = String(m.menuName || '').replace(/^\s*buy\s+/i, '').trim() || m.menuName;
      const device = categories.find((c) => norm(c.name) === norm(label) || norm(c.code) === norm(label).replace(/ /g, '_'));
      return { code: device?.code || `MENU_${m.id}`, name: label, imageUrl: m.imageUrl };
    });
  }, [buyMenu, categories]);
  const tabs = [{ code: 'ALL', name: 'All', imageUrl: null }, ...(menuTabs || categories)];

  // A ?category= link to a category that isn't on the Buy menu (e.g. a switched-off one) falls back to All.
  useEffect(() => {
    if (menuTabs && active !== 'ALL' && !menuTabs.some((t) => t.code === active)) setActive('ALL');
  }, [menuTabs, active]);

  function clearFilters() {
    setBrandFilter('');
    setSellerFilter('ALL');
    setSort('default');
  }

  function browseAll() {
    setQuery('');
    selectCategory('ALL');
    gridRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function openDetails(item) {
    rememberBuyItem(item);
    router.push(BUY_HREF.details);
  }

  async function quickAdd(item) {
    if (item.source !== 'product') {
      openDetails(item); // peer listings: contact the seller from the details page
      return;
    }
    setAddingId(item._key);
    try {
      await addToCart(item.id, 1);
      setCartCount((c) => c + 1);
      notifySuccess(`${item.productName || 'Item'} added to cart`);
    } catch (err) {
      notifyError(err, 'Could not add — try adding it from the details page.');
    } finally {
      setAddingId(null);
    }
  }

  function contact(item) {
    const phone = contactPhoneOf(item);
    if (phone) {
      window.location.href = telHref(phone);
      return;
    }
    toast(
      item.sellerType === 'CUSTOMER'
        ? 'This customer has not shared a phone number. Open View Details to see the listing.'
        : 'No contact phone available for this seller.',
      { id: `nophone:${item._key}` },
    );
  }

  const selectCls = cx(CONTROL, 'h-11 px-3 text-[13.5px] font-semibold text-[#111111] focus:border-[#035C6C] focus:outline-none');
  const cardProps = (item) => ({
    item,
    onOpen: () => openDetails(item),
    onAdd: () => quickAdd(item),
    onContact: () => contact(item),
    adding: addingId === item._key,
  });

  return (
    <div className="-m-4 min-h-full space-y-3 bg-white p-3 sm:-m-6 sm:p-4">
      {/* ---- Header ------------------------------------------------------ */}
      {/* Title, search, Filters and My Cart share one toolbar row. */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-2 min-w-0">
            <h1 className="text-[20px] font-extrabold leading-tight tracking-tight text-[#111111]">Buy</h1>
            <p className="hidden text-[12px] text-[#666666] md:block">Devices, spares &amp; more from shops and customers near you.</p>
          </div>
          <label className={cx(CONTROL, 'order-last flex h-10 w-full min-w-0 items-center gap-2.5 px-3.5 transition sm:order-none sm:w-auto sm:flex-1 focus-within:border-[#035C6C] focus-within:ring-4 focus-within:ring-[#035C6C]/10')}>
            <Search className="h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mobiles, spares, accessories..."
              aria-label="Search marketplace"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-[#111111] outline-none placeholder:text-[#98A2B3]"
            />
            {query ? (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="-m-1.5 shrink-0 p-1.5 text-[#98A2B3] hover:text-[#344054]">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className={cx(
              CONTROL,
              'inline-flex h-10 shrink-0 items-center gap-2 px-3 text-[13px] font-bold transition sm:px-3.5',
              filtersOpen || activeFilters ? 'border-[#035C6C] bg-[#F3F3F3] text-[#024A57]' : 'text-[#111111] hover:border-[#035C6C]',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilters ? <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#035C6C] px-1 text-[11px] text-white">{activeFilters}</span> : null}
          </button>
          <Link
            href={BUY_HREF.cart}
            aria-label={`My cart${cartCount ? `, ${cartCount} item${cartCount === 1 ? '' : 's'}` : ''}`}
            className="relative inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#ECECEC] bg-white px-3.5 text-[13px] font-bold text-[#111111] transition hover:border-[#035C6C] hover:text-[#035C6C]"
          >
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">My Cart</span>
            {cartCount ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#D92D20] px-1 text-[11px] font-extrabold text-white">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            ) : null}
          </Link>
        </div>

        {filtersOpen ? (
          <div className={cx(CONTROL, 'flex flex-wrap items-end gap-3 p-4')}>
            <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[12px] font-bold uppercase tracking-wide text-[#666666]">
              Sort by
              <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[12px] font-bold uppercase tracking-wide text-[#666666]">
              Brand
              <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className={selectCls}>
                <option value="">All brands</option>
                {brandOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex min-w-[240px] flex-1 flex-col gap-1">
              <legend className="mb-1 text-[12px] font-bold uppercase tracking-wide text-[#666666]">Seller</legend>
              <div className="flex gap-1.5">
                {SELLERS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    aria-pressed={sellerFilter === s.value}
                    onClick={() => setSellerFilter(s.value)}
                    className={cx(
                      'h-11 flex-1 rounded-[12px] border px-2 text-[13px] font-bold transition',
                      sellerFilter === s.value ? 'border-[#035C6C] bg-[#E5F3F5] text-[#024A57]' : 'border-[#ECECEC] bg-white text-[#344054] hover:border-[#D0D5DD]',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <button
              type="button"
              onClick={clearFilters}
              disabled={!activeFilters}
              className="h-11 rounded-[14px] px-4 text-[13.5px] font-bold text-[#024A57] transition hover:bg-[#F3F3F3] disabled:cursor-not-allowed disabled:text-[#98A2B3] disabled:hover:bg-transparent"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {/* ---- Category cards ----------------------------------------------
          Fixed-size tiles spread edge to edge when they fit (space-between
          falls back to start once they overflow, so narrow screens scroll).
          A short menu stays left-aligned rather than flinging two tiles to
          opposite ends. */}
      <div
        role="tablist"
        aria-label="Categories"
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((c, i) => {
          const selected = active === c.code;
          const Fallback = c.code === 'ALL' ? LayoutGrid : CATEGORY_ICONS[c.code] || Smartphone;
          const n = counts[c.code] || 0;
          return (
            <button
              key={c.code}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectCategory(c.code)}
              className={cx(
                'flex min-w-[150px] shrink-0 items-center gap-2.5 rounded-xl border p-2 text-left transition sm:min-w-0',
                selected ? 'border-[#035C6C] bg-[#E5F3F5] ring-1 ring-[#035C6C]' : 'border-[#ECECEC] bg-white hover:border-[#035C6C]/50',
              )}
            >
              <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg p-1', selected ? 'bg-white' : TINTS[i % TINTS.length])}>
                <Img src={resolveMediaUrl(c.imageUrl)} fallbackIcon={Fallback} iconClassName="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className={cx('block truncate text-[13px] font-bold', selected ? 'text-[#024A57]' : 'text-[#111111]')}>{c.name}</span>
                <span className="block text-[11.5px] text-[#666666]">{loading ? '…' : `${n} item${n === 1 ? '' : 's'}`}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Hero: the banner at its own shape (never stretched) beside the trust badges. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,880px)_minmax(0,1fr)]">
        <BuyBanner banners={banners} onBroken={(id) => setBanners((list) => list.filter((b) => b.id !== id))} onBrowse={browseAll} />
        <div className="flex flex-col gap-3">
          <Benefits />
        </div>
      </div>

      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}

      {/* ---- Rails (the app's home view) ---------------------------------- */}
      {/* Flash Deals / Trending only when there is more than one screen of listings — otherwise they just repeat All Items. */}
      {!browsing && !loading && !error && rows.length > 12 && flashDeals.length ? (
        <>
          <Rail title="Flash Deals" items={flashDeals} onViewAll={browseAll} renderItem={(it) => <RailCard key={it._key} {...cardProps(it)} />} />
          {trending.length ? (
            <Rail title="Trending Near You" items={trending} onViewAll={browseAll} renderItem={(it) => <RailCard key={it._key} {...cardProps(it)} />} />
          ) : null}
        </>
      ) : null}

      {/* ---- Section header + products ------------------------------------ */}
      <section ref={gridRef} className="scroll-mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-extrabold tracking-tight text-[#111111]">{sectionName}</h2>
          <span className="rounded-full bg-[#F3F3F3] px-2.5 py-0.5 text-[12.5px] font-bold text-[#024A57]">
            {loading ? '…' : `${visible.length} item${visible.length === 1 ? '' : 's'}`}
          </span>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            aria-label="Filter by brand"
            disabled={!brandOptions.length}
            className={cx(selectCls, 'ml-auto h-10 min-w-[150px] disabled:cursor-not-allowed disabled:text-[#98A2B3]')}
          >
            <option value="">Brand</option>
            {brandOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {!loading && !error ? (
          <p className="flex items-center gap-1.5 text-[12.5px] text-[#666666]">
            <MapPin className="h-3.5 w-3.5 text-[#035C6C]" aria-hidden="true" />
            {located
              ? `Listings within ${BUY_RADIUS_KM} km of your shop, plus shop catalogue items.`
              : "Add your shop's location to see the listings nearest to you."}
          </p>
        ) : null}

        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-[300px] w-[240px] shrink-0 animate-pulse rounded-[18px] border border-[#ECECEC] bg-[#F8F8F8]" />
            ))}
          </div>
        ) : error ? null : visible.length === 0 ? (
          <div className="flex flex-col items-center rounded-[20px] border border-[#ECECEC] bg-[#F8F8F8] px-4 py-14 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F3F3F3] text-[#035C6C]">
              <Store className="h-8 w-8" aria-hidden="true" />
            </span>
            <p className="mt-4 text-[16px] font-extrabold text-[#111111]">
              {query || activeFilters
                ? 'No items match your search'
                : `No ${brandName ? `${brandName} ` : ''}${activeCategory ? `${activeCategory.name.toLowerCase()} ` : ''}products available`}
            </p>
            <p className="mt-1 max-w-md text-[13.5px] text-[#666666]">
              {query || activeFilters ? 'Try a different search term, brand or filter.' : 'Listings from customers & shops and shop catalogue items will show up here.'}
            </p>
            {query || activeFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  clearFilters();
                }}
                className="mt-4 rounded-xl border border-[#ECECEC] bg-white px-4 py-2 text-[13.5px] font-bold text-[#024A57] transition hover:bg-[#F3F3F3]"
              >
                Clear search &amp; filters
              </button>
            ) : null}
          </div>
        ) : (
          <HScroll label="items">
            {visible.map((it) => (
              <div key={it._key} className="w-[220px] shrink-0 snap-start sm:w-[240px]">
                <BuyCard {...cardProps(it)} />
              </div>
            ))}
          </HScroll>
        )}
      </section>
    </div>
  );
}
