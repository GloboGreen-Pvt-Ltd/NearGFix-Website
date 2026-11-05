'use client';

/**
 * BusinessLoginModal — BUSINESS (shop-owner) Login / Signup popup for the
 * Sell with NearGFix page (src/app/sell-with-us). Same look as the customer
 * LoginModal (split green/white card, phone -> OTP), but wired to the
 * existing business auth only — the same calls /shopmanagement's
 * ShopLoginForm makes, nothing duplicated:
 *
 *   sendMobileOtp(mobile)       POST /auth/shop-login/request-otp
 *   verifyMobileOtp(mobile,otp) POST /auth/login  -> LoginResponse
 *   writeSession(session)       stores the shop session (src/lib/shopAuth.js)
 *   router.replace('/shop-home') — the existing post-login destination
 *
 * Visual: the left panel is the existing promo artwork in /public; the white
 * form panel uses #035C6C as its only accent. Portalled out of the header into the page's
 * root (#sell-with-us-root, which carries the Inter font variable),
 * falling back to <body>.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from '@/components/PortalLink';
import { useRouter } from '@/lib/portalNavigation';
import { msIcon } from '@/components/site/MaterialIcon';

import { normalizeMobile, sendMobileOtp, verifyMobileOtp } from '@/lib/shopMobileAuth';
import { writeSession } from '@/lib/shopAuth';
import { notifyError } from '@/lib/toast';

// Google Material Symbols (Outlined) — see src/components/site/MaterialIcon.js.
const ArrowRight = msIcon("arrow_forward");
const ChevronRight = msIcon("chevron_right");
const Gift = msIcon("redeem");
const Loader2 = msIcon("progress_activity");
const X = msIcon("close");


// Existing asset in /public (real filename, URL-encoded: it contains spaces and commas).
const PROMO_IMAGE = '/' + encodeURIComponent('ChatGPT Image Sep 30, 2026, 01_27_14 PM.png');
const RESEND_SECONDS = 30;
const OTP_LENGTH = 6;

export default function BusinessLoginModal({ open, onClose }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState('phone'); // 'phone' | 'otp' | 'done'
  const [mobile, setMobile] = useState('');
  const [agree, setAgree] = useState(false);
  const [otp, setOtp] = useState(() => Array(OTP_LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const phoneRef = useRef(null);
  const otpRefs = useRef([]);
  const lockRef = useRef(false); // one verify in flight at a time

  useEffect(() => setMounted(true), []);

  const digits = normalizeMobile(mobile);
  const otpValue = otp.join('');
  const canContinue = digits.length === 10 && agree && !busy;

  useEffect(() => {
    if (!open) return undefined;
    setPhase('phone');
    setOtp(Array(OTP_LENGTH).fill(''));
    setBusy(false);
    setSeconds(0);
    const t = setTimeout(() => phoneRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onClose]);

  useEffect(() => {
    if (phase !== 'otp' || seconds <= 0) return undefined;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, seconds]);

  const requestOtp = useCallback(async () => {
    setBusy(true);
    const res = await sendMobileOtp(digits);
    setBusy(false);
    if (!res.ok) {
      notifyError(res.message || 'Unable to send an OTP right now. Please try again.');
      return false;
    }
    setSeconds(RESEND_SECONDS);
    return true;
  }, [digits]);

  async function onPhoneSubmit(e) {
    e.preventDefault();
    if (!canContinue) return;
    if (await requestOtp()) {
      setPhase('otp');
      setOtp(Array(OTP_LENGTH).fill(''));
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
    }
  }

  async function onOtpSubmit(e) {
    e?.preventDefault();
    if (otpValue.length < OTP_LENGTH || lockRef.current) return;
    lockRef.current = true;
    setBusy(true);
    try {
      const res = await verifyMobileOtp(digits, otpValue);
      if (!res.ok) {
        notifyError(res.message || 'The OTP you entered is incorrect. Please try again.');
        return;
      }
      writeSession(res.session);
      setPhase('done');
      router.replace('/shop-home');
      onClose();
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }

  function onOtpChange(i, raw) {
    const chars = raw.replace(/\D/g, '').split('');
    if (!chars.length) {
      setOtp((prev) => prev.map((v, k) => (k === i ? '' : v)));
      return;
    }
    setOtp((prev) => {
      const next = [...prev];
      chars.forEach((c, k) => {
        if (i + k < OTP_LENGTH) next[i + k] = c;
      });
      return next;
    });
    otpRefs.current[Math.min(i + chars.length, OTP_LENGTH - 1)]?.focus();
  }

  function onOtpKeyDown(i, e) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    else if (e.key === 'ArrowLeft' && i > 0) otpRefs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus();
  }

  if (!open || !mounted) return null;

  // Continue / Login: pale-green disabled state, solid green enabled state.
  const BTN =
    'flex h-[54px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#035C6C] text-[17px] font-bold text-white shadow-[0_8px_20px_rgba(3,92,108,0.22)] transition hover:bg-[#035C6C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#DDF3E1] disabled:text-[#8CBF96] disabled:shadow-none';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 font-[family-name:var(--font-inter)] text-[#1E1E1E] sm:p-6" role="dialog" aria-modal="true" aria-label="Business login">
      <button type="button" aria-label="Close login" tabIndex={-1} onClick={() => !busy && onClose()} className="absolute inset-0 h-full w-full cursor-default bg-[#1E1E1E]/55 backdrop-blur-[6px]" />

      <div className="relative z-10 my-auto grid max-h-[94dvh] w-full max-w-[900px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[20px] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.20)] md:grid-cols-2 md:grid-rows-[minmax(0,1fr)]">
        {/* Close: round light-grey button, top-right of the modal. */}
        <button
          type="button"
          aria-label="Close"
          onClick={() => !busy && onClose()}
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F5] text-[#1E1E1E] transition hover:bg-[#EAEAEA] md:right-5 md:top-5"
        >
          <X className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        {/* Left panel: the existing promo artwork (public/ChatGPT Image Sep 30, 2026, 01_27_14 PM.png,
            1086x1448 — logo, title, devices and checklist are all in the image). Full-bleed:
            no padding, object-cover. From md up the panel takes the image's own 3:4 shape,
            so nothing is cropped; on phones it is a short banner showing the top (logo + title). */}
        <aside className="relative aspect-[1086/468] max-h-[35dvh] overflow-hidden bg-[#035C6C] md:aspect-[1086/1448] md:max-h-none">
          <Image
            src={PROMO_IMAGE}
            alt="NearGFix Login Signup"
            fill
            priority
            sizes="(min-width: 768px) 450px, 100vw"
            className="block object-cover object-top md:object-center"
          />
        </aside>

        {/* Form panel */}
        <section className="relative flex flex-col overflow-y-auto bg-white px-6 pb-7 pt-6 sm:px-9 md:px-10 md:pb-10 md:pt-16">
          <div className="w-full md:my-auto">
            {/* Offer banner */}
            <div className="flex min-h-[80px] items-center gap-3.5 rounded-[14px] bg-[rgba(3,92,108,0.09)] px-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#035C6C] text-white">
                <Gift className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
                Log in to get exclusive
                <br />
                discounts &amp; offers
              </p>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#035C6C]" aria-hidden="true" />
            </div>

            {phase === 'phone' ? (
              <form onSubmit={onPhoneSubmit} className="mt-7">
                <label htmlFor="ggfix-business-mobile" className="block text-[15px] font-bold">
                  Enter your phone number
                </label>
                <div className="mt-2.5 flex h-[52px] items-center rounded-[10px] border border-[#E2E2E2] bg-white transition focus-within:border-[#035C6C] focus-within:shadow-[0_0_0_3px_rgba(3,92,108,0.10)]">
                  {/* Business login is India-only (+91), so this is a fixed prefix, not a picker. */}
                  <span className="flex h-full items-center gap-2 border-r border-[#E2E2E2] pl-3.5 pr-3 text-[15px] font-semibold">
                    <IndiaFlag />
                    +91
                  </span>
                  <input
                    id="ggfix-business-mobile"
                    ref={phoneRef}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="Enter your mobile number"
                    value={mobile}
                    onChange={(e) => {
                      setMobile(e.target.value.replace(/\D/g, '').slice(0, 10));
                    }}
                    className="h-full min-w-0 flex-1 rounded-r-[10px] bg-transparent px-3.5 text-base tracking-wide sm:text-[15px] placeholder:tracking-normal placeholder:text-[#9A9A9A] focus:outline-none"
                  />
                </div>

                <label className="mt-[22px] flex cursor-pointer items-center gap-2.5 text-[13.5px] text-[#555555]">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="h-[17px] w-[17px] shrink-0 cursor-pointer rounded-[4px] accent-[#035C6C]"
                  />
                  <span>
                    I agree to the{' '}
                    <Link href="/terms/" className="font-semibold text-[#035C6C] underline underline-offset-2">
                      Terms &amp; Conditions
                    </Link>{' '}
                    &amp;{' '}
                    <Link href="/privacy/" className="font-semibold text-[#035C6C] underline underline-offset-2">
                      Privacy Policy
                    </Link>
                  </span>
                </label>

                <button type="submit" disabled={!canContinue} className={`${BTN} mt-[26px]`}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
                  {busy ? 'Sending OTP…' : 'Continue'}
                  {busy ? null : <ArrowRight className="h-5 w-5" aria-hidden="true" />}
                </button>
              </form>
            ) : (
              <form onSubmit={onOtpSubmit} className="mt-7">
                <p className="text-[16px] font-bold">Enter OTP</p>
                <p className="mt-1 text-sm text-[#666666]">We&apos;ve sent an OTP to your number.</p>
                <p className="mt-0.5 text-sm text-[#666666]">
                  Phone number: +91-{digits}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setPhase('phone');
                    }}
                    className="font-semibold text-[#035C6C] underline underline-offset-2"
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
                      className="h-12 w-11 rounded-[10px] border border-[#E2E2E2] bg-white text-center text-lg font-bold transition focus:border-[#035C6C] focus:shadow-[0_0_0_3px_rgba(3,92,108,0.10)] focus:outline-none sm:h-[52px] sm:w-[52px]"
                    />
                  ))}
                </div>

                <div className="mt-3 text-right text-sm text-[#666666]">
                  {seconds > 0 ? (
                    <span>Resend OTP in {seconds} seconds</span>
                  ) : (
                    <button type="button" onClick={requestOtp} disabled={busy} className="font-semibold text-[#035C6C] underline underline-offset-2 disabled:opacity-50">
                      Resend OTP
                    </button>
                  )}
                </div>

                <button type="submit" disabled={otpValue.length < OTP_LENGTH || busy} className={`${BTN} mt-6`}>
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
                  {busy ? 'Verifying…' : 'Login'}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>,
    document.getElementById('sell-with-us-root') || document.body,
  );
}

/** Small India flag for the fixed +91 prefix (business login is India-only). */
function IndiaFlag() {
  return (
    <svg viewBox="0 0 30 20" className="h-[14px] w-[21px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/5" aria-hidden="true">
      <rect width="30" height="20" fill="#FFFFFF" />
      <rect width="30" height="6.67" fill="#FF9933" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.7" />
    </svg>
  );
}

