// Loads all Markdown write-ups bundled at build time and parses frontmatter.
// The file name (minus .md) is the URL slug: /#/w/<slug>.
import { parseFrontmatter } from './util.js';

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
