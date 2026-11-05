'use client';

import { useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { FAQS } from '@/lib/siteContent';

/* -------------------------------------------------------------------------- */
/* Local grouping                                                              */
/* -------------------------------------------------------------------------- */

/**
 * siteContent.js tags every FAQ with one of two audiences ('For customers' /
 * 'For shop owners'). The two extra topic filters below are derived here rather
 * than in siteContent.js — a question can legitimately sit in an audience AND a
 * topic (e.g. "What does the paid plan cost?" is both a shop-owner question and
 * a pricing one), so these are additive, not a re-partition.
 */
const PRICING_RE = /cost|price|charg|refund|trial|limits|quote|\bpay\b|\bplan\b/i;
const SECURITY_RE = /sign in|secure|security|login|lock|password|kyc|data separate|past orders/i;

const FILTERS = [
  { key: 'all', label: 'All', match: () => true },
  {
    key: 'customers',
    label: 'For customers',
    match: (faq) => faq.category === 'For customers',
  },
  {
    key: 'shops',
    label: 'For shop owners',
    match: (faq) => faq.category === 'For shop owners',
  },
  {
    key: 'pricing',
    label: 'Pricing & billing',
    match: (faq) => PRICING_RE.test(faq.question),
  },
  {
    key: 'security',
    label: 'Account & security',
    match: (faq) => SECURITY_RE.test(faq.question),
  },
];

/** Stable ids, assigned once from the source order so filtering cannot shift them. */
const ITEMS = FAQS.map((faq, index) => ({
  ...faq,
  id: `faq-${index}`,
  haystack: `${faq.question} ${faq.answer}`.toLowerCase(),
}));

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function FaqAccordion() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const listRef = useRef(null);

  const trimmed = query.trim().toLowerCase();

  /* Search first, so the chip counts describe what the search actually left. */
  const searched = useMemo(
    () => (trimmed ? ITEMS.filter((item) => item.haystack.includes(trimmed)) : ITEMS),
    [trimmed]
  );

  const counts = useMemo(() => {
    const next = {};
    FILTERS.forEach((filter) => {
      next[filter.key] = searched.filter(filter.match).length;
    });
    return next;
  }, [searched]);

  const activeMatch = (FILTERS.find((f) => f.key === activeFilter) || FILTERS[0]).match;
  const visible = searched.filter(activeMatch);

  function reset() {
    setQuery('');
    setActiveFilter('all');
    setOpenId(null);
  }

  /* Roving focus between the disclosure triggers — Arrow keys, Home and End. */
  function handleKeyDown(event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const triggers = Array.from(listRef.current?.querySelectorAll('[data-faq-trigger]') || []);
    const current = triggers.indexOf(document.activeElement);
    if (current === -1 || triggers.length === 0) return;

    event.preventDefault();
    let next = current;
    if (event.key === 'ArrowDown') next = (current + 1) % triggers.length;
    if (event.key === 'ArrowUp') next = (current - 1 + triggers.length) % triggers.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = triggers.length - 1;
    triggers[next].focus();
  }

  return (
    <div className="mt-10">
      {/* Search ---------------------------------------------------------- */}
      <div className="mx-auto max-w-2xl">
        <label htmlFor="faq-search" className="sr-only">
          Search the frequently asked questions
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-muted"
            aria-hidden="true"
          />
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search — pickup, KYC, refund, IMEI…"
            className="w-full rounded-full border border-brand-line bg-white py-3.5 pl-12 pr-12 text-base text-brand-ink shadow-soft outline-none transition placeholder:text-brand-muted focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-brand-muted transition hover:bg-brand-soften hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Filter chips ----------------------------------------------------- */}
      <div
        role="group"
        aria-label="Filter questions by topic"
        className="mt-6 flex flex-wrap justify-center gap-2 sm:gap-3"
      >
        {FILTERS.map((filter) => {
          const isActive = filter.key === activeFilter;
          const count = counts[filter.key];
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              aria-pressed={isActive}
              disabled={count === 0 && !isActive}
              className={cx(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-40',
                isActive
                  ? 'border-brand-600 bg-brand-600 text-white shadow-soft'
                  : 'border-brand-line bg-white text-brand-ink hover:border-brand-300 hover:bg-brand-50'
              )}
            >
              {filter.label}
              <span
                className={cx(
                  'rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums',
                  isActive ? 'bg-white/20 text-white' : 'bg-brand-soften text-brand-muted'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Result count ----------------------------------------------------- */}
      <p className="mt-6 text-center text-sm text-brand-muted" aria-live="polite">
        {visible.length === 0
          ? 'No questions match that yet.'
          : `Showing ${visible.length} of ${ITEMS.length} questions.`}
      </p>

      {/* Accordion --------------------------------------------------------- */}
      {visible.length > 0 ? (
        <div
          ref={listRef}
          onKeyDown={handleKeyDown}
          className="mx-auto mt-8 max-w-3xl divide-y divide-brand-line overflow-hidden rounded-3xl border border-brand-line bg-white shadow-soft"
        >
          {visible.map((item) => {
            const isOpen = openId === item.id;
            const panelId = `${item.id}-panel`;
            const buttonId = `${item.id}-trigger`;
            return (
              <div key={item.id}>
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    data-faq-trigger=""
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="flex w-full items-start gap-4 px-5 py-5 text-left transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700 sm:px-7 sm:py-6"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold leading-snug text-brand-ink sm:text-lg">
                        {item.question}
                      </span>
                      <span className="mt-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-600">
                        {item.category}
                      </span>
                    </span>
                    <span
                      className={cx(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition motion-reduce:transition-none',
                        isOpen
                          ? 'rotate-180 bg-brand-600 text-white'
                          : 'bg-brand-soften text-brand-muted'
                      )}
                      aria-hidden="true"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={cx(
                    'grid transition-all duration-300 ease-out motion-reduce:transition-none',
                    isOpen
                      ? 'visible grid-rows-[1fr] opacity-100'
                      : 'invisible grid-rows-[0fr] opacity-0'
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <p className="px-5 pb-6 pr-12 text-sm leading-relaxed text-brand-muted sm:px-7 sm:pb-7 sm:text-base">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mx-auto mt-8 max-w-2xl rounded-3xl border border-brand-line bg-white p-8 text-center shadow-soft sm:p-10">
          <p className="text-lg font-bold text-brand-ink">Nothing matched that search.</p>
          <p className="mx-auto mt-3 max-w-prose text-sm leading-relaxed text-brand-muted sm:text-base">
            Try a shorter word — “pickup”, “KYC”, “invoice” or “trial” — or clear the filters and
            browse the full list. Our team is happy to answer it directly either way.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
          >
            Show all questions
          </button>
        </div>
      )}
    </div>
  );
}
