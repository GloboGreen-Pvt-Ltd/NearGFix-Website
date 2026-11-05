import { MASTER_BASE } from '@/lib/api';

/**
 * Model images on media.ggfix.in.
 *
 * The client sends IDs and a file and NEVER a path. The S3 key is derived on the
 * server from the names those IDs resolve to — see MediaKeys.java. Building the key
 * here would mean two implementations of the same slug rules drifting apart, and it
 * would let anyone with the endpoint choose where their bytes land.
 *
 * These go through fetch rather than `masterApi`, which sets Content-Type:
 * application/json. A multipart POST must let the browser set that header itself so
 * it can append the boundary; overriding it makes Spring see an unparseable body and
 * report the file as missing.
 */

const trim = (base) => String(base || '').replace(/\/+$/, '');

function authHeaders() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Surface the backend's message — it is written to be shown to the user as-is. */
async function unwrap(res) {
  const raw = await res.text().catch(() => '');
  let body = raw;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      /* keep the raw text */
    }
  }
  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && (body.message || body.error)) ||
      (typeof body === 'string' && body.trim()) ||
      `Upload failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/**
 * Append a repeated field once per value. Spring binds repeats to a List; a single
 * comma-joined string would arrive as one element containing commas.
 */
function appendAll(form, field, values) {
  (Array.isArray(values) ? values : []).forEach((value) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      form.append(field, String(value));
    }
  });
}

/**
 * Create a model and upload its image in one request.
 *
 * @param {object} model
 * @param {string} model.categoryId
 * @param {string} model.brandId
 * @param {string} model.seriesId
 * @param {string} model.modelName
 * @param {string[]} [model.modelNumber]
 * @param {string[]} [model.colors]
 * @param {string[]} [model.ramStorage]
 * @param {boolean} [model.sellActive]
 * @param {File} file  jpeg, png or webp
 * @returns {Promise<{id:string, mediaFolderKey:string, imageKey:string, imageUrl:string}>}
 */
export async function createModelWithImage(model, file) {
  const form = new FormData();
  form.append('categoryId', model.categoryId);
  form.append('brandId', model.brandId);
  form.append('seriesId', model.seriesId);
  form.append('modelName', model.modelName);
  appendAll(form, 'modelNumber', model.modelNumber);
  appendAll(form, 'colors', model.colors);
  appendAll(form, 'ramStorage', model.ramStorage);
  if (model.sellActive !== undefined) form.append('sellActive', String(model.sellActive));
  form.append('image', file);

  const res = await fetch(`${trim(MASTER_BASE())}/master/models/with-image`, {
    method: 'POST',
    headers: authHeaders(), // no Content-Type: the browser adds the boundary
    body: form,
  });
  return unwrap(res);
}

/**
 * Replace an existing model's image. The folder is kept; the response carries a NEW
 * imageKey, because the filename changes on every upload so CloudFront and the
 * browser cannot keep serving the superseded image.
 *
 * The image it replaced is deleted from the bucket by the server — see
 * {@link imageReplacementNotice} for reporting that, including the cases where the
 * old file was deliberately kept.
 */
export async function replaceModelImage(modelId, file) {
  const form = new FormData();
  form.append('image', file);

  const res = await fetch(
    `${trim(MASTER_BASE())}/master/models/${encodeURIComponent(modelId)}/image`,
    { method: 'POST', headers: authHeaders(), body: form },
  );
  return unwrap(res);
}

/**
 * Ask the server where a model would be filed, without uploading.
 *
 * Lets the form show the destination as the user picks, and makes the shared base
 * path visible: every model under one category/brand/series returns the same
 * baseFolder.
 *
 * @returns {Promise<{baseFolder:string, modelFolder?:string, examplePublicUrl?:string}>}
 */
export async function previewModelMediaPath({ categoryId, brandId, seriesId, modelName }) {
  const res = await fetch(`${trim(MASTER_BASE())}/master/models/media-path/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ categoryId, brandId, seriesId, modelName }),
  });
  return unwrap(res);
}

/** Formats accepted by the backend validator; use as the file input's `accept`. */
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';

/**
 * What to tell the operator after an upload replaced an existing image.
 *
 * Every upload endpoint returns previousImageUrl (what the record held before) and
 * previousImageRemoved (whether that file was deleted from the bucket). The server
 * keeps the old file in two cases it cannot safely delete — another record still
 * points at it, or it was never hosted on media.ggfix.in (a data URI, an old
 * Cloudinary link) — and those must not be reported as a deletion that happened.
 *
 * @param {object} res    upload response
 * @param {string} label  what was uploaded, e.g. "Model image"
 * @returns {string} a sentence to show, or '' when there is nothing worth saying
 */
export function imageReplacementNotice(res, label = 'Image') {
  if (!res) return '';
  if (res.previousImageRemoved) {
    return `${label} updated — the new file is stored on media.ggfix.in and the old one was deleted.`;
  }
  if (res.previousImageUrl) {
    return `${label} updated and stored on media.ggfix.in. The previous file was kept: it is either still used by another record or was not stored on media.ggfix.in.`;
  }
  return `${label} stored on media.ggfix.in.`;
}

/* -------------------------------------------------------------------------- */
/* Taxonomy artwork (categories, brands)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Upload or replace a category tile.
 *
 * Id-scoped, so a NEW category has to be saved before its image can be uploaded —
 * the key is derived from the category's stored name. That is the opposite order to
 * the old Cloudinary uploader, which produced a URL first and saved it as a field.
 *
 * @returns {Promise<{imageKey:string, imageUrl:string}>}
 */
export async function uploadCategoryImage(categoryId, file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(
    `${trim(MASTER_BASE())}/master/device-categories/${encodeURIComponent(categoryId)}/image`,
    { method: 'POST', headers: authHeaders(), body: form },
  );
  return unwrap(res);
}

/** Upload or replace a brand logo. Same id-scoped ordering as categories. */
export async function uploadBrandImage(brandId, file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(
    `${trim(MASTER_BASE())}/master/brands/${encodeURIComponent(brandId)}/image`,
    { method: 'POST', headers: authHeaders(), body: form },
  );
  return unwrap(res);
}

/**
 * Upload or replace a home-screen banner image.
 *
 * Keyed on the banner's title, so it lands at banner/<title>-<id>.<ext>. Id-scoped
 * like the others, because the key comes from the stored title — the banner has to
 * exist before its image can be named.
 */
export async function uploadBannerImage(bannerId, file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(
    `${trim(MASTER_BASE())}/master/banners/${encodeURIComponent(bannerId)}/image`,
    { method: 'POST', headers: authHeaders(), body: form },
  );
  return unwrap(res);
}

/**
 * Upload or replace the reference photo on a Model Compatibility box.
 *
 * Keyed on the box's number, so it lands at
 * master/model-compatibility/a-12-9d3f7b10.jpg. Id-scoped like the others — the
 * box must be saved first, which is why the form uploads after the save returns
 * an id rather than before.
 */
export async function uploadCompatibilityImage(compatibilityId, file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(
    `${trim(MASTER_BASE())}/master/model-compatibility/${encodeURIComponent(compatibilityId)}/image`,
    { method: 'POST', headers: authHeaders(), body: form },
  );
  return unwrap(res);
}

/**
 * Upload or replace a Category Menu tile image (Repair/Sell/Buy customer-app
 * menu tiles). Id-scoped like the others above — a new row has to be saved and
 * have an id before its image can be uploaded.
 */
export async function uploadCategoryMenuImage(categoryMenuId, file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(
    `${trim(MASTER_BASE())}/master/category-menu/${encodeURIComponent(categoryMenuId)}/image`,
    { method: 'POST', headers: authHeaders(), body: form },
  );
  return unwrap(res);
}
