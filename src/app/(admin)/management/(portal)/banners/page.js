'use client';

import { useEffect, useState } from 'react';
import { masterApi } from '@/lib/api';
import DataTable from '@/components/DataTable';
import S3ImageUpload from '@/components/S3ImageUpload';
import { imageReplacementNotice, uploadBannerImage } from '@/lib/modelMedia';
import { notifyError, notifySuccess } from '@/lib/toast';

export default function DirectoryBannersPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  // Held until the row has an id: the S3 key is built from the banner's stored title.
  const [imageFile, setImageFile] = useState(null);
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await masterApi.get('/master/banners');
      setList(Array.isArray(data) ? data : data?.content ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setModal({ type: 'create' });
    setTitle('');
    setImageUrl('');
    setImageFile(null);
    setSortOrder('0');
    setIsActive(true);
  };
  const openEdit = (item) => {
    setModal({ type: 'edit', item });
    setTitle(item.title || '');
    setImageUrl(item.imageUrl || '');
    setSortOrder(String(item.sortOrder ?? 0));
    setIsActive(item.isActive ?? true);
    // A file left staged from a previous modal would otherwise be uploaded onto THIS
    // banner on save — and now also delete that banner's current image.
    setImageFile(null);
  };
  const closeModal = () => setModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        title: title.trim(),
        imageUrl: imageUrl.trim() || null,
        sortOrder: parseInt(sortOrder, 10) || 0,
        isActive,
      };
      // Save first, then upload: the endpoint is id-scoped because the object key
      // is derived from the banner's stored title.
      let bannerId = modal.type === 'create' ? null : modal.item.id;
      if (modal.type === 'create') {
        const created = await masterApi.post('/master/banners', body);
        bannerId = created?.id || null;
      } else {
        await masterApi.put(`/master/banners/${modal.item.id}`, body);
      }
      if (imageFile && bannerId) {
        const uploaded = await uploadBannerImage(bannerId, imageFile);
        const notice = imageReplacementNotice(uploaded, 'Banner image');
        if (notice) notifySuccess(notice);
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
    if (!confirm('Delete this banner?')) return;
    try {
      await masterApi.delete(`/master/banners/${row.id}`);
      load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  const columns = [
    {
      key: 'imageUrl',
      label: 'Image',
      render: (r) =>
        r.imageUrl ? (
          <img src={r.imageUrl} alt="" className="h-10 w-16 rounded object-cover" />
        ) : (
          '—'
        ),
    },
    { key: 'title', label: 'Title' },
    { key: 'sortOrder', label: 'Sort', render: (r) => r.sortOrder ?? 0 },
    { key: 'isActive', label: 'Active', render: (r) => (r.isActive ? 'Yes' : 'No') },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Banners</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add banner
        </button>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        Promotional banners shown in the mobile app (GET /api/master/banners).
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
          emptyMessage="No banners."
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-admin-card border border-admin-border max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              {modal.type === 'create' ? 'New banner' : 'Edit banner'}
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
              {/* aspect="wide" matches the shape the mobile carousel renders.
                  allowBase64Fallback={false}: master_banners.image_url is a
                  hosted-URL column and every banner ships to the app on each
                  list fetch, so a silent data-URI fallback is worse than a
                  visible upload error. */}
              <S3ImageUpload
                value={imageUrl}
                onFileChange={setImageFile}
                label="Banner image"
                caption="Shown in the customer app home slider"
              />
              <div>
                <label className="block text-sm text-admin-muted mb-1">Sort order</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active
              </label>
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
