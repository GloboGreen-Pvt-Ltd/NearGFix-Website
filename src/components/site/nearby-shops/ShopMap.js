'use client';

/**
 * ShopMap — the embedded map view for /nearby-shops.
 *
 * Markers are built ONLY from the `shops` array NearbyShops already fetched
 * from our own backend — no second request, and Google's own "nearby search"
 * is never used to populate a pin. Every marker is a real, active NearGFix shop;
 * this file has no code path that can put anything else on the map.
 */

import { useEffect, useRef, useState } from 'react';

import { loadGoogleMaps } from '@/components/site/googleMapsLoader';
import { cx } from '@/components/site/ui';

function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Plain, escaped HTML for the InfoWindow. Google's InfoWindow renders raw
 * DOM, not React, and — being injected at runtime rather than present in the
 * build — can't pick up Tailwind's compiled classes, so this uses inline
 * styles instead.
 *
 * Same two actions as ShopCard's footer (Call Store / Get Directions) — this
 * app has no shop-detail page to link a "View Shop" button to, so the
 * InfoWindow doesn't invent one.
 */
function shopInfoHtml(shop) {
  const name = escapeHtml((shop && shop.name) || 'NearGFix shop');
  const address = escapeHtml((shop && shop.address) || '');
  const distanceKm = Number(shop && shop.distanceKm);
  const distance = Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km away` : '';
  const openLabel = typeof (shop && shop.isOpen) === 'boolean' ? (shop.isOpen ? 'Open' : 'Closed') : '';
  const meta = [openLabel, distance].filter(Boolean).join(' · ');

  const lat = Number(shop && shop.latitude);
  const lng = Number(shop && shop.longitude);
  const directionsUrl = Number.isFinite(lat) && Number.isFinite(lng)
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : null;

  const rawPhone = shop && (shop.mobile || shop.phone);
  const phoneDigits = typeof rawPhone === 'string' ? rawPhone.replace(/[^\d+]/g, '') : '';
  const callUrl = phoneDigits.length >= 6 ? `tel:${phoneDigits}` : null;

  return `
    <div style="font-family:inherit;max-width:220px;padding:2px 0;">
      <div style="font-weight:700;font-size:14px;color:#0f172a;margin-bottom:2px;">${name}</div>
      ${address ? `<div style="font-size:12px;color:#64748b;margin-bottom:4px;line-height:1.4;">${address}</div>` : ''}
      ${meta ? `<div style="font-size:12px;color:#475569;margin-bottom:6px;">${meta}</div>` : ''}
      <div style="display:flex;gap:10px;">
        ${callUrl ? `<a href="${callUrl}" style="font-size:12px;font-weight:600;color:#035C6C;text-decoration:none;">Call Store</a>` : ''}
        ${directionsUrl ? `<a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="font-size:12px;font-weight:600;color:#035C6C;text-decoration:none;">Get Directions</a>` : ''}
      </div>
    </div>
  `;
}

/**
 * @param {object} props
 * @param {Array} props.shops - the same array NearbyShops renders as cards.
 * @param {{lat:number,lng:number}|null} props.geo - the customer's own location, if set.
 * @param {string} [props.className]
 */
export default function ShopMap({ shops, geo, className }) {
  const containerRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'unavailable'

  /* -- create the map once ------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        mapObjRef.current = new google.maps.Map(containerRef.current, {
          center: { lat: 20.5937, lng: 78.9629 }, // India-wide default; fitBounds below replaces this the moment there's a real point
          zoom: 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        infoWindowRef.current = new google.maps.InfoWindow();
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* -- rebuild markers whenever the shop list or customer location changes - */
  useEffect(() => {
    if (state !== 'ready' || typeof window === 'undefined' || !window.google || !mapObjRef.current) return undefined;
    const { google } = window;
    const map = mapObjRef.current;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoint = false;

    if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
      const position = { lat: geo.lat, lng: geo.lng };
      const customerMarker = new google.maps.Marker({
        position,
        map,
        title: 'You are here',
        zIndex: 999,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      markersRef.current.push(customerMarker);
      bounds.extend(position);
      hasPoint = true;
    }

    (shops || []).forEach((shop) => {
      const lat = Number(shop && shop.latitude);
      const lng = Number(shop && shop.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const position = { lat, lng };
      const marker = new google.maps.Marker({
        position,
        map,
        title: (shop && shop.name) || 'NearGFix shop',
      });
      marker.addListener('click', () => {
        infoWindowRef.current.setContent(shopInfoHtml(shop));
        infoWindowRef.current.open({ map, anchor: marker });
      });
      markersRef.current.push(marker);
      bounds.extend(position);
      hasPoint = true;
    });

    if (!hasPoint) return undefined;

    map.fitBounds(bounds, 48);
    // A single point makes fitBounds zoom in absurdly far (street level) —
    // clamp it to something a visitor can still make sense of.
    const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
      if (map.getZoom() > 15) map.setZoom(15);
    });
    return () => google.maps.event.removeListener(listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geo/shops compared by value below
  }, [state, shops, geo && geo.lat, geo && geo.lng]);

  if (state === 'unavailable') {
    return (
      <div
        className={cx(
          'flex min-h-[240px] items-center justify-center rounded-3xl border border-brand-line bg-brand-soft p-10 text-center text-sm text-brand-muted',
          className,
        )}
      >
        Map unavailable right now — use List view instead.
      </div>
    );
  }

  return (
    <div className={cx('relative overflow-hidden rounded-3xl border border-brand-line shadow-soft', className)}>
      <div ref={containerRef} className="h-[420px] max-h-[75dvh] w-full sm:h-[520px] lg:max-h-none" />
      {state === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-brand-muted">
          Loading map…
        </div>
      ) : null}
    </div>
  );
}
