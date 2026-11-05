'use client';

import { useEffect, useState } from 'react';
import { masterApi } from '@/lib/api';
import { mapPool } from '@/lib/concurrency';
import DataTable from '@/components/DataTable';
import { notifyError } from '@/lib/toast';

// In a later step, you can swap this to a dedicated marketplaceApi exported from lib/api.
const productsApi = {
  get: (path) => masterApi.get(path),
  post: (path, body) => masterApi.post(path, body),
  put: (path, body) => masterApi.put(path, body),
  delete: (path) => masterApi.delete(path),
};

export default function MarketplaceItemsPage() {
  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);       // models of the selected brand (picker)
  const [modelNames, setModelNames] = useState({}); // modelId -> name, for the table
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null); // { type: 'create' | 'edit', item? }
  const [title, setTitle] = useState('');
  const [type, setType] = useState('DEVICE');
  const [brandId, setBrandId] = useState('');
  const [modelId, setModelId] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadBrands = async () => {
    try {
      const data = await masterApi.get('/master/brands');
      setBrands(Array.isArray(data) ? data : data?.content ?? []);
    } catch {
      setBrands([]);
    }
  };

  // Models for the SELECTED brand only. This used to walk every brand on mount
  // to build one big list — ~55 requests and ~54 MB of JSON, enough to exhaust
  // the master-data service's 384 MB heap and take it down. The picker only
  // ever shows one brand's models anyway.
  const loadModelsForBrand = async (id) => {
    if (!id) { setModels([]); return; }
    try {
      const data = await masterApi.get(`/master/brands/${id}/models`);
      setModels(Array.isArray(data) ? data : data?.content ?? []);
    } catch {
      setModels([]);
    }
  };
  useEffect(() => { loadModelsForBrand(brandId); }, [brandId]);

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await productsApi.get('/marketplace/products');
      setItems(Array.isArray(data) ? data : data?.content ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load marketplace items');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
    loadItems();
  }, []);

  // The table shows a model name per row. Resolve just the ids the loaded items
  // actually reference (one small GET each) rather than downloading every
  // brand's model list to do a client-side lookup.
  useEffect(() => {
    const wanted = [...new Set(items.map((i) => i.modelId).filter(Boolean))]
      .filter((id) => !(id in modelNames));
    if (!wanted.length) return;
    let cancelled = false;
    (async () => {
      const found = {};
      await mapPool(wanted, 5, async (id) => {
        const m = await masterApi.get(`/master/models/${id}`).catch(() => null);
        if (m?.name) found[id] = m.name;
      });
      if (!cancelled && Object.keys(found).length) {
        setModelNames((prev) => ({ ...prev, ...found }));
      }
    })();
    return () => { cancelled = true; };
    // modelNames is intentionally not a dep — it is read to skip ids already
    // resolved, and including it would re-run this effect on every resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const openCreate = () => {
    setModal({ type: 'create' });
    setTitle('');
    setType('DEVICE');
    setBrandId(brands[0]?.id ?? '');
    setModelId('');
    setPrice('');
    setStatus('ACTIVE');
    setImageUrl('');
  };

  const openEdit = (item) => {
    setModal({ type: 'edit', item });
    setTitle(item.title || '');
    setType(item.type || 'DEVICE');
    setBrandId(item.brandId || '');
    setModelId(item.modelId || '');
    setPrice(item.price != null ? String(item.price) : '');
    setStatus(item.status || 'ACTIVE');
    setImageUrl(item.imageUrl || '');
  };

  const closeModal = () => setModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !brandId || !modelId) return;
    setSubmitting(true);
    const body = {
      title: title.trim(),
      type,
      brandId,
      modelId,
      price: Number(price) || 0,
      status,
      imageUrl: imageUrl.trim() || null,
    };
    try {
      if (modal.type === 'create') {
        await productsApi.post('/marketplace/products', body);
      } else {
        await productsApi.put(`/marketplace/products/${modal.item.id}`, body);
      }
      closeModal();
      loadItems();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm('Delete this marketplace item?')) return;
    try {
      await productsApi.delete(`/marketplace/products/${row.id}`);
      loadItems();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  const getBrandName = (id) =>
    brands.find((b) => (b.id ?? b.brandId) === id)?.name ?? id ?? '—';
  const getModelName = (id) =>
    modelNames[id] ?? models.find((m) => (m.id ?? m.modelId) === id)?.name ?? id ?? '—';

  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type', render: (r) => r.type || 'DEVICE' },
    {
      key: 'brand',
      label: 'Brand',
      render: (r) => getBrandName(r.brandId),
    },
    {
      key: 'model',
      label: 'Model',
      render: (r) => getModelName(r.modelId),
    },
    {
      key: 'price',
      label: 'Price',
      render: (r) =>
        r.price != null ? `₹${Number(r.price).toLocaleString('en-IN')}` : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => r.status || 'ACTIVE',
    },
    {
      key: 'imageUrl',
      label: 'Image URL',
      render: (r) => r.imageUrl || '—',
    },
  ];

  // `models` already holds only the selected brand's models.
  const filteredModels = models;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Marketplace Items</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add item
        </button>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        Manage products shown in the shop owner “Buy / Sell” flows. These map to marketplace
        products (GET /marketplace/products).
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-admin-muted text-sm">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          keyExtractor={(r) => r.id ?? JSON.stringify(r)}
          onEdit={openEdit}
          onDelete={handleDelete}
          emptyMessage="No marketplace items. Add one to show in the Buy/Sell screens."
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-admin-card border border-admin-border max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              {modal.type === 'create' ? 'New marketplace item' : 'Edit marketplace item'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-admin-muted mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                >
                  <option value="DEVICE">DEVICE</option>
                  <option value="SPARE_PART">SPARE_PART</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Brand</label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  required
                >
                  <option value="">Select brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Model</label>
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  required
                >
                  <option value="">Select model</option>
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Image URL</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  placeholder="https://…/product.png"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-slate-600 hover:bg-admin-dark"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-admin-accent px-4 py-2 text-white disabled:opacity-50"
                >
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
