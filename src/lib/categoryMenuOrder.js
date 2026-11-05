/**
 * Shared helpers for /master/category-menu rows (REPAIR / SELL / BUY).
 */

/** Words a menu name may carry in front of the device ("Sell Mobile", "Repair Laptop"). */
const SERVICE_PREFIX = /^(repair|sell|buy)\s+/i;

/**
 * Device key for a menu name or device-category name/code, so the three menus
 * and /master/device-categories line up: "Sell Mobile" → "mobile",
 * "Audio Device" / "AUDIO_DEVICE" → "audiodevice", "SMARTWATCHES" / "Smart Watch"
 * → "smartwatch".
 */
export function normKey(value) {
  if (typeof value !== 'string') return '';
  let key = value.trim().replace(SERVICE_PREFIX, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/(ch|sh|x)es$/.test(key)) key = key.slice(0, -2);
  else if (/[^s]s$/.test(key)) key = key.slice(0, -1);
  return key;
}

/** Service order on the home page: every Repair tile, then Buy, then Sell. */
const SERVICE_ORDER = ['REPAIR', 'BUY', 'SELL'];

/**
 * One list for the home page's "Our Services": grouped by service (Repair, Buy,
 * Sell), each group in the admin's sortOrder. A tile with no sortOrder goes to
 * the end of its group, and a tile with no service (Nearby Shops) goes last.
 * Stable, so equal tiles keep the order they arrived in.
 */
export function orderTiles(tiles) {
  const rank = (tile) => {
    const i = SERVICE_ORDER.indexOf(tile?.service);
    return i === -1 ? SERVICE_ORDER.length : i;
  };
  const sort = (tile) => (Number.isFinite(Number(tile?.sortOrder)) && tile?.sortOrder !== null ? Number(tile.sortOrder) : Infinity);

  return (Array.isArray(tiles) ? tiles : [])
    .filter(Boolean)
    .map((tile, index) => ({ tile, index }))
    .sort((a, b) => rank(a.tile) - rank(b.tile) || sort(a.tile) - sort(b.tile) || a.index - b.index)
    .map(({ tile }) => tile);
}
