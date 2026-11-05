'use client';

/**
 * /shop-home/sell/sales-category/ — Sell a Device, step 4: what's being sold,
 * the whole device or its spare parts. The Partner app's
 * OwnerSellChooseSalesCategoryScreen: the picked model up top (tap to change
 * it), the two choices, and the "why sell" list. Device → Select Variant;
 * Spare Parts → the spare-parts builder.
 */

import { useRouter } from '@/lib/portalNavigation';
import {
  Award,
  ChevronRight,
  Headphones,
  Laptop,
  Rocket,
  ShieldCheck,
  Smartphone,
  Tablet,
  Watch,
  Wrench,
  Zap,
} from 'lucide-react';

import { SellLoading, SellMissingDraft, SellShell, SellThumb } from '@/components/shop-dashboard/SellStep';
import { SELL_STEP_HREF } from '@/lib/sellFlow';
import { draftCategoryCode, saveSellDraft, useSellDraft } from '@/lib/sellListing';

const ICONS = {
  MOBILE: Smartphone,
  SMARTPHONE: Smartphone,
  LAPTOP: Laptop,
  TABLET: Tablet,
  SMARTWATCH: Watch,
  SMARTWATCHES: Watch,
  AUDIO: Headphones,
  AUDIO_DEVICE: Headphones,
  AUDIO_DEVICES: Headphones,
};

const WHY = [
  { icon: ShieldCheck, tone: 'bg-[#E5F3F5] text-[#035C6C]', title: 'Verified buyers in your area', sub: 'We connect you with trusted, local buyers' },
  { icon: Award, tone: 'bg-[#FEF3C7] text-[#B45309]', title: 'Get paid quickly & safely', sub: 'Secure payments with instant transfers' },
  { icon: Rocket, tone: 'bg-[#E5F3F5] text-[#035C6C]', title: 'Listing live in under a minute', sub: 'A few simple steps and you are done' },
];

export default function SalesCategoryPage() {
  const router = useRouter();
  const draft = useSellDraft();
  const shell = { title: 'Sell on NearGFix', subtitle: 'Reach nearby buyers in minutes' };

  if (draft === undefined) return <SellShell {...shell}><SellLoading /></SellShell>;
  if (!draft?.model) return <SellShell {...shell}><SellMissingDraft /></SellShell>;

  const { category, model } = draft;
  const DeviceIcon = ICONS[draftCategoryCode(draft)] || Smartphone;
  const choose = (mode, href) => {
    saveSellDraft({ mode });
    router.push(href);
  };
  const tiles = [
    {
      key: 'device',
      title: category?.name || 'Mobile',
      sub: `List the whole ${(category?.name || 'device').toLowerCase()} for sale`,
      tag: 'Best Value',
      Icon: DeviceIcon,
      onClick: () => choose('device', SELL_STEP_HREF.variant),
    },
    {
      key: 'parts',
      title: 'Spare Parts',
      sub: 'List individual parts (display, battery, camera…)',
      tag: 'Quick Sell',
      Icon: Wrench,
      onClick: () => choose('parts', SELL_STEP_HREF.spareParts),
    },
  ];

  return (
    <SellShell {...shell}>
      <div className="flex items-center gap-3 rounded-2xl border border-[#C7E6EA] bg-[#E5F3F5] px-3.5 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#035C6C]">
          <Zap className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-extrabold text-[#024A57]">Zero commission on first 10 listings</p>
          <p className="text-[12.5px] text-[#666666]">List more, sell more – we only win when you do!</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => router.back()}
        className="flex w-full items-center gap-3 rounded-2xl border border-[#ECECEC] bg-white p-3 text-left transition hover:border-[#D0D5DD]"
        aria-label={`Selected ${model.name}. Change model`}
      >
        <SellThumb src={model.imageUrl} fallbackIcon={DeviceIcon} className="h-14 w-14 rounded-xl bg-[#E5F3F5] p-1" iconClassName="h-6 w-6" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10.5px] font-extrabold uppercase tracking-wider text-[#024A57]">Selected</span>
          <span className="block truncate text-[15px] font-extrabold text-[#111111]">{model.name}</span>
          {category?.name ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#E5F3F5] px-2 py-0.5 text-[11px] font-bold text-[#024A57]">
              <DeviceIcon className="h-3 w-3" aria-hidden="true" />
              {category.name}
            </span>
          ) : null}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-[#D0D5DD]" aria-hidden="true" />
      </button>

      <div>
        <p className="mb-2.5 text-[11.5px] font-extrabold uppercase tracking-wider text-[#8E8E8E]">What are you selling?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {tiles.map(({ key, title, sub, tag, Icon, onClick }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              className="flex items-center gap-3 rounded-2xl border border-[#ECECEC] bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#035C6C]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#E5F3F5] text-[#035C6C]">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-extrabold text-[#111111]">{title}</span>
                  <span className="shrink-0 rounded-full bg-[#E5F3F5] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-[#024A57]">{tag}</span>
                </span>
                <span className="mt-1 block text-[12.5px] leading-snug text-[#666666]">{sub}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#035C6C]" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-[#ECECEC] bg-white p-3.5">
        <p className="mb-1 text-[11.5px] font-extrabold uppercase tracking-wider text-[#8E8E8E]">Why sell on NearGFix</p>
        {WHY.map(({ icon: Icon, tone, title, sub }, i) => (
          <div key={title} className={i ? 'flex items-center gap-3 border-t border-[#F3F3F3] py-2.5' : 'flex items-center gap-3 py-2.5'}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-extrabold text-[#111111]">{title}</p>
              <p className="text-[12.5px] text-[#666666]">{sub}</p>
            </div>
          </div>
        ))}
      </section>
    </SellShell>
  );
}
