/**
 * docsDeployWalk — M-TIZEN-15 Deployment-to-TV runnability law
 * (review tizen__writer MAJOR-3: "'Deployment to TV' cannot be completed by
 * a first-timer").
 *
 * WHAT IT PINS:
 *  (a) the fossil instruction "Select the `phlix-tizen` directory" never
 *      returns — no such directory exists (the clone dir is
 *      phlix-tizen-client; `phlix-tizen` is only the npm package name), and
 *      the repo root is not importable (Tizen web imports need config.xml at
 *      the project root; the manifest lives in app/);
 *  (b) the section teaches the config.xml-at-project-root reality instead of
 *      silently failing on import;
 *  (c) the directory it tells you to import/sign actually exists in the tree
 *      as a widget project root (package/config.xml on disk);
 *  (d) no duplication drift: README's Option-2 `tizen install` / `tizen run`
 *      argv match docs/signing.md's canonical walk, and the `tizen package`
 *      flag skeleton matches too (placeholder names normalized);
 *  (e) the app id the README runs is the one app/config.xml declares;
 *  (f) M-TIZEN-17 anti-phantom sweep: every `tizen package` command line in
 *      either file carries only flags the official CLI reference documents —
 *      no `-o`, no `--password` (the 1d37585 cure introduced `-o ./release`;
 *      the reference table has only -t/-s/-S/--, identical 2022→2026);
 *  (g) M-TIZEN-17 install contract: `install -n` takes a bare FILE NAME and
 *      `-- <dir>` the directory holding the widget copy — never the tracked,
 *      CI-freshness-gated `package/` root itself (the official TV CLI writes
 *      the signed .wgt INTO the `--` directory), and no `sdb capability` /
 *      fabricated Google-Cloud SDK URL survives anywhere in either file.
 *
 * Zero runtime imports (docsPinConsistency/versionStamping idiom): reads FILE
 * TEXT and the filesystem only, never src/ or node_modules, so the pin cannot
 * self-reference what it checks.
 *
 * RED-ON-PARENT: at f9329a5 arms (a) and (b) fail — line 282 carried
 * "Select the `phlix-tizen` directory" and nothing in the section mentioned
 * the project-root requirement. Arms (c)(d)(e) pass at the parent too (they
 * are anti-drift guards around the 1d37585 partial cure), so the suite's
 * first-ever run was green after the cure; the measured parent reds are the
 * two arms this lane fixes. Recorded in .reviews/fixlog/M-TIZEN-15__fix.md.
 * Arms (f)(g) are the M-TIZEN-17 additions: RED on their own parent
 * (756e79b) where signing.md/README still carried the phantom `-o ./release`
 * package flag, the path-valued `install -n`, and `sdb capability`; measured
 * in .reviews/fixlog/M-TIZEN-17__fix.md.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(path.join(REPO, rel), 'utf8');

/** Text of README.md from "## Deployment to TV" to the next "## " heading. */
function deploySection(readme: string): string {
  const start = readme.indexOf('\n## Deployment to TV\n');
  expect(start, 'README.md has a "Deployment to TV" section').toBeGreaterThan(-1);
  const rest = readme.slice(start + 1);
  const end = rest.indexOf('\n## ', '## Deployment to TV'.length + 1);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Flag-skeleton of a captured argv tail: tokens in order, <placeholder> normalized. */
function argvSkeleton(line: string): string[] {
  return line
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => (tok.startsWith('<') ? '<P>' : tok));
}

/**
 * Last CLI invocation of `verb` in `text`. Accepts both spellings in use
 * across the docs (`.../bin/tizen <verb>` and `"$TIZEN" <verb>`) and joins
 * shell line continuations first.
 */
function cliLine(text: string, verb: string): string {
  const joined = text.replace(/\\\s*\n\s+/g, ' ');
  const re = new RegExp(`^[^\\n]*\\btizen"?\\s+${verb} (.+)$`, 'gmi');
  const m = [...joined.matchAll(re)];
  expect(m.length, `at least one "tizen ${verb}" command line exists`).toBeGreaterThan(0);
  return m[m.length - 1][1];
}

/** Raw argv tails of EVERY invocation of `verb` (continuations joined), M-TIZEN-17. */
function allCliLines(text: string, verb: string): string[] {
  const joined = text.replace(/\\\s*\n\s+/g, ' ');
  const re = new RegExp(`^[^\\n]*\\btizen"?\\s+${verb} (.+)$`, 'gmi');
  return [...joined.matchAll(re)].map((m) => m[1]);
}

describe('Deployment-to-TV walk is runnable for a first-timer (M-TIZEN-15)', () => {
  const readme = read('README.md');
  const signing = read(path.join('docs', 'signing.md'));
  const section = deploySection(readme);

  it('never instructs selecting the nonexistent `phlix-tizen` directory', () => {
    expect(section, 'fossil import instruction must not return').not.toMatch(
      /Select the `phlix-tizen` directory/,
    );
    expect(section).not.toMatch(/`phlix-tizen\/`/); // path-style bare ref
    expect(readme).toMatch(/phlix-tizen-client/); // the real clone dir is named truthfully
  });

  it('teaches WHY the repo root is not importable (config.xml at project root)', () => {
    expect(section).toMatch(/config\.xml[^.]*project root/s);
    expect(section).toMatch(/app\/config\.xml/); // names where the manifest really lives
  });

  it('the directory it tells you to import exists on disk as a widget project root', () => {
    expect(section).toMatch(/`package\/`/);
    expect(existsSync(path.join(REPO, 'package', 'config.xml')), 'package/config.xml').toBe(true);
    expect(existsSync(path.join(REPO, 'app', 'config.xml')), 'app/config.xml').toBe(true);
  });

  it('install/run argv do not drift from docs/signing.md canonical walk', () => {
    expect(argvSkeleton(cliLine(section, 'install'))).toEqual(
      argvSkeleton(cliLine(signing, 'install')),
    );
    expect(argvSkeleton(cliLine(section, 'run'))).toEqual(argvSkeleton(cliLine(signing, 'run')));
  });

  it('package-flag skeleton matches signing.md and `-s` stays a profile name', () => {
    const readmePkg = argvSkeleton(cliLine(section, 'package'));
    const signingPkg = argvSkeleton(cliLine(signing, 'package'));
    expect(readmePkg).toEqual(signingPkg);
    expect(readmePkg).toContain('-s');
    expect(section, 'the -s placeholder must read as a NAME, never a .p12 path').toMatch(
      /-s <profile-name>/,
    );
    expect(section).not.toMatch(/-s \S*\.p12/);
  });

  it('the app id the walk runs is the one app/config.xml declares', () => {
    const appXml = read(path.join('app', 'config.xml'));
    const idMatch = appXml.match(/tizen:application id="([^"]+)"/);
    expect(idMatch, 'app/config.xml declares a tizen:application id').not.toBeNull();
    expect(cliLine(section, 'run'), 'README run line uses the declared id').toContain(
      idMatch![1],
    );
    expect(cliLine(signing, 'run')).toContain(idMatch![1]);
  });

  it('every tizen package line carries only officially documented flags (M-TIZEN-17)', () => {
    // Official reference (Samsung/tizen-docs command-line-interface.md, table
    // identical 2022→2026) documents ONLY -t/--type, -s/--sign, -S/--strip and
    // `-- <path>`; the TV CLI page likewise. `-o`/`--password` are phantoms.
    for (const [name, text] of [
      ['README.md', readme],
      ['docs/signing.md', signing],
    ] as const) {
      const lines = allCliLines(text, 'package').filter((l) => l.includes('wgt'));
      expect(lines.length, `${name}: package command lines exist`).toBeGreaterThan(0);
      for (const line of lines) {
        const argv = argvSkeleton(line);
        expect(argv, `${name}: tizen package has no -o flag: ${line}`).not.toContain('-o');
        expect(argv, `${name}: tizen package has no --password flag: ${line}`).not.toContain(
          '--password',
        );
        // The `--` directory is where the signed .wgt lands (TV CLI:
        // "-- <output path> : Package output path") — one must be given.
        expect(argv, `${name}: package needs a -- <output dir>: ${line}`).toContain('--');
      }
    }
  });

  it('install honors the -n <file name> + -- <dir> contract; no fabricated sdb/SDK lore (M-TIZEN-17)', () => {
    for (const [name, text] of [
      ['README.md', readme],
      ['docs/signing.md', signing],
    ] as const) {
      for (const line of allCliLines(text, 'install').filter((l) => l.includes('-n'))) {
        const argv = argvSkeleton(line);
        const n = argv[argv.indexOf('-n') + 1];
        expect(n, `${name}: install -n takes a bare FILE NAME: ${line}`).toBeDefined();
        expect(n, `${name}: install -n must not be a path: ${line}`).not.toContain('/');
        const dir = argv[argv.indexOf('--') + 1];
        expect(
          dir,
          `${name}: never write the signed .wgt into the tracked package/ root: ${line}`,
        ).not.toBe('./package');
      }
      expect(text, `${name}: sdb capability is not an SDB command`).not.toMatch(/sdb capability/);
      expect(text, `${name}: Google-Cloud Tizen SDK URL was fabricated`).not.toMatch(
        /storage\.googleapis\.com\/tizen-sdk/,
      );
    }
  });
});
