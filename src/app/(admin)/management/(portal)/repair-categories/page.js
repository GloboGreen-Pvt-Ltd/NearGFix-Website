'use client';

import { useEffect, useMemo, useState } from 'react';
import { masterApi } from '@/lib/api';
import DataTable from '@/components/DataTable';
import { notifyError } from '@/lib/toast';

// Split a typed/pasted value into individual names on commas or new lines.
const splitNames = (s) => (s || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const mergeUnique = (prev, parts) => {
  const next = [...prev];
  for (const p of parts) if (!next.some((n) => n.toLowerCase() === p.toLowerCase())) next.push(p);
  return next;
};

export default function MasterRepairCategoriesPage() {
  const [categories, setCategories] = useState([]); // device categories
  const [filterCategory, setFilterCategory] = useState('');

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null);
  const [deviceCategoryId, setDeviceCategoryId] = useState('');
  const [name, setName] = useState('');             // edit mode (single)
  const [catInput, setCatInput] = useState('');     // create mode typing buffer
  const [catNames, setCatNames] = useState([]);     // create mode bulk list
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadCategories = async () => {
    try {
      const cats = await masterApi.get('/master/device-categories').catch(() => []);
      setCategories(Array.isArray(cats) ? cats : cats?.content ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load categories');
    }
  };
  useEffect(() => { loadCategories(); }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const q = filterCategory ? `?deviceCategoryId=${filterCategory}` : '';
      const data = await masterApi.get(`/master/repair-categories${q}`);
      setList(Array.isArray(data) ? data : data?.content ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setList([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [filterCategory]);

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || '—';

  const openCreate = () => {
    setModal({ type: 'create' });
    setDeviceCategoryId(filterCategory || categories[0]?.id || '');
    setName('');
    setCatInput('');
    setCatNames([]);
    setIsActive(true);
  };
  const openEdit = (item) => {
    setModal({ type: 'edit', item });
    setDeviceCategoryId(item.deviceCategoryId || '');
    setName(item.name || '');
    setIsActive(item.isActive ?? true);
  };
  const closeModal = () => setModal(null);

  const addCat = () => {
    const parts = splitNames(catInput);
    if (!parts.length) return;
    setCatNames((prev) => mergeUnique(prev, parts));
    setCatInput('');
  };
  const removeCat = (n) => setCatNames((prev) => prev.filter((x) => x !== n));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deviceCategoryId) return;
    setSubmitting(true);
    try {
      if (modal.type === 'create') {
        const names = [...catNames, ...splitNames(catInput)];
        const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
        if (!uniq.length) { setSubmitting(false); return; }
        // Store one-by-one via the single-create endpoint.
        for (const nm of uniq) {
          await masterApi.post('/master/repair-categories', { deviceCategoryId, name: nm, isActive: true });
        }
      } else {
        if (!name.trim()) { setSubmitting(false); return; }
        await masterApi.put(`/master/repair-categories/${modal.item.id}`, {
          deviceCategoryId, name: name.trim(), isActive,
        });
      }
      closeModal();
      load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm('Delete this main category? Its issues will be unlinked.')) return;
    try {
      await masterApi.delete(`/master/repair-categories/${row.id}`);
      load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  const columns = useMemo(() => [
    { key: 'deviceCategoryId', label: 'Category', render: (r) => categoryName(r.deviceCategoryId) },
    { key: 'name', label: 'Main Category' },
    { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
  ], [categories]);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Repair Categories</h1>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm sm:w-auto"
          >
            <option value="">All categories</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <button
            type="button"
            onClick={openCreate}
            disabled={!categories.length}
            className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add main category
          </button>
        </div>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        Main repair categories per device category — e.g. <span className="text-slate-600">Mobile → Display &amp; Touch</span>.
        Issues (Repair Services) live under these.
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
          emptyMessage="No main categories. Pick a device category and add one."
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-admin-card border border-admin-border max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              {modal.type === 'create' ? 'Add main categories' : 'Edit main category'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-admin-muted mb-1">Device category</label>
                <select
                  value={deviceCategoryId}
                  onChange={(e) => setDeviceCategoryId(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              {modal.type === 'create' ? (
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Main categories</label>
                  <input
                    type="text"
                    value={catInput}
                    onChange={(e) => setCatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } }}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    placeholder="Display & Touch, Battery & Charging — comma-separated, press Enter"
                  />
                  {catNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {catNames.map((n) => (
                        <span key={n} className="inline-flex items-center gap-1 rounded-full bg-admin-accent/20 text-admin-accent px-3 py-1 text-xs">
                          {n}
                          <button type="button" onClick={() => removeCat(n)} className="text-admin-accent/80 hover:text-white">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-admin-muted mt-2">
                    Add several main categories, then Save — all are created under the selected device category.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Main category</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    placeholder="e.g. Display & Touch"
                    required
                  />
                </div>
              )}
              {modal.type === 'edit' ? (
                <label className="flex items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                  Active
                </label>
              ) : null}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={closeModal} className="rounded-lg px-4 py-2 text-slate-600 hover:bg-admin-dark">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-admin-accent px-4 py-2 text-white disabled:opacity-50">
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
