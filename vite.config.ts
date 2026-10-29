import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  root: '.',
  // .wgt loads from a file:// origin on the TV — absolute /assets paths 404.
  // Relative base keeps every asset URL relative to index.html. MANDATORY.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // NOTE: `target` is esbuild's SYNTAX CEILING, not the engine floor. It never
    // polyfills nor forbids runtime APIs. The enforced runtime contract is
    // Chromium >= 85 — canonical: docs/runtime-floor.md, tripwire:
    // tests/unit/distApiFloor.test.ts (scans the committed package/ bundle).
    target: 'chrome100',
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, 'index.html')
    }
  },
  server: {
    port: 8080
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
