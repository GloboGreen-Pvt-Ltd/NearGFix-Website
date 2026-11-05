import Icon3D from './Icon3D';

/** `tone`: 'brand' (green, default) or 'muted' (gray) — routes through the shared Icon3D badge. */
export default function EmptyState({ icon: Icon, title, description, action, tone = 'brand' }) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center sm:px-5">
      <Icon3D icon={Icon} tone={tone === 'muted' ? 'gray' : 'green'} size="lg" />
      <p className="mt-3 text-sm font-semibold text-[#111111]">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-sm text-[#666666]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
