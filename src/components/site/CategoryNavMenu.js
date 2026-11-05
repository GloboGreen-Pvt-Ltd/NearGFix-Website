'use client';

/**
 * CategoryNavMenu — a primary-nav item ("Repair", "Sell Device", "Buy Devices")
 * expanded into a dropdown (desktop) / accordion (mobile panel) of device
 * categories, each with its admin-managed image.
 *
 * Data: GET /master/category-menu?categoryType=<REPAIR|SELL|BUY>, through the
 * same single-flight loadCategoryMenu the home page's "Our Services" grid uses,
 * so the two can never disagree. Only `isActive` rows, in the admin's sortOrder.
 * If the request fails or returns nothing, the bundled DEVICE_CATEGORIES stand
 * in ("Repair Mobile", "Sell Laptop", …) so the menu never opens empty.
 *
 * Destinations:
 *   REPAIR → /repair/?category=<code>, matched by name to the device category
 *            (category-menu rows carry no code); unmatched rows open /repair/.
 *   SELL   → /#sell and BUY → /#buy — there is no /sell or /buy page yet.
 *
 * The trigger itself is still a real link (to `href`), so clicking "Repair"
 * goes to /repair as before; the dropdown opens on hover or keyboard focus.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Headphones, Laptop, Smartphone, Tablet, Watch } from 'lucide-react';

import { cx, desktopNavItemClass } from './ui';
import { DEVICE_CATEGORIES } from '@/lib/siteContent';
import { normKey } from '@/lib/categoryMenuOrder';
import { loadCategoryMenu } from './RepairCategoryCards';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

/** Fallback thumbnail when a row has no image (or it fails to load). */
const DEVICE_ICONS = {
  mobile: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  smartwatch: Watch,
  audiodevice: Headphones,
};

const VERB = { REPAIR: 'Repair', SELL: 'Sell', BUY: 'Buy' };

/** Device key → device-category code, from the bundled rows (name and code both). */
const CODE_BY_KEY = (Array.isArray(DEVICE_CATEGORIES) ? DEVICE_CATEGORIES : []).reduce((map, c) => {
  if (!c?.code) return map;
  map[normKey(c.name)] = c.code;
  if (!map[normKey(c.code)]) map[normKey(c.code)] = c.code;
  return map;
}, {});

function hrefFor(service, key, fallbackHref) {
  if (service !== 'REPAIR') return fallbackHref;
  const code = CODE_BY_KEY[key];
  return code ? `/repair/?category=${encodeURIComponent(code)}` : '/repair/';
}

/** Menu rows → items; null/empty rows → the bundled device categories. */
function toItems(rows, service, fallbackHref) {
  const active = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.isActive === true && r.menuName)
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

  if (active.length) {
    return active.map((r) => {
      const key = normKey(r.menuName);
      return { id: r.id, key, label: r.menuName, imageUrl: r.imageUrl, href: hrefFor(service, key, fallbackHref) };
    });
  }

  return (Array.isArray(DEVICE_CATEGORIES) ? DEVICE_CATEGORIES : []).map((c) => {
    const key = normKey(c.name || c.code);
    return {
      id: c.code,
      key,
      label: `${VERB[service] || ''} ${c.name}`.trim(),
      imageUrl: c.imageUrl || null,
      href: hrefFor(service, key, fallbackHref),
    };
  });
}

function Thumb({ item, size = 'md' }) {
  const [broken, setBroken] = useState(false);
  const Icon = DEVICE_ICONS[item.key] || Smartphone;
  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl';

  return (
    <span className={cx('flex shrink-0 items-center justify-center overflow-hidden bg-[#EEEEEE] p-1', box)}>
      {item.imageUrl && !broken ? (
        <img
          src={item.imageUrl}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <Icon className="h-4 w-4 text-brand-700" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * @param {object} props
 * @param {'REPAIR'|'SELL'|'BUY'} props.service  Category-menu type to list.
 * @param {string} props.label   Trigger text ("Repair").
 * @param {string} props.href    Trigger destination ('/repair', '/#sell', '/#buy').
 * @param {'desktop'|'mobile'} [props.variant='desktop']
 * @param {boolean} [props.active]  Mobile only: the pill's active state.
 * @param {import('react').ComponentType} [props.icon]  Mobile only: icon before the label.
 * @param {() => void} [props.onNavigate]  Called after a row is chosen (closes the panel).
 */
export default function CategoryNavMenu({
  service,
  label,
  href,
  variant = 'desktop',
  active = false,
  icon: TriggerIcon,
  onNavigate,
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(undefined); // undefined = loading, null = unavailable
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    loadCategoryMenu(service).then((r) => {
      if (alive) setRows(r);
    });
    return () => {
      alive = false;
    };
  }, [service]);

  const items = rows === undefined ? [] : toItems(rows, service, href);

  const close = useCallback(() => setOpen(false), []);
  const choose = useCallback(() => {
    setOpen(false);
    if (onNavigate) onNavigate();
  }, [onNavigate]);

  /* Desktop: outside click + Escape. Capture phase on keydown so Escape is
   * marked handled before SiteHeader's mobile-panel listener sees it. */
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

  /* Touch (tablets / touchscreen desktops at lg+): there is no hover, and the
   * emulated mouseenter/focus would open the card only for the same tap's
   * click to navigate away. So a tap that starts with the card closed opens it
   * instead of following the link; a second tap follows the link. */
  const touchOpenRef = useRef(null);
  const handlePointerDown = useCallback(
    (event) => {
      touchOpenRef.current = event.pointerType === 'touch' ? open : null;
    },
    [open],
  );
  const handleTriggerClick = useCallback((event) => {
    const wasOpen = touchOpenRef.current;
    touchOpenRef.current = null;
    if (wasOpen === false) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    setOpen(false);
  }, []);

  const handleBlur = useCallback((event) => {
    const next = event.relatedTarget;
    if (next && wrapRef.current && wrapRef.current.contains(next)) return;
    setOpen(false);
  }, []);

  /* ----------------------------------------------------------------------- */
  /* Mobile — accordion inside the header panel                               */
  /* ----------------------------------------------------------------------- */
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
            {TriggerIcon ? <TriggerIcon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
            {label}
          </span>
          <ChevronDown className={cx('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>

        {open ? (
          <ul className="ml-3 mt-1 space-y-0.5 border-l border-brand-line pl-3">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={choose}
                  className={cx(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-brand-ink transition hover:bg-brand-soften',
                    FOCUS_RING,
                  )}
                >
                  <Thumb item={item} size="sm" />
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={href}
                onClick={choose}
                className={cx(
                  'block rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-soften',
                  FOCUS_RING,
                )}
              >
                See all
              </Link>
            </li>
          </ul>
        ) : null}
      </div>
    );
  }

  /* ----------------------------------------------------------------------- */
  /* Desktop — text trigger + dropdown card                                   */
  /* ----------------------------------------------------------------------- */
  return (
    <div ref={wrapRef} onBlur={handleBlur} onMouseLeave={close} className="relative">
      <Link
        ref={triggerRef}
        href={href}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onPointerDown={handlePointerDown}
        onClick={handleTriggerClick}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cx(desktopNavItemClass(open), 'gap-1.5')}
      >
        {label}
        <ChevronDown className={cx('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </Link>

      {open ? (
        /* pt-2 instead of a margin: the gap stays inside the wrapper, so moving
           the pointer from the trigger down to the card doesn't fire mouseleave. */
        <div className="absolute left-0 top-full z-50 pt-2">
          <div role="menu" className="w-64 overflow-hidden rounded-2xl border border-brand-line bg-white p-2 shadow-lift">
            {items.length === 0 ? (
              <p className="px-3 py-3 text-sm text-brand-muted">Loading…</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  role="menuitem"
                  onClick={choose}
                  className={cx(
                    'flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-soften hover:text-brand-700',
                    FOCUS_RING,
                  )}
                >
                  <Thumb item={item} />
                  {item.label}
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

