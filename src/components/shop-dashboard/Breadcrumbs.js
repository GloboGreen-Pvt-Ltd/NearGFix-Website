'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { resolveNavContext } from '@/lib/partnerNav';

export default function Breadcrumbs() {
  const pathname = usePathname();
  const { breadcrumb } = resolveNavContext(pathname);

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex list-none flex-wrap items-center gap-1 p-0 text-xs text-[#666666]">
        <li>
          <Link href="/shop-home" className="rounded font-medium transition hover:text-[#024A57]">
            Home
          </Link>
        </li>
        {breadcrumb.map((crumb, index) => (
          <li key={crumb} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-[#D0D5DD]" aria-hidden="true" />
            {index === breadcrumb.length - 1 ? (
              <span className="font-semibold text-[#344054]">{crumb}</span>
            ) : (
              <span>{crumb}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
