'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi, uploadMedia as uploadFile } from '@/lib/api';
import BusinessLocationsManager from '@/components/BusinessLocationsManager';
import SafeImage from '@/components/SafeImage';
import { notifyError } from '@/lib/toast';

const EMPTY_OWNER = {
  name: '', email: '', phone: '', secondaryMobile: '', password: '', otpCode: '',
  personalAddress: '',
  addrState: '', addrDistrict: '', addrTaluk: '', addrArea: '', addrStreet: '', addrPincode: '',
  // Owner KYC (users.kyc_document jsonb): Aadhar front/back + PAN.
  avatarUrl: '', aadharFrontUrl: '', aadharBackUrl: '', panUrl: '',
};

export default function EditShopOwnerPage() {
  const router = useRouter();
  const params = useSearchParams();
  // Resolve the owner id from ?id=, falling back to the persisted id — S3 static
  // hosting drops the query on its trailing-slash 302 redirect (see view page).
  const [id, setId] = useState(null);
  const [idResolved, setIdResolved] = useState(false);
  useEffect(() => {
    const q = params.get('id');
    if (q) { try { sessionStorage.setItem('ggfix.ownerId', q); } catch {} }
    let v = q;
    if (!v) { try { v = sessionStorage.getItem('ggfix.ownerId'); } catch {} }
    setId(v || null);
    setIdResolved(true);
  }, [params]);

  const [owner, setOwner] = useState({ ...EMPTY_OWNER });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState({});
  const [locations, setLocations] = useState([]);
  const [kycDocument, setKycDocument] = useState(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await authApi.get(`/auth/shop-owners/${id}`);
        setOwner({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          secondaryMobile: data.secondaryMobile || '',
          password: '',
          otpCode: '',
          personalAddress: data.personalAddress || '',
          addrState: data.addrState || '',
          addrDistrict: data.addrDistrict || '',
          addrTaluk: data.addrTaluk || '',
          addrArea: data.addrArea || '',
          addrStreet: data.addrStreet || '',
          addrPincode: data.addrPincode || '',
          avatarUrl: data.avatarUrl || '',
          aadharFrontUrl: data.kycDocument?.aadharFrontUrl || '',
          aadharBackUrl: data.kycDocument?.aadharBackUrl || '',
          panUrl: data.kycDocument?.panUrl || '',
        });
        setLocations(data.locations || []);
        setKycDocument(data.kycDocument || null);
      } catch (e) {
        setError(e.body?.message || e.message || 'Failed to load owner');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Re-fetches only the locations/KYC slice after an add/edit/delete in
  // BusinessLocationsManager, deliberately leaving `owner` alone — a full
  // reload would clobber any Basic Info edits the admin hasn't saved yet.
  const reloadLocations = async () => {
    try {
      const data = await authApi.get(`/auth/shop-owners/${id}`);
      setLocations(data.locations || []);
      setKycDocument(data.kycDocument || null);
    } catch (e) {
      setError(e.body?.message || e.message || 'Failed to reload business locations');
    }
  };

  const setField = (k, v) => setOwner((o) => ({ ...o, [k]: v }));

  const handleUpload = async (field, file, folder, opts) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [field]: true }));
    try {
      const url = await uploadFile(file, folder, opts);
      if (url) setField(field, url);
    } catch (e) { notifyError(e.message || 'Upload failed'); }
    finally { setUploading((u) => ({ ...u, [field]: false })); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!owner.name.trim() || !owner.email.trim()) {
      notifyError('Owner name and email are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: owner.name.trim(),
        email: owner.email.trim(),
        phone: owner.phone.trim(),
        secondaryMobile: owner.secondaryMobile.trim(),
        personalAddress: owner.personalAddress.trim(),
        addrState: owner.addrState.trim(),
        addrDistrict: owner.addrDistrict.trim(),
        addrTaluk: owner.addrTaluk.trim(),
        addrArea: owner.addrArea.trim(),
        addrStreet: owner.addrStreet.trim(),
        addrPincode: owner.addrPincode.trim(),
        // Media/KYC — only send a field when it has a value, so a partial edit
        // (e.g. just the phone number) never clears an existing document. A
        // non-null KYC value also resets that KYC status to PENDING_REVIEW on
        // the backend, so an unchanged value must stay omitted, not resent.
        ...(owner.avatarUrl ? { avatarUrl: owner.avatarUrl } : {}),
        ...(owner.aadharFrontUrl ? { aadharFrontUrl: owner.aadharFrontUrl } : {}),
        ...(owner.aadharBackUrl ? { aadharBackUrl: owner.aadharBackUrl } : {}),
        ...(owner.panUrl ? { panUrl: owner.panUrl } : {}),
        // password & otpCode only sent if explicitly set, to avoid wiping them.
        ...(owner.password.trim() ? { password: owner.password } : {}),
        ...(owner.otpCode.trim() ? { otpCode: owner.otpCode.trim() } : {}),
      };
      await authApi.patch(`/auth/shop-owners/${id}`, payload);
      router.push(`/management/shops/view/?id=${id}`);
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!idResolved) return <div className="p-6 text-admin-muted">Loading…</div>;
  // No id anywhere (query stripped AND nothing persisted): don't hang forever.
  if (!id) return (
    <div className="p-6 text-admin-muted">
      No shop owner selected. <Link href="/management/shops/" className="text-admin-accent hover:underline">← Back to shops</Link>
    </div>
  );
  if (loading) return <div className="p-6 text-admin-muted">Loading…</div>;

  return (
    <div className="p-4 pb-24 sm:p-6 sm:pb-24 md:p-8 md:pb-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Edit Shop Owner</h1>
          <p className="text-sm text-admin-muted">Update the owner account profile and business locations.</p>
        </div>
        <Link href={`/management/shops/view/?id=${id}`} className="text-sm text-admin-muted hover:text-slate-800">← Back to view</Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Basic Information */}
          <div className="lg:col-span-2 rounded-xl bg-admin-card border border-admin-border p-5">
            <SectionHeader icon="👤" title="Basic Information" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <Field label="FULL NAME *">
                <input value={owner.name} onChange={(e) => setField('name', e.target.value)} className="input" placeholder="Full Name" required />
              </Field>
              <Field label="EMAIL ADDRESS *">
                <input type="email" value={owner.email} onChange={(e) => setField('email', e.target.value)} className="input" placeholder="Email" required />
              </Field>
              <Field label="PRIMARY MOBILE">
                <input value={owner.phone} onChange={(e) => setField('phone', e.target.value)} className="input" placeholder="Primary Mobile" />
              </Field>
              <Field label="SECONDARY MOBILE">
                <input value={owner.secondaryMobile} onChange={(e) => setField('secondaryMobile', e.target.value)} className="input" placeholder="Secondary Mobile" />
              </Field>
              <Field label="NEW PASSWORD" hint="Leave blank to keep current password">
                <input type="password" value={owner.password} onChange={(e) => setField('password', e.target.value)} className="input" placeholder="••••••••" />
              </Field>
              <Field label="OTP CODE" hint="Leave blank to keep current OTP">
                <input value={owner.otpCode} onChange={(e) => setField('otpCode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="input" placeholder="6-digit" />
              </Field>
            </div>

            <div className="mt-5">
              <SectionHeader icon="🔍" title="Personal Address" small />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <Field label="STATE">
                  <input value={owner.addrState} onChange={(e) => setField('addrState', e.target.value)} className="input" />
                </Field>
                <Field label="DISTRICT">
                  <input value={owner.addrDistrict} onChange={(e) => setField('addrDistrict', e.target.value)} className="input" />
                </Field>
                <Field label="TALUK">
                  <input value={owner.addrTaluk} onChange={(e) => setField('addrTaluk', e.target.value)} className="input" />
                </Field>
                <Field label="AREA">
                  <input value={owner.addrArea} onChange={(e) => setField('addrArea', e.target.value)} className="input" />
                </Field>
                <Field label="STREET">
                  <input value={owner.addrStreet} onChange={(e) => setField('addrStreet', e.target.value)} className="input" />
                </Field>
                <Field label="PINCODE">
                  <input value={owner.addrPincode} onChange={(e) => setField('addrPincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="input" />
                </Field>
                <Field label="ADDRESS NOTE" full>
                  <textarea value={owner.personalAddress} onChange={(e) => setField('personalAddress', e.target.value)} className="input min-h-[60px]" placeholder="Optional free-text note" />
                </Field>
              </div>
            </div>
          </div>

          {/* Profile & Documents */}
          <div className="rounded-xl bg-admin-card border border-admin-border p-5">
            <SectionHeader icon="📇" title="Personal Profile & Documents" />
            <p className="text-[11px] text-admin-muted mt-1">Owner KYC — Aadhar (front &amp; back) and PAN card.</p>
            <div className="mt-3 space-y-3">
              <UploadCard label="Avatar" hint="Profile image" url={owner.avatarUrl} uploading={!!uploading.avatarUrl} onFile={(f) => handleUpload('avatarUrl', f, 'owners/avatars')} accept="image/*" buttonText="Upload Avatar" />
              <UploadCard label="Aadhar Card Front" hint="PDF or image" url={owner.aadharFrontUrl} uploading={!!uploading.aadharFrontUrl} onFile={(f) => handleUpload('aadharFrontUrl', f, 'owners/kyc', { document: true })} accept="image/*,application/pdf" buttonText="Upload Aadhar Front" />
              <UploadCard label="Aadhar Card Back" hint="PDF or image" url={owner.aadharBackUrl} uploading={!!uploading.aadharBackUrl} onFile={(f) => handleUpload('aadharBackUrl', f, 'owners/kyc', { document: true })} accept="image/*,application/pdf" buttonText="Upload Aadhar Back" />
              <UploadCard label="PAN Card" hint="PDF or image" url={owner.panUrl} uploading={!!uploading.panUrl} onFile={(f) => handleUpload('panUrl', f, 'owners/kyc', { document: true })} accept="image/*,application/pdf" buttonText="Upload PAN Card" />
            </div>
          </div>
        </div>

        <BusinessLocationsManager
          ownerId={id}
          locations={locations}
          kycDocument={kycDocument}
          onChanged={reloadLocations}
        />

        {error && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-sm text-red-500">{error}</div>}

        <div className="flex flex-wrap items-center justify-end gap-3 sticky bottom-4 bg-admin-card border border-admin-border rounded-xl p-3">
          <Link href={`/management/shops/view/?id=${id}`} className="rounded-lg border border-admin-border px-4 py-2 text-sm text-slate-800 hover:bg-admin-dark">
            ← Cancel
          </Link>
          <button type="submit" disabled={submitting} className="rounded-lg bg-admin-accent px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? 'Saving…' : '💾 Save Changes'}
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

function SectionHeader({ icon, title, small }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <h2 className={`${small ? 'text-sm' : 'text-base'} font-semibold text-slate-900`}>{title}</h2>
    </div>
  );
}

function Field({ label, hint, children, full }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
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
      <div className="flex items-center justify-between gap-2 mb-1">
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
