'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/PortalLink';
import { Headphones, Laptop, Smartphone, Tablet, Watch, Wrench } from 'lucide-react';

import { masterApi } from '@/lib/api';
import { cx } from '@/components/site/ui';
import { DEVICE_CATEGORIES, sortDeviceCategories } from '@/lib/siteContent';

/* -------------------------------------------------------------------------- */
/* Fallback icons                                                              */
/* -------------------------------------------------------------------------- */
/* Imported straight from lucide-react rather than routed through the shared    */
/* ICONS lookup in ui.js — these names may not exist there. Shown only when a    */
/* remote image 404s / is blocked.                                              */

const FALLBACK_ICONS = {
  MOBILE: Smartphone,
  TABLET: Tablet,
  LAPTOP: Laptop,
  SMARTWATCHES: Watch,
  AUDIO_DEVICE: Headphones,
};

/* -------------------------------------------------------------------------- */
/* Shared fetch                                                                */
/* -------------------------------------------------------------------------- */
/* Even as a single grid this can be mounted more than once across the site, so
 * the request is hoisted to a module-scoped promise: the first mount starts it,
 * any other awaits the same promise, and a later mount (e.g. client-side nav
 * back to the page) reuses the resolved value. Module scope — deliberately not
 * hung off `window` — so it dies with the bundle.
 *
 * The promise NEVER rejects: loadCategories resolves to `null` on any failure so
 * every consumer takes the same "keep the bundled rows" path.
 */
let categoriesPromise = null;

function loadCategories() {
  if (!categoriesPromise) {
    categoriesPromise = (async () => {
      try {
        // masterApi bakes in { skipAuthRedirect: true } on every verb (see
        // src/lib/api.js), so a 401/403 from a cold or misrouted master-data
        // service can never bounce a public visitor to /management.
        const rows = await masterApi.get('/master/device-categories');
        if (!Array.isArray(rows) || rows.length === 0) return null;
        const sorted = sortDeviceCategories(rows);
        return Array.isArray(sorted) && sorted.length > 0 ? sorted : null;
      } catch {
        // Network down, CORS, mixed-content block, junk body — all the same
        // outcome. A public marketing page never surfaces a backend error.
        return null;
      }
    })();

    // Cache SUCCESS forever, but never cache a failure: drop the memo once a
    // null settles so the next mount (a client-side nav back to the page, say)
    // gets a fresh attempt instead of being pinned to the bundled rows for the
    // rest of the session by one bad moment on the network. This runs after the
    // promise settles, so every consumer already awaiting it still shares the
    // single in-flight request — the single-flight guarantee is unchanged.
    // `mine` pins the identity being invalidated so this can only ever clear
    // its OWN settled promise, never a newer in-flight one.
    const mine = categoriesPromise;
    mine.then((rows) => {
      if (!rows && categoriesPromise === mine) categoriesPromise = null;
    });
  }
  return categoriesPromise;
}

/**
 * CategoryRail — flat "gadget tile" grid of device categories.
 *
 * Renders the bundled DEVICE_CATEGORIES from siteContent on first paint (so the
 * static export is correct and there is no spinner or layout shift), then quietly
 * refreshes from master-data so the grid mirrors whatever the admin has configured
 * at /management/device-categories. Master data owns the NAMES and the images —
 * labels are always built from the live name, never hardcoded. Adding a category
 * in the admin grows this grid automatically.
 *
 * TWO MODES:
 *
 * 1. `actions` (an array) — the "Our Services" grid. Every action is crossed with
 *    every category into ONE continuous grid, so 3 actions x 5 categories renders
 *    15 tiles ("Repair Mobile" ... "Buy Audio Device"). Each tile is a link to its
 *    action's section, which is what makes the grid function as a menu.
 *
 * 2. `action` (a single string) — one rail of categories for that verb. Kept for
 *    reuse elsewhere; on mobile it is a horizontally scrollable strip.
 *
 * @param {object} props
 * @param {Array<{action: string, href?: string}>} [props.actions]  Grid mode.
 * @param {string} [props.action]     Single-rail mode verb ('Repair' | 'Sell' | 'Buy').
 * @param {'light'|'dark'} [props.tone='light']  Band this sits on. On 'dark' the
 *                                    labels go light; the image tile stays light
 *                                    either way, because the category PNGs are
 *                                    transparent and vanish on a dark backing.
 * @param {'auto'|5|'five'} [props.columns='auto']  Grid shape. 'five' pins the
 *                                    grid to five columns from md up (one row
 *                                    for the five device categories); 'auto'
 *                                    runs more columns than there are items so
 *                                    tiles keep a fixed compact size.
 * @param {string} [props.tileClassName='aspect-square']  Classes for the image
 *                                    box — the place to override the tile's
 *                                    aspect ratio (e.g. 'aspect-[3/2]').
 * @param {string} [props.ariaLabel]  Accessible name for the list.
 * @param {string} [props.className]  Applied to the root element.
 */
export default function CategoryRail({
  actions,
  action,
  tone = 'light',
  columns = 'auto',
  tileClassName = 'aspect-square',
  ariaLabel,
  className,
}) {
  const [categories, setCategories] = useState(() =>
    Array.isArray(DEVICE_CATEGORIES) ? DEVICE_CATEGORIES : [],
  );
  // Codes whose remote image failed to load -> render the lucide fallback.
  const [brokenImages, setBrokenImages] = useState({});

  useEffect(() => {
    let alive = true;

    loadCategories().then((rows) => {
      if (!alive || !rows) return;
      setCategories(rows);
      setBrokenImages({});
    });

    return () => {
      alive = false;
    };
  }, []);

  if (!categories.length) return null;

  const isDark = tone === 'dark';
  const isGrid = Array.isArray(actions) && actions.length > 0;

  // Normalise both modes to one flat list of tiles so the render path below has
  // no branching. In grid mode the outer loop is the ACTION, so tiles come out
  // action-major — all five Repair tiles, then all five Sell, then all five Buy —
  // which lines each action up as its own row on a 5-column grid.
  const groups = isGrid
    ? actions
    : [{ action: typeof action === 'string' ? action.trim() : '', href: null }];

  const tiles = groups.flatMap((group) => {
    const verb = typeof group.action === 'string' ? group.action.trim() : '';
    return categories.map((category) => {
      const name = category.name || '';
      return {
        key: `${verb || 'plain'}-${category.code || name}`,
        code: category.code,
        imageUrl: category.imageUrl,
        label: verb ? `${verb} ${name}` : name,
        href: group.href || null,
      };
    });
  });

  return (
    <ul
      // `role="list"` is not redundant: `list-style: none` (plus display:flex /
      // display:grid) makes WebKit drop the implicit list semantics, so without
      // it VoiceOver stops announcing this as a list of N items.
      role="list"
      aria-label={ariaLabel || (isGrid ? 'Services by device' : 'Device categories')}
      // The scrolling strip (single-rail mode only) is a scrollable region and so
      // has to be operable by keyboard alone (WCAG 2.1.1) — without a tab stop the
      // arrow keys have nothing to act on and off-screen tiles are unreachable.
      // The grid never scrolls, so it takes no tab stop of its own; its tiles are
      // links and are already in the tab order.
      tabIndex={isGrid ? undefined : 0}
      className={cx(
        'list-none p-0',
        isGrid
          ? // Grid mode: never scrolls. 5 columns from lg so each action forms its
            // own tidy row; denser breakpoints just wrap, which still reads fine
            // because the action verb is on every label.
            // Two grid shapes, picked by the `columns` prop rather than by a
            // className override — `cx` is a plain join, so a caller passing
            // "md:grid-cols-5" alongside a built-in "xl:grid-cols-8" would emit
            // both and let CSS source order decide.
            //
            // 'five'  — exactly five across from md up: one clean row for the
            //           five device categories.
            // 'auto'  — more columns than there are categories, so tiles stay
            //           ~155px however wide the container gets instead of
            //           stretching, and rows start at the container's left edge.
            (columns === 5 || columns === 'five'
              ? 'grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-5'
              : 'grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8')
          : cx(
              // Mobile: one continuous strip that scrolls inside its own box. The
              // overflow lives here, so the page body never scrolls sideways.
              // pt-1: overflow-x-auto forces overflow-y:auto too, which would clip
              // the tiles against the top edge of the strip.
              'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pt-1 sm:pt-0',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              'sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid-cols-5',
              // Visible focus for the tab stop above. No ring-offset: the offset
              // would paint its own colour behind the ring, reading as a white halo
              // on a dark band. brand-700 rather than brand-500 — #035C6C manages
              // only 2.3:1 on white, under the 3:1 WCAG 1.4.11 floor for a focus
              // indicator; #024A57 clears it on every light surface.
              'rounded-3xl focus-visible:outline-none focus-visible:ring-2',
              isDark ? 'focus-visible:ring-white' : 'focus-visible:ring-brand-700',
            ),
        className,
      )}
    >
      {tiles.map((tile) => {
        const Fallback = FALLBACK_ICONS[tile.code] || Wrench;
        const showFallback = brokenImages[tile.code] || !tile.imageUrl;

        const inner = (
          <>
            <div
              className={cx(
                // tileClassName carries the aspect ratio (default square). The
                // repair page passes aspect-[3/2] for a 148x98.66 card.
                'flex w-full items-center justify-center overflow-hidden',
                tileClassName,
                // Rounded CARD tile (not a circle). White-on-white would vanish
                // against the white page background, so the border — not a fill
                // — is what defines the tile edge. Flat: no shadow, no gradient.
                'rounded-2xl border border-brand-line bg-white',
                // Compact: a card wastes less of its box than a circle did, so
                // the padding comes down again to keep the product photo large
                // inside a physically smaller tile.
                'p-2.5 transition duration-200 sm:p-3',
                'group-hover:border-brand-300 group-hover:bg-brand-50',
                'motion-safe:transition-transform motion-safe:group-hover:-translate-y-0.5',
              )}
            >
              {showFallback ? (
                <Fallback className="h-9 w-9 text-brand-600 sm:h-11 sm:w-11" aria-hidden="true" />
              ) : (
                <img
                  src={tile.imageUrl}
                  // Decorative, NOT the label: the same text is rendered as a
                  // visible <p> directly below this tile, so a descriptive alt
                  // makes a screen reader announce every tile twice. It also
                  // avoids a flash of alt text beside the label if the remote
                  // image 404s before onError swaps in the fallback icon.
                  alt=""
                  width={160}
                  height={160}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-contain"
                  onError={() =>
                    setBrokenImages((prev) =>
                      prev[tile.code] ? prev : { ...prev, [tile.code]: true },
                    )
                  }
                />
              )}
            </div>

            <p
              className={cx(
                'mt-2 w-full break-words text-center text-xs font-medium sm:text-sm',
                isDark ? 'text-white' : 'text-brand-ink',
              )}
            >
              {tile.label}
            </p>
          </>
        );

        return (
          <li
            key={tile.key}
            className={cx(
              'flex flex-col items-center',
              // Fixed comfortable width while the strip scrolls; auto once gridded.
              isGrid ? 'w-full' : 'shrink-0 snap-start w-[132px] sm:w-auto',
            )}
          >
            {tile.href ? (
              <Link
                href={tile.href}
                className={cx(
                  'group flex w-full flex-col items-center rounded-2xl',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  isDark ? 'focus-visible:ring-white' : 'focus-visible:ring-brand-700',
                )}
              >
                {inner}
              </Link>
            ) : (
              // Single-rail mode has no per-tile destination, so the tile stays
              // presentational — `group` is still needed for the hover styles.
              <div className="group flex w-full flex-col items-center">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
