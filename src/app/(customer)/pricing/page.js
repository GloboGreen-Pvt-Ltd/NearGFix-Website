import Link from '@/components/PortalLink';
import {
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  Handshake,
  Headset,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CheckList,
  CTABand,
  Section,
  SectionHeading,
  StatTile,
  cx,
} from '@/components/site/ui';

import {
  BRAND,
  CTA,
  FAQS,
  MULTI_SHOP_PRICING,
  PLAN_COMPARISON,
  PLANS,
  PRICING_NOTE,
} from '@/lib/siteContent';
import { pageMetadata } from '@/lib/seo';

import LivePlans from './LivePlans';

export const metadata = pageMetadata({
  title: 'Repair Shop Software Pricing – Free Trial',
  description:
    'NearGFix pricing for repair shops: a 15-day free trial, then ₹3,000 a year for one shop and ₹2,500 a year for each extra shop. Customers use the app free.',
  path: '/pricing',
});

const freeTrial = PLANS.find((plan) => plan.key === 'free-trial');
const basic = PLANS.find((plan) => plan.key === 'basic');

/* -------------------------------------------------------------------------- */
/* Local data                                                                  */
/* -------------------------------------------------------------------------- */

const HEADLINE_FACTS = [
  {
    value: '15',
    unit: 'days',
    label: 'Free trial, auto-granted the moment you register',
    tone: 'brand',
  },
  {
    value: '₹3,000',
    label: 'Per year for your first shop, on the Basic plan',
    tone: 'accent',
  },
  {
    value: '₹2,500',
    label: 'Per shop per year from your second shop onwards',
    tone: 'brand',
  },
];

const BILLING_POINTS = [
  {
    icon: Handshake,
    title: 'A person sets it up, not a checkout page',
    description:
      'Tell us how many shops you run. We activate the Basic plan on your account and confirm the dates back to you — nothing to click, no card to add.',
  },
  {
    icon: CalendarClock,
    title: 'The trial starts itself',
    description:
      'Registering a shop grants the 15-day Free Trial automatically. You do not have to ask for it, and you do not have to enter payment details to use it.',
  },
  {
    icon: ShieldCheck,
    title: 'No card details on the platform',
    description:
      'Because there is no online payment gateway yet, NearGFix never asks you for card or bank details inside the apps. Treat anyone who does as a red flag.',
  },
];

/** Pull a verbatim FAQ answer by its exact question; null if it is not there. */
function findFaq(question) {
  return FAQS.find((faq) => faq.question === question) || null;
}

const PRICING_FAQS = [
  findFaq('How long is the free trial and what does it cost?'),
  findFaq('What are the limits during the free trial?'),
  {
    question: 'What happens when the 15 days are up?',
    answer:
      'The Free Trial simply reaches the end of its 15 days. Before it does, talk to our team and we will move your shop on to the Basic plan — that is what unlocks unlimited shops, unlimited employees, unlimited Sell orders and the doorstep Pickup Service.',
  },
  findFaq('What does the paid plan cost?'),
  findFaq('How do I pay? Is there online checkout?'),
  {
    question: 'Do my customers pay anything to use NearGFix?',
    answer:
      'No. The NearGFix customer app is free to use — booking a repair, requesting a doorstep pickup, collecting Sell quotations from nearby shops and browsing the Buy tab all cost the customer nothing. The only money a customer parts with is the repair price they approve with the shop, and the only money they receive is the Sell quotation they accept. The plan on this page is paid by the shop.',
  },
].filter(Boolean);

/* -------------------------------------------------------------------------- */
/* Local pieces                                                                */
/* -------------------------------------------------------------------------- */

function PlanCard({ plan, recommended = false }) {
  const items = [
    ...plan.bullets,
    ...plan.excluded.map((label) => ({ label, excluded: true })),
  ];

  return (
    <Card
      padded={false}
      hover={false}
      className={cx(
        'flex h-full flex-col overflow-hidden',
        recommended && 'border-brand-600 shadow-lift ring-1 ring-brand-600'
      )}
    >
      {recommended ? (
        <p className="bg-brand-600 px-6 py-2 text-center text-xs font-bold uppercase tracking-widest text-white sm:px-8">
          Recommended
        </p>
      ) : (
        <p className="bg-brand-soften px-6 py-2 text-center text-xs font-bold uppercase tracking-widest text-brand-muted sm:px-8">
          Start here
        </p>
      )}

      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <h3 className="text-2xl font-bold tracking-tight text-brand-ink">{plan.name}</h3>

        <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1">
          <span
            className={cx(
              'text-4xl font-extrabold tracking-tight sm:text-5xl',
              recommended ? 'text-brand-700' : 'text-brand-ink'
            )}
          >
            {plan.price}
          </span>
          <span className="pb-1 text-sm font-medium text-brand-muted sm:text-base">
            {plan.priceNote}
          </span>
        </div>

        {plan.secondaryPrice ? (
          <p className="mt-3 inline-flex rounded-xl bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-700">
            {plan.secondaryPrice}
          </p>
        ) : null}

        <p className="mt-4 text-sm leading-relaxed text-brand-muted sm:text-base">{plan.summary}</p>

        <div className="mt-6 border-t border-brand-line pt-6">
          <h4 className="text-xs font-bold uppercase tracking-widest text-brand-muted">
            What is included
          </h4>
          <CheckList className="mt-4" items={items} />
        </div>

        <div className="mt-6 rounded-2xl bg-brand-page p-4 sm:p-5">
          <h4 className="text-xs font-bold uppercase tracking-widest text-brand-muted">
            The actual limits
          </h4>
          <dl className="mt-3 space-y-2">
            {plan.limits.map((limit) => (
              <div
                key={limit.label}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm"
              >
                <dt className="text-brand-muted">{limit.label}</dt>
                <dd className="font-semibold text-brand-ink">{limit.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-8 flex flex-col gap-3 pt-0 sm:mt-auto sm:pt-8">
          <Button
            href={CTA.startTrial.href}
            variant={recommended ? 'primary' : 'outline'}
            size="lg"
            icon="ArrowRight"
            className="w-full"
          >
            {CTA.startTrial.label}
          </Button>
          <p className="text-center text-xs leading-relaxed text-brand-muted">
            {recommended
              ? 'Every shop begins on the 15-day trial. Tell us when you are ready and we switch you to Basic.'
              : 'Granted automatically at registration. No card required.'}
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Renders a PLAN_COMPARISON cell: boolean becomes a tick or a cross. */
function ComparisonCell({ value, plan }) {
  if (value === true) {
    return (
      <>
        <Check className="mx-auto h-5 w-5 text-brand-600" aria-hidden="true" />
        <span className="sr-only">{`Included on ${plan}`}</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <X className="mx-auto h-5 w-5 text-brand-subtle" aria-hidden="true" />
        <span className="sr-only">{`Not included on ${plan}`}</span>
      </>
    );
  }
  return <span className="font-semibold text-brand-ink">{value}</span>;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function PricingPage() {
  return (
    <>
      {/* 1 — Header ------------------------------------------------------- */}
      <Section tone="soft">
        <SectionHeading
          as="h1"
          eyebrow="Pricing"
          title={
            <>
              One plan, priced per shop.{' '}
              <span className="text-brand-700">Fifteen days free first.</span>
            </>
          }
          subtitle="There is no pricing maze here. Register a shop and the 15-day Free Trial starts on its own. When you are ready for unlimited shops, unlimited staff, unlimited Sell orders and doorstep pickup, the Basic plan is ₹3,000 a year — and it gets cheaper per shop the more shops you run."
        />

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button href={CTA.startTrial.href} size="lg" icon="ArrowRight">
            {CTA.startTrial.label}
          </Button>
          <Button href={CTA.talkToSales.href} variant="outline" size="lg">
            {CTA.talkToSales.label}
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-brand-muted">
          No card required · No online checkout · Customers use the NearGFix app free
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {HEADLINE_FACTS.map((fact) => (
            <StatTile
              key={fact.label}
              value={fact.value}
              unit={fact.unit}
              label={fact.label}
              tone={fact.tone}
            />
          ))}
        </div>
      </Section>

      {/* 2 — The two plans ------------------------------------------------ */}
      <Section id="plans" tone="page">
        <SectionHeading
          eyebrow="Plans"
          title="Two ways in, and you are already on the first one"
          subtitle="The Free Trial is what every new shop owner lands on. Basic is the same product with the ceilings taken off and the doorstep Pickup Service switched on."
        />

        <LivePlans>
          <div className="mx-auto mt-12 grid max-w-5xl items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
            {freeTrial ? <PlanCard plan={freeTrial} /> : null}
            {basic ? <PlanCard plan={basic} recommended /> : null}
          </div>
        </LivePlans>

        <p className="mx-auto mt-8 max-w-prose text-center text-sm leading-relaxed text-brand-muted">
          {PRICING_NOTE}
        </p>
      </Section>

      {/* 3 — Multi-shop table --------------------------------------------- */}
      <Section id="multi-shop" tone="white">
        <SectionHeading
          eyebrow="More than one shop"
          title="The rate drops from your second shop"
          subtitle="Your first shop is ₹3,000 a year. Every shop after that is ₹2,500 a year instead — the same product, the same unlimited staff and bookings, with multi-shop switching built into the owner app."
        />

        <div className="mx-auto mt-12 max-w-3xl">
          {/* Stacked cards below sm so nothing overflows at 360px */}
          <ul className="space-y-3 sm:hidden">
            {MULTI_SHOP_PRICING.map((row) => (
              <li
                key={row.shops}
                className="flex items-center justify-between gap-4 rounded-2xl border border-brand-line bg-white p-4 shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-700">
                    <Store className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">{row.label}</p>
                    <p className="text-xs text-brand-muted">
                      {row.shops === 1 ? '₹3,000 per shop' : '₹2,500 per shop'}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-extrabold tracking-tight text-brand-700">{row.price}</p>
              </li>
            ))}
          </ul>

          {/* Real table from sm upwards */}
          <div className="hidden overflow-x-auto rounded-3xl border border-brand-line bg-white shadow-soft sm:block">
            <table className="w-full min-w-[28rem] border-collapse text-left">
              <caption className="sr-only">
                NearGFix Basic plan yearly price by number of shops
              </caption>
              <thead>
                <tr className="border-b border-brand-line bg-brand-page">
                  <th
                    scope="col"
                    className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-brand-muted"
                  >
                    Shops
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-brand-muted"
                  >
                    Rate per shop
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-right text-xs font-bold uppercase tracking-widest text-brand-muted"
                  >
                    Total per year
                  </th>
                </tr>
              </thead>
              <tbody>
                {MULTI_SHOP_PRICING.map((row) => (
                  <tr key={row.shops} className="border-b border-brand-line last:border-0">
                    <th
                      scope="row"
                      className="px-5 py-4 text-sm font-semibold text-brand-ink sm:text-base"
                    >
                      <span className="inline-flex items-center gap-2.5">
                        <Building2 className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                        {row.label}
                      </span>
                    </th>
                    <td className="px-5 py-4 text-sm text-brand-muted">
                      {row.shops === 1 ? '₹3,000' : '₹2,500'}
                    </td>
                    <td className="px-5 py-4 text-right text-base font-extrabold tracking-tight text-brand-700 sm:text-lg">
                      {row.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-2xl border border-accent-200 bg-accent-50 p-5">
            <p className="text-sm leading-relaxed text-accent-900">
              <span className="font-bold">From two shops onwards</span> every shop is{' '}
              <span className="font-bold">₹2,500 per shop per year</span> rather than ₹3,000 — so
              five shops is ₹12,500 a year in total, not ₹15,000. Running more than five? Tell us
              the number and we will confirm the total before anything is activated.
            </p>
          </div>
        </div>
      </Section>

      {/* 4 — Feature comparison ------------------------------------------- */}
      <Section id="compare" tone="page">
        <SectionHeading
          eyebrow="Side by side"
          title="Exactly what changes when you move to Basic"
          subtitle="Nothing is removed on the trial — the ceilings are just lower, and the doorstep Pickup Service is the one capability held back for Basic shops."
        />

        <div className="mx-auto mt-12 max-w-3xl overflow-x-auto rounded-3xl border border-brand-line bg-white shadow-soft">
          <table className="w-full min-w-[26rem] border-collapse text-left">
            <caption className="sr-only">
              Feature comparison between the NearGFix Free Trial and the Basic plan
            </caption>
            <thead>
              <tr className="border-b border-brand-line bg-brand-page">
                <th
                  scope="col"
                  className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-brand-muted sm:px-6"
                >
                  Capability
                </th>
                <th
                  scope="col"
                  className="px-3 py-4 text-center text-xs font-bold uppercase tracking-widest text-brand-muted sm:px-6"
                >
                  Free Trial
                </th>
                <th
                  scope="col"
                  className="px-3 py-4 text-center text-xs font-bold uppercase tracking-widest text-brand-700 sm:px-6"
                >
                  Basic
                </th>
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON.map((row) => (
                <tr key={row.feature} className="border-b border-brand-line last:border-0">
                  <th
                    scope="row"
                    className="px-4 py-4 text-sm font-semibold text-brand-ink sm:px-6 sm:text-base"
                  >
                    {row.feature}
                  </th>
                  <td className="px-3 py-4 text-center text-sm text-brand-muted sm:px-6">
                    <ComparisonCell value={row.free} plan="the Free Trial" />
                  </td>
                  <td className="bg-brand-50/60 px-3 py-4 text-center text-sm text-brand-muted sm:px-6">
                    <ComparisonCell value={row.basic} plan="Basic" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mx-auto mt-6 max-w-prose text-center text-sm leading-relaxed text-brand-muted">
          Everything else is identical on both plans: IMEI and QR device intake, the full six-stage
          ticket lifecycle, technicians, geofenced attendance, invoicing and label printing,
          inventory, KYC, customer chat and App Lock.
        </p>
      </Section>

      {/* 5 — Billing honesty ---------------------------------------------- */}
      <Section id="billing" tone="dark">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-16">
          <div>
            <Badge tone="inverted" icon="Handshake">
              How activation works
            </Badge>
            <SectionHeading
              className="mt-6"
              align="left"
              inverted
              title="There is no online payment gateway yet — and we would rather say so"
              subtitle="Plans on NearGFix are activated by our team, not by a checkout page. Message us with the number of shops you run, we confirm the total, and we switch the plan on for your account."
            />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button href={CTA.talkToSales.href} variant="white" size="lg" icon="ArrowRight">
                {CTA.talkToSales.label}
              </Button>
              <Button
                href={BRAND.whatsappHref}
                external
                size="lg"
                className="border border-white/40 bg-transparent text-white hover:bg-white/10"
              >
                WhatsApp {BRAND.phone}
              </Button>
            </div>
            <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-brand-100">
              <Headset className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Or email{' '}
                <a
                  href={BRAND.emailHref}
                  className="font-semibold text-white underline underline-offset-2 hover:text-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900"
                >
                  {BRAND.email}
                </a>
              </span>
            </p>
          </div>

          <ul className="space-y-4">
            {BILLING_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <li
                  key={point.title}
                  className="rounded-3xl border border-white/15 bg-white/5 p-6 sm:p-7"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-white sm:text-lg">{point.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-brand-100">
                        {point.description}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {/* 6 — Pricing FAQ --------------------------------------------------- */}
      <Section id="pricing-faq" tone="white">
        <SectionHeading
          eyebrow="Pricing questions"
          title="The things shop owners actually ask us"
          subtitle="Short answers on the trial, what happens when it ends, the multi-shop rate, and who pays for what."
        />

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {PRICING_FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-3xl border border-brand-line bg-white shadow-soft transition hover:border-brand-200 [&[open]_.faq-chevron]:rotate-180"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-3xl p-5 text-base font-semibold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:p-6 sm:text-lg [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <ChevronDown
                  className="faq-chevron h-5 w-5 shrink-0 text-brand-600 transition-transform duration-200 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-brand-muted sm:px-6 sm:pb-6 sm:text-base">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-brand-muted">
          More questions?{' '}
          <Link
            href="/faq"
            className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
          >
            Read the full FAQ
          </Link>{' '}
          — {FAQS.length} answers for customers and shop owners.
        </p>
      </Section>

      {/* 7 — Closing CTA --------------------------------------------------- */}
      <Section tone="page">
        <CTABand
          title="Fifteen days, your own shop, your own bookings"
          subtitle="Register, and the trial is already running. Move to Basic whenever the two-shop or three-employee ceiling starts getting in your way."
          primary={CTA.startTrial}
          secondary={CTA.talkToSales}
        />
      </Section>
    </>
  );
}
