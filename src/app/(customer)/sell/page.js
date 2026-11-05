import JsonLd from '@/components/seo/JsonLd';
import SeoBreadcrumb from '@/components/site/SeoBreadcrumb';
import SeoFaqList from '@/components/site/SeoFaqList';
import { Badge, Button, CheckList, CTABand, FeatureCard, Section, SectionHeading, StepList } from '@/components/site/ui';
import { CTA, SELL_HIGHLIGHT, SELL_STEPS } from '@/lib/siteContent';
import { pageMetadata, serviceSchema } from '@/lib/seo';

/**
 * /sell — landing page for customers selling a used phone or other device.
 * The selling itself happens in the NearGFix customer app; this page explains how
 * it works, using the same SELL_STEPS the app's flow is built from. Linked
 * from the footer and the repair pages; the header's "Sell Device" item still
 * scrolls to the home page section, unchanged.
 */

const DESCRIPTION =
  'Sell your old mobile, tablet or laptop on NearGFix. List it once, get price offers from verified shops near you, compare them and accept the best one.';

export const metadata = pageMetadata({
  title: 'Sell Your Used Mobile Phone Online',
  description: DESCRIPTION,
  path: '/sell',
});

const PRICE_FACTORS = [
  { title: 'Screen and body condition', description: 'Cracks, scratches, dents and display lines all change what a shop will offer.', icon: 'MonitorSmartphone' },
  { title: 'Working condition', description: 'Whether it switches on, and any faults with the camera, speaker, mic, buttons, charging or network.', icon: 'Stethoscope' },
  { title: 'Model and storage', description: 'The exact model and its RAM and storage variant — confirmed in the listing, not guessed.', icon: 'Cpu' },
  { title: 'Box, charger and bill', description: 'Original accessories and a purchase bill, plus whether the device is still under warranty.', icon: 'Package' },
];

const BEFORE_YOU_SELL = [
  'Back up your photos, contacts and chats',
  'Sign out of your Google or Apple account and turn off Find My Device / Find My iPhone',
  'Remove your SIM card and any memory card',
  'Factory reset the device once you have accepted an offer',
  'Keep the box, charger and bill together if you still have them',
];

const SELL_FAQS = [
  { question: 'How do I get the best price for my old phone?', answer: 'List it once in the NearGFix Sell flow and several nearby shops send you their own quotations. Compare them side by side and accept the one you like — or none of them.' },
  { question: 'Do I have to accept an offer?', answer: 'No. If none of the quotations work for you, simply do not accept one. There is nothing to pay for listing your device.' },
  { question: 'Can I sell a phone that does not switch on?', answer: 'Yes. The Sell flow asks whether the device works at all, so shops can quote for dead or damaged devices too — the offer will reflect its condition.' },
  { question: 'Who buys my device?', answer: 'Verified NearGFix partner shops near you. Each shop that is interested sends its own offer, and you choose which one to accept.' },
];

export default function SellPage() {
  return (
    <>
      <JsonLd
        data={serviceSchema({
          name: 'Sell your used device',
          description: DESCRIPTION,
          path: '/sell',
          serviceType: 'Used device buy-back',
        })}
      />

      <Section tone="white" padding="snug">
        <SeoBreadcrumb items={[{ name: 'Home', path: '/' }, { name: 'Sell your device', path: '/sell' }]} />
      </Section>

      <Section tone="white" padding="tight">
        <div className="max-w-3xl">
          <Badge icon="Handshake">Sell on NearGFix</Badge>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl lg:text-5xl">
            Sell Your Old Phone for the Best Price
          </h1>
          <p className="mt-4 text-base leading-relaxed text-brand-muted sm:text-lg">
            Selling a used mobile usually means accepting one take-it-or-leave-it number. On NearGFix you describe your
            phone, tablet or laptop once, and verified repair shops near you send their own offers. You compare them
            and accept the best — and the shop can collect the device from your door.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href={CTA.getApp.href} size="lg" icon="ArrowRight">
              {CTA.getApp.label}
            </Button>
            <Button href="/repair" variant="outline" size="lg">
              Repair it instead
            </Button>
          </div>
        </div>
      </Section>

      <Section tone="soft">
        <SectionHeading title={SELL_HIGHLIGHT.title} subtitle={SELL_HIGHLIGHT.description} />
        <div className="mx-auto mt-12 max-w-3xl">
          <StepList steps={SELL_STEPS} />
        </div>
      </Section>

      <Section tone="white">
        <SectionHeading
          title="What affects the price of a used phone"
          subtitle="Shops quote from the details in your listing, so an honest, complete listing gets the most accurate offers."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRICE_FACTORS.map((f) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} description={f.description} />
          ))}
        </div>
      </Section>

      <Section tone="page">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            align="left"
            title="Before you hand your phone over"
            subtitle="A few minutes of preparation protects your data and keeps the handover quick."
          />
          <CheckList items={BEFORE_YOU_SELL} />
        </div>
      </Section>

      <Section tone="white">
        <SectionHeading title="Selling your device: common questions" />
        <SeoFaqList faqs={SELL_FAQS} />
        <CTABand
          className="mt-16"
          title="Ready to sell your old device?"
          subtitle="List it once and let nearby shops compete for it."
          primary={{ label: CTA.getApp.label, href: CTA.getApp.href }}
          secondary={{ label: 'Buy a refurbished phone', href: '/buy' }}
        />
      </Section>
    </>
  );
}
