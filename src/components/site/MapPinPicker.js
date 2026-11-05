'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Crosshair, LoaderCircle, MapPin } from 'lucide-react';

import { cx } from '@/components/site/ui';
import { lookupPlace, reverseGeocodeBackend } from '@/components/site/geo';
import { loadGoogleMaps } from '@/components/site/googleMapsLoader';

// Centre of India — used only when we have no saved point yet.
const FALLBACK = { lat: 20.5937, lng: 78.9629, zoom: 5 };

/**
 * "Pick on map" step of the location dialog (Airtel / Apple Maps style):
 * the pin stays fixed in the middle and the visitor drags the map under it.
 * When the map settles we reverse-geocode the centre and show the address +
 * PIN code; "Confirm location" hands the point back to LocationControl.
 *
 *   initial    saved geo entry ({lat,lng}) to start from, or null
 *   onConfirm  (entry) => void — {lat,lng,label,pincode,...place}
 *   onBack     () => void
 */
export default function MapPinPicker({ initial, onConfirm, onBack, focusRing }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const seq = useRef(0);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [dragging, setDragging] = useState(false);
  const [place, setPlace] = useState(null); // { lat, lng, label?, pincode?, ... }
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGoogleMaps()
      .then((google) => {
        if (!alive || !mapEl.current) return;
        const start = initial && Number.isFinite(initial.lat) ? initial : FALLBACK;
        const map = new google.maps.Map(mapEl.current, {
          center: { lat: start.lat, lng: start.lng },
          zoom: start.zoom || 16,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });
        mapRef.current = map;
        map.addListener('dragstart', () => setDragging(true));
        map.addListener('idle', () => {
          setDragging(false);
          const c = map.getCenter();
          resolve(c.lat(), c.lng());
        });
        setState('ready');
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once.
  }, []);

  function resolve(lat, lng) {
    const id = ++seq.current;
    setPlace({ lat, lng });
    setResolving(true);
    reverseGeocodeBackend(lat, lng)
      .then((hit) => (hit && hit.pincode ? hit : lookupPlace(lat, lng).then((b) => (hit ? { ...b, ...hit, pincode: b && b.pincode } : b))))
      .then((hit) => {
        if (id !== seq.current) return; // a newer drag won
        setResolving(false);
        if (hit) setPlace({ lat, lng, ...hit });
      })
      .catch(() => id === seq.current && setResolving(false));
  }

  function locateMe() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        mapRef.current.panTo({ lat: p.coords.latitude, lng: p.coords.longitude });
        mapRef.current.setZoom(17);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  const title = place && (place.area || place.label || place.city);
  const subtitle = place && (place.formattedAddress || [place.city, place.state].filter(Boolean).join(', '));

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onBack}
        className={cx('inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-brand-700 hover:underline', focusRing)}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <div className="relative mt-3 h-72 overflow-hidden rounded-2xl border border-brand-line bg-brand-soften sm:h-80">
        <div ref={mapEl} className="absolute inset-0" aria-label="Map — drag to move the pin" role="application" />

        {state === 'loading' ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-brand-muted">
            <LoaderCircle className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            Loading map…
          </div>
        ) : null}
        {state === 'error' ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-brand-muted">
            The map couldn’t load. Enter your PIN code or use your current location instead.
          </div>
        ) : null}

        {state === 'ready' ? (
          <>
            {/* Fixed centre pin — lifts while the map is dragged */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full" aria-hidden="true">
              <div className={cx('flex flex-col items-center transition-transform duration-150', dragging && '-translate-y-2')}>
                <span className="mb-1 whitespace-nowrap rounded-full bg-brand-ink px-2.5 py-1 text-[11px] font-semibold text-white shadow-md">
                  {dragging ? 'Release to set' : 'Your device is here'}
                </span>
                <MapPin className="h-10 w-10 fill-brand-600 text-white drop-shadow-md" strokeWidth={1.5} />
              </div>
              <span className={cx('mx-auto block h-1.5 w-3 rounded-full bg-black/30 transition', dragging ? 'scale-75 opacity-50' : 'opacity-100')} />
            </div>

            <button
              type="button"
              onClick={locateMe}
              aria-label="Go to my current location"
              className={cx('absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-700 shadow-lift hover:bg-brand-soft', focusRing)}
            >
              <Crosshair className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      <div className="mt-3 min-h-[3.5rem] rounded-2xl border border-brand-line bg-white p-3" role="status" aria-live="polite">
        {resolving || !place ? (
          <p className="flex items-center gap-2 text-sm text-brand-muted">
            <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            Finding address…
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-bold text-brand-ink">
              <span className="min-w-0 truncate">{title || 'Selected point'}</span>
              {place.pincode ? (
                <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-700">{place.pincode}</span>
              ) : null}
            </p>
            {subtitle ? <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-brand-muted">{subtitle}</p> : null}
          </>
        )}
      </div>

      <button
        type="button"
        disabled={!place || resolving || state !== 'ready'}
        onClick={() => onConfirm({ ...place, source: 'gps' })}
        className={cx(
          'mt-3 w-full rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700',
          'disabled:cursor-not-allowed disabled:bg-brand-200',
          focusRing,
        )}
      >
        Confirm location
      </button>
    </div>
  );
}
