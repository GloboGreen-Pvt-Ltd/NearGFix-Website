/**
 * Build-time repair catalogue for the SEO landing pages (/repair/<category>/
 * and /repair/<category>/<brand>/) and the sitemap.
 *
 * Everything listed on those pages — device categories, brands, models and the
 * repair services — comes from the live master-data API (the same public
 * endpoints the /repair picker calls in the browser), so no page advertises a
 * brand or repair NearGFix does not actually carry. It runs only during
 * `next build`: the static export bakes the result into HTML, and a new deploy
 * picks up catalogue changes.
 *
 * Only categories that also have hand-written copy in REPAIR_CATEGORY_CONTENT
 * (src/lib/repairSeoContent.js) get a page; a category added in the admin
 * shows up here once someone writes its copy.
 *
 * A failed fetch is retried, then FAILS THE BUILD: shipping a site whose
 * sitemap and repair pages silently lost their brands would be worse than a
 * red deploy that can simply be re-run.
 */

import { REPAIR_CATEGORY_CONTENT } from '@/lib/repairSeoContent';

const MASTER_BASE = (process.env.NEXT_PUBLIC_MASTER_DATA_BASE || 'https://api.ggfix.in').replace(/\/+$/, '');

const asList = (data) => (Array.isArray(data) ? data : data?.content || data?.data || []);
const active = (row) => row && row.isActive !== false;
const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'en', { sensitivity: 'base' });

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getJson(path) {
  const url = `${MASTER_BASE}${path}`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      // force-cache: every page, generateStaticParams and the sitemap share one
      // response per URL for the whole build instead of refetching.
      const res = await fetch(url, { cache: 'force-cache', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return asList(await res.json());
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  throw new Error(`repairCatalog: could not load ${url} at build time (${lastError?.message}). Re-run the build once the master-data API is reachable.`);
}

/** Run async tasks with a small concurrency cap — the API is a single box. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

let catalogPromise;

/**
 * [{ code, slug, id, name, imageUrl, content, brands: [{ id, name, slug,
 *    imageUrl, models: [{ id, name }] }], repairGroups: [{ name, services: [name] }] }]
 * Brands without a single model in that category are dropped — a page for them
 * would have nothing to show.
 */
export function getRepairCatalog() {
  if (!catalogPromise) {
    catalogPromise = loadCatalog().catch((err) => {
      catalogPromise = undefined;
      throw err;
    });
  }
  return catalogPromise;
}

async function loadCatalog() {
  const [categories, repairCategories, repairServices] = await Promise.all([
    getJson('/master/device-categories'),
    getJson('/master/repair-categories'),
    getJson('/master/repair-services'),
  ]);

  const wanted = categories.filter((c) => active(c) && REPAIR_CATEGORY_CONTENT[String(c.code).toUpperCase()]);

  const brandsPerCategory = await mapLimit(wanted, 3, (c) =>
    getJson(`/master/categories/by-code/${encodeURIComponent(String(c.code).toUpperCase())}/brands`),
  );

  // Models are fetched per brand (all categories at once), then split by categoryId.
  const brandIds = [...new Set(brandsPerCategory.flat().filter(active).map((b) => b.id))];
  const modelLists = await mapLimit(brandIds, 6, (id) => getJson(`/master/brands/${id}/models`));
  const modelsByBrand = new Map(brandIds.map((id, i) => [id, modelLists[i].filter(active)]));

  return wanted.map((cat, i) => {
    const code = String(cat.code).toUpperCase();
    const content = REPAIR_CATEGORY_CONTENT[code];

    const brands = brandsPerCategory[i]
      .filter(active)
      .map((b) => ({
        id: b.id,
        name: b.name,
        slug: slugify(b.name),
        imageUrl: b.imageUrl || null,
        models: (modelsByBrand.get(b.id) || [])
          .filter((m) => (m.categoryId || m.deviceCategoryId) === cat.id)
          .map((m) => ({ id: m.id, name: m.name }))
          .sort(byName),
      }))
      .filter((b) => b.models.length > 0)
      .sort(byName);

    // Two brand names that slugify alike would collide on one URL; keep the
    // first and give later ones an id suffix so every page stays reachable.
    const seen = new Set();
    for (const b of brands) {
      if (seen.has(b.slug)) b.slug = `${b.slug}-${String(b.id).slice(0, 6)}`;
      seen.add(b.slug);
    }

    const repairGroups = repairCategories
      .filter((g) => active(g) && g.deviceCategoryId === cat.id)
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || byName(a, b))
      .map((g) => ({
        name: g.displayName || g.name,
        services: repairServices
          .filter((s) => active(s) && s.categoryId === g.id)
          .map((s) => s.name)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b)),
      }))
      .filter((g) => g.services.length > 0);

    return {
      code,
      slug: content.slug,
      id: cat.id,
      name: cat.name,
      imageUrl: cat.imageUrl || null,
      content,
      brands,
      repairGroups,
    };
  });
}

export async function getRepairCategory(slug) {
  const catalog = await getRepairCatalog();
  return catalog.find((c) => c.slug === slug) || null;
}

/** The /repair picker, opened on a category (and optionally a brand). */
export function pickerHref(category, brand) {
  const params = new URLSearchParams({ category: category.code });
  if (brand) {
    params.set('brand', brand.id);
    params.set('brandName', brand.name);
  }
  return `/repair/?${params.toString()}`;
}
