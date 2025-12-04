# GitHub Actions workflow: Build and deploy to GitHub Pages

What this does
- Runs on pushes to `main`.
- Installs dependencies (`npm ci`), runs the production build (`npm run build`), copies `dist/index.html` to `dist/404.html` to help SPA routing, and publishes the `dist/` folder to the `gh-pages` branch using the repository's `GITHUB_TOKEN`.

Why this fixes the Pages issue
- GitHub Pages only serves static files. This workflow ensures the compiled production assets (in `dist/`) are published to the `gh-pages` branch, which Pages can serve. The repository's root index.html (Vite dev entry) will remain in the repo, but Pages will serve the built site from `gh-pages`.

Prerequisites / notes
- vite.config.ts: keep `base: '/app-restaurante/'` for a project page at `https://<username>.github.io/app-restaurante/` (your repo already has this).
- package.json: your `build` script must produce `dist/` (your `build`: "tsc -b && vite build" is correct).
- After the workflow runs, in GitHub > Settings > Pages, configure the site to serve from the `gh-pages` branch (root) if it isn't set automatically.
- For SPA routing, copying index.html -> 404.html helps when users navigate directly to subpaths.
