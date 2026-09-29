// Firebase v10 modular SDK — configuration + helpers.
//
// Config is read from Vite env vars (VITE_FIREBASE_*), injected at build time
// from GitHub Secrets (see .env.example and .github/workflows/deploy.yml).
// Firebase WEB config is not secret — security is enforced by the Realtime
// Database rules in database.rules.json (UID-gated admin writes).
//
// The database and auth SDKs load independently and only on demand, so a
// visitor reading posts never downloads the auth SDK.

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfig = cfg;
export const firebaseEnabled = Object.values(cfg).every((v) => v && !String(v).startsWith('TODO'));

let appP = null;
let dbP = null;
let authP = null;
let dbMod = null;
let authMod = null;

function getApp() {
  appP ??= (async () => {
    if (!firebaseEnabled) throw new Error('Firebase is not configured.');
    const { initializeApp } = await import('firebase/app');
    return initializeApp(cfg);
  })();
  return appP;
}

function getDb() {
  dbP ??= (async () => {
    const [app, m] = await Promise.all([getApp(), import('firebase/database')]);
    dbMod = m;
    return m.getDatabase(app);
  })();
  return dbP;
}

function getAuthInstance() {
  authP ??= (async () => {
    const [app, m] = await Promise.all([getApp(), import('firebase/auth')]);
    authMod = m;
    return m.getAuth(app);
  })();
  return authP;
}

/* -------------------------------------------------------------- Auth (admin) */
export async function signInEmail(email, password) {
  const a = await getAuthInstance();
  return authMod.signInWithEmailAndPassword(a, email, password);
}
export async function signOutUser() {
  const a = await getAuthInstance();
  return authMod.signOut(a);
}
export async function onAuth(cb) {
  const a = await getAuthInstance();
  return authMod.onAuthStateChanged(a, cb);
}

/* --------------------------------------------------------------- DB reads --- */
export async function readOnce(path) {
  const d = await getDb();
  const snap = await dbMod.get(dbMod.ref(d, path));
  return snap.exists() ? snap.val() : null;
}

// Public listing: the rules only allow this exact query for non-admins, so
// unpublished drafts are never sent to visitors.
export async function readPublishedPosts() {
  const d = await getDb();
  const q = dbMod.query(dbMod.ref(d, 'posts'), dbMod.orderByChild('published'), dbMod.equalTo(true));
  const snap = await dbMod.get(q);
  return snap.exists() ? snap.val() : null;
}

export async function watch(path, cb) {
  const d = await getDb();
  return dbMod.onValue(dbMod.ref(d, path), (snap) => cb(snap.exists() ? snap.val() : null));
}

/* --------------------------------------------------------- DB writes (admin) */
export async function writeData(path, value) {
  const d = await getDb();
  return dbMod.set(dbMod.ref(d, path), value);
}
export async function updateData(path, value) {
  const d = await getDb();
  return dbMod.update(dbMod.ref(d, path), value);
}
export async function removeData(path) {
  const d = await getDb();
  return dbMod.remove(dbMod.ref(d, path));
}
