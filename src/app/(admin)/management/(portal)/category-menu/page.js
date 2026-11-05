'use client';

import { useEffect, useMemo, useState } from 'react';
import { Wrench, Tag, ShoppingCart } from 'lucide-react';
import { masterApi } from '@/lib/api';
import DataTable from '@/components/DataTable';
import S3ImageUpload from '@/components/S3ImageUpload';
import { imageReplacementNotice, uploadCategoryMenuImage } from '@/lib/modelMedia';
import { notifyError, notifySuccess } from '@/lib/toast';

/**
 * The three customer-app/website category menus. Single source for this list —
 * the create/edit <select>, the type filter above the table, and the coloured
 * badge in the "Category Type" column all derive from this one array, so a
 * fourth menu type (if one is ever added) is one line here rather than three
 * places kept in sync by hand.
 *
 * Icon + tone pairs mirror the ones already associated with Repair/Sell/Buy
 * elsewhere on the public site (see src/lib/siteContent.js CUSTOMER_SERVICES
 * and the icon registry in src/components/site/ui.js) — kept for visual
 * consistency rather than invented fresh here.
 */
const CATEGORY_MENU_TYPES = [
  { value: 'REPAIR', label: 'Repair', icon: Wrench, tone: 'bg-blue-100 text-blue-700' },
  { value: 'SELL', label: 'Sell', icon: Tag, tone: 'bg-orange-100 text-orange-700' },
  { value: 'BUY', label: 'Buy', icon: ShoppingCart, tone: 'bg-brand-100 text-brand-700' },
];

const typeMeta = (value) => CATEGORY_MENU_TYPES.find((t) => t.value === value) || null;

function CategoryTypeBadge({ type }) {
  const meta = typeMeta(type);
  if (!meta) return <span className="text-admin-muted">{type || '—'}</span>;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.tone}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export default function CategoryMenuPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Above-the-table filters. Type is sent to the backend (it already supports
  // the query param, so there is no reason to fetch everything and filter
  // client-side); status is filtered client-side against whatever type filter
  // already narrowed the fetch to.
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modal, setModal] = useState(null);
  const [categoryType, setCategoryType] = useState(CATEGORY_MENU_TYPES[0].value);
  const [menuName, setMenuName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  // Held until the row has an id: the image endpoint is id-scoped.
  const [imageFile, setImageFile] = useState(null);
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const qs = typeFilter ? `?categoryType=${encodeURIComponent(typeFilter)}` : '';
      const data = await masterApi.get(`/master/category-menu${qs}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const visibleList = useMemo(() => {
    if (!statusFilter) return list;
    const wantActive = statusFilter === 'active';
    return list.filter((r) => (r.isActive !== false) === wantActive);
  }, [list, statusFilter]);

  const openCreate = () => {
    setModal({ type: 'create' });
    setCategoryType(typeFilter || CATEGORY_MENU_TYPES[0].value);
    setMenuName('');
    setSlug('');
    setDescription('');
    setImageUrl('');
    setImageFile(null);
    setSortOrder('0');
    setIsActive(true);
  };
  const openEdit = (item) => {
    setModal({ type: 'edit', item });
    setCategoryType(item.categoryType || CATEGORY_MENU_TYPES[0].value);
    setMenuName(item.menuName || '');
    setSlug(item.slug || '');
    setDescription(item.description || '');
    setImageUrl(item.imageUrl || '');
    setSortOrder(String(item.sortOrder ?? 0));
    setIsActive(item.isActive !== false);
    // A file left staged from a previous modal would otherwise upload onto
    // THIS row on save, and now also delete this row's current image.
    setImageFile(null);
  };
  const closeModal = () => setModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!menuName.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        categoryType,
        menuName: menuName.trim(),
        slug: slug.trim() || null,
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        sortOrder: parseInt(sortOrder, 10) || 0,
        isActive,
      };
      // Save first, then upload: the image endpoint is id-scoped, so a
      // brand-new row must be saved and have an id before its image can be
      // uploaded — same ordering as Banners.
      let rowId = modal.type === 'create' ? null : modal.item.id;
      if (modal.type === 'create') {
        const created = await masterApi.post('/master/category-menu', body);
        rowId = created?.id || null;
      } else {
        await masterApi.put(`/master/category-menu/${modal.item.id}`, body);
      }
      if (imageFile && rowId) {
        const uploaded = await uploadCategoryMenuImage(rowId, imageFile);
        const notice = imageReplacementNotice(uploaded, 'Menu image');
        if (notice) notifySuccess(notice);
      }
      closeModal();
      load();
    } catch (e2) {
      notifyError(e2.body?.message || e2.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (row) => {
    try {
      await masterApi.patch(`/master/category-menu/${row.id}/status`, {
        isActive: row.isActive === false,
      });
      load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Could not change status');
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete "${row.menuName}"?`)) return;
    try {
      await masterApi.delete(`/master/category-menu/${row.id}`);
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.imageUrl} alt="" className="h-10 w-16 rounded object-cover" />
        ) : (
          '—'
        ),
    },
    { key: 'menuName', label: 'Menu Name' },
    {
      key: 'categoryType',
      label: 'Category Type',
      render: (r) => <CategoryTypeBadge type={r.categoryType} />,
    },
    { key: 'sortOrder', label: 'Sort', render: (r) => r.sortOrder ?? 0 },
    {
      key: 'isActive',
      label: 'Status',
      render: (r) => (r.isActive !== false ? 'Active' : 'Inactive'),
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'),
    },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Category Menu Management</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Category Menu
        </button>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        Tile name and image shown for the Repair / Sell / Buy category menus on the customer app
        and website (GET /master/category-menu).
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm sm:w-auto"
        >
          <option value="">All types</option>
          {CATEGORY_MENU_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm sm:w-auto"
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-admin-muted">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={visibleList}
          onEdit={openEdit}
          onToggle={handleToggle}
          onDelete={handleDelete}
          emptyMessage="No category menus yet."
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-admin-card border border-admin-border max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              {modal.type === 'create' ? 'New category menu' : 'Edit category menu'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-admin-muted mb-1">Category type</label>
                <select
                  value={categoryType}
                  onChange={(e) => setCategoryType(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  required
                >
                  {CATEGORY_MENU_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Menu name</label>
                <input
                  type="text"
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                />
              </div>
              <S3ImageUpload
                value={imageUrl}
                onFileChange={setImageFile}
                label="Menu image"
                caption="Shown as the tile image for this menu on the customer app and website"
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
