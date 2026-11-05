'use client';

import { useCallback, useEffect, useState } from 'react';
import { masterApi } from '@/lib/api';
import DataTable from '@/components/DataTable';
import SellFlowBulkActions from '@/components/SellFlowBulkActions';
import SellFlowImportModal from '@/components/SellFlowImportModal';
import { notifyError } from '@/lib/toast';

// Split a typed/pasted value into individual values on commas or new lines.
const splitNames = (s) => (s || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const mergeUnique = (prev, parts) => {
  const next = [...prev];
  for (const p of parts) if (!next.some((n) => n.toLowerCase() === p.toLowerCase())) next.push(p);
  return next;
};

export default function MasterDeviceConfigurationPage() {
  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const [modal, setModal] = useState(null);
  const [deviceCategoryId, setDeviceCategoryId] = useState('');
  const [name, setName] = useState('');
  const [optInput, setOptInput] = useState('');
  const [optNames, setOptNames] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    const [fieldsResult, categoriesResult] = await Promise.allSettled([
      masterApi.get('/master/config-fields'),
      masterApi.get('/master/device-categories'),
    ]);

    let loadError = null;
    if (fieldsResult.status === 'fulfilled') {
      const data = fieldsResult.value;
      setList(Array.isArray(data) ? data : data?.content ?? []);
    } else {
      loadError = fieldsResult.reason;
      setList([]);
    }

    if (categoriesResult.status === 'fulfilled') {
      const data = categoriesResult.value;
      setCategories(Array.isArray(data) ? data : data?.content ?? []);
    } else {
      loadError ||= categoriesResult.reason;
      setCategories([]);
    }

    if (loadError) setError(loadError?.message || 'Failed to load');
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const catName = (id) => categories.find((c) => c.id === id)?.name || 'All categories';
  const filtered = filterCategory ? list.filter((r) => r.deviceCategoryId === filterCategory) : list;

  const openCreate = () => {
    setModal({ type: 'create' });
    setDeviceCategoryId(filterCategory || '');
    setName('');
    setOptInput('');
    setOptNames([]);
  };
  const openEdit = (item) => {
    setModal({ type: 'edit', item });
    setDeviceCategoryId(item.deviceCategoryId || '');
    setName(item.name || '');
    setOptInput('');
    setOptNames((item.options || []).map((o) => o.value));
  };
  const closeModal = () => setModal(null);

  const addOpt = () => {
    const parts = splitNames(optInput);
    if (!parts.length) return;
    setOptNames((prev) => mergeUnique(prev, parts));
    setOptInput('');
  };
  const removeOpt = (n) => setOptNames((prev) => prev.filter((x) => x !== n));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deviceCategoryId) { notifyError('Select a device category.'); return; }
    if (!name.trim()) return;
    const options = [...new Set([...optNames, ...splitNames(optInput)].map((x) => x.trim()).filter(Boolean))];
    setSubmitting(true);
    try {
      const body = { deviceCategoryId: deviceCategoryId || null, name: name.trim(), options };
      if (modal.type === 'create') {
        await masterApi.post('/master/config-fields', body);
      } else {
        await masterApi.put(`/master/config-fields/${modal.item.id}`, body);
      }
      closeModal();
      reload();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete config field "${row.name}" and its options?`)) return;
    try {
      await masterApi.delete(`/master/config-fields/${row.id}`);
      reload();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  const columns = [
    { key: 'deviceCategoryId', label: 'Device category', render: (r) => catName(r.deviceCategoryId) },
    { key: 'name', label: 'Field (key)' },
    {
      key: 'options',
      label: 'Options (values)',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {(r.options || []).map((o) => (
            <span key={o.id} className="rounded-full bg-admin-dark border border-admin-border px-2 py-0.5 text-xs text-slate-800">{o.value}</span>
          ))}
          {(!r.options || r.options.length === 0) ? <span className="text-admin-muted text-xs">—</span> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Device Configuration</h1>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm sm:w-auto"
          >
            <option value="">All categories</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <SellFlowBulkActions
            kind="deviceConfiguration"
            categories={categories}
            rows={filtered}
            filterCategory={filterCategory}
            onRefresh={reload}
            onImport={() => setImportOpen(true)}
          />
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add field
          </button>
        </div>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        Configuration fields per device — e.g. <span className="text-slate-600">Laptop → Device Processor: Intel, AMD, Apple Silicon</span>.
        Left is the field key, right are its dropdown options.
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
          emptyMessage="No configuration fields. Pick a category and add one."
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-admin-card border border-admin-border max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              {modal.type === 'create' ? 'Add configuration field' : 'Edit configuration field'}
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
              <div>
                <label className="block text-sm text-admin-muted mb-1">Field key</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  placeholder="e.g. Device Processor"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Options (values)</label>
                <input
                  type="text"
                  value={optInput}
                  onChange={(e) => setOptInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOpt(); } }}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  placeholder="Intel, AMD, Apple Silicon, Qualcomm, Other — comma-separated, press Enter"
                />
                {optNames.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {optNames.map((n) => (
                      <span key={n} className="inline-flex items-center gap-1 rounded-full bg-admin-accent/20 text-admin-accent px-3 py-1 text-xs">
                        {n}
                        <button type="button" onClick={() => removeOpt(n)} className="text-admin-accent/80 hover:text-white">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-admin-muted mt-2">
                  Type the values comma-separated (they split into separate options).
                </p>
              </div>
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
      {importOpen && (
        <SellFlowImportModal
          kind="deviceConfiguration"
          categories={categories}
          onClose={() => setImportOpen(false)}
          onImported={reload}
        />
      )}
    </div>
  );
}
