/**
 * modelCompatibility.js — which devices take the same spare part.
 *
 * Port of the Partner app's utils/modelCompatibility.js so the website and the
 * app answer the same way. A part fits another device when both carry the same
 * MANUFACTURER MODEL NUMBER (Samsung SM-A127F, Apple A2221…).
 * `master_models.model_number` holds those codes and is maintained in the
 * admin Models screen — there is no separate compatibility table, and none is
 * invented here.
 *
 * Data (all public master endpoints):
 *   GET /master/models                        whole catalogue (cached)
 *   GET /master/brands, /master/device-categories
 *   GET /master/model-compatibility-types     part-type tabs (admin-managed)
 *   GET /master/model-compatibility?type=&activeOnly=true   boxes per type
 */

import { masterApi } from '@/lib/api';

const unwrap = (res) => (Array.isArray(res) ? res : Array.isArray(res?.content) ? res.content : []);

/* -------------------------------------------------------------------------- */
/* Fetching                                                                    */
/* -------------------------------------------------------------------------- */

const ALL_MODELS_TTL_MS = 10 * 60 * 1000;
let allModelsCache = null; // { at, rows }
let allModelsInFlight = null;

/** Whole model catalogue, cached for 10 minutes; concurrent callers share one request. */
export async function getAllModels({ force = false } = {}) {
  if (!force) {
    if (allModelsCache && Date.now() - allModelsCache.at < ALL_MODELS_TTL_MS) return allModelsCache.rows;
    if (allModelsInFlight) return allModelsInFlight;
  }
  const inFlight = (async () => {
    const rows = unwrap(await masterApi.get('/master/models'));
    allModelsCache = { at: Date.now(), rows };
    return rows;
  })();
  allModelsInFlight = inFlight;
  try {
    return await inFlight;
  } finally {
    if (allModelsInFlight === inFlight) allModelsInFlight = null;
  }
}

export async function getBrands() {
  return unwrap(await masterApi.get('/master/brands'));
}

export async function getDeviceCategories() {
  return unwrap(await masterApi.get('/master/device-categories'));
}

/** Active part types (the admin retires a tab by switching it off). */
export async function getCompatibilityTypes() {
  return unwrap(await masterApi.get('/master/model-compatibility-types')).filter((t) => t?.isActive !== false);
}

/** Active boxes filed under one part type. */
export async function getCompatibilityBoxes(typeSlug) {
  const qs = new URLSearchParams({ activeOnly: 'true' });
  if (typeSlug) qs.set('type', typeSlug);
  return unwrap(await masterApi.get(`/master/model-compatibility?${qs}`));
}

/* -------------------------------------------------------------------------- */
/* Index                                                                       */
/* -------------------------------------------------------------------------- */

/** jsonb array, legacy slash/comma string, or JSON text -> de-duplicated codes. */
export function parseModelNumbers(mn) {
  const raw = Array.isArray(mn) ? mn.map((s) => String(s).trim()) : String(mn || '').split(/[/,;]+/).map((s) => s.trim());
  return [...new Set(raw.filter(Boolean))];
}

export const normalizeCode = (value) => String(value ?? '').trim().toUpperCase();

/** Admin-entered names can carry tabs/double spaces ("Honor\t200 Pro"). */
export const displayName = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

export function modelCodes(model) {
  return [...new Set(parseModelNumbers(model?.modelNumber).map(normalizeCode).filter(Boolean))];
}

/** Lookup structures, built once per catalogue load. */
export function buildCompatIndex(models, { brands = [], categories = [] } = {}) {
  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const byCode = new Map();
  const byId = new Map();
  const entries = [];

  for (const model of Array.isArray(models) ? models : []) {
    if (!model?.id) continue;
    const label = displayName(model.name);
    const entry = {
      ...model,
      codes: modelCodes(model),
      name: label,
      brandName: displayName(brandName.get(model.brandId)),
      categoryName: displayName(categoryName.get(model.categoryId)),
      searchName: label.toLowerCase(),
    };
    entries.push(entry);
    byId.set(entry.id, entry);
    for (const code of entry.codes) {
      if (!byCode.has(code)) byCode.set(code, []);
      byCode.get(code).push(entry);
    }
  }
  return { entries, byId, byCode };
}

/** Models sharing a part number with `model`, most shared codes first, each with its `sharedCodes`. */
export function findInterchangeable(index, model) {
  if (!index || !model) return [];
  const self = index.byId.get(model.id) || model;
  const hits = new Map();
  for (const code of self.codes || []) {
    for (const other of index.byCode.get(code) || []) {
      if (other.id === self.id) continue;
      if (!hits.has(other.id)) hits.set(other.id, { model: other, sharedCodes: [] });
      hits.get(other.id).sharedCodes.push(code);
    }
  }
  return [...hits.values()].sort((a, b) => b.sharedCodes.length - a.sharedCodes.length || a.model.name.localeCompare(b.model.name));
}

/** Every model carrying a given part number. */
export function findByCode(index, code) {
  if (!index) return [];
  return [...(index.byCode.get(normalizeCode(code)) || [])].sort((a, b) => a.name.localeCompare(b.name));
}

/** Codes are short, alphanumeric-with-dashes and contain a digit. */
export const looksLikeCode = (q) => /^[A-Za-z0-9][A-Za-z0-9\-_.]{2,}$/.test(String(q).trim()) && /\d/.test(q);

// Least ambiguous interpretation first: an exact code hit beats a name containing the text.
const RANK_CODE_EXACT = 0;
const RANK_CODE_PREFIX = 1;
const RANK_NAME_PREFIX = 2;
const RANK_CODE_PART = 3;
const RANK_NAME_PART = 4;

/** Search by marketing name OR part number, across every category. Uncapped so counts stay true. */
export function searchModels(index, query) {
  if (!index) return [];
  const raw = String(query ?? '').trim();
  if (raw.length < 2) return [];
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();
  const scored = [];
  for (const entry of index.entries) {
    let rank = null;
    for (const code of entry.codes) {
      if (code === upper) {
        rank = RANK_CODE_EXACT;
        break;
      }
      if (code.startsWith(upper)) rank = Math.min(rank ?? RANK_CODE_PREFIX, RANK_CODE_PREFIX);
      else if (code.includes(upper)) rank = Math.min(rank ?? RANK_CODE_PART, RANK_CODE_PART);
    }
    if (rank !== RANK_CODE_EXACT) {
      if (entry.searchName.startsWith(lower)) rank = Math.min(rank ?? RANK_NAME_PREFIX, RANK_NAME_PREFIX);
      else if (entry.searchName.includes(lower)) rank = Math.min(rank ?? RANK_NAME_PART, RANK_NAME_PART);
    }
    if (rank !== null) scored.push({ entry, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name));
  return scored.map((s) => s.entry);
}

/** Models with at least one exact cross-fit — the default list before anything is typed. */
export function modelsWithCrossFit(index, { categoryId = null } = {}) {
  if (!index) return [];
  return index.entries
    .filter((e) => (!categoryId || e.categoryId === categoryId) && e.codes.some((c) => (index.byCode.get(c) || []).length > 1))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* -------------------------------------------------------------------------- */
/* Boxes                                                                       */
/* -------------------------------------------------------------------------- */

/** Chip label — brand prefixed only when the name doesn't already start with it ("Vivo Y20", not "Vivo Vivo Y20"). */
export function boxModelLabel(m) {
  const name = String(m?.modelName || '').trim();
  const brand = String(m?.brandName || '').trim();
  if (!brand) return name;
  return name.toLowerCase().startsWith(brand.toLowerCase()) ? name : `${brand} ${name}`;
}

export function brandCount(models) {
  return new Set((models || []).map((m) => m.brandId || m.brandName).filter(Boolean)).size;
}

/** A box's models grouped by brand, brands and models alphabetical. */
export function groupModelsByBrand(models) {
  const groups = new Map();
  for (const m of models || []) {
    const key = m.brandId || m.brandName || '—';
    if (!groups.has(key)) groups.set(key, { key, brandName: m.brandName || 'Unknown brand', models: [] });
    groups.get(key).models.push(m);
  }
  return [...groups.values()]
    .sort((a, b) => String(a.brandName).localeCompare(String(b.brandName)))
    .map((g) => ({ ...g, models: [...g.models].sort((a, b) => boxModelLabel(a).localeCompare(boxModelLabel(b))) }));
}

/** A box matches on its number, name, and every brand and model it lists. */
export function boxMatches(box, needle) {
  if (!needle) return true;
  const hay = [box.boxNo, box.boxName, ...(box.models || []).flatMap((m) => [m.brandName, m.modelName, boxModelLabel(m)])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle.toLowerCase());
}
