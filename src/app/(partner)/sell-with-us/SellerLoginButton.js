'use client';

/**
 * The Sell with NearGFix header's only action: opens the business Login / Signup
 * popup (no page redirect). It is also THE business login: logout, the
 * dashboard's auth guard and the old /shopmanagement address all land on
 * /sell-with-us/?login=1, which opens this popup straight away.
 */

import { useEffect, useState } from 'react';

import BusinessLoginModal from '@/components/site/BusinessLoginModal';

export default function SellerLoginButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('login') !== '1') return;
    setOpen(true);
    // Drop the flag so a refresh or Back doesn't keep reopening the popup.
    url.searchParams.delete('login');
    window.history.replaceState(null, '', url);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-[10px] bg-[#035C6C] px-5 text-[14.5px] font-semibold text-white transition hover:bg-[#035C6C] sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2"
      >
        Login
      </button>
      <BusinessLoginModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
