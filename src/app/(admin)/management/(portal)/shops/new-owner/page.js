'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, uploadMedia as uploadFile } from '@/lib/api';
import SafeImage from '@/components/SafeImage';
import { notifyError } from '@/lib/toast';

function detectTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'; }
  catch { return 'Asia/Kolkata'; }
}

function getBrowserCoords() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
  });
}

const EMPTY_LOC = {
  name: '', mobile: '', gstNumber: '',
  state: '', district: '', taluk: '', area: '', street: '', pincode: '',
  address: '',
  // latitude/longitude are auto-captured from browser geolocation on submit.
  latitude: '', longitude: '',
  frontImageUrl: '', bannerImageUrl: '', gstCertificateUrl: '', udyamCertificateUrl: '',
  // Shop working hours (admin Edit Business Location form)
  workingDays: 'MON_SAT', openingTime: '', closingTime: '',
};

const WORKING_DAYS_OPTIONS = [
  { value: 'MON_FRI', label: 'Monday – Friday' },
  { value: 'MON_SAT', label: 'Monday – Saturday' },
  { value: 'MON_SUN', label: 'Monday – Sunday' },
];

const EMPTY_OWNER = {
  name: '', email: '',
  phone: '', secondaryMobile: '', password: '', otpCode: '',
  personalAddress: '',
  addrState: '', addrDistrict: '', addrTaluk: '', addrArea: '', addrStreet: '', addrPincode: '',
  // Owner KYC (stored in users.kyc_document jsonb): Aadhar front/back + PAN.
  avatarUrl: '', aadharFrontUrl: '', aadharBackUrl: '', panUrl: '',
};

/**
 * Type-ahead address suggestions via OpenStreetMap Nominatim. Free, no API
 * key, rate-limited to ~1 req/s by their usage policy. The 350 ms debounce
 * in the caller keeps us well under that. For production scale, swap to
 * Google Places Autocomplete.
 *
 * Smart fallback: if the full query returns 0 results (typical when the user
 * prepends a brand name like "Globo Green Cuddalore"), retry with just the
 * last 2 tokens so "Globo Green Cuddalore" still surfaces Cuddalore matches.
 */
async function nominatimSearch(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=in&limit=6`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

function mapNominatimRows(rows) {
  return (rows || []).map((r) => ({
    displayName: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
    street: r.address?.road || r.address?.pedestrian || r.address?.path || '',
    area: r.address?.suburb || r.address?.neighbourhood || r.address?.village || r.address?.town || '',
    taluk: r.address?.county || r.address?.subdistrict || '',
    district: r.address?.state_district || r.address?.county || '',
    state: r.address?.state || '',
    pincode: r.address?.postcode || '',
  }));
}

async function searchAddressSuggestions(query) {
  const q = (query || '').trim();
  if (q.length < 3) return [];
  let rows = await nominatimSearch(q);
  // Fallback: brand-prefixed search ("Globo Green Cuddalore") often has no
  // POI in OSM; retry with just the trailing two tokens so we still surface
  // city / landmark matches.
  if (rows.length === 0) {
    const tokens = q.split(/\s+/);
    if (tokens.length >= 2) {
      const tail = tokens.slice(-2).join(' ');
      if (tail !== q) rows = await nominatimSearch(tail);
    }
  }
  // Final fallback: try only the last token (e.g. just "Cuddalore").
  if (rows.length === 0) {
    const tokens = q.split(/\s+/);
    const last = tokens[tokens.length - 1];
    if (last.length >= 3 && last !== q) rows = await nominatimSearch(last);
  }
  return mapNominatimRows(rows);
}

export default function NewShopOwnerPage() {
  const router = useRouter();

  const [owner, setOwner] = useState({ ...EMPTY_OWNER });
  const [locations, setLocations] = useState([{ ...EMPTY_LOC }]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState({});
  const [autoCoords, setAutoCoords] = useState(null); // { latitude, longitude } from browser
  const [locatingIdx, setLocatingIdx] = useState(null); // index currently fetching geolocation
  const [suggestions, setSuggestions] = useState({}); // idx -> list (or [])
  const [searched, setSearched]       = useState({}); // idx -> bool (any search completed)
  const [searching, setSearching]     = useState({}); // idx -> bool (in flight)
  const searchTimers = useRef({});

  const onShopNameChange = (i, value) => {
    setLocationField(i, 'name', value);
    if (searchTimers.current[i]) clearTimeout(searchTimers.current[i]);
    if (!value || value.trim().length < 3) {
      setSuggestions((s) => ({ ...s, [i]: [] }));
      setSearched((s) => ({ ...s, [i]: false }));
      return;
    }
    setSearching((s) => ({ ...s, [i]: true }));
    searchTimers.current[i] = setTimeout(async () => {
      const list = await searchAddressSuggestions(value);
      setSuggestions((s) => ({ ...s, [i]: list }));
      setSearched((s) => ({ ...s, [i]: true }));
      setSearching((s) => ({ ...s, [i]: false }));
    }, 350);
  };

  const dismissSuggestions = (i) => {
    setSuggestions((s) => ({ ...s, [i]: [] }));
    setSearched((s) => ({ ...s, [i]: false }));
  };

  // Wipe all address fields (keep name/mobile/GST/business proofs intact).
  // Used when Nominatim filled the wrong pincode/area and the user wants to
  // start over rather than fix each field manually.
  const clearAddressFields = (i) => {
    setLocations((arr) => arr.map((loc, idx) => idx === i ? {
      ...loc,
      street: '', area: '', taluk: '', district: '', state: '', pincode: '',
      address: '', latitude: '', longitude: '',
    } : loc));
  };

  const applySuggestion = (i, sug) => {
    setLocations((arr) => arr.map((loc, idx) => idx === i ? {
      ...loc,
      // Don't clobber a name the user already typed unless the matching field is empty.
      street:   loc.street   || sug.street   || loc.street,
      area:     loc.area     || sug.area     || loc.area,
      taluk:    loc.taluk    || sug.taluk    || loc.taluk,
      district: loc.district || sug.district || loc.district,
      state:    loc.state    || sug.state    || loc.state,
      pincode:  loc.pincode  || sug.pincode  || loc.pincode,
      latitude:  String(sug.lat),
      longitude: String(sug.lng),
    } : loc));
    setSuggestions((s) => ({ ...s, [i]: [] }));
  };

  // Capture browser geolocation once on mount; we'll attach it to every new
  // location on submit if the user hasn't entered their own. Silently no-ops
  // if the user denies permission or the browser can't fetch a fix.
  useEffect(() => {
    let cancelled = false;
    getBrowserCoords().then((c) => { if (!cancelled && c) setAutoCoords(c); });
    return () => { cancelled = true; };
  }, []);

  // On-demand geolocation fetch for a specific shop card. Returns an object
  // with the typed error reason so the UI can give targeted guidance instead
  // of a generic message.
  const fetchLocationForShop = async (i) => {
    setLocatingIdx(i);
    try {
      const result = await new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          return resolve({ ok: false, reason: 'unsupported' });
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ ok: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => {
            const reason = err.code === 1 ? 'denied' : err.code === 2 ? 'unavailable' : err.code === 3 ? 'timeout' : 'unknown';
            resolve({ ok: false, reason });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
      });
      if (result.ok) {
        setLocationField(i, 'latitude', String(result.latitude));
        setLocationField(i, 'longitude', String(result.longitude));
        setAutoCoords({ latitude: result.latitude, longitude: result.longitude });
      } else {
        const msg = {
          denied:      'Location permission was blocked. In Chrome: click the lock/info icon left of the URL → Site settings → set Location to Allow → reload. Or paste coords manually using the 🗺 Find on Google Maps link.',
          unavailable: 'Browser could not determine your location (no GPS/network signal). Use the 🗺 Find on Google Maps link to look up coords manually.',
          timeout:     'Location lookup timed out. Try again with a stronger signal, or paste coords via 🗺 Find on Google Maps.',
          unsupported: 'This browser does not support geolocation. Paste coords manually.',
          unknown:     'Could not get your current location. Use the 🗺 Find on Google Maps link to look up coords manually.',
        }[result.reason] || 'Could not get your current location.';
        notifyError(msg);
      }
    } finally {
      setLocatingIdx(null);
    }
  };

  // Build a Google Maps search URL from whatever address parts are filled in,
  // so the admin can right-click the dropped pin to read off coords.
  const mapsSearchUrl = (loc) => {
    const parts = [loc.name, loc.street, loc.area, loc.taluk, loc.district, loc.state, loc.pincode].filter(Boolean);
    const q = encodeURIComponent(parts.join(', ') || 'India');
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  };

  const setOwnerField = (k, v) => setOwner((o) => ({ ...o, [k]: v }));
  const setLocationField = (i, k, v) =>
    setLocations((arr) => arr.map((loc, idx) => (idx === i ? { ...loc, [k]: v } : loc)));

  const handleOwnerUpload = async (field, file, folder, opts) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [`owner-${field}`]: true }));
    try {
      const url = await uploadFile(file, folder, opts);
      if (url) setOwnerField(field, url);
    } catch (e) { notifyError(e.message || 'Upload failed'); }
    finally { setUploading((u) => ({ ...u, [`owner-${field}`]: false })); }
  };
  const handleLocationUpload = async (i, field, file, folder, opts) => {
    if (!file) return;
    const key = `loc${i}-${field}`;
    setUploading((u) => ({ ...u, [key]: true }));
    try {
      const url = await uploadFile(file, folder, opts);
      if (url) setLocationField(i, field, url);
    } catch (e) { notifyError(e.message || 'Upload failed'); }
    finally { setUploading((u) => ({ ...u, [key]: false })); }
  };

  const addLocation = () => setLocations((arr) => [...arr, { ...EMPTY_LOC }]);
  const removeLocation = (i) => setLocations((arr) => arr.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!owner.name.trim() || !owner.email.trim() || !owner.password.trim()) {
      notifyError('Owner name, email and password are required');
      return;
    }
    if (!locations.length || !locations[0].name.trim()) {
      notifyError('At least one shop location with a name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: owner.name.trim(),
        email: owner.email.trim(),
        password: owner.password,
        phone: owner.phone.trim() || undefined,
        secondaryMobile: owner.secondaryMobile.trim() || undefined,
        personalAddress: owner.personalAddress.trim() || undefined,
        addrState: owner.addrState.trim() || undefined,
        addrDistrict: owner.addrDistrict.trim() || undefined,
        addrTaluk: owner.addrTaluk.trim() || undefined,
        addrArea: owner.addrArea.trim() || undefined,
        addrStreet: owner.addrStreet.trim() || undefined,
        addrPincode: owner.addrPincode.trim() || undefined,
        avatarUrl: owner.avatarUrl || undefined,
        aadharFrontUrl: owner.aadharFrontUrl || undefined,
        aadharBackUrl: owner.aadharBackUrl || undefined,
        panUrl: owner.panUrl || undefined,
        otpCode: owner.otpCode.trim() || undefined,
        locations: locations.map((l) => ({
          name: l.name.trim(),
          mobile: l.mobile.trim() || undefined,
          gstNumber: l.gstNumber.trim() || undefined,
          state: l.state.trim() || undefined,
          district: l.district.trim() || undefined,
          taluk: l.taluk.trim() || undefined,
          area: l.area.trim() || undefined,
          street: l.street.trim() || undefined,
          pincode: l.pincode.trim() || undefined,
          address: l.address.trim() || undefined,
          // Manual entry wins; otherwise fall back to auto-captured browser coords.
          latitude: (l.latitude !== '' && l.latitude != null) ? Number(l.latitude) : autoCoords?.latitude,
          longitude: (l.longitude !== '' && l.longitude != null) ? Number(l.longitude) : autoCoords?.longitude,
          timezone: detectTimezone(),
          frontImageUrl: l.frontImageUrl || undefined,
          bannerImageUrl: l.bannerImageUrl || undefined,
          gstCertificateUrl: l.gstCertificateUrl || undefined,
          udyamCertificateUrl: l.udyamCertificateUrl || undefined,
          workingDays: l.workingDays || undefined,
          openingTime: l.openingTime?.trim() || undefined,
          closingTime: l.closingTime?.trim() || undefined,
        })),
      };
      await authApi.post('/auth/shop-owner', payload);
      router.push('/management/shops');
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 pb-24 sm:p-6 sm:pb-24 md:p-8 md:pb-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Create Shop Owner</h1>
          <p className="text-sm text-admin-muted">
            Create the shop owner account, then continue with one or more business locations in the same workspace.
          </p>
        </div>
        <Link href="/management/shops" className="text-sm text-admin-muted hover:text-slate-800">← Back to shops</Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Basic Information */}
          <div className="lg:col-span-2 rounded-xl bg-admin-card border border-admin-border p-5">
            <SectionHeader icon="👤" title="Basic Information" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <Field label="FULL NAME *">
                <input value={owner.name} onChange={(e) => setOwnerField('name', e.target.value)} className="input" placeholder="Full Name" required />
              </Field>
              <Field label="EMAIL ADDRESS *">
                <input type="email" value={owner.email} onChange={(e) => setOwnerField('email', e.target.value)} className="input" placeholder="Email Address" required />
              </Field>
              <Field label="PRIMARY MOBILE *">
                <input value={owner.phone} onChange={(e) => setOwnerField('phone', e.target.value)} className="input" placeholder="Primary Mobile" />
              </Field>
              <Field label="SECONDARY MOBILE">
                <input value={owner.secondaryMobile} onChange={(e) => setOwnerField('secondaryMobile', e.target.value)} className="input" placeholder="Secondary Mobile" />
              </Field>
              <Field label="PASSWORD *">
                <input type="password" value={owner.password} onChange={(e) => setOwnerField('password', e.target.value)} className="input" placeholder="Min 6 chars" required />
              </Field>
              <Field label="OTP CODE (optional)" hint="Defaults to 123456">
                <input value={owner.otpCode} onChange={(e) => setOwnerField('otpCode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="input" placeholder="6-digit" />
              </Field>
            </div>

            <div className="mt-5">
              <SectionHeader icon="🔍" title="Personal Address" small />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <Field label="STATE *">
                  <input value={owner.addrState} onChange={(e) => setOwnerField('addrState', e.target.value)} className="input" placeholder="Select or type state" />
                </Field>
                <Field label="DISTRICT *">
                  <input value={owner.addrDistrict} onChange={(e) => setOwnerField('addrDistrict', e.target.value)} className="input" placeholder="Select or type district" />
                </Field>
                <Field label="TALUK *">
                  <input value={owner.addrTaluk} onChange={(e) => setOwnerField('addrTaluk', e.target.value)} className="input" placeholder="Select or type taluk" />
                </Field>
                <Field label="AREA *">
                  <input value={owner.addrArea} onChange={(e) => setOwnerField('addrArea', e.target.value)} className="input" placeholder="Select or type area" />
                </Field>
                <Field label="STREET *">
                  <input value={owner.addrStreet} onChange={(e) => setOwnerField('addrStreet', e.target.value)} className="input" placeholder="Street" />
                </Field>
                <Field label="PINCODE *">
                  <input value={owner.addrPincode} onChange={(e) => setOwnerField('addrPincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="input" placeholder="Pincode" />
                </Field>
                <Field label="ADDRESS NOTE" full>
                  <textarea value={owner.personalAddress} onChange={(e) => setOwnerField('personalAddress', e.target.value)} className="input min-h-[60px]" placeholder="Optional free-text note (landmark, instructions…)" />
                </Field>
              </div>
            </div>
          </div>

          {/* Profile & Documents */}
          <div className="rounded-xl bg-admin-card border border-admin-border p-5">
            <SectionHeader icon="📇" title="Personal Profile & Documents" />
            <p className="text-[11px] text-admin-muted mt-1">Owner KYC — Aadhar (front &amp; back) and PAN card.</p>
            <div className="mt-3 space-y-3">
              <UploadCard
                label="Avatar"
                hint="Profile image"
                url={owner.avatarUrl}
                uploading={!!uploading['owner-avatarUrl']}
                onFile={(f) => handleOwnerUpload('avatarUrl', f, 'owners/avatars')}
                accept="image/*"
                buttonText="Upload Avatar"
              />
              <UploadCard
                label="Aadhar Card Front"
                hint="PDF or image"
                url={owner.aadharFrontUrl}
                uploading={!!uploading['owner-aadharFrontUrl']}
                onFile={(f) => handleOwnerUpload('aadharFrontUrl', f, 'owners/kyc', { document: true })}
                accept="image/*,application/pdf"
                buttonText="Upload Aadhar Front"
              />
              <UploadCard
                label="Aadhar Card Back"
                hint="PDF or image"
                url={owner.aadharBackUrl}
                uploading={!!uploading['owner-aadharBackUrl']}
                onFile={(f) => handleOwnerUpload('aadharBackUrl', f, 'owners/kyc', { document: true })}
                accept="image/*,application/pdf"
                buttonText="Upload Aadhar Back"
              />
              <UploadCard
                label="PAN Card"
                hint="PDF or image"
                url={owner.panUrl}
                uploading={!!uploading['owner-panUrl']}
                onFile={(f) => handleOwnerUpload('panUrl', f, 'owners/kyc', { document: true })}
                accept="image/*,application/pdf"
                buttonText="Upload PAN Card"
              />
            </div>
          </div>
        </div>

        {/* Business Locations */}
        <div className="rounded-xl bg-admin-card border border-admin-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <SectionHeader icon="🏪" title="Business Locations" inline />
            <button type="button" onClick={addLocation} className="rounded-lg bg-admin-accent text-white text-xs px-3 py-1.5 hover:bg-blue-700">
              + Add another shop
            </button>
          </div>

          <div className="space-y-4">
            {locations.map((loc, i) => (
              <div key={i} className="rounded-lg border border-admin-border p-4 bg-admin-dark/40">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-slate-800">New Business Location {locations.length > 1 ? `#${i + 1}` : ''}</h3>
                  {locations.length > 1 && (
                    <button type="button" onClick={() => removeLocation(i)} className="text-admin-muted hover:text-red-600 text-lg leading-none">×</button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Field label="SHOP / LOCATION NAME *">
                    <div className="relative">
                      <input
                        value={loc.name}
                        onChange={(e) => onShopNameChange(i, e.target.value)}
                        className="input pr-7"
                        placeholder="Type shop name or address (e.g. Globo Green Cuddalore)"
                        autoComplete="off"
                        required
                      />
                      {searching[i] ? (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-admin-muted text-[10px]">⏳</span>
                      ) : null}
                      {(Array.isArray(suggestions[i]) && suggestions[i].length > 0) || (searched[i] && !searching[i]) ? (
                        <div className="absolute z-30 mt-1 left-0 right-0 bg-admin-card border border-admin-border rounded-lg shadow-xl max-h-64 overflow-auto">
                          {(suggestions[i] || []).length > 0 ? (
                            <>
                              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-admin-muted bg-admin-dark/40 border-b border-admin-border">
                                ⚠ Verify pincode before picking — OSM data isn&apos;t always current
                              </div>
                              {suggestions[i].map((sug, k) => (
                                <button
                                  type="button"
                                  key={k}
                                  onClick={() => applySuggestion(i, sug)}
                                  className="block w-full text-left px-3 py-2 text-xs text-slate-800 hover:bg-admin-dark border-b border-admin-border last:border-b-0"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="font-medium truncate flex-1">{sug.displayName}</div>
                                    {sug.pincode ? (
                                      <span className="shrink-0 inline-flex items-center rounded bg-admin-accent/15 text-admin-accent px-1.5 py-0.5 text-[10px] font-mono font-bold">
                                        {sug.pincode}
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="text-admin-muted text-[10px] mt-0.5">
                                    📍 {sug.lat.toFixed(4)}, {sug.lng.toFixed(4)}
                                    {sug.area ? ` · ${sug.area}` : ''}
                                    {sug.district ? ` · ${sug.district}` : ''}
                                  </div>
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => dismissSuggestions(i)}
                                className="block w-full text-center px-3 py-1.5 text-[10px] text-admin-muted hover:bg-admin-dark bg-admin-dark/40"
                              >
                                Dismiss
                              </button>
                            </>
                          ) : (
                            <div className="px-3 py-3 text-xs text-admin-muted">
                              <div className="font-medium text-slate-600">No matches found</div>
                              <div className="mt-1 text-[11px]">
                                Try just the area or pincode (e.g. <span className="text-slate-800">Cuddalore</span> or <span className="text-slate-800">607002</span>), or use <span className="text-slate-800">🗺 Find on Google Maps</span> below.
                              </div>
                              <button
                                type="button"
                                onClick={() => dismissSuggestions(i)}
                                className="mt-2 text-[10px] text-admin-accent hover:underline"
                              >
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-admin-muted mt-1">
                      Type 3+ characters to search OpenStreetMap. Picking a result auto-fills street/area/district/state/pincode + lat/lng.
                    </p>
                  </Field>
                  <Field label="MOBILE *">
                    <input value={loc.mobile} onChange={(e) => setLocationField(i, 'mobile', e.target.value)} className="input" placeholder="Mobile" required />
                  </Field>
                  <Field label="GST NUMBER">
                    <input value={loc.gstNumber} onChange={(e) => setLocationField(i, 'gstNumber', e.target.value.toUpperCase())} className="input" placeholder="GST Number" />
                  </Field>
                  <Field label="PINCODE *">
                    <input value={loc.pincode} onChange={(e) => setLocationField(i, 'pincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="input" placeholder="Pincode" required />
                  </Field>

                  <Field label="STATE *">
                    <input value={loc.state} onChange={(e) => setLocationField(i, 'state', e.target.value)} className="input" placeholder="State" required />
                  </Field>
                  <Field label="DISTRICT *">
                    <input value={loc.district} onChange={(e) => setLocationField(i, 'district', e.target.value)} className="input" placeholder="District" required />
                  </Field>
                  <Field label="TALUK *">
                    <input value={loc.taluk} onChange={(e) => setLocationField(i, 'taluk', e.target.value)} className="input" placeholder="Taluk" required />
                  </Field>
                  <Field label="AREA *">
                    <input value={loc.area} onChange={(e) => setLocationField(i, 'area', e.target.value)} className="input" placeholder="Area" required />
                  </Field>

                  <Field label="STREET *">
                    <input value={loc.street} onChange={(e) => setLocationField(i, 'street', e.target.value)} className="input" placeholder="Street" required />
                  </Field>
                  <Field label="ADDRESS LINE">
                    <input value={loc.address} onChange={(e) => setLocationField(i, 'address', e.target.value)} className="input" placeholder="Building / landmark" />
                  </Field>
                  <Field label="LATITUDE">
                    <input
                      type="number" step="any"
                      value={loc.latitude}
                      onChange={(e) => setLocationField(i, 'latitude', e.target.value)}
                      className="input"
                      placeholder={autoCoords ? autoCoords.latitude.toFixed(6) : 'e.g. 13.0776'}
                    />
                  </Field>
                  <Field label="LONGITUDE">
                    <input
                      type="number" step="any"
                      value={loc.longitude}
                      onChange={(e) => setLocationField(i, 'longitude', e.target.value)}
                      className="input"
                      placeholder={autoCoords ? autoCoords.longitude.toFixed(6) : 'e.g. 80.2917'}
                    />
                  </Field>

                  <Field label="WORKING DAYS">
                    <select
                      value={loc.workingDays || ''}
                      onChange={(e) => setLocationField(i, 'workingDays', e.target.value)}
                      className="input"
                    >
                      {WORKING_DAYS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="OPENING TIME">
                    <input
                      value={loc.openingTime || ''}
                      onChange={(e) => setLocationField(i, 'openingTime', e.target.value)}
                      className="input"
                      placeholder="08:00 AM"
                    />
                  </Field>
                  <Field label="CLOSING TIME">
                    <input
                      value={loc.closingTime || ''}
                      onChange={(e) => setLocationField(i, 'closingTime', e.target.value)}
                      className="input"
                      placeholder="07:00 PM"
                    />
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                  <p className="text-[10px] text-admin-muted flex-1 min-w-[200px]">
                    📍 Latitude / Longitude lets customers within the pickup radius see this shop.
                    Click <span className="text-slate-800 font-semibold">Get Current Location</span> at the shop, or use <span className="text-slate-800 font-semibold">Find on Google Maps</span> to right-click a pin and read off coords.
                    · Timezone: <span className="font-mono">{detectTimezone()}</span>
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => clearAddressFields(i)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-dark px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-admin-card whitespace-nowrap"
                      title="Wipe street/area/taluk/district/state/pincode/lat/lng"
                    >
                      ✕ Clear Address
                    </button>
                    <a
                      href={mapsSearchUrl(loc)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-dark px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-admin-card whitespace-nowrap"
                    >
                      🗺 Find on Google Maps
                    </a>
                    <button
                      type="button"
                      onClick={() => fetchLocationForShop(i)}
                      disabled={locatingIdx === i}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-admin-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
                    >
                      {locatingIdx === i ? (
                        <>
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          </svg>
                          Locating…
                        </>
                      ) : (
                        <>📍 Get Current Location</>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-admin-border">
                  <p className="text-sm font-semibold text-slate-800">Shop Photos & Documents</p>
                  <p className="text-xs text-admin-muted mb-3">Shop front + banner/visiting card are required; GST &amp; Udyam are optional proofs.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <UploadCard
                      label="Shop Front View *"
                      hint="Photo of the shop front"
                      url={loc.frontImageUrl}
                      uploading={!!uploading[`loc${i}-frontImageUrl`]}
                      onFile={(f) => handleLocationUpload(i, 'frontImageUrl', f, 'shops/front')}
                      accept="image/*"
                      buttonText="Upload Front Image"
                    />
                    <UploadCard
                      label="Shop Banner / Visiting Card *"
                      hint="Banner board or visiting card"
                      url={loc.bannerImageUrl}
                      uploading={!!uploading[`loc${i}-bannerImageUrl`]}
                      onFile={(f) => handleLocationUpload(i, 'bannerImageUrl', f, 'shops/banner')}
                      accept="image/*"
                      buttonText="Upload Banner"
                    />
                    <UploadCard
                      label="GST Certificate"
                      hint="PDF or image"
                      url={loc.gstCertificateUrl}
                      uploading={!!uploading[`loc${i}-gstCertificateUrl`]}
                      onFile={(f) => handleLocationUpload(i, 'gstCertificateUrl', f, 'shops/gst', { document: true })}
                      accept="image/*,application/pdf"
                      buttonText="Upload GST Proof"
                    />
                    <UploadCard
                      label="Udyam Certificate"
                      hint="PDF or image"
                      url={loc.udyamCertificateUrl}
                      uploading={!!uploading[`loc${i}-udyamCertificateUrl`]}
                      onFile={(f) => handleLocationUpload(i, 'udyamCertificateUrl', f, 'shops/udyam', { document: true })}
                      accept="image/*,application/pdf"
                      buttonText="Upload Udyam Proof"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 sticky bottom-4 bg-admin-card border border-admin-border rounded-xl p-3">
          <Link href="/management/shops" className="rounded-lg border border-admin-border px-4 py-2 text-sm text-slate-800 hover:bg-admin-dark">
            ← Cancel
          </Link>
          <button type="submit" disabled={submitting} className="rounded-lg bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Saving…' : '💾 Save Shop Owner Details'}
          </button>
        </div>
      </form>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.5rem;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.75rem;
          color: #0f172a;
          font-size: 0.875rem;
        }
        :global(.input::placeholder) { color: #94a3b8; }
        :global(.input:focus) { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2); }
      `}</style>
    </div>
  );
}

function SectionHeader({ icon, title, small, inline }) {
  return (
    <div className={`flex items-center gap-2 ${inline ? '' : ''}`}>
      <span className="text-lg">{icon}</span>
      <h2 className={`${small ? 'text-sm' : 'text-base'} font-semibold text-slate-900`}>{title}</h2>
    </div>
  );
}

function Field({ label, hint, children, full }) {
  return (
    <div className={full ? 'md:col-span-2 md:col-end-[-1]' : ''}>
      <label className="block text-[10px] uppercase tracking-wider text-admin-muted mb-1 font-medium">{label}</label>
      {children}
      {hint ? <p className="text-[10px] text-admin-muted mt-1">{hint}</p> : null}
    </div>
  );
}

function UploadCard({ label, hint, url, uploading, onFile, accept, buttonText }) {
  const isImg = url && (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url) || url.startsWith('data:image'));
  return (
    <div className="rounded-lg border border-admin-border bg-admin-dark/40 p-3 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-800">{label}</span>
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-[10px] text-sky-400 hover:underline">Open</a>}
      </div>
      <span className="text-[10px] text-admin-muted mb-2">{hint}</span>
      <div className="flex-1 flex items-center justify-center min-h-[80px] rounded bg-admin-dark/60">
        {url ? (
          isImg ? (
            <SafeImage
              src={url}
              alt={label}
              className="max-h-20 max-w-full object-contain"
              placeholderClassName="text-[11px] text-admin-muted italic px-2 text-center"
              placeholderText="Image unavailable"
            />
          ) : (
            <span className="text-[11px] text-slate-600 truncate max-w-full px-2">{url.split('/').pop() || 'File'}</span>
          )
        ) : (
          <span className="text-xs text-admin-muted">{uploading ? 'Uploading…' : 'No file'}</span>
        )}
      </div>
      <label className="mt-2 w-full text-center rounded-md bg-admin-accent text-white text-xs py-1.5 cursor-pointer hover:bg-blue-700">
        {uploading ? 'Uploading…' : (url ? `Replace ${label}` : buttonText)}
        <input type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} disabled={uploading} />
      </label>
    </div>
  );
}
