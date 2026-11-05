'use client';

/**
 * /shop-home/employee/team/edit/?id=<employeeId> — "Edit Profile", as in the
 * Partner app: photo + Active, Basic Information, Work Information (date of
 * join / birth, shift with check-in / check-out), Identity Verification
 * (Aadhaar + PAN front/back + number), Salary Package, App Login, and Delete
 * Employee, with Cancel / Save Changes.
 *
 * Data (ticket-service, helpers in src/lib/shopDashboard.js):
 *   - GET    /technicians/{id}  — prefill (TechnicianResponse)
 *   - PATCH  /technicians/{id}  — Save Changes (UpdateTechnicianRequest)
 *   - DELETE /technicians/{id}  — Delete Employee
 * Photos / ID images upload through the media service (uploadShopFile) and
 * are saved as their URLs. The update request has no password field, so App
 * Login is shown read-only (enabled when the employee has a linked user).
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  Camera,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
  User,
  Wallet,
  X,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import { deleteTechnician, fetchTechnician, updateTechnician } from '@/lib/shopDashboard';
import { uploadShopFile } from '@/lib/shopBooking';
import { resolveMediaUrl } from '@/lib/deviceImage';
import { notifyError, notifySuccess } from '@/lib/toast';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
const INPUT =
  'mt-1.5 w-full rounded-xl border border-[#E4E7EC] bg-white px-3.5 py-2.5 text-[14.5px] text-[#111111] placeholder:text-[#98A2B3] focus:border-[#035C6C] focus:outline-none focus:ring-4 focus:ring-[#035C6C]/10';
const ROLES = ['Technician', 'Staff', 'Pickup Person'];
const SHIFTS = [
  { key: 'general', label: 'General Shift', in: '09:30', out: '18:30' },
  { key: 'morning', label: 'Morning Shift', in: '07:00', out: '15:00' },
  { key: 'evening', label: 'Evening Shift', in: '14:00', out: '22:00' },
  { key: 'custom', label: 'Custom' },
];
const MAX_MB = 2;

const hhmm = (v) => {
  const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
};
const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');
const digits = (v) => String(v || '').replace(/\D/g, '');

function Card({ icon: Icon, title, children }) {
  return (
    <section className="min-w-0 rounded-[22px] border border-[#ECECEC] bg-white p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2.5 text-[16px] font-extrabold text-[#111111]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E5F3F5] text-[#035C6C]">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, required, children, className }) {
  return (
    <label className={cx('block text-[13px] font-semibold text-[#475467]', className)}>
      {label}
      {required ? <span className="text-[#D92D20]"> *</span> : null}
      {children}
    </label>
  );
}

/** Dashed upload box; shows the uploaded image with a remove button. */
function UploadBox({ label, url, uploading, onPick, onClear }) {
  const src = resolveMediaUrl(url);
  return (
    <div className="relative">
      {src ? (
        <div className="relative h-[92px] overflow-hidden rounded-2xl border border-[#C7E6EA] bg-[#F8F8F8]">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded ID image from the media service. */}
          <img src={src} alt={label} className="h-full w-full object-contain" />
          <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#B42318] shadow">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label className={cx('flex h-[92px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#5BBF73] bg-[#E5F3F5] text-center transition hover:bg-[#E3F4E7]', uploading && 'pointer-events-none opacity-70')}>
          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-[#035C6C]" aria-hidden="true" /> : <UploadCloud className="h-5 w-5 text-[#035C6C]" aria-hidden="true" />}
          <span className="mt-1 text-[13.5px] font-bold text-[#035C6C]">{uploading ? 'Uploading…' : label}</span>
          <span className="text-[11px] text-[#667085]">JPG, PNG (Max {MAX_MB}MB)</span>
          <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}

export default function EditEmployeePage() {
  const id = useSearchParams().get('id');
  const router = useRouter();
  const [tech, setTech] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fieldErr, setFieldErr] = useState({});

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    fetchTechnician(id)
      .then((t) => {
        if (!alive) return;
        setTech(t);
        setForm({
          name: t.name || '',
          email: t.email || '',
          phone: digits(t.phone).slice(-10),
          roleLabel: ROLES.find((r) => r.toLowerCase() === String(t.roleLabel || '').toLowerCase()) || t.roleLabel || 'Technician',
          isAvailable: t.isAvailable !== false,
          dateOfJoin: dateOnly(t.dateOfJoin),
          dateOfBirth: dateOnly(t.dateOfBirth),
          defaultCheckIn: hhmm(t.defaultCheckIn),
          defaultCheckOut: hhmm(t.defaultCheckOut),
          aadharNumber: t.aadharNumber || '',
          aadharFrontUrl: t.aadharFrontUrl || '',
          aadharBackUrl: t.aadharBackUrl || '',
          panNumber: t.panNumber || '',
          panFrontUrl: t.panFrontUrl || '',
          panBackUrl: t.panBackUrl || '',
          salaryAmount: t.salaryAmount || '',
          dailyWage: t.dailyWage || '',
          photoUrl: t.photoUrl || '',
        });
      })
      .catch((err) => alive && setError(err.message || 'Could not load this employee.'));
    return () => {
      alive = false;
    };
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const shiftKey = useMemo(() => {
    if (!form) return 'general';
    return SHIFTS.find((s) => s.in === form.defaultCheckIn && s.out === form.defaultCheckOut)?.key || 'custom';
  }, [form]);

  async function upload(field, file) {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      notifyError(`Images must be under ${MAX_MB} MB.`);
      return;
    }
    setUploading((u) => ({ ...u, [field]: true }));
    try {
      const url = await uploadShopFile(file, 'employees', field);
      set(field, url);
    } catch (e) {
      notifyError(e, 'Upload failed.');
    } finally {
      setUploading((u) => ({ ...u, [field]: false }));
    }
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Employee name is required.';
    if (digits(form.phone).length !== 10) e.phone = 'Enter a valid 10-digit mobile number.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email.';
    if (form.defaultCheckIn && form.defaultCheckOut && form.defaultCheckOut <= form.defaultCheckIn) e.shift = 'Check out must be after check in.';
    setFieldErr(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) {
      notifyError('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      const toTime = (v) => (v ? `${v}:00` : null);
      await updateTechnician(id, {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: digits(form.phone),
        roleLabel: form.roleLabel,
        isAvailable: form.isAvailable,
        dateOfJoin: form.dateOfJoin || null,
        dateOfBirth: form.dateOfBirth || null,
        defaultCheckIn: toTime(form.defaultCheckIn),
        defaultCheckOut: toTime(form.defaultCheckOut),
        aadharNumber: digits(form.aadharNumber) || null,
        aadharFrontUrl: form.aadharFrontUrl || null,
        aadharBackUrl: form.aadharBackUrl || null,
        panNumber: form.panNumber.trim().toUpperCase() || null,
        panFrontUrl: form.panFrontUrl || null,
        panBackUrl: form.panBackUrl || null,
        salaryAmount: form.salaryAmount !== '' ? String(form.salaryAmount) : null,
        salaryPeriod: form.salaryAmount !== '' ? 'MONTHLY' : tech?.salaryPeriod || null,
        dailyWage: form.dailyWage !== '' ? String(form.dailyWage) : null,
        photoUrl: form.photoUrl || null,
      });
      notifySuccess('Employee updated');
      router.push(`/shop-home/employee/team/view/?id=${encodeURIComponent(id)}`);
    } catch (e) {
      notifyError(e, 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${form?.name || 'this employee'}? This cannot be undone — all employee data will be permanently deleted.`)) return;
    setDeleting(true);
    try {
      await deleteTechnician(id);
      notifySuccess('Employee deleted');
      router.push('/shop-home/employee/team');
    } catch (e) {
      notifyError(e, 'Could not delete this employee.');
      setDeleting(false);
    }
  }

  const code = tech?.id ? `EM-${String(tech.id).replace(/-/g, '').slice(0, 8).toUpperCase()}` : '';
  const photo = resolveMediaUrl(form?.photoUrl);

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4 pb-24">
      <div className="relative flex items-center justify-center border-b border-[#ECECEC] pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className={cx('absolute left-0 flex h-11 w-11 items-center justify-center rounded-full bg-[#E5F3F5] text-[#111111] transition hover:bg-[#E5F3F5]', FOCUS_RING)}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-[20px] font-extrabold text-[#111111]">Edit Profile</h1>
      </div>

      {error ? (
        <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13.5px] font-semibold text-[#B42318]">{error}</p>
      ) : !form ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-[22px] bg-[#F3F3F3]" />
          ))}
        </div>
      ) : (
        <>
          {/* Profile */}
          <section className="flex items-center gap-4 rounded-[22px] border border-[#ECECEC] bg-white p-4 sm:p-5">
            <label className="relative shrink-0 cursor-pointer" title="Change photo">
              <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#ECECEC] text-[#667085]">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- employee photo from the media service.
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10" fill="currentColor" aria-hidden="true" />
                )}
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-[#035C6C] text-white">
                {uploading.photoUrl ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
              </span>
              <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => upload('photoUrl', e.target.files?.[0])} />
            </label>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[20px] font-extrabold text-[#111111]">{form.name || 'Employee'}</p>
              <button
                type="button"
                onClick={() => set('isAvailable', !form.isAvailable)}
                aria-pressed={form.isAvailable}
                title="Click to switch Active / Inactive"
                className={cx('mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold', FOCUS_RING, form.isAvailable ? 'bg-[#E5F3F5] text-[#035C6C]' : 'bg-[#F3F3F3] text-[#667085]')}
              >
                <span className={cx('h-2.5 w-2.5 rounded-full', form.isAvailable ? 'bg-[#035C6C]' : 'bg-[#98A2B3]')} aria-hidden="true" />
                {form.isAvailable ? 'Active' : 'Inactive'}
              </button>
              <p className="mt-1 text-[13px] text-[#667085]">ID: {code}</p>
            </div>
          </section>

          <Card icon={User} title="Basic Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Employee Name" required>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} className={INPUT} />
                {fieldErr.name ? <span className="mt-1 block text-[12px] text-[#D92D20]">{fieldErr.name}</span> : null}
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" className={INPUT} />
                {fieldErr.email ? <span className="mt-1 block text-[12px] text-[#D92D20]">{fieldErr.email}</span> : null}
              </Field>
              <Field label="Mobile Number" required>
                <input inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => set('phone', digits(e.target.value).slice(0, 10))} className={INPUT} />
                {fieldErr.phone ? <span className="mt-1 block text-[12px] text-[#D92D20]">{fieldErr.phone}</span> : null}
              </Field>
              <Field label="Role" required>
                <select value={form.roleLabel} onChange={(e) => set('roleLabel', e.target.value)} className={INPUT}>
                  {[...new Set([...ROLES, form.roleLabel])].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card icon={Briefcase} title="Work Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of Join">
                <input type="date" value={form.dateOfJoin} onChange={(e) => set('dateOfJoin', e.target.value)} className={INPUT} />
              </Field>
              <Field label="Date of Birth">
                <input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} className={INPUT} />
              </Field>
              <Field label="Shift" className="sm:col-span-2">
                <select
                  value={shiftKey}
                  onChange={(e) => {
                    const s = SHIFTS.find((x) => x.key === e.target.value);
                    if (s?.in) setForm((f) => ({ ...f, defaultCheckIn: s.in, defaultCheckOut: s.out }));
                  }}
                  className={INPUT}
                >
                  {SHIFTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                      {s.in ? ` (${s.in} – ${s.out})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="block rounded-2xl border border-[#C7E6EA] bg-[#E5F3F5] px-4 py-3">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-[#475467]">
                  <Clock className="h-4 w-4 text-[#035C6C]" aria-hidden="true" />
                  Check In
                </span>
                <input type="time" value={form.defaultCheckIn} onChange={(e) => set('defaultCheckIn', e.target.value)} className="mt-1 w-full min-w-0 bg-transparent text-[22px] font-extrabold text-[#035C6C] focus:outline-none" />
              </label>
              <label className="block rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-[#475467]">
                  <Clock className="h-4 w-4 text-[#E53935]" aria-hidden="true" />
                  Check Out
                </span>
                <input type="time" value={form.defaultCheckOut} onChange={(e) => set('defaultCheckOut', e.target.value)} className="mt-1 w-full min-w-0 bg-transparent text-[22px] font-extrabold text-[#E53935] focus:outline-none" />
              </label>
              {fieldErr.shift ? <p className="text-[12px] text-[#D92D20] sm:col-span-2">{fieldErr.shift}</p> : null}
            </div>
          </Card>

          <Card icon={ShieldCheck} title="Identity Verification">
            <p className="mb-2 text-[14px] font-bold text-[#111111]">Aadhaar Card</p>
            <div className="grid grid-cols-2 gap-3">
              <UploadBox label="Upload Front" url={form.aadharFrontUrl} uploading={uploading.aadharFrontUrl} onPick={(f) => upload('aadharFrontUrl', f)} onClear={() => set('aadharFrontUrl', '')} />
              <UploadBox label="Upload Back" url={form.aadharBackUrl} uploading={uploading.aadharBackUrl} onPick={(f) => upload('aadharBackUrl', f)} onClear={() => set('aadharBackUrl', '')} />
            </div>
            <input
              inputMode="numeric"
              maxLength={12}
              value={form.aadharNumber}
              onChange={(e) => set('aadharNumber', digits(e.target.value).slice(0, 12))}
              placeholder="Aadhaar Number (optional)"
              className={INPUT}
            />
            <p className="mb-2 mt-5 border-t border-[#ECECEC] pt-4 text-[14px] font-bold text-[#111111]">PAN Card</p>
            <div className="grid grid-cols-2 gap-3">
              <UploadBox label="Upload Front" url={form.panFrontUrl} uploading={uploading.panFrontUrl} onPick={(f) => upload('panFrontUrl', f)} onClear={() => set('panFrontUrl', '')} />
              <UploadBox label="Upload Back" url={form.panBackUrl} uploading={uploading.panBackUrl} onPick={(f) => upload('panBackUrl', f)} onClear={() => set('panBackUrl', '')} />
            </div>
            <input
              maxLength={10}
              value={form.panNumber}
              onChange={(e) => set('panNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
              placeholder="PAN Number (optional)"
              className={INPUT}
            />
          </Card>

          <Card icon={Wallet} title="Salary Package">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monthly Salary">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-[#667085]">₹</span>
                  <input inputMode="decimal" value={form.salaryAmount} onChange={(e) => set('salaryAmount', e.target.value.replace(/[^\d.]/g, ''))} placeholder="Enter amount" className={cx(INPUT, 'pl-8')} />
                </div>
              </Field>
              <Field label="Daily Wage">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-[#667085]">₹</span>
                  <input inputMode="decimal" value={form.dailyWage} onChange={(e) => set('dailyWage', e.target.value.replace(/[^\d.]/g, ''))} placeholder="Enter amount" className={cx(INPUT, 'pl-8')} />
                </div>
              </Field>
            </div>
          </Card>

          <Card icon={Lock} title="App Login">
            <p className="flex items-center gap-2 text-[15px] font-bold text-[#111111]">
              <span className={cx('flex h-6 w-6 items-center justify-center rounded-md text-white', tech?.userId ? 'bg-[#035C6C]' : 'bg-[#98A2B3]')} aria-hidden="true">
                {tech?.userId ? '✓' : '–'}
              </span>
              Employee login {tech?.userId ? 'enabled' : 'not enabled'}
            </p>
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#E5F3F5] px-3 py-2.5 text-[13px] text-[#035C6C]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Employee signs in to the NearGFix Staff App with this mobile number + OTP. Login and password are managed from the app.
            </p>
          </Card>

          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className={cx('flex w-full items-center gap-4 rounded-[22px] border border-[#FECACA] bg-[#FEF2F2] p-5 text-left transition hover:bg-[#FDE8E8] disabled:opacity-60', FOCUS_RING)}
          >
            {deleting ? <Loader2 className="h-6 w-6 animate-spin text-[#D92D20]" aria-hidden="true" /> : <Trash2 className="h-6 w-6 text-[#D92D20]" aria-hidden="true" />}
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-extrabold text-[#D92D20]">Delete Employee</span>
              <span className="block text-[13px] text-[#667085]">This action cannot be undone. All employee data will be permanently deleted.</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#D92D20]" aria-hidden="true" />
          </button>

          {/* Sticky actions */}
          <div className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 grid grid-cols-2 gap-3 rounded-[22px] border border-[#ECECEC] bg-white/95 p-3 shadow-[0_8px_24px_rgba(16,24,40,0.12)] backdrop-blur">
            <button
              type="button"
              onClick={() => router.back()}
              className={cx('h-12 rounded-full border-2 border-[#035C6C] bg-white text-[15px] font-extrabold text-[#035C6C] transition hover:bg-[#E5F3F5]', FOCUS_RING)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || Object.values(uploading).some(Boolean)}
              className={cx('inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#035C6C] text-[15px] font-extrabold text-white transition hover:bg-[#035C6C] disabled:opacity-60', FOCUS_RING)}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Save className="h-5 w-5" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
