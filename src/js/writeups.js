// Write-ups come from two sources:
//   1. Markdown files bundled at build time (src/data/writeups/*.md) — filename = slug.
//   2. Published posts in Firebase (posts/ + postContent/), managed from #/admin.
// A DB post overrides a bundled one with the same slug.
import { parseFrontmatter } from './util.js';
import { firebaseEnabled, readOnce, readPublishedPosts } from './firebase.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const files = import.meta.glob('../data/writeups/*.md', { query: '?raw', import: 'default', eager: true });

export const writeups = Object.entries(files)
  .map(([path, raw]) => {
    const slug = path.split('/').pop().replace(/\.md$/, '');
    const { data, body } = parseFrontmatter(raw);
    return {
      slug,
      title: data.title || slug,
      date: data.date || '',
      summary: data.summary || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      mitre: Array.isArray(data.mitre) ? data.mitre : [],
      platform: data.platform || '',
      difficulty: data.difficulty || '',
      body,
    };
  })
  .sort((a, b) => new Date(b.date) - new Date(a.date));

export function getWriteup(slug) {
  return writeups.find((w) => w.slug === slug);
}

// Session caches (Phase 3.2): merged list + rendered HTML per slug.
let mergedCache = null;
const contentCache = new Map();

const toList = (v) => (Array.isArray(v) ? v : v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);

function normDbPost(slug, p, fallbackBody) {
  return {
    slug,
    title: p.title || slug,
    date: p.date || '',
    summary: p.excerpt || '',
    tags: toList(p.tags),
    mitre: toList(p.mitre),
    platform: p.platform || '',
    difficulty: p.difficulty || '',
    body: fallbackBody || '',
    remote: true,
  };
}

export async function loadWriteups() {
  if (mergedCache) return mergedCache;
  const map = new Map(writeups.map((w) => [w.slug, w]));
  if (firebaseEnabled) {
    try {
      const posts = await readPublishedPosts();
      if (posts && typeof posts === 'object') {
        Object.entries(posts).forEach(([slug, p]) => {
          if (p) map.set(slug, normDbPost(slug, p, map.get(slug)?.body));
        });
      }
    } catch {
      /* offline / rules / not configured — bundled only */
    }
  }
  mergedCache = [...map.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
  return mergedCache;
}

export async function findWriteup(slug) {
  const list = await loadWriteups();
  return list.find((w) => w.slug === slug);
}

/** Invalidate caches after an admin edit so the list/content refetch. */
export function invalidateWriteups() {
  mergedCache = null;
  contentCache.clear();
}

export async function getRenderedContent(w) {
  if (contentCache.has(w.slug)) return contentCache.get(w.slug);

  let md = w.body;
  // Only DB-managed posts hit the database; bundled posts render with zero network.
  if (w.remote && firebaseEnabled) {
    try {
      const remote = await readOnce(`postContent/${w.slug}`);
      if (typeof remote === 'string' && remote.trim() && !remote.startsWith('See src/')) md = remote;
    } catch {
      /* fall back to the bundled body, if any */
    }
  }

  const html = DOMPurify.sanitize(marked.parse(md || ''));
  contentCache.set(w.slug, html);
  return html;
}
