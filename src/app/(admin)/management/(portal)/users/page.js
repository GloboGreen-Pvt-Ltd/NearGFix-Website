'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import DataTable from '@/components/DataTable';

export default function UserManagementPage() {
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState('');

  const loadShops = async () => {
    setLoadingShops(true);
    setError('');
    try {
      const data = await authApi.get('/auth/shops');
      setShops(Array.isArray(data) ? data : []);
      if (!selectedShopId && data?.length) {
        setSelectedShopId(data[0].id ?? data[0].shopId ?? '');
      }
    } catch (e) {
      setError(e.message || 'Failed to load shops');
      setShops([]);
    } finally {
      setLoadingShops(false);
    }
  };

  const loadUsers = async () => {
    if (!selectedShopId) {
      setUsers([]);
      return;
    }
    setLoadingUsers(true);
    setError('');
    try {
      const data = await authApi.get(`/auth/shops/${selectedShopId}/users`);
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.body?.message || e.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadShops();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [selectedShopId]);

  const selectedShop = shops.find((s) => (s.id ?? s.shopId) === selectedShopId);
  const shopName = selectedShop?.name ?? selectedShop?.shopName ?? selectedShop?.slug ?? '';

  const columns = [
    { key: 'email', label: 'Email', render: (r) => r.email ?? '—' },
    { key: 'name', label: 'Name', render: (r) => r.name ?? '—' },
    {
      key: 'role',
      label: 'Role',
      render: (r) => (
        <span className="text-slate-800">
          {r.role ?? '—'}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Active',
      render: (r) => (
        <span className={r.isActive ? 'text-brand-400' : 'text-admin-muted'}>
          {r.isActive ? 'Yes' : 'No'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        View and manage users by shop. Select a shop to see its users and roles.
      </p>

      {loadingShops ? (
        <p className="text-admin-muted">Loading shops…</p>
      ) : (
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-600 mb-2">Shop</label>
          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
            className="w-full max-w-md rounded-lg border border-admin-border bg-admin-card px-4 py-2 text-slate-800 focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
          >
            <option value="">Select a shop</option>
            {shops.map((s) => {
              const id = s.id ?? s.shopId;
              const name = s.name ?? s.shopName ?? s.slug ?? id;
              return (
                <option key={id} value={id}>
                  {name} {s.slug ? `(${s.slug})` : ''}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {selectedShopId && (
        <>
          <h2 className="text-lg font-medium text-slate-800 mb-3">
            Users{shopName ? ` — ${shopName}` : ''}
          </h2>
          {loadingUsers ? (
            <p className="text-admin-muted">Loading users…</p>
          ) : (
            <DataTable
              columns={columns}
              rows={users}
              keyExtractor={(r) => r.id ?? r.userId ?? JSON.stringify(r)}
              emptyMessage="No users for this shop."
            />
          )}
        </>
      )}

      <div className="mt-6 p-4 rounded-lg border border-admin-border bg-admin-card/50 text-sm text-admin-muted">
        <p className="font-medium text-slate-600 mb-1">Seeded shop users (dev, password: test)</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Shop Alpha — login: <code className="text-slate-800">shop1</code> / test</li>
          <li>Shop Beta — login: <code className="text-slate-800">shop2</code> / test</li>
        </ul>
      </div>
    </div>
  );
}
