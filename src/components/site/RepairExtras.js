'use client';

import { useSearchParams } from 'next/navigation';

/**
 * RepairExtras — shows its children ONLY on the bare /repair category step, and
 * hides them the moment a category is chosen (?category=…, and every deeper step
 * that keeps that param: brand, product, summary).
 *
 * It wraps the marketing chrome around the picker — the hero banner, the
 * "how a repair works" section and the closing CTA — none of which belong on the
 * focused "Select a brand" / "Select a product" screens.
 *
 * STATIC-EXPORT NOTE — why the caller pairs this with `fallback={sameContent}`:
 * under output:'export', useSearchParams() is client-only, so this component is
 * rendered on the client. The parent Suspense's FALLBACK is what lands in the
 * prerendered HTML. Passing the identical content as BOTH the fallback and this
 * component's children means:
 *   • /repair            → build HTML has the content (fallback); the client
 *                          resolves to the same content — no flash, and the
 *                          marketing copy is in the static HTML for SEO.
 *   • /repair?category=… → build HTML briefly shows it, then the client hides it.
 *                          A one-frame flash on the secondary screen is the
 *                          deliberate trade for zero flash on the primary page.
 */
export default function RepairExtras({ children }) {
  const params = useSearchParams();
  if (params.get('category')) return null;
  return children;
}
