'use client';

/**
 * SellHome — the Sell on NearGFix home (/shop-home/sell/select-brand/ with no
 * ?category=), ported from the Partner app's OwnerSellHomeScreen, top to
 * bottom:
 *
 *   1. Category menu — All + the device categories in Sell order. Each chip's
 *      image: SELL Category Menu row (GET /master/category-menu?categoryType=SELL,
 *      matched by normKey) → the app's Sell art → the category's own imageUrl
 *      → an icon. A category starts the existing flow (sellBrandHref); "All"
 *      scrolls to the listings and expands them (there is no web My Listings).
 *   2. The admin's "Sell" banner(s) at their natural aspect ratio (never
 *      cropped), or a designed fallback hero when none is published.
 *   3. Three benefit cards.
 *   4. Your listed products — this shop's own SELL listings (fetchMySellListings),
 *      4 at first, "View all" for the rest; tapping a photo opens ImagePreviewModal.
 *
 * Every request here is a read-only GET.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from '@/components/PortalLink';
import {
  ChevronRight,
  ChevronUp,
  Gauge,
  Headphones,
  IndianRupee,
  Laptop,
  LayoutGrid,
  Package,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  Tablet,
  Watch,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import { loadCategoryMenu } from '@/components/site/RepairCategoryCards';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import ImagePreviewModal from '@/components/shop-dashboard/ImagePreviewModal';
import { normKey } from '@/lib/categoryMenuOrder';
import { resolveMediaUrl } from '@/lib/deviceImage';
import { BANNER_INTERVAL_MS } from '@/lib/siteContent';
import {
  fetchMySellListings,
  fetchSellBanners,
  fetchSellCategories,
  sellBrandHref,
  sellCategoryArt,
  sortSellCategories,
} from '@/lib/sellFlow';

const CATEGORY_ICONS = { MOBILE: Smartphone, TABLET: Tablet, LAPTOP: Laptop, SMARTWATCHES: Watch, AUDIO_DEVICE: Headphones };

// Per-category tile tint — the Partner app's screens/shared/categoryTints.js.
const TINTS = {
  MOBILE: '#E6F7E3',
  SMARTPHONE: '#E6F7E3',
  LAPTOP: '#F3ECFF',
  TABLET: '#EAF3FF',
  SMARTWATCH: '#EAF7F2',
  SMARTWATCHES: '#EAF7F2',
  AUDIO: '#FFF0F2',
  AUDIO_DEVICE: '#FFF0F2',
  AUDIO_DEVICES: '#FFF0F2',
};
const tintFor = (code) => TINTS[String(code || '').toUpperCase()] || '#F3F5F4';

const BENEFITS = [
  { icon: Gauge, title: 'Quick Listing', sub: 'List in less than 1 minute', tone: 'bg-[#E5F3F5] text-[#035C6C]' },
  { icon: ShieldCheck, title: 'Trusted Buyers', sub: '100% verified buyers', tone: 'bg-[#FFF3CD] text-[#B45309]' },
  { icon: ScanSearch, title: 'Best Price', sub: 'Get the best value for your device', tone: 'bg-[#E5F3F5] text-[#035C6C]' },
];

// Static promotional copy of the app's fallback hero — not business data.
const HERO_POINTS = [
  { title: 'Best Price', sub: 'Get top value' },
  { title: 'Quick & Easy', sub: 'List in minutes' },
  { title: 'Safe & Secure', sub: 'Trusted buyers' },
  { title: 'Trusted Platform', sub: 'Thousands of happy customers' },
];

const LISTING_LIMIT = 4;

const CHIP = 'group flex w-[68px] shrink-0 snap-start flex-col items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2 sm:w-[84px] lg:w-auto';
const CHIP_TILE = 'flex h-[60px] w-full items-center justify-center overflow-hidden rounded-2xl transition sm:h-[72px]';
const CHIP_LABEL = 'mt-1.5 w-full truncate text-center text-[11.5px] sm:text-[12.5px]';

const LISTING_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Brand + model, without doubling the brand when the model name already starts with it. */
function listingName(p) {
  const brand = String(p.brandName || '').trim();
  const model = String(p.modelName || p.title || '').trim();
  if (!model) return brand || 'Listed device';
  return !brand || model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`;
}

/** "256 GB • 12 GB RAM • Black" — storage, RAM, colour, whichever the listing has. */
function listingSpecs(p) {
  const ram = String(p.ramLabel || '').trim();
  return [p.storageLabel, ram && (/ram/i.test(ram) ? ram : `${ram} RAM`), p.color]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' • ');
}

function statusPill(status) {
  const s = String(status || '').trim().toUpperCase();
  if (!s || s === 'ACTIVE') return { label: 'Active', cls: 'bg-[#E5F3F5] text-[#035C6C]' };
  if (s === 'SOLD' || s === 'COMPLETED') return { label: 'Sold', cls: 'bg-[#F3F3F3] text-[#111111]' };
  if (s === 'CANCELLED' || s === 'CANCELED') return { label: 'Cancelled', cls: 'bg-[#FEE2E2] text-[#B91C1C]' };
  return { label: s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' '), cls: 'bg-[#F3F3F3] text-[#666666]' };
}

const formatPrice = (price) => (price != null && price !== '' && Number.isFinite(Number(price)) ? `₹${Number(price).toLocaleString('en-IN')}` : '—');

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** The first of `sources` that loads, contained in its box; the icon when none does. */
function FallbackImage({ sources, icon: Icon, className, iconClassName }) {
  const list = [...new Set(sources.filter(Boolean))];
  const key = list.join('|');
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [key]);
  const src = list[index];
  if (!src) return <Icon className={iconClassName} aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote master-data art, not an app asset Next can optimize.
    <img key={src} src={src} alt="" decoding="async" onError={() => setIndex((i) => i + 1)} className={cx('object-contain object-center', className)} />
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Category menu                                                            */
/* -------------------------------------------------------------------------- */

function CategoryMenu({ categories, menuImages, onAll }) {
  if (!categories) {
    return (
      <div className="-mx-4 flex gap-2.5 overflow-hidden px-4 sm:mx-0 sm:gap-3 sm:px-0" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="w-[68px] shrink-0 sm:w-[84px] lg:flex-1">
            <div className="h-[60px] animate-pulse rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] sm:h-[72px]" />
            <div className="mx-auto mt-2 h-2.5 w-3/4 animate-pulse rounded bg-[#F3F3F3]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <nav aria-label="Choose a category to sell">
      {/* Phones: one compact row that scrolls sideways (edge to edge). Desktop:
          one even row across the content width. */}
      <div
        className="-mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:gap-3 sm:px-0 lg:grid lg:overflow-visible [&::-webkit-scrollbar]:hidden"
        style={{ gridTemplateColumns: `repeat(${categories.length + 1}, minmax(0, 1fr))` }}
      >
        <button type="button" onClick={onAll} className={CHIP}>
          <span className={cx(CHIP_TILE, 'border-[1.5px] border-[#035C6C] bg-[#E5F3F5]')}>
            <LayoutGrid className="h-5 w-5 text-[#035C6C] sm:h-6 sm:w-6" aria-hidden="true" />
          </span>
          <span className={cx(CHIP_LABEL, 'font-bold text-[#035C6C]')}>All</span>
        </button>

        {categories.map((c) => {
          const code = String(c.code || '').toUpperCase();
          const Icon = CATEGORY_ICONS[code] || Smartphone;
          return (
            <Link key={c.code} href={sellBrandHref(c.code)} className={CHIP}>
              <span className={cx(CHIP_TILE, 'border border-[#ECECEC] group-hover:border-[#035C6C]/50')} style={{ backgroundColor: tintFor(code) }}>
                <FallbackImage
                  sources={[menuImages[normKey(c.name)] || menuImages[normKey(c.code)], sellCategoryArt(code), resolveMediaUrl(c.imageUrl)]}
                  icon={Icon}
                  className="h-[86%] w-[86%] transition-transform duration-200 motion-safe:group-hover:scale-105"
                  iconClassName="h-6 w-6 text-[#035C6C]/70"
                />
              </span>
              <span className={cx(CHIP_LABEL, 'font-semibold text-[#111111] group-hover:text-[#035C6C]')}>{c.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Sell banner / fallback hero                                              */
/* -------------------------------------------------------------------------- */

/** The admin's Sell banner(s). Each image keeps its own aspect ratio — never cropped. */
function SellBanner({ banners, startHref, onBroken }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;
  const current = Math.min(index, count - 1);

  useEffect(() => {
    if (count < 2 || paused || prefersReducedMotion()) return undefined;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), BANNER_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [count, current, paused]);

  // All slides share one grid cell, so the frame is as tall as the tallest
  // image at full width and every slide shows whole.
  const slides = banners.map((b, i) => (
    <div
      key={b.id || b.src}
      aria-hidden={i === current ? undefined : 'true'}
      className={cx(
        'col-start-1 row-start-1 flex items-center transition-opacity duration-700 motion-reduce:transition-none',
        i === current ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- admin banner from the media service, not an app asset. */}
      <img
        src={b.src}
        alt={i === current ? 'Sell on NearGFix' : ''}
        loading={i === 0 ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => onBroken(b.id)}
        className="block h-auto w-full"
      />
    </div>
  ));
  const frame = 'grid overflow-hidden rounded-[20px] border border-[#ECECEC] bg-[#F8F8F8]';

  return (
    <section aria-label="Sell offers" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {startHref ? (
        <Link href={startHref} aria-label="Start selling" className={cx(frame, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2')}>
          {slides}
        </Link>
      ) : (
        <div className={frame}>{slides}</div>
      )}
      {count > 1 ? (
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id || b.src}
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

/** Shown only when no Sell banner is published (the app's designed hero). */
function FallbackHero({ startHref }) {
  return (
    <section aria-label="Sell your devices" className="flex overflow-hidden rounded-[20px] border border-[#ECECEC] bg-white">
      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#035C6C] text-[13px] font-extrabold text-white" aria-hidden="true">
            G
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-extrabold tracking-[0.08em] text-[#035C6C]">NearGFix</span>
            <span className="block truncate text-[8.5px] tracking-wide text-[#666666]">SMART DEVICES. SMARTER CHOICE.</span>
          </span>
        </div>
        <h2 className="mt-3 text-[19px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[24px]">
          Sell Your Devices
          <span className="block text-[#035C6C]">Get the Best Value</span>
        </h2>
        <p className="mt-1 text-[11.5px] text-[#666666] sm:text-[13px]">Quick Evaluation · Instant Offers · Secure Payments</p>
        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 md:grid-cols-4">
          {HERO_POINTS.map((b) => (
            <li key={b.title} className="flex min-w-0 items-start gap-1.5">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-[#035C6C]" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-extrabold text-[#111111] sm:text-[12px]">{b.title}</span>
                <span className="block truncate text-[9.5px] text-[#666666] sm:text-[11px]">{b.sub}</span>
              </span>
            </li>
          ))}
        </ul>
        {startHref ? (
          <Link
            href={startHref}
            className="mt-4 inline-flex items-center gap-2.5 rounded-full bg-[#035C6C] py-1.5 pl-4 pr-1.5 text-[13px] font-extrabold text-white transition hover:bg-[#035C6C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2"
          >
            Sell Now
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#035C6C]">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        ) : null}
      </div>
      <div className="flex w-[96px] shrink-0 flex-col justify-between bg-gradient-to-br from-[#035C6C] to-[#035C6C] p-3 sm:w-[168px] sm:p-4" aria-hidden="true">
        <span className="flex h-12 w-12 flex-col items-center justify-center self-end rounded-full bg-white/15 text-white">
          <IndianRupee className="h-3.5 w-3.5" />
          <span className="mt-px text-center text-[6px] font-extrabold leading-tight">
            INSTANT
            <br />
            PAYMENT
          </span>
        </span>
        <Package className="mx-auto my-2 h-10 w-10 text-white/90 sm:h-14 sm:w-14" strokeWidth={1.4} />
        <span className="text-right text-[9px] italic leading-tight text-white/90 sm:text-[11px]">
          Turn Your Device
          <br />
          into Value
        </span>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Benefits                                                                 */
/* -------------------------------------------------------------------------- */

function Benefits() {
  return (
    <section aria-label="Why sell on NearGFix" className="grid grid-cols-3 gap-2 sm:gap-3">
      {BENEFITS.map(({ icon: Icon, title, sub, tone }) => (
        <div key={title} className="flex min-w-0 flex-col rounded-2xl border border-[#ECECEC] bg-white p-2.5 md:flex-row md:items-center md:gap-3 md:p-3.5">
          <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full md:h-10 md:w-10', tone)}>
            <Icon className="h-[15px] w-[15px] md:h-5 md:w-5" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="mt-1.5 min-w-0 md:mt-0">
            <span className="block truncate text-[12px] font-extrabold text-[#111111] md:text-[14px]">{title}</span>
            <span className="mt-0.5 line-clamp-2 block text-[10px] leading-[13px] text-[#666666] md:text-[12.5px] md:leading-snug">{sub}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Your listed products                                                     */
/* -------------------------------------------------------------------------- */

function ListingCard({ p, onPreview }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [p.image]);
  const name = listingName(p);
  const specs = listingSpecs(p);
  const pill = statusPill(p.status);
  const box = 'flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-[#F8F8F8]';

  return (
    <article className="flex min-w-0 flex-col rounded-[18px] border border-[#ECECEC] bg-white p-2.5 sm:p-3">
      {p.image && !broken ? (
        <button
          type="button"
          onClick={() => onPreview(p)}
          aria-label={`Preview image of ${name}`}
          className={cx(box, 'cursor-zoom-in transition hover:bg-[#F3F3F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C]')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- listing / master-data photo, not an app asset. */}
          <img src={p.image} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-[86%] w-[86%] object-contain object-center" />
        </button>
      ) : (
        <div className={box}>
          <Package className="h-8 w-8 text-[#035C6C]/60" aria-hidden="true" />
        </div>
      )}
      <p className="mt-2.5 line-clamp-2 text-[13px] font-bold leading-snug text-[#111111] sm:text-[14px]" title={name}>
        {name}
      </p>
      {specs ? <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[#666666] sm:text-[12px]">{specs}</p> : null}
      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <span className="truncate text-[15px] font-extrabold text-[#035C6C] sm:text-[16px]">{formatPrice(p.price)}</span>
        <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold', pill.cls)}>{pill.label}</span>
      </div>
    </article>
  );
}

function YourListings({ sectionRef, listings, error, onRetry, expanded, onToggle, onPreview, startHref }) {
  const count = Array.isArray(listings) ? listings.length : 0;
  const shown = expanded ? listings || [] : (listings || []).slice(0, LISTING_LIMIT);

  return (
    <section ref={sectionRef} aria-labelledby="sell-listings-title" className="scroll-mt-24">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="sell-listings-title" className="flex items-center gap-2 text-[16px] font-extrabold tracking-tight text-[#111111] sm:text-[18px]">
          Your listed products
          {listings && !error && count ? (
            <span className="rounded-full bg-[#F3F3F3] px-2 py-0.5 text-[11.5px] font-bold text-[#035C6C]">{count}</span>
          ) : null}
        </h2>
        {/* Only when there is more than the first row to show. */}
        {!error && count > LISTING_LIMIT ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg text-[13px] font-extrabold text-[#035C6C] transition hover:text-[#035C6C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C]"
          >
            {expanded ? 'Show less' : 'View all'}
            {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </button>
        ) : null}
      </div>

      {error ? (
        <ErrorBanner message={error} onRetry={onRetry} />
      ) : !listings ? (
        <div className={LISTING_GRID} aria-hidden="true">
          {Array.from({ length: LISTING_LIMIT }, (_, i) => (
            <div key={i} className="h-[236px] animate-pulse rounded-[18px] border border-[#ECECEC] bg-[#F8F8F8] sm:h-[300px]" />
          ))}
        </div>
      ) : count === 0 ? (
        <div className="rounded-[18px] border border-[#ECECEC] bg-[#F8F8F8]">
          <EmptyState
            icon={Package}
            tone="muted"
            title="You haven't listed any products yet"
            description="Pick a category above to list your first device for verified buyers nearby."
            action={
              startHref ? (
                <Link
                  href={startHref}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#035C6C] px-4 py-2 text-[13px] font-bold text-white transition hover:bg-[#035C6C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2"
                >
                  Start listing
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : null
            }
          />
        </div>
      ) : (
        <div className={LISTING_GRID}>
          {shown.map((p) => (
            <ListingCard key={p.id} p={p} onPreview={onPreview} />
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page body                                                                   */
/* -------------------------------------------------------------------------- */

export default function SellHome() {
  const [categories, setCategories] = useState(null); // null = loading
  const [menuImages, setMenuImages] = useState({}); // normKey(menu name) -> image
  const [banners, setBanners] = useState(null); // null = loading, [] = none → fallback hero
  const [brokenBanners, setBrokenBanners] = useState([]);
  const [listings, setListings] = useState(null); // null = loading
  const [listingsError, setListingsError] = useState('');
  const [listingsKey, setListingsKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState(null);
  const listingsRef = useRef(null);

  // Categories + the SELL Category Menu images together, so a chip never
  // swaps its picture after first paint.
  useEffect(() => {
    let alive = true;
    Promise.all([fetchSellCategories(), loadCategoryMenu('SELL')])
      .then(([list, menu]) => {
        if (!alive) return;
        const images = {};
        (Array.isArray(menu) ? menu : [])
          .filter((row) => row && row.isActive === true)
          .forEach((row) => {
            const key = normKey(row.menuName);
            const url = resolveMediaUrl(row.imageUrl);
            if (key && url && !images[key]) images[key] = url;
          });
        setMenuImages(images);
        setCategories(sortSellCategories(list));
      })
      .catch(() => alive && setCategories([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchSellBanners().then((rows) => alive && setBanners(rows));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setListings(null);
    setListingsError('');
    fetchMySellListings()
      .then((rows) => alive && setListings(rows))
      .catch((err) => alive && setListingsError(err.message || 'Could not load your listed products.'));
    return () => {
      alive = false;
    };
  }, [listingsKey]);

  const startHref = categories?.length ? sellBrandHref(categories[0].code) : null;
  const liveBanners = (banners || []).filter((b) => !brokenBanners.includes(b.id));

  // "All": there is no web My Listings page, so it opens the full list here.
  const showAllListings = useCallback(() => {
    setExpanded(true);
    listingsRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, []);
  const closePreview = useCallback(() => setPreview(null), []);
  const markBannerBroken = useCallback((id) => setBrokenBanners((ids) => (ids.includes(id) ? ids : [...ids, id])), []);

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6">
      <CategoryMenu categories={categories} menuImages={menuImages} onAll={showAllListings} />

      {banners === null ? (
        <div className="aspect-[12/5] w-full animate-pulse rounded-[20px] border border-[#ECECEC] bg-[#F8F8F8]" aria-hidden="true" />
      ) : liveBanners.length ? (
        <SellBanner banners={liveBanners} startHref={startHref} onBroken={markBannerBroken} />
      ) : (
        <FallbackHero startHref={startHref} />
      )}

      <Benefits />

      <YourListings
        sectionRef={listingsRef}
        listings={listings}
        error={listingsError}
        onRetry={() => setListingsKey((k) => k + 1)}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onPreview={setPreview}
        startHref={startHref}
      />

      <ImagePreviewModal
        open={Boolean(preview)}
        src={preview?.image}
        title={preview ? listingName(preview) : ''}
        subtitle={preview ? listingSpecs(preview) : ''}
        onClose={closePreview}
      />
    </div>
  );
}
