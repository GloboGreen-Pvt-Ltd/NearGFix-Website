// Runs automatically after `next build` (via the "postbuild" npm script).
// Static-export housekeeping for GitHub Pages:
//   1. error.html  - a generic error page some static hosts (and our deploy) expect.
//      Next's App Router export only emits 404.html, so we copy it to error.html.
//   2. .nojekyll   - stops GitHub Pages (Jekyll) from deleting the _next/ folder,
//      whose name starts with "_".
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');

if (!fs.existsSync(outDir)) {
  console.error('postbuild: out/ not found - did `next build` run? Skipping.');
  process.exit(0);
}

// 1. error.html from 404.html
const notFound = path.join(outDir, '404.html');
const errorHtml = path.join(outDir, 'error.html');
if (fs.existsSync(notFound)) {
  fs.copyFileSync(notFound, errorHtml);
  console.log('postbuild: wrote out/error.html (copied from 404.html)');
} else {
  console.warn('postbuild: out/404.html missing - error.html not created');
}

// 2. .nojekyll
fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
console.log('postbuild: wrote out/.nojekyll');
