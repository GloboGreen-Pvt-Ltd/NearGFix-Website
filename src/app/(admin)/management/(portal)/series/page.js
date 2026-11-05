'use client';

import { useEffect, useMemo, useState } from 'react';
import { masterApi } from '@/lib/api';
import DataTable from '@/components/DataTable';
import { notifyError } from '@/lib/toast';

// Split a bulk paste into clean, de-duplicated series names. Accepts one name
// per line, comma-separated, or a mix; trims blanks.
const parseSeriesNames = (raw) =>
  Array.from(new Set(
    String(raw || '')
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  ));

export default function MasterSeriesPage() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formBrandId, setFormBrandId] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- Initial load
  const loadRefData = async () => {
    try {
      const [cats, brs, maps] = await Promise.all([
        masterApi.get('/master/device-categories').catch(() => []),
        masterApi.get('/master/brands').catch(() => []),
        masterApi.get('/master/category-brand-mappings').catch(() => []),
      ]);
      setCategories(Array.isArray(cats) ? cats : cats?.content ?? []);
      setBrands(Array.isArray(brs) ? brs : brs?.content ?? []);
      setMappings(Array.isArray(maps) ? maps : maps?.content ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load reference data');
    }
  };
  useEffect(() => { loadRefData(); }, []);

  // Brands available under selected category (via mapping table)
  const brandsForCategory = useMemo(() => {
    if (!filterCategory) return brands;
    const allowed = new Set(mappings.filter((m) => m.categoryId === filterCategory).map((m) => m.brandId));
    return brands.filter((b) => allowed.has(b.id));
  }, [filterCategory, brands, mappings]);

  // Reset brand filter if it's no longer valid for the chosen category
  useEffect(() => {
    if (filterBrand && !brandsForCategory.some((b) => b.id === filterBrand)) {
      setFilterBrand('');
    }
  }, [filterBrand, brandsForCategory]);

  // Resolve mapping id from (category, brand) pair
  const resolveMappingId = (categoryId, brandId) =>
    mappings.find((m) => m.categoryId === categoryId && m.brandId === brandId)?.id || null;

  // --- Load series list (driven by filters)
  const loadSeries = async () => {
    setLoading(true);
    setError('');
    try {
      let mappingIds = [];
      if (filterCategory && filterBrand) {
        const id = resolveMappingId(filterCategory, filterBrand);
        if (id) mappingIds = [id];
      } else if (filterCategory) {
        mappingIds = mappings.filter((m) => m.categoryId === filterCategory).map((m) => m.id);
      } else if (filterBrand) {
        mappingIds = mappings.filter((m) => m.brandId === filterBrand).map((m) => m.id);
      } else {
        mappingIds = mappings.map((m) => m.id);
      }

      const all = [];
      for (const mid of mappingIds) {
        const rows = await masterApi.get(`/master/category-brand-mappings/${mid}/series`).catch(() => []);
        const arr = Array.isArray(rows) ? rows : [];
        all.push(...arr);
      }

      // Legacy fallback: when a brand has series with no mapping yet, also query the legacy endpoint
      if (filterBrand) {
        const legacy = await masterApi.get(`/master/brands/${filterBrand}/series`).catch(() => []);
        const arr = Array.isArray(legacy) ? legacy : [];
        for (const s of arr) {
          if (!all.some((x) => x.id === s.id)) all.push(s);
        }
      }

      setList(all);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (mappings.length || filterBrand) loadSeries(); else setList([]); }, [filterCategory, filterBrand, mappings]);

  // --- Modal handlers
  const openCreate = () => {
    setModal({ type: 'create' });
    setFormCategoryId(filterCategory || categories[0]?.id || '');
    setFormBrandId(filterBrand || '');
    setName('');
  };

  const openEdit = (item) => {
    setModal({ type: 'edit', item });
    // Best-effort reverse lookup from mapping
    const map = mappings.find((m) => m.id === item.categoryBrandId);
    setFormCategoryId(map?.categoryId || filterCategory || '');
    setFormBrandId(map?.brandId || item.brandId || '');
    setName(item.name || '');
  };
  const closeModal = () => setModal(null);

  const formBrandOptions = useMemo(() => {
    if (!formCategoryId) return brands;
    const allowed = new Set(mappings.filter((m) => m.categoryId === formCategoryId).map((m) => m.brandId));
    return brands.filter((b) => allowed.has(b.id));
  }, [formCategoryId, brands, mappings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formCategoryId || !formBrandId) return;
    const mappingId = resolveMappingId(formCategoryId, formBrandId);
    if (!mappingId) {
      notifyError('No Category-Brand mapping for this pair. Create it in the Category-Brand Mapping page first.');
      return;
    }
    setSubmitting(true);
    try {
      if (modal.type === 'create') {
        // Bulk create: one series per line / comma-separated name.
        const names = parseSeriesNames(name);
        if (!names.length) {
          notifyError('Enter at least one series name.');
          setSubmitting(false);
          return;
        }
        let ok = 0;
        const failed = [];
        for (const n of names) {
          try {
            await masterApi.post('/master/series', {
              categoryBrandId: mappingId,
              brandId: formBrandId, // kept for backward compat
              name: n,
            });
            ok += 1;
          } catch (_) {
            failed.push(n); // usually a duplicate name under this pair
          }
        }
        loadSeries();
        if (failed.length) {
          // Keep the modal open with only the failed names so they can be fixed/retried.
          setName(failed.join('\n'));
          notifyError(`Added ${ok} of ${names.length}. These were skipped (already exist or invalid): ${failed.join(', ')}`);
          setSubmitting(false);
          return;
        }
        closeModal();
      } else {
        if (!name.trim()) { setSubmitting(false); return; }
        await masterApi.put(`/master/series/${modal.item.id}`, {
          categoryBrandId: mappingId,
          brandId: formBrandId,
          name: name.trim(),
        });
        closeModal();
        loadSeries();
      }
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm('Delete this series? Models under it may need to be removed first.')) return;
    try {
      await masterApi.delete(`/master/series/${row.id}`);
      loadSeries();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  const labelForMapping = (mid) => {
    const m = mappings.find((x) => x.id === mid);
    if (!m) return '—';
    const c = categories.find((x) => x.id === m.categoryId)?.name || '?';
    const b = brands.find((x) => x.id === m.brandId)?.name || '?';
    return `${c} + ${b}`;
  };

  const columns = [
    {
      key: 'categoryBrand',
      label: 'Category + Brand',
      render: (r) => r.categoryBrandId
        ? labelForMapping(r.categoryBrandId)
        : (brands.find((b) => b.id === r.brandId)?.name || '—'),
    },
    { key: 'name', label: 'Series name' },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Series</h1>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm sm:w-auto"
          >
            <option value="">All categories</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="w-full rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm sm:w-auto"
          >
            <option value="">All brands{filterCategory ? ' in category' : ''}</option>
            {brandsForCategory.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
          <button
            type="button"
            onClick={openCreate}
            disabled={!categories.length || !brands.length}
            className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add series
          </button>
        </div>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        Series live under a (category, brand) pair — e.g. <span className="text-slate-600">Mobile + Vivo → Y Series</span>.
        Create the pair first in <span className="text-slate-600">Category-Brand Mapping</span> if it&apos;s missing.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-admin-muted">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={list}
          onEdit={openEdit}
          onDelete={handleDelete}
          emptyMessage="No series. Pick a category-brand pair and add one."
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-admin-card border border-admin-border max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              {modal.type === 'create' ? 'New series' : 'Edit series'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Category</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => { setFormCategoryId(e.target.value); setFormBrandId(''); }}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Brand</label>
                  <select
                    value={formBrandId}
                    onChange={(e) => setFormBrandId(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    required
                    disabled={!formCategoryId}
                  >
                    <option value="">Select brand</option>
                    {formBrandOptions.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                  </select>
                </div>
              </div>
              {formCategoryId && formBrandId && !resolveMappingId(formCategoryId, formBrandId) && (
                <p className="text-xs text-amber-400">
                  No Category-Brand mapping exists for this pair. Create it first in the
                  Category-Brand Mapping page.
                </p>
              )}
              {modal.type === 'create' ? (
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Series names</label>
                  <textarea
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    rows={7}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900 resize-y"
                    placeholder={'Add multiple at once — one per line or comma-separated, e.g.\nGalaxy A Series\nGalaxy J Series\nGalaxy Note Series'}
                    required
                  />
                  <p className="text-xs text-admin-muted mt-1">
                    One per line, or comma-separated.
                    {parseSeriesNames(name).length > 0 ? ` ${parseSeriesNames(name).length} series ready to add.` : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Series name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    placeholder="e.g. Vivo Y Series"
                    required
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={closeModal} className="rounded-lg px-4 py-2 text-slate-600 hover:bg-admin-dark">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-admin-accent px-4 py-2 text-white disabled:opacity-50">
                  {submitting
                    ? 'Saving…'
                    : modal.type === 'create'
                      ? `Save${parseSeriesNames(name).length ? ` ${parseSeriesNames(name).length}` : ''}`
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
