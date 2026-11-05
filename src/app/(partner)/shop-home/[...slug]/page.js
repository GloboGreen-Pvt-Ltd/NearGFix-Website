import fs from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';

import ComingSoon from '@/components/shop-dashboard/ComingSoon';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import { ALL_STUB_SLUGS, findNavItemBySlug } from '@/lib/partnerNav';

/**
 * Required under output:'export' — every stub destination is pre-rendered.
 *
 * Slugs that already have a real page are skipped. `next dev` resolves routes
 * per request, so the real page wins there; the static export instead writes
 * one out/<path>/index.html per param, and the catch-all's copy was
 * overwriting the real page's (production showed "Coming soon" for every real
 * /shop-home/* page while localhost looked fine).
 */
export function generateStaticParams() {
  const appDir = path.join(process.cwd(), 'src', 'app', 'shop-home');
  return ALL_STUB_SLUGS
    .filter((slug) => !fs.existsSync(path.join(appDir, ...slug.split('/'), 'page.js')))
    .map((slug) => ({ slug: slug.split('/') }));
}

/**
 * Catch-all for every sidebar destination under /shop-home/* that doesn't
 * have a real page yet — see src/lib/partnerNav.js's doc comment. A path
 * matching a real nav item renders an honest ComingSoon; anything else
 * (typos, stale links) falls through to the real not-found page rather than
 * pretending every arbitrary URL is valid.
 *
 * When a real page is later added at one of these paths (e.g.
 * src/app/shop-home/services/bookings/page.js), Next.js routes to it
 * directly and this catch-all is never consulted for that path again.
 */
export default function PartnerNavStubPage({ params }) {
  const item = findNavItemBySlug(params.slug);
  if (!item) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={item.label} subtitle={item.description} />
      <ComingSoon icon={item.icon} title={item.label} description="This page is being built." />
    </div>
  );
}
