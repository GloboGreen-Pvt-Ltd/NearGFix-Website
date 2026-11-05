'use client';

/**
 * shoplogin.js — the Business Login screen rendered at /shopmanagement.
 *
 * Mobile number + OTP only — no email, username, password, or the old
 * Password/OTP toggle, per the redesign brief.
 *
 * REAL backend, verified end-to-end against production:
 *   POST /auth/shop-login/request-otp   { mobile }
 *   POST /auth/shop-login               { mobile, otp } -> real JWT + shop identity
 * See src/lib/shopMobileAuth.js for the exact calls. On success this screen
 * writes the real response (token, shopId, shopName, name, ...) via
 * shopAuth.js's writeSession(), which is what lets this session pass
 * /shop-home's real, unchanged guard.
 *
 * One real limitation, inherited from the backend: OTP delivery is dev-mode
 * only there (see shopMobileAuth.js's doc comment) — a shop's OTP is a
 * stored static value, not yet actually sent by SMS. That's backend work,
 * not something fixable here.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Phone, ShieldCheck, Store } from 'lucide-react';

import { BRAND } from '@/lib/siteContent';
import { cx } from '@/components/site/ui';
import { writeSession } from '@/lib/shopAuth';
import { normalizeMobile, sendMobileOtp, verifyMobileOtp } from '@/lib/shopMobileAuth';
import Icon3D from '@/components/shop-dashboard/Icon3D';
import { notifyError } from '@/lib/toast';

const RESEND_SECONDS = 30;
const OTP_LENGTH = 6;

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100';

function maskMobile(digits) {
  if (digits.length !== 10) return `+91 ${digits}`;
  return `+91 ${'•'.repeat(6)} ${digits.slice(-4)}`;
}

/* -------------------------------------------------------------------------- */
/* 6-box OTP input                                                            */
/* -------------------------------------------------------------------------- */

function OtpBoxes({ values, onChange, error, disabled, shake }) {
  const refs = useRef([]);

  useEffect(() => {
    if (refs.current[0]) refs.current[0].focus();
  }, []);

  const focusBox = (index) => {
    const el = refs.current[index];
    if (el) el.focus();
  };

  const setDigit = (index, digit) => {
    const next = [...values];
    next[index] = digit;
    onChange(next);
  };

  const handleChange = (index, event) => {
    const digit = event.target.value.replace(/\D/g, '').slice(-1);
    setDigit(index, digit);
    if (digit && index < OTP_LENGTH - 1) focusBox(index + 1);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      if (!values[index] && index > 0) {
        event.preventDefault();
        setDigit(index - 1, '');
        focusBox(index - 1);
      }
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData('text');
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
    if (!digits.length) return;
    const next = [...values];
    digits.forEach((d, i) => {
      next[i] = d;
    });
    onChange(next);
    focusBox(Math.min(digits.length, OTP_LENGTH) - 1);
  };

  return (
    <div
      role="group"
      aria-label="6-digit OTP"
      className={cx('flex justify-between gap-2 sm:gap-2.5', shake && 'animate-shake')}
    >
      {values.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          aria-label={`OTP digit ${index + 1} of ${OTP_LENGTH}`}
          aria-invalid={error ? 'true' : 'false'}
          className={cx(
            'h-[52px] min-w-0 flex-1 max-w-[46px] rounded-xl border text-center text-xl font-semibold text-[#101828] transition sm:h-[54px] sm:max-w-[48px]',
            error
              ? 'border-[#D92D20] bg-red-50 focus:border-[#D92D20] focus:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100'
              : cx(
                  digit ? 'border-brand-600 bg-white' : 'border-[#D0D5DD] bg-white',
                  'focus:border-brand-600 focus:bg-[#E5F3F5] focus:outline-none focus:ring-4 focus:ring-brand-100',
                ),
            disabled && 'cursor-not-allowed opacity-60',
          )}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function ShopLogin() {
  const router = useRouter();

  const [step, setStep] = useState('mobile'); // 'mobile' | 'otp'

  const [mobile, setMobile] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [sending, setSending] = useState(false);

  const [otp, setOtp] = useState(() => Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState('');
  // The server rejected the code: its message is a toast, but the boxes still turn red.
  const [otpRejected, setOtpRejected] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [shake, setShake] = useState(false);

  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);

  const mobileInputRef = useRef(null);
  // The OTP value already attempted (success or failure) — guards the
  // auto-verify effect below against re-firing for the same code. Set
  // synchronously, before the async verify call, not inside a dependency
  // array — see that effect's doc comment for why.
  const attemptedOtpRef = useRef('');
  // Hard lock against a second verify call landing while one is already in
  // flight (e.g. the auto-effect and a manual button click in the same tick).
  const verifyLockRef = useRef(false);

  const digits = normalizeMobile(mobile);
  const otpValue = otp.join('');

  /* Countdown, only while the OTP step is showing. */
  useEffect(() => {
    if (step !== 'otp' || resendSeconds <= 0) return undefined;
    const id = setInterval(() => setResendSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [step, resendSeconds]);

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 350);
  }

  function handleMobileChange(event) {
    setMobile(event.target.value.replace(/\D/g, '').slice(0, 10));
    if (mobileError) setMobileError('');
  }

  async function handleSendOtp(event) {
    event.preventDefault();
    if (digits.length !== 10) {
      setMobileError('Enter a valid 10-digit mobile number.');
      return;
    }
    setSending(true);
    setMobileError('');
    const result = await sendMobileOtp(digits);
    setSending(false);
    if (!result.ok) {
      notifyError(result.message || 'Unable to sign in right now. Please try again.');
      return;
    }
    setOtp(Array(OTP_LENGTH).fill(''));
    setOtpError('');
    setOtpRejected(false);
    attemptedOtpRef.current = '';
    setResendSeconds(RESEND_SECONDS);
    setStep('otp');
  }

  async function handleVerify() {
    // Hard guard: covers the auto-effect and a manual button click landing
    // in the same tick, which `verifying` state alone can't prevent (state
    // updates aren't visible until the next render).
    if (verifyLockRef.current) return;
    if (otpValue.length !== OTP_LENGTH) {
      setOtpError('Enter the complete 6-digit OTP.');
      triggerShake();
      return;
    }
    verifyLockRef.current = true;
    setVerifying(true);
    setOtpError('');
    try {
      const result = await verifyMobileOtp(digits, otpValue);
      if (!result.ok) {
        notifyError(result.message || 'The OTP you entered is incorrect. Please try again.');
        setOtpRejected(true);
        triggerShake();
        return;
      }
      setVerified(true);
      // result.session is the real POST /auth/login response, passed
      // straight through — see shopMobileAuth.js.
      writeSession(result.session);
      setTimeout(() => {
        router.replace('/shop-home');
      }, 900);
    } finally {
      // Always runs — success, a real 401/403/429/500, or a network throw —
      // so the spinner and the lock can never get stuck after a failed
      // attempt. See the module doc comment for the loop this replaced.
      verifyLockRef.current = false;
      setVerifying(false);
    }
  }

  /* Auto-trigger once the 6th digit lands — exactly once per distinct OTP
   * value. attemptedOtpRef is written synchronously, before handleVerify
   * ever awaits anything, so it is the single source of truth for "have we
   * already tried this code" — unlike the `verifying` flag this effect used
   * to depend on. That version re-fired every time `verifying` flipped back
   * to false after a failed attempt (otpValue and `verified` were still
   * unchanged), which is exactly what produced the repeated /auth/login
   * calls on a wrong OTP: verify -> 401 -> verifying resets -> effect deps
   * change -> condition still true -> verify again, forever. Depending on
   * [step, otpValue] only removes that trigger entirely. */
  useEffect(() => {
    if (
      step === 'otp' &&
      otpValue.length === OTP_LENGTH &&
      otpValue !== attemptedOtpRef.current &&
      !verifying
    ) {
      attemptedOtpRef.current = otpValue;
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, otpValue]);

  function handleOtpChange(nextOtp) {
    setOtp(nextOtp);
    if (otpError) setOtpError('');
    if (otpRejected) setOtpRejected(false);
    // A fresh edit is never "the code we already tried" — let a completed
    // value re-trigger the auto-verify effect above.
    attemptedOtpRef.current = '';
  }

  async function handleResend() {
    if (resendSeconds > 0 || resending) return;
    setResending(true);
    setOtpError('');
    const result = await sendMobileOtp(digits);
    setResending(false);
    setOtpRejected(false);
    if (!result.ok) {
      notifyError(result.message || 'Unable to resend right now. Please try again.');
      return;
    }
    setOtp(Array(OTP_LENGTH).fill(''));
    attemptedOtpRef.current = '';
    setResendSeconds(RESEND_SECONDS);
  }

  function handleChangeNumber() {
    setStep('mobile');
    setOtp(Array(OTP_LENGTH).fill(''));
    setOtpError('');
    setOtpRejected(false);
    setVerified(false);
    setVerifying(false);
    attemptedOtpRef.current = '';
    verifyLockRef.current = false;
    setTimeout(() => {
      if (mobileInputRef.current) mobileInputRef.current.focus();
    }, 0);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8FAF9] px-4 py-10 sm:px-6">
      {/* Decorative background glow — purely presentational. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-brand-200/30 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute -left-20 bottom-10 h-56 w-56 rounded-full bg-[#E5F3F5] blur-3xl" />
      </div>

      <div className="relative w-full max-w-[440px] animate-fade-up">
        {/* ---- Brand header ------------------------------------------- */}
        <div className="flex flex-col items-center text-center">
          <Icon3D icon={Store} tone="green" size="xl" />
          <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight text-[#101828] sm:text-[28px]">
            Business Login
          </h1>
          <p className="mt-1.5 text-sm text-[#667085]">Manage your {BRAND.name} business securely</p>
          <p className="mt-0.5 text-sm text-[#667085]">Sign in using your registered mobile number.</p>
        </div>

        {/* ---- Card ----------------------------------------------------- */}
        <div className="mt-7 rounded-[22px] border border-[#E5ECE8] bg-white p-6 shadow-[0_8px_30px_rgba(20,80,55,0.08)] sm:p-8">
          {step === 'mobile' ? (
            <form onSubmit={handleSendOtp} noValidate>
              <label htmlFor="business-mobile" className="mb-1.5 block text-sm font-semibold text-[#101828]">
                Mobile Number
              </label>
              <div
                className={cx(
                  'flex items-stretch overflow-hidden rounded-[13px] border bg-white transition',
                  mobileError
                    ? 'border-[#D92D20]'
                    : 'border-[#D0D5DD] focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100',
                )}
              >
                <span className="flex shrink-0 items-center gap-1.5 border-r border-[#D0D5DD] bg-[#F9FAFB] px-3.5 text-sm font-semibold text-[#101828]">
                  <Phone className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  +91
                </span>
                <input
                  ref={mobileInputRef}
                  id="business-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  autoFocus
                  value={mobile}
                  onChange={handleMobileChange}
                  placeholder="Enter 10-digit mobile number"
                  maxLength={10}
                  aria-invalid={mobileError ? 'true' : 'false'}
                  aria-describedby={mobileError ? 'business-mobile-error' : 'business-mobile-hint'}
                  className="h-[52px] min-w-0 flex-1 bg-transparent px-3.5 text-base text-[#101828] outline-none placeholder:text-[#98A2B3] sm:h-[54px]"
                />
              </div>

              {mobileError ? (
                <p id="business-mobile-error" className="mt-2 text-sm font-medium text-[#D92D20]" role="alert">
                  {mobileError}
                </p>
              ) : (
                <p id="business-mobile-hint" className="mt-2 text-sm text-[#667085]">
                  We&rsquo;ll send a verification code to this number.
                </p>
              )}

              <button
                type="submit"
                disabled={digits.length !== 10 || sending}
                className={cx(
                  'mt-6 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[13px] bg-brand-600 text-sm font-semibold text-white transition sm:h-[54px]',
                  'hover:bg-brand-700 hover:-translate-y-px active:scale-[0.99]',
                  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
                  FOCUS_RING,
                )}
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Sending OTP...
                  </>
                ) : (
                  'Send OTP'
                )}
              </button>
            </form>
          ) : (
            <div>
              <h2 className="text-lg font-bold text-[#101828]">Verify OTP</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Enter the 6-digit code sent to{' '}
                <span className="font-semibold text-[#101828]">{maskMobile(digits)}</span>
              </p>
              <button
                type="button"
                onClick={handleChangeNumber}
                className={cx('mt-1 rounded text-sm font-semibold text-brand-600 hover:text-brand-700', FOCUS_RING)}
              >
                Change number
              </button>

              <div className="mt-5">
                {verified ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center animate-fade-in">
                    <Icon3D icon={CheckCircle2} tone="green" size="lg" />
                    <p className="text-sm font-bold text-[#101828]">Verified successfully</p>
                  </div>
                ) : (
                  <>
                    <OtpBoxes values={otp} onChange={handleOtpChange} error={Boolean(otpError) || otpRejected} disabled={verifying} shake={shake} />

                    {otpError ? (
                      <p className="mt-3 text-sm font-medium text-[#D92D20]" role="alert">
                        {otpError}
                      </p>
                    ) : null}

                    <div className="mt-4 text-center text-sm text-[#667085]">
                      Didn&rsquo;t receive the code?{' '}
                      {resendSeconds > 0 ? (
                        <span className="font-semibold text-[#101828]">
                          Resend OTP in 00:{String(resendSeconds).padStart(2, '0')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResend}
                          disabled={resending}
                          className={cx('rounded font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-60', FOCUS_RING)}
                        >
                          {resending ? 'Resending…' : 'Resend OTP'}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={otpValue.length !== OTP_LENGTH || verifying}
                      className={cx(
                        'mt-6 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[13px] bg-brand-600 text-sm font-semibold text-white transition sm:h-[54px]',
                        'hover:bg-brand-700 hover:-translate-y-px active:scale-[0.99]',
                        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
                        FOCUS_RING,
                      )}
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Verifying...
                        </>
                      ) : (
                        'Verify & Sign In'
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ---- Registration -------------------------------------------- */}
        <p className="mt-6 text-center text-sm text-[#667085]">
          New to {BRAND.name} Business?{' '}
          <Link href="/business/register" className="font-semibold text-brand-600 hover:text-brand-700">
            Register your business
          </Link>
        </p>

        {/* ---- Trust row -------------------------------------------------- */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[#667085]">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
          Your account is protected with OTP verification.
        </div>
      </div>
    </div>
  );
}
