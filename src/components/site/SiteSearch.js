'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CircleHelp, Search, Smartphone, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
// Namespace import on purpose. buildSearchIndex / SEARCH_PLACEHOLDER are new
// additions to siteContent.js owned by another file; a namespace import
// resolves them at runtime instead of at bind time, so this component compiles
// and degrades gracefully if it is ever built against an older siteContent
// rather than exploding the whole bundle on a missing named export.
import * as siteContent from '@/lib/siteContent';

const MAX_RESULTS = 8;
const MIN_QUERY = 2;

const TYPE_ICONS = {
  category: Smartphone,
  faq: CircleHelp,
};

/* -------------------------------------------------------------------------- */
/* Index                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Fallback index, used only if siteContent has not (yet) shipped
 * buildSearchIndex. Same shape as the contract: { type, label, hint, href,
 * haystack }. Kept deliberately minimal — siteContent's version is canonical.
 */
function fallbackIndex() {
  const rows = [];

  const categories = Array.isArray(siteContent.DEVICE_CATEGORIES)
    ? siteContent.DEVICE_CATEGORIES
    : [];
  categories.forEach((category) => {
    if (!category || !category.name) return;
    rows.push({
      type: 'category',
      label: category.name,
      hint: 'Device category',
      href: '/#repair',
      haystack: `${category.name} ${category.blurb || ''}`.toLowerCase(),
    });
  });

  const faqs = Array.isArray(siteContent.FAQS) ? siteContent.FAQS : [];
  faqs.forEach((faq) => {
    if (!faq || !faq.question) return;
    rows.push({
      type: 'faq',
      label: faq.question,
      hint: 'FAQ',
      href: '/faq',
      haystack: `${faq.question} ${faq.answer || ''}`.toLowerCase(),
    });
  });

  return rows;
}

function getIndex() {
  if (typeof siteContent.buildSearchIndex === 'function') {
    try {
      const rows = siteContent.buildSearchIndex();
      if (Array.isArray(rows) && rows.length) return rows;
    } catch {
      /* fall through to the bundled fallback */
    }
  }
  return fallbackIndex();
}

/**
 * Rank matches so the obvious answer is first.
 *
 * Three tiers, then original index as a stable tiebreak (which keeps categories
 * ahead of FAQs, since buildSearchIndex emits them in that order):
 *   0  label starts with the query      — "mob" -> "Mobile"
 *   1  a word inside the label starts with it — "watch" -> "Smartwatch"
 *   2  matched only in the body text
 *
 * Without tier 2 a query like "battery" would find nothing, because no category
 * or question *title* contains it — the word lives in blurbs and answers. With
 * tier 2 unranked, those body-only hits would outrank the exact title match.
 */
function scoreRow(row, query) {
  const label = String(row.label || '').toLowerCase();
  if (label.startsWith(query)) return 0;
  if (label.split(/[^a-z0-9]+/i).some((word) => word.startsWith(query))) return 1;
  return 2;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * SiteSearch — client-side search over the bundled device categories and FAQs.
 *
 * Entirely local: no fetch, no debounce, no loading state, and nothing to break
 * when the backend is down. The corpus is a few dozen short strings, so a plain
 * substring scan per keystroke is far below anything a user could perceive.
 *
 * Implemented as an ARIA 1.2 combobox: the input keeps DOM focus at all times
 * and the "selected" option is communicated through aria-activedescendant, so
 * typing never fights with arrowing. Roving tabindex would be wrong here — it
 * would move focus out of the input and break continued typing.
 *
 * Renders inline in the desktop header and inside the mobile menu. It sets no
 * width of its own: the panel is positioned absolutely against a relative
 * wrapper, so the caller controls sizing via className and the dropdown never
 * widens the header.
 *
 * @param {object} props
 * @param {string} [props.className]   Applied to the positioning wrapper.
 * @param {string} [props.placeholder] Overrides SEARCH_PLACEHOLDER.
 * @param {boolean} [props.autoFocus]  For the mobile menu, which opens onto it.
 * @param {'md'|'lg'} [props.size]     'lg' is the tall pill used in the site header.
 */
export default function SiteSearch({ className, placeholder, autoFocus = false, size = 'md' }) {
  const router = useRouter();
  const uid = useId();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);

  // Built once per mount. The corpus is static module data — rebuilding it on
  // every keystroke would be pure waste.
  const index = useMemo(() => getIndex(), []);

  const trimmed = query.trim().toLowerCase();
  const isSearchable = trimmed.length >= MIN_QUERY;

  const results = useMemo(() => {
    if (!isSearchable) return [];
    return index
      .map((row, order) => ({ row, order, score: scoreRow(row, trimmed) }))
      .filter(({ row }) => String(row.haystack || row.label || '').toLowerCase().includes(trimmed))
      .sort((a, b) => a.score - b.score || a.order - b.order)
      .slice(0, MAX_RESULTS)
      .map(({ row }) => row);
  }, [index, trimmed, isSearchable]);

  const listboxId = `${uid}-listbox`;
  const optionId = (position) => `${uid}-option-${position}`;

  // The panel shows results OR the empty state, so it opens on any searchable
  // query — "No matches" is information, and silently showing nothing reads as
  // a broken input.
  const panelOpen = open && isSearchable;

  /* -- keep the active option valid --------------------------------------- */
  /* Editing the query reshuffles the list, so a held index could point at an
   * unrelated row (or past the end, leaving aria-activedescendant referencing a
   * missing id — which makes some screen readers announce nothing at all). */
  useEffect(() => {
    setActiveIndex(-1);
  }, [trimmed]);

  useEffect(() => {
    optionRefs.current.length = results.length;
  }, [results.length]);

  // Keep the highlighted option visible when arrowing through a list taller
  // than the panel's max height.
  useEffect(() => {
    if (activeIndex < 0) return;
    const node = optionRefs.current[activeIndex];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  /* -- dismissal ---------------------------------------------------------- */

  useEffect(() => {
    if (!panelOpen) return undefined;

    // pointerdown rather than click: it lands before focus moves, so the panel
    // is gone before the click reaches whatever is underneath it.
    const onPointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [panelOpen]);

  /** Tabbing out of the widget closes it, without yanking focus back. */
  const handleBlur = useCallback((event) => {
    const next = event.relatedTarget;
    if (next && wrapRef.current && wrapRef.current.contains(next)) return;
    setOpen(false);
  }, []);

  /* -- activation --------------------------------------------------------- */

  const goTo = useCallback(
    (href) => {
      if (!href) return;
      setOpen(false);
      setActiveIndex(-1);
      router.push(href);
    },
    [router],
  );

  const handleKeyDown = useCallback(
    (event) => {
      // Escape closes first and clears second, so one press never does both.
      if (event.key === 'Escape') {
        // preventDefault() in BOTH consuming branches, not just the first. It is
        // the signal SiteHeader reads (event.defaultPrevented) to know this
        // widget already handled the key, so it does not ALSO collapse the
        // whole mobile search row out from under a half-typed query. React
        // delegates at the document root and is registered at hydration, i.e.
        // before any effect-registered listener, so the flag is always set by
        // the time the header's handler runs. stopPropagation() would not work
        // here: both listeners sit on the same node.
        if (panelOpen) {
          event.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        } else if (query) {
          event.preventDefault();
          setQuery('');
        }
        // Focus is already on the input and stays there — nothing to restore.
        // With no panel open and an empty field there is nothing to consume, so
        // the key is left to bubble and close the row.
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        // Without preventDefault the arrow keys also scroll the page behind the
        // open panel.
        event.preventDefault();

        if (!panelOpen) {
          if (isSearchable) setOpen(true);
          return;
        }
        if (!results.length) return;

        setActiveIndex((prev) => {
          const step = event.key === 'ArrowDown' ? 1 : -1;
          // Wraps at both ends: from the last option down to the first, and
          // ArrowUp from "nothing selected" jumps straight to the last option.
          const next = prev + step;
          if (next < 0) return results.length - 1;
          if (next >= results.length) return 0;
          return next;
        });
        return;
      }

      if (event.key === 'Home' && panelOpen && results.length) {
        event.preventDefault();
        setActiveIndex(0);
        return;
      }

      if (event.key === 'End' && panelOpen && results.length) {
        event.preventDefault();
        setActiveIndex(results.length - 1);
        return;
      }

      if (event.key === 'Enter') {
        if (!panelOpen || !results.length) return;
        event.preventDefault();
        // With nothing explicitly highlighted, Enter takes the top result —
        // that is what the ordering is for, and it saves an ArrowDown on the
        // overwhelmingly common "type three letters, hit Enter" path.
        const target = results[activeIndex >= 0 ? activeIndex : 0];
        if (target) goTo(target.href);
      }
    },
    [panelOpen, query, isSearchable, results, activeIndex, goTo],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
    if (inputRef.current) inputRef.current.focus();
  }, []);

  /* The visible search button mirrors Enter: take the top (or highlighted)
   * result once the panel has something to offer, open the panel if there's
   * a searchable query not yet shown, or just refocus the field if it's
   * empty. Same activation path as the keyboard, just reachable by pointer. */
  const handleSearchButtonClick = useCallback(() => {
    if (!isSearchable) {
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    if (!panelOpen) {
      setOpen(true);
      return;
    }
    if (!results.length) return;
    const target = results[activeIndex >= 0 ? activeIndex : 0];
    if (target) goTo(target.href);
  }, [isSearchable, panelOpen, results, activeIndex, goTo]);

  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

  const large = size === 'lg';

  const resolvedPlaceholder =
    placeholder ||
    (typeof siteContent.SEARCH_PLACEHOLDER === 'string' && siteContent.SEARCH_PLACEHOLDER) ||
    'Search devices and help';

  return (
    <div ref={wrapRef} className={cx('relative w-full min-w-0', className)} onBlur={handleBlur}>
      <div
        className={cx(
          'flex items-center gap-1 border border-brand-line bg-brand-page transition',
          large ? 'h-11 rounded-full pl-4 pr-1 sm:h-12 sm:pl-5' : 'rounded-2xl pl-4 pr-1.5',
          'focus-within:border-brand-600 focus-within:bg-white focus-within:shadow-soft',
        )}
      >
        <Search
          className={cx('shrink-0 text-brand-subtle', large ? 'h-5 w-5' : 'h-4 w-4')}
          aria-hidden="true"
        />

        <input
          ref={inputRef}
          type="text"
          value={query}
          // Native decorations fight the custom listbox: search-type inputs get
          // a WebKit clear button, and the browser's own autofill/history
          // dropdown would render on top of ours.
          role="combobox"
          aria-expanded={panelOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            panelOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          aria-label="Search NearGFix"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- opt-in only; the
          // mobile menu opens onto this field, where not focusing it costs an
          // extra tap. Off by default in the header.
          autoFocus={autoFocus}
          placeholder={resolvedPlaceholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (isSearchable) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full min-w-0 bg-transparent py-2.5 pl-2.5 text-base text-brand-ink sm:text-sm outline-none placeholder:text-brand-subtle"
        />

        {query ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className={cx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              'text-brand-subtle transition hover:bg-brand-soften hover:text-brand-ink',
              focusRing,
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleSearchButtonClick}
          aria-label="Search"
          className={cx(
            'inline-flex shrink-0 items-center justify-center bg-brand-600 text-white transition',
            'hover:bg-brand-700',
            large ? 'h-9 w-9 rounded-full sm:h-10 sm:w-10' : 'h-8 w-8 rounded-xl',
            focusRing,
          )}
        >
          <Search className={large ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />
        </button>
      </div>

      {/* The listbox is always in the DOM so aria-controls always resolves to a
          real element; it is emptied and hidden when closed. */}
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Search results"
        className={cx(
          'absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(22rem,60vh)] list-none overflow-y-auto overflow-x-hidden',
          'rounded-2xl border border-brand-line bg-white p-1.5 shadow-lift',
          !panelOpen && 'hidden',
        )}
      >
        {panelOpen && results.length === 0 ? (
          <li className="px-3 py-4 text-sm text-brand-muted">
            No matches for “<span className="font-semibold text-brand-ink">{query.trim()}</span>”.
            Try a device name, or browse the{' '}
            <Link
              href="/faq"
              onClick={() => setOpen(false)}
              className="font-semibold text-brand-700 underline underline-offset-2"
            >
              FAQ
            </Link>
            .
          </li>
        ) : null}

        {panelOpen
          ? results.map((row, position) => {
              const Icon = TYPE_ICONS[row.type] || Search;
              const isActive = position === activeIndex;

              return (
                <li
                  key={`${row.type}-${row.href}-${row.label}`}
                  id={optionId(position)}
                  role="option"
                  aria-selected={isActive}
                  ref={(node) => {
                    optionRefs.current[position] = node;
                  }}
                  // Highlight follows the pointer as well as the keyboard, so
                  // there is only ever one visible "current" row.
                  onMouseMove={() => setActiveIndex(position)}
                  className={cx(
                    'rounded-xl transition-colors',
                    isActive ? 'bg-brand-soft' : 'bg-transparent',
                  )}
                >
                  <Link
                    href={row.href}
                    // The <li> owns the option role, so the link must not add a
                    // second interactive name inside it — but it still has to be
                    // a real anchor for middle-click / open-in-new-tab. tabIndex
                    // -1 keeps it out of the tab order: focus belongs to the
                    // input (see aria-activedescendant above).
                    tabIndex={-1}
                    onClick={() => {
                      setOpen(false);
                      setActiveIndex(-1);
                    }}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 outline-none"
                  >
                    <span
                      className={cx(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        row.type === 'faq'
                          ? 'bg-accent-soft text-accent-600'
                          : 'bg-brand-soft text-brand-700',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      {/* line-clamp is not available (no @tailwindcss/typography
                          or line-clamp plugin config here), so long FAQ
                          questions wrap instead of truncating — break-words
                          keeps them inside the panel at 360px. */}
                      <span className="block break-words text-sm font-semibold text-brand-ink">
                        {row.label}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium uppercase tracking-wide text-brand-subtle">
                        {row.hint}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })
          : null}
      </ul>
    </div>
  );
}
