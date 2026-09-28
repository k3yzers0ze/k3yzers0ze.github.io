// Write-up comments UI. Uses Firebase when configured, otherwise shows a
// graceful "not configured" notice so the site works without a backend.
import { esc, fmtDate } from './util.js';
import {
  firebaseEnabled,
  onAuth,
  signInGoogle,
  signInAnon,
  signOut,
  watchComments,
  postComment,
} from './firebase.js';

export function renderComments(mount, slug) {
  if (!mount) return;

  mount.innerHTML = `
    <div class="shead"><span class="snum">//</span><div class="stitle"><h2>Comments</h2><p class="jp">コメント</p></div><div class="sline"></div></div>`;

  if (!firebaseEnabled) {
    mount.insertAdjacentHTML(
      'beforeend',
      `<div class="panel cm-disabled">
        <strong style="color:var(--text)">Comments are not configured yet.</strong><br/>
        Add your Firebase project values in <code>src/data/config.json</code> and install the
        Realtime Database security rules (see the README → "Firebase"). Until then this section
        stays inert and the site still builds and deploys normally.
      </div>`
    );
    return;
  }

  mount.insertAdjacentHTML(
    'beforeend',
    `<div class="panel cm-form">
      <div data-auth>
        <p class="cm-note">Sign in to leave a comment.</p>
        <div class="cm-row">
          <button class="btn ghost" type="button" data-google>Sign in with Google</button>
          <button class="btn ghost" type="button" data-anon>Continue anonymously</button>
        </div>
      </div>
      <div data-editor hidden>
        <textarea data-text maxlength="1000" placeholder="Share a thought, a correction, or a better payload…"></textarea>
        <div class="cm-row">
          <span class="cm-note" data-as></span>
          <span style="display:flex;gap:.6rem">
            <button class="btn ghost" type="button" data-signout>Sign out</button>
            <button class="btn" type="button" data-post>Post comment</button>
          </span>
        </div>
      </div>
      <p class="cm-note" data-status role="status" style="margin-top:.6rem"></p>
    </div>
    <div class="cm-list" data-list><p class="cm-note">Loading comments…</p></div>`
  );

  const q = (s) => mount.querySelector(s);
  const status = (m) => (q('[data-status]').textContent = m || '');
  let user = null;

  onAuth((u) => {
    user = u;
    q('[data-auth]').hidden = !!u;
    q('[data-editor]').hidden = !u;
    if (u) q('[data-as]').textContent = `posting as ${u.displayName || 'anonymous'}`;
  }).catch((e) => status(e.message));

  q('[data-google]').addEventListener('click', () => { status(''); signInGoogle().catch((e) => status(e.message)); });
  q('[data-anon]').addEventListener('click', () => { status(''); signInAnon().catch((e) => status(e.message)); });
  q('[data-signout]').addEventListener('click', () => signOut());
  q('[data-post]').addEventListener('click', () => {
    const body = q('[data-text]').value.trim();
    if (!body) return status('Write something first.');
    if (!user) return status('Sign in first.');
    status('Posting…');
    postComment(slug, user, body)
      .then(() => { q('[data-text]').value = ''; status('Posted.'); })
      .catch((e) => status(e.message));
  });

  watchComments(slug, (items) => {
    const list = q('[data-list]');
    if (!items.length) { list.innerHTML = '<p class="cm-note">No comments yet — be the first.</p>'; return; }
    list.innerHTML = items
      .map(
        (c) => `<div class="panel cm-item">
          <div class="meta"><span class="who">${esc(c.name || 'anonymous')}</span><span class="when">${esc(c.ts ? fmtDate(c.ts) : '')}</span></div>
          <div class="body">${esc(c.body || '')}</div>
        </div>`
      )
      .join('');
  }).catch((e) => status(e.message));
}
