'use client';

/**
 * Shared chrome for the Sell a Device steps (src/app/shop-home/sell/*):
 * SellStepHeader — back arrow · centered title · search icon that expands a
 * client-side filter field (only when onQueryChange is given — the Sell on
 * NearGFix home has nothing to filter); SellTile — the equal-size logo/photo card.
 *
 * The listing steps after Select Model also share (the Partner app's
 * sellTheme.js, on the web): SellShell (header + content column + optional
 * sticky SellFooter), SellButton, SellIntro, SellCard, SellLoading,
 * SellMissingDraft, SellThumb, CheckDot / RadioRing and choiceCls(). Buy's
 * details and cart pages (services/marketplace/*) use the same frame.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2, Search, Smartphone, Tag, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import EmptyState from '@/components/shop-dashboard/EmptyState';

export function SellStepHeader({ title, subtitle, query, onQueryChange, searchPlaceholder = 'Search' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const searchable = typeof onQueryChange === 'function';

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function toggleSearch() {
    if (open) onQueryChange('');
    setOpen((v) => !v);
  }

  return (
    <div className="border-b border-[#ECECEC] bg-white">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#111111] transition hover:bg-[#F3F3F3] hover:text-[#035C6C]"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-[20px] font-extrabold tracking-tight text-[#111111]">{title}</h1>
          {subtitle ? <p className="truncate text-[12.5px] text-[#666666]">{subtitle}</p> : null}
        </div>
        {searchable ? (
          <button
            type="button"
            onClick={toggleSearch}
            aria-label={open ? 'Close search' : 'Search'}
            aria-expanded={open}
            className={cx(
              'inline-flex h-10 w-10 items-center justify-center rounded-full transition',
              open ? 'bg-[#F3F3F3] text-[#035C6C]' : 'text-[#111111] hover:bg-[#F3F3F3] hover:text-[#035C6C]',
            )}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
          </button>
        ) : (
          // Keeps the title centred.
          <span className="h-10 w-10" aria-hidden="true" />
        )}
      </div>
      {searchable && open ? (
        <div className="px-4 pb-3.5 sm:px-6">
          <div className="mx-auto flex max-w-xl items-center gap-2 rounded-xl border border-[#ECECEC] bg-[#F8F8F8] px-3.5 py-2.5 focus-within:border-[#035C6C] focus-within:bg-white">
            <Search className="h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && toggleSearch()}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-[14px] text-[#111111] outline-none placeholder:text-[#98A2B3]"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Equal-size card: centered logo/photo (object-contain) over a centered name. */
export function SellTile({ href, imageUrl, name, fallbackIcon: Fallback, imageClassName = 'h-14', onClick, title }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [imageUrl]);
  const inner = (
    <>
      <span className={cx('flex w-full items-center justify-center', imageClassName)}>
        {imageUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote master-data logo/photo, not an app asset Next can optimize.
          <img src={imageUrl} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-contain object-center" />
        ) : Fallback ? (
          <Fallback className="h-8 w-8 text-[#035C6C]/60" aria-hidden="true" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F3F3] text-[18px] font-extrabold text-[#035C6C]">
            {String(name || '?').charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span className="mt-2.5 line-clamp-2 w-full text-center text-[13px] font-semibold leading-snug text-[#111111]">{name}</span>
    </>
  );
  const cls =
    'group flex h-full flex-col items-center rounded-[18px] border border-[#ECECEC] bg-[#F8F8F8] p-3.5 transition';
  if (href) {
    return (
      <Link href={href} title={title} className={cx(cls, 'hover:-translate-y-0.5 hover:border-[#ECECEC]')}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} title={title} className={cx(cls, 'text-left hover:border-[#ECECEC]')}>
      {inner}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Listing steps                                                               */
/* -------------------------------------------------------------------------- */

/** Page frame: header, a centred content column, and an optional sticky footer. */
export function SellShell({ title, subtitle, footer, width = 'max-w-3xl', children }) {
  return (
    <div className="-m-4 flex min-h-full flex-col bg-white sm:-m-6">
      <SellStepHeader title={title} subtitle={subtitle} />
      <div className={cx('mx-auto w-full flex-1 space-y-4 px-4 py-5 sm:px-6 sm:py-6', width)}>{children}</div>
      {footer}
    </div>
  );
}

/** Sticky action bar: a progress caption and the step's button(s). */
export function SellFooter({ caption, width = 'max-w-3xl', children }) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-[#ECECEC] bg-white/95 backdrop-blur">
      <div className={cx('mx-auto flex w-full flex-col gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-6', width)}>
        <p className="text-center text-[12.5px] font-semibold text-[#666666] sm:text-left" aria-live="polite">
          {caption}
        </p>
        <div className="flex gap-2 sm:min-w-[240px]">{children}</div>
      </div>
    </div>
  );
}

export function SellButton({ children, onClick, disabled, loading, variant = 'primary', icon: Icon, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cx(
        'inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-[14.5px] font-extrabold transition disabled:cursor-not-allowed',
        variant === 'outline'
          ? 'border-[1.5px] border-[#ECECEC] bg-white text-[#111111] hover:border-[#035C6C] hover:text-[#035C6C] disabled:opacity-60'
          : variant === 'danger'
            ? 'bg-[#D92D20] text-white hover:bg-[#B42318] disabled:bg-[#D92D20]/40'
            : 'bg-[#035C6C] text-white hover:bg-[#024A57] disabled:bg-[#035C6C]/40',
        className,
      )}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
      {children}
      {Icon && !loading ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
    </button>
  );
}

export function SellIntro({ title, caption }) {
  return (
    <div className="px-0.5">
      <h2 className="text-[18px] font-extrabold tracking-tight text-[#111111]">{title}</h2>
      {caption ? <p className="mt-0.5 text-[13.5px] text-[#666666]">{caption}</p> : null}
    </div>
  );
}

export function SellCard({ className, children }) {
  return <section className={cx('rounded-[18px] border border-[#ECECEC] bg-white p-4 sm:p-5', className)}>{children}</section>;
}

export function SellLoading({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center py-16 text-[#666666]">
      <Loader2 className="h-7 w-7 animate-spin text-[#035C6C]" aria-hidden="true" />
      <p className="mt-2 text-[13px]">{label}</p>
    </div>
  );
}

/** Shown when a step is opened without the earlier steps (a direct link, or a new tab). */
export function SellMissingDraft() {
  return (
    <EmptyState
      icon={Tag}
      tone="muted"
      title="Start from the beginning"
      description="This step needs the device you picked on the earlier steps. Choose a category, brand and model to continue."
      action={
        <Link
          href="/shop-home/sell/select-brand/"
          className="inline-flex h-11 items-center rounded-xl bg-[#035C6C] px-5 text-[14px] font-bold text-white transition hover:bg-[#024A57]"
        >
          Start selling
        </Link>
      }
    />
  );
}

/** A device/part photo that falls back to an icon when missing or broken. */
export function SellThumb({ src, className, fit = 'contain', fallbackIcon: Fallback = Smartphone, iconClassName = 'h-7 w-7' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <span className={cx('flex shrink-0 items-center justify-center overflow-hidden', className)}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- catalogue / uploaded photo, not an app asset Next can optimize.
        <img src={src} alt="" onError={() => setBroken(true)} className={cx('h-full w-full', fit === 'cover' ? 'object-cover' : 'object-contain')} />
      ) : (
        <Fallback className={cx('text-[#035C6C]', iconClassName)} aria-hidden="true" />
      )}
    </span>
  );
}

export function CheckDot({ className = 'h-5 w-5' }) {
  return (
    <span className={cx('flex shrink-0 items-center justify-center rounded-full bg-[#035C6C] text-white', className)} aria-hidden="true">
      <Check className="h-[65%] w-[65%]" strokeWidth={3} />
    </span>
  );
}

export function RadioRing({ className = 'h-5 w-5' }) {
  return <span className={cx('shrink-0 rounded-full border-2 border-[#D0D5DD] bg-white', className)} aria-hidden="true" />;
}

/** Border/fill/text for a selectable option. */
export const choiceCls = (active) =>
  active
    ? 'border-[#035C6C] bg-[#E5F3F5] text-[#024A57]'
    : 'border-[#ECECEC] bg-white text-[#111111] hover:border-[#D0D5DD]';
