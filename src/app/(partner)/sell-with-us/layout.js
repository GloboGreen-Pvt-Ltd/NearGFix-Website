import { pageMetadata } from '@/lib/seo';

/**
 * /sell-with-us — the seller homepage. Lives outside the (site) group so it
 * gets its own seller header/footer instead of the customer SiteHeader, and
 * loads its font (Inter, headings and body) for this route only — no global
 * font change.
 */

// Inter + Raleway come from a plain Google Fonts stylesheet (below), not
// next/font/google: next/font downloads the font files at BUILD time and its
// Next 14 loader crashes ("reading '1'") on Google's current font URLs, which
// broke the production build. Raleway is used only for the NearGFix logo wordmark
// (.ggfix-logo-text).
const FONT_VARS = {
  '--font-inter': "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  '--font-raleway': "'Raleway', ui-sans-serif, system-ui, sans-serif",
};

// The seller (shop) homepage — /sell is the separate customer page for selling
// a used phone. `?login=1` variants canonicalise here.
export const metadata = pageMetadata({
  title: 'Sell With Us – Grow Your Device Business | NearGFix',
  absoluteTitle: true,
  description:
    'List devices, reach more customers, manage orders and grow your repair or device business with NearGFix. Register your shop and start with a free trial.',
  path: '/sell-with-us',
});

export default function SellWithUsLayout({ children }) {
  return (
    <div id="sell-with-us-root" style={FONT_VARS} className="min-h-screen bg-white font-[family-name:var(--font-inter)] text-[#1E1E1E] antialiased">
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- text fonts scoped to this route. */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Raleway:wght@500&display=swap" />
      {children}
    </div>
  );
}
