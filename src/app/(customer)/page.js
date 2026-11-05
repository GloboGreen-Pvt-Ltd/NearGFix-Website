import Link from '@/components/PortalLink';
import { preload } from 'react-dom';
import {
  ArrowRight,
  ClipboardList,
  Headphones,
  Laptop,
  Search,
  ShoppingCart,
  Smartphone,
  Wrench,
  BadgeCheck,
  BellRing,
  Check,
  Clock,
  Handshake,
  LockKeyhole,
  Phone,
  Receipt,
  ShieldCheck,
  Store,
  TrendingUp,
  Truck,
} from 'lucide-react';

import HomeHeroSlide from '@/components/site/HomeHeroSlide';
import HomeRepairCategories from '@/components/site/HomeRepairCategories';
import AppBenefitsSection from '@/components/site/AppBenefitsSection';
import StoreBadges from '@/components/site/StoreBadges';
import CustomerHomePhone from '@/components/site/CustomerHomePhone';
import {
  Button,
  Section,
  SectionHeading,
  cx,
} from '@/components/site/ui';
import {
  BRAND,
  CTA,
  FAQS,
} from '@/lib/siteContent';
import JsonLd from '@/components/seo/JsonLd';
import { organizationSchema, pageMetadata, websiteSchema } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Mobile Repair, Buy & Sell Devices Online | NearGFix',
  absoluteTitle: true,
  description:
    'NearGFix offers mobile, tablet, laptop, smartwatch and audio device repair services. Book repairs, buy devices or sell your used gadgets easily.',
  path: '/',
});

/* -------------------------------------------------------------------------- */
/* Local, page-only pieces                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Scroll offset for every in-page anchor target on this page.
 *
 * Repair / Sell / Buy in the primary nav are hash links to sections on THIS
 * page, and the header is sticky. Without a scroll margin the browser puts the
 * section's top edge at y=0 — directly underneath the header — so the eyebrow
 * and part of the heading land behind it.
 *
 * Sized against the real header, not guessed:
 *   < sm   h-16                      = 64px
 *   sm     h-20                      = 80px
 *   lg     h-20 + the menu row       = 133px  (80 + 1px border + 16px ul
 *                                              padding + 36px link box)
 * 6rem/9rem clears each with room to spare. Matches the scroll-mt-28 already
 * used by the /terms and /privacy clause anchors.
 */
const ANCHOR_OFFSET = 'scroll-mt-24 lg:scroll-mt-36';

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

const HOME_FAQS = [
  {
    topic: 'Getting started',
    question: 'Do I need the app, or can I use NearGFix on the website?',
    answer:
      'Booking a repair, selling a device and buying from shops all happen in the NearGFix customer app — download it, sign in with your phone number and an OTP, and you are ready. The website lets you browse nearby shops and check your account.',
  },
  {
    topic: 'Repair',
    question: 'I do not know what is wrong with my phone. Can I still book?',
    answer:
      'Yes. Send an enquiry instead of a booking — nearby repair shops can look at your issue and you can message them directly before you commit to anything.',
  },
  {
    topic: 'Pickup',
    question: 'Do I have to go to the shop?',
    answer:
      'Not if the shop offers doorstep pickup. Choose a pickup-enabled shop, confirm your address and pick a time slot — the shop collects the device from you.',
  },
  {
    topic: 'Sell',
    question: 'How do I get the best price for my old phone?',
    answer:
      'List it once in the Sell flow and several nearby shops send you their own quotations. Compare them side by side and accept the one you like — or none of them.',
  },
  {
    topic: 'Safety',
    question: 'Is my account and data safe?',
    answer:
      'You sign in with an OTP sent to your phone, and you can switch on App Lock so the app needs your fingerprint or Face ID to open. Each shop only sees the orders you place with it.',
  },
];

export default function HomePage() {
  // The hero artwork is a CSS background (HomeHeroSlide), which the browser
  // only discovers after the stylesheet loads. It is the page's LCP element on
  // every screen size, so ask for it straight away.
  preload('/Hero-bg.jpg', { as: 'image', fetchPriority: 'high' });

  return (
    <>
      {/* Who runs the site and what it is — the home page is where Google
          expects Organization / WebSite structured data. */}
      <JsonLd data={[organizationSchema(), websiteSchema()]} />

      {/* ---------------------------------------------------------------- */}
      {/* 1. Hero                                                          */}
      {/* ---------------------------------------------------------------- */}
      {/* padding="snug": the hero sits straight under the sticky header, but its
          stats bar hangs 10px below the artwork on xl+, so it needs a little
          room underneath. No overflow-hidden here — it would clip that bar. */}
      {/* "Your Devices In Safe Hands" — HomeHeroSlide carries the page's <h1>. */}
      <Section tone="white" padding="snug">
        <HomeHeroSlide />
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. The category menu                                             */}
      {/* ---------------------------------------------------------------- */}
      {/* "Our Services" is the section's own <h2>. The card labels beneath it
          are plain <span>s, not headings — three words in a row do not warrant
          heading semantics and would only pad the document outline. */}
      {/* padding="tight" as well: the hero above is tight, so the default
          py-16/20/24 here stacked a large empty band between the banner and
          "Our Services". Both tight puts them a comfortable distance apart
          without the gap reading as a missing section. */}
      <Section id="menu" tone="page" padding="tight" className={ANCHOR_OFFSET}>
        {/* Repair device categories, then the admin's Buy / Sell menu rows, then
            Nearby Shops — one flat tile each (see HomeRepairCategories). */}
        <HomeRepairCategories />
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 3. How a repair works                                            */}
      {/* ---------------------------------------------------------------- */}
      <Section id="repair" tone="white" className={ANCHOR_OFFSET}>
        <AppBenefitsSection />
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 4. Sell — the differentiator                                     */}
      {/* ---------------------------------------------------------------- */}
      <Section id="sell" tone="soft" className={cx(ANCHOR_OFFSET, 'bg-gradient-to-b from-[#E5F3F5] via-[#F3FBF4] to-white')}>
        <SectionHeading
          eyebrow="Sell with the NearGFix app"
          title="Sell your old device the smart way"
          subtitle="List once, let nearby shops compete, and take the best offer — all from the NearGFix app."
        />

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Store, title: 'Many offers, one listing', body: 'List once — nearby shops each send you their own price.', chip: 'from-[#035C6C] to-[#035C6C]' },
            { icon: TrendingUp, title: 'You get the best price', body: 'Compare the offers side by side and pick the highest.', chip: 'from-[#5EA2FF] to-[#1570EF]' },
            { icon: Clock, title: 'List in minutes', body: 'Guided questions cover condition, faults, accessories and photos.', chip: 'from-[#FDB022] to-[#F79009]' },
            { icon: ShieldCheck, title: 'Verified shops only', body: 'Offers come from verified NearGFix partner shops near you.', chip: 'from-[#A48AFB] to-[#7F56D9]' },
            { icon: Truck, title: 'Doorstep pickup', body: 'Accept an offer and the shop can collect the device from you.', chip: 'from-[#2ED3B7] to-[#0E9384]' },
            { icon: Handshake, title: 'No obligation', body: "Don't like the offers? Simply don't accept — nothing to pay.", chip: 'from-[#FD6F8E] to-[#E31B54]' },
            { icon: BellRing, title: 'Track every offer', body: 'Get notified the moment a shop quotes or updates its offer.', chip: 'from-[#F7B500] to-[#DC6803]' },
            { icon: LockKeyhole, title: 'Safe & transparent', body: 'A clear condition report means no surprise deductions later.', chip: 'from-[#36BFFA] to-[#0086C9]' },
          ].map((item) => (
            <li
              key={item.title}
              className="group rounded-3xl border border-[#C7E6EA] bg-white p-6 shadow-[0_6px_20px_rgba(3,92,108,0.06)] transition hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(3,92,108,0.14)]"
            >
              <span className={cx('inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md transition group-hover:scale-105', item.chip)}>
                <item.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold tracking-tight text-brand-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">{item.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-center justify-between gap-5 rounded-3xl border border-[#C7E6EA] bg-white px-6 py-6 text-center shadow-sm sm:flex-row sm:px-8 sm:text-left">
          <div>
            <p className="text-lg font-extrabold text-brand-ink">Ready to sell? It takes just a few minutes.</p>
            <p className="mt-1 text-sm text-brand-muted">Describe your device → nearby shops quote → accept the best offer.</p>
          </div>
          <Button href={CTA.getApp.href} variant="primary" size="lg" icon="ArrowRight">
            {CTA.getApp.label}
          </Button>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 5. Buy — refurbished devices and accessories                      */}
      {/* ---------------------------------------------------------------- */}
      <Section id="buy" tone="white" className={ANCHOR_OFFSET}>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          <div>
            <SectionHeading
              eyebrow="Buy on NearGFix"
              title="Quality devices from shops you can trust"
              subtitle="Refurbished phones, laptops, accessories and spare parts — sold by verified repair shops near you, at honest local prices."
              align="left"
            />
            <ul className="mt-8 space-y-3">
              {[
                'Sold by verified NearGFix repair shops near you',
                'Real photos, specs and condition on every listing',
                'Compare prices from different shops in one place',
                'Every purchase tracked in My Orders, with the shop a call away',
              ].map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-base font-medium text-brand-ink">{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href={CTA.getApp.href} variant="primary" size="lg" icon="ArrowRight">
                Start shopping in the app
              </Button>
              <Button href="/nearby-shops" variant="outline" size="lg">
                Find nearby shops
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[
              { icon: Smartphone, title: 'Refurbished phones', text: 'Tested handsets at a fraction of the price.', tone: 'from-[#E5F3F5] to-[#CFF2DA]', chip: 'from-[#035C6C] to-[#035C6C]' },
              { icon: Laptop, title: 'Laptops & tablets', text: 'Work and study devices, checked by experts.', tone: 'from-[#EEF5FF] to-[#D6E7FF]', chip: 'from-[#5EA2FF] to-[#1570EF]' },
              { icon: Headphones, title: 'Accessories', text: 'Chargers, cables, cases, earbuds and more.', tone: 'from-[#FFF6EA] to-[#FFE3BF]', chip: 'from-[#FDB022] to-[#F79009]' },
              { icon: Wrench, title: 'Spare parts', text: 'Screens, batteries and parts for DIY fixes.', tone: 'from-[#F5EFFF] to-[#E4D6FF]', chip: 'from-[#A48AFB] to-[#7F56D9]' },
            ].map((tile, i) => (
              <div
                key={tile.title}
                className={cx(
                  'group relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 transition hover:-translate-y-1 hover:shadow-lift sm:p-6',
                  tile.tone,
                  i % 2 === 1 && 'sm:translate-y-6',
                )}
              >
                <tile.icon className="pointer-events-none absolute -bottom-5 -right-5 h-24 w-24 text-brand-ink opacity-[0.06]" aria-hidden="true" />
                <span className={cx('relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md', tile.chip)}>
                  <tile.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="relative mt-5 break-words text-base font-extrabold text-brand-ink sm:text-lg">{tile.title}</p>
                <p className="relative mt-1 text-sm leading-relaxed text-brand-muted">{tile.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 rounded-3xl border border-brand-line bg-brand-50/60 p-6 sm:p-8">
          <p className="text-center text-sm font-extrabold uppercase tracking-[0.14em] text-brand-700">How buying works</p>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Search, title: 'Browse nearby', text: 'Pick a category and see listings from shops around you.' },
              { icon: ShoppingCart, title: 'Add to cart & order', text: 'Check the photos and specs, then order in a few taps.' },
              { icon: ClipboardList, title: 'Track & collect', text: 'Follow your order in My Orders until it reaches you.' },
            ].map((step, i) => (
              <li key={step.title} className="flex items-start gap-4">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm">
                  <step.icon className="h-6 w-6" aria-hidden="true" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{i + 1}</span>
                </span>
                <div>
                  <p className="text-base font-extrabold text-brand-ink">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 7. Track everything                                              */}
      {/* ---------------------------------------------------------------- */}
      <Section id="orders" tone="white" className={ANCHOR_OFFSET}>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Track everything"
              title="Always know where your device is"
              subtitle="Repairs, pickups, purchases, sales and enquiries — all in My Orders, updated live as the shop works on them."
              align="left"
            />

            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                { icon: BellRing, title: 'Live status updates', body: 'Get notified at every step — from accepted to ready for pickup.', chip: 'from-[#035C6C] to-[#035C6C]' },
                { icon: BadgeCheck, title: 'Approve the price first', body: 'The shop quotes, you approve. No work starts on a surprise bill.', chip: 'from-[#5EA2FF] to-[#1570EF]' },
                { icon: Receipt, title: 'Receipts & invoices', body: 'Digital receipt and invoice saved with every order.', chip: 'from-[#FDB022] to-[#F79009]' },
                { icon: Phone, title: 'Talk to the shop', body: 'Call or message the shop handling your device anytime.', chip: 'from-[#A48AFB] to-[#7F56D9]' },
              ].map((item) => (
                <li key={item.title} className="rounded-2xl border border-brand-line bg-white p-4 transition hover:border-brand-600/40 hover:shadow-soft">
                  <span className={cx('inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm', item.chip)}>
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-base font-bold text-brand-ink">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-muted">{item.body}</p>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-brand-muted">Track all five:</span>
              {['Service', 'Pickup', 'Buy', 'Sell', 'Enquiry'].map((t) => (
                <span key={t} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-700">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Phone mockup — illustrative customer app home screen. */}
          <div className="relative mx-auto my-8 w-full max-w-[360px]">
            <div className="pointer-events-none absolute -inset-8 rounded-[60px] bg-gradient-to-br from-brand-100/70 via-white to-accent-50/60 blur-2xl" aria-hidden="true" />
            <CustomerHomePhone />

          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 8. FAQ teaser                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Section id="faq" tone="page" className={ANCHOR_OFFSET}>
        <SectionHeading
          eyebrow="Questions"
          title="New to NearGFix? Start here"
          subtitle="Quick answers to what first-time customers want to know before they book, sell or buy."
        />

        <div className="mx-auto mt-12 max-w-3xl space-y-4">
          {HOME_FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-3xl border border-brand-line bg-white p-5 shadow-soft transition open:shadow-lift sm:p-6"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-xl text-base font-bold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:text-lg [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="mb-1.5 inline-block rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-700">{faq.topic}</span>
                  <span className="block">{faq.question}</span>
                </span>
                <span
                  className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-700 transition motion-reduce:transition-none group-open:rotate-90"
                  aria-hidden="true"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </summary>
              <p className="mt-3 text-base leading-relaxed text-brand-muted">{faq.answer}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-base font-semibold text-brand-700 transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
          >
            Read all {FAQS.length} questions
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 9. Closing CTA                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="white">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 px-6 py-10 text-white shadow-lift sm:px-10 sm:py-12 lg:px-14">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-[#C7E6EA]/10 blur-2xl" aria-hidden="true" />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#C7E6EA]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#C7E6EA]" aria-hidden="true" />
                {BRAND.appsStatus}
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Repair, sell and buy — all from one app
              </h2>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-white/80">
                The NearGFix customer app is almost here. Be the first to know when it launches and book your first repair in a few taps.
              </p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {['Doorstep pickup from nearby shops', 'Approve the price before work starts', 'Live tracking for every order', 'Best offers when you sell'].map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm font-semibold">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-brand-700">
                      <Check className="h-3 w-3" aria-hidden="true" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href={CTA.contact.href} variant="white" size="lg" icon="ArrowRight">
                  Notify me at launch
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-sm font-bold text-white">Get the NearGFix app</p>
                <StoreBadges tone="dark" align="left" caption="" className="mt-3" />
              </div>
              <div className="rounded-3xl bg-white p-5 text-brand-ink shadow-soft">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#035C6C] to-[#035C6C] text-white">
                    <Store className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-base font-extrabold">Run a repair shop?</p>
                    <p className="mt-1 text-sm leading-relaxed text-brand-muted">Start your 15-day free trial — no card needed.</p>
                  </div>
                </div>
                <Link
                  href={CTA.forShops.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline"
                >
                  Explore NearGFix for shops
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
