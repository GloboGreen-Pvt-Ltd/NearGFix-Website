import { Search } from 'lucide-react';

import { cx } from '@/components/site/ui';

export const FIELD_INPUT_CLS =
  'w-full rounded-2xl border border-[#D0D5DD] bg-[#F8F8F8] px-3.5 py-3.5 text-sm text-[#111111] placeholder:text-[#98A2B3] transition focus:border-[#024A57] focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-[#ECECEC]';

export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024A57] focus-visible:ring-offset-2';

export default function SearchField({ value, onChange, placeholder, ariaLabel }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" aria-hidden="true" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder}
        className={cx(FIELD_INPUT_CLS, 'pl-10')}
      />
    </div>
  );
}
