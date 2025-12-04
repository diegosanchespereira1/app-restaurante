# GitHub Actions workflow: Build and deploy to GitHub Pages

## What this does
- Triggers on pushes to the `main` branch
- Sets up Node.js
- Installs dependencies using `npm install`
- Builds the application using `npm run build`
- Deploys the contents of the `dist` directory to the `gh-pages` branch

## Prerequisites / notes
- `vite.config.ts` has `base: '/app-restaurante/'` for the project page at `https://diegosanchespereira1.github.io/app-restaurante/`
- `package.json` produces `dist/` with `npm run build` (the repo has "build": "tsc -b && vite build")
- After the workflow runs, go to Settings → Pages and confirm the site is using the `gh-pages` branch (root)
