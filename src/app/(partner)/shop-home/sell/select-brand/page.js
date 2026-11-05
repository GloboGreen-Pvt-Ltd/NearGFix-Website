'use client';

/**
 * /shop-home/sell/select-brand/?category=<CODE> — Sell a Device, step 2:
 * the brands master data links to the chosen category (GET
 * /master/categories/by-code/{CODE}/brands — the same call Book Service
 * makes), each with its real logo. A brand opens step 3, Select Model, with
 * the category and brand carried in the URL.
 *
 * Without ?category= this is the Sell on NearGFix home instead (SellHome:
 * category menu, Sell banner, benefits and the shop's own listings), which is
 * what the sidebar's Sell item and the dashboard's Sell card open. A category
 * there comes back to this page with ?category=.
 *
 * The category is read with useSearchParams (Suspense boundary in
 * ./layout.js) so it follows the URL: picking a category on the Sell home
 * changes ?category= without remounting this page, and the brands must load.
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from '@/lib/portalNavigation';
import { Tag } from 'lucide-react';

import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import SellHome from '@/components/shop-dashboard/SellHome';
import { SellStepHeader, SellTile } from '@/components/shop-dashboard/SellStep';
import { resolveMediaUrl } from '@/lib/deviceImage';
import { fetchCategoryBrands, findCategory, sellModelHref } from '@/lib/sellFlow';

const GRID = 'grid grid-cols-3 gap-3 min-[400px]:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8';

export default function SelectBrandPage() {
  // '' = no category (the Sell home). Follows the URL, so a category picked on the home opens its brands.
  const code = (useSearchParams().get('category') || '').toUpperCase();
  const [category, setCategory] = useState(null);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // The Sell home (SellHome loads its own data).
    if (!code) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    setQuery('');
    Promise.all([findCategory(code), fetchCategoryBrands(code)])
      .then(([cat, list]) => {
        if (!alive) return;
        setCategory(cat);
        setBrands(list);
      })
      .catch((err) => alive && setError(err.message || 'Could not load brands.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [code, reloadKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? brands.filter((b) => String(b.name || '').toLowerCase().includes(q)) : brands;
  }, [brands, query]);

  if (code === '') {
    return (
      <div className="-m-4 min-h-full bg-white sm:-m-6">
        <SellStepHeader title="Sell on NearGFix" subtitle="List your device. Reach verified buyers nearby." />
        <SellHome />
      </div>
    );
  }

  const subtitle = category ? `${category.name} brands` : code ? 'Brands' : '';

  return (
    <div className="-m-4 min-h-full bg-white sm:-m-6">
      <SellStepHeader title="Select Brand" subtitle={subtitle} query={query} onQueryChange={setQuery} searchPlaceholder="Search brands" />

      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 sm:py-6">
        {error ? (
          <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : loading ? (
          <div className={GRID}>
            {Array.from({ length: 16 }, (_, i) => (
              <div key={i} className="h-[112px] animate-pulse rounded-[18px] border border-[#ECECEC] bg-[#F8F8F8]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Tag}
            tone="muted"
            title={query ? 'No matches' : 'No brands for this category yet'}
            description={query ? `Nothing matches “${query}”.` : 'Brands linked to this category in master data will appear here.'}
          />
        ) : (
          <div className={GRID}>
            {filtered.map((b) => (
              <SellTile
                key={b.id}
                href={sellModelHref(code, b.id)}
                imageUrl={resolveMediaUrl(b.imageUrl) || (b.imageBase64 ? `data:image/png;base64,${b.imageBase64}` : null)}
                name={b.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
