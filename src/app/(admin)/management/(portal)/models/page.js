'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { colornames } from 'color-name-list';
import cssColorNames from 'color-name';
import { masterApi, uploadMedia } from '@/lib/api';
import { mapPool } from '@/lib/concurrency';
import DataTable from '@/components/DataTable';
import S3ImageUpload from '@/components/S3ImageUpload';
import ModelsImportModal from '@/components/ModelsImportModal';
import { imageReplacementNotice, replaceModelImage } from '@/lib/modelMedia';
import { imageForColor, toColorImagesPayload } from '@/lib/colorImages';
import { exportModelsWorkbook, exportTemplateWorkbook } from '@/lib/modelsExcel';
import { notifyError, notifySuccess } from '@/lib/toast';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Split a comma/newline separated string into trimmed, non-empty parts.
const splitNames = (s) => (s || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

// Model numbers can be pasted several at once, slash / comma / semicolon / newline
// separated (e.g. "MZB0L8AIN/MZB0L88IN"). Split into clean parts.
const splitNumbers = (s) => (s || '').split(/[/,;\n]/).map((x) => x.trim()).filter(Boolean);

// Normalise a model's model_number to a clean array of codes. It can arrive as:
//   • a real jsonb array (post-migration)        -> ["A","B"]
//   • a plain slash/comma string (legacy varchar) -> "A / B"
//   • JSON *text* of an array or a quoted string, if a save happened while the
//     column was still varchar -> '["A","B"]' or '"A,B"'. Parse those so the
//     brackets/quotes don't leak into the chips.
const asNumberList = (mn) => {
  if (Array.isArray(mn)) return mn.map((x) => String(x).trim()).filter(Boolean);
  if (mn == null) return [];
  let s = String(mn).trim();
  if (!s) return [];
  if (s[0] === '[' || s[0] === '"') {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
      if (typeof parsed === 'string') s = parsed; // unwrap "A,B" then split below
    } catch { /* not valid JSON — fall through to a plain split */ }
  }
  // Split, then strip any stray quote/bracket chars a half-migrated value left behind.
  return splitNumbers(s).map((x) => x.replace(/^["[\]]+|["[\]]+$/g, '').trim()).filter(Boolean);
};

const DEFAULT_SWATCH = '#9CA3AF';
const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x | 0)).toString(16).padStart(2, '0')).join('');

// The 148 CSS keyword colors (gold, gray, black, green, teal, …) → hex. Covers
// base color nouns so "Passion Red" still resolves via its "red" word.
const CSS_HEX = new Map(Object.entries(cssColorNames).map(([k, [r, g, b]]) => [k, rgbToHex(r, g, b)]));

// ~32k community-named colors (marketing shades like "Champagne Gold" → #e8d6b3,
// "Rose Red", "Starlight"). Built once, lazily, on first color lookup.
let NAMED_HEX = null;
const namedHex = () => {
  if (!NAMED_HEX) NAMED_HEX = new Map(colornames.map((c) => [c.name.toLowerCase(), c.hex]));
  return NAMED_HEX;
};

// Normalize any stored value to a 6-digit hex an <input type="color"> accepts.
const toColorInput = (h) => {
  const s = String(h || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) return '#' + s.slice(1).split('').map((c) => c + c).join('');
  return DEFAULT_SWATCH;
};

// An explicit "#abc" / "#aabbcc" / "rgb(r,g,b)" the admin typed directly.
function parseLiteralColor(n) {
  if (/^#[0-9a-f]{6}$/.test(n)) return n;
  if (/^#[0-9a-f]{3}$/.test(n)) return '#' + n.slice(1).split('').map((c) => c + c).join('');
  const m = n.match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/);
  if (m) return rgbToHex(+m[1], +m[2], +m[3]);
  return null;
}

// Resolve a free-form color name to a swatch hex, fully automatically — no
// hand-maintained table. Priority:
//   1. an explicit hex / rgb() value
//   2. the exact name in the ~32k community color list ("Champagne Gold" → #e8d6b3)
//   3. the exact CSS keyword ("gold", "teal")
//   4. word fallback, base-noun-first ("Passion Red" → red), so an unknown
//      descriptor still lands on the right base color.
function guessColorHex(name) {
  const n = String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!n) return DEFAULT_SWATCH;
  const literal = parseLiteralColor(n);
  if (literal) return literal;
  const named = namedHex();
  if (named.has(n)) return named.get(n);
  if (CSS_HEX.has(n)) return CSS_HEX.get(n);
  const words = n.split(' ');
  for (let i = words.length - 1; i >= 0; i--) {
    if (CSS_HEX.has(words[i])) return CSS_HEX.get(words[i]);
    if (named.has(words[i])) return named.get(words[i]);
  }
  return DEFAULT_SWATCH;
}

// Parse a "RAM + Storage" chip like "6 GB + 128 GB" into option values.
function parseSpec(s) {
  const parts = String(s || '').split('+').map((x) => x.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  const ramValue = parseInt(parts[0], 10);
  const storageValue = parseInt(parts[1], 10);
  if (!ramValue || !storageValue) return null;
  const ramLabel = parts[0].replace(/\s+/g, ' ');
  const storageLabel = parts[1].replace(/\s+/g, ' ');
  return { ramValue, storageValue, ramLabel, storageLabel, label: `${ramLabel} + ${storageLabel}` };
}

// Parse a storage-only chip like "128 GB" / "256 GB" into a storage option value.
// Used when the model's storage type is "Storage only" (no RAM half).
function parseStorageOnly(s) {
  const label = String(s || '').replace(/\s+/g, ' ').trim();
  if (!label) return null;
  const storageValue = parseInt(label, 10);
  if (!storageValue) return null;
  return { storageOnly: true, storageValue, storageLabel: label, label };
}

// Small on/off toggle switch. Used for a model's "Sell Active" flag in the table
// and the edit form (green = shown in the Sell flow, grey = hidden).
/**
 * One colour's photo in the model modal: swatch, name, thumbnail (staged file or
 * saved URL), and pick / remove. Colours without a photo fall back to the main
 * model image on the website, so leaving one empty is fine.
 */
function ColorPhotoRow({ name, hex, url, file, onPick, onClear }) {
  const inputRef = useRef(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shown = preview || url || null;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-admin-border bg-admin-dark px-3 py-2">
      <span className="h-4 w-4 shrink-0 rounded-full border border-admin-border" style={{ backgroundColor: hex }} />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{name}</span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-admin-border bg-white">
        {shown
          // eslint-disable-next-line @next/next/no-img-element -- local object URL / remote S3 URL preview.
          ? <img src={shown} alt={`${name} photo`} className="h-full w-full object-contain" />
          : <span className="text-[10px] text-admin-muted">Main</span>}
      </span>
      <button type="button" onClick={() => inputRef.current?.click()}
        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-admin-accent hover:bg-admin-card">
        {shown ? 'Change' : 'Add photo'}
      </button>
      {shown ? (
        <button type="button" onClick={onClear} className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-admin-card hover:text-slate-800">
          Remove
        </button>
      ) : null}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </li>
  );
}

function ToggleSwitch({ on, onClick, title, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-brand-500' : 'bg-slate-300'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function MasterModelsPage() {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [allSeries, setAllSeries] = useState([]);

  // Table filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSeries, setFilterSeries] = useState('');

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [modal, setModal] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const exportMenuRef = useRef(null);
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formBrandId, setFormBrandId] = useState('');
  const [formSeriesId, setFormSeriesId] = useState('');
  const [name, setName] = useState('');
  // Model numbers are chips (a model can carry several regional codes); persisted
  // inline on the model as a JSON array (model.modelNumber = [codes]).
  const [modelNumberInput, setModelNumberInput] = useState('');
  const [modelNumbers, setModelNumbers] = useState([]);
  const [imageUrl, setImageUrl] = useState('');
  // Held until the row has an id: the S3 key is derived from the model's stored
  // category/brand/series/name, so the record must exist before the upload.
  const [imageFile, setImageFile] = useState(null);
  // Per-colour photos (model.colorImages, see src/lib/colorImages.js): saved URLs
  // keyed by colour name, plus files staged in this modal and uploaded on Save.
  const [colorImageUrls, setColorImageUrls] = useState({});
  const [colorImageFiles, setColorImageFiles] = useState({});
  const [category, setCategory] = useState('DEVICE');
  const [sellActive, setSellActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Global option sets (for resolving / creating colors + ram/storage on save)
  const [allColors, setAllColors] = useState([]);
  const [ramOptions, setRamOptions] = useState([]);
  const [storageOptions, setStorageOptions] = useState([]);

  // Per-model colors + RAM/storage chips — persisted inline on the model as
  // JSON arrays (model.colors = [names], model.ramStorage = [labels]).
  const [colorInput, setColorInput] = useState('');
  const [colorChips, setColorChips] = useState([]);   // [{ name, hex, colorId?, hexTouched? }]
  const [pendingHex, setPendingHex] = useState(null);  // swatch picked next to the input, before the chip is added
  const [specInput, setSpecInput] = useState('');
  const [specChips, setSpecChips] = useState([]);      // [{ label, ramValue, storageValue, ramLabel, storageLabel, ramId?, storageId?, storageOnly? }]
  // 'RAM_STORAGE' -> chips are "6 GB + 128 GB" combos; 'STORAGE_ONLY' -> chips are
  // plain "128 GB" sizes. Inferred from the model on edit; drives the input parser.
  const [storageMode, setStorageMode] = useState('RAM_STORAGE');

  const resolveMappingId = (categoryId, brandId) =>
    mappings.find((m) => m.categoryId === categoryId && m.brandId === brandId)?.id || null;

  // ---- Reference data
  const loadRefData = async () => {
    try {
      const [cats, brs, maps] = await Promise.all([
        masterApi.get('/master/device-categories').catch(() => []),
        // null (not []) so a failed fetch is distinguishable from "no brands" —
        // swallowing it renders as a bare "No models." with nothing explaining why.
        masterApi.get('/master/brands').catch(() => null),
        masterApi.get('/master/category-brand-mappings').catch(() => []),
      ]);
      if (brs === null) {
        setBrands([]);
        setError('Could not load the brand list — the master-data service is not responding. It restarts on its own after about a minute; press Refresh then.');
        return;
      }
      const catArr = Array.isArray(cats) ? cats : cats?.content ?? [];
      const brandArr = Array.isArray(brs) ? brs : brs?.content ?? [];
      const mapArr = Array.isArray(maps) ? maps : maps?.content ?? [];
      setCategories(catArr);
      setBrands(brandArr);
      setMappings(mapArr);

      // Pre-fetch all series across mappings so the form can resolve series → mapping → (cat, brand).
      // Bounded pool rather than one-at-a-time: this is dozens of round-trips and
      // was the slowest part of loading the page.
      const allSeriesAcc = [];
      await mapPool(mapArr, 6, async (m) => {
        const rows = await masterApi.get(`/master/category-brand-mappings/${m.id}/series`).catch(() => []);
        if (Array.isArray(rows)) allSeriesAcc.push(...rows);
      });
      setAllSeries(allSeriesAcc);
    } catch (e) {
      setError(e.message || 'Failed to load reference data');
    }
  };
  useEffect(() => { loadRefData(); }, []);

  // Colors + RAM + Storage master options — the global palettes/labels. Colors +
  // RAM/storage now live INLINE on each model (model.colors / model.ramStorage);
  // these master lists are kept only to resolve a colour name → swatch hex and to
  // find-or-create the palette rows the mobile pickers resolve labels against.
  const loadOptionSets = async () => {
    const [cols, rams, stos] = await Promise.all([
      masterApi.get('/master/colors').catch(() => []),
      masterApi.get('/master/ram-options').catch(() => []),
      masterApi.get('/master/storage-options').catch(() => []),
    ]);
    setAllColors(Array.isArray(cols) ? cols : cols?.content ?? []);
    setRamOptions(Array.isArray(rams) ? rams : rams?.content ?? []);
    setStorageOptions(Array.isArray(stos) ? stos : stos?.content ?? []);
  };
  useEffect(() => { loadOptionSets(); }, []);

  // Cascading filter helpers
  const brandsForCategory = useMemo(() => {
    if (!filterCategory) return brands;
    const allowed = new Set(mappings.filter((m) => m.categoryId === filterCategory).map((m) => m.brandId));
    return brands.filter((b) => allowed.has(b.id));
  }, [filterCategory, brands, mappings]);

  const seriesForFilter = useMemo(() => {
    if (filterCategory && filterBrand) {
      const id = resolveMappingId(filterCategory, filterBrand);
      return id ? allSeries.filter((s) => s.categoryBrandId === id) : [];
    }
    if (filterCategory) {
      const ids = new Set(mappings.filter((m) => m.categoryId === filterCategory).map((m) => m.id));
      return allSeries.filter((s) => ids.has(s.categoryBrandId));
    }
    if (filterBrand) {
      const ids = new Set(mappings.filter((m) => m.brandId === filterBrand).map((m) => m.id));
      return allSeries.filter((s) => ids.has(s.categoryBrandId));
    }
    return allSeries;
  }, [allSeries, mappings, filterCategory, filterBrand]);

  useEffect(() => {
    if (filterBrand && !brandsForCategory.some((b) => b.id === filterBrand)) setFilterBrand('');
  }, [filterBrand, brandsForCategory]);
  useEffect(() => {
    if (filterSeries && !seriesForFilter.some((s) => s.id === filterSeries)) setFilterSeries('');
  }, [filterSeries, seriesForFilter]);

  // ---- Models list
  // With no brand/series chosen this lists EVERY model, which means one
  // /master/brands/{id}/models request per brand — master-data has no list-all
  // endpoint. Whole sweep is ~8.8 MB / ~3s and returns all 1397 models.
  //
  // It used to be ~206 MB, because 103 models stored their image inline as a
  // multi-MB base64 data URI: Nokia's list alone was 83 MB, which the service
  // (JVM capped at -Xmx384m) could not serialize at all, so those brands were
  // simply unlistable and every sweep OOM-killed the service. Those images were
  // resized/re-encoded in place on 2026-08-02 (198 MB -> 7.9 MB).
  //
  // The resilience below — one brand at a time, wait for the service if one
  // fails, series-by-series retry, keep partial results — is what made the page
  // survive that. It is cheap when nothing fails, so it stays as a guard against
  // oversized images being uploaded again.
  const seriesByBrandRef = useRef(new Map());
  useEffect(() => {
    const brandOfMapping = new Map(mappings.map((m) => [m.id, m.brandId]));
    const idx = new Map();
    for (const s of allSeries) {
      const bId = brandOfMapping.get(s.categoryBrandId);
      if (!bId) continue;
      if (!idx.has(bId)) idx.set(bId, []);
      idx.get(bId).push(s);
    }
    seriesByBrandRef.current = idx;
  }, [mappings, allSeries]);

  /**
   * One request for the whole catalogue.
   *
   * This used to fetch models one brand at a time — 55 sequential round-trips —
   * wrapped in retry, a wait-for-restart poll and a second pass, because a single
   * oversized brand could OOM master-data and take whatever was in flight with it
   * (Nokia alone answered 83 MB).
   *
   * That weight was base64, not rows: 82% of the payload came from a handful of
   * models still holding a data: URI. GET /master/models returns a projection with
   * those stripped — the full 1397 models measure ~0.7 MB and land in about a
   * second — so none of that machinery is needed any more.
   *
   * Rows still holding an inline image come back as inlineImage:true with a null
   * imageUrl; the table shows a placeholder for them rather than a broken thumbnail.
   */
  const loadModels = async () => {
    setLoading(true);
    setError('');
    try {
      const params = filterSeries
        ? `?seriesId=${encodeURIComponent(filterSeries)}`
        : filterBrand
          ? `?brandId=${encodeURIComponent(filterBrand)}`
          : '';
      const rows = await masterApi.get(`/master/models${params}`);
      setList(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e.body?.message || e.message || 'Failed to load');
      setList([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadModels(); }, [filterBrand, filterSeries, brands]);

  // Category is a pure client-side narrowing of the rows already fetched — a
  // model's category comes from its series → mapping. Kept out of loadModels so
  // changing the category doesn't refetch.
  const visibleList = useMemo(() => {
    if (!filterCategory) return list;
    const categoryOfMapping = new Map(mappings.map((m) => [m.id, m.categoryId]));
    const seriesById = new Map(allSeries.map((s) => [s.id, s]));
    return list.filter((m) => {
      const s = seriesById.get(m.seriesId);
      const cid = s ? categoryOfMapping.get(s.categoryBrandId) : m.categoryId;
      return !cid || cid === filterCategory; // keep unresolvable rows rather than hiding them
    });
  }, [list, filterCategory, mappings, allSeries]);

  // ---- Form
  const formBrandOptions = useMemo(() => {
    if (!formCategoryId) return brands;
    const allowed = new Set(mappings.filter((m) => m.categoryId === formCategoryId).map((m) => m.brandId));
    return brands.filter((b) => allowed.has(b.id));
  }, [formCategoryId, brands, mappings]);

  const formSeriesOptions = useMemo(() => {
    if (!formCategoryId || !formBrandId) return [];
    const mid = resolveMappingId(formCategoryId, formBrandId);
    return mid ? allSeries.filter((s) => s.categoryBrandId === mid) : [];
  }, [allSeries, formCategoryId, formBrandId, mappings]);

  const openCreate = () => {
    setModal({ type: 'create' });
    setFormCategoryId(filterCategory || categories[0]?.id || '');
    setFormBrandId(filterBrand || '');
    setFormSeriesId(filterSeries || '');
    setName('');
    setModelNumberInput(''); setModelNumbers([]);
    setImageUrl('');
    setImageFile(null);
    setColorImageUrls({}); setColorImageFiles({});
    setCategory('DEVICE');
    setSellActive(true);
    setColorInput(''); setColorChips([]);
    setSpecInput(''); setSpecChips([]);
    setStorageMode('RAM_STORAGE');
  };

  const openEdit = (item) => {
    setModal({ type: 'edit', item });
    // Reverse-resolve from seriesId → mapping → (category, brand)
    const s = allSeries.find((x) => x.id === item.seriesId);
    const map = s ? mappings.find((m) => m.id === s.categoryBrandId) : null;
    setFormCategoryId(map?.categoryId || item.categoryId || '');
    setFormBrandId(map?.brandId || item.brandId || '');
    setFormSeriesId(item.seriesId || '');
    setName(item.name || '');
    setModelNumberInput(''); setModelNumbers(asNumberList(item.modelNumber));
    setImageUrl(item.imageUrl || '');
    // A file left staged from a previous modal would otherwise be uploaded onto THIS
    // record on save — and now also delete that record's current image.
    setImageFile(null);
    setColorImageUrls(toColorImagesPayload(item.colors, Object.fromEntries(
      (Array.isArray(item.colors) ? item.colors : []).map((c) => [c, imageForColor(item, c)]),
    )));
    setColorImageFiles({});
    setCategory(item.category || 'DEVICE');
    setSellActive(item.sellActive !== false);
    // Colours + RAM/storage come straight off the model's inline JSON arrays.
    setColorInput(''); setSpecInput('');
    const cChips = (Array.isArray(item.colors) ? item.colors : []).map((name) => {
      const col = allColors.find((c) => c.name?.toLowerCase() === String(name).toLowerCase());
      return { name, hex: col?.hexCode || guessColorHex(name), colorId: col?.id };
    });
    const rawSpecs = Array.isArray(item.ramStorage) ? item.ramStorage : [];
    // A model is storage-only when it has specs and none of them use the "+" combo.
    const modeIsStorageOnly = rawSpecs.length > 0 && rawSpecs.every((l) => !String(l).includes('+'));
    setStorageMode(modeIsStorageOnly ? 'STORAGE_ONLY' : 'RAM_STORAGE');
    const sChips = rawSpecs
      .map((label) => {
        if (String(label).includes('+')) {
          const spec = parseSpec(label);
          if (spec) {
            const ram = ramOptions.find((r) => r.valueGb === spec.ramValue);
            const sto = storageOptions.find((s) => s.valueGb === spec.storageValue);
            return { ...spec, ramId: ram?.id, storageId: sto?.id };
          }
        } else {
          const st = parseStorageOnly(label);
          if (st) {
            const sto = storageOptions.find((s) => s.valueGb === st.storageValue);
            return { ...st, storageId: sto?.id };
          }
        }
        // Keep an unparseable stored label visible rather than silently dropping it.
        return { label: String(label), label_raw: true };
      })
      .filter(Boolean);
    setColorChips(cChips); setSpecChips(sChips);
  };
  // Drop the staged file on the way OUT as well as on the way in. openCreate and
  // openEdit both clear it, but that only holds while every future entry point
  // remembers to — and the cost of forgetting is silent: the previous model's
  // image is uploaded onto this record on save, and the record's own image is
  // deleted from the bucket to make room for it. Clearing here also releases the
  // File so a long admin session does not pin every image it has touched.
  const closeModal = () => { setModal(null); setImageFile(null); setColorImageFiles({}); };

  // ---- Color chips ----
  const addColorChips = () => {
    const parts = splitNames(colorInput);
    if (!parts.length) return;
    // A color picked in the input's preview swatch overrides the auto-guess — but only
    // for a single typed name (a comma-list has no single swatch to apply it to).
    const override = parts.length === 1 ? pendingHex : null;
    setColorChips((prev) => {
      const next = [...prev];
      for (const p of parts) {
        if (next.some((x) => x.name.toLowerCase() === p.toLowerCase())) continue;
        const existing = allColors.find((c) => c.name.toLowerCase() === p.toLowerCase());
        if (existing) {
          next.push(override
            ? { name: existing.name, hex: override, colorId: existing.id, hexTouched: true }
            : { name: existing.name, hex: existing.hexCode || guessColorHex(existing.name), colorId: existing.id });
        } else {
          next.push({ name: p, hex: override || guessColorHex(p) });
        }
      }
      return next;
    });
    setColorInput('');
    setPendingHex(null);
  };
  const removeColorChip = (idx) => setColorChips((prev) => prev.filter((_, i) => i !== idx));
  // Fine-tune a swatch to match the real product color.
  const updateColorHex = (idx, hex) => setColorChips((prev) => prev.map((c, i) => (i === idx ? { ...c, hex, hexTouched: true } : c)));

  // ---- Model number chips ----
  const addModelNumberChips = () => {
    const parts = splitNumbers(modelNumberInput);
    if (!parts.length) return;
    setModelNumbers((prev) => {
      const next = [...prev];
      for (const p of parts) {
        if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
      }
      return next;
    });
    setModelNumberInput('');
  };
  const removeModelNumberChip = (idx) => setModelNumbers((prev) => prev.filter((_, i) => i !== idx));

  // ---- RAM + Storage chips ----
  const addSpecChips = () => {
    const parts = splitNames(specInput);
    if (!parts.length) return;
    let bad = false;
    setSpecChips((prev) => {
      const next = [...prev];
      for (const p of parts) {
        if (storageMode === 'STORAGE_ONLY') {
          const st = parseStorageOnly(p);
          if (!st) { bad = true; continue; }
          const key = `s:${st.storageValue}`;
          if (next.some((x) => x.storageOnly && `s:${x.storageValue}` === key)) continue;
          const sto = storageOptions.find((s) => s.valueGb === st.storageValue);
          next.push({ ...st, storageId: sto?.id });
        } else {
          const spec = parseSpec(p);
          if (!spec) { bad = true; continue; }
          const key = `${spec.ramValue}+${spec.storageValue}`;
          if (next.some((x) => !x.storageOnly && `${x.ramValue}+${x.storageValue}` === key)) continue;
          const ram = ramOptions.find((r) => r.valueGb === spec.ramValue);
          const sto = storageOptions.find((s) => s.valueGb === spec.storageValue);
          next.push({ ...spec, ramId: ram?.id, storageId: sto?.id });
        }
      }
      return next;
    });
    if (bad) notifyError(storageMode === 'STORAGE_ONLY'
      ? 'Use a storage size, e.g. 128 GB.'
      : 'Use the format "RAM + Storage", e.g. 6 GB + 128 GB.');
    setSpecInput('');
  };
  const removeSpecChip = (idx) => setSpecChips((prev) => prev.filter((_, i) => i !== idx));

  // Switching storage type drops chips of the other shape so a model never mixes
  // "6 GB + 128 GB" combos with plain "128 GB" sizes.
  const changeStorageMode = (mode) => {
    setStorageMode(mode);
    setSpecInput('');
    setSpecChips((prev) => prev.filter((c) => (mode === 'STORAGE_ONLY' ? c.storageOnly : !c.storageOnly)));
  };

  // Colours + RAM/storage are stored inline on the model as name/label strings.
  // The global master_colors / ram / storage rows are still kept in sync so the
  // swatch hex persists and the mobile pickers can resolve a label → option UUID.
  // No per-model master_model_variant rows are created any more.
  const persistPaletteFor = async (colors, specs) => {
    // Track what this run has already created: two specs can share a size
    // ("8 GB + 128 GB" and "8 GB + 256 GB" both need 8 GB RAM), and the state
    // arrays below are a snapshot that does not grow as we POST. Without this a
    // bulk import registers the same option a dozen times.
    const madeColors = new Set();
    const madeRam = new Set();
    const madeStorage = new Set();

    for (const c of colors) {
      const key = c.name.toLowerCase();
      if (madeColors.has(key)) continue;
      const existing = allColors.find((x) => x.name?.toLowerCase() === key);
      if (!existing) {
        madeColors.add(key);
        await masterApi.post('/master/colors', { name: c.name, hexCode: c.hex }).catch(() => {});
      } else if (c.hexTouched) {
        // Admin fine-tuned an existing colour's swatch — persist the corrected hex.
        await masterApi.put(`/master/colors/${existing.id}`, { name: existing.name, hexCode: c.hex }).catch(() => {});
      }
    }
    for (const s of specs) {
      if (s.ramValue && !madeRam.has(s.ramValue) && !ramOptions.some((r) => r.valueGb === s.ramValue)) {
        madeRam.add(s.ramValue);
        await masterApi.post('/master/ram-options', { valueGb: s.ramValue, label: s.ramLabel || `${s.ramValue} GB` }).catch(() => {});
      }
      if (s.storageValue && !madeStorage.has(s.storageValue) && !storageOptions.some((r) => r.valueGb === s.storageValue)) {
        madeStorage.add(s.storageValue);
        await masterApi.post('/master/storage-options', { valueGb: s.storageValue, label: s.storageLabel || `${s.storageValue} GB` }).catch(() => {});
      }
    }
    loadOptionSets();
  };

  const persistPalette = () => persistPaletteFor(colorChips, specChips);

  // Same registration, driven by the plain name/label strings an imported sheet
  // carries rather than by the modal's chip objects — so a colour that only ever
  // arrived through Excel still gets a swatch and a resolvable option row.
  const syncPaletteFromLabels = (colorNames, specLabels) => persistPaletteFor(
    colorNames.map((name) => ({ name, hex: guessColorHex(name) })),
    specLabels.map((label) => (label.includes('+') ? parseSpec(label) : parseStorageOnly(label))).filter(Boolean),
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !formBrandId) return;
    setSubmitting(true);
    try {
      // Fold any code still sitting in the input (user typed but didn't press Enter).
      const allModelNumbers = [...modelNumbers];
      for (const p of splitNumbers(modelNumberInput)) {
        if (!allModelNumbers.some((x) => x.toLowerCase() === p.toLowerCase())) allModelNumbers.push(p);
      }
      const body = {
        brandId: formBrandId,
        categoryId: formCategoryId || null,
        seriesId: formSeriesId || null,
        name: name.trim(),
        modelNumber: allModelNumbers,
        // Slug is no longer edited in the UI; keep it auto-generated so the
        // (series_id, slug) unique constraint and legacy consumers keep working.
        slug: slugify(name),
        imageUrl: imageUrl.trim() || null,
        category: category || null,
        sellActive,
        // Inline options: colours as names, RAM+storage as "6 GB + 128 GB" labels.
        colors: colorChips.map((c) => c.name),
        ramStorage: specChips.map((s) => s.label),
      };

      // Per-colour photos go through the generic media upload (not id-scoped), so
      // they can be uploaded before the save and sent with it. Filed beside the
      // model's main image when it has one.
      const colorUrls = { ...colorImageUrls };
      const stagedColors = Object.entries(colorImageFiles).filter(([c, f]) => f && colorChips.some((x) => x.name === c));
      if (stagedColors.length) {
        const folderMatch = String(imageUrl || '').match(/^https?:\/\/[^/]+\/(.+)\/[^/]+$/);
        const folder = folderMatch ? `${folderMatch[1]}/colors` : 'master/model-colors';
        for (const [c, file] of stagedColors) {
          colorUrls[c] = await uploadMedia(file, folder);
        }
      }
      body.colorImages = toColorImagesPayload(body.colors, colorUrls);
      const sentColorImages = Object.keys(body.colorImages).length > 0;

      // Save first, then upload. The image endpoint is id-scoped because the S3 key
      // comes from the model's stored taxonomy, not from anything the client sends.
      let modelId = modal.type === 'create' ? null : modal.item.id;
      let saved;
      if (modal.type === 'create') {
        saved = await masterApi.post('/master/models', body);
        modelId = saved?.id || null;
      } else {
        saved = await masterApi.put(`/master/models/${modal.item.id}`, body);
      }
      // The master-data API only keeps colour photos once it has a colorImages
      // field; until then it drops them silently. Say so instead of pretending.
      if (sentColorImages && saved && typeof saved === 'object' && !('colorImages' in saved)) {
        notifyError('Colour photos were uploaded, but the server did not save them yet. The master-data API needs the colorImages field (see src/lib/colorImages.js).');
      }
      if (imageFile && modelId) {
        const uploaded = await replaceModelImage(modelId, imageFile);
        const notice = imageReplacementNotice(uploaded, 'Model image');
        if (notice) notifySuccess(notice);
      }
      await persistPalette();
      closeModal();
      loadModels();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Flip a model's Sell-flow visibility from the table switch. Optimistic —
  // update the row immediately, revert if the PATCH fails.
  const toggleSellActive = async (row) => {
    const next = row.sellActive === false; // currently off → turn on, else turn off
    setList((prev) => prev.map((m) => (m.id === row.id ? { ...m, sellActive: next } : m)));
    try {
      await masterApi.patch(`/master/models/${row.id}/sell-active`, { sellActive: next });
    } catch (e) {
      setList((prev) => prev.map((m) => (m.id === row.id ? { ...m, sellActive: !next } : m)));
      notifyError(e.body?.message || e.message || 'Failed to update Sell Active');
    }
  };

  const handleDelete = async (row) => {
    if (!confirm('Delete this model?')) return;
    try {
      await masterApi.delete(`/master/models/${row.id}`);
      loadModels();
    } catch (e) {
      notifyError(e.body?.message || e.message || 'Delete failed');
    }
  };

  const nameById = {
    cat: (id) => categories.find((c) => c.id === id)?.name,
    brand: (id) => brands.find((b) => b.id === id)?.name,
    series: (id) => allSeries.find((s) => s.id === id)?.name,
  };

  // modelId → its distinct colors ({name, hex}) and RAM+Storage labels, read
  // straight off each model's inline colors / ramStorage JSON arrays. The colour
  // swatch hex is resolved from the master palette by name, falling back to the
  // auto-detected guess.
  const variantsByModel = useMemo(() => {
    const colorByName = new Map(allColors.map((c) => [String(c.name).toLowerCase(), c]));
    const map = new Map();
    for (const m of list) {
      if (!m.id) continue;
      const colors = (Array.isArray(m.colors) ? m.colors : []).map((name) => {
        const col = colorByName.get(String(name).toLowerCase());
        return { name, hex: col?.hexCode || guessColorHex(name) };
      });
      const specs = Array.isArray(m.ramStorage) ? m.ramStorage : [];
      map.set(m.id, { colors, specs });
    }
    return map;
  }, [list, allColors]);

  // Resolve a model's category name via series → mapping, falling back to categoryId.
  const categoryNameOf = (r) => {
    const s = allSeries.find((x) => x.id === r.seriesId);
    const map = s ? mappings.find((m) => m.id === s.categoryBrandId) : null;
    return nameById.cat(map?.categoryId || r.categoryId);
  };

  // Name the download after whatever the three dropdowns are narrowed to, e.g.
  // ggfix-models-laptop-dell-alienware-2026-08-19.xlsx — so a folder of exports
  // taken over a few days is still tellable apart.
  const exportFilename = () => {
    const parts = ['ggfix-models'];
    for (const label of [nameById.cat(filterCategory), nameById.brand(filterBrand), nameById.series(filterSeries)]) {
      if (label) parts.push(slugify(label));
    }
    parts.push(new Date().toISOString().slice(0, 10));
    return parts.join('-');
  };

  useEffect(() => {
    if (!exportMenu) return undefined;
    const onDown = (e) => { if (!exportMenuRef.current?.contains(e.target)) setExportMenu(false); };
    const onKey = (e) => { if (e.key === 'Escape') setExportMenu(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [exportMenu]);

  /**
   * Download the rows the filters currently select — not the whole catalogue.
   * What you see in the table is what lands in the sheet, which is what makes the
   * export → edit → import round-trip safe to do one brand at a time.
   */
  const runExport = async (build) => {
    setExportMenu(false);
    setExporting(true);
    try {
      await build();
    } catch (e) {
      notifyError(e.message || 'Could not build the Excel file.');
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => visibleList.length && runExport(() => exportModelsWorkbook(
    visibleList,
    { categoryOf: categoryNameOf, brand: nameById.brand, series: nameById.series },
    exportFilename(),
  ));

  // The same workbook with no rows under the header — the sheet to fill in when the
  // models being added do not exist yet, so there is nothing to export and edit.
  // The live taxonomy goes with it so Category / Brand / Series are real Excel
  // dropdowns rather than free text that only fails at import time.
  const handleExportEmpty = () => runExport(() => {
    // Send each series WITH its category and brand, not just its name. A flat
    // name list makes the template offer every series on every row — a Laptop /
    // Apple row was being offered Lenovo's ThinkPad series — and leaves the user
    // scrolling hundreds of entries. With the pair, the template cascades the
    // Series dropdown off the Category + Brand already chosen on that row.
    const categoryOfMapping = new Map(mappings.map((m) => [m.id, m.categoryId]));
    const brandOfMapping = new Map(mappings.map((m) => [m.id, m.brandId]));
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const brandNameById = new Map(brands.map((b) => [b.id, b.name]));
    return exportTemplateWorkbook({
      categories: categories.map((c) => c.name),
      // One entry per category-brand MAPPING, not per brand: the template
      // cascades Brand off Category exactly like the filter bar above, so a
      // Laptop row offers the 14 laptop brands rather than all 55.
      brands: mappings.map((m) => ({
        name: brandNameById.get(m.brandId) || '',
        category: categoryNameById.get(m.categoryId) || '',
      })).filter((b) => b.name && b.category),
      series: allSeries.map((x) => ({
        name: x.name,
        category: categoryNameById.get(categoryOfMapping.get(x.categoryBrandId)) || '',
        brand: brandNameById.get(brandOfMapping.get(x.categoryBrandId)) || '',
      })),
    });
  });

  const columns = [
    {
      key: 'category',
      label: 'Category',
      search: (r) => categoryNameOf(r),
      render: (r) => categoryNameOf(r) || '—',
    },
    { key: 'brand', label: 'Brand', search: (r) => nameById.brand(r.brandId), render: (r) => nameById.brand(r.brandId) || '—' },
    { key: 'series', label: 'Series', search: (r) => nameById.series(r.seriesId), render: (r) => nameById.series(r.seriesId) || '—' },
    { key: 'name', label: 'Model' },
    {
      key: 'modelNumber',
      label: 'Model number',
      search: (r) => asNumberList(r.modelNumber).join(' '),
      render: (r) => {
        const ns = asNumberList(r.modelNumber);
        if (!ns.length) return '—';
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {ns.map((n, i) => (
              <span key={i} className="inline-block rounded bg-admin-dark border border-admin-border px-1.5 py-0.5 text-[11px] text-slate-700 whitespace-nowrap">{n}</span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'colors',
      label: 'Colors',
      search: (r) => (variantsByModel.get(r.id)?.colors || []).map((c) => c.name).join(' '),
      render: (r) => {
        const cs = variantsByModel.get(r.id)?.colors || [];
        if (!cs.length) return '—';
        return (
          <div className="flex flex-wrap items-center gap-1.5 max-w-[220px]">
            {cs.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs text-slate-700" title={c.name}>
                <span className="inline-block h-3 w-3 rounded-full border border-admin-border shrink-0" style={{ backgroundColor: c.hex }} />
                {c.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'specs',
      label: 'RAM / Storage',
      search: (r) => (variantsByModel.get(r.id)?.specs || []).join(' '),
      render: (r) => {
        const ss = variantsByModel.get(r.id)?.specs || [];
        if (!ss.length) return '—';
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {ss.map((s, i) => (
              <span key={i} className="inline-block rounded bg-admin-dark border border-admin-border px-1.5 py-0.5 text-[11px] text-slate-700 whitespace-nowrap">{s}</span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'imageUrl',
      label: 'Image',
      // inlineImage means the row still holds a base64 data URI, which the list
      // endpoint strips for weight. Flag it rather than showing '—', so it reads as
      // "needs re-uploading to S3" instead of "has no image".
      render: (r) => (r.imageUrl
        ? <img src={r.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
        : r.inlineImage
          ? <span title="Stored inline as a data URI — re-upload to move it to cdn.neargfix.com"
                  className="text-[11px] font-semibold text-amber-600">inline</span>
          : '—'),
    },
    {
      key: 'sellActive',
      label: 'Sell Active',
      render: (r) => {
        const on = r.sellActive !== false;
        return (
          <ToggleSwitch
            on={on}
            title={on ? 'Shown in the Sell flow — click to hide' : 'Hidden from the Sell flow — click to show'}
            onClick={() => toggleSellActive(r)}
          />
        );
      },
    },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Models</h1>
        <div className="relative flex flex-wrap items-center gap-3">
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full sm:w-auto rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm">
            <option value="">All categories</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}
            className="w-full sm:w-auto rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm">
            <option value="">All brands</option>
            {brandsForCategory.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
          <select value={filterSeries} onChange={(e) => setFilterSeries(e.target.value)}
            className="w-full sm:w-auto rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-slate-800 text-sm">
            <option value="">All series</option>
            {seriesForFilter.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
          <button type="button" onClick={loadModels} disabled={loading}
            title="Reload models"
            className="inline-flex items-center gap-1.5 rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {/* Export is a menu rather than a single button: the blank format has to stay
              reachable when the filters match nothing, which is exactly when there are
              no rows to export and a plain button would be disabled. */}
          <div className="xl:relative" ref={exportMenuRef}>
            <button type="button" onClick={() => setExportMenu((v) => !v)} disabled={exporting}
              aria-haspopup="menu" aria-expanded={exportMenu}
              className="inline-flex items-center gap-1.5 rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark disabled:opacity-50">
              <Download size={16} />
              {exporting ? 'Exporting…' : 'Export'}
              <ChevronDown size={14} className={exportMenu ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {exportMenu && (
              <div role="menu"
                className="absolute right-0 z-20 mt-1 w-72 max-w-full xl:max-w-none overflow-hidden rounded-lg border border-admin-border bg-admin-card shadow-lg">
                <button type="button" role="menuitem" onClick={handleExport} disabled={loading || !visibleList.length}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-admin-dark disabled:opacity-50 disabled:hover:bg-transparent">
                  <Download size={16} className="mt-0.5 shrink-0 text-slate-500" />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">
                      Listed models{visibleList.length ? ` (${visibleList.length})` : ''}
                    </span>
                    <span className="block text-xs text-admin-muted">
                      {visibleList.length
                        ? 'The rows the filters above select, with their data.'
                        : 'Nothing matches the current filters.'}
                    </span>
                  </span>
                </button>
                <div className="border-t border-admin-border" />
                <button type="button" role="menuitem" onClick={handleExportEmpty}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-admin-dark">
                  <FileSpreadsheet size={16} className="mt-0.5 shrink-0 text-slate-500" />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">Empty format</span>
                    <span className="block text-xs text-admin-muted">
                      Headers only, with Category / Brand / Series dropdowns. Fill it in, then Import.
                    </span>
                  </span>
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setImportOpen(true)} disabled={!brands.length}
            title="Upload a filled-in Excel file to create or update models in bulk"
            className="inline-flex items-center gap-1.5 rounded-lg bg-admin-card border border-admin-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-admin-dark disabled:opacity-50">
            <Upload size={16} />
            Import
          </button>
          <button type="button" onClick={openCreate} disabled={!brands.length}
            className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            Add model
          </button>
        </div>
      </div>
      <p className="text-admin-muted text-sm mb-4">
        Models live under a series — e.g. <span className="text-slate-600">Mobile + Vivo → Y Series → Vivo Y20</span>.
        {' '}Export writes the rows the filters above select; Import reads that same sheet back, creating new models and
        updating the ones it recognises.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-admin-muted">
          Loading…
        </p>
      ) : (
        <DataTable columns={columns} rows={visibleList} onEdit={openEdit} onDelete={handleDelete} emptyMessage="No models." />
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-2xl flex flex-col max-h-[90dvh] rounded-xl bg-admin-card border border-admin-border shadow-xl">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-admin-border shrink-0">
              <h2 className="text-lg font-medium text-slate-900">
                {modal.type === 'create' ? 'New model' : 'Edit model'}
              </h2>
              <button type="button" onClick={closeModal} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Category</label>
                  <select value={formCategoryId}
                    onChange={(e) => { setFormCategoryId(e.target.value); setFormBrandId(''); setFormSeriesId(''); }}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900" required>
                    <option value="">Select</option>
                    {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Brand</label>
                  <select value={formBrandId}
                    onChange={(e) => { setFormBrandId(e.target.value); setFormSeriesId(''); }}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    required disabled={!formCategoryId}>
                    <option value="">Select</option>
                    {formBrandOptions.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Series</label>
                  <select value={formSeriesId} onChange={(e) => setFormSeriesId(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    disabled={!formBrandId}>
                    <option value="">— None —</option>
                    {formSeriesOptions.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Model name</label>
                  <input type="text" value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    placeholder="e.g. Vivo Y20" required />
                </div>
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Model number</label>
                  <input type="text" value={modelNumberInput}
                    onChange={(e) => setModelNumberInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModelNumberChips(); } }}
                    onBlur={addModelNumberChips}
                    className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    placeholder="e.g. MZB0L8AIN — press Enter" />
                  {modelNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {modelNumbers.map((n, i) => (
                        <span key={`${n}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-admin-dark border border-admin-border px-3 py-1 text-xs text-slate-800">
                          {n}
                          <button type="button" onClick={() => removeModelNumberChip(i)} className="text-slate-400 hover:text-slate-700">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-admin-muted">Manufacturer model number(s) — add one at a time; paste several separated by <span className="text-slate-600">/ , ;</span> to split them.</p>
                </div>
              </div>

              {/* Sell Active — controls whether this model appears in the mobile Sell flow */}
              <div className="flex items-center justify-between gap-3 rounded-lg bg-admin-dark border border-admin-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-900">Sell Active</p>
                  <p className="text-xs text-admin-muted">When on, this model is shown in the customer Sell / trade-in flow.</p>
                </div>
                <ToggleSwitch
                  on={sellActive}
                  title={sellActive ? 'Shown in the Sell flow' : 'Hidden from the Sell flow'}
                  onClick={() => setSellActive((v) => !v)}
                />
              </div>

              {/* Colors — type a name, swatch auto-detected; each becomes a color-only variant row */}
              <div>
                <label className="block text-sm text-admin-muted mb-1">Colors</label>
                <div className="flex items-center gap-2">
                  <input type="text" value={colorInput}
                    onChange={(e) => { setColorInput(e.target.value); setPendingHex(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColorChips(); } }}
                    onBlur={(e) => { if (e.relatedTarget?.dataset?.swatch) return; addColorChips(); }}
                    className="min-w-0 flex-1 rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                    placeholder="Type ONE color, e.g. Passion Red — then press Enter" />
                  {colorInput.trim() && !colorInput.includes(',') && (
                    <label className="relative inline-flex h-10 w-10 shrink-0" title="Click to pick the exact color, then press Enter">
                      <span className="inline-block h-10 w-10 rounded-lg border border-admin-border" style={{ backgroundColor: pendingHex || guessColorHex(colorInput) }} />
                      <input type="color" data-swatch="1" value={toColorInput(pendingHex || guessColorHex(colorInput))}
                        onChange={(e) => setPendingHex(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColorChips(); } }}
                        onBlur={() => addColorChips()}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                  )}
                </div>
                {colorChips.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {colorChips.map((c, i) => (
                      <span key={`${c.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-admin-dark border border-admin-border px-3 py-1 text-xs text-slate-800">
                        <label className="relative inline-flex h-4 w-4" title="Click to fine-tune this color">
                          <span className="inline-block h-4 w-4 rounded-full border border-admin-border" style={{ backgroundColor: c.hex }} />
                          <input type="color" value={toColorInput(c.hex)} onChange={(e) => updateColorHex(i, e.target.value)}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                        </label>
                        {c.name}
                        <button type="button" onClick={() => removeColorChip(i)} className="text-slate-400 hover:text-slate-700">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-admin-muted">Add <span className="text-slate-600">one color at a time</span>: type the name → the swatch beside it shows the detected color → <span className="text-slate-600">click that swatch to pick/eyedrop the exact color</span> → press Enter. Repeat for the next color.</p>
              </div>

              {/* Colour photos — the website swaps to these when a customer picks the colour */}
              {colorChips.length > 0 && (
                <div>
                  <label className="block text-sm text-admin-muted mb-1">Colour photos <span className="text-slate-400">(optional)</span></label>
                  <ul className="space-y-2">
                    {colorChips.map((c) => (
                      <ColorPhotoRow
                        key={c.name}
                        name={c.name}
                        hex={c.hex}
                        url={colorImageUrls[c.name]}
                        file={colorImageFiles[c.name]}
                        onPick={(f) => setColorImageFiles((prev) => ({ ...prev, [c.name]: f }))}
                        onClear={() => {
                          setColorImageFiles((prev) => { const next = { ...prev }; delete next[c.name]; return next; });
                          setColorImageUrls((prev) => { const next = { ...prev }; delete next[c.name]; return next; });
                        }}
                      />
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-admin-muted">When a customer picks a colour, the website shows its photo. Colours without one show the model image below.</p>
                </div>
              )}

              {/* RAM + Storage (or Storage-only) variants — chips saved inline on the model */}
              <div>
                <label className="block text-sm text-admin-muted mb-1">
                  {storageMode === 'STORAGE_ONLY' ? 'Storage variants' : 'RAM + Storage variants'}
                </label>
                {/* Storage type toggle — RAM + Storage combos vs plain storage sizes */}
                <div className="inline-flex rounded-lg border border-admin-border overflow-hidden mb-2 text-sm">
                  <button type="button" onClick={() => changeStorageMode('RAM_STORAGE')}
                    className={`px-3 py-1.5 font-medium ${storageMode === 'RAM_STORAGE' ? 'bg-admin-accent text-white' : 'bg-admin-dark text-slate-700 hover:bg-admin-card'}`}>
                    RAM + Storage
                  </button>
                  <button type="button" onClick={() => changeStorageMode('STORAGE_ONLY')}
                    className={`px-3 py-1.5 font-medium border-l border-admin-border ${storageMode === 'STORAGE_ONLY' ? 'bg-admin-accent text-white' : 'bg-admin-dark text-slate-700 hover:bg-admin-card'}`}>
                    Storage only
                  </button>
                </div>
                <input type="text" value={specInput} onChange={(e) => setSpecInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecChips(); } }}
                  onBlur={addSpecChips}
                  className="w-full rounded-lg bg-admin-dark border border-admin-border px-3 py-2 text-slate-900"
                  placeholder={storageMode === 'STORAGE_ONLY'
                    ? '128 GB, 256 GB — comma-separated, press Enter'
                    : '4 GB + 128 GB, 6 GB + 128 GB — comma-separated, press Enter'} />
                {specChips.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {specChips.map((s, i) => (
                      <span key={`${s.label}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-admin-accent/20 text-admin-accent px-3 py-1 text-xs">
                        {s.label}
                        <button type="button" onClick={() => removeSpecChip(i)} className="text-admin-accent/80 hover:text-slate-700">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-admin-muted">
                  {storageMode === 'STORAGE_ONLY'
                    ? 'Format: Storage only (e.g. 128 GB) — for devices sold by storage size, without a RAM option.'
                    : 'Format: RAM + Storage (e.g. 6 GB + 128 GB).'}
                </p>
              </div>

              <S3ImageUpload
                value={imageUrl}
                onFileChange={setImageFile}
                label="Model image"
                caption="Hero image for this model (e.g. Vivo Y20)"
              />
            </div>
            <div className="flex gap-2 justify-end px-4 sm:px-6 py-4 border-t border-admin-border shrink-0">
              <button type="button" onClick={closeModal} className="rounded-lg px-4 py-2 text-slate-600 hover:bg-admin-dark">Cancel</button>
              <button type="submit" disabled={submitting}
                className="rounded-lg bg-admin-accent px-4 py-2 text-white disabled:opacity-50">
                {submitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {importOpen && (
        <ModelsImportModal
          categories={categories}
          brands={brands}
          mappings={mappings}
          allSeries={allSeries}
          onSyncPalette={syncPaletteFromLabels}
          onClose={() => setImportOpen(false)}
          onImported={() => { loadRefData(); loadModels(); }}
        />
      )}
    </div>
  );
}
