'use client';

import { useEffect, useState } from 'react';
import { masterApi } from '@/lib/api';
import DataTable from '@/components/DataTable';
import { notifyError } from '@/lib/toast';

// Admin CRUD for the technician Ticket Detail screen's "Technician Work
// Status" dropdown. The admin only enters a label; the backend infers the
// matching ticket status (e.g. "Done" → READY, anything else → IN_REPAIR)
// so the shop never has to think about backend status keys.
export default function MasterTechnicianWorkStatusesPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null);
  const [label, setLabel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await masterApi.get('/master/technician-work-statuses');
      setList(Array.isArray(data) ? data : data?.content ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setList([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setModal({ type: 'create' });
    setLabel('');
    setIsActive(true);
  };
  const openEdit = (item) => {
    setModal({ type: 'edit', item });
    setLabel(item.label || '');
    setIsActive(item.isActive !== false);
  };
  const closeModal = () => setModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    try {
      // The backend infers ticketStatus from the label (e.g. "done" → READY),
      // generates a unique code, and appends to the end of the list.
      const body = {
        label: label.trim(),
        isActive,
      };
      if (modal.type === 'create') {
        await masterApi.post('/master/technician-work-statuses', body);
      } else {
        await masterApi.put(`/master/technician-work-statuses/${modal.item.id}`, body);
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
    if (!confirm(`Delete "${row.label}"?`)) return;
    try {
      await masterApi.delete(`/master/technician-work-statuses/${row.id}`);
      load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  const columns = [
    { key: 'sortOrder', label: 'Sort', render: (r) => r.sortOrder ?? 0 },
    { key: 'label', label: 'Label' },
    { key: 'code', label: 'Code', render: (r) => <span className="text-admin-muted">{r.code}</span> },
    { key: 'ticketStatus', label: 'Ticket Status', render: (r) => (
        <span className="rounded bg-admin-dark px-2 py-0.5 text-xs text-slate-800">{r.ticketStatus}</span>
      ) },
    { key: 'isActive', label: 'Active', render: (r) => (
        <span className={r.isActive ? 'text-brand-400' : 'text-admin-muted'}>{r.isActive ? 'Yes' : 'No'}</span>
      ) },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Work Status</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add status
        </button>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        Options shown in the employee app&apos;s <span className="text-slate-600">Technician Work Status</span> dropdown.
        <span className="text-slate-600"> Label</span> is what the technician sees;
        <span className="text-slate-600"> Ticket Status</span> is the backend status the PATCH applies.
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
          emptyMessage="No statuses. Add one to populate the technician dropdown."
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-admin-card border border-admin-border max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              {modal.type === 'create' ? 'New status' : 'Edit status'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-admin-muted mb-1">Label</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  placeholder="e.g. Start, In Progress, Done"
                  required
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4"
                />
                Active (shown in technician dropdown)
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
