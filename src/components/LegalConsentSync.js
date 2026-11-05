'use client';

import { useEffect } from 'react';

import { flushPendingLegalAcceptances } from '@/lib/legalConsent';

/**
 * Retries Terms / Privacy acceptance records that could not be saved at login
 * (see src/lib/legalConsent.js). Mounted once in the root layout; renders nothing.
 */
export default function LegalConsentSync() {
  useEffect(() => {
    flushPendingLegalAcceptances();
  }, []);
  return null;
}
