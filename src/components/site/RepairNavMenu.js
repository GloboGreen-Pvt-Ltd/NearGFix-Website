'use client';

/**
 * RepairNavMenu — the "Repair" primary-nav item, expanded into a dropdown
 * (desktop) / accordion (mobile panel) of device categories.
 *
 * Data is DEVICE_CATEGORIES from siteContent.js — the exact bundled fallback
 * SiteSearch and CategoryRail already use, so this can never list a category
 * the rest of the site does not also serve. Each row deep-links to
 * /repair?category=<code>, the query contract RepairFlow already reads (see
 * that component's own doc comment) — no new route or data shape.
 *
 * Clicking "Repair" itself still navigates to /repair (a real anchor, not a
 * button), so the existing plain-link behaviour is unchanged for anyone who
 * doesn't pause on it; the dropdown is purely an additive shortcut on hover
 * or keyboard focus.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Headphones, Laptop, Smartphone, Tablet, Watch, Wrench } from 'lucide-react';

import { cx } from './ui';
import { DEVICE_CATEGORIES } from '@/lib/siteContent';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

const CATEGORY_ICONS = {
  MOBILE: Smartphone,
  TABLET: Tablet,
  LAPTOP: Laptop,
  SMARTWATCHES: Watch,
  AUDIO_DEVICE: Headphones,
};

export default function RepairNavMenu({ active, variant = 'desktop', onNavigate }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  const categories = Array.isArray(DEVICE_CATEGORIES) ? DEVICE_CATEGORIES : [];

  const close = useCallback(() => setOpen(false), []);

  /* Desktop only: outside click + Escape, same pattern as HeaderAccount's
   * own dropdown. Capture phase on keydown so this can mark Escape handled
   * before the header's mobile-panel listener ever sees it, matching
   * LocationControl's documented reasoning for the same guard. */
  useEffect(() => {
    if (!open || variant !== 'desktop') return undefined;
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      if (triggerRef.current) triggerRef.current.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, variant]);

  const handleBlur = useCallback((event) => {
    const next = event.relatedTarget;
    if (next && wrapRef.current && wrapRef.current.contains(next)) return;
    setOpen(false);
  }, []);

  // Filled pill, matching SiteHeader's navLinkClass — the icon has no colour
  // class of its own, so it inherits text-brand-700 (active) or
  // text-brand-muted (inactive) from this same className via currentColor.
  const activeClass = active
    ? 'bg-brand-soft text-brand-700'
    : 'text-brand-muted hover:bg-brand-soften hover:text-brand-ink';

  if (variant === 'mobile') {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cx(
            'flex w-full items-center justify-between rounded-full px-4 py-3 text-base font-semibold transition',
            FOCUS_RING,
            active ? 'bg-brand-soft text-brand-700' : 'text-brand-muted hover:bg-brand-soften hover:text-brand-ink',
          )}
        >
          <span className="flex items-center gap-2.5">
            <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />
            Repair
          </span>
          <ChevronDown
            className={cx('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>

        {open ? (
          <ul className="ml-3 mt-1 space-y-0.5 border-l border-brand-line pl-3">
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category.code] || Smartphone;
              return (
                <li key={category.code}>
                  <Link
                    href={`/repair?category=${encodeURIComponent(category.code)}`}
                    onClick={onNavigate}
                    className={cx(
                      'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-brand-muted transition hover:bg-brand-soften hover:text-brand-ink',
                      FOCUS_RING,
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {category.name} Repair
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href="/repair"
                onClick={onNavigate}
                className={cx(
                  'block rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-soften',
                  FOCUS_RING,
                )}
              >
                See all repairs
              </Link>
            </li>
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={wrapRef} onBlur={handleBlur} className="relative">
      <Link
        ref={triggerRef}
        href="/repair"
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cx('inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition', FOCUS_RING, activeClass)}
      >
        <Wrench className="h-4 w-4 shrink-0" aria-hidden="true" />
        Repair
        <ChevronDown className={cx('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </Link>

      {open ? (
        <div
          role="menu"
          onMouseLeave={close}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-2xl border border-brand-line bg-white p-1.5 shadow-lift"
        >
          {categories.map((category) => {
            const Icon = CATEGORY_ICONS[category.code] || Smartphone;
            return (
              <Link
                key={category.code}
                href={`/repair?category=${encodeURIComponent(category.code)}`}
                role="menuitem"
                onClick={close}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-ink transition hover:bg-brand-soften',
                  FOCUS_RING,
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-700">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {category.name} Repair
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
