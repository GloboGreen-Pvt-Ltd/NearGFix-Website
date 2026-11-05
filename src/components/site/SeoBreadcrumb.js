import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/seo';

/**
 * Visible breadcrumb trail plus matching BreadcrumbList JSON-LD, for the SEO
 * landing pages. Same markup and classes as the /repair page's static trail so
 * the two read as one component. Server-rendered — no URL reading involved.
 *
 *   items: [{ name, path }] from Home to the current page (last = current).
 */
export default function SeoBreadcrumb({ items }) {
  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="flex list-none flex-wrap items-center gap-1.5 p-0 text-sm text-brand-muted">
          {items.map((item, i) => {
            const last = i === items.length - 1;
            return (
              <li key={item.path} className="flex items-center gap-1.5">
                {i > 0 ? <ChevronRight className="h-4 w-4 text-brand-subtle" aria-hidden="true" /> : null}
                {last ? (
                  <span aria-current="page" className="font-semibold text-brand-ink">
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.path}
                    className="rounded font-medium transition hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={breadcrumbSchema(items)} />
    </>
  );
}
