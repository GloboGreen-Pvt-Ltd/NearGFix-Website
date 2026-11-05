import { PRIVATE_METADATA } from '@/lib/seo';

// /shopmanagement only forwards to the business login popup — nothing to index.
export const metadata = { title: 'Business Login', ...PRIVATE_METADATA };

export default function ShopManagementLayout({ children }) {
  return children;
}
