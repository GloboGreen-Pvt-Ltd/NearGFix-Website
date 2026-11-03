'use client';

/**
 * /shop-home/sell/images/ — Sell a Device: photos and a one-line condition
 * (the Partner app's SellImagesScreen; the last step before price on every
 * device path). Five optional slots — front, back, side & center, camera,
 * other — each uploaded the moment it's picked (folder "sell"), max 5 MB.
 * A dead device has no condition field: it always lists as "Dead / Unknown".
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Camera, ImagePlus, Loader2, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import {
  SellButton,
  SellCard,
  SellFooter,
  SellIntro,
  SellLoading,
  SellMissingDraft,
  SellShell,
} from '@/components/shop-dashboard/SellStep';
import { SELL_STEP_HREF } from '@/lib/sellFlow';
import { PHOTO_SLOTS, saveSellDraft, uploadSellPhoto, useSellDraft } from '@/lib/sellListing';
import { notifyError } from '@/lib/toast';

export default function ImagesPage() {
  const router = useRouter();
  const draft = useSellDraft();
  const ready = Boolean(draft?.device && draft?.descriptionType);
  const [images, setImages] = useState({}); // slot key -> url
  const [condition, setCondition] = useState('Good');
  const [uploading, setUploading] = useState(null); // slot key

  // Coming back to this step keeps the earlier photos and condition.
  useEffect(() => {
    if (draft?.images) setImages(draft.images);
    if (typeof draft?.deviceCondition === 'string') setCondition(draft.deviceCondition);
  }, [draft]);

  const shell = { title: 'Sell Device Images', subtitle: draft?.model?.name };
  if (draft === undefined) return <SellShell {...shell}><SellLoading /></SellShell>;
  if (!ready) return <SellShell {...shell}><SellMissingDraft /></SellShell>;

  const dead = draft.workingCondition === 'DEAD';
  const added = PHOTO_SLOTS.filter((s) => images[s.key]).length;

  async function onPick(key, e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so picking the same file again still fires
    if (!file) return;
    setUploading(key);
    try {
      const url = await uploadSellPhoto(file, 'sell');
      setImages((m) => ({ ...m, [key]: url }));
    } catch (err) {
      notifyError(err, 'Upload failed. Try again.');
    } finally {
      setUploading(null);
    }
  }

  const remove = (key) =>
    setImages((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });

  function onContinue() {
    saveSellDraft({ images, deviceCondition: condition });
    router.push(SELL_STEP_HREF.price);
  }

  const footer = (
    <SellFooter caption={uploading ? 'Uploading photo…' : `${added} of ${PHOTO_SLOTS.length} photos added`}>
      <SellButton onClick={onContinue} disabled={Boolean(uploading)} icon={ArrowRight}>
        Continue
      </SellButton>
    </SellFooter>
  );

  return (
    <SellShell {...shell} footer={footer}>
      <SellIntro title="Device photos" caption="Clear photos help buyers trust the listing. Max 5 MB each." />
      <SellCard>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {PHOTO_SLOTS.map(({ key, label }) => {
            const url = images[key];
            const busy = uploading === key;
            const Icon = key === 'camera' ? Camera : ImagePlus;
            return (
              <div key={key} className="relative">
                <label
                  className={cx(
                    'relative flex h-36 flex-col items-center justify-center overflow-hidden rounded-[14px] border-[1.5px] transition focus-within:ring-4 focus-within:ring-[#035C6C]/20 sm:h-40',
                    url ? 'border-solid border-[#035C6C] bg-white' : 'border-dashed border-[#C7E6EA] bg-[#E5F3F5]',
                    uploading ? 'cursor-wait' : 'cursor-pointer hover:border-[#035C6C]',
                  )}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={Boolean(uploading)}
                    onChange={(e) => onPick(key, e)}
                    aria-label={url ? `Replace ${label} photo` : `Add ${label} photo`}
                  />
                  {busy ? (
                    <Loader2 className="h-6 w-6 animate-spin text-[#035C6C]" aria-hidden="true" />
                  ) : url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element -- uploaded photo URL. */}
                      <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-white/90 py-1 text-center text-[12px] font-bold text-[#111111]">{label}</span>
                    </>
                  ) : (
                    <>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#035C6C]">
                        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <span className="mt-2 text-[13px] font-bold text-[#111111]">{label}</span>
                      <span className="text-[11.5px] text-[#666666]">Click to add</span>
                    </>
                  )}
                </label>
                {url && !busy ? (
                  <button
                    type="button"
                    onClick={() => remove(key)}
                    aria-label={`Remove ${label} photo`}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/75"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </SellCard>

      {/* A dead device always lists as "Dead / Unknown", so its condition text would go nowhere. */}
      {!dead ? (
        <SellCard>
          <label htmlFor="device-condition" className="block text-[14.5px] font-bold text-[#111111]">
            Device condition
          </label>
          <p className="mb-2 mt-0.5 text-[12.5px] text-[#666666]">A word or two buyers will see, e.g. Good, Like new.</p>
          <input
            id="device-condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="Good"
            className="h-12 w-full rounded-xl border-[1.5px] border-[#ECECEC] bg-white px-3.5 text-[14px] font-semibold text-[#111111] outline-none transition placeholder:text-[#98A2B3] focus:border-[#035C6C] focus:ring-4 focus:ring-[#035C6C]/10"
          />
        </SellCard>
      ) : null}
    </SellShell>
  );
}
