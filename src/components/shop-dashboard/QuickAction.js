import Link from 'next/link';

import { cx } from '@/components/site/ui';
import Icon3D from './Icon3D';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

export default function QuickAction({ icon: Icon, label, href }) {
  return (
    <Link
      href={href}
      className={cx(
        'group flex items-center gap-3 rounded-xl border border-[#ECECEC] bg-white px-3.5 py-3 text-sm font-semibold text-[#111111] transition',
        'hover:-translate-y-0.5 hover:border-[#ECECEC]',
        FOCUS_RING,
      )}
    >
      <span className="transition group-hover:scale-105">
        <Icon3D icon={Icon} tone="green" size="sm" />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
