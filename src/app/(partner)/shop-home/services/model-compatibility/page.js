'use client';

/**
 * /shop-home/services/model-compatibility — "will this part fit?", the web
 * counterpart of the Partner app's OwnerModelCompatibilityScreen. Layout,
 * labels and colours follow that screen: white header bar, part-type pills,
 * search, then a grid of model cards (or a list of shelf boxes) on the grey
 * page, with a mint hero / chips on the model detail.
 *
 * Three part-type tabs, labels from the admin's model-compatibility types:
 *   Mobile Model Number  the manufacturer part-number index built from the
 *                        whole model catalogue (lib/modelCompatibility.js).
 *                        A card opens that model's detail: its part numbers
 *                        and every model sharing one. A card's photo opens a
 *                        full-screen viewer, as in the app.
 *   Tempered Glass /     one card per shelf box from
 *   UV Glass             GET /master/model-compatibility?type=<slug>, its
 *                        models grouped by brand. Search filters to the boxes
 *                        that fit and highlights the matching models.
 *
 * Read-only; boxes are maintained in the admin panel (Master Data → Model
 * Compatibility). ?tab= keeps the selected tab across refresh/back.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/lib/portalNavigation';
import { AlertTriangle, Barcode, Boxes, ChevronLeft, ChevronRight, Info, Loader2, Puzzle, RefreshCw, Search, Smartphone, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { resolveMediaUrl } from '@/lib/deviceImage';
import { readQueryParam, writeQueryParam } from '@/lib/orderStages';
import {
  boxMatches,
  boxModelLabel,
  brandCount,
  buildCompatIndex,
  findByCode,
  findInterchangeable,
  getAllModels,
  getBrands,
  getCompatibilityBoxes,
  getCompatibilityTypes,
  getDeviceCategories,
  groupModelsByBrand,
  looksLikeCode,
  normalizeCode,
  searchModels,
  modelsWithCrossFit,
} from '@/lib/modelCompatibility';

const INDEX_SLUG = 'mobile-model-number';
// The three tabs this page shows, in order; names come from the admin's types when present.
const TAB_DEFS = [
  { slug: INDEX_SLUG, key: 'all', name: 'Mobile Model Number' },
  { slug: 'tempered-glass', key: 'tempered-glass', name: 'Tempered Glass' },
  { slug: 'uv-glass', key: 'uv-glass', name: 'UV Glass' },
];
const TAB_KEYS = TAB_DEFS.map((t) => t.key);
const PAGE = 60;

// Partner app palette (OwnerModelCompatibilityScreen `C`): white cards on the grey page.
const CARD = 'rounded-[14px] border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(17,17,17,0.04)]';
// The app's list width (CONTENT_MAX.list) for the box list and model detail.
const LIST_WIDTH = 'mx-auto w-full max-w-[720px] lg:max-w-none';
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

export default function ModelCompatibilityPage() {
  const router = useRouter();
  const [tabKey, setTabKey] = useState('all');
  const [types, setTypes] = useState([]);
  const [query, setQuery] = useState('');

  // Catalogue (Mobile Model Number)
  const [index, setIndex] = useState(null);
  const [mobileCategoryId, setMobileCategoryId] = useState(null);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState('');
  const [catReload, setCatReload] = useState(0);
  const [selected, setSelected] = useState(null);
  // Model whose photo is open in the full-screen viewer.
  const [viewerModel, setViewerModel] = useState(null);

  // Boxes (glass tabs), cached per slug
  const [boxesBySlug, setBoxesBySlug] = useState({});
  const [boxError, setBoxError] = useState('');
  const [boxReload, setBoxReload] = useState(0);

  useEffect(() => {
    setTabKey(readQueryParam('tab', TAB_KEYS));
    getCompatibilityTypes().then(setTypes).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setCatLoading(true);
    setCatError('');
    Promise.all([getAllModels({ force: catReload > 0 }), getBrands().catch(() => []), getDeviceCategories().catch(() => [])])
      .then(([models, brands, categories]) => {
        if (!alive) return;
        const active = categories.filter((c) => c?.isActive !== false);
        const mobile =
          active.find((c) => String(c.code || '').toUpperCase() === 'MOBILE') || active.find((c) => String(c.name || '').trim().toLowerCase() === 'mobile');
        setMobileCategoryId(mobile?.id || null);
        setIndex(buildCompatIndex(models, { brands, categories: active }));
      })
      .catch((err) => alive && setCatError(err.message || 'Could not load the model catalogue.'))
      .finally(() => alive && setCatLoading(false));
    return () => {
      alive = false;
    };
  }, [catReload]);

  const tabs = useMemo(
    () => TAB_DEFS.map((t) => ({ ...t, name: types.find((x) => x.slug === t.slug)?.name || t.name })),
    [types],
  );
  const tab = tabs.find((t) => t.key === tabKey) || tabs[0];
  const isIndex = tab.slug === INDEX_SLUG;
  const boxes = boxesBySlug[tab.slug];

  useEffect(() => {
    if (isIndex) return undefined;
    let alive = true;
    setBoxError('');
    getCompatibilityBoxes(tab.slug)
      .then((rows) => alive && setBoxesBySlug((prev) => ({ ...prev, [tab.slug]: rows })))
      .catch((err) => {
        if (!alive) return;
        setBoxError(err.message || 'Could not load boxes for this type.');
        setBoxesBySlug((prev) => ({ ...prev, [tab.slug]: prev[tab.slug] || [] }));
      });
    return () => {
      alive = false;
    };
  }, [tab.slug, isIndex, boxReload]);

  function selectTab(key) {
    setTabKey(key);
    setQuery('');
    setSelected(null);
    writeQueryParam('tab', key);
  }

  const back = useCallback(() => {
    if (selected) setSelected(null);
    else if (window.history.length > 1) router.back();
    else router.push('/shop-home');
  }, [router, selected]);

  const trimmed = query.trim();
  const visibleBoxes = useMemo(() => (boxes || []).filter((b) => boxMatches(b, trimmed)), [boxes, trimmed]);

  const subtitle = isIndex
    ? index
      ? `${plural(index.entries.length, 'model')} · ${plural(index.byCode.size, 'part number')}`
      : ''
    : boxes
      ? plural(visibleBoxes.length, 'box', 'boxes')
      : '';

  return (
    <div className="-m-4 min-h-full bg-[#F3F4F6] sm:-m-6">
      <ScreenHeader
        title={selected ? selected.name : 'Model Compatibility'}
        subtitle={selected ? selected.brandName : subtitle}
        onBack={back}
      />

      <div className="mx-auto max-w-[1440px] px-4 pb-8 pt-3 sm:px-6 lg:px-8 lg:pt-4">
        {selected ? (
          <CompatibilityDetail
            index={index}
            model={selected}
            onOpenModel={setSelected}
            onLookupCode={(code) => {
              setSelected(null);
              setQuery(code);
            }}
          />
        ) : (
          <div className="space-y-2.5">
            <CompatibilityTabs tabs={tabs} value={tab.key} onChange={selectTab} />
            <CompatibilitySearch
              value={query}
              onChange={setQuery}
              placeholder={isIndex ? 'Model name or part number (e.g. SM-A127F)' : 'Box number, brand or model'}
            />

            <div className="pt-1">
              {isIndex ? (
                <ModelIndexView
                  index={index}
                  loading={catLoading}
                  error={catError}
                  onRetry={() => setCatReload((k) => k + 1)}
                  query={trimmed}
                  mobileCategoryId={mobileCategoryId}
                  onOpenModel={setSelected}
                  onViewPhoto={setViewerModel}
                />
              ) : (
                <BoxListView
                  boxes={boxes}
                  visible={visibleBoxes}
                  error={boxError}
                  onRetry={() => setBoxReload((k) => k + 1)}
                  query={trimmed}
                  typeName={tab.name}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {viewerModel ? (
        <PhotoViewer
          model={viewerModel}
          onClose={() => setViewerModel(null)}
          onAction={() => {
            const m = viewerModel;
            setViewerModel(null);
            setSelected(m);
          }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                               */
/* -------------------------------------------------------------------------- */

// The app's ScreenHeader: white bar, round back button, centred title + subtitle.
function ScreenHeader({ title, subtitle, onBack }) {
  return (
    <header className="flex items-center gap-2 border-b border-[#E5E7EB] bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(17,17,17,0.04)] sm:px-6">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[#111111] transition hover:bg-[#E5F3F5] hover:text-[#035C6C]"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1 px-1 text-center">
        <h1 className="truncate text-[17px] font-extrabold leading-tight text-[#111111] sm:text-[19px]">{title}</h1>
        <p className="mt-0.5 truncate text-[11.5px] text-[#6B7280] sm:text-[12.5px]">{subtitle || ' '}</p>
      </div>
      <span className="h-10 w-10 shrink-0" aria-hidden="true" />
    </header>
  );
}

// The app's FilterPill row: teal when active, white with a grey line otherwise.
function CompatibilityTabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" aria-label="Part types" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cx(
              'shrink-0 rounded-full border px-4 py-2 text-[13px] transition',
              active
                ? 'border-[#035C6C] bg-[#035C6C] font-extrabold text-white'
                : 'border-[#E5E7EB] bg-white font-semibold text-[#6B7280] hover:border-[#C7E6EA] hover:text-[#035C6C]',
            )}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

// The app's SearchBar: white, rounded 18, soft shadow, round clear button.
function CompatibilitySearch({ value, onChange, placeholder }) {
  return (
    <label className="flex h-12 items-center gap-2.5 rounded-[18px] border border-[#E5E7EB] bg-white px-4 shadow-[0_2px_8px_rgba(17,17,17,0.04)] transition focus-within:border-[#035C6C] focus-within:ring-4 focus-within:ring-[#035C6C]/10">
      <Search className="h-[18px] w-[18px] shrink-0 text-[#6B7280]" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[#111111] outline-none placeholder:text-[#9CA3AF] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280] hover:text-[#111111]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}

// Icon in a small mint tile, then the label — the app's SectionLabel.
function SectionLabel({ icon: Icon, children }) {
  return (
    <p className="flex items-center gap-2 text-[14px] font-extrabold text-[#111111]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#E5F3F5]">
        <Icon className="h-3.5 w-3.5 text-[#035C6C]" aria-hidden="true" />
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function Hint({ children }) {
  return <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-[#6B7280]">{children}</p>;
}

function CompatibilityEmptyState({ icon: Icon = Boxes, title, text }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C]">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="text-[15px] font-extrabold text-[#111111]">{title}</p>
      <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-[#6B7280]">{text}</p>
    </div>
  );
}

// Nothing loaded to fall back on — the app's full ErrorState.
function ErrorState({ title, text, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[#F32C26]/10 text-[#F32C26]">
        <AlertTriangle className="h-10 w-10" aria-hidden="true" />
      </span>
      <p className="text-[15px] font-extrabold text-[#111111]">{title}</p>
      {text ? <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-[#6B7280]">{text}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#035C6C] bg-white px-6 py-2.5 text-[14px] font-bold text-[#035C6C] transition hover:bg-[#E5F3F5]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      ) : null}
    </div>
  );
}

// A refresh failed but the last copy is still on screen — the app's amber banner.
function StaleBanner({ message, onRetry }) {
  return (
    <div role="alert" className="mb-2.5 flex items-start gap-2 rounded-xl border border-[#F6DE8C] bg-[#FFF8E1] p-2.5 text-[12.5px] leading-snug text-[#111111]">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8A6A00]" aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-[#8A6A00] hover:underline">
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      ) : null}
    </div>
  );
}

function Loading({ label }) {
  return (
    <div className="flex flex-col items-center py-16 text-[#6B7280]">
      <Loader2 className="h-8 w-8 animate-spin text-[#035C6C]" aria-hidden="true" />
      <p className="mt-3 text-[13px]">{label}</p>
    </div>
  );
}

// The app's Thumb: white tile, hairline border, photo or a phone glyph.
function ModelThumb({ url, size = 'h-11 w-11', pad = 'p-1', iconSize = 'h-5 w-5' }) {
  const [broken, setBroken] = useState(false);
  const src = resolveMediaUrl(url);
  useEffect(() => setBroken(false), [src]);
  return (
    <span className={cx('flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#F3F4F6] bg-white', pad, size)}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- catalog images are arbitrary media URLs.
        <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-contain" />
      ) : (
        <Smartphone className={cx(iconSize, 'text-[#9CA3AF]')} aria-hidden="true" />
      )}
    </span>
  );
}

function CodePill({ code }) {
  return (
    <span className="block max-w-full truncate rounded-md bg-[#F3F4F6] px-1.5 py-px text-[10.5px] font-bold tracking-[0.02em] text-[#111111]">{code}</span>
  );
}

/**
 * Grid card from the app's model list: photo, name (2 lines), brand, first part
 * number. The card opens the model; its photo opens the full-screen viewer.
 */
function ModelCard({ model, onOpen, onViewPhoto }) {
  const label = `${model.name}${model.brandName ? `, ${model.brandName}` : ''}`;
  const hasPhoto = Boolean(model.imageUrl && onViewPhoto);
  return (
    <div className={cx(CARD, 'relative flex min-w-0 flex-col items-center px-1.5 pb-2.5 pt-2 text-center transition hover:border-[#C7E6EA]')}>
      {/* Stretched button: the whole card opens the model; the photo button sits above it. */}
      <button type="button" onClick={onOpen} aria-label={label} className="absolute inset-0 rounded-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#035C6C]" />
      {hasPhoto ? (
        <button
          type="button"
          onClick={onViewPhoto}
          aria-label={`View photo of ${model.name}`}
          className="relative z-10 rounded-xl transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#035C6C]"
        >
          <ModelThumb url={model.imageUrl} size="h-[68px] w-[68px] sm:h-[76px] sm:w-[76px]" pad="p-1.5" iconSize="h-7 w-7" />
        </button>
      ) : (
        <ModelThumb url={model.imageUrl} size="h-[68px] w-[68px] sm:h-[76px] sm:w-[76px]" pad="p-1.5" iconSize="h-7 w-7" />
      )}
      <span className="pointer-events-none mt-1.5 line-clamp-2 min-h-[30px] w-full break-words text-[12px] font-extrabold leading-[15px] text-[#111111]">{model.name}</span>
      <span className="pointer-events-none mt-px block w-full truncate text-[10.5px] text-[#6B7280]">{model.brandName || '—'}</span>
      {model.codes?.[0] ? (
        <span className="pointer-events-none mt-1 flex max-w-full justify-center">
          <CodePill code={model.codes[0]} />
        </span>
      ) : null}
    </div>
  );
}

// List row from the app's detail: thumb, name, brand + first part number, shared-code badge, chevron.
function ModelRow({ model, badge, onClick }) {
  return (
    <button type="button" onClick={onClick} className={cx(CARD, 'flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition hover:border-[#C7E6EA]')}>
      <ModelThumb url={model.imageUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-extrabold text-[#111111]">{model.name}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
          {model.brandName ? <span className="truncate text-[11.5px] text-[#6B7280]">{model.brandName}</span> : null}
          {model.codes?.[0] ? (
            <span className="min-w-0 shrink">
              <CodePill code={model.codes[0]} />
            </span>
          ) : null}
          {!model.brandName && !model.codes?.[0] ? <span className="text-[11.5px] text-[#6B7280]">—</span> : null}
        </span>
      </span>
      {badge ? (
        <span className="max-w-[40%] shrink-0 truncate rounded-full bg-[#E5F3F5] px-2 py-0.5 text-[10.5px] font-extrabold tracking-[0.02em] text-[#035C6C]">{badge}</span>
      ) : null}
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5]">
        <ChevronRight className="h-3.5 w-3.5 text-[#035C6C]" aria-hidden="true" />
      </span>
    </button>
  );
}

// The app's ImageViewerModal: dark full-screen photo, label and a "View Compatibility" action.
function PhotoViewer({ model, onClose, onAction }) {
  const src = resolveMediaUrl(model.imageUrl);
  const label = [model.brandName, model.name].filter(Boolean).join(' · ');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={label || 'Model photo'} className="fixed inset-0 z-50 flex flex-col bg-[rgba(17,17,17,0.94)]" onClick={onClose}>
      <div className="flex items-center justify-end px-3.5 pt-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image"
          className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/[0.16] text-white transition hover:bg-white/25"
        >
          <X className="h-[22px] w-[22px]" aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-5">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- catalog images are arbitrary media URLs.
          <img src={src} alt={label} onClick={(e) => e.stopPropagation()} className="max-h-full w-auto max-w-[min(100%,640px)] object-contain" />
        ) : null}
      </div>
      <div className="mx-auto w-full max-w-md px-4 pb-5 text-center" onClick={(e) => e.stopPropagation()}>
        {label ? <p className="line-clamp-2 text-[13px] font-extrabold text-white">{label}</p> : null}
        <button
          type="button"
          onClick={onAction}
          className="mt-3.5 h-[46px] w-full rounded-xl bg-[#035C6C] text-[14px] font-bold text-white transition hover:bg-[#024A57]"
        >
          View Compatibility
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile Model Number                                                         */
/* -------------------------------------------------------------------------- */

function ModelIndexView({ index, loading, error, onRetry, query, mobileCategoryId, onOpenModel, onViewPhoto }) {
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [query]);

  const results = useMemo(() => (index && query ? searchModels(index, query) : []), [index, query]);
  const suggestions = useMemo(() => (index && !query ? modelsWithCrossFit(index, mobileCategoryId ? { categoryId: mobileCategoryId } : {}) : []), [index, query, mobileCategoryId]);
  const codeHits = useMemo(() => {
    if (!index || !query || !looksLikeCode(query)) return null;
    const hits = findByCode(index, query);
    return hits.length ? { code: normalizeCode(query), hits } : null;
  }, [index, query]);

  if (loading && !index) return <Loading label="Loading model catalogue…" />;
  if (error && !index) return <ErrorState title="Catalogue unavailable" text={error} onRetry={onRetry} />;

  const list = query ? results : suggestions;

  return (
    <section>
      {error ? <StaleBanner message={`Couldn’t refresh the catalogue — showing the last copy. ${error}`} onRetry={onRetry} /> : null}
      {codeHits ? <CodeBanner code={codeHits.code} hits={codeHits.hits} onOpenModel={onOpenModel} /> : null}

      <div className="mb-2.5">
        <SectionLabel icon={query ? Search : Puzzle}>
          {query ? plural(results.length, 'match', 'matches') : `${mobileCategoryId ? 'Mobile devices' : 'Devices'} with a known cross-fit · ${suggestions.length.toLocaleString('en-IN')}`}
        </SectionLabel>
        {!query ? (
          <Hint>
            These share a manufacturer part number with at least one other device. Search above to look up any model — including laptops and other categories — or type
            the code printed on a part.
          </Hint>
        ) : null}
      </div>

      {list.length ? (
        <>
          {/* 3 cards a row on phones like the app, then fixed-width columns as space allows. */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:gap-2.5 xl:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {list.slice(0, limit).map((m) => (
              <ModelCard key={m.id} model={m} onOpen={() => onOpenModel(m)} onViewPhoto={() => onViewPhoto(m)} />
            ))}
          </div>
          {list.length > limit ? (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE)}
                className="rounded-full border border-[#E5E7EB] bg-white px-5 py-2.5 text-[13px] font-bold text-[#035C6C] shadow-[0_2px_8px_rgba(17,17,17,0.04)] transition hover:border-[#C7E6EA] hover:bg-[#E5F3F5]"
              >
                Show more · {(list.length - limit).toLocaleString('en-IN')} left
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <CompatibilityEmptyState
          icon={Search}
          title={query ? 'No model matched' : 'Nothing to show'}
          text={
            query
              ? `Nothing in the catalogue is named or numbered “${query}”. Check the spelling.`
              : 'No mobile device in the catalogue shares a part number with another yet. Search above to look up any model.'
          }
        />
      )}
    </section>
  );
}

// Answers "I have this part — what does it fit?" without a drill-down.
function CodeBanner({ code, hits, onOpenModel }) {
  return (
    <div className="mb-2.5 rounded-[14px] border border-[#C7E6EA] bg-[#E5F3F5] p-3">
      <p className="flex items-center gap-1.5 break-all text-[12.5px] font-extrabold tracking-[0.02em] text-[#035C6C]">
        <Barcode className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {code}
      </p>
      <p className="mt-1 text-[12.5px] leading-snug text-[#111111]">
        {hits.length === 1 ? 'This part number belongs to one model:' : `This part number is shared by ${hits.length} models — a part for any one of them fits the rest:`}
      </p>
      <div className="mt-1.5">
        {hits.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onOpenModel(m)}
            className="flex w-full min-w-0 items-center gap-1 py-1 text-left text-[13px] font-bold text-[#035C6C] hover:underline"
          >
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{m.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CompatibilityDetail({ index, model, onOpenModel, onLookupCode }) {
  const entry = index?.byId.get(model.id) || model;
  const matches = useMemo(() => findInterchangeable(index, entry), [index, entry]);
  const codes = entry.codes || [];
  const specs = Array.isArray(entry.ramStorage) ? entry.ramStorage : [];
  const colors = Array.isArray(entry.colors) ? entry.colors : [];

  // Braces on purpose: the effect must return nothing. A one-liner returned
  // whatever window.scrollTo returns — and when a browser extension wraps
  // scrollTo to return a value, React called that value as the cleanup and
  // threw "TypeError: destroy is not a function" on every model click.
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [entry.id]);

  return (
    <div className={cx(LIST_WIDTH, 'space-y-3.5 lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-x-6 lg:gap-y-4 lg:space-y-0')}>
      {/* Hero */}
      <div className="flex items-center gap-3 rounded-[14px] border border-[#C7E6EA] lg:col-start-1 bg-[#E5F3F5] p-2.5 shadow-[0_2px_8px_rgba(17,17,17,0.04)]">
        <ModelThumb url={entry.imageUrl} size="h-[52px] w-[52px]" />
        <div className="min-w-0">
          <p className="line-clamp-2 text-[15px] font-extrabold text-[#111111]">{entry.name}</p>
          <p className="mt-0.5 truncate text-[12px] text-[#6B7280]">{[entry.brandName, entry.categoryName].filter(Boolean).join(' · ') || 'Device'}</p>
        </div>
      </div>

      <section className="space-y-1.5 lg:col-start-1">
        <SectionLabel icon={Barcode}>Part numbers on this device</SectionLabel>
        {codes.length ? (
          <div className={cx(CARD, 'flex flex-wrap gap-1.5 p-2.5')}>
            {codes.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onLookupCode(code)}
                title="Find every model with this part number"
                className="inline-flex max-w-full items-center gap-1 break-all rounded-full border border-[#C7E6EA] bg-[#E5F3F5] px-2.5 py-1 text-[12px] font-extrabold tracking-[0.02em] text-[#035C6C] transition hover:border-[#035C6C]"
              >
                {code}
                <Search className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <Notice warn>No part number recorded for this model, so compatibility can&apos;t be confirmed from the catalogue. Add it in the admin Models screen.</Notice>
        )}
      </section>

      <section className="space-y-1.5 lg:col-start-2 lg:row-span-4 lg:row-start-1">
        <SectionLabel icon={Puzzle}>Interchangeable · {matches.length}</SectionLabel>
        {matches.length ? (
          <>
            <p className="text-[12.5px] leading-relaxed text-[#6B7280]">Same manufacturer part number — parts for these are the same hardware.</p>
            <div className="space-y-2 xl:grid xl:grid-cols-2 xl:gap-2 xl:space-y-0">
              {matches.map(({ model: m, sharedCodes }) => (
                <ModelRow key={m.id} model={m} badge={sharedCodes.join(' · ')} onClick={() => onOpenModel(m)} />
              ))}
            </div>
          </>
        ) : (
          <Notice>
            {codes.length
              ? 'No other model in the catalogue shares a part number with this device. Treat its parts as model-specific.'
              : 'Nothing to compare against until this model has a part number.'}
          </Notice>
        )}
      </section>

      {specs.length || colors.length ? (
        <section className="space-y-1.5 lg:col-start-1">
          <SectionLabel icon={Boxes}>Variants on record</SectionLabel>
          <div className={cx(CARD, 'space-y-2.5 p-2.5')}>
            {[
              ['RAM / Storage', specs],
              ['Colours', colors],
            ]
              .filter(([, list]) => list.length)
              .map(([label, list]) => (
                <div key={label}>
                  <p className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#9CA3AF]">{label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((v) => (
                      <ModelChip key={v} label={v} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Notice({ children, warn }) {
  return (
    <p
      className={cx(
        'flex gap-2 p-2.5 text-[12.5px] leading-relaxed text-[#6B7280]',
        warn ? 'rounded-xl border border-[#F6DE8C] bg-[#FFF8E1]' : CARD,
      )}
    >
      <Info className={cx('mt-0.5 h-3.5 w-3.5 shrink-0', warn ? 'text-[#8A6A00]' : 'text-[#6B7280]')} aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Glass boxes                                                                 */
/* -------------------------------------------------------------------------- */

function BoxListView({ boxes, visible, error, onRetry, query, typeName }) {
  if (!boxes) return error ? <ErrorState title="Couldn’t load boxes" text={error} onRetry={onRetry} /> : <Loading label={`Loading ${typeName}…`} />;
  if (error && !boxes.length) return <ErrorState title="Couldn’t load boxes" text={error} onRetry={onRetry} />;

  return (
    <section>
      {error ? <StaleBanner message={`Couldn’t refresh — showing the last copy. ${error}`} onRetry={onRetry} /> : null}
      {boxes.length ? (
        <div className="mb-2.5">
          <SectionLabel icon={Boxes}>{query ? plural(visible.length, 'match', 'matches') : `${typeName} · ${boxes.length.toLocaleString('en-IN')}`}</SectionLabel>
          {!query ? <Hint>Each card is one box on the shelf and the models its part fits. Search a model to find which box to open.</Hint> : null}
        </div>
      ) : null}

      {visible.length ? (
        // One column on phones like the app; fixed-width columns side by side on wider screens.
        <div className="gap-2.5 sm:columns-[340px]">
          {visible.map((box) => (
            <GlassBoxCard key={box.id} box={box} query={query} />
          ))}
        </div>
      ) : boxes.length ? (
        <CompatibilityEmptyState title="No box matched" text={`Nothing under ${typeName} is numbered “${query}” or lists a matching model.`} />
      ) : (
        <CompatibilityEmptyState
          title="No boxes yet"
          text={`No ${typeName} boxes have been set up yet. Add them in the admin panel under Master Data → Model Compatibility.`}
        />
      )}
    </section>
  );
}

function GlassBoxCard({ box, query }) {
  const [pickedId, setPickedId] = useState(null);
  const models = useMemo(() => box.models || [], [box.models]);
  const brands = brandCount(models);
  const groups = useMemo(() => groupModelsByBrand(models), [models]);
  const needle = query.toLowerCase();
  const isMatch = (m) => Boolean(needle) && boxModelLabel(m).toLowerCase().includes(needle);
  const matchCount = needle ? models.filter(isMatch).length : 0;

  return (
    <article className={cx(CARD, 'mb-2 break-inside-avoid p-3 sm:mb-2.5')}>
      {/* Box on the left, its totals on the right. */}
      <div className="flex items-center gap-2.5">
        {box.referenceImageUrl ? <ModelThumb url={box.referenceImageUrl} size="h-11 w-11" /> : null}
        <p className="line-clamp-2 min-w-0 flex-1 break-words text-[14px] font-extrabold text-[#111111]">
          {box.boxName}
          <span className="font-bold text-[#6B7280]">{`  -  ${box.boxNo}`}</span>
        </p>
        <div className="shrink-0 text-right text-[11.5px] leading-snug text-[#6B7280]">
          {matchCount ? <p className="font-extrabold text-[#035C6C]">{plural(matchCount, 'match', 'matches')}</p> : null}
          <p>{plural(models.length, 'model')}</p>
          {brands ? <p>{plural(brands, 'brand')}</p> : null}
        </div>
      </div>

      {models.length ? (
        <div className="mt-2.5 divide-y divide-[#F3F4F6] border-t border-[#F3F4F6]">
          {groups.map((g) => (
            <div key={g.key} className="flex flex-wrap gap-1.5 py-2 last:pb-0">
              {g.models.map((m) => (
                <ModelChip
                  key={m.modelId}
                  label={boxModelLabel(m)}
                  picked={isMatch(m) || pickedId === m.modelId}
                  onClick={() => setPickedId((id) => (id === m.modelId ? null : m.modelId))}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2.5 text-[12px] text-[#6B7280]">No models mapped to this box yet.</p>
      )}

      {box.notes ? (
        <p className="mt-2.5 flex gap-1.5 border-t border-[#F3F4F6] pt-2 text-[12px] leading-relaxed text-[#6B7280]">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{box.notes}</span>
        </p>
      ) : null}
    </article>
  );
}

// Grey chip; picked (searched or tapped) turns mint with a teal outline, as in the app.
function ModelChip({ label, picked, onClick }) {
  const cls = cx(
    'max-w-full break-words rounded-full border px-2.5 py-1 text-[12px] transition',
    picked ? 'border-[#035C6C] bg-[#E5F3F5] font-extrabold text-[#035C6C]' : 'border-transparent bg-[#F3F4F6] font-semibold text-[#111111]',
    onClick && !picked && 'hover:border-[#C7E6EA]',
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={Boolean(picked)} className={cls}>
      {label}
    </button>
  ) : (
    <span className={cls}>{label}</span>
  );
}
