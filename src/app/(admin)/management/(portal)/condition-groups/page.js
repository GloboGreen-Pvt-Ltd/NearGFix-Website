'use client';

import { useCallback, useEffect, useState } from 'react';
import { masterApi } from '@/lib/api';
import DataTable from '@/components/DataTable';
import SellFlowBulkActions from '@/components/SellFlowBulkActions';
import SellFlowImportModal from '@/components/SellFlowImportModal';
import { notifyError } from '@/lib/toast';

const splitNames = (value) => (value || '').split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean);

/**
 * Manage the selectable choices inside a condition category. Parent condition
 * categories live on their own page so this menu stays focused on the options
 * a customer can choose (for example: No Damage, Minor Spot, Screen Broken).
 */
export default function MasterConditionGroupsPage() {
  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [conditions, setConditions] = useState([]);
  const [optionsByCondition, setOptionsByCondition] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const [modal, setModal] = useState(null); // { type: 'add' | 'edit', condition? }
  const [deviceCategoryId, setDeviceCategoryId] = useState('');
  const [conditionId, setConditionId] = useState('');
  const [input, setInput] = useState('');
  const [chips, setChips] = useState([]); // [{ id?, label }]
  const [removed, setRemoved] = useState([]);
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
      const groups = Array.isArray(data) ? data : data?.content ?? [];
      setConditions(groups);
      const pairs = await Promise.all(groups.map(async (group) => {
        try {
          const options = await masterApi.get(`/master/condition-groups/${group.id}/options`);
          return [group.id, Array.isArray(options) ? options : options?.content ?? []];
        } catch (optionError) {
          loadError ||= optionError;
          return [group.id, []];
        }
      }));
      setOptionsByCondition(Object.fromEntries(pairs));
    } else {
      loadError = groupsResult.reason;
      setConditions([]);
      setOptionsByCondition({});
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
    ? conditions.filter((condition) => condition.deviceCategoryId === filterCategory)
    : conditions;
  const conditionsForCategory = deviceCategoryId
    ? conditions.filter((condition) => condition.deviceCategoryId === deviceCategoryId || !condition.deviceCategoryId)
    : conditions;

  const openAdd = () => {
    setModal({ type: 'add' });
    setDeviceCategoryId(filterCategory || '');
    setConditionId('');
    setInput('');
    setChips([]);
    setRemoved([]);
  };

  const openEdit = (condition) => {
    setModal({ type: 'edit', condition });
    setDeviceCategoryId(condition.deviceCategoryId || '');
    setConditionId(condition.id);
    setInput('');
    setChips((optionsByCondition[condition.id] || []).map((option) => ({ id: option.id, label: option.label })));
    setRemoved([]);
  };

  const addChips = () => {
    const entries = splitNames(input);
    if (!entries.length) return;
    setChips((current) => {
      const next = [...current];
      for (const entry of entries) {
        if (!next.some((chip) => chip.label.toLowerCase() === entry.toLowerCase())) next.push({ label: entry });
      }
      return next;
    });
    setInput('');
  };

  const removeChip = (chip) => {
    if (chip.id) setRemoved((current) => [...current, chip.id]);
    setChips((current) => current.filter((entry) => entry !== chip));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!conditionId) {
      notifyError('Pick a condition category first. Add one in Condition Categories if it does not exist yet.');
      return;
    }
    const all = [...chips];
    for (const entry of splitNames(input)) {
      if (!all.some((chip) => chip.label.toLowerCase() === entry.toLowerCase())) all.push({ label: entry });
    }
    setSubmitting(true);
    try {
      for (const id of removed) await masterApi.delete(`/master/condition-options/${id}`);
      const existing = optionsByCondition[conditionId] || [];
      let sortOrder = existing.length;
      for (const chip of all) {
        if (chip.id) continue;
        await masterApi.post('/master/condition-options', {
          groupId: conditionId,
          label: chip.label,
          sortOrder: sortOrder++,
          priceImpact: 0,
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

  const columns = [
    { key: 'deviceCategoryId', label: 'Device category', render: (row) => categoryName(row.deviceCategoryId) },
    { key: 'name', label: 'Condition category' },
    {
      key: 'options',
      label: 'Condition groups',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {(optionsByCondition[row.id] || []).map((option) => (
            <span key={option.id} className="inline-flex rounded-full border border-admin-border bg-admin-dark px-2.5 py-1 text-xs text-slate-800">
              {option.label}
            </span>
          ))}
          {(!optionsByCondition[row.id] || optionsByCondition[row.id].length === 0) ? <span className="text-xs text-admin-muted">—</span> : null}
        </div>
      ),
    },
  ];

  const inputClassName = 'w-full rounded-lg border border-admin-border bg-admin-dark px-3 py-2 text-slate-900';
  const categorySelect = (value, onChange, disabled = false) => (
    <select value={value} onChange={onChange} className={`${inputClassName} disabled:opacity-60`} disabled={disabled} required>
      <option value="">Select category</option>
      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
    </select>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Condition Groups</h1>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <select
            value={filterCategory}
            onChange={(event) => {
              setFilterCategory(event.target.value);
            }}
            className="w-full rounded-lg border border-admin-border bg-admin-card px-3 py-2 text-sm text-slate-800 sm:w-auto"
          >
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <SellFlowBulkActions
            kind="conditionGroups"
            categories={categories}
            rows={filteredConditions}
            optionsByGroup={optionsByCondition}
            filterCategory={filterCategory}
            onRefresh={reload}
            onImport={() => setImportOpen(true)}
          />
          <button
            type="button"
            onClick={openAdd}
            disabled={!conditions.length}
            className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add options
          </button>
        </div>
      </div>
      <p className="text-sm text-admin-muted">
        Manage the options in each condition category (for example No Damage, Minor Spot, Screen Broken). Create or rename condition categories from the separate Condition Categories menu.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-admin-muted">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={filteredConditions}
          onEdit={openEdit}
          emptyMessage="No condition categories yet. Add one from the Condition Categories menu first."
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-admin-border bg-admin-card max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-medium text-slate-900">
              {modal.type === 'edit' ? `Edit condition groups — ${modal.condition?.name}` : 'Add condition groups'}
            </h2>
            <form onSubmit={submit} className="space-y-4">
              {modal.type === 'add' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-admin-muted">Device category</label>
                    {categorySelect(deviceCategoryId, (event) => { setDeviceCategoryId(event.target.value); setConditionId(''); })}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-admin-muted">Condition category</label>
                    <select value={conditionId} onChange={(event) => setConditionId(event.target.value)} className={inputClassName}>
                      <option value="">Select condition category</option>
                      {conditionsForCategory.map((condition) => <option key={condition.id} value={condition.id}>{condition.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm text-admin-muted">Condition groups</label>
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addChips(); } }}
                  className={inputClassName}
                  placeholder="No Damage, Minor Spot, Screen Broken — comma-separated, press Enter"
                />
                {chips.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {chips.map((chip, index) => (
                      <span key={chip.id || `new-${index}`} className="inline-flex items-center gap-1 rounded-full bg-admin-accent/20 px-3 py-1 text-xs text-admin-accent">
                        {chip.label}
                        <button type="button" onClick={() => removeChip(chip)} className="text-admin-accent/80 hover:text-white">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModal(null)} className="rounded-lg px-4 py-2 text-slate-600 hover:bg-admin-dark">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-admin-accent px-4 py-2 text-white disabled:opacity-50">{submitting ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importOpen && (
        <SellFlowImportModal
          kind="conditionGroups"
          categories={categories}
          onClose={() => setImportOpen(false)}
          onImported={reload}
        />
      )}
    </div>
  );
}
