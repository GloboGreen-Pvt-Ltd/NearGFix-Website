'use client';

/**
 * MoreNavMenu — the "More" item at the end of the desktop menu card, a
 * dropdown holding the lower-traffic pages (About, FAQ, Contact) so the main
 * row stays short.
 *
 * Unlike RepairNavMenu, "More" is not a destination itself, so the trigger is
 * a button: click (or Enter/Space) toggles, hover opens, Escape and an outside
 * click close. The mobile panel lists these same links flat instead — a
 * submenu inside the panel would only add a tap.
 *
 * @param {object} props
 * @param {{ href: string, label: string, icon?: Function, active?: boolean }[]} props.items
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import { cx, desktopNavItemClass } from './ui';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

export default function MoreNavMenu({ items }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  /* Outside click + Escape, same pattern (and capture-phase Escape) as
   * RepairNavMenu. */
  useEffect(() => {
    if (!open) return undefined;
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
  }, [open]);

  const handleBlur = useCallback((event) => {
    const next = event.relatedTarget;
    if (next && wrapRef.current && wrapRef.current.contains(next)) return;
    setOpen(false);
  }, []);

  return (
    <div ref={wrapRef} onBlur={handleBlur} onMouseLeave={close} className="relative">
      {/* Shared with SiteHeader's desktop items (ui.js desktopNavItemClass). */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={menuId}
        className={desktopNavItemClass()}
      >
        More
        <ChevronDown
          className={cx('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {/* pt-2 instead of a margin keeps the pointer inside the wrapper while it
          travels from the trigger to the list, so onMouseLeave doesn't close it. */}
      <div id={menuId} hidden={!open} className="absolute left-0 top-full z-50 pt-2">
        <ul className="w-56 overflow-hidden rounded-2xl border border-brand-line bg-white p-1.5 shadow-lift">
          {items.map(({ href, label, icon: Icon, active }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={close}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  FOCUS_RING,
                  active ? 'bg-brand-soft text-brand-700' : 'text-brand-ink hover:bg-brand-soften',
                )}
              >
                {Icon ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-700">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : null}
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
