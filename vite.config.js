import { defineConfig } from 'vite';

// For GitHub Pages:
//   - user site  (username.github.io):        base '/'
//   - project site (username.github.io/repo): set BASE_PATH=/repo
// The hash router keeps working regardless of base.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
