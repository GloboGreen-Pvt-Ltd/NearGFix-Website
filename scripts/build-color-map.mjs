/**
 * build-color-map.mjs — pre-resolve every device colour name in the GGFIX
 * catalogue to a hex, so the /repair variant swatches match the mobile app
 * WITHOUT shipping the 1.27 MB color-name-list to the browser.
 *
 * The app resolves marketing colour names ("Cosmic Green", "Diamond Black")
 * through color-name-list; names it doesn't know fall back to a base-colour
 * word. This does the same at build time and writes the result to
 * src/lib/deviceColors.json (lowercased name -> hex), a few tens of KB.
 *
 * Run manually when the catalogue's colours change:
 *   node scripts/build-color-map.mjs
 * It reads the live master-data service (same host the app/admin use).
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// Bare host: the edge routes /master/* straight through to master-data-service
// (location /master/ -> :8091/master/), so the calls below already carry the only
// /master segment the wire URL needs — https://api.neargfix.com/master/brands.
const MASTER = (process.env.MASTER_BASE || 'https://api.neargfix.com')
  .replace(/\/+$/, '')
  .replace(/\/master$/, '');

/* Base-colour words → hex. Only used when color-name-list has no exact match.
 * Kept in sync with COLOR_WORDS in src/components/site/RepairFlow.js (the client
 * fallback for any colour added to the catalogue after this file was generated). */
const COLOR_WORDS = {
  black: '#111827', white: '#e5e7eb', grey: '#6b7280', gray: '#6b7280',
  silver: '#c4c8cc', gold: '#d4af37', golden: '#d4af37', rose: '#e8b4b8',
  pink: '#ec4899', red: '#ef4444', crimson: '#dc2626', maroon: '#7f1d1d',
  orange: '#f97316', amber: '#f59e0b', yellow: '#eab308', lime: '#84cc16',
  green: '#16a34a', emerald: '#10b981', teal: '#14b8a6', cyan: '#06b6d4',
  aqua: '#22d3ee', sky: '#0ea5e9', blue: '#2563eb', navy: '#1e3a8a',
  indigo: '#4f46e5', violet: '#7c3aed', purple: '#9333ea', lavender: '#b57edc',
  brown: '#92400e', bronze: '#cd7f32', copper: '#b87333', coffee: '#6f4e37',
  graphite: '#383838', charcoal: '#36454f', titanium: '#878681', platinum: '#dcdcdc',
  midnight: '#0f172a', night: '#0f172a', space: '#1f2933', starlight: '#dfe3e8',
  starry: '#334155', mint: '#7fdca4', turquoise: '#40e0d0', coral: '#ff7f50',
  ivory: '#f2ecdd', cream: '#f5efd6', beige: '#e8dcc4', pearl: '#e6ddcf',
  glowing: '#334155', nebula: '#3b3f7a', cosmic: '#3b3f7a', ocean: '#0369a1',
  forest: '#166534', sea: '#0891b2',
};

function baseWord(name) {
  const s = String(name || '').toLowerCase().trim();
  if (COLOR_WORDS[s]) return COLOR_WORDS[s];
  const words = s.split(/[\s/_-]+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i -= 1) {
    if (COLOR_WORDS[words[i]]) return COLOR_WORDS[words[i]];
  }
  return null;
}

// Pick the client by scheme — node:http throws "Protocol https: not supported"
// on an https URL, so this must follow MASTER rather than be hardcoded.
const getJson = (url) =>
  new Promise((resolve) => {
    (url.startsWith('https:') ? https : http)
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      })
      .on('error', () => resolve(null));
  });

const asArray = (v) => (Array.isArray(v) ? v : (v && (v.content || v.data)) || []);

async function main() {
  // 1. color-name-list index (read from disk to dodge its restricted exports map)
  const listPath = path.join(
    ROOT,
    '..',
    'node_modules',
    'color-name-list',
    'dist',
    'colornames.json',
  );
  const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
  const byName = new Map();
  list.forEach((c) => byName.set(String(c.name).toLowerCase(), c.hex));
  console.log(`color-name-list: ${list.length} names`);

  // 2. every distinct colour across the catalogue
  const brands = asArray(await getJson(`${MASTER}/master/brands`));
  const colours = new Set();
  for (const b of brands) {
    const models = asArray(await getJson(`${MASTER}/master/brands/${b.id}/models`));
    models.forEach((m) =>
      asArray(m.colors).forEach((c) => {
        if (typeof c === 'string' && c.trim()) colours.add(c.trim());
      }),
    );
  }
  console.log(`catalogue: ${brands.length} brands, ${colours.size} distinct colours`);

  // 3. resolve: exact color-name-list match first, then base word
  const out = {};
  let exact = 0;
  let word = 0;
  let miss = 0;
  [...colours].sort().forEach((name) => {
    const key = name.toLowerCase();
    const hex = byName.get(key) || baseWord(name);
    if (byName.get(key)) exact += 1;
    else if (hex) word += 1;
    else miss += 1;
    if (hex) out[key] = hex.toLowerCase();
  });
  console.log(`resolved: ${exact} exact, ${word} base-word, ${miss} unresolved (neutral at runtime)`);

  const dest = path.join(ROOT, '..', 'src', 'lib', 'deviceColors.json');
  fs.writeFileSync(dest, `${JSON.stringify(out)}\n`);
  console.log(`wrote ${dest} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB, ${Object.keys(out).length} entries)`);
}

main();
