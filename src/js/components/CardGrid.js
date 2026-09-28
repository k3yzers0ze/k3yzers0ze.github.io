// Reusable grid renderers for skills, platforms, certs and projects.
// Each returns an HTML string; the router injects it into a container.
import { esc } from '../util.js';

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
    .map(
      (p) => `<div class="plat panel hov">
        <div class="plat-top"><h3>${esc(p.name)}</h3><span class="rank">${esc(p.rank)}</span></div>
        <p>${esc(p.description)}</p>
        ${p.href ? `<a href="${esc(p.href)}" target="_blank" rel="noopener noreferrer" class="chip" style="margin-top:1rem;align-self:flex-start">view profile →</a>` : ''}
      </div>`
    )
    .join('')}</div>`;
}

export function CertGrid(certs) {
  return `<div class="grid-3">${certs
    .map((c) => {
      const prog = c.status === 'in-progress';
      return `<div class="cert panel hov">
        <div class="cert-badge"><img src="${esc(c.badge)}" alt="${esc(c.name)} badge" width="66" height="66" loading="lazy" /></div>
        <div style="margin-bottom:.5rem">${prog ? '<span class="chip">in progress</span>' : '<span class="chip-key">earned</span>'}</div>
        <h3>${esc(c.name)}</h3>
        <p class="iss">${esc(c.issuer)}</p>
        <p class="date">${esc(c.date)}</p>
        ${c.verify ? `<a href="${esc(c.verify)}" target="_blank" rel="noopener noreferrer" class="chip" style="margin-top:.6rem;align-self:flex-start">verify →</a>` : ''}
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
