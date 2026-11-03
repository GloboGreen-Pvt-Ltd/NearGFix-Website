import DashboardShell from '@/components/shop-dashboard/DashboardShell';
import { PRIVATE_METADATA } from '@/lib/seo';

// Signed-in shop dashboard: never indexed (also disallowed in robots.txt).
export const metadata = { title: 'NearGFix Shop Dashboard', ...PRIVATE_METADATA };

/**
 * Wraps every route under /shop-home/* in the Partner Dashboard shell
 * (sidebar + top navbar + auth guard) — see DashboardShell's own doc
 * comment. Lives outside the (site) route group, same as before: this is
 * its own app chrome, not the marketing SiteHeader/SiteFooter.
 */
export default function ShopHomeLayout({ children }) {
  return (
    <>
      {/* Google Material Symbols (Outlined) for MaterialIcon (e.g. Book Service's step bar). */}
      {/* display=block (not swap): an icon font must never flash its ligature names as text while loading. */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display -- icon font scoped to the dashboard. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
      />
      <DashboardShell>{children}</DashboardShell>
    </>
  );
}
