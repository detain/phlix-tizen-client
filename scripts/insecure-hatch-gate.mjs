/**
 * Release gate: the insecure-dial dev hatches must be compiled OFF in every
 * packaged widget (TIZ-S9 / review TIZ-20).
 *
 * `VITE_PHLIX_DEV_ALLOW_INSECURE_RELAY` (src/api/hubRelay.ts, M-TIZEN-06) and
 * `VITE_PHLIX_DEV_ALLOW_INSECURE_SYNCPLAY` (src/syncplayTransport.ts,
 * M-TIZEN-12) let a bearer-carrying socket dial plaintext `ws://`. They exist
 * for LOCAL TESTING against a plain-http dev server only; README says never to
 * build a `.wgt` with one set. Until now that was documentation only. This
 * module makes it a fail-loud check that `scripts/package.js` runs.
 *
 * Two independent legs, both keyed on the shared hatch PREFIX so a future
 * third hatch is covered without editing this file:
 *
 *  1. ENV leg: no `VITE_PHLIX_DEV_ALLOW_INSECURE_*` variable may be set in the
 *     environment Vite resolves for the production build (process env + `.env`
 *     files, via Vite's own `loadEnv`). This catches a hatch even if a future
 *     refactor reads it with dot access, which Vite folds to a bare literal.
 *  2. BUNDLE leg: no compiled JS/HTML file may carry a hatch name as an object
 *     KEY. Both readers do `import.meta.env[CONST]`, which Vite compiles to an
 *     inlined env object literal (`{BASE_URL:…,MODE:…,PROD:!0,…}`). A hatch
 *     that was set at build time appears there as `VITE_PHLIX_DEV_ALLOW_INSECURE_X:`.
 *     The hatch-name CONSTANT (`var x=\`VITE_…_RELAY\`;`) and the resolveConfig
 *     message (`VITE_…_INSECURE_* hatch`) are not keys, so they never match.
 *
 * "Compiled OFF" means ABSENT: any value counts, not just '1', because the
 * readers enable on exactly '1' and a set-but-other value has no legitimate
 * release purpose. Unset the variable to package.
 *
 * Pure core (`findCompiledHatches`, `findEnvHatches`, `scanBuildDir`) is
 * exercised by tests/unit/insecureHatchGate.test.ts; package.js wires it.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import fs from 'node:fs';
import path from 'node:path';

/** Shared prefix of every insecure-dial dev hatch (one flag per transport). */
export const INSECURE_HATCH_PREFIX = 'VITE_PHLIX_DEV_ALLOW_INSECURE_';

/** Compiled-output extensions the bundle leg scans. */
const SCANNED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.html']);

/**
 * A hatch name used as an object-literal key (optionally quoted with ', " or `),
 * not preceded by an identifier character. Matches `VITE_…_RELAY:` and
 * `"VITE_…_RELAY":`; never the constant `\`VITE_…_RELAY\`;`.
 */
const COMPILED_KEY_RE = new RegExp(
  `(?<![A-Za-z0-9_$])(["'\`]?)(${INSECURE_HATCH_PREFIX}[A-Z0-9_]+)\\1\\s*:`,
  'g'
);

/**
 * Hatch names compiled into `text` as env-object keys, sorted and de-duplicated.
 * @param {string} text compiled JS/HTML
 * @returns {string[]}
 */
export function findCompiledHatches(text) {
  const found = new Set();
  for (const m of text.matchAll(COMPILED_KEY_RE)) {
    found.add(m[2]);
  }
  return [...found].sort();
}

/**
 * Hatch variables present (any value) in a resolved env record, sorted.
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function findEnvHatches(env) {
  return Object.keys(env)
    .filter((k) => k.startsWith(INSECURE_HATCH_PREFIX) && env[k] !== undefined)
    .sort();
}

/**
 * Recursively scan a build directory for compiled-in hatches.
 * @param {string} dir
 * @returns {{ file: string, hatches: string[] }[]} one entry per offending file,
 *   `file` relative to `dir`
 */
export function scanBuildDir(dir) {
  const hits = [];
  const walk = (abs) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const full = path.join(abs, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
        const hatches = findCompiledHatches(fs.readFileSync(full, 'utf8'));
        if (hatches.length > 0) {
          hits.push({ file: path.relative(dir, full), hatches });
        }
      }
    }
  };
  walk(dir);
  return hits.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * Human-readable failure lines for the two legs; empty array means green.
 * @param {{ envHatches?: string[], bundleHits?: { file: string, hatches: string[] }[], label?: string }} facts
 * @returns {string[]}
 */
export function describeViolations({ envHatches = [], bundleHits = [], label = 'build' }) {
  const lines = [];
  if (envHatches.length > 0) {
    lines.push(
      `insecure dev hatch set in the build environment: ${envHatches.join(', ')} ` +
        '(process env or a .env file). Unset it to package a release widget.'
    );
  }
  for (const hit of bundleHits) {
    lines.push(
      `insecure dev hatch compiled into ${label}/${hit.file}: ${hit.hatches.join(', ')}. ` +
        'Rebuild with the variable unset.'
    );
  }
  return lines;
}
