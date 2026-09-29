// Firebase v10 modular SDK — configuration + helpers.
//
// Config is read from Vite env vars (VITE_FIREBASE_*), injected at build time
// from GitHub Secrets (see .env.example and .github/workflows/deploy.yml).
// Firebase WEB config is not secret — security is enforced by the Realtime
// Database rules in database.rules.json (admin-only writes, public reads).
//
// Everything stays disabled (firebaseEnabled === false) until the env vars are
// present, so the site builds and runs without a backend.

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfig = cfg;
export const firebaseEnabled = Object.values(cfg).every((v) => v && !String(v).startsWith('TODO'));

let _app = null;
let _auth = null;
let _db = null;
let _mods = null;

// Lazy-load the SDK only when something actually needs it.
async function ensure() {
  if (!firebaseEnabled) throw new Error('Firebase is not configured.');
  if (_app) return _mods;
  const [{ initializeApp }, authMod, dbMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/database'),
  ]);
  _app = initializeApp(cfg);
  _auth = authMod.getAuth(_app);
  _db = dbMod.getDatabase(_app);
  _mods = { authMod, dbMod };
  return _mods;
}

/* -------------------------------------------------------------- Auth (admin) */
export async function signInEmail(email, password) {
  const { authMod } = await ensure();
  return authMod.signInWithEmailAndPassword(_auth, email, password);
}
export async function signOutUser() {
  const { authMod } = await ensure();
  return authMod.signOut(_auth);
}
export async function onAuth(cb) {
  const { authMod } = await ensure();
  return authMod.onAuthStateChanged(_auth, cb);
}

/* --------------------------------------------------------------- DB reads --- */
export async function readOnce(path) {
  const { dbMod } = await ensure();
  const snap = await dbMod.get(dbMod.ref(_db, path));
  return snap.exists() ? snap.val() : null;
}
export async function watch(path, cb) {
  const { dbMod } = await ensure();
  return dbMod.onValue(dbMod.ref(_db, path), (snap) => cb(snap.exists() ? snap.val() : null));
}

/* --------------------------------------------------------- DB writes (admin) */
export async function writeData(path, value) {
  const { dbMod } = await ensure();
  return dbMod.set(dbMod.ref(_db, path), value);
}
export async function updateData(path, value) {
  const { dbMod } = await ensure();
  return dbMod.update(dbMod.ref(_db, path), value);
}
export async function removeData(path) {
  const { dbMod } = await ensure();
  return dbMod.remove(dbMod.ref(_db, path));
}
