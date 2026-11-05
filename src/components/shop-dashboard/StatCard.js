import Link from '@/components/PortalLink';
import { ArrowUpRight, TrendingUp } from 'lucide-react';

import { cx } from '@/components/site/ui';
import Icon3D from './Icon3D';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

/**
 * StatCard — a single KPI tile. `trend`, if given, is rendered as-is (e.g.
 * "+12% from yesterday") — purely presentational text supplied by the
 * caller, never computed here, so this component never invents a number.
 *
 * `featured` gives one card the deep-green filled treatment so the row has
 * a clear visual anchor instead of six equally-weighted tiles. `href`, when
 * given, makes the whole card a real link (to an existing sidebar route —
 * see shop-home/page.js) rather than a decorative arrow that goes nowhere.
 *
 * The icon badge routes through Icon3D (the shared soft-3D gradient badge —
 * see plan: noble-wiggling-deer) for every non-featured card; `featured`
 * keeps its own translucent white badge since a colored gradient would
 * clash with that card's own solid dark-green fill. Props unchanged from
 * before this pass — every existing call site (~10 pages) needs no edits.
 */
export default function StatCard({ icon: Icon, label, value, trend, tone = 'green', featured = false, href }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        {featured ? (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : (
          <Icon3D icon={Icon} tone={tone} size="md" />
        )}
        {href ? (
          <span
            className={cx(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition',
              featured ? 'bg-white/15 text-white group-hover:bg-white/25' : 'bg-[#F8F8F8] text-[#98A2B3] group-hover:bg-[#F8F8F8] group-hover:text-[#024A57]',
            )}
          >
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <p className={cx('mt-4 text-[26px] font-bold leading-none tracking-tight sm:text-[28px]', featured ? 'text-white' : 'text-[#111111]')}>
        {value}
      </p>
      <p className={cx('mt-1.5 text-sm font-medium', featured ? 'text-white/75' : 'text-[#666666]')}>{label}</p>

      {trend ? (
        <p className={cx('mt-2.5 flex items-center gap-1 text-xs font-semibold', featured ? 'text-white/90' : 'text-[#024A57]')}>
          <TrendingUp className="h-3 w-3 shrink-0" aria-hidden="true" />
          {trend}
        </p>
      ) : null}
    </>
  );

  const className = cx(
    'group block rounded-3xl p-5 transition',
    featured
      ? 'bg-gradient-to-br from-[#023A44] to-[#023A44]'
      : 'border border-[#ECECEC] bg-[#F8F8F8]',
    href && !featured && 'hover:-translate-y-0.5 hover:border-[#ECECEC]',
    href && FOCUS_RING,
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
