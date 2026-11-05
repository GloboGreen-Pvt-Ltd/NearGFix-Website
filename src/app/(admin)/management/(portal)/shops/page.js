'use client';

import { useEffect, useMemo, useState } from 'react';
import TablePagination from '@/components/TablePagination';
import { pageBounds } from '@/lib/pagination';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { isAdmin as isAdminRole } from '@/lib/auth';
import SafeImage from '@/components/SafeImage';
import { notifyError } from '@/lib/toast';

function initialsOf(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

export default function ShopOwnerListPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  // Resolved after mount — localStorage is unavailable during SSR/export, and
  // reading it inline would make the first client render disagree with the
  // server HTML and trip a hydration mismatch.
  const [canManageStatus, setCanManageStatus] = useState(false);

  useEffect(() => { setCanManageStatus(isAdminRole()); }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authApi.get('/auth/shop-owners');
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.body?.message || e.message || 'Failed to load shop owners');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (row) => {
    // Hiding the control is presentation only — the backend re-checks the role
    // and answers 403, so a non-admin can never actually flip this.
    if (!canManageStatus) return;
    try {
      await authApi.patch(`/auth/shop-owners/${row.id}/status`, { active: !row.isActive });
      load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Update failed');
    }
  };

  const handleDelete = async (row) => {
    try {
      await authApi.delete(`/auth/shop-owners/${row.id}`);
      setConfirmingDelete(null);
      load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.name, r.email, r.phone, r.personalAddress].filter(Boolean).some((v) =>
        String(v).toLowerCase().includes(q),
      ),
    );
  }, [list, query]);

  const { safePage, start } = pageBounds(filtered.length, page, pageSize);
  const visible = filtered.slice(start, start + pageSize);

  // Searching or reloading can leave the current page past the end of the results;
  // pageBounds would clamp the slice, but the footer would still read the old page
  // until something else moved it.
  useEffect(() => { setPage(0); }, [query, list.length, pageSize]);

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Shop Owner List</h1>
          <p className="text-sm text-admin-muted">Review shop owners, email verification, profile completion, active status, and direct actions.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-admin-border bg-admin-dark px-4 py-2 text-sm font-medium text-slate-800 hover:bg-admin-card"
          >
            Refresh
          </button>
          <Link
            href="/management/shops/new-owner"
            className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Shop Owner
          </Link>
        </div>
      </div>

      <div className="rounded-xl bg-admin-card border border-admin-border p-3 flex items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by shop owner name, mobile, email, or address"
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
                <th className="px-4 py-3 text-left">Avatar</th>
                <th className="px-4 py-3 text-left">Shop Owner Name</th>
                <th className="px-4 py-3 text-left">Mobile Number</th>
                <th className="px-4 py-3 text-left">Email ID</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Created By</th>
                <th className="px-4 py-3 text-left">Created Date</th>
                <th className="px-4 py-3 text-left">Email Status</th>
                <th className="px-4 py-3 text-left">Profile Progress</th>
                <th className="px-4 py-3 text-left">Active Date</th>
                <th className="px-4 py-3 text-left">Inactive Date</th>
                <th className="px-4 py-3 text-left">Account Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {loading ? (
                <tr><td className="px-4 py-6 text-admin-muted" colSpan={14}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-4 py-6 text-admin-muted" colSpan={14}>No shop owners yet. Click &quot;+ Add Shop Owner&quot; to create one.</td></tr>
              ) : visible.map((r, i) => (
                <tr key={r.id} className="hover:bg-admin-dark/40">
                  <td className="px-4 py-3 text-slate-600">{start + i + 1}</td>
                  <td className="px-4 py-3">
                    <SafeImage
                      src={r.avatarUrl}
                      alt={r.name}
                      className="h-9 w-9 rounded-full object-cover"
                      fallback={
                        <div className="h-9 w-9 rounded-full bg-admin-accent/20 text-admin-accent text-xs font-bold flex items-center justify-center">
                          {initialsOf(r.name)}
                        </div>
                      }
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-slate-500/15 text-slate-600 px-2 py-0.5 text-[11px] font-medium">
                      {formatRole(r.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.createdPersonName || '—'}
                    {r.createdBy && (
                      <span className="block text-[10px] text-admin-muted">{formatRole(r.createdBy)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.emailVerified ? (
                      <span className="inline-flex items-center rounded-full bg-brand-500/15 text-brand-300 px-2 py-0.5 text-[11px] font-medium">✓ Verified</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-300 px-2 py-0.5 text-[11px] font-medium">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 min-w-[180px]">
                    <ProfileProgress percent={r.profileCompletePercent ?? 0} done={r.sectionsComplete ?? 0} total={r.sectionsTotal ?? 5} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.activeDate ? new Date(r.activeDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{r.inactiveDate ? new Date(r.inactiveDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <StatusToggle
                      active={!!r.isActive}
                      canToggle={canManageStatus}
                      onToggle={() => toggleActive(r)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/management/shops/view/?id=${r.id}`} onClick={() => { try { sessionStorage.setItem('ggfix.ownerId', r.id); } catch {} }} title="View" className="p-2.5 sm:p-1.5 rounded hover:bg-admin-dark text-sky-400">
                        <IconEye />
                      </Link>
                      <Link href={`/management/shops/edit/?id=${r.id}`} onClick={() => { try { sessionStorage.setItem('ggfix.ownerId', r.id); } catch {} }} title="Edit" className="p-2.5 sm:p-1.5 rounded hover:bg-admin-dark text-slate-600">
                        <IconPencil />
                      </Link>
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setConfirmingDelete(r)}
                        className="p-2.5 sm:p-1.5 rounded hover:bg-admin-dark text-red-600"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <TablePagination
            total={filtered.length}
            page={safePage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {confirmingDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-admin-card border border-admin-border rounded-xl p-4 sm:p-6 max-w-sm w-full max-h-[90dvh] overflow-y-auto space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Delete shop owner?</h3>
            <p className="text-sm text-admin-muted">
              This will permanently remove <span className="text-slate-800 font-medium">{confirmingDelete.name || confirmingDelete.email}</span>.
              Their {confirmingDelete.locations?.length || 0} linked shop{(confirmingDelete.locations?.length || 0) === 1 ? '' : 's'} will be detached (not deleted).
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmingDelete(null)} className="rounded-lg border border-admin-border px-4 py-2 text-sm text-slate-800 hover:bg-admin-dark">Cancel</button>
              <button onClick={() => handleDelete(confirmingDelete)} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileProgress({ percent, done, total }) {
  const color = percent >= 100 ? 'bg-brand-500' : percent >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="font-semibold text-slate-800">{percent}%</span>
        <span className="text-admin-muted">{done}/{total} complete</span>
      </div>
      <div className="h-1.5 rounded-full bg-admin-dark overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[10px] text-admin-muted">
        {percent >= 100 ? 'All sections complete' : `${total - done} section${(total - done) === 1 ? '' : 's'} incomplete`}
      </span>
    </div>
  );
}

/**
 * Account status cell. Admins get an interactive switch; everyone else sees the
 * same Active/Inactive badge with no control, since only ADMIN may change it.
 */
function StatusToggle({ active, canToggle, onToggle }) {
  const badge = (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${active ? 'bg-brand-500/15 text-brand-300' : 'bg-slate-500/15 text-slate-500'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );

  if (!canToggle) {
    return (
      <span className="inline-flex items-center" title="Only an administrator can change account status">
        {badge}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-2"
      aria-label={active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
    >
      <span className={`relative inline-block h-5 w-9 rounded-full transition ${active ? 'bg-brand-500' : 'bg-admin-dark border border-admin-border'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${active ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {badge}
    </button>
  );
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconPencil() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
