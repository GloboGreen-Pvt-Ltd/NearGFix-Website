export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export function setToken(token) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('admin_token', token);
  else localStorage.removeItem('admin_token');
}

export function isAuthenticated() {
  return !!getToken();
}

/**
 * loginType of the signed-in staff account, as returned by /auth/login.
 * SUPER_ADMIN (the platform administrator) or MARKET_PERSON.
 *
 * Used only to decide what to render. Every privileged action is re-checked
 * server-side, so a tampered value here changes the UI and nothing else.
 */
export function getRole() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_role');
}

export function setRole(role) {
  if (typeof window === 'undefined') return;
  if (role) localStorage.setItem('admin_role', role);
  else localStorage.removeItem('admin_role');
}

/** True when the signed-in user may activate/deactivate accounts. */
export function isAdmin() {
  const r = getRole();
  return r === 'SUPER_ADMIN' || r === 'ADMIN';
}
