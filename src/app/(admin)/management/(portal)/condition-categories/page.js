'use client';

import { useCallback, useEffect, useState } from 'react';
import { masterApi } from '@/lib/api';
import DataTable from '@/components/DataTable';
import SellFlowBulkActions from '@/components/SellFlowBulkActions';
import SellFlowImportModal from '@/components/SellFlowImportModal';
import { notifyError } from '@/lib/toast';

const splitNames = (value) => (value || '')
  .split(/[,\n]/)
  .map((item) => item.trim())
  .filter(Boolean);

/**
 * Maintains the parent condition categories (for example Screen / Display and
 * Battery / Power). Their selectable options live on the separate Condition
 * Groups screen so each level has an independent bulk import/export workflow.
 */
export default function ConditionCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [conditionCategories, setConditionCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const [modal, setModal] = useState(null); // { type: 'create' | 'edit', group? }
  const [deviceCategoryId, setDeviceCategoryId] = useState('');
  const [input, setInput] = useState('');
  const [chips, setChips] = useState([]); // [{ id?, name }]
  const [removedIds, setRemovedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');

    const [groupsResult, categoriesResult] = await Promise.allSettled([
      masterApi.get('/master/condition-groups'),
      masterApi.get('/master/device-categories'),
    ]);

    let loadError = null;
    if (groupsResult.status === 'fulfilled') {
      const data = groupsResult.value;
      setConditionCategories(Array.isArray(data) ? data : data?.content ?? []);
    } else {
      loadError = groupsResult.reason;
      setConditionCategories([]);
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

  const categoryName = (id) => categories.find((category) => category.id === id)?.name || 'All categories (shared)';
  const filteredConditions = filterCategory
    ? conditionCategories.filter((condition) => condition.deviceCategoryId === filterCategory)
    : conditionCategories;

  const groupedConditions = Object.values(filteredConditions.reduce((result, condition) => {
    const key = condition.deviceCategoryId || '__shared__';
    (result[key] ||= {
      id: key,
      deviceCategoryId: condition.deviceCategoryId || null,
      items: [],
    }).items.push(condition);
    return result;
  }, {}));

  const openCreate = () => {
    setModal({ type: 'create' });
    setDeviceCategoryId(filterCategory || '');
    setInput('');
    setChips([]);
    setRemovedIds([]);
  };

  const openEdit = (group) => {
    setModal({ type: 'edit', group });
    setDeviceCategoryId(group.deviceCategoryId || '');
    setInput('');
    setChips(group.items.map((condition) => ({ id: condition.id, name: condition.name })));
    setRemovedIds([]);
  };

  const addChips = () => {
    const names = splitNames(input);
    if (!names.length) return;
    setChips((current) => {
      const next = [...current];
      for (const name of names) {
        if (!next.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
          next.push({ name });
        }
      }
      return next;
    });
    setInput('');
  };

  const removeChip = (chip) => {
    if (chip.id) setRemovedIds((current) => [...current, chip.id]);
    setChips((current) => current.filter((item) => item !== chip));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!deviceCategoryId) {
      notifyError('Select a device category.');
      return;
    }

    const allChips = [...chips];
    for (const name of splitNames(input)) {
      if (!allChips.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        allChips.push({ name });
      }
    }

    setSubmitting(true);
    try {
      for (const id of removedIds) {
        await masterApi.delete(`/master/condition-groups/${id}`).catch(() => {});
      }
      for (const chip of allChips) {
        if (chip.id) continue;
        await masterApi.post('/master/condition-groups', {
          name: chip.name,
          deviceCategoryId,
        });
      }
      setModal(null);
      reload();
    } catch (submitError) {
      notifyError(submitError.body?.message || submitError.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteGroup = async (group) => {
    if (!confirm(`Delete all ${group.items.length} condition categor${group.items.length === 1 ? 'y' : 'ies'} for ${categoryName(group.deviceCategoryId)}? Their options are removed too.`)) {
      return;
    }

    try {
      for (const condition of group.items) {
        await masterApi.delete(`/master/condition-groups/${condition.id}`).catch(() => {});
      }
      reload();
    } catch (deleteError) {
      notifyError(deleteError.body?.message || deleteError.message || 'Delete failed');
    }
  };

  const columns = [
    {
      key: 'deviceCategoryId',
      label: 'Device category',
      render: (row) => categoryName(row.deviceCategoryId),
      search: (row) => categoryName(row.deviceCategoryId),
    },
    {
      key: 'items',
      label: 'Condition categories',
      search: (row) => row.items.map((condition) => condition.name).join(' '),
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.items.map((condition) => (
            <span
              key={condition.id}
              className="rounded-full border border-admin-border bg-admin-dark px-2.5 py-1 text-xs text-slate-800"
            >
              {condition.name}
            </span>
          ))}
        </div>
      ),
    },
  ];

  const inputClassName = 'w-full rounded-lg border border-admin-border bg-admin-dark px-3 py-2 text-slate-900';

  return (
    <div className="space-y-10 p-4 sm:p-6 md:p-8">
      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Condition Categories</h1>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <select
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              className="w-full rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm text-slate-800 sm:w-auto"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <SellFlowBulkActions
              kind="conditionCategories"
              categories={categories}
              rows={filteredConditions}
              filterCategory={filterCategory}
              onRefresh={reload}
              onImport={() => setImportOpen(true)}
            />
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add category
            </button>
          </div>
        </div>
        <p className="mb-4 text-sm text-admin-muted">
          Condition categories are the parent groups for a device, such as Screen / Display and Battery / Power. Manage their selectable options on the separate Condition Groups page.
        </p>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="text-admin-muted">Loading…</p>
        ) : (
          <DataTable
            columns={columns}
            rows={groupedConditions}
            onEdit={openEdit}
            onDelete={deleteGroup}
            emptyMessage="No condition categories. Pick a device category and add one."
          />
        )}
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-admin-border bg-admin-card max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-medium text-slate-900">
              {modal.type === 'create'
                ? 'Add condition categories'
                : `Edit condition categories — ${categoryName(deviceCategoryId)}`}
            </h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-admin-muted">Device category</label>
                <select
                  value={deviceCategoryId}
                  onChange={(event) => setDeviceCategoryId(event.target.value)}
                  className={`${inputClassName} disabled:opacity-60`}
                  disabled={modal.type === 'edit'}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-admin-muted">Condition categories</label>
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addChips();
                    }
                  }}
                  className={inputClassName}
                  placeholder="Screen Condition, Back Panel — comma-separated, press Enter"
                />
                {chips.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {chips.map((chip, index) => (
                      <span
                        key={chip.id || `new-${index}`}
                        className="inline-flex items-center gap-1 rounded-full bg-admin-accent/20 px-3 py-1 text-xs text-admin-accent"
                      >
                        {chip.name}
                        <button
                          type="button"
                          onClick={() => removeChip(chip)}
                          className="text-admin-accent/80 hover:text-white"
                          aria-label={`Remove ${chip.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(null)}
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

      {importOpen && (
        <SellFlowImportModal
          kind="conditionCategories"
          categories={categories}
          onClose={() => setImportOpen(false)}
          onImported={reload}
        />
      )}
    </div>
  );
}
