/**
 * ui.js — presentational kit for the public NearGFix marketing site.
 *
 * Everything in here is a server component: no state, no effects, no browser
 * APIs. Safe under `output: 'export'`.
 *
 * Icons: lucide-react components are imported EXPLICITLY and resolved through
 * the `ICONS` map below. Never build an icon import path dynamically — it
 * defeats tree-shaking and breaks the static export.
 */

import Link from '@/components/PortalLink';
import {
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  Boxes,
  Building2,
  CalendarClock,
  Camera,
  Check,
  CircleHelp,
  ClipboardList,
  Cpu,
  Handshake,
  HardHat,
  Headset,
  IndianRupee,
  ListChecks,
  Lock,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MonitorSmartphone,
  Navigation,
  Package,
  Phone,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Route,
  ScanFace,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Truck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* Icon registry                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Explicit name → component lookup. siteContent.js references icons by name;
 * this map is the only place those names are resolved.
 */
export const ICONS = {
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  Boxes,
  Building2,
  CalendarClock,
  Camera,
  Check,
  CircleHelp,
  ClipboardList,
  Cpu,
  Handshake,
  HardHat,
  Headset,
  IndianRupee,
  ListChecks,
  Lock,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MonitorSmartphone,
  Navigation,
  Package,
  Phone,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Route,
  ScanFace,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Truck,
  Users,
  Wallet,
  Wrench,
};

/**
 * Resolve an icon that may be given as a lucide component OR as a name string.
 * Returns null when it cannot be resolved, so callers can render nothing.
 */
export function resolveIcon(icon) {
  if (!icon) return null;
  if (typeof icon === 'string') return ICONS[icon] || null;
  return icon;
}

/** Tiny classname joiner — avoids pulling in clsx for six characters of logic. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Desktop header menu item (SiteHeader's menu card, CategoryNavMenu triggers):
 * text only, with a green underline that grows in on hover. `open` keeps it
 * green and underlined while that item's dropdown is showing. No separate
 * "active page" style — the menu card stays calm, and the underline already
 * says where the pointer is.
 */
export function desktopNavItemClass(open = false) {
  return cx(
    'relative inline-flex items-center whitespace-nowrap rounded-lg px-2.5 py-2.5 text-sm font-semibold transition xl:px-3.5 xl:text-[15px]',
    'after:absolute after:inset-x-2.5 xl:after:inset-x-3.5 after:bottom-1 after:h-0.5 after:origin-left after:rounded-full after:bg-brand-600 after:transition-transform',
    open
      ? 'text-brand-700 after:scale-x-100'
      : 'text-brand-ink after:scale-x-0 hover:text-brand-700 hover:after:scale-x-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
  );
}

/* -------------------------------------------------------------------------- */
/* Layout primitives                                                           */
/* -------------------------------------------------------------------------- */

export function Container({ className, children, as: Tag = 'div' }) {
  return (
    <Tag className={cx('mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8', className)}>{children}</Tag>
  );
}

/**
 * Section backgrounds.
 *
 * The site background is WHITE. 'page' used to be the tinted #F6F7F9 that
 * alternated with 'white' to separate sections; it is now white too, so those
 * two are deliberately identical and adjacent sections no longer band. 'soft'
 * (a very pale green) and 'dark' are kept as the remaining contrast bands —
 * they are what still gives the page rhythm.
 */
const SECTION_TONES = {
  page: 'bg-white text-brand-ink',
  white: 'bg-white text-brand-ink',
  soft: 'bg-brand-50 text-brand-ink',
  dark: 'bg-brand-900 text-white',
};

/**
 * Vertical rhythm presets.
 *
 * A prop rather than a className override: `cx` is a plain join with no
 * tailwind-merge, so passing "py-8" alongside the built-in "py-16" would emit
 * BOTH and let CSS source order decide the winner — which is not something to
 * leave to chance. 'default' is unchanged, so every existing page is unaffected.
 */
const SECTION_PADDING = {
  default: 'py-16 sm:py-20 lg:py-24',
  tight: 'py-6 sm:py-8 lg:py-10',
  // For a section that sits directly under the sticky header, where the header's
  // own bottom border already provides the separation.
  snug: 'py-3 sm:py-4 lg:py-5',
  // Effectively flush — 2px, just enough that the section's content does not
  // collide with the header border above it.
  hairline: 'py-0.5',
  none: 'py-0',
};

export function Section({
  id,
  tone = 'page',
  padding = 'default',
  className,
  containerClassName,
  children,
}) {
  return (
    <section
      id={id}
      className={cx(
        SECTION_PADDING[padding] || SECTION_PADDING.default,
        SECTION_TONES[tone] || SECTION_TONES.page,
        className,
      )}
    >
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  as: Tag = 'h2',
  inverted = false,
  className,
}) {
  const centered = align === 'center';
  return (
    <div
      className={cx(
        'flex flex-col gap-4',
        centered ? 'items-center text-center' : 'items-start text-left',
        className
      )}
    >
      {eyebrow ? (
        <span
          className={cx(
            'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest',
            inverted ? 'bg-white/10 text-brand-100' : 'bg-brand-soft text-brand-700'
          )}
        >
          {eyebrow}
        </span>
      ) : null}

      <Tag
        className={cx(
          'text-3xl font-bold tracking-tight sm:text-4xl',
          inverted ? 'text-white' : 'text-brand-ink'
        )}
      >
        {title}
      </Tag>

      {subtitle ? (
        <p
          className={cx(
            'max-w-prose text-base leading-relaxed sm:text-lg',
            centered && 'mx-auto',
            inverted ? 'text-brand-100' : 'text-brand-muted'
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const BUTTON_VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-soft hover:bg-brand-700 hover:shadow-lift',
  accent: 'bg-accent-500 text-[#111111] shadow-soft hover:bg-accent-600 hover:shadow-lift',
  outline: 'border border-brand-strong bg-white text-brand-ink hover:border-brand-600 hover:text-brand-700',
  ghost: 'text-brand-700 hover:bg-brand-soft',
  white: 'bg-white text-brand-700 shadow-soft hover:bg-brand-50 hover:shadow-lift',
};

const BUTTON_SIZES = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm sm:text-base',
  lg: 'px-7 py-3.5 text-base sm:text-lg',
};

export function Button({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  icon,
  iconPosition = 'right',
  external = false,
  type = 'button',
  ...rest
}) {
  const Icon = resolveIcon(icon);
  const classes = cx(
    BUTTON_BASE,
    BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary,
    BUTTON_SIZES[size] || BUTTON_SIZES.md,
    className
  );

  const inner = (
    <>
      {Icon && iconPosition === 'left' ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      <span>{children}</span>
      {Icon && iconPosition === 'right' ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
    </>
  );

  if (href) {
    if (external) {
      return (
        <a href={href} className={classes} rel="noopener noreferrer" {...rest}>
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...rest}>
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...rest}>
      {inner}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Cards                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({ as: Tag = 'div', className, children, hover = true, padded = true }) {
  return (
    <Tag
      className={cx(
        'rounded-3xl border border-brand-line bg-white shadow-soft',
        padded && 'p-6 sm:p-8',
        hover &&
          'transition motion-safe:hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift',
        className
      )}
    >
      {children}
    </Tag>
  );
}

const ICON_TONES = {
  brand: 'bg-brand-soft text-brand-700',
  accent: 'bg-accent-soft text-accent-600',
  neutral: 'bg-brand-soften text-brand-muted',
};

export function FeatureCard({
  icon,
  title,
  description,
  tone = 'brand',
  points,
  className,
  href,
}) {
  const Icon = resolveIcon(icon);

  const body = (
    <>
      {Icon ? (
        <span
          className={cx(
            'mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl',
            ICON_TONES[tone] || ICON_TONES.brand
          )}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      ) : null}

      <h3 className="text-lg font-bold tracking-tight text-brand-ink sm:text-xl">{title}</h3>

      {description ? (
        <p className="mt-2 text-base leading-relaxed text-brand-muted">{description}</p>
      ) : null}

      {points && points.length ? (
        <ul className="mt-4 space-y-2">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm text-brand-muted">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Card as="div" className={cx('h-full', className)}>
        <Link
          href={href}
          className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
        >
          {body}
        </Link>
      </Card>
    );
  }

  return <Card className={cx('h-full', className)}>{body}</Card>;
}

export function StatTile({ value, unit, label, tone = 'brand', className }) {
  return (
    <div
      className={cx(
        'rounded-3xl border border-brand-line bg-white p-6 text-center shadow-soft sm:p-8',
        className
      )}
    >
      <p className="flex items-baseline justify-center gap-1">
        <span
          className={cx(
            'text-4xl font-extrabold tracking-tight sm:text-5xl',
            tone === 'accent' ? 'text-accent-500' : 'text-brand-600'
          )}
        >
          {value}
        </span>
        {unit ? <span className="text-lg font-semibold text-brand-muted">{unit}</span> : null}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-brand-muted">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

const BADGE_TONES = {
  brand: 'bg-brand-soft text-brand-700',
  accent: 'bg-accent-soft text-accent-700',
  neutral: 'bg-brand-soften text-brand-muted',
  inverted: 'bg-white/10 text-white',
};

export function Badge({ tone = 'brand', icon, className, children }) {
  const Icon = resolveIcon(icon);
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide',
        BADGE_TONES[tone] || BADGE_TONES.brand,
        className
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Step list                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Numbered, vertically connected steps. `steps` items accept
 * { title, description, icon?, highlight? }.
 */
export function StepList({ steps, className, tone = 'brand', startAt = 1 }) {
  return (
    <ol className={cx('relative space-y-6', className)}>
      {steps.map((step, index) => {
        const Icon = resolveIcon(step.icon);
        const isLast = index === steps.length - 1;
        return (
          <li key={step.title} className="relative flex gap-4 sm:gap-6">
            {/* connector */}
            {!isLast ? (
              <span
                className="absolute left-5 top-12 bottom-[-1.5rem] w-px bg-brand-line sm:left-6"
                aria-hidden="true"
              />
            ) : null}

            <span
              className={cx(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:h-12 sm:w-12 sm:text-base',
                step.highlight || tone === 'accent'
                  ? 'bg-accent-500 text-[#111111]'
                  : 'bg-brand-600 text-white'
              )}
            >
              {index + startAt}
            </span>

            <div className="min-w-0 flex-1 pb-2">
              <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-brand-ink sm:text-lg">
                {Icon ? (
                  <Icon className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                ) : null}
                {step.title}
              </h3>
              {step.description ? (
                <p className="mt-1.5 text-sm leading-relaxed text-brand-muted sm:text-base">
                  {step.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Check list                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Tick-bulleted list. `items` may be strings or { label, excluded? } objects.
 * Excluded items render muted with a dash instead of a tick.
 */
export function CheckList({ items, className, tone = 'brand', size = 'md' }) {
  return (
    <ul className={cx('space-y-3', className)}>
      {items.map((raw) => {
        const item = typeof raw === 'string' ? { label: raw } : raw;
        const excluded = Boolean(item.excluded);
        return (
          <li
            key={item.label}
            className={cx(
              'flex items-start gap-3 leading-relaxed',
              size === 'sm' ? 'text-sm' : 'text-sm sm:text-base',
              excluded ? 'text-brand-muted' : 'text-brand-ink'
            )}
          >
            <span
              className={cx(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                excluded
                  ? 'bg-brand-soften text-brand-muted'
                  : tone === 'accent'
                    ? 'bg-accent-soft text-accent-600'
                    : 'bg-brand-soft text-brand-700'
              )}
            >
              {excluded ? (
                <span className="block h-px w-2.5 bg-current" aria-hidden="true" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>
            <span className={excluded ? 'line-through decoration-brand-strong' : undefined}>
              {item.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Prose (legal / long-form pages)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Long-form text wrapper. The project does not ship @tailwindcss/typography,
 * so element styles are applied explicitly here.
 */
export function Prose({ className, children }) {
  return (
    <div
      className={cx(
        'max-w-prose text-base leading-relaxed text-brand-muted',
        '[&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-brand-ink',
        '[&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-brand-ink',
        '[&_p]:mt-4',
        '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6',
        '[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6',
        '[&_li]:pl-1',
        '[&_strong]:font-semibold [&_strong]:text-brand-ink',
        '[&_a]:break-words [&_a]:font-medium [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-brand-800',
        className
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Misc helpers used by more than one page                                     */
/* -------------------------------------------------------------------------- */

/** A soft full-width call-to-action band. */
export function CTABand({ title, subtitle, primary, secondary, className }) {
  return (
    <div
      className={cx(
        'rounded-4xl bg-brand-700 px-6 py-12 text-center shadow-lift sm:px-12 sm:py-16',
        className
      )}
    >
      <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {subtitle ? (
        <p className="mx-auto mt-4 max-w-prose text-base leading-relaxed text-brand-100 sm:text-lg">
          {subtitle}
        </p>
      ) : null}
      {primary || secondary ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {primary ? (
            <Button href={primary.href} variant="white" size="lg" icon="ArrowRight">
              {primary.label}
            </Button>
          ) : null}
          {secondary ? (
            <Button
              href={secondary.href}
              size="lg"
              className="border border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              {secondary.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
