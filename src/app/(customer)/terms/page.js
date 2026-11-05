import LegalDocument from '@/components/site/legal/LegalDocument';
import { LEGAL_DOCS } from '@/lib/legalContent';
import { pageMetadata } from '@/lib/seo';

// Same Terms text as the Near G Fix apps (src/lib/legalContent.js).
export const metadata = pageMetadata({
  title: 'Terms & Conditions',
  description:
    'The terms for using Near G Fix, operated by Globogreen: customer and shop accounts, repairs and estimates, pickup and delivery, subscriptions, marketplace and liability.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalDocument
      doc={LEGAL_DOCS.TERMS}
      title="Terms and Conditions"
      description="The rules for using the Near G Fix app, website and services."
      path="/terms"
      related={{ href: '/privacy', title: 'Privacy Policy', description: 'How we collect, use and protect your data.' }}
    />
  );
}
