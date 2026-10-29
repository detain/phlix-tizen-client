/**
 * distApiFloor — runtime engine-floor tripwire (M-TIZEN-03 / review tizen__crossfe M1).
 *
 * WHAT IT PINS: the committed widget bundle (`package/` — the byte-tree CI ships
 * and the freshness gate "Assert committed package/ is fresh" re-verifies) must
 * stay inside the repo's declared runtime contract: **Chromium ≥ 85**, enforced
 * at API level, not just byte level. The existing gate proves shipped == rebuilt;
 * this proves rebuilt == runnable on the field population the repo admits
 * ("older Samsung Tizen webviews (pre-Chrome 98)" — src/polyfills.ts header).
 *
 * THE CONTRACT (canonical: docs/runtime-floor.md):
 *  1. Syntax: esbuild `target: 'chrome100'` lowers nothing the Chrome-100 era
 *     already has — it is a CEILING, not a floor. The bundle's real parse floor
 *     is logical assignment operators (`||=` / `&&=` / `??=`, Chrome 85). Syntax
 *     markers above 85 (class static blocks, BigInt literals, private-in) must
 *     be ABSENT — today they are by accident of deps; from now on by enforcement.
 *  2. Runtime APIs above 85 may exist in the dist ONLY if (a) polyfilled in
 *     src/polyfills.ts (the sanctioned single point — Array.prototype.at Chrome 92,
 *     structuredClone Chrome 98), or (b) inert defs with zero live callers,
 *     pinned here with their exact call-shape (Vue 3.5's reactive-array patcher).
 *  3. Any new above-floor live call site from a future @phlix/ui re-vendor reddens
 *     a count/shape pin here → a human either polyfills at src/polyfills.ts,
 *     raises the floor WITH evidence, or holds the re-pin. Rotation of a pin must
 *     carry attribution in this file + docs/runtime-floor.md, never a silent
 *     number change (estate tripwire law: moved pins are re-pins, not resets).
 *
 * Census measured 2026-10-29 at master 1d37585 over package/assets/*.js (35 files)
 * + index.html — every figure below re-derived from disk, none from the review prose.
 *
 * M-TIZEN-08 adds the CLAIM side of the same contract: the shipped bundle's
 * ≥ 85 floor and the manifest/docs promises must never diverge (the original
 * defect was "bundle unparseable below 85 while the surface claims pre-85
 * support"). See the claim-side describe below for the three laws and why the
 * platform-version check is a non-claim pin, not a floor computation.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PKG_DIR = join(__dirname, '..', '..', 'package');
const ASSETS_DIR = join(PKG_DIR, 'assets');

/** The repo's declared runtime contract (canonical copy: docs/runtime-floor.md). */
const SUPPORTED_FLOOR_CHROMIUM_MAJOR = 85;

function assetFiles(): string[] {
  expect(existsSync(ASSETS_DIR), `committed bundle missing: ${ASSETS_DIR}`).toBe(true);
  return readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.js'));
}

function readAsset(file: string): string {
  return readFileSync(join(ASSETS_DIR, file), 'utf8');
}

/** The entry chunk is whatever index.html actually loads (hash-agnostic). */
function entryChunkName(): string {
  const html = readFileSync(join(PKG_DIR, 'index.html'), 'utf8');
  const m = html.match(/src="\.\/assets\/(index-[^"]+\.js)"/);
  expect(m, 'index.html does not reference an ./assets/index-*.js entry').not.toBeNull();
  return m![1];
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

function countMatchesAcrossAssets(pattern: RegExp): number {
  let total = 0;
  for (const f of assetFiles()) {
    const matches = readAsset(f).match(pattern);
    total += matches ? matches.length : 0;
  }
  return total;
}

describe('distApiFloor — runtime engine floor of the committed package/ bundle', () => {
  it('the contract file and this test agree on one canonical floor', () => {
    expect(SUPPORTED_FLOOR_CHROMIUM_MAJOR).toBe(85);
    const doc = readFileSync(join(PKG_DIR, '..', 'docs', 'runtime-floor.md'), 'utf8');
    expect(doc).toContain('Chromium ≥ 85');
    expect(doc).toContain('distApiFloor');
  });

  describe('parse-level markers (syntax above Chrome 85 must be absent)', () => {
    it('keeps the measured Chrome-85 syntax present (the floor is real, not decorative)', () => {
      // ||=/&&=/??= are Chrome 85. Their presence proves esbuild's chrome100
      // ceiling passes ≥85 syntax through UNlowered — so any syntax above the
      // floor below would equally survive. Measured 1d37585: ||= ×530, &&= ×37, ??= ×1.
      expect(countMatchesAcrossAssets(/\|\|=/g)).toBeGreaterThan(100);
      expect(countMatchesAcrossAssets(/&&=/g)).toBeGreaterThan(0);
    });

    it('carries no class static blocks (Chrome 94)', () => {
      expect(countMatchesAcrossAssets(/static \{/g)).toBe(0);
      expect(countMatchesAcrossAssets(/static\{/g)).toBe(0);
    });

    it('carries no BigInt literals (Chrome 104 numeric-separator-era syntax)', () => {
      // \b\d+n\b matches `10n`/`0n` literals, not identifiers like `e1n`
      // (no word boundary inside) and not `a&&n`/`1,n` (non-adjacent).
      expect(countMatchesAcrossAssets(/\b\d+n\b/g)).toBe(0);
    });

    it('carries no private-brand checks `#x in y` (Chrome 84, below floor but pinned)', () => {
      expect(countMatchesAcrossAssets(/#[A-Za-z_$][\w$]*\s+in\s/g)).toBe(0);
    });
  });

  describe('runtime APIs above the floor: only polyfilled or inert-pinned may exist', () => {
    it('pins the single Error-cause options bag (Chrome 93) as a graceful-degradation exception', () => {
      // hls.js formats errors as `Error(msg,{cause:r})` — ONE site, measured
      // 1d37585, inside the hls chunk. On engines below 93 the Error constructor
      // ignores the options bag: the Error still constructs, only the cause
      // chain is lost (this is error-formatting glue, not control flow). Non-
      // crashing → documented exception (docs/runtime-floor.md). Any INCREASE
      // in the census means another above-floor cause site arrived; re-adjudicate.
      let total = 0;
      for (const f of assetFiles()) total += countOccurrences(readAsset(f), '{cause:');
      expect(total).toBe(1);
      expect(countOccurrences(readAsset(assetFiles().find((f) => f.startsWith('hls-'))!), '{cause:')).toBe(1);
      expect(countMatchesAcrossAssets(/Object\.hasOwn\(/g)).toBe(0);
    });

    it('polyfills Array.prototype.at (Chrome 92) at the entry chunk', () => {
      // Vendored @phlix/ui PosterPicker chunk calls `.at(-1)` — three sites,
      // measured 1d37585. Those live above the 85 floor, so the entry bundle
      // MUST carry the src/polyfills.ts install guard. The minified install
      // shape is `typeof Array.prototype.at!="function"&&Object.defineProperty(Array.prototype,"at",{...`.
      const entry = readAsset(entryChunkName());
      expect(entry).toContain('typeof Array.prototype.at!="function"');
      expect(entry).toContain('Object.defineProperty(Array.prototype,"at"');
    });

    it('keeps the Array.prototype.at live call sites count- and receiver-pinned', () => {
      // Pinned census: exactly 3 × `.at(-1)`, all in the PosterPicker chunk
      // (admin-gated, lazy page). Each `.value` receiver is a Vue ref read →
      // a plain Array → covered by the Array polyfill. String.prototype.at and
      // TypedArray.at are NOT polyfilled — a new `.at(` site outside this pin
      // (any count change, any other file, or a different argument shape)
      // must be adjudicated by a human: covered-array? polyfill decision?
      // floor raise with evidence? (tripwire law, header item 3).
      const total = countMatchesAcrossAssets(/\.at\(/g);
      expect(total).toBe(3);
      for (const f of assetFiles()) {
        expect(countOccurrences(readAsset(f), '.at(')).toBe(
          f.startsWith('PosterPicker-') ? 3 : 0
        );
      }
    });

    it('polyfills structuredClone (Chrome 98) at the entry chunk, with zero raw call sites', () => {
      // Measured 1d37585: exactly 2 occurrences of the token, both inside the
      // install guard in the entry chunk — no bare `structuredClone(` call
      // survives in any chunk. The guard exists for the vendored ui's
      // SettingsForm reliance; a re-vendor that inlines a raw call must first
      // pass the typeof guard — rotation law as for `.at(`.
      const entry = readAsset(entryChunkName());
      expect(entry).toContain('typeof globalThis.structuredClone!="function"');
      const total = countMatchesAcrossAssets(/structuredClone/g);
      expect(total).toBe(2);
      expect(countMatchesAcrossAssets(/[^.]structuredClone\(/g)).toBe(0);
    });

    it('pins Vue 3.5 reactive-array patcher defs as INERT (toSorted/toReversed/toSpliced, Chrome 110)', () => {
      // These defs live in the entry chunk and call the NATIVE method ONLY on
      // `X(this)` — Vue's toRaw-clone receiver. They are reachable only if app
      // code calls the method on a REACTIVE array; the bundle has zero such
      // callers today (dotted occurrence is the def body itself, nothing else).
      // A future ui/vue version that adds a live `.toSorted()` call site adds a
      // dotted occurrence outside the def-body shape → red here → adjudicate.
      const entry = readAsset(entryChunkName());
      for (const name of ['toSorted', 'toReversed', 'toSpliced'] as const) {
        // 2 token occurrences: 1 def key + 1 native call in the def body.
        expect(countOccurrences(entry, name), `${name} total`).toBe(2);
        // The only dotted call form must be the def-body clone receiver.
        const dotted = entry.match(new RegExp(`\\w*\\(?this\\)?\\.${name}\\(`, 'g')) ?? [];
        expect(dotted.length, `${name} dotted-call census`).toBe(1);
        const foreign =
          countOccurrences(entry, `.${name}(`) - countOccurrences(entry, `this).${name}(`);
        expect(foreign, `${name} call sites outside the def body`).toBe(0);
      }
      // findLast/findLastIndex (Chrome 97): defs delegate through Vue's Wt
      // helper with a STRING method name — no dotted native call form at all.
      // Occurrences: findLast ×4 = key + "findLast" string + findLastIndex
      // prefix ×2 (key + string).
      expect(countOccurrences(entry, 'findLastIndex')).toBe(2);
      expect(countOccurrences(entry, 'findLast')).toBe(4);
      expect(countOccurrences(entry, '.findLast(')).toBe(0);
      expect(countOccurrences(entry, '.findLastIndex(')).toBe(0);
      // These defs must not exist outside the entry chunk's patcher.
      for (const f of assetFiles()) {
        if (f === entryChunkName()) continue;
        for (const name of ['toSorted', 'toReversed', 'toSpliced', 'findLast']) {
          expect(countOccurrences(readAsset(f), name), `${name} in ${f}`).toBe(0);
        }
      }
    });
  });

  describe('the polyfill module is the sanctioned single point (source-level)', () => {
    it('src/polyfills.ts guards BOTH above-floor installs and is imported first by main.ts', () => {
      const src = readFileSync(join(__dirname, '..', '..', 'src', 'polyfills.ts'), 'utf8');
      expect(src).toContain("typeof globalThis.structuredClone !== 'function'");
      expect(src).toContain("typeof Array.prototype.at !== 'function'");
      const main = readFileSync(join(__dirname, '..', '..', 'src', 'main.ts'), 'utf8');
      // './polyfills' must be the first import in the entry (before @phlix/ui).
      const firstImport = main.match(/import '([^']+)'/);
      expect(firstImport?.[1]).toBe('./polyfills');
    });
  });

  /* ------------------------------------------------------------------------
   * CLAIM SIDE (M-TIZEN-08 / review tizen__exploiter lineage) — the surface
   * that SAYS what engines are supported must never undercut the ≥ 85 floor
   * this file enforces on the bundle itself.
   *
   * Why these are three non-numeric laws, not a floor computation: the brief
   * asked to "parse config.xml required applications, assert implied floor >=
   * 85". That arithmetic needs a Tizen-platform ↔ Chromium-major mapping, and
   * the canonical contract REFUSES to fabricate one (docs/runtime-floor.md:
   * required_version is "a Tizen platform version, not a Chromium version").
   * Inventing a mapping here would make the test less truthful, not more. So:
   *  L1 — the manifest can never carry an engine claim (zero Chrome/Chromium
   *       tokens; required_version stays the pinned platform literal), so it
   *       can never state a floor below 85 — or above it, either;
   *  L2 — the adjudication that keeps L1 honest stays on the books: if anyone
   *       ever attaches a Chromium implication to 6.5 (in either direction),
   *       the pinned sentence reddens here and the whole trio re-adjudicates;
   *  L3 — every hand-written doc that SPEAKS engine versions must state the
   *       bounded contract in the same breath (floor literal + canonical
   *       pointer), which kills the unbounded "pre-Chrome-98 webviews" reading
   *       — the actual shipped survivor — from ever living in docs again.
   * ---------------------------------------------------------------------- */
  describe('claim side — manifest and docs must never undercut the floor (M-TIZEN-08)', () => {
    const REPO = join(__dirname, '..', '..');

    it('L1: the .wgt manifest carries no engine claim; required_version stays the pinned platform literal', () => {
      // A <chrome|chromium> token in the manifest would be an engine-version
      // promise the repo cannot adjudicate (L2 law) — and a pre-85 one would
      // directly contradict this file's bundle enforcement. Preventative: no
      // such token exists today (disclosed green, not red-on-parent).
      for (const rel of ['app/config.xml', 'package/config.xml']) {
        const xml = readFileSync(join(REPO, rel), 'utf8');
        expect(xml.toLowerCase(), `${rel} must not mention Chrome/Chromium`).not.toMatch(
          /chro?mium|chrome/
        );
        const m = xml.match(/required_version="([^"]+)"/);
        expect(m, `${rel} declares a required_version`).not.toBeNull();
        // Tizen PLATFORM version (never a Chromium major — see L2). If the
        // supported device population changes, this pin, docs/runtime-floor.md
        // and the README rotate together, with attribution (tripwire law).
        expect(m![1], `${rel} required_version`).toBe('6.5');
      }
    });

    it('L2: the floor doc keeps its no-fabricated-mapping adjudication of required_version', () => {
      // The manifest's install gate is honest ONLY while docs/runtime-floor.md
      // still declares 6.5 a platform version, not a Chromium version, and
      // refuses to map it. Reddening this pin forces re-adjudication of L1's
      // literal and every claim-surface doc (L3) in the same change.
      const doc = readFileSync(join(REPO, 'docs', 'runtime-floor.md'), 'utf8');
      expect(doc).toContain('not a Chromium version');
      expect(doc).toContain('does not fabricate');
    });

    it('L3: every claim-surface doc that speaks engine versions states the bounded contract', () => {
      // Corpus: the hand-written user-facing surfaces. Excluded by design:
      // docs/runtime-floor.md (the contract itself), VERIFICATION.md +
      // CHANGELOG.md (dated historical records — estate law keeps them
      // verbatim), AGENTS.md/CLAUDE.md (caliber-managed mirrors), and the
      // manifest (L1 forbids it speaking engine versions at all).
      // Trigger = the file makes a numeric engine/version-shaped statement;
      // obligation = it must simultaneously bound the claim: the ≥ 85 floor
      // literal AND the canonical pointer. Red-on-parent at e4c81bb was
      // DEVELOPER.md ("for pre-Chrome-98 Tizen webviews", unbounded);
      // README.md and src/polyfills.ts were already reconciled (green).
      const ENGINE_CLAIM = /(pre-?chrome|chrome[- ]?\d|chromium\s*[≥><=]?\s*\d|chrome\d{2,})/i;
      for (const rel of ['README.md', 'DEVELOPER.md', 'src/polyfills.ts']) {
        const text = readFileSync(join(REPO, rel), 'utf8');
        if (!ENGINE_CLAIM.test(text)) continue;
        const bounded =
          (text.includes('Chromium ≥ 85') || text.includes('Chromium >= 85')) &&
          text.includes('docs/runtime-floor.md');
        expect(bounded, `${rel} speaks engine versions but does not state the Chromium ≥ 85 contract + canonical pointer`).toBe(true);
      }
    });
  });
});
