// Admin auth state (Phase 3.2). Wraps firebase.js auth and caches the `isAdmin`
// flag in localStorage so the UI can render the admin state instantly on refresh
// without waiting for Firebase to re-hydrate. The cache is a UI convenience only —
// all real authorization is enforced server-side by the database rules (UID match).
import { firebaseEnabled, onAuth, signInEmail, signOutUser } from './firebase.js';

// Must match the UID in database.rules.json.
export const ADMIN_UID = 'lEsVOWrpNQPh06Ii7hMqXgap63J2';
export const ADMIN_EMAIL = 't.aymen404@proton.me';
const KEY = 'gp_admin';

const state = { user: null, isAdmin: false, ready: false };
const listeners = new Set();
let started = null;

export function isAdmin() { return state.isAdmin; }
export function currentUser() { return state.user; }

export function cachedIsAdmin() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

// Instant, SDK-free admin hint from the localStorage cache. Used on every page
// load so we DON'T pull the Firebase auth SDK for ordinary visitors. Real
// verification happens via initAuth() when the admin panel opens.
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

// Idempotent: the auth SDK loads and subscribes once per page lifetime.
export function initAuth() {
  if (!firebaseEnabled) return Promise.resolve();
  started ??= onAuth((u) => setAdmin(!!(u && u.uid === ADMIN_UID), u)).catch((e) => {
    started = null;
    throw e;
  });
  return started;
}

export async function adminSignIn(email, password) {
  return signInEmail(email, password);
}
export async function adminSignOut() {
  try { localStorage.setItem(KEY, '0'); } catch {}
  return signOutUser();
}
