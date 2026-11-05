import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import { BRAND } from '@/lib/siteContent';
import { DEFAULT_OG_IMAGE } from '@/lib/seo';

// Each page sets its own title/description/canonical/Open Graph through
// pageMetadata() (src/lib/seo.js); these are only the fallbacks.
export const metadata = {
  title: {
    default: 'Mobile Repair, Buy & Sell Devices Online | NearGFix',
    template: '%s | NearGFix',
  },
  description:
    'NearGFix offers mobile, tablet, laptop, smartwatch and audio device repair services. Book repairs, buy devices or sell your used gadgets easily.',
  applicationName: BRAND.name,
  authors: [{ name: BRAND.company, url: BRAND.websiteUrl }],
  openGraph: {
    title: 'Mobile Repair, Buy & Sell Devices Online | NearGFix',
    description:
      'NearGFix offers mobile, tablet, laptop, smartwatch and audio device repair services. Book repairs, buy devices or sell your used gadgets easily.',
    siteName: BRAND.name,
    type: 'website',
    locale: 'en_IN',
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: { card: 'summary_large_image', images: [DEFAULT_OG_IMAGE.url] },
};

export default function SiteLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1 overflow-x-clip">{children}</main>
      <SiteFooter />
    </div>
  );
}
