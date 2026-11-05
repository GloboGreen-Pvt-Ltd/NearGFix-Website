'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { masterApi } from '@/lib/api';
import { cx } from '@/components/site/ui';
import { BANNERS, BANNER_INTERVAL_MS, sortBanners } from '@/lib/siteContent';

/* -------------------------------------------------------------------------- */
/* Shared fetch                                                                */
/* -------------------------------------------------------------------------- */
/* Same single-flight pattern as CategoryRail: one request no matter how many
 * mounts, never rejects (resolves to null on any failure so the caller keeps the
 * bundled rows), and a failed attempt is NOT cached — otherwise one bad moment on
 * the network would pin the hero to the bundled slide for the rest of the session.
 */
let bannersPromise = null;

function loadBanners() {
  if (!bannersPromise) {
    bannersPromise = (async () => {
      try {
        // masterApi bakes in { skipAuthRedirect: true }, so a 401/403 from a cold
        // master-data service can never bounce a public visitor to /management.
        const rows = await masterApi.get('/master/banners');
        if (!Array.isArray(rows) || rows.length === 0) return null;
        const sorted = sortBanners(rows);
        return Array.isArray(sorted) && sorted.length > 0 ? sorted : null;
      } catch {
        // Network down, CORS, mixed-content block, junk body — all the same.
        return null;
      }
    })();

    const mine = bannersPromise;
    mine.then((rows) => {
      if (!rows && bannersPromise === mine) bannersPromise = null;
    });
  }
  return bannersPromise;
}

/**
 * HeroCarousel — the admin-managed banner slider at the top of the home page.
 *
 * Slides come from /master/banners, so adding or reordering a banner in the admin
 * changes the hero with no code change. Seeded from the bundled BANNERS so it
 * paints correctly on first render and in the static export.
 *
 * Autoplay is paused when: there is only one slide, the user prefers reduced
 * motion, the pointer is over the carousel, focus is inside it, or the tab is
 * hidden. Each of those is a real reason not to move content out from under
 * someone.
 *
 * @param {object} props
 * @param {string} [props.title]      Show ONLY the banner with this title
 *                                    (case-insensitive). Falls back to all
 *                                    slides if nothing matches.
 * @param {string[]} [props.exclude]  Titles to keep OUT of the rotation.
 * @param {'aspect'|'tall'|'short'} [props.height='aspect']  'aspect' derives height
 *                                    from the 1920x700 ratio (never crops);
 *                                    'tall' pins a responsive height up to
 *                                    600px and crops the sides instead;
 *                                    'short' (partner dashboard) is a shorter
 *                                    3:1 banner (the uploads are ~2163x727);
 *                                    the image is contained, never cropped.
 * @param {string} [props.className]
 */
export default function HeroCarousel({ title, exclude, height = 'aspect', className }) {
  const [allSlides, setAllSlides] = useState(() => (Array.isArray(BANNERS) ? BANNERS : []));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const baseId = useId();
  // Tracks the pending timer so a manual dot press restarts the dwell time
  // instead of advancing early on the tail of the previous interval.
  const timerRef = useRef(null);

  /* ---- live refresh ---- */
  useEffect(() => {
    let alive = true;
    loadBanners().then((rows) => {
      if (!alive || !rows) return;
      setAllSlides(rows);
      setIndex(0);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* ---- honour prefers-reduced-motion, and keep honouring it if it changes ---- */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    // Safari <14 only has the deprecated addListener.
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', apply);
      else if (mq.removeListener) mq.removeListener(apply);
    };
  }, []);

  /* ---- don't advance while the tab is in the background ---- */
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  /* ---- which banners belong on THIS page ---------------------------------- */
  /* master_banners has no page/placement column, so the TITLE is the only thing
   * that can target a slide at a page. `title="Repair"` shows only the banner
   * titled Repair; `exclude={['Repair']}` is how the home page keeps page-specific
   * slides out of its general rotation. Matching is case-insensitive and trimmed
   * because these titles are typed by hand in the admin.
   *
   * If a filter matches nothing, we fall back to ALL slides rather than rendering
   * an empty hero — a renamed banner in the admin should degrade to "wrong
   * banner", never to "no hero at all". */
  const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
  const wanted = norm(title);
  const excluded = (Array.isArray(exclude) ? exclude : []).map(norm).filter(Boolean);

  let slides = allSlides;
  if (wanted) {
    const matched = allSlides.filter((s) => norm(s.title) === wanted);
    if (matched.length) slides = matched;
  } else if (excluded.length) {
    const kept = allSlides.filter((s) => !excluded.includes(norm(s.title)));
    if (kept.length) slides = kept;
  }

  const count = slides.length;
  const autoplay = count > 1 && !paused && !reducedMotion;

  /* ---- the advance timer ---- */
  useEffect(() => {
    if (!autoplay) return undefined;
    timerRef.current = setTimeout(
      () => setIndex((i) => (i + 1) % count),
      BANNER_INTERVAL_MS,
    );
    return () => clearTimeout(timerRef.current);
    // `index` is a dependency on purpose: every change restarts the dwell timer,
    // which is what makes a manual dot press give you a full interval to look.
  }, [autoplay, count, index]);

  const goTo = useCallback(
    (next) => {
      if (!count) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const onKeyDown = useCallback(
    (event) => {
      if (count < 2) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(index - 1);
      }
    },
    [count, goTo, index],
  );

  /* ---- swipe (touch) ---- the arrows are hidden below sm, so on phones a
   * horizontal swipe on the frame is the natural way to change slide. Only a
   * clearly horizontal drag counts, so vertical page scrolling is unaffected. */
  const touchRef = useRef(null);
  const onTouchStart = useCallback((event) => {
    const t = event.touches[0];
    touchRef.current = t ? { x: t.clientX, y: t.clientY } : null;
  }, []);
  const onTouchEnd = useCallback(
    (event) => {
      const start = touchRef.current;
      touchRef.current = null;
      const t = event.changedTouches[0];
      if (!start || !t || count < 2) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      goTo(dx < 0 ? index + 1 : index - 1);
    },
    [count, goTo, index],
  );

  if (!count) return null;

  return (
    <div
      className={cx('relative', className)}
      role="region"
      aria-roledescription="carousel"
      aria-label="NearGFix highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={onKeyDown}
    >
      {/* Frame. Locked to the platform's standard banner size, 1028x366
          (~2.81:1) — see BANNER_ASPECT in siteContent. A FIXED ratio is
          deliberate: the box reserves its height before any image loads, so the
          largest above-the-fold element causes no layout shift, and every slide
          in a multi-slide carousel is the same height regardless of what was
          uploaded. The trade-off is that art authored at a different ratio gets
          cropped by object-cover, which is why the size is published in the
          admin. */}
      <div
        className="relative w-full overflow-hidden rounded-3xl bg-brand-soft shadow-soft"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className={cx(
            'relative w-full',
            // 'tall' — a FIXED responsive height topping out at 600px. The
            // 1920x700 art is wider than 600px tall at these widths, so
            // object-cover trims the left/right edges rather than the top and
            // bottom. Banner artwork should therefore keep its message centred.
            // 'aspect' — the default: height derives from the 1920x700 ratio, so
            // nothing is ever cropped.
            height === 'tall'
              ? 'h-[220px] sm:h-[360px] lg:h-[480px] xl:h-[600px]'
              : height === 'short'
                ? 'aspect-[3/1]'
                : 'aspect-[1028/366]',
          )}
        >
          {slides.map((slide, i) => {
            const current = i === index;
            return (
              <div
                key={slide.id}
                id={`${baseId}-slide-${i}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                // Inactive slides are hidden from assistive tech AND removed from
                // the tab order, so a screen reader does not read every banner.
                aria-hidden={current ? undefined : 'true'}
                className={cx(
                  'absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none',
                  current ? 'opacity-100' : 'pointer-events-none opacity-0',
                )}
              >
                {/* Plain <img>: next.config declares no remotePatterns, so
                    next/image would throw on these remote Cloudinary URLs. */}
                <img
                  src={slide.imageUrl}
                  alt={slide.title}
                  width={1028}
                  height={366}
                  // The first slide is the largest thing above the fold, so it is
                  // eager; the rest can wait.
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  decoding="async"
                  className={cx('h-full w-full', height === 'short' ? 'object-contain' : 'object-cover')}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Prev / next. Like the dots, hidden for a single slide — arrows that
          cannot move anywhere are worse than no arrows. Overlaid on the frame,
          vertically centred, with a solid white pill so they stay legible over
          whatever artwork the admin uploads. */}
      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-brand-line bg-white/90 p-2 text-brand-ink shadow-soft backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:flex sm:left-4"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-brand-line bg-white/90 p-2 text-brand-ink shadow-soft backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:flex sm:right-4"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </>
      ) : null}

      {/* Dots. Hidden entirely for a single slide — one dot communicates nothing
          and reads as a broken control. */}
      {count > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          {slides.map((slide, i) => {
            const current = i === index;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show slide ${i + 1}: ${slide.title}`}
                aria-current={current ? 'true' : undefined}
                aria-controls={`${baseId}-slide-${i}`}
                className={cx(
                  // after: widens the tap target to ~34px tall without moving the dots.
                  'relative h-2.5 rounded-full transition-all duration-300 motion-reduce:transition-none after:absolute after:-inset-x-1 after:-inset-y-3',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
                  current ? 'w-7 bg-brand-600' : 'w-2.5 bg-brand-strong hover:bg-brand-400',
                )}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
