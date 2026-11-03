import Link from 'next/link';

import { cx } from '@/components/site/ui';

/* -------------------------------------------------------------------------- */
/* App-store badges                                                            */
/* -------------------------------------------------------------------------- */
/* HONESTY: the NearGFix apps are NOT published yet (BRAND.appsStatus =            */
/* "Coming soon to Play Store & App Store"). So these badges must NOT link to a  */
/* store listing that does not exist — that would be a dead link and a false     */
/* "available now" claim. They link to /contact and are captioned "Coming        */
/* soon". When the apps go live, point each `href` at its real store URL and      */
/* drop the caption.                                                            */
/*                                                                              */
/* The SVGs in public/ are self-authored, store-badge-style artwork. Apple and   */
/* Google both require their OFFICIAL badge assets in production — replace        */
/* public/app-store-badge.svg and public/google-play-badge.svg with the          */
/* downloads from developer.apple.com and play.google.com/intl/.../badges         */
/* before shipping to real users. */

const BADGES = [
  {
    src: '/app-store-badge.svg',
    alt: 'Download on the App Store',
    width: 162,
    height: 48,
    href: '/contact',
  },
  {
    src: '/google-play-badge.svg',
    alt: 'Get it on Google Play',
    width: 170,
    height: 48,
    href: '/contact',
  },
];

/**
 * StoreBadges — the App Store + Google Play badge pair.
 *
 * @param {object} props
 * @param {string} [props.caption='Coming soon to the App Store & Google Play']
 *   Small line above the badges. Pass '' to hide it (only do that once the apps
 *   are actually downloadable).
 * @param {'light'|'dark'} [props.tone='dark']  'dark' = for a dark/coloured band
 *   (light caption); 'light' = for a white surface (muted caption).
 * @param {string} [props.align='center']  'center' | 'start'
 * @param {string} [props.className]
 */
export default function StoreBadges({
  caption = 'Coming soon to the App Store & Google Play',
  tone = 'dark',
  align = 'center',
  className,
}) {
  const centered = align === 'center';
  return (
    <div
      className={cx(
        'flex flex-col gap-3',
        centered ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      {caption ? (
        <p
          className={cx(
            'text-xs font-semibold uppercase tracking-wide',
            tone === 'dark' ? 'text-brand-100' : 'text-brand-muted',
          )}
        >
          {caption}
        </p>
      ) : null}

      <div className={cx('flex flex-wrap gap-3', centered ? 'justify-center' : 'justify-start')}>
        {BADGES.map((badge) => (
          <Link
            key={badge.alt}
            href={badge.href}
            aria-label={`${badge.alt} — coming soon`}
            className={cx(
              'inline-block rounded-xl transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              tone === 'dark' ? 'focus-visible:ring-white' : 'focus-visible:ring-brand-700',
            )}
          >
            {/* Plain <img>, not next/image: these are local SVGs and next/image
                brings nothing to an SVG under images.unoptimized. */}
            <img
              src={badge.src}
              alt={badge.alt}
              width={badge.width}
              height={badge.height}
              className="h-11 w-auto sm:h-12"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
