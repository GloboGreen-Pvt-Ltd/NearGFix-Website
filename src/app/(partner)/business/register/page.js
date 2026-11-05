import BusinessRegister from '@/components/site/BusinessRegister';
import { pageMetadata } from '@/lib/seo';

/**
 * Lives OUTSIDE the (site) route group on purpose — same reasoning as
 * src/app/shop-home/page.js: this page has its own full-screen chrome (a
 * slim custom header inside BusinessRegister), not the marketing
 * SiteHeader/SiteFooter. Nesting under (site) would wrap it in both,
 * doubling the header.
 */
// A sign-up form with no content of its own — noindex, but followable so its
// links still count. /sell-with-us is the page that should rank for sellers.
export const metadata = pageMetadata({
  title: 'Start Your Business | NearGFix',
  absoluteTitle: true,
  description:
    'Create your NearGFix business account and start selling products and offering repair services across NearGFix.',
  path: '/business/register',
  noindex: true,
});

export default function BusinessRegisterPage() {
  return <BusinessRegister />;
}
