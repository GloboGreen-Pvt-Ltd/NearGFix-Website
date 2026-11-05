'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { notifyError } from '@/lib/toast';

export default function NewShopPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSubmitting(true);
    try {
      await authApi.post('/auth/shops', {
        name: name.trim(),
        slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
        address: address.trim() || undefined,
      });
      router.push('/management/shops');
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/management/shops" className="text-admin-muted hover:text-slate-900 text-sm">
          ← Shops
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Create shop</h1>
      </div>
      <div className="max-w-lg rounded-xl border border-admin-border bg-admin-card p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-admin-muted mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-admin-muted mb-1">Slug (unique URL id)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. my-repair-shop"
              className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-admin-muted mb-1">Address (optional)</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <Link
              href="/management/shops"
              className="rounded-lg px-4 py-2 text-slate-600 hover:bg-admin-dark"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-admin-accent px-4 py-2 text-white disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create shop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
