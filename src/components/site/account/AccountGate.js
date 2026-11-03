'use client';

/**
 * AccountGate — the signed-out screen for the account area. The whole area is
 * customer-only, so when there's no session we show a friendly sign-in prompt
 * (opening the same OTP LoginModal the header uses) instead of an empty shell or
 * a hard redirect (a redirect would fight the static export + the modal flow).
 * On success, customerAuth emits `ggfix:customer`; the layout re-reads and swaps
 * this out for the real content — no reload needed.
 */

import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';

import { Button, Container, Section } from '@/components/site/ui';
import LoginModal from '@/components/site/LoginModal';

export default function AccountGate() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <Section tone="page" padding="default">
      <Container className="max-w-lg">
        <div className="flex flex-col items-center rounded-3xl border border-brand-line bg-white px-5 py-10 text-center shadow-soft sm:px-6 sm:py-14">
          <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-700">
            <LockKeyhole className="h-8 w-8" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-ink">Sign in to NearGFix</h1>
          <p className="mt-2 max-w-sm text-sm text-brand-muted">
            Log in with your mobile number to see your orders, cart, saved devices and addresses.
          </p>
          <Button variant="primary" size="lg" className="mt-6" onClick={() => setLoginOpen(true)}>
            Login with OTP
          </Button>
          <p className="mt-4 text-xs text-brand-subtle">
            New to NearGFix? Create your account in the NearGFix app.
          </p>
        </div>
      </Container>

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => setLoginOpen(false)}
      />
    </Section>
  );
}
