import {
  BellRing,
  ClipboardList,
  Home,
  Laptop,
  MapPin,
  Search,
  ShoppingCart,
  Smartphone,
  Store,
  Tablet,
  Tag,
  Truck,
  User,
  Watch,
  Wrench,
} from 'lucide-react';

import { cx } from '@/components/site/ui';

/**
 * CustomerHomePhone — phone frame showing an illustrative NearGFix customer app
 * home screen (sample name, location and order, not live data).
 */
export default function CustomerHomePhone({ className }) {
  return (
    <div className={cx('relative overflow-hidden rounded-[44px] border-[10px] border-[#111827] bg-[#F6F8F7] shadow-[0_30px_60px_rgba(16,24,40,0.25)]', className)}>
      {/* Green header: notch, location, search */}
      <div className="rounded-b-[28px] bg-gradient-to-br from-[#035C6C] to-[#067A1E] px-4 pb-5 pt-2 text-white">
        <div className="mx-auto h-5 w-28 rounded-full bg-[#111827]" aria-hidden="true" />
        <div className="mt-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-white/75">Hello, Priya 👋</p>
            <p className="flex items-center gap-1 truncate text-sm font-extrabold">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Anna Nagar, Chennai
            </p>
          </div>
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
            <BellRing className="h-4 w-4" aria-hidden="true" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FDB022] ring-2 ring-[#035C6C]" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-brand-subtle shadow-sm">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="text-[11px]">Search device, repair or shop</span>
        </div>
      </div>

      <div className="px-4 pb-4 pt-4">
        {/* Promo banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1C3053] to-[#035C6C] p-3.5 text-white">
          <Wrench className="pointer-events-none absolute -bottom-3 -right-3 h-20 w-20 text-white/10" aria-hidden="true" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#C7E6EA]">Free pickup</p>
          <p className="mt-0.5 text-sm font-extrabold leading-snug">Screen broken?<br />Fix it at your doorstep</p>
          <span className="mt-2 inline-block rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#067A1E]">Book now</span>
        </div>

        {/* Quick actions */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { icon: Wrench, label: 'Repair', chip: 'from-[#035C6C] to-[#035C6C]' },
            { icon: Truck, label: 'Pickup', chip: 'from-[#2ED3B7] to-[#0E9384]' },
            { icon: ShoppingCart, label: 'Buy', chip: 'from-[#5EA2FF] to-[#1570EF]' },
            { icon: Tag, label: 'Sell', chip: 'from-[#FDB022] to-[#F79009]' },
          ].map((a) => (
            <div key={a.label} className="flex flex-col items-center gap-1">
              <span className={cx('flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm', a.chip)}>
                <a.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-[10px] font-bold text-brand-ink">{a.label}</span>
            </div>
          ))}
        </div>

        {/* Device categories */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs font-extrabold text-brand-ink">Repair by device</p>
          <span className="text-[10px] font-bold text-[#035C6C]">See all</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[
            { icon: Smartphone, label: 'Mobile' },
            { icon: Laptop, label: 'Laptop' },
            { icon: Tablet, label: 'Tablet' },
            { icon: Watch, label: 'Watch' },
          ].map((c) => (
            <div key={c.label} className="flex flex-col items-center gap-1 rounded-xl bg-white py-2 shadow-sm">
              <c.icon className="h-5 w-5 text-[#035C6C]" aria-hidden="true" />
              <span className="text-[10px] font-semibold text-brand-ink">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Active order */}
        <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand-700">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-extrabold text-brand-ink">iPhone 13 Pro · Screen</p>
              <p className="text-[10px] text-brand-muted">#GGF2048 · Repair in progress</p>
            </div>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-bold uppercase text-sky-700">Live</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-brand-line">
            <div className="h-full w-3/5 rounded-full bg-[#035C6C]" />
          </div>
        </div>
      </div>

      {/* Bottom tab bar */}
      <div className="flex items-center justify-around border-t border-brand-line bg-white px-2 pb-3 pt-2">
        {[
          { icon: Home, label: 'Home', active: true },
          { icon: ClipboardList, label: 'Orders' },
          { icon: Store, label: 'Shops' },
          { icon: User, label: 'Account' },
        ].map((t) => (
          <span key={t.label} className={cx('flex flex-col items-center gap-0.5 text-[9px] font-bold', t.active ? 'text-[#035C6C]' : 'text-brand-subtle')}>
            <t.icon className="h-4 w-4" aria-hidden="true" />
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
