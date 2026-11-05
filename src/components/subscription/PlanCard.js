/**
 * PlanCard — the ONE shop-facing plan card (Subscription v2). Used by the
 * shop's Available Plans list, the checkout plan step and the management
 * plan editor's "Preview Shop View", so admins see exactly what shops see.
 * Everything comes from the Plan JSON (price in paise, server-built
 * `features` lines) — no hardcoded prices or feature lists.
 */

import { Check, Crown, Gem, Gift, Sparkles, Star, Zap } from 'lucide-react';

import { formatPaise } from '@/lib/subscriptionFormat';

const ICONS = { crown: Crown, gem: Gem, gift: Gift, sparkles: Sparkles, star: Star, zap: Zap };
const TYPE_ICONS = { TRIAL: Gift, BASIC: Crown, PREMIUM: Gem };

const BADGES = {
  CURRENT: { label: 'Current Plan', cls: 'bg-[#024A57] text-white' },
  AVAILABLE: { label: 'Available', cls: 'bg-[#F3F3F3] text-[#024A57]' },
  COMING_SOON: { label: 'Coming Soon', cls: 'bg-amber-100 text-amber-800' },
  EXPIRED: { label: 'Expired', cls: 'bg-red-50 text-red-700' },
  INACTIVE: { label: 'Inactive', cls: 'bg-slate-100 text-slate-600' },
};

const safeColor = (c) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.trim()) ? c.trim() : '#024A57');

export function planIcon(plan) {
  const key = String(plan?.icon || '').trim().toLowerCase();
  return ICONS[key] || TYPE_ICONS[String(plan?.planType || '').toUpperCase()] || Crown;
}

export default function PlanCard({ plan, badge, selected = false, action, footnote }) {
  if (!plan) return null;
  const Icon = planIcon(plan);
  const color = safeColor(plan.color);
  const free = Number(plan.pricePaise) === 0;
  const pct = Number(plan.additionalShopDiscountPct) || 0;
  const features = Array.isArray(plan.features) ? plan.features : [];
  const b = badge ? BADGES[badge] : null;

  return (
    <div
      className={`flex h-full w-full flex-col rounded-[24px] bg-white p-5 transition ${
        selected ? 'border-2 shadow-[0_8px_24px_rgba(16,24,40,0.08)]' : 'border border-[#ECECEC]'
      }`}
      style={selected ? { borderColor: color } : undefined}
    >
      <div className="flex items-start gap-3.5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="break-words text-[1.05rem] font-extrabold leading-snug text-[#111111]">{plan.name || plan.code}</p>
            {plan.durationLabel ? (
              <span className="rounded-full bg-[#F3F3F3] px-2 py-0.5 text-[0.68rem] font-bold text-[#444444]">{plan.durationLabel}</span>
            ) : null}
          </div>
          {b ? (
            <span className={`mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide ${b.cls}`}>{b.label}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        {free ? (
          <p className="text-2xl font-extrabold text-[#111111]">
            Free{plan.durationLabel ? <span className="text-sm font-semibold text-[#666666]"> · {plan.durationLabel}</span> : null}
          </p>
        ) : (
          <>
            <p className="break-words text-2xl font-extrabold text-[#111111]">{formatPaise(plan.pricePaise)}</p>
            <p className="text-xs text-[#666666]">per shop{plan.durationLabel ? ` · ${plan.durationLabel}` : ''}</p>
          </>
        )}
        {!free && pct > 0 ? (
          <p className="mt-1.5 inline-flex rounded-lg bg-[#E5F3F5] px-2 py-1 text-xs font-semibold text-[#024A57]">
            {pct}% off each additional shop
          </p>
        ) : null}
        {plan.description ? <p className="mt-2 text-sm text-[#666666]">{plan.description}</p> : null}
      </div>

      {features.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {features.map((f, i) => (
            // eslint-disable-next-line react/no-array-index-key -- server display lines have no id
            <li key={i} className="flex items-start gap-2.5 text-sm text-[#111111]">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5]" style={{ color }}>
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
              </span>
              <span className="min-w-0 break-words">{f}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {footnote ? <p className="mt-3 text-xs text-[#98A2B3]">{footnote}</p> : null}
      {action ? <div className="mt-auto pt-5">{action}</div> : null}
    </div>
  );
}
