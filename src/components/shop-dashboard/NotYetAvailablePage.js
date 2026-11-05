/**
 * NotYetAvailablePage — an honest, properly-designed page for a sidebar
 * destination whose backend simply doesn't exist yet (no field, no status,
 * no endpoint anywhere in this codebase) — as opposed to the generic
 * ComingSoon stub every unbuilt nav item falls back to. This renders the
 * real page chrome (header, stat cards, filter chips) so the shape is
 * future-ready, but every value is an honest "—", and filters are inert,
 * because there is genuinely nothing behind them yet.
 *
 * Do not reach for this component to paper over a page that DOES have real
 * data available — check first. It exists only for a confirmed, total gap.
 */

import PageHeader from './PageHeader';
import StatCard from './StatCard';
import FilterChips from './FilterChips';
import EmptyState from './EmptyState';

export default function NotYetAvailablePage({ title, subtitle, icon: Icon, statLabels = [], filters = [], explanation }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} subtitle={subtitle} />

      {statLabels.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statLabels.map((label) => (
            <StatCard key={label} icon={Icon} label={label} value="—" tone="green" />
          ))}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]">
        {filters.length ? (
          <div className="border-b border-[#ECECEC] px-4 py-4 opacity-60 sm:px-5">
            <FilterChips options={filters} value={filters[0]} onChange={() => {}} />
          </div>
        ) : null}

        <EmptyState icon={Icon} tone="muted" title="Not available yet" description={explanation} />
      </section>
    </div>
  );
}
