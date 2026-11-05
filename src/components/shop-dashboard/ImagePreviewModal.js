'use client';

/**
 * ImagePreviewModal — view-only enlarged image of a device/product the shop
 * already has (a booking's device, a listed product, the QR page's device).
 * Dark translucent overlay, white card, the image in a fixed box, the
 * Brand + Model title under it, and close via the X, a tap outside or Esc.
 *
 * Deliberately has no "Select this product" action: everything it previews
 * is already chosen. The image never sizes the layout — it is contained
 * inside a fixed box (max 420px, 85vw × 55dvh on small screens) whatever the
 * file's own dimensions are, and a missing/broken URL shows a device icon.
 * On touch screens the image can be pinched, dragged while zoomed and
 * double-tapped to zoom (mouse: wheel / double-click).
 *
 * Portalled to <body> so a parent with transform/backdrop-filter (cards,
 * sticky headers) can't trap the fixed overlay inside itself.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, X } from 'lucide-react';

import { cx } from '@/components/site/ui';

const MAX_SCALE = 3;
const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const centreBetween = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export default function ImagePreviewModal({ open, src, title, subtitle, onClose }) {
  const [shown, setShown] = useState(false);
  const [broken, setBroken] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const panRef = useRef(null);
  const pinchRef = useRef(null);
  const lastTapRef = useRef(0);

  const applyTransform = (nextScale, nextOffset = offsetRef.current) => {
    const s = Math.max(1, Math.min(MAX_SCALE, nextScale));
    const limit = 200 * (s - 1);
    const o = s === 1
      ? { x: 0, y: 0 }
      : { x: Math.max(-limit, Math.min(limit, nextOffset.x)), y: Math.max(-limit, Math.min(limit, nextOffset.y)) };
    scaleRef.current = s;
    offsetRef.current = o;
    setScale(s);
    setOffset(o);
  };
  const toggleZoom = () => applyTransform(scaleRef.current > 1 ? 1 : 2.25, { x: 0, y: 0 });

  // Every new image / reopen starts un-zoomed.
  useEffect(() => {
    setBroken(false);
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setScale(1);
    setOffset({ x: 0, y: 0 });
    pointersRef.current.clear();
    pinchRef.current = null;
    panRef.current = null;
  }, [src, open]);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return undefined;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pointers = [...pointersRef.current.values()];
    if (pointers.length === 2) {
      pinchRef.current = {
        startDistance: distanceBetween(pointers[0], pointers[1]),
        startScale: scaleRef.current,
        startOffset: offsetRef.current,
        startCentre: centreBetween(pointers[0], pointers[1]),
      };
      panRef.current = null;
      return;
    }
    if (event.pointerType === 'touch') {
      // Double-tap to zoom (a mouse uses onDoubleClick).
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        lastTapRef.current = 0;
        toggleZoom();
        return;
      }
      lastTapRef.current = now;
    }
    if (scaleRef.current > 1) panRef.current = { x: event.clientX, y: event.clientY, startOffset: offsetRef.current };
  };
  const onPointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pointers = [...pointersRef.current.values()];
    const pinch = pinchRef.current;
    if (pinch && pointers.length >= 2) {
      const distance = distanceBetween(pointers[0], pointers[1]);
      const centre = centreBetween(pointers[0], pointers[1]);
      applyTransform(pinch.startScale * (distance / Math.max(1, pinch.startDistance)), {
        x: pinch.startOffset.x + (centre.x - pinch.startCentre.x),
        y: pinch.startOffset.y + (centre.y - pinch.startCentre.y),
      });
      return;
    }
    const pan = panRef.current;
    if (!pan || scaleRef.current <= 1) return;
    applyTransform(scaleRef.current, {
      x: pan.startOffset.x + (event.clientX - pan.x),
      y: pan.startOffset.y + (event.clientY - pan.y),
    });
  };
  const endPointer = (event) => {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    panRef.current = null;
    const remaining = [...pointersRef.current.values()];
    if (remaining.length === 1 && scaleRef.current > 1) {
      panRef.current = { x: remaining[0].x, y: remaining[0].y, startOffset: offsetRef.current };
    }
  };

  const hasImage = Boolean(src) && !broken;
  const gestureProps = hasImage
    ? {
        style: { touchAction: 'none' },
        onWheel: (e) => applyTransform(scaleRef.current + (e.deltaY < 0 ? 0.18 : -0.18)),
        onDoubleClick: toggleZoom,
        onPointerDown,
        onPointerMove,
        onPointerUp: endPointer,
        onPointerCancel: endPointer,
      }
    : {};

  return createPortal(
    <div
      className={cx(
        'fixed inset-0 z-[100] flex items-center justify-center bg-[#111111]/70 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] transition-opacity duration-200',
        shown ? 'opacity-100' : 'opacity-0',
      )}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Image preview'}
        onClick={(e) => e.stopPropagation()}
        className={cx(
          'relative flex max-h-full w-full max-w-[min(468px,92vw)] flex-col items-center rounded-[22px] bg-white p-4 pt-12 shadow-[0_24px_60px_rgba(16,24,40,0.25)] transition duration-200 sm:p-6 sm:pt-12 [@media(max-height:480px)]:w-auto [@media(max-height:480px)]:p-3 [@media(max-height:480px)]:pt-3',
          shown ? 'scale-100' : 'scale-95',
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F3F3] text-[#344054] transition hover:bg-[#ECECEC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] sm:h-9 sm:w-9"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div
          className={cx(
            'flex h-[min(420px,55dvh)] w-[min(420px,85vw)] max-w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F8F8F8] [@media(max-height:480px)]:aspect-square [@media(max-height:480px)]:h-[calc(100dvh-6.5rem)] [@media(max-height:480px)]:w-auto',
            hasImage && 'touch-none select-none',
          )}
          {...gestureProps}
        >
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote master-data / listing images.
            <img
              src={src}
              alt={title || ''}
              draggable="false"
              onError={() => setBroken(true)}
              className={cx('block h-auto max-h-full w-auto max-w-full object-contain', scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in')}
              style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`, transformOrigin: 'center center', willChange: 'transform' }}
            />
          ) : (
            <Smartphone className="h-16 w-16 text-[#98A2B3]" aria-hidden="true" />
          )}
        </div>

        {title ? <p className="mt-4 max-w-full break-words text-center text-base font-bold text-[#111111] [@media(max-height:480px)]:mt-2 [@media(max-height:480px)]:text-sm">{title}</p> : null}
        {subtitle ? <p className="mt-0.5 max-w-full break-words text-center text-xs font-medium text-[#666666]">{subtitle}</p> : null}
      </div>
    </div>,
    document.body,
  );
}
