// Generates public/og-image.png — the 1200x630 default social-share image
// (og:image / twitter:image) for every public page. Re-run after a logo or
// brand-colour change:
//
//   node scripts/generate-og-image.mjs
//
// A static file rather than an app/opengraph-image.js route: under the static
// export that route is written without a file extension, which S3 serves with
// the wrong content type and the CloudFront rewrite treats as a directory.
// Uses the renderer Next already ships (@vercel/og), so no extra dependency.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// @vercel/og locates its font/wasm with path.join(import.meta.url, ...), which
// produces an invalid URL on Windows. Load a temp copy with that one line fixed
// (node_modules itself is never modified).
const ogDir = path.join(root, 'node_modules', 'next', 'dist', 'compiled', '@vercel', 'og');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ggfix-og-'));
fs.cpSync(ogDir, tmpDir, { recursive: true });
const entry = path.join(tmpDir, 'index.node.mjs');
fs.writeFileSync(
  entry,
  fs
    .readFileSync(path.join(tmpDir, 'index.node.js'), 'utf8')
    .replace(/fileURLToPath\(join\(import\.meta\.url, "\.\.\/([^"]+)"\)\)/g, 'fileURLToPath(new URL("./$1", import.meta.url))'),
);
const { ImageResponse } = await import(pathToFileURL(entry).href);
const logo = `data:image/png;base64,${fs.readFileSync(path.join(root, 'public', 'logo.png')).toString('base64')}`;

const h = (type, props, ...children) => ({ type, props: { ...props, children: children.length > 1 ? children : children[0] } });

const CATEGORIES = ['Mobile', 'Tablet', 'Laptop', 'Smartwatch', 'Audio'];

const image = new ImageResponse(
  h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 55%, #DCFCE7 100%)',
        fontFamily: 'Noto Sans',
      },
    },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 24 } },
      h('img', { src: logo, width: 96, height: 96, style: { borderRadius: 24 } }),
      h('div', { style: { fontSize: 56, fontWeight: 700, color: '#15803D', letterSpacing: -1 } }, 'GGFIX'),
    ),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 18 } },
      h('div', { style: { fontSize: 68, fontWeight: 700, color: '#0F172A', lineHeight: 1.08, letterSpacing: -1.5 } }, 'Repair, buy & sell your devices'),
      h('div', { style: { fontSize: 32, color: '#5A6678' } }, 'Verified repair shops near you, doorstep pickup and live tracking'),
    ),
    h(
      'div',
      { style: { display: 'flex', gap: 14 } },
      ...CATEGORIES.map((c) =>
        h('div', { style: { display: 'flex', padding: '10px 24px', borderRadius: 999, background: '#16A34A', color: '#FFFFFF', fontSize: 26 } }, c),
      ),
    ),
  ),
  { width: 1200, height: 630 },
);

const out = path.join(root, 'public', 'og-image.png');
fs.writeFileSync(out, Buffer.from(await image.arrayBuffer()));
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`wrote ${path.relative(root, out)}`);
