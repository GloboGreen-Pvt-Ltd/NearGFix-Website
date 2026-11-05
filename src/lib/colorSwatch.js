/**
 * colorSwatch.js — resolve a free-form color name (e.g. "Midnight Black",
 * "Champagne Gold") to a real swatch hex, fully automatically, no
 * hand-maintained table.
 *
 * Extracted from the admin Models page's `guessColorHex` (src/app/management/
 * (portal)/models/page.js) — that page owns the canonical copy (it's the
 * only place a color is ever CREATED/typed in), this module is the same
 * algorithm reused read-only wherever a color needs a swatch elsewhere in
 * the app (Book Service's Color picker), so the two never resolve a name
 * to a different color.
 *
 * Priority: 1) an explicit hex/rgb() value 2) the exact name in the ~32k
 * community color list ("Champagne Gold" -> #e8d6b3) 3) the exact CSS
 * keyword ("gold", "teal") 4) word fallback, base-noun-first ("Passion
 * Red" -> red), so an unknown descriptor still lands on the right base
 * color. Both `color-name-list` and `color-name` are real, already-used
 * dependencies of this app (see package.json / the Models page).
 */

import { colornames } from 'color-name-list';
import cssColorNames from 'color-name';

const DEFAULT_SWATCH = '#9CA3AF';
const rgbToHex = (r, g, b) => '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x | 0)).toString(16).padStart(2, '0')).join('');

const CSS_HEX = new Map(Object.entries(cssColorNames).map(([k, [r, g, b]]) => [k, rgbToHex(r, g, b)]));

let NAMED_HEX = null;
const namedHex = () => {
  if (!NAMED_HEX) NAMED_HEX = new Map(colornames.map((c) => [c.name.toLowerCase(), c.hex]));
  return NAMED_HEX;
};

function parseLiteralColor(n) {
  if (/^#[0-9a-f]{6}$/.test(n)) return n;
  if (/^#[0-9a-f]{3}$/.test(n)) return '#' + n.slice(1).split('').map((c) => c + c).join('');
  const m = n.match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/);
  if (m) return rgbToHex(+m[1], +m[2], +m[3]);
  return null;
}

export function guessColorHex(name) {
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
