import { Suspense } from 'react';
import CompatibilityClient from './CompatibilityClient';

// Static export: one /management/model-compatibility/ page serves every part
// type. The type comes from the ?type=<slug> query string the sidebar links to,
// read client-side via useSearchParams — so a type the shop adds later needs no
// build and no new route, which a [type] segment would have required.
// useSearchParams() needs a Suspense boundary during static export.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompatibilityClient />
    </Suspense>
  );
}
