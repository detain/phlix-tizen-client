/**
 * M-TIZEN-12 (review tizen__devops MIN-2) — shrink-only ledger for the
 * tests/scripts typecheck gate.
 *
 * `npm run typecheck:tests` (vue-tsc -p tsconfig.tests.json --noEmit, wired as
 * the "Type-check tests and scripts" step in .github/workflows/test.yml)
 * strictly typechecks src/, tests/ and scripts/ — the one hole in the escape
 * is `exclude` in tsconfig.tests.json. Every entry there is a file whose
 * vitest v5 mock-typing migration is still owed (the era-drift families
 * catalogued at W-min173: FakeRemote-extends-BridgeRemote cascade, vi-mock
 * call-tuple assertions). The list is a DEBT LEDGER, not an escape hatch:
 * it may only SHRINK. Adding a file here is gate-weakening and reddens this
 * test; the honest move is fixing the file's types and deleting its entry.
 *
 * The entries must also EXIST on disk — an exclusion pointing at a deleted or
 * renamed file is dead config that would silently re-admit a future file of
 * the same name untypechecked.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

/** The pinned ledger. Shrink-only: to change this array, REMOVE an entry (and
 *  its tsconfig.tests.json twin) after migrating that file's mock types. */
const LEDGER = ['tests/unit/tizenBridge.test.ts', 'tests/unit/main.test.ts'];

describe('testsTypecheck ledger — the tsconfig.tests.json exclude list (M-TIZEN-12)', () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'tsconfig.tests.json'), 'utf8')) as {
    exclude?: unknown;
  };

  it('pins the committed exclude array EXACTLY to the ledger (no silent additions)', () => {
    expect(cfg.exclude).toEqual(LEDGER);
  });

  it('every ledger entry exists on disk (dead exclusions are forbidden)', () => {
    for (const rel of LEDGER) {
      expect(existsSync(join(ROOT, rel)), `ledger entry vanished: ${rel}`).toBe(true);
    }
  });

  it('the gate script is the fail-loud vue-tsc invocation (never weakened)', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['typecheck:tests']).toBe('vue-tsc -p tsconfig.tests.json --noEmit');
    // The prod gate is untouched by this lane: same script, same strict src/.
    expect(pkg.scripts?.['typecheck']).toBe('vue-tsc --noEmit');
    expect(pkg.scripts?.['build']).toContain('vue-tsc --noEmit');
  });

  it('the Test workflow carries the gate as a blocking step (no continue-on-error)', () => {
    const wf = readFileSync(join(ROOT, '.github', 'workflows', 'test.yml'), 'utf8');
    expect(wf).toContain('npm run typecheck:tests');
    // Fail-loud law: exactly one RUN line carries the gate, and it must not be
    // neutered with continue-on-error (comment mentions in the docblock above
    // it do not count — match the YAML run: form only).
    const runLines = wf.split('\n').filter((line) => /^\s*run:\s*npm run typecheck:tests\s*$/.test(line));
    expect(runLines).toHaveLength(1);
    expect(wf).not.toMatch(/continue-on-error:[^\n]*\n(?:[^\n]*\n){0,3}[^\n]*run: npm run typecheck:tests/);
  });
});
