// CloudFront Function — attach to the distribution's default behavior as
// **Viewer Request**. Required for this site to work at all beyond "/".
//
// WHY
// ---
// The bucket is a REST origin behind OAC (Block Public Access is on), not an S3
// *website* endpoint. A REST origin has no directory-index behaviour: CloudFront's
// "Default Root Object" maps ONLY "/" to index.html and nothing deeper.
//
// next.config.js sets trailingSlash: true, so the export writes
//   out/management/index.html, out/management/models/index.html, ...
// A browser asking for /management/ therefore requests S3 key "management/",
// which does not exist -> 404 -> the custom error response serves /index.html
// with status 200, and every route silently renders the home page.
//
// This function rewrites directory-style URIs onto the real object key:
//   /                      -> /index.html        (also handled by Default Root Object)
//   /management/           -> /management/index.html
//   /management            -> 301 /management/   (see SEO REDIRECTS below)
//   /management/models/    -> /management/models/index.html
//   /_next/static/x.js     -> unchanged (has an extension)
//
// The extension test compares the last "." against the last "/" so that a dot in a
// parent directory (e.g. /some.dir/page) still resolves as a directory, and only a
// genuine filename extension in the final segment is left alone.

//
// SEO REDIRECTS (301, before the rewrite)
// ---------------------------------------
// One URL per page, so search engines never split a page across duplicates:
//   https://www.ggfix.in/about/  -> https://ggfix.in/about/   (www -> bare host)
//   /about                       -> /about/                   (trailing slash, matches
//                                                              the canonical tags)
//   /shopmanagement/             -> /sell-with-us/?login=1    (retired page)
// Query strings are carried over. The www rule is generic ("www." prefix), so the
// same function is safe on preview/dev distributions that have no www alias.

// SUBDOMAIN PORTALS (same export, served by hostname; mirrors src/lib/portalUrl.js)
//   admin.neargfix.com/<p>       serves /management/<p>
//   shop.neargfix.com/           serves /sell-with-us/
//   shop.neargfix.com/dashboard/ serves /shop-home/
//   shop.neargfix.com/Business-Overview/ serves /shop-home/reports/overview/
//   shop.neargfix.com/<p>        serves /shop-home/<p>
// Internal paths 301 to their public URL on the right host (any host), so
// /management/ and /shop-home/ never stay in the address bar. RSC payloads
// (*.txt) are rewritten the same way; other files (/_next/*, images) pass through.
var ADMIN_HOST = 'admin.neargfix.com';
var SHOP_HOST = 'shop.neargfix.com';

function under(path, prefix) {
  return path === prefix + '/' || path.indexOf(prefix + '/') === 0;
}

// Internal directory path -> [host, public path], or null when not a portal path.
function publicUrl(path) {
  if (under(path, '/management')) return [ADMIN_HOST, path.slice(11)];
  if (under(path, '/sell-with-us')) return [SHOP_HOST, path.slice(13)];
  if (path === '/shop-home/') return [SHOP_HOST, '/dashboard/'];
  if (under(path, '/shop-home/reports/overview')) return [SHOP_HOST, '/Business-Overview' + path.slice(27)];
  if (under(path, '/shop-home')) return [SHOP_HOST, path.slice(10)];
  return null;
}

// Public directory path on a portal host -> internal directory path.
function internalPath(host, path) {
  if (host === ADMIN_HOST) return '/management' + path;
  if (path === '/') return '/sell-with-us/';
  if (under(path, '/dashboard')) return '/shop-home' + path.slice(10);
  if (under(path, '/Business-Overview')) return '/shop-home/reports/overview' + path.slice(18);
  return '/shop-home' + path;
}

var PERMANENT_REDIRECTS = {
  '/shopmanagement/': '/sell-with-us/?login=1',
};

function queryString(qs) {
  var parts = [];
  for (var key in qs) {
    var entry = qs[key];
    var values = entry.multiValue ? entry.multiValue : [entry];
    for (var i = 0; i < values.length; i++) {
      parts.push(values[i].value === '' ? key : key + '=' + values[i].value);
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

function redirect(location) {
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: { location: { value: location }, 'cache-control': { value: 'public, max-age=3600' } },
  };
}

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var host = request.headers.host ? request.headers.host.value : '';
  var isFile = uri.lastIndexOf('.') > uri.lastIndexOf('/');
  var canonicalHost = host.indexOf('www.') === 0 ? host.slice(4) : host;
  var canonicalUri = !isFile && !uri.endsWith('/') ? uri + '/' : uri;

  var portal = canonicalHost === ADMIN_HOST || canonicalHost === SHOP_HOST;
  if (!isFile) {
    var target = publicUrl(canonicalUri);
    if (target && (target[0] !== canonicalHost || target[1] !== canonicalUri)) {
      return redirect('https://' + target[0] + target[1] + queryString(request.querystring));
    }
  }
  if (portal && canonicalUri === uri && uri.indexOf('/_next/') !== 0) {
    if (!isFile) {
      request.uri = internalPath(canonicalHost, uri) + 'index.html';
      return request;
    }
    if (uri.slice(-4) === '.txt') {
      var slash = uri.lastIndexOf('/') + 1;
      request.uri = internalPath(canonicalHost, uri.slice(0, slash)) + uri.slice(slash);
      return request;
    }
  }
  if (PERMANENT_REDIRECTS[canonicalUri]) {
    return redirect('https://' + canonicalHost + PERMANENT_REDIRECTS[canonicalUri]);
  }
  if (canonicalHost !== host || canonicalUri !== uri) {
    return redirect('https://' + canonicalHost + canonicalUri + queryString(request.querystring));
  }

  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (!isFile) {
    request.uri = uri + '/index.html';
  }

  return request;
}
