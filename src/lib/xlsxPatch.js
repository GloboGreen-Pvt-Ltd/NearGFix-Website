/**
 * Post-processing for SheetJS-generated .xlsx files.
 *
 * SheetJS's community build writes cell data faithfully but drops two things this
 * catalogue sheet needs: frozen panes (`!freeze` is read and then ignored) and
 * data validations (`write_ws_xml` has a bare `/* dataValidations *\/` comment
 * where the element would go). Both are plain XML on the worksheet part, so rather
 * than take on a second, much heavier Excel library for the sake of them, the
 * workbook is written once, unzipped, patched and re-zipped.
 *
 * Everything here operates on `xl/worksheets/sheetN.xml`, whose element order is
 * fixed by the OOXML schema — put a child in the wrong place and Excel calls the
 * file corrupt rather than ignoring it, so the insertion points below matter.
 */

/**
 * CT_Worksheet children that must follow <dataValidations>, in schema order. The
 * validations block is inserted before whichever of these appears first — SheetJS
 * emits <autoFilter> and <ignoredErrors>, and dataValidations belongs between them.
 */
const AFTER_VALIDATIONS = [
  'hyperlinks', 'printOptions', 'pageMargins', 'pageSetup', 'headerFooter',
  'rowBreaks', 'colBreaks', 'customProperties', 'cellWatches', 'ignoredErrors',
  'smartTags', 'drawing', 'legacyDrawing', 'legacyDrawingHF', 'picture',
  'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst',
];

const xmlEscape = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** 0-based column index → spreadsheet letter. 0 → A, 26 → AA. */
export function colLetter(i) {
  let n = i + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * A worksheet reference usable inside a validation formula. Sheet names containing
 * a space (ours is "Valid values") must be single-quoted, and an apostrophe inside
 * one is escaped by doubling it.
 */
/**
 * A sheet name as it must appear inside a formula: bare when it is a plain
 * identifier, single-quoted (with embedded quotes doubled) when it is not.
 * "Valid values" has a space, so it always needs the quotes.
 */
export function quoteSheet(sheetName) {
  return /^[A-Za-z0-9_]+$/.test(sheetName)
    ? sheetName
    : `'${sheetName.replace(/'/g, "''")}'`;
}

export function sheetRef(sheetName, col, firstRow, lastRow) {
  return `${quoteSheet(sheetName)}!$${col}$${firstRow}:$${col}$${lastRow}`;
}

/** Freeze everything above `rows` — for us, the header row. */
function injectFreeze(xml, rows) {
  const pane =
    `<pane ySplit="${rows}" topLeftCell="A${rows + 1}" activePane="bottomLeft" state="frozen"/>` +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>';
  // SheetJS writes a self-closing <sheetView .../>; the pane has to become a child,
  // so the tag is reopened around it.
  const selfClosing = /<sheetView([^>]*)\/>/;
  if (selfClosing.test(xml)) return xml.replace(selfClosing, `<sheetView$1>${pane}</sheetView>`);
  return xml.replace(/(<sheetView[^>]*>)/, `$1${pane}`);
}

/**
 * @param list [{ sqref, formula, errorStyle, title, message }]
 *   sqref      the range the rule covers, e.g. "A2:A1001"
 *   formula    a range reference on another sheet, e.g. 'Valid values'!$A$2:$A$9
 *   errorStyle 'stop' refuses anything off-list; 'warning' lets it through
 */
function injectValidations(xml, list) {
  if (!list.length) return xml;
  const body = list.map((v) => (
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"` +
    ` errorStyle="${v.errorStyle || 'stop'}" sqref="${v.sqref}"` +
    (v.title ? ` errorTitle="${xmlEscape(v.title)}"` : '') +
    (v.message ? ` error="${xmlEscape(v.message)}"` : '') +
    `><formula1>${xmlEscape(v.formula)}</formula1></dataValidation>`
  )).join('');
  const block = `<dataValidations count="${list.length}">${body}</dataValidations>`;

  for (const tag of AFTER_VALIDATIONS) {
    const at = xml.indexOf(`<${tag}`);
    if (at > -1) return xml.slice(0, at) + block + xml.slice(at);
  }
  return xml.replace('</worksheet>', `${block}</worksheet>`);
}

/**
 * Patch one worksheet inside an .xlsx byte array.
 *
 * @param bytes      Uint8Array from XLSX.write(wb, { type: 'array' })
 * @param sheetIndex 1-based position of the sheet as appended to the workbook
 * @param opts       { freezeRows, validations }
 * @returns a new Uint8Array; the input is left alone
 */
export async function patchWorksheet(bytes, sheetIndex, { freezeRows = 0, validations = [] } = {}) {
  const { unzipSync, zipSync, strToU8, strFromU8 } = await import('fflate');
  const files = unzipSync(bytes);
  const part = `xl/worksheets/sheet${sheetIndex}.xml`;
  // Never corrupt the download over a cosmetic feature: if the part is not where we
  // expect, hand back the workbook SheetJS produced.
  if (!files[part]) return bytes;

  let xml = strFromU8(files[part]);
  if (freezeRows > 0) xml = injectFreeze(xml, freezeRows);
  xml = injectValidations(xml, validations);
  files[part] = strToU8(xml);

  // mimetype-style stored entries do not apply to xlsx; deflate everything.
  return zipSync(files, { level: 6 });
}

/** Hand a byte array to the browser as a file download. */
export function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick — Safari has been known to cancel an in-flight
  // download if the object URL disappears synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
