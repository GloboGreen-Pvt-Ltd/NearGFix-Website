import {
  ArrowUpRight,
  Briefcase,
  Globe,
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
  Section,
  SectionHeading,
  cx,
  resolveIcon,
} from '@/components/site/ui';
import { BRAND, CTA, PARTNER_BENEFITS, SUPPORT_TOPICS } from '@/lib/siteContent';

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
    external: true,
    newTab: false,
  },
  {
    key: 'website',
    icon: Globe,
    label: 'Website',
    value: BRAND.website,
    href: BRAND.websiteUrl,
    description: `${BRAND.company} — the company behind ${BRAND.name}, the platform both apps run on.`,
    action: `Visit ${BRAND.website}`,
    external: true,
    newTab: true,
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

const REACH_US = [
  {
    title: 'Repair & sell support',
    lines: [
      { label: 'Call', value: BRAND.phone, href: BRAND.phoneHref },
      { label: 'Email', value: BRAND.email, href: mailWithSubject('Repair / sell query') },
    ],
  },
  {
    title: 'Buy, warranty & returns',
    lines: [
      { label: 'WhatsApp', value: BRAND.whatsapp, href: BRAND.whatsappHref, external: true },
      { label: 'Email', value: BRAND.email, href: mailWithSubject('Buy / warranty / return query') },
    ],
  },
  {
    title: `${BRAND.company}`,
    lines: [
      { label: 'Company', value: `${BRAND.company} — the team behind ${BRAND.name}` },
      { label: 'Website', value: BRAND.website, href: BRAND.websiteUrl, external: true },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function ContactPage() {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="white" className="pb-10 sm:pb-12 lg:pb-14">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div>
            <SectionHeading
              as="h1"
              align="left"
              eyebrow="Contact"
              title="Talk to the NearGFix team"
              subtitle="Whether your phone is sitting on a repair bench right now or you are a shop owner sizing up the platform, you get the same three ways in — phone, WhatsApp and email. A real person at GloboGreen answers all three."
            />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href={BRAND.phoneHref} external size="lg" icon={Phone} iconPosition="left">
                {BRAND.phone}
              </Button>
              <Button
                href={BRAND.whatsappHref}
                external
                target="_blank"
                variant="outline"
                size="lg"
                icon={MessageCircle}
                iconPosition="left"
              >
                Chat on WhatsApp
              </Button>
            </div>

            <p className="mt-6 max-w-prose text-sm leading-relaxed text-brand-muted">
              Looking for the apps? {BRAND.appsStatus} — leave us your number below and we will send
              the link the day they go live.
            </p>
          </div>

          <Card padded={false} hover={false} className="overflow-hidden bg-brand-page">
            <div className="border-b border-brand-line bg-white px-6 py-5 sm:px-8">
              <Badge tone="accent">Who is asking?</Badge>
              <p className="mt-3 text-base leading-relaxed text-brand-ink">
                Three kinds of people write to us. Say which one you are and the reply lands faster.
              </p>
            </div>
            <ul className="divide-y divide-brand-line">
              {ROUTING.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex gap-4 px-6 py-5 sm:px-8">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-brand-ink">
                        {item.title}
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-brand-muted">
                        {item.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Channels                                                          */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="page">
        <SectionHeading
          align="left"
          eyebrow="Direct lines"
          title="Four ways to reach us"
          subtitle="No ticket portal, no queue number. These are the same details printed on every NearGFix invoice."
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map((channel) => {
            const Icon = channel.icon;
            const linkProps = channel.external
              ? { rel: 'noopener noreferrer', ...(channel.newTab ? { target: '_blank' } : {}) }
              : {};
            return (
              <Card key={channel.key} className="flex h-full flex-col">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-700">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-bold tracking-tight text-brand-ink">
                  {channel.label}
                </h3>
                <p className="mt-2 break-words text-base font-semibold text-brand-700">
                  {channel.value}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-brand-muted">
                  {channel.description}
                </p>
                <a
                  href={channel.href}
                  {...linkProps}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-brand-700 transition hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
                >
                  {channel.action}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  {channel.newTab ? <span className="sr-only">(opens in a new tab)</span> : null}
                </a>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Our team                                                          */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="white">
        <SectionHeading eyebrow="Our team" title="Write to the right desk" subtitle="Pick what your message is about — it reaches the person who can help." />

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM_DESKS.map((desk) => {
            const Icon = desk.icon;
            return (
              <li key={desk.title}>
                <a
                  href={mailWithSubject(desk.subject)}
                  className="group flex h-full gap-4 rounded-3xl border border-brand-line bg-brand-page p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#035C6C] to-[#035C6C] text-white shadow-md transition group-hover:scale-105">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-base font-bold tracking-tight text-brand-ink">{desk.title}</span>
                    <span className="mt-1 flex-1 text-sm leading-relaxed text-brand-muted">{desk.description}</span>
                    <span className="mt-3 inline-flex items-center gap-1 break-all text-sm font-semibold text-brand-700">
                      {BRAND.email}
                      <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Need help? + Reach us                                             */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="page">
        <div className="mx-auto max-w-2xl rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-8 text-center text-white shadow-lift sm:px-10">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Need help?</h2>
          <p className="mt-2 text-sm text-white/80">Get a quick response to your query on WhatsApp.</p>
          <a
            href={BRAND.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-bold text-brand-700 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-700"
          >
            <MessageCircle className="h-5 w-5 text-[#25D366]" aria-hidden="true" />
            WhatsApp
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>

        <h2 className="mt-14 text-center text-2xl font-extrabold tracking-tight text-brand-ink sm:text-3xl">Reach us</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {REACH_US.map((block) => (
            <div key={block.title} className="rounded-3xl border border-brand-line bg-white p-6 shadow-soft">
              <h3 className="text-base font-bold tracking-tight text-brand-ink">{block.title}</h3>
              <dl className="mt-4 space-y-3">
                {block.lines.map((line) => (
                  <div key={line.label}>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-brand-muted">{line.label}</dt>
                    <dd className="mt-0.5 break-words text-sm font-semibold">
                      {line.href ? (
                        <a
                          href={line.href}
                          {...(line.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                          className="text-brand-700 hover:underline"
                        >
                          {line.value}
                        </a>
                      ) : (
                        <span className="text-brand-ink">{line.value}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Enquiry form                                                      */}
      {/* ---------------------------------------------------------------- */}
      <Section id="enquiry" tone="white">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Enquiry form"
              title="Send us the details"
              subtitle="Fill this in and we build the message for you — correctly formatted, with everything we need to answer in one reply instead of three."
            />

            <div className="mt-8 rounded-3xl border border-brand-line bg-brand-page p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-brand-700">
                How this form works
              </h3>
              <ol className="mt-4 space-y-4">
                {[
                  'You fill in your name, number, email and what you need.',
                  'We assemble it into a ready-to-send message — nothing leaves your device yet.',
                  'You choose email or WhatsApp, and press send from your own app.',
                ].map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-brand-muted">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 border-t border-brand-line pt-4 text-sm leading-relaxed text-brand-muted">
                This site is a static export with no form inbox behind it. We would rather say that
                plainly than show you a spinner and a “message sent” tick that means nothing.
              </p>
            </div>
          </div>

          <EnquiryForm />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* Support topics                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="page">
        <SectionHeading
          align="left"
          eyebrow="Common questions"
          title="Most things are faster to fix in the app"
          subtitle="Before you write in, these four are worth a look — every one of them is two taps away inside the NearGFix customer app."
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {SUPPORT_TOPICS.map((topic) => {
            const Icon = resolveIcon(topic.icon);
            return (
              <Card key={topic.key} className="flex h-full flex-col">
                <div className="flex items-start gap-4">
                  {Icon ? (
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-600">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                  ) : null}
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-brand-ink">{topic.title}</h3>
                    <p className="mt-2 text-base leading-relaxed text-brand-muted">
                      {topic.description}
                    </p>
                  </div>
                </div>

                {IN_THE_APP[topic.key] ? (
                  <p
                    className={cx(
                      'mt-5 rounded-2xl bg-brand-page px-4 py-3 text-sm leading-relaxed text-brand-ink',
                      'border border-brand-line'
                    )}
                  >
                    <span className="font-bold text-brand-700">In the app: </span>
                    {IN_THE_APP[topic.key]}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>

        <p className="mt-8 max-w-prose text-base leading-relaxed text-brand-muted">
          Still stuck? Customers can also message the shop directly from Chat inside the app — the
          same shop that has your device is on the other end of that thread.
        </p>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* For shop owners                                                   */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="dark">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              inverted
              eyebrow="For shop owners"
              title="Thinking about putting your shop on NearGFix?"
              subtitle="Registering starts a 15-day free trial straight away — no card, no call required. If you would rather talk it through first, that is what this page is for. Tell us how many counters and technicians you run and we will walk you through onboarding, KYC and pickup zones."
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
              {PARTNER_BENEFITS.items.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500"
                    aria-hidden="true"
                  />
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
