import JsonLd from '@/components/seo/JsonLd';
import SeoBreadcrumb from '@/components/site/SeoBreadcrumb';
import SeoFaqList from '@/components/site/SeoFaqList';
import { Badge, Button, CheckList, CTABand, FeatureCard, Section, SectionHeading, StepList } from '@/components/site/ui';
import { BUY_FEATURES, CTA } from '@/lib/siteContent';
import { pageMetadata } from '@/lib/seo';

/**
 * /buy — landing page for refurbished and used devices sold by NearGFix partner
 * shops. Listings and checkout live in the NearGFix customer app; this page
 * explains what is on offer and how buying works, with no product, price or
 * stock claims (those change by the hour and per shop). The header's "Buy
 * Devices" item still scrolls to the home page section, unchanged.
 */

const DESCRIPTION =
  'Buy refurbished and used smartphones, laptops, tablets and accessories from verified repair shops near you on NearGFix, with real photos, specs and condition.';

export const metadata = pageMetadata({
  title: 'Buy Refurbished & Used Mobiles from Local Shops',
  description: DESCRIPTION,
  path: '/buy',
});

const BUY_STEPS = [
  { title: 'Browse nearby', description: 'Pick a category and see listings from shops around you.', icon: 'MapPin' },
  { title: 'Add to cart and order', description: 'Check the photos, specs and condition, then order in a few taps.', icon: 'ShoppingBag' },
  { title: 'Track and collect', description: 'Follow your order in My Orders until it reaches you, with the shop a call away.', icon: 'Truck' },
];

const BUYING_CHECKLIST = [
  'Read the condition notes and look closely at every photo',
  'Check the exact model, RAM and storage variant in the listing',
  'Ask the shop about battery health and what accessories are included',
  'Ask whether the shop gives a warranty on the device, and for how long',
  'Keep the invoice from My Orders for your records',
];

const BUY_FAQS = [
  { question: 'Who sells the devices on NearGFix?', answer: 'Verified NearGFix partner repair shops near you. Each listing shows which shop is selling it, and you can contact the shop before or after you buy.' },
  { question: 'Are refurbished phones on NearGFix tested?', answer: 'Refurbished devices are listed by the repair shops that check and service them. Read the condition notes on each listing and ask the shop if anything is unclear before ordering.' },
  { question: 'Can I compare prices from different shops?', answer: 'Yes. Listings from different nearby shops appear together, so you can compare prices and condition in one place.' },
  { question: 'Where can I see my order?', answer: 'Every purchase is tracked under My Orders in the NearGFix app, along with your receipt and the shop’s contact details.' },
];

export default function BuyPage() {
  return (
    <>
      <Section tone="white" padding="snug">
        <SeoBreadcrumb items={[{ name: 'Home', path: '/' }, { name: 'Buy devices', path: '/buy' }]} />
      </Section>

      <Section tone="white" padding="tight">
        <div className="max-w-3xl">
          <Badge icon="ShoppingBag">Buy on NearGFix</Badge>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl lg:text-5xl">
            Buy Refurbished Phones, Laptops &amp; Accessories
          </h1>
          <p className="mt-4 text-base leading-relaxed text-brand-muted sm:text-lg">
            A used or refurbished smartphone can cost a fraction of a new one — if you can trust who is selling it.
            On NearGFix, devices are listed by the same verified repair shops near you that fix phones every day, with
            real photos, specifications and condition on every listing.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href={CTA.getApp.href} size="lg" icon="ArrowRight">
              Start shopping in the app
            </Button>
            <Button href="/nearby-shops" variant="outline" size="lg">
              Find shops near you
            </Button>
          </div>
        </div>
      </Section>

      <Section tone="soft">
        <SectionHeading title="What you can buy" subtitle="Refurbished and used devices, accessories and spare parts from local shops." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {BUY_FEATURES.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </Section>

      <Section tone="white">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading align="left" title="How buying works" />
            <StepList steps={BUY_STEPS} className="mt-8" />
          </div>
          <div>
            <SectionHeading
              align="left"
              title="Buying a used phone? Check these first"
              subtitle="Good habits for any second-hand device, wherever you buy it."
            />
            <CheckList items={BUYING_CHECKLIST} className="mt-8" />
          </div>
        </div>
      </Section>

      <Section tone="page">
        <SectionHeading title="Buying on NearGFix: common questions" />
        <SeoFaqList faqs={BUY_FAQS} />
        <CTABand
          className="mt-16"
          title="Find your next device nearby"
          subtitle="Refurbished phones, laptops and accessories from shops you can visit."
          primary={{ label: 'Start shopping in the app', href: CTA.getApp.href }}
          secondary={{ label: 'Sell your old phone', href: '/sell' }}
        />
      </Section>
    </>
  );
}
