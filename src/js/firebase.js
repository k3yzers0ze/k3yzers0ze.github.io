// Firebase v10 modular SDK — initialization + write-up comment helpers.
// Comments/DB features stay disabled until real config is placed in
// src/data/config.json (see README → "Firebase"). The public web config is
// safe to commit; security is enforced by Realtime Database rules.
import config from '../data/config.json';

const fb = config.firebase || {};
export const firebaseEnabled = !Object.values(fb).some((v) => String(v).startsWith('TODO'));

let _app = null;
let _auth = null;
let _db = null;
let _mods = null;

// Lazy-load the SDK only when a page actually needs it.
async function ensure() {
  if (_app) return _mods;
  const [{ initializeApp }, authMod, dbMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/database'),
  ]);
  _app = initializeApp(fb);
  _auth = authMod.getAuth(_app);
  _db = dbMod.getDatabase(_app);
  _mods = { authMod, dbMod };
  return _mods;
}

export async function signInGoogle() {
  const { authMod } = await ensure();
  return authMod.signInWithPopup(_auth, new authMod.GoogleAuthProvider());
}
export async function signInAnon() {
  const { authMod } = await ensure();
  return authMod.signInAnonymously(_auth);
}
export async function signOut() {
  const { authMod } = await ensure();
  return authMod.signOut(_auth);
}
export async function onAuth(cb) {
  const { authMod } = await ensure();
  return authMod.onAuthStateChanged(_auth, cb);
}

// Live subscription to a write-up's comments (newest first).
export async function watchComments(slug, cb) {
  const { dbMod } = await ensure();
  const r = dbMod.query(dbMod.ref(_db, `comments/${slug}`), dbMod.limitToLast(200));
  return dbMod.onValue(r, (snap) => {
    const items = [];
    snap.forEach((ch) => items.push(ch.val()));
    items.reverse();
    cb(items);
  });
}

export async function postComment(slug, user, body) {
  const { dbMod } = await ensure();
  const r = dbMod.ref(_db, `comments/${slug}`);
  return dbMod.push(r, {
    body: String(body).slice(0, 1000),
    name: (user.displayName || 'anonymous').slice(0, 60),
    uid: user.uid,
    ts: dbMod.serverTimestamp(),
  });
}

// -------- Optional: write-up metadata store (add posts without redeploying) --
// If you push metadata to /writeups in the DB, this merges it with the
// Markdown files bundled at build time. Falls back silently when disabled.
export async function fetchRemoteWriteups() {
  if (!firebaseEnabled) return [];
  try {
    const { dbMod } = await ensure();
    const snap = await dbMod.get(dbMod.ref(_db, 'writeups'));
    if (!snap.exists()) return [];
    return Object.entries(snap.val()).map(([slug, v]) => ({ slug, ...v, remote: true }));
  } catch {
    return [];
  }
}
