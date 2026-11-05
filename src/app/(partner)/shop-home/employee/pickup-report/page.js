import { Suspense } from 'react';
import PickupReportClient from './PickupReportClient';

// Static export: useSearchParams() (single-pickup-person mode via
// ?employeeId=&name=) needs a Suspense boundary — same pattern as
// model-compatibility/page.js and the Service Report page.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PickupReportClient />
    </Suspense>
  );
}
