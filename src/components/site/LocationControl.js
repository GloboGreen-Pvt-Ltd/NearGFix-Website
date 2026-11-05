'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Info, LoaderCircle, Map as MapIcon, MapPin, X } from 'lucide-react';

import { cx } from '@/components/site/ui';
import {
  clearGeo,
  formatGeo,
  geocodePincode,
  lookupPlace,
  readGeo,
  reverseGeocodeBackend,
  subscribe,
  writeGeo,
} from '@/components/site/geo';
import MapPinPicker from '@/components/site/MapPinPicker';

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */
/* Every one of these is written to be read by a visitor who did nothing wrong.
 * We never surface `error.message` from the browser — those strings are written
 * for developers ("User denied Geolocation"), vary by engine, and are not
 * translated. Each message also says what to do next, because a dead end in the
 * navbar just makes people leave. */

const MESSAGES = {
  denied:
    'Location is blocked for this site. Allow it in your browser’s address-bar settings, or enter your PIN code above.',
  unavailable: 'Couldn’t work out where you are just now. Try again in a moment.',
  timeout: 'That took too long. Check your connection and try again.',
  failed: 'Couldn’t get your location. Try again in a moment.',
  unsupported: 'This browser can’t share a location. Enter your PIN code above instead.',
  insecure: 'Location sharing needs a secure (https) connection. Enter your PIN code above instead.',
  pincodeInvalid: 'Enter a valid 6-digit PIN code.',
  pincodeNotFound: 'Couldn’t find that PIN code. Double-check it and try again.',
};

/**
 * Map a GeolocationPositionError onto one of our own message keys.
 *
 * The numeric codes are checked BEFORE the named constants because the error
 * object handed to the callback is not always a real GeolocationPositionError
 * (some in-app webviews pass a plain object with just `code`), so
 * `err.PERMISSION_DENIED` can be undefined.
 */
function messageKeyFor(error) {
  const code = error && typeof error.code === 'number' ? error.code : null;
  if (code === 1) return 'denied';
  if (code === 2) return 'unavailable';
  if (code === 3) return 'timeout';
  return 'failed';
}

/* -------------------------------------------------------------------------- */
/* Availability                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Why the API might be unusable, or null if it should work.
 *
 * `isSecureContext` matters here in a way that is easy to miss: this site is
 * intended to be reachable over plain HTTP on a bare IP, and every modern
 * browser silently refuses geolocation on an insecure origin. Chrome does not
 * even prompt — it invokes the error callback with PERMISSION_DENIED, which
 * would otherwise make us tell the visitor to "allow it in settings" for a
 * permission no setting can grant. localhost is exempt (treated as secure), so
 * this never trips in development, which is exactly why it must be handled
 * explicitly rather than discovered in production.
 */
function detectUnavailable() {
  if (typeof window === 'undefined') return null;
  if (!('geolocation' in navigator) || !navigator.geolocation) return 'unsupported';
  if (window.isSecureContext === false) return 'insecure';
  return null;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * LocationControl — the navbar location affordance.
 *
 * Unset: a compact "Set location" chip. Set: a chip showing the reverse-
 * geocoded "PIN - place" label (e.g. "608501 - Cuddalore"). Either way,
 * clicking it opens a "Choose your delivery location" dialog with two ways in:
 * typing a 6-digit PIN code (forward-geocoded via Nominatim/OpenStreetMap —
 * free, keyless, the same source BusinessLocationsManager already uses for
 * postcode -> coordinates), or "Use my current location" (browser GPS,
 * reverse-geocoded via geo.js's Google-then-BigDataCloud chain).
 *
 * The dialog is portalled to document.body rather than rendered in place:
 * SiteHeader is `sticky ... backdrop-blur-md`, and a backdrop-filter other
 * than `none` makes an element the CONTAINING BLOCK for its position:fixed
 * descendants, which would otherwise pin a `fixed inset-0` overlay to the
 * header's own box instead of the viewport (see LoginModal.js, which hit the
 * same thing first).
 *
 * The value is written through geo.js, which the /nearby-shops page subscribes
 * to — so setting a location here updates that page live, and this control
 * updates itself if the location is changed from there.
 *
 * @param {object} props
 * @param {string} [props.className] Applied to the positioning wrapper.
 * @param {'md'|'lg'} [props.size]   'lg' is the borderless pill used in the site
 *   header; its text label collapses to icon + chevron below xl.
 */
export default function LocationControl({ className, size = 'md' }) {
  const [geo, setGeo] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'locating'
  const [messageKey, setMessageKey] = useState(null);
  const [unavailable, setUnavailable] = useState(null);
  const [open, setOpen] = useState(false);
  const [pincode, setPincode] = useState('');
  const [pincodeBusy, setPincodeBusy] = useState(false);
  const [view, setView] = useState('main'); // 'main' | 'map'

  const triggerRef = useRef(null);
  const pincodeInputRef = useRef(null);
  // Guards the async geolocation/geocoding callbacks against firing setState
  // after the control has unmounted (route change mid-prompt — the browser
  // permission dialog can sit open for a long time).
  const aliveRef = useRef(true);

  // The dialog renders into document.body via a portal — see the component
  // doc for why. `mounted` also keeps this SSR-safe: the site is a static
  // export, so `document` does not exist at build time, and the first client
  // render must match the server's.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* -- hydrate ------------------------------------------------------------ */
  /* Read AFTER mount, never as a useState initialiser: the server prerender has
   * no localStorage, so seeding from storage during render makes the first
   * client render disagree with the HTML and React throws out the tree. */
  useEffect(() => {
    aliveRef.current = true;
    setGeo(readGeo());
    setUnavailable(detectUnavailable());

    // Stay in sync with the /nearby-shops page and with other tabs.
    const unsubscribe = subscribe((entry) => {
      setGeo(entry);
      if (entry) setMessageKey(null);
    });

    return () => {
      aliveRef.current = false;
      unsubscribe();
    };
  }, []);

  /* -- dialog open/close --------------------------------------------------- */

  const closeModal = useCallback(() => {
    setOpen(false);
    setMessageKey(null);
    if (triggerRef.current) triggerRef.current.focus();
  }, []);

  useEffect(() => {
    if (open) setView('main');
  }, [open]);

  // A location saved before the PIN code was kept (e.g. "Madurai") gets its
  // PIN filled in once, quietly, so the chip can show "Madurai · 625001".
  const backfilledRef = useRef(false);
  useEffect(() => {
    if (!geo || geo.pincode || backfilledRef.current) return;
    backfilledRef.current = true;
    const base = geo;
    reverseGeocodeBackend(base.lat, base.lng)
      .then((place) => (place && place.pincode ? place : lookupPlace(base.lat, base.lng)))
      .then((place) => {
        if (!aliveRef.current || !place || !place.pincode) return;
        setGeo(writeGeo({ ...base, ...place, label: base.label || place.label }) || base);
      });
  }, [geo]);

  // Reset the pincode field each time the dialog opens, and focus it once the
  // portal has painted.
  useEffect(() => {
    if (!open) return;
    setPincode('');
    setMessageKey(null);
    const t = setTimeout(() => pincodeInputRef.current && pincodeInputRef.current.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  // Esc to close, and lock body scroll while open — mirrors LoginModal.js.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModal();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, closeModal]);

  /* -- GPS ------------------------------------------------------------------ */

  const requestLocation = useCallback(() => {
    const blocked = detectUnavailable();
    if (blocked) {
      setUnavailable(blocked);
      return;
    }

    setStatus('locating');
    setMessageKey(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!aliveRef.current) return;
        const entry = writeGeo(position && position.coords);
        setStatus('idle');
        if (entry) {
          // writeGeo broadcasts, and our own subscription sets state — but set
          // it here too so the UI is correct even if the CustomEvent
          // constructor was unavailable and the broadcast was swallowed.
          setGeo(entry);
          setOpen(false);

          // Reverse-geocode SECOND, and never block on it. The coordinates are
          // already stored and /nearby-shops can already query with them; the
          // address is presentation only. Google (via our own backend, key
          // never reaches the browser) is tried first for the full
          // pincode/area/district breakdown; BigDataCloud is a same-shape
          // fallback so the chip keeps working even if the backend call fails.
          reverseGeocodeBackend(entry.lat, entry.lng).then((place) => {
            if (!aliveRef.current) return;
            if (place) {
              setGeo(writeGeo({ ...entry, ...place, source: 'gps' }) || entry);
              return;
            }
            lookupPlace(entry.lat, entry.lng).then((hit) => {
              if (!aliveRef.current || !hit) return;
              setGeo(writeGeo({ ...entry, ...hit, source: 'gps' }) || entry);
            });
          });
        } else {
          setMessageKey('failed');
        }
      },
      (error) => {
        if (!aliveRef.current) return;
        setStatus('idle');
        setMessageKey(messageKeyFor(error));
      },
      {
        // Coarse position is plenty: the shop search runs on a 20 km radius, so
        // high accuracy would only spend battery and time for no visible gain.
        enableHighAccuracy: false,
        timeout: 10000,
        // A fix from the last 5 minutes is fine and answers instantly.
        maximumAge: 300000,
      },
    );
  }, []);

  /* -- pincode --------------------------------------------------------------- */

  const applyPincode = useCallback(async () => {
    if (!/^\d{6}$/.test(pincode)) {
      setMessageKey('pincodeInvalid');
      return;
    }
    setPincodeBusy(true);
    setMessageKey(null);
    const hit = await geocodePincode(pincode);
    if (!aliveRef.current) return;
    setPincodeBusy(false);
    if (!hit) {
      setMessageKey('pincodeNotFound');
      return;
    }
    const entry = writeGeo(hit);
    if (entry) {
      setGeo(entry);
      setOpen(false);
    }
  }, [pincode]);

  const confirmMapPin = useCallback((place) => {
    const entry = writeGeo(place);
    if (entry) {
      setGeo(entry);
      setOpen(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    clearGeo();
    setGeo(null);
    setMessageKey(null);
  }, []);

  /* -- shared classes ----------------------------------------------------- */

  // ring-brand-700, not brand-500: #035C6C measures ~2.3:1 on white and fails
  // the 3:1 non-text contrast floor (WCAG 1.4.11) that a focus indicator has to
  // clear. #024A57 clears it on every light surface in the header.
  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2';

  const chipBase = cx(
    'inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition',
    focusRing,
  );

  const locating = status === 'locating';
  const currentLabel = (() => {
    if (!geo) return null;
    const label = geo.label || '';
    const pin = geo.pincode;
    if (pin && !label.includes(pin)) return `${geo.city || geo.area || label || 'Near you'} · ${pin}`;
    return label || null;
  })();

  return (
    <div className={cx('relative flex min-w-0 items-center', className)}>
      {size === 'lg' ? (
        /* Header pill: borderless "📍 Select Location ⌄", or the saved
           "PIN - place". The label collapses to icon + chevron below xl. */
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label={geo ? `Location: ${currentLabel || 'Near you'}` : 'Select Location'}
          className={cx(
            'inline-flex h-11 max-w-full items-center gap-2 rounded-full px-2.5 text-left text-brand-ink transition hover:bg-brand-soften xl:px-3',
            focusRing,
          )}
        >
          {locating ? (
            <LoaderCircle className="h-5 w-5 shrink-0 motion-safe:animate-spin text-brand-600" aria-hidden="true" />
          ) : (
            <MapPin className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
          )}
          <span className="hidden max-w-[13rem] truncate text-sm font-bold xl:block">
            {locating ? 'Locating…' : geo ? currentLabel || 'Near you' : 'Select Location'}
          </span>
          <ChevronDown
            className={cx('h-4 w-4 shrink-0 text-brand-muted transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      ) : geo ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className={cx(chipBase, 'border-brand-200 bg-brand-soft text-brand-700 hover:bg-brand-100')}
        >
          <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 leading-tight">
            <span className="block text-[11px] font-medium text-brand-700/80">Deliver to</span>
            <span className="block max-w-[9rem] truncate text-sm font-bold">
              {currentLabel || 'Near you'}
            </span>
          </span>
          <ChevronDown
            className={cx('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className={cx(
            chipBase,
            'border-brand-line bg-white text-brand-ink hover:border-brand-600 hover:bg-brand-soften',
            'disabled:cursor-not-allowed disabled:opacity-70',
          )}
        >
          {locating ? (
            // motion-safe: a perpetual spin is exactly what prefers-reduced-motion
            // is for. Without motion the icon still reads as "busy" beside the
            // changed label.
            <LoaderCircle
              className="h-5 w-5 shrink-0 motion-safe:animate-spin text-brand-600"
              aria-hidden="true"
            />
          ) : (
            <MapPin className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
          )}
          <span className="min-w-0 leading-tight">
            <span className="block text-[11px] font-medium text-brand-muted">Deliver to</span>
            <span className="block max-w-[9rem] truncate text-sm font-bold text-brand-ink">
              {locating ? 'Locating…' : 'Set location'}
            </span>
          </span>
        </button>
      )}

      {/* Dialog — "Choose your delivery location". Portalled; see component doc. */}
      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ggfix-location-title"
            >
              <button
                type="button"
                aria-label="Close"
                onClick={closeModal}
                className="absolute inset-0 h-full w-full cursor-default bg-brand-ink/60 backdrop-blur-sm"
                tabIndex={-1}
              />

              <div className={cx('relative z-10 my-auto w-full rounded-3xl bg-white p-6 shadow-lift', view === 'map' ? 'max-w-lg' : 'max-w-sm')}>
                <div className="flex items-start justify-between gap-3">
                  <h2 id="ggfix-location-title" className="text-lg font-bold text-brand-ink">
                    {view === 'map' ? 'Set location on map' : 'Choose your delivery location'}
                  </h2>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={closeModal}
                    className={cx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-muted transition hover:bg-brand-soft hover:text-brand-ink',
                      focusRing,
                    )}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {view === 'map' ? (
                  <MapPinPicker initial={geo} onConfirm={confirmMapPin} onBack={() => setView('main')} focusRing={focusRing} />
                ) : (
                <>
                {geo ? (
                  <div className="mt-4 rounded-2xl border border-brand-line bg-brand-soften p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                      Current location
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-brand-ink">
                      {currentLabel || <span className="font-mono font-normal">{formatGeo(geo)}</span>}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={requestLocation}
                        disabled={locating || !!unavailable}
                        title={unavailable ? MESSAGES[unavailable] : undefined}
                        className={cx(
                          'inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700',
                          'disabled:cursor-not-allowed disabled:opacity-70',
                          focusRing,
                        )}
                      >
                        {locating ? (
                          <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />
                        ) : (
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {locating ? 'Updating…' : 'Update'}
                      </button>
                      <button
                        type="button"
                        onClick={handleClear}
                        className={cx(
                          'inline-flex items-center gap-1.5 rounded-full border border-brand-line px-3 py-1.5 text-xs font-semibold text-brand-muted transition hover:border-brand-strong hover:text-brand-ink',
                          focusRing,
                        )}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5">
                  <label htmlFor="ggfix-location-pincode" className="block text-sm font-semibold text-brand-ink">
                    Enter Pincode
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id="ggfix-location-pincode"
                      ref={pincodeInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={6}
                      placeholder="6-digit pincode"
                      value={pincode}
                      onChange={(e) => {
                        setPincode(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setMessageKey(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyPincode();
                        }
                      }}
                      className="min-w-0 flex-1 rounded-full border border-brand-line bg-white px-4 py-2.5 text-base text-brand-ink sm:text-sm placeholder:text-brand-subtle focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                    <button
                      type="button"
                      onClick={applyPincode}
                      disabled={pincode.length !== 6 || pincodeBusy}
                      className={cx(
                        'shrink-0 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700',
                        'disabled:cursor-not-allowed disabled:bg-brand-200',
                        focusRing,
                      )}
                    >
                      {pincodeBusy ? (
                        <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                      ) : (
                        'Apply'
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-brand-line" />
                  <span className="text-xs font-medium uppercase tracking-wide text-brand-subtle">or</span>
                  <span className="h-px flex-1 bg-brand-line" />
                </div>

                <div className="mt-4">
                  {unavailable ? (
                    <p className="flex items-start gap-2 rounded-2xl border border-brand-line bg-brand-soften p-3 text-xs leading-relaxed text-brand-muted">
                      <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {MESSAGES[unavailable]}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={requestLocation}
                      disabled={locating}
                      className={cx(
                        'flex w-full items-center justify-center gap-2 rounded-full border border-brand-line px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:border-brand-600 hover:bg-brand-soften',
                        'disabled:cursor-not-allowed disabled:opacity-70',
                        focusRing,
                      )}
                    >
                      {locating ? (
                        <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                      ) : (
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                      )}
                      {locating ? 'Locating…' : 'Use my current location'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setView('map')}
                    className={cx(
                      'mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100',
                      focusRing,
                    )}
                  >
                    <MapIcon className="h-4 w-4" aria-hidden="true" />
                    Pick on map
                  </button>

                  {/* role="status" (aria-live="polite") so the outcome of a press is
                      announced — a sighted user sees the text change, a screen-reader
                      user would otherwise get nothing at all. */}
                  <div role="status" aria-live="polite">
                    {messageKey ? (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {MESSAGES[messageKey]}
                        {messageKey !== 'denied' && messageKey !== 'pincodeInvalid' ? (
                          <button
                            type="button"
                            onClick={messageKey === 'pincodeNotFound' ? applyPincode : requestLocation}
                            className="ml-1.5 font-semibold underline underline-offset-2"
                          >
                            Try again
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </div>

                <p className="mt-4 text-[11px] leading-relaxed text-brand-subtle">
                  Shops are matched by distance from this point. It stays on this device.
                </p>
                </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
