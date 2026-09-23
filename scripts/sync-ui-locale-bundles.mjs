#!/usr/bin/env node
/**
 * sync-ui-locale-bundles.mjs — re-vendor the @phlix/ui locale bundles.
 *
 * Estate decision: phlix-ui is the SSOT for ui-catalog translations; clients
 * consume them via SHA-PINNED vendored copies (config-time messages seam,
 * wired at main.ts). This copies
 *   ../phlix-ui  <SOURCE_REF>:src/i18n/locales/{es,fr,de,it,pt_BR,ja,index}.ts
 * into src/i18n/ui-locale-bundles/ applying ONLY the deterministic transforms
 * below, then writes src/i18n/ui-locale-bundles/PIN (JSON): pinned
 * branch/ref + per-file sha256 of BOTH the pristine source blob and the
 * vendored output, so tests/unit/i18nLocales.test.ts can verify the copy
 * whenever the sibling repo is reachable (hard-fail locally, explicit skip
 * in CI where only phlix-contracts is cloned — see that suite's header).
 *
 * TRANSFORMS — the complete list; any other diff is drift:
 *  1. `../messages` has no client-side counterpart: the line
 *     `import type { PhlixMessages } from '../messages';` is rewritten to
 *     `import type { PhlixMessages } from '@phlix/ui';` (the type is a
 *     declared export of the package barrel since v0.99.5). EVERYTHING ELSE
 *     IS VERBATIM: the strict `satisfies PhlixMessages` (bundles) and
 *     `Record<PhlixLocaleCode, PhlixMessages>` (index) annotations survive,
 *     so the client build compile-checks key sets against the INSTALLED
 *     catalog. The earlier relaxation transforms (2: satisfies →
 *     `Record<string, Record<string, string>>`; 3: registry value → the same)
 *     existed ONLY because the dc1df7d5 bundles ran 7 keys ahead of the
 *     v0.99.4 install; the v0.99.5 re-pin closed that skew (exact key-set
 *     equality both directions), so the relaxation was deleted with it.
 *
 * Usage: node scripts/sync-ui-locale-bundles.mjs [--repo ../phlix-ui] [--ref <sha>] [--branch <name>]
 * Requires the sibling checkout to contain the pinned ref (git cat-file -e).
 * Bare run (no --ref/--branch) defaults to the PIN on disk — it RE-VENDORS
 * the pinned commit and is idempotent; it can never roll the vendor back to a
 * stale in-script constant. The SOURCE_* constants below are the BOOTSTRAP
 * anchor used only when no PIN exists yet, and
 * tests/unit/i18nLocales.test.ts hard-fails if they drift from the PIN.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * BOOTSTRAP anchor for the pin the vendor came from — applied ONLY when no
 * `PIN` manifest exists yet (first vendor). A bare run otherwise defaults to
 * PIN.ref/PIN.branch on disk, so this pair can never silently re-anchor an
 * already-pinned vendor backwards; the suite pins these constants equal to
 * the on-disk PIN, so a re-pin via `--ref` must update them too (drift fails
 * `tests/unit/i18nLocales.test.ts`).
 */
const SOURCE_BRANCH = 'master';
const SOURCE_REF = '3017f443f33a4368cb7b94c67f47814fe0db0bff';
const SOURCE_DIR = 'src/i18n/locales';
const TARGET_DIR = 'src/i18n/ui-locale-bundles';
const FILES = ['es.ts', 'fr.ts', 'de.ts', 'it.ts', 'pt_BR.ts', 'ja.ts', 'index.ts'];

/** The exact import line this vendor rewrites (transform 1). */
const SOURCE_IMPORT_LINE = "import type { PhlixMessages } from '../messages';\n";
/** Its client-side replacement: the same type, exported by the installed package. */
const VENDORED_IMPORT_LINE = "import type { PhlixMessages } from '@phlix/ui';\n";

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Deterministic source→vendored rewrite (the single transform; docblock has the why). */
function vendored(file, source) {
  if (!source.includes(SOURCE_IMPORT_LINE.trim())) {
    throw new Error(`${file}: the pinned '../messages' PhlixMessages import is gone upstream — update the script`);
  }
  const out = source.split(SOURCE_IMPORT_LINE).join(VENDORED_IMPORT_LINE);
  if (out.includes("'../messages'")) {
    throw new Error(`${file}: an unexpected variant of the '../messages' import survived the rewrite — update the script`);
  }
  // Fail loud if upstream ever drops the strict typing this vendor preserves:
  // the compile-check against the installed catalog is the whole point.
  const strictAnnotation =
    file === 'index.ts' ? 'Record<PhlixLocaleCode, PhlixMessages>' : 'satisfies PhlixMessages;';
  if (!out.includes(strictAnnotation)) {
    throw new Error(`${file}: upstream dropped \`${strictAnnotation}\` — the vendor must keep strict typing against the installed catalog`);
  }
  return out;
}

/**
 * Bare-run default pin: read the manifest on disk (idempotent re-vendor of
 * the pinned commit). Only a MISSING PIN falls back to the bootstrap
 * constants — a present-but-broken PIN fails fast rather than silently
 * re-anchoring the vendor to the constants.
 */
function pinnedFromDisk() {
  if (!existsSync(join(TARGET_DIR, 'PIN'))) {
    return { branch: SOURCE_BRANCH, ref: SOURCE_REF };
  }
  let pin;
  try {
    pin = JSON.parse(readFileSync(join(TARGET_DIR, 'PIN'), 'utf8'));
  } catch (error) {
    process.stderr.write(
      `FAIL: ${TARGET_DIR}/PIN exists but is not valid JSON — the bare-run default ref comes from it. Fix or delete the manifest.\n`,
    );
    throw error;
  }
  if (
    typeof pin.ref !== 'string' || pin.ref === '' ||
    typeof pin.branch !== 'string' || pin.branch === ''
  ) {
    throw new Error(
      `${TARGET_DIR}/PIN lacks a usable "ref"/"branch" — fix the manifest or delete it to fall back to the bootstrap constants.`,
    );
  }
  return { branch: pin.branch, ref: pin.ref };
}

const repo = arg('--repo', '../phlix-ui');
const pinned = pinnedFromDisk();
const ref = arg('--ref', pinned.ref);
const branch = arg('--branch', pinned.branch);

for (const file of FILES) {
  const source = execFileSyncText(repo, ref, file);
  const out = vendored(file, source);
  mkdirSync(TARGET_DIR, { recursive: true });
  writeFileSync(join(TARGET_DIR, file), out);
  process.stdout.write(`vendored ${file} (${out.length} bytes)\n`);
}

function execFileSyncText(gitRepo, gitRef, file) {
  try {
    return execFileSync('git', ['-C', gitRepo, 'show', `${gitRef}:${SOURCE_DIR}/${file}`], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    process.stderr.write(
      `FAIL: git -C ${gitRepo} show ${gitRef}:${SOURCE_DIR}/${file}\n` +
        `Is the sibling checkout present and does it contain ${gitRef}? ` +
        `(git -C ${gitRepo} cat-file -e ${gitRef})\n`,
    );
    throw error;
  }
}

const pin = {
  source: 'phlix-ui',
  branch,
  ref,
  directory: SOURCE_DIR,
  transforms: [
    "rewrite `import type { PhlixMessages } from '../messages';` -> `import type { PhlixMessages } from '@phlix/ui';` (strict typing — `satisfies`/`Record<...>` annotations — is preserved verbatim)",
  ],
  files: Object.fromEntries(
    FILES.map((file) => {
      const source = execFileSyncText(repo, ref, file);
      const out = readFileSync(join(TARGET_DIR, file), 'utf8');
      return [
        file,
        { source_sha256: sha256(source), vendored_sha256: sha256(out) },
      ];
    }),
  ),
};

writeFileSync(join(TARGET_DIR, 'PIN'), `${JSON.stringify(pin, null, 2)}\n`);
process.stdout.write(`PIN written: ${TARGET_DIR}/PIN (${FILES.length} files @ ${ref.slice(0, 8)})\n`);
