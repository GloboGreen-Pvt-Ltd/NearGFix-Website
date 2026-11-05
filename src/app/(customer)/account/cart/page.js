'use client';

/**
 * My Cart — /account/cart. Mirrors the app's MyCartScreen: product cards with a
 * quantity stepper and Remove, an order summary, and a Checkout that turns the
 * cart into a BUY order.
 *
 * Data (customer Bearer):
 *   GET    {MARKETPLACE}/customer/cart
 *   PUT    {MARKETPLACE}/customer/cart/{itemId}   { quantity }
 *   DELETE {MARKETPLACE}/customer/cart/{itemId}
 *   DELETE {MARKETPLACE}/customer/cart            (clear, after checkout)
 *   POST   {ORDER}/customer-orders/buy            { items, totalAmount }
 *
 * The cart controller is still live on the backend (marketplace-service). Prices
 * and product detail come hydrated on each CartItemResponse.product — nothing is
 * invented here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from 'lucide-react';

import { Button, cx } from '@/components/site/ui';
import {
  checkoutBuy,
  clearCart,
  formatINR,
  getCart,
  removeCartItem,
  updateCartItem,
} from '@/lib/customerAccount';
import {
  AccountEmpty,
  AccountError,
  AccountLoader,
  AccountPageHeader,
  Panel,
} from '@/components/site/account/ui';
import { notifyError } from '@/lib/toast';

function productOf(item) {
  return item.product || {};
}

function lineTotal(item) {
  const p = productOf(item);
  return Number(p.price || 0) * Number(item.quantity || 0);
}

/**
 * Thumbnail + click-to-open lightbox. The lightbox only ever shows the real
 * `src` this component already had (never the 📱 placeholder) — when there's
 * no image, or it failed to load, the thumbnail isn't clickable at all.
 */
function ProductImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const canPreview = Boolean(src) && !failed;

  const openLightbox = () => {
    if (!canPreview) return;
    setOpen(true);
    requestAnimationFrame(() => setVisible(true));
  };
  const closeLightbox = () => {
    setVisible(false);
    setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') closeLightbox();
    }
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!src || failed) {
    return (
      <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-brand-soften text-2xl">
        📱
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openLightbox}
        aria-label={`View larger image of ${alt || 'product'}`}
        className="block h-20 w-24 shrink-0 overflow-hidden rounded-xl transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || 'Product'}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-xl border border-brand-line object-cover"
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${alt || 'Product'} — image preview`}
          onClick={closeLightbox}
          className={cx(
            'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] transition-opacity duration-200',
            visible ? 'opacity-100' : 'opacity-0',
          )}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Close preview"
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt || 'Product'}
            onClick={(e) => e.stopPropagation()}
            className={cx(
              'max-h-[85dvh] max-w-[92vw] rounded-2xl object-contain shadow-2xl transition-transform duration-200 sm:max-w-[80vw]',
              visible ? 'scale-100' : 'scale-95',
            )}
          />
        </div>
      ) : null}
    </>
  );
}

function CartRow({ item, onQty, onRemove, busy }) {
  const p = productOf(item);
  return (
    <Panel className="p-4">
      <div className="flex gap-3.5">
        <ProductImage src={p.imageUrl} alt={p.title} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold text-brand-ink">{p.title || 'Product'}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {p.storageLabel ? (
              <span className="rounded-full bg-brand-soften px-2 py-0.5 text-[0.68rem] font-semibold text-brand-muted">
                {p.storageLabel}
              </span>
            ) : null}
            {p.color ? (
              <span className="rounded-full bg-brand-soften px-2 py-0.5 text-[0.68rem] font-semibold text-brand-muted">
                {p.color}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-base font-extrabold text-brand-700">₹{formatINR(p.price)}</p>
            {/* Quantity stepper */}
            <div className="inline-flex items-center rounded-full border border-brand-line">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={busy || item.quantity <= 1}
                onClick={() => onQty(item, item.quantity - 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-ink transition [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 hover:bg-brand-soften disabled:opacity-40"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-[2rem] text-center text-sm font-bold text-brand-ink">
                {item.quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={busy}
                onClick={() => onQty(item, item.quantity + 1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-ink transition [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10 hover:bg-brand-soften disabled:opacity-40"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-brand-line pt-2.5">
        <span className="text-xs text-brand-muted">
          Subtotal: <span className="font-bold text-brand-ink">₹{formatINR(lineTotal(item))}</span>
        </span>
        <button
          type="button"
          onClick={() => onRemove(item)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-red-600 [@media(pointer:coarse)]:min-h-10 transition hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Remove
        </button>
      </div>
    </Panel>
  );
}

export default function MyCartPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(null); // { orderNumber? } after checkout

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getCart());
    } catch (e) {
      setError(e?.message || '');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(() => items.reduce((sum, it) => sum + lineTotal(it), 0), [items]);
  const count = useMemo(() => items.reduce((n, it) => n + Number(it.quantity || 0), 0), [items]);

  const onQty = async (item, quantity) => {
    if (quantity < 1) return;
    // Optimistic update, then persist.
    setItems((list) => list.map((it) => (it.id === item.id ? { ...it, quantity } : it)));
    setBusy(true);
    try {
      await updateCartItem(item.id, quantity);
    } catch (e) {
      notifyError(e, "Couldn't update the quantity. Please try again.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (item) => {
    setBusy(true);
    try {
      await removeCartItem(item.id);
      setItems((list) => list.filter((it) => it.id !== item.id));
    } catch (e) {
      notifyError(e, "Couldn't remove the item. Please try again.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const onCheckout = async () => {
    if (!items.length) return;
    setPlacing(true);
    try {
      const payloadItems = items.map((it) => {
        const p = productOf(it);
        return { productId: p.id || it.productId, title: p.title, price: p.price, quantity: it.quantity };
      });
      const order = await checkoutBuy({ items: payloadItems, totalAmount: total });
      await clearCart().catch(() => {});
      setItems([]);
      setPlaced(order || {});
    } catch (e) {
      notifyError(e, "Couldn't place your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  /* ----- Order placed confirmation ------------------------------------- */
  if (placed) {
    return (
      <div>
        <AccountPageHeader eyebrow="My Cart" title="Order placed" />
        <Panel className="mt-5 flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-700">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-extrabold text-brand-ink">Thank you for your order!</h2>
          <p className="mt-1 text-sm text-brand-muted">
            {placed.orderNumber
              ? `Your order #${placed.orderNumber} has been placed.`
              : 'Your order has been placed successfully.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button href="/account/orders" variant="primary" size="md">
              View my orders
            </Button>
            <Button href="/#buy" variant="outline" size="md">
              Continue shopping
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <AccountPageHeader
        eyebrow="My Cart"
        title="Your cart"
        subtitle={count ? `${count} item${count > 1 ? 's' : ''}` : undefined}
      />

      <div className="mt-5">
        {loading ? (
          <AccountLoader label="Loading your cart…" />
        ) : error && !items.length ? (
          <AccountError message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <AccountEmpty
            icon={ShoppingCart}
            title="Your cart is empty"
            description="Browse our refurbished collection to get started."
            action={
              <Button href="/#buy" variant="primary" size="md">
                Start shopping
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
            {/* Items */}
            <div className="space-y-4">
              {items.map((it) => (
                <CartRow key={it.id} item={it} busy={busy} onQty={onQty} onRemove={onRemove} />
              ))}
            </div>

            {/* Summary */}
            <div className="lg:sticky lg:top-28 lg:self-start">
              <Panel className="p-5">
                <h2 className="text-base font-bold text-brand-ink">Order summary</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-brand-muted">Subtotal ({count} item{count > 1 ? 's' : ''})</dt>
                    <dd className="font-semibold text-brand-ink">₹{formatINR(total)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-brand-muted">Shipping</dt>
                    <dd className="font-semibold text-brand-700">FREE</dd>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-brand-line pt-3">
                    <dt className="text-base font-bold text-brand-ink">Total</dt>
                    <dd className="text-lg font-extrabold text-brand-ink">₹{formatINR(total)}</dd>
                  </div>
                </dl>

                <Button
                  variant="primary"
                  size="lg"
                  className={cx('mt-4 w-full', placing && 'pointer-events-none')}
                  onClick={onCheckout}
                  disabled={placing || busy}
                >
                  {placing ? 'Placing…' : 'Checkout'}
                </Button>

                <div className="mt-4 flex flex-col gap-2 text-xs text-brand-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
                    6-month warranty
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-brand-600" aria-hidden="true" />
                    Free delivery
                  </span>
                </div>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
