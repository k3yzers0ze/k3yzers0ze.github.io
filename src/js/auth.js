// Admin auth state (Phase 3.2). Wraps firebase.js auth and caches the `isAdmin`
// flag in localStorage so the UI can render the admin state instantly on refresh
// without waiting for Firebase to re-hydrate. The cache is a UI convenience only —
// all real authorization is enforced server-side by the database rules.
import { firebaseEnabled, onAuth, signInEmail, signOutUser } from './firebase.js';

export const ADMIN_EMAIL = 't.aymen404@proton.me';
const KEY = 'gp_admin';

const state = { user: null, isAdmin: false, ready: false };
const listeners = new Set();

export function isAdmin() { return state.isAdmin; }
export function currentUser() { return state.user; }

export function cachedIsAdmin() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

// Instant, SDK-free admin hint from the localStorage cache. Used on every page
// load so we DON'T pull the Firebase auth SDK for ordinary visitors. Real
// verification happens later via initAuth() when the admin panel needs it.
export function hydrateAdminFromCache() {
  state.isAdmin = cachedIsAdmin();
  return state.isAdmin;
}

export function onAdminChange(cb) {
  listeners.add(cb);
  cb({ ...state });
  return () => listeners.delete(cb);
}

function setAdmin(v, user) {
  state.isAdmin = v;
  state.user = user || null;
  state.ready = true;
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch {}
  listeners.forEach((cb) => cb({ ...state }));
}

export async function initAuth() {
  if (!firebaseEnabled) return;
  // optimistic paint from cache while Firebase re-hydrates
  state.isAdmin = cachedIsAdmin();
  try {
    await onAuth((u) => {
      const ok = !!(u && u.emailVerified && u.email === ADMIN_EMAIL);
      setAdmin(ok, u);
    });
  } catch {
    /* offline / SDK unavailable — keep cached optimistic value */
  }
}

export async function adminSignIn(email, password) {
  return signInEmail(email, password);
}
export async function adminSignOut() {
  try { localStorage.setItem(KEY, '0'); } catch {}
  return signOutUser();
}
