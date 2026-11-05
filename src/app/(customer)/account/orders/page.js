'use client';

import { Suspense } from 'react';

import OrdersExperience from '@/components/site/account/OrdersExperience';

/** Customer app My Orders flows, adapted to the public website account area (?tab= picks the order type). */
export default function MyOrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersExperience />
    </Suspense>
  );
}
