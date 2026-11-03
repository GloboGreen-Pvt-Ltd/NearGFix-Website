'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { cx } from '@/components/site/ui';

// Shared by Book Service and Re-Estimate (the Partner App's RepairIssuesPicker look).
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';

/** Issue group tile: icon over a two-line name; picked = teal edge, mint fill, count badge. */
export function IssueTile({ name, Icon, picked, onClick }) {
  const on = picked > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}${on ? `, ${picked} selected` : ''}`}
      className={cx(
        'relative flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2 text-center transition',
        FOCUS_RING,
        on ? 'border-[1.5px] border-[#035C6C] bg-[#E5F3F5]' : 'border-[#E5E7EB] bg-white hover:border-[#035C6C]/50',
      )}
    >
      {on ? (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#035C6C] px-1 text-[9px] font-extrabold text-white">{picked}</span>
      ) : null}
      <Icon className={cx('h-[22px] w-[22px]', on ? 'text-[#035C6C]' : 'text-[#111111]')} strokeWidth={1.75} aria-hidden="true" />
      <span className={cx('line-clamp-2 text-[12px] leading-[14px] text-[#111111]', on ? 'font-bold' : 'font-medium')}>{name}</span>
    </button>
  );
}

/** One issue to tick (search results and a group's sheet). */
export function IssueCheckRow({ name, sub, Icon, on, onClick }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cx(
        'flex min-h-[48px] w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition',
        FOCUS_RING,
        on ? 'border-[1.5px] border-[#035C6C] bg-[#E5F3F5]' : 'border-[#E5E7EB] bg-white hover:border-[#035C6C]/50',
      )}
    >
      <Icon className={cx('h-[18px] w-[18px] shrink-0', on ? 'text-[#035C6C]' : 'text-[#111111]')} strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={cx('line-clamp-2 text-[13px] text-[#111111]', on ? 'font-bold' : 'font-medium')}>{name}</span>
        {sub ? <span className="block truncate text-[11px] text-[#6B7280]">{sub}</span> : null}
      </span>
      <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px]', on ? 'border-[#035C6C] bg-[#035C6C] text-white' : 'border-[#C9CFC9] bg-white')}>
        {on ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" /> : null}
      </span>
    </button>
  );
}

/** A selected issue: Price | Service Charge | Warranty (months), and remove. */
export function SelectedIssueRow({ name, sub, Icon, price, charge, warranty, note, onPrice, onCharge, onWarranty, onNote, onRemove }) {
  const box = 'flex h-10 items-center rounded-[10px] border border-[#E5E7EB] bg-white px-2.5 focus-within:border-[#035C6C]';
  const input = 'min-w-0 flex-1 bg-transparent text-base font-bold text-[#111111] outline-none placeholder:font-normal placeholder:text-[#9CA3AF] sm:text-[14px]';
  return (
    <div className="rounded-[14px] border border-[#C7E6EA] bg-white p-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#E5F3F5]">
          <Icon className="h-[18px] w-[18px] text-[#035C6C]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-semibold text-[#111111]">{name}</p>
          {sub ? <p className="truncate text-[11px] text-[#6B7280]">{sub}</p> : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DC2626]/10 text-[#DC2626] transition hover:bg-[#DC2626]/20', FOCUS_RING)}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {[
          ['Price', price, onPrice],
          ['Service Charge', charge, onCharge],
        ].map(([label, value, onValue]) => (
          <label key={label} className="min-w-0">
            <span className="mb-1 block truncate text-[12px] font-semibold text-[#6B7280]">{label}</span>
            <span className={box}>
              <span className="mr-1 text-[13px] font-bold text-[#6B7280]">₹</span>
              <input
                inputMode="decimal"
                value={value}
                onChange={(e) => onValue(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                aria-label={`${label} for ${name}`}
                className={input}
              />
            </span>
          </label>
        ))}
        <label className="min-w-0">
          <span className="mb-1 block truncate text-[12px] font-semibold text-[#6B7280]">Warranty</span>
          <span className={box}>
            <input
              inputMode="numeric"
              maxLength={3}
              value={warranty}
              onChange={(e) => onWarranty(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              aria-label={`Warranty months for ${name}`}
              className={input}
            />
            <span className="ml-1 text-[12px] font-semibold text-[#6B7280]">Mo</span>
          </span>
        </label>
      </div>
      {onNote ? (
        <input
          value={note}
          onChange={(e) => onNote(e.target.value.slice(0, 200))}
          placeholder="Additional note (optional)"
          aria-label={`Additional note for ${name}`}
          className="mt-2 h-10 w-full rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 text-base text-[#111111] outline-none placeholder:text-[#9CA3AF] focus:border-[#035C6C] sm:text-[13px]"
        />
      ) : null}
    </div>
  );
}

/** A group's issues in a popup (the app's bottom sheet). */
export function IssueSheet({ title, Icon, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[520px] rounded-2xl bg-white p-4 shadow-xl">
        <div className="mb-2.5 flex items-center gap-2.5">
          <Icon className="h-5 w-5 shrink-0 text-[#111111]" strokeWidth={1.75} aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-[#111111]">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className={cx('rounded-full p-1 text-[#6B7280] hover:bg-[#F3F4F6]', FOCUS_RING)}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[420px] space-y-1.5 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

