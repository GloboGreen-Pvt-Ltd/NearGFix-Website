/**
 * reportPdf.js — "Download PDF" for the /shop-home/reports/* pages.
 *
 * No PDF/print feature existed anywhere in this codebase before this.
 * Follows the exact same shape this project already uses for document
 * export (src/lib/xlsxPatch.js, src/lib/repairServicesExcel.js): the
 * library is dynamically import()ed inside the export call, never a
 * static top-level import, so it doesn't bloat every page's initial
 * bundle — only pulled in when someone actually clicks "Download PDF".
 *
 * Every caller builds `stats`/`columns`/`rows` from data it already holds
 * in React state (the same rows already rendered on screen) — this file
 * never fetches anything itself and never invents a number.
 */

export async function downloadReportPdf({ title, subtitle, generatedLabel, stats = [], notes = [], columns = [], rows = [], filename }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  const doc = new jsPDF();
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth() - marginX * 2;
  let y = 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, marginX, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (subtitle) {
    doc.text(subtitle, marginX, y);
    y += 6;
  }
  doc.setTextColor(120, 120, 120);
  doc.text(generatedLabel || `Generated ${new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`, marginX, y);
  doc.setTextColor(0, 0, 0);
  y += 9;

  if (stats.length) {
    doc.setFontSize(11);
    stats.forEach((s) => {
      doc.setFont('helvetica', 'bold');
      doc.text(String(s.value), marginX, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(s.label), marginX + 24, y);
      y += 6;
    });
    y += 3;
  }

  if (notes.length) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    notes.forEach((n) => {
      const lines = doc.splitTextToSize(n, pageWidth);
      doc.text(lines, marginX, y);
      y += lines.length * 4.5;
    });
    doc.setTextColor(0, 0, 0);
    y += 3;
  }

  if (columns.length && rows.length) {
    autoTable(doc, {
      startY: y,
      head: [columns.map((c) => c.header)],
      body: rows.map((r) => columns.map((c) => (typeof c.value === 'function' ? c.value(r) : r[c.key] ?? ''))),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [21, 128, 61] },
      margin: { left: marginX, right: marginX },
    });
  } else if (columns.length) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('No rows to show for the current view.', marginX, y);
    doc.setTextColor(0, 0, 0);
  }

  doc.save(filename || `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
}
