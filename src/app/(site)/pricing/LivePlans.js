'use client';

/**
 * LivePlans — the Pricing page's plan cards, read from the same public
 * Subscription v2 catalog the Partner App lists (GET /subscriptions/catalog).
 * The static cards passed as children show while loading or if the API fails.
 */

import { useEffect, useState } from 'react';

import PlanCard from '@/components/subscription/PlanCard';
import { SUBSCRIPTION_BASE } from '@/lib/api';

export default function LivePlans({ children }) {
  const [plans, setPlans] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`${SUBSCRIPTION_BASE()}/subscriptions/catalog`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = Array.isArray(data?.plans) ? data.plans : [];
        const active = list
          .filter((p) => !p.status || p.status === 'ACTIVE')
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        if (alive && active.length) setPlans(active);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!plans) return children;

  return (
    <div className="mx-auto mt-12 grid max-w-6xl items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <PlanCard key={plan.id || plan.code} plan={plan} />
      ))}
    </div>
  );
}
