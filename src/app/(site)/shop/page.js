import {
  BadgeCheck,
  Boxes,
  Building2,
  CalendarClock,
  Check,
  ClipboardList,
  Handshake,
  HardHat,
  IndianRupee,
  Lock,
  Package,
  QrCode,
  ScanLine,
  Smartphone,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CheckList,
  CTABand,
  FeatureCard,
  Section,
  SectionHeading,
  StatTile,
  StepList,
} from '@/components/site/ui';

import {
  BRAND,
  CTA,
  MULTI_SHOP_PRICING,
  PARTNER_BENEFITS,
  PLANS,
  PRICING_NOTE,
  SHOP_DASHBOARD_STATS,
  SHOP_FEATURES,
  SHOP_QUICK_ACTIONS,
  SHOP_TABS,
  TICKET_LIFECYCLE,
} from '@/lib/siteContent';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Mobile Repair Shop Management Software',
  description:
    'Run your repair shop on NearGFix: bookings with IMEI and QR intake, technicians, staff attendance, doorstep pickup, invoices and multi-shop control. Free trial.',
  path: '/shop',
});

const freeTrial = PLANS.find((plan) => plan.key === 'free-trial');
const basic = PLANS.find((plan) => plan.key === 'basic');

/**
 * Facts for a shop owner sizing up the trial.
 *
 * Deliberately NOT the shared PLATFORM_FACTS: its "20 km discovery radius" tile
 * is a customer-app fact and its "12 backend services" tile is architecture
 * trivia — neither answers anything an owner is asking on this page. These four
 * restate only what /pricing already commits to.
 */
const SHOP_FACTS = [
  { value: '15', unit: 'days', label: 'Free trial, auto-granted the moment you register' },
  { value: '6', unit: 'stages', label: 'On every ticket, from Service Accepted to Delivered' },
  { value: '₹0', label: 'Commission taken on any repair, sale or booking' },
  { value: '1', unit: 'login', label: 'For every shop you run, with multi-shop switching' },
];

const TRIAL_POINTS = [
  {
    icon: CalendarClock,
    title: '15 days, starting the day you register',
    description:
      'The trial is granted automatically when you create your shop owner account. Nothing to apply for, nothing to activate.',
  },
  {
    icon: IndianRupee,
    title: '₹0, and no card required',
    description:
      'There is no payment gateway on NearGFix at all. You will never be asked for card details to begin, and nothing auto-charges when the trial ends.',
  },
  {
    icon: BadgeCheck,
    title: 'A real shop, not a sandbox',
    description:
      'Take live bookings, print real invoices and add real staff during the trial. What you enter stays in your shop when you move to Basic.',
  },
];

const INTAKE_STEPS = [
  {
    icon: ScanLine,
    title: 'Scan the IMEI or the QR code',
    description:
      'The wizard identifies the handset and auto-fills brand and model. If the scan cannot read it, the manual category → brand → series → model → variant picker is right there.',
  },
  {
    icon: Smartphone,
    title: 'Colour and storage',
    description: 'Pin down the exact variant on the bench so the ticket matches the device.',
  },
  {
    icon: ClipboardList,
    title: 'Device information',
    description: 'Condition notes and anything the customer says at the counter, captured once.',
  },
  {
    icon: Lock,
    title: 'Device security',
    description:
      'Record the unlock PIN or pattern up front, so your technician is not calling the customer back at 7pm.',
  },
  {
    icon: Package,
    title: 'Missing parts',
    description:
      'Log what did not come in with the device — back cover, SIM tray, battery — before it becomes an argument.',
  },
  {
    icon: Wrench,
    title: 'Services required',
    description: 'Pick the repairs the job actually needs from your service list.',
  },
  {
    icon: IndianRupee,
    title: 'Price estimate',
    description:
      'Quote it on the spot. The customer approves the estimate in their app before work begins.',
  },
  {
    icon: Users,
    title: 'Customer details',
    description: 'Name and contact against the ticket, so every update reaches the right person.',
  },
  {
    icon: HardHat,
    title: 'Assign a technician',
    description:
      'Set the technician and the booking status, hit save, and the job appears in that technician’s own app view.',
  },
];

const GROWTH_CARDS = [
  {
    icon: Truck,
    title: 'Doorstep pickup jobs',
    description:
      'Customers within a 20 km radius can book a pickup-enabled shop to collect the device from their address. Pickup requests arrive as their own queue with list and detail views.',
    points: [
      'You define the pickup zones you will travel to',
      'You define the slot timings you will collect in',
      'Assign a pickup person and track the collection',
    ],
    tone: 'brand',
  },
  {
    icon: Handshake,
    title: 'Sell quotations from nearby customers',
    description:
      'When someone lists a handset for sale, their device details, condition answers and photos go out to nearby shops. You quote, they compare, and the best offer wins the device.',
    points: [
      'Full condition report before you quote',
      'Real photos uploaded by the customer',
      'Buy stock without leaving the counter',
    ],
    tone: 'accent',
  },
  {
    icon: Boxes,
    title: 'Marketplace and inventory',
    description:
      'Track your stock, and buy or sell spare parts and gadgets through the in-app marketplace with listings, orders and a cart — the same catalogue your customers browse in the Buy tab.',
    points: [
      'Spare parts and gadgets, both directions',
      'Listings, orders and cart built in',
      'Inventory management alongside it',
    ],
    tone: 'brand',
  },
];

const GETTING_STARTED = [
  {
    title: 'Register your shop',
    description:
      'Create your owner account with your shop name, mobile number and address. It takes a few minutes.',
    icon: 'Store',
  },
  {
    title: 'Your 15-day trial starts automatically',
    description:
      'No activation step, no card. You are on the Free Trial from the moment the account exists.',
    icon: 'Sparkles',
  },
  {
    title: 'Complete KYC',
    description:
      'Upload Aadhar and PAN, plus either a GST certificate or an Udyam registration — one of the two is enough. The app walks you through intro, upload, review, pending and view.',
    icon: 'ShieldCheck',
  },
  {
    title: 'Add your employees',
    description:
      'Add staff and technicians so they can log in, take geofenced attendance and pick up assigned tickets. Up to 3 per shop on the trial, unlimited on Basic.',
    icon: 'Users',
  },
  {
    title: 'Take your first booking',
    description:
      'Open New Booking, scan the IMEI, quote the job and assign a technician. That is the whole loop — everything after it is reporting.',
    icon: 'ClipboardList',
    highlight: true,
  },
];

export default function ShopPage() {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* 1. Hero                                                           */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="white" className="overflow-hidden">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div>
            <SectionHeading
              as="h1"
              align="left"
              eyebrow="For repair shops"
              title={
                <>
                  Run your repair shop on{' '}
                  <span className="text-brand-600">NearGFix</span>
                </>
              }
              subtitle="A multi-tenant SaaS for mobile repair shops — Shopify-like, but built around repairs. Bookings, technicians, employees, doorstep pickup, inventory and invoicing in one app, with a customer app on the other side of every job."
              className="[&_h1]:text-4xl [&_h1]:font-extrabold sm:[&_h1]:text-5xl lg:[&_h1]:text-6xl"
            />

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button href={CTA.startTrial.href} size="lg" icon="ArrowRight">
                Start your 15-day free trial
              </Button>
              <Button href={CTA.seePricing.href} variant="outline" size="lg">
                See pricing
              </Button>
            </div>

            <div className="mt-8 rounded-3xl border border-brand-line bg-brand-page p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
                {PARTNER_BENEFITS.title}
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {PARTNER_BENEFITS.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-sm font-medium text-brand-ink"
                  >
                    <Check className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 text-sm text-brand-muted">
              {BRAND.shopAppName} — {BRAND.appsStatus}.
            </p>
          </div>

          {/* Shop app sketch — labels only, no invented numbers */}
          <div className="relative">
            <div
              className="absolute -inset-4 -z-10 rounded-4xl bg-gradient-to-br from-brand-100 via-brand-50 to-accent-50 blur-xl"
              aria-hidden="true"
            />
            <Card
              hover={false}
              padded={false}
              className="overflow-hidden rounded-4xl shadow-lift"
            >
              <div className="flex items-center justify-between gap-3 border-b border-brand-line bg-white px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brand-ink">
                    {BRAND.shopAppName}
                  </p>
                  <p className="truncate text-xs text-brand-muted">Owner dashboard</p>
                </div>
                <Badge tone="brand">Multi-shop</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b border-brand-line bg-brand-page px-4 py-4 sm:gap-3 sm:px-6">
                {SHOP_DASHBOARD_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="min-w-0 rounded-2xl border border-brand-line bg-white px-2 py-3 text-center sm:px-3"
                  >
                    <p className="text-sm font-bold text-brand-ink sm:text-base">{stat.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-brand-muted">{stat.hint}</p>
                  </div>
                ))}
              </div>

              <div className="px-5 py-5 sm:px-6">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-muted">
                  Quick actions
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SHOP_QUICK_ACTIONS.map((action) => (
                    <li
                      key={action}
                      className="rounded-2xl bg-brand-soften px-3 py-2.5 text-xs font-semibold text-brand-ink sm:text-sm"
                    >
                      {action}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Six labels in a non-wrapping row cleared 360px by only a few
                  px; wrapping removes the clipping risk on narrow phones. */}
              <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5 border-t border-brand-line bg-white px-3 py-3 sm:justify-between sm:px-4">
                {SHOP_TABS.map((tab, index) => (
                  <span
                    key={tab}
                    className={
                      index === 0
                        ? 'rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand-700 sm:text-xs'
                        : 'px-1 text-[11px] font-medium text-brand-muted sm:px-2 sm:text-xs'
                    }
                  >
                    {tab}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 2. Free trial callout                                             */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="soft" id="free-trial">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="No card, no catch"
              title="15 days free, granted the moment you register"
              subtitle={freeTrial.summary}
            />
            <div className="mt-8">
              <CheckList
                items={[
                  ...freeTrial.bullets,
                  ...freeTrial.excluded.map((label) => ({ label, excluded: true })),
                ]}
              />
            </div>
            <p className="mt-6 max-w-prose text-sm leading-relaxed text-brand-muted">
              Those are the honest limits of the trial: {freeTrial.price} {freeTrial.priceNote}, up
              to 2 shops, up to 3 employees per shop and up to 5 Sell orders. Doorstep Pickup Service
              is a Basic-plan feature and is not part of the trial.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href={CTA.startTrial.href} icon="ArrowRight">
                {CTA.startTrial.label}
              </Button>
              <Button href={CTA.talkToSales.href} variant="ghost">
                {CTA.talkToSales.label}
              </Button>
            </div>
          </div>

          <ul className="grid gap-4 sm:gap-5">
            {TRIAL_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.title}>
                  <Card className="flex h-full gap-4 sm:gap-5">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-brand-ink sm:text-lg">
                        {point.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-brand-muted sm:text-base">
                        {point.description}
                      </p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {SHOP_FACTS.map((fact) => (
            <StatTile key={fact.label} value={fact.value} unit={fact.unit} label={fact.label} />
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 3. Everything in one app                                          */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="page" id="features">
        <SectionHeading
          eyebrow="Everything in one app"
          title="The whole shop, not just a booking form"
          subtitle="Twelve capability groups shipping in the NearGFix shop app today — from the counter to the payroll report at the end of the month."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SHOP_FEATURES.map((feature) => (
            <FeatureCard
              key={feature.key}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              points={feature.points}
            />
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 4. The booking pipeline                                           */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="dark" id="pipeline">
        <SectionHeading
          inverted
          eyebrow="The booking pipeline"
          title="Six statuses. Everyone sees the same one."
          subtitle="A NearGFix ticket moves through a fixed lifecycle. Your technician updates it, your customer watches it move in their app, and your dashboard counts it — so nobody has to ring the shop to ask where the phone is."
        />

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {TICKET_LIFECYCLE.map((stage, index) => (
            <li
              key={stage.status}
              className="relative flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 transition motion-safe:hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-extrabold text-brand-800">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold text-white">{stage.status}</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-100">{stage.description}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-col gap-4 rounded-3xl border border-accent-400/40 bg-accent-500/10 p-6 sm:flex-row sm:items-center sm:gap-6">
          <Badge tone="accent" className="self-start">
            Work Pending
          </Badge>
          <p className="text-sm leading-relaxed text-brand-100 sm:text-base">
            There is a seventh state that is not a step: <strong className="font-semibold text-white">Work Pending</strong>{' '}
            parks a quoted job while it waits for the customer to approve the estimate — so unapproved
            work never gets counted as active, and never gets started by mistake.
          </p>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 5. Intake in under a minute                                       */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="white" id="intake">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              align="left"
              eyebrow="Counter workflow"
              title="Intake in under a minute"
              subtitle="The New Booking wizard is the screen your staff will live in. It is nine short steps, and the first one does most of the typing for you."
            />

            <div className="mt-8 rounded-3xl border border-accent-200 bg-accent-50 p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-accent-600 shadow-soft">
                  <ScanLine className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-accent-600 shadow-soft">
                  <QrCode className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-brand-ink">Identify the device by scan</h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-ink/80">
                Scan the IMEI or a QR code and NearGFix looks the handset up against its master device
                catalogue, then selects the brand and model for you. No model numbers typed at the
                counter, no wrong variant on the ticket. If the lookup cannot find it, the manual
                picker takes over — the booking never gets stuck.
              </p>
            </div>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2">
            {INTAKE_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="flex h-full flex-col rounded-3xl border border-brand-line bg-brand-page p-5 transition motion-safe:hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft sm:p-6"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <Icon className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-brand-ink">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-brand-muted">
                    {step.description}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 6. Grow with pickup + marketplace                                 */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="page" id="growth">
        <SectionHeading
          eyebrow="More than walk-ins"
          title="Work that comes to you"
          subtitle="A NearGFix shop is listed in the customer app. Repairs, doorstep pickups and sell quotations all arrive from people nearby who were never going to walk past your shutter."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {GROWTH_CARDS.map((card) => (
            <FeatureCard
              key={card.title}
              icon={card.icon}
              title={card.title}
              description={card.description}
              points={card.points}
              tone={card.tone}
            />
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-prose text-center text-sm leading-relaxed text-brand-muted">
          Doorstep Pickup Service is included on the Basic plan. Buying on the marketplace is
          unlimited on both plans; selling is capped at 5 orders during the free trial.
        </p>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 7. Pricing snapshot                                               */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="white" id="pricing">
        <SectionHeading
          eyebrow="Pricing"
          title="Two plans. That is the entire price list."
          subtitle="No per-booking fee, no commission on repairs, no seat pricing. Start free, then ₹3,000 a year for a shop."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {PLANS.map((plan) => (
            <Card
              key={plan.key}
              className={
                plan.highlight
                  ? 'flex h-full flex-col border-brand-600 ring-1 ring-brand-600'
                  : 'flex h-full flex-col'
              }
            >
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-bold tracking-tight text-brand-ink">{plan.name}</h3>
                {plan.badge ? <Badge tone="accent">{plan.badge}</Badge> : null}
              </div>

              <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
                <span className="text-4xl font-extrabold tracking-tight text-brand-ink">
                  {plan.price}
                </span>
                <span className="text-sm font-medium text-brand-muted">{plan.priceNote}</span>
              </p>

              {plan.secondaryPrice ? (
                <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-accent-600">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {plan.secondaryPrice}
                </p>
              ) : null}

              <p className="mt-4 text-sm leading-relaxed text-brand-muted sm:text-base">
                {plan.summary}
              </p>

              <div className="mt-6 flex-1">
                <CheckList
                  size="sm"
                  items={[
                    ...plan.bullets,
                    ...plan.excluded.map((label) => ({ label, excluded: true })),
                  ]}
                />
              </div>

              <div className="mt-8">
                <Button
                  href={plan.cta.href}
                  variant={plan.highlight ? 'primary' : 'outline'}
                  className="w-full"
                  icon="ArrowRight"
                >
                  {plan.cta.label}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-brand-line bg-brand-page p-6 sm:p-8">
          <h3 className="text-lg font-bold text-brand-ink">
            ₹2,500 per shop per year from your second shop
          </h3>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {MULTI_SHOP_PRICING.map((row) => (
              <li
                key={row.shops}
                className="rounded-2xl border border-brand-line bg-white px-4 py-4 text-center"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                  {row.label}
                </p>
                <p className="mt-1 text-xl font-extrabold tracking-tight text-brand-ink">
                  {row.price}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-prose text-sm leading-relaxed text-brand-muted">{PRICING_NOTE}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button href={CTA.seePricing.href} variant="outline" icon="ArrowRight">
              See the full comparison
            </Button>
            <Button href={CTA.talkToSales.href} variant="ghost">
              {CTA.talkToSales.label}
            </Button>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 8. Getting started                                                */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="soft" id="getting-started">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Getting started"
              title="From registration to your first booking"
              subtitle="Five steps, in order. Most shops are taking real bookings the same day they sign up."
            />
            <div className="mt-8 rounded-3xl border border-brand-line bg-white p-6">
              <p className="text-sm font-bold uppercase tracking-widest text-brand-700">
                KYC documents
              </p>
              <p className="mt-3 text-sm leading-relaxed text-brand-muted">
                Aadhar and PAN are both required. On top of those you need either a GST certificate
                or an Udyam registration — either one satisfies the requirement.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-brand-muted">
                Questions before you register? Call {BRAND.phone} or email{' '}
                <a
                  href={BRAND.emailHref}
                  className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
                >
                  {BRAND.email}
                </a>
                .
              </p>
            </div>
          </div>

          <StepList steps={GETTING_STARTED} />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      {/* 9. Closing CTA                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Section tone="page">
        <CTABand
          title="Put your shop on NearGFix this week"
          subtitle={`Register today and the 15-day free trial starts on its own. After that, ${basic.name} is ${basic.price} ${basic.priceNote}. There is no online checkout — talk to us and we will set it up.`}
          primary={CTA.startTrial}
          secondary={CTA.talkToSales}
        />
      </Section>
    </>
  );
}
