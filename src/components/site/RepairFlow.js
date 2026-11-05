'use client';

/**
 * RepairFlow — the public "pick your device" wizard for /repair.
 *
 * Mirrors the NearGFix customer app's Select Brand → Select Product screens
 * (ggfix-customer-app/src/screens/customer/device/Select{Brand,Model}Screen.js)
 * as a WEBSITE flow, so a visitor can drill Category → Brand → Product in the
 * browser. Booking itself still happens in the app (the site has no customer
 * login), so the final step is a device summary showing the chosen model with
 * its colours and storage/RAM options — informational, not a checkout.
 *
 * STATE LIVES IN THE URL, not React state, so the browser Back button walks
 * back through the steps and any step is a shareable/bookmarkable link:
 *   /repair/                                   → category grid
 *   /repair/?category=MOBILE                   → brand grid
 *   /repair/?category=MOBILE&brand=<id>&…      → product grid
 *   /repair/?…&model=<id>&modelName=…          → device summary + CTA
 * That is also why every step transition is a <Link> (never a router.push):
 * links give us prefetch, middle-click-to-open and correct history for free.
 *
 * The categories render from the bundled DEVICE_CATEGORIES on first paint (so
 * the static export is correct with no spinner), then refresh from master-data.
 * Brands / series / models are ONLY available from the live master-data service
 * — there is no bundled fallback for them — so those steps show a friendly
 * empty state (and a "continue in the app" nudge) when the service can't be
 * reached, exactly like the rest of the site degrades.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/PortalLink';
import { useRouter, useSearchParams } from '@/lib/portalNavigation';
import {
  BatteryCharging,
  Calendar,
  Camera,
  Check,
  CircleCheck,
  Clock,
  Cpu,
  Droplets,
  Fingerprint,
  Headphones,
  Home,
  Laptop,
  MapPin,
  MessageCircle,
  Mic,
  Minus,
  MonitorSmartphone,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Signal,
  Smartphone,
  Store,
  Tablet,
  Tag,
  Truck,
  Vibrate,
  Volume2,
  Watch,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

import { MEDIA_UPLOAD_URL, SHOP_BASE, masterApi } from '@/lib/api';
import { colorHexFromData, colorNames, resolveVariantImage, storagesForColor } from '@/lib/colorImages';
import { badgeOf, frames360Of, galleryOf, ratingOf, taglineOf } from '@/lib/productDetails';
import RepairDeviceSections from '@/components/site/RepairDeviceSections';
import { Button, cx } from '@/components/site/ui';
import LoginModal from '@/components/site/LoginModal';
import { isLoggedIn, readCustomer } from '@/lib/customerAuth';
import {
  createAddress,
  createRepairBooking,
  formatAddress,
  getPickupSlots,
  getShopPublic,
  listAddresses,
  readPhotos,
  savePhotos,
} from '@/lib/repairBooking';
import { lookupPlaceName, readGeo, subscribe as subscribeGeo, writeGeo } from '@/components/site/geo';
import { DEVICE_CATEGORIES, sortDeviceCategories } from '@/lib/siteContent';
import DEVICE_COLORS from '@/lib/deviceColors.json';
import { notifyError } from '@/lib/toast';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** master-data verbs sometimes wrap the list in { content } / { data }. */
function unwrap(list) {
  if (Array.isArray(list)) return list;
  return list?.content ?? list?.data ?? [];
}

/** Resolve a master row's image: hosted URL first, else an inline base64 blob. */
function resolveImg(row) {
  if (!row) return null;
  if (typeof row.imageUrl === 'string' && row.imageUrl) return row.imageUrl;
  if (typeof row.imageBase64 === 'string' && row.imageBase64) {
    return `data:image/png;base64,${row.imageBase64}`;
  }
  return null;
}

const CATEGORY_FALLBACK_ICONS = {
  MOBILE: Smartphone,
  TABLET: Tablet,
  LAPTOP: Laptop,
  SMARTWATCHES: Watch,
  AUDIO_DEVICE: Headphones,
};

/* Repair-category icons. The API's iconUrl is null for every category, so the
 * icon is chosen by matching a keyword in the category NAME (more reliable than
 * the code — e.g. "Display & Touch" has code MOBILE_BACK_PANEL_CONDITION). */
const REPAIR_CAT_ICONS = [
  [/audio|mic|speaker|sound|ring/, Mic],
  [/display|touch|screen/, MonitorSmartphone],
  [/camera|flash|lens/, Camera],
  [/network|sim|signal|call/, Signal],
  [/power|charg|battery/, BatteryCharging],
  [/software|system|os|update/, Cpu],
  [/water|liquid|moisture/, Droplets],
  [/body|button|frame|panel|back/, Smartphone],
];

function repairCatIcon(name) {
  const s = String(name || '').toLowerCase();
  for (const [re, Icon] of REPAIR_CAT_ICONS) {
    if (re.test(s)) return Icon;
  }
  return Wrench;
}

/* Per-service icons, matched on the service NAME. More granular than the
 * category icon so a row like "Flash Not Working" reads differently from
 * "Camera Blur"; anything unmatched inherits its category's icon. */
const SERVICE_ICONS = [
  [/hotspot|wifi|network|sim|signal|bluetooth/, Signal],
  [/mic/, Mic],
  [/speaker|sound|volume|ringtone|audio/, Volume2],
  [/earpiece|headphone|jack/, Headphones],
  [/flash/, Zap],
  [/camera|lens|blur/, Camera],
  [/fingerprint|face/, Fingerprint],
  [/vibrat|motor/, Vibrate],
  [/battery|charg|power|heat|drain/, BatteryCharging],
  [/display|touch|screen|lcd|glass/, MonitorSmartphone],
  [/water|liquid|moist|damp/, Droplets],
  [/software|hang|restart|reboot|update|boot|virus|slow|lag|freez/, Cpu],
  [/button|panel|frame|body|back/, Smartphone],
];

function serviceIcon(name, fallback) {
  const s = String(name || '').toLowerCase();
  for (const [re, Icon] of SERVICE_ICONS) {
    if (re.test(s)) return Icon;
  }
  return fallback || Wrench;
}

/** Build a /repair/ URL from a partial set of step params (keeps trailing slash). */
function stepHref({ category, brand, brandName, model, modelName } = {}) {
  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  if (brand) qs.set('brand', brand);
  if (brandName) qs.set('brandName', brandName);
  if (model) qs.set('model', model);
  if (modelName) qs.set('modelName', modelName);
  const s = qs.toString();
  return s ? `/repair/?${s}` : '/repair/';
}

/* -------------------------------------------------------------------------- */
/* Small presentational bits                                                   */
/* -------------------------------------------------------------------------- */

function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-brand-muted">
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
        aria-hidden="true"
      />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-brand-strong bg-white/60 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-700">
        <Wrench className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-base font-bold text-brand-ink">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-brand-muted">
            {description}
          </p>
        ) : null}
      </div>
      <Button href="/contact" variant="outline" size="sm" icon="ArrowRight">
        Continue in the NearGFix app
      </Button>
    </div>
  );
}

/** Header search box — filters the current step's grid by name, client-side. */
function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-subtle"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-brand-line bg-white py-2.5 pl-9 pr-9 text-base text-brand-ink sm:text-sm placeholder:text-brand-subtle focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-brand-muted hover:bg-brand-soften"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main                                                                         */
/* -------------------------------------------------------------------------- */

export default function RepairFlow() {
  const params = useSearchParams();
  const code = params.get('category');
  const brandId = params.get('brand');
  const brandNameParam = params.get('brandName') || '';
  const modelId = params.get('model');
  const modelNameParam = params.get('modelName') || '';
  const serviceParam = params.get('service');
  const reportParam = params.get('report');
  const optionsParam = params.get('options');
  const shopsParam = params.get('shops');
  const shopParam = params.get('shop');
  const addressParam = params.get('address');
  const slotParam = params.get('slot');
  const reviewParam = params.get('review');
  const addrIdParam = params.get('addr') || '';
  const dateParam = params.get('date') || '';
  const startParam = params.get('start') || '';
  const endParam = params.get('end') || '';
  const viaParam = params.get('via') || 'pickup';
  const serviceIdsParam = params.get('services') || '';

  const step = (() => {
    if (!modelId) return brandId ? 'product' : code ? 'brand' : 'category';
    if (!reportParam) return serviceParam ? 'service' : 'summary';
    // Booking chain, deepest marker wins.
    if (reviewParam) return 'review';
    if (slotParam) return 'slot';
    if (addressParam) return 'address';
    if (shopParam) return 'shopDetail';
    if (shopsParam) return 'shops';
    if (optionsParam) return 'options';
    return 'report';
  })();

  /* ── Categories: bundled on first paint, live-refreshed. ─────────────────── */
  const [categories, setCategories] = useState(() =>
    Array.isArray(DEVICE_CATEGORIES) ? DEVICE_CATEGORIES : [],
  );
  // code (upper) → category UUID. Needed to filter a brand's models down to the
  // chosen category (a brand like Apple spans phones, tablets, watches, laptops).
  const [idByCode, setIdByCode] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = unwrap(await masterApi.get('/master/device-categories'));
        if (!alive || !Array.isArray(rows) || rows.length === 0) return;
        const map = {};
        rows.forEach((r) => {
          if (r && r.code && r.id) map[String(r.code).toUpperCase()] = r.id;
        });
        const sorted = sortDeviceCategories(rows);
        if (Array.isArray(sorted) && sorted.length) setCategories(sorted);
        setIdByCode(map);
      } catch {
        /* keep bundled rows — a public page never surfaces a backend error. */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.code === code) || null,
    [categories, code],
  );
  const categoryName = selectedCategory?.name || code || '';

  /* ── Brands for the chosen category. ─────────────────────────────────────── */
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);

  useEffect(() => {
    if (!code) {
      setBrands([]);
      return;
    }
    let alive = true;
    setBrandsLoading(true);
    (async () => {
      try {
        const rows = unwrap(
          await masterApi.get(
            `/master/categories/by-code/${encodeURIComponent(String(code).toUpperCase())}/brands`,
          ),
        );
        if (alive) setBrands(Array.isArray(rows) ? rows : []);
      } catch {
        if (alive) setBrands([]);
      } finally {
        if (alive) setBrandsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [code]);

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === brandId) || null,
    [brands, brandId],
  );
  const brandName = selectedBrand?.name || brandNameParam;

  /* ── Models + series for the chosen (category, brand). ───────────────────── */
  const [allModels, setAllModels] = useState([]);
  const [series, setSeries] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    if (!code || !brandId) {
      setAllModels([]);
      setSeries([]);
      return;
    }
    let alive = true;
    setModelsLoading(true);
    (async () => {
      try {
        const upper = encodeURIComponent(String(code).toUpperCase());
        const [modelRows, seriesRows] = await Promise.all([
          masterApi.get(`/master/brands/${brandId}/models`).then(unwrap).catch(() => []),
          masterApi
            .get(`/master/categories/by-code/${upper}/brands/${brandId}/series`)
            .then(unwrap)
            .catch(() => []),
        ]);
        if (!alive) return;
        setAllModels(Array.isArray(modelRows) ? modelRows : []);
        setSeries(Array.isArray(seriesRows) ? seriesRows : []);
      } catch {
        if (alive) {
          setAllModels([]);
          setSeries([]);
        }
      } finally {
        if (alive) setModelsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, brandId]);

  // A brand's model list spans every category it makes devices in, so keep only
  // the ones in the chosen category (same rule the app uses). Models with no
  // categoryId are kept — legacy rows that predate the column.
  const categoryModels = useMemo(() => {
    const catId = idByCode[String(code || '').toUpperCase()] || null;
    if (!catId) return allModels;
    return allModels.filter((m) => !m.categoryId || m.categoryId === catId);
  }, [allModels, idByCode, code]);

  /* ── Per-step local UI state (reset when the step changes). ──────────────── */
  const [q, setQ] = useState('');
  const [selSeriesId, setSelSeriesId] = useState(null);

  useEffect(() => {
    setQ('');
    setSelSeriesId(null);
  }, [code, brandId]);

  const seriesWithModels = useMemo(() => {
    const ids = new Set(categoryModels.map((m) => m.seriesId).filter(Boolean));
    return (series || []).filter((s) => ids.has(s.id));
  }, [series, categoryModels]);

  const shownBrands = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return brands;
    return brands.filter((b) => (b.name || '').toLowerCase().includes(needle));
  }, [brands, q]);

  const shownModels = useMemo(() => {
    let list = selSeriesId ? categoryModels.filter((m) => m.seriesId === selSeriesId) : categoryModels;
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((m) => (m.name || '').toLowerCase().includes(needle));
    return list;
  }, [categoryModels, selSeriesId, q]);

  const selectedModel = useMemo(
    () => categoryModels.find((m) => m.id === modelId) || null,
    [categoryModels, modelId],
  );
  const modelName = selectedModel?.name || modelNameParam;

  /* The step trail now lives in the page-level <RepairBreadcrumb>, which reads the
     same URL params — so nothing is built here any more. */

  const headings = {
    category: 'Select your device category to repair',
    brand: `Select a brand`,
    product: `Select your ${brandName || categoryName} product`,
    summary: 'Your device',
    service: 'Select a repair service',
  };
  const subheadings = {
    brand: `Choose the brand of your ${categoryName || 'device'}.`,
    product: `Pick the exact model so the shop knows what it is working on.`,
    summary: 'Book the repair in the NearGFix app, or find a shop near you to take it in.',
    service: `Tell us what needs fixing on your ${modelName || 'device'} — pick as many as apply.`,
  };

  // The device-category UUID for the chosen code, so the service step can filter
  // repair categories to this device type (Mobile / Tablet / …).
  const deviceCategoryId = idByCode[String(code || '').toUpperCase()] || null;
  // Base URL carrying the full device selection; the service/report steps append
  // their own markers to it.
  const deviceHref = stepHref({
    category: code,
    brand: brandId,
    brandName,
    model: modelId,
    modelName,
  });
  const serviceHref = `${deviceHref}&service=1`;
  const reportHrefFull = `${deviceHref}&report=1${serviceIdsParam ? `&services=${serviceIdsParam}` : ''}`;
  const optionsHref = `${reportHrefFull}&options=1`;
  const shopsHref = `${optionsHref}&shops=1&via=${viaParam}`;
  // Booking-chain URLs, each layering the next step's marker onto the last.
  const shopHref = shopParam ? `${shopsHref}&shop=${shopParam}` : shopsHref;
  const addressHref = `${shopHref}&address=1`;
  const slotHref = `${addressHref}&addr=${addrIdParam}&slot=1`;
  const deviceForModal = { name: modelName, imageUrl: resolveImg(selectedModel) };

  return (
    <div>
      {/* No breadcrumb here any more — the page-level <RepairBreadcrumb> renders
          the single unified trail (Home › Repair › Categories › Mobile › …), so
          this panel starts straight at the step heading. */}

      {/* Heading + (from step 2) the search box on the same row. */}
      {/* On the device page the product name is the heading (SummaryStep), so
          the generic "Your device" title is not repeated above it. */}
      <div className={cx('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', step === 'summary' && 'hidden')}>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
            {headings[step]}
          </h2>
          {subheadings[step] ? (
            <p className="mt-1.5 text-sm leading-relaxed text-brand-muted sm:text-base">
              {subheadings[step]}
            </p>
          ) : null}
        </div>

        {step === 'brand' && brands.length > 6 ? (
          <SearchBox value={q} onChange={setQ} placeholder="Search brand" />
        ) : null}
        {step === 'product' && categoryModels.length > 8 ? (
          <SearchBox value={q} onChange={setQ} placeholder={`Search ${brandName || 'product'}`} />
        ) : null}
      </div>

      <div className="mt-6">
        {step === 'category' ? (
          <CategoryStep categories={categories} />
        ) : null}

        {step === 'brand' ? (
          brandsLoading ? (
            <Spinner label="Loading brands…" />
          ) : shownBrands.length === 0 ? (
            <EmptyState
              title={q ? 'No brands found' : 'No brands yet'}
              description={
                q
                  ? `Nothing matches "${q.trim()}".`
                  : `We don't have brands mapped to ${categoryName || 'this category'} on the web yet — the app has the full catalogue.`
              }
            />
          ) : (
            <BrandStep brands={shownBrands} categoryCode={code} />
          )
        ) : null}

        {step === 'product' ? (
          modelsLoading ? (
            <Spinner label="Loading products…" />
          ) : (
            <ProductStep
              models={shownModels}
              series={seriesWithModels}
              selSeriesId={selSeriesId}
              onSelectSeries={setSelSeriesId}
              categoryCode={code}
              brandId={brandId}
              brandName={brandName}
              searching={!!q.trim()}
              query={q}
            />
          )
        ) : null}

        {step === 'summary' ? (
          // key by model so the colour/storage selection resets when the visitor
          // switches to a different device.
          <SummaryStep
            key={modelId}
            categoryName={categoryName}
            categoryCode={code}
            brandId={brandId}
            brandName={brandName}
            modelName={modelName}
            model={selectedModel}
            siblings={categoryModels}
            seriesName={series.find((s) => s.id === selectedModel?.seriesId)?.name || ''}
            deviceCategoryId={deviceCategoryId}
            image={resolveImg(selectedModel) || resolveImg(selectedBrand)}
            serviceHref={serviceHref}
          />
        ) : null}

        {step === 'service' ? (
          <ServiceStep
            key={modelId}
            deviceCategoryId={deviceCategoryId}
            modelName={modelName}
            deviceHref={deviceHref}
            device={deviceForModal}
          />
        ) : null}

        {step === 'report' ? (
          <ReportStep
            key={modelId}
            modelId={modelId}
            categoryName={categoryName}
            brandName={brandName}
            modelName={modelName}
            model={selectedModel}
            image={resolveImg(selectedModel) || resolveImg(selectedBrand)}
            serviceIds={serviceIdsParam}
            serviceHref={serviceHref}
            optionsHref={optionsHref}
          />
        ) : null}

        {step === 'options' ? (
          <ServiceOptionsStep
            key={modelId}
            modelName={modelName}
            serviceIds={serviceIdsParam}
            reportHref={reportHrefFull}
          />
        ) : null}

        {step === 'shops' ? (
          <ShopStep key={modelId} modelName={modelName} via={viaParam} optionsHref={optionsHref} />
        ) : null}

        {step === 'shopDetail' ? (
          <ShopDetailStep
            key={shopParam}
            shopId={shopParam}
            shopsHref={shopsHref}
            addressHref={addressHref}
          />
        ) : null}

        {step === 'address' ? (
          <AddressStep key={modelId} addressHref={addressHref} backHref={shopHref} />
        ) : null}

        {step === 'slot' ? (
          <SlotStep key={shopParam} shopId={shopParam} slotHref={slotHref} backHref={addressHref} />
        ) : null}

        {step === 'review' ? (
          <ReviewStep
            key={modelId}
            modelId={modelId}
            brandId={brandId}
            modelName={modelName}
            brandName={brandName}
            categoryName={categoryName}
            image={resolveImg(selectedModel) || resolveImg(selectedBrand)}
            model={selectedModel}
            via={viaParam}
            shopId={shopParam}
            serviceIds={serviceIdsParam}
            addressId={addrIdParam}
            pickupDate={dateParam}
            pickupStart={startParam}
            pickupEnd={endParam}
            backHref={slotHref}
          />
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step: Category                                                              */
/* -------------------------------------------------------------------------- */
/* Same fixed 148×98.66 tiles as the old presentational grid, but each is now a
 * link that advances the wizard. */

function CategoryStep({ categories }) {
  const [broken, setBroken] = useState({});
  if (!categories.length) return null;

  return (
    <ul
      role="list"
      aria-label="Device categories we repair"
      className="grid max-w-[804px] list-none grid-cols-2 gap-x-3 gap-y-6 p-0 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-5"
    >
      {categories.map((cat) => {
        const Fallback = CATEGORY_FALLBACK_ICONS[cat.code] || Wrench;
        const img = resolveImg(cat);
        const showFallback = broken[cat.code] || !img;
        return (
          <li key={cat.code || cat.name} className="flex flex-col items-center">
            <Link
              href={stepHref({ category: cat.code })}
              scroll={false}
              className="group flex w-full flex-col items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
            >
              <div className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-2xl border border-brand-line bg-white p-2.5 transition duration-200 group-hover:border-brand-300 group-hover:bg-brand-50 motion-safe:group-hover:-translate-y-0.5 sm:p-3">
                {showFallback ? (
                  <Fallback className="h-9 w-9 text-brand-600 sm:h-11 sm:w-11" aria-hidden="true" />
                ) : (
                  <img
                    src={img}
                    alt=""
                    width={160}
                    height={160}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain"
                    onError={() =>
                      setBroken((p) => (p[cat.code] ? p : { ...p, [cat.code]: true }))
                    }
                  />
                )}
              </div>
              <p className="mt-2 w-full break-words text-center text-xs font-medium text-brand-ink group-hover:text-brand-700 sm:text-sm">
                {cat.name}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Step: Brand                                                                 */
/* -------------------------------------------------------------------------- */

function BrandLogo({ brand }) {
  const [broken, setBroken] = useState(false);
  const img = resolveImg(brand);
  const initial = (brand.name || '?').slice(0, 1).toUpperCase();
  // Responsive square logo tile: fills the card width (capped) and scales up on
  // wider cards, instead of a fixed 54px that looked lost in a large tile. The
  // image fills the tile with padding, so any logo aspect ratio reads centred.
  const tile =
    'flex aspect-square w-full max-w-[88px] items-center justify-center overflow-hidden rounded-2xl';
  if (img && !broken) {
    return (
      <div className={cx(tile, 'border border-brand-line bg-white')}>
        <img
          src={img}
          alt=""
          width={160}
          height={160}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-2.5"
          onError={() => setBroken(true)}
        />
      </div>
    );
  }
  return (
    <div className={cx(tile, 'bg-brand-soft')}>
      <span className="text-2xl font-extrabold text-brand-700">{initial}</span>
    </div>
  );
}

function BrandStep({ brands, categoryCode }) {
  return (
    <ul
      role="list"
      aria-label="Brands"
      className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      {brands.map((b) => (
        <li key={b.id}>
          <Link
            href={stepHref({ category: categoryCode, brand: b.id, brandName: b.name })}
            scroll={false}
            className="group flex flex-col items-center rounded-2xl border border-brand-line bg-white p-3 text-center shadow-soft transition hover:border-brand-300 hover:bg-brand-50 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
          >
            <BrandLogo brand={b} />
            <span className="mt-2 line-clamp-1 w-full text-xs font-bold text-brand-ink">
              {b.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Step: Product                                                               */
/* -------------------------------------------------------------------------- */

function ModelImage({ model, categoryCode }) {
  const [broken, setBroken] = useState(false);
  // Most laptop models have no image in master data yet; the placeholder
  // should at least be the right kind of device.
  const Fallback = CATEGORY_FALLBACK_ICONS[String(categoryCode || '').toUpperCase()] || Smartphone;
  const img = resolveImg(model);
  if (img && !broken) {
    return (
      <img
        src={img}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
        onError={() => setBroken(true)}
      />
    );
  }
  return <Fallback className="h-1/2 w-1/2 text-brand-400" aria-hidden="true" />;
}

function ProductStep({
  models,
  series,
  selSeriesId,
  onSelectSeries,
  categoryCode,
  brandId,
  brandName,
  searching,
  query,
}) {
  return (
    <div>
      {/* Series chips filter the grid (Cashify-style), when the brand has series. */}
      {series.length > 0 ? (
        <div className="mb-6">
          <p className="mb-2.5 text-sm font-bold text-brand-ink">Filter by series</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSelectSeries(null)}
              className={cx(
                'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
                selSeriesId === null
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-brand-line bg-white text-brand-ink hover:border-brand-300',
              )}
            >
              All
            </button>
            {series.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSeries(s.id)}
                className={cx(
                  'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition',
                  selSeriesId === s.id
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-brand-line bg-white text-brand-ink hover:border-brand-300',
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {models.length === 0 ? (
        <EmptyState
          title={searching ? 'No products found' : 'No products yet'}
          description={
            searching
              ? `Nothing matches "${query.trim()}".`
              : `No ${brandName || ''} models published for this category on the web yet — the app has the full catalogue.`
          }
        />
      ) : (
        <ul
          role="list"
          aria-label="Products"
          className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4"
        >
          {models.map((m) => (
            <li key={m.id}>
              <Link
                href={stepHref({
                  category: categoryCode,
                  brand: brandId,
                  brandName,
                  model: m.id,
                  modelName: m.name,
                })}
                scroll={false}
                className="group flex flex-col items-center rounded-2xl border border-brand-line bg-white p-3 shadow-soft transition hover:border-brand-300 hover:bg-brand-50 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
              >
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl">
                  <ModelImage model={m} categoryCode={categoryCode} />
                </div>
                <span className="mt-2 line-clamp-2 min-h-[2.5rem] w-full text-center text-[11px] font-bold leading-tight text-brand-ink">
                  {m.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step: Summary                                                               */
/* -------------------------------------------------------------------------- */

/* Marketing colour names ("Diamond Black", "Skyline Blue") are not CSS colours,
 * so a swatch cannot be styled from the name directly. This maps the base colour
 * WORDS that actually appear in device colour names to a hex, and colorHex()
 * finds the last recognised word in a name — deliberately light instead of
 * pulling the admin's 32k-entry color-name-list into the public bundle. */
const COLOR_WORDS = {
  black: '#111827', white: '#e5e7eb', grey: '#6b7280', gray: '#6b7280',
  silver: '#c4c8cc', gold: '#d4af37', golden: '#d4af37', rose: '#e8b4b8',
  pink: '#ec4899', red: '#ef4444', crimson: '#dc2626', maroon: '#7f1d1d',
  orange: '#f97316', amber: '#f59e0b', yellow: '#eab308', lime: '#84cc16',
  green: '#035C6C', emerald: '#035C6C', teal: '#14b8a6', cyan: '#06b6d4',
  aqua: '#22d3ee', sky: '#0ea5e9', blue: '#2563eb', navy: '#1e3a8a',
  indigo: '#4f46e5', violet: '#7c3aed', purple: '#9333ea', lavender: '#b57edc',
  brown: '#92400e', bronze: '#cd7f32', copper: '#b87333', coffee: '#6f4e37',
  graphite: '#383838', charcoal: '#36454f', titanium: '#878681', platinum: '#dcdcdc',
  midnight: '#0f172a', night: '#0f172a', space: '#1f2933', starlight: '#dfe3e8',
  starry: '#334155', mint: '#7fdca4', turquoise: '#40e0d0', coral: '#ff7f50',
  ivory: '#f2ecdd', cream: '#f5efd6', beige: '#e8dcc4', pearl: '#e6ddcf',
  glowing: '#334155', nebula: '#3b3f7a', cosmic: '#3b3f7a', ocean: '#0369a1',
  forest: '#023A44', sea: '#0891b2',
};

/** Resolve a device colour name to a hex, or null when nothing is recognised.
 *
 * DEVICE_COLORS is generated by scripts/build-color-map.mjs from the SAME
 * color-name-list the mobile app uses, so exact catalogue names ("Cosmic Green"
 * -> #30a877) match the app pixel-for-pixel. COLOR_WORDS below is only the
 * runtime fallback for a colour added to the catalogue after that file was last
 * built. Re-run the script to refresh the map. */
function colorHex(name) {
  const s = String(name || '').toLowerCase().trim();
  if (!s) return null;
  if (DEVICE_COLORS[s]) return DEVICE_COLORS[s];
  if (COLOR_WORDS[s]) return COLOR_WORDS[s];
  const words = s.split(/[\s/_-]+/).filter(Boolean);
  // Base colour usually trails the descriptor ("Diamond BLACK", "Skyline BLUE"),
  // so scan right-to-left and take the first recognised word.
  for (let i = words.length - 1; i >= 0; i -= 1) {
    if (COLOR_WORDS[words[i]]) return COLOR_WORDS[words[i]];
  }
  return null;
}

/** A clean array of non-empty trimmed strings from a possibly-messy jsonb value. */
function cleanList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  value.forEach((v) => {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/* Step: Repair Service                                                      */
/* -------------------------------------------------------------------------- */
/* Mirrors the customer app's "Select Repair Service" screen: repair services
 * grouped under their repair category (Audio & Mic, Display & Touch, …),
 * filtered to the chosen device type, multi-selectable. Booking still happens in
 * the app, so the selection is local and "Continue" hands off to /contact. */

function ServiceStep({ deviceCategoryId, modelName, deviceHref, device }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loginOpen, setLoginOpen] = useState(false);

  // The report step carries the chosen device + the selected service ids.
  const reportHref = `${deviceHref}&report=1${
    selected.size ? `&services=${[...selected].join(',')}` : ''
  }`;

  // Gate on customer login: signed in -> straight to the report; otherwise open
  // the login modal and continue on success.
  const goReport = () => router.push(reportHref);
  const onContinue = () => {
    if (isLoggedIn()) goReport();
    else setLoginOpen(true);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    Promise.all([
      masterApi.get('/master/repair-services').then(unwrap).catch(() => null),
      masterApi.get('/master/repair-categories').then(unwrap).catch(() => null),
    ]).then(([svc, cats]) => {
      if (!alive) return;
      if (!Array.isArray(svc) || !Array.isArray(cats)) {
        setFailed(true);
      } else {
        setServices(svc);
        setCategories(cats);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Repair categories for THIS device type, each with its services. A category
  // with no services (for this device) is dropped so there are no empty headers.
  const groups = useMemo(() => {
    return (categories || [])
      .filter((c) => c && c.isActive !== false)
      .filter(
        (c) => !deviceCategoryId || !c.deviceCategoryId || c.deviceCategoryId === deviceCategoryId,
      )
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
      .map((c) => ({
        cat: c,
        items: (services || []).filter((s) => s && s.categoryId === c.id),
      }))
      .filter((g) => g.items.length);
  }, [categories, services, deviceCategoryId]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Which category panels are expanded. Empty by default -> everything starts
  // collapsed; clicking a header toggles just that one.
  const [openCats, setOpenCats] = useState(() => new Set());
  const toggleCat = (id) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) return <Spinner label="Loading repair services…" />;
  if (failed || groups.length === 0) {
    return (
      <EmptyState
        title="Repair services aren't available here yet"
        description={`The NearGFix app has the full list of what we can fix on your ${modelName || 'device'}.`}
      />
    );
  }

  return (
    <div>
      {/* Accordion: one collapsible panel per repair category, all closed by
          default. The header toggles open/closed; + when closed, − when open. */}
      <ul role="list" className="list-none space-y-3 p-0">
        {groups.map(({ cat, items }) => {
          const isOpen = openCats.has(cat.id);
          const panelId = `repair-svc-${cat.id}`;
          const headerId = `repair-svc-h-${cat.id}`;
          const selCount = items.reduce((n, s) => n + (selected.has(s.id) ? 1 : 0), 0);
          const CatIcon = repairCatIcon(cat.displayName || cat.name);
          return (
            <li key={cat.id} className="overflow-hidden rounded-2xl border border-brand-line bg-white">
              <button
                type="button"
                id={headerId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleCat(cat.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-700">
                    <CatIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-base font-bold tracking-tight text-brand-ink sm:text-lg">
                    {cat.displayName || cat.name}
                  </span>
                  {selCount ? (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
                      {selCount}
                    </span>
                  ) : null}
                </span>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-line text-brand-700"
                  aria-hidden="true"
                >
                  {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </span>
              </button>

              {isOpen ? (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={headerId}
                  className="border-t border-brand-line p-4"
                >
                  <ul
                    role="list"
                    className="grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {items.map((s) => {
                      const isSel = selected.has(s.id);
                      const SvcIcon = serviceIcon(s.name, CatIcon);
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            aria-pressed={isSel}
                            onClick={() => toggle(s.id)}
                            className={cx(
                              'flex w-full items-center gap-2.5 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
                              isSel
                                ? 'border-brand-600 bg-brand-soft text-brand-700 ring-1 ring-inset ring-brand-600'
                                : 'border-brand-line bg-white text-brand-ink hover:border-brand-300 hover:bg-brand-50',
                            )}
                          >
                            <span
                              className={cx(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition',
                                isSel
                                  ? 'border-brand-600 bg-brand-600 text-white'
                                  : 'border-brand-strong',
                              )}
                              aria-hidden="true"
                            >
                              {isSel ? <Check className="h-3.5 w-3.5" /> : null}
                            </span>
                            <SvcIcon
                              className={cx(
                                'h-4 w-4 shrink-0',
                                isSel ? 'text-brand-700' : 'text-brand-muted',
                              )}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">{s.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Continue advances to the report — after a customer login gate. */}
      <div className="mt-8 flex flex-col items-center gap-2 pt-2 text-center">
        <Button
          onClick={onContinue}
          variant="primary"
          size="lg"
          icon="ArrowRight"
          disabled={selected.size === 0}
        >
          {selected.size
            ? `Continue with ${selected.size} service${selected.size > 1 ? 's' : ''}`
            : 'Select a service to continue'}
        </Button>
        <p className="text-xs text-brand-muted">
          You&apos;ll be asked to log in to view your repair report.
        </p>
      </div>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          setLoginOpen(false);
          goReport();
        }}
        device={device}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step: View Report                                                           */
/* -------------------------------------------------------------------------- */
/* Shown to a LOGGED-IN customer after picking services. Mirrors the app's
 * Review screen: device details, the chosen services, and front/back device
 * photos (uploaded for real to cdn.neargfix.com). Booking still finishes in the app,
 * so the end action is an app handoff — the photo URLs are not attached to a web
 * booking (there is no web booking backend). */

/**
 * Upload one image to master-data /media/upload; returns the hosted URL.
 * The 'repair-bookings' folder files it under Devicefiles/ in the media bucket,
 * the same place the shop and customer apps put their device photos.
 */
async function uploadDevicePhoto(file, slot) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', 'repair-bookings');
  if (slot) fd.append('slot', slot);
  // /media/upload requires an authenticated request; this step only ever shows
  // to a logged-in customer (see the comment above), so their Bearer is always
  // available here.
  const customer = readCustomer();
  // No Content-Type header — the browser sets the multipart boundary itself.
  const res = await fetch(MEDIA_UPLOAD_URL(), {
    method: 'POST',
    credentials: 'omit',
    headers: customer?.token ? { Authorization: `Bearer ${customer.token}` } : undefined,
    body: fd,
  });
  if (!res.ok) throw new Error(`upload failed ${res.status}`);
  const data = await res.json();
  const url = data && data.url;
  if (!url) throw new Error('upload returned no url');
  return url;
}

function PhotoSlot({ slot, value, busy, onPick, onRemove }) {
  const inputRef = useRef(null);
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          if (file) onPick(file);
          e.target.value = '';
        }}
      />
      {value ? (
        <div className="relative overflow-hidden rounded-2xl border border-brand-line bg-white">
          <div className="flex aspect-square w-full items-center justify-center bg-brand-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={`${slot.label} of your device`} className="h-full w-full object-cover" />
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${slot.label} photo`}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand-ink/70 text-white transition hover:bg-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current && inputRef.current.click()}
          disabled={busy}
          className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-strong bg-white p-4 text-center transition hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {busy ? (
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          ) : (
            <Camera className="h-7 w-7 text-brand-600" aria-hidden="true" />
          )}
          <span className="text-sm font-bold text-brand-ink">{slot.label}</span>
          <span className="text-xs text-brand-muted">{slot.hint}</span>
        </button>
      )}
    </div>
  );
}

const PHOTO_SLOTS = [
  { key: 'front', label: 'Front side', hint: 'Show the screen' },
  { key: 'back', label: 'Back side', hint: 'Show the rear panel' },
];

function ReportStep({
  modelId,
  categoryName,
  brandName,
  modelName,
  model,
  image,
  serviceIds,
  serviceHref,
  optionsHref,
}) {
  const [broken, setBroken] = useState(false);
  const [allServices, setAllServices] = useState([]);
  const [photos, setPhotos] = useState(() => {
    const saved = readPhotos(modelId);
    return { front: saved.front || null, back: saved.back || null };
  });
  const [uploading, setUploading] = useState({ front: false, back: false });

  // Persist uploaded photo URLs so the review/confirm step (several steps later)
  // can attach them to the booking.
  useEffect(() => {
    savePhotos(modelId, photos);
  }, [modelId, photos]);

  const wantIds = useMemo(
    () => new Set(String(serviceIds || '').split(',').map((s) => s.trim()).filter(Boolean)),
    [serviceIds],
  );

  useEffect(() => {
    let alive = true;
    masterApi
      .get('/master/repair-services')
      .then(unwrap)
      .then((rows) => {
        if (alive && Array.isArray(rows)) setAllServices(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const chosenServices = useMemo(
    () => (allServices || []).filter((s) => wantIds.has(s.id)),
    [allServices, wantIds],
  );

  const colors = cleanList(model && model.colors);
  const storage = cleanList(model && model.ramStorage);

  const pick = async (key, file) => {
    setUploading((u) => ({ ...u, [key]: true }));
    try {
      const url = await uploadDevicePhoto(file, key);
      setPhotos((p) => ({ ...p, [key]: url }));
    } catch {
      notifyError("That photo didn't upload. Please try again.");
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  };
  const remove = (key) => setPhotos((p) => ({ ...p, [key]: null }));

  const ready = Boolean(photos.front && photos.back);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Device */}
      <div className="flex items-center gap-4 rounded-3xl border border-brand-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-line bg-white sm:h-24 sm:w-24">
          {image && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="h-full w-full object-contain p-1"
              onError={() => setBroken(true)}
            />
          ) : (
            <Smartphone className="h-9 w-9 text-brand-400" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Your device</p>
          <p className="mt-1 truncate text-lg font-bold text-brand-ink sm:text-xl">{modelName}</p>
          <p className="mt-0.5 truncate text-sm text-brand-muted">
            {[brandName, categoryName, colors[0], storage[0]].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* Repair services */}
      <div className="rounded-3xl border border-brand-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <h3 className="text-base font-bold text-brand-ink sm:text-lg">Repair services</h3>
          <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-700">
            {chosenServices.length}
          </span>
        </div>
        {chosenServices.length ? (
          <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
            {chosenServices.map((s) => (
              <li
                key={s.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-ink"
              >
                <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                {s.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-brand-muted">
            No services selected.{' '}
            <Link href={serviceHref} scroll={false} className="font-semibold text-brand-700 underline">
              Go back
            </Link>
          </p>
        )}
      </div>

      {/* Device photos */}
      <div className="rounded-3xl border border-brand-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <h3 className="text-base font-bold text-brand-ink sm:text-lg">Device photos</h3>
          <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand-700">
            {(photos.front ? 1 : 0) + (photos.back ? 1 : 0)}/2
          </span>
        </div>
        <p className="mt-1 text-sm text-brand-muted">
          Add a clear front and back photo so the shop can assess your device.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
          {PHOTO_SLOTS.map((slot) => (
            <PhotoSlot
              key={slot.key}
              slot={slot}
              value={photos[slot.key]}
              busy={uploading[slot.key]}
              onPick={(file) => pick(slot.key, file)}
              onRemove={() => remove(slot.key)}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-brand-muted">
          Your photos are uploaded securely and only shared with the shop you choose.
        </p>
      </div>

      {/* Next: choose how to proceed (pickup / enquiry / walk-in). */}
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <Button href={optionsHref} scroll={false} variant="primary" size="lg" icon="ArrowRight" disabled={!ready}>
          Choose a shop
        </Button>
        <p className="text-xs text-brand-muted">
          {ready ? 'Next: pick how you want your device serviced.' : 'Add a front and back photo to continue.'}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step: Service Options                                                       */
/* -------------------------------------------------------------------------- */
/* Mirrors the app's "Service Options" screen: how the customer wants to proceed
 * — doorstep pickup, a service enquiry (chat), or walking in. Every option is a
 * real NearGFix capability; no invented prices or wait times are shown. */

const SERVICE_OPTIONS = [
  {
    key: 'pickup',
    icon: Truck,
    title: 'Doorstep pickup',
    badge: 'Popular',
    desc: 'Free doorstep pickup and drop. Pick a nearby shop and a slot — the shop handles the rest.',
    features: ['Free pickup & drop', 'Book a slot that suits you', 'Track every stage'],
    href: '/nearby-shops',
    cta: 'Continue to shops',
  },
  {
    key: 'enquiry',
    icon: MessageCircle,
    title: 'Service enquiry',
    badge: 'No obligation',
    desc: 'Chat directly with nearby shops to clarify the issue and compare before you book.',
    features: ['Message shops directly', 'Compare shops', 'No commitment'],
    href: '/nearby-shops',
    cta: 'Find shops to message',
  },
  {
    key: 'walkin',
    icon: Store,
    title: 'Walk in to a shop',
    badge: null,
    desc: 'Prefer to visit? Find verified NearGFix shops near you and drop your device in.',
    features: ['Verified shops', 'Directions & timings', 'Visit directly'],
    href: '/nearby-shops',
    cta: 'Find shops near you',
  },
];

function ServiceOptionsStep({ modelName, serviceIds, reportHref }) {
  const [selected, setSelected] = useState('pickup');
  const [allServices, setAllServices] = useState([]);

  const wantIds = useMemo(
    () => new Set(String(serviceIds || '').split(',').map((s) => s.trim()).filter(Boolean)),
    [serviceIds],
  );
  useEffect(() => {
    let alive = true;
    masterApi
      .get('/master/repair-services')
      .then(unwrap)
      .then((rows) => {
        if (alive && Array.isArray(rows)) setAllServices(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const chosen = useMemo(
    () => (allServices || []).filter((s) => wantIds.has(s.id)),
    [allServices, wantIds],
  );
  const serviceSummary =
    chosen.length === 1
      ? chosen[0].name
      : `${wantIds.size} service${wantIds.size === 1 ? '' : 's'}`;

  const active = SERVICE_OPTIONS.find((o) => o.key === selected) || SERVICE_OPTIONS[0];
  const shopsHref = `${reportHref}&options=1&shops=1&via=${selected}`;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Booking-for summary */}
      <div className="flex items-center gap-3 rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-700">
          <Wrench className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Booking for</p>
          <p className="truncate text-sm font-bold text-brand-ink">{modelName}</p>
          <p className="truncate text-xs text-brand-muted">
            {wantIds.size} service{wantIds.size === 1 ? '' : 's'}
            {chosen.length ? ` · ${serviceSummary}` : ''}
          </p>
        </div>
        <Link
          href={reportHref}
          scroll={false}
          className="ml-auto shrink-0 rounded-lg text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          Edit
        </Link>
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-widest text-brand-muted">
        How to proceed
      </p>

      <div className="mt-3 space-y-3" role="radiogroup" aria-label="How to proceed">
        {SERVICE_OPTIONS.map((opt) => {
          const isSel = selected === opt.key;
          const OptIcon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={isSel}
              onClick={() => setSelected(opt.key)}
              className={cx(
                'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
                isSel
                  ? 'border-brand-600 bg-brand-50 ring-1 ring-inset ring-brand-600'
                  : 'border-brand-line bg-white hover:border-brand-300 hover:bg-brand-50',
              )}
            >
              <span
                className={cx(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  isSel ? 'bg-brand-600 text-white' : 'bg-brand-soft text-brand-700',
                )}
                aria-hidden="true"
              >
                <OptIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-brand-ink">{opt.title}</span>
                  {opt.badge ? (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-700">
                      {opt.badge}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-brand-muted">
                  {opt.desc}
                </span>
                <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {opt.features.map((f) => (
                    <span key={f} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {f}
                    </span>
                  ))}
                </span>
              </span>
              <span
                className={cx(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                  isSel ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-strong',
                )}
                aria-hidden="true"
              >
                {isSel ? <Check className="h-3 w-3" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <Button href={shopsHref} scroll={false} variant="primary" size="lg" icon="ArrowRight">
          {active.cta}
        </Button>
        <p className="text-xs text-brand-muted">
          All options use verified NearGFix shops near you.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step: Choose a shop                                                         */
/* -------------------------------------------------------------------------- */
/* Mirrors the app's "Pickup Service Shop" screen: shops near the customer,
 * searchable, with a radius filter. Uses the LIVE /shops + /shops/nearby data,
 * which carries name/address/isOpen/distanceKm only — so NO ratings/ETA are
 * shown (the app's "4.5 (100)" is not in the public API and would be invented). */

async function fetchShops(path) {
  const b = String(SHOP_BASE() || '').replace(/\/$/, '');
  const res = await fetch(`${b}${path}`, { credentials: 'omit', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`shops ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function fmtDistance(km) {
  const v = Number(km);
  if (!Number.isFinite(v) || v < 0) return null;
  if (v < 1) return `${Math.max(10, Math.round((v * 1000) / 10) * 10)} m`;
  if (v < 10) return `${v.toFixed(1)} km`;
  return `${Math.round(v)} km`;
}

function ShopStep({ modelName, via, optionsHref }) {
  const [geo, setGeo] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [radius, setRadius] = useState(20);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recommended'); // 'recommended' | 'nearest'
  const [shops, setShops] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [locating, setLocating] = useState(false);
  const [geoTried, setGeoTried] = useState(false);

  // Ask the browser for the current position, reverse-geocode it for a place
  // name, and store it (which updates `geo` through the subscription below).
  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoTried(true);
      return;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      // Insecure origin (plain-HTTP prod) — geolocation is blocked; fall back to
      // the manual prompt + the full shop list.
      setGeoTried(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let label = '';
        try {
          label = await lookupPlaceName(lat, lng);
        } catch {
          label = '';
        }
        setLocating(false);
        setGeoTried(true);
        writeGeo({ lat, lng, label });
      },
      () => {
        setLocating(false);
        setGeoTried(true);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  useEffect(() => {
    const stored = readGeo();
    setGeo(stored);
    setHydrated(true);
    const unsub = subscribeGeo((entry) => setGeo(entry));
    // Auto-locate the moment we arrive with no stored location, so shops show
    // without a manual tap. If the browser has already granted permission this
    // resolves silently; otherwise it surfaces the native prompt once.
    if (!stored) locate();
    return unsub;
  }, [locate]);

  useEffect(() => {
    if (!hydrated) return undefined;
    let alive = true;
    setStatus('loading');
    const path = geo
      ? `/shops/nearby?lat=${encodeURIComponent(geo.lat)}&lng=${encodeURIComponent(
          geo.lng,
        )}&radiusKm=${encodeURIComponent(radius)}`
      : '/shops';
    fetchShops(path)
      .then((rows) => {
        if (!alive) return;
        setShops(rows);
        setStatus('ready');
      })
      .catch(() => {
        if (alive) setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [hydrated, geo && geo.lat, geo && geo.lng, radius]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = shops.filter((s) => {
      if (!needle) return true;
      return `${s.name || ''} ${s.address || ''}`.toLowerCase().includes(needle);
    });
    if (sort === 'nearest') {
      rows = [...rows].sort((a, b) => {
        const l = Number(a.distanceKm);
        const r = Number(b.distanceKm);
        if (!Number.isFinite(l)) return 1;
        if (!Number.isFinite(r)) return -1;
        return l - r;
      });
    }
    return rows;
  }, [shops, q, sort]);

  const placeName = (geo && geo.label) || '';

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-600">
        {via === 'enquiry' ? 'Enquiry shops' : via === 'walkin' ? 'Walk-in shops' : 'Pickup shops'}
      </p>
      <h3 className="mt-1 text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
        Choose your repair shop
      </h3>
      <p className="mt-1 text-sm text-brand-muted">
        {geo
          ? `Near ${placeName || 'you'} · within ${radius} km`
          : locating
            ? 'Finding shops near you…'
            : 'Showing all shops — turn on location to sort by distance'}
      </p>

      {/* Search */}
      <div className="relative mt-5">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-subtle"
          aria-hidden="true"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by shop name or area…"
          className="w-full rounded-2xl border border-brand-line bg-white py-2.5 pl-9 pr-3 text-base text-brand-ink sm:text-sm placeholder:text-brand-subtle focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {/* Radius */}
      {geo ? (
        <div className="mt-3 rounded-2xl border border-brand-line bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-muted">
              Search radius
            </span>
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-sm font-bold text-brand-700">
              {radius} km
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            aria-label="Search radius in kilometres"
            className="mt-3 w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-xs text-brand-muted">
            <span>1 km</span>
            <span>50 km</span>
          </div>
        </div>
      ) : locating ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-brand-line bg-white p-6 text-center">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <p className="text-sm font-semibold text-brand-ink">Finding shops near you…</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-brand-line bg-white p-6 text-center">
          <MapPin className="h-7 w-7 text-brand-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-brand-ink">
            {geoTried
              ? "We couldn't get your location — showing all shops below."
              : 'Share your location to see the closest shops first.'}
          </p>
          <Button onClick={locate} variant="primary" icon="Navigation" disabled={locating}>
            {geoTried ? 'Try location again' : 'Use my location'}
          </Button>
        </div>
      )}

      {/* Trust badges — real capabilities only */}
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-brand-line bg-white p-3 text-center sm:grid-cols-2">
        <span className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-brand-ink">
          <Truck className="h-4 w-4 text-brand-600" aria-hidden="true" /> Free pickup
        </span>
        <span className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-brand-ink">
          <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" /> Verified shops
        </span>
      </div>

      {/* Sort — only the sorts the data actually supports */}
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { key: 'recommended', label: 'Recommended' },
          { key: 'nearest', label: 'Nearest', disabled: !geo },
        ].map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={s.disabled}
            onClick={() => setSort(s.key)}
            className={cx(
              'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
              sort === s.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-brand-line bg-white text-brand-ink hover:border-brand-300',
              s.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <p className="mt-5 text-xs font-bold uppercase tracking-widest text-brand-muted">
        {status === 'ready'
          ? `${list.length} shop${list.length === 1 ? '' : 's'}${geo ? ` within ${radius} km` : ''}`
          : status === 'loading'
            ? 'Finding shops…'
            : ' '}
      </p>

      <div className="mt-3 space-y-3">
        {status === 'error' ? (
          <div className="rounded-2xl border border-brand-line bg-white p-6 text-center text-sm text-brand-muted">
            We couldn&apos;t load shops right now. Please try again in a moment.
          </div>
        ) : status === 'loading' ? (
          [0, 1].map((i) => (
            <div key={i} className="h-24 rounded-2xl border border-brand-line bg-white motion-safe:animate-pulse" />
          ))
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-brand-line bg-white p-6 text-center text-sm text-brand-muted">
            No shops match{q ? ` “${q.trim()}”` : geo ? ` within ${radius} km` : ''}. Try widening the
            radius.
          </div>
        ) : (
          list.map((shop) => {
            const dist = fmtDistance(shop.distanceKm);
            const isOpen = typeof shop.isOpen === 'boolean' ? shop.isOpen : null;
            return (
              <Link
                key={shop.id || shop.slug}
                href={`${optionsHref}&shops=1&via=${via}&shop=${shop.id}`}
                scroll={false}
                className="flex items-start gap-3 rounded-2xl border border-brand-line bg-white p-4 shadow-soft transition hover:border-brand-300 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-lg font-extrabold text-brand-700">
                  {(shop.name || 'G').charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-base font-bold text-brand-ink">{shop.name}</span>
                    {isOpen !== null ? (
                      <span
                        className={cx(
                          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase',
                          isOpen ? 'bg-brand-soft text-brand-700' : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                    ) : null}
                  </span>
                  {shop.address ? (
                    <span className="mt-1 flex items-start gap-1.5 text-sm leading-relaxed text-brand-muted">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      <span className="min-w-0 break-words">{shop.address}</span>
                    </span>
                  ) : null}
                  {dist ? (
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-accent-700">
                      {dist} away
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })
        )}
      </div>

      <p className="mt-6 text-center">
        <Link
          href={optionsHref}
          scroll={false}
          className="text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          Back to service options
        </Link>
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step: Shop detail                                                           */
/* -------------------------------------------------------------------------- */
/* The chosen shop. Uses /shops/{id}, which returns name/address/state/pincode/
 * isOpen/lat-lng/services/pickupSlots — but NO phone and NO opening hours, so
 * "Call Shop" and a hours row are deliberately absent rather than faked. Get
 * Directions is built from the real coordinates. */

function ShopDetailStep({ shopId, shopsHref, addressHref }) {
  const [shop, setShop] = useState(null);
  const [status, setStatus] = useState('loading');
  const [imgBroken, setImgBroken] = useState(false);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    // Two sources merged: /auth/shops/{id}/public carries phone + photos + full
    // address; /shops/{id} carries isOpen + the services list.
    (async () => {
      const b = String(SHOP_BASE() || '').replace(/\/$/, '');
      const [pub, base] = await Promise.all([
        getShopPublic(shopId).catch(() => null),
        fetch(`${b}/shops/${encodeURIComponent(shopId)}`, {
          credentials: 'omit',
          headers: { Accept: 'application/json' },
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      if (!alive) return;
      if (!pub && !base) {
        setStatus('error');
        return;
      }
      setShop({ ...(base || {}), ...(pub || {}) });
      setStatus('ready');
    })();
    return () => {
      alive = false;
    };
  }, [shopId]);

  if (status === 'loading') return <Spinner label="Loading shop…" />;
  if (status === 'error' || !shop) {
    return (
      <EmptyState
        title="We couldn't load this shop"
        description="Please go back and pick a shop again."
      />
    );
  }

  const lat = Number(shop.latitude);
  const lng = Number(shop.longitude);
  const directions =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : null;
  const isOpen = typeof shop.isOpen === 'boolean' ? shop.isOpen : null;
  const services = Array.isArray(shop.services) ? shop.services : [];
  const fullAddress =
    shop.address || [shop.city, shop.district, shop.state, shop.pincode].filter(Boolean).join(', ');
  const photo = shop.frontImageUrl || shop.bannerImageUrl || null;
  const phoneRaw = shop.mobile || shop.phone || '';
  const phoneDigits = String(phoneRaw).replace(/[^\d+]/g, '');
  const callable = phoneDigits.length >= 6;
  const hhmm = (t) => String(t || '').trim();
  const pickupWindow =
    shop.pickupFromTime && shop.pickupToTime
      ? `${hhmm(shop.pickupFromTime)} – ${hhmm(shop.pickupToTime)}`
      : '';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Shop card */}
      <div className="overflow-hidden rounded-3xl border border-brand-line bg-white shadow-soft">
        {photo && !imgBroken ? (
          <div className="relative aspect-[16/7] w-full bg-brand-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={`${shop.name} storefront`}
              className="h-full w-full object-cover"
              onError={() => setImgBroken(true)}
            />
            {isOpen !== null ? (
              <span
                className={cx(
                  'absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase shadow-soft',
                  isOpen ? 'bg-brand-600 text-white' : 'bg-red-500 text-white',
                )}
              >
                {isOpen ? 'Open' : 'Closed'}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {!photo || imgBroken ? (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-xl font-extrabold text-brand-700">
                  {(shop.name || 'G').charAt(0).toUpperCase()}
                </span>
              ) : null}
              <div className="min-w-0">
                <h3 className="truncate text-xl font-bold tracking-tight text-brand-ink">
                  {shop.name}
                </h3>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold uppercase text-brand-700">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified
                </span>
              </div>
            </div>
            {isOpen !== null && (!photo || imgBroken) ? (
              <span
                className={cx(
                  'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase',
                  isOpen ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600',
                )}
              >
                {isOpen ? 'Open' : 'Closed'}
              </span>
            ) : null}
          </div>

          {fullAddress ? (
            <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-brand-muted">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <span className="min-w-0 break-words">{fullAddress}</span>
            </p>
          ) : null}

          {callable ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-brand-muted">
              <Phone className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <span className="font-semibold text-brand-ink">{phoneRaw}</span>
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            {callable ? (
              <a
                href={`tel:${phoneDigits}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
              >
                <Phone className="h-4 w-4" aria-hidden="true" /> Call shop
              </a>
            ) : null}
            {directions ? (
              <a
                href={directions}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-4 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
              >
                <MapPin className="h-4 w-4" aria-hidden="true" /> Get directions
              </a>
            ) : null}
          </div>

          {pickupWindow ? (
            <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-soften px-3 py-2 text-sm text-brand-muted">
              <Clock className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Doorstep pickup {pickupWindow}
            </p>
          ) : null}
        </div>
      </div>

      {/* Trust badges — real capabilities only (no invented rating / warranty). */}
      <div className="grid grid-cols-2 gap-3">
        <span className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-brand-line bg-white px-3 py-3 text-sm font-bold text-brand-ink">
          <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" /> Verified shop
        </span>
        <span className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-brand-line bg-white px-3 py-3 text-sm font-bold text-brand-ink">
          <Truck className="h-4 w-4 text-brand-600" aria-hidden="true" /> Free pickup
        </span>
      </div>

      {/* Services offered (only if the API lists any) */}
      {services.length ? (
        <div className="rounded-3xl border border-brand-line bg-white p-5 shadow-soft sm:p-6">
          <h4 className="text-base font-bold text-brand-ink">Services at {shop.name}</h4>
          <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
            {services.map((s, i) => (
              <li
                key={s.id || s.name || i}
                className="rounded-full border border-brand-line bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-ink"
              >
                {s.name || s}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <Button href={addressHref} scroll={false} variant="primary" size="lg" icon="ArrowRight">
          Continue with this shop
        </Button>
        <Link
          href={shopsHref}
          scroll={false}
          className="text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          Choose a different shop
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Booking step indicator (Service · Address · Slot · Review)                  */
/* -------------------------------------------------------------------------- */

function StepIndicator({ current }) {
  const steps = ['Service', 'Address', 'Slot', 'Review'];
  const idx = steps.indexOf(current);
  return (
    <ol className="mb-6 flex list-none items-center gap-1 p-0">
      {steps.map((label, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={label} className="flex flex-1 items-center gap-1">
            <span className="flex flex-col items-center gap-1">
              <span
                className={cx(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                  done || active ? 'bg-brand-600 text-white' : 'bg-brand-soft text-brand-muted',
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
              </span>
              <span
                className={cx(
                  'text-[11px] font-semibold',
                  active ? 'text-brand-ink' : 'text-brand-muted',
                )}
              >
                {label}
              </span>
            </span>
            {i < steps.length - 1 ? (
              <span
                className={cx('mb-4 h-0.5 flex-1 rounded-full', done ? 'bg-brand-600' : 'bg-brand-line')}
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Step: Select Address                                                        */
/* -------------------------------------------------------------------------- */
/* Lists the customer's saved addresses (GET /customer/addresses) and lets them
 * add one (POST). Both are Bearer-authenticated with the customer token. */

const ADDRESS_LABELS = ['Home', 'Office', 'Other'];

function AddressStep({ addressHref, backHref }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [selected, setSelected] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: 'Home',
    fullName: '',
    mobile: '',
    addressLine: '',
    area: '',
    district: '',
    state: '',
    pincode: '',
  });

  const load = useCallback(() => {
    setStatus('loading');
    listAddresses()
      .then((rows) => {
        setAddresses(rows);
        const def = rows.find((a) => a.isDefault) || rows[0];
        setSelected(def ? def.id : '');
        setAdding(rows.length === 0);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim() || form.mobile.replace(/\D/g, '').length < 10 || !form.addressLine.trim()) {
      notifyError('Please fill your name, a 10-digit mobile and the address.');
      return;
    }
    setSaving(true);
    try {
      const created = await createAddress({
        ...form,
        mobile: form.mobile.replace(/\D/g, ''),
        isDefault: addresses.length === 0,
      });
      setAdding(false);
      setSaving(false);
      // Refresh + select the new one.
      const rows = await listAddresses().catch(() => addresses);
      setAddresses(rows);
      setSelected((created && created.id) || (rows[0] && rows[0].id) || '');
    } catch (err) {
      setSaving(false);
      notifyError(err, "Couldn't save the address. Please try again.");
    }
  };

  const goSlot = () => {
    if (!selected) return;
    router.push(`${addressHref}&addr=${selected}&slot=1`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator current="Address" />
      <h3 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
        Where should we pick up?
      </h3>
      <p className="mt-1 text-sm text-brand-muted">Pickup is free across all serviceable areas.</p>

      {status === 'loading' ? (
        <div className="mt-6"><Spinner label="Loading your addresses…" /></div>
      ) : status === 'error' ? (
        <EmptyState
          title="Couldn't load your addresses"
          description="Please try again in a moment."
        />
      ) : (
        <div className="mt-6 space-y-3">
          {addresses.map((a) => {
            const isSel = selected === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelected(a.id)}
                aria-pressed={isSel}
                className={cx(
                  'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
                  isSel
                    ? 'border-brand-600 bg-brand-50 ring-1 ring-inset ring-brand-600'
                    : 'border-brand-line bg-white hover:border-brand-300',
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Home className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-base font-bold text-brand-ink">{a.label || 'Address'}</span>
                    {a.isDefault ? (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold uppercase text-brand-700">
                        Default
                      </span>
                    ) : null}
                  </span>
                  {a.fullName || a.mobile ? (
                    <span className="mt-0.5 block text-sm text-brand-muted">
                      {[a.fullName, a.mobile].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block text-sm text-brand-ink">{formatAddress(a)}</span>
                </span>
                <span
                  className={cx(
                    'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    isSel ? 'border-brand-600' : 'border-brand-strong',
                  )}
                  aria-hidden="true"
                >
                  {isSel ? <span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> : null}
                </span>
              </button>
            );
          })}

          {adding ? (
            <form onSubmit={onSave} className="rounded-2xl border border-brand-line bg-white p-4 sm:p-5">
              <p className="text-base font-bold text-brand-ink">Add a pickup address</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ADDRESS_LABELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setField('label', l)}
                    className={cx(
                      'rounded-full border px-3 py-1 text-sm font-semibold',
                      form.label === l
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-brand-line bg-white text-brand-ink',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { k: 'fullName', ph: 'Full name', span: false },
                  { k: 'mobile', ph: 'Mobile number', span: false },
                  { k: 'addressLine', ph: 'Door no. / street', span: true },
                  { k: 'area', ph: 'Area / locality', span: false },
                  { k: 'district', ph: 'City / district', span: false },
                  { k: 'state', ph: 'State', span: false },
                  { k: 'pincode', ph: 'Pincode', span: false },
                ].map((f) => (
                  <input
                    key={f.k}
                    value={form[f.k]}
                    onChange={(e) => setField(f.k, e.target.value)}
                    placeholder={f.ph}
                    inputMode={f.k === 'mobile' || f.k === 'pincode' ? 'numeric' : 'text'}
                    className={cx(
                      'rounded-xl border border-brand-line bg-white px-3 py-2.5 text-base text-brand-ink placeholder:text-brand-subtle focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:text-sm',
                      f.span && 'sm:col-span-2',
                    )}
                  />
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <Button type="submit" variant="primary" size="md" disabled={saving}>
                  {saving ? 'Saving…' : 'Save address'}
                </Button>
                {addresses.length ? (
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-brand-muted hover:text-brand-ink"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-strong bg-white py-4 text-sm font-bold text-brand-700 transition hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add new address
            </button>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <Button onClick={goSlot} variant="primary" size="lg" icon="ArrowRight" disabled={!selected}>
          Continue to slot selection
        </Button>
        <Link
          href={backHref}
          scroll={false}
          className="text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          Back to shop
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step: Select Pickup Slot                                                    */
/* -------------------------------------------------------------------------- */
/* Derives concrete dates from the shop's weekly pickup slots (GET
 * /shops/{id}/pickup-slots): the next 7 days, each matched to slot rows by ISO
 * dayOfWeek. new Date() is fine here — this is a client component in the browser. */

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => String(n).padStart(2, '0');
const FALLBACK_SLOTS = [
  { startTime: '09:00:00', endTime: '11:00:00' },
  { startTime: '11:00:00', endTime: '13:00:00' },
  { startTime: '13:00:00', endTime: '15:00:00' },
  { startTime: '15:00:00', endTime: '17:00:00' },
  { startTime: '17:00:00', endTime: '19:00:00' },
];

function SlotStep({ shopId, slotHref, backHref }) {
  const router = useRouter();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dayIdx, setDayIdx] = useState(1); // default tomorrow, like the app
  const [chosen, setChosen] = useState(null); // { startTime, endTime }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getPickupSlots(shopId)
      .then((rows) => {
        if (alive) setSlots(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [shopId]);

  // Next 7 days. Computed once at mount via a lazy initializer so the list is
  // stable across renders.
  const [days] = useState(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  });

  const day = days[dayIdx];
  const isoDow = ((day.getDay() + 6) % 7) + 1;
  const daySlots = useMemo(() => {
    const matched = slots.filter((s) => s.dayOfWeek == null || Number(s.dayOfWeek) === isoDow);
    return matched.length ? matched : FALLBACK_SLOTS;
  }, [slots, isoDow]);

  const ymd = `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`;
  const hhmm = (t) => String(t || '').slice(0, 5);

  const goReview = () => {
    if (!chosen) return;
    router.push(
      `${slotHref}&date=${ymd}&start=${encodeURIComponent(chosen.startTime)}&end=${encodeURIComponent(
        chosen.endTime,
      )}&review=1`,
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator current="Slot" />
      <h3 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
        Choose a pickup slot
      </h3>
      <p className="mt-1 text-sm text-brand-muted">Free, on-time pickup — reschedule once for free.</p>

      {/* Dates */}
      <div className="mt-5 rounded-2xl border border-brand-line bg-white p-4">
        <p className="text-sm font-bold text-brand-ink">Choose pickup date</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {days.map((d, i) => {
            const active = i === dayIdx;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setDayIdx(i);
                  setChosen(null);
                }}
                className={cx(
                  'flex shrink-0 flex-col items-center rounded-2xl border px-4 py-2.5 transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
                  active
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-brand-line bg-white text-brand-ink hover:border-brand-300',
                )}
              >
                <span className="text-[11px] font-bold">{WD[d.getDay()]}</span>
                <span className="text-xl font-extrabold leading-tight">{d.getDate()}</span>
                <span className={cx('text-[11px]', active ? 'text-brand-50' : 'text-brand-muted')}>
                  {MO[d.getMonth()]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Times */}
      <div className="mt-3 rounded-2xl border border-brand-line bg-white p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-brand-ink">
          <Clock className="h-4 w-4 text-brand-600" aria-hidden="true" /> Pick a time slot
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-brand-muted">Loading slots…</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {daySlots.map((s) => {
              const isSel =
                chosen && chosen.startTime === s.startTime && chosen.endTime === s.endTime;
              return (
                <button
                  key={`${s.startTime}-${s.endTime}`}
                  type="button"
                  onClick={() => setChosen({ startTime: s.startTime, endTime: s.endTime })}
                  className={cx(
                    'rounded-xl border px-4 py-2.5 text-sm font-semibold transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
                    isSel
                      ? 'border-brand-600 bg-brand-soft text-brand-700 ring-1 ring-inset ring-brand-600'
                      : 'border-brand-line bg-white text-brand-ink hover:border-brand-300',
                  )}
                >
                  {hhmm(s.startTime)} – {hhmm(s.endTime)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <Button onClick={goReview} variant="primary" size="lg" icon="ArrowRight" disabled={!chosen}>
          Continue to review
        </Button>
        <Link
          href={backHref}
          scroll={false}
          className="text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          Back to address
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step: Review + Confirm Booking (+ inline confirmation)                      */
/* -------------------------------------------------------------------------- */
/* Gathers everything the flow collected — device, services (names re-fetched),
 * photos (from sessionStorage), the chosen address + shop + slot — shows the
 * order, and on Confirm POSTs a REAL booking to order-service. On success it
 * swaps to the confirmation view (order code from `bookingNumber`). */

function Row({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-700">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-brand-ink break-words">{value}</p>
      </div>
    </div>
  );
}

function ReviewStep({
  modelId,
  brandId,
  modelName,
  brandName,
  categoryName,
  image,
  model,
  via,
  shopId,
  serviceIds,
  addressId,
  pickupDate,
  pickupStart,
  pickupEnd,
  backHref,
}) {
  const [address, setAddress] = useState(null);
  const [shop, setShop] = useState(null);
  const [services, setServices] = useState([]);
  const [photos, setPhotos] = useState({});
  const [status, setStatus] = useState('loading');
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(null); // booking response on success

  useEffect(() => {
    let alive = true;
    setPhotos(readPhotos(modelId));
    Promise.all([
      listAddresses().catch(() => []),
      getShopPublic(shopId).catch(() => null),
      masterApi.get('/master/repair-services').then(unwrap).catch(() => []),
    ]).then(([addrs, shopData, svc]) => {
      if (!alive) return;
      const want = new Set(String(serviceIds || '').split(',').map((s) => s.trim()).filter(Boolean));
      setAddress((addrs || []).find((a) => a.id === addressId) || null);
      setShop(shopData);
      setServices((svc || []).filter((s) => want.has(s.id)));
      setStatus('ready');
    });
    return () => {
      alive = false;
    };
  }, [modelId, shopId, serviceIds, addressId]);

  const serviceMode = via === 'enquiry' ? 'ENQUIRY' : via === 'walkin' ? 'WALK_IN' : 'PICKUP';

  const confirm = async () => {
    setSaving(true);
    try {
      const payload = {
        shopId,
        brandId,
        brandName: brandName || undefined,
        modelId,
        modelName: modelName || undefined,
        deviceDisplayName: [brandName, modelName].filter(Boolean).join(' ') || undefined,
        deviceImageUrl: image || undefined,
        color: cleanList(model && model.colors)[0] || undefined,
        serviceMode,
        issueSummary: services.map((s) => s.name).join(', '),
        services: services.map((s) => ({
          repairServiceId: s.id,
          serviceCode: s.code,
          serviceName: s.name,
        })),
        pickupAddressId: addressId || undefined,
        pickupDate: pickupDate || undefined,
        pickupSlotStart: pickupStart || undefined,
        pickupSlotEnd: pickupEnd || undefined,
        frontImageUrl: photos.front || undefined,
        backImageUrl: photos.back || undefined,
      };
      const created = await createRepairBooking(payload);
      setConfirmed(created || {});
    } catch (err) {
      notifyError(
        err.status === 403
          ? 'Your session has expired. Please log in again to confirm.'
          : err.message || "We couldn't confirm your booking. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const scheduleText =
    pickupDate && pickupStart
      ? `${pickupDate} · ${String(pickupStart).slice(0, 5)} – ${String(pickupEnd).slice(0, 5)}`
      : '';

  /* -- Confirmation view -------------------------------------------------- */
  if (confirmed) {
    const number = confirmed.bookingNumber ? `#${confirmed.bookingNumber}` : '';
    return (
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-b from-brand-500 to-brand-700 p-8 text-center text-white">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-brand-600">
            <CircleCheck className="h-9 w-9" aria-hidden="true" />
          </span>
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">Booking confirmed!</h3>
          <p className="mt-2 text-sm text-brand-50">
            Your repair pickup is scheduled. We&apos;ll keep you posted on every step.
          </p>
          {number ? (
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold ring-1 ring-white/25">
              <CircleCheck className="h-4 w-4" aria-hidden="true" /> {number}
            </span>
          ) : null}
        </div>

        <div className="mt-5 rounded-3xl border border-brand-line bg-white p-5 shadow-soft sm:p-6">
          <p className="text-base font-bold text-brand-ink">Order details</p>
          <div className="mt-2 divide-y divide-brand-line">
            <Row icon={Smartphone} label="Device" value={[modelName, brandName].filter(Boolean).join(' · ')} />
            <Row icon={Wrench} label="Repair services" value={services.map((s) => s.name).join(', ')} />
            {address ? (
              <Row icon={MapPin} label="Pickup address" value={formatAddress(address)} />
            ) : null}
            {scheduleText ? <Row icon={Calendar} label="Scheduled" value={scheduleText} /> : null}
            {shop ? <Row icon={Store} label="Shop" value={shop.name} /> : null}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button href="/" variant="outline" size="lg" icon="Home" iconPosition="left">
            Home
          </Button>
          <Button href="/contact" variant="primary" size="lg" icon="ArrowRight">
            Track in the app
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-brand-muted">
          Live tracking and the shop&apos;s quote arrive in the NearGFix app.
        </p>
      </div>
    );
  }

  /* -- Review view -------------------------------------------------------- */
  return (
    <div className="mx-auto max-w-2xl">
      <StepIndicator current="Review" />
      <h3 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">Complete order</h3>

      {status === 'loading' ? (
        <div className="mt-6"><Spinner label="Preparing your order…" /></div>
      ) : (
        <div className="mt-6 space-y-4">
          {/* Device */}
          <div className="flex items-center gap-4 rounded-3xl border border-brand-line bg-white p-4 shadow-soft sm:p-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-line bg-white">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <Smartphone className="h-7 w-7 text-brand-400" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Your device</p>
              <p className="mt-0.5 truncate text-lg font-bold text-brand-ink">{modelName}</p>
              <p className="truncate text-sm text-brand-muted">
                {[brandName, categoryName].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          {/* Services */}
          <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-soft sm:p-5">
            <p className="flex items-center gap-2 text-base font-bold text-brand-ink">
              <Wrench className="h-5 w-5 text-brand-600" aria-hidden="true" /> Repair services
            </p>
            <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-ink"
                >
                  <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" /> {s.name}
                </li>
              ))}
            </ul>
          </div>

          {/* Photos */}
          {photos.front || photos.back ? (
            <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-soft sm:p-5">
              <p className="flex items-center gap-2 text-base font-bold text-brand-ink">
                <Camera className="h-5 w-5 text-brand-600" aria-hidden="true" /> Device photos
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {['front', 'back'].map((k) =>
                  photos[k] ? (
                    <div key={k}>
                      <div className="aspect-square overflow-hidden rounded-2xl border border-brand-line bg-brand-soft">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photos[k]} alt={`${k} of device`} className="h-full w-full object-cover" />
                      </div>
                      <p className="mt-1 text-center text-xs font-semibold capitalize text-brand-muted">
                        {k}
                      </p>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          ) : null}

          {/* Pickup address */}
          {address ? (
            <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-soft sm:p-5">
              <p className="flex items-center gap-2 text-base font-bold text-brand-ink">
                <MapPin className="h-5 w-5 text-brand-600" aria-hidden="true" /> Pickup address
              </p>
              <p className="mt-2 text-sm font-bold text-brand-ink">
                {[address.fullName, address.mobile].filter(Boolean).join(' · ')}
              </p>
              <p className="text-sm text-brand-muted">{formatAddress(address)}</p>
            </div>
          ) : null}

          {/* Shop & schedule */}
          <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-soft sm:p-5">
            <p className="flex items-center gap-2 text-base font-bold text-brand-ink">
              <Store className="h-5 w-5 text-brand-600" aria-hidden="true" /> Shop &amp; schedule
            </p>
            {shop ? <p className="mt-2 text-sm font-bold text-brand-ink">{shop.name}</p> : null}
            {shop && shop.address ? (
              <p className="text-sm text-brand-muted">{shop.address}</p>
            ) : null}
            {scheduleText ? (
              <p className="mt-2 inline-flex items-center gap-2 rounded-xl border border-brand-line px-3 py-2 text-sm font-semibold text-brand-ink">
                <Calendar className="h-4 w-4 text-brand-600" aria-hidden="true" /> {scheduleText}
              </p>
            ) : null}
          </div>

          {/* Payment — honest: shop quotes after inspection, pickup is free */}
          <div className="rounded-3xl border border-brand-line bg-white p-4 shadow-soft sm:p-5">
            <p className="flex items-center gap-2 text-base font-bold text-brand-ink">
              <Tag className="h-5 w-5 text-brand-600" aria-hidden="true" /> Payment
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Pickup &amp; drop</span>
                <span className="font-bold text-brand-700">Free</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-brand-muted">Repair charges</span>
                <span className="font-semibold text-brand-ink">Quoted by the shop</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-brand-muted">
              You approve the estimate before any work starts — nothing is charged now.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <Button onClick={confirm} variant="primary" size="lg" icon="ArrowRight" disabled={saving}>
              {saving ? 'Confirming…' : 'Confirm booking'}
            </Button>
            <Link
              href={backHref}
              scroll={false}
              className="text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              Back to slot
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Large product photo that cross-fades (~200ms) when `src` changes: the next
 * photo is fetched first, then faded in over the old one while the old one fades
 * out, so a colour switch never flashes white or shows a half-loaded image.
 * object-contain keeps the whole device visible at its own aspect ratio.
 */
function CrossfadeImage({ src, alt, onError }) {
  const [layers, setLayers] = useState(() => [{ src, visible: true }]);

  useEffect(() => {
    if (!src || layers[layers.length - 1]?.src === src) return undefined;
    let cancelled = false;
    const loader = new window.Image();
    loader.onload = () => {
      if (cancelled) return;
      setLayers((prev) => [...prev.filter((l) => l.src !== src).slice(-1), { src, visible: false }]);
      // Two frames: mount at opacity 0, then flip to 1 so the transition runs.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!cancelled) setLayers((prev) => prev.map((l) => ({ ...l, visible: l.src === src })));
      }));
    };
    loader.onerror = () => { if (!cancelled) onError?.(src); };
    loader.src = src;
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layers is read only to skip a no-op.
  }, [src]);

  return layers.map((layer) => (
    <img
      key={layer.src}
      src={layer.src}
      alt={layer.src === src ? alt : ''}
      aria-hidden={layer.src === src ? undefined : true}
      decoding="async"
      onError={() => onError?.(layer.src)}
      onTransitionEnd={() => {
        if (!layer.visible) setLayers((prev) => prev.filter((l) => l.src !== layer.src));
      }}
      className={cx(
        'absolute inset-0 h-full w-full object-contain p-4 transition-opacity duration-200 ease-out motion-reduce:transition-none',
        layer.visible ? 'opacity-100' : 'opacity-0',
      )}
    />
  ));
}

/**
 * The admin's colour palette (/master/colors: name + hexCode, kept in sync when a
 * model's colours are saved) as Map<lower-case name, hex>. Fetched once per page
 * visit and shared — these are the real finish colours ("Alpha" #000000,
 * "Legend" #e3e3e3), unlike colorHex()'s guess from colour words.
 */
let paletteRequest;
function usePaletteHex() {
  const [palette, setPalette] = useState(null);
  useEffect(() => {
    let alive = true;
    paletteRequest ??= masterApi
      .get('/master/colors')
      .then(unwrap)
      .then((rows) => new Map((Array.isArray(rows) ? rows : [])
        .filter((r) => r?.name && /^#[0-9a-f]{3,8}$/i.test(String(r.hexCode || '')))
        .map((r) => [String(r.name).trim().toLowerCase(), r.hexCode])))
      .catch(() => {
        paletteRequest = undefined; // let a later visit retry
        return new Map();
      });
    paletteRequest.then((map) => alive && setPalette(map));
    return () => { alive = false; };
  }, []);
  return palette;
}

function SummaryStep({ categoryName, categoryCode, brandId, brandName, modelName, model, siblings = [], seriesName, deviceCategoryId, image, serviceHref }) {
  const router = useRouter();
  // Gallery thumbnail the visitor clicked (null = follow the colour), and the
  // 360° viewer toggle. Both only appear when the API sends the photos.
  const [shot, setShot] = useState(null);
  const [view360, setView360] = useState(false);
  const palette = usePaletteHex();
  const [brokenSrcs, setBrokenSrcs] = useState([]);
  const colors = colorNames(model);
  const storage = cleanList(model && model.ramStorage);
  // A colour and a storage are always selected — the visitor's pick, else the
  // first available. Derived on every render rather than seeded into state once:
  // this step mounts before the model's data has loaded, so a one-time default
  // would stay empty ("Colour –" with nothing selected) after it arrives.
  const [colorPick, setColor] = useState(null);
  const [storageChoice, setStoragePick] = useState(null);
  const color = colors.includes(colorPick) ? colorPick : colors[0] || null;
  const validStorage = storagesForColor(model, color, storage);
  const storagePick = validStorage.includes(storageChoice) ? storageChoice : validStorage[0] || null;

  // The storage choice is kept; if the new colour does not come in it, the
  // derived storagePick above falls back to that colour's first option. A new
  // colour also drops back from a clicked thumbnail to that colour's photo.
  const selectColor = (c) => {
    setColor(c);
    setShot(null);
  };

  const gallery = galleryOf(model, color);
  const frames = frames360Of(model);
  const badge = badgeOf(model);
  const tagline = taglineOf(model);
  const rating = ratingOf(model);

  // Photo for the current pick (src/lib/colorImages.js): a clicked thumbnail →
  // colour + storage variant → colour photo → the model's own photo. A photo
  // that fails to load drops to the next one instead of leaving a broken image.
  const shown = [shot, resolveVariantImage(model, { color, storage: storagePick }), image]
    .find((src) => src && !brokenSrcs.includes(src)) || null;
  const markBroken = (src) => setBrokenSrcs((list) => (list.includes(src) ? list : [...list, src]));

  const FallbackIcon = CATEGORY_FALLBACK_ICONS[String(categoryCode || '').toUpperCase()] || Smartphone;
  const storageTitle = storage.some((s) => s.includes('+')) ? 'RAM & Storage' : 'Storage';
  // Other models in the same series (e.g. the other iPad Air sizes), for the
  // Apple-style model switcher. Real master-data rows only; hidden when alone.
  const seriesModels = siblings.filter((m) => m?.id && m.seriesId && m.seriesId === model?.seriesId);

  // Apple-style product page: details left (~45%), large photo right (~55%),
  // photo first on phones; long-form sections follow (RepairDeviceSections).
  // Selection is local (visual) — the shop quotes against the exact model, so
  // Continue and Skip both lead to the repair-service step. No price, stock or
  // delivery: this is the repair flow, and repair prices are quoted per shop.
  return (
    <>
    <div className="mx-auto grid max-w-6xl items-center gap-8 pt-2 text-left md:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] md:gap-12 lg:gap-16">
      <div className="md:order-2">
        <div className="relative mx-auto aspect-square w-full max-w-[600px] bg-white">
          {view360 && frames.length ? (
            <Viewer360 frames={frames} alt={`${modelName} 360° view`} />
          ) : shown ? (
            <CrossfadeImage
              src={shown}
              alt={color && shown !== image ? `${modelName} in ${color}` : modelName || ''}
              onError={markBroken}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FallbackIcon className="h-1/3 w-1/3 text-brand-300" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Thumbnails + 360° — only when the API sends more than one photo / 360 frames. */}
        {gallery.length > 1 || frames.length ? (
          <div className="mx-auto mt-4 flex max-w-[600px] items-center gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:justify-center [&::-webkit-scrollbar]:hidden">
            {gallery.length > 1
              ? gallery.map((g, i) => {
                const active = !view360 && shown === g.url;
                return (
                  <button
                    key={g.url}
                    type="button"
                    aria-pressed={active}
                    aria-label={g.label || `Photo ${i + 1}`}
                    onClick={() => { setView360(false); setShot(g.url); }}
                    className={cx(
                      'h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700',
                      active ? 'border-brand-600 ring-1 ring-brand-600' : 'border-[#E5E7EB] hover:border-brand-300',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote master-data media, static export. */}
                    <img src={g.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                  </button>
                );
              })
              : null}
            {frames.length ? (
              <button
                type="button"
                aria-pressed={view360}
                onClick={() => setView360((v) => !v)}
                className={cx(
                  'h-16 shrink-0 rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700',
                  view360 ? 'border-brand-600 text-brand-700 ring-1 ring-brand-600' : 'border-[#E5E7EB] text-brand-ink hover:border-brand-300',
                )}
              >
                360° view
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 md:order-1">
        {badge ? (
          <p className="mb-2 text-sm font-semibold text-[#B45309]">{badge}</p>
        ) : null}
        <p className="text-sm text-brand-muted">{[brandName, categoryName].filter(Boolean).join(' · ')}</p>
        <h2 className="mt-1 break-words text-3xl font-semibold tracking-tight text-[#111111] sm:text-4xl lg:text-5xl">{modelName}</h2>
        {tagline ? <p className="mt-3 text-lg text-[#6B7280]">{tagline}</p> : null}
        {rating ? (
          <p className="mt-3 text-sm text-[#6B7280]">
            <span className="font-semibold text-[#111111]">★ {rating.value}</span>
            {rating.count ? ` (${rating.count.toLocaleString('en-IN')} ratings)` : null}
          </p>
        ) : null}

        {seriesModels.length > 1 ? (
          <div className="mt-8">
            <label htmlFor="summary-model" className="text-sm font-semibold text-brand-ink">Model</label>
            <select
              id="summary-model"
              value={model?.id || ''}
              onChange={(e) => {
                const next = seriesModels.find((m) => m.id === e.target.value);
                if (next) router.push(stepHref({ category: categoryCode, brand: brandId, brandName, model: next.id, modelName: next.name }), { scroll: false });
              }}
              className="mt-2 block w-full rounded-xl border border-brand-line bg-white px-4 py-3 text-base text-brand-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            >
              {seriesModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        {colors.length ? (
          <div className="mt-8">
            <p className="text-sm font-semibold text-brand-ink">
              Colour <span className="font-normal text-brand-muted">– {color}</span>
            </p>
            <ul role="list" className="mt-3 flex list-none flex-wrap gap-3 p-0">
              {colors.map((c) => {
                const isSel = color === c;
                return (
                  <li key={c}>
                    <button
                      type="button"
                      aria-pressed={isSel}
                      aria-label={c}
                      title={c}
                      onClick={() => selectColor(c)}
                      className={cx(
                        'block h-7 w-7 rounded-full border border-black/15 transition',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
                        isSel ? 'ring-2 ring-brand-600 ring-offset-[3px]' : 'hover:ring-1 hover:ring-brand-300 hover:ring-offset-2',
                      )}
                      // Model's own hex → admin palette → colour-word guess → neutral.
                      style={{ backgroundColor: colorHexFromData(model, c) || palette?.get(c.trim().toLowerCase()) || colorHex(c) || '#cbd5e1' }}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {storage.length ? (
          <div className="mt-8">
            <p className="text-sm font-semibold text-brand-ink">{storageTitle}</p>
            <ul role="list" className="mt-3 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
              {storage.map((s) => {
                const isSel = storagePick === s;
                const isDisabled = !validStorage.includes(s);
                return (
                  <li key={s}>
                    <button
                      type="button"
                      aria-pressed={isSel}
                      disabled={isDisabled}
                      onClick={() => setStoragePick(s)}
                      className={cx(
                        'w-full rounded-xl border px-4 py-3 text-sm font-semibold text-brand-ink transition',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                        isSel ? 'border-brand-600 ring-1 ring-inset ring-brand-600' : 'border-brand-line hover:border-brand-300',
                      )}
                    >
                      {s}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Button href={serviceHref} variant="primary" size="lg" icon="ArrowRight" scroll={false}>
            Continue
          </Button>
          <Link
            href={serviceHref}
            scroll={false}
            className="self-center rounded text-sm font-semibold text-brand-muted underline underline-offset-2 transition hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:self-auto"
          >
            Skip for now
          </Link>
        </div>
      </div>
    </div>

    <div className="mx-auto max-w-6xl">
      <RepairDeviceSections
        model={model}
        modelName={modelName}
        brandName={brandName}
        categoryName={categoryName}
        categoryCode={categoryCode}
        deviceCategoryId={deviceCategoryId}
        seriesName={seriesName}
        siblings={siblings}
        colors={colors}
        storage={storage}
        serviceHref={serviceHref}
        modelHref={(m) => stepHref({ category: categoryCode, brand: brandId, brandName, model: m.id, modelName: m.name })}
        imageOf={resolveImg}
      />
    </div>
    </>
  );
}

/**
 * Drag-to-rotate 360° view from an ordered frame list (≥ 8 frames, from the
 * API's images360 — never faked from a single photo). Pointer drag on mouse
 * and touch; the range input gives keyboard users the same control.
 */
function Viewer360({ frames, alt }) {
  const [index, setIndex] = useState(0);
  const drag = useRef(null);
  const step = (dx) => {
    const per = 12; // px of drag per frame
    const moved = Math.trunc(dx / per);
    if (!moved) return;
    drag.current.x += moved * per;
    setIndex((i) => (((i - moved) % frames.length) + frames.length) % frames.length);
  };
  return (
    <div className="absolute inset-0 flex flex-col">
      <div
        className="relative min-h-0 flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX }; }}
        onPointerMove={(e) => { if (drag.current) step(e.clientX - drag.current.x); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote 360 frames, swapped per drag step. */}
        <img src={frames[index]} alt={alt} draggable={false} className="h-full w-full object-contain p-4" />
      </div>
      <input
        type="range"
        min={0}
        max={frames.length - 1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        aria-label="Rotate the 360° view"
        className="mx-auto mb-2 w-2/3 accent-brand-600"
      />
    </div>
  );
}
