'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { DEVICE_CATEGORIES } from '@/lib/siteContent';

/**
 * The ONE breadcrumb for the whole repair flow.
 *
 * It grows with the picker's URL so the page has a single trail instead of two:
 *   /repair/                          → Home › Repair
 *   /repair/?category=MOBILE          → Home › Repair › Categories › Mobile
 *   …&brand=<id>&brandName=Apple      → … › Apple
 *   …&model=<id>&modelName=iPhone 15  → … › iPhone 15
 *
 * RepairFlow no longer renders its own "Categories › Mobile" trail — this
 * replaces it, so the two can never disagree. The names come from the same
 * query params RepairFlow writes (brandName / modelName) and, for the category,
 * from the bundled DEVICE_CATEGORIES, so no fetch is needed to label the trail.
 */

/** Mirror of RepairFlow.stepHref so both build identical links. */
function stepHref({ category, brand, brandName, model, modelName } = {}) {
  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  if (brand) qs.set('brand', brand);
  if (brandName) qs.set('brandName', brandName);
  if (model) qs.set('model', model);
  if (modelName) qs.set('modelName', modelName);
  const s = qs.toString();
  return s ? `/repair/?${s}` : '/repair/';
}

export default function RepairBreadcrumb() {
  const params = useSearchParams();
  const code = params.get('category');
  const brandId = params.get('brand');
  const brandName = params.get('brandName') || '';
  const modelId = params.get('model');
  const modelName = params.get('modelName') || '';
  const onService = Boolean(params.get('service'));
  const onReport = Boolean(params.get('report'));
  const onOptions = Boolean(params.get('options'));
  const onShops = Boolean(params.get('shops'));
  const onShopDetail = Boolean(params.get('shop'));
  const onAddress = Boolean(params.get('address'));
  const onSlot = Boolean(params.get('slot'));
  const onReview = Boolean(params.get('review'));
  const viaParam = params.get('via') || 'pickup';
  const servicesParam = params.get('services') || '';
  // The model is a linked (not terminal) crumb once we are past the summary step.
  const pastSummary = onService || onReport;

  const category =
    code &&
    (Array.isArray(DEVICE_CATEGORIES) ? DEVICE_CATEGORIES : []).find(
      (c) => String(c.code).toUpperCase() === String(code).toUpperCase(),
    );
  const categoryName = (category && category.name) || code || '';

  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Repair', href: '/repair/' },
  ];
  if (code) {
    // "Categories" and the category name both continue the trail into the picker.
    crumbs.push({ label: 'Categories', href: '/repair/' });
    crumbs.push({ label: categoryName, href: stepHref({ category: code }) });
  }
  if (brandId) {
    crumbs.push({
      label: brandName || 'Brand',
      href: stepHref({ category: code, brand: brandId, brandName }),
    });
  }
  const deviceHref = stepHref({ category: code, brand: brandId, brandName, model: modelId, modelName });
  if (modelId) {
    // Once past the summary the model links back to it; on the summary itself it
    // is the deepest crumb and carries no onward link.
    crumbs.push({ label: modelName || 'Model', href: pastSummary ? deviceHref : null });
  }
  if (modelId && (onService || onReport)) {
    // The service step; a link back to it when we are further along (report).
    crumbs.push({ label: 'Repair Service', href: onReport ? `${deviceHref}&service=1` : null });
  }
  if (modelId && onReport) {
    const reportHref = `${deviceHref}&report=1${servicesParam ? `&services=${servicesParam}` : ''}`;
    const optionsHref = `${reportHref}&options=1`;
    crumbs.push({ label: 'View Report', href: onOptions ? reportHref : null });
    if (onOptions) {
      crumbs.push({ label: 'Service Options', href: onShops ? optionsHref : null });
    }
    if (onShops) {
      const shopsHref = `${optionsHref}&shops=1&via=${viaParam}`;
      const shopIdParam = params.get('shop') || '';
      const shopHref = `${shopsHref}&shop=${shopIdParam}`;
      const addressHref = `${shopHref}&address=1`;
      const addrIdParam = params.get('addr') || '';
      const slotHref = `${addressHref}&addr=${addrIdParam}&slot=1`;
      const deeper = onAddress || onSlot || onReview;

      crumbs.push({ label: 'Choose Shop', href: onShopDetail ? shopsHref : null });
      if (onShopDetail) {
        crumbs.push({ label: 'Shop', href: deeper ? shopHref : null });
      }
      if (deeper) {
        crumbs.push({ label: 'Address', href: onSlot || onReview ? addressHref : null });
      }
      if (onSlot || onReview) {
        crumbs.push({ label: 'Slot', href: onReview ? slotHref : null });
      }
      if (onReview) {
        crumbs.push({ label: 'Review', href: null });
      }
    }
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex list-none flex-wrap items-center gap-1.5 p-0 text-sm text-brand-muted">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? (
                <ChevronRight className="h-4 w-4 text-brand-subtle" aria-hidden="true" />
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  scroll={false}
                  className="rounded font-medium transition hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cx(
                    'max-w-[12rem] truncate',
                    isLast ? 'font-semibold text-brand-ink' : 'font-medium',
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
