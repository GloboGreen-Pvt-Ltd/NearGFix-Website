'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ListOrdered, X } from 'lucide-react';

import { cx } from '@/components/site/ui';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

/**
 * A section counts as "current" once its top is within this distance below the
 * sticky header. Larger than any heading scroll-margin gap (up to ~47px at md),
 * so a section jumped to is always the one highlighted.
 */
const SPY_MARGIN = 96;

const TAKEOVER_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'hashchange', 'popstate'];

/**
 * Calls `done` once the window stops scrolling after a programmatic jump (quiet
 * for longer than SiteHeader's 200ms collapse transition). Never fires if the
 * person takes over first — wheel, touch, pointer, key or a hash navigation —
 * or if it all takes over 2s, so it can never pull anyone back.
 * Returns a cancel function.
 */
function afterJumpSettles(done) {
  const started = Date.now();
  let timer = 0;
  function cancel() {
    window.clearTimeout(timer);
    window.removeEventListener('scroll', onScroll);
    TAKEOVER_EVENTS.forEach((type) => window.removeEventListener(type, cancel));
  }
  function finish() {
    cancel();
    if (Date.now() - started < 2000) done();
  }
  function onScroll() {
    window.clearTimeout(timer);
    timer = window.setTimeout(finish, 300);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  TAKEOVER_EVENTS.forEach((type) => window.addEventListener(type, cancel, { passive: true }));
  timer = window.setTimeout(finish, 450);
  return cancel;
}

/**
 * Scroll only `list` so `link` is comfortably visible (not flush with an edge)
 * — scrollIntoView() would also move the page.
 */
function revealInList(list, link) {
  if (!list || !link || list.scrollHeight <= list.clientHeight) return;
  const top = link.offsetTop;
  const edge = 40;
  if (top < list.scrollTop + edge || top + link.offsetHeight > list.scrollTop + list.clientHeight - edge) {
    list.scrollTop = top - list.clientHeight / 2;
  }
}

/**
 * Table of contents for /terms and /privacy.
 *
 *   lg+  a sticky side column; the current section is highlighted while the
 *        document scrolls, and the column scrolls itself to keep it in view.
 *   < lg a collapsible "Contents" panel above the document, plus a floating
 *        "Contents" button (shown once that panel has scrolled away) that opens
 *        the same list as a bottom sheet.
 *
 * Links are real #section-N anchors, so they work without JavaScript and
 * direct /privacy/#section-6 URLs land on the section (the headings carry a
 * scroll-margin that clears the sticky SiteHeader). With JavaScript a click
 * scrolls smoothly (instant under prefers-reduced-motion), updates the URL hash
 * without adding a history entry, and moves focus to the section heading.
 *
 *   items  [{ id, num, title }] in document order
 */
export default function LegalToc({ items, label = 'Contents' }) {
  const [active, setActive] = useState(items[0]?.id);
  const [panelOpen, setPanelOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showFab, setShowFab] = useState(false);

  const asideRef = useRef(null);
  const listRef = useRef(null);
  const fabRef = useRef(null);
  const sheetListRef = useRef(null);
  const clickedRef = useRef(null);
  const cancelRealignRef = useRef(null);
  const panelId = useId();

  /* -- scroll spy ---------------------------------------------------------- */
  useEffect(() => {
    const sections = items.map((item) => document.getElementById(item.id)).filter(Boolean);
    if (!sections.length) return undefined;
    let frame = 0;

    function update() {
      frame = 0;
      const header = document.querySelector('header');
      const line = (header ? header.getBoundingClientRect().bottom : 0) + SPY_MARGIN;

      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top - line > 0) break;
        current = section.id;
      }
      // The last few sections are too short to reach the top. At the bottom of
      // the page, prefer the one just clicked if it is on screen, else the last.
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) {
        const clicked = clickedRef.current && document.getElementById(clickedRef.current);
        const rect = clicked && clicked.getBoundingClientRect();
        current = rect && rect.top < window.innerHeight && rect.bottom > line
          ? clicked.id
          : sections[sections.length - 1].id;
      }
      setActive(current);

      const aside = asideRef.current;
      setShowFab(Boolean(aside) && aside.getBoundingClientRect().bottom < line);
    }

    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [items]);

  /* -- keep the active entry visible inside the sticky column -------------- */
  useEffect(() => {
    const list = listRef.current;
    revealInList(list, list?.querySelector(`[data-toc-id="${active}"]`));
  }, [active]);

  /* -- bottom sheet: Escape, scroll lock, focus in and back out ------------ */
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const fab = fabRef.current;
    function onKey(event) {
      if (event.key === 'Escape') setSheetOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const list = sheetListRef.current;
    const current = list?.querySelector('[aria-current="location"]') || list?.querySelector('a');
    current?.focus({ preventScroll: true });
    revealInList(list, current);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      // Back to the button that opened it. Choosing a section then moves focus
      // on to that section's heading (goTo, next frame).
      fab?.focus({ preventScroll: true });
    };
  }, [sheetOpen]);

  const goTo = useCallback((event, id) => {
    const section = document.getElementById(id);
    if (!section) return;
    event.preventDefault();
    clickedRef.current = id;
    setActive(id);
    setPanelOpen(false);
    setSheetOpen(false);
    // Next frame: the sheet's scroll lock is released by then.
    window.requestAnimationFrame(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      // Keep Next's router state; replaceState so Back leaves the page, not the hash.
      window.history.replaceState(window.history.state, '', `#${id}`);
      section.querySelector('h2')?.focus({ preventScroll: true });
      // Leaving the top of the page compacts SiteHeader (its trust strip
      // collapses), which pulls everything below up by ~44px after the smooth
      // scroll has already picked its target. Re-align once scrolling stops.
      cancelRealignRef.current?.();
      cancelRealignRef.current = afterJumpSettles(() => {
        const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom || 0;
        const top = section.getBoundingClientRect().top;
        if (top < headerBottom || top > headerBottom + 72) section.scrollIntoView({ block: 'start' });
      });
    });
  }, []);

  useEffect(() => () => cancelRealignRef.current?.(), []);

  const activeItem = items.find((item) => item.id === active);

  return (
    <>
      <aside ref={asideRef} className="min-w-0 lg:sticky lg:top-[8.5rem] lg:self-start">
        <div className="rounded-2xl border border-brand-line bg-white shadow-soft">
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            aria-controls={panelId}
            className={cx(
              'flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left lg:hidden',
              FOCUS_RING,
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <ListOrdered className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
              <span className="font-semibold text-brand-ink">{label}</span>
              <span className="text-sm text-brand-muted">{items.length} sections</span>
            </span>
            <ChevronDown
              className={cx('h-5 w-5 shrink-0 text-brand-muted transition-transform', panelOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          <p className="hidden px-5 pb-2 pt-4 text-xs font-bold uppercase tracking-wider text-brand-muted lg:block">
            {label}
          </p>

          <nav
            id={panelId}
            aria-label={label}
            className={cx(panelOpen ? 'block' : 'hidden', 'border-t border-brand-line lg:block lg:border-0')}
          >
            <TocList
              listRef={listRef}
              items={items}
              active={active}
              onSelect={goTo}
              className="max-h-[55dvh] lg:max-h-[calc(100dvh-12.5rem)]"
            />
          </nav>
        </div>
      </aside>

      {/* Floating Contents button + bottom sheet (below lg only). */}
      {showFab ? (
        <button
          ref={fabRef}
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          className={cx(
            'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-brand-700 py-2.5 pl-3.5 pr-4 text-sm font-semibold text-white shadow-lift transition hover:bg-brand-800 lg:hidden',
            FOCUS_RING,
          )}
        >
          <ListOrdered className="h-4 w-4 shrink-0" aria-hidden="true" />
          {label}
          {activeItem ? (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs tabular-nums">§ {activeItem.num}</span>
          ) : null}
        </button>
      ) : null}

      {sheetOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={label}>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Close ${label.toLowerCase()}`}
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-brand-ink/50"
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[80dvh] flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-lift">
            <div className="flex items-center justify-between gap-3 border-b border-brand-line px-5 py-3">
              <p className="font-semibold text-brand-ink">{label}</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label={`Close ${label.toLowerCase()}`}
                className={cx(
                  'flex h-9 w-9 items-center justify-center rounded-full text-brand-muted hover:bg-brand-soften hover:text-brand-ink',
                  FOCUS_RING,
                )}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {/* Flex column all the way down, so the list gets a bounded height and scrolls. */}
            <nav aria-label={label} className="flex min-h-0 flex-1 flex-col">
              <TocList listRef={sheetListRef} items={items} active={active} onSelect={goTo} className="min-h-0 flex-1" />
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TocList({ items, active, onSelect, listRef, className }) {
  return (
    <ol ref={listRef} className={cx('relative space-y-0.5 overflow-y-auto overscroll-contain p-2 lg:px-3 lg:pb-4', className)}>
      {items.map((item) => {
        const current = item.id === active;
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              data-toc-id={item.id}
              onClick={(event) => onSelect(event, item.id)}
              aria-current={current ? 'location' : undefined}
              className={cx(
                'flex gap-2 rounded-xl border-l-[3px] px-3 py-2 text-[13px] leading-snug transition',
                FOCUS_RING,
                current
                  ? 'border-brand-600 bg-brand-50 font-semibold text-brand-800'
                  : 'border-transparent text-brand-muted hover:bg-brand-soften hover:text-brand-ink',
              )}
            >
              <span className="w-7 shrink-0 tabular-nums">{item.num}.</span>
              <span className="min-w-0 break-words">{item.title}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
