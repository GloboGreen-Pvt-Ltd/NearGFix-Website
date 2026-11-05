/**
 * HomeHeroSlide — the home page hero: "Your Devices In Safe Hands" over
 * /Hero-bg.jpg, with the benefit row, the two CTAs and the stats bar. Its
 * heading is the page's <h1>.
 *
 * The artwork carries its devices on the RIGHT (open sky and grass on the
 * left), so every piece of copy sits on the left over a white fade. The image
 * is a CSS background, never an <img>, so it can't cover the content.
 *
 * Height: sized by its own content, so nothing is ever clipped. Fixed at xl+ (1280px) so
 * the hero is 1280x376 at the full content width; natural height below that, where the copy
 * and the illustration can't share one row.
 *
 * CTAs reuse existing destinations only: /repair (the Repair nav item) and
 * /#buy (Buy Devices).
 */

import Link from 'next/link';
import {
  ArrowRight,
  BadgeIndianRupee,
  Clock,
  Headset,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Wrench,
} from 'lucide-react';

import { cx } from './ui';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

const HERO_BG = "url('/Hero-bg.jpg')";

const BENEFITS = [
  { icon: ShieldCheck, lines: ['Certified', 'Technicians'] },
  { icon: Settings, lines: ['Genuine', 'Spare Parts'] },
  { icon: Truck, lines: ['Pickup &', 'Delivery'] },
  { icon: BadgeIndianRupee, lines: ['Transparent', 'Pricing'] },
];

/* Marketing figures supplied for the hero (2026-09-29). Update them here if
 * they change — nothing else reads them. */
const STATS = [
  { icon: Headset, value: '10K+', label: 'Happy Customers' },
  { icon: Settings, value: '100%', label: 'Genuine Parts' },
  { icon: ShieldCheck, value: 'Expert', label: 'Technicians' },
  { icon: Truck, value: 'Free', label: 'Pickup & Delivery' },
  { icon: Clock, value: 'Quick', label: 'Service Turnaround' },
  { icon: Star, value: '4.8/5', label: 'Customer Rating' },
];

export default function HomeHeroSlide() {
  return (
    <div className="relative isolate xl:h-[376px]">
      {/* Fallback fill under the artwork, so the hero still reads as a soft
          green panel if /Hero-bg.jpg is missing or slow. */}
      <div aria-hidden="true" className="absolute inset-0 -z-30 rounded-3xl bg-gradient-to-br from-brand-50 via-white to-brand-soft" />
      {/* Artwork below xl: the hero is taller than it is wide-ish here, so a
          plain cover crop, centred on the device group (~71% across). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 rounded-3xl bg-cover bg-no-repeat bg-[position:72%_center] xl:hidden"
        style={{ backgroundImage: HERO_BG }}
      />
      {/* Artwork on xl+. Hero-bg.jpg is 16:9 but this frame is ~3.4:1, so cover
          would cut the devices off top and bottom. Instead the photo is fitted
          to the frame height and pinned right (device group — x 830–1880,
          y 177–940 in the 1920x1080 file — fully visible, its bottom just
          behind the stats bar), and a blurred, enlarged copy of the photo's own
          sky and grass fills the rest of the frame. The sharp copy's left edge
          fades into it, and both horizons (y ~720 in the file) land at ~245px,
          so there's no seam. Re-tune these numbers if the artwork changes. */}
      <div aria-hidden="true" className="absolute inset-0 -z-20 hidden overflow-hidden rounded-3xl xl:block">
        <div
          className="absolute -inset-10 bg-no-repeat blur-2xl"
          style={{ backgroundImage: HERO_BG, backgroundSize: '1728px auto', backgroundPosition: '0 -363px' }}
        />
        <div
          className="absolute inset-0 bg-no-repeat"
          style={{
            backgroundImage: HERO_BG,
            backgroundSize: 'auto 452px',
            backgroundPosition: 'right 0 bottom -20px',
            WebkitMaskImage: 'linear-gradient(to left, #000 604px, transparent 804px)',
            maskImage: 'linear-gradient(to left, #000 604px, transparent 804px)',
          }}
        />
      </div>
      {/* Readability fade — below xl only, where the copy spans the full width
          and sits over the devices. On xl+ the copy sits on the photo's open
          sky, so there is no fade. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-b from-white/95 via-white/85 to-white/55 xl:hidden"
      />

      <div className="flex h-full flex-col px-5 pb-5 pt-6 sm:px-8 sm:pt-8 xl:px-11 xl:pb-[2px] xl:pt-4">
        <div className="max-w-[540px]">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 sm:text-[13px] xl:py-0.5 xl:text-xs">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-700" strokeWidth={1.75} aria-hidden="true" />
            Trusted Device Repair Experts
          </p>

          <h1 className="mt-3.5 text-[36px] font-extrabold leading-[1.04] tracking-tight sm:text-[42px] xl:mt-2 xl:text-[38px] xl:leading-[1.02]">
            <span className="block text-brand-ink">Your Devices</span>
            <span className="block text-brand-600">In Safe Hands</span>
          </h1>

          <p className="mt-2.5 max-w-[500px] text-[15px] leading-[1.55] text-brand-muted sm:text-base lg:text-[17px] xl:mt-1.5 xl:max-w-[470px] xl:text-[15px] xl:leading-[1.45] xl:text-brand-ink/80">
            Affordable repairs, genuine parts, certified technicians and quick doorstep service — all in
            one place.
          </p>

          <ul className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-0 xl:mt-2.5">
            {BENEFITS.map(({ icon: Icon, lines }, index) => (
              <li
                key={lines.join(' ')}
                className={cx(
                  'flex items-center gap-2',
                  index > 0 && 'sm:ml-4 sm:border-l sm:border-brand-line sm:pl-4',
                )}
              >
                <Icon className="h-7 w-7 shrink-0 text-brand-600 xl:h-6 xl:w-6" strokeWidth={1.6} aria-hidden="true" />
                <span className="text-[13px] font-semibold leading-tight text-brand-ink xl:text-xs">
                  {lines[0]}
                  <br />
                  {lines[1]}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row xl:mt-3">
            <Link
              href="/repair/"
              className={cx(
                'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand-600 px-6 text-[15px] font-bold text-white xl:h-10 xl:px-5 xl:text-sm',
                'shadow-glow transition hover:bg-brand-700',
                FOCUS_RING,
              )}
            >
              <Wrench className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Book a Repair
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
            <Link
              href="/#buy"
              className={cx(
                'inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-brand-line bg-white px-6 text-[15px] font-bold text-brand-700 xl:h-10 xl:px-5 xl:text-sm',
                'shadow-soft transition hover:border-brand-200 hover:bg-brand-50',
                FOCUS_RING,
              )}
            >
              <ShoppingCart className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Buy Refurbished Devices
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Stats bar. 3×2 on tablet and small laptops; hidden on phones, where
            the benefit row above already says the same things. One row on xl+,
            where it hangs 10px below the hero's bottom edge (translate) — which is
            why the frame doesn't clip and the rounded corners live on the
            background layers instead. */}
        <ul className="mt-[44px] hidden grid-cols-3 rounded-2xl border border-white/60 bg-white py-2 shadow-soft md:grid xl:mt-auto xl:translate-y-[10px] xl:grid-cols-6 xl:py-1">
          {STATS.map(({ icon: Icon, value, label }, index) => (
            <li
              key={label}
              className={cx(
                'flex min-w-0 items-center gap-2.5 px-4 py-2 xl:gap-2.5 xl:px-4 xl:py-1.5',
                index % 3 !== 0 && 'border-l border-brand-line',
                index >= 3 && 'max-xl:border-t max-xl:border-brand-line',
                index === 3 && 'xl:border-l xl:border-brand-line',
              )}
            >
              <Icon className="h-7 w-7 shrink-0 text-brand-600 xl:h-6 xl:w-6" strokeWidth={1.6} aria-hidden="true" />
              <span className="min-w-0 leading-tight">
                <span className="block text-base font-extrabold text-brand-ink xl:text-[15px]">{value}</span>
                <span className="block truncate text-xs text-brand-muted xl:text-[11px]">{label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
