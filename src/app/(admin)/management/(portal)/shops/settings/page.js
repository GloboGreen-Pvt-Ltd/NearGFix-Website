import { Suspense } from 'react';
import SettingsClient from './SettingsClient';

// Static export: a single /management/shops/settings/ page. The shop id comes from
// the ?id= query string (read client-side via useSearchParams), so one static
// file serves every shop on S3. useSearchParams() requires a Suspense boundary
// during static export.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <SettingsClient />
    </Suspense>
  );
}
