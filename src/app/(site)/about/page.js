/**
 * /about — who NearGFix is and what it does, written for customers first.
 *
 * Static server component. Facts come from siteContent.js (ABOUT, ABOUT_VALUES,
 * PLATFORM_FACTS, BRAND) so numbers never drift from the rest of the site.
 */

import Link from 'next/link';
import {
  ArrowRight,
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

import { Button, Section, SectionHeading, cx, resolveIcon } from '@/components/site/ui';
import { ABOUT, ABOUT_VALUES, BRAND, CTA, PLATFORM_FACTS } from '@/lib/siteContent';
import { pageMetadata } from '@/lib/seo';

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
  { icon: Wrench, title: 'Repair', text: 'Book a repair for your exact model and approve the price first.', href: '/repair', chip: 'from-[#035C6C] to-[#035C6C]' },
  { icon: Truck, title: 'Pickup & Delivery', text: 'A nearby shop collects your device and brings it back fixed.', href: '/pickup-delivery', chip: 'from-[#2ED3B7] to-[#0E9384]' },
  { icon: Tag, title: 'Sell', text: 'List your old device once and let nearby shops send offers.', href: '/#sell', chip: 'from-[#FDB022] to-[#F79009]' },
  { icon: ShoppingCart, title: 'Buy', text: 'Refurbished devices and accessories from verified local shops.', href: '/#buy', chip: 'from-[#5EA2FF] to-[#1570EF]' },
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

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function AboutPage() {
  return (
    <>
      {/* 1 — Hero ----------------------------------------------------------- */}
      <Section tone="soft" padding="tight" className="bg-gradient-to-b from-[#E5F3F5] to-white">
        <div className="grid items-center gap-10 py-6 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          <div>
            <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
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
            {PLATFORM_FACTS.map((fact, i) => (
              <div
                key={fact.label}
                className={cx(
                  'rounded-3xl p-4 shadow-soft sm:p-6',
                  i === 0 || i === 3 ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white' : 'border border-brand-line bg-white',
                )}
              >
                <dt className={cx('text-sm font-semibold', i === 0 || i === 3 ? 'text-white/75' : 'text-brand-muted')}>{fact.label}</dt>
                <dd className="mt-3 flex flex-wrap items-baseline gap-x-1">
                  <span className={cx('text-3xl font-extrabold tracking-tight sm:text-4xl', i === 0 || i === 3 ? 'text-white' : 'text-brand-ink')}>{fact.value}</span>
                  <span className={cx('text-base font-bold', i === 0 || i === 3 ? 'text-[#C7E6EA]' : 'text-brand-700')}>{fact.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* 2 — Why we built it ------------------------------------------------- */}
      <Section tone="white">
        <SectionHeading
          eyebrow="Why we built it"
          title="Repairs deserved better than a paper register"
        />
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-brand-line bg-[#FFF8F1] p-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#DC6803] shadow-sm">
              <NotebookPen className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#B54708]">Before</p>
            <p className="mt-1 text-xl font-extrabold tracking-tight text-brand-ink">Guesswork on both sides of the counter</p>
            <p className="mt-2 text-sm leading-relaxed text-brand-muted">
              Shops ran on a notebook and a WhatsApp group. Customers handed over their phone and waited, with no idea what was happening to it.
            </p>
          </div>
          <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-7 text-white shadow-lift">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-700">
              <ClipboardList className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#C7E6EA]">With {BRAND.name}</p>
            <p className="mt-1 text-xl font-extrabold tracking-tight">One system, everyone in the loop</p>
            <p className="mt-2 text-sm leading-relaxed text-white/80">{ABOUT.body[1].split('. ').slice(-1)[0]}</p>
          </div>
        </div>
      </Section>

      {/* 3 — What you can do ------------------------------------------------- */}
      <Section tone="soft" className="bg-gradient-to-b from-[#E5F3F5] via-[#F3FBF4] to-white">
        <SectionHeading
          eyebrow="What we do"
          title="Everything for your device, in one place"
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <li key={s.title}>
              <Link
                href={s.href}
                className="group flex h-full flex-col rounded-3xl border border-[#C7E6EA] bg-white p-6 shadow-[0_6px_20px_rgba(3,92,108,0.06)] transition hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(3,92,108,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <span className={cx('inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md transition group-hover:scale-105', s.chip)}>
                  <s.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-bold tracking-tight text-brand-ink">{s.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-muted">{s.text}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-700">
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
          {ABOUT_VALUES.map((value) => {
            const Icon = resolveIcon(value.icon);
            return (
              <div key={value.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10 sm:p-7">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-700">
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
        <SectionHeading
          eyebrow="Who it is for"
          title="Built for everyone around the repair"
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {AUDIENCE.map((a) => (
            <div key={a.title} className="flex flex-col rounded-3xl border border-brand-line bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lift sm:p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-700">
                <a.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-xl font-extrabold tracking-tight text-brand-ink">{a.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-brand-muted">{a.text}</p>
              {a.href ? (
                <Link href={a.href} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">
                  NearGFix for shops
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      {/* 6 — Talk to us ------------------------------------------------------- */}
      <Section tone="page">
        <div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 p-8 text-white shadow-lift sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[#C7E6EA]">
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                {BRAND.appsStatus}
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Say hello to the {BRAND.company} team</h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-white/80">
                Questions, feedback, or a shop you want on {BRAND.name}? We would love to hear from you.
              </p>
              <div className="mt-6">
                <Button href={CTA.contact.href} variant="white" size="lg" icon="ArrowRight">
                  {CTA.contact.label}
                </Button>
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { icon: Phone, label: 'Call us', value: BRAND.phone, href: BRAND.phoneHref },
                { icon: MessageCircle, label: 'WhatsApp', value: BRAND.whatsapp, href: BRAND.whatsappHref, external: true },
                { icon: Mail, label: 'Email', value: BRAND.email, href: BRAND.emailHref },
              ].map((c) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700">
                      <c.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-[#C7E6EA]">{c.label}</span>
                      <span className="block truncate text-sm font-bold">{c.value}</span>
                    </span>
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
