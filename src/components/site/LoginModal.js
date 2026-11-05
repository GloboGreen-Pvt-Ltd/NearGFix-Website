'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from '@/components/PortalLink';
import { BadgeCheck, Smartphone, Sparkles, Wrench, X } from 'lucide-react';

import { login, normalizeMobile, sendOtp } from '@/lib/customerAuth';
import { notifyError } from '@/lib/toast';

const RESEND_SECONDS = 30;
const OTP_LENGTH = 6;

/**
 * LoginModal — phone + OTP customer sign-in, mirroring the mobile app's
 * Login/Signup screen. Two phases: enter phone -> enter OTP.
 *
 * Real auth: sendOtp() and login() call the live auth-service (see customerAuth).
 * The dev OTP for any registered number is 123456; unknown numbers come back
 * with "No account found…" from the backend, surfaced inline.
 *
 * @param {object}   props
 * @param {boolean}  props.open
 * @param {() => void} props.onClose
 * @param {(session:object) => void} props.onSuccess  Fired after a successful login.
 * @param {{name?:string, imageUrl?:string}} [props.device]  Shown in the header card.
 */
export default function LoginModal({ open, onClose, onSuccess, device }) {
  const [phase, setPhase] = useState('phone'); // 'phone' | 'otp'
  const [mobile, setMobile] = useState('');
  const [agree, setAgree] = useState(false);
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [seconds, setSeconds] = useState(0);

  const otpRefs = useRef([]);
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);

  // The modal renders into document.body rather than in place. SiteHeader is
  // `sticky ... backdrop-blur-md`, and a backdrop-filter other than `none` makes an
  // element the CONTAINING BLOCK for its position:fixed descendants. HeaderAccount
  // renders this modal inside that header, so `fixed inset-0` resolved to the
  // header's ~64px box instead of the viewport: the dialog sat pinned to the top
  // with its head cut off and the backdrop covered only the header strip.
  // Portalling to body sidesteps it for every caller — header, AccountGate and
  // RepairFlow alike — and keeps working if another ancestor later grows a
  // transform/filter/will-change.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const digits = normalizeMobile(mobile);
  const otpValue = otp.join('');

  /* -- reset whenever the modal opens ------------------------------------- */
  useEffect(() => {
    if (!open) return;
    setPhase('phone');
    setOtp(Array(OTP_LENGTH).fill(''));
    setHint('');
    setBusy(false);
    setSeconds(0);
    // Focus the phone field after paint.
    const t = setTimeout(() => firstFieldRef.current && firstFieldRef.current.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  /* -- Esc to close, and lock body scroll while open ---------------------- */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  /* -- resend countdown --------------------------------------------------- */
  useEffect(() => {
    if (phase !== 'otp' || seconds <= 0) return undefined;
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [phase, seconds]);

  const requestOtp = useCallback(async () => {
    setBusy(true);
    const res = await sendOtp(digits);
    setBusy(false);
    if (!res.ok) {
      notifyError(res.message || "Couldn't send an OTP.");
      return false;
    }
    setHint(res.defaultOtp ? `For testing, use OTP ${res.defaultOtp}.` : '');
    setSeconds(RESEND_SECONDS);
    return true;
  }, [digits]);

  const onPhoneSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (digits.length < 10 || !agree || busy) return;
      const ok = await requestOtp();
      if (ok) {
        setPhase('otp');
        setOtp(Array(OTP_LENGTH).fill(''));
        setTimeout(() => otpRefs.current[0] && otpRefs.current[0].focus(), 60);
      }
    },
    [digits, agree, busy, requestOtp],
  );

  const onOtpSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (otpValue.length < OTP_LENGTH || busy) return;
      setBusy(true);
      const res = await login(digits, otpValue);
      setBusy(false);
      if (!res.ok) {
        notifyError(res.message || 'That OTP did not work.');
        return;
      }
      onSuccess(res.session);
    },
    [otpValue, digits, busy, onSuccess],
  );

  /* -- OTP box handlers --------------------------------------------------- */
  const setOtpAt = (i, val) => {
    setOtp((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  };
  const onOtpChange = (i, raw) => {
    const v = raw.replace(/\D/g, '');
    if (!v) {
      setOtpAt(i, '');
      return;
    }
    // Support typing/pasting multiple digits from one box.
    const chars = v.split('');
    setOtp((prev) => {
      const next = [...prev];
      let idx = i;
      chars.forEach((c) => {
        if (idx < OTP_LENGTH) next[idx] = c;
        idx += 1;
      });
      return next;
    });
    const nextIdx = Math.min(i + chars.length, OTP_LENGTH - 1);
    otpRefs.current[nextIdx] && otpRefs.current[nextIdx].focus();
  };
  const onOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1] && otpRefs.current[i - 1].focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      otpRefs.current[i - 1].focus();
    } else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) {
      otpRefs.current[i + 1].focus();
    }
  };

  const maskedPhone = useMemo(() => (digits ? `+91-${digits}` : ''), [digits]);

  // `mounted` also keeps this SSR-safe: the site is a static export, so document
  // does not exist at build time and the first client render must match it.
  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Log in to NearGFix"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close login"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-brand-ink/60 backdrop-blur-sm"
        tabIndex={-1}
      />

      {/* dvh, not vh: on mobile browsers vh is the tallest-possible viewport, so a
          92vh dialog still runs under the address bar.
          The 540px desktop min-height is gated on the window actually being that
          tall — min-height beats max-height in CSS, so on a short landscape window it
          would otherwise win over max-h and push the dialog off screen.
          my-auto centres it while the wrapper scrolls; plain items-center cannot,
          because an overflowing flex item gets pinned and loses its top. */}
      <div
        ref={dialogRef}
        className="relative z-10 my-auto grid max-h-[92dvh] w-full max-w-3xl grid-rows-[minmax(0,1fr)] overflow-hidden rounded-3xl bg-white shadow-lift md:grid-cols-[minmax(0,320px)_1fr] md:[@media(min-height:620px)]:min-h-[540px]"
      >
        {/* Left brand panel (hidden on mobile) */}
        <aside className="relative hidden overflow-hidden bg-gradient-to-b from-brand-500 to-brand-700 p-8 text-white md:flex md:flex-col">
          {/* soft decorative blobs */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-brand-900/30 blur-2xl"
          />

          <p className="relative text-2xl font-extrabold tracking-tight">Login / Signup</p>

          {/* Centred repair illustration */}
          <div className="relative my-auto flex items-end justify-center gap-4 py-8">
            <span className="flex h-36 w-24 items-center justify-center rounded-3xl bg-white/15 shadow-lift ring-1 ring-white/25">
              <Smartphone className="h-12 w-12" aria-hidden="true" />
            </span>
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-lift ring-1 ring-white/25">
              <Wrench className="h-8 w-8" aria-hidden="true" />
            </span>
          </div>

          <ul className="relative space-y-2.5 text-sm text-brand-50">
            {['Book repairs in a few taps', 'Track every stage live', 'Member-only offers'].map(
              (line) => (
                <li key={line} className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />
                  {line}
                </li>
              ),
            )}
          </ul>
        </aside>

        {/* Right form panel */}
        {/* Extra top padding below md: the brand column is hidden there, so the offer
            banner is the first thing in the panel and would otherwise run underneath
            the absolutely-positioned close button (top-4, h-9 => 52px). From md up the
            content is my-auto centred and clears it on its own. */}
        <section className="relative flex flex-col overflow-y-auto px-6 pb-6 pt-16 sm:px-8 sm:pb-8 md:pt-8">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-brand-muted transition hover:bg-brand-soft hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Content group — centred vertically on md+ via auto margins (which,
              unlike flex centering, don't clip the top when the OTP phase makes it
              taller than the panel). */}
          <div className="w-full md:my-auto">
          {/* Offer banner */}
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-900 px-4 py-3 text-white">
            <p className="text-sm font-bold leading-snug">
              Log in to get exclusive discounts &amp; offers
            </p>
            <Sparkles className="h-5 w-5 shrink-0 text-accent-300" aria-hidden="true" />
          </div>

          {/* Device card */}
          {device && (device.name || device.imageUrl) ? (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-soft">
                {device.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={device.imageUrl}
                    alt=""
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <Smartphone className="h-5 w-5 text-brand-700" aria-hidden="true" />
                )}
              </span>
              <p className="min-w-0 truncate text-sm font-bold text-brand-ink">
                {device.name || 'Your device'}
              </p>
            </div>
          ) : null}

          {phase === 'phone' ? (
            <form onSubmit={onPhoneSubmit} className="mt-6">
              <label htmlFor="ggfix-login-mobile" className="block text-sm font-semibold text-brand-ink">
                Enter your phone number
              </label>
              <div className="mt-2 flex items-center gap-2 border-b-2 border-brand-line focus-within:border-brand-600">
                <span className="pb-2 text-base font-semibold text-brand-muted">+91</span>
                <input
                  id="ggfix-login-mobile"
                  ref={firstFieldRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="Enter your mobile"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full bg-transparent pb-2 text-base text-brand-ink placeholder:text-brand-subtle focus:outline-none"
                />
              </div>

              <label className="mt-6 flex items-start gap-2.5 text-sm text-brand-muted">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-strong text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-700"
                />
                <span>
                  I agree to the{' '}
                  <Link href="/terms" className="font-semibold text-brand-700 underline underline-offset-2">
                    Terms &amp; Conditions
                  </Link>{' '}
                  &amp;{' '}
                  <Link href="/privacy" className="font-semibold text-brand-700 underline underline-offset-2">
                    Privacy Policy
                  </Link>
                </span>
              </label>

              <button
                type="submit"
                disabled={digits.length < 10 || !agree || busy}
                className="mt-6 w-full rounded-full bg-brand-600 py-3 text-base font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-200"
              >
                {busy ? 'Sending OTP…' : 'Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={onOtpSubmit} className="mt-6">
              <p className="text-base font-bold text-brand-ink">Enter OTP</p>
              <p className="mt-1 text-sm text-brand-muted">
                We&apos;ve sent an OTP to your number.
              </p>
              <p className="mt-0.5 text-sm text-brand-muted">
                Phone number: {maskedPhone}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setPhase('phone');
                  }}
                  className="font-semibold text-brand-700 underline underline-offset-2"
                >
                  Edit
                </button>
              </p>

              <div className="mt-5 flex gap-2 sm:gap-3">
                {otp.map((val, i) => (
                  <input
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    ref={(el) => {
                      otpRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={OTP_LENGTH}
                    aria-label={`OTP digit ${i + 1}`}
                    value={val}
                    onChange={(e) => onOtpChange(i, e.target.value)}
                    onKeyDown={(e) => onOtpKeyDown(i, e)}
                    className="h-12 w-12 rounded-xl border border-brand-line bg-white text-center text-lg font-bold text-brand-ink focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:h-14 sm:w-14"
                  />
                ))}
              </div>

              <div className="mt-3 text-right text-sm text-brand-muted">
                {seconds > 0 ? (
                  <span>Resend OTP in {seconds} seconds</span>
                ) : (
                  <button
                    type="button"
                    onClick={requestOtp}
                    disabled={busy}
                    className="font-semibold text-brand-700 underline underline-offset-2 disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              {hint ? (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-brand-muted">
                  <BadgeCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  {hint}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={otpValue.length < OTP_LENGTH || busy}
                className="mt-6 w-full rounded-full bg-brand-600 py-3 text-base font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-200"
              >
                {busy ? 'Verifying…' : 'Login'}
              </button>
            </form>
          )}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
