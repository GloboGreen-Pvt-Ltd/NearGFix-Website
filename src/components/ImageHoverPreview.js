'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const SIZE = 300;
const CAPTION = 32;
const GAP = 8;
const FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>'
);

/** Thumbnail that shows a 300×300 portal preview on hover (desktop) or tap (touch). */
export default function ImageHoverPreview({ src, name, className }) {
  const thumbRef = useRef(null);
  const popRef = useRef(null);
  const closeTimer = useRef(null);
  const [pos, setPos] = useState(null);
  const [thumbErr, setThumbErr] = useState(false);
  const [bigErr, setBigErr] = useState(false);

  const place = () => {
    const r = thumbRef.current?.getBoundingClientRect();
    if (!r) return;
    const w = SIZE + 2, h = SIZE + CAPTION + 2;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = r.right + GAP;
    if (left + w > vw - GAP) left = r.left - w - GAP;
    left = Math.max(GAP, Math.min(left, vw - w - GAP));
    let top = r.top + r.height / 2 - h / 2;
    top = Math.max(GAP, Math.min(top, vh - h - GAP));
    setPos({ left, top });
  };
  const open = () => { clearTimeout(closeTimer.current); setBigErr(false); place(); };
  const close = () => { closeTimer.current = setTimeout(() => setPos(null), 80); };

  useEffect(() => {
    if (!pos) return undefined;
    const onScroll = () => setPos(null);
    const onDown = (e) => {
      if (!thumbRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) setPos(null);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [pos]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const isMouse = (e) => e.pointerType === 'mouse';

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote S3/CDN URL */}
      <img
        ref={thumbRef}
        src={thumbErr ? FALLBACK : src}
        alt=""
        className={className}
        style={{ cursor: 'zoom-in' }}
        onError={() => setThumbErr(true)}
        onPointerEnter={(e) => isMouse(e) && open()}
        onPointerLeave={(e) => isMouse(e) && close()}
        onClick={(e) => { e.stopPropagation(); if (pos) setPos(null); else open(); }}
      />
      {pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={popRef}
          onPointerEnter={(e) => isMouse(e) && clearTimeout(closeTimer.current)}
          onPointerLeave={(e) => isMouse(e) && close()}
          style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 9999, width: SIZE + 2 }}
          className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote S3/CDN URL */}
          <img
            src={bigErr ? FALLBACK : src}
            alt={name ? `${name} photo` : ''}
            onError={() => setBigErr(true)}
            style={{ width: SIZE, height: SIZE, objectFit: 'contain', background: '#fff', display: 'block' }}
          />
          {name && (
            <div className="truncate border-t border-gray-100 px-2 text-center text-xs font-medium text-gray-700"
                 style={{ height: CAPTION, lineHeight: `${CAPTION}px` }}>{name}</div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
