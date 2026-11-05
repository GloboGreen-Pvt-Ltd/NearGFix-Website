'use client';

/**
 * Website equivalent of the customer app's saved-device journey:
 * category -> brand -> model -> variant.  It deliberately uses the same two
 * services as the app (master-data for choices and user-service for saving),
 * so a device added on either surface immediately appears on the other.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Laptop,
  Loader2,
  Smartphone,
  Tablet,
  Watch,
  Headphones,
  Volume2,
  X,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import { Panel } from '@/components/site/account/ui';
import { masterApi } from '@/lib/api';
import { createDevice, updateDevice } from '@/lib/customerAccount';
import { notifyError } from '@/lib/toast';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asList = (value) => (Array.isArray(value) ? value : value?.content || value?.data || []);
const onlyUuid = (value) => (UUID_RE.test(String(value || '')) ? value : undefined);

const CATEGORY_ALIASES = {
  MOBILE: 'MOBILE', SMARTPHONE: 'MOBILE', SMARTPHONES: 'MOBILE',
  LAPTOP: 'LAPTOP', LAPTOPS: 'LAPTOP',
  SMARTWATCH: 'SMARTWATCH', SMARTWATCHES: 'SMARTWATCH', WATCH: 'SMARTWATCH', WATCHES: 'SMARTWATCH',
  TABLET: 'TABLET', TABLETS: 'TABLET',
  AUDIO: 'AUDIO', AUDIO_DEVICE: 'AUDIO', AUDIO_DEVICES: 'AUDIO',
  SPEAKER: 'SPEAKER', SPEAKERS: 'SPEAKER',
};

const CATEGORY_META = {
  MOBILE: { icon: Smartphone },
  LAPTOP: { icon: Laptop },
  SMARTWATCH: { icon: Watch },
  TABLET: { icon: Tablet },
  AUDIO: { icon: Headphones },
  SPEAKER: { icon: Volume2 },
};

const DEFAULT_COLORS = [
  'Midnight Black', 'Phantom Silver', 'Cosmic Blue', 'Rose Gold', 'Starlight', 'Alpine Green',
];

const COLOR_SWATCHES = {
  black: '#0f172a', white: '#f8fafc', silver: '#cbd5e1', gold: '#f5d785', rose: '#fbcfe8',
  blue: '#3b82f6', red: '#ef4444', green: '#035C6C', purple: '#a855f7', pink: '#ec4899',
  graphite: '#4b5563', midnight: '#1e1b4b', starlight: '#faf7f0', alpine: '#3f4754',
};

function canonicalCode(code) {
  const normalized = String(code || '').toUpperCase();
  return CATEGORY_ALIASES[normalized] || normalized || 'OTHER';
}

function colorFor(name, supplied) {
  if (supplied) return supplied;
  const lower = String(name || '').toLowerCase();
  return Object.entries(COLOR_SWATCHES).find(([key]) => lower.includes(key))?.[1] || '#94a3b8';
}

function brandInitial(name) {
  return String(name || '?').trim().charAt(0).toUpperCase() || '?';
}

// Master data stores Cloudinary URLs in image_url and, for older records,
// raw image_base64.  The mobile app resolves both shapes; use the same
// compatibility layer on the website rather than falling back to an icon when
// a perfectly good image was returned by the API.
function resolveMasterImage(item) {
  const rawUrl = item?.imageUrl;
  if (rawUrl) {
    const url = String(rawUrl);
    // Older Cloudinary uploads can be AVIF/HEIC. Request JPEG bytes in that
    // case so the card remains reliable across browsers and devices.
    if (
      url.includes('res.cloudinary.com')
      && /\.(avif|heic|heif)(\?.*)?$/i.test(url)
      && !/\/upload\/[^/]*f_(jpg|png|webp|auto)/i.test(url)
    ) {
      return url.replace('/upload/', '/upload/f_jpg/');
    }
    return url;
  }
  if (!item?.imageBase64) return null;
  const base64 = String(item.imageBase64);
  return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
}

function MasterImage({ item, alt, className, children }) {
  const source = resolveMasterImage(item);
  const [failed, setFailed] = useState(false);

  // A master record can be edited while this wizard stays open. Let a new URL
  // retry instead of preserving an error from the old image.
  useEffect(() => { setFailed(false); }, [source]);

  if (!source || failed) return children;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={source} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}

function ZoomableModelImage({ item }) {
  const source = resolveMasterImage(item);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageFailed, setImageFailed] = useState(false);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pointersRef = useRef(new Map());
  const panRef = useRef(null);
  const pinchRef = useRef(null);

  const clampOffset = (nextOffset, nextScale) => {
    // The same principle as the mobile viewer: larger scales may pan farther,
    // while 1x always stays centred. Keeping this bounded stops the image from
    // disappearing completely off the viewport.
    const limit = 220 * Math.max(0, nextScale - 1);
    return {
      x: Math.max(-limit, Math.min(limit, nextOffset.x)),
      y: Math.max(-limit, Math.min(limit, nextOffset.y)),
    };
  };
  const applyTransform = (nextScale, nextOffset = offsetRef.current) => {
    const clampedScale = Math.max(1, Math.min(3, nextScale));
    const clampedOffset = clampedScale === 1
      ? { x: 0, y: 0 }
      : clampOffset(nextOffset, clampedScale);
    scaleRef.current = clampedScale;
    offsetRef.current = clampedOffset;
    setScale(clampedScale);
    setOffset(clampedOffset);
  };
  const reset = () => applyTransform(1, { x: 0, y: 0 });
  const changeScale = (nextScale) => applyTransform(nextScale);
  const onWheel = (event) => {
    event.preventDefault();
    changeScale(scaleRef.current + (event.deltaY < 0 ? 0.18 : -0.18));
  };
  const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const centreBetween = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
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
    } else if (scaleRef.current > 1) {
      panRef.current = { x: event.clientX, y: event.clientY, startOffset: offsetRef.current };
    }
  };
  const onPointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pointers = [...pointersRef.current.values()];
    const pinch = pinchRef.current;
    if (pinch && pointers.length >= 2) {
      const distance = distanceBetween(pointers[0], pointers[1]);
      const centre = centreBetween(pointers[0], pointers[1]);
      const nextScale = pinch.startScale * (distance / Math.max(1, pinch.startDistance));
      applyTransform(nextScale, {
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

  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6 py-4 [@media(max-height:480px)]:py-1">
      <div
        className="flex h-full w-full touch-none select-none items-center justify-center overflow-hidden rounded-2xl"
        style={{ touchAction: 'none' }}
        onWheel={onWheel}
        onDoubleClick={() => (scaleRef.current > 1 ? reset() : changeScale(2.25))}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        {source && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source}
            alt={item?.name || 'Selected model'}
            draggable="false"
            onError={() => setImageFailed(true)}
            className={cx('max-h-full max-w-full object-contain', scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in')}
            style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`, transformOrigin: 'center center', willChange: 'transform' }}
          />
        ) : <Smartphone className="h-32 w-32 text-white/80" aria-hidden="true" />}
      </div>
      <div className="absolute bottom-6 right-8 flex overflow-hidden [@media(max-height:480px)]:bottom-2 [@media(max-height:480px)]:right-4 rounded-xl border border-white/15 bg-slate-900/80 shadow-lg">
        <button type="button" onClick={() => changeScale(scale - 0.25)} disabled={scale <= 1} className="p-2 text-white transition hover:bg-white/10 [@media(pointer:coarse)]:p-2.5 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
        <span className="flex min-w-12 items-center justify-center border-x border-white/15 px-2 text-xs font-bold text-white">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => changeScale(scale + 0.25)} disabled={scale >= 3} className="p-2 text-white transition hover:bg-white/10 [@media(pointer:coarse)]:p-2.5 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
        <button type="button" onClick={reset} disabled={scale <= 1} className="border-l border-white/15 p-2 text-white [@media(pointer:coarse)]:p-2.5 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Reset image zoom"><RotateCcw className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/** Mirrors the customer/shop app's full-screen product viewer on the web. */
function ModelPreviewModal({ model, index, total, onClose, onPrevious, onNext, onSelect }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onPrevious();
      if (event.key === 'ArrowRight') onNext();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, onPrevious, onNext]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] text-white" role="dialog" aria-modal="true" aria-label={`${model?.name || 'Model'} image preview`}>
      <div className="flex h-full min-h-0 flex-col" onClick={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 sm:px-7 [@media(max-height:480px)]:py-2">
          <p className="min-w-0 text-xs font-semibold text-white/65">
            <span className="[@media(pointer:coarse)]:hidden">Scroll to zoom · Double-click to zoom · Drag to pan</span>
            <span className="hidden [@media(pointer:coarse)]:inline">Pinch to zoom · Double-tap to zoom · Drag to pan</span>
          </p>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25" aria-label="Close image preview"><X className="h-5 w-5" /></button>
        </header>

        <div className="relative flex min-h-0 flex-1">
          {index > 0 ? <button type="button" onClick={onPrevious} className="absolute left-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:left-6" aria-label="Previous model image"><ChevronLeft className="h-6 w-6" /></button> : null}
          <ZoomableModelImage key={model?.id} item={model} />
          {index < total - 1 ? <button type="button" onClick={onNext} className="absolute right-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:right-6" aria-label="Next model image"><ChevronRight className="h-6 w-6" /></button> : null}
        </div>

        <footer className="shrink-0 px-5 pb-5 pt-3 sm:px-7 sm:pb-7 [@media(max-height:480px)]:pb-2 [@media(max-height:480px)]:pt-1">
          <p className="break-words text-center text-base font-extrabold text-white [@media(max-height:480px)]:text-sm">{model?.name}</p>
          {total > 1 ? <p className="mt-1 text-center text-xs font-medium text-white/55 [@media(max-height:480px)]:hidden">{index + 1} of {total}</p> : null}
          <button type="button" onClick={onSelect} className="mx-auto mt-4 flex w-full max-w-md items-center justify-center rounded-2xl bg-brand-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-brand-700 [@media(max-height:480px)]:mt-2 [@media(max-height:480px)]:py-2.5">
            Select this product
          </button>
        </footer>
      </div>
    </div>
  );
}

function createSpecs(model, rams, storages) {
  const raw = Array.isArray(model?.ramStorage) ? model.ramStorage : [];
  const specs = [];
  const seen = new Set();
  raw.forEach((source) => {
    const label = String(source || '').trim();
    if (!label || seen.has(label)) return;
    seen.add(label);
    const [ramPart, storagePart] = label.includes('+')
      ? label.split('+').map((part) => part.trim())
      : [null, label];
    const ram = ramPart ? rams.find((item) => Number(item.valueGb) === parseInt(ramPart, 10)) : null;
    const storage = storages.find((item) => Number(item.valueGb) === parseInt(storagePart, 10));
    specs.push({
      id: label,
      label,
      ramLabel: ram?.label || ramPart || null,
      storageLabel: storage?.label || storagePart || null,
      ramOptionId: ram?.id || null,
      storageOptionId: storage?.id || null,
    });
  });
  return specs;
}

function Stepper({ step, editing }) {
  const steps = editing ? ['Variant details'] : ['Category', 'Brand', 'Model', 'Variant details'];
  const visibleStep = editing ? 0 : step;
  return (
    <ol className="mb-6 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Add-device progress">
      {steps.map((label, index) => (
        <li key={label} className="flex shrink-0 items-center gap-2">
          {index ? <span className="h-px w-5 bg-brand-line sm:w-8" aria-hidden="true" /> : null}
          <span
            className={cx(
              'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
              index <= visibleStep ? 'bg-brand-600 text-white' : 'bg-brand-soften text-brand-muted',
            )}
          >
            {index < visibleStep ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
          </span>
          <span className={cx('text-xs font-semibold', index <= visibleStep ? 'text-brand-ink' : 'text-brand-muted')}>
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ChoiceCard({ children, onClick, selected, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group rounded-2xl border bg-white p-4 text-left shadow-soft transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2',
        selected ? 'border-brand-500 ring-1 ring-brand-200' : 'border-brand-line hover:border-brand-300 hover:shadow-lift',
        className,
      )}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children }) {
  return <p className="mb-2 text-sm font-bold text-brand-ink">{children}</p>;
}

function VariantEditor({ device, selection, onBack, onClose, onSaved }) {
  const editing = Boolean(device?.id);
  const categoryCode = canonicalCode(selection.categoryCode || device?.categoryCode);
  const noRamStorage = /WATCH|AUDIO|HEADPHONE|EARBUD/.test(categoryCode);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [colors, setColors] = useState([]);
  const [rams, setRams] = useState([]);
  const [storages, setStorages] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [color, setColor] = useState(device?.color || '');
  const [ram, setRam] = useState(null);
  const [storage, setStorage] = useState(null);
  const [spec, setSpec] = useState(null);
  const [imei, setImei] = useState(device?.imei || '');
  const [note, setNote] = useState(device?.note || '');

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      setLoading(true);
      try {
        const [model, allColors, allRams, allStorages] = await Promise.all([
          selection.modelId
            ? masterApi.get(`/master/models/${encodeURIComponent(selection.modelId)}`).catch(() => null)
            : Promise.resolve(null),
          masterApi.get('/master/colors').catch(() => []),
          masterApi.get('/master/ram-options').catch(() => []),
          masterApi.get('/master/storage-options').catch(() => []),
        ]);
        if (cancelled) return;
        const ramChoices = asList(allRams);
        const storageChoices = asList(allStorages);
        const modelColors = Array.isArray(model?.colors) ? model.colors : [];
        const colorChoices = (modelColors.length ? modelColors : asList(allColors)).map((item) => (
          typeof item === 'string' ? { id: item, name: item } : item
        ));
        const currentColor = device?.color;
        if (currentColor && !colorChoices.some((item) => item.name === currentColor)) {
          colorChoices.unshift({ id: currentColor, name: currentColor });
        }
        setColors(colorChoices.length ? colorChoices : DEFAULT_COLORS.map((name) => ({ id: name, name })));
        setRams(ramChoices);
        setStorages(storageChoices);
        const configuredSpecs = createSpecs(model, ramChoices, storageChoices);
        setSpecs(configuredSpecs);

        const savedRam = ramChoices.find((item) => item.id === device?.ramOptionId)
          || ramChoices.find((item) => item.label === device?.ramLabel)
          || (device?.ramLabel ? { id: device.ramOptionId || device.ramLabel, label: device.ramLabel } : null);
        const savedStorage = storageChoices.find((item) => item.id === device?.storageOptionId)
          || storageChoices.find((item) => item.label === device?.storageLabel)
          || (device?.storageLabel ? { id: device.storageOptionId || device.storageLabel, label: device.storageLabel } : null);
        setRam(savedRam);
        setStorage(savedStorage);
        const existingSpec = configuredSpecs.find((item) => (
          item.ramLabel === savedRam?.label && item.storageLabel === savedStorage?.label
        ));
        setSpec(existingSpec || null);
      } catch (cause) {
        if (!cancelled) notifyError(cause, 'Could not load device options.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadOptions();
    return () => { cancelled = true; };
  }, [device, selection.modelId]);

  const applySpec = (next) => {
    setSpec(next);
    setRam(next.ramLabel ? { id: next.ramOptionId, label: next.ramLabel } : null);
    setStorage(next.storageLabel ? { id: next.storageOptionId, label: next.storageLabel } : null);
  };

  const save = async () => {
    if (!color) {
      notifyError('Choose a colour to continue.');
      return;
    }
    if (!noRamStorage && !spec && (!ram || !storage)) {
      notifyError('Choose the device memory and storage to continue.');
      return;
    }
    setSaving(true);
    const payload = {
      categoryId: onlyUuid(selection.categoryId || device?.categoryId),
      categoryCode: selection.categoryCode || device?.categoryCode || undefined,
      brandId: onlyUuid(selection.brandId || device?.brandId),
      modelId: onlyUuid(selection.modelId || device?.modelId),
      brandName: selection.brandName || device?.brandName || undefined,
      modelName: selection.modelName || device?.modelName || undefined,
      ramOptionId: noRamStorage ? undefined : onlyUuid(ram?.id),
      storageOptionId: noRamStorage ? undefined : onlyUuid(storage?.id),
      ramLabel: noRamStorage ? undefined : ram?.label || undefined,
      storageLabel: noRamStorage ? undefined : storage?.label || undefined,
      color,
      imei: imei.trim() || undefined,
      note: note.trim(),
    };
    try {
      if (editing) await updateDevice(device.id, payload);
      else await createDevice(payload);
      onSaved();
    } catch (cause) {
      notifyError(cause, 'Could not save this device. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-brand-muted">
        <Loader2 className="h-7 w-7 animate-spin text-brand-600" aria-hidden="true" />
        <p className="text-sm font-medium">Loading device options…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">{editing ? 'Edit saved device' : 'Add a device'}</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-brand-ink">
            {selection.modelName || device?.modelName || 'Device details'}
          </h2>
          <p className="mt-1 text-sm text-brand-muted">Choose the configuration you own.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-brand-muted hover:bg-brand-soft hover:text-brand-ink" aria-label="Close device editor">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <FieldLabel>Colour</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {colors.map((item) => {
              const name = item.name || item.label || item.id;
              const selected = color === name;
              return (
                <button
                  key={item.id || name}
                  type="button"
                  onClick={() => setColor(name)}
                  className={cx(
                    'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition',
                    selected ? 'border-brand-500 bg-brand-soft text-brand-800 ring-1 ring-brand-200' : 'border-brand-line bg-white text-brand-muted hover:border-brand-300',
                  )}
                >
                  <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: colorFor(name, item.hexCode) }} />
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        {!noRamStorage ? (
          specs.length ? (
            <div>
              <FieldLabel>Memory & storage</FieldLabel>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {specs.map((item) => (
                  <ChoiceCard key={item.id} selected={spec?.id === item.id} onClick={() => applySpec(item)} className="flex items-center gap-3 p-3.5">
                    <HardDrive className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    <span className="text-sm font-bold text-brand-ink">{item.label}</span>
                  </ChoiceCard>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel>RAM</FieldLabel>
                <select
                  value={ram?.id || ''}
                  onChange={(event) => setRam(rams.find((item) => item.id === event.target.value) || null)}
                  className="w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Choose RAM</option>
                  {rams.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Storage</FieldLabel>
                <select
                  value={storage?.id || ''}
                  onChange={(event) => setStorage(storages.find((item) => item.id === event.target.value) || null)}
                  className="w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">Choose storage</option>
                  {storages.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </div>
            </div>
          )
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>IMEI / serial number <span className="font-medium text-brand-muted">(optional)</span></FieldLabel>
            <input value={imei} onChange={(event) => setImei(event.target.value)} placeholder="Enter IMEI or serial number" className="w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink outline-none placeholder:text-brand-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
          <label className="block">
            <FieldLabel>Note <span className="font-medium text-brand-muted">(optional)</span></FieldLabel>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Personal phone" className="w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink outline-none placeholder:text-brand-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
          </label>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-brand-line pt-5">
        {editing ? <span /> : (
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-brand-muted hover:bg-brand-soft hover:text-brand-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />Back
          </button>
        )}
        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          {saving ? 'Saving…' : editing ? 'Update device' : 'Save device'}
        </button>
      </div>
    </div>
  );
}

export default function DeviceWizard({ device, onClose, onSaved }) {
  const editing = Boolean(device?.id);
  const [step, setStep] = useState(editing ? 3 : 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [previewModelId, setPreviewModelId] = useState(null);
  const [selection, setSelection] = useState(() => ({
    categoryId: device?.categoryId,
    categoryCode: device?.categoryCode,
    brandId: device?.brandId,
    brandName: device?.brandName,
    modelId: device?.modelId,
    modelName: device?.modelName,
  }));

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = asList(await masterApi.get('/master/device-categories'));
      setCategories(list.filter((item) => item.isActive !== false));
    } catch (cause) {
      setError(cause?.message || 'Could not load device categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!editing && step === 0) loadCategories();
  }, [editing, step, loadCategories]);

  const chooseCategory = async (category) => {
    setSelection({
      categoryId: category.id,
      categoryCode: String(category.code || '').toUpperCase(),
      brandId: undefined,
      brandName: undefined,
      modelId: undefined,
      modelName: undefined,
    });
    setQuery('');
    setLoading(true);
    setError('');
    try {
      const list = asList(await masterApi.get(`/master/categories/${encodeURIComponent(category.id)}/brands`));
      setBrands(list);
      setStep(1);
    } catch (cause) {
      notifyError(cause, 'Could not load brands for this category.');
    } finally {
      setLoading(false);
    }
  };

  const chooseBrand = async (brand) => {
    const next = { ...selection, brandId: brand.id, brandName: brand.name, modelId: undefined, modelName: undefined };
    setSelection(next);
    setQuery('');
    setLoading(true);
    setError('');
    try {
      const list = asList(await masterApi.get(`/master/brands/${encodeURIComponent(brand.id)}/models`));
      setModels(list.filter((item) => !item.categoryId || item.categoryId === next.categoryId));
      setStep(2);
    } catch (cause) {
      notifyError(cause, 'Could not load models for this brand.');
    } finally {
      setLoading(false);
    }
  };

  const chooseModel = (model) => {
    setSelection((current) => ({ ...current, modelId: model.id, modelName: model.name }));
    setQuery('');
    setStep(3);
  };

  const goBack = () => {
    if (step === 0) { onClose(); return; }
    setQuery('');
    setError('');
    setStep((current) => current - 1);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = step === 0 ? categories : step === 1 ? brands : models;
    if (!needle) return list;
    return list.filter((item) => String(item.name || '').toLowerCase().includes(needle));
  }, [step, categories, brands, models, query]);

  // This is deliberately the same image-only gallery behaviour as the mobile
  // customer/shop Select Product screens: only records with a real image can
  // be opened and previous/next stays inside the currently visible model grid.
  const imageModels = useMemo(
    () => (step === 2 ? filtered.filter((item) => Boolean(resolveMasterImage(item))) : []),
    [step, filtered],
  );
  const previewIndex = imageModels.findIndex((item) => item.id === previewModelId);
  const previewModel = previewIndex >= 0 ? imageModels[previewIndex] : null;
  const closePreview = () => setPreviewModelId(null);
  const showPreviousPreview = () => {
    if (previewIndex > 0) setPreviewModelId(imageModels[previewIndex - 1].id);
  };
  const showNextPreview = () => {
    if (previewIndex >= 0 && previewIndex < imageModels.length - 1) setPreviewModelId(imageModels[previewIndex + 1].id);
  };
  const selectPreviewModel = () => {
    if (!previewModel) return;
    closePreview();
    chooseModel(previewModel);
  };

  if (step === 3) {
    return (
      <Panel className="p-5 sm:p-6">
        <Stepper step={step} editing={editing} />
        <VariantEditor device={device} selection={selection} onBack={goBack} onClose={onClose} onSaved={onSaved} />
      </Panel>
    );
  }

  const heading = step === 0 ? 'Choose device category' : step === 1 ? 'Choose a brand' : 'Choose a model';
  const subtitle = step === 0
    ? 'Start with the type of device you want to save.'
    : step === 1
      ? `Showing brands available for ${selection.categoryCode?.toLowerCase() || 'this category'} devices.`
      : `Showing ${selection.brandName || 'brand'} models.`;

  return (
    <Panel className="p-5 sm:p-6">
      <Stepper step={step} editing={false} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand-600">Add a device</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-brand-ink">{heading}</h2>
          <p className="mt-1 text-sm text-brand-muted">{subtitle}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-brand-muted hover:bg-brand-soft hover:text-brand-ink" aria-label="Close device wizard">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative mt-5">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${step === 0 ? 'categories' : step === 1 ? 'brands' : 'models'}`} className="w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink outline-none placeholder:text-brand-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-brand-muted"><Loader2 className="h-5 w-5 animate-spin text-brand-600" aria-hidden="true" />Loading…</div>
      ) : error ? (
        <div className="mt-5 rounded-xl bg-red-50 px-3 py-3 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-brand-strong bg-brand-50/40 px-5 py-12 text-center">
          <p className="font-bold text-brand-ink">No {step === 0 ? 'categories' : step === 1 ? 'brands' : 'models'} found</p>
          <p className="mt-1 text-sm text-brand-muted">Try another search or ask support to update the catalogue.</p>
        </div>
      ) : step === 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => {
            const meta = CATEGORY_META[canonicalCode(item.code)] || { icon: Smartphone };
            const Icon = meta.icon;
            return (
              <ChoiceCard key={item.id} onClick={() => chooseCategory(item)} className="flex min-h-36 flex-col items-center justify-center gap-2 bg-white p-3 text-center">
                <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-line bg-white text-brand-700">
                  <MasterImage item={item} alt={`${item.name || 'Device'} category`} className="h-full w-full object-contain p-1.5">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </MasterImage>
                </span>
                <span className="line-clamp-2 text-sm font-bold text-brand-ink">{item.name}</span>
              </ChoiceCard>
            );
          })}
        </div>
      ) : step === 1 ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <ChoiceCard key={item.id} onClick={() => chooseBrand(item)} className="flex min-h-36 flex-col items-center justify-center gap-2 bg-white p-3 text-center">
              <span className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-brand-line bg-white text-lg font-extrabold text-brand-700">
                <MasterImage item={item} alt={`${item.name || 'Brand'} logo`} className="h-full w-full object-contain p-2">
                  {brandInitial(item.name)}
                </MasterImage>
              </span>
              <span className="line-clamp-2 text-sm font-bold text-brand-ink">{item.name}</span>
            </ChoiceCard>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => {
            const hasImage = Boolean(resolveMasterImage(item));
            return (
              <div key={item.id} className="group flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-brand-line bg-white p-3 text-center shadow-soft transition hover:border-brand-300 hover:shadow-lift">
                {hasImage ? (
                  <button type="button" onClick={() => setPreviewModelId(item.id)} className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-line bg-white text-brand-700 transition group-hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2" aria-label={`Preview ${item.name}`}>
                    <MasterImage item={item} alt={`${item.name || 'Device'} model`} className="h-full w-full object-contain p-1.5">
                      <Smartphone className="h-6 w-6" aria-hidden="true" />
                    </MasterImage>
                  </button>
                ) : (
                  <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-line bg-white text-brand-700"><Smartphone className="h-6 w-6" aria-hidden="true" /></span>
                )}
                <button type="button" onClick={() => chooseModel(item)} className="line-clamp-2 rounded-md px-1 text-sm font-bold text-brand-ink outline-none transition hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2" aria-label={`Select ${item.name}`}>
                  {item.name}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-7 border-t border-brand-line pt-5">
        <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-brand-muted hover:bg-brand-soft hover:text-brand-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{step === 0 ? 'Cancel' : 'Back'}
        </button>
      </div>

      {previewModel ? (
        <ModelPreviewModal
          model={previewModel}
          index={previewIndex}
          total={imageModels.length}
          onClose={closePreview}
          onPrevious={showPreviousPreview}
          onNext={showNextPreview}
          onSelect={selectPreviewModel}
        />
      ) : null}
    </Panel>
  );
}
