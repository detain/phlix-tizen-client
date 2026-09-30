/**
 * Route-gate pins for the `/app/library/scan` surface (L-4 follow-up, tizen).
 *
 * Mirrors phlix-server web-ui 114c9aaf for this consumer. `/api/v1/libraries`
 * strips absolute-fs `paths` for NON-admin callers (server b3aece4e), and
 * LibraryScanPage is an operator surface — so this client's SPA route must
 * carry `meta.requiresAdmin`, the exact key the vendored @phlix/ui authGuard
 * checks (to.meta?.requiresAdmin === true → bounce-to-browse / to-login).
 *
 * The guard BOUNCE behavior is pinned upstream in @phlix/ui's
 * createPhlixApp.test.ts; what is consumer-owned — and therefore pinned HERE —
 * is (1) that this route sets the key, (2) that the vendored guard still reads
 * it, and (3) that the key shape matches the LIVE admin-section meta from
 * buildAdminRoutes(), so a future ui rename flips this red instead of
 * silently un-gating the route.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildAdminRoutes } from '@phlix/ui';

const PROJECT_ROOT = resolve(__dirname, '../..');

/** The route-object source text for /app/library/scan in src/main.ts. */
function libraryScanRouteBlock(): string {
  const src = readFileSync(resolve(PROJECT_ROOT, 'src/main.ts'), 'utf8').replace(/\r\n/g, '\n');
  const start = src.indexOf("path: '/app/library/scan'");
  expect(start, 'src/main.ts must define the /app/library/scan route').not.toBe(-1);
  const open = src.lastIndexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error('unbalanced braces after the /app/library/scan route');
}

describe('/app/library/scan route gate (L-4)', () => {
  it('carries meta.requiresAdmin === true in source', () => {
    expect(libraryScanRouteBlock()).toMatch(
      /meta:\s*\{\s*requiresAdmin:\s*true\s*\}/,
      'the library-scan route must set `meta: { requiresAdmin: true }` — ' +
        'the exact key the vendored ui authGuard checks',
    );
  });

  it('uses the SAME meta shape the vendored admin section carries (live cross-check)', () => {
    const adminSection = buildAdminRoutes()[0];
    expect(adminSection.meta?.requiresAdmin).toBe(true);
    const scanFlag = /requiresAdmin:\s*(\w+)/.exec(libraryScanRouteBlock())?.[1];
    expect(scanFlag).toBe(String(adminSection.meta?.requiresAdmin));
  });

  it('vendored @phlix/ui still honors the requiresAdmin meta key in its guard', () => {
    // The reader-side half of the contract: if ui renames the key upstream,
    // this probe flips red together with the live cross-check above, instead
    // of the gate silently dying while every source pin stays green.
    const dist = readFileSync(
      resolve(PROJECT_ROOT, 'node_modules/@phlix/ui/dist/phlix-ui.js'),
      'utf8',
    );
    expect(dist).toContain('e.meta?.requiresAdmin === !0'); // wa() bounce decision
    expect(dist).toContain('meta: { requiresAdmin: !0 }'); // buildAdminRoutes marker
  });
});
