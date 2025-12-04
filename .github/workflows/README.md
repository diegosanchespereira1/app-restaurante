# GitHub Actions workflow: Build and deploy to GitHub Pages

What this does
- Runs on pushes to `main`.
- Installs dependencies (`npm ci`), runs the production build (`npm run build`), copies `dist/index.html` to `dist/404.html` to support SPA routing, and publishes the `dist/` folder to the `gh-pages` branch using the repository's `GITHUB_TOKEN`.

Why update root index.html
- The repository previously had the Vite dev index.html in the repo root, which references `/src/main.tsx` and cannot be served by GitHub Pages. Replacing it with a small redirect page ensures visitors are sent to the built site on `/app-restaurante/` (the project page) while the gh-pages branch provides the compiled site.

Prerequisites / notes
- vite.config.ts should keep `base: '/app-restaurante/'` for the project page at `https://diegosanchespereira1.github.io/app-restaurante/`.
- package.json must produce `dist/` with `npm run build` (the repo already has "build": "tsc -b && vite build").
- After the workflow runs, go to Settings → Pages and confirm the site is using the `gh-pages` branch (root).
- Copying `index.html -> 404.html` helps when users navigate directly to client-side routes.
