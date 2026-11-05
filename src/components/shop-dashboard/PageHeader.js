/**
 * PageHeader — the one page banner every dashboard page uses: a plain
 * #F8F8F8 card, 30–34px title, 14–15px subtitle, optional `action` on the
 * right (buttons / a summary pill) and optional `children` under the text
 * (e.g. a month picker). Same size on every page.
 */
export default function PageHeader({ title, subtitle, action, children }) {
  return (
    <div className="rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-[28px] font-extrabold leading-tight tracking-tight text-[#111111] sm:text-[34px]">{title}</h1>
          {subtitle ? <p className="mt-1 text-[14px] text-[#666666] sm:text-[15px]">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
