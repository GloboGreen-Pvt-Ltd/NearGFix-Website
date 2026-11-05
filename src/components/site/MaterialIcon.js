/**
 * Google Material Symbols (Outlined) icons, loaded from Google Fonts by the
 * Sell with Us layout (src/app/sell-with-us/layout.js).
 *
 * msIcon('smartphone') returns a component with the same call shape the pages
 * already use for icons — <Icon className="h-6 w-6 text-..." strokeWidth={2} /> —
 * so icons can be swapped without touching markup: the size is read from the
 * h-N / h-[Npx] class (Material Symbols are sized by font-size), strokeWidth
 * maps to the font's weight axis, and `filled` turns on the FILL axis.
 */

function sizeFromClass(className = '') {
  const px = className.match(/(?:^|\s)h-\[(\d+(?:\.\d+)?)px\]/);
  if (px) return Number(px[1]);
  const scale = className.match(/(?:^|\s)h-(\d+(?:\.5)?)(?:\s|$)/);
  return scale ? Number(scale[1]) * 4 : 24;
}

const weightFor = (strokeWidth) => (strokeWidth >= 2.2 ? 600 : strokeWidth >= 1.9 ? 500 : 400);

export function MaterialIcon({ name, className = '', strokeWidth = 2, filled = false, style, ...rest }) {
  const size = sizeFromClass(className);
  return (
    <span
      aria-hidden="true"
      {...rest}
      className={`material-symbols-outlined inline-flex shrink-0 select-none items-center justify-center overflow-hidden leading-none ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weightFor(strokeWidth)}, 'GRAD' 0, 'opsz' ${Math.min(48, Math.max(20, size))}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

export function msIcon(name, { filled = false } = {}) {
  function Icon(props) {
    return <MaterialIcon name={name} filled={filled} {...props} />;
  }
  Icon.displayName = `MaterialIcon(${name})`;
  return Icon;
}
