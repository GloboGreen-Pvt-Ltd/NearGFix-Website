/**
 * Excel (.xlsx) export / import for the Master Data → Models catalogue.
 *
 * The whole feature is client-side: master-data already exposes every write the
 * import needs (POST/PUT /master/models, POST /master/series), and the admin is a
 * static export with no server routes of its own, so adding a bulk endpoint would
 * have meant a backend deploy for no extra capability.
 *
 * SheetJS is pulled in with a dynamic import so its ~800 KB never lands in the
 * Models page bundle — it is only fetched when Export or Import is actually used.
 */

// ---------------------------------------------------------------------------
// Sheet shape
// ---------------------------------------------------------------------------

/**
 * The workbook columns, in order.
 *
 * `key` is the internal field name; `header` is what appears in Excel. Import
 * matches headers loosely (see normaliseHeader / HEADER_ALIASES), so an admin can
 * rename "Model" to "Model Name" or drop columns they do not care about.
 */
export const MODEL_COLUMNS = [
  { key: 'id', header: 'ID', width: 38 },
  { key: 'categoryName', header: 'Category', width: 16 },
  { key: 'brandName', header: 'Brand', width: 16 },
  { key: 'seriesName', header: 'Series', width: 20 },
  { key: 'name', header: 'Model', width: 32 },
  { key: 'modelNumber', header: 'Model Number', width: 26 },
  { key: 'colors', header: 'Colors', width: 32 },
  { key: 'ramStorage', header: 'RAM / Storage', width: 32 },
  { key: 'imageUrl', header: 'Image URL', width: 48 },
  { key: 'sellActive', header: 'Sell Active', width: 11 },
];

/** The blank format omits ID — every row in it is a new model. */
export const EMPTY_FORMAT_COLUMNS = MODEL_COLUMNS.filter((c) => c.key !== 'id');

const SHEET_NAME = 'Models';
const GUIDE_SHEET = 'Format guide';
const LOOKUP_SHEET = 'Valid values';

// How far down the dropdowns reach. Excel applies a validation to a fixed range,
// so this is simply more rows than anyone will paste in at once.
const VALIDATED_ROWS = 2000;

// Header text → column key. Compared after normaliseHeader(), so only the
// squashed lowercase form is listed.
const HEADER_ALIASES = {
  id: 'id',
  modelid: 'id',
  uuid: 'id',
  category: 'categoryName',
  categoryname: 'categoryName',
  devicecategory: 'categoryName',
  brand: 'brandName',
  brandname: 'brandName',
  make: 'brandName',
  series: 'seriesName',
  seriesname: 'seriesName',
  model: 'name',
  modelname: 'name',
  name: 'name',
  modelnumber: 'modelNumber',
  modelno: 'modelNumber',
  modelnumbers: 'modelNumber',
  modelcode: 'modelNumber',
  colors: 'colors',
  colour: 'colors',
  colours: 'colors',
  color: 'colors',
  ramstorage: 'ramStorage',
  ram: 'ramStorage',
  storage: 'ramStorage',
  specs: 'ramStorage',
  ramandstorage: 'ramStorage',
  imageurl: 'imageUrl',
  image: 'imageUrl',
  imagelink: 'imageUrl',
  photo: 'imageUrl',
  sellactive: 'sellActive',
  sell: 'sellActive',
  sellflow: 'sellActive',
  active: 'sellActive',
};

/** "RAM / Storage " → "ramstorage", so header matching survives case, spacing and punctuation. */
const normaliseHeader = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------------------------------------------------------------------------
// Cell value helpers
// ---------------------------------------------------------------------------

const text = (v) => String(v ?? '').trim();

/** Model numbers split on / , ; and newlines — the same separators the edit form accepts. */
export const splitNumbers = (s) => text(s).split(/[/,;\n]/).map((x) => x.trim()).filter(Boolean);

/**
 * Colours and RAM/storage labels split on commas and newlines only: a spec label
 * legitimately contains "+" and spaces ("6 GB + 128 GB").
 */
export const splitLabels = (s) => text(s).split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

/**
 * Normalise a stored model_number to a clean array. It can be a real jsonb array,
 * a legacy slash-separated string, or JSON *text* left behind by a save that
 * happened while the column was still varchar.
 */
export const asNumberList = (mn) => {
  if (Array.isArray(mn)) return mn.map((x) => text(x)).filter(Boolean);
  if (mn == null) return [];
  let s = text(mn);
  if (!s) return [];
  if (s[0] === '[' || s[0] === '"') {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => text(x)).filter(Boolean);
      if (typeof parsed === 'string') s = parsed;
    } catch { /* not JSON — fall through to a plain split */ }
  }
  return splitNumbers(s).map((x) => x.replace(/^["[\]]+|["[\]]+$/g, '').trim()).filter(Boolean);
};

const TRUEY = new Set(['yes', 'y', 'true', '1', 'on', 'active', 'enabled', 'shown']);
const FALSEY = new Set(['no', 'n', 'false', '0', 'off', 'inactive', 'disabled', 'hidden']);

/**
 * Parse a Sell Active cell. Returns true/false, or null when the cell is blank or
 * says something we do not recognise — the caller decides what to do with that.
 */
export const parseBool = (v) => {
  const s = text(v).toLowerCase();
  if (!s) return null;
  if (TRUEY.has(s)) return true;
  if (FALSEY.has(s)) return false;
  return null;
};

export function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** One model -> its row of cell strings, for the given column set. */
function toSheetRow(m, names, columns) {
  const cells = {
    id: m.id || '',
    categoryName: names.categoryOf?.(m) || '',
    brandName: names.brand?.(m.brandId) || '',
    seriesName: names.series?.(m.seriesId) || '',
    name: m.name || '',
    modelNumber: asNumberList(m.modelNumber).join(' / '),
    colors: (Array.isArray(m.colors) ? m.colors : []).join(', '),
    ramStorage: (Array.isArray(m.ramStorage) ? m.ramStorage : []).join(', '),
    imageUrl: m.imageUrl || '',
    sellActive: m.sellActive === false ? 'No' : 'Yes',
  };
  return columns.map((c) => cells[c.key]);
}

/** What each column means, keyed so the guide can be built for either column set. */
const COLUMN_HELP = {
  id: ['Keep as-is', 'The database id of the model. Keep it to UPDATE that model; leave it blank to CREATE a new one.'],
  categoryName: ['Yes', 'Pick from the dropdown. Must already exist in Master Data \u2192 Categories.'],
  brandName: ['Yes', 'Pick from the dropdown. Must already exist and be mapped to the Category.'],
  seriesName: ['Optional', 'Fill Category and Brand first, and the dropdown then lists only the series for that pair. Or type a new name and tick "Create missing series" when importing.'],
  name: ['Yes', 'The model display name, e.g. Vivo Y20. Must be unique within its series.'],
  modelNumber: ['Optional', 'Manufacturer code(s). Separate several with / , or ;   e.g. V2043 / V2043BA'],
  colors: ['Optional', 'Comma-separated colour names, e.g. Midnight Black, Champagne Gold. Swatches are auto-detected on import.'],
  ramStorage: ['Optional', 'Comma-separated. Either "RAM + Storage" (6 GB + 128 GB) or storage only (128 GB) \u2014 do not mix both styles on one model.'],
  imageUrl: ['Optional', 'A media.ggfix.in URL. Image files cannot be uploaded from Excel \u2014 use the model edit form for that.'],
  sellActive: ['Optional', 'Yes / No. Controls whether the model appears in the customer Sell flow. Blank means Yes.'],
};

const EXAMPLE_ROW = {
  id: '',
  categoryName: 'Mobile',
  brandName: 'Vivo',
  seriesName: 'Y Series',
  name: 'Vivo Y20',
  modelNumber: 'V2043 / V2043BA',
  colors: 'Obsidian Black, Dawn White',
  ramStorage: '4 GB + 64 GB, 6 GB + 128 GB',
  imageUrl: '',
  sellActive: 'Yes',
};

function guideRows(columns) {
  const matching = columns.some((c) => c.key === 'id')
    ? 'Rows are matched by ID first; then by Series + Model; and if there is no Series column, by Brand + Model. Anything unmatched is created.'
    : 'This sheet has no ID column, so nothing in it can be mistaken for an edit of the wrong row: each row is matched by Series + Model, and created when it is new.';
  return [
    ['NearGFix \u2014 Models import / export format'],
    [],
    ['Column', 'Required', 'What to put in it'],
    ...columns.map((c) => [c.header, ...(COLUMN_HELP[c.key] || ['', ''])]),
    [],
    ['Notes'],
    ['A blank cell CLEARS that field. To leave a field untouched, delete the whole column instead.'],
    [matching],
    ['Do not rename the "Models" sheet \u2014 that is the one the importer reads.'],
    [],
    ['Example row'],
    columns.map((c) => c.header),
    columns.map((c) => EXAMPLE_ROW[c.key]),
  ];
}

/** SheetJS is ~800 KB; load it only when an export or import actually happens. */
async function sheetjs() {
  return import('xlsx');
}

function buildGuideSheet(XLSX, columns) {
  const guide = XLSX.utils.aoa_to_sheet(guideRows(columns));
  guide['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 110 }, ...columns.slice(3).map(() => ({ wch: 22 }))];
  return guide;
}

function buildModelsSheet(XLSX, columns, bodyRows) {
  const header = columns.map((c) => c.header);
  const ws = XLSX.utils.aoa_to_sheet([header, ...bodyRows]);
  ws['!cols'] = columns.map((c) => ({ wch: c.width }));
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: bodyRows.length, c: header.length - 1 } }),
  };
  return ws;
}

/**
 * Serialise, patch and download. The frozen header and the dropdowns are both
 * added after the fact \u2014 see xlsxPatch for why SheetJS can write neither.
 */
async function finish(XLSX, wb, filename, patch) {
  const raw = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  const { patchWorksheet, downloadBytes } = await import('./xlsxPatch.js');
  const out = await patchWorksheet(raw, 1, patch); // Models is always appended first
  downloadBytes(out, `${filename}.xlsx`);
}

/**
 * Build and download an .xlsx of the given models.
 *
 * @param rows     the models to write \u2014 already filtered by the caller
 * @param names    { categoryOf(model), brand(id), series(id) } name resolvers
 * @param filename download name, without the extension
 */
export async function exportModelsWorkbook(rows, names, filename) {
  const XLSX = await sheetjs();
  const body = rows.map((m) => toSheetRow(m, names, MODEL_COLUMNS));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildModelsSheet(XLSX, MODEL_COLUMNS, body), SHEET_NAME);
  XLSX.utils.book_append_sheet(wb, buildGuideSheet(XLSX, MODEL_COLUMNS), GUIDE_SHEET);
  await finish(XLSX, wb, filename, { freezeRows: 1 });
}

/**
 * The blank format: a header row, dropdowns on the taxonomy columns, nothing else.
 *
 * No ID column \u2014 this sheet exists to add models that do not exist yet, so the
 * column would always be empty and is only somewhere for a stray paste to land.
 *
 * No sample row either: a filled-in first line has to be deleted before the sheet
 * can be used, and forgetting to imports a phantom "Vivo Y20". The worked example
 * sits at the bottom of the Format guide instead, to be copied out on purpose.
 *
 * @param lists { categories, brands, series } \u2014 names to offer in the dropdowns
 */
export async function exportTemplateWorkbook(lists = {}) {
  const XLSX = await sheetjs();
  const cols = EMPTY_FORMAT_COLUMNS;

  // One lookup column per dropdown, deduped and sorted so the list can be navigated
  // by typing the first letters in Excel.
  const uniqueSorted = (xs) => [...new Set((xs || []).map((x) => text(x)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  // Brands may arrive as plain names or as { name, category } pairs; series as
  // plain names or { name, category, brand } triples. Given the structured form
  // the dropdown CASCADES off the columns already filled on that row - the same
  // rule the admin Models filter bar uses: Category -> the brands mapped to it ->
  // that Category+Brand pair's series. Flat lists were why a Laptop/Apple row was
  // offered every brand in the system and Lenovo's ThinkPad series.
  const structured = (xs, keyFields) => {
    const seen = new Map();
    for (const x of xs || []) {
      if (!x || typeof x !== 'object') continue;
      const name = text(x.name);
      const parts = keyFields.map((f) => text(x[f]));
      if (!name || parts.some((v) => !v)) continue;
      const key = parts.join('|');
      seen.set(`${key}::${name}`, { key, name });
    }
    // Sorted so every row sharing a key is CONTIGUOUS: OFFSET takes the first
    // match plus a height, so a split key would silently truncate the list.
    return [...seen.values()].sort((a, b) => a.key.localeCompare(b.key) || a.name.localeCompare(b.name));
  };
  const flatNames = (xs) => uniqueSorted((xs || []).map((x) => (x && typeof x === 'object' ? x.name : x)));

  const brandPairs = structured(lists.brands, ['category']);
  const seriesPairs = structured(lists.series, ['category', 'brand']);
  const cascadeBrands = brandPairs.length > 0;
  const cascadeSeries = seriesPairs.length > 0;

  const lookups = [
    {
      key: 'categoryName', header: 'Categories', values: flatNames(lists.categories), errorStyle: 'stop',
      title: 'Unknown category',
      message: 'Pick a category from the list. New categories have to be added in Master Data > Categories first.',
    },
    // Each of these stays a flat column only while there is nothing to cascade on.
    ...(cascadeBrands ? [] : [{
      key: 'brandName', header: 'Brands', values: flatNames(lists.brands), errorStyle: 'stop',
      title: 'Unknown brand',
      message: 'Pick a brand from the list. New brands have to be added in Master Data > Brands first.',
    }]),
    ...(cascadeSeries ? [] : [{
      // Warning rather than stop: a new series IS allowed, as long as the importer
      // is told to create it.
      key: 'seriesName', header: 'Series', values: flatNames(lists.series), errorStyle: 'warning',
      title: 'Series not in the list',
      message: 'This series does not exist yet. That is fine if you tick "Create missing series" when importing - otherwise pick one from the list.',
    }]),
    {
      key: 'sellActive', header: 'Sell Active', values: ['Yes', 'No'], errorStyle: 'stop',
      title: 'Yes or No',
      message: 'Sell Active accepts Yes or No.',
    },
  ].filter((l) => l.values.length);

  // Each cascade adds a key/value column pair to the right of the flat dropdowns.
  const blocks = [
    ...(cascadeBrands ? [{
      key: 'brandName', keyCols: ['categoryName'], pairs: brandPairs,
      keyHeader: 'Brand key (Category)', valueHeader: 'Brands by Category',
      errorStyle: 'stop',
      title: 'Unknown brand',
      message: 'Pick a brand from the list. It shows the brands mapped to this row\'s Category - set Category first. New brands and mappings are added in Master Data.',
    }] : []),
    ...(cascadeSeries ? [{
      key: 'seriesName', keyCols: ['categoryName', 'brandName'], pairs: seriesPairs,
      keyHeader: 'Series key (Category|Brand)', valueHeader: 'Series by Category + Brand',
      errorStyle: 'warning',
      title: 'Series not in the list',
      message: 'This series does not exist for that Category and Brand yet. That is fine if you tick "Create missing series" when importing - otherwise pick one from the list.',
    }] : []),
  ];

  // The lookup sheet is a plain grid: headers in row 1, values beneath. Short
  // columns are padded so the rows stay aligned.
  const depth = Math.max(0, ...lookups.map((l) => l.values.length), ...blocks.map((b) => b.pairs.length));
  const headerRow = [...lookups.map((l) => l.header), ...blocks.flatMap((b) => [b.keyHeader, b.valueHeader])];
  const lookupRows = [headerRow];
  for (let r = 0; r < depth; r++) {
    lookupRows.push([
      ...lookups.map((l) => l.values[r] ?? ''),
      ...blocks.flatMap((b) => [b.pairs[r]?.key ?? '', b.pairs[r]?.name ?? '']),
    ]);
  }
  const lookupSheet = XLSX.utils.aoa_to_sheet(lookupRows);
  lookupSheet['!cols'] = headerRow.map((_, i) => ({ wch: i < lookups.length ? 24 : 30 }));
  // Ctrl+F and the filter buttons on this sheet are how you search the full list
  // in Excel builds whose dropdown has no search box (anything before 365).
  lookupSheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: depth, c: headerRow.length - 1 } }),
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildModelsSheet(XLSX, cols, []), SHEET_NAME);
  XLSX.utils.book_append_sheet(wb, buildGuideSheet(XLSX, cols), GUIDE_SHEET);
  XLSX.utils.book_append_sheet(wb, lookupSheet, LOOKUP_SHEET);

  const { colLetter, sheetRef, quoteSheet } = await import('./xlsxPatch.js');
  const targetCol = (key) => colLetter(cols.findIndex((c) => c.key === key));
  const validations = lookups.map((l, i) => ({
    sqref: `${targetCol(l.key)}2:${targetCol(l.key)}${VALIDATED_ROWS}`,
    formula: sheetRef(LOOKUP_SHEET, colLetter(i), 2, l.values.length + 1),
    errorStyle: l.errorStyle,
    title: l.title,
    message: l.message,
  }));

  const sheet = quoteSheet(LOOKUP_SHEET);
  blocks.forEach((b, bi) => {
    const keyCol = colLetter(lookups.length + bi * 2);
    const valCol = colLetter(lookups.length + bi * 2 + 1);
    const last = b.pairs.length + 1;                            // header is row 1
    const keyRange = `${sheet}!$${keyCol}$2:$${keyCol}$${last}`;
    // The key is built from THIS row's parent columns. OOXML stores one formula
    // for the whole sqref, resolved relative to its top-left cell, so a
    // row-relative $A2 becomes $A3 on the next row, and so on down the sheet.
    const rowKey = b.keyCols.map((k) => `$${targetCol(k)}2`).join('&"|"&');
    validations.push({
      sqref: `${targetCol(b.key)}2:${targetCol(b.key)}${VALIDATED_ROWS}`,
      // OFFSET(first value cell, rows down to the first match, 0, how many match, 1).
      // Until the parent columns are filled MATCH is #N/A and the list is simply
      // empty - which is the right prompt: fill those first.
      formula: `OFFSET(${sheet}!$${valCol}$2,MATCH(${rowKey},${keyRange},0)-1,0,COUNTIF(${keyRange},${rowKey}),1)`,
      errorStyle: b.errorStyle,
      title: b.title,
      message: b.message,
    });
  });

  await finish(XLSX, wb, 'ggfix-models-empty-format', { freezeRows: 1, validations });
}

/** Write the rows that failed an import back out, with the reason appended. */
export async function exportErrorReport(failures) {
  const XLSX = await sheetjs();
  const header = [...MODEL_COLUMNS.map((c) => c.header), 'Sheet row', 'Problem'];
  const body = failures.map((f) => [
    ...MODEL_COLUMNS.map((c) => f.values?.[c.key] ?? ''),
    f.rowNumber,
    f.error || '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  ws['!cols'] = [...MODEL_COLUMNS.map((c) => ({ wch: c.width })), { wch: 10 }, { wch: 70 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  await finish(XLSX, wb, 'ggfix-models-import-errors', { freezeRows: 1 });
}

// ---------------------------------------------------------------------------
// Import — parse
// ---------------------------------------------------------------------------

/**
 * Read an uploaded .xlsx / .xls / .csv into `{ sheetName, present, rows }`.
 *
 * `present` is the set of column keys the sheet actually has. A column that is
 * absent is never written on update — only a column that IS present but blank
 * clears its field. That distinction is what lets an admin import a two-column
 * sheet (ID + Sell Active) without wiping every image and colour on those rows.
 */
export async function parseModelsFile(file) {
  const XLSX = await sheetjs();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = wb.SheetNames.find((n) => normaliseHeader(n) === 'models') || wb.SheetNames[0];
  if (!sheetName) throw new Error('That workbook has no sheets.');
  // raw:false so Excel hands back the displayed text — a model number like "1234"
  // stays "1234" instead of arriving as a float.
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, defval: '' });

  // Tolerate a title or blank line above the headers: scan the first few rows for
  // the one that maps at least two known columns.
  let headerIdx = -1;
  let colMap = null;
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const map = new Map();
    (aoa[i] || []).forEach((cell, c) => {
      const key = HEADER_ALIASES[normaliseHeader(cell)];
      if (key && !map.has(key)) map.set(key, c);
    });
    if (map.size >= 2) { headerIdx = i; colMap = map; break; }
  }
  if (headerIdx < 0) {
    throw new Error(
      `No header row found on sheet "${sheetName}". Expected columns like ${MODEL_COLUMNS.map((c) => c.header).join(', ')}.`,
    );
  }
  if (!colMap.has('name')) {
    throw new Error('The sheet has no "Model" column — that one is required to know which model each row is.');
  }

  const rows = [];
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const raw = aoa[r] || [];
    const values = {};
    for (const [key, c] of colMap) values[key] = text(raw[c]);
    // Skip fully blank rows — Excel leaves plenty of those behind.
    if (!Object.values(values).some((v) => v)) continue;
    rows.push({ rowNumber: r + 1, values }); // 1-based, matching the row numbers Excel shows
  }

  return { sheetName, present: new Set(colMap.keys()), rows };
}

// ---------------------------------------------------------------------------
// Import — plan
// ---------------------------------------------------------------------------

const lower = (s) => text(s).toLowerCase();

/**
 * Key a model by its series (or its brand, when it has no series) plus its name —
 * the fallback identity used when a sheet row carries no ID.
 */
const modelKey = (seriesId, brandId, name) => `${seriesId || `b:${brandId || ''}`}::${lower(name)}`;

/**
 * Turn parsed sheet rows into a reviewable plan: what would be created, what would
 * be updated, and what cannot be applied and why. Pure — it performs no writes, so
 * the preview the admin approves is exactly what runs.
 */
export function planModelImport({
  parsed,
  models,
  categories,
  brands,
  mappings,
  series,
  allowCreateSeries,
}) {
  const { present, rows } = parsed;

  const categoryByName = new Map(categories.map((c) => [lower(c.name), c]));
  const brandByName = new Map(brands.map((b) => [lower(b.name), b]));
  const mappingOf = (categoryId, brandId) =>
    mappings.find((m) => m.categoryId === categoryId && m.brandId === brandId) || null;
  const categoryOfMapping = new Map(mappings.map((m) => [m.id, m.categoryId]));
  const seriesById = new Map(series.map((s) => [s.id, s]));
  // Series names are only unique within a category+brand pair, so key on the mapping.
  const seriesByKey = new Map(series.map((s) => [`${s.categoryBrandId}::${lower(s.name)}`, s]));

  const modelById = new Map(models.map((m) => [m.id, m]));
  const modelByKey = new Map(models.map((m) => [modelKey(m.seriesId, m.brandId, m.name), m]));
  // Secondary index for sheets with no Series column at all: without it those rows
  // could never match a model that HAS a series, and every one of them would be
  // re-created as a duplicate.
  const modelsByBrandName = new Map();
  for (const m of models) {
    const k = `${m.brandId}::${lower(m.name)}`;
    if (!modelsByBrandName.has(k)) modelsByBrandName.set(k, []);
    modelsByBrandName.get(k).push(m);
  }

  // Series the sheet asks for that do not exist yet, deduped so twenty rows of one
  // new series create it once.
  const newSeries = new Map(); // key -> { key, name, categoryBrandId, categoryName, brandName }
  // Guards the (series_id, slug) unique index: two sheet rows naming the same model
  // in the same series would make the second insert fail at the database.
  const seenKeys = new Map(); // dup key -> first sheet row number

  const items = rows.map(({ rowNumber, values }) => {
    const item = { rowNumber, values, action: 'error', error: '' };
    const fail = (msg) => { item.error = msg; return item; };

    const name = values.name || '';
    if (!name) return fail('Model name is empty.');

    // ---- Match an existing model: by ID when given, else by series + name below.
    let existing = null;
    if (present.has('id') && values.id) {
      existing = modelById.get(values.id) || null;
      if (!existing) {
        return fail(`No model has ID ${values.id}. Clear the ID cell to create this as a new model.`);
      }
    }

    // ---- Resolve the taxonomy. A column the sheet does not have keeps the stored
    // value; on a new row that column is required.
    let category = null;
    if (present.has('categoryName') && values.categoryName) {
      category = categoryByName.get(lower(values.categoryName)) || null;
      if (!category) {
        return fail(`Category "${values.categoryName}" does not exist. Add it in Master Data → Categories first.`);
      }
    }
    let brand = null;
    if (present.has('brandName') && values.brandName) {
      brand = brandByName.get(lower(values.brandName)) || null;
      if (!brand) {
        return fail(`Brand "${values.brandName}" does not exist. Add it in Master Data → Brands first.`);
      }
    }

    // Fall back to whatever the matched model already points at.
    if (existing) {
      const es = seriesById.get(existing.seriesId);
      if (!category) {
        const cid = es ? categoryOfMapping.get(es.categoryBrandId) : existing.categoryId;
        category = categories.find((c) => c.id === cid) || null;
      }
      if (!brand) brand = brands.find((b) => b.id === existing.brandId) || null;
    }

    if (!brand) return fail('Brand is missing — a new model needs a Brand.');
    if (!category) return fail('Category is missing — a new model needs a Category.');

    const mapping = mappingOf(category.id, brand.id);
    if (!mapping) {
      return fail(`${brand.name} is not mapped to ${category.name}. Add the pair in Master Data → Category-Brand Mapping first.`);
    }

    // ---- Series (optional).
    let seriesId = existing ? existing.seriesId || null : null;
    let pendingSeriesKey = null;
    if (present.has('seriesName')) {
      const wanted = values.seriesName;
      if (!wanted) {
        seriesId = null; // blank cell in a present column = no series
      } else {
        const key = `${mapping.id}::${lower(wanted)}`;
        const found = seriesByKey.get(key);
        if (found) {
          seriesId = found.id;
        } else if (allowCreateSeries) {
          pendingSeriesKey = key; // resolved to a real id at apply time
          seriesId = null;
          if (!newSeries.has(key)) {
            newSeries.set(key, {
              key,
              name: wanted,
              categoryBrandId: mapping.id,
              categoryName: category.name,
              brandName: brand.name,
            });
          }
        } else {
          return fail(`Series "${wanted}" does not exist under ${category.name} → ${brand.name}. Tick "Create missing series" to add it automatically.`);
        }
      }
    } else {
      // Series column absent. Match on brand + name across the whole brand, so a
      // sheet that simply omits Series still updates the right model instead of
      // duplicating it under no series at all.
      if (!existing) {
        const candidates = modelsByBrandName.get(`${brand.id}::${lower(name)}`) || [];
        if (candidates.length > 1) {
          return fail(`${brand.name} has ${candidates.length} models called "${name}" in different series. Add a Series column, or an ID, to say which one this row is.`);
        }
        if (candidates.length === 1) {
          existing = candidates[0];
          seriesId = existing.seriesId || null;
        }
      }
      // Leave a matched model where it is, unless the row moved it to a
      // category/brand pair its current series does not belong to.
      if (seriesId) {
        const es = seriesById.get(seriesId);
        if (es && es.categoryBrandId !== mapping.id) seriesId = null;
      }
    }

    // ---- Match by series + name for rows that named a series but carried no ID.
    if (!existing && !pendingSeriesKey && present.has('seriesName')) {
      existing = modelByKey.get(modelKey(seriesId, brand.id, name)) || null;
    }

    // ---- Duplicate guard, within the sheet. Two rows resolving to the same model
    // would race each other on PUT; two new rows with the same name in one series
    // would break the (series_id, slug) unique index on the second insert. A
    // pending (not-yet-created) series cannot collide with anything stored, so rows
    // under one are keyed by its placeholder until apply time.
    const dupKey = existing
      ? `id:${existing.id}`
      : pendingSeriesKey
        ? `new:${pendingSeriesKey}::${lower(name)}`
        : modelKey(seriesId, brand.id, name);
    const clash = seenKeys.get(dupKey);
    if (clash) {
      return fail(`Duplicate of row ${clash} — both rows point at the same model. Each model may appear only once in the sheet.`);
    }
    seenKeys.set(dupKey, rowNumber);

    // ---- Build the payload. Start from the stored row so an absent column carries
    // through unchanged: PUT /master/models overwrites name, brandId, imageUrl and
    // category unconditionally, so a partial body would blank them.
    const base = existing || {};
    const payload = {
      brandId: brand.id,
      categoryId: category.id,
      seriesId,
      name,
      slug: slugify(name),
      // `category` (DEVICE / ACCESSORY) has no column — it is not editable in the UI
      // either, so preserve it rather than letting the PUT null it out.
      category: base.category || 'DEVICE',
      modelNumber: present.has('modelNumber') ? splitNumbers(values.modelNumber) : asNumberList(base.modelNumber),
      colors: present.has('colors')
        ? splitLabels(values.colors)
        : (Array.isArray(base.colors) ? base.colors : []),
      ramStorage: present.has('ramStorage')
        ? splitLabels(values.ramStorage)
        : (Array.isArray(base.ramStorage) ? base.ramStorage : []),
      imageUrl: present.has('imageUrl') ? (values.imageUrl || null) : (base.imageUrl || null),
      sellActive: present.has('sellActive')
        ? (parseBool(values.sellActive) ?? (existing ? base.sellActive !== false : true))
        : (existing ? base.sellActive !== false : true),
    };

    // A model that mixes "6 GB + 128 GB" combos with bare "128 GB" sizes breaks the
    // mobile variant picker, which infers a single shape per model.
    const specs = payload.ramStorage;
    if (specs.length && specs.some((s) => s.includes('+')) && specs.some((s) => !s.includes('+'))) {
      return fail('RAM / Storage mixes "6 GB + 128 GB" combos with storage-only sizes. Use one style per model.');
    }

    item.action = existing ? 'update' : 'create';
    item.existingId = existing?.id || null;
    item.pendingSeriesKey = pendingSeriesKey;
    item.payload = payload;
    item.label = `${category.name} → ${brand.name}${values.seriesName ? ` → ${values.seriesName}` : ''} → ${name}`;
    // Surfaced in the preview: an update that empties a field the model currently has.
    item.clearsImage = Boolean(existing && base.imageUrl && present.has('imageUrl') && !values.imageUrl);
    item.error = '';
    return item;
  });

  const counts = {
    create: items.filter((i) => i.action === 'create').length,
    update: items.filter((i) => i.action === 'update').length,
    error: items.filter((i) => i.action === 'error').length,
    clearsImage: items.filter((i) => i.clearsImage).length,
    newSeries: newSeries.size,
  };

  return { items, counts, newSeries: [...newSeries.values()] };
}
