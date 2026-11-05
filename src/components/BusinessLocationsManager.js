'use client';

import { useEffect, useRef, useState } from 'react';
import { authApi, uploadMedia as uploadFile } from '@/lib/api';
import SafeImage from '@/components/SafeImage';
import { notifyError } from '@/lib/toast';

/**
 * The full "Business Locations" table + add/edit/view/delete flow for one
 * shop owner. Originally lived only on the shop-owner View page; extracted so
 * the Edit page can offer the same inline editing instead of bouncing the
 * admin over to View just to fix a GST number or swap a document.
 */

const EMPTY_LOC = {
  name: '', mobile: '', gstNumber: '', state: '', district: '',
  taluk: '', area: '', street: '', pincode: '',
  address: '',
  // latitude/longitude auto-captured from browser geolocation when adding.
  latitude: '', longitude: '',
  frontImageUrl: '', bannerImageUrl: '', gstCertificateUrl: '', udyamCertificateUrl: '',
  // Shop working hours
  workingDays: 'MON_SAT', openingTime: '', closingTime: '',
};

const WORKING_DAYS_OPTIONS = [
  { value: 'MON_FRI', label: 'Monday – Friday' },
  { value: 'MON_SAT', label: 'Monday – Saturday' },
  { value: 'MON_SUN', label: 'Monday – Sunday' },
];

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

function Badge({ tone, children }) {
  const tones = {
    success: 'bg-brand-500/15 text-brand-300',
    warn:    'bg-amber-500/15 text-amber-300',
    muted:   'bg-slate-500/15 text-slate-500',
    info:    'bg-admin-accent/15 text-admin-accent',
  };
  return <span className={`inline-flex items-center rounded-full ${tones[tone] || tones.muted} px-2 py-0.5 text-[11px] font-medium`}>{children}</span>;
}
function KycBadge({ status }) {
  const map = {
    APPROVED: { tone: 'success', label: 'Verified' },
    REJECTED: { tone: 'warn', label: 'Rejected' },
    PENDING_REVIEW: { tone: 'info', label: 'Under Review' },
    NONE: { tone: 'muted', label: 'No documents' },
  };
  const m = map[status] || map.NONE;
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
      <span className="text-[11px] uppercase tracking-wider text-admin-muted">{label}</span>
      <span className="text-slate-800 break-all">{value ?? '—'}</span>
    </div>
  );
}
function DocPreview({ label, url }) {
  return (
    <div className="rounded-lg border border-admin-border bg-admin-dark/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wider text-admin-muted">{label}</span>
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-[11px] text-sky-400 hover:underline">Open</a>}
      </div>
      {url ? (
        isImageUrl(url) ? (
          <SafeImage
            src={url}
            alt={label}
            className="max-h-32 w-full object-contain rounded bg-black/20"
            placeholderClassName="text-xs text-admin-muted italic h-32 flex items-center justify-center rounded bg-black/20"
            placeholderText="Image unavailable"
          />
        ) : (
          <div className="text-xs text-slate-600 truncate">{url.split('/').pop() || 'File'}</div>
        )
      ) : (
        <p className="text-xs text-admin-muted italic">No {label.toLowerCase()} uploaded.</p>
      )}
    </div>
  );
}
function DocChip({ label, url }) {
  if (!url) return <span className="text-[10px] text-admin-muted">{label}—</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-md bg-brand-500/15 text-brand-300 px-1.5 py-0.5 hover:bg-brand-500/25">
      ✓ {label}
    </a>
  );
}
function Progress({ percent }) {
  const color = percent >= 100 ? 'bg-brand-500' : percent >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-semibold text-slate-800">{percent}%</span>
      <div className="h-1.5 rounded-full bg-admin-dark overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
function IconPencil() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>;
}
function IconTrash() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></svg>;
}
function IconEye() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function ConfirmModal({ title, message, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-admin-card border border-admin-border rounded-xl p-5 sm:p-6 max-w-sm w-full space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-admin-muted">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-admin-border px-4 py-2 text-sm text-slate-800 hover:bg-admin-dark">Cancel</button>
          <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Read-only detail view for one business location: shop info + shop documents
// (front/banner/GST/Udyam images). Owner KYC is per-owner, not per-location.
function LocationViewModal({ loc, onClose }) {
  const addr = [loc.street, loc.area, loc.taluk, loc.district, loc.state, loc.pincode].filter(Boolean).join(', ') || loc.address || '—';
  const hours = (loc.openingTime || loc.closingTime) ? `${loc.openingTime || '—'} – ${loc.closingTime || '—'}` : '—';
  const coords = (loc.latitude != null && loc.longitude != null) ? `${loc.latitude}, ${loc.longitude}` : '—';
  const shopDocs = [
    { label: 'Shop Front', url: loc.frontImageUrl },
    { label: 'Banner / Visiting Card', url: loc.bannerImageUrl },
    { label: 'GST Certificate (optional)', url: loc.gstCertificateUrl },
    { label: 'Udyam Certificate (optional)', url: loc.udyamCertificateUrl },
  ];
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-admin-card border border-admin-border rounded-xl max-w-3xl w-full my-auto sm:my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-admin-border">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{loc.name}</h3>
            <p className="text-xs text-admin-muted">Business location details, documents, and KYC.</p>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-admin-muted hover:text-slate-800 text-xl leading-none" aria-label="Close">×</button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <DetailRow label="Mobile" value={loc.mobile} />
            <DetailRow label="GST" value={loc.gstNumber} />
            <DetailRow label="Address" value={addr} />
            <DetailRow label="Working Days" value={loc.workingDays} />
            <DetailRow label="Hours" value={hours} />
            <DetailRow label="Coords" value={coords} />
            <DetailRow label="Progress" value={`${loc.progressPercent ?? 0}%`} />
            <DetailRow label="Created" value={loc.createdAt ? new Date(loc.createdAt).toLocaleDateString() : '—'} />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-2">Shop Documents</h4>
            <p className="text-[11px] text-admin-muted mb-2">Shop Front &amp; Banner are required; GST &amp; Udyam are optional.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {shopDocs.map((d) => <DocPreview key={d.label} label={d.label} url={d.url} />)}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-admin-border">
          <button type="button" onClick={onClose} className="rounded-lg border border-admin-border px-4 py-2 text-sm text-slate-800 hover:bg-admin-dark">Close</button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-admin-muted mb-1">{label}</label>
      {children}
    </div>
  );
}

function UploadCard({ label, hint, url, uploading, onFile, accept }) {
  return (
    <div className="rounded-lg border border-dashed border-admin-border bg-admin-dark/40 p-3 flex flex-col items-center min-h-[150px]">
      <div className="w-full flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-800">{label}</span>
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-[10px] text-sky-400 hover:underline">Open</a>}
      </div>
      <span className="text-[10px] text-admin-muted mb-2 w-full">{hint}</span>
      <div className="flex-1 flex items-center justify-center w-full">
        {url ? (
          isImageUrl(url) ? (
            <SafeImage
              src={url}
              alt={label}
              className="max-h-20 object-contain rounded"
              placeholderClassName="text-[11px] text-admin-muted italic text-center px-2"
              placeholderText="Image unavailable"
            />
          ) : (
            <span className="text-[11px] text-slate-600 truncate max-w-full">{url.split('/').pop() || 'File'}</span>
          )
        ) : (
          <span className="text-xs text-admin-muted">{uploading ? 'Uploading…' : 'No file'}</span>
        )}
      </div>
      <label className="mt-2 w-full text-center rounded-md bg-admin-accent text-white text-xs py-1.5 cursor-pointer hover:bg-blue-700">
        {url ? `Replace ${label}` : `Upload ${label}`}
        <input type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} disabled={uploading} />
      </label>
    </div>
  );
}

function LocationModal({ ownerId, mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_LOC, ...initial, latitude: initial.latitude ?? '', longitude: initial.longitude ?? '' }));
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
      street:   f.street   || sug.street   || f.street,
      area:     f.area     || sug.area     || f.area,
      taluk:    f.taluk    || sug.taluk    || f.taluk,
      district: f.district || sug.district || f.district,
      state:    f.state    || sug.state    || f.state,
      pincode:  f.pincode  || sug.pincode  || f.pincode,
      latitude:  String(sug.lat),
      longitude: String(sug.lng),
    }));
    setSuggestions([]);
  };

  // Capture browser geolocation when the Add modal opens. In edit mode we keep
  // whatever coords the location already has.
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
          denied:      'Location permission was blocked. Click the lock/info icon left of the URL → Site settings → set Location to Allow → reload. Or use the 🗺 Find on Google Maps link to paste coords manually.',
          unavailable: 'Browser could not determine your location. Use the 🗺 Find on Google Maps link to look up coords manually.',
          timeout:     'Location lookup timed out. Try again or use the 🗺 Find on Google Maps link.',
          unsupported: 'This browser does not support geolocation. Paste coords manually.',
          unknown:     'Could not get your current location. Use the 🗺 Find on Google Maps link to look up coords manually.',
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
      const url = await uploadFile(file, folder, opts);
      if (url) setField(field, url);
    } catch (e) {
      notifyError(e.message || 'Upload failed');
    } finally {
      setUploading((u) => ({ ...u, [field]: false }));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { notifyError('Shop / Location Name is required'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form,
        // Manual entry always wins. On add, fall back to browser auto-capture
        // when the field is left empty. On edit, leave undefined → server keeps
        // the existing stored value.
        latitude: form.latitude !== '' && form.latitude != null
          ? Number(form.latitude)
          : (isEdit ? undefined : autoCoords?.latitude),
        longitude: form.longitude !== '' && form.longitude != null
          ? Number(form.longitude)
          : (isEdit ? undefined : autoCoords?.longitude),
        timezone: detectTimezone(),
      };
      if (isEdit) {
        await authApi.patch(`/auth/shop-owners/${ownerId}/locations/${initial.id}`, payload);
      } else {
        await authApi.post(`/auth/shop-owners/${ownerId}/locations`, payload);
      }
      onSaved();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-admin-card border border-admin-border rounded-xl max-w-4xl w-full my-auto sm:my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-admin-border">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{isEdit ? 'Edit Business Location' : 'New Business Location'}</h3>
            <p className="text-xs text-admin-muted">Capture shop information and proof documents for this location.</p>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-admin-muted hover:text-slate-800 text-xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <ModalField label="Shop / Location Name *">
              <div className="relative">
                <input
                  value={form.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  className="modal-input pr-7"
                  placeholder="Type shop name or address"
                  autoComplete="off"
                  required
                />
                {searching ? (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-admin-muted text-[10px]">⏳</span>
                ) : null}
                {suggestions.length > 0 || (searched && !searching) ? (
                  <div className="absolute z-30 mt-1 left-0 right-0 bg-admin-card border border-admin-border rounded-lg shadow-xl max-h-64 overflow-auto">
                    {suggestions.length > 0 ? (
                      <>
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-admin-muted bg-admin-dark/40 border-b border-admin-border">
                          ⚠ Verify pincode before picking — OSM data isn&apos;t always current
                        </div>
                        {suggestions.map((sug, k) => (
                          <button
                            type="button"
                            key={k}
                            onClick={() => applySuggestion(sug)}
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
                          onClick={dismissSuggestions}
                          className="block w-full text-center px-3 py-1.5 text-[10px] text-admin-muted hover:bg-admin-dark bg-admin-dark/40"
                        >
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <div className="px-3 py-3 text-xs text-admin-muted">
                        <div className="font-medium text-slate-600">No matches found</div>
                        <div className="mt-1 text-[11px]">
                          Try just the area or pincode, or use <span className="text-slate-800">🗺 Find on Google Maps</span> below.
                        </div>
                        <button
                          type="button"
                          onClick={dismissSuggestions}
                          className="mt-2 text-[10px] text-admin-accent hover:underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </ModalField>
            <ModalField label="Mobile *">
              <input value={form.mobile} onChange={(e) => setField('mobile', e.target.value)} className="modal-input" placeholder="+91 …" required />
            </ModalField>
            <ModalField label="GST Number">
              <input value={form.gstNumber} onChange={(e) => setField('gstNumber', e.target.value.toUpperCase())} className="modal-input" placeholder="22AAAAA0000A1Z5" />
            </ModalField>
            <ModalField label="Pincode *">
              <input value={form.pincode} onChange={(e) => setField('pincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="modal-input" required />
            </ModalField>

            <ModalField label="State *">
              <input value={form.state} onChange={(e) => setField('state', e.target.value)} className="modal-input" required />
            </ModalField>
            <ModalField label="District *">
              <input value={form.district} onChange={(e) => setField('district', e.target.value)} className="modal-input" required />
            </ModalField>
            <ModalField label="Taluk *">
              <input value={form.taluk} onChange={(e) => setField('taluk', e.target.value)} className="modal-input" required />
            </ModalField>
            <ModalField label="Area *">
              <input value={form.area} onChange={(e) => setField('area', e.target.value)} className="modal-input" required />
            </ModalField>

            <ModalField label="Street *">
              <input value={form.street} onChange={(e) => setField('street', e.target.value)} className="modal-input" required />
            </ModalField>
            <ModalField label="Address line">
              <input value={form.address} onChange={(e) => setField('address', e.target.value)} className="modal-input" placeholder="Building / landmark" />
            </ModalField>
            <ModalField label="Latitude">
              <input
                type="number" step="any"
                value={form.latitude}
                onChange={(e) => setField('latitude', e.target.value)}
                className="modal-input"
                placeholder={autoCoords ? autoCoords.latitude.toFixed(6) : 'e.g. 13.0776'}
              />
            </ModalField>
            <ModalField label="Longitude">
              <input
                type="number" step="any"
                value={form.longitude}
                onChange={(e) => setField('longitude', e.target.value)}
                className="modal-input"
                placeholder={autoCoords ? autoCoords.longitude.toFixed(6) : 'e.g. 80.2917'}
              />
            </ModalField>

            <ModalField label="Working Days">
              <select
                value={form.workingDays || ''}
                onChange={(e) => setField('workingDays', e.target.value)}
                className="modal-input"
              >
                {WORKING_DAYS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </ModalField>
            <ModalField label="Opening Time">
              <input
                value={form.openingTime || ''}
                onChange={(e) => setField('openingTime', e.target.value)}
                className="modal-input"
                placeholder="08:00 AM"
              />
            </ModalField>
            <ModalField label="Closing Time">
              <input
                value={form.closingTime || ''}
                onChange={(e) => setField('closingTime', e.target.value)}
                className="modal-input"
                placeholder="07:00 PM"
              />
            </ModalField>
          </div>
          <div className="flex items-center justify-between gap-3 mt-1 flex-wrap">
            <p className="text-[10px] text-admin-muted flex-1 min-w-[200px]">
              📍 Latitude / Longitude lets customers within the pickup radius see this shop.
              Click <span className="text-slate-800 font-semibold">Get Current Location</span> at the shop, or use <span className="text-slate-800 font-semibold">Find on Google Maps</span> to right-click a pin and read off coords.
              · Timezone: <span className="font-mono">{detectTimezone()}</span>
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={clearAddressFields}
                className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-dark px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-admin-card whitespace-nowrap"
                title="Wipe street/area/taluk/district/state/pincode/lat/lng"
              >
                ✕ Clear Address
              </button>
              <a
                href={mapsSearchUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-dark px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-admin-card whitespace-nowrap"
              >
                🗺 Find on Google Maps
              </a>
              <button
                type="button"
                onClick={fetchLocationNow}
                disabled={locating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-admin-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
              >
                {locating ? (
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

          <div className="rounded-lg border border-admin-border p-4">
            <h4 className="text-sm font-semibold text-slate-900">Shop Photos &amp; Documents</h4>
            <p className="text-xs text-admin-muted mb-3">Shop front + banner/visiting card are required; GST &amp; Udyam are optional proofs.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <UploadCard label="Shop Front View *" hint="Photo of the shop front" url={form.frontImageUrl} uploading={!!uploading.frontImageUrl} onFile={(f) => handleUpload('frontImageUrl', f, 'shops/front')} accept="image/*" />
              <UploadCard label="Shop Banner / Visiting Card *" hint="Banner board or visiting card" url={form.bannerImageUrl} uploading={!!uploading.bannerImageUrl} onFile={(f) => handleUpload('bannerImageUrl', f, 'shops/banner')} accept="image/*" />
              <UploadCard label="GST Certificate" hint="PDF or image" url={form.gstCertificateUrl} uploading={!!uploading.gstCertificateUrl} onFile={(f) => handleUpload('gstCertificateUrl', f, 'shops/gst', { document: true })} accept="image/*,application/pdf" />
              <UploadCard label="Udyam Certificate" hint="PDF or image" url={form.udyamCertificateUrl} uploading={!!uploading.udyamCertificateUrl} onFile={(f) => handleUpload('udyamCertificateUrl', f, 'shops/udyam', { document: true })} accept="image/*,application/pdf" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-admin-border">
          <button type="button" onClick={onClose} className="rounded-lg border border-admin-border px-4 py-2 text-sm text-slate-800 hover:bg-admin-dark">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Save Location')}
          </button>
        </div>

        <style jsx>{`
          :global(.modal-input) {
            width: 100%;
            border-radius: 0.5rem;
            background: rgb(15 23 42);
            border: 1px solid rgb(51 65 85);
            padding: 0.5rem 0.75rem;
            color: rgb(241 245 249);
            font-size: 0.875rem;
          }
          :global(.modal-input:focus) { outline: none; border-color: rgb(56 189 248); }
        `}</style>
      </form>
    </div>
  );
}

export default function BusinessLocationsManager({ ownerId, locations, kycDocument, onChanged }) {
  const [showLocModal, setShowLocModal] = useState(null); // { mode: 'add'|'edit', loc, index }
  const [deletingLoc, setDeletingLoc] = useState(null);
  const [viewingLoc, setViewingLoc] = useState(null);

  const handleDeleteLoc = async (loc) => {
    try {
      await authApi.delete(`/auth/shop-owners/${ownerId}/locations/${loc.id}`);
      setDeletingLoc(null);
      onChanged();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  const list = locations || [];

  return (
    <div className="rounded-xl bg-admin-card border border-admin-border p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Business Locations</h3>
          <p className="text-xs text-admin-muted">Business locations linked to this shop owner account.</p>
        </div>
        <button onClick={() => setShowLocModal({ mode: 'add', loc: { ...EMPTY_LOC } })} className="rounded-lg bg-admin-accent px-3 py-1.5 text-xs text-white hover:bg-blue-700">
          + Add Business Location
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-admin-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-admin-dark/60 text-[11px] uppercase tracking-wider text-admin-muted">
            <tr>
              <th className="px-3 py-2 text-left">S.No</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-left">Mobile</th>
              <th className="px-3 py-2 text-left">Address</th>
              <th className="px-3 py-2 text-left">GST</th>
              <th className="px-3 py-2 text-left">Documents</th>
              <th className="px-3 py-2 text-left">Progress</th>
              <th className="px-3 py-2 text-center">Verified</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border">
            {list.length === 0 ? (
              <tr><td className="px-3 py-6 text-admin-muted text-center" colSpan={9}>No business locations yet.</td></tr>
            ) : list.map((loc, i) => (
              <tr key={loc.id} className="hover:bg-admin-dark/30">
                <td className="px-3 py-3 text-slate-600">{i + 1}</td>
                <td className="px-3 py-3">
                  <div className="text-slate-900 font-medium flex items-center gap-2">
                    {loc.name}
                    {i === 0 && <span className="text-[10px] uppercase tracking-wide rounded-full bg-admin-accent/20 text-admin-accent px-1.5 py-0.5">Main</span>}
                  </div>
                  <div className="text-[11px] text-admin-muted mt-0.5">Created {loc.createdAt ? new Date(loc.createdAt).toLocaleDateString() : '—'}</div>
                </td>
                <td className="px-3 py-3 text-slate-600">{loc.mobile || '—'}</td>
                <td className="px-3 py-3 text-slate-600 max-w-[260px]">
                  <div className="line-clamp-3 text-xs">{[loc.street, loc.area, loc.taluk, loc.district, loc.state, loc.pincode].filter(Boolean).join(', ') || loc.address || '—'}</div>
                </td>
                <td className="px-3 py-3">
                  {loc.gstNumber ? (
                    <span className="inline-flex items-center rounded-md bg-admin-dark px-2 py-0.5 text-[11px] text-slate-800 border border-admin-border font-mono">{loc.gstNumber}</span>
                  ) : '—'}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                    <DocChip label="Front" url={loc.frontImageUrl} />
                    <DocChip label="Banner" url={loc.bannerImageUrl} />
                    <DocChip label="GST" url={loc.gstCertificateUrl} />
                    <DocChip label="Udyam" url={loc.udyamCertificateUrl} />
                  </div>
                </td>
                <td className="px-3 py-3 min-w-[130px]">
                  <Progress percent={loc.progressPercent ?? 0} />
                </td>
                <td className="px-3 py-3 text-center">
                  {/* Owner-level KYC (same for every location). Review it in the Owner KYC card above. */}
                  {kycDocument && (kycDocument.aadharFrontUrl || kycDocument.aadharBackUrl || kycDocument.panUrl)
                    ? <KycBadge status={kycDocument.status || 'PENDING_REVIEW'} />
                    : <span className="text-[11px] text-admin-muted">No KYC</span>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => setViewingLoc(loc)} title="View" className="p-1.5 rounded hover:bg-admin-dark text-sky-600">
                      <IconEye />
                    </button>
                    <button onClick={() => setShowLocModal({ mode: 'edit', loc, index: i })} title="Edit" className="p-1.5 rounded hover:bg-admin-dark text-slate-600">
                      <IconPencil />
                    </button>
                    <button onClick={() => setDeletingLoc(loc)} title="Delete" className="p-1.5 rounded hover:bg-admin-dark text-red-600">
                      <IconTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showLocModal && (
        <LocationModal
          ownerId={ownerId}
          mode={showLocModal.mode}
          initial={showLocModal.loc}
          onClose={() => setShowLocModal(null)}
          onSaved={() => { setShowLocModal(null); onChanged(); }}
        />
      )}

      {deletingLoc && (
        <ConfirmModal
          title="Delete this business location?"
          message={`Permanently remove "${deletingLoc.name}". This cannot be undone.`}
          confirmLabel="Delete"
          onCancel={() => setDeletingLoc(null)}
          onConfirm={() => handleDeleteLoc(deletingLoc)}
        />
      )}

      {viewingLoc && (
        <LocationViewModal
          loc={viewingLoc}
          onClose={() => setViewingLoc(null)}
        />
      )}
    </div>
  );
}
