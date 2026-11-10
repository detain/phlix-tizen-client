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
 *
 * RT-106 / RT-107 (lane w24-L3, 2026-11-09, review tizen__crossfe M1+M2 at
 * 91e3848) close the two governance gaps that file named: the crypto.randomUUID
 * (Chrome 92) install + per-chunk census (the vendored Menu call is the third
 * polyfilled live-site class after `.at` and structuredClone), and the
 * color-mix() (Chrome 111) CSS census + guard-completeness classifier, whose
 * row restores the floor doc's "complete measured census" claim.
 *
 * RT-087 (pinia ^3.0.0 -> ^4.1.0 manual bump, 2026-11-10, owner ruling (a))
 * is the first DEP arrival this tripwire was built for: pinia 4 rewrote its
 * own-property checks from `Object.prototype.hasOwnProperty.call` to
 * `Object.hasOwn(...)` — a Chrome 93 API, above the 85 floor — landing THREE
 * live call sites inside the entry chunk's vendored pinia dist. The absent-
 * by-accident pin (`Object.hasOwn` count 0, previously a one-liner inside the
 * Error-cause test) reddened exactly as header item 3 prescribes; the cure is
 * the sanctioned one (polyfill at src/polyfills.ts) and the pin rotates here,
 * now living in its own named test with the install-shape asserts. Measured
 * 2026-11-10 at the rebuilt package/ (entry index-DgueOqPh.js).
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

/** The exact @supports probe esbuild/rollup emit for the ui floor-fallbacks. */
const COLOR_MIX_PROBE = '@supports not (color:color-mix(in srgb,red,blue))';

interface ColorMixCensus {
  /** innermost rules carrying a color-mix declaration (token = one site). */
  declarationSites: number;
  /** sites whose selector+property twin lives in an @supports-not guard body. */
  blockGuarded: number;
  /** sites preceded by a same-property declaration in the SAME rule. */
  doubleDeclared: number;
  /** sites with NEITHER guard form — accepted-drop candidates. */
  unguarded: string[];
}

/**
 * RT-107 census classifier — pure over the shipped stylesheet text. Walks
 * every innermost rule (recursing through @media/@supports/@keyframes),
 * and for each declaration containing `color-mix(` classifies its guard
 * form. Whole-selector matching (main rule selector vs guard-body selector
 * split on commas): a shape the classifier does not know lands in
 * `unguarded` and reddens the pin — fail-loud by construction.
 */
function classifyColorMixSites(css: string): ColorMixCensus {
  const openBrace = COLOR_MIX_PROBE.length + 1; // index offset of the block '{'
  const guardSelectors = new Set<string>();
  let idx = css.indexOf(COLOR_MIX_PROBE + '{');
  while (idx !== -1) {
    let depth = 0;
    let j = idx + openBrace - 1;
    const bodyStart = j + 1;
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = css.slice(bodyStart, j);
    const ruleRe = /([^{}]+)\{[^{}]*\}/g;
    let r: RegExpExecArray | null;
    while ((r = ruleRe.exec(body))) {
      for (const sel of r[1].split(',')) guardSelectors.add(sel.trim());
    }
    idx = css.indexOf(COLOR_MIX_PROBE + '{', j);
  }

  const out: ColorMixCensus = { declarationSites: 0, blockGuarded: 0, doubleDeclared: 0, unguarded: [] };
  function* rulesDeep(text: string): Generator<{ selector: string; body: string }> {
    let i = 0;
    while (i < text.length) {
      const brace = text.indexOf('{', i);
      if (brace === -1) return;
      const prelude = text.slice(i, brace).trim();
      let depth = 1;
      let j = brace + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const body = text.slice(brace + 1, j - 1);
      if (prelude.startsWith('@')) yield* rulesDeep(body);
      else yield { selector: prelude, body };
      i = j;
    }
  }
  for (const { selector, body } of rulesDeep(css)) {
    const seenProps = new Set<string>();
    for (const decl of body.split(';')) {
      if (!decl.includes('color-mix(')) {
        const p = decl.split(':')[0]?.trim();
        if (p) seenProps.add(p);
        continue;
      }
      const prop = decl.split(':')[0].trim();
      // Token math, not statement math: 35 tokens ride 31 declarations —
      // the two ambient/backdrop scrim gradients each mix two colors in one
      // `background:` value. Every bucket counts tokens so the three
      // sub-counts partition declarationSites exactly.
      const tokens = (decl.match(/color-mix\(/g) ?? []).length;
      out.declarationSites += tokens;
      if (seenProps.has(prop)) out.doubleDeclared += tokens;
      else if (guardSelectors.has(selector)) out.blockGuarded += tokens;
      else for (let t = 0; t < tokens; t++) out.unguarded.push(`${selector} {${prop}}`);
    }
  }
  return out;
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
      // RT-087 (2026-11-10): the `Object.hasOwn` absent-pin that rode in this
      // test (Chrome-93 neighbour, both were "absent by accident") rotated to
      // its own named test below when pinia 4 made it a three-site LIVE class.
    });

    /* ------------------------------------------------------------------
     * RT-087 (owner ruling (a), 2026-11-10, pinia ^4.1.0 manual bump) —
     * `Object.hasOwn` is Chrome 93, above the 85 floor. pinia 4's shipped
     * dist calls it at THREE live sites — two in the reactive-object state
     * merge (`mergeReactiveObjects`: own-key loop + own-key guard on the
     * recursion), one in the store-symbol membership check — all inside the
     * entry chunk, all dependency-minified code the client cannot edit.
     * RED-ON-PARENT for this lane: the pre-bump bundle measured 0 (the old
     * absent pin), post-bump pre-polyfill measured 3 with no install guard,
     * and the entry-shape asserts below are red on any tree that lost the
     * src/polyfills.ts install. Cure = the sanctioned point, third precedent
     * repeated; census law identical to randomUUID's (header item 3): a
     * count move means pinia's dist reshaped → re-adjudicate.
     * ---------------------------------------------------------------- */
    it('polyfills Object.hasOwn (Chrome 93) at the entry chunk (RT-087)', () => {
      const entry = readAsset(entryChunkName());
      // Minified install shape from src/polyfills.ts (same fold class as the
      // `.at`/structuredClone guards: a `!=` string compare survives). The
      // guard must stay CALL-FREE (`typeof Object.hasOwn!=`, not `hasOwn(`)
      // so the dep call-census below stays a pure pinia measure.
      expect(entry).toContain('typeof Object.hasOwn!="function"');
      expect(entry).toContain('Object.defineProperty(Object,"hasOwn"');
      // esbuild strips the inner function name (same as the `at`/randomUUID
      // installs): the shim body reaches for the ES1 hasOwnProperty directly.
      expect(entry).not.toContain('function hasOwn');
      expect(entry).toContain('hasOwnProperty.call');
    });

    it('keeps the Object.hasOwn census pinned: 3 dep call sites, all entry-local (RT-087)', () => {
      // Measured 2026-11-10 at the RT-087 rebuild. ENTRY 4 bare `Object.hasOwn`
      // tokens = 3 live calls + 1 typeof guard; zero `Object.hasOwn(` calls
      // anywhere outside the entry (the guard is a call-free read). A count
      // move = pinia's dist reshaped or a new above-floor arrival → re-
      // adjudicate (header item 3), never silently re-number.
      expect(countMatchesAcrossAssets(/Object\.hasOwn\(/g)).toBe(3);
      const entry = readAsset(entryChunkName());
      expect(countOccurrences(entry, 'Object.hasOwn')).toBe(4);
      for (const f of assetFiles()) {
        if (f === entryChunkName()) continue;
        expect(countOccurrences(readAsset(f), 'Object.hasOwn')).toBe(0);
      }
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

    /* ------------------------------------------------------------------
     * RT-106 (review tizen__crossfe M1, lane w24-L3 2026-11-09) —
     * crypto.randomUUID is Chrome 92, i.e. ABOVE the 85 floor, and the
     * vendored @phlix/ui Menu component calls it UNGUARDED inside setup()
     * (ui Menu.vue:62 `const baseId = crypto.randomUUID()`; still unguarded
     * upstream at the #v0.99.25 pin). On the admitted 85–91 population the
     * TypeError unmounts every Menu subtree — Player quality/captions/speed,
     * UserMenu, MediaCard context menus, Libraries menus. The call site is
     * vendored minified JS the client cannot edit, so — exactly the
     * Array.prototype.at precedent — the cure installs at src/polyfills.ts:
     * an RFC 4122 v4 shim over crypto.getRandomValues (ancient support).
     * RED-ON-PARENT at cc8a40f8: both the entry-shape asserts below (no
     * shim installed yet) and the token census (5 ≠ 7 pre-cure).
     * ---------------------------------------------------------------- */
    it('polyfills crypto.randomUUID (Chrome 92) at the entry chunk (RT-106)', () => {
      // Minified install shape esbuild emits from src/polyfills.ts. Two
      // folds, both measured 2026-11-09 post-cure: `typeof X !== "function"`
      // keeps the string form with `!=` (same fold the structuredClone/at
      // guards above are pinned in), while `typeof X !== "undefined"` is
      // folded further, to the `<"u"` short-compare. The getRandomValues
      // precondition is the shim's honesty clause: it only claims what the
      // floor engine actually provides (Chrome 1-era API).
      const entry = readAsset(entryChunkName());
      expect(entry).toContain('typeof globalThis.crypto<"u"');
      expect(entry).toContain('typeof globalThis.crypto.randomUUID!="function"');
      expect(entry).toContain('typeof globalThis.crypto.getRandomValues=="function"');
      expect(entry).toContain('Object.defineProperty(globalThis.crypto,"randomUUID"');
    });

    it('keeps the crypto.randomUUID token census pinned per chunk (RT-106)', () => {
      // Measured 2026-11-09 post-cure. ENTRY 7 tokens = 5 vendored (1
      // UNGUARDED Menu call + the web-/tizen-deviceId guarded sites) + 2
      // shim-install (`randomUUID` in the typeof guard + the defineProperty
      // key; esbuild strips the inner function name — the `at` install shows
      // the same, so `function randomUUID` does NOT count). HLS 1 token =
      // its own try/catch-guarded site with the Blob-URL fallback (safe
      // pre-shim, unchanged by it). A count move = the vendored surface
      // reshaped or a new above-floor arrival → re-adjudicate (header item 3).
      const entry = readAsset(entryChunkName());
      expect(countOccurrences(entry, 'randomUUID')).toBe(7);
      const hls = assetFiles().find((f) => f.startsWith('hls-'));
      expect(hls, 'hls chunk present').toBeTruthy();
      expect(countOccurrences(readAsset(hls!), 'randomUUID')).toBe(1);
      // The UNGUARDED vendored Menu call survives by design (client cannot
      // edit it; the shim makes it safe on 85–91). Discriminator: a bare
      // `crypto.randomUUID()` whose call closes directly into a `,` — the
      // let-declaration continuation of Menu's setup body. Guarded sites
      // read `…randomUUID=="function"?…randomUUID():fallback` (ternary,
      // `:` after) or `try{…randomUUID()}catch` (`}` after). If upstream
      // ever guards or drops the Menu call, THIS pin reddens — then retire
      // it with attribution and keep the shim for the next arrival.
      expect(countMatchesAcrossAssets(/crypto\.randomUUID\(\),/g)).toBe(1);
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
    it('src/polyfills.ts guards ALL THREE above-floor installs and is imported first by main.ts', () => {
      const src = readFileSync(join(__dirname, '..', '..', 'src', 'polyfills.ts'), 'utf8');
      expect(src).toContain("typeof globalThis.structuredClone !== 'function'");
      expect(src).toContain("typeof Array.prototype.at !== 'function'");
      // RT-106 (red-on-parent at cc8a40f8 — the randomUUID guard is the cure):
      expect(src).toContain("typeof globalThis.crypto !== 'undefined'");
      expect(src).toContain("typeof globalThis.crypto.randomUUID !== 'function'");
      expect(src).toContain("typeof globalThis.crypto.getRandomValues === 'function'");
      const main = readFileSync(join(__dirname, '..', '..', 'src', 'main.ts'), 'utf8');
      // './polyfills' must be the first import in the entry (before @phlix/ui).
      const firstImport = main.match(/import '([^']+)'/);
      expect(firstImport?.[1]).toBe('./polyfills');
    });
  });

  /* ------------------------------------------------------------------------
   * CSS SIDE (review M9) — the same ≥ 85 floor governs the shipped stylesheet,
   * where an unsupported selector/property silently DROPS THE WHOLE RULE. The
   * census below is measured 2026-11-03 from the committed single CSS file;
   * every figure is an exact re-pin target (rotation law + docs/runtime-floor.md
   * "CSS features above 85"). The pair law: the 153 `:focus-visible` sites are
   * admitted ONLY because the vendored `[data-tv] :focus` fallback rides in
   * the same file — both halves are asserted together, so a re-vendor that
   * drops the fallback reddens the suite instead of shipping blind D-pad focus.
   * ---------------------------------------------------------------------- */
  describe('CSS features above the floor (review M9)', () => {
    function cssFiles(): string[] {
      expect(existsSync(ASSETS_DIR), `committed bundle missing: ${ASSETS_DIR}`).toBe(true);
      return readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.css'));
    }

    /** The stylesheet index.html actually links (hash-agnostic, entry law). */
    function entryCssName(): string {
      const html = readFileSync(join(PKG_DIR, 'index.html'), 'utf8');
      const m = html.match(/href="\.\/assets\/(index-[^"]+\.css)"/);
      expect(m, 'index.html does not reference an ./assets/index-*.css entry').not.toBeNull();
      return m![1];
    }

    function countAcrossCss(needle: string): number {
      let total = 0;
      for (const f of cssFiles()) total += countOccurrences(readFileSync(join(ASSETS_DIR, f), 'utf8'), needle);
      return total;
    }

    it('the bundle emits exactly one stylesheet, and it is the entry-linked one', () => {
      const files = cssFiles();
      expect(files.length, 'CSS file count').toBe(1);
      expect(files[0]).toBe(entryCssName());
    });

    it('pins the above-floor CSS census at measured counts (rotation = adjudication)', () => {
      // :focus-visible Chrome 86 · inset: 87 · aspect-ratio 88 · accent-color 93.
      // Measured 2026-11-03 (batch-3 tree). Movement in ANY of these means the
      // vendored surface changed shape — re-derive the degradation table in
      // docs/runtime-floor.md in the same change, never silently.
      // 155→156: deferred m3 added the host `.stepper-btn:focus-visible` ring
      // (schedule steppers, 2026-11-03) — host surface, attributed.
      // 156→157: ui #v0.99.15 re-vendor added exactly one rule —
      // `.phlix-input.is-invalid .phlix-input__field:focus-visible` (invalid-
      // state input ring; vendored surface, attributed via a scope-hash-
      // stripped selector-set diff of the old vs new committed stylesheet).
      // 41→42: ui #v0.99.22 re-vendor (ambient-canvas fps cure) — the new
      // `.player__ambient` layers carry two negative `inset:` declarations and
      // one media-query rule was hoisted at build time: net +1 site (the
      // pre-existing red at the v0.99.22 re-vendor commit, attributed by a
      // selector-set diff of index-u1vjsYdH.css vs index-DzrZJodb.css and
      // cured here; docs/runtime-floor.md table re-measured in the same change).
      // 157→153: RT-068 (w09-L4) dropped the two host redundant double arms
      // `.audio-track-list__item:focus-visible:focus-visible` and
      // `.subtitle-track-list__item:focus-visible:focus-visible`, mirroring the
      // earlier ChapterList m14 cure. Each doubled selector carried TWO
      // `:focus-visible` tokens; collapsing to one arm removed 2 per file × 2
      // files = −4 (host surface, attributed). Other figures held (RT-069's
      // removal of the dead `@media (max-width:640px)` density fallbacks in
      // RecommendationsScreen/MusicPage deleted no above-floor token).
      // 153→152: RT-100/RT-101 (w13-L4) deleted the three overlay components —
      // their compiled focus arms left the bundle — and RT-103 added the
      // toggle-pill ring back: net −2 (two deleted host overlay arms) + 1
      // (`.toggle-pill:focus-visible`) = −1. Attributed by selector-set diff
      // of the old vs new committed host CSS chunk; docs/runtime-floor.md
      // table re-measured in the same change.
      // 42→43: ui #v0.99.25 re-vendor — the vendored `.album-card__link`
      // overlay (anchor-music-nav wave ui `c7f96bc7`, .23-era payload) adds
      // one `position:absolute;inset:0` site; a scoped-hash-stripped
      // selector-set diff of index-B3a2zLUG.css vs index-BVpuTFMB.css shows
      // the other 42 rules as hash twins with this single net addition
      // (measured red at this re-vendor, cured here; docs/runtime-floor.md
      // table re-measured in the same change).
      expect(countAcrossCss(':focus-visible')).toBe(152);
      expect(countAcrossCss('inset:')).toBe(43);
      expect(countAcrossCss('aspect-ratio')).toBe(36);
      // 8→7: RT-103 (w15-L10) replaced the native schedule checkbox (whose
      // 1.25rem `accent-color` arm was the 8th site) with the D-pad-operable
      // toggle pill — border-color driven, no accent-color. Attribution: the
      // removed `.form__checkbox` rule is the only delta in this census.
      expect(countAcrossCss('accent-color')).toBe(7);
    });

    it('carries the vendored [data-tv] plain-:focus fallback the census depends on', () => {
      const css = readFileSync(join(ASSETS_DIR, entryCssName()), 'utf8');
      // Verbatim selector pair (minified form) — the load-bearing cure for
      // :focus-visible on ≤ 85 engines (docs/runtime-floor.md, M9 section).
      expect(css).toContain('[data-tv] :focus,[data-tv] [data-focusable]:focus{');
      // And it must be a real ring rule, not a hollow selector:
      expect(css).toContain('[data-tv] :focus,[data-tv] [data-focusable]:focus{box-shadow:');
    });

    it('pins the single :has( rule as the known cosmetic dead-rule (upstream half)', () => {
      const css = readFileSync(join(ASSETS_DIR, entryCssName()), 'utf8');
      // Chrome 105 — on the floor engine the ONE segmented-control highlight
      // rule drops, unstyled-state cosmetic only. Pinned count=1: a second
      // `:has(` arrival is a new dependency on ≥ 105 parsing and needs eyes.
      expect(countOccurrences(css, ':has(')).toBe(1);
      expect(css).toContain(':has(input:checked)');
    });

    it('pins the 100dvh (Chrome 108) census with its guarded/unguarded split (RT-067)', () => {
      // docs/runtime-floor.md "CSS features above 85" carries the matching row.
      // Measured 2026-11-06 at tip 1c09f99 — 7 `100dvh` tokens, all in the
      // VENDORED @phlix/ui stylesheet (the tizen host styles use none):
      //   * 5 GUARDED — the two theater-mode heights (`.player.is-theater`
      //     height/max-height + `.player-page.is-theater .player-page__stage`
      //     height) each sit behind a `@supports not (height:100dvh){…100vh}`
      //     fallback; the token appears once in each guarded rule AND once in
      //     each of the two @supports conditions (3 + 2 = 5) → these degrade to
      //     100vh on ≤ 107, no clamp loss.
      //   * 2 UNGUARDED — `.phlix-menu__list{max-height:calc(100dvh - 16px)}`
      //     and `.usermenu__panel{max-height:calc(100dvh - var(--space-4))}`
      //     have no vh fallback: on ≤ 107 the declaration drops and long menus
      //     lose their viewport clamp (cosmetic overflow, no crash — the cure is
      //     an upstream @phlix/ui double-declare, out of this repo's pin scope).
      // A count move here means the vendored menu/theater CSS reshaped →
      // re-derive this split and the floor-doc row together (tripwire law).
      const css = readFileSync(join(ASSETS_DIR, entryCssName()), 'utf8');
      expect(countAcrossCss('100dvh')).toBe(7);
      expect(countOccurrences(css, '@supports not (height:100dvh)')).toBe(2);
      // The two unguarded clamps — named so their removal upstream is noticed.
      expect(css).toContain('max-height:calc(100dvh - 16px)');
      expect(css).toContain('max-height:calc(100dvh - var(--space-4))');
    });

    /* ------------------------------------------------------------------
     * RT-107 (review tizen__crossfe M2, lane w24-L3 2026-11-09) — the
     * largest above-floor CSS feature was entirely unpinned, and the floor
     * doc's "complete measured census" claim was falsified by its own file.
     * The #v0.99.25 re-vendor carries the ui c7f96bc7 floor-fallbacks cure;
     * this wave converts the doc's provisional "Info, unpinned" note into a
     * governance PIN: exact token census + machine-checked guard
     * completeness. RED-ON-PARENT at cc8a40f8: the floor-doc row asserts
     * (the CSS bytes themselves were already correct — the gap was purely
     * that nothing checked them).
     * ---------------------------------------------------------------- */
    it('pins the color-mix() (Chrome 111) census with machine-checked guard completeness (RT-107)', () => {
      // Measured 2026-11-09 at cc8a40f8, single stylesheet (hash-agnostic).
      // 49 `color-mix(` tokens = 14 @supports probe CONDITIONS (one per
      // guard block, never declarations) + 35 declaration sites spread
      // across the vendored auth/badge/syncplay/invite/ambient surfaces.
      const css = readFileSync(join(ASSETS_DIR, entryCssName()), 'utf8');
      expect(countAcrossCss('color-mix(')).toBe(49);
      expect(countAcrossCss(COLOR_MIX_PROBE)).toBe(14);
      // Guard completeness: every declaration site rides a plain-color twin
      // of the SAME selector inside an @supports-not guard body. Zero same-
      // rule double-declares, ZERO unguarded sites → on ≤ 110 the whole
      // population renders the guard-body fallbacks: tint/gradient loss
      // (cosmetic), no rule loss — color-mix is a VALUE, its drop
      // granularity is the single declaration. An unguarded arrival upstream
      // reddens this pin, it does not silently degrade the field.
      const census = classifyColorMixSites(css);
      expect(census.declarationSites).toBe(35);
      expect(census.blockGuarded).toBe(35);
      expect(census.doubleDeclared).toBe(0);
      expect(census.unguarded.join(' , ')).toBe('');
      // Floor-doc completeness (the claim RT-107 exists to restore): the
      // census table must carry the color-mix row matching these numbers.
      const doc = readFileSync(join(PKG_DIR, '..', 'docs', 'runtime-floor.md'), 'utf8');
      expect(doc).toContain('| `color-mix()` | Chrome **111** | 49 (14 probes + 35 sites) |');
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
