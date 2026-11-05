import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  Handshake,
  IndianRupee,
  LifeBuoy,
  MapPin,
  PackageSearch,
  ShieldCheck,
  Store,
} from 'lucide-react';

import {
  Badge,
  Button,
  Container,
  Section,
  SectionHeading,
  cx,
  resolveIcon,
} from '@/components/site/ui';
import { BRAND, CTA, FAQS, SUPPORT_CHANNELS } from '@/lib/siteContent';

import CustomerHomePhone from '@/components/site/CustomerHomePhone';
import StoreBadges from '@/components/site/StoreBadges';

import { tone, toneOf } from '@/components/site/tones';
import FaqAccordion from './FaqAccordion';
import { faqSchema, pageMetadata } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';

export const metadata = pageMetadata({
  title: 'FAQs – Repair, Pickup, Sell & Buy Questions',
  description:
    'Answers about booking a phone repair, doorstep pickup, selling your device to multiple shops, the 15-day shop free trial, KYC and account security.',
  path: '/faq',
});

/* -------------------------------------------------------------------------- */
/* Local data — the three hard numbers people search this page for             */
/* -------------------------------------------------------------------------- */

const QUICK_FACTS = [
  {
    icon: CalendarClock,
    value: '15 days free',
    description:
      'The Free Trial is granted automatically the moment you register a shop. No card, nothing to cancel.',
    tone: 'green',
  },
  {
    icon: IndianRupee,
    value: '₹3,000 a year',
    description:
      'The Basic plan for one shop. From your second shop onwards it is ₹2,500 per shop per year.',
    tone: 'orange',
  },
  {
    icon: MapPin,
    value: '20 km radius',
    description:
      'How far the customer app looks when it shows you pickup-enabled repair shops and their ratings.',
    tone: 'blue',
  },
];

const HELP_TOPICS = [
  {
    icon: PackageSearch,
    who: 'Customers',
    title: 'Where is my device?',
    description: 'Share your order ID and we will check the live status with the shop handling your repair or pickup.',
  },
  {
    icon: CalendarClock,
    who: 'Customers',
    title: 'Pickup or delivery change',
    description: 'Need a different pickup slot, address or delivery time? We will help you coordinate it with the shop.',
  },
  {
    icon: IndianRupee,
    who: 'Customers',
    title: 'Price, refund or return',
    description: 'Questions about an estimate, a refund that has not arrived, or returning something you bought.',
  },
  {
    icon: Handshake,
    who: 'Customers',
    title: 'Selling your device',
    description: 'Not getting quotes, unsure about an offer, or need help completing a sale with a shop.',
  },
  {
    icon: Store,
    who: 'Shop owners',
    title: 'Plans, trial and KYC',
    description: 'Get your plan set up, ask which KYC documents you need, or move an existing shop onto NearGFix.',
  },
  {
    icon: ShieldCheck,
    who: 'Everyone',
    title: 'Account and sign-in',
    description: 'Trouble with OTP, a forgotten password or App Lock — we will help you get back into your account.',
  },
];

const READY_CHECKLIST = [
  'Your order ID (for example #GGF2048) from My Orders',
  'The phone number you registered with',
  'Your device brand and model',
  'A screenshot or photo of the problem, if you have one',
];

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function FaqPage() {
  return (
    <>
      {/* 1 — Header ------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-brand-line bg-gradient-to-b from-[#E5F3F5] to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl" aria-hidden="true" />
        <Container className="relative py-14 sm:py-16 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-700 shadow-soft">
                <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
                Help centre
              </span>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-brand-ink sm:text-5xl">
                Straight answers, for both sides of the counter.{' '}
                <span className="text-brand-700">No small print.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-brand-muted sm:text-lg">
                How a repair moves from booking to delivery, why several shops bid on the phone you
                are selling, what the Free Trial really includes — filter by who you are, or search
                the whole list.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href="#questions" size="lg" icon="ArrowRight">
                  Browse questions
                </Button>
                <Button href={CTA.contact.href} variant="outline" size="lg">
                  {CTA.contact.label}
                </Button>
              </div>
            </div>

            <ul className="space-y-3">
              {QUICK_FACTS.map((fact) => {
                const Icon = fact.icon;
                const t = toneOf(fact.tone);
                return (
                  <li key={fact.value} className={cx('flex items-start gap-4 rounded-3xl border bg-white p-5 shadow-soft', t.ring)}>
                    <span
                      className={cx('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md', t.chip)}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className={cx('text-xl font-extrabold tracking-tight', t.text)}>
                        {fact.value}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-brand-muted">{fact.description}</p>
                    </div>
                  </li>
                );
              })}
              <li className="px-1 text-xs leading-relaxed text-brand-muted">
                NearGFix has no online checkout. Plans are set up by our team, so nothing is ever
                charged to a card you saved.
              </li>
            </ul>
          </div>
        </Container>
      </section>

      {/* 2 — The questions ------------------------------------------------ */}
      <Section id="questions" tone="white">
        <SectionHeading
          eyebrow="Frequently asked"
          title="Find your question"
          subtitle="Pick a topic or start typing. Every answer describes what the apps do today — nothing here is a roadmap promise."
        />
        <FaqAccordion />
        {/* Every answer stays in the DOM (collapsed with CSS), so the markup
            matches content a visitor can open on this page. */}
        <JsonLd data={faqSchema(FAQS)} />
      </Section>

      {/* 3 — Still need help? --------------------------------------------- */}
      <Section tone="page">
        <SectionHeading
          eyebrow="Still need help?"
          title="Real people, ready to sort it out"
          subtitle="Whether you are a customer waiting on a device or a shop owner getting started, our support team picks up where the answers above stop."
        />

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HELP_TOPICS.map((topic, i) => (
            <li key={topic.title} className={cx('flex gap-4 rounded-3xl border p-5', tone(i).ring, tone(i).soft)}>
              <span className={cx('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md', tone(i).chip)}>
                <topic.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <span className={cx('text-[11px] font-bold uppercase tracking-wider', tone(i).text)}>{topic.who}</span>
                <h3 className="mt-0.5 text-base font-bold text-brand-ink">{topic.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">{topic.description}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="rounded-4xl border border-[#FEDF89] bg-[#FFF6E8] p-6 sm:p-8">
            <Badge tone="accent" icon={ClipboardCheck}>Before you reach out</Badge>
            <p className="mt-3 text-lg font-bold text-brand-ink sm:text-xl">Keep these handy for a faster answer</p>
            <ul className="mt-5 space-y-3">
              {READY_CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-brand-muted">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F79009] text-white">
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-4xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-lift sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C7E6EA]">Contact {BRAND.company}</p>
            <p className="mt-2 text-xl font-extrabold sm:text-2xl">Pick the way that suits you</p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/80">
              Call for anything urgent, WhatsApp to share photos or screenshots, or email when you want a written record.
            </p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {SUPPORT_CHANNELS.map((channel, i) => {
                const Icon = resolveIcon(channel.icon);
                const isWeb = channel.href.startsWith('http');
                return (
                  <li key={channel.key}>
                    <a
                      href={channel.href}
                      {...(isWeb ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="group flex h-full flex-col gap-2 rounded-2xl bg-white/10 p-4 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      <span className="flex items-center justify-between">
                        <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl shadow-md', [toneOf('green'), toneOf('teal'), toneOf('blue')][i % 3].chip)}>
                          {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-white/50 transition group-hover:text-white" aria-hidden="true" />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wide text-[#C7E6EA]">{channel.label}</span>
                      <span className="break-all text-sm font-extrabold">{channel.value}</span>
                      {isWeb ? <span className="sr-only">(opens in a new tab)</span> : null}
                    </a>
                  </li>
                );
              })}
            </ul>

            <Link
              href={CTA.contact.href}
              className="mt-6 inline-flex items-center gap-1.5 rounded-full text-sm font-bold text-white underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              More ways on the Contact page
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Section>

      {/* 4 — Closing CTA --------------------------------------------------- */}
      <Section tone="white">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 px-6 pt-10 text-white shadow-lift sm:px-10 lg:px-12 lg:pt-8">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-32 right-10 h-80 w-80 rounded-full bg-[#C7E6EA]/15 blur-3xl" aria-hidden="true" />

          <div className="relative grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_250px] lg:gap-12">
            {/* Centre — message, store badges, actions */}
            <div className="pb-10 text-center lg:self-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#C7E6EA]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#C7E6EA]" aria-hidden="true" />
                {BRAND.appsStatus}
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Read enough? Start the 15-day trial.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-white/80 lg:mx-0">
                Repair, buy, sell or book a pickup — all in one place. Register your shop and the Free Trial begins on its own. No card needed.
              </p>

              <StoreBadges tone="dark" align="center" caption="" className="mt-6 lg:items-start lg:[&>div]:justify-start" />

              <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Button href={CTA.startTrial.href} variant="white" size="lg" icon="ArrowRight">
                  {CTA.startTrial.label}
                </Button>
                <Link
                  href={CTA.seePricing.href}
                  className="inline-flex items-center rounded-full border border-white/40 px-6 py-3 text-base font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700"
                >
                  {CTA.seePricing.label}
                </Link>
              </div>
            </div>

            {/* Right — app home screen, cropped by the card's bottom edge */}
            <div className="mx-auto h-[300px] w-full max-w-[250px] self-end overflow-hidden sm:h-[340px]">
              <CustomerHomePhone className="rounded-b-none border-b-0" />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
