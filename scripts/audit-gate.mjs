/**
 * audit-gate — npm-audit wrapper with an explicit, justified advisory allow-list.
 *
 * WHY THIS EXISTS (M-TIZEN-13 / review tizen__devops MIN-3):
 * This repo had no npm-audit gate at all: no `npm audit` step in any workflow,
 * and the two time-drift-prone dev-chain advisories that Dependabot happened
 * to bump (postcss-selector-parser, source-map-js) were the only sign anyone
 * was watching. A CI without a gate is a CI that reports "we did not look".
 * The bare `npm audit --audit-level=high` step (the windows/website precedent
 * this replaces) hides every sub-high advisory and treats a broken audit as a
 * green one. The gate is stricter: the audit passes only while the reported
 * advisory-id set is a subset of ALLOWED_ADVISORIES below, and turns red the
 * moment ANY advisory not explicitly allow-listed appears — at any severity.
 *
 * FOUNDING STATE (2026-10-30, W-min169): the dependency tree was first cleared
 * with in-range bumps — vite 7.3.6→7.3.7 (5 ids), vitest + @vitest/coverage-v8
 * 5.0.1→5.0.5 (2 ids, @vitest/mocker), and the jsdom-carried undici 7.29.1→
 * 7.30.1 (8 ids). Everything npm could fix inside declared ranges, it fixed;
 * the two surviving entries below are NOT range-fixable — each was verified
 * against the registry (`npm view` on every parent's declared minimatch/glob
 * range at its latest release) before being allowed, per the law below.
 *
 * ADDING AN ENTRY (the reviewed-decision law): only for an advisory that is
 * LIVE in the reported set, has no fix inside any declared parent range, and
 * is dev-chain-justified — with GHSA id, patched-version-absence evidence
 * (`npm view <pkg> versions` / parent-deps cited), and a re-verify-by date.
 * Every entry must carry a mirror fixture proving the exact set stays pinned.
 *
 * ANTI-NEUTERING LAW:
 * A silent gate is worse than no gate. The script distinguishes "audit clean"
 * from "audit broken": unparseable JSON, an unrecognized report shape, a failed
 * spawn, or a nonzero npm exit that reports ZERO advisories all exit with
 * EXIT_STRUCTURE_ERROR (2) — never 0. Unknown advisories exit EXIT_VIOLATION (1).
 *
 * Exit codes: 0 pass (clean or allowed-only) · 1 allow-list violation ·
 * 2 audit itself failed (structural — the verdict is unusable, not "clean").
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const EXIT_OK = 0;
export const EXIT_VIOLATION = 1;
export const EXIT_STRUCTURE_ERROR = 2;

// Exact GHSA ids the gate tolerates, each with the justification CI prints on
// every run. Subset semantics: ANY advisory id missing here reddens the gate.
export const ALLOWED_ADVISORIES = new Map([
  [
    'GHSA-g3hv-75wg-m249',
    {
      package: 'minimatch',
      justification:
        'minimatch ReDoS (dev chain only: eslint/@typescript-eslint/editorconfig carry it). ' +
        'Patched ONLY at 11.0.1+, and no parent admits 11.x: @eslint/eslintrc@latest declares ' +
        'minimatch ^3.1.5 (3.x line ends at 3.1.5, flagged), @typescript-eslint/typescript-estree ' +
        '@latest declares ^10.2.2 (10.x is at 10.2.6, still flagged by the "<11.0.1" range), ' +
        'glob@13 (via js-beautify) declares ^10 too. Nothing ships: the widget bundle never ' +
        'imports minimatch (devDeps are not bundled by vite). Re-verify by 2027-04-30 (or any ' +
        'parent releasing a 11.x admit).',
    },
  ],
  [
    'GHSA-3g3m-2fjr-6pw4',
    {
      package: 'glob',
      justification:
        'glob vulnerability (dev chain only: @vue/test-utils→js-beautify@^1.15 carries ' +
        'glob@13.0.6). Patched ONLY at 14.0.2+, and even js-beautify@2.0.3 (latest) still ' +
        'declares glob ^13.0.6 — no 13.x release fixes it, and 13.0.6 is the last 13.x. ' +
        'Nothing ships: glob is never reachable from the widget bundle. Re-verify by ' +
        '2027-04-30 (or when js-beautify admits glob ^14).',
    },
  ],
]);

const AUDIT_ARGS = ['audit', '--json', '--audit-level=high'];
const MAX_BUFFER_BYTES = 64 * 1024 * 1024;

export class AuditGateError extends Error {}

/** Run the real `npm audit --json` the gate wraps. */
export function runAudit() {
  // Tizen CI legs are Linux-only, but the argv is kept shell-free and
  // fixed-constant anyway — no interpolation, no injection surface.
  const result = spawnSync('npm', AUDIT_ARGS, {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER_BYTES,
    shell: process.platform === 'win32',
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    spawnError: result.error ?? null,
  };
}

// GHSA ids are case-insensitive by spec. Extraction preserves the reported
// case for display; ALLOW-LIST MATCHING IS CASE-INSENSITIVE (decide() below
// lowercases both sides), so authoring a key as GHSA-… or ghsa-… both work.
function ghsaFromUrl(url) {
  const match = typeof url === 'string' ? /\/(GHSA-[0-9a-z]+(-[0-9a-z]+){2,3})$/i.exec(url) : null;
  return match ? match[1] : null;
}

function advisoryIdOf(via) {
  const fromUrl = ghsaFromUrl(via.url);
  if (fromUrl) return fromUrl;
  if (typeof via.github_advisory_id === 'string' && /^GHSA-/i.test(via.github_advisory_id)) {
    return via.github_advisory_id;
  }
  throw new AuditGateError(
    `advisory entry carries no resolvable GHSA id (url=${JSON.stringify(via.url ?? null)}); ` +
      `refusing to certify an unnamed advisory — ${JSON.stringify(via).slice(0, 200)}`,
  );
}

/** Parse npm audit JSON (report v3 `vulnerabilities`, legacy v2 `advisories`) into a Set of GHSA ids. */
export function collectAdvisoryIds(stdout) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    throw new AuditGateError(
      `npm audit --json produced unparseable output: ${JSON.stringify(String(stdout).slice(0, 300))}`,
    );
  }
  if (report === null || typeof report !== 'object') {
    throw new AuditGateError(`npm audit --json produced a non-object report: ${JSON.stringify(report).slice(0, 200)}`);
  }

  const ids = new Set();
  if (report.vulnerabilities && typeof report.vulnerabilities === 'object') {
    for (const node of Object.values(report.vulnerabilities)) {
      for (const via of node?.via ?? []) {
        // v3: `via` strings name affected dependents; objects ARE the advisories.
        if (typeof via === 'object' && via !== null) ids.add(advisoryIdOf(via));
      }
    }
    return ids;
  }
  if (report.advisories && typeof report.advisories === 'object') {
    for (const advisory of Object.values(report.advisories)) {
      if (advisory && typeof advisory === 'object') ids.add(advisoryIdOf(advisory));
    }
    return ids;
  }
  throw new AuditGateError(
    'unrecognized npm audit JSON shape (no `vulnerabilities`/`advisories` key) — ' +
      `refusing to guess at an audit we cannot read: keys=[${Object.keys(report).join(',')}]`,
  );
}

/**
 * Pure decision: audit-run facts in, gate verdict out.
 * `allowList` defaults to the module-level reviewed set; tests inject synthetic
 * maps to exercise the subset/case-insensitivity laws without relying on the
 * shipped allow-list (the production entry point, main(), never overrides it).
 * Returns { code, clean, allowed[], unknown[], problems[] }.
 */
export function decide({ exitCode, stdout, spawnError = null, allowList = ALLOWED_ADVISORIES }) {
  if (spawnError) {
    return {
      code: EXIT_STRUCTURE_ERROR,
      clean: false,
      allowed: [],
      unknown: [],
      problems: [`npm audit could not be executed: ${spawnError.message}`],
    };
  }

  let ids;
  try {
    ids = collectAdvisoryIds(stdout);
  } catch (error) {
    return {
      code: EXIT_STRUCTURE_ERROR,
      clean: false,
      allowed: [],
      unknown: [],
      problems: [error instanceof AuditGateError ? error.message : `audit parse failed: ${error.message}`],
    };
  }

  const canonicalKeyByLowerId = new Map([...allowList.keys()].map((key) => [key.toLowerCase(), key]));
  const allowed = [...ids]
    .filter((id) => canonicalKeyByLowerId.has(id.toLowerCase()))
    .map((id) => canonicalKeyByLowerId.get(id.toLowerCase()))
    .sort();
  const unknown = [...ids].filter((id) => !canonicalKeyByLowerId.has(id.toLowerCase())).sort();
  const problems = [];
  if (unknown.length > 0) {
    problems.push(
      `${unknown.length} advisory id(s) are NOT on the allow-list: ${unknown.join(', ')} — ` +
        'fix the dependency (preferred) or justify a deliberate, reviewed ALLOWED_ADVISORIES entry.',
    );
  }
  // Anti-neutering: nonzero exit with nothing allow-listable means the audit
  // command itself failed — an unread verdict is never a green verdict.
  if (exitCode !== 0 && ids.size === 0) {
    problems.push(
      `npm audit exited ${exitCode} while reporting ZERO advisories — the audit command failed; ` +
        'refusing to treat a broken audit as a clean one.',
    );
  }
  if (problems.length > 0) {
    return { code: unknown.length > 0 ? EXIT_VIOLATION : EXIT_STRUCTURE_ERROR, clean: false, allowed, unknown, problems };
  }
  return { code: EXIT_OK, clean: exitCode === 0 && ids.size === 0, allowed, unknown, problems };
}

export function main() {
  const audit = runAudit();
  const verdict = decide(audit);

  for (const id of verdict.allowed) {
    const entry = ALLOWED_ADVISORIES.get(id);
    console.log(`audit-gate: ALLOWED ${id} (${entry.package}) — ${entry.justification}`);
  }
  for (const problem of verdict.problems) {
    console.error(`audit-gate: ${problem}`);
  }
  if (verdict.code === EXIT_OK) {
    console.log(
      verdict.clean
        ? 'audit-gate: PASS — npm audit clean (0 advisories, exit 0)'
        : `audit-gate: PASS — ${verdict.allowed.length} advisory id(s) reported, every one allow-listed (npm audit exit ${audit.exitCode})`,
    );
  }
  return verdict.code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
