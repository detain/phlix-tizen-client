import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/test-setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // S501 T-13 — coverage floor gate (was: upload-only, no enforcement).
      // Pinned 2026-09-16 at the MEASURED floor reached after the T-11 tests landed
      // (global: statements 74.09 / branches 63.95 / functions 70.25 / lines 75.08),
      // held a few points BELOW that so CI is green immediately and only a real
      // regression trips it. Ratchet these UP as coverage grows — never down to
      // paper over a drop.
      thresholds: {
        statements: 72,
        branches: 61,
        functions: 68,
        lines: 73
      },
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'app/**',
        '**/*.d.ts',
        '**/*.config.{ts,mts,js,mjs,cjs}'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
