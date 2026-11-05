'use client';

/**
 * /shop-home/sell/select-model/?category=<CODE>&brand=<brandId> — Sell a
 * Device, step 3: the brand's sellable models in the chosen category (GET
 * /master/brands/{id}/models narrowed by model.categoryId, sellActive only —
 * see sellFlow.js), each with its real catalog photo.
 *
 * Picking a model starts a fresh sell draft (lib/sellListing.js) with the
 * category, brand and model — the Partner app's SelectModel params — and
 * opens the next step, What are you selling? (device or spare parts).
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone } from 'lucide-react';

import EmptyState from '@/components/shop-dashboard/EmptyState';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import { SellStepHeader, SellTile } from '@/components/shop-dashboard/SellStep';
import { SELL_STEP_HREF, fetchBrand, fetchSellModels, findCategory, modelImageSrc } from '@/lib/sellFlow';
import { startSellDraft } from '@/lib/sellListing';

export default function SelectModelPage() {
  const router = useRouter();
  const [params, setParams] = useState(null);
  const [category, setCategory] = useState(null);
  const [brand, setBrand] = useState(null);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({ code: (sp.get('category') || '').toUpperCase(), brandId: sp.get('brand') || '' });
  }, []);

  useEffect(() => {
    if (!params) return undefined;
    if (!params.brandId) {
      setLoading(false);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError('');
    Promise.all([findCategory(params.code), fetchBrand(params.brandId)])
      .then(async ([cat, br]) => {
        const list = await fetchSellModels(params.brandId, cat?.id);
        if (!alive) return;
        setCategory(cat);
        setBrand(br);
        setModels(list);
      })
      .catch((err) => alive && setError(err.message || 'Could not load models.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [params, reloadKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? models.filter((m) => String(m.name || '').toLowerCase().includes(q)) : models;
  }, [models, query]);

  const subtitle = [brand?.name, category?.name].filter(Boolean).join(' · ');

  function pickModel(m) {
    startSellDraft({
      category: { id: category?.id || null, code: params.code, name: category?.name || '' },
      brand: { id: brand?.id || params.brandId, name: brand?.name || '' },
      model: { id: m.id, name: m.name, imageUrl: modelImageSrc(m) || null },
    });
    router.push(SELL_STEP_HREF.salesCategory);
  }

  return (
    <div className="-m-4 min-h-full bg-white sm:-m-6">
      <SellStepHeader title="Select Model" subtitle={subtitle} query={query} onQueryChange={setQuery} searchPlaceholder="Search models" />

      <div className="mx-auto max-w-[1280px] space-y-4 px-4 py-5 sm:px-6 sm:py-6">
        {!params?.brandId && params ? (
          <EmptyState icon={Smartphone} tone="muted" title="No brand selected" description="Start from Sell a Device and pick a category and brand." />
        ) : error ? (
          <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="h-[196px] animate-pulse rounded-[18px] border border-[#ECECEC] bg-[#F8F8F8]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            tone="muted"
            title={query ? 'No matches' : 'No sellable models yet'}
            description={query ? `Nothing matches “${query}”.` : `No ${[brand?.name, category?.name?.toLowerCase()].filter(Boolean).join(' ')} models are enabled for selling in master data.`}
          />
        ) : (
          <>
            <p className="text-[12.5px] font-semibold text-[#666666]">
              {filtered.length} model{filtered.length === 1 ? '' : 's'}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filtered.map((m) => (
                <SellTile
                  key={m.id}
                  imageUrl={modelImageSrc(m)}
                  name={m.name}
                  fallbackIcon={Smartphone}
                  imageClassName="h-28"
                  onClick={() => pickModel(m)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
