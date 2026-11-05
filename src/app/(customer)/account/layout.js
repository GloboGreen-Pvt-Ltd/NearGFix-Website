import { PRIVATE_METADATA } from '@/lib/seo';
import AccountShell from './AccountShell';

/**
 * Server wrapper so the customer account area can be marked noindex — the
 * shell itself (session guard + sidebar) is a client component, which cannot
 * export `metadata`. Not disallowed in robots.txt on purpose: Google has to be
 * able to fetch these pages to see the noindex.
 */
export const metadata = { title: 'My Account', ...PRIVATE_METADATA };

export default function AccountLayout({ children }) {
  return <AccountShell>{children}</AccountShell>;
}
