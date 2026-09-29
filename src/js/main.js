// App entry point: styles, chrome (nav/footer/boot), then the router.
import '../styles/variables.css';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/views.css';

import config from '../data/config.json';
import { esc } from './util.js';
import { startRouter } from './router.js';
import { initPerf } from './perf.js';
import { countVisit } from './analytics.js';
import { hydrateAdminFromCache } from './auth.js';

/* ---------------------------------------------------------------- NAV ------ */
function buildNav() {
  const nav = document.getElementById('nav');
  const links = config.nav
    .map((n) => `<a href="#/${n.id}" data-route="${n.id}">${esc(n.label)}<b>${esc(n.jp)}</b></a>`)
    .join('');

  nav.innerHTML = `
    <a class="logo" href="#/">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M50 6 L88 28 L88 72 L50 94 L12 72 L12 28 Z" fill="none" stroke="#ff2e88" stroke-width="8" />
        <path d="M50 32 L68 42 L68 62 L50 72 L32 62 L32 42 Z" fill="#22d3ee" />
      </svg>
      <span><span class="logo-t">TIBTANI<span>.</span>AYMEN</span><span class="logo-jp">オフェンシブ・セキュリティ</span></span>
    </a>
    <div class="nlinks">${links}</div>
    <div class="nav-r">
      <span class="avail"><i></i>AVAILABLE</span>
      <button class="ham" type="button" aria-label="Menu" aria-expanded="false" data-ham><span></span><span></span><span></span></button>
    </div>`;

  const mob = document.querySelector('[data-mob]');
  mob.innerHTML = `<div class="mob-in">${links}<a href="mailto:${esc(config.email)}">email<b>${esc(config.email)}</b></a></div>`;

  // scroll behaviour
  let last = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('solid', y > 20);
    if (y > 240 && y > last) nav.classList.add('hide');
    else nav.classList.remove('hide');
    last = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // mobile menu
  const ham = nav.querySelector('[data-ham]');
  const close = () => { ham.classList.remove('open'); mob.classList.remove('open'); ham.setAttribute('aria-expanded', 'false'); };
  ham.addEventListener('click', () => {
    const open = ham.classList.toggle('open');
    mob.classList.toggle('open', open);
    ham.setAttribute('aria-expanded', String(open));
  });
  mob.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  window.addEventListener('hashchange', close);
}

/* -------------------------------------------------------------- FOOTER ----- */
function buildFooter() {
  const year = new Date().getFullYear();
  const links = config.socials
    .map((s) => `<a href="${esc(s.href)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a>`)
    .join('');
  document.getElementById('foot').innerHTML = `
    <div class="foot-in">
      <p>© ${year} ${esc(config.name)} · <span>RABAT, MA</span></p>
      <div class="foot-links">${links}<a href="mailto:${esc(config.email)}">email</a></div>
    </div>`;
}

/* --------------------------------------------------------------- BOOT ------ */
function handleBoot() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seen = false;
  try { seen = sessionStorage.getItem('booted') === '1'; } catch {}
  if (reduce || seen) { boot.remove(); return; }
  try { sessionStorage.setItem('booted', '1'); } catch {}
  window.addEventListener('load', () => {
    setTimeout(() => { boot.classList.add('gone'); setTimeout(() => boot.remove(), 600); }, 900);
  });
}

/* --------------------------------------------------------------- INIT ------ */
handleBoot();
initPerf();       // low-power / reduced-motion FX handling (3.3)
buildNav();
buildFooter();
startRouter();
countVisit();            // one count per session via gp_seen (3.2)
hydrateAdminFromCache(); // SDK-free admin hint (3.2); full auth deferred to admin panel
