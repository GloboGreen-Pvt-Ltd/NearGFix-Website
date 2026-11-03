'use client';

/**
 * /shop-home/account/settings — "Account Settings".
 *
 * Tabbed layout (Personal Information / KYC Document / Subscription /
 * My QR Code / Pickup Service / My Orders), each backed by a real endpoint
 * already used elsewhere in this app rather than invented data:
 *   - Personal Information: GET /auth/me. Name/email/mobile are read-only —
 *     there's no update endpoint for those yet — but the profile photo is a
 *     real two-step upload against auth-service (src/lib/shopProfile.js):
 *     POST /auth/me/kyc-documents/upload (type=avatar) -> S3 URL, then
 *     PUT /auth/me/avatar { avatarUrl } to persist it. This used to live on
 *     its own /shop-home/account/profile ("My Profile") page; that page was
 *     removed as redundant with this tab, so the photo control moved here
 *     rather than being dropped.
 *   - KYC Document: the shop OWNER's own identity documents (Aadhar
 *     front/back + PAN) — src/lib/shopKyc.js, the same GET/POST
 *     /auth/me/kyc-documents (+ /upload) routes the mobile app's KYC screen
 *     uses. Previously had no web UI at all. Uploading a file only stages
 *     its URL locally; "Submit for Review" is the one call that persists
 *     all three and flips status back to PENDING_REVIEW.
 *   - Subscription: GET /subscriptions/owner/{ownerId} + /subscriptions/plans.
 *     Read-only here — "Upgrade" links out rather than calling the
 *     record-only /subscriptions/activate, which would flip the account to
 *     paid with no payment actually collected.
 *   - My QR Code: generated client-side (qrcode package) from the owner's
 *     main location's Google Maps search link — there's no public
 *     shop-profile URL/slug route yet, so "share your shop" means share
 *     directions to it, the same link src/components/BusinessLocationsManager.js
 *     already builds for "Find on Google Maps".
 *   - Pickup Service: reuses updateShopLocation() (src/lib/shopLocations.js)
 *     against the same per-location pickupEnabled/pickupFromTime/
 *     pickupToTime/pickupDistanceKm fields the Business Profile edit form
 *     already writes — the only tab with a real Save action.
 *   - My Orders: GET {ORDER_BASE}/repair-bookings/shop, same call and
 *     friendly-status mapping the Dashboard's "Recent Bookings" card uses.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  QrCode as QrCodeIcon,
  Smartphone,
  Store,
  Truck,
  User,
  X,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import { deriveDisplayName, initialsOf } from '@/components/shop-dashboard/ProfileDropdown';
import { readShopOwner, updateShopOwnerSession } from '@/lib/shopAuth';
import { isOwnerSession, OWNER_ONLY_TABS } from '@/lib/shopAccess';
import { getShopPublic } from '@/lib/repairBooking';
import {
  fetchMyProfile,
  saveMyAvatar,
  sendChangeEmailOtp,
  sendChangeMobileOtp,
  updateMyProfile,
  uploadMyAvatar,
  verifyChangeEmailOtp,
  verifyChangeMobileOtp,
} from '@/lib/shopProfile';
import { fetchMyKyc, saveMyKyc, uploadMyKycFile } from '@/lib/shopKyc';
import { fetchSubscriptionMe } from '@/lib/shopSubscription';
import { fetchShopBookings, recentBookings } from '@/lib/shopDashboard';
import { updateShopLocation } from '@/lib/shopLocations';
import { notifyError, notifySuccess } from '@/lib/toast';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';
const INPUT_CLS = 'w-full rounded-xl border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-sm text-[#111111] transition focus:border-[#024A57] focus:outline-none focus:ring-[3px] focus:ring-[#ECECEC]';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TABS = [
  { key: 'personal', label: 'Personal Information', icon: User },
  { key: 'kyc', label: 'KYC Document', icon: IdCard },
  { key: 'subscription', label: 'Subscription', icon: CreditCard },
  { key: 'qr', label: 'My QR Code', icon: QrCodeIcon },
  { key: 'pickup', label: 'Pickup Service', icon: Truck },
  { key: 'orders', label: 'My Orders', icon: ClipboardList },
];

const KYC_STATUS_BADGE = {
  APPROVED: { tone: 'bg-[#F3F3F3] text-[#024A57]', label: 'Verified' },
  REJECTED: { tone: 'bg-red-100 text-red-700', label: 'Rejected' },
  PENDING_REVIEW: { tone: 'bg-sky-100 text-sky-700', label: 'Under Review' },
};

const STATUS_BADGE = {
  Created: 'bg-[#F3F3F3] text-[#024A57]',
  'In Progress': 'bg-sky-100 text-sky-700',
  Pickup: 'bg-orange-100 text-orange-700',
  Completed: 'bg-violet-100 text-violet-700',
  Cancelled: 'bg-red-100 text-red-700',
};

function formatMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return digits ? `+91 ${digits}` : null;
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return null;
  }
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <section className="min-w-0 rounded-3xl border border-[#ECECEC] bg-[#F8F8F8] p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[#111111]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-[#666666]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ReadOnlyField({ label, icon: Icon, value }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-semibold text-[#344054]">{label}</label>
      <div className="flex items-center gap-2.5 rounded-xl border border-[#ECECEC] bg-[#F8F8F8] px-3.5 py-2.5 text-sm font-medium text-[#111111]">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#666666]" aria-hidden="true" /> : null}
        <span className="truncate">{value || '—'}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Personal Information                                                        */
/* -------------------------------------------------------------------------- */

function AvatarWithUpload({ avatarUrl, name, uploading, onPick }) {
  const [failed, setFailed] = useState(false);
  const validImage = avatarUrl && !failed;

  useEffect(() => setFailed(false), [avatarUrl]);

  return (
    <span className="relative inline-flex shrink-0">
      <span className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#024A57] text-xl font-bold text-white ring-4 ring-white">
        {validImage ? (
          <img src={avatarUrl} alt={`${name || 'Owner'} avatar`} className="h-full w-full object-cover" onError={() => setFailed(true)} />
        ) : (
          initialsOf(name)
        )}
      </span>
      <button
        type="button"
        onClick={onPick}
        disabled={uploading}
        aria-label={avatarUrl ? 'Change profile photo' : 'Upload profile photo'}
        className={cx(
          'absolute -bottom-0.5 -right-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#024A57] shadow-[0_1px_4px_rgba(16,24,40,0.2)] ring-2 ring-white transition hover:bg-[#F8F8F8]',
          FOCUS_RING,
        )}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Camera className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
    </span>
  );
}

function FieldShell({ label, editing, onEdit, children }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-sm font-semibold text-[#344054]">{label}</label>
        {!editing && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${label}`}
            className={cx('inline-flex items-center gap-1 text-xs font-semibold text-[#024A57] hover:underline', FOCUS_RING)}
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Simple direct-save edit — used for Name, which has no login-identity implications. */
function EditableNameField({ profile, onSaved }) {
  const name = profile ? deriveDisplayName(profile) : '';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startEdit = () => { setValue(name); setError(''); setEditing(true); };
  const cancel = () => { setEditing(false); setError(''); };

  const save = async () => {
    if (!value.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const updated = await updateMyProfile({ name: value.trim() });
      updateShopOwnerSession(updated);
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      notifyError(err.body?.message || err.message || 'Could not save your name.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <FieldShell label="Full Name" onEdit={startEdit}>
        <div className="flex items-center gap-2.5 rounded-xl border border-[#ECECEC] bg-[#F8F8F8] px-3.5 py-2.5 text-sm font-medium text-[#111111]">
          <User className="h-4 w-4 shrink-0 text-[#666666]" aria-hidden="true" />
          <span className="truncate">{name || '—'}</span>
        </div>
      </FieldShell>
    );
  }

  return (
    <FieldShell label="Full Name" editing>
      <input value={value} onChange={(e) => setValue(e.target.value)} className={INPUT_CLS} autoFocus />
      {error ? <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={cx('inline-flex items-center gap-1.5 rounded-lg bg-[#F3BF23] px-3 py-1.5 text-xs font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:opacity-60', FOCUS_RING)}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={cancel}
          className={cx('inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Cancel
        </button>
      </div>
    </FieldShell>
  );
}

/**
 * Email/mobile edit — these double as login identifiers, so changing either
 * requires proving control of the NEW value first: enter it, send an OTP to
 * THAT value, then verify before it's saved. Mobile's "OTP" is always 123456
 * (no SMS gateway anywhere in this codebase); email gets a real emailed code.
 */
function EditableContactField({ type, label, icon: Icon, currentValue, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState('input'); // 'input' | 'otp'
  const [value, setValue] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  const startEdit = () => { setValue(''); setOtp(''); setStep('input'); setError(''); setHint(''); setEditing(true); };
  const cancel = () => { setEditing(false); setStep('input'); setError(''); };

  const sendOtp = async () => {
    setError('');
    const trimmed = value.trim();
    if (type === 'email') {
      if (!EMAIL_RE.test(trimmed)) { setError('Enter a valid email address.'); return; }
    } else if (trimmed.replace(/\D/g, '').length !== 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setSending(true);
    try {
      const res = type === 'email' ? await sendChangeEmailOtp(trimmed) : await sendChangeMobileOtp(trimmed);
      setHint(res?.defaultOtp ? `For testing, use OTP ${res.defaultOtp}.` : `We've sent a code to ${trimmed}.`);
      setStep('otp');
    } catch (err) {
      notifyError(err.body?.message || err.message || 'Could not send OTP.');
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (otp.trim().length < 6) { setError('Enter the 6-digit code.'); return; }
    setError('');
    setVerifying(true);
    try {
      const trimmed = value.trim();
      const updated = type === 'email'
        ? await verifyChangeEmailOtp(trimmed, otp.trim())
        : await verifyChangeMobileOtp(trimmed, otp.trim());
      updateShopOwnerSession(updated);
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      notifyError(err.status === 401 ? 'Invalid OTP. Please check the code and try again.' : (err.body?.message || err.message || 'Verification failed.'));
    } finally {
      setVerifying(false);
    }
  };

  if (!editing) {
    return (
      <FieldShell label={label} onEdit={startEdit}>
        <div className="flex items-center gap-2.5 rounded-xl border border-[#ECECEC] bg-[#F8F8F8] px-3.5 py-2.5 text-sm font-medium text-[#111111]">
          {Icon ? <Icon className="h-4 w-4 shrink-0 text-[#666666]" aria-hidden="true" /> : null}
          <span className="truncate">{currentValue || '—'}</span>
        </div>
      </FieldShell>
    );
  }

  return (
    <FieldShell label={label} editing>
      {step === 'input' ? (
        <>
          <input
            value={value}
            onChange={(e) => setValue(type === 'mobile' ? e.target.value.replace(/[^0-9]/g, '').slice(0, 10) : e.target.value)}
            placeholder={type === 'email' ? 'New email address' : 'New 10-digit mobile number'}
            type={type === 'email' ? 'email' : 'tel'}
            inputMode={type === 'mobile' ? 'numeric' : undefined}
            className={INPUT_CLS}
            autoFocus
          />
          {error ? <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">{error}</p> : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={sendOtp}
              disabled={sending}
              className={cx('inline-flex items-center gap-1.5 rounded-lg bg-[#F3BF23] px-3 py-1.5 text-xs font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:opacity-60', FOCUS_RING)}
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {sending ? 'Sending…' : 'Send OTP'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className={cx('inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-1.5 text-xs text-[#666666]">Enter the 6-digit code sent to {value.trim()}.</p>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="6-digit code"
            className={cx(INPUT_CLS, 'tracking-widest')}
            autoFocus
          />
          {hint ? <p className="mt-1.5 text-xs text-[#666666]">{hint}</p> : null}
          {error ? <p role="alert" className="mt-1.5 text-xs font-semibold text-red-600">{error}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={verify}
              disabled={verifying}
              className={cx('inline-flex items-center gap-1.5 rounded-lg bg-[#F3BF23] px-3 py-1.5 text-xs font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:opacity-60', FOCUS_RING)}
            >
              {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {verifying ? 'Verifying…' : 'Verify & Save'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('input'); setError(''); }}
              className={cx('inline-flex items-center rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}
            >
              Back
            </button>
            <button
              type="button"
              onClick={cancel}
              className={cx('inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </button>
          </div>
        </>
      )}
    </FieldShell>
  );
}

function PersonalInformationTab({ profile, onProfileUpdated }) {
  const name = profile ? deriveDisplayName(profile) : '';
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const pickAvatar = () => {
    setError('');
    inputRef.current?.click();
  };

  const onAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;

    const nameLooksAllowed = /\.(png|jpe?g)$/i.test(file.name || '');
    const typeLooksAllowed = ['image/png', 'image/jpeg'].includes(file.type);
    if (!nameLooksAllowed && !typeLooksAllowed) {
      setError('Choose a PNG or JPG image.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setError('Choose an image smaller than 1 MB.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const url = await uploadMyAvatar(file);
      const updated = await saveMyAvatar(url);
      updateShopOwnerSession(updated);
      onProfileUpdated(updated);
    } catch (err) {
      notifyError(err?.message || 'Could not upload your photo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Personal Information" subtitle="Manage your personal details and keep your contact info up to date.">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" className="hidden" onChange={onAvatarFile} />

        <div className="mb-6 flex items-center gap-4">
          <AvatarWithUpload avatarUrl={profile?.avatarUrl} name={name} uploading={uploading} onPick={pickAvatar} />
          <div>
            <p className="text-sm font-bold text-[#111111]">Profile photo</p>
            <p className="text-xs text-[#666666]">PNG or JPG, up to 1 MB.</p>
            {error ? <p className="mt-1 text-xs font-semibold text-red-600">{error}</p> : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <EditableNameField profile={profile} onSaved={onProfileUpdated} />
          <EditableContactField
            type="email"
            label="Email Address"
            icon={Mail}
            currentValue={profile?.email}
            onSaved={onProfileUpdated}
          />
          <EditableContactField
            type="mobile"
            label="Mobile Number"
            icon={Phone}
            currentValue={formatMobile(profile?.phone)}
            onSaved={onProfileUpdated}
          />
          <ReadOnlyField label="Business" icon={Store} value={profile?.locations?.[0]?.name} />
        </div>
        <p className="mt-5 text-xs text-[#98A2B3]">
          Changing your email or mobile number requires verifying the new one with a one-time code, since
          they&apos;re also what you sign in with.
        </p>
      </SectionCard>

      <AddressSection profile={profile} onSaved={onProfileUpdated} />
    </div>
  );
}

/**
 * Personal (residential) address — separate from a shop's own address, which
 * lives per-location on the Business Profile page. Backed by the same
 * PATCH /auth/me as the name field above (personalAddress/addrState/
 * addrDistrict/addrTaluk/addrArea/addrStreet/addrPincode columns on User,
 * already read/written by the admin's owner-edit form — this is just the
 * first owner-scoped UI for them). One edit toggle for the whole address
 * rather than per-field like email/mobile, since there's no login-identity
 * concern here and editing seven fields one at a time would be tedious.
 */
function AddressSection({ profile, onSaved }) {
  const emptyForm = {
    personalAddress: '', addrStreet: '', addrArea: '', addrTaluk: '', addrDistrict: '', addrState: '', addrPincode: '',
  };
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const startEdit = () => {
    setForm({
      personalAddress: profile?.personalAddress || '',
      addrStreet: profile?.addrStreet || '',
      addrArea: profile?.addrArea || '',
      addrTaluk: profile?.addrTaluk || '',
      addrDistrict: profile?.addrDistrict || '',
      addrState: profile?.addrState || '',
      addrPincode: profile?.addrPincode || '',
    });
    setEditing(true);
  };
  const cancel = () => { setEditing(false); };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateMyProfile(form);
      updateShopOwnerSession(updated);
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      notifyError(err.body?.message || err.message || 'Could not save your address.');
    } finally {
      setSaving(false);
    }
  };

  const summary = [profile?.addrStreet, profile?.addrArea, profile?.addrTaluk, profile?.addrDistrict, profile?.addrState, profile?.addrPincode]
    .filter(Boolean)
    .join(', ') || profile?.personalAddress || '';

  return (
    <SectionCard
      title="Address"
      subtitle="Your personal residential address"
      action={
        !editing ? (
          <button
            type="button"
            onClick={startEdit}
            className={cx('inline-flex items-center gap-1 text-xs font-semibold text-[#024A57] hover:underline', FOCUS_RING)}
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit
          </button>
        ) : null
      }
    >
      {!editing ? (
        summary ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-[#ECECEC] bg-[#F8F8F8] px-3.5 py-3 text-sm font-medium text-[#111111]">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#666666]" aria-hidden="true" />
            <span className="min-w-0 break-words">{summary}</span>
          </div>
        ) : (
          <p className="text-sm text-[#98A2B3]">No address added yet.</p>
        )
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-[#344054]">Address Line</label>
              <input value={form.personalAddress} onChange={(e) => setField('personalAddress', e.target.value)} placeholder="Building / landmark" className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#344054]">Street</label>
              <input value={form.addrStreet} onChange={(e) => setField('addrStreet', e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#344054]">Area</label>
              <input value={form.addrArea} onChange={(e) => setField('addrArea', e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#344054]">Taluk</label>
              <input value={form.addrTaluk} onChange={(e) => setField('addrTaluk', e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#344054]">District</label>
              <input value={form.addrDistrict} onChange={(e) => setField('addrDistrict', e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#344054]">State</label>
              <input value={form.addrState} onChange={(e) => setField('addrState', e.target.value)} className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#344054]">Pincode</label>
              <input
                value={form.addrPincode}
                onChange={(e) => setField('addrPincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                inputMode="numeric"
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={cx('inline-flex items-center gap-1.5 rounded-lg bg-[#F3BF23] px-3.5 py-2 text-xs font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:opacity-60', FOCUS_RING)}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className={cx('inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2 text-xs font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </button>
          </div>
        </>
      )}
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/* KYC Document                                                                */
/* -------------------------------------------------------------------------- */

function KycUploadCard({ label, hint, url, uploading, onFile }) {
  return (
    <div className="flex min-h-[150px] flex-col items-center rounded-xl border border-dashed border-[#D0D5DD] bg-[#F8F8F8] p-3">
      <div className="mb-1 flex w-full items-center justify-between">
        <span className="text-xs font-semibold text-[#111111]">{label}</span>
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#024A57] hover:underline">Open</a>}
      </div>
      <span className="mb-2 w-full text-[11px] text-[#666666]">{hint}</span>
      <div className="flex flex-1 w-full items-center justify-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="max-h-20 rounded object-contain" />
        ) : (
          <span className="text-xs text-[#98A2B3]">{uploading ? 'Uploading…' : 'No file'}</span>
        )}
      </div>
      <label className={cx('mt-2 w-full cursor-pointer rounded-lg bg-[#F3BF23] text-[#1E1E1E] hover:bg-[#E5B11A] py-1.5 text-center text-xs font-semibold transition', uploading && 'opacity-60')}>
        {url ? `Replace ${label}` : `Upload ${label}`}
        <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} disabled={uploading} />
      </label>
    </div>
  );
}

function KycDocumentTab() {
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [urls, setUrls] = useState({ aadharFrontUrl: '', aadharBackUrl: '', panUrl: '' });
  const [uploading, setUploading] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoadError('');
    return fetchMyKyc()
      .then((data) => {
        setKyc(data);
        setUrls({
          aadharFrontUrl: data?.aadharFrontUrl || '',
          aadharBackUrl: data?.aadharBackUrl || '',
          panUrl: data?.panUrl || '',
        });
      })
      .catch((err) => setLoadError(err.message || 'Could not load your KYC documents.'));
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleUpload = async (field, type, file) => {
    if (!file) return;
    setUploading((u) => ({ ...u, [field]: true }));
    try {
      const url = await uploadMyKycFile(file, type);
      setUrls((u) => ({ ...u, [field]: url }));
    } catch (err) {
      notifyError(err, 'Upload failed.');
    } finally {
      setUploading((u) => ({ ...u, [field]: false }));
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const updated = await saveMyKyc(urls);
      setKyc(updated);
      notifySuccess('Documents submitted for review.');
    } catch (err) {
      notifyError(err.body?.message || err.message || 'Could not submit your documents.');
    } finally {
      setSaving(false);
    }
  };

  const badge = kyc?.status ? KYC_STATUS_BADGE[kyc.status] : null;
  const hasAnyUpload = urls.aadharFrontUrl || urls.aadharBackUrl || urls.panUrl;

  if (loading) {
    return (
      <SectionCard title="KYC Document" subtitle="Aadhar and PAN verification for your account">
        <div className="flex items-center gap-2 text-sm text-[#666666]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="KYC Document"
      subtitle="Aadhar and PAN verification for your account"
      action={
        badge ? (
          <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold', badge.tone)}>{badge.label}</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-[#F3F3F3] px-2.5 py-1 text-xs font-bold text-[#98A2B3]">Not submitted</span>
        )
      }
    >
      {loadError ? (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : null}

      {kyc?.status === 'REJECTED' && kyc?.rejectReason ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Rejected: {kyc.rejectReason}. Upload clearer documents and submit again.</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KycUploadCard
          label="Aadhar Front"
          hint="Front side, all corners visible"
          url={urls.aadharFrontUrl}
          uploading={!!uploading.aadharFrontUrl}
          onFile={(f) => handleUpload('aadharFrontUrl', 'aadhaar-front', f)}
        />
        <KycUploadCard
          label="Aadhar Back"
          hint="Back side, all corners visible"
          url={urls.aadharBackUrl}
          uploading={!!uploading.aadharBackUrl}
          onFile={(f) => handleUpload('aadharBackUrl', 'aadhaar-back', f)}
        />
        <KycUploadCard
          label="PAN Card"
          hint="Clear photo or scan"
          url={urls.panUrl}
          uploading={!!uploading.panUrl}
          onFile={(f) => handleUpload('panUrl', 'pan', f)}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={saving || !hasAnyUpload}
        className={cx('mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#F3BF23] px-4 py-2.5 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-60', FOCUS_RING)}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {saving ? 'Submitting…' : 'Submit for Review'}
      </button>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Subscription                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 2026-09: this tab used to duplicate the full plan-card UI inline — now a
 * real, separate page exists at /shop-home/settings/subscription (plan
 * cards, feature checklists, the multi-shop stepper, per a reference
 * design). Keeping both meant two different Subscription UIs could drift
 * out of sync (and did — this tab was still showing the old 3-tile
 * layout after that page was rebuilt). This tab is now just the current-
 * plan summary + a link to that one real page, so there's exactly one
 * place the full plan details/UI live.
 */
function SubscriptionTab({ ownerId }) {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Subscription v2: GET /subscriptions/me (owner from the shop JWT) carries the
  // server-built plan name/duration, so no plan-catalog lookup is needed here.
  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    fetchSubscriptionMe()
      .then((me) => {
        if (!cancelled) setSub(me?.subscription && me.subscription.status !== 'NONE' ? me.subscription : null);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your subscription right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [ownerId]);

  const planLabel = sub ? `${sub.planName || sub.planCode}${sub.durationLabel ? ` · ${sub.durationLabel}` : ''}` : 'No active plan';
  const daysRemaining = sub?.daysRemaining ?? 0;

  if (loading) {
    return (
      <SectionCard title="Subscription" subtitle="View your plan & upgrade">
        <div className="flex items-center gap-2 text-sm text-[#666666]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Subscription" subtitle="View your plan & upgrade">
      {error ? (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[#024A57]">Current plan</p>
          <p className="mt-1 text-xl font-bold text-[#111111]">{planLabel}</p>
          {sub ? (
            <p className="mt-1 text-sm text-[#666666]">
              {daysRemaining > 0 ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining` : 'No active window'}
              {sub.status ? ` · ${String(sub.status).replace(/_/g, ' ')}` : ''}
              {sub.endsAt ? ` · renews/expires ${formatDate(sub.endsAt)}` : ''}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[#666666]">No subscription record found for this account yet.</p>
          )}
        </div>
        <Link
          href="/shop-home/settings/subscription"
          className={cx('inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#F3BF23] px-4 py-2.5 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A]', FOCUS_RING)}
        >
          View Plans &amp; Pricing
        </Link>
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/* My QR Code                                                                  */
/* -------------------------------------------------------------------------- */

function mapsSearchUrl(location) {
  const parts = [location?.name, location?.street, location?.area, location?.taluk, location?.district, location?.state, location?.pincode].filter(Boolean);
  const q = encodeURIComponent(parts.join(', ') || 'India');
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function QrCodeTab({ mainLocation }) {
  const [dataUrl, setDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const targetUrl = useMemo(() => mapsSearchUrl(mainLocation), [mainLocation]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(targetUrl, { width: 240, margin: 1, color: { dark: '#101828', light: '#FFFFFF' } })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [targetUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the link is still visible to copy manually */
    }
  };

  return (
    <SectionCard title="My QR Code" subtitle="Share your shop instantly">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="flex h-64 w-64 max-w-full shrink-0 items-center justify-center rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] p-4">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt={`QR code linking to ${mainLocation?.name || 'your shop'} on Google Maps`} className="h-full w-full" />
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-[#98A2B3]" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-bold text-[#111111]">{mainLocation?.name || 'Your shop'}</p>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-[#666666]">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Scanning this code opens your shop&apos;s location on Google Maps — print it at the counter or share it
            with customers so they can find you or drop a pickup pin.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {dataUrl ? (
              <a
                href={dataUrl}
                download={`ggfix-shop-qr-${(mainLocation?.name || 'shop').toLowerCase().replace(/\s+/g, '-')}.png`}
                className={cx('inline-flex items-center gap-1.5 rounded-xl bg-[#F3BF23] px-4 py-2.5 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A]', FOCUS_RING)}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download QR
              </a>
            ) : null}
            <button
              type="button"
              onClick={copyLink}
              className={cx('inline-flex items-center gap-1.5 rounded-xl border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F8F8F8]', FOCUS_RING)}
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-[#024A57]" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Pickup Service                                                              */
/* -------------------------------------------------------------------------- */

function PickupServiceTab({ ownerId, locations, onSaved }) {
  const [selectedId, setSelectedId] = useState(locations[0]?.id || '');
  const selected = locations.find((l) => l.id === selectedId) || locations[0];
  const [form, setForm] = useState({
    pickupEnabled: !!selected?.pickupEnabled,
    pickupFromTime: selected?.pickupFromTime || '',
    pickupToTime: selected?.pickupToTime || '',
    pickupDistanceKm: selected?.pickupDistanceKm ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      pickupEnabled: !!selected?.pickupEnabled,
      pickupFromTime: selected?.pickupFromTime || '',
      pickupToTime: selected?.pickupToTime || '',
      pickupDistanceKm: selected?.pickupDistanceKm ?? '',
    });
  }, [selected?.id]);

  const setField = (k, v) => { setForm((f) => ({ ...f, [k]: v })); };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateShopLocation(ownerId, selected.id, {
        pickupEnabled: form.pickupEnabled,
        pickupFromTime: form.pickupFromTime,
        pickupToTime: form.pickupToTime,
        pickupDistanceKm: form.pickupDistanceKm === '' ? null : Number(form.pickupDistanceKm),
      });
      notifySuccess('Pickup settings saved.');
      await onSaved();
    } catch (err) {
      notifyError(err.body?.message || err.message || 'Could not save pickup settings.');
    } finally {
      setSaving(false);
    }
  };

  if (locations.length === 0) {
    return (
      <SectionCard title="Pickup Service" subtitle="Turn pickup on/off, slot timings & zones">
        <p className="text-sm text-[#666666]">Add a business location first — pickup settings live on each location.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Pickup Service"
      subtitle="Turn pickup on/off, slot timings & zones"
      action={
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={cx('inline-flex items-center gap-1.5 rounded-xl bg-[#F3BF23] px-4 py-2.5 text-sm font-semibold text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-60', FOCUS_RING)}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      }
    >
      {locations.length > 1 ? (
        <div className="mb-5">
          <label className="mb-1.5 block text-sm font-semibold text-[#344054]">Location</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={INPUT_CLS}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#ECECEC] bg-[#F8F8F8] px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#111111]">Pickup Service</p>
          <p className="text-xs text-[#666666]">Let nearby customers request a device pickup from this location.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.pickupEnabled}
          onClick={() => setField('pickupEnabled', !form.pickupEnabled)}
          className={cx('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition', form.pickupEnabled ? 'bg-[#024A57]' : 'bg-[#D0D5DD]', FOCUS_RING)}
        >
          <span className={cx('inline-block h-5 w-5 transform rounded-full bg-white transition', form.pickupEnabled ? 'translate-x-6' : 'translate-x-1')} />
        </button>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#344054]">Pickup From</label>
          <input value={form.pickupFromTime} onChange={(e) => setField('pickupFromTime', e.target.value)} placeholder="09:00 AM" className={INPUT_CLS} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#344054]">Pickup To</label>
          <input value={form.pickupToTime} onChange={(e) => setField('pickupToTime', e.target.value)} placeholder="07:00 PM" className={INPUT_CLS} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[#344054]">Pickup Zone (km)</label>
          <input
            type="number"
            min="0"
            value={form.pickupDistanceKm}
            onChange={(e) => setField('pickupDistanceKm', e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 5"
            className={INPUT_CLS}
          />
        </div>
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/* My Orders                                                                   */
/* -------------------------------------------------------------------------- */

function MyOrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchShopBookings()
      .then((list) => { if (!cancelled) setOrders(recentBookings(list, 8)); })
      .catch(() => { if (!cancelled) setError('Could not load your orders right now.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <SectionCard
      title="My Orders"
      subtitle="View your orders & history"
      action={
        <Link href="/shop-home/services/bookings" className="text-sm font-semibold text-[#024A57] hover:underline">
          View all
        </Link>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-[#666666]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…</div>
      ) : error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <ClipboardList className="h-6 w-6 text-[#98A2B3]" aria-hidden="true" />
          <p className="mt-2 text-sm text-[#666666]">No orders yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#ECECEC]">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center gap-3 py-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F8F8F8]">
                <Smartphone className="h-5 w-5 text-[#024A57]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#111111]">{order.issueSummary || 'Service booking'}</p>
                <p className="truncate text-xs text-[#666666]">{order.customerName || 'Customer'} · #{order.bookingNumber}</p>
              </div>
              <div className="hidden shrink-0 text-right text-xs text-[#666666] sm:block">
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''}
              </div>
              <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide', STATUS_BADGE[order.statusLabel] || 'bg-[#F8F8F8] text-[#666666]')}>
                {order.statusLabel}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Shop login: own shop only                                                   */
/* -------------------------------------------------------------------------- */

/**
 * What a SHOP login (signed in with the shop's own mobile) sees instead of the
 * owner's Personal Information. Read from the shop's public record
 * (GET /auth/shops/{shopId}/public, shopId from the session's JWT) — never
 * GET /auth/me, which is the owner's private profile.
 */
function ShopInformationTab({ shop }) {
  const address = [shop?.address, shop?.district, shop?.state, shop?.pincode].filter(Boolean).join(', ');
  return (
    <SectionCard title="Shop Information" subtitle="Details of the shop you are signed in to. The business owner manages these.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Shop Name" icon={Store} value={shop?.name} />
        <ReadOnlyField label="Shop Mobile" icon={Phone} value={formatMobile(shop?.mobile)} />
        <div className="sm:col-span-2">
          <ReadOnlyField label="Shop Address" icon={MapPin} value={address} />
        </div>
      </div>
    </SectionCard>
  );
}

/** Pickup hours for a SHOP login — view only; changing them is an owner action. */
function ShopPickupTab({ shop }) {
  const hours =
    shop?.pickupFromTime && shop?.pickupToTime ? `${String(shop.pickupFromTime).slice(0, 5)} – ${String(shop.pickupToTime).slice(0, 5)}` : '';
  return (
    <SectionCard title="Pickup Service" subtitle="Doorstep pickup for this shop. Ask the business owner to change these settings.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReadOnlyField label="Pickup" icon={Truck} value={hours ? 'Enabled' : 'Not enabled'} />
        <ReadOnlyField label="Pickup Hours" icon={Truck} value={hours} />
      </div>
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function AccountSettingsPage() {
  const [activeTab, setActiveTab] = useState('personal');
  const [profile, setProfile] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // Who is signed in decides the data source. OWNER: GET /auth/me — the
  // owner's own identity, independent of whichever shop is active. SHOP: only
  // that shop's public record; the owner's profile is never fetched.
  const [session, setSession] = useState(undefined);
  useEffect(() => setSession(readShopOwner()), []);
  const owner = isOwnerSession(session);

  const load = useCallback(() => {
    setLoadError('');
    if (session === undefined) return Promise.resolve();
    if (!owner) {
      if (!session?.shopId) {
        setLoadError('Could not identify your shop. Please sign in again.');
        return Promise.resolve();
      }
      return getShopPublic(session.shopId).then((data) => {
        if (data) setShop(data);
        else setLoadError('Could not load your shop details.');
      });
    }
    return fetchMyProfile()
      .then((data) => setProfile(data))
      .catch((err) => setLoadError(err.message || 'Could not load your account.'));
  }, [session, owner]);

  useEffect(() => {
    if (session === undefined) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load, session]);

  // Owner-only tabs (KYC = the owner's identity documents, Subscription = the
  // owner's plan) don't exist for a shop login — not just hidden, never rendered.
  const tabs = useMemo(
    () =>
      owner
        ? TABS
        : TABS.filter((t) => !OWNER_ONLY_TABS.includes(t.key)).map((t) => (t.key === 'personal' ? { ...t, label: 'Shop Information', icon: Store } : t)),
    [owner],
  );
  useEffect(() => {
    if (!tabs.some((t) => t.key === activeTab)) setActiveTab('personal');
  }, [tabs, activeTab]);

  const locations = profile?.locations || [];
  const ownerId = profile?.id;
  const shopForQr = shop ? { name: shop.name, street: shop.address, district: shop.district, state: shop.state, pincode: shop.pincode } : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Account Settings" subtitle="Manage your personal, subscription and shop preferences" />

      <div className="flex gap-1 overflow-x-auto border-b border-[#ECECEC]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cx(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition',
                active ? 'border-[#024A57] text-[#024A57]' : 'border-transparent text-[#666666] hover:text-[#111111]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loadError ? (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : null}

      {loading || session === undefined ? (
        <div className="h-64 animate-pulse rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]" />
      ) : (
        <>
          {owner ? (
            <>
              {activeTab === 'personal' ? <PersonalInformationTab profile={profile} onProfileUpdated={setProfile} /> : null}
              {activeTab === 'kyc' ? <KycDocumentTab /> : null}
              {activeTab === 'subscription' ? <SubscriptionTab ownerId={ownerId} /> : null}
              {activeTab === 'qr' ? <QrCodeTab mainLocation={locations[0]} /> : null}
              {activeTab === 'pickup' ? <PickupServiceTab ownerId={ownerId} locations={locations} onSaved={load} /> : null}
            </>
          ) : (
            <>
              {activeTab === 'personal' ? <ShopInformationTab shop={shop} /> : null}
              {activeTab === 'qr' ? <QrCodeTab mainLocation={shopForQr} /> : null}
              {activeTab === 'pickup' ? <ShopPickupTab shop={shop} /> : null}
            </>
          )}
          {activeTab === 'orders' ? <MyOrdersTab /> : null}
        </>
      )}
    </div>
  );
}
