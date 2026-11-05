'use client';

import { useEffect, useMemo, useState } from 'react';
import { masterApi } from '@/lib/api';
import DataTable from '@/components/DataTable';
import { notifyError } from '@/lib/toast';

export default function MasterCategoryBrandMappingPage() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [list, setList] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { type: 'create' | 'edit', item?: {} }

  // Form state
  const [categoryId, setCategoryId] = useState('');
  const [brandIds, setBrandIds] = useState([]); // multi-select in create mode
  const [brandId, setBrandId] = useState('');   // single in edit mode
  const [brandSearch, setBrandSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(''); // shown during multi-create

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [cats, brs, maps] = await Promise.all([
        masterApi.get('/master/device-categories').catch(() => []),
        masterApi.get('/master/brands').catch(() => []),
        masterApi.get('/master/category-brand-mappings').catch(() => []),
      ]);
      setCategories(Array.isArray(cats) ? cats : cats?.content ?? []);
      setBrands(Array.isArray(brs) ? brs : brs?.content ?? []);
      setList(Array.isArray(maps) ? maps : maps?.content ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const catName = (id) => categories.find((c) => c.id === id)?.name || '—';
  const brandById = (id) => brands.find((b) => b.id === id);
  const brandName = (id) => brandById(id)?.name || '—';

  const filtered = useMemo(
    () => (filterCategory ? list.filter((m) => m.categoryId === filterCategory) : list),
    [list, filterCategory]
  );

  // Brand IDs that are ALREADY mapped to the selected (form) category.
  const mappedBrandIdsForFormCategory = useMemo(() => {
    if (!categoryId) return new Set();
    return new Set(list.filter((m) => m.categoryId === categoryId).map((m) => m.brandId));
  }, [list, categoryId]);

  const visibleBrandsForForm = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    return q ? brands.filter((b) => (b.name || '').toLowerCase().includes(q)) : brands;
  }, [brands, brandSearch]);

  const openCreate = () => {
    setModal({ type: 'create' });
    setCategoryId(filterCategory || categories[0]?.id || '');
    setBrandIds([]);
    setBrandSearch('');
  };
  const openEdit = (item) => {
    setModal({ type: 'edit', item });
    setCategoryId(item.categoryId || '');
    setBrandId(item.brandId || '');
  };
  const closeModal = () => { setModal(null); setProgress(''); };

  const toggleBrand = (id) => {
    setBrandIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllVisible = () => {
    const ids = visibleBrandsForForm
      .filter((b) => !mappedBrandIdsForFormCategory.has(b.id))
      .map((b) => b.id);
    setBrandIds((prev) => Array.from(new Set([...prev, ...ids])));
  };
  const clearSelection = () => setBrandIds([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoryId) return;

    if (modal.type === 'edit') {
      if (!brandId) return;
      setSubmitting(true);
      try {
        await masterApi.put(`/master/category-brand-mappings/${modal.item.id}`, { categoryId, brandId });
        closeModal();
        load();
      } catch (e) {
        notifyError(e.body?.message || e.message || 'Request failed');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Create mode: multi-select. POST one mapping per brand.
    const toCreate = brandIds.filter((id) => !mappedBrandIdsForFormCategory.has(id));
    if (toCreate.length === 0) {
      notifyError('Pick at least one brand that isn\'t already mapped to this category.');
      return;
    }

    setSubmitting(true);
    let done = 0;
    const failed = [];
    try {
      for (const bId of toCreate) {
        setProgress(`Saving ${done + 1} of ${toCreate.length}…`);
        try {
          await masterApi.post('/master/category-brand-mappings', { categoryId, brandId: bId });
        } catch (err) {
          failed.push({ brandId: bId, msg: err.body?.message || err.message });
        }
        done += 1;
      }
      if (failed.length) {
        notifyError(`${failed.length} of ${toCreate.length} failed: ${failed.map((f) => brandName(f.brandId)).join(', ')}`);
      } else {
        closeModal();
      }
      load();
    } finally {
      setSubmitting(false);
      setProgress('');
    }
  };

  const handleDelete = async (row) => {
    const label = `${catName(row.categoryId)} → ${brandName(row.brandId)}`;
    if (!confirm(`Delete mapping "${label}"? Series and models under it may need to be reassigned.`)) return;
    try {
      await masterApi.delete(`/master/category-brand-mappings/${row.id}`);
      load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  const columns = [
    { key: 'categoryId', label: 'Category', render: (r) => catName(r.categoryId) },
    {
      key: 'brand',
      label: 'Brand',
      render: (r) => {
        const b = brandById(r.brandId);
        return (
          <div className="flex items-center gap-2">
            {b?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.imageUrl} alt="" className="h-7 w-7 rounded-md object-contain bg-white p-0.5" />
            ) : (
              <div className="h-7 w-7 rounded-md bg-admin-dark border border-admin-border" />
            )}
            <span>{b?.name || r.brandId}</span>
          </div>
        );
      },
    },
  ];

  const newPairsCount = brandIds.filter((id) => !mappedBrandIdsForFormCategory.has(id)).length;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Category-Brand Mapping</h1>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm sm:w-auto"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={openCreate}
            disabled={!categories.length || !brands.length}
            className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add mappings
          </button>
        </div>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        Pick a category and select <span className="text-slate-600">one or many brands</span> — each
        selected brand creates a (category, brand) row. Series and models always live under a
        category-brand pair.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-admin-muted">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          onEdit={openEdit}
          onDelete={handleDelete}
          emptyMessage="No mappings yet. Pick a category and a few brands to start."
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-admin-card border border-admin-border max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              {modal.type === 'create' ? 'Add mappings' : 'Edit mapping'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-admin-muted mb-1">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  required
                  disabled={modal.type === 'edit'}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {modal.type === 'create' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-admin-muted">Brands (pick one or many)</label>
                    <div className="flex items-center gap-2 text-xs">
                      <button type="button" onClick={selectAllVisible} className="text-admin-accent hover:underline">Select all</button>
                      <span className="text-admin-muted">·</span>
                      <button type="button" onClick={clearSelection} className="text-admin-muted hover:text-slate-800">Clear</button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Search brand…"
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    className="w-full mb-2 rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900 text-sm"
                  />
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-admin-border bg-admin-dark p-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {visibleBrandsForForm.length === 0 ? (
                      <p className="text-xs text-admin-muted col-span-full p-2">No brands match.</p>
                    ) : visibleBrandsForForm.map((b) => {
                      const alreadyMapped = mappedBrandIdsForFormCategory.has(b.id);
                      const checked = brandIds.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer ${alreadyMapped ? 'opacity-50 cursor-not-allowed' : 'hover:bg-admin-card'}`}
                          title={alreadyMapped ? 'Already mapped to this category' : ''}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={alreadyMapped}
                            onChange={() => !alreadyMapped && toggleBrand(b.id)}
                          />
                          {b.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.imageUrl} alt="" className="h-6 w-6 rounded object-contain bg-white p-0.5" />
                          ) : (
                            <div className="h-6 w-6 rounded bg-admin-card border border-admin-border" />
                          )}
                          <span className="text-sm text-slate-800 truncate">{b.name}</span>
                          {alreadyMapped ? <span className="ml-auto text-[10px] text-admin-muted">mapped</span> : null}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-admin-muted">
                    Selected: <span className="text-slate-800">{brandIds.length}</span> · Will create:{' '}
                    <span className="text-slate-800">{newPairsCount}</span> new mapping{newPairsCount === 1 ? '' : 's'}
                    {brandIds.length !== newPairsCount ? ' (skipping already-mapped brands)' : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Brand</label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    required
                  >
                    <option value="">Select brand</option>
                    {brands.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                  </select>
                </div>
              )}

              {progress ? <p className="text-xs text-admin-muted">{progress}</p> : null}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={closeModal} className="rounded-lg px-4 py-2 text-slate-600 hover:bg-admin-dark">Cancel</button>
                <button
                  type="submit"
                  disabled={submitting || (modal.type === 'create' && newPairsCount === 0)}
                  className="rounded-lg bg-admin-accent px-4 py-2 text-white disabled:opacity-50"
                >
                  {submitting
                    ? 'Saving…'
                    : modal.type === 'create'
                      ? `Save ${newPairsCount || ''} mapping${newPairsCount === 1 ? '' : 's'}`.trim()
                      : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
