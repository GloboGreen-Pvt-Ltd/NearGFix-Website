'use client';

/**
 * Everything below the hero on the repair device page (/repair/?…&model=…):
 * the Apple-style long-form part of the product page.
 *
 * Real data today: repairs available for this device type (master data),
 * specifications built from the model's real fields, the support strip and
 * service links (true platform facts), more models from the same series, and
 * the category FAQ. Highlights, feature rows, what's in the box, extra spec rows
 * and the comparison read optional fields described in src/lib/productDetails.js
 * and render nothing until the API sends them.
 *
 * No price, stock, EMI, delivery date or warranty here: this is the repair
 * flow — the shop quotes the repair after seeing the device.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  ChevronRight,
  MapPin,
  Package,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Wrench,
} from 'lucide-react';

import SeoFaqList from '@/components/site/SeoFaqList';
import { cx } from '@/components/site/ui';
import { masterApi } from '@/lib/api';
import { REPAIR_CATEGORY_CONTENT } from '@/lib/repairSeoContent';
import { featuresOf, highlightsOf, inTheBoxOf, specsOf } from '@/lib/productDetails';

const INK = 'text-[#111111]';
const MUTED = 'text-[#6B7280]';
const H2 = cx('text-3xl font-semibold tracking-tight sm:text-4xl', INK);

const unwrapList = (d) => (Array.isArray(d) ? d : d?.content || d?.data || []);

/** One page section: generous Apple-style spacing, optional soft-grey band. */
function Block({ tone = 'white', id, children, className }) {
  return (
    <section
      id={id}
      className={cx(
        'scroll-mt-28',
        tone === 'grey' ? 'rounded-[28px] bg-[#F5F5F7] px-5 py-14 sm:px-10 sm:py-16 lg:px-14 lg:py-20' : 'py-14 sm:py-16 lg:py-20',
        className,
      )}
    >
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Highlights (data-gated)                                                     */
/* -------------------------------------------------------------------------- */

function Highlights({ items }) {
  if (!items.length) return null;
  return (
    <Block>
      <h2 className={H2}>Highlights</h2>
      <ul role="list" className="mt-10 grid list-none gap-x-8 gap-y-10 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((h) => (
          <li key={h.title} className="flex gap-4">
            <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" aria-hidden="true" />
            <div>
              <p className={cx('text-lg font-semibold', INK)}>{h.title}</p>
              {h.description ? <p className={cx('mt-1 text-[15px] leading-relaxed', MUTED)}>{h.description}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/* Repairs available (real master data)                                        */
/* -------------------------------------------------------------------------- */

function RepairsAvailable({ deviceCategoryId, label, serviceHref }) {
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      masterApi.get('/master/repair-categories').then(unwrapList).catch(() => []),
      masterApi.get('/master/repair-services').then(unwrapList).catch(() => []),
    ]).then(([cats, services]) => {
      if (!alive) return;
      setGroups(
        cats
          .filter((c) => c && c.isActive !== false && (!deviceCategoryId || c.deviceCategoryId === deviceCategoryId))
          .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
          .map((c) => ({
            id: c.id,
            name: c.displayName || c.name,
            services: services.filter((s) => s && s.isActive !== false && s.categoryId === c.id).map((s) => s.name).filter(Boolean),
          }))
          .filter((g) => g.services.length),
      );
    });
    return () => { alive = false; };
  }, [deviceCategoryId]);

  if (!groups || !groups.length) return null;
  const total = groups.reduce((n, g) => n + g.services.length, 0);

  return (
    <Block tone="grey" id="repairs">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-700">Repairs</p>
          <h2 className={cx(H2, 'mt-2')}>What we can fix on your {label}</h2>
          <p className={cx('mt-3 max-w-2xl text-base leading-relaxed sm:text-[17px]', MUTED)}>
            {total} repairs across {groups.length} areas. Which ones a shop offers, and its price, vary from shop to shop —
            you approve the quote before work starts.
          </p>
        </div>
        <Link
          href={serviceHref}
          scroll={false}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full text-base font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:self-auto"
        >
          Choose a repair <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <ul role="list" className="mt-10 grid list-none gap-x-10 gap-y-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <li key={g.id}>
            <p className={cx('text-base font-semibold', INK)}>{g.name}</p>
            <p className={cx('mt-1.5 text-sm leading-relaxed', MUTED)}>
              {g.services.slice(0, 4).join(' · ')}
              {g.services.length > 4 ? ` · +${g.services.length - 4} more` : ''}
            </p>
          </li>
        ))}
      </ul>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/* Feature rows (data-gated)                                                   */
/* -------------------------------------------------------------------------- */

function Features({ items, modelName }) {
  if (!items.length) return null;
  return (
    <Block>
      <div className="space-y-20 lg:space-y-28">
        {items.map((f, i) => (
          <div key={f.title} className="grid items-center gap-10 md:grid-cols-2 lg:gap-16">
            <div className={cx(i % 2 === 1 && 'md:order-2')}>
              {f.eyebrow ? <p className="text-sm font-semibold text-brand-700">{f.eyebrow}</p> : null}
              <h2 className={cx(H2, 'mt-2')}>{f.title}</h2>
              <p className={cx('mt-4 max-w-prose text-base leading-relaxed sm:text-[17px]', MUTED)}>{f.body}</p>
            </div>
            {f.imageUrl ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[#F5F5F7]">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote master-data media, static export. */}
                <img src={f.imageUrl} alt={`${modelName}: ${f.title}`} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-contain p-6" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/* Specifications (real fields + optional extra rows)                          */
/* -------------------------------------------------------------------------- */

function Specifications({ rows }) {
  if (!rows.length) return null;
  return (
    <Block id="specs">
      <h2 className={H2}>Specifications</h2>
      <dl className="mt-10 divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
        {rows.map((r) => (
          <div key={`${r.group || ''}-${r.label}`} className="grid gap-1 py-5 sm:grid-cols-[minmax(0,16rem)_1fr] sm:gap-8">
            <dt className={cx('text-[15px] font-semibold', INK)}>{r.label}</dt>
            <dd className={cx('break-words text-[15px] leading-relaxed', MUTED)}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/* What's in the box (data-gated)                                              */
/* -------------------------------------------------------------------------- */

function InTheBox({ items }) {
  if (!items.length) return null;
  return (
    <Block>
      <h2 className={H2}>What&apos;s in the box</h2>
      <ul role="list" className="mt-8 flex list-none flex-wrap gap-x-10 gap-y-4 p-0">
        {items.map((x) => (
          <li key={x} className={cx('flex items-center gap-2.5 text-base', INK)}>
            <Package className="h-5 w-5 text-[#6B7280]" aria-hidden="true" />
            {x}
          </li>
        ))}
      </ul>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/* Support strip (true platform facts — no warranty claims)                    */
/* -------------------------------------------------------------------------- */

const SUPPORT = [
  { icon: Store, title: 'Verified shops near you', text: 'NearGFix partner shops within 20 km.' },
  { icon: BadgeCheck, title: 'Approve the price first', text: 'No work starts until you accept the quote.' },
  { icon: Truck, title: 'Doorstep pickup', text: 'From shops that offer pickup and delivery.' },
  { icon: BellRing, title: 'Live tracking', text: 'Every stage, plus your receipt and invoice.' },
];

function SupportStrip() {
  return (
    <Block className="border-y border-[#E5E7EB]">
      <ul role="list" className="grid list-none gap-8 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {SUPPORT.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3.5">
            <Icon className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" aria-hidden="true" />
            <div>
              <p className={cx('text-base font-semibold', INK)}>{title}</p>
              <p className={cx('mt-1 text-sm leading-relaxed', MUTED)}>{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/* Repair / Sell / Buy ecosystem                                               */
/* -------------------------------------------------------------------------- */

function Ecosystem({ serviceHref, deviceNoun }) {
  const items = [
    { icon: Wrench, q: `Need your ${deviceNoun} repaired?`, cta: 'Book a repair', href: serviceHref, scroll: false },
    { icon: ShoppingBag, q: 'Want to sell your old device?', cta: 'Sell your device', href: '/sell' },
    { icon: Package, q: 'Looking for another device?', cta: 'Buy refurbished', href: '/buy' },
    { icon: MapPin, q: 'Prefer to walk in?', cta: 'Find a shop near you', href: '/nearby-shops' },
  ];
  return (
    <Block>
      <h2 className={H2}>More from NearGFix</h2>
      <ul role="list" className="mt-10 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, q, cta, href, scroll }) => (
          <li key={cta}>
            <Link
              href={href}
              scroll={scroll}
              className="group flex h-full flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 transition hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
            >
              <Icon className="h-6 w-6 text-brand-600" aria-hidden="true" />
              <p className={cx('mt-4 text-[15px]', MUTED)}>{q}</p>
              <p className={cx('mt-1 inline-flex items-center gap-1 text-base font-semibold', INK)}>
                {cta}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/* Related models (real: same series)                                          */
/* -------------------------------------------------------------------------- */

function RelatedModels({ models, seriesName, modelHref, imageOf }) {
  if (!models.length) return null;
  return (
    <Block>
      <h2 className={H2}>{seriesName ? `More from ${seriesName}` : 'You may also like'}</h2>
      {/* Swipe row on phones, 4-up grid from lg. */}
      <ul
        role="list"
        className="-mx-4 mt-10 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden"
      >
        {models.map((m) => {
          const img = imageOf(m);
          const colours = Array.isArray(m.colors) ? m.colors.length : 0;
          const storage = Array.isArray(m.ramStorage) ? m.ramStorage : [];
          return (
            <li key={m.id} className="w-[72%] shrink-0 snap-start sm:w-auto">
              <div className="flex h-full flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5">
                <div className="flex aspect-square items-center justify-center rounded-xl bg-[#F5F5F7]">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote master-data media, static export.
                    <img src={img} alt={m.name} loading="lazy" decoding="async" className="h-4/5 w-4/5 object-contain" />
                  ) : (
                    <Package className="h-10 w-10 text-[#9CA3AF]" aria-hidden="true" />
                  )}
                </div>
                <p className={cx('mt-4 line-clamp-2 text-base font-semibold', INK)}>{m.name}</p>
                <p className={cx('mt-1 text-sm', MUTED)}>
                  {[storage.length ? `${storage[0]}${storage.length > 1 ? ` – ${storage[storage.length - 1]}` : ''}` : null, colours ? `${colours} colour${colours === 1 ? '' : 's'}` : null]
                    .filter(Boolean)
                    .join(' · ') || ' '}
                </p>
                <Link
                  href={modelHref(m)}
                  scroll={false}
                  className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
                >
                  View model <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/* Compare (data-gated: needs specs on this model and at least one sibling)    */
/* -------------------------------------------------------------------------- */

function Compare({ model, siblings }) {
  const own = specsOf(model);
  const others = siblings.filter((m) => specsOf(m).length).slice(0, 3);
  if (!own.length || !others.length) return null;
  const columns = [model, ...others];
  const labels = own.map((r) => r.label).slice(0, 8);
  const valueOf = (m, label) => specsOf(m).find((r) => r.label === label)?.value || '—';
  return (
    <Block>
      <h2 className={H2}>Compare with similar models</h2>
      <div className="-mx-4 mt-10 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[36rem] border-collapse text-left text-[15px]">
          <thead>
            <tr>
              <th className="w-40 py-3" />
              {columns.map((m) => (
                <th key={m.id} scope="col" className={cx('py-3 pr-4 font-semibold', INK)}>{m.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
            {labels.map((label) => (
              <tr key={label}>
                <th scope="row" className={cx('py-4 pr-4 font-semibold', INK)}>{label}</th>
                {columns.map((m) => (
                  <td key={m.id} className={cx('py-4 pr-4', MUTED)}>{valueOf(m, label)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function RepairDeviceSections({
  model,
  modelName,
  brandName,
  categoryName,
  categoryCode,
  deviceCategoryId,
  seriesName,
  siblings = [],
  colors = [],
  storage = [],
  serviceHref,
  modelHref,
  imageOf,
}) {
  const content = REPAIR_CATEGORY_CONTENT[String(categoryCode || '').toUpperCase()] || null;
  const deviceNoun = content?.deviceNoun || 'device';
  const related = useMemo(
    () => siblings.filter((m) => m?.id && m.id !== model?.id && m.seriesId && m.seriesId === model?.seriesId).slice(0, 8),
    [siblings, model],
  );

  // Specifications: real model fields first, then any extra rows the API sends.
  const modelNumbers = Array.isArray(model?.modelNumber) ? model.modelNumber.filter(Boolean) : [];
  const specRows = [
    brandName ? { label: 'Brand', value: brandName } : null,
    modelName ? { label: 'Model', value: modelName } : null,
    seriesName ? { label: 'Series', value: seriesName } : null,
    categoryName ? { label: 'Category', value: categoryName } : null,
    modelNumbers.length ? { label: modelNumbers.length > 1 ? 'Model numbers' : 'Model number', value: modelNumbers.join(', ') } : null,
    colors.length ? { label: 'Colours', value: colors.join(' / ') } : null,
    storage.length ? { label: storage.some((s) => s.includes('+')) ? 'RAM & Storage' : 'Storage', value: storage.join(' / ') } : null,
    ...specsOf(model),
  ].filter(Boolean);

  return (
    <div className="mt-16 sm:mt-20">
      <Highlights items={highlightsOf(model)} />
      <RepairsAvailable deviceCategoryId={deviceCategoryId} label={deviceNoun} serviceHref={serviceHref} />
      <Features items={featuresOf(model)} modelName={modelName} />
      <Specifications rows={specRows} />
      <InTheBox items={inTheBoxOf(model)} />
      <SupportStrip />
      <Ecosystem serviceHref={serviceHref} deviceNoun={deviceNoun} />
      <RelatedModels models={related} seriesName={seriesName} modelHref={modelHref} imageOf={imageOf} />
      <Compare model={model} siblings={related} />
      {content?.faqs?.length ? (
        <Block>
          <h2 className={H2}>{content.label} repair questions</h2>
          {/* No FAQPage schema: this is a ?query view of /repair/, whose own
              canonical page carries the structured data. */}
          <SeoFaqList faqs={content.faqs} withSchema={false} />
        </Block>
      ) : null}

      {/* Phones: keep Continue in reach while scrolling the long page. The spacer
          stops the bar covering the last section. */}
      <div className="h-20 md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E7EB] bg-white/95 px-4 pt-3 backdrop-blur pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="flex items-center gap-3">
          <p className={cx('min-w-0 flex-1 truncate text-sm font-semibold', INK)}>{modelName}</p>
          <Link
            href={serviceHref}
            scroll={false}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
          >
            Continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

