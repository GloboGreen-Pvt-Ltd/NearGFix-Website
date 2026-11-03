import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Globe, Mail, MessageCircle, Phone } from 'lucide-react';

import { BRAND, FOOTER_NAV } from '@/lib/siteContent';
import StoreBadges from './StoreBadges';
import { Container } from './ui';

const CONTACT_TILES = [
  { key: 'phone', Icon: Phone, title: 'Call us', label: BRAND.phone, href: BRAND.phoneHref, external: false },
  { key: 'whatsapp', Icon: MessageCircle, title: 'WhatsApp', label: BRAND.whatsapp, href: BRAND.whatsappHref, external: true },
  { key: 'email', Icon: Mail, title: 'Email', label: BRAND.email, href: BRAND.emailHref, external: false },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1C3053]';

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-[#1C3053] text-white">
      {/* Soft glows */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#035C6C]/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-[#C7E6EA]/10 blur-3xl" aria-hidden="true" />

      <Container className="relative pb-6 pt-10">
        {/* Contact strip */}
        <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-3 sm:grid-cols-3">
          {CONTACT_TILES.map(({ key, Icon, title, label, href, external }) => (
            <a
              key={key}
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-white/10 ${FOCUS_RING}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#035C6C] to-[#035C6C] text-white shadow-md">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#C7E6EA]">{title}</span>
                <span className="block truncate text-sm font-bold text-white">{label}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-white/40 transition group-hover:text-white" aria-hidden="true" />
            </a>
          ))}
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Brand block */}
          <div className="lg:col-span-4">
            <Link
              href="/"
              className={`inline-flex items-center gap-2.5 rounded-xl ${FOCUS_RING}`}
              aria-label={`${BRAND.name} home`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white p-1.5">
                <Image src={BRAND.logo} alt={BRAND.logoAlt} width={36} height={36} className="h-8 w-8 object-contain" />
              </span>
              <span className="text-2xl font-extrabold tracking-tight">{BRAND.name}</span>
            </Link>

            <p className="mt-3 block w-fit rounded-full bg-[#035C6C]/25 px-3 py-1 text-xs font-bold text-[#C7E6EA]">
              {BRAND.tagline}
            </p>

            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">{BRAND.description}</p>

            <StoreBadges tone="dark" align="left" caption={BRAND.appsStatus} className="mt-5" />

            <a
              href={BRAND.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-4 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-white/70 transition hover:text-white ${FOCUS_RING}`}
            >
              <Globe className="h-4 w-4 text-[#C7E6EA]" aria-hidden="true" />
              {BRAND.website}
            </a>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8 lg:grid-cols-6 lg:gap-6">
            {FOOTER_NAV.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#035C6C]" aria-hidden="true" />
                  {column.title}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.href}-${link.label}`}>
                      <Link
                        href={link.href}
                        className={`inline-block rounded-lg text-sm text-white/65 transition hover:translate-x-0.5 hover:text-white ${FOCUS_RING}`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Legal row */}
        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/60">
            © {year} {BRAND.company}. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {[
              { href: '/terms', label: 'Terms' },
              { href: '/privacy', label: 'Privacy' },
              { href: '/management', label: 'Admin Portal' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg text-white/60 transition hover:text-white ${FOCUS_RING}`}
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
