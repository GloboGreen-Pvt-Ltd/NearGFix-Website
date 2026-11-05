'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, Info, Mail, MessageCircle, Send } from 'lucide-react';

import { Button, cx } from '@/components/site/ui';
import { BRAND } from '@/lib/siteContent';
import { notifyError } from '@/lib/toast';

/* -------------------------------------------------------------------------- */
/* Config                                                                      */
/* -------------------------------------------------------------------------- */

const ROLES = [
  { value: 'Customer', label: 'Customer — I want a repair, pickup, or to sell a device' },
  { value: 'Shop owner', label: 'Shop owner — I run a repair shop' },
  { value: 'Technician', label: 'Technician — I work at a repair shop' },
  { value: 'Other', label: 'Other — something else' },
];

const EMPTY = {
  name: '',
  mobile: '',
  email: '',
  role: '',
  shopName: '',
  message: '',
};

const FIELD_ORDER = ['name', 'mobile', 'email', 'role', 'shopName', 'message'];

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

function validate(values) {
  const errors = {};

  const name = values.name.trim();
  if (!name) errors.name = 'Please tell us your name.';
  else if (name.length < 2) errors.name = 'Your name looks too short.';

  const digits = values.mobile.replace(/\D/g, '');
  if (!digits) errors.mobile = 'We need a mobile number to call you back.';
  else if (!(digits.length === 10 || (digits.length === 12 && digits.startsWith('91')))) {
    errors.mobile = 'Enter a 10-digit Indian mobile number.';
  }

  const email = values.email.trim();
  if (!email) errors.email = 'We reply by email, so this one is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = 'That does not look like a valid email address.';
  }

  if (!values.role) errors.role = 'Pick the option that describes you best.';

  if (values.role === 'Shop owner' && !values.shopName.trim()) {
    errors.shopName = 'Tell us the shop name so we can set up your account.';
  }

  const message = values.message.trim();
  if (!message) errors.message = 'Add a short message so we know how to help.';
  else if (message.length < 10) errors.message = 'A little more detail, please — at least 10 characters.';

  return errors;
}

/* -------------------------------------------------------------------------- */
/* Handoff composition                                                         */
/* -------------------------------------------------------------------------- */

function buildSummary(values) {
  const rows = [
    ['Name', values.name.trim()],
    ['Mobile', values.mobile.trim()],
    ['Email', values.email.trim()],
    ['I am a', values.role],
  ];
  if (values.role === 'Shop owner' && values.shopName.trim()) {
    rows.push(['Shop name', values.shopName.trim()]);
  }
  rows.push(['Message', values.message.trim()]);
  return rows;
}

function buildHandoff(values) {
  const rows = buildSummary(values);
  const subject = values.role === 'Shop owner'
    ? `NearGFix shop enquiry — ${values.shopName.trim() || values.name.trim()}`
    : `NearGFix enquiry — ${values.role}`;

  const body = `${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nSent from the NearGFix contact form on ${BRAND.website}.`;

  return {
    rows,
    subject,
    mailtoHref: `mailto:${BRAND.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    whatsappHref: `${BRAND.whatsappHref}?text=${encodeURIComponent(`${subject}\n\n${body}`)}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Field primitives                                                            */
/* -------------------------------------------------------------------------- */

const CONTROL_BASE =
  'w-full rounded-2xl border bg-white px-4 py-3 text-base text-brand-ink shadow-sm transition ' +
  'placeholder:text-brand-muted focus:outline-none focus-visible:outline-none ' +
  'focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white';

function controlClasses(hasError) {
  return cx(CONTROL_BASE, hasError ? 'border-status-danger' : 'border-brand-strong focus:border-brand-600');
}

function Field({ id, label, hint, error, required = true, children, className }) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-brand-ink">
        {label}
        {required ? (
          <>
            <span className="ml-1 text-status-danger" aria-hidden="true">
              *
            </span>
            {/* The asterisk is hidden from assistive tech, so without this a
                screen reader gets no signal that the field is required. */}
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-status-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-brand-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id, error, hint) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Form                                                                        */
/* -------------------------------------------------------------------------- */

export default function EnquiryForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [handoff, setHandoff] = useState(null);
  const formRef = useRef(null);
  const panelRef = useRef(null);

  const isShopOwner = values.role === 'Shop owner';

  function update(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);

    const firstBroken = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstBroken) {
      const errorCount = Object.keys(nextErrors).length;
      notifyError(
        errorCount === 1
          ? 'One field needs fixing before we can build your message.'
          : `${errorCount} fields need fixing before we can build your message.`,
      );
      const el = formRef.current && formRef.current.querySelector(`#enquiry-${firstBroken}`);
      if (el && typeof el.focus === 'function') el.focus();
      return;
    }

    setHandoff(buildHandoff(values));
    if (panelRef.current && typeof panelRef.current.focus === 'function') {
      panelRef.current.focus();
    }
  }

  function reopenForm() {
    setHandoff(null);
  }

  function startOver() {
    setValues(EMPTY);
    setErrors({});
    setHandoff(null);
  }

  /* ---------------------------------------------------------------------- */
  /* Confirmation panel                                                      */
  /* ---------------------------------------------------------------------- */

  if (handoff) {
    return (
      <div
        ref={panelRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="rounded-3xl border border-brand-200 bg-brand-50 p-6 shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 sm:p-8"
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-700">
          <Send className="h-6 w-6" aria-hidden="true" />
        </span>

        <h3 className="mt-5 text-xl font-bold tracking-tight text-brand-ink sm:text-2xl">
          Your enquiry is ready to send
        </h3>

        <p className="mt-3 max-w-prose text-base leading-relaxed text-brand-ink">
          Nothing has been sent yet. This website is a static site with no form inbox behind it, so we
          hand the message to an app you already trust. Pick one below — it opens your email app or
          WhatsApp with every detail pre-filled, and you press send.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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

        <div className="mt-8 overflow-hidden rounded-2xl border border-brand-line bg-white">
          <p className="border-b border-brand-line px-5 py-3 text-xs font-bold uppercase tracking-widest text-brand-700">
            What gets sent
          </p>
          <dl className="divide-y divide-brand-line">
            {handoff.rows.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 px-5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4"
              >
                <dt className="text-sm font-semibold text-brand-muted">{label}</dt>
                <dd className="break-words text-sm text-brand-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button variant="ghost" size="sm" icon={ArrowLeft} iconPosition="left" onClick={reopenForm}>
            Edit these details
          </Button>
          <Button variant="ghost" size="sm" onClick={startOver}>
            Clear and start again
          </Button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Form                                                                    */
  /* ---------------------------------------------------------------------- */

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      className="rounded-3xl border border-brand-line bg-white p-6 shadow-soft sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="enquiry-name" label="Your name" error={errors.name}>
          <input
            id="enquiry-name"
            name="name"
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={(e) => update('name', e.target.value)}
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={describedBy('enquiry-name', errors.name)}
            className={controlClasses(Boolean(errors.name))}
            placeholder="Ravi Kumar"
          />
        </Field>

        <Field
          id="enquiry-mobile"
          label="Mobile number"
          hint="We call or WhatsApp this number."
          error={errors.mobile}
        >
          <input
            id="enquiry-mobile"
            name="mobile"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.mobile}
            onChange={(e) => update('mobile', e.target.value)}
            aria-invalid={errors.mobile ? 'true' : 'false'}
            aria-describedby={describedBy(
              'enquiry-mobile',
              errors.mobile,
              'We call or WhatsApp this number.'
            )}
            className={controlClasses(Boolean(errors.mobile))}
            placeholder="98765 43210"
          />
        </Field>

        <Field id="enquiry-email" label="Email address" error={errors.email} className="sm:col-span-2">
          <input
            id="enquiry-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => update('email', e.target.value)}
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={describedBy('enquiry-email', errors.email)}
            className={controlClasses(Boolean(errors.email))}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          id="enquiry-role"
          label="I am a…"
          error={errors.role}
          className={isShopOwner ? undefined : 'sm:col-span-2'}
        >
          <select
            id="enquiry-role"
            name="role"
            value={values.role}
            onChange={(e) => update('role', e.target.value)}
            aria-invalid={errors.role ? 'true' : 'false'}
            aria-describedby={describedBy('enquiry-role', errors.role)}
            className={controlClasses(Boolean(errors.role))}
          >
            <option value="">Select one…</option>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </Field>

        {isShopOwner ? (
          <Field
            id="enquiry-shopName"
            label="Shop name"
            hint="The name your customers see on the board outside."
            error={errors.shopName}
          >
            <input
              id="enquiry-shopName"
              name="shopName"
              type="text"
              autoComplete="organization"
              value={values.shopName}
              onChange={(e) => update('shopName', e.target.value)}
              aria-invalid={errors.shopName ? 'true' : 'false'}
              aria-describedby={describedBy(
                'enquiry-shopName',
                errors.shopName,
                'The name your customers see on the board outside.'
              )}
              className={controlClasses(Boolean(errors.shopName))}
              placeholder="Sri Balaji Mobile Care"
            />
          </Field>
        ) : null}

        <Field
          id="enquiry-message"
          label="How can we help?"
          hint={
            isShopOwner
              ? 'Tell us how many shops and staff you run, and whether you need doorstep pickup.'
              : 'Device model, order number, or what went wrong — whatever you already know.'
          }
          error={errors.message}
          className="sm:col-span-2"
        >
          <textarea
            id="enquiry-message"
            name="message"
            rows={5}
            value={values.message}
            onChange={(e) => update('message', e.target.value)}
            aria-invalid={errors.message ? 'true' : 'false'}
            aria-describedby={describedBy(
              'enquiry-message',
              errors.message,
              isShopOwner
                ? 'Tell us how many shops and staff you run, and whether you need doorstep pickup.'
                : 'Device model, order number, or what went wrong — whatever you already know.'
            )}
            className={cx(controlClasses(Boolean(errors.message)), 'resize-y')}
            placeholder={
              isShopOwner
                ? 'I run two counters in Coimbatore with four technicians and want to start the 15-day free trial.'
                : 'My Redmi Note 12 screen is cracked and I would like a doorstep pickup this week.'
            }
          />
        </Field>
      </div>

      <div className="mt-7 flex flex-col gap-4 border-t border-brand-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm leading-relaxed text-brand-muted sm:max-w-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <span>
            Nothing is submitted to a server. The next step opens your own mail app or WhatsApp with
            the message written out.
          </span>
        </p>
        <Button type="submit" size="lg" icon={Send} className="w-full sm:w-auto">
          Compose my enquiry
        </Button>
      </div>
    </form>
  );
}
