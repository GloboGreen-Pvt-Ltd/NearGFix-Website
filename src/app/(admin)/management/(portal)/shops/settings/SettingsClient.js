'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi, shopApi } from '@/lib/api';
import { notifyError } from '@/lib/toast';

export default function ShopSettingsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const shopId = params.get('id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [kycStatus, setKycStatus] = useState('PENDING');
  const [pickupFromTime, setPickupFromTime] = useState('01:00 PM');
  const [pickupToTime, setPickupToTime] = useState('07:00 PM');
  const [pickupDistanceKm, setPickupDistanceKm] = useState('5');

  useEffect(() => {
    const load = async () => {
      if (!shopId) return;
      setLoading(true);
      setError('');
      try {
        // Shop profile is currently exposed from auth-service
        const data = await authApi.get(`/auth/shops/${shopId}`);
        setName(data.name ?? data.shopName ?? '');
        setSlug(data.slug ?? '');
        setEmail(data.email ?? '');
        setPhone(data.phone ?? '');
        setAddress(data.address ?? '');
        setTimezone(data.timezone ?? '');
        setIsActive(data.isActive ?? data.status === 'ACTIVE');

        // If these fields exist on the shop payload, hydrate from them
        if (data.kycStatus) setKycStatus(data.kycStatus);
        if (data.pickupFromTime) setPickupFromTime(data.pickupFromTime);
        if (data.pickupToTime) setPickupToTime(data.pickupToTime);
        if (data.pickupDistanceKm != null) setPickupDistanceKm(String(data.pickupDistanceKm));
      } catch (e) {
        setError(e.body?.message || e.message || 'Failed to load shop');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [shopId]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);
    try {
      await authApi.patch(`/auth/shops/${shopId}`, {
        name: name.trim(),
        slug: slug.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        timezone: timezone.trim() || null,
        isActive,
      });
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKyc = async (e) => {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);
    try {
      // If there is a dedicated KYC endpoint, you can switch to it later.
      await authApi.patch(`/auth/shops/${shopId}`, { kycStatus });
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Failed to save KYC status');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePickup = async (e) => {
    e.preventDefault();
    if (!shopId) return;
    setSaving(true);
    try {
      // Prefer a pickup-service API if available; for now we persist via shop service when fields exist.
      await shopApi
        .patch(`/shops/${shopId}/pickup-options`, {
          fromTime: pickupFromTime,
          toTime: pickupToTime,
          distanceKm: Number(pickupDistanceKm) || 0,
        })
        .catch(async () => {
          // Fallback: store on shop object when dedicated endpoint is not present.
          await authApi.patch(`/auth/shops/${shopId}`, {
            pickupFromTime,
            pickupToTime,
            pickupDistanceKm: Number(pickupDistanceKm) || 0,
          });
        });
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Failed to save pickup options');
    } finally {
      setSaving(false);
    }
  };

  if (!shopId) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        <p className="text-red-600 text-sm">Invalid shop id.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Shop settings</h1>
          <p className="text-admin-muted text-sm">
            Manage shop profile, KYC status, and pickup options.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-admin-border px-3 py-2 text-sm text-slate-800 hover:bg-admin-dark"
        >
          ← Back
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-admin-muted text-sm">Loading…</p>
      ) : (
        <>
          {/* Basic profile */}
          <section className="rounded-xl border border-admin-border bg-admin-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div>
                <h2 className="text-lg font-medium text-slate-900">Basic Shop Profile</h2>
                <p className="text-admin-muted text-sm">
                  Name, contact details, and address used in invoices and mobile app.
                </p>
              </div>
              <Link
                href="/management/shops"
                className="text-xs text-admin-muted hover:text-slate-900 hover:underline"
              >
                View all shops
              </Link>
            </div>

            <form onSubmit={handleSaveProfile} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-sm text-admin-muted">Shop name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm text-admin-muted">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  placeholder="green-mobiles"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm text-admin-muted">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm text-admin-muted">Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="block text-sm text-admin-muted">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm text-admin-muted">Timezone</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  placeholder="Asia/Kolkata"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm text-admin-muted">Status</label>
                <select
                  value={isActive ? 'ACTIVE' : 'SUSPENDED'}
                  onChange={(e) => setIsActive(e.target.value === 'ACTIVE')}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            </form>
          </section>

          {/* KYC status */}
          <section className="rounded-xl border border-admin-border bg-admin-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div>
                <h2 className="text-lg font-medium text-slate-900">KYC status</h2>
                <p className="text-admin-muted text-sm">
                  Controls whether this shop is pending, approved, or rejected for onboarding.
                </p>
              </div>
            </div>
            <form onSubmit={handleSaveKyc} className="flex flex-wrap items-center gap-4">
              <select
                value={kycStatus}
                onChange={(e) => setKycStatus(e.target.value)}
                className="rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900 text-sm"
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save KYC status'}
              </button>
            </form>
          </section>

          {/* Pickup options */}
          <section className="rounded-xl border border-admin-border bg-admin-card p-5 space-y-4">
            <div>
              <h2 className="text-lg font-medium text-slate-900">Pickup options</h2>
              <p className="text-admin-muted text-sm">
                Default pickup window and distance used in the shop owner mobile app.
              </p>
            </div>
            <form onSubmit={handleSavePickup} className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="block text-sm text-admin-muted">From Time</label>
                <input
                  type="text"
                  value={pickupFromTime}
                  onChange={(e) => setPickupFromTime(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  placeholder="01:00 PM"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm text-admin-muted">To Time</label>
                <input
                  type="text"
                  value={pickupToTime}
                  onChange={(e) => setPickupToTime(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  placeholder="07:00 PM"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm text-admin-muted">Pickup Distance (KM)</label>
                <input
                  type="number"
                  min="0"
                  value={pickupDistanceKm}
                  onChange={(e) => setPickupDistanceKm(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                />
              </div>
              <div className="md:col-span-3 flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save pickup options'}
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}

