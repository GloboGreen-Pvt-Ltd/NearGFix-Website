/**
 * sellListing.js — the listing half of Sell a Device (everything after Select
 * Model), ported from the Partner app's OWNER_LIST flow:
 *
 *   sales-category → select-variant → description ─┬─ DETAILED / DEAD_SHORT:
 *                  │                               │    screening → screen-condition → functional
 *                  │                               │    → device-config (skips itself when empty)
 *                  │                               │    → accessories → images → price → listed
 *                  │                               └─ SHORT: images → price → listed
 *                  └─ spare-parts → price → listed
 *
 * THE DRAFT. The app carries every answer forward in route params. The web
 * keeps the same object in sessionStorage instead (one tab, survives a
 * refresh and the browser's Back), started fresh when a model is picked and
 * replaced by just { listed } once the listing is created — so Back from the
 * success page can't post the same listing twice.
 *
 * Writes (the app's two):
 *   POST {MASTER}/master/media/upload (multipart: file, folder) — each photo, as it's picked
 *   POST {MARKETPLACE_BASE}/marketplace/products                — the listing (one per spare part)
 */

import { useEffect, useState } from 'react';

import { MARKETPLACE_BASE, MEDIA_UPLOAD_URL } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';
import { SHOP_TOKEN_KEY } from '@/lib/shopAuth';

/* -------------------------------------------------------------------------- */
/* Draft                                                                       */
/* -------------------------------------------------------------------------- */

const DRAFT_KEY = 'ggfix.sellDraft';

export function readSellDraft() {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage full or blocked — the in-page state still carries this step */
  }
  return draft;
}

/** Replace the draft (a new model picked, or the listing created). */
export const startSellDraft = (draft) => writeDraft(draft);

/** Merge one step's answers into the draft. */
export const saveSellDraft = (patch) => writeDraft({ ...(readSellDraft() || {}), ...patch });

export function clearSellDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The draft, read after mount: undefined while reading, null when there is none. */
export function useSellDraft() {
  const [draft, setDraft] = useState(undefined);
  useEffect(() => setDraft(readSellDraft()), []);
  return draft;
}

// Switching description type (or Working ↔ Dead, which changes the screening
// questions) starts the assessment over, as a fresh navigation does in the app.
export const CLEARED_ASSESSMENT = {
  screeningAnswers: null,
  conditions: null,
  issues: null,
  deviceConfig: null,
  accessories: null,
  warranty: null,
  warrantyLabel: null,
};

/* -------------------------------------------------------------------------- */
/* Category rules (the app's keyword lists)                                    */
/* -------------------------------------------------------------------------- */

export const draftCategoryCode = (draft) => String(draft?.category?.code || draft?.device?.categoryCode || '').toUpperCase();
const hasAny = (code, words) => words.some((w) => code.includes(w));

/** Smart watches and audio devices take no RAM/storage pick. */
export const noRamStorageFor = (code) => hasAny(code, ['WATCH', 'AUDIO', 'HEADPHONE', 'EARBUD']);
/** Laptop / audio / watch / tablet listings carry no warranty question. */
export const noWarrantyFor = (code) => hasAny(code, ['LAPTOP', 'AUDIO', 'WATCH', 'HEADPHONE', 'EARBUD', 'TABLET']);

/* -------------------------------------------------------------------------- */
/* Photos                                                                      */
/* -------------------------------------------------------------------------- */

// Keys match the app's SellImagesScreen slots; their order is the gallery order.
export const PHOTO_SLOTS = [
  { key: 'front', label: 'Front side' },
  { key: 'back', label: 'Back side' },
  { key: 'side', label: 'Side & center' },
  { key: 'camera', label: 'Camera' },
  { key: 'other', label: 'Other angle' },
];

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Upload one photo (folder 'sell' or 'spare-parts', as the app does); returns its hosted URL. */
export async function uploadSellPhoto(file, folder) {
  if (!file) return null;
  if (!String(file.type || '').startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > MAX_PHOTO_BYTES) throw new Error('Photos must be 5 MB or smaller.');
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  let token = null;
  try {
    token = window.localStorage.getItem(SHOP_TOKEN_KEY);
  } catch {
    token = null;
  }
  const res = await fetch(MEDIA_UPLOAD_URL(), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const data = await res.json().catch(() => ({}));
  if (!data?.url) throw new Error('Upload returned no URL');
  return data.url;
}

/* -------------------------------------------------------------------------- */
/* Listing                                                                     */
/* -------------------------------------------------------------------------- */

/** "12,500.00" — the app's price format. */
export const formatPrice = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

/** Digits (and a decimal point) only; anything else is 0. */
export const toPrice = (s) => {
  const n = Number(String(s ?? '').replace(/[^0-9.]/g, ''));
  return Number.isNaN(n) ? 0 : n;
};

export const deviceSpecs = (device) => [device?.ramLabel, device?.storageLabel].filter(Boolean).join(' / ');

/** The uploaded device photos, in slot order. */
export const draftPhotoList = (draft) => PHOTO_SLOTS.map((s) => draft?.images?.[s.key]).filter(Boolean);

/**
 * The whole-device listing — the app's OwnerSellGadgetPriceScreen payload,
 * field for field. The catalogue photo leads (so listing cards show the real
 * device); the uploaded photos follow as extras. A SHORT listing carries no
 * assessment even if a detailed one was started and abandoned.
 */
export function buildDeviceListing(draft, price, shopId) {
  const device = draft.device || {};
  const detailed = draft.descriptionType !== 'SHORT';
  const photos = draftPhotoList(draft);
  const specs = deviceSpecs(device);
  const assessment = {
    screeningAnswers: (detailed && draft.screeningAnswers) || [],
    conditions: (detailed && draft.conditions) || [],
    issues: (detailed && draft.issues) || [],
    accessories: (detailed && draft.accessories) || [],
    warranty: (detailed && draft.warranty) || null,
    warrantyLabel: (detailed && draft.warrantyLabel) || null,
    deviceConfig: (detailed && draft.deviceConfig) || null,
    spareParts: null,
  };
  return {
    shopId: shopId || null,
    type: 'SELL',
    status: 'ACTIVE',
    title: `${device.modelName || 'Device'}${specs ? ` (${specs})` : ''}`,
    description: `${device.modelName || ''}${device.color ? ` · ${device.color}` : ''}${specs ? ` · ${specs}` : ''}`.trim(),
    price,
    brandId: device.brandId || null,
    modelId: device.modelId || null,
    ramOptionId: device.ramOptionId || null,
    storageOptionId: device.storageOptionId || null,
    conditionLabel: draft.workingCondition === 'DEAD' ? 'Dead / Unknown' : draft.deviceCondition || 'Good',
    color: device.color || null,
    ramLabel: device.ramLabel || null,
    storageLabel: device.storageLabel || null,
    imei: device.imei || null,
    workingCondition: draft.workingCondition || null,
    descriptionType: draft.descriptionType || null,
    imageUrl: device.imageUrl || photos[0] || null,
    extraImageUrls: photos.filter((u) => u !== device.imageUrl),
    assessmentJson: JSON.stringify(assessment),
  };
}

/** One spare-part listing — the app posts one of these per priced part. */
export function buildSparePartListing(part, price, partImages, shopId) {
  const fallbackImage = Object.values(partImages || {}).find(Boolean) || null;
  return {
    shopId: shopId || null,
    type: 'SELL',
    status: 'ACTIVE',
    title: part.partName,
    description: `${part.group} · ${part.partName}`,
    price,
    conditionLabel: 'Spare Part',
    descriptionType: 'SPARE_PARTS',
    imageUrl: part.imageUrl || fallbackImage,
    extraImageUrls: (part.imageUrls || []).filter((u) => u && u !== part.imageUrl),
    assessmentJson: JSON.stringify({ spareParts: [part] }),
  };
}

export async function createSellListing(payload) {
  return shopRequest(MARKETPLACE_BASE(), '/marketplace/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
