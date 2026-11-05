/**
 * buyFlow.js — the shop's Buy flow, ported from the Partner app's
 * OwnerBuyListingScreen → OwnerBuyListingDetailsScreen → OwnerCartScreen.
 *
 * The feed merges two sources into one card shape:
 *   GET {MARKETPLACE}/marketplace/buy/nearby?radiusKm=20[&lat&lng][&excludeSellerId]
 *       — peer listings (customers' and shops' devices), AVAILABLE only, nearest first
 *   GET {MARKETPLACE}/marketplace/products?status=ACTIVE
 *       — catalogue products, the only rows that can go in the cart
 * plus GET {SHOP}/shops for seller names and cities, and GET {AUTH}/auth/me for
 * this shop's location (the radius origin) and ids — the shop's own rows are
 * left out, as in the app. Each read fails soft, so one service being down
 * doesn't blank the page.
 *
 * Cart (the server keys it by the caller's user id):
 *   GET /customer/cart · POST /customer/cart { productId, quantity }
 *   PUT /customer/cart/{id} { quantity } · DELETE /customer/cart/{id} · DELETE /customer/cart
 *
 * There is no order call in the app: its checkout is "coming soon", Order Now
 * phones the seller, and Send Quote isn't available yet. Neither response
 * carries a seller phone today, so the call actions say so.
 */

import { useEffect, useState } from 'react';

import { AUTH_BASE, MARKETPLACE_BASE, MASTER_BASE, SHOP_BASE } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/deviceImage';
import { SHOP_TOKEN_KEY } from '@/lib/shopAuth';
import { currentSellerIds, currentShopId } from '@/lib/sellFlow';

export const BUY_RADIUS_KM = 20;

export const BUY_HREF = {
  list: '/shop-home/services/marketplace/',
  details: '/shop-home/services/marketplace/details/',
  cart: '/shop-home/services/marketplace/cart/',
};

const trim = (b) => String(b || '').replace(/\/+$/, '');
const unwrap = (rows) =>
  Array.isArray(rows) ? rows : Array.isArray(rows?.content) ? rows.content : Array.isArray(rows?.data) ? rows.data : [];

function shopToken() {
  try {
    return window.localStorage.getItem(SHOP_TOKEN_KEY);
  } catch {
    return null;
  }
}

// JSON request that tolerates an empty body (the cart DELETEs return none).
// `auth: false` for public reads, so a stale token can't 401 them.
async function request(base, path, { method = 'GET', body, auth = true } = {}) {
  const token = auth ? shopToken() : null;
  const res = await fetch(`${trim(base)}${path}`, {
    method,
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text().catch(() => '');
  let data = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      (typeof data === 'string' && data.trim().length < 200 ? data.trim() : '') ||
      `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Public master data, sent without a token (an expired one would 401 these public lists). */
export const fetchMaster = (path) => request(MASTER_BASE(), path, { auth: false });

/* -------------------------------------------------------------------------- */
/* Feed                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * This shop's location and ids, as the app's ensureOrigin(): the session's shop
 * among /auth/me's locations (else the first one), its lat/lng when set.
 */
async function buyerOrigin() {
  const sessionShopId = currentShopId();
  const me = await request(AUTH_BASE(), '/auth/me').catch(() => null);
  const locations = Array.isArray(me?.locations) ? me.locations : [];
  const shop = sessionShopId ? locations.find((s) => String(s.id) === String(sessionShopId)) : locations[0];
  const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
  return {
    lat: num(shop?.latitude),
    lng: num(shop?.longitude),
    shopId: shop?.id || sessionShopId || null,
    userId: me?.id || currentSellerIds().userId || null,
  };
}

/** A spare part either way it's tagged: type SPARE_PART, or the app's own SELL + descriptionType SPARE_PARTS. */
export const isSparePart = (item) => item?.productType === 'SPARE_PART' || item?.descriptionType === 'SPARE_PARTS';

function listingToCard(l, shop) {
  return {
    ...l,
    _key: `listing:${l.id}`,
    source: 'listing',
    productImage: resolveMediaUrl(l.productImage) || l.productImage || null,
    shopName: l.sellerType === 'SHOP' ? shop?.name || null : null,
    city: l.city || shop?.city || null,
    state: l.state || shop?.state || null,
  };
}

function productToCard(p, shop) {
  return {
    _key: `product:${p.id}`,
    source: 'product',
    id: p.id,
    sellerType: 'SHOP',
    productName: p.title,
    productImage: resolveMediaUrl(p.imageUrl) || null,
    expectedPrice: p.price,
    condition: p.workingCondition === 'DEAD' ? 'Dead / Unknown' : p.conditionLabel,
    description: p.description,
    productType: p.type,
    descriptionType: p.descriptionType,
    modelId: p.modelId,
    brandId: p.brandId,
    shopId: p.shopId,
    categoryId: null,
    // Shown on the details page (the app's card drops them).
    extraImageUrls: (Array.isArray(p.extraImageUrls) ? p.extraImageUrls : []).map((u) => resolveMediaUrl(u) || u).filter(Boolean),
    color: p.color || null,
    ramLabel: p.ramLabel || null,
    storageLabel: p.storageLabel || null,
    shopName: shop?.name || null,
    city: shop?.city || null,
    state: shop?.state || null,
  };
}

/**
 * Nearby listings (server order: nearest first) followed by catalogue
 * products, both without this shop's own rows. Throws only when BOTH sources
 * fail — then there is genuinely nothing to show.
 */
export async function loadBuyFeed() {
  const failed = { listings: false, products: false };
  const productsReq = request(MARKETPLACE_BASE(), '/marketplace/products?status=ACTIVE', { auth: false }).catch(() => {
    failed.products = true;
    return [];
  });
  const shopsReq = request(SHOP_BASE(), '/shops').catch(() => []);

  const origin = await buyerOrigin();
  const q = new URLSearchParams({ radiusKm: String(BUY_RADIUS_KM) });
  if (origin.lat != null && origin.lng != null) {
    q.set('lat', String(origin.lat));
    q.set('lng', String(origin.lng));
  }
  if (origin.userId) q.set('excludeSellerId', String(origin.userId));
  const [listingData, productData, shopData] = await Promise.all([
    request(MARKETPLACE_BASE(), `/marketplace/buy/nearby?${q}`).catch(() => {
      failed.listings = true;
      return [];
    }),
    productsReq,
    shopsReq,
  ]);
  if (failed.listings && failed.products) throw new Error('Could not load marketplace listings. Check your connection and try again.');

  const myShop = origin.shopId ? String(origin.shopId).toLowerCase() : null;
  const notMine = (row) => !myShop || String(row?.shopId || '').toLowerCase() !== myShop;
  const shops = new Map(unwrap(shopData).filter((s) => s?.id).map((s) => [String(s.id), s]));
  const shopOf = (row) => (row.shopId ? shops.get(String(row.shopId)) : null);

  const listings = unwrap(listingData).filter(notMine).map((l) => listingToCard(l, shopOf(l)));
  const products = unwrap(productData)
    .filter((p) => p && (!p.status || String(p.status).toUpperCase() === 'ACTIVE'))
    .filter(notMine)
    .map((p) => productToCard(p, shopOf(p)));
  return { items: [...listings, ...products], located: origin.lat != null && origin.lng != null };
}

/** The admin's Buy banners: active rows titled "Buy", in sortOrder. Never rejects. */
export async function fetchBuyBanners() {
  try {
    return unwrap(await fetchMaster('/master/banners'))
      .filter((b) => b && String(b.title || '').trim().toLowerCase() === 'buy' && (b.isActive ?? b.is_active) !== false)
      .sort((a, b) => (a.sortOrder ?? a.sort_order ?? 0) - (b.sortOrder ?? b.sort_order ?? 0))
      .map((b) => {
        const b64 = String(b.imageBase64 || b.image_base64 || '').trim();
        return {
          id: b.id,
          src: resolveMediaUrl(b.imageUrl || b.image_url) || (b64 ? (b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`) : null),
          link: b.linkTarget || b.link_target || null,
        };
      })
      .filter((b) => b.src);
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Card helpers                                                                */
/* -------------------------------------------------------------------------- */

export const priceOf = (item) => (item?.expectedPrice != null ? Number(item.expectedPrice) || 0 : 0);
export const formatRupees = (n, decimals = 0) =>
  `₹${Number(n || 0).toLocaleString('en-IN', decimals ? { minimumFractionDigits: decimals } : undefined)}`;
/** expectedPrice 0 means the seller is waiting for a quote. */
export const awaitingQuote = (item) => item?.expectedPrice != null && Number(item.expectedPrice) === 0;

export const sellerLabel = (item) => (item?.sellerType === 'CUSTOMER' ? 'Customer' : item?.shopName || 'Shop');
export const placeOf = (item) => [item?.city, item?.state].filter(Boolean).join(', ') || item?.address || '';
export const contactPhoneOf = (item) => item?.contactPhone || item?.sellerPhone || null;
export const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

/** Google Maps search for the seller's address, or null when there is none. */
export function mapHref(item) {
  const q = [item?.address, item?.city, item?.state, item?.pincode].filter(Boolean).join(', ');
  return q ? `https://maps.google.com/?q=${encodeURIComponent(q)}` : null;
}

/* -------------------------------------------------------------------------- */
/* Details hand-off                                                            */
/* -------------------------------------------------------------------------- */

// The app passes the whole card to its details screen (there is no GET by id
// for a nearby listing); the web hands it over through sessionStorage.
const ITEM_KEY = 'ggfix.buyItem';

export function rememberBuyItem(item) {
  try {
    window.sessionStorage.setItem(ITEM_KEY, JSON.stringify(item));
  } catch {
    /* storage blocked — the details page shows its empty state */
  }
}

/** The item opened from the list: undefined while reading, null when there is none. */
export function useBuyItem() {
  const [item, setItem] = useState(undefined);
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(ITEM_KEY);
      setItem(raw ? JSON.parse(raw) : null);
    } catch {
      setItem(null);
    }
  }, []);
  return item;
}

/* -------------------------------------------------------------------------- */
/* Cart                                                                        */
/* -------------------------------------------------------------------------- */

export const getCart = async () => unwrap(await request(MARKETPLACE_BASE(), '/customer/cart'));
export const addToCart = (productId, quantity = 1) =>
  request(MARKETPLACE_BASE(), '/customer/cart', { method: 'POST', body: { productId, quantity } });
export const updateCartItem = (itemId, quantity) =>
  request(MARKETPLACE_BASE(), `/customer/cart/${encodeURIComponent(itemId)}`, { method: 'PUT', body: { quantity } });
export const removeCartItem = (itemId) => request(MARKETPLACE_BASE(), `/customer/cart/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
export const clearCart = () => request(MARKETPLACE_BASE(), '/customer/cart', { method: 'DELETE' });

/** Total quantity across cart rows — the header badge. */
export const cartQuantity = (rows) => (Array.isArray(rows) ? rows : []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
