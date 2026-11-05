import { getRepairCatalog } from '@/lib/repairCatalog';
import { absoluteUrl } from '@/lib/seo';

/**
 * /sitemap.xml, generated at build from the same catalogue the repair pages
 * are built from, so it can never list a page that was not exported.
 *
 * Only indexable public pages: no dashboards, account, login, sign-up or
 * query-string variants (/repair/?category=… canonicalises to /repair/).
 * About 100 URLs today; a sitemap index only becomes necessary past 50,000.
 *
 * No lastModified: a build timestamp on every URL tells Google nothing true
 * about when each page last changed, and it learns to ignore it.
 */
export const dynamic = 'force-static';

const STATIC_PAGES = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/repair', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/sell', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/buy', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/nearby-shops', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/pickup-delivery', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/shop', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/sell-with-us', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/pricing', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'yearly' },
  { path: '/faq', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/disclaimer', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
];

export default async function sitemap() {
  const catalog = await getRepairCatalog();

  const repairPages = catalog.flatMap((category) => [
    { path: `/repair/${category.slug}`, priority: 0.9, changeFrequency: 'weekly' },
    ...category.brands.map((brand) => ({
      path: `/repair/${category.slug}/${brand.slug}`,
      priority: 0.7,
      changeFrequency: 'weekly',
    })),
  ]);

  return [...STATIC_PAGES, ...repairPages].map(({ path, priority, changeFrequency }) => ({
    url: absoluteUrl(path),
    changeFrequency,
    priority,
  }));
}
