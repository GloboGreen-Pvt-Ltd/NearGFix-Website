'use client';

/**
 * Shared presentational bits for the "My Account" area, built on the site's
 * design tokens (brand-* / accent-*) and the `cx` no-merge joiner. Kept small
 * and local so every account page reads the same — matching the mobile app's
 * per-screen header, loader, empty-state and status-chip conventions.
 */

import { Loader2, RefreshCw } from 'lucide-react';

import { cx } from '@/components/site/ui';

/* -------------------------------------------------------------------------- */
/* Page header — eyebrow + title (+ optional right-aligned action)             */
/* -------------------------------------------------------------------------- */

export function AccountPageHeader({ eyebrow, title, subtitle, right, className }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-brand-ink sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-brand-muted">{subtitle}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Panel — a plain rounded surface for list items (Card in ui.js hover-lifts;  */
/* these lists want a calmer, non-animated container).                         */
/* -------------------------------------------------------------------------- */

/**
 * `highlight` picks the border — NOT the caller via className. cx has no
 * tailwind-merge, so a caller layering `border-brand-300` on top of the base
 * `border-brand-line` would emit both and the base would win by source order,
 * silently killing the highlight. Choosing exactly one class here is the repo's
 * "prop not className override" convention (see SECTION_PADDING in ui.js).
 */
export function Panel({ as: Tag = 'div', className, children, highlight = false, ...rest }) {
  return (
    <Tag
      className={cx(
        'rounded-2xl bg-white shadow-soft',
        highlight ? 'border border-brand-300 ring-1 ring-brand-200' : 'border border-brand-line',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* Loading                                                                     */
/* -------------------------------------------------------------------------- */

export function AccountLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-brand-muted">
      <Loader2 className="h-7 w-7 animate-spin text-brand-600" aria-hidden="true" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */

export function AccountEmpty({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-strong',
        'bg-brand-50/40 px-6 py-16 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-700">
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
      ) : null}
      <h3 className="text-base font-bold text-brand-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-brand-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Error state                                                                 */
/* -------------------------------------------------------------------------- */

export function AccountError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-status-danger/30 bg-red-50/60 px-6 py-14 text-center">
      <h3 className="text-base font-bold text-brand-ink">Something went wrong</h3>
      <p className="mt-1 max-w-md text-sm text-brand-muted">
        {message || "We couldn't load this right now. Please try again."}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-brand-strong bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition hover:border-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status pill — colours a booking/order status the way the app's StatusChip   */
/* does: green = done, red = cancelled, amber = in-progress/pending, else blue. */
/* -------------------------------------------------------------------------- */

const STATUS_TONES = {
  success: 'bg-brand-soft text-brand-700',
  danger: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-sky-100 text-sky-700',
  neutral: 'bg-brand-soften text-brand-muted',
};

export function statusTone(status) {
  const s = String(status || '').toUpperCase();
  if (!s) return 'neutral';
  if (/(COMPLETED|DELIVERED|RECEIVED|READY|DONE|PAID|SUCCESS|CONFIRMED)/.test(s)) return 'success';
  if (/(CANCEL|REJECT|FAIL|RETURN)/.test(s)) return 'danger';
  if (/(PENDING|PLACED|CREATED|AWAIT|HOLD|REQUEST)/.test(s)) return 'warning';
  return 'info';
}

/** Turn "IN_PROGRESS" into "In Progress" for display. */
export function humanizeStatus(status) {
  const s = String(status || '').trim();
  if (!s) return '';
  return s
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function StatusPill({ status, label, className }) {
  const tone = statusTone(status);
  const text = label || humanizeStatus(status);
  if (!text) return null;
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide',
        STATUS_TONES[tone] || STATUS_TONES.neutral,
        className,
      )}
    >
      {text}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Chip — the tab pill / filter chip used by Orders and Devices                */
/* -------------------------------------------------------------------------- */

export function Chip({ active, onClick, icon: Icon, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
        active
          ? 'bg-brand-600 text-white shadow-soft'
          : 'border border-brand-line bg-white text-brand-muted hover:border-brand-300 hover:text-brand-ink',
      )}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      <span>{children}</span>
      {typeof count === 'number' ? (
        <span
          className={cx(
            'ml-0.5 rounded-full px-1.5 text-xs font-bold',
            active ? 'bg-white/20 text-white' : 'bg-brand-soften text-brand-muted',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Initials avatar                                                             */
/* -------------------------------------------------------------------------- */

export function initialsOf(name, fallback = 'U') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || fallback;
}
