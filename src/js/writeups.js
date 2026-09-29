// Loads all Markdown write-ups bundled at build time and parses frontmatter.
// The file name (minus .md) is the URL slug: /#/w/<slug>.
import { parseFrontmatter } from './util.js';
import { firebaseEnabled, readOnce } from './firebase.js';
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

// Session-level cache of rendered HTML (Phase 3.2). Prevents re-parsing Markdown
// and redundant Firebase reads when a write-up is re-opened in the same session.
const contentCache = new Map();

export async function getRenderedContent(w) {
  if (contentCache.has(w.slug)) return contentCache.get(w.slug);

  let md = w.body;
  // Prefer database content when configured (lets you edit posts without redeploying).
  if (firebaseEnabled) {
    try {
      const remote = await readOnce(`postContent/${w.slug}`);
      if (typeof remote === 'string' && remote.trim() && !remote.startsWith('See src/')) md = remote;
    } catch {
      /* fall back to bundled Markdown */
    }
  }

  const html = DOMPurify.sanitize(marked.parse(md));
  contentCache.set(w.slug, html);
  return html;
}
