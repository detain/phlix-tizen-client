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
