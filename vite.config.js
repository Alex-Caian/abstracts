import { defineConfig } from 'vite';

// index.html (root) is the entry. The game's ten scripts + css live in public/
// and are served verbatim as classic global scripts — Vite does NOT process them.
// Only src/account.js (the Firebase/auth layer) is bundled.
// base: './' keeps asset URLs relative so it works under the GitHub Pages
// project sub-path (alex-caian.github.io/abstracts/).
export default defineConfig({
  base: './',
  build: { outDir: 'dist', emptyOutDir: true }
});
