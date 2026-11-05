import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight,Mail, MessageCircle, Phone } from 'lucide-react';

import { BRAND, FOOTER_NAV } from '@/lib/siteContent';
import StoreBadges from './StoreBadges';
import { Container, cx } from './ui';
import { tone, toneOf } from './tones';

const CONTACT_TILES = [
  { key: 'phone', Icon: Phone, title: 'Call us', label: BRAND.phone, href: BRAND.phoneHref, external: false, tone: 'green' },
  { key: 'whatsapp', Icon: MessageCircle, title: 'WhatsApp', label: BRAND.whatsapp, href: BRAND.whatsappHref, external: true, tone: 'teal' },
  { key: 'email', Icon: Mail, title: 'Email', label: BRAND.email, href: BRAND.emailHref, external: false, tone: 'blue' },
];

const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/disclaimer', label: 'Disclaimer' },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-brand-line bg-gradient-to-b from-[#F3F8FB] to-[#E9F3F6] text-brand-ink">
      {/* Multi-colour top strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-[#01AC77] via-[#1570EF] via-60% to-[#F79009]" aria-hidden="true" />

      <Container className="relative pb-6 pt-10">
        {/* Contact strip — one colour per channel */}
        <div className="grid gap-3 sm:grid-cols-3">
          {CONTACT_TILES.map(({ key, Icon, title, label, href, external, tone: k }) => (
            <a
              key={key}
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className={cx('group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 shadow-lift transition motion-safe:hover:-translate-y-0.5', toneOf(k).chip, FOCUS_RING)}
            >
              <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/15" aria-hidden="true" />
              <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-md', toneOf(k).text)}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wider text-white/80">{title}</span>
                <span className="block truncate text-base font-bold text-white">{label}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-white/70 transition group-hover:text-white" aria-hidden="true" />
              {external ? <span className="sr-only">(opens in a new tab)</span> : null}
            </a>
          ))}
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Brand block */}
          <div className="lg:col-span-4">
            <Link
              href="/"
              className={`inline-flex items-center gap-2.5 rounded-xl ${FOCUS_RING}`}
              aria-label={`${BRAND.name} home`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white p-1.5 shadow-soft ring-1 ring-brand-line">
                <Image src={BRAND.logo} alt={BRAND.logoAlt} width={36} height={36} className="h-8 w-8 object-contain" />
              </span>
              <span className="text-2xl font-extrabold tracking-tight text-[#05366E]">{BRAND.name}</span>
            </Link>

            <p className="mt-3 block w-fit rounded-full bg-gradient-to-r from-[#E7F8F1] to-[#EEF4FF] px-3 py-1 text-xs font-bold text-[#035C6C] ring-1 ring-[#C7E6EA]">
              {BRAND.tagline}
            </p>

            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-700">{BRAND.description}</p>

            <StoreBadges tone="light" align="left" caption={BRAND.appsStatus} className="mt-5" />
          </div>

          {/* Link columns — each with its own accent */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8 lg:grid-cols-5 lg:gap-6">
            {FOOTER_NAV.map((column, i) => {
              const t = tone(i + 1);
              return (
                <nav key={column.title} aria-label={column.title}>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-[#05366E]">{column.title}</h2>
                  <span className={cx('mt-2 block h-1 w-8 rounded-full', t.bar)} aria-hidden="true" />
                  <ul className="mt-4 space-y-2.5">
                    {column.links.map((link) => (
                      <li key={`${column.title}-${link.href}-${link.label}`}>
                        <Link
                          href={link.href}
                          className={`inline-block rounded-lg text-sm font-medium text-slate-700 transition hover:translate-x-0.5 hover:text-[#035C6C] ${FOCUS_RING}`}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              );
            })}
          </div>
        </div>

        {/* Legal row */}
        <div className="mt-12 flex flex-col gap-4 border-t border-[#C7E6EA] pt-5 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-slate-600">
            © {year}{' '}
            <Link href="/about" className={`rounded font-semibold text-[#05366E] underline-offset-4 transition hover:underline ${FOCUS_RING}`}>
              Globogreen System &amp; Technology Private Limited
            </Link>
            . All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full border border-[#C7E6EA] bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-[#035C6C] hover:text-[#035C6C] ${FOCUS_RING}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
