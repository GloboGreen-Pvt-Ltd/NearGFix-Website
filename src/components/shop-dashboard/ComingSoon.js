/**
 * ComingSoon — the honest placeholder for a real sidebar destination that
 * doesn't have a page yet. Not fake data, not a dead link: a real route that
 * says plainly it isn't built, with its real icon/label so it still looks
 * intentional inside the dashboard shell.
 */

import { cx } from '@/components/site/ui';

export default function ComingSoon({ icon: Icon, title, description }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-[#ECECEC] bg-[#F8F8F8] px-6 py-16 text-center">
      {Icon ? (
        <span className={cx('inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F3F3F3] text-[#024A57]')}>
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
      ) : null}
      <h2 className="mt-4 text-lg font-bold text-[#111111]">{title}</h2>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-[#666666]">{description}</p> : null}
      <span className="mt-5 inline-flex items-center rounded-full bg-[#F8F8F8] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#024A57]">
        Coming soon
      </span>
    </div>
  );
}
