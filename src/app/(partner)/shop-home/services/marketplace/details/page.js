'use client';

/**
 * /shop-home/services/marketplace/details/ — one Buy item, the Partner app's
 * OwnerBuyListingDetailsScreen. The item is handed over from the list
 * (sessionStorage, as the app passes it in route params — a nearby listing
 * has no GET by id).
 *
 *   Catalogue product → Add to Cart (POST /customer/cart { productId, quantity: 1 })
 *   Peer listing      → Contact, and Order Now (phones the seller) — or, for a
 *                       listing waiting on a quote, Send Quote, which the app
 *                       can't do yet either (the listing doesn't carry its sell order)
 *
 * The web also shows a catalogue product's extra photos and variant, which the
 * app's card drops.
 */

import { useState } from 'react';
import Link from '@/components/PortalLink';
import { useRouter } from '@/lib/portalNavigation';
import { ExternalLink, Phone, RotateCcw, ShieldCheck, ShoppingCart, Store } from 'lucide-react';

import { cx } from '@/components/site/ui';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import { SellButton, SellFooter, SellLoading, SellShell, SellThumb } from '@/components/shop-dashboard/SellStep';
import {
  BUY_HREF,
  addToCart,
  awaitingQuote,
  contactPhoneOf,
  formatRupees,
  isSparePart,
  mapHref,
  priceOf,
  sellerLabel,
  telHref,
  useBuyItem,
} from '@/lib/buyFlow';
import { notifyError, notifySuccess, toast } from '@/lib/toast';

function Row({ label, children, action }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <dt className="w-24 shrink-0 text-[13px] text-[#666666]">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13.5px] font-bold text-[#111111]">
        <span className="break-words">{children}</span>
        {action}
      </dd>
    </div>
  );
}

export default function BuyDetailsPage() {
  const router = useRouter();
  const item = useBuyItem();
  const [photo, setPhoto] = useState(0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const title = item?.productName || 'Listing Details';
  if (item === undefined) return <SellShell title="Listing Details"><SellLoading /></SellShell>;
  if (!item) {
    return (
      <SellShell title="Listing Details">
        <EmptyState
          icon={Store}
          tone="muted"
          title="Pick an item to view"
          description="Open a device or spare part from Buy to see its details here."
          action={
            <Link href={BUY_HREF.list} className="inline-flex h-11 items-center rounded-xl bg-[#035C6C] px-5 text-[14px] font-bold text-white transition hover:bg-[#024A57]">
              Go to Buy
            </Link>
          }
        />
      </SellShell>
    );
  }

  const isProduct = item.source === 'product' && Boolean(item.id);
  const photos = [...new Set([item.image, ...(item.extraImageUrls || [])].filter(Boolean))];
  const shown = photos[Math.min(photo, Math.max(photos.length - 1, 0))];
  const phone = contactPhoneOf(item);
  const contactName = item.sellerType === 'SHOP' ? item.shopName || 'Shop' : 'Customer';
  const quote = awaitingQuote(item);
  const variant = [[item.ramLabel, item.storageLabel].filter(Boolean).join(' / '), item.color].filter(Boolean).join(' · ');
  const location = [item.city, item.state, item.pincode].filter(Boolean).join(', ');
  const map = mapHref(item);

  async function onAdd() {
    if (adding) return;
    setAdding(true);
    try {
      await addToCart(item.id, 1);
      setAdded(true);
      notifySuccess(`${item.productName || 'Item'} is in your cart.`);
    } catch (err) {
      notifyError(err, 'Could not add to cart. Try again.');
    } finally {
      setAdding(false);
    }
  }

  // The app's callSeller / orderNow: dial when the seller shared a number, else say it isn't available.
  function callSeller() {
    if (phone) window.location.href = telHref(phone);
    else toast(`${contactName}'s number isn't available`, { id: `nophone:${item._key}` });
  }

  function sendQuote() {
    toast("Quotation not available yet — this listing doesn't include the sell order it belongs to, so a quote can't be sent yet.", { id: 'noquote' });
  }

  const footer = (
    <SellFooter width="max-w-5xl" caption={isProduct ? (added ? 'Added — open your cart to check out' : null) : '* Contact the seller after placing your order.'}>
      {isProduct ? (
        added ? (
          <>
            <SellButton variant="outline" onClick={onAdd} loading={adding}>
              Add another
            </SellButton>
            <SellButton onClick={() => router.push(BUY_HREF.cart)} icon={ShoppingCart}>
              View Cart
            </SellButton>
          </>
        ) : (
          <SellButton onClick={onAdd} loading={adding} icon={ShoppingCart}>
            {adding ? 'Adding…' : 'Add to Cart'}
          </SellButton>
        )
      ) : (
        <>
          <SellButton variant="outline" onClick={callSeller} icon={Phone}>
            {phone ? 'Contact' : `Call ${contactName}`}
          </SellButton>
          <SellButton onClick={quote ? sendQuote : callSeller}>{quote ? 'Send Quote' : 'Order Now'}</SellButton>
        </>
      )}
    </SellFooter>
  );

  return (
    <SellShell title={title} subtitle={sellerLabel(item)} footer={footer} width="max-w-5xl">
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <section className="space-y-2.5">
          <div className="relative flex h-72 max-h-[60dvh] items-center justify-center overflow-hidden rounded-[20px] border border-[#ECECEC] bg-[#F8F8F8] p-6 sm:h-96">
            <SellThumb src={shown} className="h-full w-full" iconClassName="h-14 w-14" />
            {isSparePart(item) ? (
              <span className="absolute left-3 top-3 rounded-full bg-[#FFF5E8] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#B54708]">Spare part</span>
            ) : null}
          </div>
          {photos.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`Show photo ${i + 1} of ${photos.length}`}
                  aria-current={src === shown ? 'true' : undefined}
                  className={cx('h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition', src === shown ? 'border-[#035C6C]' : 'border-[#ECECEC] hover:border-[#D0D5DD]')}
                >
                  <SellThumb src={src} fit="cover" className="h-full w-full" iconClassName="h-5 w-5" />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <div>
            <span
              className={cx(
                'inline-flex rounded-full px-3 py-1 text-[15px] font-extrabold',
                quote ? 'bg-[#FEF0C7] text-[#B54708]' : 'bg-[#E5F3F5] text-[#024A57]',
              )}
            >
              {quote ? 'Awaiting your quote' : priceOf(item) > 0 ? formatRupees(priceOf(item), 2) : 'Price on request'}
            </span>
            <h2 className="mt-2.5 break-words text-[22px] font-extrabold leading-tight tracking-tight text-[#111111]">{item.productName || 'Untitled'}</h2>
            {item.brandName || item.modelName ? <p className="mt-0.5 text-[13.5px] text-[#666666]">{[item.brandName, item.modelName].filter(Boolean).join(' · ')}</p> : null}
          </div>

          <dl className="divide-y divide-[#F3F3F3] overflow-hidden rounded-[18px] border border-[#ECECEC] bg-white">
            <Row label="Condition">{item.condition || 'Good'}</Row>
            {item.description ? <Row label="Specs">{item.description}</Row> : null}
            {variant ? <Row label="Variant">{variant}</Row> : null}
            <Row label="Sold by">{sellerLabel(item)}</Row>
            <Row
              label="Location"
              action={
                map ? (
                  <a href={map} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-[12.5px] font-bold text-[#035C6C] hover:underline">
                    View on map
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : null
              }
            >
              {location || '—'}
            </Row>
            {item.distanceKm != null ? <Row label="Distance">{`${Number(item.distanceKm).toFixed(1)} km`}</Row> : null}
          </dl>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ECECEC] bg-[#F8F8F8] px-3 py-1.5 text-[12.5px] font-bold text-[#344054]">
              <RotateCcw className="h-3.5 w-3.5 text-[#035C6C]" aria-hidden="true" />
              15 Days Refund*
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ECECEC] bg-[#F8F8F8] px-3 py-1.5 text-[12.5px] font-bold text-[#344054]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#035C6C]" aria-hidden="true" />
              Upto 06 Months Warranty*
            </span>
          </div>
          <p className="text-[12px] text-[#666666]">* Contact the seller after placing your order.</p>
        </section>
      </div>
    </SellShell>
  );
}
