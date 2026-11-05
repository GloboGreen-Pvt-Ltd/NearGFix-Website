import { PRIVATE_METADATA } from '@/lib/seo';

/**
 * Server wrapper for the whole /management area (login + portal) so it can
 * carry noindex metadata — the portal's own layout is a client component,
 * which cannot export `metadata`. Also disallowed in robots.txt.
 */
export const metadata = { title: 'NearGFix Management Portal', ...PRIVATE_METADATA };

export default function ManagementRootLayout({ children }) {
  return children;
}
