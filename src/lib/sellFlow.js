/**
 * sellFlow.js — read-only master-data lookups behind the partner dashboard's
 * Sell a Device flow (category → brand → model), reusing the exact
 * category/brand/model relationship Book Service uses:
 *
 *   GET /master/device-categories                 — categories (code, name, imageUrl)
 *   GET /master/categories/by-code/{CODE}/brands  — brands in that category (name, imageUrl logo)
 *   GET /master/brands/{brandId}/models           — a brand's models across ALL categories,
 *                                                   narrowed here by model.categoryId
 *
 * For selling, models flagged `sellActive: false` are left out — that flag is
 * master data's own "can be sold" switch (see /management/models).
 *
 * The Sell on NearGFix home (step 1, the Partner app's OwnerSellHomeScreen) also reads:
 *
 *   GET /master/banners                                    — the admin's "Sell" banner(s)
 *   GET {MARKETPLACE_BASE}/marketplace/products?type=SELL  — SELL listings, narrowed
 *                                                            here to this shop's own
 *
 * The listing steps after Select Model (lib/sellListing.js) read the same
 * master data the Partner app's api/masterData.js does, category-filtered by
 * the device category's UUID:
 *
 *   GET /master/colors, /master/ram-options, /master/storage-options,
 *       /master/models/{id}                               — variant pickers
 *   GET /master/screening-questions?flow=WORKING|DEAD     — screening
 *   GET /master/condition-groups (+ /{id}/options)        — physical condition
 *   GET /master/functional-issues                         — functional issues
 *   GET /master/config-fields                             — device configuration
 */

import { MARKETPLACE_BASE, masterApi } from '@/lib/api';
import { loadCatalog, resolveMediaUrl } from '@/lib/deviceImage';
import { readShopOwner } from '@/lib/shopAuth';
import { DEVICE_CATEGORIES, sortDeviceCategories } from '@/lib/siteContent';

const unwrap = (rows) => (Array.isArray(rows) ? rows : Array.isArray(rows?.content) ? rows.content : []);

const base64Src = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
};

let categoriesPromise = null;

/** Active device categories; bundled rows if master data is unreachable. */
export function fetchSellCategories() {
  if (!categoriesPromise) {
    categoriesPromise = masterApi
      .get('/master/device-categories')
      .then((rows) => {
        const list = sortDeviceCategories(unwrap(rows).filter((c) => c.isActive !== false));
        return Array.isArray(list) && list.length ? list : DEVICE_CATEGORIES;
      })
      .catch(() => {
        categoriesPromise = null;
        return DEVICE_CATEGORIES;
      });
  }
  return categoriesPromise;
}

export async function findCategory(code) {
  const wanted = String(code || '').trim().toUpperCase();
  if (!wanted) return null;
  const list = await fetchSellCategories();
  return list.find((c) => String(c.code || '').toUpperCase() === wanted) || null;
}

export async function fetchCategoryBrands(code) {
  const rows = await masterApi.get(`/master/categories/by-code/${encodeURIComponent(String(code).toUpperCase())}/brands`);
  return unwrap(rows).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
}

export async function fetchBrand(brandId) {
  const rows = await masterApi.get('/master/brands');
  return unwrap(rows).find((b) => String(b.id) === String(brandId)) || null;
}

export async function fetchSellModels(brandId, categoryId) {
  const rows = unwrap(await masterApi.get(`/master/brands/${encodeURIComponent(brandId)}/models`));
  return rows
    .filter((m) => (!categoryId || !m.categoryId || m.categoryId === categoryId) && m.sellActive !== false)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' }));
}

/* -------------------------------------------------------------------------- */
/* Sell on NearGFix home (step 1)                                                 */
/* -------------------------------------------------------------------------- */

/** Sell's own category order (the Partner app's Sell screen); any other category follows. */
export const SELL_CATEGORY_ORDER = ['MOBILE', 'LAPTOP', 'TABLET', 'AUDIO_DEVICE', 'SMARTWATCHES'];

export function sortSellCategories(list) {
  const rank = (c) => {
    const i = SELL_CATEGORY_ORDER.indexOf(String(c?.code || '').toUpperCase());
    return i === -1 ? SELL_CATEGORY_ORDER.length : i;
  };
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => rank(a) - rank(b));
}

// The Sell-specific category art the Partner app shows (OwnerSellHomeScreen's
// SELL_IMAGES). All five files checked: 200 image/png on cdn.neargfix.com.
const SELL_ART_DIR = 'https://cdn.neargfix.com/buy&sell-categories-image';
const SELL_ART = {
  MOBILE: 'Sell-Phone.png',
  SMARTPHONE: 'Sell-Phone.png',
  LAPTOP: 'Sell-Laptop.png',
  TABLET: 'Sell-Tablet.png',
  SMARTWATCH: 'Sell-smartWatch.png',
  SMARTWATCHES: 'Sell-smartWatch.png',
  AUDIO: 'Sell-AudioDevice.png',
  AUDIO_DEVICE: 'Sell-AudioDevice.png',
  AUDIO_DEVICES: 'Sell-AudioDevice.png',
};

/** Sell art for a device-category code, or null. */
export function sellCategoryArt(code) {
  const file = SELL_ART[String(code || '').toUpperCase()];
  return file ? `${SELL_ART_DIR}/${file}` : null;
}

/**
 * The admin's Sell banners: active rows titled "Sell" (case-insensitive), in
 * sortOrder, as { id, title, src }. Never rejects — [] when there are none or
 * the service is unreachable, so the caller shows its designed fallback
 * rather than someone else's banner.
 */
export async function fetchSellBanners() {
  try {
    return unwrap(await masterApi.get('/master/banners'))
      .filter((b) => b && String(b.title || '').trim().toLowerCase() === 'sell' && (b.isActive ?? b.is_active) !== false)
      .sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0))
      .map((b) => ({
        id: b.id,
        title: b.title,
        src: resolveMediaUrl(b.imageUrl || b.image_url) || base64Src(b.imageBase64 || b.image_base64),
      }))
      .filter((b) => b.src);
  } catch {
    return [];
  }
}

/**
 * { shopId, userId } of the signed-in shop session, as stored. The stored
 * session fields come first; the email/password login stores neither, so the
 * JWT's own claims (subject = userId, `shopId`) fill the gap.
 */
function sessionIds() {
  const session = readShopOwner();
  if (!session) return { shopId: null, userId: null };
  let claims = {};
  try {
    const part = String(session.token || '').split('.')[1];
    if (part) claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) || {};
  } catch {
    claims = {};
  }
  return { shopId: session.shopId || claims.shopId || null, userId: session.userId || claims.sub || null };
}

/** sessionIds(), lower-cased for matching listing rows. */
export function currentSellerIds() {
  const { shopId, userId } = sessionIds();
  const id = (v) => (v ? String(v).trim().toLowerCase() : null);
  return { shopId: id(shopId), userId: id(userId) };
}

/** The signed-in shop's id as stored — what a new listing carries as `shopId`. */
export function currentShopId() {
  const { shopId } = sessionIds();
  return shopId ? String(shopId).trim() : null;
}

/**
 * This shop's own SELL listings, in the API's order (rows carry no createdAt
 * to sort by), each with `brandName`, `modelName` and `image` (listing photo →
 * model photo) from the master catalog — the rows carry only brandId/modelId.
 *
 * Mine = shopId is this shop OR sellerUserId is this user. Unlike the Partner
 * app, a row with neither is NOT treated as ours: on the web that would list
 * other sellers' devices. The GET is public and goes out without a token (as
 * on the Buy page), so a stale session can't 401 it. The endpoint itself
 * returns ACTIVE rows unless asked for another status.
 */
export async function fetchMySellListings() {
  const { shopId, userId } = currentSellerIds();
  let res;
  try {
    res = await fetch(`${MARKETPLACE_BASE().replace(/\/+$/, '')}/marketplace/products?type=SELL`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('Could not load your listed products. Check your connection and try again.');
  }
  if (!res.ok) throw new Error(`Could not load your listed products (${res.status}).`);
  const body = await res.json().catch(() => []);
  const rows = Array.isArray(body) ? body : Array.isArray(body?.content) ? body.content : Array.isArray(body?.data) ? body.data : [];

  const same = (value, own) => Boolean(value && own) && String(value).trim().toLowerCase() === own;
  const mine = rows.filter((p) => p && (same(p.shopId, shopId) || same(p.sellerUserId, userId)));
  if (!mine.length) return [];

  const { brands, modelsById } = await loadCatalog(mine.map((p) => p.brandId));
  return mine.map((p) => {
    const brand = p.brandId ? brands.get(String(p.brandId)) : null;
    const model = p.modelId ? modelsById.get(String(p.modelId)) : null;
    return {
      ...p,
      brandName: brand?.name || '',
      modelName: model?.name || '',
      image: resolveMediaUrl(p.imageUrl) || resolveMediaUrl(model?.imageUrl) || base64Src(model?.imageBase64),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Listing steps (after Select Model)                                          */
/* -------------------------------------------------------------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// The app only sends deviceCategoryId when it is a real UUID.
const withQuery = (path, params) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  return q.toString() ? `${path}?${q}` : path;
};
const byCategory = (categoryId) => ({ deviceCategoryId: isUuid(categoryId) ? categoryId : null });

/** A model's photo — its image URL, else its inline base64 as a data: URI (the app's modelImageUrl). */
export const modelImageSrc = (m) => resolveMediaUrl(m?.imageUrl) || base64Src(m?.imageBase64);

/**
 * A model's configured colours and RAM/storage variants (the app's
 * getModelOptions): colours resolve to a swatch hex via /master/colors by
 * name; "6 GB + 128 GB" combos and storage-only "128 GB" specs resolve to real
 * option UUIDs by GB value when the master lists have them. The full master
 * lists come back too, for models with nothing configured.
 */
export async function fetchModelOptions(modelId) {
  const [allColors, allRams, allStorages, model] = await Promise.all([
    masterApi.get('/master/colors').then(unwrap).catch(() => []),
    masterApi.get('/master/ram-options').then(unwrap).catch(() => []),
    masterApi.get('/master/storage-options').then(unwrap).catch(() => []),
    modelId ? masterApi.get(`/master/models/${encodeURIComponent(modelId)}`).catch(() => null) : null,
  ]);
  const colorByName = new Map(allColors.map((c) => [String(c.name).toLowerCase(), c]));

  const colors = [];
  const seenColor = new Set();
  for (const name of Array.isArray(model?.colors) ? model.colors : []) {
    const key = String(name || '').toLowerCase();
    if (!key || seenColor.has(key)) continue;
    seenColor.add(key);
    const hit = colorByName.get(key);
    colors.push({ id: hit?.id || name, name, hexCode: hit?.hexCode });
  }

  const specs = [];
  const seenSpec = new Set();
  for (const raw of Array.isArray(model?.ramStorage) ? model.ramStorage : []) {
    const label = String(raw || '').trim();
    if (!label || seenSpec.has(label)) continue;
    seenSpec.add(label);
    if (label.includes('+')) {
      const [ramPart = '', stoPart = ''] = label.split('+').map((x) => x.trim());
      const ramOpt = allRams.find((r) => r.valueGb === parseInt(ramPart, 10));
      const stoOpt = allStorages.find((s) => s.valueGb === parseInt(stoPart, 10));
      specs.push({
        id: label,
        label,
        storageOnly: false,
        ramOptionId: ramOpt?.id || `ram:${ramPart}`,
        storageOptionId: stoOpt?.id || `sto:${stoPart}`,
        ramLabel: ramOpt?.label || ramPart,
        storageLabel: stoOpt?.label || stoPart,
      });
    } else {
      const stoOpt = allStorages.find((s) => s.valueGb === parseInt(label, 10));
      specs.push({
        id: label,
        label,
        storageOnly: true,
        ramOptionId: null,
        storageOptionId: stoOpt?.id || `sto:${label}`,
        ramLabel: null,
        storageLabel: stoOpt?.label || label,
      });
    }
  }

  return { colors, specs, allColors, allRams, allStorages };
}

export async function fetchScreeningQuestions(flow, categoryId) {
  return unwrap(await masterApi.get(withQuery('/master/screening-questions', { flow, ...byCategory(categoryId) })));
}

/** Condition groups, each with `fetchedOptions` from its own options endpoint ([] when that read fails). */
export async function fetchConditionGroups(categoryId) {
  const groups = unwrap(await masterApi.get(withQuery('/master/condition-groups', byCategory(categoryId))));
  const options = await Promise.all(
    groups.map((g) => masterApi.get(`/master/condition-groups/${encodeURIComponent(g.id)}/options`).then(unwrap).catch(() => [])),
  );
  return groups.map((g, i) => ({ ...g, fetchedOptions: options[i] }));
}

export async function fetchFunctionalIssues(categoryId) {
  return unwrap(await masterApi.get(withQuery('/master/functional-issues', byCategory(categoryId))));
}

export async function fetchConfigFields(categoryId) {
  return unwrap(await masterApi.get(withQuery('/master/config-fields', byCategory(categoryId))));
}

/** Web routes for each step — one page per step, the selection carried in the query string. */
export const sellBrandHref = (categoryCode) =>
  categoryCode ? `/shop-home/sell/select-brand/?category=${encodeURIComponent(categoryCode)}` : '/shop-home/sell/select-brand/';
export const sellModelHref = (categoryCode, brandId) =>
  `/shop-home/sell/select-model/?category=${encodeURIComponent(categoryCode)}&brand=${encodeURIComponent(brandId)}`;

/** The listing steps after Select Model — their selection rides in the sell draft (lib/sellListing.js). */
export const SELL_STEP_HREF = {
  salesCategory: '/shop-home/sell/sales-category/',
  variant: '/shop-home/sell/select-variant/',
  description: '/shop-home/sell/description/',
  screening: '/shop-home/sell/screening/',
  screenCondition: '/shop-home/sell/screen-condition/',
  functional: '/shop-home/sell/functional/',
  deviceConfig: '/shop-home/sell/device-config/',
  accessories: '/shop-home/sell/accessories/',
  images: '/shop-home/sell/images/',
  spareParts: '/shop-home/sell/spare-parts/',
  price: '/shop-home/sell/price/',
  listed: '/shop-home/sell/listed/',
};
