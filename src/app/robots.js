import { INDEXING_ENABLED, SITE_URL } from '@/lib/seo';

/**
 * /robots.txt, generated at build.
 *
 * Only the two signed-in apps are disallowed — they are never linked for
 * crawlers and have nothing to index. Customer-facing private pages (account,
 * business sign-up) stay crawlable on purpose: they carry noindex, and Google
 * can only honour a noindex on a page it is allowed to fetch. _next/ assets are
 * never blocked, so Google can render every public page.
 *
 * A dev/preview build (NEXT_PUBLIC_ALLOW_INDEXING=false) blocks everything.
 */
export const dynamic = 'force-static';

export default function robots() {
  if (!INDEXING_ENABLED) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/shop-home/', '/management/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
