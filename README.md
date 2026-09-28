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

## Firebase (comments)
Comments stay **disabled** (a friendly notice shows) until you fill real values — the site builds/deploys fine either way.

1. Create a Firebase project → **Realtime Database** → create a database.
2. **Authentication** → enable **Anonymous** and **Google** providers.
3. Copy your web-app config into the `firebase` block of `src/data/config.json` (these values are public and safe to commit — security is enforced by DB rules).
4. Realtime Database → **Rules**:
   ```json
   {
     "rules": {
       "comments": {
         "$slug": {
           ".read": true,
           "$id": {
             ".write": "auth != null && !data.exists()",
             ".validate": "newData.hasChildren(['body','name','uid','ts']) && newData.child('body').isString() && newData.child('body').val().length <= 1000 && newData.child('uid').val() === auth.uid"
           }
         }
       },
       "writeups": { ".read": true, ".write": "auth != null" }
     }
   }
   ```
5. Authentication → **Settings → Authorized domains**: add your Pages domain (e.g. `username.github.io`).

## Deploy to GitHub Pages
1. Push to GitHub.
2. **Settings → Pages → Source: GitHub Actions.**
3. **Project site** (`username.github.io/repo`): add a repo **Variable** `BASE_PATH=/repo`
   (Settings → Secrets and variables → Actions → Variables). **User site** (`username.github.io`): leave it unset.
4. Push to `main` — [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and deploys.

> Note: this is a client-side SPA (hash routing), so per-page SEO/social previews are limited compared to a
> pre-rendered site. `index.html` carries sensible default meta; the app updates `<title>`/OG at runtime.
