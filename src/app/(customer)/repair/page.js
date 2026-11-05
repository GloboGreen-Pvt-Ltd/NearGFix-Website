import { Suspense } from 'react';
import Link from '@/components/PortalLink';
import { ChevronRight } from 'lucide-react';

import HeroCarousel from '@/components/site/HeroCarousel';
import RepairBreadcrumb from '@/components/site/RepairBreadcrumb';
import RepairExtras from '@/components/site/RepairExtras';
import RepairFlow from '@/components/site/RepairFlow';
import StoreBadges from '@/components/site/StoreBadges';
import AppBenefitsSection from '@/components/site/AppBenefitsSection';
import { Button, Section } from '@/components/site/ui';
import { pageMetadata } from '@/lib/seo';

// The picker's ?category=…&brand=… steps all canonicalise to /repair/; the
// per-category landing pages (/repair/mobile/ etc.) are what rank for
// "<device> repair" searches.
export const metadata = pageMetadata({
  title: 'Book Mobile, Laptop & Tablet Repair Near You',
  description:
    'Choose your phone, tablet, laptop, smartwatch or earbuds, pick the fault, and book a doorstep pickup or in-shop repair with a verified NearGFix shop near you.',
  path: '/repair',
});

export default function RepairPage() {
  /* The marketing chrome that surrounds the picker. Defined as consts so each can
     be passed to <RepairExtras> AND to its Suspense fallback — identical content
     in both means the bare /repair page keeps them in the static HTML with no
     flash, while /repair?category=… hides them (see RepairExtras). */
  const heroBanner = (
    <Section tone="white" padding="hairline">
      <HeroCarousel title="Repair" className="mx-auto w-full max-w-[1028px]" />
    </Section>
  );

  const detailSections = (
    <>
      {/* NearGFix app benefits — the same AppBenefitsSection as the home page's
          #repair section, so the two can never drift in wording. */}
      <Section tone="white">
        <AppBenefitsSection />
      </Section>

      {/* Closing CTA — custom two-column band (message + store badges) rather than
          the shared <CTABand>, which is left untouched for other pages. */}
      <Section tone="white" padding="tight">
        <div className="overflow-hidden rounded-4xl bg-brand-700 shadow-lift">
          <div className="grid items-center gap-8 px-6 py-12 sm:px-12 sm:py-14 lg:grid-cols-2 lg:gap-12">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to get it fixed?
              </h2>
              <p className="mx-auto mt-4 max-w-prose text-base leading-relaxed text-brand-100 sm:text-lg lg:mx-0">
                Book the repair in the NearGFix app — pick your device, choose the fault, and a verified
                shop near you takes it from there.
              </p>
              <div className="mt-7 flex justify-center lg:justify-start">
                <Button href="/nearby-shops" variant="white" size="lg" icon="ArrowRight">
                  Find a shop near you
                </Button>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-sm rounded-3xl bg-white/10 p-6 text-center ring-1 ring-white/15">
                <p className="text-lg font-bold text-white">Get the NearGFix app</p>
                <StoreBadges className="mt-4" />
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  );

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* 1. Breadcrumb                                                     */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="white" padding="snug">
        {/* The visible title, subtitle, CTAs and assurance chips were removed —
            this breadcrumb is all that remains above the banner.

            The <h1> stays, visually hidden. A page still needs exactly one for
            search engines and for screen-reader document navigation, and a
            breadcrumb cannot supply it: "Repair" there is a location marker, not
            the page's heading. Delete this only if a visible <h1> comes back. */}
        <h1 className="sr-only">Repair</h1>

        {/* One trail for the whole flow: Home › Repair, growing to
            Home › Repair › Categories › Mobile › … as the picker advances.
            It reads the URL, so it sits in Suspense (fallback = the bare trail,
            which is also the static-export HTML). RepairFlow no longer renders
            its own breadcrumb — this is the single source. */}
        <Suspense
          fallback={
            <nav aria-label="Breadcrumb">
              <ol className="flex list-none flex-wrap items-center gap-1.5 p-0 text-sm text-brand-muted">
                <li>
                  <Link
                    href="/"
                    className="rounded font-medium transition hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
                  >
                    Home
                  </Link>
                </li>
                <li aria-hidden="true" className="text-brand-subtle">
                  <ChevronRight className="h-4 w-4" />
                </li>
                <li aria-current="page" className="font-semibold text-brand-ink">
                  Repair
                </li>
              </ol>
            </nav>
          }
        >
          <RepairBreadcrumb />
        </Suspense>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Hero banner — category step only                              */}
      {/* ---------------------------------------------------------------- */}
      {/* Hidden once a category is chosen (see RepairExtras). The banner is 1028x366
          (its authored size), capped so object-cover never trims the artwork. */}
      <Suspense fallback={heroBanner}>
        <RepairExtras>{heroBanner}</RepairExtras>
      </Suspense>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Pick a device — the Category → Brand → Product wizard         */}
      {/* ---------------------------------------------------------------- */}
      {/* RepairFlow is a client component that drives the whole picker from
          the URL query (?category=…&brand=…&model=…), so the Back button and
          shareable links work. It replaces the old presentational tiles: the
          category tiles now advance to Select Brand → Select Product, mirroring
          the customer app, and end on a "book in the app / find a shop" summary.
          Wrapped in Suspense because it reads useSearchParams(), which the
          static export requires to sit inside a Suspense boundary. */}
      {/* padding="snug", not "tight": with the hero hidden on a category step,
          the picker sits right under the breadcrumb, and "tight" left a large
          empty band above the "Select a brand" panel. On the bare /repair page
          this just pulls the category grid a little closer to the banner. */}
      <Section tone="white" padding="snug">
        {/* No panel background or border — the picker sits directly on the white
            page. Padding kept so the grid does not run to the page gutters. */}
        <div className="py-2">
          <Suspense
            fallback={
              <h2 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
                Select your device category to repair
              </h2>
            }
          >
            <RepairFlow />
          </Suspense>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 4. How a repair works + closing CTA — category step only        */}
      {/* ---------------------------------------------------------------- */}
      <Suspense fallback={detailSections}>
        <RepairExtras>{detailSections}</RepairExtras>
      </Suspense>
    </>
  );
}
