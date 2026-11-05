'use client';

/**
 * Customer Personal Information at /account/profile.
 *
 * The website now uses the same profile contract as the customer app:
 * GET/PUT user-service /customer/profile. Avatar files are stored through the
 * master-data media endpoint (S3 behind media.ggfix.in); only the returned HTTPS
 * URL is saved in user-service's profile_image_url column.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Edit3,
  Loader2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import {
  getCustomerProfile,
  updateCustomerProfile,
  uploadCustomerAvatar,
} from '@/lib/customerAccount';
import { readCustomer, updateCustomerSession } from '@/lib/customerAuth';
import {
  AccountError,
  AccountLoader,
  AccountPageHeader,
  Panel,
  initialsOf,
} from '@/components/site/account/ui';
import { notifyError, notifySuccess } from '@/lib/toast';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  mobile: '',
  alternateMobile: '',
  profileImageUrl: '',
};

function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' '),
  };
}

function formFromProfile(profile) {
  return {
    ...EMPTY_FORM,
    ...splitFullName(profile?.fullName),
    email: profile?.email || '',
    mobile: profile?.mobile || '',
    alternateMobile: profile?.alternateMobile || '',
    profileImageUrl: profile?.profileImageUrl || '',
  };
}

function digitsOnly(value) {
  let digits = String(value || '').replace(/\D/g, '');
  // Let a customer paste +91 98765 43210, but persist the API's normal
  // 10-digit representation used by OTP login and the mobile app.
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return digits;
}

function ProfileAvatar({ imageUrl, fullName, className = '' }) {
  const [failed, setFailed] = useState(false);
  const validImage = imageUrl && !failed;

  useEffect(() => setFailed(false), [imageUrl]);

  return (
    <span className={cx('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-brand-700', className)}>
      {validImage ? (
        <img
          src={imageUrl}
          alt={`${fullName || 'Customer'} avatar`}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-xl font-extrabold">{initialsOf(fullName)}</span>
      )}
    </span>
  );
}

function Field({ label, icon: Icon, readOnly, className, ...props }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-brand-muted">
        {Icon ? <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" /> : null}
        {label}
      </span>
      <input
        {...props}
        readOnly={readOnly}
        className={cx(
          'block h-11 w-full rounded-xl border px-3 text-sm font-semibold text-brand-ink outline-none transition',
          'placeholder:font-normal placeholder:text-brand-subtle focus:border-brand-600 focus:ring-2 focus:ring-brand-100',
          readOnly ? 'cursor-default border-brand-line bg-brand-soften text-brand-muted' : 'border-brand-strong bg-white',
        )}
      />
    </label>
  );
}

export default function AccountProfilePage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const session = readCustomer();
    const fallback = formFromProfile(session);
    try {
      const live = await getCustomerProfile();
      const next = formFromProfile({
        ...fallback,
        ...live,
        fullName: live?.fullName ?? session?.fullName,
        email: live?.email ?? session?.email,
        mobile: live?.mobile ?? session?.mobile,
      });
      setForm(next);
      setSavedForm(next);
      if (live) updateCustomerSession(live);
    } catch (requestError) {
      // Session data still makes the form useful while a service restarts, but
      // make the problem visible instead of silently showing stale identity.
      setForm(fallback);
      setSavedForm(fallback);
      setError(requestError?.message || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = (key, value) => {
    setError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const startEditing = () => {
    setError('');
    setForm(savedForm);
    setEditing(true);
  };

  const cancelEditing = () => {
    setForm(savedForm);
    setError('');
    setEditing(false);
  };

  const chooseAvatar = () => {
    if (!editing) setEditing(true);
    window.setTimeout(() => inputRef.current?.click(), 0);
  };

  const onAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;

    const nameLooksAllowed = /\.(png|jpe?g)$/i.test(file.name || '');
    const typeLooksAllowed = ['image/png', 'image/jpeg'].includes(file.type);
    if (!nameLooksAllowed && !typeLooksAllowed) {
      notifyError('Choose a PNG or JPG image.');
      return;
    }
    if (file.size > 1024 * 1024) {
      notifyError('Choose an image smaller than 1 MB.');
      return;
    }

    setAvatarUploading(true);
    try {
      const profileImageUrl = await uploadCustomerAvatar(file);
      setForm((current) => ({ ...current, profileImageUrl }));
      notifySuccess('Avatar uploaded. Save changes to apply it to your profile.');
      setEditing(true);
    } catch (uploadError) {
      notifyError(uploadError, 'Could not upload your avatar.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const mobile = digitsOnly(form.mobile);
    const alternateMobile = digitsOnly(form.alternateMobile);
    const email = form.email.trim();

    if (!firstName) {
      notifyError('Enter your first name.');
      return;
    }
    if (mobile.length !== 10) {
      notifyError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (alternateMobile && alternateMobile.length !== 10) {
      notifyError('Enter a valid 10-digit alternate mobile number.');
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      notifyError('Enter a valid email address.');
      return;
    }

    setSaving(true);
    try {
      const saved = await updateCustomerProfile({
        fullName: [firstName, lastName].filter(Boolean).join(' '),
        email,
        mobile,
        alternateMobile,
        profileImageUrl: form.profileImageUrl || '',
      });
      const next = formFromProfile(saved);
      setForm(next);
      setSavedForm(next);
      updateCustomerSession(saved);
      setEditing(false);
      notifySuccess('Personal information saved successfully.');
    } catch (saveError) {
      notifyError(saveError, 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AccountLoader label="Loading personal information…" />;

  return (
    <div>
      <AccountPageHeader
        eyebrow="My Account"
        title="Personal Information"
        subtitle="Keep your contact details and profile photo up to date."
        right={(
          <button
            type="button"
            onClick={editing ? cancelEditing : startEditing}
            className={cx(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition',
              editing ? 'border-brand-line bg-white text-brand-ink hover:bg-brand-soften' : 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700',
            )}
          >
            {editing ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
            {editing ? 'Cancel editing' : 'Edit details'}
          </button>
        )}
      />

      {error && !editing ? <div className="mt-5"><AccountError message={error} onRetry={load} /></div> : null}

      <Panel className="mt-6 overflow-hidden">
        <div className="border-b border-brand-line bg-brand-50/60 px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-center gap-4">
            <ProfileAvatar
              imageUrl={form.profileImageUrl}
              fullName={[form.firstName, form.lastName].filter(Boolean).join(' ')}
              className="h-20 w-20 border-4 border-white shadow-soft"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold text-brand-ink">
                {[form.firstName, form.lastName].filter(Boolean).join(' ') || 'NearGFix Customer'}
              </p>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-brand-700">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Verified customer
              </span>
            </div>
            <div className="shrink-0">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                className="hidden"
                onChange={onAvatarFile}
              />
              <button
                type="button"
                disabled={avatarUploading}
                onClick={chooseAvatar}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-strong bg-white px-3.5 py-2 text-sm font-bold text-brand-ink transition hover:border-brand-600 hover:text-brand-700 disabled:cursor-wait disabled:opacity-60"
              >
                {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {avatarUploading ? 'Uploading…' : form.profileImageUrl ? 'Change avatar' : 'Upload avatar'}
              </button>
              <p className="mt-1.5 text-xs text-brand-muted">PNG or JPG · maximum 1 MB</p>
            </div>
          </div>
        </div>

        <form onSubmit={save} className="p-5 sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="First Name" icon={User} readOnly={!editing} value={form.firstName} onChange={(event) => update('firstName', event.target.value)} placeholder="Enter first name" autoComplete="given-name" />
            <Field label="Last Name" icon={User} readOnly={!editing} value={form.lastName} onChange={(event) => update('lastName', event.target.value)} placeholder="Enter last name" autoComplete="family-name" />
            <Field label="Email Address" icon={Mail} readOnly={!editing} value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="name@example.com" type="email" autoComplete="email" />
            <Field label="Mobile Number" icon={Phone} readOnly={!editing} value={form.mobile} onChange={(event) => update('mobile', event.target.value)} placeholder="9876543210" inputMode="numeric" autoComplete="tel" />
            <Field label="Alternate Mobile Number" icon={Phone} readOnly={!editing} value={form.alternateMobile} onChange={(event) => update('alternateMobile', event.target.value)} placeholder="Optional alternate number" inputMode="numeric" autoComplete="tel" />
          </div>

          {editing ? (
            <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-brand-line pt-5">
              <button
                type="submit"
                disabled={saving || avatarUploading}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-brand-700 disabled:cursor-wait disabled:bg-brand-300"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" onClick={cancelEditing} disabled={saving} className="rounded-xl border border-brand-line bg-white px-4 py-3 text-sm font-bold text-brand-ink transition hover:bg-brand-soften disabled:opacity-60">Cancel</button>
            </div>
          ) : null}
        </form>
      </Panel>
    </div>
  );
}
