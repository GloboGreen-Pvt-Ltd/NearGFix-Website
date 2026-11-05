import LegalDocument from '@/components/site/legal/LegalDocument';
import { DISCLAIMER } from '@/lib/disclaimerContent';
import { pageMetadata } from '@/lib/seo';

// Same Disclaimer text as the NearGFix apps (src/lib/disclaimerContent.js).
export const metadata = pageMetadata({
  title: 'Disclaimer',
  description:
    'NearGFix Disclaimer Policy: the role of NearGFix, repair risks, device data, parts, pricing, pickup and delivery, warranties and the used-device marketplace.',
  path: '/disclaimer',
});

const COMPANY = {
  name: 'Globogreen System & Technology Private Limited',
  brand: 'NearGFix',
  office: 'No. 1/16, South Street, Villiyanallur, Bhuvanagiri Taluk, Tamil Nadu, India',
  website: 'neargfix.com',
};

export default function DisclaimerPage() {
  return (
    <LegalDocument
      doc={DISCLAIMER}
      title="Disclaimer"
      description="What NearGFix is responsible for, and what independent Service Providers are."
      path="/disclaimer"
      company={COMPANY}
      related={{ href: '/terms', title: 'Terms and Conditions', description: 'The rules for using Near G Fix.' }}
    />
  );
}
