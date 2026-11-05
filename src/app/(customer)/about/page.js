/**
 * /about — who NearGFix is and what it does, written for customers first.
 *
 * Static server component. Facts come from siteContent.js (ABOUT, ABOUT_VALUES,
 * PLATFORM_FACTS, BRAND) so numbers never drift from the rest of the site.
 */

import Link from '@/components/PortalLink';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ClipboardList,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  ShoppingCart,
  Smartphone,
  Store,
  Tag,
  Truck,
  UserCog,
  Users,
  Wrench,
} from 'lucide-react';

import { Button, Container, Section, SectionHeading, cx, resolveIcon } from '@/components/site/ui';
import { ABOUT, ABOUT_VALUES, BRAND, CTA, PLATFORM_FACTS } from '@/lib/siteContent';
import { pageMetadata } from '@/lib/seo';
import { tone, toneOf } from '@/components/site/tones';

export const metadata = pageMetadata({
  title: 'About Us – Device Repair, Buy & Sell Platform',
  description:
    'NearGFix by Globogreen connects you with verified repair shops to repair, buy and sell mobiles, tablets and laptops, with doorstep pickup and live tracking.',
  path: '/about',
});

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

const SERVICES = [
  { icon: Wrench, title: 'Repair', text: 'Book a repair for your exact model and approve the price first.', href: '/repair' },
  { icon: Truck, title: 'Pickup & Delivery', text: 'A nearby shop collects your device and brings it back fixed.', href: '/pickup-delivery' },
  { icon: Tag, title: 'Sell', text: 'List your old device once and let nearby shops send offers.', href: '/#sell' },
  { icon: ShoppingCart, title: 'Buy', text: 'Refurbished devices and accessories from verified local shops.', href: '/#buy' },
];

const AUDIENCE = [
  {
    icon: Users,
    title: 'Customers',
    text: 'Find a shop nearby, book a repair or pickup, sell or buy a device — and track every order in one app.',
  },
  {
    icon: Store,
    title: 'Shop owners',
    text: 'Run the counter, bookings, invoices, staff and inventory from the NearGFix Shop app.',
    href: '/shop',
  },
  {
    icon: UserCog,
    title: 'Technicians',
    text: 'See assigned jobs, update the status, add repair notes and photos as the work moves.',
  },
];

/* Registered office as stated in the NearGFix legal documents. */
const REGISTERED_OFFICE = 'No. 1/16, South Street, Villiyanallur, Bhuvanagiri Taluk, Tamil Nadu, India';

const CONTACTS = [
  { icon: Phone, label: 'Call us', value: BRAND.phone, href: BRAND.phoneHref },
  { icon: MessageCircle, label: 'WhatsApp', value: BRAND.whatsapp, href: BRAND.whatsappHref, external: true },
  { icon: Mail, label: 'Email', value: BRAND.email, href: BRAND.emailHref },
];

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function AboutPage() {
  return (
    <>
      {/* 1 — Hero ----------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-brand-line bg-gradient-to-b from-[#E5F3F5] to-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-200/40 blur-3xl" aria-hidden="true" />
        <Container className="relative py-14 sm:py-16 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
            <div>
              <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-700 shadow-soft">
                About {BRAND.name}
              </span>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-brand-ink sm:text-5xl">
                Device care made <span className="text-brand-700">simple, honest</span> and close to home.
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-brand-muted">
                {BRAND.name} by {BRAND.company} connects you with trusted repair shops near you — to repair, sell or buy a device, with doorstep pickup and live tracking.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href={CTA.getApp.href} variant="primary" size="lg" icon="ArrowRight">
                  {CTA.getApp.label}
                </Button>
                <Button href="/nearby-shops" variant="outline" size="lg">
                  Find nearby shops
                </Button>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:gap-4">
              {PLATFORM_FACTS.map((fact, i) => {
                const filled = true;
                const t = [toneOf('teal'), toneOf('green'), toneOf('orange'), toneOf('navy')][i % 4];
                return (
                  <div key={fact.label} className={cx('flex flex-col rounded-3xl p-5 shadow-soft sm:p-6', t.chip)}>
                    <dt className={cx('order-2 mt-2 text-sm font-semibold leading-snug', filled ? 'text-white/75' : 'text-brand-muted')}>{fact.label}</dt>
                    <dd className="order-1 flex flex-wrap items-baseline gap-x-1">
                      <span className={cx('text-3xl font-extrabold tracking-tight sm:text-4xl', filled ? 'text-white' : 'text-brand-ink')}>{fact.value}</span>
                      <span className={cx('text-base font-bold', filled ? 'text-[#C7E6EA]' : 'text-brand-700')}>{fact.unit}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </Container>
      </section>

      {/* 2 — Our story ------------------------------------------------------- */}
      <Section tone="white">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            <SectionHeading align="left" eyebrow="Why we built it" title={ABOUT.headline} />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-brand-muted">
              <p>{ABOUT.body[0]}</p>
              <p>{ABOUT.body[2]}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-brand-line bg-[#FFF8F1] p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#DC6803] shadow-sm">
                  <NotebookPen className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#B54708]">Before</p>
              </div>
              <p className="mt-4 text-lg font-extrabold tracking-tight text-brand-ink">Guesswork on both sides of the counter</p>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                Shops ran on a notebook and a WhatsApp group. Customers handed over their phone and waited, with no idea what was happening to it.
              </p>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-lift sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-brand-700">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#C7E6EA]">With {BRAND.name}</p>
              </div>
              <p className="mt-4 text-lg font-extrabold tracking-tight">One system, everyone in the loop</p>
              <p className="mt-2 text-sm leading-relaxed text-white/80">{ABOUT.body[1].split('. ').slice(-1)[0]}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* 3 — What you can do ------------------------------------------------- */}
      <Section tone="page">
        <SectionHeading eyebrow="What we do" title="Everything for your device, in one place" />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s, i) => (
            <li key={s.title}>
              <Link
                href={s.href}
                className={cx(
                  'group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-white p-6 shadow-soft transition hover:shadow-lift motion-safe:hover:-translate-y-1',
                  tone(i).ring,
                  FOCUS,
                )}
              >
                <span className={cx('absolute inset-x-0 top-0 h-1.5', tone(i).bar)} aria-hidden="true" />
                <span className={cx('inline-flex h-12 w-12 items-center justify-center rounded-2xl shadow-md transition group-hover:scale-105', tone(i).chip)}>
                  <s.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-bold tracking-tight text-brand-ink">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-muted">{s.text}</p>
                <span className={cx('mt-4 inline-flex items-center gap-1 text-sm font-bold', tone(i).text)}>
                  Learn more
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* 4 — What we believe -------------------------------------------------- */}
      <Section tone="dark">
        <SectionHeading inverted eyebrow="What we believe" title="Promises you can see in the app" />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {ABOUT_VALUES.map((value, i) => {
            const Icon = resolveIcon(value.icon);
            return (
              <div key={value.title} className="relative rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10 sm:p-7">
                <span className="absolute right-6 top-6 text-4xl font-extrabold text-white/10" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={cx('inline-flex h-12 w-12 items-center justify-center rounded-2xl shadow-md', tone(i + 1).chip)}>
                  {Icon ? <Icon className="h-6 w-6" aria-hidden="true" /> : null}
                </span>
                <h3 className="mt-5 text-lg font-bold tracking-tight text-white">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-100">{value.description}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 5 — Who it is for ---------------------------------------------------- */}
      <Section tone="white">
        <SectionHeading eyebrow="Who it is for" title="Built for everyone around the repair" />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {AUDIENCE.map((a, i) => (
            <div key={a.title} className={cx('flex flex-col rounded-3xl border p-6 sm:p-7', tone(i + 2).ring, tone(i + 2).soft)}>
              <span className={cx('flex h-12 w-12 items-center justify-center rounded-2xl shadow-md', tone(i + 2).chip)}>
                <a.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-xl font-extrabold tracking-tight text-brand-ink">{a.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-muted">{a.text}</p>
              {a.href ? (
                <Link href={a.href} className={cx('mt-4 inline-flex items-center gap-1 self-start rounded text-sm font-bold text-brand-700 hover:underline', FOCUS)}>
                  NearGFix for shops
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      {/* 6 — Company + talk to us -------------------------------------------- */}
      <Section tone="page">
        <div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 p-6 text-white shadow-lift sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#C7E6EA]">
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                {BRAND.appsStatus}
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Say hello to the {BRAND.company} team</h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-white/80">
                Questions, feedback, or a shop you want on {BRAND.name}? We would love to hear from you.
              </p>
              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-white/10 p-4">
                <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[#C7E6EA]" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-white/85">
                  <span className="block font-bold text-white">{BRAND.company}</span>
                  Registered office: {REGISTERED_OFFICE}
                </p>
              </div>
              <div className="mt-6">
                <Button href={CTA.contact.href} variant="white" size="lg" icon="ArrowRight">
                  {CTA.contact.label}
                </Button>
              </div>
            </div>
            <ul className="grid gap-3">
              {CONTACTS.map((c, i) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="group flex items-center gap-4 rounded-2xl bg-white p-4 text-brand-ink transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md', [toneOf('green'), toneOf('teal'), toneOf('blue')][i % 3].chip)}>
                      <c.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">{c.label}</span>
                      <span className="block truncate text-base font-bold text-brand-700">{c.value}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-brand-muted transition group-hover:text-brand-700" aria-hidden="true" />
                    {c.external ? <span className="sr-only">(opens in a new tab)</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </>
  );
}
