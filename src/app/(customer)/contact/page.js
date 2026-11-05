import {
  ArrowUpRight,
  Briefcase,
  GraduationCap,
  Handshake,
  HardHat,
  Headset,
  Layers,
  Mail,
  MessageCircle,
  MessageSquareWarning,
  Phone,
  Smartphone,
  Store,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  Container,
  Section,
  SectionHeading,
  cx,
  resolveIcon,
} from '@/components/site/ui';
import { BRAND, CTA, PARTNER_BENEFITS, SUPPORT_TOPICS } from '@/lib/siteContent';

import { tone, toneOf } from '@/components/site/tones';
import EnquiryForm from './EnquiryForm';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Contact Us – Repair Support & Shop Enquiries',
  description:
    'Call, WhatsApp or email the NearGFix team for help with repairs, pickups, orders, refunds and warranty, or ask about the 15-day free trial for your repair shop.',
  path: '/contact',
});

/* -------------------------------------------------------------------------- */
/* Page-local content                                                          */
/* -------------------------------------------------------------------------- */

const CHANNELS = [
  {
    key: 'call',
    icon: Phone,
    label: 'Call us',
    value: BRAND.phone,
    href: BRAND.phoneHref,
    description:
      'The quickest route for anything urgent — a pickup agent running late, a device you need back today.',
    action: 'Tap to call',
    tone: 'green',
    external: false,
    newTab: false,
  },
  {
    key: 'whatsapp',
    icon: MessageCircle,
    label: 'WhatsApp',
    value: BRAND.whatsapp,
    href: BRAND.whatsappHref,
    description:
      'Best for sending a photo of the damage, an invoice, or a screenshot of the order you are asking about.',
    action: 'Open WhatsApp',
    tone: 'teal',
    external: true,
    newTab: true,
  },
  {
    key: 'email',
    icon: Mail,
    label: 'Email',
    value: BRAND.email,
    href: BRAND.emailHref,
    description:
      'Use this for shop onboarding, KYC documents, billing questions and anything with an attachment.',
    action: 'Write an email',
    tone: 'blue',
    external: true,
    newTab: false,
  },
];

const ROUTING = [
  {
    icon: Smartphone,
    title: 'Customers',
    description:
      'Repair, pickup, sell and buy questions. Have your order number from My Orders ready if it is about an existing job.',
  },
  {
    icon: Store,
    title: 'Shop owners',
    description:
      'Onboarding, the 15-day free trial, extra shops and KYC. Tell us your shop name and city and we will set you up.',
  },
  {
    icon: HardHat,
    title: 'Technicians & staff',
    description:
      'Login trouble, attendance, KYC uploads or payslips. Your shop owner can also fix most of this from the Settings tab.',
  },
];

const FORM_STEPS = [
  'You fill in your name, number, email and what you need.',
  'We assemble it into a ready-to-send message — nothing leaves your device yet.',
  'You choose email or WhatsApp, and press send from your own app.',
];

/* One-line, in-app answers for each SUPPORT_TOPICS entry, keyed by topic key. */
const IN_THE_APP = {
  'track-order': 'Profile → My Orders → pick the Repair, Pickup, Buy or Sell tab, then open the order for its live timeline.',
  refund: 'Profile → My Orders → open the cancelled or returned order; the refund state sits on the order timeline.',
  'return-cancel': 'Profile → My Orders → open the order and use Cancel before it is picked up, or message the shop from Chat.',
  warranty: 'Profile → My Orders → open the completed job and check the service receipt and invoice for its warranty terms.',
};

/* "Our team" desks. NearGFix has one support inbox today, so every desk mails it
 * with a pre-filled subject that routes the message to the right person. */
const mailWithSubject = (subject) => `${BRAND.emailHref}?subject=${encodeURIComponent(subject)}`;

const TEAM_DESKS = [
  {
    icon: Headset,
    title: 'Customer Inquiry',
    description: 'For any question about a repair, pickup, price or an order you have placed.',
    subject: 'Customer inquiry',
  },
  {
    icon: MessageSquareWarning,
    title: 'Feedback & Escalations',
    description: 'Complaints, escalations or suggestions — tell us what went wrong or what we can do better.',
    subject: 'Feedback / escalation',
  },
  {
    icon: Layers,
    title: 'Bulk Selling',
    description: 'Selling several devices at once and want a single, customised quote? Write to us.',
    subject: 'Bulk selling enquiry',
  },
  {
    icon: Handshake,
    title: 'NearGFix Partner Program',
    description: 'Run a repair shop and want to join NearGFix? Ask about onboarding and the 15-day free trial.',
    subject: 'Partner program — shop onboarding',
  },
  {
    icon: Briefcase,
    title: 'Business Inquiry',
    description: 'Press, media, partnerships, exchange and buyback programs.',
    subject: 'Business inquiry',
  },
  {
    icon: GraduationCap,
    title: 'Job Inquiry',
    description: `Want to build ${BRAND.name} with us? Send your resume and the role you are interested in.`,
    subject: 'Job inquiry',
  },
];

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function ContactPage() {
  return (
    <>
      {/* 1 — Hero with the three direct lines ------------------------------ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#035C6C] via-[#05366E] to-[#1559C7] text-white">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#01AC77]/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-[#F79009]/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute right-1/3 top-10 h-56 w-56 rounded-full bg-[#E31B54]/15 blur-3xl" aria-hidden="true" />
        <Container className="relative py-14 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#C7E6EA]">
              <Headset className="h-3.5 w-3.5" aria-hidden="true" />
              Contact
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Talk to the {BRAND.name} team
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
              Whether your phone is on a repair bench right now or you are a shop owner sizing up the
              platform — call, WhatsApp or email. A real person answers all three.
            </p>
          </div>

          <ul className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
            {CHANNELS.map((channel) => {
              const Icon = channel.icon;
              const t = toneOf(channel.tone);
              const linkProps = channel.external
                ? { rel: 'noopener noreferrer', ...(channel.newTab ? { target: '_blank' } : {}) }
                : {};
              return (
                <li key={channel.key}>
                  <a
                    href={channel.href}
                    {...linkProps}
                    className={cx('group relative flex h-full flex-col overflow-hidden rounded-3xl p-6 shadow-lift ring-1 ring-white/20 transition motion-safe:hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700', t.chip)}
                  >
                    <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15" aria-hidden="true" />
                    <span className="flex items-center justify-between">
                      <span className={cx('inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md transition group-hover:scale-105', t.text)}>
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <ArrowUpRight className="h-5 w-5 text-white/70 transition group-hover:text-white" aria-hidden="true" />
                    </span>
                    <span className="mt-5 text-xs font-bold uppercase tracking-wider text-white/80">{channel.label}</span>
                    <span className="mt-1 break-words text-xl font-extrabold tracking-tight">{channel.value}</span>
                    <span className="mt-2 flex-1 text-sm leading-relaxed text-white/85">{channel.description}</span>
                    <span className={cx('mt-4 inline-flex w-fit items-center rounded-full bg-white px-4 py-1.5 text-sm font-bold', t.text)}>{channel.action}</span>
                    {channel.newTab ? <span className="sr-only">(opens in a new tab)</span> : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* 2 — Enquiry form + who is asking ---------------------------------- */}
      <Section id="enquiry" tone="page" className="bg-gradient-to-br from-[#E7F8F1] via-white to-[#EEF4FF]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
          <div className="min-w-0">
            <SectionHeading
              align="left"
              eyebrow="Enquiry form"
              title="Send us the details"
              subtitle="Fill this in and we build the message for you — with everything we need to answer in one reply instead of three."
            />
            <div className="mt-8">
              <EnquiryForm />
            </div>
          </div>

          <aside className="space-y-5 lg:pt-2">
            <Card padded={false} hover={false} className="overflow-hidden">
              <div className="border-b border-[#D9CFFD] bg-[#F4F1FF] px-6 py-5">
                <Badge tone="accent">Who is asking?</Badge>
                <p className="mt-3 text-sm leading-relaxed text-brand-muted">
                  Say which one you are and the reply lands faster.
                </p>
              </div>
              <ul className="divide-y divide-brand-line">
                {ROUTING.map((item, i) => {
                  const Icon = item.icon;
                  const t = tone(i + 3);
                  return (
                    <li key={item.title} className="flex gap-4 px-6 py-4">
                      <span className={cx('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm', t.chip)}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="text-base font-bold tracking-tight text-brand-ink">{item.title}</h2>
                        <p className="mt-1 text-sm leading-relaxed text-brand-muted">{item.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <div className="rounded-3xl border border-[#FEDF89] bg-[#FFF6E8] p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#B54708]">How this form works</h3>
              <ol className="mt-4 space-y-3">
                {FORM_STEPS.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F79009] text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-brand-muted">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </Section>

      {/* 3 — Desks ----------------------------------------------------------- */}
      <Section tone="white" className="bg-gradient-to-b from-white via-[#FFF6E8]/60 to-white">
        <SectionHeading
          eyebrow="Our team"
          title="Write to the right desk"
          subtitle="Pick what your message is about — the subject line routes it to the person who can help."
        />

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM_DESKS.map((desk, i) => {
            const Icon = desk.icon;
            const t = tone(i);
            return (
              <li key={desk.title}>
                <a
                  href={mailWithSubject(desk.subject)}
                  className={cx(
                    'group flex h-full items-start gap-4 rounded-3xl border p-5 transition hover:shadow-lift motion-safe:hover:-translate-y-0.5',
                    t.ring,
                    t.soft,
                    FOCUS,
                  )}
                >
                  <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-md transition group-hover:scale-105', t.chip)}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center justify-between gap-2 text-base font-bold tracking-tight text-brand-ink">
                      {desk.title}
                      <ArrowUpRight className={cx('h-4 w-4 shrink-0 transition', t.text)} aria-hidden="true" />
                    </span>
                    <span className="mt-1 text-sm leading-relaxed text-brand-muted">{desk.description}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 4 — Self-help -------------------------------------------------------- */}
      <Section tone="page" className="bg-gradient-to-br from-[#FFF1F3] via-white to-[#F4F1FF]">
        <SectionHeading
          eyebrow="Common questions"
          title="Most things are faster in the app"
          subtitle="Before you write in, these four are two taps away inside the NearGFix customer app."
        />

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {SUPPORT_TOPICS.map((topic, i) => {
            const Icon = resolveIcon(topic.icon);
            const t = tone(i + 1);
            return (
              <Card key={topic.key} className={cx('relative flex h-full flex-col overflow-hidden')}>
                <span className={cx('absolute inset-x-0 top-0 h-1.5', t.bar)} aria-hidden="true" />
                <div className="flex items-start gap-4">
                  {Icon ? (
                    <span className={cx('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-md', t.chip)}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                  ) : null}
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-brand-ink">{topic.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">{topic.description}</p>
                  </div>
                </div>
                {IN_THE_APP[topic.key] ? (
                  <p className={cx('mt-5 rounded-2xl border px-4 py-3 text-sm leading-relaxed text-brand-ink', t.ring, t.soft)}>
                    <span className={cx('font-bold', t.text)}>In the app: </span>
                    {IN_THE_APP[topic.key]}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-prose text-center text-sm leading-relaxed text-brand-muted">
          Still stuck? Customers can also message the shop directly from Chat inside the app — the
          same shop that has your device is on the other end of that thread.
        </p>
        <div className="mt-6 flex justify-center">
          <Button href="/faq" variant="outline" icon="ArrowRight">
            Read all FAQs
          </Button>
        </div>
      </Section>

      {/* 5 — For shop owners -------------------------------------------------- */}
      <Section tone="dark" className="bg-gradient-to-br from-[#05366E] via-[#035C6C] to-[#047857]">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              inverted
              eyebrow="For shop owners"
              title="Thinking about putting your shop on NearGFix?"
              subtitle="Registering starts a 15-day free trial straight away — no card, no call required. Prefer to talk first? Tell us how many counters and technicians you run and we will walk you through onboarding, KYC and pickup zones."
            />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href={CTA.forShops.href} variant="white" size="lg" icon="ArrowRight">
                See what the shop app does
              </Button>
              <Button
                href={CTA.seePricing.href}
                size="lg"
                className="border border-white/40 bg-transparent text-white hover:bg-white/10"
              >
                {CTA.seePricing.label}
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/5 p-6 sm:p-8">
            <h3 className="text-xl font-bold tracking-tight text-white">{PARTNER_BENEFITS.title}</h3>
            <ul className="mt-6 space-y-4">
              {PARTNER_BENEFITS.items.map((item, i) => (
                <li key={item} className="flex items-start gap-3">
                  <span className={cx('mt-1.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-white/30', tone(i + 1).bar)} aria-hidden="true" />
                  <span className="text-base leading-relaxed text-brand-100">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-white/15 pt-5 text-sm leading-relaxed text-brand-100">
              Onboarding enquiries go to{' '}
              <a
                href={BRAND.emailHref}
                className="font-semibold text-white underline underline-offset-4 transition hover:text-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900"
              >
                {BRAND.email}
              </a>{' '}
              or {BRAND.phone}.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
