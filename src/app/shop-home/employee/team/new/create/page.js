'use client';

/**
 * /shop-home/employee/team/new/create — "Employee Details" create-staff
 * form, matching the real NearGFix Staff mobile app screen of the same name
 * (screenshot supplied 2026-09): avatar upload, Basic Information, Work
 * Information, Identity Verification, Salary Package, App Login (optional).
 *
 * Every field here is a real, controlled input — this is not a cosmetic
 * mockup. What's NOT wired yet, and why: `TECHNICIAN_BASE`
 * (src/lib/api.js, https://api.ggfix.in/technician) is defined but has
 * never been called anywhere in this web codebase; a live probe confirmed
 * it's a real, auth-protected service, so the mobile app's real
 * create-employee call almost certainly lives there — but the exact path
 * and request/response shape aren't confirmed for this web app yet.
 * "Create Employee", the avatar photo picker, and the Aadhaar/PAN upload
 * dropzones all stay honestly disabled with a tooltip until that's
 * confirmed — building a submit call against a guessed endpoint/payload
 * shape risks sending malformed data to a live production service.
 * "Cancel" is real (navigates back) since it needs no backend at all.
 *
 * Role options (Technician / Pickup Person) are the only two roleLabel
 * values confirmed to exist anywhere in this codebase (team/page.js's own
 * `normalize()`), not invented categories.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  IndianRupee,
  Info,
  Lock,
  Settings,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react';

import { cx } from '@/components/site/ui';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';
const INPUT_CLS =
  'w-full rounded-xl border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#98A2B3] transition focus:border-[#024A57] focus:outline-none focus:ring-[3px] focus:ring-[#ECECEC]';

const ROLE_OPTIONS = ['Technician', 'Pickup Person'];

function SectionCard({ icon: Icon, title, settings, children }) {
  return (
    <section className="relative min-w-0 rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3] text-[#035C6C]">
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span className="text-sm font-extrabold text-[#1C3053]">{title}</span>
        </span>
        {settings ? (
          <button
            type="button"
            disabled
            title="Section settings aren't available yet."
            className="flex h-8 w-8 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-[#F3F3F3] text-[#98A2B3]"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#344054]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function UploadBox({ label }) {
  return (
    <button
      type="button"
      disabled
      title="Document upload isn't available yet — waiting on a confirmed create-employee endpoint."
      className="flex h-24 w-full cursor-not-allowed flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#ECECEC] bg-[#F8F8F8] text-center"
    >
      <Upload className="h-5 w-5 text-[#035C6C]" aria-hidden="true" />
      <span className="text-xs font-bold text-[#035C6C]">{label}</span>
      <span className="text-[0.65rem] text-[#98A2B3]">JPG, PNG (Max 2MB)</span>
    </button>
  );
}

export default function CreateEmployeePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    role: '',
    dateOfJoin: '',
    dateOfBirth: '',
    shift: 'General Shift',
    checkIn: '',
    checkOut: '',
    aadhaarNumber: '',
    panNumber: '',
    monthlySalary: '',
    dailyWage: '',
    password: '',
    loginEnabled: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 pb-24">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ECECEC] bg-white text-[#344054] transition hover:border-[#024A57] hover:text-[#024A57]', FOCUS_RING)}
        >
          <ArrowLeft className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-extrabold tracking-tight text-[#1C3053]">Employee Details</h1>
      </div>

      {/* Avatar photo picker — disabled: no confirmed create-employee
          endpoint to attach an uploaded photo to yet. */}
      <div className="flex items-center gap-4 rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-4 sm:p-5">
        <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3] text-[#98A2B3]">
          <User className="h-7 w-7" aria-hidden="true" />
          <button
            type="button"
            disabled
            title="Photo upload isn't available yet — waiting on a confirmed create-employee endpoint."
            aria-label="Upload photo (not available yet)"
            className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 cursor-not-allowed items-center justify-center rounded-full bg-[#035C6C] text-white ring-2 ring-white"
          >
            <Camera className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
        <p className="text-base font-extrabold text-[#1C3053]">New Employee</p>
      </div>

      {/* Basic Information */}
      <SectionCard icon={User} title="Basic Information">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Employee Name" required>
            <input type="text" value={form.name} onChange={set('name')} placeholder="Enter name" className={INPUT_CLS} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={set('email')} placeholder="name@example.com" className={INPUT_CLS} />
          </Field>
          <Field label="Mobile Number" required>
            <input type="tel" value={form.mobile} onChange={set('mobile')} placeholder="Enter mobile" className={INPUT_CLS} />
          </Field>
          <Field label="Role" required>
            <select value={form.role} onChange={set('role')} className={cx(INPUT_CLS, 'appearance-none')}>
              <option value="">Select role</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
        </div>
      </SectionCard>

      {/* Work Information */}
      <SectionCard icon={Briefcase} title="Work Information" settings>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Date of Join">
            <input type="date" value={form.dateOfJoin} onChange={set('dateOfJoin')} className={INPUT_CLS} />
          </Field>
          <Field label="Date of Birth">
            <input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} className={INPUT_CLS} />
          </Field>
        </div>
        <div className="mt-3.5">
          <Field label="Shift">
            <select value={form.shift} onChange={set('shift')} className={cx(INPUT_CLS, 'appearance-none')}>
              <option>General Shift</option>
              <option>Morning Shift</option>
              <option>Evening Shift</option>
            </select>
          </Field>
        </div>
        <div className="mt-3.5 grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-xl bg-[#F8F8F8] p-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#035C6C]">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Check In
            </span>
            <input
              type="time"
              value={form.checkIn}
              onChange={set('checkIn')}
              className="mt-1 w-full min-w-0 border-0 bg-transparent text-base font-extrabold sm:text-lg text-[#035C6C] focus:outline-none"
            />
          </div>
          <div className="min-w-0 rounded-xl bg-[#FEF2F2] p-3">
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#DC2626]">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Check Out
            </span>
            <input
              type="time"
              value={form.checkOut}
              onChange={set('checkOut')}
              className="mt-1 w-full min-w-0 border-0 bg-transparent text-base font-extrabold sm:text-lg text-[#DC2626] focus:outline-none"
            />
          </div>
        </div>
      </SectionCard>

      {/* Identity Verification */}
      <SectionCard icon={ShieldCheck} title="Identity Verification" settings>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#98A2B3]">Aadhaar Card</p>
        <div className="grid grid-cols-2 gap-3">
          <UploadBox label="Upload Front" />
          <UploadBox label="Upload Back" />
        </div>
        <div className="mt-3">
          <input
            type="text"
            value={form.aadhaarNumber}
            onChange={set('aadhaarNumber')}
            placeholder="Aadhaar Number (optional)"
            className={INPUT_CLS}
          />
        </div>

        <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-[#98A2B3]">PAN Card</p>
        <div className="grid grid-cols-2 gap-3">
          <UploadBox label="Upload Front" />
          <UploadBox label="Upload Back" />
        </div>
        <div className="mt-3">
          <input
            type="text"
            value={form.panNumber}
            onChange={set('panNumber')}
            placeholder="PAN Number (optional)"
            className={INPUT_CLS}
          />
        </div>
      </SectionCard>

      {/* Salary Package */}
      <SectionCard icon={IndianRupee} title="Salary Package">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Monthly Salary">
            <div className="relative">
              <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#98A2B3]" aria-hidden="true" />
              <input type="number" value={form.monthlySalary} onChange={set('monthlySalary')} placeholder="Enter amount" className={cx(INPUT_CLS, 'pl-8')} />
            </div>
          </Field>
          <Field label="Daily Wage">
            <div className="relative">
              <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#98A2B3]" aria-hidden="true" />
              <input type="number" value={form.dailyWage} onChange={set('dailyWage')} placeholder="Enter amount" className={cx(INPUT_CLS, 'pl-8')} />
            </div>
          </Field>
        </div>
      </SectionCard>

      {/* App Login (optional) */}
      <SectionCard icon={Lock} title="App Login (optional)" settings>
        <Field label="Password">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="Min 4 characters"
              className={cx(INPUT_CLS, 'pr-10')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#344054]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </Field>

        <label className="mt-3.5 flex items-center gap-2 text-sm font-semibold text-[#1C3053]">
          <input
            type="checkbox"
            checked={form.loginEnabled}
            onChange={(e) => setForm((f) => ({ ...f, loginEnabled: e.target.checked }))}
            className="h-4 w-4 rounded border-[#D0D5DD] accent-[#035C6C] focus:ring-[#035C6C]"
          />
          Employee login enabled
        </label>

        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-[#F8F8F8] p-2.5 text-xs text-[#035C6C]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Employee signs in to the NearGFix Staff App with this mobile number + OTP.
        </p>
      </SectionCard>

      {/* Sticky footer — Cancel is real; Create Employee stays disabled
          until a confirmed create-employee endpoint exists. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ECECEC] bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex w-full max-w-[1320px] gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className={cx(
              'flex-1 rounded-full border border-[#D0D5DD] bg-white px-4 py-2.5 text-sm font-bold text-[#344054] transition hover:border-[#98A2B3]',
              FOCUS_RING,
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled
            title="Creating employees isn't available yet — waiting on a confirmed create-employee endpoint."
            className="flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-full bg-[#F3BF23] px-4 py-2.5 text-sm font-bold text-[#1E1E1E] opacity-50 hover:bg-[#E5B11A]"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Create Employee
          </button>
        </div>
      </div>
    </div>
  );
}
