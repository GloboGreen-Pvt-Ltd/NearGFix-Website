/**
 * deviceImage.js — one place that decides which real image a device-ish row
 * (repair booking, device category, category-menu tile) should show.
 *
 * Field names come from what the backend actually returns, not guesses:
 *   - repair bookings (GET {ORDER_BASE}/repair-bookings/shop) carry the
 *     model's photo as `deviceImageUrl` — the same field the Bookings list,
 *     booking view and booking details pages already bind.
 *   - device categories (GET /master/device-categories) and category-menu
 *     tiles (GET /master/category-menu) carry `imageUrl`.
 * The other names in DIRECT_FIELDS are only read if present, so a response
 * that gains a model/product/brand image later is picked up without a code
 * change here — a missing field is simply skipped.
 */

import { masterApi } from '@/lib/api';

// Where the media service serves uploads from. Every URL the backend
// returns today is already absolute (https://media.ggfix.in/...); this only
// matters if a row ever comes back with a bare key like "master/models/x.png".
export const MEDIA_ORIGIN = 'https://media.ggfix.in';

// Priority order: the device/model's own photo first, then product, then
// brand, then a generic imageUrl.
const DIRECT_FIELDS = [
  'deviceImageUrl',
  'modelImageUrl',
  'productImageUrl',
  'brandImageUrl',
  'imageUrl',
];

/** Absolute URL for a media value, or null. Relative keys resolve against MEDIA_ORIGIN. */
export function resolveMediaUrl(value) {
  const url = typeof value === 'string' ? value.trim() : '';
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${MEDIA_ORIGIN}/${url.replace(/^\/+/, '')}`;
}

function norm(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

/**
 * Best real image for `item`, or null when there is none (callers render
 * their own icon fallback). `categories` is an optional list of
 * device-category rows — when the item has no photo of its own but names a
 * category, that category's artwork is used before giving up.
 */
export function getDeviceImage(item, { categories } = {}) {
  if (!item) return null;
  for (const field of DIRECT_FIELDS) {
    const url = resolveMediaUrl(item[field]);
    if (url) return url;
  }
  const categoryKey = norm(item.categoryCode || item.deviceCategoryCode || item.categoryName || item.deviceCategory);
  if ((categoryKey || item.categoryId) && Array.isArray(categories)) {
    const match = categories.find(
      (c) => (item.categoryId && c.id === item.categoryId) || (categoryKey && (norm(c.code) === categoryKey || norm(c.name) === categoryKey)),
    );
    const url = resolveMediaUrl(match?.imageUrl);
    if (url) return url;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Master-catalog enrichment                                                   */
/* -------------------------------------------------------------------------- */
/* Bookings made from the partner/customer apps often carry only brandId +     */
/* modelId — no deviceDisplayName, modelName or deviceImageUrl. The customer   */
/* My Orders screen (OrdersExperience.js) resolves those the same way: the     */
/* model row from GET /master/brands/{brandId}/models gives the name and       */
/* photo, GET /master/brands the brand name and logo. Both are public          */
/* master-data reads; nothing is written.                                      */

const modelsByBrand = new Map();
let brandsPromise = null;

const unwrapList = (rows) => (Array.isArray(rows) ? rows : Array.isArray(rows?.content) ? rows.content : []);

function loadBrands() {
  if (!brandsPromise) {
    brandsPromise = masterApi
      .get('/master/brands')
      .then((rows) => new Map(unwrapList(rows).map((b) => [String(b.id), b])))
      .catch(() => {
        brandsPromise = null; // don't pin a failure for the session
        return new Map();
      });
  }
  return brandsPromise;
}

function loadBrandModels(brandId) {
  const key = String(brandId);
  if (!modelsByBrand.has(key)) {
    modelsByBrand.set(
      key,
      masterApi
        .get(`/master/brands/${encodeURIComponent(brandId)}/models`)
        .then(unwrapList)
        .catch(() => {
          modelsByBrand.delete(key);
          return [];
        }),
    );
  }
  return modelsByBrand.get(key);
}

let optionsPromise = null;

/** { ram, storage }: Map<id, label> from GET /master/ram-options and /master/storage-options, cached per session. */
export function loadVariantOptions() {
  if (!optionsPromise) {
    optionsPromise = Promise.all([
      masterApi.get('/master/ram-options').catch(() => []),
      masterApi.get('/master/storage-options').catch(() => []),
    ]).then(([rams, storages]) => ({
      ram: new Map(unwrapList(rams).map((o) => [String(o.id), o.label || o.name])),
      storage: new Map(unwrapList(storages).map((o) => [String(o.id), o.label || o.name])),
    }));
  }
  return optionsPromise;
}

/** "8 GB / 256 GB" for a booking's ram/storage option ids ('' when neither resolves). */
export function variantLabel(row, options) {
  if (!row || !options) return '';
  return [options.ram.get(String(row.ramOptionId)), options.storage.get(String(row.storageOptionId))].filter(Boolean).join(' / ') || row.ramStorage || '';
}

/** { brands: Map<id, brand>, modelsById: Map<id, model> } for the given brand ids, cached per session. */
export async function loadCatalog(brandIds) {
  const ids = [...new Set((brandIds || []).filter(Boolean).map(String))];
  const [brands, modelLists] = await Promise.all([loadBrands(), Promise.all(ids.map(loadBrandModels))]);
  return { brands, modelsById: new Map(modelLists.flat().map((m) => [String(m.id), m])) };
}

/**
 * Same rows back, each with `brandName` / `deviceDisplayName` /
 * `deviceImageUrl` / `brandImageUrl` filled from the master catalog wherever the booking itself
 * left them empty. Values the booking already has always win.
 */
export async function enrichWithCatalog(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const needs = list.filter((b) => b?.brandId && (!b.deviceImageUrl || !(b.deviceDisplayName || b.modelName) || !b.brandName));
  if (!needs.length) return list;

  const { brands, modelsById } = await loadCatalog(needs.map((b) => b.brandId));

  return list.map((b) => {
    if (!needs.includes(b)) return b;
    const model = b.modelId ? modelsById.get(String(b.modelId)) : null;
    const brand = brands.get(String(b.brandId));
    const modelImage = model?.imageUrl || (model?.imageBase64 ? `data:image/png;base64,${model.imageBase64}` : null);
    return {
      ...b,
      brandName: b.brandName || brand?.name,
      deviceDisplayName: b.deviceDisplayName || b.modelName || model?.name || undefined,
      deviceImageUrl: b.deviceImageUrl || modelImage || undefined,
      brandImageUrl: b.brandImageUrl || brand?.imageUrl || undefined,
    };
  });
}
