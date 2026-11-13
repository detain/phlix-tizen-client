# Runtime engine floor — the canonical contract

**The repo's supported runtime contract is Chromium ≥ 85.**

This is the single canonical statement of the Tizen widget's engine floor
(M-TIZEN-03 / review `tizen__crossfe.md` M1). Everything below was **measured
from the committed bundle** (`package/assets/*.js`, 97 JS chunks + `index.html`
— re-counted 2026-11-11 at the vite 8 wave: rolldown emits finer-grained
chunks than the esbuild-era 35 measured at `1d37585`; no surface change — every
pinned per-token census below held or moved only in the attributed way its row
records)
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
| `crypto.randomUUID` | Chrome 92 | **8 tokens** in dist (re-measured 2026-11-11 at the vite 8 wave; esbuild era was entry 7 + hls 1): entry 6 = 4 web-/tizen-deviceId guarded ternaries + 2 shim-install tokens; `Menu-` lazy chunk 1 = **1 UNGUARDED live call** (vendored ui `Menu.vue` setup — `const baseId = crypto.randomUUID()`, still unguarded upstream at #v0.99.26); hls chunk 1 = try/catch-guarded with a Blob-URL fallback | **Polyfilled** in `src/polyfills.ts` — RT-106. On the admitted 85–91 population the unguarded Menu TypeError unmounts every Menu subtree (player quality/captions/speed, UserMenu, MediaCard context menus, Libraries), so the `.at` precedent applies: vendored call sites cannot be edited client-side, the shim (RFC 4122 v4 over `crypto.getRandomValues`, which Chrome has had since v1) installs at the sanctioned point. Census pinned per chunk (2026-11-11 wave: entry 6 = 4 vendored + 2 install tokens; Menu 1; hls 1; the esbuild-era split was entry 7 with the Menu call entry-resident) plus the exact unguarded-Menu discriminator `/crypto\.randomUUID\(\),/` count=1 — if upstream ever guards that call, the pin reddens for retirement. |
| `structuredClone` | Chrome 98 | 2 tokens — **both are the install guard itself** in the entry chunk; zero raw call sites | Polyfilled in `src/polyfills.ts`. |
| `toSorted` / `toReversed` / `toSpliced` | Chrome 110 | 2 tokens each, all in ONE shared lazy chunk (the `Icon-*` chunk since the 2026-11-11 vite 8 wave; entry-resident in the esbuild era): one Vue 3.5 reactive-array patcher **def** + its internal native call on the `Fa(this)` (toRaw-clone) receiver | **Inert** — zero external callers (`\.NAME\(` outside the def body = 0). Pinned def-shape + one-chunk location law by the tripwire (host resolved by content, hash-agnostic); a future live caller reddens the census. |
| `findLast` / `findLastIndex` | Chrome 97 | 4 / 2 tokens — Vue patcher defs (string-delegating, no dotted native call form) | **Inert** — pinned identically. |
| `Error(msg,{cause})` options bag | Chrome 93 | **2 live sites** — the hls.js chunk (error-formatting helper) and the SyncPlay REST timeout error (`useSyncPlayStore`, added with ESLint 10 `preserve-caught-error`) | **Graceful-degradation exception**: below 93 the constructor ignores the options argument — the `Error` still constructs; only the cause chain is lost. Non-crashing, non-control-flow. Pinned count=2 (hls chunk = 1); an increase means a new cause site arrived → re-adjudicate. |
| `Object.hasOwn` | Chrome 93 | **3 live calls** — inside pinia 4's shipped dist (2 in the reactive-object state merge, 1 in the store-symbol membership check; re-measured 2026-11-11 at the vite 8 wave: all 3 calls in the `pinia-` lazy chunk, the entry carries only the call-free install-guard token; the esbuild-era RT-087 rebuild had all 4 tokens entry-resident). Was **0 — absent by accident** (pinia 3 used `Object.prototype.hasOwnProperty.call`) until the RT-087 manual bump `pinia ^3.0.0 → ^4.1.0` (owner ruling (a), 2026-11-10) turned it live. | **Polyfilled** in `src/polyfills.ts` — RT-087. Call sites are dependency-minified JS (same constraint as `.at`/`randomUUID`), so the shim installs at the sanctioned point: `Object.defineProperty(Object, 'hasOwn', …)` delegating to `hasOwnProperty.call` — ES1 building block, spec-equivalent own-property answer, identical TypeError domain (`null`/`undefined` target). Census + install shape pinned by the two RT-087 tests in the tripwire. |

The `toSorted`-class Vue defs delegate to the **native** method on a raw clone,
so if any code ever calls them on a reactive array below 110 the call throws
`TypeError`. The tripwire counts and shape-pins them precisely so a re-vendor
that turns one live cannot pass green.

### CSS features above 85 (review M9)

The same floor applies to the shipped stylesheet — an unsupported selector or
property in modern CSS drops **the whole rule**, silently. Census measured
2026-11-03 (batch-3 rebuild, review-lane `e2995a7` successor) over the single
committed stylesheet `package/assets/index-*.css` (hash-agnostic read — the
whole bundle emitted exactly one CSS file until the TIZ-S21 lazy-route split; it now emits one entry `index-*.css` plus per-lazy-page sidecar `.css` files, and the census sums across all of them), all figures re-derived from disk;
re-measured 2026-11-06 after the `@phlix/ui` #v0.99.22 re-vendor — the ambient
canvas cure (`.player__ambient`) emits one more `inset:` site (41→42, the two
negative-inset declarations of the new keyframed layers minus one media-query
rule hoisted at build time); re-measured again 2026-11-06 at tip 1c09f99 —
dropping the two host `:focus-visible:focus-visible` redundant double arms
(AudioTrackList / SubtitleTrackList, mirroring the ChapterList m14 cure)
removed 4 `:focus-visible` tokens (157→153; then 153→152 at RT-100/RT-101/RT-103, then 152→154 at the TIZ-S8 stale-package rebuild, then 154→155 at the ui v0.99.28 re-pin (+1 `.device-sessions-page__card-title:focus:not(:focus-visible)`) — the current table figure); the deletion of the dead
`@media (max-width:640px)` density fallbacks, reviewed in the same round,
removed no above-floor token, so every other figure held; the `100dvh` row
is added this wave; re-measured again 2026-11-09 at the `@phlix/ui`
#v0.99.25 re-vendor — the vendored `.album-card__link` overlay (anchor-music-
nav cure ui `c7f96bc7`) adds one `inset:` site (42→43, attributed by a
scoped-hash-stripped selector-set diff; every other pinned figure held), and
the `color-mix()` census that the same re-vendor jumped 1→49 is PINNED here
for the first time (RT-107, adjudicated 2026-11-09) — see its row and note
below the table:

| Feature | Engine | Occurrences | Degradation on a Chrome-85 webview |
|---|---|---|---|
| `:focus-visible` | Chrome **86** | 155 | Its rules drop — focus rings would vanish **except** for the vendored TV fallback below, which uses plain `:focus`. (157→153 by collapsing two host `:focus-visible:focus-visible` double arms.) |
| `inset:` | Chrome **87** | 43 | Positioned elements fall back to their `top/left` (or static) geometry — layouts shift, nothing throws. |
| `aspect-ratio` | Chrome **88** | 36 | Boxes size from content/height instead of the ratio — cards may stretch. |
| `accent-color` | Chrome **93** | 7 | Form controls keep UA default colors — cosmetic only. |
| `:has()` | Chrome **105** | 1 | The one rule (`.register-form__segment:has(input:checked)`, a segmented-control highlight) drops — the state stays unstyled. Upstream cosmetic half (ui repo), pinned here so its arrival/movement is visible. |
| `100dvh` | Chrome **108** | 7 | All vendored `@phlix/ui`. 5 GUARDED: the two theater-mode heights ride `@supports not (height:100dvh){…100vh}` fallbacks (token appears in each guarded rule + each `@supports` condition = 3+2) → they degrade to `100vh` on ≤ 107, no clamp loss. 2 UNGUARDED: `.phlix-menu__list` / `.usermenu__panel` `max-height:calc(100dvh …)` have no vh fallback → on ≤ 107 the clamp drops and long menus overflow (cosmetic, no crash). Cure is an upstream `@phlix/ui` double-declare (out of this repo's pin scope); pinned count=7 so any reshaping vendored menu/theater CSS shows up here. |
| `color-mix()` | Chrome **111** | 49 (14 probes + 35 sites) | Adjudicated RT-107 (was the Info "unpinned" note under this table). Machine-checked classification: all 35 declaration sites ride a plain-color twin of the SAME selector inside an `@supports not (color:color-mix(in srgb,red,blue))` guard body — zero same-rule double-declares, ZERO unguarded sites. On ≤ 110 the whole population renders the guard-body colors: tint/gradient loss (cosmetic), no rule loss — color-mix is a VALUE, its drop granularity is the single declaration. Pinned by the census + guard-completeness asserts in the tripwire; an unguarded arrival upstream reddens the suite instead of silently degrading the field. |

**`color-mix()` note (RT-107, adjudicated 2026-11-09 — history kept verbatim).**
The stylesheet's `color-mix()` sites jumped 1→49 with the ui .23-era
"color-mix CSS floor fallbacks" cure (ui `c7f96bc7`, riding #v0.99.25). The
provisional same-rule scan from the re-vendor wave found "38 sites without a
preceding fallback declaration" and left the census unpinned — RT-107
(review `tizen__crossfe.md` M2) convicted exactly that gap: the floor doc
claimed completeness while the newest, highest-engine feature carried no pin.
Adjudication (measured 2026-11-09 at cc8a40f8, single stylesheet, hash-
agnostic): the 49 `color-mix(` tokens split into 14 `@supports` PROBE
conditions and 35 declaration sites, and a machine walk of every guard body
shows all 35 sites have same-selector plain-color twins — the provisional
"38 without a preceding fallback" figure counted only the same-RULE
double-declaration form and missed the @supports-block form; it is superseded
by the classification above. The census is now pinned (counts + guard
completeness) in `tests/unit/distApiFloor.test.ts` under the same rotation
law as every other figure.

The load-bearing cure is the vendored 10-foot fallback carried in the same
stylesheet:

```css
[data-tv] :focus,[data-tv] [data-focusable]:focus{box-shadow:…;outline:none}
```

`data-tv` is set by @phlix/ui on `document.documentElement` (the same class of
surface `src/styles/tv-typography.css` documents), so on ≤ 85 engines the D-pad
focus ring still renders — through plain `:focus`, universally supported. The
tripwire test **hard-asserts** that selector pair verbatim: if a re-vendor ever
drops it, the 155 `:focus-visible` census sites become unsupported-with-no-
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
