/**
 * Colour / storage → product photo resolution for master-data models.
 *
 * As of 2026-10-06 the live API gives each model ONE photo (`imageUrl`) and
 * `colors` / `ramStorage` as plain name lists — no per-colour or per-variant
 * photos exist yet, so every colour falls back to `imageUrl`. This module reads
 * the shapes the backend may add, in priority order, so the picker starts
 * switching photos the moment the data appears, with no further UI change:
 *
 *   1. model.variants[]   { color, storage|ramStorage, imageUrl }    exact colour + storage
 *   2. model.variants[]   same colour, any storage                    colour-level fallback
 *   3. model.colorImages  { "<colour>": url } or [{ color, imageUrl }] colour photo
 *   4. model.colors[]     [{ name, imageUrl }] (objects instead of strings)
 *   5. model.images[]     [{ color, url }]
 *   6. model.imageUrl     the model's default photo
 *
 * Field names are read tolerantly (color|colour|colorName|name,
 * imageUrl|image|image_url|url|variantImage|colorImage|colourImage|productImage)
 * and colours/storage are compared after normalisation, so "Space Grey",
 * "SPACE_GREY", "space-grey" and "SpaceGray" all match. Stored values are never
 * rewritten — normalisation is only used for comparison.
 */

/** "Space Grey" / "SPACE_GREY" / "SpaceGray" → "spacegrey"; "1 TB" → "1tb". */
export function normalizeValue(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/gray/g, 'grey')
    .replace(/colour/g, 'color')
    .replace(/[\s_\-./]+/g, '');
}

const IMAGE_KEYS = ['imageUrl', 'image', 'image_url', 'url', 'variantImage', 'colorImage', 'colourImage', 'productImage'];
const COLOR_KEYS = ['color', 'colour', 'colorName', 'colourName', 'name'];
const STORAGE_KEYS = ['storage', 'ramStorage', 'variant', 'storageLabel', 'label'];

const firstString = (row, keys) => {
  for (const k of keys) {
    const v = row?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object' && typeof v.url === 'string' && v.url) return v.url; // { image: { url } }
  }
  return null;
};
const imageOf = (row) => firstString(row, IMAGE_KEYS);
const colorOf = (row) => (typeof row === 'string' ? row : firstString(row, COLOR_KEYS));
const storageOf = (row) => firstString(row, STORAGE_KEYS);

const asArray = (v) => (Array.isArray(v) ? v : []);
const variantsOf = (model) => asArray(model?.variants || model?.modelVariants || model?.skus);

/** Colour names as displayed, in API order, whether `colors` holds strings or objects. */
export function colorNames(model) {
  const seen = new Set();
  const out = [];
  asArray(model?.colors).forEach((c) => {
    const name = colorOf(c);
    if (name && !seen.has(normalizeValue(name))) {
      seen.add(normalizeValue(name));
      out.push(name.trim());
    }
  });
  return out;
}

/** A hex the data itself gives for `color` (colour objects with hex|hexCode), or null. */
export function colorHexFromData(model, color) {
  const want = normalizeValue(color);
  const row = asArray(model?.colors).find((c) => typeof c === 'object' && normalizeValue(colorOf(c)) === want);
  const hex = row?.hex || row?.hexCode || null;
  return typeof hex === 'string' && /^#?[0-9a-f]{3,8}$/i.test(hex) ? (hex.startsWith('#') ? hex : `#${hex}`) : null;
}

/** Map<normalised colour, url> from every colour-level source (3–5 above). */
export function colorImageMap(model) {
  const map = new Map();
  const put = (name, url) => {
    if (name && url && !map.has(normalizeValue(name))) map.set(normalizeValue(name), url);
  };
  const raw = model?.colorImages ?? model?.colourImages;
  if (Array.isArray(raw)) raw.forEach((row) => put(colorOf(row), imageOf(row)));
  else if (raw && typeof raw === 'object') Object.entries(raw).forEach(([name, url]) => put(name, typeof url === 'string' ? url : imageOf(url)));
  asArray(model?.colors).forEach((c) => (typeof c === 'object' ? put(colorOf(c), imageOf(c)) : null));
  asArray(model?.images || model?.media).forEach((row) => (typeof row === 'object' && row?.color ? put(row.color, imageOf(row)) : null));
  return map;
}

/** The photo for `color` alone, or null when that colour has none. */
export function imageForColor(model, color) {
  if (!color) return null;
  const want = normalizeValue(color);
  const variant = variantsOf(model).find((v) => normalizeValue(colorOf(v)) === want && imageOf(v));
  return (variant && imageOf(variant)) || colorImageMap(model).get(want) || null;
}

/**
 * The photo to display for a colour + storage pick, following the priority
 * list at the top. Returns the model's default photo when nothing more specific
 * exists, and null only when the model has no photo at all.
 */
export function resolveVariantImage(model, { color, storage } = {}) {
  if (color) {
    const c = normalizeValue(color);
    const s = storage ? normalizeValue(storage) : null;
    const variants = variantsOf(model).filter((v) => normalizeValue(colorOf(v)) === c);
    const exact = s ? variants.find((v) => normalizeValue(storageOf(v)) === s && imageOf(v)) : null;
    const url = (exact && imageOf(exact)) || imageForColor(model, color);
    if (url) return url;
  }
  return typeof model?.imageUrl === 'string' && model.imageUrl ? model.imageUrl : null;
}

/**
 * Storage options that exist for `color`. When the API lists variants, only
 * those combinations are valid; without variants every storage is valid for
 * every colour (the current data).
 */
export function storagesForColor(model, color, allStorages) {
  const variants = variantsOf(model);
  if (!variants.length || !color) return allStorages;
  const c = normalizeValue(color);
  const valid = new Set(variants.filter((v) => normalizeValue(colorOf(v)) === c).map((v) => normalizeValue(storageOf(v))));
  if (!valid.size) return allStorages;
  return allStorages.filter((s) => valid.has(normalizeValue(s)));
}

/**
 * Clean `{ colour: url }` for saving: only colours still in `colors`, only
 * non-empty URLs, keyed by the colour's own spelling.
 */
export function toColorImagesPayload(colors, images) {
  const out = {};
  const byNorm = new Map(Object.entries(images || {}).map(([k, v]) => [normalizeValue(k), v]));
  (colors || []).forEach((c) => {
    const name = colorOf(c);
    const url = byNorm.get(normalizeValue(name));
    if (name && typeof url === 'string' && url.trim()) out[name] = url.trim();
  });
  return out;
}
