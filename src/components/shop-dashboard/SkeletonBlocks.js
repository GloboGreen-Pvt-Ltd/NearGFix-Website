export function SkeletonStatCards({ count = 4, className = 'grid grid-cols-2 gap-3 sm:grid-cols-4' }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key -- static-count placeholder rows, no stable id exists yet.
        <div key={i} className="h-[118px] animate-pulse rounded-3xl border border-[#ECECEC] bg-[#F8F8F8]" />
      ))}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="divide-y divide-[#ECECEC]">
      {Array.from({ length: rows }).map((_, i) => (
        // eslint-disable-next-line react/no-array-index-key -- static-count placeholder rows, no stable id exists yet.
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[#F3F3F3]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-[#F3F3F3]" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-[#F3F3F3]" />
          </div>
        </div>
      ))}
    </div>
  );
}
