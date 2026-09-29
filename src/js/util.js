// Small shared helpers.

/** Escape a string for safe insertion as HTML text/attribute. */
export function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/**
 * Allow only https:, mailto: and site-relative URLs in href/src.
 * esc() prevents attribute breakout but not `javascript:` URLs — this does.
 */
export function safeUrl(u) {
  const s = String(u || '').trim();
  if (/^(https:\/\/|mailto:)/i.test(s) || (s.startsWith('/') && !s.startsWith('//'))) return s;
  return '';
}

/** Format an ISO/Date into "Sep 1, 2026". */
export function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(d);
  }
}

/**
 * Minimal YAML-ish frontmatter parser for the small subset our write-ups use:
 * strings, and inline arrays like [a, b, c]. Good enough without a YAML dep.
 */
export function parseFrontmatter(raw) {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    let [, key, val] = kv;
    val = val.trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      data[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      data[key] = val.replace(/^['"]|['"]$/g, '');
    }
  }
  return { data, body: m[2] };
}
