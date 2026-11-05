/**
 * formFocus.js — pairs with formValidation.js. Registers a ref per field
 * name (same pattern already used for `tabRefs` in
 * shop-home/services/book-service/page.js) and focuses + smooth-scrolls
 * the first invalid one after a failed validation, per the app-wide
 * "focus first invalid field" requirement.
 */

export function registerField(refs, name) {
  return (el) => {
    if (!refs.current) return;
    refs.current[name] = el;
  };
}

export function focusField(refs, name) {
  const el = refs?.current?.[name];
  if (!el) return;
  if (typeof el.focus === 'function') el.focus({ preventScroll: true });
  if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
