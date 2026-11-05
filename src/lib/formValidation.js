/**
 * formValidation.js — small, dependency-free required-field validation
 * helpers shared across the app (management/(portal), shop-home, and the
 * public (site) customer portal). No form library exists in this project
 * (no react-hook-form/formik/yup/zod) and no equivalent shared helper
 * existed before this file — every form previously hand-rolled its own
 * `if (!x.trim()) return` checks.
 *
 * Deliberately NOT a UI component: every area of the app already uses its
 * own inline-error string convention (`<p className="text-xs text-red-600">`,
 * confirmed independently in management/brands, shop-home/book-service, and
 * site/account/profile) against three different visual token systems, so
 * this only returns error strings — callers render them however their own
 * page already does.
 *
 * A validator is `(value, allValues) => '' | errorMessage` — returning ''
 * means valid. `allValues` is passed through so a validator can depend on
 * a sibling field (e.g. "required only when serviceMode !== 'WALK_IN'");
 * most validators ignore it.
 */

export function required(message = 'This field is required.') {
  return (value) => {
    if (value == null) return message;
    if (typeof value === 'string' && value.trim() === '') return message;
    if (Array.isArray(value) && value.length === 0) return message;
    return '';
  };
}

/** Passes when empty (pair with `required` separately if the field is also mandatory) — only checks digit count once something is entered. */
export function exactDigits(n, message) {
  const msg = message || `Must be exactly ${n} digits.`;
  return (value) => {
    const v = String(value ?? '').trim();
    if (v === '') return '';
    return /^\d+$/.test(v) && v.length === n ? '' : msg;
  };
}

export function minDigits(n, message) {
  const msg = message || `Must be at least ${n} digits.`;
  return (value) => {
    const v = String(value ?? '').trim();
    if (v === '') return '';
    return /^\d+$/.test(v) && v.length >= n ? '' : msg;
  };
}

export function pattern(regex, message = 'Invalid format.') {
  return (value) => {
    const v = String(value ?? '').trim();
    if (v === '') return '';
    return regex.test(v) ? '' : message;
  };
}

export function emailFormat(message = 'Enter a valid email address.') {
  return pattern(/^\S+@\S+\.\S+$/, message);
}

/** Runs each field's validator(s) in order, stopping at the first failing one per field. */
export function validateForm(schema, values) {
  const errors = {};
  let firstErrorField = null;
  Object.keys(schema).forEach((field) => {
    const validators = Array.isArray(schema[field]) ? schema[field] : [schema[field]];
    for (const validate of validators) {
      const message = validate(values[field], values);
      if (message) {
        errors[field] = message;
        if (!firstErrorField) firstErrorField = field;
        break;
      }
    }
  });
  return { errors, firstErrorField, isValid: firstErrorField === null };
}

/**
 * For pages that currently do a chain of `if (...) return setError('msg')`
 * and aren't ready to move to per-field errors yet: evaluates
 * [[predicate, message], ...] in order, returns the first failing message
 * or ''. `predicate(values)` should return true when INVALID.
 */
export function firstError(rules, values) {
  for (const [predicate, message] of rules) {
    if (predicate(values)) return message;
  }
  return '';
}
