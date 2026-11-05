/**
 * Excel import/export helpers for Master Data > Repair Services.
 *
 * The admin is a static Next export, so this deliberately uses the existing
 * per-row master-data endpoints from the browser. The companion modal first
 * builds a pure plan and shows it to the administrator; nothing is written
 * while a workbook is being parsed or reviewed.
 */

export const REPAIR_SERVICE_COLUMNS = [
  { key: 'id', header: 'ID', width: 38 },
  { key: 'deviceCategoryName', header: 'Category', width: 24 },
  { key: 'mainCategoryName', header: 'Main Category', width: 28 },
  { key: 'name', header: 'Issue', width: 36 },
  { key: 'description', header: 'Description', width: 54 },
  { key: 'iconUrl', header: 'Icon URL', width: 54 },
];

const EMPTY_FORMAT_COLUMNS = REPAIR_SERVICE_COLUMNS.filter((column) => column.key !== 'id');
const SHEET_NAME = 'Repair Services';
const GUIDE_SHEET = 'Format guide';
const LOOKUP_SHEET = 'Valid values';
const VALIDATED_ROWS = 2000;

const HEADER_ALIASES = {
  id: 'id',
  uuid: 'id',
  repairserviceid: 'id',
  serviceid: 'id',
  category: 'deviceCategoryName',
  categoryname: 'deviceCategoryName',
  devicecategory: 'deviceCategoryName',
  devicecategoryname: 'deviceCategoryName',
  device: 'deviceCategoryName',
  maincategory: 'mainCategoryName',
  maincategoryname: 'mainCategoryName',
  repaircategory: 'mainCategoryName',
  repaircategoryname: 'mainCategoryName',
  issue: 'name',
  issuename: 'name',
  repairservice: 'name',
  servicename: 'name',
  name: 'name',
  description: 'description',
  details: 'description',
  notes: 'description',
  iconurl: 'iconUrl',
  icon: 'iconUrl',
  imageurl: 'iconUrl',
  image: 'iconUrl',
};

const normaliseHeader = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLowerCase();

async function sheetjs() {
  return import('xlsx');
}

function buildDataSheet(XLSX, columns, rows) {
  const header = columns.map((column) => column.header);
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  worksheet['!cols'] = columns.map((column) => ({ wch: column.width }));
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: header.length - 1 },
    }),
  };
  return worksheet;
}

async function finish(XLSX, workbook, filename, patch) {
  const raw = new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
  const { patchWorksheet, downloadBytes } = await import('./xlsxPatch.js');
  const output = await patchWorksheet(raw, 1, patch);
  downloadBytes(output, filename + '.xlsx');
}

function toSheetRow(service, names, columns) {
  const cells = {
    id: service.id || '',
    deviceCategoryName: names.deviceCategory?.(service.deviceCategoryId) || '',
    mainCategoryName: names.mainCategory?.(service.categoryId) || '',
    name: service.name || '',
    description: service.description || '',
    iconUrl: service.iconUrl || '',
  };
  return columns.map((column) => cells[column.key]);
}

const COLUMN_HELP = {
  id: ['Keep as-is', 'The database ID. Keep it to update that issue; leave it blank to create a new issue.'],
  deviceCategoryName: ['Yes for new rows', 'Pick the device category from the dropdown. It must already exist in Master Data > Categories.'],
  mainCategoryName: ['Yes for new rows', 'Pick a main repair category. Fill Category first; this dropdown is limited to that category.'],
  name: ['Yes', 'The repair issue shown to customers, for example Screen Broken.'],
  description: ['Optional', 'A customer-facing description. A blank cell clears it; delete this whole column to leave existing descriptions unchanged.'],
  iconUrl: ['Optional', 'A URL to the repair-service icon. Excel cannot upload image files. A blank cell clears an existing URL; delete this whole column to leave it unchanged.'],
};

const EXAMPLE_ROW = {
  id: '',
  deviceCategoryName: 'Mobile',
  mainCategoryName: 'Display & Touch',
  name: 'Screen Broken',
  description: 'Cracked or damaged display glass.',
  iconUrl: 'https://cdn.neargfix.com/repair-services/screen-broken.png',
};

function buildGuideSheet(XLSX, columns) {
  const matching = columns.some((column) => column.key === 'id')
    ? 'Rows are matched by ID first, then by Category + Main Category + Issue. A matching row updates; anything unmatched is created.'
    : 'This format has no ID column. Rows are matched by Category + Main Category + Issue; anything unmatched is created.';
  const rows = [
    ['NearGFix - Repair Services import / export format'],
    [],
    ['Column', 'Required', 'What to put in it'],
    ...columns.map((column) => [column.header, ...(COLUMN_HELP[column.key] || ['', ''])]),
    [],
    ['Notes'],
    ['Categories and main categories are never created by an import. Add those on their own Master Data pages first.'],
    [matching],
    ['A blank Description or Icon URL cell clears that field. Delete the whole column to leave the field untouched on existing rows.'],
    ['Do not rename the "Repair Services" sheet - that is the one the importer reads.'],
    [],
    ['Example row'],
    columns.map((column) => column.header),
    columns.map((column) => EXAMPLE_ROW[column.key]),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 110 }];
  return worksheet;
}

/**
 * Download the currently listed Repair Services. The caller has already applied
 * the page filters, so this is safe to edit and import as a narrow batch.
 */
export async function exportRepairServicesWorkbook(rows, names, filename) {
  const XLSX = await sheetjs();
  const body = (rows || []).map((service) => toSheetRow(service, names, REPAIR_SERVICE_COLUMNS));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildDataSheet(XLSX, REPAIR_SERVICE_COLUMNS, body), SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, buildGuideSheet(XLSX, REPAIR_SERVICE_COLUMNS), GUIDE_SHEET);
  await finish(XLSX, workbook, filename, { freezeRows: 1 });
}

const uniqueSorted = (values) => [...new Set((values || []).map((value) => text(value)).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b));

/**
 * A fill-in workbook with Category and dependent Main Category dropdowns.
 *
 * Each main category is supplied with the device-category name it belongs to.
 * Keeping equal keys adjacent is required by the OFFSET/COUNTIF Excel formula.
 */
export async function exportRepairServicesTemplateWorkbook(lists = {}) {
  const XLSX = await sheetjs();
  const columns = EMPTY_FORMAT_COLUMNS;
  const categories = uniqueSorted(lists.categories);
  const pairMap = new Map();
  for (const value of lists.mainCategories || []) {
    if (!value || typeof value !== 'object') continue;
    const name = text(value.name);
    const category = text(value.category);
    if (!name || !category) continue;
    pairMap.set(category + '::' + name, { category, name });
  }
  const mainCategoryPairs = [...pairMap.values()]
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const lookupHeader = ['Categories', 'Main category key (Category)', 'Main categories by Category'];
  const depth = Math.max(categories.length, mainCategoryPairs.length);
  const lookupRows = [lookupHeader];
  for (let index = 0; index < depth; index += 1) {
    lookupRows.push([
      categories[index] || '',
      mainCategoryPairs[index]?.category || '',
      mainCategoryPairs[index]?.name || '',
    ]);
  }
  const lookupSheet = XLSX.utils.aoa_to_sheet(lookupRows);
  lookupSheet['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 30 }];
  lookupSheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: depth, c: lookupHeader.length - 1 },
    }),
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildDataSheet(XLSX, columns, []), SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, buildGuideSheet(XLSX, columns), GUIDE_SHEET);
  XLSX.utils.book_append_sheet(workbook, lookupSheet, LOOKUP_SHEET);

  const { colLetter, quoteSheet, sheetRef } = await import('./xlsxPatch.js');
  const columnFor = (key) => colLetter(columns.findIndex((column) => column.key === key));
  const validations = [];
  if (categories.length) {
    const categoryColumn = columnFor('deviceCategoryName');
    validations.push({
      sqref: categoryColumn + '2:' + categoryColumn + VALIDATED_ROWS,
      formula: sheetRef(LOOKUP_SHEET, 'A', 2, categories.length + 1),
      errorStyle: 'stop',
      title: 'Unknown category',
      message: 'Pick a device category from the list. Add new categories in Master Data > Categories first.',
    });
  }
  if (mainCategoryPairs.length) {
    const categoryColumn = columnFor('deviceCategoryName');
    const mainCategoryColumn = columnFor('mainCategoryName');
    const lookupSheetName = quoteSheet(LOOKUP_SHEET);
    const last = mainCategoryPairs.length + 1;
    const keyRange = lookupSheetName + '!$B$2:$B$' + last;
    const key = '$' + categoryColumn + '2';
    validations.push({
      sqref: mainCategoryColumn + '2:' + mainCategoryColumn + VALIDATED_ROWS,
      formula: 'OFFSET(' + lookupSheetName + '!$C$2,MATCH(' + key + ',' + keyRange + ',0)-1,0,COUNTIF(' + keyRange + ',' + key + '),1)',
      errorStyle: 'stop',
      title: 'Unknown main category',
      message: 'Fill Category first, then pick a main category from its list. Add new main categories in Master Data > Repair Categories first.',
    });
  }

  await finish(XLSX, workbook, 'ggfix-repair-services-empty-format', {
    freezeRows: 1,
    validations,
  });
}

/** Write import failures back to a workbook the administrator can fix and re-upload. */
export async function exportRepairServiceErrorReport(failures) {
  const XLSX = await sheetjs();
  const header = [...REPAIR_SERVICE_COLUMNS.map((column) => column.header), 'Sheet row', 'Problem'];
  const body = (failures || []).map((failure) => [
    ...REPAIR_SERVICE_COLUMNS.map((column) => failure.values?.[column.key] || ''),
    failure.rowNumber,
    failure.error || '',
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  worksheet['!cols'] = [
    ...REPAIR_SERVICE_COLUMNS.map((column) => ({ wch: column.width })),
    { wch: 10 },
    { wch: 80 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
  await finish(XLSX, workbook, 'ggfix-repair-services-import-errors', { freezeRows: 1 });
}

/**
 * Parse .xlsx, .xls and .csv uploads. Header aliases make exports made by older
 * admin builds and hand-written sheets less brittle.
 */
export async function parseRepairServicesFile(file) {
  const XLSX = await sheetjs();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = workbook.SheetNames.find((name) => {
    const normalised = normaliseHeader(name);
    return normalised === 'repairservices' || normalised === 'repairservice' || normalised === 'issues';
  }) || workbook.SheetNames[0];
  if (!sheetName) throw new Error('That workbook has no sheets.');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  let headerIndex = -1;
  let columnMap = null;
  for (let index = 0; index < Math.min(rows.length, 10); index += 1) {
    const map = new Map();
    (rows[index] || []).forEach((cell, column) => {
      const key = HEADER_ALIASES[normaliseHeader(cell)];
      if (key && !map.has(key)) map.set(key, column);
    });
    if (map.size >= 2) {
      headerIndex = index;
      columnMap = map;
      break;
    }
  }
  if (headerIndex < 0) {
    throw new Error('No header row found on sheet "' + sheetName + '". Expected columns like ID, Category, Main Category and Issue.');
  }
  if (!columnMap.has('name')) {
    throw new Error('The sheet has no "Issue" column. That is required to know which repair service each row represents.');
  }

  const dataRows = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const raw = rows[rowIndex] || [];
    const values = {};
    for (const [key, column] of columnMap) values[key] = text(raw[column]);
    if (!Object.values(values).some(Boolean)) continue;
    dataRows.push({ rowNumber: rowIndex + 1, values });
  }
  return { sheetName, present: new Set(columnMap.keys()), rows: dataRows };
}

const repairServiceKey = (deviceCategoryId, mainCategoryId, name) =>
  String(deviceCategoryId || '') + '::' + String(mainCategoryId || '') + '::' + lower(name);

function addIndex(index, key, value) {
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(value);
}

/**
 * Build a no-write import plan. An ID wins when supplied; otherwise a repair
 * service is recognised by its device category, main category and issue name.
 */
export function planRepairServicesImport({ parsed, services, categories, mainCategories }) {
  const sourceServices = Array.isArray(services) ? services : [];
  const sourceCategories = Array.isArray(categories) ? categories : [];
  const sourceMainCategories = Array.isArray(mainCategories) ? mainCategories : [];
  const present = parsed.present;

  const categoryById = new Map(sourceCategories.map((category) => [category.id, category]));
  const categoryByName = new Map();
  sourceCategories.forEach((category) => addIndex(categoryByName, lower(category.name), category));

  const mainById = new Map(sourceMainCategories.map((category) => [category.id, category]));
  const mainByScopedName = new Map();
  sourceMainCategories.forEach((category) => {
    addIndex(
      mainByScopedName,
      String(category.deviceCategoryId || '') + '::' + lower(category.name),
      category,
    );
  });

  const serviceById = new Map(sourceServices.map((service) => [service.id, service]));
  const servicesByKey = new Map();
  sourceServices.forEach((service) => {
    addIndex(
      servicesByKey,
      repairServiceKey(service.deviceCategoryId, service.categoryId, service.name),
      service,
    );
  });
  const seenTargets = new Map();

  const items = parsed.rows.map(({ rowNumber, values }) => {
    const item = { rowNumber, values, action: 'error', error: '' };
    const fail = (message) => {
      item.error = message;
      return item;
    };
    const name = text(values.name);
    if (!name) return fail('Issue is empty.');

    let existing = null;
    if (present.has('id') && values.id) {
      existing = serviceById.get(values.id) || null;
      if (!existing) {
        return fail('No repair service has ID ' + values.id + '. Clear the ID cell to create a new issue.');
      }
    }

    let deviceCategory = null;
    if (present.has('deviceCategoryName') && values.deviceCategoryName) {
      const candidates = categoryByName.get(lower(values.deviceCategoryName)) || [];
      if (candidates.length > 1) {
        return fail('Category "' + values.deviceCategoryName + '" is ambiguous. Use a unique category name.');
      }
      deviceCategory = candidates[0] || null;
      if (!deviceCategory) {
        return fail('Category "' + values.deviceCategoryName + '" does not exist. Add it in Master Data > Categories first.');
      }
    } else if (existing) {
      deviceCategory = categoryById.get(existing.deviceCategoryId) || null;
    }
    if (!deviceCategory) {
      return fail('Category is missing. New issues need a Category value.');
    }

    let mainCategory = null;
    if (present.has('mainCategoryName') && values.mainCategoryName) {
      const candidates = mainByScopedName.get(deviceCategory.id + '::' + lower(values.mainCategoryName)) || [];
      if (candidates.length > 1) {
        return fail('Main Category "' + values.mainCategoryName + '" is ambiguous under ' + deviceCategory.name + '.');
      }
      mainCategory = candidates[0] || null;
      if (!mainCategory) {
        return fail('Main Category "' + values.mainCategoryName + '" does not exist under ' + deviceCategory.name + '. Add it in Master Data > Repair Categories first.');
      }
    } else if (existing) {
      mainCategory = mainById.get(existing.categoryId) || null;
      if (!mainCategory) {
        return fail('The existing issue has no valid Main Category. Supply one in this row before importing.');
      }
    }
    if (!mainCategory) {
      return fail('Main Category is missing. New issues need a Main Category value.');
    }
    if (mainCategory.deviceCategoryId !== deviceCategory.id) {
      return fail('Main Category "' + mainCategory.name + '" does not belong to ' + deviceCategory.name + '. Pick a matching category pair.');
    }

    if (!existing) {
      const matches = servicesByKey.get(repairServiceKey(deviceCategory.id, mainCategory.id, name)) || [];
      if (matches.length > 1) {
        return fail('More than one existing issue matches ' + deviceCategory.name + ' -> ' + mainCategory.name + ' -> ' + name + '. Use an ID to choose the one to update.');
      }
      existing = matches[0] || null;
    }

    const targetKey = existing
      ? 'id:' + existing.id
      : 'new:' + repairServiceKey(deviceCategory.id, mainCategory.id, name);
    const firstRow = seenTargets.get(targetKey);
    if (firstRow) {
      return fail('Duplicate of row ' + firstRow + ' - both rows point at the same repair service.');
    }
    seenTargets.set(targetKey, rowNumber);

    const previous = existing || {};
    const description = present.has('description')
      ? (text(values.description) || null)
      : (previous.description || null);
    const iconUrl = present.has('iconUrl')
      ? text(values.iconUrl)
      : (previous.iconUrl || null);

    item.action = existing ? 'update' : 'create';
    item.existingId = existing?.id || null;
    item.payload = {
      name,
      description,
      deviceCategoryId: deviceCategory.id,
      categoryId: mainCategory.id,
      iconUrl,
    };
    item.label = deviceCategory.name + ' -> ' + mainCategory.name + ' -> ' + name;
    item.clearsDescription = Boolean(
      existing && previous.description && present.has('description') && !text(values.description),
    );
    item.clearsIcon = Boolean(
      existing && previous.iconUrl && present.has('iconUrl') && !text(values.iconUrl),
    );
    item.error = '';
    return item;
  });

  const counts = {
    create: items.filter((item) => item.action === 'create').length,
    update: items.filter((item) => item.action === 'update').length,
    error: items.filter((item) => item.action === 'error').length,
    clearsDescription: items.filter((item) => item.clearsDescription).length,
    clearsIcon: items.filter((item) => item.clearsIcon).length,
  };
  return { items, counts };
}
