'use client';

import { useState, useEffect } from 'react';

/**
 * <img> for a URL the API returned (owner avatar, KYC scan, shop document) that
 * shows a controlled placeholder instead of a broken-image icon when the URL is
 * empty or the object 404s. This is UI-only protection — it never rewrites or
 * clears the underlying value, so a real backend/DB problem still surfaces
 * wherever that value is otherwise shown (e.g. the raw url in an "Open" link).
 */
export default function SafeImage({ src, alt, className, placeholderClassName, placeholderText, fallback }) {
  const [broken, setBroken] = useState(false);
  // A replacement upload changes `src`; retry loading it instead of sticking
  // with a stale "broken" flag from whatever URL was shown before.
  useEffect(() => { setBroken(false); }, [src]);

  if (!src || broken) {
    if (fallback) return fallback;
    return (
      <div className={placeholderClassName || className} title={alt}>
        {placeholderText || 'No image'}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setBroken(true)} />
  );
}
