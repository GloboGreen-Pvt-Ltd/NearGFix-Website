'use client';

/**
 * BusinessRegister — the /business/register page content.
 *
 * IMPORTANT — what this form actually does, and why:
 * There is no self-service shop-owner registration backend anywhere in this
 * codebase (no mobile-OTP send/verify pair, no public account-creation
 * endpoint — the only real account-creation call, POST /auth/shop-owner, is
 * staff-authenticated and email/password based, called from the management
 * portal's "new owner" screen). Building a working OTP-verification step or
 * an "account created" success state here would mean fabricating a backend
 * that doesn't exist — exactly what this feature must not do.
 *
 * So this form collects only what it can honestly act on — a mobile number —
 * validates its format, and on submit composes the SAME real handoff
 * mechanism the /contact page's EnquiryForm already uses: a mailto: /
 * WhatsApp link pre-filled with the details, which the visitor's own mail
 * app or WhatsApp sends. Nothing is claimed to be verified or created; the
 * copy says a request is ready to send, and that NearGFix will follow up to
 * complete KYC, shop details and bank account setup (see the Requirements
 * checklist, which is informational only — none of those fields are
 * collected here, since none has a backend field to submit them to).
 *
 * "Business Login" throughout points at /shopmanagement — the real,
 * already-working shop-owner sign-in built this session (src/lib/shopAuth.js
 * against POST /auth/login) — rather than a second, non-functional
 * /business/login door.
 */

import { useRef, useState } from 'react';
import Link from '@/components/PortalLink';
import Image from 'next/image';
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Store,
  Users,
  Wrench,
} from 'lucide-react';

import { Button, cx } from '@/components/site/ui';
import LocationControl from '@/components/site/LocationControl';
import { BRAND } from '@/lib/siteContent';

/* -------------------------------------------------------------------------- */
/* Content                                                                     */
/* -------------------------------------------------------------------------- */

const BENEFITS = [
  {
    icon: Users,
    title: 'Thousands of Customers',
    description: 'Reach customers looking for devices and repair services.',
  },
  {
    icon: MapPin,
    title: 'Pan-India Reach',
    description: 'Grow your business across supported locations.',
  },
  {
    icon: Store,
    title: 'Sell & Manage',
    description: 'Sell products and manage orders from one dashboard.',
  },
  {
    icon: Wrench,
    title: 'Repair Services',
    description: 'Accept service bookings and grow your repair business.',
  },
];

const REQUIREMENTS = [
  {
    title: 'Business Details',
    items: ['Business / Shop Name', 'Business Type', 'GSTIN (optional, depending on seller type)'],
  },
  {
    title: 'Identity Verification',
    items: ['Aadhaar / PAN or an approved KYC document'],
  },
  {
    title: 'Bank Account',
    items: ['Account Holder Name', 'Account Number', 'IFSC Code'],
  },
  {
    title: 'Shop Information',
    items: ['Shop Address', 'Service Location'],
  },
];

/* -------------------------------------------------------------------------- */
/* Validation + handoff                                                       */
/* -------------------------------------------------------------------------- */

function normalizeMobile(value) {
  return value.replace(/\D/g, '');
}

function validateMobile(value) {
  const digits = normalizeMobile(value);
  if (!digits) return 'Enter your mobile number to get started.';
  if (digits.length !== 10) return 'Please enter a valid 10-digit mobile number.';
  return null;
}

function buildHandoff(mobile) {
  const digits = normalizeMobile(mobile);
  const subject = `NearGFix Business Registration — +91 ${digits}`;
  const body =
    `New business/shop owner sign-up interest via the NearGFix website.\n\n` +
    `Mobile: +91 ${digits}\n\n` +
    `Please contact this number to complete onboarding — KYC, shop details and bank account setup.\n\n` +
    `Sent from the NearGFix Business Registration page on ${BRAND.website}.`;

  return {
    digits,
    mailtoHref: `mailto:${BRAND.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    whatsappHref: `${BRAND.whatsappHref}?text=${encodeURIComponent(`${subject}\n\n${body}`)}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Shared classes                                                              */
/* -------------------------------------------------------------------------- */

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

/* -------------------------------------------------------------------------- */
/* Original NearGFix illustration — storefront, device, tools, package, delivery */
/* -------------------------------------------------------------------------- */

function BusinessIllustration({ className }) {
  return (
    <svg
      viewBox="0 0 320 220"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* ground */}
      <ellipse cx="160" cy="196" rx="140" ry="10" fill="#E5F3F5" />

      {/* storefront */}
      <rect x="26" y="86" width="130" height="92" rx="10" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="2" />
      <path d="M20 86 L46 52 H136 L162 86 Z" fill="#E5F3F5" stroke="#035C6C" strokeWidth="2" strokeLinejoin="round" />
      <rect x="46" y="112" width="34" height="34" rx="6" fill="#E5F3F5" stroke="#035C6C" strokeWidth="2" />
      <rect x="98" y="112" width="46" height="66" rx="6" fill="#035C6C" />
      <rect x="105" y="120" width="32" height="42" rx="3" fill="#E5F3F5" />

      {/* smartphone */}
      <g transform="translate(180 96) rotate(-8)">
        <rect x="0" y="0" width="52" height="92" rx="12" fill="#0F172A" />
        <rect x="5" y="8" width="42" height="72" rx="3" fill="#FFFFFF" />
        <circle cx="26" cy="84" r="3" fill="#334155" />
      </g>

      {/* wrench badge */}
      <circle cx="248" cy="72" r="26" fill="#024A57" />
      <path
        d="M238 62 a8 8 0 1 1 5 15 l14 14 -5 5 -14 -14 a8 8 0 0 1 -10 -20 l4 4 -3 3 3 3 3 -3 4 4 z"
        fill="#FFFFFF"
      />

      {/* package box */}
      <g transform="translate(214 128)">
        <rect x="0" y="10" width="46" height="38" rx="4" fill="#FFF7ED" stroke="#FF7A00" strokeWidth="2" />
        <path d="M0 20 H46 M23 10 V48" stroke="#FF7A00" strokeWidth="2" />
      </g>

      {/* delivery path */}
      <path d="M40 190 C 110 176, 210 176, 280 190" stroke="#C7E6EA" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
      <g transform="translate(258 176)">
        <rect x="0" y="6" width="30" height="16" rx="3" fill="#0F172A" />
        <rect x="-14" y="10" width="16" height="12" rx="2" fill="#035C6C" />
        <circle cx="0" cy="24" r="4" fill="#0F172A" />
        <circle cx="20" cy="24" r="4" fill="#0F172A" />
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Field primitives                                                            */
/* -------------------------------------------------------------------------- */

const CONTROL_BASE =
  'w-full rounded-xl border bg-white px-4 py-3 text-base text-brand-ink transition ' +
  'placeholder:text-brand-subtle ' + FOCUS_RING;

function controlClasses(hasError) {
  return cx(CONTROL_BASE, hasError ? 'border-red-400' : 'border-brand-line hover:border-brand-strong focus:border-brand-600');
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function BusinessRegister() {
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [handoff, setHandoff] = useState(null);
  const inputRef = useRef(null);

  function handleChange(event) {
    setMobile(event.target.value);
    if (error) setError('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    const message = validateMobile(mobile);
    if (message) {
      setError(message);
      if (inputRef.current) inputRef.current.focus();
      return;
    }
    setHandoff(buildHandoff(mobile));
  }

  function editDetails() {
    setHandoff(null);
  }

  return (
    <div className="min-h-screen bg-[#F7F9FA]">
      {/* -------------------------------------------------------------- */}
      {/* Slim page header — logo, location, Business Login               */}
      {/* -------------------------------------------------------------- */}
      <header className="border-b border-brand-line bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className={cx('flex shrink-0 items-center gap-2.5 rounded-xl py-1', FOCUS_RING)} aria-label={`${BRAND.name} home`}>
            <Image src={BRAND.logo} alt={BRAND.logoAlt} width={36} height={36} priority className="h-9 w-9 rounded-xl object-contain" />
            <span className="text-lg font-extrabold tracking-tight text-brand-ink sm:text-xl">{BRAND.name}</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <LocationControl className="hidden sm:flex" />
            <span className="hidden text-sm text-brand-muted md:inline">Already have a business account?</span>
            <Link
              href="/sell-with-us/?login=1"
              className={cx(
                'inline-flex items-center gap-1.5 rounded-xl border border-brand-line px-3.5 py-2 text-sm font-semibold text-brand-ink transition hover:border-brand-300 hover:bg-brand-soften',
                FOCUS_RING,
              )}
            >
              <Store className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Business Login
            </Link>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- */}
      {/* Main — two column                                                */}
      {/* -------------------------------------------------------------- */}
      <div className="mx-auto w-full max-w-[1480px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[44%_1fr] lg:gap-16">
          {/* ---- LEFT — registration -------------------------------- */}
          <div className="mx-auto w-full max-w-md lg:mx-0">
            <h1 className="text-3xl font-bold tracking-tight text-brand-ink sm:text-4xl">
              Start Your Business with NearGFix
            </h1>
            <p className="mt-3 text-base leading-relaxed text-brand-muted">
              Create your business account and start selling products and offering services across{' '}
              {BRAND.name}.
            </p>

            <div className="mt-8 rounded-3xl border border-brand-line bg-white p-6 shadow-soft sm:p-8">
              {handoff ? (
                <div role="status" aria-live="polite">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-700">
                    <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-xl font-bold tracking-tight text-brand-ink">
                    Your registration request is ready to send
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                    Nothing has been submitted yet. Send it below and our team will call or WhatsApp
                    +91 {handoff.digits} to verify your number and complete onboarding — KYC, shop
                    details and bank account setup.
                  </p>

                  <div className="mt-6 flex flex-col gap-3">
                    <Button href={handoff.mailtoHref} external icon={Mail} iconPosition="left" size="lg">
                      Open my email app
                    </Button>
                    <Button
                      href={handoff.whatsappHref}
                      external
                      target="_blank"
                      variant="outline"
                      icon={MessageCircle}
                      iconPosition="left"
                      size="lg"
                    >
                      Send on WhatsApp
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={editDetails}
                    className={cx('mt-5 rounded-lg text-sm font-semibold text-brand-700 hover:underline', FOCUS_RING)}
                  >
                    Edit mobile number
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <label htmlFor="business-mobile" className="mb-1.5 block text-sm font-semibold text-brand-ink">
                    Mobile Number
                  </label>
                  <div className="flex items-stretch gap-2">
                    <span className="inline-flex shrink-0 items-center rounded-xl border border-brand-line bg-brand-page px-3 text-sm font-semibold text-brand-ink">
                      +91
                    </span>
                    <input
                      ref={inputRef}
                      id="business-mobile"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={mobile}
                      onChange={handleChange}
                      placeholder="Enter Mobile Number"
                      maxLength={10}
                      aria-invalid={error ? 'true' : 'false'}
                      aria-describedby={error ? 'business-mobile-error' : undefined}
                      className={controlClasses(Boolean(error))}
                    />
                  </div>
                  {error ? (
                    <p id="business-mobile-error" className="mt-2 text-sm font-medium text-red-600">
                      {error}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-brand-muted">
                      We&rsquo;ll call or WhatsApp this number to verify you and complete your registration.
                    </p>
                  )}

                  <button
                    type="submit"
                    className={cx(
                      'mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition',
                      'hover:bg-brand-700',
                      FOCUS_RING,
                    )}
                  >
                    Create Business Account
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <p className="mt-4 text-center text-xs leading-relaxed text-brand-muted">
                    By continuing, you agree to our{' '}
                    <Link href="/terms" className="font-semibold text-brand-700 underline underline-offset-2">
                      Terms &amp; Conditions
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="font-semibold text-brand-700 underline underline-offset-2">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* ---- RIGHT — benefits + requirements ---------------------- */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-brand-ink sm:text-3xl">
              Grow Your Business Faster with {BRAND.name}
            </h2>
            <p className="mt-3 max-w-prose text-base leading-relaxed text-brand-muted">
              Reach more customers, manage your business, sell devices and deliver professional repair
              services from one platform.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <div key={benefit.title} className="rounded-2xl border border-brand-line bg-white p-5 shadow-soft">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand-700">
                    <benefit.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3.5 text-base font-bold text-brand-ink">{benefit.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-brand-muted">{benefit.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 border-t border-brand-line pt-8">
              <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-brand-ink">
                <ShieldCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
                Everything you need to start with {BRAND.name}
              </h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {REQUIREMENTS.map((group) => (
                  <div key={group.title} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-brand-ink">{group.title}</p>
                      <ul className="mt-1 space-y-0.5">
                        {group.items.map((item) => (
                          <li key={item} className="text-sm text-brand-muted">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <BusinessIllustration className="mt-10 hidden h-auto w-full max-w-sm opacity-90 sm:block sm:ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
