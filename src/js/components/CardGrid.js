// Reusable grid renderers for skills, platforms, certs and projects.
// Each returns an HTML string; the router injects it into a container.
import { esc, safeUrl } from '../util.js';

const code = (s) =>
  s
    .split(/[\s&/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export function SkillGrid(skills, limit) {
  const items = limit ? skills.slice(0, limit) : skills;
  return `<div class="grid3">${items
    .map(
      (s, i) => `<article class="skill panel hov">
        <span class="skill-i" aria-hidden="true">${esc(code(s.category))}</span>
        <p class="skill-lbl">Technique ${String(i + 1).padStart(2, '0')}</p>
        <h3>${esc(s.category)}</h3>
        <p>${esc(s.description)}</p>
        <div class="tags">${s.tools.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      </article>`
    )
    .join('')}</div>`;
}

export function PlatformGrid(platforms) {
  return `<div class="grid-3">${platforms
    .map((p) => {
      const logo = safeUrl(p.logo);
      const href = safeUrl(p.href);
      return `<div class="plat panel hov">
        ${logo ? `<div class="plat-logo"><img src="${esc(logo)}" alt="${esc(p.name)} logo" loading="lazy" decoding="async" /></div>` : ''}
        <div class="plat-top"><h3>${esc(p.name)}</h3><span class="rank">${esc(p.rank)}</span></div>
        <p>${esc(p.description)}</p>
        ${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" class="chip" style="margin-top:1rem;align-self:flex-start">view profile →</a>` : ''}
      </div>`;
    })
    .join('')}</div>`;
}

export function SocialGrid(socials) {
  return `<div class="social-grid">${socials
    .map((s) => {
      const href = safeUrl(s.href);
      if (!href) return '';
      const icon = safeUrl(s.icon);
      const external = href.startsWith('https://');
      return `<a class="social panel hov" href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
        <span class="social-ico">${icon ? `<img src="${esc(icon)}" alt="" width="28" height="28" loading="lazy" decoding="async" />` : ''}</span>
        <span class="social-txt"><b>${esc(s.label)}</b><s>${esc(s.handle || '')}</s></span>
        <span class="social-go" aria-hidden="true">→</span>
      </a>`;
    })
    .join('')}</div>`;
}

export function CertGrid(certs) {
  return `<div class="grid-3">${certs
    .map((c) => {
      const prog = c.status === 'in-progress';
      const badge = safeUrl(c.badge);
      const verify = safeUrl(c.verify);
      return `<div class="cert panel hov">
        ${badge ? `<div class="cert-badge"><img src="${esc(badge)}" alt="${esc(c.issuer)} logo" width="66" height="66" loading="lazy" decoding="async" /></div>` : ''}
        <div style="margin-bottom:.5rem">${prog ? '<span class="chip">in progress</span>' : '<span class="chip-key">earned</span>'}</div>
        <h3>${esc(c.name)}</h3>
        <p class="iss">${esc(c.issuer)}</p>
        ${c.date ? `<p class="date">${esc(c.date)}</p>` : ''}
        ${verify ? `<a href="${esc(verify)}" target="_blank" rel="noopener noreferrer" class="chip" style="margin-top:.6rem;align-self:flex-start">verify →</a>` : ''}
      </div>`;
    })
    .join('')}</div>`;
}

export function ProjectGrid(projects) {
  return `<div class="grid-3">${projects
    .map(
      (p) => `<article class="proj panel hov">
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.description)}</p>
        <div class="proj-tags">${p.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
        <div class="proj-links">
          ${p.github ? `<a href="${esc(p.github)}" target="_blank" rel="noopener noreferrer">GitHub →</a>` : ''}
          ${p.demo ? `<a href="${esc(p.demo)}" target="_blank" rel="noopener noreferrer">Live Demo →</a>` : ''}
        </div>
      </article>`
    )
    .join('')}</div>`;
}
