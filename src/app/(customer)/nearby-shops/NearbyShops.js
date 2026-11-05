'use client';

/**
 * NearbyShops — the live, client-side half of /nearby-shops.
 *
 * WHY THIS IS A CLIENT COMPONENT
 * next.config.js sets `output: 'export'` in production, so there is no server at
 * request time and no SSR data fetching. Everything below runs in the browser,
 * inside useEffect, after hydration.
 *
 * WHAT THE BACKEND ACTUALLY RETURNS  (verified against the live service)
 *   GET /shops
 *     [{ id, name, slug, address, latitude, longitude, isOpen }]
 *   GET /shops/nearby?lat=&lng=&radiusKm=
 *     the same shape PLUS distanceKm (float)
 * That is the WHOLE DTO. There is no rating, no review count, no photo, no city,
 * no phone number, no opening hours and no service list. Nothing in this file
 * may render a field that is not in that list — a plausible-looking "4.8 ★" or
 * "Open until 8pm" would be fabricated, and the cards are deliberately sparse
 * instead.
 *
 * The card is a store-locator card: a photo header with the open/closed badge
 * and distance overlaid, then name, address, timings, and a Call Store /
 * Get Directions action row. Photo, phone and timings render ONLY when the API
 * supplies them (see the getters below) — today it does not, so those pieces are
 * absent rather than faked, and the grid still works from name/address/isOpen/
 * lat-lng alone.
 *
 * DESIGNED FOR A NEARLY-EMPTY DATABASE
 * There are two shops on the platform today, so the grid column count scales with
 * the result count (1 centred, 2 side-by-side, up to 4 across) instead of leaving
 * holes in a fixed wide grid.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Image as ImageIcon,
  List,
  Map as MapIcon,
  MapPin,
  Navigation,
  Phone,
  Store,
} from 'lucide-react';

import { AUTH_BASE, SHOP_BASE } from '@/lib/api';
import { Button, cx } from '@/components/site/ui';
import { readGeo, subscribe } from '@/components/site/geo';
import { NEARBY } from '@/lib/siteContent';
import ShopMap from '@/components/site/nearby-shops/ShopMap';
import LocationControl from '@/components/site/LocationControl';

/* -------------------------------------------------------------------------- */
/* Transport                                                                   */
/* -------------------------------------------------------------------------- */
/**
 * These two endpoints are fetched directly rather than through `shopApi`.
 *
 * This is a deliberate deviation and worth reading before "fixing" it. The brief
 * asked for `shopApi.get(path, { skipAuthRedirect: true })`, but src/lib/api.js
 * (which is in the MUST-NOT-MODIFY list) declares:
 *
 *     get: (path) => request(SHOP_BASE(), path)
 *
 * — a one-argument function. A second `{ skipAuthRedirect: true }` argument is
 * silently dropped on the floor, so it would look correct at the call site and
 * do nothing. `request()` then attaches any `admin_token` in localStorage and,
 * on a 401/403, deletes that token and `window.location.assign('/management')`s.
 *
 * On a PUBLIC marketing page that is a real bug: an admin with an expired token
 * who browses to /nearby-shops would be silently signed out and thrown at the
 * login screen by a page that never needed auth in the first place. Both
 * endpoints are unauthenticated and CORS-open, so the correct fix is to send no
 * credentials at all. SHOP_BASE() is still imported from api.js, so the base URL
 * stays in exactly one place and env changes still flow through.
 *
 * If api.js ever grows an options passthrough on shopApi.get, this can become
 * `shopApi.get(path, { skipAuthRedirect: true })` with no other change.
 */
async function getShops(path, signal) {
  const base = String(SHOP_BASE() || '').replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    signal,
    // No Authorization header, and credentials stay omitted: this is public data
    // and a stale admin session must not be able to affect (or be affected by) it.
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`shop directory responded ${res.status}`);

  const data = await res.json();
  // A malformed body is a backend failure, not something to render around.
  if (!Array.isArray(data)) throw new Error('shop directory returned an unexpected body');
  return data;
}

/**
 * Public shop detail — the ONE endpoint that carries the shop's front photo,
 * phone number and full address.
 *
 * The `/shops` + `/shops/nearby` list DTO is intentionally sparse (name / slug /
 * address / lat-lng / isOpen[/distanceKm]) and has NO image or phone. Those live
 * on auth-service's `/auth/shops/{id}/public` (verified: frontImageUrl,
 * bannerImageUrl, mobile, a fuller address). So the card fills in from here after
 * the list paints. Public + CORS-open + no credentials, same as getShops().
 *
 * Never throws: any failure (including an abort during teardown) resolves to null
 * so one shop's missing detail can't blank the whole grid — the card just falls
 * back to the list fields it already has.
 */
async function getShopPublic(id, signal) {
  if (!id) return null;
  try {
    const base = String(AUTH_BASE() || '').replace(/\/$/, '');
    const res = await fetch(`${base}/auth/shops/${encodeURIComponent(id)}/public`, {
      signal,
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fold the public detail into a list shop WITHOUT clobbering the list-only fields
 * that the public DTO gets wrong for this context: distanceKm (public returns
 * 0.0) and isOpen (public omits it). Only the genuinely-missing pieces — image,
 * phone, the fuller address, and (below) the location/pickup fields the sparse
 * /shops(/nearby) DTO never carried — are copied across, and only when present.
 */
function mergePublicDetail(shop, pub) {
  if (!pub) return shop;
  const merged = { ...shop };
  const image = pub.frontImageUrl || pub.bannerImageUrl;
  if (image) merged.frontImageUrl = image;
  if (pub.mobile) merged.mobile = pub.mobile;
  if (pub.address) merged.address = pub.address;
  // Pickup window is the only real "hours" data the API has; surfaced by
  // shopTimings() only when the shop has actually set it (null for most today).
  if (pub.pickupFromTime) merged.pickupFromTime = pub.pickupFromTime;
  if (pub.pickupToTime) merged.pickupToTime = pub.pickupToTime;
  // District/pincode/state were already being fetched here and thrown away —
  // this just keeps them, for a fuller address line and future PIN display.
  if (pub.district) merged.district = pub.district;
  if (pub.pincode) merged.pincode = pub.pincode;
  if (pub.state) merged.state = pub.state;
  if (pub.pickupDistanceKm != null) merged.pickupDistanceKm = pub.pickupDistanceKm;
  if (pub.pickupEnabled != null) merged.pickupEnabled = pub.pickupEnabled;
  return merged;
}

/**
 * True when this page is on HTTPS but the shop service is plain HTTP.
 *
 * The backend is http:// on a bare IP. The moment this site is served over
 * HTTPS the browser blocks the request as mixed content BEFORE it leaves the
 * page — the fetch rejects with a bare TypeError and no status. Detecting the
 * combination lets the error state say something true and specific instead of
 * blaming the visitor's connection, and guarantees the failure surfaces as a
 * designed state rather than a spinner that never resolves.
 */
function isMixedContentBlocked() {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.location.protocol === 'https:' &&
      String(SHOP_BASE() || '').startsWith('http:')
    );
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */
/**
 * The API sends distanceKm as a raw float — 0.9478635306185756. Rendering that
 * verbatim would be absurd, and rendering "0.9 km" for everything under a
 * kilometre throws away the only precision that actually matters to someone
 * deciding whether to walk.
 *
 *   < 1 km   -> metres, snapped to 10 m   (0.9478… -> "950 m")
 *   < 10 km  -> one decimal               (4.23    -> "4.2 km")
 *   >= 10 km -> whole kilometres          (18.7    -> "19 km")
 *
 * Returns null for anything non-finite, so a missing distanceKm renders no badge
 * rather than "NaN km".
 */
function formatDistance(km) {
  const value = Number(km);
  if (!Number.isFinite(value) || value < 0) return null;
  if (value < 1) return `${Math.max(10, Math.round((value * 1000) / 10) * 10)} m`;
  if (value < 10) return `${value.toFixed(1)} km`;
  return `${Math.round(value)} km`;
}

/** A Google Maps directions URL, built from the latitude/longitude we really have. */
function directionsHref(shop) {
  const lat = Number(shop && shop.latitude);
  const lng = Number(shop && shop.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/* ------------------------------------------------------------------------- */
/* Optional fields — present in the DB but NOT (yet) in the public DTO.       */
/* ------------------------------------------------------------------------- */
/* The shop record HAS a front image, phone number and opening hours, but the  */
/* shop-service `/shops` and `/shops/nearby` responses do not serialize them    */
/* (verified against the live service — the DTO is name/slug/address/lat/lng/    */
/* isOpen[/distanceKm]). The getters below read every plausible field name so    */
/* that the moment the backend widens the DTO, the photo/Call Store/timings      */
/* light up with ZERO frontend change. Until then each returns null and its      */
/* piece of the card is simply not rendered — never faked. */

/**
 * Shrink a Cloudinary original to a card-sized thumbnail on the fly. The stored
 * front photos are full-res PNGs (~1.2 MB); injecting `f_auto,q_auto,w_800` after
 * `/image/upload/` serves a ~35 KB webp/jpeg instead — verified 200. Non-
 * Cloudinary URLs, or ones that already carry a transform, pass through untouched.
 */
function optimizeCloudinary(url) {
  if (typeof url !== 'string') return url;
  const marker = '/image/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const after = url.slice(i + marker.length);
  // Already transformed (a transform segment precedes the version/path).
  if (/^[a-z]_[^/]*\//.test(after)) return url;
  return `${url.slice(0, i + marker.length)}f_auto,q_auto,w_800/${after}`;
}

/** First usable image URL (Cloudinary-optimised), or null. */
function shopImage(shop) {
  if (!shop) return null;
  const direct =
    shop.imageUrl || shop.frontImageUrl || shop.heroImageUrl || shop.bannerUrl || shop.logoUrl;
  if (typeof direct === 'string' && direct.trim()) return optimizeCloudinary(direct.trim());
  const first = Array.isArray(shop.images) ? shop.images[0] : null;
  const nested = first && (first.url || first.imageUrl || first.src);
  return typeof nested === 'string' && nested.trim() ? optimizeCloudinary(nested.trim()) : null;
}

/** Digits-only phone for a tel: link, or null. */
function shopPhone(shop) {
  const raw = shop && (shop.phone || shop.phoneNumber || shop.mobile || shop.contactNumber);
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/[^\d+]/g, '');
  return digits.length >= 6 ? { display: raw.trim(), href: `tel:${digits}` } : null;
}

/** "HH:mm[:ss]" -> "h:mm AM/PM"; passes anything unparseable straight through. */
function to12h(t) {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t || '').trim();
  let h = Number(m[1]);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}

/** "10:00 AM – 09:00 PM" style timings, or null when the shop has set none. */
function shopTimings(shop) {
  if (!shop) return null;
  const open = shop.openingTime || shop.openTime;
  const close = shop.closingTime || shop.closeTime;
  if (open && close) return `${String(open).trim()} – ${String(close).trim()}`;
  if (typeof shop.hoursText === 'string' && shop.hoursText.trim()) return shop.hoursText.trim();
  // Fall back to the pickup service window — the only real "hours" the API has.
  if (shop.pickupFromTime && shop.pickupToTime) {
    return `${to12h(shop.pickupFromTime)} – ${to12h(shop.pickupToTime)}`;
  }
  return null;
}

/** The letter shown on the image placeholder when a shop has no photo. */
function shopInitial(name) {
  const first = String(name || '').trim().charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(first) ? first : 'G';
}

/** Stable React key. `id` should always be there; fall back rather than crash. */
function shopKey(shop, index) {
  return (shop && (shop.id || shop.slug)) || `shop-${index}`;
}

/* -------------------------------------------------------------------------- */
/* Presentational pieces                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The list wrapper. Column count scales with the RESULT COUNT so a one- or
 * two-shop list reads as composed rather than as a wide grid with holes, while
 * a full directory fans out to four across like a real store locator.
 */
function ShopGrid({ count, children }) {
  return (
    <ul
      // list-style:none + display:grid makes WebKit drop list semantics, so the
      // explicit role is not redundant — without it VoiceOver stops announcing
      // "list, N items".
      role="list"
      className={cx(
        'mx-auto mt-5 grid list-none gap-5 p-0',
        count <= 1 && 'max-w-sm',
        count === 2 && 'max-w-3xl sm:grid-cols-2',
        count === 3 && 'max-w-5xl sm:grid-cols-2 lg:grid-cols-3',
        count >= 4 && 'max-w-6xl sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
      )}
    >
      {children}
    </ul>
  );
}

/** Keyless Google Maps embed for one point — pan/zoom works inside the card. */
function mapEmbedSrc(shop) {
  const lat = Number(shop && shop.latitude);
  const lng = Number(shop && shop.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
}

/**
 * The card header. Defaults to an interactive mini map of the shop's real
 * location; when the shop has uploaded a photo, a Map / Photo switch lets the
 * user flip to it. With neither, a branded placeholder with the shop's initial.
 */
function ShopMedia({ shop, name }) {
  const [failed, setFailed] = useState(false);
  const photo = shopImage(shop);
  const hasPhoto = Boolean(photo) && !failed;
  const mapSrc = mapEmbedSrc(shop);
  const [view, setView] = useState(mapSrc ? 'map' : 'photo');
  const distance = formatDistance(shop && shop.distanceKm);
  const isOpen = shop && shop.isOpen;
  const showMap = view === 'map' && mapSrc;

  return (
    <div className="relative aspect-[16/8] w-full shrink-0 overflow-hidden bg-brand-soft">
      {showMap ? (
        <iframe
          src={mapSrc}
          title={`Map showing ${name}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full border-0"
        />
      ) : hasPhoto ? (
        <img
          src={photo}
          alt={`${name} storefront`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition duration-500 motion-safe:hover:scale-105"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-soft"
          aria-hidden="true"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-xl font-extrabold text-brand-700 shadow-soft">
            {shopInitial(name)}
          </span>
        </div>
      )}

      {/* Open / closed, overlaid top-left. Rendered only when isOpen is a real
          boolean — no guessing. */}
      {typeof isOpen === 'boolean' ? (
        <span
          className={cx(
            'pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-soft',
            isOpen ? 'bg-brand-600 text-white' : 'bg-red-500 text-white',
          )}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden="true" />
          {isOpen ? NEARBY.openLabel : NEARBY.closedLabel}
        </span>
      ) : null}

      {/* Distance, overlaid top-right. */}
      {distance ? (
        <span className="pointer-events-none absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-brand-ink shadow-soft">
          <Navigation className="h-3 w-3 text-brand-600" aria-hidden="true" />
          {distance}
        </span>
      ) : null}

      {/* Map / Photo switch — only when there is a choice to make. */}
      {mapSrc && hasPhoto ? (
        <div
          role="group"
          aria-label={`${name} view`}
          className="absolute bottom-2.5 left-2.5 inline-flex rounded-full bg-white/95 p-0.5 shadow-soft"
        >
          {[
            { key: 'map', label: 'Map', icon: MapIcon },
            { key: 'photo', label: 'Photo', icon: ImageIcon },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              aria-pressed={view === opt.key}
              onClick={() => setView(opt.key)}
              className={cx(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700',
                view === opt.key ? 'bg-brand-600 text-white' : 'text-brand-muted hover:text-brand-ink',
              )}
            >
              <opt.icon className="h-3 w-3" aria-hidden="true" />
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** One footer action (Call Store / Get Directions). Splits the row evenly. */
function CardAction({ href, external, icon: Icon, children, srSuffix }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : null)}
      className={cx(
        'flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold text-brand-700',
        'transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {children}
      {srSuffix ? <span className="sr-only"> {srSuffix}</span> : null}
    </a>
  );
}

function ShopCard({ shop }) {
  const name = (shop && shop.name) || 'NearGFix shop';
  const address = (shop && shop.address) || null;
  const timings = shopTimings(shop);
  const phone = shopPhone(shop);
  const maps = directionsHref(shop);

  return (
    <li className="h-full">
      <article
        className={cx(
          'flex h-full flex-col overflow-hidden rounded-2xl border border-brand-line bg-white shadow-soft',
          'transition hover:border-brand-200 hover:shadow-lift motion-safe:hover:-translate-y-0.5',
        )}
      >
        <ShopMedia shop={shop} name={name} />

        <div className="flex flex-1 flex-col p-4">
          {/* Name + an external-link affordance (opens the shop on the map in a
              new tab), matching the reference store-locator card. */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-[15px] font-bold leading-snug tracking-tight text-brand-ink">
              {/* break-words: shop names are user-entered and can be one long
                  unbroken string, which would otherwise scroll the page sideways. */}
              <span className="break-words">{name}</span>
            </h3>
            {maps ? (
              <a
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${name} on the map (opens in a new tab)`}
                className={cx(
                  'shrink-0 rounded-lg p-1 text-brand-muted transition hover:bg-brand-soft hover:text-brand-700',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700',
                )}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : null}
          </div>

          {address ? (
            <p className="mt-1 line-clamp-2 break-words text-[13px] leading-relaxed text-brand-muted">
              {address}
            </p>
          ) : null}

          {timings ? (
            <p className="mt-1 text-[13px] text-brand-muted">
              Timings: <span className="font-semibold text-brand-ink">{timings}</span>
            </p>
          ) : null}

          {/* The flex-1 spacer pins the action row to the bottom so cards of differing
              body length still align their footers across the row. */}
          {phone || maps ? (
            <div className="min-h-[12px] flex-1" aria-hidden="true" />
          ) : null}
          {phone || maps ? (
            <div className="-mx-4 -mb-4 flex items-stretch divide-x divide-brand-line border-t border-brand-line">
              {phone ? (
                <CardAction href={phone.href} icon={Phone} srSuffix={`— ${name}`}>
                  Call Store
                </CardAction>
              ) : null}
              {maps ? (
                <CardAction
                  href={maps}
                  external
                  icon={MapPin}
                  srSuffix={`to ${name} (opens in a new tab)`}
                >
                  Get Directions
                </CardAction>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>
    </li>
  );
}

/**
 * Loading skeletons.
 *
 * Same outer shape and roughly the same height as a real ShopCard (photo header,
 * two text lines, action row), so results swapping in causes no layout shift.
 */
function ShopSkeletons() {
  return (
    <ul
      role="list"
      aria-hidden="true"
      className="mx-auto mt-10 grid max-w-5xl list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3"
    >
      {[0, 1, 2].map((index) => (
        <li key={index}>
          <div className="overflow-hidden rounded-3xl border border-brand-line bg-white shadow-soft">
            <div className="aspect-[16/8] w-full bg-brand-soft motion-safe:animate-pulse" />
            <div className="p-5">
              <div className="h-5 w-2/3 rounded-full bg-brand-soft motion-safe:animate-pulse" />
              <div className="mt-3 h-4 w-full rounded-full bg-slate-100 motion-safe:animate-pulse" />
              <div className="mt-2 h-4 w-1/2 rounded-full bg-slate-100 motion-safe:animate-pulse" />
              <div className="mt-5 h-9 w-full rounded-full bg-slate-100 motion-safe:animate-pulse" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Shared shell for every non-list state, so they all sit on the same footprint. */
function StatePanel({ tone = 'brand', icon: Icon, title, body, children }) {
  return (
    <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-brand-line bg-white p-8 text-center shadow-soft sm:p-10">
      {Icon ? (
        <span
          className={cx(
            'inline-flex h-14 w-14 items-center justify-center rounded-2xl',
            tone === 'accent' ? 'bg-accent-soft text-accent-600' : 'bg-brand-soft text-brand-700',
          )}
        >
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>
      ) : null}
      <h3 className="mt-5 text-xl font-bold tracking-tight text-brand-ink sm:text-2xl">{title}</h3>
      {body ? (
        <p className="mx-auto mt-3 max-w-prose text-base leading-relaxed text-brand-muted">{body}</p>
      ) : null}
      {children ? (
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function NearbyShops({ className }) {
  /* Coordinates. Seeded null on purpose and hydrated in an effect: readGeo()
     during the first render would disagree with the prerendered HTML (which
     always says "unset") and throw a hydration mismatch. */
  const [geo, setGeo] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [shops, setShops] = useState([]);
  const [mode, setMode] = useState('all'); // which query produced `shops`
  const [errorKind, setErrorKind] = useState(null); // 'network' | 'mixed-content'
  const [view, setView] = useState('list'); // 'list' | 'map'

  /* Set when the visitor, having been told there is nothing within the radius,
     asks to see the whole directory anyway. Reset whenever the location moves. */
  const [showAllAnyway, setShowAllAnyway] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  /* Guards every setState that follows an await. Without it, navigating away
     mid-request warns and, worse, resurrects state on a dead tree. */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const radiusKm = Number(NEARBY.radiusKm) || 20;

  /* -- hydrate + stay in sync with the navbar ------------------------------ */
  useEffect(() => {
    setGeo(readGeo());
    setHydrated(true);

    // subscribe() covers both the same-tab 'ggfix:geo' CustomEvent and the
    // cross-tab 'storage' event, so setting the location in the header updates
    // this page live with no reload.
    return subscribe((entry) => {
      if (!aliveRef.current) return;
      setGeo(entry);
      // A new location resets the "show everything anyway" escape hatch.
      setShowAllAnyway(false);
    });
  }, []);

  /* -- fetch --------------------------------------------------------------- */
  const useNearby = Boolean(geo) && !showAllAnyway;

  useEffect(() => {
    if (!hydrated) return undefined; // don't fire the "all shops" query before we know the location

    const controller = new AbortController();
    let cancelled = false;

    setStatus('loading');
    setErrorKind(null);

    const path = useNearby
      ? `/shops/nearby?lat=${encodeURIComponent(geo.lat)}&lng=${encodeURIComponent(
          geo.lng,
        )}&radiusKm=${encodeURIComponent(radiusKm)}`
      : '/shops';

    getShops(path, controller.signal)
      .then(async (rows) => {
        if (cancelled || !aliveRef.current) return;
        // Sort ascending by distance. The API already returns nearest-first, but
        // ordering is presentation and this page owns it; entries missing a
        // distance sink to the bottom instead of jumping to the front via NaN.
        const sorted = useNearby
          ? [...rows].sort((a, b) => {
              const left = Number(a && a.distanceKm);
              const right = Number(b && b.distanceKm);
              if (!Number.isFinite(left)) return 1;
              if (!Number.isFinite(right)) return -1;
              return left - right;
            })
          : rows;

        // Paint the list immediately from the sparse list DTO (name/address/
        // isOpen/distance), so nothing waits on the per-shop enrichment below.
        setShops(sorted);
        setMode(useNearby ? 'nearby' : 'all');
        setStatus('ready');

        // Then fold in the front photo + phone from the public shop endpoint —
        // one request per shop, in parallel. getShopPublic never throws, so a
        // slow/failed shop just keeps its list-only card. Small list (a couple of
        // shops today), so Promise.all is fine.
        const enriched = await Promise.all(
          sorted.map((s) =>
            getShopPublic(s && s.id, controller.signal).then((pub) => mergePublicDetail(s, pub)),
          ),
        );
        if (cancelled || !aliveRef.current) return;
        setShops(enriched);
      })
      .catch((error) => {
        // An abort is this component tearing down its own request, not a failure.
        if (cancelled || !aliveRef.current) return;
        if (error && error.name === 'AbortError') return;

        // Never surface `error.message` — it is a stack-adjacent string like
        // "Failed to fetch" or "shop directory responded 502", which tells a
        // visitor nothing and reads as a broken site.
        setErrorKind(isMixedContentBlocked() ? 'mixed-content' : 'network');
        setStatus('error');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `geo` is read only when useNearby is true; including the primitives keeps
    // the effect honest without re-firing on an identity-only change.
  }, [hydrated, useNearby, geo && geo.lat, geo && geo.lng, radiusKm, retryCount]);

  /* -- actions ------------------------------------------------------------- */

  const retry = useCallback(() => setRetryCount((n) => n + 1), []);

  /* -- derived ------------------------------------------------------------- */

  const showingNearby = mode === 'nearby' && status === 'ready';
  const isEmptyWithinRadius = showingNearby && shops.length === 0;

  const listHeading = useMemo(() => {
    if (showingNearby) {
      return {
        title: `Within ${radiusKm} km of you`,
        body: NEARBY.dataNote,
      };
    }
    return {
      // Honest label: this is the whole directory, not a proximity result.
      title: NEARBY.allShopsTitle,
      body: NEARBY.allShopsBody,
    };
  }, [showingNearby, radiusKm]);

  /* -- render -------------------------------------------------------------- */

  return (
    <div className={className}>
      {/* ---- Results ------------------------------------------------------- */}
      {/* aria-live so a screen reader hears the list change when the location is
          set from the navbar without any navigation happening. */}
      <div aria-live="polite" aria-busy={status === 'loading'}>
        {status === 'loading' ? (
          <>
            <p className="text-center text-sm font-semibold uppercase tracking-widest text-brand-muted">
              {NEARBY.loadingLabel}
            </p>
            <ShopSkeletons />
          </>
        ) : status === 'error' ? (
          <StatePanel
            tone="accent"
            icon={AlertTriangle}
            title={NEARBY.errorTitle}
            body={
              errorKind === 'mixed-content'
                ? 'This page is served securely over HTTPS, but the shop directory is still on an unsecured address, so your browser blocked the request. This is on us, not on you — we are moving the directory to HTTPS.'
                : NEARBY.errorBody
            }
          >
            <Button onClick={retry} variant="primary" icon="RefreshCw" iconPosition="left">
              Try again
            </Button>
            <Button href="/contact" variant="outline">
              Contact us
            </Button>
          </StatePanel>
        ) : isEmptyWithinRadius ? (
          <StatePanel
            icon={MapPin}
            title={NEARBY.emptyNearbyTitle}
            body={NEARBY.emptyNearbyBody}
          >
            <Button onClick={() => setShowAllAnyway(true)} variant="primary" icon="Store" iconPosition="left">
              Show all shops instead
            </Button>
            <Button href="/contact" variant="outline">
              Contact us
            </Button>
          </StatePanel>
        ) : shops.length === 0 ? (
          /* The whole directory is empty. Distinct from empty-within-radius:
             widening the search would not help, so no "show all" button. */
          <StatePanel
            icon={Store}
            title="No shops are listed yet"
            body="No NearGFix shops are live on the platform right now. If you run a repair shop, we would love to hear from you."
          >
            <Button href="/shop" variant="primary" icon="ArrowRight">
              NearGFix for shops
            </Button>
          </StatePanel>
        ) : (
          <>
            <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 rounded-2xl border border-brand-line bg-white px-4 py-3 shadow-soft sm:flex-row">
              <div className="text-center sm:text-left">
                <h2 className="text-lg font-bold tracking-tight text-brand-ink">
                  {listHeading.title}
                </h2>
                <p className="text-xs font-semibold text-brand-700">
                  {shops.length === 1 ? '1 shop' : `${shops.length} shops`}
                  {showingNearby ? ` within ${radiusKm} km` : ' on the platform'}
                </p>
              </div>

            {/* List / Map toggle. Map markers come from this SAME `shops` array
                — no second request, and never from Google's own place search. */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <LocationControl />
              <div className="inline-flex rounded-full border border-brand-line bg-white p-1 shadow-soft">
                <button
                  type="button"
                  onClick={() => setView('list')}
                  aria-pressed={view === 'list'}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
                    view === 'list' ? 'bg-brand-600 text-white' : 'text-brand-muted hover:text-brand-ink',
                  )}
                >
                  <List className="h-4 w-4" aria-hidden="true" />
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setView('map')}
                  aria-pressed={view === 'map'}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
                    view === 'map' ? 'bg-brand-600 text-white' : 'text-brand-muted hover:text-brand-ink',
                  )}
                >
                  <MapIcon className="h-4 w-4" aria-hidden="true" />
                  Map
                </button>
              </div>
            </div>
            </div>

            {view === 'map' ? (
              <ShopMap shops={shops} geo={geo} className="mx-auto mt-5 max-w-6xl" />
            ) : (
              <ShopGrid count={shops.length}>
                {shops.map((shop, index) => (
                  <ShopCard key={shopKey(shop, index)} shop={shop} />
                ))}
              </ShopGrid>
            )}

            {/* Escape hatch back to the full directory once a nearby search has
                narrowed it — otherwise the only way out is clearing the location. */}
            {showingNearby ? (
              <p className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllAnyway(true)}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold',
                    'text-brand-700 transition hover:bg-brand-soft',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
                  )}
                >
                  <Store className="h-4 w-4" aria-hidden="true" />
                  Show every NearGFix shop instead
                </button>
              </p>
            ) : null}

            {/* Symmetric: having widened to "all shops", offer the way back. */}
            {!showingNearby && geo ? (
              <p className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllAnyway(false)}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold',
                    'text-brand-700 transition hover:bg-brand-soft',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
                  )}
                >
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  Back to shops within {radiusKm} km
                </button>
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
