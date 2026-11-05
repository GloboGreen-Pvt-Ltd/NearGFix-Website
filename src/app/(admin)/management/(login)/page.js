'use client';

import { Suspense, useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from '@/lib/portalNavigation';
import { Eye, EyeOff, Lock, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { authApi } from '@/lib/api';
import { setToken, setRole } from '@/lib/auth';
import { notifyError } from '@/lib/toast';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Synchronous guard against a double submit: the `submitting` STATE only
  // drives the UI (disabled button, spinner) — it is not safe as the actual
  // duplicate-request guard because a closure captured at render time reads
  // whatever that state was AT THAT RENDER, not the live value. Two clicks
  // fired close enough together can both run the handler before React
  // commits the first setSubmitting(true), so both closures still see
  // submitting=false and both fire. A ref is mutated in place and read
  // synchronously, so the second call always sees the first call's guard.
  const submittingRef = useRef(false);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (submittingRef.current) return;

      const trimmedEmail = email.trim();
      let hasError = false;
      if (!trimmedEmail) {
        setEmailError('Email address is required.');
        hasError = true;
      } else if (!EMAIL_RE.test(trimmedEmail)) {
        setEmailError('Enter a valid email address.');
        hasError = true;
      } else {
        setEmailError('');
      }
      if (!password) {
        setPasswordError('Password is required.');
        hasError = true;
      } else {
        setPasswordError('');
      }
      if (hasError) return;

      submittingRef.current = true;
      setSubmitting(true);
      try {
        const res = await authApi.post('/auth/login', { email: trimmedEmail, password });
        const token = res.accessToken || res.token;
        if (!token) {
          notifyError('Invalid response: no token');
          return;
        }

        // Gate the admin web by loginType. Back-office staff — SUPER_ADMIN and
        // MARKET_PERSON — belong on /management/*; both create shop owners, and
        // only SUPER_ADMIN may change account status (enforced server-side).
        // Shop-owner and shop-mobile sessions are mobile-app territory; employee
        // sessions belong in the employee app. We reject them here with a clear
        // message rather than dropping them on a half-broken admin dashboard.
        const loginType = res.loginType;
        const isStaff = loginType === 'SUPER_ADMIN' || loginType === 'MARKET_PERSON';
        if (loginType && !isStaff) {
          notifyError(
            loginType === 'SHOP_OWNER' || loginType === 'SHOP_LOGIN'
              ? 'Shop accounts must sign in through the NearGFix mobile app.'
              : 'Employee accounts must sign in through the employee app.',
          );
          return;
        }

        setToken(token);
        setRole(loginType || null);
        // returnTo must be a portal page *below* /management — bare "/management"
        // is this login page, and replacing to it would just bounce back here.
        const safeReturn = returnTo && /^\/management\/.+/.test(returnTo) ? returnTo : null;
        const dest = safeReturn || '/management/dashboard';
        router.replace(dest);
      } catch (err) {
        // request() attaches a generic "session expired" message to every 401 so
        // that stale-token bounces read well elsewhere in the app; on this page a
        // 401 only ever means bad credentials or a disabled account, both of
        // which the server already names in err.body.message.
        let message;
        if (typeof err.status !== 'number') {
          message = 'Unable to connect to the server. Please try again.';
        } else if (err.status === 401) {
          message = err.body?.message || 'Incorrect email or password.';
        } else if (err.status >= 500) {
          message = 'Unable to sign in right now. Please try again.';
        } else {
          message = err.body?.message || err.message || 'Sign-in failed. Please try again.';
        }
        notifyError(message);
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [email, password, returnTo, router],
  );

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#035C6C] via-[#04485F] to-[#05366E] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 25%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 25%, transparent 75%)',
        }}
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-[#1FB89A]/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-[#2B7FD9]/20 blur-3xl" aria-hidden="true" />

      <div className="relative w-full max-w-[440px]">
          <div className="w-full rounded-[24px] bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:p-8 md:p-10">
            <div className="mb-6 flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="NearGFix logo"
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-xl object-contain"
                priority
              />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-slate-900 sm:text-[26px]">Management Login</h1>
              </div>
            </div>
            <p className="-mt-3 mb-6 text-sm text-slate-500">
              Secure access to your NearGFix Management Portal.
            </p>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label htmlFor="mgmt-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="mgmt-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    placeholder="Enter your registered email"
                    aria-invalid={emailError ? 'true' : 'false'}
                    aria-describedby={emailError ? 'mgmt-email-error' : undefined}
                    className={`h-[52px] w-full rounded-xl border bg-white pl-10 pr-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-[3px] ${
                      emailError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                        : 'border-[#DDE3EA] hover:border-brand-400 focus:border-brand-600 focus:ring-brand-100'
                    }`}
                  />
                </div>
                {emailError ? (
                  <p id="mgmt-email-error" role="alert" aria-live="polite" className="mt-1.5 text-sm text-red-600">
                    {emailError}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="mgmt-password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="mgmt-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError('');
                    }}
                    placeholder="Enter your password"
                    aria-invalid={passwordError ? 'true' : 'false'}
                    aria-describedby={passwordError ? 'mgmt-password-error' : undefined}
                    className={`h-[52px] w-full rounded-xl border bg-white pl-10 pr-11 text-[15px] text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-[3px] ${
                      passwordError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                        : 'border-[#DDE3EA] hover:border-brand-400 focus:border-brand-600 focus:ring-brand-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" /> : <Eye className="h-[18px] w-[18px]" aria-hidden="true" />}
                  </button>
                </div>
                {passwordError ? (
                  <p id="mgmt-password-error" role="alert" aria-live="polite" className="mt-1.5 text-sm text-red-600">
                    {passwordError}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white shadow-sm transition hover:bg-brand-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-slate-100 pt-5 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Your credentials are encrypted in transit and never stored on this device.</span>
            </div>
          </div>
        <p className="mt-6 text-center text-xs text-white/60">© {new Date().getFullYear()} Globogreen System &amp; Technology Private Limited</p>
      </div>
    </div>
  );
}