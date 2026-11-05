'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '@/lib/api';
import { isAdmin as isAdminRole } from '@/lib/auth';
import { notifyError, notifySuccess } from '@/lib/toast';

// SUPER_ADMIN is the stored value for the platform administrator; the UI calls
// it "Admin" to match how the roles are named to users.
const ROLE_LABELS = {
  SUPER_ADMIN: 'Admin',
  ADMIN: 'Admin',
  MARKET_PERSON: 'Market Person',
  SHOP_OWNER: 'Shop Owner',
  TECHNICIAN: 'Technician',
};

function formatRole(role) {
  if (!role) return '—';
  return ROLE_LABELS[String(role).toUpperCase()] || role;
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function UserManagementPage() {
  const [list, setList] = useState([]);
  const [marketPersons, setMarketPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Resolved after mount — localStorage is unavailable during SSR/export, and
  // reading it inline would make the first client render disagree with the
  // server HTML and trip a hydration mismatch.
  const [canManage, setCanManage] = useState(false);
  useEffect(() => { setCanManage(isAdminRole()); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authApi.get('/auth/managed-users');
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.body?.message || e.message || 'Failed to load users');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only admins may list market persons, so a market person signed in here
  // simply gets no assignment picker rather than a spurious error banner.
  const loadMarketPersons = useCallback(async () => {
    if (!canManage) { setMarketPersons([]); return; }
    try {
      const data = await authApi.get('/auth/market-persons');
      setMarketPersons(Array.isArray(data) ? data : []);
    } catch {
      setMarketPersons([]);
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMarketPersons(); }, [loadMarketPersons]);

  const toggleActive = async (row) => {
    // Presentation only — the backend re-checks the role and answers 403, so a
    // non-admin can never actually flip this.
    if (!canManage) return;
    setBusyId(row.id);
    try {
      await authApi.patch(`/auth/shop-owners/${row.id}/status`, { active: !row.isActive });
      notifySuccess(`${row.name || row.email} is now ${!row.isActive ? 'Active' : 'Inactive'}.`);
      await load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const assignPerson = async (row, marketPersonId) => {
    if (!canManage) return;
    setBusyId(row.id);
    try {
      await authApi.patch(`/auth/shop-owners/${row.id}/active-person`, { marketPersonId });
      await load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Assignment failed');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.name, r.email, r.phone, r.createdPersonName, r.activePersonName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [list, query]);

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
          <p className="text-sm text-admin-muted">
            Shop owners and market persons, with who created each account and who is currently responsible for it.
            {canManage
              ? ' Only you, as an administrator, can activate or deactivate an account.'
              : ' Activation is restricted to administrators.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-admin-border bg-admin-dark px-4 py-2 text-sm font-medium text-slate-800 hover:bg-admin-card"
          >
            Refresh
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Add Market Person
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-admin-card border border-admin-border p-3 flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, mobile, email, creator, or active person"
          className="min-w-0 flex-1 rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-sm text-slate-900 placeholder:text-admin-muted focus:outline-none focus:border-admin-accent"
        />
        <span className="shrink-0 whitespace-nowrap text-xs text-admin-muted">Total: {list.length}</span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl bg-admin-card border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-admin-dark/60 text-[11px] uppercase tracking-wider text-admin-muted">
              <tr>
                <th className="px-4 py-3 text-left">S.No</th>
                <th className="px-4 py-3 text-left">User Name</th>
                <th className="px-4 py-3 text-left">Mobile Number</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Active Role</th>
                <th className="px-4 py-3 text-left">Active Person</th>
                <th className="px-4 py-3 text-left">Created By</th>
                <th className="px-4 py-3 text-left">Created Person</th>
                <th className="px-4 py-3 text-left">Created Date</th>
                <th className="px-4 py-3 text-left">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {loading ? (
                <tr><td className="px-4 py-6 text-admin-muted" colSpan={11}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-4 py-6 text-admin-muted" colSpan={11}>No users to manage yet.</td></tr>
              ) : filtered.map((r, i) => {
                const isOwner = String(r.role).toUpperCase() === 'SHOP_OWNER';
                return (
                  <tr key={r.id} className="hover:bg-admin-dark/40">
                    <td className="px-4 py-3 text-slate-600">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-500/15 text-slate-600 px-2 py-0.5 text-[11px] font-medium">
                        {formatRole(r.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatRole(r.activeRole)}</td>
                    <td className="px-4 py-3">
                      {canManage && isOwner ? (
                        <select
                          value={r.activePersonId || ''}
                          disabled={busyId === r.id}
                          onChange={(e) => assignPerson(r, e.target.value || null)}
                          className="rounded-lg bg-admin-dark border border-admin-border px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-admin-accent disabled:opacity-50"
                        >
                          <option value="">— Unassigned —</option>
                          {marketPersons.map((mp) => (
                            <option key={mp.id} value={mp.id}>{mp.name || mp.email}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600">{r.activePersonName || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatRole(r.createdBy)}</td>
                    <td className="px-4 py-3 text-slate-600">{r.createdPersonName || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <StatusCell
                        active={!!r.isActive}
                        canManage={canManage}
                        busy={busyId === r.id}
                        onToggle={() => toggleActive(r)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateMarketPersonModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            notifySuccess('Market person created.');
            await Promise.all([load(), loadMarketPersons()]);
          }}
        />
      )}
    </div>
  );
}

/**
 * Account status cell. Admins get a badge plus the opposite action; everyone
 * else sees the badge alone, since only ADMIN may change it.
 */
function StatusCell({ active, canManage, busy, onToggle }) {
  const badge = (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${active ? 'bg-brand-500/15 text-brand-600' : 'bg-slate-500/15 text-slate-500'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );

  if (!canManage) {
    return (
      <span className="inline-flex items-center" title="Only an administrator can change account status">
        {badge}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {badge}
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50 ${active ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'}`}
      >
        {busy ? '…' : active ? 'Deactivate' : 'Activate'}
      </button>
    </div>
  );
}

/**
 * Collects only the market person's own details. createdBy, createdPersonId,
 * createdPersonName, createdAt and isActive are deliberately absent — the
 * backend derives every one of them from the authenticated caller.
 */
function CreateMarketPersonModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      notifyError('Name and email are required.');
      return;
    }
    setSaving(true);
    try {
      await authApi.post('/auth/market-persons', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        password: form.password || null,
      });
      await onCreated();
    } catch (err) {
      notifyError(err.body?.message || err.message || 'Could not create market person');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <form onSubmit={submit} className="bg-admin-card border border-admin-border rounded-xl p-4 sm:p-6 max-w-md w-full max-h-[90dvh] overflow-y-auto space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Add Market Person</h3>

        {['name', 'email', 'phone'].map((field) => (
          <div key={field} className="space-y-1">
            <label className="block text-xs font-medium text-admin-muted capitalize">
              {field}{field !== 'phone' ? ' *' : ''}
            </label>
            <input
              value={form[field]}
              onChange={set(field)}
              type={field === 'email' ? 'email' : 'text'}
              className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-admin-accent"
            />
          </div>
        ))}

        <div className="space-y-1">
          <label className="block text-xs font-medium text-admin-muted">Password</label>
          <input
            value={form.password}
            onChange={set('password')}
            type="password"
            placeholder="Optional — they can sign in with OTP 123456"
            className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-sm text-slate-900 placeholder:text-admin-muted focus:outline-none focus:border-admin-accent"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-admin-border px-4 py-2 text-sm text-slate-800 hover:bg-admin-dark">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-admin-accent px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
