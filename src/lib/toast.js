/**
 * toast.js — the site-wide way to show an error or success message
 * (react-hot-toast, rendered by components/AppToaster.js).
 *
 *   notifySuccess('Booking created')
 *   notifyError(err)            // an Error, a string, or nothing (falls back)
 *
 * Each call passes an `id`, so the same message fired twice (a retry, a
 * re-render, a poll) replaces the visible toast instead of stacking copies.
 */

import toast from 'react-hot-toast';

const text = (v, fallback) => {
  if (!v) return fallback;
  if (typeof v === 'string') return v;
  return v.message || fallback;
};

export function notifySuccess(message, options) {
  const msg = text(message, 'Done');
  return toast.success(msg, { id: `ok:${msg}`, ...options });
}

export function notifyError(error, fallback = 'Something went wrong. Please try again.', options) {
  const msg = text(error, fallback);
  return toast.error(msg, { id: `err:${msg}`, ...options });
}

export { toast };
