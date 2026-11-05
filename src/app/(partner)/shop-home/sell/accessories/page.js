'use client';

/**
 * /shop-home/sell/accessories/ — detailed assessment, step 5: accessories and
 * the warranty left (the Partner app's SellAccessoriesWarrantyScreen). Both
 * lists are the app's own. Laptop, tablet, watch and audio listings get the
 * charger-only accessory list and no warranty question.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BatteryCharging, Flashlight, Zap } from 'lucide-react';

import { cx } from '@/components/site/ui';
import {
  CheckDot,
  RadioRing,
  SellButton,
  SellCard,
  SellFooter,
  SellIntro,
  SellLoading,
  SellMissingDraft,
  SellShell,
  choiceCls,
} from '@/components/shop-dashboard/SellStep';
import { SELL_STEP_HREF } from '@/lib/sellFlow';
import { draftCategoryCode, noWarrantyFor, saveSellDraft, useSellDraft } from '@/lib/sellListing';

const MOBILE_ACCESSORIES = [
  { id: 'original_charger', label: 'Original Charger', icon: Zap },
  { id: 'battery_local', label: 'Battery Replaced From Local Market', icon: BatteryCharging },
  { id: 'flashlight_not_working', label: 'Flash Light Not Working', icon: Flashlight },
];
const LAPTOP_ACCESSORIES = [{ id: 'original_charger', label: 'Original Charger', icon: Zap }];

// `label` is what the listing stores (warrantyLabel), kept exactly as the app
// stores it; `title` is the on-screen wording with the spelling fixed.
const WARRANTY = [
  { id: 'lt_3', label: 'Less then 3 months', title: 'Less than 3 months' },
  { id: '3_6', label: '3 - 6 months', title: '3 - 6 months' },
  { id: '6_11', label: '6 - 11 months', title: '6 - 11 months' },
  { id: 'gt_11', label: 'More then 11 months', title: 'More than 11 months' },
];

export default function AccessoriesPage() {
  const router = useRouter();
  const draft = useSellDraft();
  const ready = Boolean(draft?.device && draft?.descriptionType);
  const [accessories, setAccessories] = useState([]);
  const [warranty, setWarranty] = useState(null);

  // Coming back to this step keeps the earlier picks.
  useEffect(() => {
    if (Array.isArray(draft?.accessories)) setAccessories(draft.accessories.map((a) => a.accessoryCode));
    if (draft?.warranty) setWarranty(draft.warranty);
  }, [draft]);

  const isLaptopLike = noWarrantyFor(draftCategoryCode(draft));
  const list = isLaptopLike ? LAPTOP_ACCESSORIES : MOBILE_ACCESSORIES;
  const shell = { title: isLaptopLike ? 'Accessories' : 'Accessories & Warranty', subtitle: draft?.model?.name };

  if (draft === undefined) return <SellShell {...shell}><SellLoading /></SellShell>;
  if (!ready) return <SellShell {...shell}><SellMissingDraft /></SellShell>;

  const toggle = (id) => setAccessories((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const canContinue = isLaptopLike || Boolean(warranty);

  function onContinue() {
    saveSellDraft({
      accessories: list.filter((a) => accessories.includes(a.id)).map((a) => ({ accessoryCode: a.id, label: a.label })),
      warranty: isLaptopLike ? null : warranty,
      warrantyLabel: isLaptopLike ? null : WARRANTY.find((w) => w.id === warranty)?.label || null,
    });
    router.push(SELL_STEP_HREF.images);
  }

  const footer = (
    <SellFooter caption={canContinue ? null : 'Pick the warranty to continue'}>
      <SellButton onClick={onContinue} disabled={!canContinue} icon={ArrowRight}>
        Continue
      </SellButton>
    </SellFooter>
  );

  return (
    <SellShell {...shell} footer={footer}>
      <SellIntro
        title={isLaptopLike ? 'Accessories' : 'Accessories & warranty'}
        caption={isLaptopLike ? 'Tap everything that applies to the device.' : 'Tap everything that applies, then pick the remaining warranty.'}
      />
      <SellCard>
        <h3 className="mb-3 text-[14.5px] font-bold text-[#111111]">Accessories</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map(({ id, label, icon: Icon }) => {
            const active = accessories.includes(id);
            return (
              <button
                key={id}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => toggle(id)}
                className={cx(
                  'relative flex min-h-[96px] flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-2 py-2.5 text-center text-[12px] leading-snug transition',
                  choiceCls(active),
                  active ? 'font-bold' : 'font-semibold',
                )}
              >
                <span className={cx('flex h-9 w-9 items-center justify-center rounded-full', active ? 'bg-white text-[#035C6C]' : 'bg-[#F3F3F3] text-[#666666]')} aria-hidden="true">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="line-clamp-3">{label}</span>
                {active ? <CheckDot className="absolute right-1.5 top-1.5 h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
      </SellCard>

      {!isLaptopLike ? (
        <SellCard>
          <h3 id="warranty-title" className="mb-1 text-[14.5px] font-bold text-[#111111]">
            Warranty left
          </h3>
          <div role="radiogroup" aria-labelledby="warranty-title" className="grid gap-2 sm:grid-cols-2">
            {WARRANTY.map((w) => {
              const active = warranty === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setWarranty(w.id)}
                  className={cx('mt-1 flex min-h-[48px] items-center gap-2.5 rounded-xl border-[1.5px] px-3 text-left text-[13.5px] transition', choiceCls(active), active ? 'font-bold' : 'font-semibold')}
                >
                  {active ? <CheckDot /> : <RadioRing />}
                  {w.title}
                </button>
              );
            })}
          </div>
        </SellCard>
      ) : null}
    </SellShell>
  );
}
