'use client';

/**
 * /shop-home/sell/price/ — Sell your Gadget: the shop types its price, then
 * confirms (the Partner app's OwnerSellGadgetPriceScreen). There is no
 * pricing formula or quote API — the price is the owner's own.
 *
 *   Device       one POST /marketplace/products (buildDeviceListing)
 *   Spare parts  one POST per part priced above 0 (buildSparePartListing);
 *                parts already listed are skipped if a retry follows a failure
 *
 * On success the draft is replaced by just { listed } — so Back can't post the
 * same listing again — and the Listed page opens.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/lib/portalNavigation';
import { Check, IndianRupee, Tag, Wrench } from 'lucide-react';

import { cx } from '@/components/site/ui';
import {
  SellButton,
  SellFooter,
  SellIntro,
  SellLoading,
  SellMissingDraft,
  SellShell,
  SellThumb,
} from '@/components/shop-dashboard/SellStep';
import { SELL_STEP_HREF, currentShopId } from '@/lib/sellFlow';
import {
  buildDeviceListing,
  buildSparePartListing,
  createSellListing,
  deviceSpecs,
  draftPhotoList,
  formatPrice,
  startSellDraft,
  toPrice,
  useSellDraft,
} from '@/lib/sellListing';
import { notifyError } from '@/lib/toast';

const firstOf = (obj) => Object.values(obj || {}).find(Boolean) || null;

function PriceInput({ id, value, onChange, large, label }) {
  const has = toPrice(value) > 0;
  return (
    <div
      className={cx(
        'flex items-center rounded-2xl border-[1.5px] px-3.5 transition focus-within:border-[#035C6C] focus-within:ring-4 focus-within:ring-[#035C6C]/10',
        has ? 'border-[#035C6C] bg-[#E5F3F5]' : 'border-[#ECECEC] bg-white',
      )}
    >
      <span className={cx('mr-1.5 font-extrabold text-[#111111]', large ? 'text-[20px]' : 'text-[15px]')}>₹</span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="0"
        aria-label={label}
        className={cx('min-w-0 flex-1 bg-transparent font-extrabold text-[#111111] outline-none placeholder:text-[#98A2B3]', large ? 'py-3 text-[20px]' : 'py-2 text-[15px]')}
      />
    </div>
  );
}

export default function PricePage() {
  const router = useRouter();
  const draft = useSellDraft();
  const [priceText, setPriceText] = useState('');
  const [partPrices, setPartPrices] = useState({}); // part index -> text
  const [posted, setPosted] = useState({}); // part index -> created listing
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!confirming) return undefined;
    dialogRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && !submitting && setConfirming(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirming, submitting]);

  const parts = draft?.mode === 'parts' && Array.isArray(draft?.spareParts) && draft.spareParts.length ? draft.spareParts : null;
  const deviceReady = Boolean(draft?.mode !== 'parts' && draft?.device && draft?.descriptionType && draft?.images);
  const shell = { title: 'Sell your Gadget', subtitle: parts ? 'Spare parts' : draft?.model?.name };

  if (draft === undefined) return <SellShell {...shell}><SellLoading /></SellShell>;
  if (!parts && !deviceReady) return <SellShell {...shell}><SellMissingDraft /></SellShell>;

  const device = draft.device || {};
  const specs = deviceSpecs(device);
  const priceNum = toPrice(priceText);
  const priced = parts ? parts.map((part, idx) => ({ part, idx, price: toPrice(partPrices[idx]) })).filter((p) => p.price > 0) : [];
  const total = parts ? priced.reduce((s, p) => s + p.price, 0) : priceNum;
  const canSubmit = parts ? priced.length > 0 : priceNum > 0;
  const modalImage = parts ? firstOf(draft.partImages) : device.imageUrl;

  async function submit() {
    if (submitting) return; // a fast double-click must not post twice
    setSubmitting(true);
    const shopId = currentShopId();
    const done = { ...posted };
    try {
      let listed;
      if (parts) {
        for (const p of priced) {
          if (done[p.idx]) continue;
          done[p.idx] = await createSellListing(buildSparePartListing(p.part, p.price, draft.partImages, shopId));
          setPosted({ ...done });
        }
        const results = priced.map((p) => done[p.idx]);
        listed = {
          id: results[0]?.id || null,
          title: `Spare Parts (${results.length})`,
          price: total,
          image: firstOf(draft.partImages),
          count: results.length,
        };
      } else {
        const res = await createSellListing(buildDeviceListing(draft, priceNum, shopId));
        listed = { id: res?.id || null, title: device.modelName || 'Device', price: priceNum, image: draftPhotoList(draft)[0] || device.imageUrl || null };
      }
      startSellDraft({ listed });
      router.replace(SELL_STEP_HREF.listed);
    } catch (err) {
      const detail = err?.message || 'Could not create the marketplace listing';
      const already = Object.keys(done).length;
      notifyError(
        `${parts && already ? `${already} of ${priced.length} parts listed. ` : ''}${err?.status ? `${detail} (HTTP ${err.status})` : detail}`,
      );
      setSubmitting(false);
      setConfirming(false);
    }
  }

  const footer = (
    <SellFooter caption={canSubmit ? null : parts ? 'Price at least one part to continue' : 'Enter a price to continue'}>
      <SellButton onClick={() => setConfirming(true)} disabled={!canSubmit}>
        {parts ? `Submit (${priced.length})` : 'Submit'}
      </SellButton>
    </SellFooter>
  );

  return (
    <>
      <SellShell {...shell} footer={footer}>
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5F3F5] px-3.5 py-1.5 text-[11.5px] font-extrabold tracking-widest text-[#024A57]">
            <Tag className="h-3.5 w-3.5" aria-hidden="true" />
            SELL NOW FOR AMAZING PRICE
          </span>
        </div>

        {parts ? (
          <>
            <SellIntro title="Set part prices" caption="Enter a price for each part you want to list. Parts left at 0 are skipped." />
            <div className="space-y-2.5">
              {parts.map((p, idx) => {
                const listedAlready = Boolean(posted[idx]);
                return (
                  <div
                    key={`${p.groupKey}-${p.partName}-${idx}`}
                    className={cx(
                      'flex items-center gap-3 rounded-2xl border-[1.5px] bg-white p-3',
                      toPrice(partPrices[idx]) > 0 ? 'border-[#035C6C]' : 'border-[#ECECEC]',
                    )}
                  >
                    <SellThumb src={p.imageUrl} fit="cover" fallbackIcon={Wrench} className="h-[52px] w-[52px] rounded-xl bg-[#F3F3F3]" iconClassName="h-5 w-5" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-[#111111]">{p.partName}</p>
                      <p className="truncate text-[12.5px] text-[#666666]">{p.group}</p>
                      {listedAlready ? <p className="text-[11.5px] font-bold text-[#024A57]">Listed</p> : null}
                    </div>
                    <div className="w-32 shrink-0 sm:w-40">
                      {listedAlready ? (
                        <p className="text-right text-[15px] font-extrabold text-[#024A57]">₹{formatPrice(toPrice(partPrices[idx]))}</p>
                      ) : (
                        <PriceInput value={partPrices[idx] || ''} onChange={(v) => setPartPrices((s) => ({ ...s, [idx]: v }))} label={`Price for ${p.partName}`} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center rounded-2xl bg-[#E5F3F5] p-3.5">
              <div className="flex-1">
                <p className="text-[11.5px] font-bold tracking-wider text-[#666666]">
                  TOTAL · {priced.length}/{parts.length} PRICED
                </p>
                <p className="text-[19px] font-extrabold text-[#024A57]">₹{formatPrice(total)}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#035C6C]">
                <IndianRupee className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            </div>
          </>
        ) : (
          <section className="flex flex-col items-center rounded-[20px] border border-[#ECECEC] bg-white p-4 sm:p-6">
            <SellThumb src={device.imageUrl} className="mb-3 h-[150px] w-[150px] rounded-full bg-[#E5F3F5] p-5" iconClassName="h-11 w-11" />
            <p className="line-clamp-2 text-center text-[16px] font-extrabold text-[#111111]">{device.modelName || 'Device'}</p>
            {specs || device.color ? <p className="mt-0.5 text-center text-[13px] text-[#666666]">{[specs, device.color].filter(Boolean).join(' · ')}</p> : null}

            <div className="mt-5 w-full max-w-md">
              <label htmlFor="sell-price" className="block text-[13.5px] font-bold text-[#111111]">
                Your selling price
              </label>
              <p className="mb-2 mt-0.5 text-[12.5px] text-[#666666]">Buyers nearby will see this price.</p>
              <PriceInput id="sell-price" value={priceText} onChange={setPriceText} large />
              {priceNum > 0 ? <p className="mt-1.5 text-[12.5px] font-bold text-[#024A57]">Listing price: ₹{formatPrice(priceNum)}</p> : null}
            </div>
          </section>
        )}
      </SellShell>

      {confirming ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1E1E1E]/50 px-5 py-4" onMouseDown={() => !submitting && setConfirming(false)}>
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-sale-title"
            onMouseDown={(e) => e.stopPropagation()}
            className="max-h-full w-full max-w-[420px] overflow-y-auto overscroll-contain rounded-3xl bg-white p-5 outline-none"
          >
            <div className="flex flex-col items-center">
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#E5F3F5]">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#035C6C] text-white">
                  <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
                </span>
              </span>
              <h2 id="confirm-sale-title" className="mt-2 text-[18px] font-extrabold text-[#111111]">
                Confirm your sale
              </h2>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#F8F8F8] p-3">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[16px] font-extrabold text-[#111111]">{parts ? `Spare Parts (${priced.length})` : device.modelName || 'Device'}</p>
                {parts ? (
                  <p className="mt-0.5 line-clamp-3 text-[12.5px] text-[#666666]">{priced.map((p) => p.part.partName).join(', ')}</p>
                ) : specs ? (
                  <p className="mt-0.5 text-[12.5px] text-[#666666]">{specs}</p>
                ) : null}
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#035C6C] px-2.5 py-1 text-[11px] font-extrabold text-white">
                  <Tag className="h-3 w-3" aria-hidden="true" />
                  BEST DEAL
                </span>
              </div>
              {modalImage ? <SellThumb src={modalImage} fit={parts ? 'cover' : 'contain'} className="h-[92px] w-[76px] rounded-lg" /> : null}
            </div>

            <p className="mt-3.5 text-[13.5px] leading-relaxed text-[#111111]">
              {parts
                ? `We'll list ${priced.length} spare part${priced.length === 1 ? '' : 's'} separately. Confirm to proceed.`
                : 'Should we proceed with selling this product? Please confirm.'}
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-[13.5px] font-bold text-[#666666]">{parts ? 'Total' : 'Price'}</span>
              <span className="text-[19px] font-extrabold text-[#024A57]">₹{formatPrice(total)}</span>
            </p>

            <div className="mt-5 flex gap-2.5">
              <SellButton variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>
                Cancel
              </SellButton>
              <SellButton onClick={submit} loading={submitting}>
                Sell Now
              </SellButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
