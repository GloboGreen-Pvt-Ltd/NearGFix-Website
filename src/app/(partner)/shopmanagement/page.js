'use client';

/**
 * /shopmanagement used to be a separate full-page Business Login. Business
 * login now lives only in the Sell with NearGFix popup, so this address just
 * forwards there (with the popup open) — old links and bookmarks keep working.
 * A client redirect because the site is a static export (no server redirects).
 */

import { useEffect } from 'react';
import { useRouter } from '@/lib/portalNavigation';

export default function ShopManagementRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/sell-with-us/?login=1');
  }, [router]);
  return null;
}
