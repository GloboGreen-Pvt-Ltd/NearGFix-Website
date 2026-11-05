import { toInternal, toPublic } from '@/lib/portalUrl';
// IMPORTANT: Next.js only inlines NEXT_PUBLIC_* env vars into the client bundle when
// they are referenced as STATIC literals (process.env.NEXT_PUBLIC_FOO). A dynamic
// lookup such as process.env[`NEXT_PUBLIC_${key}`] is NOT inlined, so in the browser
// it returns undefined and every base silently falls back to LIVE_BASE. Each var must
// therefore be spelled out below. With output:'export' these are baked in at BUILD time.
//
// PATH SHAPE — master-data is the exception, every other service is uniform.
//
// Most nginx locations at the edge use a trailing-slash proxy_pass, which STRIPS
// the matched prefix before forwarding:
//   location /auth/ { proxy_pass http://127.0.0.1:8081/; }   /auth/auth/login -> :8081/auth/login
// The Spring controller is @RequestMapping("/auth"), so the service name has to
// appear TWICE in the wire URL — once for nginx to route on, once for the mapping.
// That is why those bases keep their /<service> suffix and the call sites add it
// again.
//
// master-data-service (8091) is special-cased at the edge precisely so the public
// path does NOT have to double up:
//   location /master/       { proxy_pass http://127.0.0.1:8091/master/; }  /master/brands -> :8091/master/brands
//   location /master/media/ { proxy_pass http://127.0.0.1:8091/media/;  }  /master/media/upload -> :8091/media/upload
// So MASTER_BASE is the bare host and the call sites supply the whole public path:
//   MASTER_BASE() + '/master/brands' -> https://api.neargfix.com/master/brands
// Verified 2026-08-04 against the live edge: /master/brands 200, /master/media/ping
// 200, /media/ping 404 (media is only reachable under the /master routing prefix).
const EDGE = 'https://api.neargfix.com';
const pick = (value, fallback) => (value && value.trim()) || fallback;

// Tolerate a deploy variable still carrying the old `/master` suffix. The edge now
// routes /master/* by itself, so leaving the suffix on would double the segment and
// — worse — push media to /master/master/media/upload, which 404s. Normalising here
// keeps the app correct whether or not NEXT_PUBLIC_MASTER_DATA_BASE has been updated.
const stripMasterSuffix = (value) => value.replace(/\/+$/, '').replace(/\/master$/, '');

export const MASTER_BASE = () =>
  stripMasterSuffix(
    pick(
      process.env.NEXT_PUBLIC_MASTER_DATA_BASE ||
        process.env.NEXT_PUBLIC_API_BASE ||
        process.env.NEXT_PUBLIC_API_BASE_URL,
      EDGE,
    ),
  );

// Media is @RequestMapping("/media") on master-data-service, NOT under /master.
// Talking to the service DIRECTLY (http://localhost:8091) hits that mapping as-is,
// but the edge only exposes it beneath the /master routing prefix
// (location /master/media/ -> :8091/media/), so the public path needs the prefix.
// Detect by port: a direct origin always names one, the edge is plain 443.
// Centralised here so this one odd path lives in a single place rather than being
// respelled at each upload call site.
const isDirectServiceOrigin = (base) => /:\d+$/.test(base);
export const MEDIA_UPLOAD_URL = () => {
  const base = MASTER_BASE();
  return isDirectServiceOrigin(base) ? `${base}/media/upload` : `${base}/master/media/upload`;
};

// master-data-service requires an authenticated request on /media/upload (it
// writes into the paid S3 bucket), so every caller must send the admin's
// Bearer token — a plain `fetch(MEDIA_UPLOAD_URL())` 403s. Centralised here
// after the same missing-header bug turned up independently in three admin
// pages (shops/edit, shops/view, shops/new-owner).
// `document: true` is for fields that are routinely scanned to PDF (KYC,
// GST/Udyam certificates) — it tells the backend to allow application/pdf
// alongside images. Leave it false for pure artwork (avatar, shop front/banner).
export async function uploadMedia(file, folder, { document = false } = {}) {
  if (!file) return null;
  const fd = new FormData();
  fd.append('file', file);
  if (folder) fd.append('folder', folder);
  if (document) fd.append('allowDocument', 'true');
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  const res = await fetch(MEDIA_UPLOAD_URL(), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return (await res.json())?.url || null;
}
export const AUTH_BASE = () => pick(process.env.NEXT_PUBLIC_AUTH_BASE, `${EDGE}/auth`);
export const TICKET_BASE = () => pick(process.env.NEXT_PUBLIC_TICKET_BASE, `${EDGE}/ticket`);
export const USER_BASE = () => pick(process.env.NEXT_PUBLIC_USER_BASE, `${EDGE}/user`);
export const SHOP_BASE = () => pick(process.env.NEXT_PUBLIC_SHOP_BASE, `${EDGE}/shop`);
export const TECHNICIAN_BASE = () => pick(process.env.NEXT_PUBLIC_TECHNICIAN_BASE, `${EDGE}/technician`);
export const INVENTORY_BASE = () => pick(process.env.NEXT_PUBLIC_INVENTORY_BASE, `${EDGE}/inventory`);
export const MARKETPLACE_BASE = () => pick(process.env.NEXT_PUBLIC_MARKETPLACE_BASE, `${EDGE}/marketplace`);
export const PICKUP_BASE = () => pick(process.env.NEXT_PUBLIC_PICKUP_BASE, `${EDGE}/pickup`);
export const NOTIFICATION_BASE = () => pick(process.env.NEXT_PUBLIC_NOTIFICATION_BASE, `${EDGE}/notification`);
export const SUBSCRIPTION_BASE = () => pick(process.env.NEXT_PUBLIC_SUBSCRIPTION_BASE, `${EDGE}/subscription`);
export const ORDER_BASE = () => pick(process.env.NEXT_PUBLIC_ORDER_BASE, `${EDGE}/order`);

async function request(base, path, options = {}) {
  const url = `${base.replace(/\/$/, '')}${path}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  const { skipAuthRedirect, ...fetchOptions } = options;
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...fetchOptions.headers,
  };
  const res = await fetch(url, { ...fetchOptions, headers });
  if (!res.ok) {
    // Consume the body ONCE as text, then try to parse JSON from it. The old
    // code did `res.json()` then `res.text()` in a catch — both read the same
    // stream, so the second call throws "body stream already read" and the
    // user sees that bogus error instead of the real failure.
    const raw = await res.text().catch(() => '');
    let body = raw;
    if (raw) {
      try { body = JSON.parse(raw); } catch { /* keep raw text */ }
    }

    // Auth failure: drop the (now-invalid) token, surface a friendly message,
    // and kick the user to /management. Callers that hit endpoints which don't
    // require auth (like master-data /master/**) pass skipAuthRedirect:true so
    // a 401 from a misrouted/cold service doesn't bounce the whole page.
    //
    // Only a 401 ends the session. A 403 means the token is perfectly valid and
    // the server simply refused this action for this role — e.g. a MARKET_PERSON
    // attempting an ADMIN-only account-status change. Logging them out for that
    // would be wrong and confusing; we keep the session and let the caller show
    // the permission message built below.
    if (res.status === 401 || res.status === 403) {
      if (res.status === 401 && !skipAuthRedirect && typeof window !== 'undefined') {
        try { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_role'); } catch {}
        // The login page IS /management/ and every portal page lives under it
        // (/management/dashboard/, /management/models/, …), so this must be an
        // EXACT match. A startsWith() here would be true everywhere in the
        // portal and the 401 bounce would never fire. trailingSlash:true means
        // the served path has a trailing slash, hence the strip.
        const onLogin = toInternal(window.location.pathname).replace(/\/+$/, '') === '/management';
        if (!onLogin) {
          const returnTo = encodeURIComponent(toInternal(window.location.pathname) + window.location.search);
          // Defer so the caller's error handler can still run + render the toast.
          setTimeout(() => { window.location.assign(toPublic(`/management/?returnTo=${returnTo}`)); }, 50);
        }
      }
      const where = `${options.method || 'GET'} ${path}`;
      const serverHint = (body && typeof body === 'object' && (body.message || body.error)) || '';
      let msg;
      if (res.status === 401) {
        msg = skipAuthRedirect
          ? `Master service not reachable (401 from ${where})`
          : 'Session expired or not signed in. Redirecting to login…';
      } else {
        // 403
        msg = skipAuthRedirect
          ? `Master service blocked the request (403 from ${where}). The service likely needs a restart.`
          : `You don't have permission to do that. (${where}${serverHint ? ' — ' + serverHint : ''})`;
      }
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      // eslint-disable-next-line no-console
      console.error('[api]', res.status, where, body);
      throw err;
    }

    const apiMsg =
      (body && typeof body === 'object' && (body.message || body.error)) ||
      (typeof body === 'string' && body.trim() ? body : null);
    const err = new Error(
      apiMsg ||
        `${options.method || 'GET'} ${path} failed: ${res.status}${res.statusText ? ' ' + res.statusText : ''}`,
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) return res.json();
  return res.text();
}

// Master-data endpoints are permitAll on the backend (see SecurityConfig).
// We pass skipAuthRedirect so a 401 here never kicks the user to /management —
// most likely cause of a 401 from /master is that the service hasn't been
// restarted with the latest endpoints, or a gateway is misrouting the path.
export const masterApi = {
  get: (path) => request(MASTER_BASE(), path, { skipAuthRedirect: true }),
  post: (path, body) => request(MASTER_BASE(), path, { method: 'POST', body: JSON.stringify(body), skipAuthRedirect: true }),
  put: (path, body) => request(MASTER_BASE(), path, { method: 'PUT', body: JSON.stringify(body), skipAuthRedirect: true }),
  patch: (path, body) => request(MASTER_BASE(), path, { method: 'PATCH', body: JSON.stringify(body), skipAuthRedirect: true }),
  delete: (path) => request(MASTER_BASE(), path, { method: 'DELETE', skipAuthRedirect: true }),
};

export const authApi = {
  get: (path) => request(AUTH_BASE(), path),
  post: (path, body) => request(AUTH_BASE(), path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(AUTH_BASE(), path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(AUTH_BASE(), path, { method: 'DELETE' }),
};

export const ticketApi = {
  get: (path) => request(TICKET_BASE(), path),
  post: (path, body) => request(TICKET_BASE(), path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(TICKET_BASE(), path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(TICKET_BASE(), path, { method: 'PATCH', body: JSON.stringify(body) }),
};

export const shopApi = {
  get: (path) => request(SHOP_BASE(), path),
  post: (path, body) => request(SHOP_BASE(), path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(SHOP_BASE(), path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(SHOP_BASE(), path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(SHOP_BASE(), path, { method: 'DELETE' }),
};

export const subscriptionApi = {
  get: (path) => request(SUBSCRIPTION_BASE(), path),
  post: (path, body) => request(SUBSCRIPTION_BASE(), path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(SUBSCRIPTION_BASE(), path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(SUBSCRIPTION_BASE(), path, { method: 'PATCH', body: JSON.stringify(body) }),
};

// Subscription v2 management routes (admin JWT; every write is audit-logged
// server-side). Money is integer paise; Razorpay keys/secrets are env-only on
// the server and never sent to or from this client.
const ADMIN_SUB = '/subscriptions/admin';
const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};
export const subscriptionAdminApi = {
  plans: () => subscriptionApi.get(`${ADMIN_SUB}/plans`),
  createPlan: (plan) => subscriptionApi.post(`${ADMIN_SUB}/plans`, plan),
  updatePlan: (id, plan) => subscriptionApi.put(`${ADMIN_SUB}/plans/${id}`, plan),
  setPlanStatus: (id, status) => subscriptionApi.patch(`${ADMIN_SUB}/plans/${id}/status`, { status }),
  updatePricing: (items) => subscriptionApi.put(`${ADMIN_SUB}/pricing`, { items }),
  subscriptions: (status, q) => subscriptionApi.get(`${ADMIN_SUB}/subscriptions${qs({ status, q })}`),
  subscription: (id) => subscriptionApi.get(`${ADMIN_SUB}/subscriptions/${id}`),
  extend: (id, body) => subscriptionApi.post(`${ADMIN_SUB}/subscriptions/${id}/extend`, body),
  cancel: (id, reason) => subscriptionApi.post(`${ADMIN_SUB}/subscriptions/${id}/cancel`, { reason }),
  manualActivate: (body) => subscriptionApi.post(`${ADMIN_SUB}/subscriptions/manual-activate`, body),
  payments: (status, q) => subscriptionApi.get(`${ADMIN_SUB}/payments${qs({ status, q })}`),
  refund: (paymentId, body) => subscriptionApi.post(`${ADMIN_SUB}/payments/${paymentId}/refund`, body),
  settings: () => subscriptionApi.get(`${ADMIN_SUB}/settings`),
  saveSettings: (body) => subscriptionApi.put(`${ADMIN_SUB}/settings`, body),
  auditLogs: (limit) => subscriptionApi.get(`${ADMIN_SUB}/audit-logs${qs({ limit })}`),
  quotePreview: (planCode, shopCount) => subscriptionApi.post('/subscriptions/quote/preview', { planCode, shopCount }),
  receipt: (paymentId) => subscriptionApi.get(`/subscriptions/receipts/${paymentId}`),
};
