'use client';

/**
 * Account area layout — nests inside the (site) shell (SiteHeader + footer) and
 * adds the persistent left rail. It also guards the whole area on a customer
 * session:
 *   • before mount           → a neutral loader (server render can't read
 *                              localStorage, so the first client render must
 *                              match it — avoids a hydration mismatch)
 *   • signed out             → <AccountGate/> (sign-in prompt + modal)
 *   • signed in              → sidebar + the page's content in a two-column grid
 *
 * subscribe() keeps this reactive: logging in (from the gate or the header) or
 * out (from the sidebar or another tab) re-renders the correct branch with no
 * reload. The children pages assume a signed-in customer and read the session
 * themselves for their data calls.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Container, Section } from '@/components/site/ui';
import { readCustomer, subscribe } from '@/lib/customerAuth';
import AccountSidebar from '@/components/site/account/AccountSidebar';
import AccountGate from '@/components/site/account/AccountGate';

export default function AccountShell({ children }) {
  const [mounted, setMounted] = useState(false);
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    setMounted(true);
    setCustomer(readCustomer());
    const unsub = subscribe((c) => setCustomer(c));
    return unsub;
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" aria-hidden="true" />
      </div>
    );
  }

  if (!customer) {
    return <AccountGate />;
  }

  return (
    <Section tone="page" padding="tight">
      <Container>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr] lg:gap-8">
          <AccountSidebar customer={customer} />
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </Section>
  );
}
