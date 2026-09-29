// Lazy syntax highlighting for write-up code blocks (Phase 4.3).
// highlight.js + its theme load only when a post actually contains code.
let hljsPromise = null;

export async function highlightWithin(el) {
  if (!el) return;
  const blocks = el.querySelectorAll('pre code');
  if (!blocks.length) return;

  if (!hljsPromise) {
    hljsPromise = (async () => {
      const [{ default: hljs }] = await Promise.all([
        import('highlight.js/lib/common'),
        import('highlight.js/styles/atom-one-dark.css'),
      ]);
      return hljs;
    })();
  }
  const hljs = await hljsPromise;
  blocks.forEach((b) => {
    try { hljs.highlightElement(b); } catch { /* ignore unknown languages */ }
  });
}
