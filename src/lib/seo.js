/**
 * SEO helpers for the public site — canonical URLs, per-page metadata and
 * schema.org JSON-LD builders.
 *
 * The site is a static export (next.config.js), so everything here runs at
 * BUILD time: canonical URLs, Open Graph tags and JSON-LD are baked into each
 * exported HTML file, which is exactly what crawlers read.
 *
 * Environment (all optional, all NEXT_PUBLIC_* so they are inlined at build):
 *   NEXT_PUBLIC_SITE_URL       canonical origin, default https://neargfix.com
 *   NEXT_PUBLIC_ALLOW_INDEXING set to "false" on dev/preview deploys so they are
 *                              noindex + disallowed in robots.txt; production
 *                              leaves it unset and is indexable.
 *
 * Nothing in the structured data is invented: name, legal name, logo, phone and
 * email come from BRAND (src/lib/siteContent.js) or were supplied by the
 * business. There are no ratings, reviews, prices, street addresses or social
 * profiles because none exist yet — add them only once they are real.
 */

import { BRAND } from '@/lib/siteContent';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://neargfix.com').replace(/\/+$/, '');
export const SITE_NAME = BRAND.name;
export const LEGAL_NAME = 'Globogreen System & Technology Private Limited';
export const INDEXING_ENABLED = process.env.NEXT_PUBLIC_ALLOW_INDEXING !== 'false';

/** public/og-image.png, made by scripts/generate-og-image.mjs (1200x630). */
export const DEFAULT_OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630, alt: 'NearGFix — repair, buy and sell your devices' };

/**
 * Site-relative path → the canonical form. next.config.js sets
 * trailingSlash: true, so every page lives at "/path/"; the canonical has to
 * match or Google sees two URLs for one page.
 */
export function canonicalPath(path = '/') {
  const [pathname] = String(path).split(/[?#]/);
  const clean = `/${pathname.replace(/^\/+|\/+$/g, '')}`;
  return clean === '/' ? '/' : `${clean}/`;
}

export function absoluteUrl(path = '/') {
  return `${SITE_URL}${canonicalPath(path)}`;
}

/** Absolute URL for an asset path (images), left as-is when already absolute. */
export function assetUrl(src) {
  if (!src) return undefined;
  return /^https?:\/\//.test(src) ? src : `${SITE_URL}/${String(src).replace(/^\/+/, '')}`;
}

/**
 * Full metadata for one public page: title, description, canonical, Open Graph
 * and Twitter card. Open Graph/Twitter are rebuilt per page because Next merges
 * metadata shallowly — a page that sets `openGraph` replaces the parent's whole
 * object, so a partial one would drop og:site_name, og:image, etc.
 *
 *   title         page title WITHOUT the brand; the (site) layout's template
 *                 appends " | NearGFix". Pass absoluteTitle to opt out.
 *   noindex       for private/thin pages (still followable unless follow:false)
 */
export function pageMetadata({
  title,
  description,
  path = '/',
  image,
  type = 'website',
  absoluteTitle = false,
  noindex = false,
  follow = true,
}) {
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const url = canonicalPath(path);
  const images = [image || DEFAULT_OG_IMAGE];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      title: fullTitle,
      description,
      siteName: SITE_NAME,
      locale: 'en_IN',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: images.map((i) => (typeof i === 'string' ? i : i.url)),
    },
    ...(noindex ? { robots: { index: false, follow } } : {}),
  };
}

/** Metadata for private areas (dashboards, account, login): never indexed. */
export const PRIVATE_METADATA = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/* -------------------------------------------------------------------------- */
/* JSON-LD builders                                                            */
/* -------------------------------------------------------------------------- */

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    legalName: LEGAL_NAME,
    url: `${SITE_URL}/`,
    logo: { '@type': 'ImageObject', url: assetUrl(BRAND.logo) },
    email: BRAND.email,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        telephone: BRAND.phone.replace(/\s+/g, '-'),
        email: BRAND.email,
        areaServed: 'IN',
        availableLanguage: ['en'],
      },
    ],
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: 'en-IN',
    publisher: { '@id': ORG_ID },
  };
}

/** items: [{ name, path }] from Home down to the current page. */
export function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * A repair service offered through NearGFix partner shops. No price, rating or
 * address: those vary per shop and none are published by the platform.
 */
export function serviceSchema({ name, description, path, serviceType, offers }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    serviceType,
    url: absoluteUrl(path),
    areaServed: { '@type': 'Country', name: 'India' },
    provider: { '@id': ORG_ID },
    ...(offers?.length
      ? {
          hasOfferCatalog: {
            '@type': 'OfferCatalog',
            name: `${name} options`,
            itemListElement: offers.map((o) => ({
              '@type': 'Offer',
              itemOffered: { '@type': 'Service', name: o },
            })),
          },
        }
      : {}),
  };
}

/** Only for pages that visibly render every one of these questions and answers. */
export function faqSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}
