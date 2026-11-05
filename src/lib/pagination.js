/**
 * Resolve a requested page against the data actually present.
 *
 * Pure and shared, because two places have to agree on it: the table, which uses
 * `start` to slice its rows and to number the S.No column, and the footer, which
 * prints "Showing 41 to 50 of 998". A table that slices with one page number while
 * its footer prints another is worse than having no pagination at all.
 *
 * `page` is clamped rather than validated — the row count can shrink underneath a
 * viewer (a search narrows, a delete lands) and asking every caller to notice that
 * before rendering is how off-by-one bugs get in.
 *
 * @returns pageCount  total pages, never below 1 even when there are no rows
 * @returns safePage   the 0-based page actually being shown
 * @returns start      index of the first visible row
 * @returns end        index one past the last visible row, capped at `total`
 */
export function pageBounds(total, page, pageSize) {
  const size = Math.max(1, pageSize || 1);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(page || 0, 0), pageCount - 1);
  const start = safePage * size;
  return { pageCount, safePage, start, end: Math.min(start + size, total) };
}
