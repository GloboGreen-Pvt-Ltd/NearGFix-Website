import './globals.css';
import AppToaster from '@/components/AppToaster';
import Analytics from '@/components/seo/Analytics';
import { INDEXING_ENABLED, SITE_NAME, SITE_URL } from '@/lib/seo';

export const metadata = {
  // Resolves every relative canonical / og:url / og:image to the production origin.
  metadataBase: new URL(SITE_URL),
  title: 'NearGFix — Repair · Buy · Sell',
  description:
    'NearGFix by GloboGreen — book a mobile repair, get doorstep pickup, sell or buy a device, and run your repair shop end to end.',
  applicationName: SITE_NAME,
  icons: { icon: '/logo.png', apple: '/logo.png' },
  // Indexable by default; dev/preview builds set NEXT_PUBLIC_ALLOW_INDEXING=false.
  // Private areas (dashboards, account, login) override this with noindex.
  robots: INDEXING_ENABLED
    ? { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } }
    : { index: false, follow: false },
  // Search Console "HTML tag" verification — only rendered when the id is set.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#035C6C',
  // This app is light-themed only — no dark-mode stylesheet exists anywhere.
  // Without this, a device in dark mode (Android especially) has the
  // browser auto-dark-theme native form controls and can shift light
  // pastel colors (e.g. the pale-green "Ready By" badge, the Duration
  // <select>) toward blue on its own, which looks like a rendering bug but
  // isn't one this app's own CSS causes.
  colorScheme: 'light',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <AppToaster />
        <Analytics />
      </body>
    </html>
  );
}
