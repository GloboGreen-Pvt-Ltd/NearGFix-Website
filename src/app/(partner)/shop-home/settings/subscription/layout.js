import { Suspense } from 'react';

// Checkout and receipt read ?step= / ?id= client-side via useSearchParams(),
// which needs a Suspense boundary under static export (output: 'export').
export default function SubscriptionLayout({ children }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
