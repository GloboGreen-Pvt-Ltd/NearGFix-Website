/**
 * /pickup-delivery — doorstep pickup & delivery, explained for customers.
 *
 * Static server component (the site is a static export). Every claim here
 * mirrors what the customer app and the shop app actually do — pickup is
 * offered by pickup-enabled shops within 20 km, the customer picks the address
 * and slot, approves the estimate, and follows the ticket statuses to delivery.
 */

import Link from 'next/link';
import {
  BadgeCheck,
  BatteryCharging,
  BellRing,
  CalendarClock,
  Check,
  ClipboardCheck,
  CloudUpload,
  CreditCard,
  Home,
  KeyRound,
  MapPin,
  MessageCircle,
  Receipt,
  Smartphone,
  Store,
  Truck,
  Wrench,
} from 'lucide-react';

import { Button, Section, SectionHeading, cx } from '@/components/site/ui';
import { CTA, FAQS } from '@/lib/siteContent';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Doorstep Pickup & Delivery for Device Repairs',
  description:
    'Get your phone or laptop repaired without leaving home. Choose a pickup-enabled NearGFix shop within 20 km, pick a slot, approve the price and track it back.',
  path: '/pickup-delivery',
});

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    icon: Smartphone,
    title: 'Tell us about your device',
    text: 'Pick your device by brand and model, then choose the repair you need.',
  },
  {
    icon: Store,
    title: 'Choose a pickup shop',
    text: 'See pickup-enabled repair shops within 20 km of you and pick one.',
  },
  {
    icon: CalendarClock,
    title: 'Set address & time slot',
    text: 'Confirm where to collect from and a pickup slot that suits you.',
  },
  {
    icon: Truck,
    title: 'We collect, fix & return',
    text: 'The shop picks it up, repairs it and delivers it back to your door.',
  },
];

const JOURNEY = [
  'Service Accepted',
  'Technician Assigned',
  'In Service Process',
  'Work Completed',
  'Out for Delivery',
  'Delivered',
];

const BENEFITS = [
  { icon: Home, title: 'No trip to the shop', text: 'Hand over your device at home or work — the shop comes to you.', chip: 'from-[#035C6C] to-[#035C6C]' },
  { icon: CalendarClock, title: 'Your time slot', text: 'Choose the pickup slot that fits your day, not the shop’s.', chip: 'from-[#2ED3B7] to-[#0E9384]' },
  { icon: BadgeCheck, title: 'Approve the price first', text: 'The shop sends an estimate — no work starts until you approve it.', chip: 'from-[#5EA2FF] to-[#1570EF]' },
  { icon: BellRing, title: 'Live status updates', text: 'Follow every stage in My Orders, from pickup to delivery.', chip: 'from-[#FDB022] to-[#F79009]' },
  { icon: Receipt, title: 'Receipt & invoice', text: 'A digital service receipt and invoice are saved with your order.', chip: 'from-[#A48AFB] to-[#7F56D9]' },
  { icon: MapPin, title: 'Shops near you', text: 'Only shops within 20 km that offer pickup are shown.', chip: 'from-[#FD6F8E] to-[#E31B54]' },
];

const OPTIONS = [
  {
    icon: Truck,
    title: 'Doorstep pickup',
    tag: 'Most convenient',
    text: 'A pickup-enabled shop collects the device from your address at your chosen slot and delivers it back.',
    highlight: true,
  },
  {
    icon: MessageCircle,
    title: 'Enquiry first',
    tag: 'Compare shops',
    text: 'Not sure yet? Message nearby shops, compare their answers, then decide.',
  },
  {
    icon: Wrench,
    title: 'Walk in',
    tag: 'Visit the shop',
    text: 'Prefer to drop it off yourself? Find a nearby shop and walk in.',
  },
];

const READY_TIPS = [
  { icon: CloudUpload, title: 'Back up your data', text: 'Save photos, contacts and chats before you hand it over.' },
  { icon: CreditCard, title: 'Remove SIM & memory card', text: 'Keep your SIM, memory card and cover with you.' },
  { icon: KeyRound, title: 'Keep your screen lock handy', text: 'The shop may ask for it to test the device after the repair.' },
  { icon: BatteryCharging, title: 'Charge it if you can', text: 'A little battery helps the shop check the fault quickly.' },
];

const PICKUP_FAQ_QUESTIONS = [
  'What is the difference between an enquiry and a doorstep pickup?',
  'How far away can the shops be?',
  'Can I see what is happening to my device?',
  'Will I be charged something I did not agree to?',
];
const PICKUP_FAQS = PICKUP_FAQ_QUESTIONS.map((q) => FAQS.find((f) => f.question === q)).filter(Boolean);

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function PickupDeliveryPage() {
  return (
    <>
      {/* 1 — Hero ----------------------------------------------------------- */}
      <Section tone="soft" padding="tight" className="bg-gradient-to-b from-[#E5F3F5] to-white">
        <div className="grid items-center gap-10 py-6 lg:grid-cols-2 lg:gap-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              Pickup &amp; Delivery
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-brand-ink sm:text-5xl">
              We pick it up. <span className="text-brand-700">We bring it back fixed.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-brand-muted">
              Book a doorstep pickup with a repair shop near you, choose your time slot, approve the price — and get your device delivered back to your door.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {['Pickup within 20 km', 'Choose your slot', 'Live tracking'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-white px-3 py-1.5 text-sm font-semibold text-brand-ink">
                  <Check className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href={CTA.getApp.href} variant="primary" size="lg" icon="ArrowRight">
                Book a pickup in the app
              </Button>
              <Button href="/nearby-shops" variant="outline" size="lg">
                Find pickup shops
              </Button>
            </div>
          </div>

          {/* Route visual: Home → Shop → Home */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="pointer-events-none absolute -inset-6 rounded-[48px] bg-gradient-to-br from-brand-100/70 via-white to-accent-50/50 blur-2xl" aria-hidden="true" />
            <div className="relative rounded-[32px] border border-brand-line bg-white p-6 shadow-lift sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Your device’s journey</p>
              <ol className="mt-6 space-y-0">
                {[
                  { icon: Home, title: 'Picked up from your door', sub: 'At the slot you chose', tone: 'from-[#035C6C] to-[#035C6C]' },
                  { icon: Wrench, title: 'Repaired at the shop', sub: 'After you approve the estimate', tone: 'from-[#5EA2FF] to-[#1570EF]' },
                  { icon: Truck, title: 'Out for delivery', sub: 'Tracked live in My Orders', tone: 'from-[#FDB022] to-[#F79009]' },
                  { icon: ClipboardCheck, title: 'Delivered back to you', sub: 'With receipt and invoice', tone: 'from-[#A48AFB] to-[#7F56D9]' },
                ].map((stop, i, arr) => (
                  <li key={stop.title} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < arr.length - 1 ? (
                      <span className="absolute left-[21px] top-12 h-[calc(100%-36px)] border-l-2 border-dashed border-brand-200" aria-hidden="true" />
                    ) : null}
                    <span className={cx('relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md', stop.tone)}>
                      <stop.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="pt-1">
                      <p className="text-base font-extrabold text-brand-ink">{stop.title}</p>
                      <p className="text-sm text-brand-muted">{stop.sub}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </Section>

      {/* 2 — How it works --------------------------------------------------- */}
      <Section tone="white">
        <SectionHeading
          eyebrow="How it works"
          title="Book a pickup in four steps"
          subtitle="All from the NearGFix customer app — it takes a couple of minutes."
        />
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-3xl border border-brand-line bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
              <span className="absolute right-5 top-5 text-4xl font-black text-brand-soft">{String(i + 1).padStart(2, '0')}</span>
              <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md">
                <step.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold tracking-tight text-brand-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 3 — Live tracking --------------------------------------------------- */}
      <Section tone="dark">
        <SectionHeading
          inverted
          eyebrow="Track every stage"
          title="Know exactly where your device is"
          subtitle="Every pickup booking moves through the same statuses, and you see each one in My Orders as it happens."
        />
        <ol className="mt-12 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {JOURNEY.map((stage, i) => (
            <li key={stage} className="relative rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-extrabold text-brand-700">
                {i + 1}
              </span>
              <p className="mt-3 text-sm font-bold text-white">{stage}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 4 — Benefits -------------------------------------------------------- */}
      <Section tone="soft" className="bg-gradient-to-b from-[#E5F3F5] via-[#F3FBF4] to-white">
        <SectionHeading
          eyebrow="Why doorstep pickup"
          title="Repairs that fit around your day"
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <li key={b.title} className="group flex gap-4 rounded-3xl border border-[#C7E6EA] bg-white p-5 shadow-[0_6px_20px_rgba(3,92,108,0.06)] transition hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(3,92,108,0.14)]">
              <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md transition group-hover:scale-105', b.chip)}>
                <b.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-bold tracking-tight text-brand-ink">{b.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-brand-muted">{b.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* 5 — Ways to get it repaired ----------------------------------------- */}
      <Section tone="white">
        <SectionHeading
          eyebrow="Your choice"
          title="Three ways to get it repaired"
          subtitle="Doorstep pickup is one option — pick whatever suits you."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {OPTIONS.map((opt) => (
            <div
              key={opt.title}
              className={cx(
                'relative rounded-3xl border p-6 transition hover:-translate-y-1 sm:p-7',
                opt.highlight
                  ? 'border-transparent bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-lift'
                  : 'border-brand-line bg-white shadow-soft hover:shadow-lift',
              )}
            >
              <span
                className={cx(
                  'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                  opt.highlight ? 'bg-white/15 text-[#C7E6EA]' : 'bg-brand-soft text-brand-700',
                )}
              >
                {opt.tag}
              </span>
              <span
                className={cx(
                  'mt-4 flex h-12 w-12 items-center justify-center rounded-2xl',
                  opt.highlight ? 'bg-white text-brand-700' : 'bg-brand-soft text-brand-700',
                )}
              >
                <opt.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className={cx('mt-4 text-xl font-extrabold tracking-tight', opt.highlight ? 'text-white' : 'text-brand-ink')}>
                {opt.title}
              </h3>
              <p className={cx('mt-2 text-sm leading-relaxed', opt.highlight ? 'text-white/80' : 'text-brand-muted')}>
                {opt.text}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* 6 — Questions ------------------------------------------------------- */}
      {PICKUP_FAQS.length ? (
        <Section tone="page">
          <SectionHeading eyebrow="Questions" title="Pickup questions, answered" />
          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {PICKUP_FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-brand-line bg-white p-5 shadow-soft transition open:shadow-lift"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-bold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 [&::-webkit-details-marker]:hidden">
                  <span>{faq.question}</span>
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-bold leading-none text-brand-700 transition group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-brand-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link href="/faq" className="text-sm font-semibold text-brand-700 hover:underline">
              See all questions
            </Link>
          </p>
        </Section>
      ) : null}

      {/* 7 — Closing: book + get ready for pickup --------------------------- */}
      <Section tone="white">
        <div className="grid overflow-hidden rounded-[32px] shadow-lift lg:grid-cols-[1.15fr_1fr]">
          {/* Left — book it */}
          <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 p-6 text-white sm:p-10">
            <Truck className="pointer-events-none absolute -bottom-8 -right-6 h-44 w-44 text-white/10" aria-hidden="true" />
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#C7E6EA]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#C7E6EA]" aria-hidden="true" />
              Ready when you are
            </span>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Your device, picked up and back at your door
            </h2>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-white/80">
              Choose a nearby shop, set a time slot and relax — you will see every step until it is delivered.
            </p>

            <dl className="relative mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { value: '20 km', label: 'Pickup radius' },
                { value: 'Your', label: 'Time slot' },
                { value: 'Live', label: 'Tracking' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-white/10 px-2 py-3 text-center sm:px-3">
                  <dt className="whitespace-nowrap text-lg font-extrabold sm:text-xl">{stat.value}</dt>
                  <dd className="text-xs font-semibold text-white/70">{stat.label}</dd>
                </div>
              ))}
            </dl>

            <div className="relative mt-7 flex flex-wrap gap-3">
              <Button href={CTA.getApp.href} variant="white" size="lg" icon="ArrowRight">
                Book a pickup
              </Button>
              <Link
                href="/nearby-shops"
                className="inline-flex items-center rounded-full border border-white/40 px-6 py-3 text-base font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700"
              >
                Find pickup shops
              </Link>
            </div>
          </div>

          {/* Right — before the pickup */}
          <div className="bg-[#F3FBF4] p-6 sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Before the pickup</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-brand-ink">Get your device ready</p>
            <ul className="mt-6 space-y-4">
              {READY_TIPS.map((tip) => (
                <li key={tip.title} className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm">
                    <tip.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-brand-ink">{tip.title}</p>
                    <p className="text-sm leading-relaxed text-brand-muted">{tip.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </>
  );
}
