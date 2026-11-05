/**
 * Spreadsheet helpers for Sell Flow master data.
 *
 * This module deliberately does not call the API.  It turns a workbook into a
 * reviewable, no-write plan instead; the pages/modal decide when to send the
 * returned payloads to `masterApi`.  Keeping that boundary here is important:
 * the same CSV must never start changing screening questions simply because it
 * was selected in a file picker.
 */

const VALIDATED_ROWS = 2000;
const FLOWS = ['COMMON', 'WORKING', 'DEAD'];

const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLowerCase();
const idText = (value) => text(value);
const normaliseHeader = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sameId = (left, right) => idText(left) === idText(right);
const asArray = (value) => (Array.isArray(value) ? value : (Array.isArray(value?.content) ? value.content : []));

const KIND_ALIASES = {
  screeningquestions: 'screeningQuestions',
  screeningquestion: 'screeningQuestions',
  conditioncategories: 'conditionCategories',
  conditioncategory: 'conditionCategories',
  conditiongroups: 'conditionGroups',
  conditiongroup: 'conditionGroups',
  functionalissues: 'functionalIssues',
  functionalissue: 'functionalIssues',
  deviceconfiguration: 'deviceConfiguration',
  deviceconfig: 'deviceConfiguration',
  configfields: 'deviceConfiguration',
};

/**
 * One definition drives sheets, guides, aliases and the pure import planners.
 * `key` values are intentionally API-shaped where possible, which makes the
 * rows in an error workbook useful even after the UI evolves.
 */
const DEFINITIONS = {
  screeningQuestions: {
    kind: 'screeningQuestions',
    label: 'Screening Questions',
    sheetName: 'Screening Questions',
    filenamePrefix: 'ggfix-screening-questions',
    primaryKey: 'question',
    hasFlow: true,
    columns: [
      { key: 'id', header: 'ID', width: 38, id: true, required: 'Keep for updates', help: 'Database ID. Keep it to update this question; leave blank to create one.' },
      { key: 'categoryName', header: 'Category', width: 26, required: 'Yes for new rows', help: 'Existing device category. Categories are never created by an import.' },
      { key: 'flow', header: 'Flow', width: 16, required: 'Yes for new rows', help: 'COMMON, WORKING or DEAD. COMMON appears in both sell flows.' },
      { key: 'question', header: 'Question', width: 62, required: 'Yes', help: 'The customer-facing yes/no question.' },
      { key: 'description', header: 'Description', width: 64, required: 'Optional', help: 'Helper text below the question. A blank cell clears it; delete this column to preserve existing descriptions.' },
      { key: 'sortOrder', header: 'Sort Order', width: 16, required: 'Optional', help: 'Whole number ordering. Blank keeps the old order on updates.' },
      { key: 'isActive', header: 'Active', width: 14, required: 'Optional', help: 'Yes or No. Blank keeps the old value on updates.' },
    ],
    aliases: {
      id: ['id', 'questionid', 'screeningquestionid'],
      categoryName: ['category', 'categoryname', 'devicecategory', 'devicecategoryname'],
      flow: ['flow', 'questionflow'],
      question: ['question', 'screeningquestion', 'name'],
      description: ['description', 'helpertext', 'helptext', 'details', 'notes'],
      sortOrder: ['sortorder', 'sort', 'order', 'displayorder'],
      isActive: ['active', 'isactive', 'enabled'],
    },
    example: {
      id: '', categoryName: 'Mobile', flow: 'COMMON', question: 'Does the device switch on?',
      description: 'Choose Yes only if it can power on.', sortOrder: '0', isActive: 'Yes',
    },
  },
  conditionCategories: {
    kind: 'conditionCategories',
    label: 'Condition Categories',
    sheetName: 'Condition Categories',
    filenamePrefix: 'ggfix-condition-categories',
    primaryKey: 'groupName',
    hasFlow: true,
    columns: [
      { key: 'groupId', header: 'Condition Category ID', width: 38, id: true, required: 'Keep for updates', help: 'Database ID. Keep it to update this condition category; leave blank to create one.' },
      { key: 'categoryName', header: 'Category', width: 26, required: 'Yes for new rows', help: 'Existing device category. Categories are never created by an import.' },
      { key: 'groupCode', header: 'Group Code', width: 24, required: 'Optional', help: 'Stable group code. Keep it to recognise an exported row; leave it blank for a new category to create a code automatically.' },
      { key: 'groupName', header: 'Condition Category', width: 36, required: 'Yes for new rows', help: 'For example Screen Condition or Back Panel.' },
      { key: 'flow', header: 'Flow', width: 16, required: 'Yes for new rows', help: 'COMMON, WORKING or DEAD.' },
      { key: 'groupSortOrder', header: 'Sort Order', width: 16, required: 'Optional', help: 'Whole number ordering. Blank keeps the old order on updates.' },
    ],
    aliases: {
      groupId: ['conditioncategoryid', 'groupid', 'id', 'conditiongroupid'],
      categoryName: ['category', 'categoryname', 'devicecategory', 'devicecategoryname'],
      groupCode: ['groupcode', 'code', 'conditiongroupcode'],
      groupName: ['conditioncategory', 'conditiongroup', 'groupname', 'name'],
      flow: ['flow', 'groupflow'],
      groupSortOrder: ['sortorder', 'groupsortorder', 'groupsort', 'grouporder'],
    },
    example: {
      groupId: '', categoryName: 'Mobile', groupCode: 'SCREEN_CONDITION', groupName: 'Screen Condition',
      flow: 'COMMON', groupSortOrder: '0',
    },
  },
  conditionGroups: {
    kind: 'conditionGroups',
    label: 'Condition Groups',
    sheetName: 'Condition Groups',
    filenamePrefix: 'ggfix-condition-groups',
    primaryKey: 'groupName',
    hasFlow: true,
    columns: [
      { key: 'groupId', header: 'Group ID', width: 38, id: true, required: 'Keep for updates', help: 'Condition-group ID. Keep it when updating an existing condition category.' },
      { key: 'categoryName', header: 'Category', width: 26, required: 'Yes for new groups', help: 'Existing device category. Imports never create categories.' },
      { key: 'groupCode', header: 'Group Code', width: 24, required: 'Optional', help: 'Stable group code. When supplied it is used after Group ID to recognise a group.' },
      { key: 'groupName', header: 'Condition Category', width: 32, required: 'Yes for new groups', help: 'For example Screen Condition or Back Panel.' },
      { key: 'flow', header: 'Flow', width: 16, required: 'Yes for new groups', help: 'COMMON, WORKING or DEAD.' },
      { key: 'groupSortOrder', header: 'Group Sort Order', width: 18, required: 'Optional', help: 'Whole number ordering for the condition category.' },
      { key: 'optionId', header: 'Option ID', width: 38, id: true, required: 'Keep for updates', help: 'Condition-option ID. It must already belong to this group. Keep it only when this row has one Option Label.' },
      { key: 'optionLabel', header: 'Option Label', width: 32, required: 'Optional', help: 'One selectable option per row, for example No Damage or Screen Broken. Legacy comma, pipe, semicolon or new-line values can be split only when Option ID is blank.' },
      { key: 'priceImpact', header: 'Price Impact', width: 16, required: 'Optional', help: 'Number, positive or negative. A blank value clears an existing optional price impact.' },
      { key: 'iconUrl', header: 'Icon URL', width: 58, required: 'Optional', help: 'Image URL for this option. A blank cell clears it; delete this column to preserve existing icon URLs.' },
      { key: 'optionSortOrder', header: 'Option Sort Order', width: 18, required: 'Optional', help: 'Whole number ordering within the condition category.' },
    ],
    aliases: {
      groupId: ['groupid', 'id', 'conditiongroupid'],
      categoryName: ['category', 'categoryname', 'devicecategory', 'devicecategoryname'],
      groupCode: ['groupcode', 'code', 'conditiongroupcode'],
      groupName: ['conditioncategory', 'conditiongroup', 'groupname', 'name'],
      flow: ['flow', 'groupflow'],
      groupSortOrder: ['groupsortorder', 'groupsort', 'groupsort', 'grouporder'],
      optionId: ['optionid', 'conditionoptionid'],
      optionLabel: ['optionlabel', 'option', 'label', 'conditionoption'],
      priceImpact: ['priceimpact', 'price', 'impact'],
      iconUrl: ['iconurl', 'icon', 'imageurl', 'image'],
      optionSortOrder: ['optionsortorder', 'optionsort', 'optionorder'],
    },
    example: {
      groupId: '', categoryName: 'Mobile', groupCode: 'SCREEN_CONDITION', groupName: 'Screen Condition',
      flow: 'COMMON', groupSortOrder: '0', optionId: '', optionLabel: 'No Damage', priceImpact: '0',
      iconUrl: 'https://cdn.neargfix.com/conditions/no-damage.png', optionSortOrder: '0',
    },
  },
  functionalIssues: {
    kind: 'functionalIssues',
    label: 'Functional Issues',
    sheetName: 'Functional Issues',
    filenamePrefix: 'ggfix-functional-issues',
    primaryKey: 'name',
    columns: [
      { key: 'id', header: 'ID', width: 38, id: true, required: 'Keep for updates', help: 'Database ID. Keep it to update this issue; leave blank to create one.' },
      { key: 'categoryName', header: 'Category', width: 26, required: 'Yes for new rows', help: 'Existing device category. Imports never create categories.' },
      { key: 'name', header: 'Functional Issue', width: 38, required: 'Yes', help: 'For example Speaker Not Working.' },
      { key: 'priceImpact', header: 'Price Impact', width: 16, required: 'Optional', help: 'Number, positive or negative. A blank value clears an existing optional price impact.' },
      { key: 'iconUrl', header: 'Icon URL', width: 58, required: 'Optional', help: 'Image URL. A blank cell clears it; delete this column to preserve existing icon URLs.' },
      { key: 'sortOrder', header: 'Sort Order', width: 16, required: 'Optional', help: 'Whole number ordering. Blank keeps the old order on updates.' },
      { key: 'isActive', header: 'Active', width: 14, required: 'Optional', help: 'Yes or No. Blank keeps the old value on updates.' },
    ],
    aliases: {
      id: ['id', 'issueid', 'functionalissueid'],
      categoryName: ['category', 'categoryname', 'devicecategory', 'devicecategoryname'],
      name: ['functionalissue', 'issue', 'issuename', 'name'],
      priceImpact: ['priceimpact', 'price', 'impact'],
      iconUrl: ['iconurl', 'icon', 'imageurl', 'image'],
      sortOrder: ['sortorder', 'sort', 'order', 'displayorder'],
      isActive: ['active', 'isactive', 'enabled'],
    },
    example: {
      id: '', categoryName: 'Mobile', name: 'Speaker Not Working',
      priceImpact: '0', iconUrl: 'https://cdn.neargfix.com/issues/speaker.png', sortOrder: '0', isActive: 'Yes',
    },
  },
  deviceConfiguration: {
    kind: 'deviceConfiguration',
    label: 'Device Configuration',
    sheetName: 'Device Configuration',
    filenamePrefix: 'ggfix-device-configuration',
    primaryKey: 'name',
    columns: [
      { key: 'id', header: 'ID', width: 38, id: true, required: 'Keep for updates', help: 'Database ID. Keep it to update this configuration field; leave blank to create one.' },
      { key: 'categoryName', header: 'Category', width: 26, required: 'Yes for new rows', help: 'Existing device category. Imports never create categories.' },
      { key: 'name', header: 'Field', width: 34, required: 'Yes', help: 'Configuration field key, for example Device Processor.' },
      { key: 'options', header: 'Options', width: 64, required: 'Optional', help: 'Values separated with |, comma, semicolon or a new line. A blank present cell clears all options; delete this column to preserve them.' },
      { key: 'sortOrder', header: 'Sort Order', width: 16, required: 'Optional', help: 'Whole number ordering. Blank keeps the old order on updates.' },
      { key: 'isActive', header: 'Active', width: 14, required: 'Optional', help: 'Yes or No. Blank keeps the old value on updates.' },
    ],
    aliases: {
      id: ['id', 'fieldid', 'configfieldid', 'deviceconfigid'],
      categoryName: ['category', 'categoryname', 'devicecategory', 'devicecategoryname'],
      name: ['field', 'fieldname', 'configurationfield', 'configfield', 'name'],
      options: ['options', 'optionvalues', 'values', 'dropdownvalues'],
      sortOrder: ['sortorder', 'sort', 'order', 'displayorder'],
      isActive: ['active', 'isactive', 'enabled'],
    },
    example: {
      id: '', categoryName: 'Laptop', name: 'Device Processor', options: 'Intel | AMD | Apple Silicon',
      sortOrder: '0', isActive: 'Yes',
    },
  },
};

/** Return the static sheet definition for a supported Sell Flow master-data kind. */
export function getSellFlowDefinition(kind) {
  const key = KIND_ALIASES[normaliseHeader(kind)];
  if (!key || !DEFINITIONS[key]) {
    throw new Error('Unknown Sell Flow master-data type: ' + String(kind || '(empty)') + '.');
  }
  return DEFINITIONS[key];
}

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
  const name = String(filename || 'ggfix-sell-flow-export');
  downloadBytes(output, /\.xlsx$/i.test(name) ? name : name + '.xlsx');
}

function addIndex(index, key, value) {
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(value);
}

function indexRows(rows, keyFor) {
  const index = new Map();
  for (const row of rows || []) {
    const key = keyFor(row);
    if (key) addIndex(index, key, row);
  }
  return index;
}

function categoryIndexes(categories) {
  const list = asArray(categories);
  const byId = new Map();
  const byName = new Map();
  for (const category of list) {
    const id = idText(category?.id);
    const name = text(category?.name);
    if (id) byId.set(id, category);
    if (name) addIndex(byName, lower(name), category);
  }
  return { list, byId, byName };
}

function categoryName(categoryId, indexes) {
  const id = idText(categoryId);
  if (!id) return 'All categories (shared)';
  return text(indexes.byId.get(id)?.name) || 'Category ' + id;
}

function categoryCell(categoryId, indexes) {
  const id = idText(categoryId);
  return id ? (text(indexes.byId.get(id)?.name) || '') : '';
}

function uniqueSorted(values) {
  return [...new Set((values || []).map((value) => text(value)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function boolCell(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
}

function numberCell(value) {
  return value === null || value === undefined || value === '' ? '' : value;
}

function rowsForExport(definition, rows, categories, optionsByGroup) {
  const indexes = categoryIndexes(categories);
  const list = asArray(rows);

  if (definition.kind === 'screeningQuestions') {
    return list.map((row) => definition.columns.map((column) => ({
      id: idText(row.id),
      categoryName: categoryCell(row.deviceCategoryId, indexes),
      flow: text(row.flow) || 'COMMON',
      question: text(row.question),
      description: row.helperText ?? '',
      sortOrder: numberCell(row.sortOrder),
      isActive: boolCell(row.isActive),
    })[column.key] ?? ''));
  }

  if (definition.kind === 'functionalIssues') {
    return list.map((row) => definition.columns.map((column) => ({
      id: idText(row.id),
      categoryName: categoryCell(row.deviceCategoryId, indexes),
      name: text(row.name),
      priceImpact: numberCell(row.priceImpact),
      iconUrl: row.iconUrl ?? '',
      sortOrder: numberCell(row.sortOrder),
      isActive: boolCell(row.isActive),
    })[column.key] ?? ''));
  }

  if (definition.kind === 'deviceConfiguration') {
    return list.map((row) => {
      const options = optionValues(row.options).join(' | ');
      return definition.columns.map((column) => ({
        id: idText(row.id),
        categoryName: categoryCell(row.deviceCategoryId, indexes),
        name: text(row.name),
        options,
        sortOrder: numberCell(row.sortOrder),
        isActive: boolCell(row.isActive),
      })[column.key] ?? '');
    });
  }

  if (definition.kind === 'conditionCategories') {
    return list.map((group) => definition.columns.map((column) => ({
      groupId: idText(group.id),
      categoryName: categoryCell(group.deviceCategoryId, indexes),
      groupCode: text(group.code),
      groupName: text(group.name),
      flow: text(group.flow) || 'COMMON',
      groupSortOrder: numberCell(group.sortOrder),
    })[column.key] ?? ''));
  }

  // Condition Groups are deliberately a flat parent/child export: a group with
  // N options occupies N rows, and a group without options still occupies one.
  // Some older records have a delimiter-separated label in one option record.
  // Those are canonicalised here so the workbook always has one label per row.
  const flat = [];
  for (const group of list) {
    const groupOptions = optionsForGroup(optionsByGroup, group.id, group.options);
    const optionRows = groupOptions.length ? expandConditionOptionsForExport(groupOptions) : [null];
    for (const option of optionRows) {
      const values = {
        groupId: idText(group.id),
        categoryName: categoryCell(group.deviceCategoryId, indexes),
        groupCode: text(group.code),
        groupName: text(group.name),
        flow: text(group.flow) || 'COMMON',
        groupSortOrder: numberCell(group.sortOrder),
        optionId: option?.optionId ?? idText(option?.id),
        optionLabel: option?.optionLabel ?? optionLabel(option),
        priceImpact: numberCell(option?.priceImpact),
        iconUrl: option?.iconUrl ?? '',
        optionSortOrder: numberCell(option?.optionSortOrder ?? option?.sortOrder),
      };
      flat.push(definition.columns.map((column) => values[column.key] ?? ''));
    }
  }
  return flat;
}

function buildGuideSheet(XLSX, definition, columns, template) {
  const matching = definition.kind === 'conditionGroups'
    ? 'Groups are matched by Group ID, then Group Code, then Category + Flow + Condition Category. Options are matched by Option ID, then by Group + Option Label.'
    : definition.kind === 'conditionCategories'
      ? 'Rows are matched by Condition Category ID, then Group Code, then Category + Flow + Condition Category.'
    : definition.kind === 'functionalIssues'
      ? 'Rows are matched by ID, then Category + Functional Issue.'
      : definition.kind === 'deviceConfiguration'
        ? 'Rows are matched by ID, then Category + Field.'
        : 'Rows are matched by ID, then Category + Flow + Question.';
  const rows = [
    ['NearGFix - ' + definition.label + ' import / export format'],
    [],
    ['Column', 'Required', 'What to put in it'],
    ...columns.map((column) => [column.header, column.required || '', column.help || '']),
    [],
    ['Notes'],
    ['Categories are never created by an import. Add them in Master Data > Categories first.'],
    [matching],
    [template
      ? 'This empty format has no ID columns. It creates rows unless a safe natural match already exists.'
      : 'Keep ID columns when editing exported rows. Delete an optional column to leave that field unchanged on existing rows.'],
    ...(definition.kind === 'screeningQuestions'
      ? [['A blank Description cell clears an existing description.']]
      : []),
    ...(definition.kind === 'functionalIssues'
      ? [['A blank Icon URL cell clears an existing icon URL.']]
      : []),
    ...(definition.kind === 'deviceConfiguration'
      ? [['A blank Options cell clears all options. Delete the whole Options column to keep existing options unchanged.']]
      : []),
    ...(definition.kind === 'conditionGroups'
      ? [
        ['Use one Option Label per row. The importer splits comma, pipe, semicolon or new-line labels only when Option ID is blank.'],
        ['A legacy combined option is migrated only when that exact combined label uniquely matches an existing option; it becomes the first label and the remaining labels are created.'],
        ['A blank Icon URL cell clears an option icon. Option IDs cannot be moved to a different condition group.'],
      ]
      : []),
    ['Do not rename the data sheet; that is the sheet the importer reads.'],
    [],
    ['Example row'],
    columns.map((column) => column.header),
    columns.map((column) => definition.example?.[column.key] ?? ''),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 110 }];
  return worksheet;
}

/** Download the current listed rows in an editable workbook with an in-file guide. */
export async function exportSellFlowWorkbook({ kind, rows, categories, optionsByGroup, filename }) {
  const definition = getSellFlowDefinition(kind);
  const XLSX = await sheetjs();
  const workbook = XLSX.utils.book_new();
  const body = rowsForExport(definition, rows, categories, optionsByGroup);
  XLSX.utils.book_append_sheet(workbook, buildDataSheet(XLSX, definition.columns, body), definition.sheetName);
  XLSX.utils.book_append_sheet(workbook, buildGuideSheet(XLSX, definition, definition.columns, false), 'Format guide');
  await finish(XLSX, workbook, filename || definition.filenamePrefix + '-export', { freezeRows: 1 });
}

/** Download an empty, validated workbook. IDs are intentionally left out. */
export async function exportSellFlowTemplateWorkbook({ kind, categories }) {
  const definition = getSellFlowDefinition(kind);
  const XLSX = await sheetjs();
  const columns = definition.columns.filter((column) => !column.id);
  const categoryNames = uniqueSorted(asArray(categories).map((category) => (
    typeof category === 'string' ? category : category?.name
  )));
  const lookups = [
    { key: 'categoryName', header: 'Categories', values: categoryNames, title: 'Unknown category', message: 'Pick an existing category. Add categories on their own Master Data page first.' },
    ...(definition.hasFlow ? [{ key: 'flow', header: 'Flows', values: FLOWS, title: 'Unknown flow', message: 'Choose COMMON, WORKING or DEAD.' }] : []),
  ].filter((lookup) => columns.some((column) => column.key === lookup.key));
  const depth = Math.max(0, ...lookups.map((lookup) => lookup.values.length));
  const lookupRows = [lookups.map((lookup) => lookup.header)];
  for (let row = 0; row < depth; row += 1) {
    lookupRows.push(lookups.map((lookup) => lookup.values[row] || ''));
  }
  const lookupSheet = XLSX.utils.aoa_to_sheet(lookupRows);
  lookupSheet['!cols'] = lookups.map(() => ({ wch: 28 }));
  if (lookups.length) {
    lookupSheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: depth, c: lookups.length - 1 } }),
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildDataSheet(XLSX, columns, []), definition.sheetName);
  XLSX.utils.book_append_sheet(workbook, buildGuideSheet(XLSX, definition, columns, true), 'Format guide');
  XLSX.utils.book_append_sheet(workbook, lookupSheet, 'Valid values');

  const { colLetter, sheetRef } = await import('./xlsxPatch.js');
  const validations = lookups.flatMap((lookup, index) => {
    if (!lookup.values.length) return [];
    const columnIndex = columns.findIndex((column) => column.key === lookup.key);
    if (columnIndex < 0) return [];
    const letter = colLetter(columnIndex);
    return [{
      sqref: letter + '2:' + letter + VALIDATED_ROWS,
      formula: sheetRef('Valid values', colLetter(index), 2, lookup.values.length + 1),
      errorStyle: 'stop',
      title: lookup.title,
      message: lookup.message,
    }];
  });

  await finish(XLSX, workbook, definition.filenamePrefix + '-empty-format', { freezeRows: 1, validations });
}

/** Write failures to a fix-and-reupload workbook. */
export async function exportSellFlowErrorReport({ kind, failures }) {
  const definition = getSellFlowDefinition(kind);
  const XLSX = await sheetjs();
  const header = [...definition.columns.map((column) => column.header), 'Sheet row', 'Problem'];
  const body = asArray(failures).map((failure) => [
    ...definition.columns.map((column) => failure?.values?.[column.key] ?? ''),
    failure?.rowNumber ?? '',
    failure?.error || '',
  ]);
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  worksheet['!cols'] = [
    ...definition.columns.map((column) => ({ wch: column.width })),
    { wch: 11 },
    { wch: 90 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, definition.sheetName);
  await finish(XLSX, workbook, definition.filenamePrefix + '-import-errors', { freezeRows: 1 });
}

function aliasesFor(definition) {
  const aliases = {};
  for (const column of definition.columns) {
    for (const alias of [column.key, column.header, ...(definition.aliases?.[column.key] || [])]) {
      aliases[normaliseHeader(alias)] = column.key;
    }
  }
  return aliases;
}

function isImportIdentifier(definition, map) {
  if (definition.kind === 'conditionGroups' || definition.kind === 'conditionCategories') {
    return map.has('groupName') || map.has('groupId') || map.has('groupCode');
  }
  return map.has(definition.primaryKey);
}

function supportedSheetName(definition, name) {
  const normal = normaliseHeader(name);
  const candidates = [definition.sheetName, definition.label, definition.kind]
    .map(normaliseHeader);
  return candidates.includes(normal);
}

/**
 * Parse xlsx/xls/csv into `{ sheetName, present, rows }`.  The values remain
 * strings so an ID which happens to be numeric-looking is never coerced.
 */
export async function parseSellFlowFile(kind, file) {
  const definition = getSellFlowDefinition(kind);
  const XLSX = await sheetjs();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const aliases = aliasesFor(definition);
  let best = null;

  for (const sheetName of workbook.SheetNames || []) {
    const aoa = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1, raw: false, defval: '',
    });
    for (let index = 0; index < Math.min(aoa.length, 12); index += 1) {
      const columnMap = new Map();
      (aoa[index] || []).forEach((cell, column) => {
        const key = aliases[normaliseHeader(cell)];
        if (key && !columnMap.has(key)) columnMap.set(key, column);
      });
      // Requiring two fields avoids accidentally treating a single mention of
      // "Question" in the format-guide prose as a data-table header.
      if (columnMap.size < 2 || !isImportIdentifier(definition, columnMap)) continue;
      const score = columnMap.size + (supportedSheetName(definition, sheetName) ? 100 : 0);
      if (!best || score > best.score) {
        best = { sheetName, aoa, headerIndex: index, columnMap, score };
      }
    }
  }

  if (!best) {
    throw new Error(
      'No ' + definition.label + ' header row found. Expected columns such as ' +
      definition.columns.slice(0, 4).map((column) => column.header).join(', ') + '.',
    );
  }

  const rows = [];
  for (let rowIndex = best.headerIndex + 1; rowIndex < best.aoa.length; rowIndex += 1) {
    const raw = best.aoa[rowIndex] || [];
    const values = {};
    for (const [key, column] of best.columnMap) values[key] = text(raw[column]);
    if (!Object.values(values).some(Boolean)) continue;
    rows.push({ rowNumber: rowIndex + 1, values });
  }
  return { sheetName: best.sheetName, present: new Set(best.columnMap.keys()), rows };
}

function one(index, key) {
  const values = index.get(key) || [];
  return values.length === 1 ? values[0] : null;
}

function countAt(index, key) {
  return (index.get(key) || []).length;
}

function rowCategoryId(row) {
  return row?.deviceCategoryId ?? row?.categoryId ?? null;
}

function resolveCategory({ values, present, existing, indexes, noun }) {
  const supplied = present.has('categoryName') && Boolean(text(values.categoryName));
  if (supplied) {
    const wanted = text(values.categoryName);
    const candidates = indexes.byName.get(lower(wanted)) || [];
    if (candidates.length > 1) {
      return { error: 'Category "' + wanted + '" is ambiguous. Use a unique category name.' };
    }
    if (!candidates.length) {
      return { error: 'Category "' + wanted + '" does not exist. Add it in Master Data > Categories first.' };
    }
    return { id: idText(candidates[0].id), name: text(candidates[0].name), supplied: true };
  }
  if (existing) {
    const id = idText(rowCategoryId(existing));
    return { id: id || null, name: categoryName(id, indexes), supplied: false };
  }
  return { error: 'Category is missing. New ' + noun + ' need a Category value.' };
}

function parseFlow(value) {
  const raw = text(value).toUpperCase();
  if (!raw) return { empty: true, value: null };
  const aliases = { ALL: 'COMMON', SHARED: 'COMMON' };
  const flow = aliases[raw] || raw;
  if (!FLOWS.includes(flow)) {
    return { error: 'Flow must be COMMON, WORKING or DEAD (received "' + text(value) + '").' };
  }
  return { empty: false, value: flow };
}

function parseNumber(value, label, integer = false) {
  const raw = text(value);
  if (!raw) return { empty: true, value: null };
  const normalized = raw.replace(/,/g, '');
  if (!/^-?(?:\d+|\d*\.\d+)$/.test(normalized)) {
    return { error: label + ' must be a number.' };
  }
  const number = Number(normalized);
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number))) {
    return { error: label + (integer ? ' must be a whole number.' : ' must be a valid number.') };
  }
  return { empty: false, value: number };
}

function parseBoolean(value) {
  const raw = lower(value);
  if (!raw) return { empty: true, value: null };
  if (['yes', 'y', 'true', '1', 'active', 'enabled'].includes(raw)) return { empty: false, value: true };
  if (['no', 'n', 'false', '0', 'inactive', 'disabled'].includes(raw)) return { empty: false, value: false };
  return { error: 'Active must be Yes or No.' };
}

function nextSortOrder(rows) {
  let max = -1;
  for (const row of rows || []) {
    const number = Number(row?.sortOrder);
    if (Number.isFinite(number)) max = Math.max(max, number);
  }
  return max + 1;
}

function defaultBoolean() {
  return true;
}

function optionsForGroup(optionsByGroup, groupId, fallback) {
  const key = idText(groupId);
  if (optionsByGroup instanceof Map) {
    return asArray(optionsByGroup.get(groupId) ?? optionsByGroup.get(key) ?? fallback);
  }
  if (optionsByGroup && typeof optionsByGroup === 'object') {
    return asArray(optionsByGroup[key] ?? fallback);
  }
  return asArray(fallback);
}

function optionLabel(option) {
  if (typeof option === 'string') return text(option);
  return text(option?.label ?? option?.value);
}

function splitConditionOptionLabels(value) {
  const values = text(value)
    .split(/[|,;\n\r]+/)
    .map((entry) => text(entry))
    .filter(Boolean);
  const seen = new Set();
  const duplicates = [];
  const unique = [];
  for (const entry of values) {
    const key = lower(entry);
    if (seen.has(key)) duplicates.push(entry);
    else {
      seen.add(key);
      unique.push(entry);
    }
  }
  return { values: unique, duplicates };
}

/**
 * Make the exported Condition Groups workbook canonical even when a legacy
 * option record stores several labels in one delimited string. The original ID
 * can only update one record, so it stays with the first label; added rows are
 * intentionally new options. A monotonic sort sequence keeps those added rows
 * ordered and avoids duplicate sort values after expansion.
 */
function expandConditionOptionsForExport(options) {
  const expanded = [];
  let nextSort = 0;
  for (const option of asArray(options)) {
    const parsed = splitConditionOptionLabels(optionLabel(option));
    const labels = parsed.values.length ? parsed.values : [''];
    const suppliedSort = Number(option?.sortOrder);
    const startSort = Number.isInteger(suppliedSort)
      ? Math.max(suppliedSort, nextSort)
      : nextSort;
    labels.forEach((label, index) => {
      expanded.push({
        ...(typeof option === 'object' && option ? option : {}),
        optionId: index === 0 ? idText(option?.id) : '',
        optionLabel: label,
        optionSortOrder: startSort + index,
      });
    });
    nextSort = startSort + labels.length;
  }
  return expanded;
}

function optionValues(options) {
  return asArray(options)
    .map((option) => text(typeof option === 'string' ? option : option?.value))
    .filter(Boolean);
}

function parseOptions(value) {
  const values = text(value)
    .split(/[|,;\n\r]+/)
    .map((entry) => text(entry))
    .filter(Boolean);
  const seen = new Set();
  const duplicates = [];
  const unique = [];
  for (const entry of values) {
    const key = lower(entry);
    if (seen.has(key)) duplicates.push(entry);
    else { seen.add(key); unique.push(entry); }
  }
  return { values: unique, duplicates };
}

function sameOptions(left, right) {
  const a = optionValues(left);
  const b = optionValues(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function scopedKey(categoryId, ...parts) {
  return [idText(categoryId), ...parts.map((part) => lower(part))].join('::');
}

function targetCollision(index, key, existing) {
  return (index.get(key) || []).some((candidate) => !existing || !sameId(candidate.id, existing.id));
}

function baseItem(row) {
  return { rowNumber: row.rowNumber, values: row.values, action: 'error', error: '' };
}

function fail(item, message) {
  item.error = message;
  return item;
}

function planScreeningQuestions({ parsed, rows, categories }) {
  const source = asArray(rows);
  const present = parsed?.present || new Set();
  const indexes = categoryIndexes(categories);
  const byId = indexRows(source, (row) => idText(row.id));
  const byNatural = indexRows(source, (row) => scopedKey(row.deviceCategoryId, row.flow || 'COMMON', row.question));
  const seen = new Map();
  let nextSort = nextSortOrder(source);

  const items = asArray(parsed?.rows).map((row) => {
    const item = baseItem(row);
    const values = row.values;
    let existing = null;
    if (present.has('id') && values.id) {
      const matches = countAt(byId, idText(values.id));
      if (!matches) return fail(item, 'No screening question has ID ' + values.id + '. Clear the ID to create a new row.');
      if (matches > 1) return fail(item, 'More than one screening question has ID ' + values.id + '. Refresh the page and try again.');
      existing = one(byId, idText(values.id));
    }

    const category = resolveCategory({ values, present, existing, indexes, noun: 'screening questions' });
    if (category.error) return fail(item, category.error);
    const flowInput = present.has('flow') ? parseFlow(values.flow) : { empty: true, value: null };
    if (flowInput.error) return fail(item, flowInput.error);
    const flow = flowInput.empty ? (text(existing?.flow) || 'COMMON').toUpperCase() : flowInput.value;
    const question = text(values.question);
    if (!question) return fail(item, 'Question is empty.');

    const natural = scopedKey(category.id, flow, question);
    if (!existing) {
      const matches = countAt(byNatural, natural);
      if (matches > 1) return fail(item, 'More than one existing question matches ' + category.name + ' -> ' + flow + ' -> ' + question + '. Use an ID.');
      existing = one(byNatural, natural);
    }
    if (existing && targetCollision(byNatural, natural, existing)) {
      return fail(item, 'Another screening question already uses ' + category.name + ' -> ' + flow + ' -> ' + question + '.');
    }

    const sortInput = present.has('sortOrder') ? parseNumber(values.sortOrder, 'Sort Order', true) : { empty: true };
    if (sortInput.error) return fail(item, sortInput.error);
    const activeInput = present.has('isActive') ? parseBoolean(values.isActive) : { empty: true };
    if (activeInput.error) return fail(item, activeInput.error);
    const helperText = present.has('description')
      ? (text(values.description) || null)
      : (existing?.helperText ?? null);

    // Only reserve a target after the full row has validated. Otherwise a bad
    // row would make a later corrected row look like a duplicate in the preview.
    const duplicateKey = existing ? 'id:' + idText(existing.id) : 'new:' + natural;
    const duplicate = seen.get(duplicateKey);
    if (duplicate) return fail(item, 'Duplicate of row ' + duplicate + ' - both rows point at the same screening question.');
    seen.set(duplicateKey, row.rowNumber);

    item.action = existing ? 'update' : 'create';
    item.existingId = existing ? idText(existing.id) : null;
    const payload = {
      deviceCategoryId: category.id,
      question,
      helperText,
    };
    // The endpoint only changes flow/sort/active when those values are sent.
    // Omitting an optional column must therefore preserve even legacy nulls.
    if (!existing || !flowInput.empty) payload.flow = flow;
    if (!existing || !sortInput.empty) payload.sortOrder = sortInput.empty ? nextSort++ : sortInput.value;
    if (!existing || !activeInput.empty) payload.isActive = activeInput.empty ? defaultBoolean() : activeInput.value;
    item.payload = payload;
    item.label = category.name + ' -> ' + flow + ' -> ' + question;
    item.clearsDescription = Boolean(existing?.helperText && present.has('description') && !text(values.description));
    item.error = '';
    return item;
  });

  return {
    items,
    counts: {
      create: items.filter((item) => item.action === 'create').length,
      update: items.filter((item) => item.action === 'update').length,
      error: items.filter((item) => item.action === 'error').length,
      clearsDescription: items.filter((item) => item.clearsDescription).length,
    },
  };
}

function planFunctionalIssues({ parsed, rows, categories }) {
  const source = asArray(rows);
  const present = parsed?.present || new Set();
  const indexes = categoryIndexes(categories);
  const byId = indexRows(source, (row) => idText(row.id));
  const byNatural = indexRows(source, (row) => scopedKey(row.deviceCategoryId, row.name));
  const seen = new Map();
  let nextSort = nextSortOrder(source);

  const items = asArray(parsed?.rows).map((row) => {
    const item = baseItem(row);
    const values = row.values;
    let existing = null;
    if (present.has('id') && values.id) {
      const matches = countAt(byId, idText(values.id));
      if (!matches) return fail(item, 'No functional issue has ID ' + values.id + '. Clear the ID to create a new row.');
      if (matches > 1) return fail(item, 'More than one functional issue has ID ' + values.id + '. Refresh the page and try again.');
      existing = one(byId, idText(values.id));
    }
    const category = resolveCategory({ values, present, existing, indexes, noun: 'functional issues' });
    if (category.error) return fail(item, category.error);
    const name = text(values.name);
    if (!name) return fail(item, 'Functional Issue is empty.');
    const natural = scopedKey(category.id, name);
    if (!existing) {
      const matches = countAt(byNatural, natural);
      if (matches > 1) return fail(item, 'More than one functional issue matches ' + category.name + ' -> ' + name + '. Use an ID.');
      existing = one(byNatural, natural);
    }
    if (existing && targetCollision(byNatural, natural, existing)) {
      return fail(item, 'Another functional issue already uses ' + category.name + ' -> ' + name + '.');
    }
    const priceInput = present.has('priceImpact') ? parseNumber(values.priceImpact, 'Price Impact') : { empty: true };
    if (priceInput.error) return fail(item, priceInput.error);
    const sortInput = present.has('sortOrder') ? parseNumber(values.sortOrder, 'Sort Order', true) : { empty: true };
    if (sortInput.error) return fail(item, sortInput.error);
    const activeInput = present.has('isActive') ? parseBoolean(values.isActive) : { empty: true };
    if (activeInput.error) return fail(item, activeInput.error);

    const duplicateKey = existing ? 'id:' + idText(existing.id) : 'new:' + natural;
    const duplicate = seen.get(duplicateKey);
    if (duplicate) return fail(item, 'Duplicate of row ' + duplicate + ' - both rows point at the same functional issue.');
    seen.set(duplicateKey, row.rowNumber);

    const payload = {
      deviceCategoryId: category.id,
      name,
      iconUrl: present.has('iconUrl') ? (text(values.iconUrl) || null) : (existing?.iconUrl ?? null),
      priceImpact: present.has('priceImpact')
        ? (priceInput.empty ? (existing ? null : 0) : priceInput.value)
        : (existing ? (existing.priceImpact ?? null) : 0),
    };
    // Unlike icon/price, the endpoint treats sort/active as patch fields. Do
    // not turn an omitted spreadsheet column into a defaulted update.
    if (!existing || !sortInput.empty) payload.sortOrder = sortInput.empty ? nextSort++ : sortInput.value;
    if (!existing || !activeInput.empty) payload.isActive = activeInput.empty ? defaultBoolean() : activeInput.value;
    item.action = existing ? 'update' : 'create';
    item.existingId = existing ? idText(existing.id) : null;
    item.payload = payload;
    item.label = category.name + ' -> ' + name;
    item.clearsIcon = Boolean(existing?.iconUrl && present.has('iconUrl') && !text(values.iconUrl));
    item.error = '';
    return item;
  });

  return {
    items,
    counts: {
      create: items.filter((item) => item.action === 'create').length,
      update: items.filter((item) => item.action === 'update').length,
      error: items.filter((item) => item.action === 'error').length,
      clearsIcon: items.filter((item) => item.clearsIcon).length,
    },
  };
}

function planDeviceConfiguration({ parsed, rows, categories }) {
  const source = asArray(rows);
  const present = parsed?.present || new Set();
  const indexes = categoryIndexes(categories);
  const byId = indexRows(source, (row) => idText(row.id));
  const byNatural = indexRows(source, (row) => scopedKey(row.deviceCategoryId, row.name));
  const seen = new Map();
  let nextSort = nextSortOrder(source);

  const items = asArray(parsed?.rows).map((row) => {
    const item = baseItem(row);
    const values = row.values;
    let existing = null;
    if (present.has('id') && values.id) {
      const matches = countAt(byId, idText(values.id));
      if (!matches) return fail(item, 'No configuration field has ID ' + values.id + '. Clear the ID to create a new row.');
      if (matches > 1) return fail(item, 'More than one configuration field has ID ' + values.id + '. Refresh the page and try again.');
      existing = one(byId, idText(values.id));
    }
    const category = resolveCategory({ values, present, existing, indexes, noun: 'configuration fields' });
    if (category.error) return fail(item, category.error);
    const name = text(values.name);
    if (!name) return fail(item, 'Field is empty.');
    const natural = scopedKey(category.id, name);
    if (!existing) {
      const matches = countAt(byNatural, natural);
      if (matches > 1) return fail(item, 'More than one configuration field matches ' + category.name + ' -> ' + name + '. Use an ID.');
      existing = one(byNatural, natural);
    }
    if (existing && targetCollision(byNatural, natural, existing)) {
      return fail(item, 'Another configuration field already uses ' + category.name + ' -> ' + name + '.');
    }

    const parsedOptions = present.has('options') ? parseOptions(values.options) : null;
    if (parsedOptions?.duplicates?.length) {
      return fail(item, 'Options contains duplicates: ' + parsedOptions.duplicates.join(', ') + '.');
    }
    const sortInput = present.has('sortOrder') ? parseNumber(values.sortOrder, 'Sort Order', true) : { empty: true };
    if (sortInput.error) return fail(item, sortInput.error);
    const activeInput = present.has('isActive') ? parseBoolean(values.isActive) : { empty: true };
    if (activeInput.error) return fail(item, activeInput.error);

    const duplicateKey = existing ? 'id:' + idText(existing.id) : 'new:' + natural;
    const duplicate = seen.get(duplicateKey);
    if (duplicate) return fail(item, 'Duplicate of row ' + duplicate + ' - both rows point at the same configuration field.');
    seen.set(duplicateKey, row.rowNumber);

    const payload = {
      deviceCategoryId: category.id,
      name,
    };
    if (!existing || !sortInput.empty) payload.sortOrder = sortInput.empty ? nextSort++ : sortInput.value;
    if (!existing || !activeInput.empty) payload.isActive = activeInput.empty ? defaultBoolean() : activeInput.value;
    const optionsChanged = Boolean(parsedOptions && !sameOptions(existing?.options, parsedOptions.values));
    // PUT /config-fields replaces every option row only when `options` is
    // present. Do not send it for absent or unchanged columns.
    if (!existing) payload.options = parsedOptions ? parsedOptions.values : [];
    else if (optionsChanged) payload.options = parsedOptions.values;

    item.action = existing ? 'update' : 'create';
    item.existingId = existing ? idText(existing.id) : null;
    item.payload = payload;
    item.label = category.name + ' -> ' + name;
    item.clearsOptions = Boolean(existing && optionValues(existing.options).length && present.has('options') && !parsedOptions.values.length);
    item.replacesOptions = Boolean(existing && optionsChanged);
    item.error = '';
    return item;
  });

  return {
    items,
    counts: {
      create: items.filter((item) => item.action === 'create').length,
      update: items.filter((item) => item.action === 'update').length,
      error: items.filter((item) => item.action === 'error').length,
      clearsOptions: items.filter((item) => item.clearsOptions).length,
      replacesOptions: items.filter((item) => item.replacesOptions).length,
    },
  };
}

function conditionGroupScope(categoryId, flow, name) {
  return scopedKey(categoryId, flow, name);
}

function optionGroupMap(groups, optionsByGroup) {
  const all = [];
  const seen = new Set();
  for (const group of groups) {
    const groupId = idText(group?.id);
    for (const option of optionsForGroup(optionsByGroup, groupId, group?.options)) {
      const id = idText(option?.id);
      const label = optionLabel(option);
      const identity = id || groupId + '::' + lower(label) + '::' + String(all.length);
      if (seen.has(identity)) continue;
      seen.add(identity);
      all.push({ ...(typeof option === 'object' && option ? option : {}), label, groupId: option?.groupId ?? groupId });
    }
  }
  return all;
}

function conditionGroupError(row, message) {
  const item = baseItem(row);
  item.groupKey = 'error:' + row.rowNumber;
  item.phase = 'group';
  item.error = message;
  return item;
}

function groupItemConflict(current, candidate) {
  const checks = [
    ['categoryId', current._specified.categoryId, candidate._specified.categoryId],
    ['flow', current._specified.flow, candidate._specified.flow],
    ['name', current._specified.name, candidate._specified.name],
    ['code', current._specified.code, candidate._specified.code],
    ['sortOrder', current._specified.sortOrder, candidate._specified.sortOrder],
  ];
  for (const [key, currentSpecified, candidateSpecified] of checks) {
    if (!currentSpecified || !candidateSpecified) continue;
    const left = current._compare[key];
    const right = candidate._compare[key];
    if (left !== right) return key;
  }
  return null;
}

function planConditionGroups({ parsed, rows, categories, optionsByGroup }) {
  const groups = asArray(rows);
  const inputRows = asArray(parsed?.rows);
  const present = parsed?.present || new Set();
  const indexes = categoryIndexes(categories);
  const groupsById = indexRows(groups, (group) => idText(group.id));
  const groupsByCode = indexRows(groups, (group) => lower(group.code));
  const groupsByScope = indexRows(groups, (group) => conditionGroupScope(group.deviceCategoryId, group.flow || 'COMMON', group.name));
  const options = optionGroupMap(groups, optionsByGroup);
  const optionsById = indexRows(options, (option) => idText(option.id));
  const optionsByGroupAndLabel = indexRows(options, (option) => scopedKey(option.groupId, option.label));
  const optionsByExistingGroup = new Map();
  for (const option of options) addIndex(optionsByExistingGroup, idText(option.groupId), option);

  const groupItems = [];
  const optionItems = [];
  const successfulGroups = new Map();
  const sourceContext = new Map();
  const errorRows = new Set();
  const plannedNewCodes = new Map();
  let nextGroupSort = nextSortOrder(groups);

  // Phase 1: resolve every flat line to a condition group, then collapse the
  // repeated parent columns (one per exported option) into a single group item.
  for (const row of inputRows) {
    const values = row.values;
    let existing = null;
    if (present.has('groupId') && values.groupId) {
      const matches = countAt(groupsById, idText(values.groupId));
      if (!matches) {
        const item = conditionGroupError(row, 'No condition group has Group ID ' + values.groupId + '. Clear the Group ID to create a new group.');
        groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
      }
      if (matches > 1) {
        const item = conditionGroupError(row, 'More than one condition group has Group ID ' + values.groupId + '. Refresh the page and try again.');
        groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
      }
      existing = one(groupsById, idText(values.groupId));
    }

    const wantedCode = present.has('groupCode') ? text(values.groupCode) : '';
    if (wantedCode) {
      const codeMatches = countAt(groupsByCode, lower(wantedCode));
      if (codeMatches > 1) {
        const item = conditionGroupError(row, 'More than one condition group has Group Code ' + wantedCode + '. Use Group ID.');
        groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
      }
      const coded = one(groupsByCode, lower(wantedCode));
      if (existing && coded && !sameId(existing.id, coded.id)) {
        const item = conditionGroupError(row, 'Group ID ' + values.groupId + ' and Group Code ' + wantedCode + ' point to different condition groups.');
        groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
      }
      existing = existing || coded;
    }

    const category = resolveCategory({ values, present, existing, indexes, noun: 'condition groups' });
    if (category.error) {
      const item = conditionGroupError(row, category.error);
      groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
    }
    const flowInput = present.has('flow') ? parseFlow(values.flow) : { empty: true };
    if (flowInput.error) {
      const item = conditionGroupError(row, flowInput.error);
      groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
    }
    const flow = flowInput.empty ? (text(existing?.flow) || 'COMMON').toUpperCase() : flowInput.value;
    const name = text(values.groupName) || text(existing?.name);
    if (!name) {
      const item = conditionGroupError(row, 'Condition Category is empty. New condition groups need a Condition Category.');
      groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
    }
    const scope = conditionGroupScope(category.id, flow, name);
    if (!existing) {
      const matches = countAt(groupsByScope, scope);
      if (matches > 1) {
        const item = conditionGroupError(row, 'More than one condition group matches ' + category.name + ' -> ' + flow + ' -> ' + name + '. Use Group ID.');
        groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
      }
      existing = one(groupsByScope, scope);
    }
    if (existing && targetCollision(groupsByScope, scope, existing)) {
      const item = conditionGroupError(row, 'Another condition group already uses ' + category.name + ' -> ' + flow + ' -> ' + name + '.');
      groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
    }
    if (wantedCode && targetCollision(groupsByCode, lower(wantedCode), existing)) {
      const item = conditionGroupError(row, 'Group Code ' + wantedCode + ' already belongs to another condition group.');
      groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
    }

    const sortInput = present.has('groupSortOrder') ? parseNumber(values.groupSortOrder, 'Group Sort Order', true) : { empty: true };
    if (sortInput.error) {
      const item = conditionGroupError(row, sortInput.error);
      groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
    }
    const groupKey = existing ? 'id:' + idText(existing.id) : 'new:' + scope;
    const candidate = {
      groupKey,
      phase: 'group',
      action: existing ? 'update' : 'create',
      existingId: existing ? idText(existing.id) : null,
      payload: {
        deviceCategoryId: category.id,
        name,
      },
      label: category.name + ' -> ' + flow + ' -> ' + name,
      rowNumber: row.rowNumber,
      values,
      sourceRows: [row.rowNumber],
      _specified: {
        categoryId: category.supplied,
        flow: present.has('flow') && Boolean(text(values.flow)),
        name: present.has('groupName') && Boolean(text(values.groupName)),
        code: present.has('groupCode') && Boolean(wantedCode),
        sortOrder: present.has('groupSortOrder') && Boolean(text(values.groupSortOrder)),
      },
      _compare: {
        categoryId: idText(category.id), flow, name, code: wantedCode, sortOrder: sortInput.value,
      },
      _needsDefaultSort: !existing && sortInput.empty,
    };
    if (!existing || !flowInput.empty) candidate.payload.flow = flow;
    if (!sortInput.empty) candidate.payload.sortOrder = sortInput.value;
    if (wantedCode) candidate.payload.code = wantedCode;

    const already = successfulGroups.get(groupKey);
    if (already) {
      const conflict = groupItemConflict(already, candidate);
      if (conflict) {
        const item = conditionGroupError(row, 'This repeats group row ' + already.rowNumber + ' but gives it a different ' + conflict + '. Keep all group columns identical for its options.');
        groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
      }
      already.sourceRows.push(row.rowNumber);
      sourceContext.set(row.rowNumber, { valid: true, item: already });
      continue;
    }
    if (!existing && wantedCode) {
      const codeOwner = plannedNewCodes.get(lower(wantedCode));
      if (codeOwner && codeOwner !== groupKey) {
        const item = conditionGroupError(row, 'Group Code ' + wantedCode + ' is also used by another new condition group in this sheet.');
        groupItems.push(item); sourceContext.set(row.rowNumber, { valid: false }); errorRows.add(row.rowNumber); continue;
      }
      plannedNewCodes.set(lower(wantedCode), groupKey);
    }
    if (candidate._needsDefaultSort) candidate.payload.sortOrder = nextGroupSort++;
    delete candidate._needsDefaultSort;
    successfulGroups.set(groupKey, candidate);
    groupItems.push(candidate);
    sourceContext.set(row.rowNumber, { valid: true, item: candidate });
  }

  // Phase 2: resolve each option against its already-planned parent. A parent
  // created in phase 1 has no UUID yet, so its option carries groupKey; the modal
  // replaces `payload.groupId` with the created UUID before POSTing it.
  const seenOptions = new Map();
  const optionNextSort = new Map();
  const nextOptionSort = (groupItem) => {
    const key = groupItem.groupKey;
    if (!optionNextSort.has(key)) {
      const existingOptions = groupItem.existingId ? (optionsByExistingGroup.get(groupItem.existingId) || []) : [];
      optionNextSort.set(key, nextSortOrder(existingOptions));
    }
    const current = optionNextSort.get(key);
    optionNextSort.set(key, current + 1);
    return current;
  };

  const addOptionError = (row, groupItem, message, values = row.values) => {
    optionItems.push({
      rowNumber: row.rowNumber,
      values,
      phase: 'option',
      action: 'error',
      groupKey: groupItem?.groupKey || ('error:' + row.rowNumber),
      groupExistingId: groupItem?.existingId || null,
      error: message,
    });
    errorRows.add(row.rowNumber);
  };

  for (const row of inputRows) {
    const values = row.values;
    const context = sourceContext.get(row.rowNumber);
    const hasOption = ['optionId', 'optionLabel', 'priceImpact', 'iconUrl', 'optionSortOrder']
      .some((key) => present.has(key) && Boolean(text(values[key])));
    if (!hasOption || !context?.valid) continue;
    const groupItem = context.item;
    const rawOptionLabel = text(values.optionLabel);
    const splitLabels = rawOptionLabel ? splitConditionOptionLabels(rawOptionLabel) : { values: [], duplicates: [] };
    const hasMultipleLabels = splitLabels.values.length > 1;

    if (rawOptionLabel && !splitLabels.values.length) {
      addOptionError(row, groupItem, 'Option Label has no values. Enter one label per row or use a non-empty comma-separated list.');
      continue;
    }

    // A UUID represents exactly one persisted option. Silently fanning it out
    // would make the importer update the same row repeatedly, so stop for a
    // review instead. Canonical exports keep the ID on the first line only.
    if (hasMultipleLabels && present.has('optionId') && text(values.optionId)) {
      addOptionError(row, groupItem, 'Option ID ' + values.optionId + ' cannot be used with multiple Option Labels. Put each label on its own row; only the first migrated row may keep the old ID.');
      continue;
    }
    if (splitLabels.duplicates.length) {
      addOptionError(row, groupItem, 'Option Label contains duplicates after splitting: ' + splitLabels.duplicates.join(', ') + '.');
      continue;
    }

    const priceInput = present.has('priceImpact') ? parseNumber(values.priceImpact, 'Price Impact') : { empty: true };
    if (priceInput.error) {
      addOptionError(row, groupItem, priceInput.error);
      continue;
    }
    const sourceSortInput = present.has('optionSortOrder') ? parseNumber(values.optionSortOrder, 'Option Sort Order', true) : { empty: true };
    if (sourceSortInput.error) {
      addOptionError(row, groupItem, sourceSortInput.error);
      continue;
    }

    const labels = rawOptionLabel ? splitLabels.values : [''];
    const sourceLabel = rawOptionLabel;
    let legacyComposite = null;
    if (hasMultipleLabels && groupItem.existingId) {
      const legacyKey = scopedKey(groupItem.existingId, sourceLabel);
      const legacyMatches = countAt(optionsByGroupAndLabel, legacyKey);
      if (legacyMatches > 1) {
        addOptionError(row, groupItem, 'More than one legacy option exactly matches "' + sourceLabel + '" in ' + groupItem.label + '. Use separate rows and Option IDs.');
        continue;
      }
      legacyComposite = one(optionsByGroupAndLabel, legacyKey);
      if (legacyComposite) {
        // The legacy row is renamed to the first value. That is only safe when
        // the target label does not already belong to another option.
        const firstTarget = optionsByGroupAndLabel.get(scopedKey(groupItem.existingId, labels[0])) || [];
        if (firstTarget.some((option) => !sameId(option.id, legacyComposite.id))) {
          addOptionError(row, groupItem, 'Cannot migrate legacy option "' + sourceLabel + '" because "' + labels[0] + '" already exists in ' + groupItem.label + '. Resolve the duplicate first.');
          continue;
        }
        const ambiguousTarget = labels.find((label) => countAt(optionsByGroupAndLabel, scopedKey(groupItem.existingId, label)) > 1);
        if (ambiguousTarget) {
          addOptionError(row, groupItem, 'More than one option named "' + ambiguousTarget + '" exists in ' + groupItem.label + '. Use separate rows and Option IDs.');
          continue;
        }
      }
    }

    for (let labelIndex = 0; labelIndex < labels.length; labelIndex += 1) {
      const suppliedLabel = labels[labelIndex];
      const itemValues = hasMultipleLabels
        ? {
          ...values,
          optionId: '',
          optionLabel: suppliedLabel,
          optionSortOrder: sourceSortInput.empty ? values.optionSortOrder : String(sourceSortInput.value + labelIndex),
        }
        : values;
      const item = {
        rowNumber: row.rowNumber,
        values: itemValues,
        phase: 'option',
        action: 'error',
        groupKey: groupItem.groupKey,
        groupExistingId: groupItem.existingId || null,
        error: '',
      };
      let existing = legacyComposite && labelIndex === 0 ? legacyComposite : null;
      if (!existing && present.has('optionId') && values.optionId) {
        const matches = countAt(optionsById, idText(values.optionId));
        if (!matches) {
          item.error = 'No condition option has Option ID ' + values.optionId + '.';
          optionItems.push(item); errorRows.add(row.rowNumber); continue;
        }
        if (matches > 1) {
          item.error = 'More than one condition option has Option ID ' + values.optionId + '. Refresh the page and try again.';
          optionItems.push(item); errorRows.add(row.rowNumber); continue;
        }
        existing = one(optionsById, idText(values.optionId));
        if (!groupItem.existingId || !sameId(existing.groupId, groupItem.existingId)) {
          item.error = 'Option ID ' + values.optionId + ' belongs to a different condition group. Imports never move options between groups.';
          optionItems.push(item); errorRows.add(row.rowNumber); continue;
        }
      }

      if (!existing && suppliedLabel && groupItem.existingId) {
        const naturalKey = scopedKey(groupItem.existingId, suppliedLabel);
        const matches = countAt(optionsByGroupAndLabel, naturalKey);
        if (matches > 1) {
          item.error = 'More than one option named "' + suppliedLabel + '" exists in ' + groupItem.label + '. Use Option ID.';
          optionItems.push(item); errorRows.add(row.rowNumber); continue;
        }
        existing = one(optionsByGroupAndLabel, naturalKey);
      }
      const label = suppliedLabel || text(existing?.label);
      if (!label) {
        item.error = 'Option Label is empty. New options need an Option Label.';
        optionItems.push(item); errorRows.add(row.rowNumber); continue;
      }
      if (existing && groupItem.existingId) {
        const sameLabelElsewhere = (optionsByGroupAndLabel.get(scopedKey(groupItem.existingId, label)) || [])
          .some((option) => !sameId(option.id, existing.id));
        if (sameLabelElsewhere) {
          item.error = 'Another option named "' + label + '" already exists in ' + groupItem.label + '.';
          optionItems.push(item); errorRows.add(row.rowNumber); continue;
        }
      }

      const sortOrder = sourceSortInput.empty
        ? null
        : sourceSortInput.value + (hasMultipleLabels ? labelIndex : 0);
      const duplicateKey = existing
        ? 'id:' + idText(existing.id)
        : 'new:' + groupItem.groupKey + '::' + lower(label);
      const duplicate = seenOptions.get(duplicateKey);
      if (duplicate) {
        item.error = 'Duplicate of row ' + duplicate + ' - both rows point at the same condition option.';
        optionItems.push(item); errorRows.add(row.rowNumber); continue;
      }
      seenOptions.set(duplicateKey, row.rowNumber);

      item.action = existing ? 'update' : 'create';
      item.existingId = existing ? idText(existing.id) : null;
      item.payload = {
        // This is ready for an existing parent. For a just-created parent the
        // importer substitutes the UUID resolved by `groupKey` before POST/PUT.
        groupId: groupItem.existingId || null,
        label,
        priceImpact: present.has('priceImpact')
          ? (priceInput.empty ? (existing ? null : 0) : priceInput.value)
          : (existing ? (existing.priceImpact ?? null) : 0),
        iconUrl: present.has('iconUrl') ? (text(values.iconUrl) || null) : (existing?.iconUrl ?? null),
      };
      if (!existing || !sourceSortInput.empty) {
        item.payload.sortOrder = sourceSortInput.empty ? nextOptionSort(groupItem) : sortOrder;
      }
      item.label = groupItem.label + ' -> ' + label;
      item.clearsIcon = Boolean(existing?.iconUrl && present.has('iconUrl') && !text(values.iconUrl));
      item.migratesCompositeOption = Boolean(legacyComposite && labelIndex === 0);
      item.error = '';
      optionItems.push(item);
    }
  }

  // Internal comparison fields are useful while grouping repeated option rows,
  // but should not leak into the generic modal's API-shaped item contract.
  groupItems.forEach((item) => {
    delete item._specified;
    delete item._compare;
  });

  const groupCreate = groupItems.filter((item) => item.phase === 'group' && item.action === 'create').length;
  const groupUpdate = groupItems.filter((item) => item.phase === 'group' && item.action === 'update').length;
  const optionCreate = optionItems.filter((item) => item.action === 'create').length;
  const optionUpdate = optionItems.filter((item) => item.action === 'update').length;
  return {
    groupItems,
    optionItems,
    // Kept for shared review/rendering code. Apply code should use the two
    // phases above so child rows never race a parent create.
    items: [...groupItems, ...optionItems],
    counts: {
      create: groupCreate + optionCreate,
      update: groupUpdate + optionUpdate,
      error: errorRows.size,
      groupCreate,
      groupUpdate,
      groupError: groupItems.filter((item) => item.action === 'error').length,
      optionCreate,
      optionUpdate,
      optionError: optionItems.filter((item) => item.action === 'error').length,
      clearsIcon: optionItems.filter((item) => item.clearsIcon).length,
      migratesCompositeOptions: optionItems.filter((item) => item.migratesCompositeOption).length,
    },
  };
}

/**
 * Build a no-write import plan. Non-condition kinds return `{ items, counts }`.
 * Condition Groups additionally returns `{ groupItems, optionItems }`: apply the
 * group phase first, map each created group's `groupKey` to its returned ID, then
 * replace `payload.groupId` on its option items before applying the option phase.
 */
export function planSellFlowImport({ kind, parsed, rows, categories, optionsByGroup }) {
  const definition = getSellFlowDefinition(kind);
  if (!parsed || !parsed.present || !Array.isArray(parsed.rows)) {
    throw new Error('A parsed import file with rows and present columns is required.');
  }
  if (definition.kind === 'screeningQuestions') return planScreeningQuestions({ parsed, rows, categories });
  if (definition.kind === 'functionalIssues') return planFunctionalIssues({ parsed, rows, categories });
  if (definition.kind === 'deviceConfiguration') return planDeviceConfiguration({ parsed, rows, categories });
  if (definition.kind === 'conditionCategories') {
    const conditionPlan = planConditionGroups({ parsed, rows, categories, optionsByGroup: {} });
    return {
      items: conditionPlan.groupItems,
      counts: {
        create: conditionPlan.counts.groupCreate,
        update: conditionPlan.counts.groupUpdate,
        error: conditionPlan.counts.groupError,
      },
    };
  }
  return planConditionGroups({ parsed, rows, categories, optionsByGroup });
}
