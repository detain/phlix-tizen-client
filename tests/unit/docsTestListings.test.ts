/**
 * docsTestListings — M-TIZEN-16 doc-citation truth law
 * (review tizen__writer MAJOR-4: "README still documents components/tests
 * deleted at S501").
 *
 * WHAT IT PINS:
 *  (a) every `*.test.ts` FILE NAME cited by the human-facing docs
 *      (README.md, DEVELOPER.md, AGENTS.md, CLAUDE.md, .claude/rules/*.md)
 *      exists under tests/ — a doc may not instruct `vitest run` on a suite
 *      that no longer ships, nor list a deleted file in its tree walkthrough;
 *      globs (`tests/unit/*.test.ts`) are not names and are never matched by
 *      the extraction regex (it requires a real stem);
 *  (b) every `npx vitest run <path>` command in README.md/DEVELOPER.md
 *      targets a file that exists (args beginning with `-` — `-t "BACK"` —
 *      are filters, not paths);
 *  (c) the README tree lines' overlay counts are derived from src/main.ts:
 *      BOTH "spatial-nav host + N overlay apps" (main.ts line) and
 *      "spatial-host + N overlay hosts" (index.html line) must equal the
 *      `createApp(...).mount(...)` calls minus the renderless spatial-nav
 *      host (both "5"s were the pre-S501 set Chapter/SleepTimer/SkipIntro/
 *      PiP/UpNext; S501 deleted two, S516/S520/S521/S523 added four — the
 *      lines silently fossilized at the old number);
 *  (d) host-div parity: every `#phlix-*` mount host in index.html (bar the
 *      main app and the splash) is mounted by a `createApp(...).mount(...)`
 *      call in src/main.ts and vice versa — the exact check that CAN succeed
 *      for the overlays it documents, replacing the pre-cure instruction that
 *      could never succeed for the PlayerPage-bundled sleep timer / up next;
 *      additionally every host-div id named in README's "Overlay Missing"
 *      section exists in index.html (the debug walk must not chase ghosts).
 *
 * Zero runtime imports (docsPinConsistency/docsDeployWalk idiom): reads doc,
 * README, index.html and src/main.ts as TEXT plus the tests/ directory only,
 * so the pin cannot self-reference what it checks.
 *
 * RED-ON-PARENT: planted at the pre-cure README (220ea1d) this suite is red
 * on arms (a) `UpNextOverlay.test.ts` cited in README + .claude/rules, (b) the
 * `npx vitest run tests/unit/UpNextOverlay.test.ts` command, and (c) the
 * "5 overlay apps" line. Measured runs recorded in
 * .reviews/fixlog/M-TIZEN-16__fix.md. Mutation teeth: re-planting any fossil
 * name reddens exactly its arm.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(path.join(REPO, rel), 'utf8');

/** A cited test-suite FILE NAME: real stem + `.test.ts` (globs never match). */
const TEST_NAME_RE = /[A-Za-z0-9_-][A-Za-z0-9._-]*\.test\.ts/g;

const DOC_SURFACES = ['README.md', 'DEVELOPER.md', 'AGENTS.md', 'CLAUDE.md'];

/** Doc surfaces whose prose cites suite paths as live examples. */
function allDocs(): Array<[string, string]> {
  const docs: Array<[string, string]> = DOC_SURFACES.map((rel) => [rel, read(rel)]);
  const rulesDir = path.join(REPO, '.claude', 'rules');
  for (const f of readdirSync(rulesDir)) {
    if (f.endsWith('.md')) {
      docs.push([`.claude/rules/${f}`, read(path.join('.claude/rules', f))]);
    }
  }
  return docs;
}

/** Resolve a citation as written: a path is repo-relative, a bare name lives in tests/unit/. */
function citationResolves(citation: string): boolean {
  if (citation.includes('/')) return existsSync(path.join(REPO, citation));
  return existsSync(path.join(REPO, 'tests', 'unit', citation));
}

/** `createApp(Component)...mount('#host')` calls in src/main.ts as [component, host]. */
function mountedApps(mainTs: string): Array<[string, string]> {
  return [...mainTs.matchAll(/createApp\((\w+)\)[^;]*?\.mount\('(#[^']+)'\)/g)].map((m) => [
    m[1],
    m[2],
  ]);
}

/** `#phlix-*` host div ids declared in index.html. */
function hostDivs(indexHtml: string): string[] {
  return [...indexHtml.matchAll(/<div id="(phlix-[^"]+)"/g)].map((m) => `#${m[1]}`);
}

describe('docsTestListings — doc-citation truth (M-TIZEN-16)', () => {
  describe('(a) every cited *.test.ts file exists', () => {
    for (const [rel, text] of allDocs()) {
      it(`${rel} names only existing suites`, () => {
        const citations = [...new Set(text.match(TEST_NAME_RE) ?? [])];
        for (const citation of citations) {
          expect(
            citationResolves(citation),
            `${rel} cites ${citation}, but no such file exists — deleted suites must be removed from docs in the same change (or the doc must mark them historical outside the cited form)`
          ).toBe(true);
        }
      });
    }
  });

  describe('(b) vitest single-file commands run real files', () => {
    for (const rel of ['README.md', 'DEVELOPER.md']) {
      it(`${rel} command targets exist`, () => {
        const targets = [...read(rel).matchAll(/npx vitest run ([^\s`]+)/g)]
          .map((m) => m[1])
          .filter((arg) => !arg.startsWith('-'));
        expect(targets.length, `${rel} must show at least one single-file run`).toBeGreaterThan(0);
        for (const target of targets) {
          expect(existsSync(path.join(REPO, target)), `${rel} runs missing file ${target}`).toBe(
            true
          );
        }
      });
    }
  });

  describe('(c) README overlay-app counts track main.ts', () => {
    it('both README tree-line counts equal the createApp mounts minus the spatial host', () => {
      const readme = read('README.md');
      const overlayMounts = mountedApps(read('src/main.ts')).filter(
        ([, host]) => host !== '#phlix-spatial-host'
      );
      const countPatterns: Array<[RegExp, string]> = [
        [/spatial-nav host \+ (\d+) overlay apps/, 'main.ts line "<N> overlay apps"'],
        [/spatial-host \+ (\d+) overlay hosts/, 'index.html line "<N> overlay hosts"'],
      ];
      for (const [re, label] of countPatterns) {
        const line = readme.split('\n').find((l) => re.test(l));
        expect(line, `README tree carries the ${label} count`).toBeDefined();
        expect(
          Number(re.exec(line as string)![1]),
          `${label} equals real overlay mounts in src/main.ts`
        ).toBe(overlayMounts.length);
      }
    });
  });

  describe('(d) host-div parity index.html ↔ src/main.ts', () => {
    const mainTs = read('src/main.ts');
    const html = read('index.html');
    const mounts = mountedApps(mainTs);

    it('every overlay host div in index.html is mounted by main.ts', () => {
      const exempt = new Set(['#phlix-app', '#phlix-splash']);
      const mounted = new Set(mounts.map(([, host]) => host));
      for (const div of hostDivs(html)) {
        if (exempt.has(div)) continue;
        expect(mounted.has(div), `index.html div ${div} has no createApp mount in main.ts`).toBe(
          true
        );
      }
    });

    it('every main.ts mount target exists as an index.html div', () => {
      const declared = new Set(hostDivs(html));
      for (const [, host] of mounts) {
        expect(declared.has(host), `main.ts mounts ${host}, absent from index.html`).toBe(true);
      }
    });

    it('the Overlay Missing section names only real host divs', () => {
      const start = read('README.md').indexOf('### Overlay Missing');
      expect(start, 'README keeps an "Overlay Missing" debug section').toBeGreaterThan(-1);
      const rest = read('README.md').slice(start);
      const section = rest.slice(0, rest.indexOf('\n### ', 4) === -1 ? rest.length : rest.indexOf('\n### ', 4));
      const declared = new Set(hostDivs(html));
      for (const id of new Set(section.match(/#phlix-[a-z-]+/g) ?? [])) {
        expect(declared.has(id), `Overlay Missing walk references ${id} — no such div`).toBe(true);
      }
    });
  });
});
