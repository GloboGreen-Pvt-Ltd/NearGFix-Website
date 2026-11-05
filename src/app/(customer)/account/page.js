'use client';

/**
 * Compatibility route for older “My Account” links. The account landing action
 * is Personal Information, so both /account and the header menu lead there.
 * A client redirect works in the production static export as well as local dev.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AccountPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/account/profile');
  }, [router]);

  return (
    <div className="flex min-h-[35vh] items-center justify-center">
      <Loader2
        className="h-6 w-6 animate-spin text-brand-600"
        aria-label="Opening personal information"
      />
    </div>
  );
}
