// Visit counting (Phase 3.2). Uses a sessionStorage `gp_seen` flag so a refresh
// doesn't inflate counts — one count per browser session.
//
// NOTE: the Firebase rules are admin-only writes, so the browser cannot write to
// `stats/`/`visitors/` (that would need public writes = spoofable/floodable, or a
// server we don't have on the free plan). We therefore keep a local, non-authoritative
// tally and expose a hook where a privacy-friendly external analytics call (Plausible,
// GoatCounter, Cloudflare Web Analytics) would go. See README → Firebase backend.

const SEEN = 'gp_seen';
const VIEWS = 'gp_views';

export function countVisit() {
  let seen = false;
  try { seen = sessionStorage.getItem(SEEN) === '1'; } catch {}
  if (seen) return false;
  try { sessionStorage.setItem(SEEN, '1'); } catch {}

  // local, non-authoritative tally
  try {
    const n = (parseInt(localStorage.getItem(VIEWS) || '0', 10) || 0) + 1;
    localStorage.setItem(VIEWS, String(n));
  } catch {}

  // External analytics hook (no-op unless a provider script is present):
  try { if (typeof window.plausible === 'function') window.plausible('pageview'); } catch {}

  return true;
}

export function localViews() {
  try { return parseInt(localStorage.getItem(VIEWS) || '0', 10) || 0; } catch { return 0; }
}
