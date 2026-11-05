import { Suspense } from 'react';
import JobReportClient from './JobReportClient';

// Static export: useSearchParams() (used to switch into single-technician
// mode via ?employee=<id> (or legacy ?employeeId=&name=), e.g. from Employee Management's Quick Access)
// needs a Suspense boundary — see model-compatibility/page.js for the same
// pattern already established in this app.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <JobReportClient />
    </Suspense>
  );
}
