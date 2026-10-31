/**
 * auditGate.test — the M-TIZEN-13 npm-audit gate's own contract (W-min169).
 *
 * Pinned laws (all exercised against the PURE decision core with synthetic
 * fixtures — the real `npm audit` is never spawned from here; CI runs the CLI
 * step separately and tests/unit/installWorkflowDocs.test.ts pins the step):
 *
 *  1. SUBSET LAW — every reported advisory id must be on ALLOWED_ADVISORIES;
 *     one unknown id reddens the gate (EXIT_VIOLATION) at ANY severity, and
 *     the unknown ids are named in the problem line (an operator can act on
 *     the output without re-running audit).
 *  2. CASE-INSENSITIVITY — advisory matching lowercases both sides, so a
 *     report emitting `ghsa-…` or an entry authored `GHSA-…` still match;
 *     the canonical (entry-authored) spelling is what gets echoed.
 *  3. ANTI-NEUTERING — unparseable JSON, an unrecognized report shape, a
 *     failed spawn, or a nonzero exit reporting ZERO advisories are all
 *     EXIT_STRUCTURE_ERROR (2), never 0: a broken audit is never a green one.
 *  4. MIRROR LAW — the shipped ALLOWED_ADVISORIES is pinned to the EXACT
 *     founding set {GHSA-g3hv-75wg-m249, GHSA-3g3m-2fjr-6pw4} with the exact
 *     packages, and the founding cleared-id families (vite/undici/@vitest/
 *     mocker) get dedicated reappearance guards: if a bump ever regresses the
 *     lock to a vulnerable vite/undici/mocker, the gate reddens — nothing
 *     silently re-enters the trusted set.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import {
  EXIT_OK,
  EXIT_VIOLATION,
  EXIT_STRUCTURE_ERROR,
  ALLOWED_ADVISORIES,
  collectAdvisoryIds,
  decide,
} from '../../scripts/audit-gate.mjs';

/** v3 report with the given advisory objects hanging off one vulnerability node. */
function v3Report(advisories: Array<{ id: string; url?: string }>): string {
  return JSON.stringify({
    auditReportVersion: 3,
    vulnerabilities: {
      'some-pkg': {
        name: 'some-pkg',
        severity: 'moderate',
        via: advisories.map((a) => ({
          source: 1,
          name: 'some-pkg',
          dependency: 'some-pkg',
          title: a.id,
          url: a.url ?? `https://github.com/advisories/${a.id}`,
          severity: 'moderate',
          range: '<99.0.0',
        })),
        effects: [],
        range: '<99.0.0',
        nodes: ['node_modules/some-pkg'],
      },
    },
  });
}

function v2Report(ids: string[]): string {
  const advisories: Record<string, unknown> = {};
  ids.forEach((id, i) => {
    advisories[`a${i}`] = { id: i, name: 'some-pkg', severity: 'moderate', url: `https://github.com/advisories/${id}` };
  });
  return JSON.stringify({ auditReportVersion: 2, advisories });
}

describe('collectAdvisoryIds', () => {
  it('extracts v3 `via` object ids and ignores dependent-name string vias', () => {
    const report = JSON.stringify({
      vulnerabilities: {
        a: { via: ['b', { url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' }] },
        b: { via: [{ url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff' }] },
      },
    });
    expect([...collectAdvisoryIds(report)].sort()).toEqual([
      'GHSA-aaaa-bbbb-cccc',
      'GHSA-dddd-eeee-ffff',
    ]);
  });

  it('extracts legacy v2 `advisories` ids', () => {
    expect([...collectAdvisoryIds(v2Report(['GHSA-1111-2222-3333', 'GHSA-4444-5555-6666']))].sort()).toEqual([
      'GHSA-1111-2222-3333',
      'GHSA-4444-5555-6666',
    ]);
  });

  it('refuses an advisory entry with no resolvable GHSA id (never certifies an unnamed advisory)', () => {
    const report = JSON.stringify({ vulnerabilities: { a: { via: [{ title: 'nameless' }] } } });
    expect(() => collectAdvisoryIds(report)).toThrow(/no resolvable GHSA id/);
  });

  it('refuses unparseable output and unknown shapes with AuditGateError (structural, not zero-ids)', () => {
    expect(() => collectAdvisoryIds('not json {')).toThrow(/unparseable/);
    expect(() => collectAdvisoryIds(JSON.stringify({ somethingElse: true }))).toThrow(/unrecognized npm audit JSON shape/);
    expect(() => collectAdvisoryIds(JSON.stringify(null))).toThrow(/non-object report/);
  });
});

describe('decide — subset law', () => {
  it('passes a clean audit (exit 0, zero advisories) as clean', () => {
    const v = decide({ exitCode: 0, stdout: JSON.stringify({ vulnerabilities: {} }) });
    expect(v.code).toBe(EXIT_OK);
    expect(v.clean).toBe(true);
    expect(v.problems).toEqual([]);
  });

  it('passes a report whose ids are ALL on the shipped allow-list', () => {
    const v = decide({ exitCode: 1, stdout: v3Report([{ id: 'GHSA-g3hv-75wg-m249' }, { id: 'GHSA-3g3m-2fjr-6pw4' }]) });
    expect(v.code).toBe(EXIT_OK);
    expect(v.clean).toBe(false);
    expect(v.allowed).toEqual(['GHSA-3g3m-2fjr-6pw4', 'GHSA-g3hv-75wg-m249']);
    expect(v.unknown).toEqual([]);
  });

  it('reddens on ONE unknown id alongside allowed ones, naming it in the problem', () => {
    const v = decide({ exitCode: 1, stdout: v3Report([{ id: 'GHSA-g3hv-75wg-m249' }, { id: 'GHSA-9999-9999-9999' }]) });
    expect(v.code).toBe(EXIT_VIOLATION);
    expect(v.unknown).toEqual(['GHSA-9999-9999-9999']);
    expect(v.problems.join('\n')).toContain('GHSA-9999-9999-9999');
  });

  it('matches case-insensitively and echoes the canonical entry spelling', () => {
    const v = decide({
      exitCode: 1,
      // Lowercase advisory URL as a registry mirror could emit it.
      stdout: v3Report([{ id: 'ignored', url: 'https://github.com/advisories/ghsa-g3hv-75wg-m249' }]),
    });
    expect(v.code).toBe(EXIT_OK);
    expect(v.allowed).toEqual(['GHSA-g3hv-75wg-m249']);
  });
});

describe('decide — anti-neutering law', () => {
  it('a failed spawn is EXIT_STRUCTURE_ERROR, never 0', () => {
    const v = decide({ exitCode: -1, stdout: '', spawnError: new Error('ENOENT npm') });
    expect(v.code).toBe(EXIT_STRUCTURE_ERROR);
    expect(v.problems.join('\n')).toContain('could not be executed');
  });

  it('nonzero exit reporting ZERO advisories is EXIT_STRUCTURE_ERROR (broken ≠ clean)', () => {
    const v = decide({ exitCode: 1, stdout: JSON.stringify({ vulnerabilities: {} }) });
    expect(v.code).toBe(EXIT_STRUCTURE_ERROR);
    expect(v.problems.join('\n')).toContain('refusing to treat a broken audit as a clean one');
  });

  it('unparseable stdout is EXIT_STRUCTURE_ERROR, never 0', () => {
    const v = decide({ exitCode: 0, stdout: '<<proxy html injected>>' });
    expect(v.code).toBe(EXIT_STRUCTURE_ERROR);
  });

  it('an allow-listed id does NOT excuse a broken audit shape', () => {
    const v = decide({ exitCode: 0, stdout: JSON.stringify({ advisories: 'not-an-object' }), allowList: ALLOWED_ADVISORIES });
    expect(v.code).toBe(EXIT_STRUCTURE_ERROR);
  });
});

describe('shipped ALLOWED_ADVISORIES — mirror law', () => {
  it('is pinned to the exact founding set, packages, and non-empty justifications', () => {
    const ids = [...ALLOWED_ADVISORIES.keys()].sort();
    expect(ids).toEqual(['GHSA-3g3m-2fjr-6pw4', 'GHSA-g3hv-75wg-m249']);
    expect(ALLOWED_ADVISORIES.get('GHSA-g3hv-75wg-m249')?.package).toBe('minimatch');
    expect(ALLOWED_ADVISORIES.get('GHSA-3g3m-2fjr-6pw4')?.package).toBe('glob');
    for (const [id, entry] of ALLOWED_ADVISORIES) {
      expect(entry.justification, id).toMatch(/Re-verify by \d{4}-\d{2}-\d{2}/);
      expect(entry.justification, id).toMatch(/dev chain only/i);
    }
  });
});

describe('founding cleared families — reappearance guards', () => {
  // vite, undici and @vitest/mocker were cleared IN RANGE on 2026-10-30 and
  // are therefore NOT on the allow-list: a lock regression to any of their
  // vulnerable eras must redden the gate, not pass silently. The ids below
  // are the real founding-era advisory ids (from `npm audit` at 26a2af8).
  const clearedIds = [
    'GHSA-587h-7wmj-h5pm', // vite ≤7.3.6 era
    'GHSA-2m5v-pch6-74hx', // undici <7.30.1 era
    'GHSA-qxg6-89mg-rqv8', // @vitest/mocker <5.0.3 era
  ];

  for (const id of clearedIds) {
    it(`a reappearing ${id} (lock regression) reddens the gate`, () => {
      const v = decide({ exitCode: 1, stdout: v3Report([{ id }]) });
      expect(v.code).toBe(EXIT_VIOLATION);
      expect(v.unknown).toEqual([id]);
    });
  }

  it('every cleared id is absent from ALLOWED_ADVISORIES (they must be FIXED, not tolerated)', () => {
    for (const id of clearedIds) expect(ALLOWED_ADVISORIES.has(id)).toBe(false);
  });
});
