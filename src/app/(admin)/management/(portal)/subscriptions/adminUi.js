'use client';

/**
 * Small admin-portal building blocks shared by the Subscription v2 tabs
 * (same admin-* tokens, borders and inputs as the rest of /management).
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, MoreVertical, RefreshCw, X } from 'lucide-react';

export const inputBase =
  'rounded-lg border border-admin-border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-admin-accent focus:outline-none focus:ring-2 focus:ring-admin-accent/20 disabled:bg-slate-50 disabled:text-slate-500';
export const inputCls = `w-full ${inputBase}`;

const TONES = {
  green: 'bg-brand-100 text-brand-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-700',
  slate: 'bg-slate-100 text-slate-600',
  violet: 'bg-violet-100 text-violet-700',
};

const STATUS_TONE = {
  ACTIVE: 'green', ACTIVATED: 'green', CAPTURED: 'green', PAID: 'green', SUCCESS: 'green', LIVE: 'green',
  TRIAL: 'blue', TEST: 'amber', CREATED: 'slate', AWAITING_PAYMENT: 'amber', PENDING: 'amber', AUTHORIZED: 'amber',
  EXPIRING: 'amber', COMING_SOON: 'amber', REFUNDED: 'violet', PARTIALLY_REFUNDED: 'violet', MANUAL: 'violet',
  EXPIRED: 'red', CANCELLED: 'red', FAILED: 'red', INACTIVE: 'slate', NONE: 'slate', UNCONFIGURED: 'red',
};

export function Badge({ value, tone, children }) {
  const key = String(value || '').toUpperCase();
  const cls = TONES[tone || STATUS_TONE[key] || 'slate'];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {children ?? (value ? String(value).replace(/_/g, ' ') : '—')}
    </span>
  );
}

export function ErrorNote({ message, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold ring-1 ring-red-200 hover:bg-red-100">
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      ) : null}
    </div>
  );
}

export function Field({ label, hint, required, children, className = '' }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-medium text-admin-muted">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`flex items-start justify-between gap-3 rounded-lg border border-admin-border bg-white px-3 py-2.5 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-admin-muted">{hint}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={!!checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-admin-accent peer-focus-visible:ring-2 peer-focus-visible:ring-admin-accent/30" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, size = 'max-w-lg' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" className={`flex max-h-[92dvh] w-full ${size} flex-col rounded-xl border border-admin-border bg-admin-card shadow-xl`}>
        <div className="flex items-start justify-between gap-3 border-b border-admin-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-admin-muted">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-admin-border px-4 py-3 sm:px-5">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Drawer({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <aside role="dialog" aria-modal="true" className="flex h-full w-full max-w-2xl flex-col bg-admin-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-admin-border px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 break-words text-xs text-admin-muted">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
      </aside>
    </div>
  );
}

/** Plain responsive table: horizontal scroll inside its card, skeleton while loading. */
export function Table({ columns, rows, loading, empty = 'Nothing to show.', rowKey = (r, i) => r.id ?? i, onRowClick }) {
  return (
    <div className="overflow-hidden rounded-xl border border-admin-border bg-admin-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="border-b border-admin-border bg-slate-50 text-xs uppercase tracking-wide text-admin-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`whitespace-nowrap px-3 py-2.5 font-semibold ${c.align === 'right' ? 'text-right' : ''} ${c.sticky ? 'sticky right-0 bg-slate-50' : ''}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key -- skeleton rows
                  <tr key={i}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-3">
                        <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((r, i) => (
                  <tr key={rowKey(r, i)} className={`hover:bg-slate-50/70 ${onRowClick ? 'cursor-pointer' : ''}`} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                    {columns.map((c) => (
                      <td key={c.key} className={`px-3 py-2.5 align-top text-slate-700 ${c.align === 'right' ? 'text-right' : ''} ${c.wrap ? '' : 'whitespace-nowrap'} ${c.sticky ? 'sticky right-0 bg-white shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.15)]' : ''}`}>
                        {c.render ? c.render(r) : r[c.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-admin-muted">{empty}</p> : null}
    </div>
  );
}

/** Row "⋮" menu, positioned fixed so table scroll containers never clip it. */
export function ActionMenu({ items, label = 'Actions' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const menu = useRef(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = menu.current?.offsetHeight || items.length * 36 + 8;
    const top = r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4;
    setPos({ top, left: Math.max(8, Math.min(r.right - 208, window.innerWidth - 216)) });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (menu.current?.contains(e.target) || btn.current?.contains(e.target)) return;
      setOpen(false);
    };
    const shut = () => setOpen(false);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', shut, true);
    window.addEventListener('resize', shut);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', shut, true);
      window.removeEventListener('resize', shut);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 md:h-8 md:w-8"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div
          ref={menu}
          role="menu"
          style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
          className="fixed z-[60] w-52 rounded-lg border border-admin-border bg-white py-1 shadow-lg"
        >
          {items.filter(Boolean).map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  it.onClick();
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                  it.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                {it.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

export function FilterChips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            value === o.value ? 'border-admin-accent bg-admin-accent text-white' : 'border-admin-border bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Debounced value — server-side search without a request per keystroke. */
export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function DefList({ items }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-100 py-1.5 text-sm">
          <dt className="shrink-0 text-admin-muted">{k}</dt>
          <dd className="min-w-0 break-words text-right font-medium text-slate-800">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export const shortId = (v) => (v ? String(v).slice(0, 8) : '—');
