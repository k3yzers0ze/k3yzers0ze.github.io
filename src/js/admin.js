// Admin dashboard (#/admin).
// Tabs: Write-ups (Firebase CRUD, live) and Certificates (UI ready; database
// sync is wired in Phase 3). Every write is authorized server-side by the UID
// rule in database.rules.json — this UI only decides what to show.
import config from '../data/config.json';
import skills from '../data/skills.json';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { firebaseEnabled, readOnce, writeData, removeData } from './firebase.js';
import { initAuth, onAdminChange, adminSignIn, adminSignOut, ADMIN_EMAIL } from './auth.js';
import { writeups as bundled, invalidateWriteups } from './writeups.js';
import { localViews } from './analytics.js';
import { barChart } from './components/Chart.js';
import { toast } from './components/Toast.js';
import { openDrawer, confirmDialog } from './components/Drawer.js';
import { esc, fmtDate, safeUrl } from './util.js';

/* ------------------------------------------------------------------ state -- */
let unsubscribe = null;
let currentView = null; // 'login' | 'denied' | 'dashboard'
const state = { tab: 'writeups', filter: '', posts: {}, rows: { writeups: [], certs: [] } };

const SLUG_RE = /^[a-z0-9-]{1,80}$/;
const CERTS_LIVE = false; // flipped on in Phase 3 when certs sync to Firebase

const slugify = (s) =>
  String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const toList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

const ICON = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3m-7 0l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  view: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

/** Turn Firebase/network errors into something actionable. */
function fbError(e) {
  const raw = String(e?.code || e?.message || e || '');
  if (/permission[_ -]?denied/i.test(raw)) return 'Permission denied — publish the latest database.rules.json in the Firebase console.';
  if (/network|offline|unavailable|failed to fetch/i.test(raw)) return 'Network error — check your connection and try again.';
  if (/too-many-requests/i.test(raw)) return 'Too many attempts. Wait a minute and try again.';
  return e?.message || 'Something went wrong.';
}

/* ------------------------------------------------------------------ entry -- */
export async function renderAdmin(root) {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentView = null;
  root.innerHTML = '<div class="wrap adm"><div id="adm"></div></div>';
  const mount = root.querySelector('#adm');

  if (!firebaseEnabled) {
    mount.innerHTML = `<div class="adm-card adm-login">
      <h2 class="adm-login-t">Admin unavailable</h2>
      <p class="adm-muted">Firebase isn't configured in this build. Set the <code>FIREBASE</code> secret
      (or <code>.env</code> locally) and rebuild.</p></div>`;
    return;
  }

  mount.innerHTML = `<div class="adm-card adm-login" aria-busy="true">
    <div class="skel skel-circle"></div><div class="skel skel-line w60"></div><div class="skel skel-line w80"></div>
    <div class="skel skel-block"></div><div class="skel skel-block"></div></div>`;

  try {
    await initAuth();
  } catch (e) {
    mount.innerHTML = `<div class="adm-card adm-login"><h2 class="adm-login-t">Connection failed</h2>
      <p class="adm-muted">${esc(fbError(e))}</p></div>`;
    return;
  }

  unsubscribe = onAdminChange((st) => {
    if (!mount.isConnected) { unsubscribe?.(); unsubscribe = null; return; }
    if (!st.ready) return;
    const next = st.user && st.isAdmin ? 'dashboard' : st.user ? 'denied' : 'login';
    if (next === currentView) return;
    currentView = next;
    try {
      if (next === 'dashboard') dashboard(mount, st.user);
      else if (next === 'denied') denied(mount);
      else login(mount);
    } catch (e) {
      mount.innerHTML = `<p class="adm-err">${esc(e.message)}</p>`;
    }
  });
}

/* ------------------------------------------------------------------ login -- */
function login(mount) {
  mount.innerHTML = `
    <div class="adm-card adm-login">
      <div class="adm-login-mark" aria-hidden="true">&gt;_</div>
      <h2 class="adm-login-t">Admin access</h2>
      <p class="adm-muted">Sign in to manage write-ups and certificates.</p>
      <form class="aform" novalidate>
        <div class="afield">
          <label for="adm-email">Email</label>
          <input id="adm-email" type="email" name="email" autocomplete="username" required />
        </div>
        <div class="afield">
          <label for="adm-pass">Password</label>
          <div class="afield-pw">
            <input id="adm-pass" type="password" name="password" autocomplete="current-password" required />
            <button type="button" class="pw-toggle" aria-label="Show password" aria-pressed="false">Show</button>
          </div>
        </div>
        <button class="abtn primary full" type="submit"><span class="spin" aria-hidden="true"></span><span class="lbl">Sign in</span></button>
        <p class="adm-err" role="alert"></p>
      </form>
    </div>`;

  const form = mount.querySelector('form');
  const err = mount.querySelector('.adm-err');
  const pass = form.querySelector('#adm-pass');
  form.email.value = ADMIN_EMAIL;
  pass.focus();

  const toggle = form.querySelector('.pw-toggle');
  toggle.addEventListener('click', () => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    if (!form.email.value.trim() || !pass.value) { err.textContent = 'Enter your email and password.'; return; }
    btn.disabled = true;
    btn.classList.add('busy');
    err.textContent = '';
    try {
      await adminSignIn(form.email.value.trim(), pass.value);
      toast('Signed in. Welcome back.', 'success');
      // onAdminChange swaps in the dashboard.
    } catch (ex) {
      // Deliberately generic: don't reveal whether the email or the password was wrong.
      err.textContent = /too-many-requests/.test(ex?.code || '')
        ? 'Too many attempts. Try again later.'
        : 'Sign-in failed. Check your credentials.';
      btn.disabled = false;
      btn.classList.remove('busy');
    }
  });
}

function denied(mount) {
  mount.innerHTML = `<div class="adm-card adm-login"><h2 class="adm-login-t">Not authorized</h2>
    <p class="adm-muted">This account isn't the site admin.</p>
    <button class="abtn ghost full" type="button" data-out>Sign out</button></div>`;
  mount.querySelector('[data-out]').addEventListener('click', signOut);
}

async function signOut() {
  try {
    await adminSignOut();
    toast('Signed out.', 'info');
  } catch (e) {
    toast(fbError(e), 'error');
  }
}

/* -------------------------------------------------------------- dashboard -- */
const skelKpis = () => Array.from({ length: 6 }, () => '<div class="kpi"><div class="skel skel-line w40 tall"></div><div class="skel skel-line w70"></div></div>').join('');
const skelRows = (n = 4) => `<div class="adm-skel-rows" aria-busy="true">${Array.from({ length: n }, () =>
  '<div class="skel-row"><div class="skel skel-line w50"></div><div class="skel skel-line w20"></div><div class="skel skel-pill"></div></div>').join('')}</div>`;

function dashboard(mount, user) {
  state.filter = '';
  const email = user?.email || '';
  mount.innerHTML = `
    <header class="adm-top">
      <div>
        <p class="adm-kicker">// admin · 管理</p>
        <h1 class="adm-title">Dashboard</h1>
      </div>
      <div class="adm-user">
        <span class="adm-avatar" aria-hidden="true">${esc((email[0] || 'A').toUpperCase())}</span>
        <span class="adm-who"><b>Administrator</b><s>${esc(email)}</s></span>
        <button class="abtn ghost" type="button" data-out>Sign out</button>
      </div>
    </header>

    <section class="adm-kpis" data-kpis aria-label="Key figures">${skelKpis()}</section>

    <section class="adm-grid">
      <div class="adm-card adm-main">
        <div class="adm-tabs" role="tablist" aria-label="Content type">
          <button class="adm-tab" role="tab" id="tab-writeups" data-tab="writeups" aria-controls="adm-panel" aria-selected="true">
            Write-ups <span class="cnt" data-cnt="writeups">–</span></button>
          <button class="adm-tab" role="tab" id="tab-certs" data-tab="certs" aria-controls="adm-panel" aria-selected="false" tabindex="-1">
            Certificates <span class="cnt" data-cnt="certs">–</span></button>
        </div>
        <div class="adm-toolbar">
          <label class="adm-filter">${ICON.search}
            <input type="search" data-filter placeholder="Filter…" aria-label="Filter rows" autocomplete="off" />
          </label>
          <button class="abtn primary" type="button" data-new>+ New write-up</button>
        </div>
        <div id="adm-panel" role="tabpanel" aria-labelledby="tab-writeups" data-panel>${skelRows()}</div>
      </div>

      <aside class="adm-card adm-side" aria-label="Insights">
        <h3 class="adm-h3">Posts by tag</h3>
        <canvas class="chart" role="img" aria-label="Bar chart of posts per tag"></canvas>
        <div class="adm-note">
          <p><b>Bundled</b> posts live in <code>src/data/writeups/</code>. Editing one saves a database copy that overrides it.</p>
          <p><b>Drafts</b> are stored in the database but never sent to visitors.</p>
        </div>
      </aside>
    </section>`;

  mount.querySelector('[data-out]').addEventListener('click', signOut);

  // tabs (click + arrow keys)
  const tabs = [...mount.querySelectorAll('.adm-tab')];
  const selectTab = (name, focus = false) => {
    state.tab = name;
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    mount.querySelector('[data-panel]').setAttribute('aria-labelledby', `tab-${name}`);
    renderTable(mount);
  };
  tabs.forEach((t) => {
    t.addEventListener('click', () => selectTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = tabs.indexOf(t);
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(next.dataset.tab, true);
    });
  });

  const filter = mount.querySelector('[data-filter]');
  filter.addEventListener('input', () => { state.filter = filter.value.trim().toLowerCase(); renderTable(mount); });

  mount.querySelector('[data-new]').addEventListener('click', () => {
    if (state.tab === 'writeups') openWriteupEditor(mount, null);
    else openCertEditor(null);
  });

  // row actions (delegated)
  mount.querySelector('[data-panel]').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const row = state.rows[state.tab].find((r) => r.id === b.dataset.id);
    if (!row) return;
    if (b.dataset.act === 'edit') {
      if (state.tab === 'writeups') openWriteupEditor(mount, row);
      else openCertEditor(row);
    } else if (b.dataset.act === 'del') {
      deleteWriteup(mount, row);
    }
  });

  loadData(mount);
}

async function loadData(mount, { quiet = false } = {}) {
  const panel = mount.querySelector('[data-panel]');
  if (!panel) return;
  if (!quiet) panel.innerHTML = skelRows();
  try {
    const posts = (await readOnce('posts')) || {};
    state.posts = posts;
    state.rows.writeups = buildWriteupRows(posts);
    state.rows.certs = config.certs.map((c, i) => ({ id: `cert-${i}`, source: 'bundled', ...c }));
    if (!mount.isConnected) return;
    renderKpis(mount);
    renderCounts(mount);
    renderTable(mount);
    renderChart(mount);
  } catch (e) {
    const msg = fbError(e);
    panel.innerHTML = `<div class="adm-empty">
      <p class="adm-empty-t">Couldn't load data</p><p class="adm-empty-s">${esc(msg)}</p>
      <button class="abtn ghost" type="button" data-retry>Retry</button></div>`;
    panel.querySelector('[data-retry]').addEventListener('click', () => loadData(mount));
    mount.querySelector('[data-kpis]').innerHTML = '';
    toast(msg, 'error');
  }
}

function buildWriteupRows(posts) {
  const dbRows = Object.entries(posts).map(([slug, p]) => ({
    id: slug, slug, source: 'db',
    title: p.title || slug, date: p.date || '', excerpt: p.excerpt || '',
    tags: Array.isArray(p.tags) ? p.tags : [], mitre: Array.isArray(p.mitre) ? p.mitre : [],
    platform: p.platform || '', difficulty: p.difficulty || '', published: p.published === true,
  }));
  const dbSlugs = new Set(dbRows.map((r) => r.slug));
  const bundledRows = bundled.filter((w) => !dbSlugs.has(w.slug)).map((w) => ({
    id: w.slug, slug: w.slug, source: 'bundled',
    title: w.title, date: w.date, excerpt: w.summary, tags: w.tags, mitre: w.mitre,
    platform: w.platform, difficulty: w.difficulty, published: true,
  }));
  return [...dbRows, ...bundledRows].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderKpis(mount) {
  const w = state.rows.writeups;
  const db = w.filter((r) => r.source === 'db');
  const kpis = [
    { v: w.length, l: 'Write-ups', tone: 'cyber' },
    { v: db.filter((r) => r.published).length, l: 'Published (DB)', tone: 'jade' },
    { v: db.filter((r) => !r.published).length, l: 'Drafts', tone: 'gold' },
    { v: w.filter((r) => r.source === 'bundled').length, l: 'Bundled', tone: 'muted' },
    { v: state.rows.certs.length, l: 'Certificates', tone: 'sakura' },
    { v: localViews(), l: 'Views · this browser', tone: 'violet' },
  ];
  mount.querySelector('[data-kpis]').innerHTML = kpis
    .map((k) => `<div class="kpi" data-tone="${k.tone}"><b>${esc(k.v)}</b><span>${esc(k.l)}</span></div>`)
    .join('');
}

function renderCounts(mount) {
  mount.querySelector('[data-cnt="writeups"]').textContent = state.rows.writeups.length;
  mount.querySelector('[data-cnt="certs"]').textContent = state.rows.certs.length;
}

function renderChart(mount) {
  try {
    const counts = {};
    state.rows.writeups.forEach((r) => r.tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    const data = Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    barChart(mount.querySelector('.chart'), data);
  } catch { /* chart is decorative */ }
}

function renderTable(mount) {
  const panel = mount.querySelector('[data-panel]');
  const newBtn = mount.querySelector('[data-new]');
  if (!panel || !newBtn) return;
  const tab = state.tab;
  newBtn.textContent = tab === 'writeups' ? '+ New write-up' : '+ New certificate';

  let rows = state.rows[tab];
  const q = state.filter;
  if (q) {
    rows = rows.filter((r) =>
      [r.title, r.slug, r.name, r.issuer, ...(r.tags || [])].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }

  const banner = tab === 'certs' && !CERTS_LIVE
    ? '<div class="adm-banner">Certificates are read-only until Phase 3 connects them to the database. The editor UI is ready to review.</div>'
    : '';

  if (!rows.length) {
    panel.innerHTML = `${banner}<div class="adm-empty">
      <p class="adm-empty-t">${q ? 'No matches' : 'Nothing here yet'}</p>
      <p class="adm-empty-s">${q ? 'Try a different filter.' : `Create your first ${tab === 'writeups' ? 'write-up' : 'certificate'}.`}</p></div>`;
    return;
  }

  panel.innerHTML = banner + (tab === 'writeups' ? writeupTable(rows) : certTable(rows));
}

function statusBadge(r) {
  if (r.source === 'bundled') return '<span class="pill pill-muted">Bundled</span>';
  return r.published ? '<span class="pill pill-jade">Published</span>' : '<span class="pill pill-gold">Draft</span>';
}

function writeupTable(rows) {
  return `<div class="adm-table-wrap"><table class="adm-table">
    <thead><tr><th scope="col">Title</th><th scope="col">Date</th><th scope="col">Tags</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${rows.map((r) => {
      const tags = r.tags.slice(0, 3).map((t) => `<span class="tagchip">${esc(t)}</span>`).join('');
      const more = r.tags.length > 3 ? `<span class="tagchip more">+${r.tags.length - 3}</span>` : '';
      const live = r.source === 'bundled' || r.published;
      return `<tr>
        <td data-label="Title"><div class="cell-title"><b>${esc(r.title)}</b><s>/w/${esc(r.slug)}</s></div></td>
        <td data-label="Date" class="cell-date">${esc(r.date ? fmtDate(r.date) : '—')}</td>
        <td data-label="Tags"><div class="cell-tags">${tags}${more || (tags ? '' : '<span class="adm-muted">—</span>')}</div></td>
        <td data-label="Status">${statusBadge(r)}</td>
        <td class="cell-act">
          ${live ? `<a class="iconbtn" href="#/w/${esc(r.slug)}" title="View" aria-label="View ${esc(r.title)}">${ICON.view}</a>` : ''}
          <button class="iconbtn" type="button" data-act="edit" data-id="${esc(r.id)}" title="Edit" aria-label="Edit ${esc(r.title)}">${ICON.edit}</button>
          ${r.source === 'db' ? `<button class="iconbtn danger" type="button" data-act="del" data-id="${esc(r.id)}" title="Delete" aria-label="Delete ${esc(r.title)}">${ICON.del}</button>` : ''}
        </td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

function certTable(rows) {
  return `<div class="adm-table-wrap"><table class="adm-table">
    <thead><tr><th scope="col">Certificate</th><th scope="col">Issuer</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${rows.map((r) => {
      const logo = safeUrl(r.badge);
      return `<tr>
        <td data-label="Certificate"><div class="cell-cert">
          ${logo ? `<img src="${esc(logo)}" alt="" width="34" height="34" loading="lazy" />` : '<span class="cert-ph" aria-hidden="true">?</span>'}
          <b>${esc(r.name)}</b></div></td>
        <td data-label="Issuer">${esc(r.issuer)}</td>
        <td data-label="Date" class="cell-date">${esc(r.date || '—')}</td>
        <td data-label="Status">${r.status === 'in-progress' ? '<span class="pill pill-gold">In progress</span>' : '<span class="pill pill-jade">Earned</span>'}</td>
        <td class="cell-act">
          <button class="iconbtn" type="button" data-act="edit" data-id="${esc(r.id)}" title="Edit" aria-label="Edit ${esc(r.name)}">${ICON.edit}</button>
        </td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

/* ------------------------------------------------------- write-up editor -- */
const FOOTER = (saveLabel, disabled = false) => `
  <button class="abtn ghost" type="button" data-cancel>Cancel</button>
  <button class="abtn primary" type="button" data-save ${disabled ? 'disabled' : ''}><span class="spin" aria-hidden="true"></span><span class="lbl">${esc(saveLabel)}</span></button>`;

function serialize(form) {
  return JSON.stringify([...new FormData(form).entries()]) + (form.published?.checked ? '1' : '0');
}

async function openWriteupEditor(mount, row) {
  const isNew = !row;
  const drawer = openDrawer({
    title: isNew ? 'New write-up' : 'Edit write-up',
    subtitle: isNew ? 'Saved to Firebase · appears instantly, no redeploy' : `/w/${row.slug}${row.source === 'bundled' ? ' · bundled — saving creates a DB copy' : ''}`,
    body: `
      <form class="aform" novalidate>
        <div class="afield"><label for="f-title">Title</label>
          <input id="f-title" name="title" required maxlength="200" placeholder="Kerberoasting an attack path to Domain Admin" /></div>
        <div class="arow">
          <div class="afield"><label for="f-slug">Slug</label>
            <div class="afield-prefix"><span>/w/</span><input id="f-slug" name="slug" required maxlength="80" spellcheck="false" ${isNew ? '' : 'readonly'} /></div>
            <small class="hint">Lowercase letters, digits and dashes.</small></div>
          <div class="afield"><label for="f-date">Date</label><input id="f-date" type="date" name="date" required /></div>
        </div>
        <div class="afield"><label for="f-excerpt">Excerpt <span class="count" data-count="excerpt"></span></label>
          <textarea id="f-excerpt" name="excerpt" rows="3" maxlength="500" placeholder="One or two sentences for the list and social previews."></textarea></div>
        <div class="arow">
          <div class="afield"><label for="f-tags">Tags</label><input id="f-tags" name="tags" placeholder="Active Directory, Kerberoasting" /><small class="hint">Comma-separated.</small></div>
          <div class="afield"><label for="f-mitre">MITRE ATT&amp;CK IDs</label><input id="f-mitre" name="mitre" placeholder="T1558.003, T1003.006" /><small class="hint">Comma-separated.</small></div>
        </div>
        <div class="arow">
          <div class="afield"><label for="f-platform">Platform</label><input id="f-platform" name="platform" maxlength="80" placeholder="Hack The Box" /></div>
          <div class="afield"><label for="f-difficulty">Difficulty</label><input id="f-difficulty" name="difficulty" maxlength="40" placeholder="Medium" /></div>
        </div>
        <div class="afield">
          <div class="afield-head"><label for="f-content">Content · Markdown</label>
            <div class="seg" role="group" aria-label="Editor mode">
              <button type="button" class="seg-b act" data-mode="write" aria-pressed="true">Write</button>
              <button type="button" class="seg-b" data-mode="preview" aria-pressed="false">Preview</button>
            </div></div>
          <textarea id="f-content" name="content" rows="16" spellcheck="false" placeholder="## TL;DR&#10;…"></textarea>
          <div class="md-preview article-body" hidden></div>
        </div>
        <label class="aswitch"><input type="checkbox" name="published" />
          <span class="aswitch-ui" aria-hidden="true"></span>
          <span class="aswitch-t">Published<small>Drafts stay in the database and are never shown to visitors.</small></span></label>
        <p class="adm-err" data-err role="alert"></p>
      </form>`,
    footer: FOOTER(isNew ? 'Create write-up' : 'Save changes'),
    beforeClose: async () => {
      if (baseline === null || serialize(form) === baseline) return true;
      return confirmDialog({ title: 'Discard changes?', message: 'You have unsaved edits in this write-up.', confirmText: 'Discard', danger: true });
    },
  });

  const form = drawer.body.querySelector('form');
  const f = form.elements;
  const err = form.querySelector('[data-err]');
  const content = f.content;
  const preview = form.querySelector('.md-preview');
  let baseline = null;

  // fill values via properties (no attribute interpolation of user data)
  f.title.value = row?.title || '';
  f.slug.value = row?.slug || '';
  f.date.value = (row?.date || new Date().toISOString()).slice(0, 10);
  f.excerpt.value = row?.excerpt || '';
  f.tags.value = (row?.tags || []).join(', ');
  f.mitre.value = (row?.mitre || []).join(', ');
  f.platform.value = row?.platform || '';
  f.difficulty.value = row?.difficulty || '';
  f.published.checked = isNew ? false : row.published !== false;

  // excerpt counter
  const cnt = form.querySelector('[data-count="excerpt"]');
  const updateCount = () => { cnt.textContent = `${f.excerpt.value.length}/500`; };
  f.excerpt.addEventListener('input', updateCount);
  updateCount();

  // auto-slug from title for new posts until the slug is edited by hand
  let slugTouched = !isNew;
  f.slug.addEventListener('input', () => { slugTouched = true; });
  f.title.addEventListener('input', () => { if (!slugTouched) f.slug.value = slugify(f.title.value); });

  // write / preview toggle (preview sanitized with DOMPurify)
  form.querySelectorAll('.seg-b').forEach((b) => b.addEventListener('click', () => {
    const toPreview = b.dataset.mode === 'preview';
    form.querySelectorAll('.seg-b').forEach((x) => {
      x.classList.toggle('act', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    if (toPreview) {
      try {
        preview.innerHTML = DOMPurify.sanitize(marked.parse(content.value || '*Nothing to preview yet.*'));
      } catch {
        preview.textContent = 'Preview failed to render.';
      }
    }
    preview.hidden = !toPreview;
    content.hidden = toPreview;
  }));

  // load body: DB content for DB posts, bundled Markdown otherwise
  if (row?.source === 'db') {
    content.disabled = true;
    content.placeholder = 'Loading content…';
    try {
      content.value = (await readOnce(`postContent/${row.slug}`)) || '';
    } catch (e) {
      toast(`Couldn't load content: ${fbError(e)}`, 'error');
    }
    content.disabled = false;
    content.placeholder = '';
  } else if (row) {
    content.value = bundled.find((w) => w.slug === row.slug)?.body || '';
  }
  baseline = serialize(form);

  const saveBtn = drawer.footer.querySelector('[data-save]');
  drawer.footer.querySelector('[data-cancel]').addEventListener('click', () => drawer.close());
  saveBtn.addEventListener('click', () => saveWriteup());
  form.addEventListener('submit', (e) => { e.preventDefault(); saveWriteup(); });

  function invalid(field, msg) {
    err.textContent = msg;
    field.setAttribute('aria-invalid', 'true');
    field.focus();
    field.addEventListener('input', () => field.removeAttribute('aria-invalid'), { once: true });
  }

  async function saveWriteup() {
    err.textContent = '';
    const slug = f.slug.value.trim().toLowerCase();
    const title = f.title.value.trim();
    if (!title) return invalid(f.title, 'Title is required.');
    if (!SLUG_RE.test(slug)) return invalid(f.slug, 'Slug must be 1–80 lowercase letters, digits or dashes.');
    if (!f.date.value) return invalid(f.date, 'Pick a date.');

    if (isNew && state.posts[slug]) {
      const ok = await confirmDialog({ title: 'Overwrite existing post?', message: `A database post already uses /w/${slug}. Saving will replace it.`, confirmText: 'Overwrite', danger: true });
      if (!ok) return;
    }

    const meta = {
      title: title.slice(0, 200),
      date: f.date.value,
      excerpt: f.excerpt.value.trim().slice(0, 500),
      published: f.published.checked,
      updatedAt: Date.now(),
    };
    const tags = toList(f.tags.value);
    const mitre = toList(f.mitre.value);
    if (tags.length) meta.tags = tags;
    if (mitre.length) meta.mitre = mitre;
    if (f.platform.value.trim()) meta.platform = f.platform.value.trim().slice(0, 80);
    if (f.difficulty.value.trim()) meta.difficulty = f.difficulty.value.trim().slice(0, 40);

    saveBtn.disabled = true;
    saveBtn.classList.add('busy');
    try {
      await writeData(`postContent/${slug}`, content.value); // content first…
      await writeData(`posts/${slug}`, meta);                 // …then make it visible
      invalidateWriteups();
      toast(`${meta.published ? 'Published' : 'Saved draft'}: ${meta.title}`, 'success');
      await drawer.close(true);
      loadData(mount, { quiet: true });
    } catch (e) {
      const msg = fbError(e);
      err.textContent = msg;
      toast(`Save failed — ${msg}`, 'error');
      saveBtn.disabled = false;
      saveBtn.classList.remove('busy');
    }
  }
}

async function deleteWriteup(mount, row) {
  const ok = await confirmDialog({
    title: 'Delete write-up?',
    message: `"${row.title}" (/w/${row.slug}) will be removed from the database. This can't be undone.`,
    confirmText: 'Delete',
    danger: true,
  });
  if (!ok) return;
  try {
    await removeData(`posts/${row.slug}`);       // hide first…
    await removeData(`postContent/${row.slug}`); // …then drop content
    invalidateWriteups();
    toast(`Deleted: ${row.title}`, 'success');
    loadData(mount, { quiet: true });
  } catch (e) {
    toast(`Delete failed — ${fbError(e)}`, 'error');
  }
}

/* --------------------------------------------------- certificate editor -- */
function openCertEditor(row) {
  const isNew = !row;
  const drawer = openDrawer({
    title: isNew ? 'New certificate' : 'Edit certificate',
    subtitle: CERTS_LIVE ? '' : 'Preview only — database sync arrives in Phase 3',
    body: `
      ${CERTS_LIVE ? '' : '<div class="adm-banner">Saving certificates is enabled in Phase 3. For now, edit <code>src/data/config.json</code>.</div>'}
      <form class="aform" novalidate>
        <div class="cert-preview"><img alt="" hidden /><span class="cert-ph" aria-hidden="true">?</span></div>
        <div class="afield"><label for="c-name">Name</label><input id="c-name" name="name" maxlength="120" placeholder="CRTP — Certified Red Team Professional" /></div>
        <div class="arow">
          <div class="afield"><label for="c-issuer">Issuer</label><input id="c-issuer" name="issuer" maxlength="80" placeholder="Altered Security" /></div>
          <div class="afield"><label for="c-date">Date</label><input id="c-date" name="date" maxlength="40" placeholder="Month YYYY" /></div>
        </div>
        <div class="afield"><label for="c-badge">Logo path</label><input id="c-badge" name="badge" placeholder="/assets/certs/…" spellcheck="false" /></div>
        <div class="afield"><label for="c-verify">Verification URL</label><input id="c-verify" name="verify" type="url" placeholder="https://…" spellcheck="false" /></div>
        <div class="afield"><label for="c-status">Status</label>
          <select id="c-status" name="status"><option value="earned">Earned</option><option value="in-progress">In progress</option></select></div>
      </form>`,
    footer: FOOTER(isNew ? 'Create certificate' : 'Save changes', !CERTS_LIVE),
  });

  const form = drawer.body.querySelector('form');
  const f = form.elements;
  f.name.value = row?.name || '';
  f.issuer.value = row?.issuer || '';
  f.date.value = row?.date || '';
  f.badge.value = row?.badge || '';
  f.verify.value = row?.verify || '';
  f.status.value = row?.status || 'earned';

  const img = form.querySelector('.cert-preview img');
  const ph = form.querySelector('.cert-preview .cert-ph');
  const updateLogo = () => {
    const u = safeUrl(f.badge.value);
    img.hidden = !u;
    ph.hidden = !!u;
    if (u) img.src = u;
  };
  img.addEventListener('error', () => { img.hidden = true; ph.hidden = false; });
  f.badge.addEventListener('input', updateLogo);
  updateLogo();

  drawer.footer.querySelector('[data-cancel]').addEventListener('click', () => drawer.close(true));
  drawer.footer.querySelector('[data-save]').addEventListener('click', () => {
    toast('Certificate sync is wired in Phase 3.', 'info');
  });
}
