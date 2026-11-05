'use client';

/**
 * /management/subscriptions — Subscription v2 admin (NearGFix).
 * Five tabs, each loading its own data from /subscriptions/admin/**
 * (subscriptionAdminApi in src/lib/api.js). Money is integer paise and is
 * formatted only through formatPaise(); no prices or feature lists live in
 * this client. The old typed-UUID POST /activate flow is replaced by the
 * audit-logged Manual Activation form in the Subscriptions tab.
 */

import { useState } from 'react';
import { CreditCard, Crown, Percent, RefreshCw, Settings, Zap } from 'lucide-react';

import PageHeader, { Button } from '@/components/PageHeader';
import SubscriptionsTab from './SubscriptionsTab';
import PlansTab from './PlansTab';
import PaymentsTab from './PaymentsTab';
import PricingTab from './PricingTab';
import SettingsTab from './SettingsTab';

const TABS = [
  { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard, Comp: SubscriptionsTab },
  { key: 'plans', label: 'Plans', icon: Crown, Comp: PlansTab },
  { key: 'payments', label: 'Payments', icon: Zap, Comp: PaymentsTab },
  { key: 'pricing', label: 'Pricing & Discounts', icon: Percent, Comp: PricingTab },
  { key: 'settings', label: 'Settings', icon: Settings, Comp: SettingsTab },
];

export default function SubscriptionsPage() {
  const [tab, setTab] = useState('subscriptions');
  const [reloadKey, setReloadKey] = useState(0);
  const Active = TABS.find((t) => t.key === tab)?.Comp || SubscriptionsTab;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader
        breadcrumb={['Admin', 'Subscriptions']}
        title="Subscription Management"
        subtitle="Subscriptions, plans, Razorpay UPI payments, pricing and billing settings."
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={() => setReloadKey((k) => k + 1)}>
            Refresh
          </Button>
        }
      />

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-admin-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-2 text-sm font-medium sm:px-4 ${
                active ? 'border-b-2 border-admin-accent text-admin-accent' : 'text-admin-muted hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <Active key={`${tab}:${reloadKey}`} />
    </div>
  );
}
