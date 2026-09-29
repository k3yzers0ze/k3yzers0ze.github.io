# Offensive Security Portfolio & Write-ups

Single-page portfolio + pentest write-up blog for **Tibtani Ahmed Aymen**. Vanilla JS, no framework.

## Stack
- **Vite** — dev server (HMR) + production build, no Webpack.
- **ES6 modules** — pure modern JavaScript, no jQuery/React.
- **CSS variables + modern CSS** (Grid, Flexbox, backdrop-filter) — cyberpunk/dark aesthetic, modularized.
- **Firebase v10 (modular)** — Realtime Database for write-up comments (+ optional post metadata).
- **marked + DOMPurify** — safe Markdown → HTML rendering (XSS-sanitized).
- **GitHub Actions → GitHub Pages** — auto build + deploy on push to `main`.

## Develop
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/
npm run preview
```

## Project layout
```
index.html                 # shell: #app mount, nav, footer, boot, scene
src/
  data/                    # ← edit content here
    config.json            # name, email, socials, nav, about, certs, projects, contact, firebase
    skills.json  platforms.json
    writeups/*.md          # one file per post; filename = URL slug (/#/w/<name>)
  js/                      # main.js, router.js, firebase.js, writeups.js, comments.js, util.js
    components/            # Terminal.js, CardGrid.js
  styles/                  # variables.css, base.css, components.css, views.css
  views/*.html             # per-route scaffolds with #id mount points
public/assets/             # profile.svg, certs/*.svg, icons/*.svg, og-default.png
.claude/CLAUDE.md          # instructions for the AI agent
.github/workflows/deploy.yml
```

## Editing content
- **Text, socials, certs, projects, contact:** `src/data/config.json` (search for `TODO`).
- **Skills / platforms:** `src/data/skills.json`, `src/data/platforms.json`.
- **Your photo:** replace `public/assets/profile.svg` with your image and update `profileImage` in config.
- **Cert badges:** replace `public/assets/certs/*.svg` and update `badge` paths.
- **Add a write-up:** drop a Markdown file in `src/data/writeups/`. The filename becomes the URL
  (`my-post.md` → `/#/w/my-post`). Frontmatter:
  ```markdown
  ---
  title: Post title
  date: 2026-01-15
  summary: One or two sentences for the list + social description.
  tags: [Active Directory, Web]
  mitre: [T1558.003]
  platform: Home lab
  difficulty: Medium
  ---
  Markdown body…
  ```

## Firebase backend (Phase 2)

Model: **UID-gated admin writes, public reads of published content only.** The admin is
identified by Firebase **UID** (`lEsVOWrpNQPh06Ii7hMqXgap63J2`), not by email — the strongest
check, and it doesn't depend on email verification. The app runs fine with Firebase
**unconfigured** (`firebaseEnabled` stays false).

### Data model (`database.rules.json`, seed in `src/data/seed.firebase.json`)
| Path | Read | Write | Purpose |
| --- | --- | --- | --- |
| `site/` | public | admin | hero text, contact, global settings |
| `posts/<slug>` | public **only via** `orderByChild('published').equalTo(true)`; admin: all | admin | write-up metadata (title, date, tags, excerpt, `published`) |
| `postContent/<slug>` | public **only if** that post is published; admin: all | admin | the Markdown body, kept separate from metadata |
| `stats/` | public | admin | aggregated views (`total`, `by_day/week/month`) |
| `visitors/` | admin only | admin | raw anonymized logs (kept private) |

**Drafts stay private:** unpublished posts are never returned to visitors — a plain read of
`/posts.json` is denied; only the published-only query is allowed. Unknown fields on a post are
rejected, and slugs must match `^[a-z0-9-]{1,80}$`.

### Admin panel
Open **https://k3yzers0ze.github.io/#/admin** and sign in with your admin email/password.
You can create, edit, publish/unpublish and delete posts; editing a bundled Markdown post saves a
DB copy that overrides it. KPIs and a posts-by-tag chart are on the dashboard.

> **Security note (analytics):** with admin-only writes, the site can't self-record
> page views from the browser (that would need public writes = spoofable/floodable, or a
> server we don't have on the free plan). For real analytics use a privacy-friendly
> external tool (Plausible / GoatCounter / Cloudflare Web Analytics) and mirror totals into
> `stats/` from your admin, or keep `stats/` admin-maintained. Ask and I'll wire one in.

### Console setup (2.1 / 2.4 — your account)
1. **Firebase Console → Add project.**
2. **Build → Realtime Database → Create database** → region **`europe-west1`** → start in **locked mode**.
3. **Build → Authentication → Sign-in method → enable Email/Password only.**
4. **Authentication → Users → Add user** → your admin email + a strong password. Copy the
   user's **UID** into `database.rules.json` and `ADMIN_UID` in `src/js/auth.js` (already set).
5. **Realtime Database → Rules** → paste the contents of [`database.rules.json`](database.rules.json) → **Publish**.
   Re-paste whenever that file changes — the console is the source of truth.
6. **(Optional) Import seed:** Realtime Database → ⋮ → **Import JSON** → [`src/data/seed.firebase.json`](src/data/seed.firebase.json).
7. **Project settings → General → Your apps → Web app** → copy the SDK config values.

### Hardening (recommended)
- **Authentication → Settings → User actions → uncheck "Enable create (sign-up)".** Otherwise anyone
  can create accounts with your public API key (harmless to data given the UID rule, but noise).
- **Google Cloud Console → APIs & Services → Credentials → your Browser key → Application
  restrictions: HTTP referrers** → `https://k3yzers0ze.github.io/*` (plus `http://localhost:5173/*` for dev).
- Consider **App Check** (reCAPTCHA Enterprise) to block scripted abuse of your endpoints.

### Config via GitHub Secrets (2.4)
Web config is injected at build, never committed. Values are **not secret** (they identify the
project; the rules protect the data) — kept out of the repo only because Phase 2.4 asked for it.
- **Local dev:** `cp .env.example .env` and fill the `VITE_FIREBASE_*` values.
- **CI:** add a repo **Secret** named `FIREBASE` containing your `firebaseConfig` object (JSON or the
  JS snippet from the console both work), **or** five secrets `VITE_FIREBASE_API_KEY`,
  `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`,
  `VITE_FIREBASE_APP_ID`. The deploy workflow parses them into the build. The config must include
  `databaseURL`, or Firebase stays disabled.
- **Authorized domains:** Authentication → Settings → **Authorized domains** → add `k3yzers0ze.github.io`.

## Deploy to GitHub Pages
1. Push to GitHub.
2. **Settings → Pages → Source: GitHub Actions.**
3. **Project site** (`username.github.io/repo`): add a repo **Variable** `BASE_PATH=/repo`
   (Settings → Secrets and variables → Actions → Variables). **User site** (`username.github.io`): leave it unset.
4. Push to `main` — [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and deploys.

> Note: this is a client-side SPA (hash routing), so per-page SEO/social previews are limited compared to a
> pre-rendered site. `index.html` carries sensible default meta; the app updates `<title>`/OG at runtime.
