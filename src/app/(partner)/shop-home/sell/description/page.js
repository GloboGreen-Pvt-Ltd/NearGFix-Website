'use client';

/**
 * /shop-home/sell/description/ — Sell a Device, step 6: how much to describe,
 * the Partner app's OwnerSellMobileChoiceScreen. Detailed and Dead Phone
 * Short run the full assessment (screening → condition → functional →
 * configuration → accessories → photos → price); Short goes straight to
 * photos and price. Dead Phone Short marks the device DEAD, which switches
 * screening to its dead-phone questions and lists it as "Dead / Unknown".
 */

import { useRouter } from '@/lib/portalNavigation';
import { ChevronRight, ClipboardList, FileText, Skull } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { SellIntro, SellLoading, SellMissingDraft, SellShell } from '@/components/shop-dashboard/SellStep';
import { SELL_STEP_HREF } from '@/lib/sellFlow';
import { CLEARED_ASSESSMENT, saveSellDraft, useSellDraft } from '@/lib/sellListing';

const OPTIONS = [
  {
    key: 'DETAILED',
    title: 'Detailed Description',
    sub: 'Full assessment: screening, screen, functional, accessories, warranty, photos, price.',
    icon: ClipboardList,
    steps: 6,
    danger: false,
  },
  {
    key: 'SHORT',
    title: 'Short Description',
    sub: 'Quick listing: just photos and price.',
    icon: FileText,
    steps: 2,
    danger: false,
  },
  {
    key: 'DEAD_SHORT',
    title: 'Dead Phone Short Description',
    sub: 'Full assessment optimised for dead / non-working phones.',
    icon: Skull,
    steps: 6,
    danger: true,
  },
];

export default function DescriptionPage() {
  const router = useRouter();
  const draft = useSellDraft();
  const shell = { title: 'Choose Description', subtitle: draft?.model?.name };

  if (draft === undefined) return <SellShell {...shell}><SellLoading /></SellShell>;
  if (!draft?.device) return <SellShell {...shell}><SellMissingDraft /></SellShell>;

  function pick(opt) {
    const changed = draft.descriptionType && draft.descriptionType !== opt.key;
    saveSellDraft({
      descriptionType: opt.key,
      workingCondition: opt.key === 'DEAD_SHORT' ? 'DEAD' : 'WORKING',
      ...(changed ? CLEARED_ASSESSMENT : {}),
    });
    router.push(opt.key === 'SHORT' ? SELL_STEP_HREF.images : SELL_STEP_HREF.screening);
  }

  return (
    <SellShell {...shell}>
      <SellIntro title="How would you like to describe this device?" caption="More detail helps buyers trust the listing." />
      <div className="space-y-3">
        {OPTIONS.map((o) => {
          const Icon = o.icon;
          const current = draft.descriptionType === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => pick(o)}
              className={cx(
                'flex w-full items-center gap-3 rounded-[18px] border bg-white p-3.5 text-left transition hover:-translate-y-0.5',
                current ? 'border-[#035C6C]' : 'border-[#ECECEC] hover:border-[#D0D5DD]',
              )}
            >
              <span
                className={cx(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]',
                  o.danger ? 'bg-[#FEE4E2] text-[#D92D20]' : 'bg-[#E5F3F5] text-[#035C6C]',
                )}
              >
                <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-extrabold text-[#111111]">{o.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-[#666666]">{o.sub}</span>
                <span
                  className={cx(
                    'mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                    o.danger ? 'bg-[#FEE4E2] text-[#D92D20]' : 'bg-[#E5F3F5] text-[#024A57]',
                  )}
                >
                  {o.steps} steps
                </span>
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3] text-[#111111]">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </SellShell>
  );
}
