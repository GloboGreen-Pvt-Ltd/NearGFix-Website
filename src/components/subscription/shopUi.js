/**
 * Shop-dashboard styling helpers for the Subscription v2 screens
 * (/shop-home/settings/subscription/**) — same palette, radii and focus ring
 * as the rest of the shop dashboard.
 */

import { cx } from '@/components/site/ui';
import { FOCUS_RING } from '@/components/shop-dashboard/SearchField';

export { FOCUS_RING };

export const BTN_PRIMARY = cx(
  'inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#F3BF23] px-4 py-3 text-sm font-bold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-50',
  FOCUS_RING,
);
export const BTN_GREEN = cx(
  'inline-flex items-center justify-center gap-1.5 rounded-2xl bg-[#024A57] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#023A44] disabled:cursor-not-allowed disabled:opacity-50',
  FOCUS_RING,
);
export const BTN_SECONDARY = cx(
  'inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[#ECECEC] bg-white px-4 py-3 text-sm font-bold text-[#111111] transition hover:bg-[#F8F8F8] disabled:cursor-not-allowed disabled:opacity-50',
  FOCUS_RING,
);
export const BTN_LINK = cx('inline-flex items-center gap-1 text-sm font-bold text-[#024A57] hover:underline disabled:opacity-50', FOCUS_RING);

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={cx('w-full min-w-0 rounded-[24px] border border-[#ECECEC] bg-white p-5 sm:p-6', className)}>
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-extrabold text-[#111111]">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-sm text-[#666666]">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const PILL = {
  green: 'bg-[#E5F3F5] text-[#024A57]',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  gray: 'bg-[#F3F3F3] text-[#666666]',
};
const STATUS_PILL = {
  ACTIVE: 'green', ACTIVATED: 'green', CAPTURED: 'green', PAID: 'green', TRIAL: 'blue',
  CREATED: 'amber', AWAITING_PAYMENT: 'amber', PENDING: 'amber', AUTHORIZED: 'amber',
  EXPIRED: 'red', CANCELLED: 'red', FAILED: 'red', REFUNDED: 'gray', NONE: 'gray',
};

export function Pill({ status, tone, children }) {
  const key = String(status || '').toUpperCase();
  return (
    <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide', PILL[tone || STATUS_PILL[key] || 'gray'])}>
      {children ?? (key ? key.replace(/_/g, ' ') : '—')}
    </span>
  );
}

export function Row({ label, value, tone, strong }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <p className="min-w-0 flex-1 text-sm text-[#666666]">{label}</p>
      <div
        className={cx(
          'min-w-0 max-w-[65%] break-words text-right text-sm',
          strong ? 'text-base font-extrabold' : 'font-bold',
          tone === 'green' ? 'text-[#024A57]' : tone === 'red' ? 'text-red-600' : 'text-[#111111]',
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function Notice({ tone = 'amber', icon: Icon, children }) {
  const cls = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-700',
    green: 'border-[#C7E6EA] bg-[#E5F3F5] text-[#023A44]',
    gray: 'border-[#ECECEC] bg-[#F8F8F8] text-[#444444]',
  }[tone];
  return (
    <div role={tone === 'red' ? 'alert' : undefined} className={cx('flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm', cls)}>
      {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}

export function SkeletonCard({ lines = 4 }) {
  return (
    <div className="w-full rounded-[24px] border border-[#ECECEC] bg-white p-5 sm:p-6">
      <div className="h-4 w-1/3 animate-pulse rounded bg-[#F3F3F3]" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key -- static skeleton
          <div key={i} className="h-3 animate-pulse rounded bg-[#F3F3F3]" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

export const SUB_BASE = '/shop-home/settings/subscription';
export const checkoutHref = (params) => {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return `${SUB_BASE}/checkout/${s ? `?${s}` : ''}`;
};

/** Entitlement flag -> display label (labels for server booleans, not a plan feature list). */
export const ENTITLEMENT_LABELS = [
  ['serviceBookingEnabled', 'Service booking'],
  ['pickupEnabled', 'Pickup service'],
  ['whatsappEnabled', 'WhatsApp alerts'],
  ['smsEnabled', 'SMS alerts'],
  ['reportsEnabled', 'Reports'],
  ['exportEnabled', 'Export'],
  ['prioritySupportEnabled', 'Priority support'],
];
