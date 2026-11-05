'use client';

import { useEffect, useState } from 'react';
import { shopApi } from '@/lib/api';
import DataTable from '@/components/DataTable';
import { notifyError, notifySuccess } from '@/lib/toast';

const SERVICE_CODES = ['REPAIR', 'BUY', 'SELL', 'PICKUP', 'SMART_EXCHANGE'];
// Backend stores dayOfWeek as a Short (ISO-8601: 1=Mon … 7=Sun, null = any day).
const DAYS = [
  { value: '',  label: 'Any day' },
  { value: 1,   label: 'Monday' },
  { value: 2,   label: 'Tuesday' },
  { value: 3,   label: 'Wednesday' },
  { value: 4,   label: 'Thursday' },
  { value: 5,   label: 'Friday' },
  { value: 6,   label: 'Saturday' },
  { value: 7,   label: 'Sunday' },
];
const DAY_LABEL = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };

export default function DirectoryShopsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  // Shop form fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [rating, setRating] = useState('');
  const [hoursText, setHoursText] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Pasting a Google Maps URL fills both lat/lng. Recognises both
  // "/@11.7451936,79.7591706,94m/" and "?q=11.7451936,79.7591706" formats.
  const extractLatLngFromMapsUrl = (input) => {
    if (!input) return null;
    const at = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) return { lat: at[1], lng: at[2] };
    const q = input.match(/[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (q) return { lat: q[1], lng: q[2] };
    const bare = input.match(/^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/);
    if (bare) return { lat: bare[1], lng: bare[2] };
    return null;
  };

  const handleAddressPaste = (text) => {
    const parsed = extractLatLngFromMapsUrl(text);
    if (parsed) {
      setLatitude(parsed.lat);
      setLongitude(parsed.lng);
      notifySuccess(`Detected coords from URL: ${parsed.lat}, ${parsed.lng}`);
    }
  };

  // Free-text geocode using OpenStreetMap Nominatim (no key required).
  // Set lat/lng + auto-fill city/state/pincode if not yet set.
  const geocodeAddress = async () => {
    const query = [address, city, state, pincode].filter(Boolean).join(', ').trim();
    if (!query) { notifyError('Type an address first, then click Geocode'); return; }
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!res.ok) throw new Error(`Geocoder returned ${res.status}`);
      const data = await res.json();
      if (!data.length) { notifyError(`No match for "${query}". Add more detail or paste coords directly.`); return; }
      const hit = data[0];
      setLatitude(String(Number(hit.lat).toFixed(7)));
      setLongitude(String(Number(hit.lon).toFixed(7)));
      const a = hit.address || {};
      if (!city && (a.city || a.town || a.village)) setCity(a.city || a.town || a.village);
      if (!state && a.state) setState(a.state);
      if (!pincode && a.postcode) setPincode(a.postcode);
    } catch (e) {
      notifyError(e.message || 'Geocoding failed');
    } finally {
      setGeocoding(false);
    }
  };

  // Edit-only sub-data
  const [services, setServices] = useState([]);
  const [newServiceCode, setNewServiceCode] = useState(SERVICE_CODES[0]);
  const [pickupSlots, setPickupSlots] = useState([]);
  const [slotDay, setSlotDay] = useState(1); // 1=Monday
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('18:00');
  const [slotCapacity, setSlotCapacity] = useState('1');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await shopApi.get('/shops');
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
  }, []);

  const loadShopExtras = async (shopId) => {
    try {
      const svc = await shopApi.get(`/shops/${shopId}/services`).catch(() => []);
      setServices(Array.isArray(svc) ? svc : []);
    } catch {
      setServices([]);
    }
    try {
      const slots = await shopApi.get(`/shops/${shopId}/pickup-slots`).catch(() => []);
      setPickupSlots(Array.isArray(slots) ? slots : []);
    } catch {
      setPickupSlots([]);
    }
  };

  const resetForm = () => {
    setName('');
    setSlug('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCity('');
    setState('');
    setPincode('');
    setLatitude('');
    setLongitude('');
    setRating('');
    setHoursText('');
    setHeroImageUrl('');
    setDescription('');
    setIsActive(true);
    setServices([]);
    setPickupSlots([]);
  };

  const openCreate = () => {
    resetForm();
    setModal({ type: 'create' });
  };

  const openEdit = async (item) => {
    setName(item.name || '');
    setSlug(item.slug || '');
    setEmail(item.email || '');
    setPhone(item.phone || '');
    setAddress(item.address || '');
    setCity(item.city || '');
    setState(item.state || '');
    setPincode(item.pincode || '');
    setLatitude(item.latitude != null ? String(item.latitude) : '');
    setLongitude(item.longitude != null ? String(item.longitude) : '');
    setRating(item.rating != null ? String(item.rating) : '');
    setHoursText(item.hoursText || '');
    setHeroImageUrl(item.heroImageUrl || '');
    setDescription(item.description || '');
    setIsActive(item.isActive ?? true);
    setServices([]);
    setPickupSlots([]);
    setModal({ type: 'edit', item });
    loadShopExtras(item.id);
  };

  const closeModal = () => setModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        slug: slug.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        pincode: pincode.trim() || null,
        latitude: latitude !== '' ? parseFloat(latitude) : null,
        longitude: longitude !== '' ? parseFloat(longitude) : null,
        rating: rating !== '' ? parseFloat(rating) : null,
        hoursText: hoursText.trim() || null,
        heroImageUrl: heroImageUrl.trim() || null,
        description: description.trim() || null,
        isActive,
      };
      if (modal.type === 'create') {
        const created = await shopApi.post('/shops', body);
        closeModal();
        await load();
        if (created?.id) openEdit(created);
        return;
      }

      // EDIT: do the full-body PUT for everything except isActive (which we
      // PATCH separately so Jackson's `isActive` binding quirk never bites).
      const id = modal.item.id;
      await shopApi.put(`/shops/${id}`, { ...body, isActive: undefined });
      if (isActive !== modal.item.isActive) {
        await shopApi.patch(`/shops/${id}/status?active=${isActive}`);
      }
      closeModal();
      await load();
      // Toast confirmation so the user knows the save landed.
      notifySuccess(`Saved "${body.name}" ✅`);
    } catch (e) {
      notifyError(e.body?.message || e.body?.error || e.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm('Delete this shop?')) return;
    try {
      await shopApi.delete(`/shops/${row.id}`);
      load();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  // Toggle Active via the dedicated PATCH /shops/{id}/status?active=... endpoint.
  // Why not PUT { isActive }? Lombok generates getIsActive()/setIsActive() for a
  // Boolean field named isActive, but Jackson's BeanIntrospector strips the `is`
  // prefix and looks for an "active" property — so the JSON `isActive` field
  // silently doesn't bind. The dedicated PATCH avoids the DTO entirely.
  const toggleActive = async (row) => {
    try {
      const next = !row.isActive;
      await shopApi.patch(`/shops/${row.id}/status?active=${next}`);
      await load();
    } catch (e) {
      const msg = e.body?.message || e.body?.error || e.message || 'Failed to toggle Active';
      notifyError(`Couldn't toggle "${row.name}": ${msg}`);
      throw e;
    }
  };

  const activateAll = async () => {
    const inactive = list.filter((r) => !r.isActive);
    if (inactive.length === 0) {
      alert('All shops are already active.');
      return;
    }
    if (!confirm(`Activate ${inactive.length} shop(s)?`)) return;
    let ok = 0;
    for (const r of inactive) {
      try {
        await shopApi.patch(`/shops/${r.id}/status?active=true`);
        ok += 1;
      } catch (e) {
        const msg = e.body?.message || e.body?.error || e.message || 'unknown error';
        notifyError(`Stopped after ${ok} of ${inactive.length}. Failed on "${r.name}": ${msg}`);
        await load();
        return;
      }
    }
    await load();
    notifySuccess(`Activated ${ok} shop(s) ✅`);
  };

  const addService = async () => {
    if (!modal?.item?.id) return;
    try {
      await shopApi.post(`/shops/${modal.item.id}/services`, { serviceCode: newServiceCode });
      loadShopExtras(modal.item.id);
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Failed to add service');
    }
  };

  const removeService = async (code) => {
    if (!modal?.item?.id) return;
    try {
      await shopApi.delete(`/shops/${modal.item.id}/services/${code}`);
      loadShopExtras(modal.item.id);
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Failed to remove service');
    }
  };

  const addPickupSlot = async () => {
    if (!modal?.item?.id) return;
    try {
      await shopApi.post(`/shops/${modal.item.id}/pickup-slots`, {
        // Numeric 1-7 (ISO Mon-Sun) or null for "any day". Backend rejects
        // strings like "MONDAY" (its DTO is Short — see Invalid request body
        // error before this fix).
        dayOfWeek: slotDay === '' || slotDay == null ? null : Number(slotDay),
        startTime: slotStart,
        endTime: slotEnd,
        capacity: parseInt(slotCapacity, 10) || 1,
      });
      loadShopExtras(modal.item.id);
    } catch (e) {
      notifyError(e.body?.message || e.body?.error || e.message || 'Failed to add slot');
    }
  };

  const deletePickupSlot = async (slotId) => {
    if (!modal?.item?.id) return;
    try {
      await shopApi.delete(`/shops/${modal.item.id}/pickup-slots/${slotId}`);
      loadShopExtras(modal.item.id);
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Failed to delete slot');
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'slug', label: 'Slug', render: (r) => r.slug || '—' },
    { key: 'city', label: 'City', render: (r) => r.city || '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'rating', label: 'Rating', render: (r) => (r.rating != null ? r.rating : '—') },
    {
      key: 'isActive',
      label: 'Active',
      render: (r) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleActive(r); }}
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
            r.isActive
              ? 'bg-brand-500/15 border-brand-500/40 text-brand-300 hover:bg-brand-500/25'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
          }`}
          title="Click to toggle"
        >
          {r.isActive ? 'Yes · click to disable' : 'No · click to activate'}
        </button>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Shops</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={activateAll}
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            title="Set Active=true on every inactive shop"
          >
            Activate all
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add shop
          </button>
        </div>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        Shop directory (GET /shops). Edit a shop to manage its services and pickup slots.
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
          emptyMessage="No shops."
        />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
          {/* my-auto centres the panel when it fits and lets a taller one scroll from its top, instead of items-center clipping it. */}
          <div className="w-full max-w-3xl rounded-xl bg-admin-card border border-admin-border p-4 sm:p-6 my-auto">
            <h2 className="text-lg font-medium text-slate-900 mb-4">
              {modal.type === 'create' ? 'New shop' : `Edit shop: ${modal.item.name}`}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label className="block text-sm text-admin-muted mb-1">Slug</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">
                  Address <span className="text-admin-muted">· paste a Google Maps URL to auto-fill coords</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onPaste={(e) => {
                    // If the user pastes a Maps URL or "lat,lng" string into
                    // the address field, capture the coords and let the paste
                    // still proceed normally (we don't preventDefault).
                    const text = e.clipboardData?.getData?.('text') || '';
                    handleAddressPaste(text);
                  }}
                  placeholder="No. 1 Bharathi Road, Manjakuppam, Cuddalore (or paste a Google Maps URL)"
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-admin-muted mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm text-admin-muted mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Pincode</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-slate-600">Location coordinates</span>
                <button
                  type="button"
                  onClick={geocodeAddress}
                  disabled={geocoding}
                  className="rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  title="Look up lat/lng from the address fields (uses OpenStreetMap)"
                >
                  {geocoding ? 'Locating…' : '📍 Geocode address'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="11.7480000"
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Rating (1-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Hours text</label>
                <input
                  type="text"
                  value={hoursText}
                  onChange={(e) => setHoursText(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  placeholder="Mon-Sat 10am-8pm"
                />
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Hero image URL</label>
                <input
                  type="text"
                  value={heroImageUrl}
                  onChange={(e) => setHeroImageUrl(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-sm text-admin-muted mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  rows={4}
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
                <button type="button" onClick={closeModal} className="rounded-lg px-4 py-2 text-slate-600 hover:bg-admin-dark">Close</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-admin-accent px-4 py-2 text-white disabled:opacity-50">
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>

            {modal.type === 'edit' && modal.item?.id && (
              <>
                <hr className="my-6 border-admin-border" />
                <section className="space-y-3">
                  <h3 className="text-base font-medium text-slate-900">Services</h3>
                  <div className="flex flex-wrap gap-2">
                    {services.length === 0 ? (
                      <span className="text-admin-muted text-sm">No services attached.</span>
                    ) : (
                      services.map((s) => {
                        const code = typeof s === 'string' ? s : s.serviceCode || s.code;
                        return (
                          <span
                            key={code}
                            className="inline-flex items-center gap-2 rounded-full bg-admin-dark border border-admin-border px-3 py-1 text-xs text-slate-800"
                          >
                            {code}
                            <button
                              type="button"
                              onClick={() => removeService(code)}
                              className="text-red-600 hover:text-red-500"
                              aria-label={`Remove ${code}`}
                            >
                              ×
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      value={newServiceCode}
                      onChange={(e) => setNewServiceCode(e.target.value)}
                      className="min-w-0 max-w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900 text-sm"
                    >
                      {SERVICE_CODES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addService}
                      className="rounded-lg bg-admin-accent px-3 py-2 text-sm text-white hover:bg-blue-700"
                    >
                      Add service
                    </button>
                  </div>
                </section>

                <hr className="my-6 border-admin-border" />
                <section className="space-y-3">
                  <h3 className="text-base font-medium text-slate-900">Pickup slots</h3>
                  {pickupSlots.length === 0 ? (
                    <p className="text-admin-muted text-sm">No pickup slots configured.</p>
                  ) : (
                    <ul className="divide-y divide-admin-border rounded-lg border border-admin-border">
                      {pickupSlots.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-800">
                          <span className="min-w-0">
                            {s.dayOfWeek ? DAY_LABEL[s.dayOfWeek] : 'Any day'} · {s.startTime}–{s.endTime} · cap {s.capacity}
                          </span>
                          <button
                            type="button"
                            onClick={() => deletePickupSlot(s.id)}
                            className="text-red-600 hover:underline text-xs"
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                    <div>
                      <label className="block text-xs text-admin-muted mb-1">Day</label>
                      <select
                        value={slotDay}
                        onChange={(e) => setSlotDay(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full rounded-lg bg-admin-dark border border-admin-border px-2 py-2 text-slate-900 text-sm"
                      >
                        {DAYS.map((d) => (
                          <option key={String(d.value)} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-admin-muted mb-1">Start</label>
                      <input
                        type="time"
                        value={slotStart}
                        onChange={(e) => setSlotStart(e.target.value)}
                        className="w-full rounded-lg bg-admin-dark border border-admin-border px-2 py-2 text-slate-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-admin-muted mb-1">End</label>
                      <input
                        type="time"
                        value={slotEnd}
                        onChange={(e) => setSlotEnd(e.target.value)}
                        className="w-full rounded-lg bg-admin-dark border border-admin-border px-2 py-2 text-slate-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-admin-muted mb-1">Capacity</label>
                      <input
                        type="number"
                        min="1"
                        value={slotCapacity}
                        onChange={(e) => setSlotCapacity(e.target.value)}
                        className="w-full rounded-lg bg-admin-dark border border-admin-border px-2 py-2 text-slate-900 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addPickupSlot}
                    className="rounded-lg bg-admin-accent px-3 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    Add slot
                  </button>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
