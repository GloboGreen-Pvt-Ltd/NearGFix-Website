import Link from 'next/link';

import SiteFooter from '@/components/site/SiteFooter';
import SiteHeader from '@/components/site/SiteHeader';
import { Button, Section } from '@/components/site/ui';

/**
 * Exported as out/404.html. CloudFront serves it with a real 404 status for
 * any unknown URL (infra/cloudfront-patch-config.mjs), so a mistyped or
 * removed address is a proper "not found" for Google, not a soft 404 or the
 * bare S3 AccessDenied XML. Lives at the app root (outside the (site) group),
 * so it brings the site header and footer itself.
 */
// Next adds <meta name="robots" content="noindex"> to this page itself.
export const metadata = { title: 'Page not found | NearGFix' };

const POPULAR = [
  { href: '/repair/mobile/', label: 'Mobile phone repair' },
  { href: '/repair/laptop/', label: 'Laptop repair' },
  { href: '/repair/tablet/', label: 'Tablet repair' },
  { href: '/sell/', label: 'Sell your old phone' },
  { href: '/buy/', label: 'Buy refurbished devices' },
  { href: '/nearby-shops/', label: 'Repair shops near you' },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <Section tone="white">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-700">Error 404</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-ink sm:text-4xl">
              We could not find that page
            </h1>
            <p className="mt-4 text-base leading-relaxed text-brand-muted sm:text-lg">
              The link may be old or mistyped. These are the pages people usually look for:
            </p>
            <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
              {POPULAR.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex rounded-full border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition hover:border-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <Button href="/" size="lg" icon="ArrowRight">
                Go to the home page
              </Button>
            </div>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </div>
  );
}
