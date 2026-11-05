import Link from 'next/link';

/**
 * The Terms / Privacy consent checkbox used by every login and sign-up form.
 *
 * Both links open the full document in a new tab, so reading one never throws
 * away a half-finished login. Each link is its own focusable target: clicking a
 * link inside a <label> follows the link without toggling the checkbox.
 * Callers block submit until `checked` is true and, after a successful login,
 * record it with recordLegalAcceptance() (src/lib/legalConsent.js).
 *
 * This is consent to the Terms and acknowledgement of the Privacy Policy — not
 * a marketing opt-in.
 *
 *   tone     'brand' (public site) or 'business' (Sell with NearGFix, #035C6C accent)
 *   hint     optional helper line, announced through aria-describedby
 *   invalid  show the hint as an error (submit was attempted unticked)
 */
const TONES = {
  brand: {
    box: 'mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-brand-strong accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
    label: 'text-sm leading-snug text-brand-muted',
    link: 'rounded font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700',
    hint: 'text-xs text-brand-muted',
  },
  business: {
    box: 'mt-px h-[17px] w-[17px] shrink-0 cursor-pointer rounded-[4px] accent-[#035C6C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2',
    label: 'text-[13.5px] leading-snug text-[#555555]',
    link: 'rounded font-semibold text-[#035C6C] underline underline-offset-2 hover:text-[#035C6C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C]',
    hint: 'text-xs text-[#666666]',
  },
};

export default function LegalConsentCheckbox({ id, checked, onChange, tone = 'brand', hint, invalid = false, className }) {
  const t = TONES[tone] || TONES.brand;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={hintId}
          className={t.box}
        />
        <label htmlFor={id} className={`cursor-pointer ${t.label}`}>
          I agree to the{' '}
          <Link href="/terms/" target="_blank" rel="noopener noreferrer" className={t.link}>
            Terms and Conditions
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>{' '}
          and acknowledge the{' '}
          <Link href="/privacy/" target="_blank" rel="noopener noreferrer" className={t.link}>
            Privacy Policy
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </label>
      </div>
      {hint ? (
        <p id={hintId} className={`mt-1.5 pl-[26px] ${invalid ? 'text-xs font-medium text-red-600' : t.hint}`} aria-live="polite">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
