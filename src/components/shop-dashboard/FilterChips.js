import { cx } from '@/components/site/ui';

/**
 * options: array of strings, or {value,label} objects.
 * counts: optional {[value]: number} shown as "Label · N".
 */
export default function FilterChips({ options, value, onChange, counts }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => {
        const optValue = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const active = value === optValue;
        const count = counts?.[optValue];
        return (
          <button
            key={optValue}
            type="button"
            onClick={() => onChange(optValue)}
            aria-pressed={active}
            className={cx(
              'rounded-full px-4 py-2 text-xs font-bold transition',
              active
                ? 'bg-gradient-to-r from-[#035C6C] to-[#024A57] text-white'
                : 'bg-[#F8F8F8] text-[#344054] hover:bg-[#F3F3F3] hover:text-[#024A57]',
            )}
          >
            {label}
            {count != null ? ` · ${count}` : ''}
          </button>
        );
      })}
    </div>
  );
}
