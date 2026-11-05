import { cx } from '@/components/site/ui';

/**
 * Icon3D — the one shared "soft 3D icon" primitive the whole Partner
 * Dashboard redesign hangs off (see plan: noble-wiggling-deer). A gradient
 * rounded badge with a soft colored shadow and a subtle glossy top-inset
 * highlight, standing in for the flat single-color icon circles this app
 * used before. The green and mint tones are the brand green #035C6C (solid).
 */
// Each `` value is one combined box-shadow (inset glossy highlight +
// outer colored drop shadow) — two separate `` utility classes
// on the same element would NOT combine, since each is a full box-shadow
// value that replaces the other, not a layer that stacks with it.
const TONES = {
  green: { grad: 'from-[#035C6C] to-[#035C6C]', shadow: '' },
  mint: { grad: 'from-[#035C6C] to-[#035C6C]', shadow: '' },
  blue: { grad: 'from-[#38BDF8] to-[#0284C7]', shadow: '' },
  orange: { grad: 'from-[#FB923C] to-[#EA580C]', shadow: '' },
  violet: { grad: 'from-[#A78BFA] to-[#7C3AED]', shadow: '' },
  red: { grad: 'from-[#FB7185] to-[#E11D48]', shadow: '' },
  teal: { grad: 'from-[#2DD4BF] to-[#0D9488]', shadow: '' },
  indigo: { grad: 'from-[#818CF8] to-[#4F46E5]', shadow: '' },
  gray: { grad: 'from-[#CBD5E1] to-[#94A3B8]', shadow: '' },
};

const SIZES = {
  sm: { box: 'h-8 w-8', icon: 'h-4 w-4', radius: 'rounded-xl' },
  md: { box: 'h-10 w-10', icon: 'h-5 w-5', radius: 'rounded-2xl' },
  lg: { box: 'h-12 w-12', icon: 'h-6 w-6', radius: 'rounded-2xl' },
  xl: { box: 'h-16 w-16', icon: 'h-7 w-7', radius: 'rounded-2xl' },
  xxl: { box: 'h-20 w-20', icon: 'h-8 w-8', radius: 'rounded-2xl' },
};

// `flat` drops the glow for pages that want a plain, shadow-free look (Book Service).
export default function Icon3D({ icon: Icon, tone = 'green', size = 'md', flat = false, className }) {
  const t = TONES[tone] || TONES.green;
  const s = SIZES[size] || SIZES.md;
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center bg-gradient-to-br text-white', t.grad, !flat && t.shadow, s.box, s.radius, className)}
    >
      <Icon className={s.icon} aria-hidden="true" />
    </span>
  );
}
