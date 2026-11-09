/**
 * Public <-> internal URL mapping for the portal subdomains.
 *
 * One static export serves three hosts (CloudFront rewrites by hostname, see
 * infra/cloudfront-rewrite-index.js — keep both in sync):
 *   admin.neargfix.com/<p>   <- /management/<p>
 *   shop.neargfix.com/       <- /sell-with-us/
 *   shop.neargfix.com/dashboard/ <- /shop-home/
 *   shop.neargfix.com/Business-Overview/ <- /shop-home/reports/overview/
 *   shop.neargfix.com/<p>    <- /shop-home/<p>
 * App code keeps using internal paths; Link/router/usePathname wrappers
 * (src/components/PortalLink.js, src/lib/portalNavigation.js) translate them.
 * Any other hostname (localhost, previews) maps 1:1, except /shop-home/ shows
 * as /dashboard/ and reports overview as /business-overview/ (next.config.js rewrites it back in dev).
 */
export const MAIN_HOST = 'neargfix.com';
export const ADMIN_HOST = 'admin.neargfix.com';
export const SHOP_HOST = 'shop.neargfix.com';

function currentHost() {
  return typeof window === 'undefined' ? '' : window.location.hostname.replace(/^www\./, '');
}

const under = (path, prefix) => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?');

/** Which host serves an internal path. */
function hostFor(path) {
  if (under(path, '/management')) return ADMIN_HOST;
  if (under(path, '/shop-home') || under(path, '/sell-with-us')) return SHOP_HOST;
  return MAIN_HOST;
}

const OVERVIEW = '/shop-home/reports/overview';
const isShopRoot = (p) => p === '/shop-home' || p === '/shop-home/' || p.startsWith('/shop-home?') || p.startsWith('/shop-home/?');

/** Path on its own host for an internal path. */
function publicPath(path) {
  if (under(path, '/management')) return path.slice('/management'.length).replace(/^(?=[?#]|$)/, '/') || '/';
  if (under(path, '/sell-with-us')) return path.slice('/sell-with-us'.length).replace(/^\/?/, '/');
  if (path === '/shop-home' || path.startsWith('/shop-home/?') || path === '/shop-home/' || path.startsWith('/shop-home?')) {
    return '/dashboard/' + path.replace(/^\/shop-home\/?/, '');
  }
  if (under(path, OVERVIEW)) return '/Business-Overview' + path.slice(OVERVIEW.length);
  if (under(path, '/shop-home')) return path.slice('/shop-home'.length);
  return path;
}

/** Internal href -> what the browser should show on the current host. */
export function toPublic(href) {
  const host = currentHost();
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return href;
  if (host !== MAIN_HOST && host !== ADMIN_HOST && host !== SHOP_HOST) {
    if (under(href, OVERVIEW)) return '/business-overview' + href.slice(OVERVIEW.length);
    return isShopRoot(href) ? '/dashboard/' + href.replace(/^\/shop-home\/?/, '') : href;
  }
  const target = hostFor(href);
  const path = target === MAIN_HOST ? href : publicPath(href);
  return target === host ? path : `https://${target}${path}`;
}

/** Browser pathname on the current host -> internal pathname. */
export function toInternal(pathname) {
  const host = currentHost();
  if (!pathname) return pathname;
  if (host === ADMIN_HOST) return under(pathname, '/management') ? pathname : '/management' + (pathname === '/' ? '' : pathname);
  if (host === SHOP_HOST) {
    if (pathname === '/') return '/sell-with-us';
    if (under(pathname, '/dashboard')) return '/shop-home' + pathname.slice('/dashboard'.length);
    if (under(pathname, '/Business-Overview')) return OVERVIEW + pathname.slice('/Business-Overview'.length);
    return under(pathname, '/shop-home') ? pathname : '/shop-home' + pathname;
  }
  if (host !== MAIN_HOST && under(pathname, '/business-overview')) return OVERVIEW + pathname.slice('/business-overview'.length);
  if (host !== MAIN_HOST && under(pathname, '/dashboard')) return '/shop-home' + pathname.slice('/dashboard'.length);
  return pathname;
}
