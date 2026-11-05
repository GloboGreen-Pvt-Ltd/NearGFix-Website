import LegalDocument from '@/components/site/legal/LegalDocument';
import { LEGAL_DOCS } from '@/lib/legalContent';
import { pageMetadata } from '@/lib/seo';

// Same Privacy Policy text as the Near G Fix apps (src/lib/legalContent.js).
export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description:
    'How Near G Fix and Globogreen collect, use, share and protect your information across the Near G Fix apps and this website.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <LegalDocument
      doc={LEGAL_DOCS.PRIVACY}
      title="Privacy Policy"
      description="How Near G Fix collects, uses, shares and protects your information."
      path="/privacy"
      related={{ href: '/terms', title: 'Terms and Conditions', description: 'The rules for using Near G Fix.' }}
    />
  );
}
