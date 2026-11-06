# Runtime engine floor — the canonical contract

**The repo's supported runtime contract is Chromium ≥ 85.**

This is the single canonical statement of the Tizen widget's engine floor
(M-TIZEN-03 / review `tizen__crossfe.md` M1). Everything below was **measured
from the committed bundle** (`package/assets/*.js`, 35 JS chunks + `index.html`)
at master `1d37585` on 2026-10-29 — not from marketing tables or remembered
spec history — and is re-asserted on every CI run by the tripwire test
[`tests/unit/distApiFloor.test.ts`](../tests/unit/distApiFloor.test.ts).

## Why the three old artifacts did not triangulate

| Artifact | It says | What it actually controls |
|---|---|---|
| `vite.config.ts` `build.target: 'chrome100'` | "build target chrome100" (README) | esbuild **syntax ceiling** only: lowers nothing Chrome 100 already has. It never polyfills nor forbids **runtime APIs**, and it passes ≥85 syntax through unlowered. |
| `app/config.xml` `required_version="6.5"` | Tizen platform floor for install | A **Tizen platform version**, not a Chromium version. This repo has never established (and does not fabricate) a Tizen↔Chromium mapping table for 6.5-era webviews. |
| `src/polyfills.ts` header | field includes "older Samsung Tizen webviews (pre-Chrome 98)" | Honest field intel — the population the ≥ 85 contract is sized for. |

The enforceable contract is therefore code-level: **what the shipped bundle
actually calls**, pinned by census below. Chromium ≥ 85 sits below every webview
the repo has ever admitted to fielding support for, and above the 2020-era
engines the dist provably does not use.

## Measured census (master 1d37585, 2026-10-29)

### Parse level (syntax)

| Marker | Engine | Count in dist | Status |
|---|---|---|---|
| `\|\|=` / `&&=` / `??=` (logical assignment) | Chrome **85** | 530 / 37 / 1 | **Sets the real parse floor.** Present by design; esbuild's chrome100 ceiling does not lower them. |
| class static blocks `static {}` | Chrome 94 | 0 | Absent — pinned |
| BigInt literals `10n` | Chrome 104-era | 0 | Absent — pinned |
| private brand check `#x in y` | Chrome 84 | 0 | Absent — pinned |
| `?.` / binary `??` | Chrome 80 | 804 / 548 (own grep `?\.` and `??` not followed by `=`) | Below floor — no pin needed |

### Runtime APIs above 85

| API | Engine | Sites | Treatment |
|---|---|---|---|
| `Array.prototype.at` | Chrome 92 | **3 live calls** — all `.at(-1)` in the vendored ui `PosterPicker` chunk | **Polyfilled** in `src/polyfills.ts` (guard + `defineProperty`, non-enumerable). The call sites are vendored minified JS; the client-side polyfill point is the only place they can be cured — same precedent that installed the first one caught this class by hand. |
| `structuredClone` | Chrome 98 | 2 tokens — **both are the install guard itself** in the entry chunk; zero raw call sites | Polyfilled in `src/polyfills.ts`. |
| `toSorted` / `toReversed` / `toSpliced` | Chrome 110 | 2 tokens each, all in the entry chunk: one Vue 3.5 reactive-array patcher **def** + its internal native call on the `Fa(this)` (toRaw-clone) receiver | **Inert** — zero external callers (`\.NAME\(` outside the def body = 0). Pinned def-shape + per-file location by the tripwire; a future live caller reddens the census. |
| `findLast` / `findLastIndex` | Chrome 97 | 4 / 2 tokens — Vue patcher defs (string-delegating, no dotted native call form) | **Inert** — pinned identically. |
| `Error(msg,{cause})` options bag | Chrome 93 | **1 live site** — inside the hls.js chunk (error-formatting helper) | **Graceful-degradation exception**: below 93 the constructor ignores the options argument — the `Error` still constructs; only the cause chain is lost. Non-crashing, non-control-flow. Pinned count=1; an increase means a new cause site arrived → re-adjudicate. |
| `Object.hasOwn` | Chrome 93 | 0 | Absent — pinned absent |

The `toSorted`-class Vue defs delegate to the **native** method on a raw clone,
so if any code ever calls them on a reactive array below 110 the call throws
`TypeError`. The tripwire counts and shape-pins them precisely so a re-vendor
that turns one live cannot pass green.

### CSS features above 85 (review M9)

The same floor applies to the shipped stylesheet — an unsupported selector or
property in modern CSS drops **the whole rule**, silently. Census measured
2026-11-03 (batch-3 rebuild, review-lane `e2995a7` successor) over the single
committed stylesheet `package/assets/index-*.css` (hash-agnostic read — the
whole bundle emits exactly one CSS file), all figures re-derived from disk;
re-measured 2026-11-06 after the `@phlix/ui` #v0.99.22 re-vendor — the ambient
canvas cure (`.player__ambient`) emits one more `inset:` site (41→42, the two
negative-inset declarations of the new keyframed layers minus one media-query
rule hoisted at build time); every other figure held:

| Feature | Engine | Occurrences | Degradation on a Chrome-85 webview |
|---|---|---|---|
| `:focus-visible` | Chrome **86** | 157 | Its rules drop — focus rings would vanish **except** for the vendored TV fallback below, which uses plain `:focus`. |
| `inset:` | Chrome **87** | 42 | Positioned elements fall back to their `top/left` (or static) geometry — layouts shift, nothing throws. |
| `aspect-ratio` | Chrome **88** | 36 | Boxes size from content/height instead of the ratio — cards may stretch. |
| `accent-color` | Chrome **93** | 8 | Form controls keep UA default colors — cosmetic only. |
| `:has()` | Chrome **105** | 1 | The one rule (`.register-form__segment:has(input:checked)`, a segmented-control highlight) drops — the state stays unstyled. Upstream cosmetic half (ui repo), pinned here so its arrival/movement is visible. |

The load-bearing cure is the vendored 10-foot fallback carried in the same
stylesheet:

```css
[data-tv] :focus,[data-tv] [data-focusable]:focus{box-shadow:…;outline:none}
```

`data-tv` is set by @phlix/ui on `document.documentElement` (the same class of
surface `src/styles/tv-typography.css` documents), so on ≤ 85 engines the D-pad
focus ring still renders — through plain `:focus`, universally supported. The
tripwire test **hard-asserts** that selector pair verbatim: if a re-vendor ever
drops it, the 157 `:focus-visible` census sites become unsupported-with-no-
fallback and the suite reddens on the same law that admits them today.

## Governance law (tripwire rotation rules)

1. `tests/unit/distApiFloor.test.ts` scans the **committed** `package/` — the
   same byte-tree the `Assert committed package/ is fresh` CI gate rebuilds and
   diffs. API-level enforcement now rides beside byte-level enforcement.
2. A red count/shape pin means: the bundle's above-floor surface **changed**.
   A human adjudicates each case — polyfill it in `src/polyfills.ts` (and extend
   this table), keep it inert-pinned (if the def/call-shape analysis holds), or
   raise the ≥ 85 floor **with evidence**. Silent number rotation is forbidden;
   every moved pin carries attribution in the test file and this table.
3. The polyfill module stays the single sanctioned install point and stays
   first in `src/main.ts` (before any `@phlix/ui` evaluation) — both asserted by
   the test.
4. String/TypedArray `.at` are **not** covered by the Array polyfill; the
   `\.at\(` census pin protects against a silent String receiver sneaking in as
   "already covered".
5. The CSS census (above) rotates under the same law: every count pin is an
   exact measured figure, and the `[data-tv] :focus` fallback assertion is the
   load-bearing half — a change to either means the ≥ 85 population's focus
   story or layout changed and a human re-adjudicates, with attribution in
   both this table and the test.
6. Host ring scale (deferred m9, 2026-11-03): every HOST-owned focus ring
   rides TV scale on the 1920 canvas — translucent box-shadow rings are
   `0 0 0 5px var(--accent-ring, …)` (30 sites) and solid outline rings are
   `outline: 4px solid …` (3 sites). Desktop-scale 3px was 0.16% of frame
   width at couch distance. Width only — the COLOR stays the estate token
   `--accent-ring` (ui theme), so this is a tizen-surface scale decision, not
   a palette one. Final weight awaits a real-TV eyeball (device-test-pending);
   5/4px sits inside the 4-6px TV convention band.
