'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Navigation, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import SafeImage from '@/components/SafeImage';
import { uploadShopLocationMedia } from '@/lib/shopLocations';
import { notifyError } from '@/lib/toast';

/**
 * Add/Edit form for one business location — ported from the admin's
 * LocationModal (Client/src/components/BusinessLocationsManager.js), same
 * fields and the same geocoding/geolocation/upload behaviour, restyled to
 * the shop-dashboard's own palette and signed with the owner's own token
 * (uploadShopLocationMedia) instead of admin_token.
 */

const EMPTY_LOC = {
  name: '', mobile: '', gstNumber: '', state: '', district: '',
  taluk: '', area: '', street: '', pincode: '',
  address: '',
  latitude: '', longitude: '',
  frontImageUrl: '', bannerImageUrl: '', gstCertificateUrl: '', udyamCertificateUrl: '',
  workingDays: 'MON_SAT', openingTime: '', closingTime: '',
};

const WORKING_DAYS_OPTIONS = [
  { value: 'MON_FRI', label: 'Monday – Friday' },
  { value: 'MON_SAT', label: 'Monday – Saturday' },
  { value: 'MON_SUN', label: 'Monday – Sunday' },
];

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';
const INPUT_CLS =
  'w-full rounded-xl border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#98A2B3] transition focus:border-[#024A57] focus:outline-none focus:ring-[3px] focus:ring-[#ECECEC]';

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

function isImageUrl(u) {
  return !!u && (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(u) || u.startsWith('data:image'));
}

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
  if (rows.length === 0) {
    const tokens = q.split(/\s+/);
    if (tokens.length >= 2) {
      const tail = tokens.slice(-2).join(' ');
      if (tail !== q) rows = await nominatimSearch(tail);
    }
  }
  if (rows.length === 0) {
    const tokens = q.split(/\s+/);
    const last = tokens[tokens.length - 1];
    if (last.length >= 3 && last !== q) rows = await nominatimSearch(last);
  }
  return mapNominatimRows(rows);
}

function FormField({ label, required, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#666666]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function UploadCard({ label, hint, url, uploading, onFile, accept }) {
  return (
    <div className="flex min-h-[150px] flex-col items-center rounded-xl border border-dashed border-[#D0D5DD] bg-[#F8F8F8] p-3">
      <div className="mb-1 flex w-full items-center justify-between">
        <span className="text-xs font-semibold text-[#111111]">{label}</span>
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#024A57] hover:underline">Open</a>}
      </div>
      <span className="mb-2 w-full text-[11px] text-[#666666]">{hint}</span>
      <div className="flex flex-1 w-full items-center justify-center">
        {url ? (
          isImageUrl(url) ? (
            <SafeImage
              src={url}
              alt={label}
              className="max-h-20 rounded object-contain"
              placeholderClassName="px-2 text-center text-[11px] italic text-[#98A2B3]"
              placeholderText="Image unavailable"
            />
          ) : (
            <span className="max-w-full truncate text-[11px] text-[#475467]">{url.split('/').pop() || 'File'}</span>
          )
        ) : (
          <span className="text-xs text-[#98A2B3]">{uploading ? 'Uploading…' : 'No file'}</span>
        )}
      </div>
      <label className={cx('mt-2 w-full cursor-pointer rounded-lg bg-[#F3BF23] text-[#1E1E1E] hover:bg-[#E5B11A] py-1.5 text-center text-xs font-semibold transition', uploading && 'opacity-60')}>
        {url ? `Replace ${label}` : `Upload ${label}`}
        <input type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} disabled={uploading} />
      </label>
    </div>
  );
}

export default function LocationFormModal({ ownerId, mode, initial, onClose, onSaved, submit: submitFn }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_LOC, ...initial, latitude: initial?.latitude ?? '', longitude: initial?.longitude ?? '' }));
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState({});
  const [autoCoords, setAutoCoords] = useState(null);
  const [locating, setLocating] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);
  const isEdit = mode === 'edit';

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onNameChange = (value) => {
    setField('name', value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value || value.trim().length < 3) { setSuggestions([]); setSearched(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const list = await searchAddressSuggestions(value);
      setSuggestions(list);
      setSearched(true);
      setSearching(false);
    }, 350);
  };

  const dismissSuggestions = () => { setSuggestions([]); setSearched(false); };

  const clearAddressFields = () => {
    setForm((f) => ({
      ...f,
      street: '', area: '', taluk: '', district: '', state: '', pincode: '',
      address: '', latitude: '', longitude: '',
    }));
  };

  const applySuggestion = (sug) => {
    setForm((f) => ({
      ...f,
      street: f.street || sug.street || f.street,
      area: f.area || sug.area || f.area,
      taluk: f.taluk || sug.taluk || f.taluk,
      district: f.district || sug.district || f.district,
      state: f.state || sug.state || f.state,
      pincode: f.pincode || sug.pincode || f.pincode,
      latitude: String(sug.lat),
      longitude: String(sug.lng),
    }));
    setSuggestions([]);
  };

  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    getBrowserCoords().then((c) => { if (!cancelled && c) setAutoCoords(c); });
    return () => { cancelled = true; };
  }, [isEdit]);

  const fetchLocationNow = async () => {
    setLocating(true);
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
        setField('latitude', String(result.latitude));
        setField('longitude', String(result.longitude));
        setAutoCoords({ latitude: result.latitude, longitude: result.longitude });
      } else {
        const msg = {
          denied: 'Location permission was blocked. Allow location access for this site in your browser settings, or paste coordinates manually using Find on Google Maps.',
          unavailable: 'Your browser could not determine your location. Use Find on Google Maps to look up coordinates manually.',
          timeout: 'Location lookup timed out. Try again, or use Find on Google Maps.',
          unsupported: 'This browser does not support location lookup. Paste coordinates manually.',
          unknown: 'Could not get your current location. Use Find on Google Maps to look up coordinates manually.',
        }[result.reason] || 'Could not get your current location.';
        notifyError(msg);
      }
    } finally {
      setLocating(false);
    }
  };

  const mapsSearchUrl = () => {
    const parts = [form.name, form.street, form.area, form.taluk, form.district, form.state, form.pincode].filter(Boolean);
    const q = encodeURIComponent(parts.join(', ') || 'India');
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  };

  const handleUpload = async (field, file, folder, opts) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [field]: true }));
    try {
      const url = await uploadShopLocationMedia(file, folder, opts);
      if (url) setField(field, url);
    } catch (e) {
      notifyError(e, 'Upload failed');
    } finally {
      setUploading((u) => ({ ...u, [field]: false }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { notifyError('Shop / Location Name is required'); return; }
    if (!form.mobile.trim()) { notifyError('Mobile number is required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        latitude: form.latitude !== '' && form.latitude != null
          ? Number(form.latitude)
          : (isEdit ? undefined : autoCoords?.latitude),
        longitude: form.longitude !== '' && form.longitude != null
          ? Number(form.longitude)
          : (isEdit ? undefined : autoCoords?.longitude),
        timezone: detectTimezone(),
      };
      await submitFn(payload, { isEdit, ownerId, locationId: initial?.id });
      onSaved();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#101828]/60 p-4">
      <form onSubmit={submit} className="my-auto w-full max-w-4xl rounded-3xl sm:my-8 bg-white shadow-[0_20px_60px_rgba(16,24,40,0.25)]">
        <div className="flex items-center justify-between border-b border-[#ECECEC] px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-bold text-[#111111]">{isEdit ? 'Edit Business Location' : 'Add Business Location'}</h3>
            <p className="text-xs text-[#666666]">Shop information and proof documents for this location.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cx('rounded-full p-1.5 text-[#666666] transition hover:bg-[#F8F8F8] hover:text-[#111111]', FOCUS_RING)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[70dvh] overflow-y-auto p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-2">
              <FormField label="Shop / Location Name" required>
                <input value={form.name} onChange={(e) => onNameChange(e.target.value)} className={INPUT_CLS} placeholder="Type shop name or address" autoComplete="off" required />
              </FormField>
              {searching || suggestions.length > 0 || (searched && !searching) ? (
                <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-[#ECECEC] bg-white shadow-[0_8px_24px_rgba(16,24,40,0.15)]">
                  {suggestions.length > 0 ? (
                    <>
                      <div className="border-b border-[#ECECEC] bg-[#F8F8F8] px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#666666]">
                        Verify pincode before picking — map data isn&apos;t always current
                      </div>
                      {suggestions.map((sug, k) => (
                        <button
                          type="button"
                          key={k}
                          onClick={() => applySuggestion(sug)}
                          className="block w-full border-b border-[#ECECEC] px-3 py-2 text-left text-xs text-[#344054] last:border-b-0 hover:bg-[#F8F8F8]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 truncate font-medium">{sug.displayName}</div>
                            {sug.pincode ? (
                              <span className="shrink-0 rounded bg-[#F3F3F3] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#024A57]">{sug.pincode}</span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-[10px] text-[#666666]">
                            {sug.lat.toFixed(4)}, {sug.lng.toFixed(4)}
                            {sug.area ? ` · ${sug.area}` : ''}
                            {sug.district ? ` · ${sug.district}` : ''}
                          </div>
                        </button>
                      ))}
                      <button type="button" onClick={dismissSuggestions} className="block w-full bg-[#F8F8F8] px-3 py-1.5 text-center text-[10px] text-[#666666] hover:bg-[#F8F8F8]">
                        Dismiss
                      </button>
                    </>
                  ) : searching ? (
                    <div className="px-3 py-3 text-xs text-[#666666]">Searching…</div>
                  ) : (
                    <div className="px-3 py-3 text-xs text-[#666666]">
                      <div className="font-medium text-[#344054]">No matches found</div>
                      <div className="mt-1 text-[11px]">Try just the area or pincode, or use Find on Google Maps below.</div>
                      <button type="button" onClick={dismissSuggestions} className="mt-2 text-[10px] font-semibold text-[#024A57] hover:underline">Dismiss</button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <FormField label="Mobile" required>
              <input value={form.mobile} onChange={(e) => setField('mobile', e.target.value)} className={INPUT_CLS} placeholder="+91 …" required />
            </FormField>
            <FormField label="GST Number">
              <input value={form.gstNumber} onChange={(e) => setField('gstNumber', e.target.value.toUpperCase())} className={INPUT_CLS} placeholder="22AAAAA0000A1Z5" />
            </FormField>

            <FormField label="Pincode" required>
              <input value={form.pincode} onChange={(e) => setField('pincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className={INPUT_CLS} required />
            </FormField>
            <FormField label="State" required>
              <input value={form.state} onChange={(e) => setField('state', e.target.value)} className={INPUT_CLS} required />
            </FormField>
            <FormField label="District" required>
              <input value={form.district} onChange={(e) => setField('district', e.target.value)} className={INPUT_CLS} required />
            </FormField>
            <FormField label="Taluk" required>
              <input value={form.taluk} onChange={(e) => setField('taluk', e.target.value)} className={INPUT_CLS} required />
            </FormField>

            <FormField label="Area" required>
              <input value={form.area} onChange={(e) => setField('area', e.target.value)} className={INPUT_CLS} required />
            </FormField>
            <FormField label="Street" required>
              <input value={form.street} onChange={(e) => setField('street', e.target.value)} className={INPUT_CLS} required />
            </FormField>
            <FormField label="Address line">
              <input value={form.address} onChange={(e) => setField('address', e.target.value)} className={INPUT_CLS} placeholder="Building / landmark" />
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Latitude">
                <input type="number" step="any" value={form.latitude} onChange={(e) => setField('latitude', e.target.value)} className={INPUT_CLS} placeholder={autoCoords ? autoCoords.latitude.toFixed(4) : 'e.g. 13.0776'} />
              </FormField>
              <FormField label="Longitude">
                <input type="number" step="any" value={form.longitude} onChange={(e) => setField('longitude', e.target.value)} className={INPUT_CLS} placeholder={autoCoords ? autoCoords.longitude.toFixed(4) : 'e.g. 80.2917'} />
              </FormField>
            </div>

            <FormField label="Working Days">
              <select value={form.workingDays || ''} onChange={(e) => setField('workingDays', e.target.value)} className={INPUT_CLS}>
                {WORKING_DAYS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Opening Time">
              <input value={form.openingTime || ''} onChange={(e) => setField('openingTime', e.target.value)} className={INPUT_CLS} placeholder="08:00 AM" />
            </FormField>
            <FormField label="Closing Time">
              <input value={form.closingTime || ''} onChange={(e) => setField('closingTime', e.target.value)} className={INPUT_CLS} placeholder="07:00 PM" />
            </FormField>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-[220px] flex-1 text-[11px] text-[#666666]">
              <MapPin className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Latitude/longitude lets customers within the pickup radius find this shop. Timezone: <span className="font-mono">{detectTimezone()}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearAddressFields}
                className={cx('whitespace-nowrap rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#475467] transition hover:bg-[#F8F8F8]', FOCUS_RING)}
              >
                Clear Address
              </button>
              <a
                href={mapsSearchUrl()}
                target="_blank"
                rel="noreferrer"
                className={cx('whitespace-nowrap rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}
              >
                Find on Google Maps
              </a>
              <button
                type="button"
                onClick={fetchLocationNow}
                disabled={locating}
                className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#F3BF23] px-3 py-1.5 text-xs font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:opacity-60', FOCUS_RING)}
              >
                {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Navigation className="h-3.5 w-3.5" aria-hidden="true" />}
                {locating ? 'Locating…' : 'Get Current Location'}
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#ECECEC] p-4">
            <h4 className="text-sm font-bold text-[#111111]">Shop Photos &amp; Documents</h4>
            <p className="mb-3 text-xs text-[#666666]">Shop front + banner/visiting card are required; GST &amp; Udyam are optional proofs.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <UploadCard label="Shop Front View" hint="Photo of the shop front" url={form.frontImageUrl} uploading={!!uploading.frontImageUrl} onFile={(f) => handleUpload('frontImageUrl', f, 'shops/front')} accept="image/*" />
              <UploadCard label="Banner / Visiting Card" hint="Banner board or visiting card" url={form.bannerImageUrl} uploading={!!uploading.bannerImageUrl} onFile={(f) => handleUpload('bannerImageUrl', f, 'shops/banner')} accept="image/*" />
              <UploadCard label="GST Certificate" hint="PDF or image" url={form.gstCertificateUrl} uploading={!!uploading.gstCertificateUrl} onFile={(f) => handleUpload('gstCertificateUrl', f, 'shops/gst', { document: true })} accept="image/*,application/pdf" />
              <UploadCard label="Udyam Certificate" hint="PDF or image" url={form.udyamCertificateUrl} uploading={!!uploading.udyamCertificateUrl} onFile={(f) => handleUpload('udyamCertificateUrl', f, 'shops/udyam', { document: true })} accept="image/*,application/pdf" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#ECECEC] px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className={cx('rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={cx('inline-flex items-center gap-2 rounded-xl bg-[#F3BF23] px-5 py-2.5 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-60', FOCUS_RING)}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Location'}
          </button>
        </div>
      </form>
    </div>
  );
}
