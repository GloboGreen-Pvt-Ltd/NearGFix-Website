'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { masterApi } from '@/lib/api';
import DataTable from '@/components/DataTable';
import RepairServicesImportModal from '@/components/RepairServicesImportModal';
import {
  exportRepairServicesTemplateWorkbook,
  exportRepairServicesWorkbook,
} from '@/lib/repairServicesExcel';
import { notifyError } from '@/lib/toast';

// Split a typed/pasted value into individual names on commas or new lines.
const splitNames = (s) => (s || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const mergeUnique = (prev, parts) => {
  const next = [...prev];
  for (const p of parts) if (!next.some((n) => n.toLowerCase() === p.toLowerCase())) next.push(p);
  return next;
};
const slugify = (value) => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

export default function MasterRepairServicesPage() {
  const [categories, setCategories] = useState([]);   // device categories
  const [mainCats, setMainCats] = useState([]);       // repair (main) categories — all
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMain, setFilterMain] = useState('');

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const exportMenuRef = useRef(null);
  const [deviceCategoryId, setDeviceCategoryId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');            // edit mode (single issue)
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [issueInput, setIssueInput] = useState(''); // create mode typing buffer
  const [issueNames, setIssueNames] = useState([]); // create mode bulk list
  const [submitting, setSubmitting] = useState(false);

  const loadRefData = async () => {
    try {
      const [cats, mains] = await Promise.all([
        masterApi.get('/master/device-categories').catch(() => []),
        masterApi.get('/master/repair-categories').catch(() => []),
      ]);
      setCategories(Array.isArray(cats) ? cats : cats?.content ?? []);
      setMainCats(Array.isArray(mains) ? mains : mains?.content ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load reference data');
    }
  };
  useEffect(() => { loadRefData(); }, []);

  // Main categories available under the selected device category.
  const mainCatsForFilter = useMemo(() => (
    filterCategory ? mainCats.filter((m) => m.deviceCategoryId === filterCategory) : mainCats
  ), [filterCategory, mainCats]);
  const mainCatsForForm = useMemo(() => (
    deviceCategoryId ? mainCats.filter((m) => m.deviceCategoryId === deviceCategoryId) : []
  ), [deviceCategoryId, mainCats]);

  useEffect(() => {
    if (filterMain && !mainCatsForFilter.some((m) => m.id === filterMain)) setFilterMain('');
  }, [filterMain, mainCatsForFilter]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set('deviceCategoryId', filterCategory);
      if (filterMain) params.set('categoryId', filterMain);
      const qs = params.toString();
      const data = await masterApi.get(`/master/repair-services${qs ? `?${qs}` : ''}`);
      setList(Array.isArray(data) ? data : data?.content ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setList([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [filterCategory, filterMain]);

  const deviceName = (id) => categories.find((c) => c.id === id)?.name || '—';
  const mainName = (id) => mainCats.find((m) => m.id === id)?.name || '—';

  const openCreate = () => {
    setModal({ type: 'create' });
    setDeviceCategoryId(filterCategory || categories[0]?.id || '');
    setCategoryId(filterMain || '');
    setName('');
    setDescription('');
    setIconUrl('');
    setIssueInput('');
    setIssueNames([]);
  };
  const openEdit = (item) => {
    setModal({ type: 'edit', item });
    setDeviceCategoryId(item.deviceCategoryId || '');
    setCategoryId(item.categoryId || '');
    setName(item.name || '');
    setDescription(item.description || '');
    setIconUrl(item.iconUrl || '');
  };
  const closeModal = () => setModal(null);

  // Add the typed issue(s) to the bulk list — splits on commas/new lines.
  const addIssue = () => {
    const parts = splitNames(issueInput);
    if (!parts.length) return;
    setIssueNames((prev) => mergeUnique(prev, parts));
    setIssueInput('');
  };
  const removeIssue = (n) => setIssueNames((prev) => prev.filter((x) => x !== n));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deviceCategoryId || !categoryId) return;
    setSubmitting(true);
    try {
      if (modal.type === 'create') {
        const names = [...issueNames, ...splitNames(issueInput)];
        const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
        if (!uniq.length) { setSubmitting(false); return; }
        // Store one-by-one via the single-create endpoint.
        for (const nm of uniq) {
          await masterApi.post('/master/repair-services', { deviceCategoryId, categoryId, name: nm });
        }
      } else {
        if (!name.trim()) { setSubmitting(false); return; }
        await masterApi.put(`/master/repair-services/${modal.item.id}`, {
          name: name.trim(),
          description: description.trim() || null,
          iconUrl: iconUrl.trim(),
          deviceCategoryId,
          categoryId,
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
    if (!confirm('Delete this issue?')) return;
    try {
      await masterApi.delete(`/master/repair-services/${row.id}`);
      load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  const exportFilename = () => {
    const parts = ['ggfix-repair-services'];
    const category = categories.find((item) => item.id === filterCategory)?.name;
    const mainCategory = mainCats.find((item) => item.id === filterMain)?.name;
    if (category) parts.push(slugify(category));
    if (mainCategory) parts.push(slugify(mainCategory));
    parts.push(new Date().toISOString().slice(0, 10));
    return parts.join('-');
  };

  useEffect(() => {
    if (!exportMenu) return undefined;
    const onMouseDown = (event) => {
      if (!exportMenuRef.current?.contains(event.target)) setExportMenu(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setExportMenu(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [exportMenu]);

  const runExport = async (build) => {
    setExportMenu(false);
    setExporting(true);
    try {
      await build();
    } catch (exportError) {
      notifyError(exportError.message || 'Could not build the Excel file.');
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => list.length && runExport(() => exportRepairServicesWorkbook(
    list,
    { deviceCategory: deviceName, mainCategory: mainName },
    exportFilename(),
  ));

  const handleExportEmpty = () => runExport(() => {
    const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
    return exportRepairServicesTemplateWorkbook({
      categories: categories.map((category) => category.name),
      mainCategories: mainCats.map((category) => ({
        name: category.name,
        category: categoryNameById.get(category.deviceCategoryId) || '',
      })),
    });
  });

  const columns = useMemo(() => [
    { key: 'deviceCategoryId', label: 'Category', render: (r) => deviceName(r.deviceCategoryId) },
    { key: 'categoryId', label: 'Main Category', render: (r) => mainName(r.categoryId) },
    { key: 'name', label: 'Issue' },
    { key: 'description', label: 'Description', render: (r) => r.description || '—' },
  ], [categories, mainCats]);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Repair Services</h1>
        <div className="relative flex flex-wrap items-center gap-3">
          <select
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setFilterMain(''); }}
            className="w-full sm:w-auto rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <select
            value={filterMain}
            onChange={(e) => setFilterMain(e.target.value)}
            className="w-full sm:w-auto rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm"
          >
            <option value="">All main categories</option>
            {mainCatsForFilter.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
          <button
            type="button"
            onClick={() => { loadRefData(); load(); }}
            title="Reload Repair Services"
            className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <div className="xl:relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportMenu((open) => !open)}
              disabled={exporting}
              aria-haspopup="menu"
              aria-expanded={exportMenu}
              className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark disabled:opacity-50"
            >
              <Download size={16} />
              {exporting ? 'Exporting…' : 'Export'}
              <ChevronDown size={14} className={exportMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {exportMenu && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-72 max-w-full xl:max-w-none overflow-hidden rounded-lg border border-admin-border bg-admin-card shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExport}
                  disabled={loading || !list.length}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-admin-dark disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Download size={16} className="mt-0.5 shrink-0 text-slate-500" />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">
                      Listed issues{list.length ? ' (' + list.length + ')' : ''}
                    </span>
                    <span className="block text-xs text-admin-muted">
                      {list.length
                        ? 'The rows the filters above select, with their data.'
                        : 'Nothing matches the current filters.'}
                    </span>
                  </span>
                </button>
                <div className="border-t border-admin-border" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportEmpty}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-admin-dark"
                >
                  <FileSpreadsheet size={16} className="mt-0.5 shrink-0 text-slate-500" />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">Empty format</span>
                    <span className="block text-xs text-admin-muted">
                      Headers only, with Category / Main Category dropdowns. Fill it in, then Import.
                    </span>
                  </span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={!categories.length || !mainCats.length}
            title="Upload a filled-in Excel file to create or update Repair Services in bulk"
            className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark disabled:opacity-50"
          >
            <Upload size={16} />
            Import
          </button>
          <button
            type="button"
            onClick={openCreate}
            disabled={!categories.length}
            className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add issue
          </button>
        </div>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        Issues live under a main category — e.g. <span className="text-slate-600">Mobile → Display &amp; Touch → &quot;Screen Broken&quot;</span>.
        {' '}Create the main category first in <span className="text-slate-600">Repair Categories</span>. Export writes the rows the
        {' '}filters above select; Import reads that same sheet back, creating new issues and updating the ones it recognises.
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
          emptyMessage="No issues. Pick a category + main category and add one."
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-xl bg-admin-card border border-admin-border p-4 sm:p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              {modal.type === 'create' ? 'Add issues' : 'Edit issue'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-admin-muted mb-1">Device category</label>
                <select
                  value={deviceCategoryId}
                  onChange={(e) => { setDeviceCategoryId(e.target.value); setCategoryId(''); }}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Main category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  required
                  disabled={!deviceCategoryId}
                >
                  <option value="">Select main category</option>
                  {mainCatsForForm.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
                {deviceCategoryId && mainCatsForForm.length === 0 && (
                  <p className="text-xs text-amber-400 mt-1">
                    No main categories for this device category yet. Add one in Repair Categories first.
                  </p>
                )}
              </div>
              {modal.type === 'create' ? (
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Issue names</label>
                  <input
                    type="text"
                    value={issueInput}
                    onChange={(e) => setIssueInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIssue(); } }}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    placeholder="Screen Broken, No Display, Touch Not Working — comma-separated, press Enter"
                  />
                  {issueNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {issueNames.map((n) => (
                        <span key={n} className="inline-flex items-center gap-1 rounded-full bg-admin-accent/20 text-admin-accent px-3 py-1 text-xs">
                          {n}
                          <button type="button" onClick={() => removeIssue(n)} className="text-admin-accent/80 hover:text-white">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-admin-muted mt-2">
                    Add several issues, then Save — all are created under the selected main category.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-admin-muted mb-1">Issue name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                      placeholder="e.g. Screen Broken"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-admin-muted mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                      placeholder="Optional customer-facing description"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-admin-muted mb-1">Icon URL</label>
                    <input
                      type="url"
                      value={iconUrl}
                      onChange={(e) => setIconUrl(e.target.value)}
                      className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                      placeholder="https://media.ggfix.in/repair-services/icon.png"
                    />
                    <p className="mt-1 text-xs text-admin-muted">Optional icon used in the customer repair-service picker.</p>
                  </div>
                </>
              )}
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
        <RepairServicesImportModal
          categories={categories}
          mainCategories={mainCats}
          onClose={() => setImportOpen(false)}
          onImported={() => { loadRefData(); load(); }}
        />
      )}
    </div>
  );
}
