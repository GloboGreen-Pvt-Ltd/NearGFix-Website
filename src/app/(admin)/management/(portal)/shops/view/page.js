import { Suspense } from 'react';
import ViewClient from './ViewClient';

// Static export: a single /management/shops/view/ page. The shop id comes from the
// ?id= query string (read client-side via useSearchParams), so one static file
// serves every shop on S3 — no per-UUID pre-render needed. useSearchParams()
// requires a Suspense boundary during static export.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ViewClient />
    </Suspense>
  );
}
