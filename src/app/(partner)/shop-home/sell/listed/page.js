'use client';

/**
 * /shop-home/sell/listed/ — the end of Sell a Device (the Partner app's
 * OwnerSellListedScreen): what was listed, a short listing reference (the
 * UUID's first block), the price, and Home / Sell More. Both clear the draft.
 */

import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';

import { SellButton, SellLoading, SellMissingDraft, SellShell, SellThumb } from '@/components/shop-dashboard/SellStep';
import { clearSellDraft, formatPrice, useSellDraft } from '@/lib/sellListing';

export default function ListedPage() {
  const router = useRouter();
  const draft = useSellDraft();
  const listed = draft?.listed;

  if (draft === undefined) return <SellShell title="Listed"><SellLoading /></SellShell>;
  if (!listed) return <SellShell title="Listed"><SellMissingDraft /></SellShell>;

  const ref = listed.id ? String(listed.id).split('-')[0].toUpperCase() : null;
  const go = (href) => {
    clearSellDraft();
    router.push(href);
  };

  return (
    <SellShell title="Listed" width="max-w-lg">
      <div className="flex flex-col items-center pt-4 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#E5F3F5]">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#035C6C] text-white">
            <Check className="h-9 w-9" strokeWidth={3} aria-hidden="true" />
          </span>
        </span>
        <h2 className="mt-3.5 text-[22px] font-extrabold text-[#111111]">Listed successfully!</h2>
        <p className="mt-1 text-[13.5px] text-[#666666]">
          {listed.count > 1 ? 'Your spare parts are now live on the marketplace.' : 'Your device is now live on the marketplace.'}
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-[18px] border border-[#ECECEC] bg-white p-3.5">
        <SellThumb src={listed.image} className="h-[68px] w-[60px] rounded-xl bg-[#F3F3F3]" iconClassName="h-6 w-6" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[14.5px] font-extrabold text-[#111111]">{listed.title}</p>
          {ref ? <p className="text-[12.5px] text-[#666666]">Listing #{ref}</p> : null}
          <p className="mt-1 text-[16px] font-extrabold text-[#024A57]">₹{formatPrice(listed.price)}</p>
        </div>
        <span className="self-start rounded-full bg-[#E5F3F5] px-2 py-0.5 text-[10.5px] font-extrabold text-[#024A57]">LIVE</span>
      </div>

      <div className="flex gap-2.5">
        <SellButton variant="outline" onClick={() => go('/shop-home')}>
          Home
        </SellButton>
        <SellButton onClick={() => go('/shop-home/sell/select-brand/')}>Sell More</SellButton>
      </div>
    </SellShell>
  );
}
