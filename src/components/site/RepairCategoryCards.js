'use client';

/**
 * RepairCategoryCards — the /repair "Select your device category to repair"
 * step: a centred heading and one large pastel card per repair category.
 *
 * Data: GET /master/category-menu?categoryType=REPAIR is the source of truth for
 * what each card SHOWS — `menuName` is the title, `imageUrl` the device image,
 * `description` the subtitle (none shown while it is empty). Only `isActive`
 * rows are shown; `id` is the key.
 *
 * Navigation is unchanged: category-menu rows carry no device-category code,
 * so each card is matched by name to the /master/device-categories rows
 * RepairFlow already loads, and links to the same stepHref({ category: code })
 * the old tiles used. A menu row with no matching device category is still
 * shown, but not as a link (it has nowhere to go yet).
 *
 * If the menu request fails or returns nothing, the device-category rows are
 * rendered instead, so the step never goes blank.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  AudioWaveform,
  Cpu,
  Hammer,
  Headphones,
  Laptop,
  Settings,
  Smartphone,
  Store,
  Tablet,
  Watch,
  Wrench,
} from 'lucide-react';

import { masterApi } from '@/lib/api';
import { normKey, orderTiles } from '@/lib/categoryMenuOrder';
import { cx } from '@/components/site/ui';

/* -------------------------------------------------------------------------- */
/* Data                                                                        */
/* -------------------------------------------------------------------------- */

function unwrap(list) {
  if (Array.isArray(list)) return list;
  return list?.content ?? list?.data ?? [];
}

/** Display order for this page; anything else follows, by the API's sortOrder. */
const ORDER = ['mobile', 'laptop', 'tablet', 'smartwatch', 'audiodevice'];

/* Per-category look. Only decoration lives here — never an image. */
const THEMES = {
  mobile: {
    bg: 'linear-gradient(145deg, #F0FFF8 0%, #E4FAF0 50%, #D7F7E8 100%)',
    tint: '#A7F3D0', fg: '#047857', solid: '#059669', soft: '#D1FAE5',
    icon: Smartphone, badge: Wrench,
  },
  tablet: {
    bg: 'linear-gradient(145deg, #F0FAFF 0%, #DDF3FF 55%, #CDEBFF 100%)',
    tint: '#BAE6FD', fg: '#0369A1', solid: '#0284C7', soft: '#E0F2FE',
    icon: Tablet, badge: Hammer,
  },
  laptop: {
    bg: 'linear-gradient(145deg, #FFF9ED 0%, #FFF0CF 55%, #FFE7B0 100%)',
    tint: '#FDE68A', fg: '#B45309', solid: '#D97706', soft: '#FEF3C7',
    icon: Laptop, badge: Settings,
  },
  smartwatch: {
    bg: 'linear-gradient(145deg, #FFF2F9 0%, #FFE2F2 55%, #FFD8EC 100%)',
    tint: '#FBCFE8', fg: '#BE185D', solid: '#DB2777', soft: '#FCE7F3',
    icon: Watch, badge: Wrench,
  },
  audiodevice: {
    bg: 'linear-gradient(145deg, #FAF5FF 0%, #EEE2FF 55%, #E5D5FF 100%)',
    tint: '#DDD6FE', fg: '#6D28D9', solid: '#7C3AED', soft: '#EDE9FE',
    icon: Headphones, badge: AudioWaveform,
  },
  // Nearby Shops tile — only its fallback icon is used (when /Near-Store.png is missing).
  nearbyshops: {
    bg: 'linear-gradient(145deg, #F0FFF8 0%, #E4FAF0 50%, #D7F7E8 100%)',
    tint: '#A7F3D0', fg: '#047857', solid: '#059669', soft: '#D1FAE5',
    icon: Store, badge: Store,
  },
};

const DEFAULT_THEME = {
  bg: 'linear-gradient(145deg, #F8FAFC 0%, #EEF2F6 55%, #E2E8F0 100%)',
  tint: '#CBD5E1', fg: '#334155', solid: '#035C6C', soft: '#F1F5F9',
  icon: Cpu, badge: Wrench,
};

function sortByPageOrder(rows) {
  return [...rows].sort((a, b) => {
    const ia = ORDER.indexOf(a.key);
    const ib = ORDER.indexOf(b.key);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
  });
}

/** Menu rows → card models, each carrying the device-category code to link to. */
function fromMenu(menuRows, deviceCategories) {
  const codeByKey = {};
  deviceCategories.forEach((c) => {
    if (!c?.code) return;
    codeByKey[normKey(c.name)] = c.code;
    codeByKey[normKey(c.code)] = codeByKey[normKey(c.code)] || c.code;
  });
  return menuRows
    .filter((r) => r && r.isActive === true)
    .map((r) => {
      const key = normKey(r.menuName);
      return {
        id: r.id,
        key,
        name: r.menuName,
        description: r.description,
        imageUrl: r.imageUrl,
        sortOrder: r.sortOrder,
        code: codeByKey[key] || null,
      };
    });
}

/** Fallback when the menu API is unavailable: the device categories themselves. */
function fromDeviceCategories(deviceCategories) {
  return deviceCategories
    .filter((c) => c && c.isActive !== false)
    .map((c) => ({
      id: c.id || c.code,
      key: normKey(c.name || c.code),
      name: c.name,
      description: null,
      imageUrl: c.imageUrl || null,
      sortOrder: c.sortOrder,
      code: c.code || null,
    }));
}

/* Single-flight, never rejects, failures not cached (same pattern as HeroCarousel). */
const menuPromises = {};

/** GET /master/category-menu?categoryType=<type> — rows, or null when unavailable. */
export function loadCategoryMenu(type) {
  if (!menuPromises[type]) {
    const mine = masterApi
      .get(`/master/category-menu?categoryType=${encodeURIComponent(type)}`)
      .then((res) => {
        const rows = unwrap(res);
        return Array.isArray(rows) && rows.length ? rows : null;
      })
      .catch(() => null);
    menuPromises[type] = mine;
    mine.then((rows) => {
      if (!rows && menuPromises[type] === mine) delete menuPromises[type];
    });
  }
  return menuPromises[type];
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

const GRID =
  'grid list-none grid-cols-1 gap-4 p-0 min-[440px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 xl:gap-[18px]';

/* Height follows width, so a card keeps its shape at every column count:
 * 4:3 when a phone shows one per row, square from two per row up. */
const CARD_HEIGHT = 'aspect-[4/3] min-[440px]:aspect-square';

export function RepairCategoryHeading() {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
        <span className="text-brand-ink">Select your device </span>
        <span className="bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
          category to repair
        </span>
      </h2>
      <div className="mx-auto mt-2.5 flex max-w-xl items-center gap-3 sm:gap-4">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-brand-strong" aria-hidden="true" />
        <p className="shrink-0 text-sm text-brand-muted sm:text-base">
          Choose the device type you need service for
        </p>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-brand-strong" aria-hidden="true" />
      </div>
    </div>
  );
}

export function RepairCategorySkeleton({ count = 5 }) {
  return (
    <ul role="list" aria-label="Loading device categories" className={cx(GRID, 'mt-7')}>
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className={cx(
            CARD_HEIGHT,
            'flex flex-col overflow-hidden rounded-[26px] border border-brand-line bg-white motion-safe:animate-pulse',
          )}
        >
          <div className="m-auto h-[55%] w-3/4 rounded-3xl bg-brand-soften" />
          <div className="m-2.5 flex items-center gap-3 rounded-2xl bg-brand-soften/70 p-3">
            <span className="h-11 w-11 shrink-0 rounded-xl bg-brand-line" />
            <span className="flex-1 space-y-2">
              <span className="block h-3.5 w-2/3 rounded bg-brand-line" />
              <span className="block h-3 w-1/2 rounded bg-brand-line" />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CategoryCard({ category, href, scroll }) {
  const [broken, setBroken] = useState(false);
  const theme = THEMES[category.key] || DEFAULT_THEME;
  const Icon = theme.icon;
  const Badge = theme.badge;
  const subtitle = (typeof category.description === 'string' && category.description.trim()) || '';
  const showImage = Boolean(category.imageUrl) && !broken;

  const body = (
    <>
      {/* Decoration — CSS only, low opacity, behind the device. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span
          className="absolute -right-12 -top-14 h-36 w-36 rounded-full opacity-60"
          style={{ background: `radial-gradient(circle at 35% 35%, #ffffff 0%, ${theme.tint} 70%)` }}
        />
        <span
          className="absolute -left-8 top-1/3 h-24 w-24 rounded-full opacity-50 blur-2xl"
          style={{ background: theme.tint }}
        />
        <span className="absolute left-6 top-8 h-2.5 w-2.5 rounded-full bg-white/80" />
        <span className="absolute left-12 top-14 h-1.5 w-1.5 rounded-full opacity-70" style={{ background: theme.solid }} />
        <span className="absolute right-10 top-[46%] h-2 w-2 rounded-full bg-white/90" />
        {/* soft platform under the device */}
        <span className="absolute bottom-[78px] left-1/2 h-4 w-3/5 -translate-x-1/2 rounded-[50%] bg-black/10 blur-md" />
      </span>

      {/* Decorative service badge. */}
      <span
        aria-hidden="true"
        className="absolute right-3.5 top-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-white/85 shadow-soft"
        style={{ color: theme.fg }}
      >
        <Badge className="h-5 w-5" strokeWidth={1.75} />
      </span>

      {/* Device — straight from category.imageUrl, contained, never cropped. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-6 pb-1 pt-5">
        {showImage ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            width={220}
            height={220}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="h-full w-[80%] object-contain drop-shadow-[0_10px_14px_rgba(15,23,42,0.12)] transition-transform duration-[250ms] ease-out motion-safe:group-hover:scale-[1.025]"
          />
        ) : (
          <Icon className="h-20 w-20 opacity-80" style={{ color: theme.fg }} strokeWidth={1.25} aria-hidden="true" />
        )}
      </div>

      {/* Information panel. */}
      {/* Compact: in every multi-column layout a card is only ~230px wide. */}
      <div className="relative m-2 flex items-center gap-2 rounded-2xl border border-white/80 bg-white/80 p-2.5 backdrop-blur-md">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: theme.soft, color: theme.fg }}
        >
          <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold leading-tight text-[#071A38]">
            {category.name}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block text-xs leading-snug text-brand-muted">{subtitle}</span>
          ) : null}
        </span>
        {href ? (
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-soft transition-transform duration-[250ms] ease-out motion-safe:group-hover:translate-x-0.5"
            style={{ background: theme.solid }}
          >
            <ArrowRight className="h-[18px] w-[18px]" />
          </span>
        ) : null}
      </div>
    </>
  );

  const shell = cx(
    CARD_HEIGHT,
    'group relative flex flex-col overflow-hidden rounded-[26px] border border-white/70 shadow-soft',
  );

  if (!href) {
    return (
      <div className={shell} style={{ background: theme.bg }}>
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      scroll={scroll}
      className={cx(
        shell,
        'transition duration-[250ms] ease-out hover:shadow-lift motion-safe:hover:-translate-y-[5px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
      )}
      style={{ background: theme.bg }}
    >
      {body}
    </Link>
  );
}

/** Tile cell: fills its grid column (the grid below sets how many per row). */
const TILE_ITEM = 'min-w-0';

/** Home page tile: flat gray 150x100 image tile, name underneath. */
function ServiceTile({ category, href, scroll }) {
  const [broken, setBroken] = useState(false);
  const Icon = (THEMES[category.key] || DEFAULT_THEME).icon;
  const showImage = Boolean(category.imageUrl) && !broken;

  const body = (
    <>
      <span className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-xl bg-[#EEEEEE] p-2.5 transition duration-200 group-hover:bg-[#E4E4E4]">
        {showImage ? (
          <img
            src={category.imageUrl}
            alt=""
            width={150}
            height={100}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="h-full w-full object-contain transition-transform duration-200 motion-safe:group-hover:scale-105"
          />
        ) : (
          <Icon className="h-9 w-9 text-brand-700" strokeWidth={1.5} aria-hidden="true" />
        )}
      </span>
      <span className="mt-2 block text-center text-[13px] font-medium text-brand-ink transition group-hover:text-brand-700 sm:text-sm">
        {category.name}
      </span>
    </>
  );

  if (!href) return <div>{body}</div>;
  return (
    <Link
      href={href}
      scroll={scroll}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
    >
      {body}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Step                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} props
 * @param {object[]} props.deviceCategories  RepairFlow's device-category rows (code + name).
 * @param {(opts: { category: string }) => string} props.hrefFor  RepairFlow's stepHref.
 * @param {boolean} [props.scroll=false]  false inside the /repair wizard (the step
 *   swaps in place); true when linking in from another page (the home page).
 * @param {import('react').ReactNode} [props.heading]  Replaces the default
 *   "Select your device category to repair" heading (the home page's
 *   "Our Services").
 * @param {boolean} [props.small=false]  Flat gray tiles with the name underneath,
 *   up to 8 per row (the home page).
 * @param {{ id: string, name: string, imageUrl: string, href: string, sortOrder?: number, service?: 'BUY'|'SELL' }[]} [props.extraTiles]
 *   Non-repair tiles shown with the categories in `small` mode (Buy / Sell menu
 *   rows, Nearby Shops). They and the repair tiles form ONE list: every Repair
 *   tile, then Buy, then Sell, each in one device order that follows the admin's
 *   sortOrder — Category Menu's "Sort order" runs across Repair, Sell and Buy —
 *   and a tile with no service or sortOrder goes last.
 * @param {boolean} [props.pending=false]  Keep the skeleton up — the caller is
 *   still loading extraTiles.
 */
export default function RepairCategoryCards({
  deviceCategories,
  hrefFor,
  scroll = false,
  heading,
  small = false,
  extraTiles = [],
  pending = false,
}) {
  const [menu, setMenu] = useState(undefined); // undefined = loading, null = unavailable

  useEffect(() => {
    let alive = true;
    loadCategoryMenu('REPAIR').then((rows) => {
      if (alive) setMenu(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  const devices = Array.isArray(deviceCategories) ? deviceCategories : [];
  let cards = menu ? fromMenu(menu, devices) : [];
  const fromAdminMenu = cards.length > 0;
  if (menu === null || (menu && !fromAdminMenu)) cards = fromDeviceCategories(devices);
  cards = sortByPageOrder(cards);

  const hrefOf = (category) => (category.code ? hrefFor({ category: category.code }) : null);

  // Home page: the Repair list, then Buy, then Sell (see orderTiles). The fallback
  // device categories carry no category-menu sortOrder, so page order stands in.
  let tiles = [];
  if (small) {
    const repairTiles = cards.map((category, i) => ({
      ...category,
      service: 'REPAIR',
      href: hrefOf(category),
      ...(fromAdminMenu ? null : { sortOrder: i }),
    }));
    tiles = orderTiles([...repairTiles, ...extraTiles]);
  }

  return (
    <div>
      {heading ?? <RepairCategoryHeading />}

      {menu === undefined || pending ? (
        <RepairCategorySkeleton />
      ) : cards.length === 0 ? (
        <p className="mt-7 rounded-2xl border border-brand-line bg-white px-5 py-8 text-center text-sm text-brand-muted">
          Device categories are not available right now. Please try again in a moment.
        </p>
      ) : (
        <ul
          role="list"
          aria-label={small ? 'Our services' : 'Device categories we repair'}
          className={
            small
              ? // Even grid that always spans the full row (no empty space on the right):
                // 2 per row on phones → 4 → 6 → 8 on desktop.
                'mt-4 grid list-none grid-cols-2 gap-x-3 gap-y-4 p-0 min-[480px]:grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
              : cx(GRID, 'mt-7')
          }
        >
          {small
            ? tiles.map((tile) => (
                <li key={tile.id} className={TILE_ITEM}>
                  <ServiceTile category={tile} href={tile.href} scroll={scroll} />
                </li>
              ))
            : cards.map((category) => (
                <li key={category.id}>
                  <CategoryCard category={category} href={hrefOf(category)} scroll={scroll} />
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}
