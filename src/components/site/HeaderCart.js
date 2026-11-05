'use client';

/**
 * HeaderCart — compact cart icon + live item-count badge for the primary
 * header. Links to the existing /account/cart page, which already gates
 * itself on a signed-in customer (AccountLayout → AccountGate) — this
 * control does not duplicate that gate, it just surfaces a shortcut.
 *
 * The count is fetched only for a signed-in customer, via the existing
 * getCart() call the /account/cart page itself uses. A fetch failure (or no
 * session) just leaves the badge off rather than showing a stale or fake
 * number — never invents a count.
 *
 * Known gap: cart mutations that happen elsewhere (e.g. adding a product from
 * a marketplace page) don't push an event this control listens for, so the
 * badge can lag until the next customerAuth event or tab focus. Refetching on
 * window focus covers the common "left it open in another tab" case cheaply
 * without wiring a new cross-app cart-change event bus.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';

import { cx } from './ui';
import { readCustomer, subscribe } from '@/lib/customerAuth';
import { getCart } from '@/lib/customerAccount';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

export default function HeaderCart({ className, size = 'md' }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function refresh(customer) {
      if (!customer) {
        if (alive) setCount(0);
        return;
      }
      try {
        const items = await getCart();
        if (!alive) return;
        const total = Array.isArray(items)
          ? items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
          : 0;
        setCount(total);
      } catch {
        if (alive) setCount(0);
      }
    }

    refresh(readCustomer());
    const unsubscribe = subscribe(refresh);
    const onFocus = () => refresh(readCustomer());
    window.addEventListener('focus', onFocus);

    return () => {
      alive = false;
      unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <Link
      href="/account/cart"
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'}
      className={cx(
        'relative inline-flex shrink-0 items-center justify-center border border-brand-line bg-white',
        size === 'lg' ? 'h-11 w-11 rounded-full' : 'h-10 w-10 rounded-xl',
        'text-brand-ink transition hover:bg-brand-soften',
        FOCUS_RING,
        className,
      )}
    >
      <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      {count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold leading-none text-white">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
