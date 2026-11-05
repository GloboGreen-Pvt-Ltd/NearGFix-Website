'use client';

/**
 * /shop-home/services/marketplace/cart/ — My Cart, the Partner app's
 * OwnerCartScreen. The marketplace cart is keyed by the signed-in user:
 *   GET    /customer/cart                 rows { id, productId, quantity, product }
 *   PUT    /customer/cart/{id} { quantity }   stepper (min 1; optimistic, re-read on failure)
 *   DELETE /customer/cart/{id}                remove
 *   DELETE /customer/cart                     clear (after a confirm)
 * Checkout says order placement is coming soon — exactly what the app does;
 * no order endpoint is wired anywhere in it yet.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/PortalLink';
import { Minus, Plus, ShoppingCart, Trash2, Wrench } from 'lucide-react';

import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import EmptyState from '@/components/shop-dashboard/EmptyState';
import { SellButton, SellFooter, SellLoading, SellShell, SellThumb } from '@/components/shop-dashboard/SellStep';
import { BUY_HREF, cartQuantity, clearCart, formatRupees, getCart, removeCartItem, updateCartItem } from '@/lib/buyFlow';
import { resolveMediaUrl } from '@/lib/deviceImage';
import { notifyError, toast } from '@/lib/toast';

const isSpare = (p) => p?.type === 'SPARE_PART' || p?.descriptionType === 'SPARE_PARTS';

export default function CartPage() {
  const [rows, setRows] = useState(null); // null while loading
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(() => {
    setError('');
    getCart()
      .then(setRows)
      .catch((err) => {
        setRows((r) => r || []);
        setError(err.message || 'Could not load your cart.');
      });
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!confirmClear) return undefined;
    const onKey = (e) => e.key === 'Escape' && !clearing && setConfirmClear(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmClear, clearing]);

  async function setQuantity(row, next) {
    if (next < 1 || busyId) return;
    setBusyId(row.id);
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, quantity: next } : r)));
    try {
      await updateCartItem(row.id, next);
    } catch (err) {
      notifyError(err, 'Could not update the quantity.');
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row) {
    if (busyId) return;
    setBusyId(row.id);
    try {
      await removeCartItem(row.id);
      setRows((list) => list.filter((r) => r.id !== row.id));
    } catch (err) {
      notifyError(err, 'Could not remove the item.');
    } finally {
      setBusyId(null);
    }
  }

  async function clearAll() {
    setClearing(true);
    try {
      await clearCart();
      setRows([]);
      setConfirmClear(false);
    } catch (err) {
      notifyError(err, 'Could not clear the cart.');
    } finally {
      setClearing(false);
    }
  }

  if (rows === null) return <SellShell title="My Cart"><SellLoading label="Loading your cart…" /></SellShell>;

  const totalQty = cartQuantity(rows);
  const subtotal = rows.reduce((s, r) => s + (Number(r.product?.price) || 0) * (Number(r.quantity) || 0), 0);

  const footer = rows.length ? (
    <SellFooter caption={`${totalQty} item${totalQty === 1 ? '' : 's'} · Subtotal ${formatRupees(subtotal)}`}>
      <SellButton onClick={() => toast('Order placement from the cart is coming soon.', { id: 'checkout' })}>Checkout</SellButton>
    </SellFooter>
  ) : null;

  return (
    <>
      <SellShell title="My Cart" subtitle={rows.length ? `${totalQty} item${totalQty === 1 ? '' : 's'}` : null} footer={footer}>
        {error ? <ErrorBanner message={error} onRetry={load} /> : null}

        {!rows.length && !error ? (
          <EmptyState
            icon={ShoppingCart}
            tone="muted"
            title="Your cart is empty"
            description="Add products and spare parts from the Buy screen to see them here."
            action={
              <Link href={BUY_HREF.list} className="inline-flex h-11 items-center rounded-xl bg-[#035C6C] px-5 text-[14px] font-bold text-white transition hover:bg-[#024A57]">
                Browse Buy
              </Link>
            }
          />
        ) : null}

        {rows.length ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#666666]">
                {rows.length} product{rows.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-[#D92D20] transition hover:bg-[#FEF3F2]"
              >
                Clear
              </button>
            </div>
            <ul className="space-y-2.5">
              {rows.map((r) => {
                const p = r.product || {};
                const qty = Number(r.quantity) || 1;
                const busy = busyId === r.id;
                return (
                  <li key={r.id} className="flex gap-3 rounded-[18px] border border-[#ECECEC] bg-white p-3">
                    <SellThumb
                      src={resolveMediaUrl(p.imageUrl)}
                      fallbackIcon={isSpare(p) ? Wrench : undefined}
                      className="h-20 w-20 rounded-xl bg-[#F8F8F8] p-1.5"
                      iconClassName="h-7 w-7"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start gap-2">
                        <p className="line-clamp-2 min-w-0 flex-1 text-[14px] font-bold leading-snug text-[#111111]">{p.title || 'Product'}</p>
                        <button
                          type="button"
                          onClick={() => remove(r)}
                          disabled={Boolean(busyId)}
                          aria-label={`Remove ${p.title || 'product'}`}
                          className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-[#98A2B3] transition hover:bg-[#FEF3F2] hover:text-[#D92D20] disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {isSpare(p) ? <span className="rounded-md bg-[#FFF5E8] px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase text-[#B54708]">Spare</span> : null}
                        {p.conditionLabel ? <span className="rounded-md bg-[#F3F3F3] px-1.5 py-0.5 text-[11px] font-semibold text-[#475467]">{p.conditionLabel}</span> : null}
                      </div>
                      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                        <p className="text-[16px] font-extrabold text-[#024A57]">{formatRupees(p.price)}</p>
                        <div className="flex items-center rounded-xl border border-[#ECECEC]" aria-label={`Quantity for ${p.title || 'product'}`}>
                          <button
                            type="button"
                            onClick={() => setQuantity(r, qty - 1)}
                            disabled={qty <= 1 || Boolean(busyId)}
                            aria-label="Decrease quantity"
                            className="flex h-9 w-9 items-center justify-center text-[#111111] transition hover:text-[#035C6C] disabled:text-[#D0D5DD]"
                          >
                            <Minus className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <span className="w-8 text-center text-[14px] font-extrabold text-[#111111]" aria-live="polite">
                            {busy ? '…' : qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setQuantity(r, qty + 1)}
                            disabled={Boolean(busyId)}
                            aria-label="Increase quantity"
                            className="flex h-9 w-9 items-center justify-center text-[#111111] transition hover:text-[#035C6C] disabled:text-[#D0D5DD]"
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </SellShell>

      {confirmClear ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1E1E1E]/50 px-5" onMouseDown={() => !clearing && setConfirmClear(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-cart-title"
            aria-describedby="clear-cart-text"
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-[380px] rounded-3xl bg-white p-5"
          >
            <h2 id="clear-cart-title" className="text-[18px] font-extrabold text-[#111111]">
              Clear cart?
            </h2>
            <p id="clear-cart-text" className="mt-1 text-[13.5px] text-[#666666]">
              Remove all items from your cart?
            </p>
            <div className="mt-5 flex gap-2.5">
              <SellButton variant="outline" onClick={() => setConfirmClear(false)} disabled={clearing}>
                Cancel
              </SellButton>
              <SellButton variant="danger" onClick={clearAll} loading={clearing}>
                Clear
              </SellButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
