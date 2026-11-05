/**
 * Optional rich product content for the repair device page.
 *
 * NONE of these fields exist in the master-data API today (2026-10-06): a
 * model carries id, name, modelNumber, slug, imageUrl, colors, ramStorage,
 * seriesId and categoryId only. The page sections that use them stay hidden
 * until the backend starts sending them — nothing is invented in the meantime.
 *
 * PROPOSED FIELDS on a model (all optional; any can ship on its own):
 *   badge        "New" | "Best Seller"      (or isNew: true → "New")
 *   tagline      "Flagship performance smartphone"
 *   rating       4.6   ratingCount 1203     (real reviews only)
 *   highlights   [{ title, description?, icon? }]           4–6 short items
 *   specs        { "Display": "6.78-inch AMOLED", … }
 *                or [{ label, value, group? }]               shown under Specifications
 *   features     [{ eyebrow?, title, body, imageUrl? }]      alternating feature rows
 *   inTheBox     ["Charging cable", "SIM tool", …]
 *   images       [{ url, label?, color? }] or ["url", …]     gallery; color-tagged
 *                                                            photos follow the colour pick
 *   images360    ["frame-01.jpg", …]                         ≥ 8 frames for a 360° view
 *
 * Readers below accept a few spellings so the backend is not boxed in.
 */

import { normalizeValue } from '@/lib/colorImages';

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function badgeOf(model) {
  return str(model?.badge) || (model?.isNew === true ? 'New' : null);
}

export function taglineOf(model) {
  return str(model?.tagline) || str(model?.shortDescription) || str(model?.subtitle);
}

/** { value, count } only for a real 0–5 rating; null otherwise. */
export function ratingOf(model) {
  const value = Number(model?.rating ?? model?.averageRating);
  if (!Number.isFinite(value) || value <= 0 || value > 5) return null;
  const count = Number(model?.ratingCount ?? model?.reviewCount);
  return { value: Math.round(value * 10) / 10, count: Number.isFinite(count) && count > 0 ? count : null };
}

export function highlightsOf(model) {
  return arr(model?.highlights)
    .map((h) => (typeof h === 'string' ? { title: h } : { title: str(h?.title) || str(h?.label), description: str(h?.description), icon: str(h?.icon) }))
    .filter((h) => h.title)
    .slice(0, 6);
}

/** [{ label, value, group }] from either an object map or a row list. */
export function specsOf(model) {
  const raw = model?.specs ?? model?.specifications;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((r) => ({ label: str(r?.label) || str(r?.name), value: str(r?.value) ?? (r?.value != null ? String(r.value) : null), group: str(r?.group) }))
      .filter((r) => r.label && r.value);
  }
  if (typeof raw === 'object') {
    return Object.entries(raw)
      .map(([label, value]) => ({ label: str(label), value: value == null ? null : String(value).trim(), group: null }))
      .filter((r) => r.label && r.value);
  }
  return [];
}

export function featuresOf(model) {
  return arr(model?.features)
    .map((f) => ({ eyebrow: str(f?.eyebrow), title: str(f?.title), body: str(f?.body) || str(f?.description), imageUrl: str(f?.imageUrl) || str(f?.image) }))
    .filter((f) => f.title && f.body);
}

export function inTheBoxOf(model) {
  return arr(model?.inTheBox ?? model?.boxContents).map((x) => str(typeof x === 'string' ? x : x?.name)).filter(Boolean);
}

/**
 * Gallery photos for the current colour: photos tagged with that colour, plus
 * untagged ones. [{ url, label }]. Fewer than two → no thumbnail strip.
 */
export function galleryOf(model, color) {
  const all = arr(model?.images ?? model?.gallery)
    .map((x) => (typeof x === 'string' ? { url: x } : { url: str(x?.url) || str(x?.imageUrl), label: str(x?.label) || str(x?.alt), color: str(x?.color) || str(x?.colour) }))
    .filter((x) => x.url);
  const want = normalizeValue(color);
  const forColor = all.filter((x) => x.color && normalizeValue(x.color) === want);
  const untagged = all.filter((x) => !x.color);
  return [...forColor, ...untagged];
}

export function frames360Of(model) {
  const frames = arr(model?.images360 ?? model?.view360).map((x) => str(typeof x === 'string' ? x : x?.url)).filter(Boolean);
  return frames.length >= 8 ? frames : [];
}
