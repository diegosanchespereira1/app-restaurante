# GitHub Actions Workflows

## Deploy to GitHub Pages (`deploy.yml`)

This workflow automatically builds and deploys the Vite + React application to GitHub Pages.

### Trigger
- Runs on every push to the `main` branch

### What it does
1. Checks out the repository
2. Sets up Node.js v18
3. Installs dependencies using `npm ci`
4. Builds the project using `npm run build`
5. Copies `index.html` to `404.html` to support SPA (Single Page Application) routing on GitHub Pages
6. Publishes the `dist` folder to the `gh-pages` branch

### GitHub Pages Configuration
After the first successful workflow run, the `gh-pages` branch will be created automatically. To serve the site:

1. Go to **Settings** → **Pages** in your repository
2. Under **Source**, select the `gh-pages` branch
3. Click **Save**

The site will be available at: `https://<username>.github.io/app-restaurante/`
