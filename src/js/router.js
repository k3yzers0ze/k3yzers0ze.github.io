// Hash-based router. Maps /#/<route> to a view (HTML partial + init function).
import config from '../data/config.json';
import skills from '../data/skills.json';
import platforms from '../data/platforms.json';
import { writeups, loadWriteups, findWriteup, getRenderedContent } from './writeups.js';
import { SkillGrid, PlatformGrid, CertGrid, ProjectGrid, SocialGrid } from './components/CardGrid.js';
import { Terminal } from './components/Terminal.js';
import { esc, fmtDate, safeUrl } from './util.js';
import { highlightWithin } from './highlight.js';
import { renderAdmin } from './admin.js';

// Incremented on every navigation; async routes bail out if the user has
// moved on before their data arrived (prevents stale content rendering).
let navSeq = 0;

// View HTML partials, bundled at build time.
const partials = import.meta.glob('../views/*.html', { query: '?raw', import: 'default', eager: true });
const view = (name) => partials[`../views/${name}.html`] || `<div class="wrap"><p>Missing view: ${name}</p></div>`;

const app = () => document.getElementById('app');

/* ---------------------------------------------------------------- helpers -- */
function setMeta({ title, description, page }) {
  document.title = title ? `${title} · ${config.name}` : config.title;
  // Swap only the pg-* class; keep others (e.g. `no-fx` from perf.js).
  [...document.body.classList].forEach((c) => c.startsWith('pg-') && document.body.classList.remove(c));
  document.body.classList.add(`pg-${page || 'home'}`);
  const d = document.querySelector('meta[name="description"]');
  if (d && description) d.setAttribute('content', description);
  const ot = document.querySelector('meta[property="og:title"]');
  if (ot) ot.setAttribute('content', document.title);
  const od = document.querySelector('meta[property="og:description"]');
  if (od && description) od.setAttribute('content', description);
}

function setActiveNav(page) {
  document.querySelectorAll('#nav .nlinks a, .mob a').forEach((a) => {
    a.classList.toggle('act', a.dataset.route === page);
  });
}

/* ------------------------------------------------------------------ HOME --- */
function homeView() {
  const a = config.about;
  // Pills reflect real data: cert short names (e.g. "CRTP") + platforms.
  const certPills = [...config.certs.map((c) => c.name.split(' — ')[0]), ...platforms.map((p) => p.name)];
  const photo = safeUrl(config.profileImage);
  const stats = [
    { b: '3+', s: 'years offensive' },
    { b: 'AD', s: 'multi-domain forests' },
    { b: 'ATT&CK', s: 'mapped findings' },
    { b: 'PRO', s: 'HTB hacker rank' },
  ];
  const portals = config.nav.map((n, i) => ({
    ...n,
    n: String(i + 1).padStart(2, '0'),
  }));
  const latest = writeups.slice(0, 3);

  return `
  <section class="landing">
    <div class="landing-in wrap hero-grid">
      <div class="hero-copy">
        <span class="hero-tag">${esc(config.hero?.eyebrow || 'Welcome to my portfolio')}</span>
        <h1 class="hero-name"><span class="l1">TIBTANI</span><span class="l2">AYMEN</span></h1>
        <p class="hero-jp">オフェンシブ・セキュリティ · ${esc(config.location)}</p>
        <p class="hero-bio">${esc(a.header)}</p>
        <div class="certrow">${certPills.map((c) => `<span class="cpill">${esc(c)}</span>`).join('')}</div>
        <div class="hero-cta">
          <a href="#/writeups" class="btn">Read the writeups →</a>
          <a href="#/contact" class="btn ghost">Open for engagements</a>
        </div>
      </div>
      ${
        photo
          ? `<figure class="hero-photo panel">
        <img src="${esc(photo)}" alt="Portrait of ${esc(config.name)}" width="440" height="560" fetchpriority="high" decoding="async" />
        <figcaption><span class="hp-dot"></span>${esc(config.role)}</figcaption>
      </figure>`
          : ''
      }
    </div>
    <div class="scrollcue">SCROLL<i></i></div>
  </section>

  <div class="wrap"><div class="stats">${stats
    .map((x) => `<div class="stat"><b>${x.b}</b><s>${esc(x.s)}</s></div>`)
    .join('')}</div></div>

  <section class="sec"><div class="wrap">
    <div class="shead"><span class="snum">01</span><div class="stitle"><h2>Explore</h2><p class="jp">ナビゲーション</p></div><div class="sline"></div></div>
    <div class="portal">${portals
      .map(
        (p) => `<a href="#/${p.id}" class="pcard panel hov">
          <span class="pcard-n">${p.n}</span>
          <span class="pcard-jp">${esc(p.jp)}</span>
          <h3 class="pcard-t">${esc(p.label)}</h3>
          <p class="pcard-s">Enter the ${esc(p.label)} section.</p>
          <span class="pcard-go">ENTER →</span>
        </a>`
      )
      .join('')}</div>
  </div></section>

  <section class="sec"><div class="wrap">
    <div class="shead"><span class="snum">02</span><div class="stitle"><h2>Capabilities</h2><p class="jp">技術</p></div><div class="sline"></div><a href="#/skills" class="seeall">ALL SKILLS →</a></div>
    ${SkillGrid(skills, 3)}
  </div></section>

  ${
    latest.length
      ? `<section class="sec"><div class="wrap">
    <div class="shead"><span class="snum">03</span><div class="stitle"><h2>Latest Research</h2><p class="jp">記録</p></div><div class="sline"></div><a href="#/writeups" class="seeall">ALL WRITEUPS →</a></div>
    <div class="grid-3">${latest
      .map(
        (w) => `<a href="#/w/${esc(w.slug)}" class="wu-card panel hov">
          <div class="top"><h2>${esc(w.title)}</h2></div>
          <time style="font-family:var(--mono);font-size:.6rem;color:var(--dim)">${esc(fmtDate(w.date))}</time>
          <p>${esc(w.summary)}</p>
          <div class="tags">${w.tags.slice(0, 3).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
        </a>`
      )
      .join('')}</div>
  </div></section>`
      : ''
  }

  <section class="sec"><div class="wrap">
    <div class="panel hov" style="padding:2.2rem;display:flex;flex-wrap:wrap;gap:1.4rem;align-items:center;justify-content:space-between">
      <div>
        <h2 style="font-family:var(--display);font-size:clamp(1.4rem,3vw,2rem);text-transform:uppercase">Open for engagements</h2>
        <p style="color:var(--muted);margin-top:.5rem;font-size:.9rem">${esc(config.contact.engagements.slice(0, 3).join(' · '))} and more.</p>
      </div>
      <a href="mailto:${esc(config.email)}" class="btn">${esc(config.email)}</a>
    </div>
  </div></section>`;
}

/* ---------------------------------------------------------------- ROUTES --- */
const routes = {
  home: () => {
    setMeta({ page: 'home' });
    app().innerHTML = homeView();
  },

  about: () => {
    setMeta({ title: 'About', description: config.about.header, page: 'about' });
    const a = config.about;
    app().innerHTML = view('about');
    app().querySelector('#about-copy').innerHTML =
      `<p class="about-lead">${esc(a.header)}</p><p>${esc(a.bio)}</p>`;
    app().querySelector('#about-focus').innerHTML = a.focus.map((f) => `<li>${esc(f)}</li>`).join('');
    app().querySelector('#portrait').innerHTML =
      `<img src="${esc(safeUrl(config.profileImage))}" alt="Portrait of ${esc(config.name)}" width="480" height="640" loading="lazy" decoding="async" /><figcaption>${esc(a.profile.location)} · ${esc(config.role)}</figcaption>`;
    app().querySelector('#factlist').innerHTML = `
      <div class="fact"><b>Location</b><span>${esc(a.profile.location)}</span></div>
      <div class="fact"><b>Email</b><span><a href="mailto:${esc(a.profile.email)}">${esc(a.profile.email)}</a></span></div>
      <div class="fact"><b>Focus</b><span>${esc(a.profile.focus)}</span></div>
      <div class="fact"><b>Status</b><span class="live"><i></i>${esc(a.profile.status)}</span></div>`;
    app().querySelector('#timeline').innerHTML = a.timeline
      .map(
        (t) => `<div class="tlitem"><div class="tlbox panel">
          <div class="tlhead"><h3>${esc(t.title)}</h3><span class="tlper">${esc(t.period)}</span></div>
          <p class="tlmeta">${esc(t.org)}</p></div></div>`
      )
      .join('');
  },

  skills: () => {
    setMeta({ title: 'Skills', description: 'What I bring to an engagement.', page: 'skills' });
    app().innerHTML = view('skills');
    app().querySelector('#skill-grid').innerHTML = SkillGrid(skills);
  },

  certs: () => {
    setMeta({ title: 'Certifications', description: 'Certifications, earned and in progress.', page: 'certs' });
    app().innerHTML = view('certs');
    app().querySelector('#cert-grid').innerHTML = CertGrid(config.certs);
  },

  platforms: () => {
    setMeta({ title: 'Platforms', description: 'Proving grounds — HTB, THM, Offsec.', page: 'platforms' });
    app().innerHTML = view('platforms');
    app().querySelector('#plat-grid').innerHTML = PlatformGrid(platforms);
  },

  projects: () => {
    setMeta({ title: 'Projects', description: 'Offensive tooling and automation.', page: 'projects' });
    app().innerHTML = view('projects');
    app().querySelector('#proj-grid').innerHTML = ProjectGrid(config.projects);
  },

  writeups: async () => {
    const seq = navSeq;
    setMeta({ title: 'Writeups & Research', description: 'Research and machine write-ups.', page: 'writeups' });
    app().innerHTML = view('writeups');
    const input = app().querySelector('#wu-search');
    const list = app().querySelector('#wu-list');
    const count = app().querySelector('#wu-count');
    const empty = app().querySelector('#wu-empty');
    const filters = app().querySelector('#wu-filters');

    count.textContent = 'loading…';
    const all = await loadWriteups();
    if (seq !== navSeq) return;

    // category filter pills, derived from tags
    const cats = ['all', ...Array.from(new Set(all.flatMap((w) => w.tags)))];
    let activeTag = 'all';
    let query = '';
    filters.innerHTML = cats
      .map((c) => `<button class="fbtn${c === 'all' ? ' act' : ''}" type="button" data-tag="${esc(c)}">${esc(c)}</button>`)
      .join('');

    const card = (w) => `<a href="#/w/${esc(w.slug)}" class="wu-card panel hov">
      <div class="top"><h2>${esc(w.title)}</h2><time>${esc(fmtDate(w.date))}</time></div>
      <p>${esc(w.summary)}</p>
      <div class="tags">${[...w.mitre.map((m) => `<span class="chip-key">${esc(m)}</span>`), ...w.tags.map((t) => `<span class="chip">${esc(t)}</span>`)].join('')}</div>
    </a>`;

    const render = (items) => {
      list.innerHTML = items.map(card).join('');
      empty.hidden = items.length > 0;
      count.textContent = `${items.length} writeup${items.length === 1 ? '' : 's'}`;
    };

    const apply = () => {
      let items = all;
      if (activeTag !== 'all') items = items.filter((w) => w.tags.includes(activeTag));
      if (query) {
        items = items.filter((w) =>
          [w.title, w.summary, ...w.tags, ...w.mitre].join(' ').toLowerCase().includes(query)
        );
      }
      render(items);
    };

    input.addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); apply(); });
    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('.fbtn');
      if (!btn) return;
      activeTag = btn.dataset.tag;
      filters.querySelectorAll('.fbtn').forEach((b) => b.classList.toggle('act', b === btn));
      apply();
    });

    apply();
    input.focus();
  },

  writeup: async (slug) => {
    const seq = navSeq;
    const w = await findWriteup(slug);
    if (seq !== navSeq) return;
    if (!w) return routes.notfound();
    setMeta({ title: w.title, description: w.summary, page: 'writeup' });
    app().innerHTML = view('writeup-detail');

    // Render header immediately; body streams in from cache/DB/bundled markdown.
    app().querySelector('#wu-article').innerHTML = `
      <a href="#/writeups" class="backlink">← back to writeups</a>
      <h1 style="font-family:var(--display);font-size:clamp(1.8rem,5vw,3.4rem);line-height:1;text-transform:uppercase">${esc(w.title)}</h1>
      <div class="pvmeta">
        <time>${esc(fmtDate(w.date))}</time>
        ${w.platform ? `<span>· ${esc(w.platform)}</span>` : ''}
        ${w.difficulty ? `<span>· ${esc(w.difficulty)}</span>` : ''}
      </div>
      <p class="article-lead" style="margin-top:1rem">${esc(w.summary)}</p>
      ${w.mitre.length ? `<div style="margin-top:1.2rem"><p style="font-family:var(--mono);font-size:.58rem;letter-spacing:.22em;color:var(--cyber);text-transform:uppercase;margin-bottom:.5rem">// mitre att&ck</p><div class="tags">${w.mitre.map((m) => `<span class="chip-key">${esc(m)}</span>`).join('')}</div></div>` : ''}
      ${w.tags.length ? `<div class="tags" style="margin-top:.8rem">${w.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="article-body" id="wu-body"></div>`;

    initReadbar();
    try {
      const html = await getRenderedContent(w);
      if (seq !== navSeq) return;
      const bodyEl = app().querySelector('#wu-body');
      if (bodyEl) {
        bodyEl.innerHTML = html;
        buildTOC(bodyEl, app().querySelector('#wu-toc'));
        updateReadbar();
        highlightWithin(bodyEl).catch(() => {});
      }
    } catch {
      if (seq !== navSeq) return;
      const bodyEl = app().querySelector('#wu-body');
      if (bodyEl) bodyEl.innerHTML = '<p class="cm-note">Could not load this write-up.</p>';
    }
  },

  admin: () => {
    setMeta({ title: 'Admin', description: 'Site administration.', page: 'admin' });
    renderAdmin(app());
  },

  contact: () => {
    setMeta({ title: 'Contact', description: 'Open for engagements.', page: 'contact' });
    app().innerHTML = view('contact');
    app().querySelector('#engagements').innerHTML = config.contact.engagements
      .map((e) => `<li>${esc(e)}</li>`)
      .join('');
    app().querySelector('#mail-btn').setAttribute('href', `mailto:${config.email}`);
    app().querySelector('#mail-btn').textContent = `✉ ${config.email}`;
    app().querySelector('#socials').innerHTML = SocialGrid(config.socials);
    app().querySelector('#terminal').innerHTML = Terminal({
      title: '~/contact',
      lines: [
        { cmd: 'whoami', out: `${config.name} — ${config.role}` },
        { cmd: 'cat contact.txt', out: config.email },
        { cmd: 'uptime', out: `available for engagements · ${config.location}` },
      ],
    });
  },

  notfound: () => {
    setMeta({ title: '404 — Not Found', page: 'home' });
    app().innerHTML = `<section class="landing" style="min-height:80vh"><div class="landing-in wrap" style="text-align:center">
      <p style="font-family:var(--mono);font-size:.7rem;letter-spacing:.3em;color:var(--cyber)">$ cat /dev/null</p>
      <h1 class="hero-name" style="font-size:clamp(4rem,20vw,12rem);margin-top:1rem"><span class="l2">404</span></h1>
      <p style="font-family:var(--mono);color:var(--muted);margin:1rem 0 2rem">// this path doesn't resolve</p>
      <a href="#/" class="btn">← back home</a>
    </div></section>`;
  },
};

/* ------------------------------------------------------------------ TOC ---- */
function slugify(s) {
  return String(s).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60) || 'section';
}

let tocObserver = null;
function buildTOC(bodyEl, tocEl) {
  if (tocObserver) { tocObserver.disconnect(); tocObserver = null; }
  if (!tocEl) return;
  const heads = [...bodyEl.querySelectorAll('h2, h3')];
  if (heads.length < 2) { tocEl.hidden = true; return; }

  const used = new Set();
  heads.forEach((h) => {
    let id = slugify(h.textContent);
    let n = 1;
    while (used.has(id)) id = `${slugify(h.textContent)}-${n++}`;
    used.add(id);
    h.id = id;
    h.style.scrollMarginTop = '90px';
  });

  tocEl.hidden = false;
  tocEl.innerHTML =
    `<div class="toc-h">Contents 目次</div><ul>` +
    heads
      .map((h) => `<li class="${h.tagName.toLowerCase()}"><a href="#${h.id}" data-id="${h.id}">${esc(h.textContent)}</a></li>`)
      .join('') +
    `</ul>`;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  tocEl.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = document.getElementById(a.dataset.id);
      if (t) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  });

  // scrollspy
  const links = new Map([...tocEl.querySelectorAll('a')].map((a) => [a.dataset.id, a]));
  tocObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => l.classList.remove('on'));
          links.get(en.target.id)?.classList.add('on');
        }
      });
    },
    { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
  );
  heads.forEach((h) => tocObserver.observe(h));
}

/* -------------------------------------------------------------- readbar ---- */
// Reading-progress bar: one element, one scroll listener for the page lifetime,
// only active on write-up pages.
let readbarEl = null;
let readbarOn = false;
function updateReadbar() {
  if (!readbarEl) return;
  if (!readbarOn) { readbarEl.style.width = '0'; return; }
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  readbarEl.style.width = max > 0 ? `${(h.scrollTop / max) * 100}%` : '0';
}
function initReadbar() {
  if (!readbarEl) {
    readbarEl = document.createElement('div');
    readbarEl.className = 'readbar';
    document.body.appendChild(readbarEl);
    window.addEventListener('scroll', updateReadbar, { passive: true });
  }
  readbarOn = true;
  updateReadbar();
}
function clearReadbar() {
  readbarOn = false;
  updateReadbar();
}

/* --------------------------------------------------------------- resolve --- */
export function resolve() {
  const raw = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  const parts = raw.split('/');
  navSeq++;
  clearReadbar();
  if (tocObserver) { tocObserver.disconnect(); tocObserver = null; }

  let page = 'home';
  if (!raw) routes.home();
  else if (parts[0] === 'w' && parts[1]) {
    page = 'writeup';
    routes.writeup(decodeURIComponent(parts[1]));
  } else if (routes[parts[0]]) {
    page = parts[0];
    routes[parts[0]]();
  } else {
    routes.notfound();
  }

  setActiveNav(page === 'writeup' ? 'writeups' : page);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Programmatic navigation helper.
export function go(path) {
  const p = path.startsWith('#') ? path.slice(1) : path;
  location.hash = p.startsWith('/') ? p : `/${p}`;
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
