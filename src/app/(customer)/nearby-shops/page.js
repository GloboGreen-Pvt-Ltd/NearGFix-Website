/**
 * /nearby-shops — the public "Near Shops" page.
 *
 * Route naming: this is deliberately NOT /shops. The singular /shop is already
 * the shop-owner B2B landing page, and /shop vs /shops would be a permanent
 * source of confusion for visitors and maintainers alike.
 *
 * This file is a server component: metadata, static copy and layout only. Every
 * byte of live data is fetched client-side in <NearbyShops />, because
 * next.config.js sets `output: 'export'` in production — there is no server at
 * request time, so no SSR fetching, no route handlers and no server actions.
 */

import Link from '@/components/PortalLink';
import { Check, Clock, Lock, Map as MapIcon, Navigation, Phone, Smartphone, Truck } from 'lucide-react';

import { Button, Section, SectionHeading, cx } from '@/components/site/ui';
import CustomerHomePhone from '@/components/site/CustomerHomePhone';
import StoreBadges from '@/components/site/StoreBadges';
import { BRAND, CTA, NEARBY } from '@/lib/siteContent';

import NearbyShops from './NearbyShops';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Mobile Repair Shops Near You',
  description:
    'Find NearGFix mobile repair shops near you. Share your location to see every shop within 20 km, closest first, with its address and whether it is open now.',
  path: '/nearby-shops',
});

/* -------------------------------------------------------------------------- */
/* Static copy                                                                 */
/* -------------------------------------------------------------------------- */
/** What a visitor can do with this page — every item maps to a real feature. */
const SHOP_FEATURES = [
  {
    icon: Navigation,
    title: 'Closest shops first',
    description: 'Shops within 20 km, sorted by real distance from where you are.',
    chip: 'from-[#035C6C] to-[#035C6C]',
  },
  {
    icon: Clock,
    title: 'Open or closed, live',
    description: 'See at a glance which shops are open right now.',
    chip: 'from-[#2ED3B7] to-[#0E9384]',
  },
  {
    icon: Phone,
    title: 'Call or get directions',
    description: 'One tap to ring the shop or open the route in Google Maps.',
    chip: 'from-[#5EA2FF] to-[#1570EF]',
  },
  {
    icon: MapIcon,
    title: 'List or map view',
    description: 'Browse shop cards, or switch to the map to see them around you.',
    chip: 'from-[#FDB022] to-[#F79009]',
  },
];

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function NearbyShopsPage() {
  return (
    <>
      {/* 1 — Heading + the live list -------------------------------------- */}
      <Section tone="soft" padding="tight">
        <SectionHeading as="h1" eyebrow={NEARBY.eyebrow} title={NEARBY.title} />

        <div className="mt-6">
          <NearbyShops />
        </div>
      </Section>

      {/* 2 — What you can do here --------------------------------------- */}
      <Section tone="white">
        <SectionHeading
          eyebrow="Made for finding shops fast"
          title="Everything you need to pick the right shop"
          subtitle="Find a trusted repair shop around the corner, check it is open, and get there — or have your device picked up."
        />

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHOP_FEATURES.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.title}
                className="group rounded-3xl border border-brand-line bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift"
              >
                <span className={cx('inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md transition group-hover:scale-105', item.chip)}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-bold tracking-tight text-brand-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-muted">{item.description}</p>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          {/* Next step: book in the app */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-lift sm:p-8">
            <Smartphone className="pointer-events-none absolute -bottom-6 -right-4 h-36 w-36 text-white/10" aria-hidden="true" />
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C7E6EA]">Found your shop?</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight">Book the repair in the NearGFix app</p>
            <ul className="relative mt-4 grid gap-2 sm:grid-cols-2">
              {['Doorstep pickup or walk in', 'Approve the price first', 'Track every stage live', 'Receipt & invoice saved'].map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm font-semibold text-white/90">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-brand-700">
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Privacy */}
          <div className="flex gap-4 rounded-3xl border border-brand-line bg-brand-50/60 p-6 sm:p-8">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm">
              <Lock className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight text-brand-ink">Your location stays private</p>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                Your location is only used to sort shops by distance. It stays in this browser and is never stored against you.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* 3 — Closing band: can't visit? pickup ---------------------------- */}
      <Section tone="page">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 px-6 pt-8 text-white shadow-lift sm:px-10 lg:px-12">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-32 right-10 h-80 w-80 rounded-full bg-[#C7E6EA]/15 blur-3xl" aria-hidden="true" />

          <div className="relative grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_250px] lg:gap-12">
            <div className="pb-8 text-center lg:self-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#C7E6EA]">
                <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                Doorstep pickup
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                No time to visit? The shop comes to you.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-white/80 lg:mx-0">
                Book a doorstep pickup with a nearby shop in the NearGFix app — pick your slot, approve the price, and get your device delivered back fixed.
              </p>

              <StoreBadges tone="dark" align="center" caption={BRAND.appsStatus} className="mt-6 lg:items-start lg:[&>div]:justify-start" />

              <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Button href="/pickup-delivery" variant="white" size="lg" icon="ArrowRight">
                  How pickup works
                </Button>
                <Link
                  href={CTA.contact.href}
                  className="inline-flex items-center rounded-full border border-white/40 px-6 py-3 text-base font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700"
                >
                  {CTA.contact.label}
                </Link>
              </div>
            </div>

            {/* App home screen, cropped by the card's bottom edge */}
            <div className="mx-auto h-[300px] w-full max-w-[250px] self-end overflow-hidden sm:h-[340px]">
              <CustomerHomePhone className="rounded-b-none border-b-0" />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
