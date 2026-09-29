// Admin dashboard (#/admin): login, KPIs, tag chart, and posts CRUD.
// Every write is authorized server-side by the UID rule in database.rules.json —
// this UI only decides what to show.
import config from '../data/config.json';
import skills from '../data/skills.json';
import { firebaseEnabled, readOnce, writeData, removeData } from './firebase.js';
import { initAuth, onAdminChange, adminSignIn, adminSignOut, ADMIN_EMAIL } from './auth.js';
import { writeups as bundled, invalidateWriteups } from './writeups.js';
import { localViews } from './analytics.js';
import { barChart } from './components/Chart.js';
import { esc, fmtDate } from './util.js';

let unsubscribe = null;

export async function renderAdmin(root) {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  root.innerHTML = '<div class="wrap adm"><div id="adm"></div></div>';
  const mount = root.querySelector('#adm');

  if (!firebaseEnabled) {
    mount.innerHTML = `<div class="panel adm-login"><h2>Admin</h2><p class="cm-note" style="margin-top:1rem">
      Firebase isn't configured in this build, so the admin panel is unavailable.
      Set the <code>FIREBASE</code> secret (or <code>.env</code> locally) and rebuild.</p></div>`;
    return;
  }

  mount.innerHTML = '<p class="cm-note">Connecting…</p>';
  try {
    await initAuth();
  } catch (e) {
    mount.innerHTML = `<p class="err">Could not reach Firebase: ${esc(e.message)}</p>`;
    return;
  }

  unsubscribe = onAdminChange((st) => {
    if (!mount.isConnected) { unsubscribe?.(); unsubscribe = null; return; }
    if (!st.ready) return;
    if (st.user && st.isAdmin) dashboard(mount);
    else if (st.user) denied(mount);
    else login(mount);
  });
}

/* ------------------------------------------------------------------ login -- */
function login(mount) {
  mount.innerHTML = `
    <div class="panel adm-login">
      <h2>Admin Access</h2>
      <p class="jp" style="font-family:var(--mono);font-size:.58rem;letter-spacing:.4em;color:var(--sakura);margin:.4rem 0 1.6rem">管理者</p>
      <form novalidate>
        <div class="field"><label for="adm-email">Email</label>
          <input id="adm-email" type="email" name="email" autocomplete="username" required value="${esc(ADMIN_EMAIL)}" /></div>
        <div class="field"><label for="adm-pass">Password</label>
          <input id="adm-pass" type="password" name="password" autocomplete="current-password" required /></div>
        <button class="btn" type="submit">Sign in</button>
        <p class="err" role="alert"></p>
      </form>
    </div>`;

  const form = mount.querySelector('form');
  const err = mount.querySelector('.err');
  form.querySelector('#adm-pass').focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    btn.disabled = true;
    err.textContent = '';
    try {
      await adminSignIn(form.email.value.trim(), form.password.value);
      // onAdminChange re-renders into the dashboard.
    } catch (ex) {
      // Deliberately generic — don't reveal whether the email or password was wrong.
      err.textContent = ex?.code === 'auth/too-many-requests'
        ? 'Too many attempts. Try again later.'
        : 'Sign-in failed. Check your credentials.';
      btn.disabled = false;
    }
  });
}

function denied(mount) {
  mount.innerHTML = `<div class="panel adm-login"><h2>Not authorized</h2>
    <p class="cm-note" style="margin:1rem 0">This account isn't the site admin.</p>
    <button class="btn ghost" type="button" data-out>Sign out</button></div>`;
  mount.querySelector('[data-out]').addEventListener('click', () => adminSignOut());
}

/* -------------------------------------------------------------- dashboard -- */
async function dashboard(mount) {
  mount.innerHTML = '<p class="cm-note">Loading dashboard…</p>';
  let posts = {};
  try {
    posts = (await readOnce('posts')) || {};
  } catch (e) {
    mount.innerHTML = `<p class="err">Could not load posts: ${esc(e.message)}. Are the database rules published?</p>`;
    return;
  }

  const dbSlugs = new Set(Object.keys(posts));
  const dbList = Object.entries(posts).map(([slug, p]) => ({ slug, ...p, source: 'db' }));
  const bundledOnly = bundled.filter((w) => !dbSlugs.has(w.slug)).map((w) => ({
    slug: w.slug, title: w.title, date: w.date, excerpt: w.summary, tags: w.tags, mitre: w.mitre,
    platform: w.platform, difficulty: w.difficulty, published: true, source: 'bundled',
  }));
  const all = [...dbList, ...bundledOnly].sort((a, b) => new Date(b.date) - new Date(a.date));

  const published = dbList.filter((p) => p.published).length;
  const kpis = [
    { b: all.length, s: 'total posts' },
    { b: published, s: 'db published' },
    { b: dbList.length - published, s: 'db drafts' },
    { b: bundledOnly.length, s: 'bundled' },
    { b: skills.length, s: 'skills' },
    { b: config.certs.length, s: 'certs' },
    { b: localViews(), s: 'views (this browser)' },
  ];

  const tagCounts = {};
  all.forEach((p) => (Array.isArray(p.tags) ? p.tags : []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const tagData = Object.entries(tagCounts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  mount.innerHTML = `
    <div class="adm-h">
      <div>
        <p class="phead-k" style="margin-bottom:.6rem">// admin · 管理</p>
        <h2 style="font-family:var(--display);font-size:clamp(2rem,5vw,3rem);line-height:1;text-transform:uppercase">Dashboard</h2>
      </div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap">
        <button class="btn" type="button" data-new>+ New post</button>
        <button class="btn ghost" type="button" data-out>Sign out</button>
      </div>
    </div>

    <div class="kpis">${kpis.map((k) => `<div class="kpi panel"><b>${esc(k.b)}</b><s>${esc(k.s)}</s></div>`).join('')}</div>

    <div class="acard panel">
      <h3>Posts by tag</h3>
      <canvas class="chart" aria-label="Posts by tag bar chart" role="img"></canvas>
    </div>

    <div class="acard panel" data-editor hidden></div>

    <div class="acard panel">
      <h3>Posts</h3>
      <div class="table-wrap"><table class="atable">
        <thead><tr><th>Title</th><th class="hide-sm">Date</th><th>Status</th><th></th></tr></thead>
        <tbody>${all.map(row).join('') || '<tr><td colspan="4" class="cm-note">No posts yet.</td></tr>'}</tbody>
      </table></div>
      <p class="cm-note" style="margin-top:.8rem">Bundled posts live in <code>src/data/writeups/</code>. Editing one saves a DB copy that overrides it.</p>
    </div>`;

  barChart(mount.querySelector('.chart'), tagData);

  mount.querySelector('[data-out]').addEventListener('click', () => adminSignOut());
  mount.querySelector('[data-new]').addEventListener('click', () => openEditor(mount, null));
  mount.querySelector('tbody').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const slug = b.dataset.slug;
    if (b.dataset.act === 'edit') {
      const p = all.find((x) => x.slug === slug);
      openEditor(mount, p);
    } else if (b.dataset.act === 'del') {
      if (!confirm(`Delete "${slug}" from the database? This can't be undone.`)) return;
      b.disabled = true;
      try {
        await removeData(`posts/${slug}`);        // hide first…
        await removeData(`postContent/${slug}`);  // …then drop content
        invalidateWriteups();
        dashboard(mount);
      } catch (ex) {
        alert(`Delete failed: ${ex.message}`);
        b.disabled = false;
      }
    }
  });
}

function row(p) {
  const badge = p.source === 'bundled'
    ? '<span class="badge bun">bundled</span>'
    : p.published ? '<span class="badge pub">published</span>' : '<span class="badge draft">draft</span>';
  return `<tr>
    <td><a href="#/w/${esc(p.slug)}">${esc(p.title || p.slug)}</a><br/><span class="cm-note">${esc(p.slug)}</span></td>
    <td class="hide-sm">${esc(p.date ? fmtDate(p.date) : '')}</td>
    <td>${badge}</td>
    <td class="act">
      <button class="mini" type="button" data-act="edit" data-slug="${esc(p.slug)}">edit</button>
      ${p.source === 'db' ? `<button class="mini dan" type="button" data-act="del" data-slug="${esc(p.slug)}">delete</button>` : ''}
    </td>
  </tr>`;
}

/* ----------------------------------------------------------------- editor -- */
async function openEditor(mount, p) {
  const ed = mount.querySelector('[data-editor]');
  const isNew = !p;
  const join = (v) => (Array.isArray(v) ? v.join(', ') : v || '');

  let content = '';
  if (p?.source === 'db') {
    try { content = (await readOnce(`postContent/${p.slug}`)) || ''; } catch {}
  }
  if (!content && p) content = bundled.find((w) => w.slug === p.slug)?.body || '';

  ed.hidden = false;
  ed.innerHTML = `
    <h3>${isNew ? 'New post' : `Edit · ${esc(p.slug)}`}</h3>
    <form novalidate>
      <div class="row2">
        <div class="field"><label>Slug (URL)</label>
          <input name="slug" required pattern="[a-z0-9-]{1,80}" value="${esc(p?.slug || '')}" ${isNew ? '' : 'readonly'} placeholder="my-htb-box" /></div>
        <div class="field"><label>Date</label>
          <input name="date" type="date" required value="${esc((p?.date || new Date().toISOString()).slice(0, 10))}" /></div>
      </div>
      <div class="field"><label>Title</label><input name="title" required maxlength="200" value="${esc(p?.title || '')}" /></div>
      <div class="field"><label>Excerpt</label><textarea name="excerpt" rows="2" maxlength="500">${esc(p?.excerpt || '')}</textarea></div>
      <div class="row2">
        <div class="field"><label>Tags (comma-separated)</label><input name="tags" value="${esc(join(p?.tags))}" /></div>
        <div class="field"><label>MITRE IDs (comma-separated)</label><input name="mitre" value="${esc(join(p?.mitre))}" /></div>
      </div>
      <div class="row2">
        <div class="field"><label>Platform</label><input name="platform" maxlength="80" value="${esc(p?.platform || '')}" /></div>
        <div class="field"><label>Difficulty</label><input name="difficulty" maxlength="40" value="${esc(p?.difficulty || '')}" /></div>
      </div>
      <div class="field"><label>Content (Markdown)</label><textarea name="content" rows="18">${esc(content)}</textarea></div>
      <div class="field check"><input id="adm-pub" type="checkbox" name="published" ${p?.published !== false ? 'checked' : ''} />
        <label for="adm-pub">Published (unchecked = draft, hidden from visitors)</label></div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
        <button class="btn" type="submit">Save</button>
        <button class="btn ghost" type="button" data-cancel>Cancel</button>
        <span class="err" role="status"></span>
      </div>
    </form>`;
  ed.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const form = ed.querySelector('form');
  const msg = ed.querySelector('.err');
  ed.querySelector('[data-cancel]').addEventListener('click', () => { ed.hidden = true; ed.innerHTML = ''; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const slug = f.slug.value.trim().toLowerCase();
    const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

    if (!/^[a-z0-9-]{1,80}$/.test(slug)) { msg.textContent = 'Slug: lowercase letters, digits and dashes only.'; return; }
    if (!f.title.value.trim()) { msg.textContent = 'Title is required.'; return; }
    if (isNew && !confirm(`Create post "${slug}"? If a DB post with this slug exists it will be overwritten.`)) return;

    const meta = {
      title: f.title.value.trim().slice(0, 200),
      date: f.date.value,
      excerpt: f.excerpt.value.trim().slice(0, 500),
      published: f.published.checked,
      updatedAt: Date.now(),
    };
    const tags = list(f.tags.value);
    const mitre = list(f.mitre.value);
    if (tags.length) meta.tags = tags;
    if (mitre.length) meta.mitre = mitre;
    if (f.platform.value.trim()) meta.platform = f.platform.value.trim();
    if (f.difficulty.value.trim()) meta.difficulty = f.difficulty.value.trim();

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    msg.textContent = 'Saving…';
    try {
      await writeData(`postContent/${slug}`, f.content.value); // content first…
      await writeData(`posts/${slug}`, meta);                   // …then make it visible
      invalidateWriteups();
      dashboard(mount);
    } catch (ex) {
      msg.textContent = `Save failed: ${ex.message}`;
      btn.disabled = false;
    }
  });
}
