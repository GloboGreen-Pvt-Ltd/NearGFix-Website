'use client';

/**
 * HomeRepairCategories — the home page's "Our Services" section: the /repair
 * device-category cards under their own heading. Same component, same data (category-menu images
 * and names), same destination: each card opens /repair/?category=<code>, the
 * step the Repair page's own cards open.
 *
 * RepairFlow normally supplies the device-category rows (for the name → code
 * match); here they come from the bundled DEVICE_CATEGORIES, refreshed from
 * /master/device-categories exactly as RepairFlow does.
 *
 * Alongside the repair tiles: every active SELL and BUY row from
 * /master/category-menu?categoryType=SELL|BUY (name + image straight from the
 * admin). There is no /sell or /buy page yet, so those open the home page's
 * Sell / Buy section — the same /#sell and /#buy the header menu items use.
 * The full Repair list comes first, then Buy, then Sell, each in the same device
 * order (Mobile, Laptop, …); Category Menu → "Sort order" sets that device order.
 * Nearby Shops (no sortOrder) is last.
 */

import { useEffect, useState } from 'react';

import { masterApi } from '@/lib/api';
import { DEVICE_CATEGORIES, sortDeviceCategories } from '@/lib/siteContent';
import { normKey } from '@/lib/categoryMenuOrder';
import RepairCategoryCards, { loadCategoryMenu } from './RepairCategoryCards';

function unwrap(list) {
  if (Array.isArray(list)) return list;
  return list?.content ?? list?.data ?? [];
}

/** The Nearby Shops page (its image lives in public/). No sortOrder, so it comes last. */
const NEARBY_TILE = {
  id: 'nearby-shops',
  key: 'nearbyshops',
  name: 'Nearby Shops',
  imageUrl: '/Near-Store.png',
  href: '/nearby-shops',
};

/** Active SELL / BUY menu rows → tiles; RepairCategoryCards orders them by sortOrder. */
function menuTiles(rows, service, href) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.isActive === true && r.menuName)
    .map((r) => ({
      id: r.id,
      // "Sell Mobile" → "mobile", so a missing image falls back to that device's icon.
      key: normKey(r.menuName),
      name: r.menuName,
      imageUrl: r.imageUrl,
      sortOrder: r.sortOrder,
      service,
      href,
    }));
}

/** Same URL shape as RepairFlow's stepHref({ category }). */
const repairHref = ({ category }) => `/repair/?category=${encodeURIComponent(category)}`;

export default function HomeRepairCategories() {
  const [devices, setDevices] = useState(() => (Array.isArray(DEVICE_CATEGORIES) ? DEVICE_CATEGORIES : []));
  const [sellAndBuy, setSellAndBuy] = useState(null); // null = loading

  useEffect(() => {
    let alive = true;
    // Together, so the grid reorders once rather than once per type.
    Promise.all([loadCategoryMenu('SELL'), loadCategoryMenu('BUY')]).then(([sellRows, buyRows]) => {
      if (alive) setSellAndBuy([...menuTiles(sellRows, 'SELL', '/#sell'), ...menuTiles(buyRows, 'BUY', '/#buy')]);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    masterApi
      .get('/master/device-categories')
      .then((res) => {
        const rows = unwrap(res);
        if (!alive || !Array.isArray(rows) || rows.length === 0) return;
        const sorted = sortDeviceCategories(rows);
        if (Array.isArray(sorted) && sorted.length) setDevices(sorted);
      })
      .catch(() => {
        /* keep bundled rows — a public page never surfaces a backend error. */
      });
    return () => {
      alive = false;
    };
  }, []);

  // A new page, so land at its top (the Repair page's own cards keep scroll).
  return (
    <RepairCategoryCards
      deviceCategories={devices}
      hrefFor={repairHref}
      scroll
      small
      extraTiles={[...(sellAndBuy || []), NEARBY_TILE]}
      // Sell / Buy slot in between the repair tiles, so showing the grid before they
      // arrive would move tiles under the visitor's finger. loadCategoryMenu never
      // rejects, so this always settles.
      pending={sellAndBuy === null}
      heading={
        <h2 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">Our Services</h2>
      }
    />
  );
}
