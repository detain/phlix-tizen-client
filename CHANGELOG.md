# Changelog

All notable changes to **phlix-tizen-client** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed — hub relay bearer transport is TLS-mandatory; plaintext downgrade refused (M-TIZEN-06 / review tizen__exploiter MAJOR-6) — 2026-10-29

- **The silent downgrade closes.** `buildHubRelayUrl` mapped any non-`https:`
  hub base to bare `ws://` — and the relay dial presents the minted relay
  token in the `Sec-WebSocket-Protocol: bearer, <token>` handshake, so a
  plain-http hub config (the LAN-default the boot fallback happily resolves)
  broadcast that credential to anyone on the TV's network, which then rides
  the unauthenticated socket as a `pending_command` injector. C27 `d2a5202`
  was the spatial-nav focus cure (disk-reproved at this tip) — the relay path
  was NOT already closed; the review's cited line downgraded on the parent.
- **The law:** `https:` base → `wss:` (unchanged shape); a plaintext base
  now throws a NAMED `HubRelayInsecureTransportError` whose message is
  actionable (names the refused origin, demands https, names the only escape
  hatch). `connectHubRelaySocket` builds the URL FIRST — before the token
  provider is consulted — so a refusal ends the attempt before ANY
  credential (the hub JWT mint included) touches the wire; the refusal is
  terminal (console.error + status `'closed'`, no ladder, no S510 wait — the
  config must change, transient retry cannot fix it). The malformed-URL →
  laddered path is byte-preserved (TypeError ≠ policy error).
- **The hatch** (repo default-off flag convention, `VITE_PHLIX_TV_ADMIN`
  idiom): `VITE_PHLIX_DEV_ALLOW_INSECURE_RELAY=1` at BUILD time unlocks the
  `ws://` dial for local testing against a plain-http dev hub, warns on the
  console with EVERY dial (per-attempt, not one-shot), is declared in
  `vite-env.d.ts`, and README documents it as insecure-dev-only. Any other
  value keeps the gate shut.
- **Scope truth:** `src/syncplayDispatch.ts:66-92` (second cited evidence
  site) is a store watcher — it assembles NO URL (grep-proven); the only
  relay builder was `buildHubRelayUrl`, and it is now the single gate. The
  direct-mode `buildWsUrl` in `src/stores/useSyncPlayStore.ts` (server
  `:8097`) is the SERVER lane's policy question, not this hub-relay item —
  reported, untouched. phlix-mobile-client carries the identical downgrade
  in its own `src/syncplay/hubRelay.ts:159` (grep-proven this lane, read-
  only) — its own queue item, no cure precedent existed to mirror.
- Tests: `tests/unit/hubRelay.test.ts` 44 → 54 (+10 exact): builder refusal
  (named error, message bytes, `ws://` base also refused, TypeError leg
  stays laddered), hatch-shape unlocks ONLY via explicit allowance, the env
  default IS the hatch read (stub→unlock→unstub→re-refuse), non-`'1'`
  values shut; connect-path refusal-before-mint (tokenProvider never called,
  zero sockets across 600 s of clock, zero visibility listeners), hatch
  disclosure per-dial, https dials `wss:` quietly. The lifecycle fixtures
  flipped `http:` → `https:` (the old shape ENCODED the bug — precedent:
  ui `c81480b9` bug-encoding flips). Red-on-parent: the 7 gate-legs fail on
  `84bc875`'s `hubRelay.ts` (measured); mutation matrix: builder-gate strip
  reddens exactly 5, connect-terminal strip exactly 1, disclosure strip
  exactly 2 — all restored.
- Suite: 52 files/823 tests → 52/833 (+10 exact, serial self-baseline
  re-measured on the parent tip this lane); vue-tsc 0, eslint 0, coverage-
  floor gate green (84.39/74.15/81.18/85.82 vs 72/61/68/73); build +
  `npm run package` green, committed `package/` carries the cure bytes
  (`index-BT2qjJ3x.js` contains `wss:// is mandatory`), package tree
  deterministic ×2 (aggregate md5 `221e6c75afe7e105a1eacd3e3bb6e770`).

### Fixed — telemetry CLIENT_VERSION joins the stamped carriers; package chain re-ordered sync-first (M-TIZEN-05 r2 / review tizen__devops MAJOR-1) — 2026-10-29

- **The r2 review caught the third silent carrier.** r1 automated the two
  manifest files but left `src/telemetry.ts` `CLIENT_VERSION = '1.0.0'` a
  hand-maintained mirror — neither stamped nor pinned — while the heartbeat
  POSTs it to the server as `version` AND `build`. Dynamic proof at r1's tip:
  bump package.json → 1.0.1, run version-sync, and all 5 versionStamping
  tests stayed GREEN while the telemetry constant still read 1.0.0 — every
  TV's server-side version report would have gone stale forever.
- **`scripts/version-sync.mjs` now stamps TWO carriers**: the `<widget
  version>` manifest (unchanged) and the `CLIENT_VERSION` literal in
  `src/telemetry.ts`, each with its own trailing/`<!-- -->` `generated:`
  marker (the telemetry marker rides ON the stamped line, single-sourced as
  an export the test imports — same idiom as r1's `GENERATED_MARKER`).
  Fail-loud: a renamed constant exits 1 (`found 0`) and a duplicated
  declaration exits 1 (`found 2`), both probed. Idempotent: the in-sync tree
  logs "already stamped at 1.0.0 (in sync, nothing written)" and writes
  nothing (probe-proven after the source edits landed).
- **Chain order is now `version-sync → build → package.js`** — telemetry.ts
  is a BUILD INPUT, so the r1 order (`build → sync → package`) would have
  bundled a stale constant on every bump even with the stamp. Counterfactual
  probe at package.json 1.0.1: old order → shipped bundle still said
  `"1.0.0"`; new order → bundle says `"1.0.1"`.
- **`tests/unit/versionStamping.test.ts` 5 → 7 tests**: telemetry equality vs
  the SSOT (reads the literal from the FILE TEXT by regex — the r1 critique
  that a pin importing the symbol as its own expectation is self-reference is
  cured exactly as the review prescribed), telemetry marker arm, and the
  wiring arm strengthened to pin sync-before-build-before-assemble.
  Mutation matrix: bump-without-sync reddened exactly the 3 equality arms;
  completing the workflow (sync + re-copy mirror) re-greened 7/7; hand-
  editing the constant reddened 1; stripping the marker reddened 1;
  re-ordering the chain back reddened 1.
- Suite: 52 files/821 tests → 52/823 (+2 exact; parent 32ab266^ re-measured
  in a scratch worktree at 51/816); vue-tsc 0, eslint 0, coverage-floor gate
  green (84.44/74.02/81.29/85.88 vs 72/61/68/73); full `npm run package` on
  the new chain green with the committed `package/` tree byte-identical to
  the build output (zero `git status` diff — the minifier strips the added
  comments and no value bytes move).
- Docs: DEVELOPER.md "Versioning" now enumerates every carrier and the
  sync-first chain (the "one place" claim is true after this commit, not
  just scoped); the bump procedure gained the missing `npm install
  --package-lock-only` step for the tracked lockfile (review MINOR-2 — CI's
  `npm ci` self-defends loudly, but the procedure now says so); and
  `src/telemetry.ts`'s "Pinned by test" docblock sentence is literally true.

### Fixed — Widget version stamping single-sourced to package.json with build-time sync + drift pin (M-TIZEN-05 / review tizen__devops MAJ-2) — 2026-10-29

- **The drift trap closes.** `app/config.xml` and `package.json` both said
  `1.0.0` and had said so since the initial restructure with zero automation
  touching either — a bump could silently ship a widget the TV/store still
  read as `1.0.0` forever. Honest value note: the repo has never shipped a
  version bump (its only tag is the CI-rolling `latest` prerelease pointer),
  so `1.0.0` stays as current truth; this cure makes the FIRST real bump a
  one-line change instead of inventing a release.
- **NEW `scripts/version-sync.mjs`** — `package.json` "version" (semver-
  validated, fail-loud) is the single source; the script stamps it into
  `app/config.xml`'s `<widget version>` and maintains a `generated:
  run scripts/version-sync` marker comment. Idempotent: an in-sync tree
  writes nothing (probe: second run logged "in sync", zero diff). Wired into
  `npm run package` (`build → version-sync → scripts/package.js`), so the CI
  build leg and the committed `package/config.xml` freshness mirror always
  carry the stamped bytes; `npm run version:sync` standalone for manual use.
  Estate siblings stamp the same idea their own way, cited both-sides: the
  Roku client (`scripts/derive-version.sh` + Makefile build-time manifest
  injection, gated by `verify-runtime.sh` Check 18) and the Windows client
  (`build.yml` version-check job, tag == package.json).
- **NEW tripwire `tests/unit/versionStamping.test.ts` (5 tests)** — equality
  pin (both manifests vs SSOT), marker pin, mirror pin, and package-chain
  wiring pin (sync runs before `scripts/package.js`). Teeth are future-drift
  by disclosed design (the two files are EQUAL today): mutation-proven —
  bump-without-sync reddened exactly the equality + mirror arms; completing
  the workflow (sync + re-package copy) re-greened all 5; stripping the
  marker, hand-editing the mirror, and dropping sync from the chain each
  reddened exactly their named arm; non-semver SSOT and a version-less
  `<widget>` each made the script exit 1.
- Suite: 51 files/816 tests → 52/821 (+5 exact); vue-tsc, eslint and the full
  `npm run package` leg (build with vue-tsc → sync → assemble → mirror) all
  green at HEAD. Docs: DEVELOPER.md gains a "Versioning" section (bump
  procedure in one place), README manifest/package comments point at the SSOT.

### Fixed — Runtime-compat floor made canonical + enforced; committed-bundle `.at` crash cured; diagnostics-half provenance truth-pass (M-TIZEN-03 / review tizen__crossfe M1) — 2026-10-29

- **The queued M-TIZEN-03 finding lands.** r1 review (M-TIZEN-03__r1.md) ruled
  the *briefed* error-visibility half excellent but established the queue
  authority: M-TIZEN-03 = "Runtime-compat floor is undocumented and
  self-contradictory; committed dist calls APIs above the repo's own stated
  floor" (tizen__crossfe M1). Every named defect was live at HEAD: the shipped
  `package/` bundle carried **3 raw `Array.prototype.at(-1)` call sites** (the
  vendored ui `PosterPicker` chunk; Chrome 92 — above the repo's real floor)
  with NO polyfill installed, and the three "floor" artifacts (vite
  `target: 'chrome100'`, `config.xml required_version="6.5"`, polyfills.ts
  header prose) never triangulated into one contract.
- **NEW `docs/runtime-floor.md` — the SINGLE canonical statement: Chromium
  ≥ 85**, measured from the committed bundle at 1d37585 (parse census:
  logical-assignment `||=`/`&&=`/`??=` present at 530/37/1 — *that* sets the
  parse floor; static blocks/BigInt/private-brand = 0, pinned absent), with a
  per-API adjudication table: `Array.prototype.at` (3 live sites) **polyfilled**;
  `structuredClone` (2 tokens = guard only) **polyfilled**; `toSorted`/
  `toReversed`/`toSpliced` + `findLast`/`findLastIndex` (Vue 3.5 reactive-array
  patcher defs) **inert-pinned** with zero external callers; `Error(msg,
  {cause})` (1 live site, hls.js formatter) kept as a count-pinned
  **graceful-degradation exception** (pre-93 engines ignore the options bag —
  the Error still constructs); `Object.hasOwn` pinned absent. The honest
  refusal: no Tizen 6.5↔Chromium mapping table is fabricated — none exists.
- **NEW tripwire `tests/unit/distApiFloor.test.ts` (11 tests)** scans the
  committed `package/` byte-tree — the same tree the 'Assert committed
  package/ is fresh' CI gate rebuilds — pinning floor agreement between all
  four artifacts, syntax-absence of above-floor *syntax*, and
  polyfilled-or-inert for every above-floor *runtime API* (live `.at(` caller
  count 3 → 0 at bundle level via the polyfill; def-shape + per-file location
  pins; rotation law: silent number rotation forbidden, every moved pin
  carries attribution). `src/polyfills.ts` gains the spec-faithful guarded
  `Array.prototype.at` install (`defineProperty`, non-enumerable — negative
  indices from the end, out-of-range undefined; the local `declare global`
  keeps tsconfig lib ES2020), and documents the sanctioned-polyfill-point
  doctrine; `tests/unit/polyfills.test.ts` +4 install/behavior pins;
  README/vite.config gain the floor pointer (chrome100 = syntax CEILING, not
  an engine floor). `src/main.ts` untouched — the polyfill import was already
  first.
- **Provenance truth-pass (r1 Issue 2, forward-fix — history never rewritten):**
  the error-visibility half (01500bd/355f6f6) shipped citing "review
  tizen__devops M3" — that finding ID does not exist in `tizen__devops.md`
  (numbered MAJ-1/MAJ-2/MIN-*/INF-*; grep-proven). All docblocks, the
  `main.test.ts` suite name, the AGENTS.md architecture line and the heading
  below are re-badged to the true banner: "error-visibility brief" (crosswire;
  closest real on-disk analogue M-ROKU-11 / roku__devops). The two commit
  *subjects* carry the stale tag immutably by the no-rewrite law; this entry is
  the permanent record's correction.
- **Tests measured at this state:** baseline (this session start) 49 files /
  769 tests → 01500bd+355f6f6: 50 / 801 → **r2: 51 files / 816 tests, serial
  `--no-file-parallelism` 0 failures 0 skips** (+15 = 11 distApiFloor + 4
  polyfills additions), vue-tsc 0 errors, eslint 0. **`package/` REBUILT from
  this exact source**: entry + 29 chunk renames + index.html; deterministic
  (two consecutive `npm run package` builds byte-identical, aggregate md5
  `42e25fe16d40c8e07191f63517d70feb`); the PosterPicker chunk now ships beside
  the installed polyfill and the diagnostics ring code.

### Fixed — Uncaught-error visibility: on-device runtime-failure ring, zero phantom telemetry (M-TIZEN-03 / error-visibility brief — re-badged by r1 truth-pass; original "review tizen__devops M3" tag was fabricated provenance) — 2026-10-29

- **NEW `src/runtimeDiagnostics.ts` — the estate never had crash telemetry and
  still does not: this is visibility, not reporting.** Before this change every
  uncaught-error path in the widget died silently behind the TV: a throwing
  watcher or a rejected promise ended in an invisible `console.error` (the
  vendored `@phlix/ui` v0.99.10 registers no `app.config.errorHandler` and no
  window listeners — grep-proven; `src/telemetry.ts` is the separate S521
  opt-IN heartbeat, not an error path). `boot()` now installs
  `installRuntimeFailureCapture` at its very head (window `'error'` +
  `'unhandledrejection'`, handlers try/caught so diagnostics can never become
  the failure) and bridges Vue's production error channel through
  `application.config.errorHandler` (kind `vue`; overrides nothing — the vendored
  ui ships none). Failures are summarized `{kind, message, at}` — no stacks (PII
  posture) — into a BOUNDED ring: `MAX_RECORDED_FAILURES = 20` oldest-evicted,
  `FAILURE_MESSAGE_LIMIT = 300` per entry, consecutive-identical burst
  suppression inside `DUPLICATE_SUPPRESSION_MS = 1000`, persisted to
  `localStorage['phlix.runtimeFailures']` through the same bounded-localStorage
  idiom as the S529 address history. A healthy run writes NOTHING (pin-tested).
- **Persistence is localStorage because the manifest mask makes log FILES
  impossible**: `app/config.xml` grants only `internet` + `tv.inputdevice`
  (S503; TN-2 law — privileges fold in only with their feature), so
  `tizen.filesystem`/`application.log` cannot be reached without privilege
  creep. The cure therefore adds ZERO privileges, ZERO dependencies and ZERO
  request sites: `routeManifest.gate` scan stays 27, the manifest fixture is
  byte-identical, and source greps in the new suite pin the absence of
  `fetch(`/`XMLHttpRequest`/`sendBeacon`/`WebSocket`/`navigator.` and `tizen.`.
- **Surfacing rides the error-state UI that already exists**:
  `renderBootFailure` (the T-09 terminal screen) now records the fatal as
  `boot-fatal` and quotes up to `BOOT_FAILURE_TAIL_COUNT = 3` PRIOR captured
  failures beneath a new `boot.recentFailures` label (raw `[kind] HH:MM:SS
  message` lines stay untranslated data under the translated label — the
  catalog's own ja.ts precedent), rendered with `white-space: pre-line`. A TV
  that hard-dies leaves its cause of death readable after relaunch.
- **Old-webview API floor honored** (vite `target: 'chrome100'` lowers syntax
  only; `polyfills.ts` documents pre-Chrome-98 field webviews): the module uses
  only `addEventListener`/JSON/index-`slice`/`Number.isFinite`/
  `Date#toISOString` and reads event fields via `typeof` guards — never the
  `ErrorEvent`/`PromiseRejectionEvent` constructors, never `.at(`/
  `Object.hasOwn`/`structuredClone` (a grep describe pins the floor against the
  shipped source).
- **i18n**: `boot.recentFailures` added across all seven catalogs — tizen-own
  catalog 198 → 199 keys (the four census pins in `i18nLocales.test.ts` and the
  three in `docs/i18n.md` rotated to 199 from measurement; `tizenI18n.test.ts`
  byte-pin extended).
- **Tests measured from this repo state**: baseline 49 files / 769 tests →
  50 files / 801 tests (+28 `runtimeDiagnostics.test.ts`, +4
  `main.test.ts` M3 chain block: healthy-boot-stays-quiet, window-error → ring
  → boot-failure surface end-to-end, unhandledrejection leg, honest-quiet
  single-line fatal), serial `--no-file-parallelism` 0 failures (the lone
  `skipped` in the isolated-run tail is the vendored-bundle parity gate's
  documented sibling-absent skip — it executes in the pristine main tree and
  SKIPS in CI per its own header). `vue-tsc --noEmit` 0 errors; `eslint .` 0.
- **`package/` companion REBUILT from the committed state only** (an isolated
  detached worktree at 1d37585 + this lane's files, so concurrent in-flight
  work elsewhere in the tree could not be baked in): 30 asset renames +
  `index.html`, aggregate md5 `3dcde87474bf834401fd665b4703ee35` identical
  across two consecutive `npm run package` builds — satisfying the repo CI's
  'Assert committed package/ is fresh' gate.

### Fixed — Signing/install docs cured from fabrications; mirror verified 2026 tooling (M-TIZEN-02 / review tizen__casualgamer) — 2026-10-29

- **`docs/signing.md` rewritten against live-verified sources.** The previous
  edition's CI examples downloaded the SDK from
  `https://storage.googleapis.com/tizen-sdk/latest/tizen-sdk.bin` — a bucket
  that never existed (curl-verified 404). Real distribution is Samsung's
  `https://download.tizen.org/sdk/Installer/tizen-studio_6.1/` (web-ide /
  web-cli installers per platform, curl-verified listing) with the official
  walk-through on developer.samsung.com; the retired `developer.tizen.org`
  portal now redirects to samsungtizenos.com.
- **CLI flags de-fabricated**: `tizen package -s` takes a Certificate Manager
  profile **name** (not a `.p12` path) and there is **no `--password` flag**;
  the nonexistent `tizen launch` is really `tizen run -p <app-id>`; the
  on-device `pkgcmd … -s /tmp/author.p12 -c <password>` "alternative" signing
  recipe never existed on current TVs and is deleted (signing is host-side).
  README's deployment blocks fixed to match (including the retired Eclipse-era
  "Window → Preferences → Tizen TV → Devices" path → Tools → Device Manager,
  and the non-existent `tizen studio` launcher command).
- **2026 ceremony added**: TV Developer Mode walk-through (App Settings →
  `12345` → dev-machine IP → full power cycle), sdb port **26101** for Samsung
  TVs (not the legacy 26159), "Permit to install applications", Certificate
  Manager wizard incl. distributor-certificate privilege levels and per-TV
  **DUID** registration, and the **Samsung Certificate Extension ≥ 2.0.73**
  floor (cert creation broke on older extensions since Sept 2025).
- **CI section aligned to the shipped pipeline** (`.github/workflows/build.yml`):
  the published `phlix-tizen-unsigned.wgt` is RAW/UNSIGNED by design; the doc
  states that plainly and keeps an honest headless-signing sketch (no invented
  installer flags) for owners with their own keys. Known-issues rewritten to
  the real failure modes.

### Added — Connect screen surfaces the LAN scanner + address history (M2 / review tizen__casualgamer) — 2026-10-29

- **`src/discovery/connectScan.ts` (NEW)** — the AD-24 surfacing leg lands. The
  client shipped a tested LAN scanner (`lanDiscovery.ts`) and a bounded
  address-history suggester (`resolveConfig.buildConnectSuggestions`) with ZERO
  consumers, so the first-run TV still hand-typed `http://192.168.x.x:8097` on a
  D-pad while both sat dead in the same widget. `@phlix/ui` v0.99.10's Connect
  screen carries the host seam they were built for (`PhlixAppConfig.connectScan`
  — omitted ⇒ the Scan affordance hides); `main.ts` now injects
  `createConnectScan({storage, currentBase})`, so pick-from-list is the day-1
  path and typed entry is the collapsed fallback.
- **Honest row law**: rows render ONLY on the user's Scan press (nothing
  auto-sweeps at mount); probed-confirmed servers lead (annotated `v<version>` —
  server-sent data, zero new UI strings, so no tizen-catalog keys and no locale
  pin rotation); a known address (persisted base ∪ capped history) that did NOT
  confirm still shows — a CORS-shy or sleeping host must not blind the suggester,
  and the page's own guards re-validate on row select; an unconfirmed subnet
  GUESS never shows — no fabricated IPs. Sweep stays inside the S503 mask (plain
  root-`/health` fetches; `app/config.xml` byte-identical) and inside the engine's
  bounded caps (≤ 6 known + ≤ 16 siblings, dedup-by-host, `MAX_CANDIDATES_PER_SWEEP`).
  A throwing storage REJECTS by contract — the page's documented inline "scan
  failed" note beats a fake empty list.
- **D-pad law**: rows are plain `<button>`s, so the C27 focus-candidate watcher
  registers them through `FOCUSABLE_SELECTOR` automatically — every row is a
  spatial stop with no engine change.
- **Tests**: `tests/unit/connectScan.test.ts` (+13: assembly ordering/label/
  dedup law, first-run pick-from-list through all-failed probes, confirmed vs
  dropped guesses, anchor precedence, known-base coverage for pre-history
  installs, zero-spray, bounded probe counts, fail-loud rejection, platform-API
  greps) + 1 boot wiring pin in `main.test.ts` driving the REAL module through
  the injected config. Red-before measured on a pre-fix scratch: exactly 2
  failures (config-pin + wiring leg).
- **Zero new request sites**: the `routeManifest.gate` scan stays at 27; the
  manifest fixture and `app/config.xml` are byte-identical. `AGENTS.md` and the
  `lanDiscovery` header carry the surfacing-leg truth (the "separate ui train
  slot" it named has landed and is now wired).

### Fixed — spatial engine registers focus candidates on real surfaces (C27 / review tizen__gameux) — 2026-10-29

- **CRITICAL: the D-pad was inert everywhere.** @phlix/ui's `useSpatialNav`
  moves focus between the elements in its exported `focusableRegistry`, but the
  ONLY producer of entries there is the opt-in `v-focusable` directive — which
  no shipped ui template invokes at the pinned v0.99.10 (grep `data-focusable`
  across the bundle: zero call sites). The registry was provably empty on every
  surface: the engine's key handler found no candidates, never called
  `preventDefault`, and the Arrows only scrolled the page.
- **`src/spatial/focusCandidates.ts` (new)**: the shell registers candidates at
  the engine boundary instead of forking upstream templates.
  `createFocusCandidateWatcher({root, registry})` keeps the pool equal to the
  currently-interactive elements under `root` — the SAME shape the focus trap
  and row-snap accept (`FOCUSABLE_SELECTOR`, now single-sourced here;
  `tizenBridge.ts` imports it) — via a full scan on mount plus a coalesced
  MutationObserver for node churn and in-place `disabled` flips. Shell entries
  are stamped `data-focusable="auto"` so the directive's own entries (empty
  string) are never swept or stolen; no `tabindex` is ever written and no focus
  is ever moved. `destroy()` releases exactly the shell-owned entries.
- **`src/SpatialNavHost.vue`**: owns the watcher's lifecycle — mount registers
  `document.body` into ui's `focusableRegistry`, unmount releases it. The
  `enabled` gate (tv mode / route / quality-menu) alone still decides whether
  moves happen, so a surface-off pool is idle, never contesting the player or
  the YELLOW flyout. The Tizen focus law holds: every interactive element on
  screen is D-pad reachable, including the C16 QuickConnect panel.
- **Tests**: +10 pins — `tests/unit/focusCandidates.test.ts` ×9 (whole-set
  initial registration, no-tabindex law, non-interactive/disabled exclusion,
  add/remove/disabled-flip churn, directive-owned immunity, destroy releases +
  disconnect, refresh idempotence) + the SpatialNavHost mount-lifecycle
  regression (a live body element reaches the registry, responds to DOM
  changes, is released on unmount — red pre-fix, green post). The host suite's
  mounts are now unmounted in afterEach (watchers must not leak across tests).

### Fixed — first-run QuickConnect takeover is dismissible (C16 / review tizen__casualgamer) — 2026-10-29

- **`src/quickconnect/QuickConnectPanel.vue` (CRITICAL)**: the pairing takeover was
  a non-dismissible wall — self-gated on `mounted && apiBase && !isLoggedIn`,
  rendered full-bleed opaque (`z-index: 12000`), covering the ONLY sign-in path
  (`@phlix/ui`'s LoginPage) while the ceremony's companion half
  (`POST …/quick-connect/{code}/approve`) has no client that can call it, and the
  BACK ladder registered no closable layer for it (at the app root, quitting the
  app was the only discoverable "dismiss"). It is now a door: a persistent
  "Enter password instead" control in EVERY phase stops the ceremony and retires
  the takeover, and BACK reaches the same retire through the S526 ladder — the
  panel root carries `data-quick-connect-panel` + `@keydown.escape` (the
  ring-the-bell contract, exactly the focus-trap layer's), and `tizenBridge.ts`
  gained `createQuickConnectLayer()` ranked ABOVE the ui trap probe (the
  full-bleed card is unconditionally topmost while visible). Dismissal is
  per-base: choosing a DIFFERENT server re-offers the pairing code.
- **i18n law**: ONE new key `quickConnect.usePassword` ("Enter password instead")
  mirrored across all seven tizen catalogs (en, es, fr, de, it, pt_BR, ja); the
  tizen-own key-set pins rotate 197 → 198 (`i18nLocales`, `tizenI18n` verbatim
  table) and `docs/i18n.md` counts follow.
- **Tests**: +12 pins (panel C16 dismissal contract ×6 — persistent affordance,
  click-retires + poll-gate close, Escape-bell receiver, per-base re-offer,
  selector tripwire vs `tizenBridge.ts`; bridge layer contract ×6 — probe, bell,
  BACK-at-root closes INSTEAD of exiting, trap outranking, no-fabrication).
  Red-before measured on the pre-fix `cp -a` scratch: exactly 15 failures
  (12 new component/bridge pins + the 3 i18n rotation pins). Serial suite
  47 files 733 → 745 tests, 0 failures; `vue-tsc` and `eslint` exit 0.
- **Zero new request sites**: the `routeManifest.gate` scan stays at 27 and
  `app/config.xml` is byte-identical.

### Changed — ui re-pin v0.99.9 → v0.99.10 — 2026-10-14

- **Pin advance (release-cascade lane, ui tag v0.99.10).** `@phlix/ui` bumped
  `#v0.99.9` → `#v0.99.10` (annotated tag `5898effc`, peels to `18c76eb0` —
  the lock's `resolved` equals the tag peel; strict-equality pin law holds;
  manifest `version` field honestly reads `0.99.10`). The release carries the
  **plugin-themes fix** (ui `c81480b9`): the themes store no longer
  short-circuits its `/api/v1/themes` fetch on an EMPTY-string apiBase — an
  absent base is same-origin, so the loader now gates on `null` and hosted
  pages (and the widget's served-context equivalent) discover plugin themes
  in the Appearance picker instead of shipping built-ins only.
- **Lock churn is the minimal declared-delta shape** (npm 11.19.0 / node
  24.20.0, `npm_config_userconfig=/dev/null`): exactly 3+/3− — the root
  `packages[""].dependencies` edge plus the `node_modules/@phlix/ui` node's
  `version`/`resolved` pair. The recorded `@phlix/contracts` edge under ui is
  UNCHANGED (`#v0.5.3` still requested — v0.99.10 rotated no dependency
  edges); zero other lock movement, zero `devOptional`→`dev` rewrite churn.
  `npm ci`-clean install; vendored identity proven: installed
  `node_modules/@phlix/ui/dist/phlix-ui.js` sha256 `deff3847…c056c8c7` ==
  the tag's tree blob == the server/hub lanes' install.
- **i18n law untouched.** `scripts/sync-ui-locale-bundles.mjs` needs no
  re-run: `src/i18n/locales/` + `messages.ts` are byte-unchanged between
  `cc931723` (the prior peel) and `18c76eb0` (`git diff` empty; the only
  test-tree delta was ui's own `ci-shard-gate.test.ts`, outside the vendored
  set), so the six bundles and the PIN manifest stay true — drift tests green
  as-is.
- **Widget re-packaged.** `npm run package` refreshed `package/` (31 assets
  rotated + `index.html`; deterministic: two consecutive package runs
  byte-identical, aggregate md5 `699737bd…`). Proofs on the shipped widget:
  the old themes-loader short-circuit `if(c!==""&&!(a.value&&!u))` (chunk
  `index-BCwpm1zs.js`) is GONE — the new `index-KxHfFy-r.js` carries the
  null-check shape `if(c!==null&&!(a.value&&!u))` around the same
  `get("/api/v1/themes",…)` call site.
- **Gates:** `vue-tsc --noEmit` 0 (folds into `package`); `eslint .` 0;
  `vitest run` **47 files / 733 total** (732 passed + 1 skipped — the
  sibling-clone-only i18nLocales pristine-source leg, skipped exactly as CI
  does; totals held baseline-exact); `npm run package` 0. CI re-runs the same
  legs, incl. 'Assert committed package/ is fresh'.

### Changed — ui re-pin v0.99.8 → v0.99.9 — 2026-10-03

- **Pin advance (release-cascade lane, ui tag v0.99.9).** `@phlix/ui` bumped
  `#v0.99.8` → `#v0.99.9` (annotated tag `c7130f70`, peels to `cc931723` —
  the lock's `resolved` equals the tag peel; strict-equality pin law holds;
  manifest `version` field honestly reads `0.99.9`). The release carries the
  **playlist create-contract fix** (ui `09bf8248`): the member-facing
  'Add to playlist' now sends EXACTLY `{name, library_id}` to
  `POST /api/v1/playlists` (server `CollectionController::create` requires
  `library_id` — the flow 400ed for every role before), unwraps the
  `{collection}` 201 envelope fail-loud, and chains
  `POST /api/v1/collections/{id}/items/{mediaItemId}` so the item lands —
  plus the contracts `#v0.5.3` catalog (204 codes) and the `library_id`
  wire-truth doc pass riding the ui dist chain.
- **Lock churn is the minimal declared-delta shape** (npm 11.19.0 / node
  24.20.0, `npm_config_userconfig=/dev/null`): exactly 4+/4− — the root
  `packages[""].dependencies` edge, and in the `node_modules/@phlix/ui`
  node the `version`/`resolved` pair plus the recorded `@phlix/contracts`
  edge `#v0.5.2`→`#v0.5.3` (the tarball now publishes the v0.5.3 edge; the
  hoisted root contracts/syncplay copies were ALREADY at `#v0.5.3`/`#v0.1.5`
  since the b99c964 lane, so the edges converge — zero nested shadow nodes,
  zero other lock movement; no `devOptional`→`dev` rewrite churn).
  `npm ci`-clean install; vendored identity proven: installed
  `node_modules/@phlix/ui/dist/phlix-ui.js` sha256 `5efa7cb5…8aa78cdc` ==
  the tag's tree blob == the server/hub lanes' install.
- **i18n law untouched.** `scripts/sync-ui-locale-bundles.mjs` needs no
  re-run: `src/i18n/locales/` + `messages.ts` are byte-unchanged between
  `a580410f` (the PIN ref) and `cc931723` (`git diff` empty; the only i18n
  delta was `errors.ts`, outside the vendored set), so the six bundles and
  the PIN manifest stay true — drift tests green as-is.
- **Widget re-packaged.** `npm run package` refreshed `package/` (31 assets
  rotated + `index.html`; deterministic: two consecutive package runs
  byte-identical by md5 census). Proofs on the shipped widget: the
  `{name:t,library_id:n}` create payload and per-leg failure toasts are in
  the new chunks, the `['bearer', …]` WS carrier is live, zero `[?&]token=`
  occurrences, and `syncplay.queue_limit_exceeded` (the v0.5.3 catalog)
  rides the bundle.
- **Gates:** `vue-tsc --noEmit` 0; `eslint .` 0; `vitest run` **47 files /
  733 passed** (baseline exactly held); `npm run package` 0. CI re-runs the
  same legs, incl. 'Assert committed package/ is fresh'.

### Changed — contracts re-pin v0.5.2 → v0.5.3 — 2026-10-01

- **Pin advance (lane `chore/contracts-repin-v0.5.3`).** `@phlix/contracts`
  bumped `#v0.5.2` → `#v0.5.3` (annotated tag `eb90e6d`, peels to contracts
  `430981e` — strict-equality pin law holds: the lock's `resolved` equals the
  tag peel, `ls-remote`-verified this leg). The release grows the error-code
  registry 202 → 204 (`+leaf_hub_id_already_bound`,
  `+syncplay.queue_limit_exceeded`; `dist/error-codes.json` md5 `40c1da48…`)
  and re-ships the server-route manifest 410 → 412 tuples (`+GET|POST
  /api/v1/books/{id}/progress`, ZERO removals; server sha `758f9149…`).
- **TRUE content re-vendor (S280 gate).** `tests/fixtures/server-route-manifest.json`
  re-vendored byte-for-byte from the tag's `dist/server-route-manifest.json`
  (md5 `91579683…`; cmp-proven identical to the tag payload and to mobile's
  v0.5.3 leg — one source across the estate). Gate pins rotated:
  provenance serverSha `730e55b7…`→`758f9149…`, total/length/unique
  410→412, fixture md5 `06ce7ec9…`→`91579683…`, log wording. Negative
  tripwires re-verified against the new bytes: S279-class dead rails
  (`/syncplay/rooms`, `/syncplay/sessions`, `/audio-tracks`, `/playlist`)
  stay UNSERVED, hub-minted relay-token stays absent from the server
  manifest, WS/relay transports stay OUT of the HTTP registry, and the
  planted-red non-vacuity control still fires. Per-file scan coverage
  UNCHANGED (27 sites across 11 modules) — the two new routes are not
  called from this tree.
- **Compile-pin verdict: NO TS2741 class break.** Unlike mobile (whose
  `syncplayErrors.ts` imports the `SyncPlayErrorCode` union directly),
  tizen has NO exhaustive `Record` over any contracts-derived union:
  `grep -rn "ErrorCode\|error_code" src/ tests/` yields ZERO matches;
  every `@phlix/contracts` type import is erased at compile time. The
  registry growth is therefore type-invisible here.
- **Lock: surgical 3+/3−.** Exactly the root `packages[""]` edge text + the
  hoisted `node_modules/@phlix/contracts` node (`version` `0.5.2`→`0.5.3`,
  `resolved` → peel `430981e`). The `@phlix/ui` manifest's own contracts
  edge (`#v0.5.2`, as published in ui `a580410f`) stays exactly as written
  — ui's declaration, not this client's pin; npm hoists the single
  top-level contracts tree and `npm ci --allow-git=all` accepts (v0.5.2-leg
  precedent). Zero unrelated churn: the seven `devOptional` markers byte-
  identical (npm 12 install verified non-destructive on this lock shape).
- **Locale law untouched.** `src/i18n/**` (PIN manifest, six vendored
  ui-locale bundles, SOURCE_REF `a580410f`, 441-key equality) and
  `scripts/sync-ui-locale-bundles.mjs` are NOT in this commit — contracts
  rides no locale surface; the re-pin must not move them and did not.
- **`package/` refresh RIDES THE COMPANION COMMIT — bundle genuinely
  moved.** tizen's single runtime contracts import (`buildPhlixHeaders`)
  shares its module with the error-code registry constants, and rollup
  keeps them; the new index chunk embeds `leaf_hub_id_already_bound` +
  `syncplay.queue_limit_exceeded` (1× each; the 412-route table itself did
  NOT tree-in). Determinism proved: two consecutive `npm run package` runs
  → identical aggregate md5 `3ebe6b6b…` (was `fc70830b…` under the standing
  formula per the b56eabd correction — the companion commit's message cited
  `f3635488…`, the known phantom; that pushed message stands as history,
  corrected forward-only here). Shipped-shape
  guards re-checked on the new bundle: `["bearer"` subprotocol present,
  zero `[?&]token=` in any js/html.
- **Gates:** typecheck 0, lint 0, vitest 47 files / **733 tests exact**
  (baseline held — fixture+pin rotation changed counts 410→412 INSIDE the
  gate but no site counts), build 0.

### Changed — ui re-pin v0.99.7 → v0.99.8 — 2026-10-01

- **Pin advance (lane `chore/ui-repin-v0.99.8`, retag-cascade estate item).**
  `@phlix/ui` bumped `#v0.99.7` → `#v0.99.8` (annotated tag `35f727a6`, peels to
  `a580410f` — lock `resolved` equals the tag peel; strict-equality pin law
  holds; manifest `version` field honestly reads `0.99.8`). The release carries:
  the syncplay **bearer-subprotocol flip** (vendored `src/api/syncplay.ts` dials
  `:8097` with `['bearer', token]`, never `?token=`), the **invite one-time-token
  DTO** (`/redeem` surface), the **`player.css` export rename** (`./ui.css` →
  `./player.css`), and the **`paths?.` guard hardening (P1)** — the crash-risk
  fix for consumers whose server redacts `paths` for non-admins.
- **ui manifest deps→peers.** `a580410f` moved `vue`/`pinia`/`vue-router` from
  ui's `dependencies` to `peerDependencies`; the lock's `node_modules/@phlix/ui`
  node therefore LOSES those three edges. The hoisted root copies (this repo's
  own declares) are untouched — no nested shadow ever existed, so resolved
  versions never moved. Zero other lock churn: exactly the ui node + the
  root `packages[""].dependencies` edge text.
- **TRUE RE-VENDOR (i18n).** Unlike the zero-content v0.99.7 pin, the locale
  tree genuinely moved: catalog **412 → 441 keys** (`+29`: itemActions, reader,
  player-theme, mcpTokens, syncplay modeSelect, music a11y).
  `scripts/sync-ui-locale-bundles.mjs` re-run at `SOURCE_REF=a580410f`: the six
  bundles each gained 35 lines, `PIN` re-derived (14 hashes at the new blobs),
  bare-run re-vendor proved **idempotent** (byte-identical second pass), and the
  installed `DEFAULT_MESSAGES` flattens to the same **441** keys — the exact
  both-direction equality law in `tests/unit/i18nLocales.test.ts` is
  compile-proven by the surviving `satisfies PhlixMessages` annotations and
  green in the suite. Era prose (docs/i18n.md, src/i18n/index.ts,
  AGENTS.md/CLAUDE.md pin lines, test headers) updated to v0.99.8.
- **`package/` REGENERATED (companion commit).** Content moved, so the
  committed widget output refreshes. Determinism proved: `npm run package` ×2 →
  byte-identical file sets; tree aggregate md5 `104bb4fc…` → `fc70830b…`
  (lane time cited `f3635488…` — NOT reproducible under the formula
  `cd package && find . -type f | sort | xargs md5sum | sort -k2 | md5sum`;
  reviewer re-ran it 2026-10-01 on the committed `ac4c7c0` tree and got
  `fc70830bdbb372084b8c69b40fa69751`, while the same formula on the prior
  `476c00d` tree reproduces `104bb4fc291acb76832c3d774d93190f` exactly, so
  the formula is confirmed and only the cited new-side value was phantom —
  corrected forward-only; the `ac4c7c0` commit message stands as history).
  Shipped-widget proofs: `["bearer"` appears in `assets/index-*.js` (×3: the
  vendored ui syncplay dial, the vendored ui hub-relay dial, and this repo's own
  `useSyncPlayStore` dial — all three now law-consistent) and in the lazy
  `SyncPlayModal-*.js` chunk (×1, the `buildWsProtocols` helper); `paths?.`
  guards ship in the index bundle (×2); **ZERO** `[?&]token=` in any shipped
  js/html/css (the only surviving `?token=` mentions repo-wide are source-map
  docblock prose). `SyncPlayPage`/`PlayerPage` chunks ship: the ui router
  (`createPhlixApp.ts` `${base}/syncplay`) makes the bearer-flipped vendored
  syncplay surface LIVE in the widget alongside the client-local store path.
- **Gates.** typecheck 0, lint 0, suite 733 → 733 (all green; CI expectation
  732 + 1 skip unchanged), build 0, package ×2 deterministic.
- **Syncplay/contracts edges untouched.** `@phlix/syncplay` stays `#v0.1.5`,
  `@phlix/contracts` stays `#v0.5.2` (both here and inside ui's manifest).

### Fixed — `/app/library/scan` route is admin-gated (`meta.requiresAdmin`) — 2026-09-30

- **Security (estate L-4 follow-up, mirrors server web-ui `114c9aaf`).** The
  library-scan route was registered unguarded, so a logged-in NON-admin could
  mount the operator page whose rows assume the `paths` key that server
  `b3aece4e` redacts for non-admins. The route now carries
  `meta: { requiresAdmin: true }` — the exact key the vendored @phlix/ui
  authGuard checks (`to.meta?.requiresAdmin === true`): non-admins bounce to
  browse pre-render, anonymous visitors to login. No @phlix/ui bump needed —
  the guard honors the key in the pinned v0.99.7.
- **Tests.** New `tests/unit/library-scan-route.test.ts` pins the meta in the
  `src/main.ts` route block, cross-checks the shape against the LIVE
  `buildAdminRoutes()` section meta from the vendored tarball, and probes the
  vendored guard's `requiresAdmin` reads — a future ui key-rename flips these
  red instead of silently un-gating. The existing `buildExtraRoutes` wiring
  test now asserts the meta on the runtime route object. Suite 730 → 733.

### Changed — SyncPlay :8097 empty-token subprotocol bail — 2026-09-30

- **`connectWs` no longer lets an empty token reach the `WebSocket`
  constructor.** The `:8097` dial's second argument becomes
  `token ? ['bearer', token] : undefined` — with a missing token the socket
  opens with NO subprotocol offer (anonymous handshake) instead of constructing
  `['bearer', '']`. Rationale (measured fact from the @phlix/ui rework lane):
  the WHATWG constructor THROWS on empty protocol entries (HTML spec §3.1
  step 9; Chrome 153 `SyntaxError`), and the Tizen webview is Chromium — the
  throw would be swallowed by the dial's try/catch as a generic
  `wsError`, misreporting "no token" as "connect failed". Estate-shape parity
  with `../phlix-ui/src/api/syncplay.ts`.
- **Prose correction.** The 2026-09-29 entry's "latent PROD reconnect bug"
  claim was overstated — see its corrected bullet below (harness-only proxying;
  `toRaw` is defense-in-depth). The commit-message narrative of `9a5b24b`
  carried the same overstatement; this entry is the amend-in-new-commit
  (the pushed commit is never rewritten).
- **Tests.** `MockWebSocket` now mirrors the spec and throws on empty protocol
  entries (mutation-pinning the bail); new pins: an empty token constructs with
  `protocols === undefined` and `connectWs` does not throw / sets no `wsError`;
  the bearer path is unchanged (`['bearer', <jwt>]`). Suite 729 → 730, all
  green; typecheck / lint / build green.

### Changed — SyncPlay :8097 bearer-subprotocol carrier flip — 2026-09-29

- **`src/stores/useSyncPlayStore.ts` moves the handshake JWT from the `?token=`
  query param to the two-entry bearer subprotocol carrier** —
  `new WebSocket(url, ['bearer', token])` at the `connectWs` construction site,
  and `buildWsUrl` loses its `token` parameter entirely (the URL is now
  `wss://<host>:8097?room=<id>`; the room param is non-credential and stays).
  The signature change makes re-introducing a query token a type error.
  Retires the `0b63874` TODO block — the blocker it named lifted in
  phlix-server `424c14d0`, which ships the transitional dual-carrier law on
  `:8097` (`SyncPlayAuthMiddleware::offersBearerSubprotocol()` /
  `bearerSubprotocolToken()` / `resolveHandshakeToken()`, doc
  `phlix-server docs/dev/WEBSOCKET_AUTH_CARRIERS.md`): bearer is priority 1
  (TARGET) with the offer-gated `Sec-WebSocket-Protocol: bearer` echo; the
  legacy query carrier remains ACCEPTED server-side (priority 2, RETIRING)
  while old client builds age out — this client has moved. Platform proof the
  constructor form works in this webview: `src/api/hubRelay.ts:453` has always
  opened the `:8804` relay socket with exactly `['bearer', token]`.
- **`toRaw` hardening of the `ws.onclose` identity guard (surfaced by the
  flip's test; original entry OVERSTATED — corrected 2026-09-30).** The guard
  compares `toRaw(wsConnection.value) !== ws`. Reviewer-measured on vue 3.5.39:
  `reactive()` proxies only `toStringTag:'Object'` values, and a REAL browser
  WebSocket is platform-tagged (`'[object WebSocket]'`) — it is stored RAW, so
  production identity matching always worked and auto-reconnect was never dead
  in prod. The proxy-induced mismatch existed ONLY in the harness, where the
  plain-class `MockWebSocket` (tag `'[object Object]'`) IS proxied and every
  mocked close early-returned. The `toRaw` unwrap stays as defense-in-depth
  (it pins the identity compare against any future proxy-shaped stored handle
  and keeps the harness lane honest); it is not a production bugfix.
- **Tests.** `MockWebSocket` records the constructor `(url, protocols)` args
  (mirroring `hubRelay.test.ts`'s `FakeWebSocket`); three new pins: protocols
  are exactly `['bearer', <jwt>]` for a dotted JWT-shaped token (refutes the
  dotted-single-entry shape), the URL is byte-pinned
  `wss://api.example.com:8097?room=room-123` with no `token=` and no token
  echo, and the reconnect lane re-enters `connectWs` through the real 1 s rung
  with the same bearer carrier (doubles as the `toRaw` regression pin).
  Suite 726 → 729, all green; typecheck / lint / build green.

### Changed — ui re-pin v0.99.6 → v0.99.7 — 2026-09-25

- **Pin advance (lane `chore/ui-repin-v0.99.7`).** `@phlix/ui` bumped
  `#v0.99.6` → `#v0.99.7` (annotated tag `da9f1625`, peels to ui merge-commit
  `bc1d29bf` — ui-side hygiene: `.gitattributes` LF shield, contracts-pin test
  synced to `#v0.5.2`, route-gate test harness + errors/LoginForm test
  refreshes; no shipped-behavior change). Strict-equality pin law holds: the
  lock's `resolved` is exactly the tag peel.
  **VERSION-FIELD SKEW ENDED (ui side).** The v0.99.6 tag tree's
  `package.json` `version` FIELD still read `0.99.4` (the v0.99.6 entry below
  notes the lag — historical record kept), so only `resolved` advanced and this
  lock's `version` carried the lag. The v0.99.7 release commit bumps the
  manifest honestly to `0.99.7`, so this lane moves the lock's ui `version`
  `0.99.4` → `0.99.7` alongside `resolved` — lock and tag now agree in every
  field.
- **ui's contracts edge moves `#v0.5.1` → `#v0.5.2`.** The lock's
  `node_modules/@phlix/ui` dependency edge previously carried the stale
  `#v0.5.1` text as published in ui `98a5bf38` (that entry explicitly left it
  "exactly as written"); ui `bc1d29bf` re-declares it at `#v0.5.2`, matching
  the single hoisted `node_modules/@phlix/contracts` copy this repo already
  resolves — both old and new edge text were/are served by that one v0.5.2
  checkout (no nested copy ever existed), so the resolved contract bytes never
  moved. Recorded honestly: this is edge-text alignment, not a dependency
  behavior change.
- **Zero-content pin, proven at the tags.** `git diff 98a5bf38..bc1d29bf --
  src/i18n/locales/` is EMPTY — the release lane proved dist zero-delta across
  `98a5bf38` → `bc1d29bf`. Empirical proof in-lane: `node
  scripts/sync-ui-locale-bundles.mjs --ref bc1d29bf --branch master`
  re-vendored with a ZERO content diff — only `PIN.ref` moved; all 14 hashes
  (7 files × `source_sha256` + `vendored_sha256`) byte-identical before and
  after. The six-locale bundles and installed `DEFAULT_MESSAGES` still flatten
  to 412 keys / 16 groups.
- **`package/` needs NO regeneration.** Unlike #115 (whose regen existed
  because bundled CONTENT moved), nothing changed in the bundle: `npm run
  package` executed twice; `git status --porcelain -- package/` stayed empty,
  so no `package/` commit rides this PR. The CI widget-build freshness job
  remains the authority.
- **Syncplay untouched.** `@phlix/syncplay` stays `#v0.1.5`
  (`b82d4f36…`).

### Changed — contracts re-pin v0.5.1 → v0.5.2 — 2026-09-25

- **Pin advance (lane `chore/contracts-repin-v0.5.2`).** `@phlix/contracts`
  bumped `#v0.5.1` → `#v0.5.2` (annotated tag `9676874e`, peels to contracts
  merge-commit `7afb6a91` — errors-registry coordinate re-sweep, CI freshness
  gates, repo LF shield, contracts PRs #79–#83). Strict-equality pin law
  holds: the lock's `resolved` is exactly the tag peel.
  **VERSION-FIELD SKEW ENDED.** In the two prior legs the tag trees'
  `package.json` `version` FIELD still read `0.4.7` (see the v0.5.0/v0.5.1
  entries below — kept as historical record, not rewritten), so only
  `resolved` advanced and the lock's `version` carried the lag. The v0.5.2
  release commit (`ac669ca`) bumps the manifest honestly to `0.5.2`, so this
  lane moves the lock's `version` `0.4.7` → `0.5.2` alongside `resolved` —
  lock and tag now agree in every field.
- **Zero-content pin, proven at the tags.** The `v0.5.1..v0.5.2` diff touches
  errors docblocks/types (`src/errors.ts`, `dist/errors.d.ts`), source maps,
  and repo plumbing only; measured byte-identical across both tags:
  `dist/phlix-contracts.js` (md5 `6cd0a00e…`), `dist/error-codes.json`
  (md5 `b919685d…`, 202 codes), `dist/server-route-manifest.json`
  (md5 `06ce7ec9…`). The version-field bump is manifest metadata, never
  bundled. Consequence: the committed `package/` needs NO regeneration this
  time — unlike #113/#114, whose regen existed because bundled CONTENT moved.
  Empirical proof in-lane: `npm run package` executed twice;
  `git status --porcelain -- package/` stayed empty, so no `package/` commit
  rides this PR.
- **Fixture + i18n untouched.** Route-manifest fixture unmodified — the gate
  comment cites `#v0.5.2` and re-measures its embed (stands server
  `730e55b7…`/md5 `06ce7ec9…`, byte-identical to the vendored copy);
  comment-only, 0 behavior. `src/i18n/` is DO-NOT-TOUCH on this lane: `PIN` +
  every vendored bundle byte-identical before/after, with the #116
  `.gitattributes` LF shield verified active (`git ls-files --eol`: `i/lf
  w/lf` across the tree). The `@phlix/ui` manifest's own contracts edge
  (`#v0.5.1`, as published in ui `98a5bf38`) stays exactly as written —
  that line is ui's declaration, not this client's pin; npm hoists the single
  top-level contracts tree and `npm ci --allow-git=all` accepts. Gates held:
  typecheck, lint, build, 46 files / 726 tests exact.

### Changed — ui re-pin v0.99.5 → v0.99.6 — 2026-09-24

- **Pin advance (lane `chore/ui-repin-v0.99.6`).** `@phlix/ui` bumped
  `#v0.99.5` → `#v0.99.6` (annotated tag `7d0b71d1`, peels to ui merge-commit
  `98a5bf38` — signup error-catalog rendering, ui PRs #421–#425). Strict-equality
  pin law holds: the lock's `resolved` is exactly the tag peel. SKEW persists
  (estate-wide, documented): the v0.99.6 tag tree's `package.json` `version`
  FIELD still reads `0.99.4`; the lock's `version` therefore holds `0.99.4` and
  only `resolved` advances. ADDITIVE upstream, verified at the source:
  `git diff 3017f443..98a5bf38 -- src/i18n/` touches ONLY the new
  `errors.ts`/`errors.test.ts` module (ui's error-code catalog — a separate
  module this client does not consume); `src/i18n/messages.ts`, `locales/` and
  `plural.ts` are byte-unchanged. Installed-tree verification: `DEFAULT_MESSAGES`
  still flattens to 412 keys / 16 groups (read from the resolved v0.99.6 bundle),
  exactly equal to every vendored bundle key set both directions — the strict
  `satisfies PhlixMessages` typing still compile-checks clean (`typecheck`), so
  the key-set equality law never trips. `scripts/sync-ui-locale-bundles.mjs`
  re-vendored at `--ref 98a5bf38` produced a ZERO content diff — only `PIN.ref`
  and the bootstrap `SOURCE_REF` constant move (`PIN.branch`/`SOURCE_BRANCH`
  stay `master`), contradicting nothing and confirming ui's additive claim.
  Side-benefit: ui's own contracts manifest edge now declares `#v0.5.1`,
  matching this client's top-level contracts pin — the lock hoists a single
  v0.5.1 tree (3-line lock diff total). The route-manifest fixture is untouched
  (no request-site changes; `routeManifest.gate` green). Gates held: typecheck,
  lint, build, 46 files / 726 tests exact; committed `package/` regenerated in
  its own commit (ui rides the widget chunks; CI T-02 freshness), double-`npm
  run package` byte-stable.

### Changed — contracts re-pin v0.5.0 → v0.5.1 — 2026-09-23

- **Pin advance (lane `chore/contracts-repin-v0.5.1`).** `@phlix/contracts`
  bumped `#v0.5.0` → `#v0.5.1` (annotated tag `cf0163ee`, peels to contracts
  merge-commit `e3c14f07` — the W1b registry expansion, contracts PR #78).
  Purely ADDITIVE upstream: `dist/error-codes.json` grows 147 → 202 wire codes
  (verified zero removals, zero duplicates); tizen carries NO error catalog
  keyed to registry codes, so the 55 additions cause zero client adaptation
  and zero test churn by design. SKEW persists (estate-wide, documented): the
  v0.5.1 tag tree's `package.json` `version` FIELD still reads `0.4.7`; the
  lock's `version` therefore holds `0.4.7` and only `resolved` advances.
  Surgical lock diff: root echo + resolved sha; the `@phlix/ui` manifest edge
  (`#v0.4.7`, ui's own declaration) stays as written and npm hoists the single
  v0.5.1 tree — `npm ci --allow-git=all` accepts. The route-manifest embed is
  UNCHANGED by this tag (v0.5.1 diffs only `src/errors.ts`, `test/`, and the
  errors-affected `dist/` files): re-measured at server
  `730e55b7…`/md5 `06ce7ec9…`, byte-identical to the vendored fixture —
  `routeManifest.gate` advances its pin cite accordingly, comment-only,
  0 behavior. The ui pin and `src/i18n/ui-locale-bundles/PIN` are untouched —
  the contracts bump is disjoint from the ui-locale lineage (verified
  byte-identical after). Gates held: typecheck, lint, build, 46 files /
  726 tests (coverage floor), double-`npm run package` byte-stable; committed
  `package/` regenerated in its own commit (contracts ride the widget chunks;
  CI T-02 freshness).

### Changed — contracts re-pin v0.4.7 → v0.5.0 (cs#48) — 2026-09-23

- **cs#48 pin advance (lane `chore/contracts-repin-v0.5.0`).** `@phlix/contracts`
  bumped `#v0.4.7` → `#v0.5.0` (tag peels to contracts master `8ef65d30`). Purely
  ADDITIVE upstream — the new `src/errors.ts` wire-code registry +
  `dist/error-codes.json` land with zero changes to existing exports — so the
  client adapts nothing by design (a bump-induced break would have stopped the
  lane). SKEW (estate-wide, documented): the v0.5.0 tag tree's `package.json`
  `version` FIELD still reads `0.4.7`; the lock's `version` therefore holds
  `0.4.7` and only `resolved` advances — version-field readers need the
  documented override (cf. the windows lockwalk `manifestVersion` precedent).
  Surgical lock diff: root echo + the `node_modules/@phlix/contracts` entry's
  resolved sha; the `@phlix/ui` manifest edge (`#v0.4.7`, ui's own declaration)
  stays as written and npm hoists the single v0.5.0 tree — `npm ci
  --allow-git=all` accepts it byte-for-byte. The v0.5.0 tag now embeds the
  canonical server-route-manifest (server `730e55b7`/md5 `06ce7ec9` —
  byte-identical to the vendored fixture), so `routeManifest.gate` advances its
  pin cite + records the re-measurement, comment-only, 0 behavior; re-adoption
  of the contracts export stays the coordinated W19 phlix-ui #349 call. The ui
  pin and `src/i18n/ui-locale-bundles/PIN` are untouched — the contracts bump
  does not disturb the ui-locale lineage. Gates held: typecheck, lint, build,
  46 files / 726 tests (coverage floor), double-`npm run package` byte-stable;
  committed `package/` regenerated in its own commit (contracts rides the
  widget chunks; CI T-02 freshness).

### Added — six-locale build-out: vendored ui bundles + tizen-own translations (es, fr, de, it, pt_BR, ja)

- **The estate's six locales now ship.** Per the 2026-09 estate decision the
  client speaks es / fr / de / it / pt_BR / ja. The ui-catalog translations
  are NOT forked here: `phlix-ui` is the SSOT and its locale bundles (authored
  at `feat/i18n-locale-bundles@2f2df8a2`) arrive as SHA-PINNED vendored copies
  under `src/i18n/ui-locale-bundles/` + a `PIN` hash manifest, refreshed by
  `scripts/sync-ui-locale-bundles.mjs` (three documented transforms; the
  `satisfies` relaxation exists because the bundles run 7 keys ahead of the
  installed v0.99.4 pin — the extras are pinned in tests until the next
  dependency bump). `MESSAGE_CATALOGS` serves them through the existing
  config-time seam with one documented boundary cast.
- **Tizen-own catalog translated ×6.** `src/i18n/tizen/locales/{es,fr,de,it,pt_BR,ja}.ts`
  each carry the complete 197-key set typed `satisfies TizenCatalog` (compile
  key-set law). Doctrine: every `{placeholder}` verbatim; latin locales add
  CLDR two-segment pipes on exactly the 12 keys where English hardcoded a
  plural while passing `count`; **ja carries zero pipes** (single CLDR
  category) with native counters 人/枚/曲/件/章/本 and One/Other pairs holding
  identical values; per-locale English-leak allow-lists (brand/unit/format
  tokens) are pinned BOTH directions; pt_BR is Brazilian, and every `pt-*`
  device signal resolves to it (`normalizeLocaleTag` is region-aware for pt —
  the alternative silently degrades all Portuguese devices to English).
- **Resolution matrix + real-bundle E2E.** New `tests/unit/i18nLocales.test.ts`
  (45 tests): tag→bundle for BOTH registries (incl. `es-ES`→es wins outright,
  `zz`/`xx_YY`/`kl-GL` fall through, `pt-PT`→`pt_BR`), Spanish actually
  rendering through `mergeMessages()`/`tTizen()`, the en path byte-identical
  (all 197 own-catalog pins re-walked), PIN↔disk hashes (runs in CI) and
  PIN↔pristine-source transform parity (hard-fails locally, SKIPS in CI —
  tizen CI clones only `phlix-contracts`; drift rides the local gate +
  re-pin cascade). Three existing expectations that assumed es/fr were
  UNSUPPORTED were revised to genuinely-unsupported probes (`zz`-class) —
  intent preserved, inverted truth documented inline.
- **Docs.** `docs/i18n.md` gains the locale matrix, the vendoring/refresh
  procedure incl. CI drift-policy, and the rewritten add-a-locale#7 recipe
  covering both catalogs.

### Changed — ui locale bundles re-vendored at `phlix-ui@dc1df7d5`

- The vendored copies + `PIN` were refreshed from the SSOT branch after the ui
  review-fix commit `dc1df7d5` (follow-up to `2f2df8a2`). Eight shipped values
  moved: es `player.captionsAndSubtitles` (leyendas → "closed captions" loanword)
  and `player.queue` (Cola → Cola de reproducción); de `searchLibrary`,
  `transcodePreparingTitled`, `transcodeBodyTitled` (quote closer `"` → `“` to
  pair `„…“`); ja `syncplay.members` (native measure-word order), `connect.hint`
  and `connect.invalidAddress` (half-width spaces at CJK↔ASCII boundaries).
  Header comments in es/de/it were normalised (quote pairs + policy lines); no
  key set, placeholder, or pipe-segment shape changed, so no test expectation
  moved — the PIN↔source parity leg re-derives everything from the new ref.

### Fixed — i18n locale lane: R1 review follow-ups (bare-run rollback guard, header/store literals) — 2026-09-23

- **Sync-script rollback guard (R1-F3).** `scripts/sync-ui-locale-bundles.mjs`
  kept a hardcoded `SOURCE_REF` beside the `PIN` manifest; after the
  `dc1df7d5` re-vendor the constant was stale at `2f2df8a2`, so a BARE script
  run would have silently re-vendored the OLD bundles and self-rewritten the
  PIN (every self-consistent gate stayed green). Bare runs now default to
  `PIN.ref`/`PIN.branch` on disk (idempotent re-sync; explicit `--ref`/
  `--branch` still override for re-pins), the constants are bootstrap-only
  (used when no PIN exists), a present-but-broken PIN now fails fast, and
  `tests/unit/i18nLocales.test.ts` hard-pins constants == PIN so future
  re-pins must sync the anchor deliberately.
- **ParentalControls section headers localized (R1-F1).** The `Blocked Tags`
  and `Stream Limits` `h2.section__title` literals now render through
  `tTizen('parentalControls.tabBlockedTags'/'tabStreamLimits')` — the existing
  tab keys whose English values are byte-identical to the literals (verified
  against `en.ts`; all six locale catalogs already carried translations). New
  real-mount proof: an es-locale mount asserts both headings render Spanish
  out of the DOM.
- **SyncPlay member fallback localized (R1-F2).** `useSyncPlayStore`'s
  `normalizeMembers` used `name: m.name ?? 'Unknown'`; it is now
  `?? tTizen('common.unknown')` (the accessor is already imported by the
  Pinia `useMusicStore` precedent — no cycle; en render byte-identical).
  Survey of the file's other English literals found none of the same
  user-visible-display class: the `error.value`/`wsError.value` strings are
  unread diagnostic state (no consumer renders them today), the API-error
  fragment is a diagnostic template, and `'User left room'` is a WebSocket
  close reason on the wire — all deliberately untranslated.
- **Ahead-of-pin placeholder parity widened (R1-F4).** The cross-bundle
  placeholder-parity law now covers ALL 7 ahead-of-pin ui keys (was 3); the
  set is one hoisted `UI_AHEAD_OF_PIN` constant shared by the three laws that
  consume it, so extending the vendor set cannot silently miss a law.

### Added — tizen-own string catalog: every client-rendered literal moves behind `tTizen()`

- **The client's own strings are now cataloged.** The ui seam above reaches
  only strings `@phlix/ui` renders; everything this client renders from its
  nine root-mounted apps and pages (menu labels, boot-failure chrome, the hub
  paused notice, overlay/list/page/panel text) sat as inline literals. New
  `src/i18n/tizen/locales/en.ts` (`TIZEN_EN`, 197 keys / 18 groups) holds each
  EXACT original string (interpolated ones become `{param}` templates), and
  `src/i18n/tizen/index.ts` exposes `tTizen(key, params?)` with ui-parity
  semantics: `{name}` interpolation (unmatched tokens ride through), pipe-form
  plurals selected by `params.count` through ui's own exported
  `selectPluralTemplate`, raw-key fallback with a loud `import.meta.env.DEV`
  warning on unknown keys.
- **One locale truth, zero forks.** The accessor REUSES `resolveLocale()` /
  `SupportedLocale` from `src/i18n/index.ts`; `boot()` resolves the locale
  ONCE and threads it into BOTH catalogs (`setTizenLocale(locale)` +
  `messagesForLocale(locale)`), so they can never disagree. Adding a locale is
  now two files + two registry lines, documented in `docs/i18n.md`.
- **Behavior byte-identical, contract pinned.** No string was translated; `'en'`
  remains the only locale. `tests/unit/tizenI18n.test.ts` pins every catalog
  value verbatim against the pre-refactor literals, scans that every key has a
  live quoted call site (and every call-site key is defined), pins
  `tTizen('audioTracks.applyRefusal')` against the intentionally-literal English
  ANCHOR export the boundary tests import, and pins `boot.splashHint` against
  the zero-JS `index.html` splash. `src/tizenBridge.ts` carries no user-facing
  literals (verified). Wire identity (`deviceName`), the dual-use
  `KeyMapping.DISPLAY_NAMES` voice phrases, and non-rendered sync-play strings
  are deliberately excluded — rationale in `docs/i18n.md`. Zero new request
  sites; manifest scan stays 27, `app/config.xml` untouched.

### Added — i18n messages seam wiring: client locale → `@phlix/ui` catalog overrides

- **The seam is now reachable from the client.** `@phlix/ui`'s config-time
  `PhlixAppConfig.messages` override existed since R6.5c but this client never
  passed it, so translated strings had no path into the render. New
  `src/i18n/index.ts` resolves the boot locale (explicit → `VITE_PHLIX_LOCALE` →
  unprivileged `navigator.language` → `'en'` — no `tizen.systeminfo` privilege,
  doctrine held) and `boot()` now passes
  `messages: messagesForLocale(resolveLocale())` into `createPhlixApp`.
- **Behavior-preserving by construction.** The only shipped catalog is `'en'`
  (`src/i18n/locales/en.ts`) and it is an EMPTY override — ui's `mergeMessages`
  reproduces its English defaults exactly. Adding a locale is new file + union
  line + one registry line (`docs/i18n.md`).
- **Pipeline PROVEN headlessly.** `tests/unit/i18n.test.ts` runs the REAL
  v0.99.4 bundle unmocked: a fake `{ common: { retry: 'ZZZ-TEST' } }` override
  reaches a mounted component's `useMessages().t` through the actual
  provide→inject→merge→resolve chain (sibling keys keep English; omitted-config
  and empty-en-catalog baselines pin byte-identical defaults), plus `mergeMessages`
  semantics pins and a full `resolveLocale` priority table incl. env stubbing.
  `main.test.ts` pins `boot()` passes the field. Zero new request sites — the
  route manifest scan stays 27, `app/config.xml` untouched.

### Added — W115 (S535): digit-commit buffer — the digit channel goes LIVE (AD-22)

- **One shared buffer replaces the dead passthrough.** New pure module
  `src/remote/DigitBuffer.ts` queues typed/pressed digit input and drains after a
  2 s inactivity window as ONE joined commit — "1-2-3 fast" commits `123`, three
  slow presses commit `1`, `2`, `3`; every digit re-arms the single timer, a lone
  digit flushes alone, and `clear()` cancels a pending burst without emitting.
  `RemoteManager` feeds it on digit keydowns (outside typing targets) and drains
  onto the existing action channel as `{key: 'DIGIT_COMMIT', value}` — a named
  action in the shared `KeyMapping` vocabulary (displayed caption included), never
  a second dispatcher.
- **Typing targets are untouched (hard law).** While an `INPUT`, `TEXTAREA`, or
  contenteditable owns focus, digit keys behave exactly as before this change —
  no buffering, no `preventDefault`, the character lands where the user is typing
  ("1984" stays typeable). Recognition is structural (element/ancestor walk;
  readonly, disabled, and non-typing input types never intercept), and the buffer
  module itself never touches `document`/`window` (grep-pinned).
- **Voice numerics land on the SAME handler.** S531's coordinate-on-arrival
  discharge: the guarded voice registration now commits the ten digit phrases
  (`DIGIT_0`–`DIGIT_9`, display-name sourced) alongside the transport seven, and
  the bridge's voice seam routes recognised digits through the very same
  `RemoteManager` entry point — spoken and pressed digits join one queue and drain
  as one commit. One buffer total (importer grep-pinned); the guarded no-op
  platform posture is unchanged. Consuming `DIGIT_COMMIT` (go-to-time, search) is
  a named follow-on, not part of this ship.
- **Zero surface change.** Client-side input routing only: ZERO new request sites,
  no new routes, no contract/server change; the vendored manifest stays
  byte-identical and `app/config.xml` is byte-identical before and after
  (blob hash proven in both mirrors).

### Added — W114 (S531): guarded VoiceControl registration (AD-23)

- **Spoken transport, only where the platform already offers it.** New module
  `src/voiceControl.ts` feature-detects the `tizen.voicecontrol` platform API and,
  while the player route is mounted, registers a small transport command list at
  foreground service level; it unregisters when the player unmounts. Absent or
  throwing `voicecontrol` — the common TV-profile case — is a silent no-op, so app
  behaviour is byte-identical without voice, and a non-Tizen (browser / jsdom) run
  never calls into the platform.
- **Reuses the existing action vocabulary and pipeline.** The default command set is
  a transport subset mapped onto ActionNames the remote already knows, with phrases
  taken from the shared display-name source (no forked label table). A recognised
  phrase is delivered through the single existing action bus rather than a second
  dispatcher. Numeric voice commands were withheld at ship time — the timed
  digit-commit buffer they must share was not present yet, so numerics coordinated
  on arrival instead of becoming a blocking dependency. (Superseded: that buffer
  landed with the next entry; the digit phrases are now committed.)
- **Manifest honesty (the mask is honored).** `app/config.xml` is UNCHANGED — no
  `voicecontrol` `<feature>` was pre-added. On profiles where the voice API only
  materialises once such a feature is declared, this module simply no-ops, and the
  feature decision is deferred to the batched, line-justified manifest change
  (a guarded no-op ship is preferred to a speculative privilege/feature add).
  Introduces ZERO new request sites, changes NO route / contract / server surface,
  and leaves the vendored manifest byte-identical.

### Added — W114 (S530): ref-counted request-dedup store (AD-15)

- **One in-flight call per logical request.** New composable
  `src/api/useRequestsStore.ts` keys concurrent requests on their arguments and
  collapses every simultaneous identical call onto a single underlying fetch whose
  result fans out to all callers. It keeps a live reference count per key, evicts
  the entry automatically once the last caller leaves (unless flagged persistent),
  coalesces repeated refresh triggers fired inside a `refreshIn(ms)` window into
  one refetch, and exposes an `isReady` initialization gate so boot code can tell
  "the first reply has not landed yet" apart from "it resolved empty". This is
  request **dedup / coalescing, not a cache** — nothing survives its last
  subscriber, and the shared UI's single-item cache is deliberately not forked.
- **Reuses the already-landed race-defense idiom (no second mechanism).** Superseded
  replies are dropped with the very same generation guard proven in the chapter and
  skip-intro overlays (`++gen` on start, publish only while the captured generation
  is still current), so the two patterns cannot drift apart. The store's suite greps
  its own source to keep an `AbortController` race or a parallel version counter from
  quietly reappearing.
- **Wired to the keyed surfaces that actually ship today.** `useMusicStore.fetchAlbum`
  and `fetchTrack` had no in-flight guard — a double ENTER fired two parallel
  identical GETs and every re-drill refetched; both now key through the store, so the
  duplicate press and the overlapping re-drill collapse to one call and a genuine
  later re-drill still re-fetches honestly. `RecommendationsScreen` built a fresh API
  client on every load and now shares one for its lifetime with its request riding the
  store, so a double-mount or a spammed Retry issues one GET. Prop-fed cards are
  untouched and no speculative consumer was invented. Adds ZERO new request sites,
  changes NO route / contract / server / shared-library surface, and leaves the vendored
  manifest and `app/config.xml` byte-identical.

### Added — W113 (S529): mDNS-less LAN server discovery (AD-24) — 2026-09-17

- **A TV can now lean on servers it already knows, without hand-typing a URL.**
  New pure module `src/discovery/lanDiscovery.ts` finds a phlix server with a
  plain `fetch` GET of the EXISTING unauthenticated health endpoint — the same
  root health path the boot probe already reaches — under a ~400 ms
  `AbortController` budget, a bounded number of parallel probes (sequenced in
  groups so peak in-flight stays capped), host de-duplication, and a per-sweep
  ceiling so a runaway candidate list can never turn into a request storm. Body
  acceptance is deliberately LOOSE (`status === 'ok'` OR a present `version`), so
  a valid server whose health payload grows new fields is still recognized — the
  same never-hard-assert-against-a-server-tuple posture as the boot probe. Every
  failure (non-OK, unrecognized body, timeout, opaque network/CORS) resolves to a
  structured verdict — a sweep of unreachable hosts is the NORMAL LAN case, never
  an exception.
- **Privilege-honest (the S503 mask is honored byte-for-byte).** Discovery lives
  ENTIRELY inside the already-granted `internet` privilege: `app/config.xml` is
  UNCHANGED and no `tizen.systeminfo` / `webapis` call appears anywhere. A blind
  full-subnet sweep is therefore NOT run automatically — from a TV webview a
  foreign host that omits a readable CORS header answers an opaque network error,
  so `internet`-alone enumeration cannot RELIABLY identify servers, and spraying
  hundreds of cross-origin requests from a living-room TV would be dishonest
  engineering. Following the "withheld + reported" precedent, the shipped close is
  a BOUNDED connect-flow suggestion list assembled from the addresses THIS TV has
  already connected to: `resolveConfig` gains pure, storage-injected
  `readAddressHistory` / `pushAddressHistory` / `buildConnectSuggestions` (bounded,
  most-recent-first, host-deduped; corrupt/absent history parses to empty rather
  than throwing), and `main.ts` records each committed Connect choice into that
  history. A bounded same-subnet candidate generator ships for an EXPLICIT,
  user-initiated scan; the Connect-screen "Scan" affordance that surfaces live
  results is the matching surfacing leg in the shared UI layer (a separate train
  slot) — named honestly, never silently dropped. Introduces ZERO new request sites
  (a plain `fetch` is neither an API-client nor a SyncPlay call and never emits a
  contiguous versioned prefix), so the route manifest stays byte-identical and no
  new server route or contracts change is required.

### Added — W113 (S526): BACK layer-stack ladder + ordered toast queue (AD-10) — 2026-09-17

- **BACK is now a four-rung ladder, not a one-liner.** On a phone BACK is one
  thing; on a TV it means the NEAREST control that can absorb the press. New pure
  module `src/remote/backPolicy.ts` decides the rung as data-in/data-out in strict
  order — **row-snap** (a horizontally-panned shelf returns to its start before the
  page leaves) → **modal-close** (the topmost closable layer, the quality flyout,
  dismisses; nothing beneath moves) → **history-back** → **exit-app** (an EXPLICIT
  `tizen.application.getCurrentApplication().exit()` at the browse root instead of a
  blind `history.back()` against an empty stack — the zombie-webview class where the
  panel sits awake having done nothing). `tizenBridge.ts` wires it with every effect
  behind injectable seams (`layers` / `exit` / `row probe+executor` / `focusMemory`),
  so each rung is unit-pinned against fakes and no test or browser session can trip a
  real platform call; the exit resolves lazily via optional chaining, so a non-Tizen
  webview is a silent no-op and the module never touches `tizen.*` at import. YELLOW
  now remembers where the viewer stood (a LIFO focus stack) and BACK returns them there.
  The same pure ladder + `createLayerFocusStack` is written to be **imported by the
  AD-9 `@phlix/ui` focus-memory leg** (AD-10 before AD-9 — the policy is authored first,
  adopted second).
- **A burst of captions now announces in order instead of clobbering.** S516 shipped a
  single toast slot; rapid transient actions overwrote each other and only the last
  survived. `useActionToastStore` generalises it into a **bounded FIFO** (cap on the
  waiting room, oldest evicted) drained by **exactly one** timer — the S510 no-stack
  rule stands in the way that matters: the renderer still shows ONE caption at a time,
  ordering simply lives in the store. Held-key repeats still refresh the one window,
  blank captions are refused, and the NEXT keypress skips forward (S516 dismissal
  preserved). Both halves are pure client-side — ZERO new request sites, the
  `routeManifest.gate` scan stays 27, and the vendored manifest is byte-identical.

### Added — W112 (S523): idle screensaver overlay (zero-privilege half) — 2026-09-17

- **The TV now rests behind a designed idle surface.** `src/screensaver.ts`
  holds the entire WHEN policy as pure functions: the jellyfin-convention
  **180 s idle window** (localStorage-overridable via `phlix.screensaver.idleMs`
  — positive-integer parse; garbage falls back to the default) engages the
  screensaver **only when playback is NOT active** and the window has fully
  elapsed. `src/components/ScreenSaverOverlay.vue` mounts as the ninth
  always-mounted root app: a 1 s tick reads the SAME `usePlayerStore().playing`
  signal the shell does — active playback counts as continuous activity, so the
  overlay never dims over a film and the post-pause window starts from the
  pause — and **any key routed through the existing RemoteManager `keydown`
  seam wakes it instantly** (arrows included; the waking key keeps its normal
  action — the overlay never preventDefaults and is never a focus target:
  `aria-hidden`, no tabindex, S512/S516 focus discipline honored). Engagement
  stamps the `screensaver-active` body class; the artwork is the house
  nocturne/amber language with a slow 42 s drift + 7 s breathing halo, so no
  pixel sits static while idle (burn-in risk class, adopted honestly).
- **Keep-awake during playback: deliberately NOT shipped (privilege-honest).**
  The as-shipped `app/config.xml` (and its `package/` mirror) grants exactly
  two privileges — `internet` and `tv.inputdevice` (the S503 prune) — while
  Samsung Tizen screen-state / keep-awake APIs require
  `http://tizen.org/privilege/display`, which the manifest does not grant and
  which no in-tree seam uses. TN-2/S503 law says privileges fold in only WITH
  their feature and are never pre-added, so **this step changes the manifest
  ZERO** and withholds the keep-awake leg instead of smuggling a speculative
  grant; a test pins the two-privilege surface, and a real playing video remains
  the one thing that always keeps the panel awake. Zero new request sites
  (`routeManifest.gate` scan unchanged at 27); fixture byte-identical.

### Added — W112 (S522): gamepad→synthetic-keyboard input bridge (dev / manual-QA) — 2026-09-17

- **A controller now drives the TV build.** `src/remote/gamepadBridge.ts` reads
  the Gamepad API each animation frame and synthesises the SAME `document`
  keydown/keyup events the Samsung remote produces, so it rides the existing
  input seam with **zero change to `KeyMapping`/`RemoteManager` and `@phlix/ui`'s
  `useSpatialNav`**: the D-pad and left stick (0.5 deadzone, dominant axis) map to
  the arrow keys with 400 ms initial / 150 ms hold auto-repeat, **A → `Enter`**
  (native selection activation) and **B → the Samsung back code `10009`** (which
  already resolves to the immediate `BACK` action). The polling logic is a pure
  `pollGamepad(getGamepads, dispatch, now, state)` over injected fakes; the
  impure `installGamepadBridge()` edge runs an injectable rAF loop, installs
  **idempotently**, wraps each frame fail-soft, and — where there is no Gamepad
  API (a real TV, and every existing test) — **installs nothing**, so a TV boot is
  byte-identical. It is a dev / QA-grade surface (a TV has no controller) and is
  **focus-safe by construction**: it calls no `focus()`/DOM mutation, only
  `document.dispatchEvent`, so the S512/S516 focus-containment discipline is
  untouched (grep-pinned). `main.ts` installs it once at boot after the remote
  bridge. **Zero new server route and zero contracts change** — it never touches
  the wire, so `routeManifest.gate`'s scan is unchanged at 27 and the vendored
  manifest is byte-identical.

### Added — W112 (S521): consent-gated telemetry heartbeat client (TV half) — 2026-09-17

- **Opt-in-only usage telemetry, off by default.** `src/telemetry.ts` adds the
  client half of anonymous usage reporting with a hard privacy gate: nothing is
  ever sent until the user explicitly consents (`getConsent` is strictly
  `=== 'true'` — unset, empty, garbage and an explicit decline all mean OFF), and
  withdrawing stops the sender and clears the local throttle stamp so a re-consent
  inherits no stale window. When consented, a single coarse hourly tick sends at
  most one bounded heartbeat per 24 h to the EXISTING served
  `POST /api/v1/telemetry/heartbeat` route. The payload is the server's bounded,
  zero-PII field set — `instance_id` (the stable install id from the existing
  `deviceId.ts` seam, so no second device identity), client type, platform and
  build version — and deliberately does NOT reuse the richer server→hub
  `HeartbeatDto`. Every failure (network reject, timeout, 5xx) is swallowed on the
  spot with no throw and no app-facing effect, and only a success advances the
  throttle stamp so the next tick retries. `TelemetryConsent.vue` mounts as the
  eighth always-on root app and shows a one-time, D-pad-operable card ONLY to a
  never-decided install that already has a server; Enable persists consent and
  arms the sender, Not-now records an explicit decline and stops it. `main.ts`
  starts the sender at boot only when consent was already granted and a base
  exists (start-when-opted-in). No new server route or contracts change (era law)
  — the vendored 410-route manifest is byte-identical; `routeManifest.gate`
  advances its per-file pin to count `src/telemetry.ts` (scan 26 → 27 request
  sites, one module).

### Added — W112 (S520): quick-connect pairing client (TV half) — 2026-09-17

- **Sign in on the TV without a keyboard.** A no-keyboard device should never
  make you type a password on a remote. `src/quickconnect/` adds the TV
  (`client`) half of quick-connect: `initiatePairing` asks the server to mint a
  short human-code, `QuickConnectPanel` shows it (no QR), `createPairingSession`
  polls `…/{code}/status` and, on approval, `redeemPairingToken` fetches the
  device's own token pair, which the flow hands back through the app's EXISTING
  `useAuthStore().setTokens` seam — no second token store is introduced. The
  companion's `approve` leg is deliberately out of scope (that is the phone's
  job, never the TV's). The panel mounts as a seventh always-on root app sharing
  the main app's pinia and self-gates: it renders and polls only when a server
  base exists but no session does, retires itself the instant a pairing lands,
  and issues zero status requests while hidden. Poll cadence prefers an explicit
  override, then the server-published interval, then a conservative default, and
  transient faults back off exponentially to a ceiling and then stop rather than
  hammer; denied/expired/abandoned resolve as calm non-fatal phases (never a
  throw). All three request sites ride EXISTING served routes — the vendored
  410-route manifest is untouched, and `routeManifest.gate` advances its per-file
  pin to count `src/quickconnect/quickConnectClient.ts` (scan 23 → 26 request
  sites, same modules). No new server route or contracts change (era law).

### Changed — W111 (cs47b): route-manifest CONTENT re-vendor (404→410 tuples) — 2026-09-16

- **cs#47 currency re-vendor (lane cs47b).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from the
  `@phlix/contracts` canonical master export (untagged regen #34 against the
  current phlix-server master tip — the quick-connect device-pairing endpoints and
  consent-gated client telemetry). NOT pure: the union rises from 404 to 410
  tuples (Application guard count 367→373; WebPortal 48 and shared 11 hold), so
  route-content bytes move alongside the provenance lines. The currency pins in
  `tests/unit/routeManifest.gate.test.ts` advance in the same commit (full server
  sha, byte-identity md5, total/length/unique-count pins, the log line's tuple
  wording, and the header's canonical-regen/contracts-tip cites), and the header's
  chain note gains the cs#47 lineage. Client-side counts HELD: this wave added
  server surface only — tizen issues no request against the new tuples, so the
  scan stays 23 request sites / 19 distinct tuples across the same modules. No new
  token home in this repo — the cs#47 token keeps its contracts code home and this
  repo's cs#46 lane constant holds. Gate files are not bundled; the widget
  `package/` rebuild check (T-02) ran with zero drift.

### Changed — W111 (S517): admin console behind a default-off build flag (T-10)

- **No admin on the TV unless you build it in.** `buildMenu()` and
  `buildExtraRoutes()` now consult a default-off flag
  (`VITE_PHLIX_TV_ADMIN === '1'`): unset, the `admin` nav entry is omitted and
  the shared admin route section is never spread into the table, so
  `/app/admin/*` has no matching route on the TV. Measured honest scope: the
  flag drops the admin-layout chunk from the widget; the admin PAGE chunks
  still link because `@phlix/ui`'s shell statically imports its admin registry
  for label lookup, so full bundle exclusion — like the merged design-system
  CSS split — is an `@phlix/ui` cross-repo follow-up, not a claim of this gate
  (the pages were already lazy and never boot-parsed). Default builds change
  behavior only by making admin unreachable; every other route and menu entry
  is byte-identical.

### Added — W111 (S516): transient "active control" action toast (AD-13)

- **The remote now echoes.** A TV has no hover, so the viewer gets a
  glanceable ~1-second caption for what just happened: each transport key
  (Play, Pause, Fast Forward, Rewind, Stop…) captions through the repo's own
  key display names, and every D-pad focus landing captions the newly focused
  control. Implemented as a single-slot Pinia store
  (`src/stores/useActionToastStore.ts`) plus one always-mounted overlay app
  (`src/components/ActionToastOverlay.vue`, mounted as the sixth root app) —
  the same replace-never-stack discipline the hub-relay notice introduced.
  Non-blocking by construction: the next remote key dismisses the current
  caption, showing one never moves D-pad focus (no tabindex, `aria-hidden`,
  never focused), and the terminal boot-failure surface stays a separate,
  single surface — the two can never double-stack.

### Added — W111 (S515): boot-reachability probe + branded CSS splash (AD-3)

- **A set-but-unreachable server no longer boots into silence.** The
  first-run Connect screen only appeared when NO server base was configured; a
  stale or dead one now gets probed before the app commits: a new pure
  `src/bootProbe.ts` wraps `@phlix/ui`'s exported `probeServer` (public
  unauthenticated `GET {base}/health`, 6 s abort, loose body rule — the server
  response shape is not hard-asserted and the server stays untouched). On a
  failed probe the app boots NON-fatally: the persisted URL and the resolved
  base are kept for a retry, and a one-shot pre-mount route intercept lands
  the viewer on the existing D-pad-operable Connect screen, whose "Connect
  anyway" keeps CORS-restricted back ends fully usable. An empty base skips
  the probe entirely — first-run behavior is byte-identical. The root
  `index.html` now inlines a CSS-only branded splash (nocturne-dark field,
  amber accent, breathing "Booting" hint) that paints before any JS and
  retires declaratively the moment Vue mounts — or when the T-09 boot-failure
  guard writes its message — so the TV never shows a white screen during the
  probe window.

### Added — W110 (S511): per-item audio/subtitle language preference memory (AD-18)

- **The track pages now remember.** Both `AudioTracksPage` and `SubtitleTracksPage`
  resolve a preferred language through a strict ladder — this title's stored choice
  first, then the account's `preferred_{audio,subtitle}_language`, then nothing — in a
  new pure `src/tracks/languageLadder.ts`. Subtitles adopt that default once when the
  viewer has no current selection and persist every pick; audio still cannot be
  switched live by the vendored player store, so it marks the remembered row while
  keeping its named "unsupported in this build" refusal honest. A new Pinia store
  (`src/stores/useTrackPreferenceStore.ts`) keeps each per-item choice in
  `localStorage` and writes the account field back through the **existing**
  `PUT /api/v1/users/me/settings` (single-field partial merge) — no new server route.
  A missing, empty, or unmatched preference leaves today's selection behaviour
  byte-identical, and a failed settings fetch degrades silently to that fallback.

### Added — W110 (S510): hub-relay visible-window retry ladder (T-14)

- **The relay no longer dies silently after five tries.** The hub-relay socket
  (`src/api/hubRelay.ts`) previously gave up with a bare `closed` once its capped
  reconnect ladder was spent — and a token whose mint was still in flight would
  stay dead until the app was relaunched. Now, on exhaustion the module stops
  background hammering entirely (no timer left armed) and waits for a single
  edge back into the foreground: the next `visibilitychange` to `visible` re-asks
  once, bounded again by the same capped ladder, so a wedged mint can never spin
  an unbounded loop. A new transient `waiting-visible` status drives a single,
  auto-dismissing, non-modal notice wired at boot, cleared the moment the socket
  recovers. Hosts with no page-visibility signal (explicit `visibilitySource:
  null`) keep the classic silent give-up byte-for-byte.

### Added — W110 (S509): global key handling — media keys + digit-key groundwork (AD-1)

- **Tizen media keys now register.** On 2020+ Samsung TVs the webview silently
  drops media-transport / channel / colour / Info keys unless the app declares
  them through `tizen.tvinputdevice`. A new pure, fakeable seam
  (`src/remote/registerKeys.ts`) registers that key set once at app-ready and
  releases exactly those keys on teardown, and `installTizenBridge` drives it so
  registration shares the bridge's install/cleanup pairing — no listener leak, no
  parallel key pipeline. `KeyMapping` gains the codes the registration makes
  reachable (`10252` → `PLAY_PAUSE`, `427`/`428` → `CHANNEL_UP`/`CHANNEL_DOWN`).
  On a non-Tizen webview (browser dev) the `tizen` global is absent and
  registration is a silent no-op, so the DOM keydown fallback stays authoritative.
- **Digit-key routing groundwork.** The digit codes (`48`–`57`) are named
  `DIGIT_0`–`DIGIT_9` and exposed via `KeyMapping.isDigit()`, giving a later
  timed-commit buffer a stable token to route on. They are deliberately left out
  of the immediate/handled sets, so typing into a search field is byte-identical.

### Changed — W105 (S500): vitest 3 → 5 test-runner migration (#83) — 2026-09-16

- **Test-runner major bump, taken over by hand.** `vitest` and
  `@vitest/coverage-v8` advance to the 5 line, superseding a Dependabot vitest-5
  PR that had sat open across the wave — the migration is done manually so the
  suite is proven green rather than the automation rubber-stamped, and the
  vitest-locked peers are realigned in the same change. The one genuine breakage
  is mock-factory constructibility: vitest 4/5 no longer treats a `vi.fn()` given
  an arrow implementation as constructible, yet `src/main.ts` and the wire-shape
  components do `new ApiClient(…)` / `new LocalStorageTokenStore(…)` against
  exactly those stubs — so the two mock factories in `tests/unit/main.test.ts`
  and `tests/unit/RouteWireShape.test.ts` are re-authored as `function()` impls
  that stay newable. Zero behavior change; the suite passes identically across
  the bump.

### Changed — W105 (S501 PR1): reproducible installs & truthful widget artifact (#84) — 2026-09-16

- **T-01 lockfile tracked and commit-pinned.** `package-lock.json` is committed
  and dropped from `.gitignore` — it is dependency-resolution metadata, not a
  build artifact, so the "no committed artifacts" policy does not reach it. The
  lock pins the three `github:detain/*` git-deps to the exact commits of their
  release tags, so `npm ci` reproduces a clean-clone install and a tag retag can
  no longer silently shift a build; the `resolved` URLs are rewritten from
  `git+ssh` to `git+https` for CI portability (public repos; runners hold no SSH
  key). Build/Lint/Test workflows switch from `npm install` to
  `npm ci --allow-git=all` with the setup-node cache enabled.
- **T-02 `package/` freshness gate.** The committed `package/` is rebuilt from
  current source (closing a 116-file drift so what ships equals what was
  audited), and Build CI runs `npm run package` then asserts
  `git status --porcelain package/` is empty — the build is byte-deterministic
  across clean rebuilds, so the gate is stable.
- **T-03 real app icon.** `app/icon.png` (128×128) added via a deterministic,
  canvas-less generator (`scripts/make-icon.js`); `config.xml` already declared
  an `<icon src="icon.png"/>` that had resolved to nothing. `package.js` copies
  it into `package/` and its sanity check now requires it.
- **T-12 dead env file removed.** `tizen.env` deleted — zero references, no
  `--mode tizen` script, and its keys lacked the `VITE_` prefix the code reads.

### Fixed — W105 (S501 PR2): runtime — dead overlays removed, polling bounded, races/boot guarded (#87) — 2026-09-16

- **T-04 / T-06 dead duplicate overlays deleted.** `UpNextOverlay.vue` and
  `SleepTimerOverlay.vue` were mounted as root apps but could never render — the
  former's `counting` prop stayed false forever, the latter's
  `defineExpose({show,toggle})` had zero callers — while `@phlix/ui`'s PlayerPage
  already ships a working UpNext and sleep timer. Both components are removed with
  their mounts, `index.html` divs, and the orphaned tests and route-coverage
  entries; this also ends their 250 ms player-position polls running for the whole
  app lifetime on a TV that never unmounts them.
- **T-05 poll bounded to the player route.** In the two long-lived overlays that
  remain (`ChapterOverlay`, `SkipIntroOverlay`) the position poll now starts only
  while a player route is active and stops the instant it clears; the
  never-firing `onUnmounted` cleanup becomes `onBeforeUnmount` and the poll
  starter is idempotent.
- **T-07 stale-response guards.** `loadChapters` / `loadMarkers` gain per-endpoint
  generation counters, so a slow reply for the previous title can no longer clobber
  the current title's chapters/markers; the loading/error writes are guarded too.
- **T-09 boot white-screen guard.** `probeStorage()` reads `localStorage` inside a
  try/catch and falls back to an in-memory `StorageLike` (privacy-mode webviews
  throw on the getter), and the top-level `boot()` now catches to render a boot
  failure instead of a blank screen; a redundant `await Promise.resolve()` no-op is
  gone.
- **T-15 unknown-frame accounting.** `@phlix/syncplay`'s `onUnknownFrame` hook
  (supported since v0.1.5) is wired — unknown/future frame types are counted and
  warned once rather than dropped silently.

### Added — W105 (S501 test leg): rating/polyfill coverage + enforced coverage floor (#88) — 2026-09-16

- **T-11 inverted coverage corrected.** `polyfills.test.ts` now exercises the real
  `@/polyfills` module (it had re-implemented the fallback inline and left the
  module at zero), and three new suites — `RatingBadge`, `RatingModal`,
  `UserRatingPicker` — cover the reachable rating components that carried no
  coverage while the just-deleted dead overlays had held the best numbers.
- **T-13 coverage floor pinned and enforced.** `vitest.config.ts` gains
  `coverage.thresholds` set just below the measured post-T-11 floor with a
  ratchet-up policy noted in the config, and the Test job switches to
  `npx vitest run --coverage` so the floor is enforced on every PR. Additions
  only — no test weakened; the suite stands at 335 tests across 25 files.

### Fixed — W109 (S502): parental-schedule EDIT issues PUT, not a duplicate POST — 2026-09-16

- **T-08 duplicate-row defect.** The schedule edit path POSTed to the create
  collection (`/api/v1/profiles/{pid}/schedules`) with an `id` in the body —
  but `createForProfile` always INSERTs via `createSchedule` and never reads an
  id, so every "edit" silently created another row. The edit path now issues
  `PUT /api/v1/profiles/{pid}/schedules/{scheduleId}` (the server's existing
  `updateSchedule`: AuthMiddleware-gated, ownership-404) with the snake_case
  body that handler reads — camelCase there is a 400 "No valid fields to
  update". Zero server change; create stays POST.
- **T-16 verb-blind mock fixed.** `ParentalControlsWireShape.test.ts` now
  records the HTTP VERB on every call (the old capture kept only url+body —
  precisely why the wrong-verb edit sailed through), plus a create-stays-POST
  case, an edit→PUT verb+URL+body tuple pin, and a tripwire that reddens if the
  edit ever regresses to POST. Suite stands at 338 tests across 25 files.

### Changed — W109 (S503): config.xml privilege/feature hygiene bundle (AD-5 + T-20) — 2026-09-16

- **Manifest over-claims pruned to what the code uses.** `app/config.xml` drops
  the five privileges with zero backing `tizen.*`/`webapis` usage anywhere in
  the repo (`tv.window`, `tv.audio`, `network.get`, `application.launch`,
  `filesystem.read`) and keeps the two the widget actually needs
  (`internet`; `tv.inputdevice`, retained on the AD-1 expectation).
- **Adopted features added.** `<tizen:profile name="tv-samsung"/>` (the TV
  profile this app already builds for — `deviceType: 'samsung-tizen'`) and
  `hwkey-event="enable"` on `<tizen:setting>`, which is what delivers the
  hardware BACK key as a key event to the `KeyMapping`/`RemoteManager` bridge
  that already maps key code 10009 to BACK. One PR, net diff justified
  line-by-line; no future privileges pre-added — those arrive with their
  features.
- Docs re-derived from the manifest (CLAUDE.md/README privilege lists). The
  change flows into `package/config.xml` via `scripts/package.js` (T-02).
- **Fix-lane marker (W109 review):** `app/config.xml` now carries an S503 XML comment
  at the privilege/feature change site recording the T-20 posture — surface masked to
  runtime need, five unused privileges pruned after zero-use grep, `hwkey-event` and
  the `tv-samsung` profile added. Comment-only; `package/config.xml` (T-02) mirrors
  the manifest byte-identically in the same commit.

### Changed — W93 (cs46a): route-manifest PROVENANCE re-vendor (404 tuples — route bytes unmoved) — 2026-09-15

- **cs#46 currency re-vendor (lane cs46a).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from the
  `@phlix/contracts` canonical master export (untagged regen #33), and the
  currency pins in `tests/unit/routeManifest.gate.test.ts` advance to the current
  phlix-server master tip in the same commit (server sha, the byte-identity md5,
  and the header's canonical-regen/contracts-tip cites). The diff against the
  previous vendored bytes is provenance-only: no route-registration change
  upstream, so the `[method, path]` tuples are byte-for-byte identical and the
  count holds at 404 — only the embedded provenance moves, which is enough to
  rotate the md5 and the vendored blob while the described route surface is
  unchanged. The size/total/unique-count pins and the per-file coverage counts
  are HELD (23 request sites / 19 distinct tuples re-measured green; no client
  request site moved this wave). The header's vendoring rationale gains the
  cs#46 chain note; the `#v0.4.7` tag-embed measurement stands (the tag never
  moved — only the untagged canonical advanced). This leg additionally plants the
  lane ritual token as an exported string constant beside the pins (cs#46
  ceremony; no behavior change). `package-lock.json` is gitignored here; the
  change is the fixture + the gate test only.

### Changed — W85 (cs45): route-manifest PROVENANCE re-pin (404 tuples — route bytes unmoved) — 2026-09-13

- **cs#45 currency cascade (lane cs45).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from the
  `@phlix/contracts` canonical master export (untagged regen #32), and the
  currency pins in `tests/unit/routeManifest.gate.test.ts` advance to the current
  phlix-server master tip in the same commit (server sha, the byte-identity md5,
  and the header's contracts-tip cite). The server span since the previous pin is
  bundle-only: no route-registration file and nothing under `include/` or `src/`
  moved, so the `[method, path]` tuples are byte-for-byte identical and the count
  holds at 404; only the embedded provenance moves, which is enough to rotate the
  md5 and the vendored blob while the described route surface is unchanged. The
  404 size/total/unique-count pins and the per-file coverage counts are HELD
  (this wave adds/removes no client request site). The header's vendoring
  rationale is corrected again to the `#v0.4.7` tag the manifest is now pinned to
  and that tag's measured embed shas, verified by peeling the tag at this leg
  (comment-only, zero behavior). The post-S240 `useMusicStore` migration and its
  pin are untouched. No survival-token home in this repo — the wave token lives
  in its two verified code homes. `package-lock.json` is gitignored here; the
  change is the fixture + the gate test only.

### Changed — W83 (cs44): route-manifest PROVENANCE re-pin (404 tuples — route bytes unmoved) — 2026-09-13

- **cs#44 currency cascade (lane cs44).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from the
  `@phlix/contracts` canonical master export, and the currency pins in
  `tests/unit/routeManifest.gate.test.ts` advance to the current phlix-server
  master tip in the same commit (server sha, the byte-identity md5, and the
  header's contracts-tip cite). The server span since the previous pin is
  bundle-only: no route-registration file and nothing under `include/` or `src/`
  moved, so the `[method, path]` tuples are byte-for-byte identical and the count
  holds at 404; only the embedded provenance moves, which is enough to rotate the
  md5 and the vendored blob while the described route surface is unchanged. The
  404 size/total/unique-count pins and the per-file coverage counts are HELD
  (this wave adds/removes no client request site). The header's stale "pins at
  #v0.4.5" vendoring rationale is corrected to the `#v0.4.6` tag the manifest is
  actually pinned to and that tag's measured embed shas (comment-only, zero
  behavior). The post-S240 `useMusicStore` migration and its pin are untouched.
  No survival-token home in this repo — the wave token lives in its two verified
  code homes. `package-lock.json` is gitignored here; the change is the fixture +
  the gate test only.

### Changed — W82 (s240tizen): `@phlix/ui` pin-bump v0.99.1 → v0.99.2 — music album-detail migrated to the S240 query-param rail

- **S240 client leg (lane s240tizen).** `package.json` moves its `@phlix/ui`
  pin to `#v0.99.2`, whose `ApiClient.getAlbum` now builds the album-detail
  request as `GET /api/v1/music/album?name=…&artist=…` (query-param rail)
  instead of the legacy `/music/albums/{mbid}` path form, and inlines `artist`
  through `encodeURIComponent` (so the separator is `%20`, not the `+` the old
  `URLSearchParams` path produced). The list rails are unchanged — `listArtists`
  / `listAlbums` still pass a params object, so their `?artist=Artist+7`
  expectations keep the `+`. `useMusicStore` delegates the whole request to the
  ui helper, so the tizen diff is the flipped exact-match expectation in
  `tests/unit/useMusicStore.test.ts` plus docblock prose in
  `src/stores/useMusicStore.ts`; the server still serves the legacy path
  (additive law) and no hand-built music URL exists in `src/`. `package-lock.json`
  is gitignored in this repo and CI installs with `npm install`, so the refreshed
  resolution (`#a7530e8b…`) lives on the working tree and is re-derived by CI from
  the pin — the pin line itself is the committed deliverable. The vendored
   route-manifest gate and fixture are byte-unchanged (self-contained against the
   prior-era regen; S240's two additive rails were already folded in by the W81
  cs#43 content regen). No tag, no version bump, no contracts/syncplay pin move.

### Changed — W81 (cs43): route-manifest CONTENT regen (402 → 404 tuples — S240 adds music query rails) — 2026-09-12

- **cs#43 currency cascade (lane cs43).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #30). Unlike the pure re-pin waves
  this is a CONTENT regen: S240 added two additive music query-param GET rails
  (`GET /api/v1/music/artist?name=` and `GET /api/v1/music/album?name=`), so the
  union rises from 402 to 404 tuples and the Application router's guard-constant
  count rises by the two new rails. The `routeManifest.gate.test.ts` serverSha,
  provenance.total, routes length, unique-tuple size and the vendored-file md5
  advance in the same commit. This leg is PURE CURRENCY — `@phlix/ui` stays pinned
  at `#v0.99.1` and the tizen music builder is NOT migrated: it still issues the
  legacy `/music/artists/{mbid}` / `/music/albums/{mbid}` paths, which S240 keeps
  serving (additive law), so every per-file coverage count and request site stays
  tuple-exact against the widened 404-route set. The tizen builder migration
  rides the future `@phlix/ui#v0.99.2` pin-bump wave (tag authority is
  coordinator-only). Suite 21 files / 317 tests pass; test- and fixture-only
  change, `dist/` untouched. No survival-token home in this repo.

### Changed — W79 (cs42): PURE route-manifest provenance re-pin (402 tuples unchanged) — 2026-09-12

- **cs#42 currency re-pin cascade (lane cs42).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #29 against the current
  phlix-server master tip; purity re-proven before regenerating — the
  server span since the previous pin is four commits of SyncPlay
  bridge/worker/room and WebSocket plumbing work, a catalog-pin bump and an
  AGENTS.md theming paragraph, with an empty diff on the two route-bearing
  guard-constant files, so the stripped route-content digest measures equal
  old-vs-new and only provenance bytes move). 402
  `[method, path]` tuples unchanged; the full-file byte-freeze md5 advances
  while the route content is invariant. Gate pins (provenance sha,
  byte-freeze md5, docblock cites) advance in the same commit; client-scan
  counts untouched. Untagged wave: the `#v0.4.6` dependency pin stays put.

### Changed — W75 (cs41): PURE route-manifest provenance re-pin (402 tuples unchanged) — 2026-09-12

- **cs#41 currency re-pin cascade (lane cs41).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #28 against the current
  phlix-server master tip; purity re-proven before regenerating — the
  server span since the previous pin is one merge confined to the
  parallel-suite junit-merge tooling, two new guard tests and
  changelog/release-journal prose, with an empty diff under the
  route-surface directories, so the stripped route-content digest
  measures equal old-vs-new and only provenance bytes move). 402
  `[method, path]` tuples unchanged; the full-file byte-freeze md5 advances
  while the route content is invariant. Gate pins (provenance sha,
  byte-freeze md5, docblock cites) advance in the same commit; client-scan
  counts untouched. Untagged wave: the `#v0.4.6` dependency pin stays put.

### Changed — W72 (cs40): PURE route-manifest provenance re-pin (402 tuples unchanged) — 2026-09-12

- **cs#40 currency re-pin cascade (lane cs40).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #27 against the current
  phlix-server master tip; purity re-proven before regenerating — the
  server span since the previous pin is three merges confined to
  parallel-harness suite-runner plumbing, an ignore-rule tidy and
  changelog/release-journal prose, with an empty diff under the
  route-surface directories, so the stripped route-content digest
  measures equal old-vs-new and only provenance bytes move). 402
  `[method, path]` tuples unchanged; the full-file byte-freeze md5 advances
  while the route content is invariant. Gate pins (provenance sha,
  byte-freeze md5, docblock cites) advance in the same commit; client-scan
  counts untouched. Untagged wave: the `#v0.4.6` dependency pin stays put.

### Changed — W70 (cs39): PURE route-manifest provenance re-pin (402 tuples unchanged) — 2026-09-11

- **cs#39 currency re-pin cascade (lane cs39).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #26 against the current
  phlix-server master tip; purity re-proven before regenerating — the
  server span since the previous pin is one packaging-and-installation
  merge confined to the install script, release-process and changelog
  journals, and one third-party clone pin-guard test, with an empty diff
  under the route-surface directories, so the stripped route-content digest
  measures equal old-vs-new and only provenance bytes move). 402
  `[method, path]` tuples unchanged; the full-file byte-freeze md5 advances
  while the route content is invariant. Gate pins (provenance sha,
  byte-freeze md5, docblock cites) advance in the same commit; client-scan
  counts untouched. Untagged wave: the `#v0.4.6` dependency pin stays put.

### Changed — W67 (cs38): PURE route-manifest provenance re-pin (402 tuples unchanged) — 2026-09-11

- **cs#38 currency re-pin cascade (lane cs38).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #25 against the current
  phlix-server master tip; purity re-proven before regenerating — the
  server span since the previous pin is two commits confined to CI
  workflow definitions, docker example files, helm chart value files,
  support test files and changelog prose, with an empty diff under the
  route-surface directories, so the stripped route-content digest measures
  equal old-vs-new and only provenance bytes move). 402
  `[method, path]` tuples unchanged; the full-file byte-freeze md5 advances
  while the route content is invariant. Gate pins (provenance sha,
  byte-freeze md5, docblock cites) advance in the same commit; client-scan
  counts untouched. Untagged wave: the `#v0.4.6` dependency pin stays put.

### Changed — W63 (cs37): PURE route-manifest provenance re-pin (402 tuples unchanged) — 2026-09-11

- **cs#37 currency re-pin cascade (lane cs37).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #24 against the current
  phlix-server master tip; purity re-proven before regenerating — the
  server route-relevant span is test-only, so the stripped route-content
  digest measures equal old-vs-new and only provenance bytes move). 402
  `[method, path]` tuples unchanged; the full-file byte-freeze md5 advances
  while the route content is invariant. Gate pins (provenance sha,
  byte-freeze md5, docblock cites) advance in the same commit; client-scan
  counts untouched. Untagged wave: the `#v0.4.6` dependency pin stays put.

### Changed — W61 (cs36): PURE route-manifest provenance re-pin (402 tuples unchanged) — 2026-09-11

- **cs#36 currency re-pin cascade (lane cs36).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #23 against the current
  phlix-server master tip; purity re-proven before regenerating — the
  server route-relevant span is test-only, so the stripped route-content
  digest measures equal old-vs-new and only provenance bytes move). 402
  `[method, path]` tuples unchanged; the full-file byte-freeze md5 advances
  while the route content is invariant. Gate pins (provenance sha,
  byte-freeze md5, docblock cites) advance in the same commit; client-scan
  counts untouched. Untagged wave: the `#v0.4.6` dependency pin stays put.

### Changed — W59 (cs35): route-manifest full regen (401 → 402 tuples) — 2026-09-11

- **cs#35 currency re-pin cascade (lane cs35).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen against the current phlix-server
  master tip). This is a genuine full regen, not a provenance-only re-pin: the
  server gained one WebPortal route, so the manifest moves from 401 to 402
  `[method, path]` tuples (Application source count holds; WebPortal source
  count rises by one; shared overlap unchanged). The gate's provenance sha,
  byte-freeze md5, total/length/uniqueness tuple counts, and docblock cites all
  advance in the same commit. The new route is server-side only, so no Tizen
  request site calls it — the manifest simply becomes a superset and the
  client-scan counts (sites/tuples the gate derives from this repo's own code)
  stay exactly as pinned. Untagged wave: the `#v0.4.6` dependency pin stays put.

### Prior era snapshot — W58 (cs34): PURE provenance re-pin (401 tuples)

### Changed — W58 (cs34): PURE route-manifest provenance re-pin (401 tuples unchanged) — 2026-09-10

- **cs#34 currency re-pin cascade (lane cs34).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #21 against the current
  phlix-server master tip; purity re-proven before regenerating — server
  route-relevant span empty, generator-input guard blobs identical, fence
  digest held). 401 `[method, path]` tuples unchanged; only provenance bytes
  move, so the full-file byte-freeze md5 advances while the stripped
  route-content md5 measures equal old-vs-new. Gate pins (provenance sha,
  byte-freeze md5, docblock cites) advance in the same commit; counts
  untouched. Untagged wave: the `#v0.4.6` dependency pin stays put.

### Changed — W57 (cs33): PURE route-manifest provenance re-pin (401 tuples unchanged) — 2026-09-10

- **cs#33 currency re-pin cascade (lane cs33).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #20 against the current
  phlix-server master tip; purity re-proven before regenerating — server
  route-relevant span empty, generator-input guard blobs identical, fence
  digest held). 401 `[method, path]` tuples unchanged; only provenance bytes
  move, so the full-file byte-freeze md5 advances while the stripped
  route-content md5 measures equal old-vs-new. Gate pins (provenance sha,
  byte-freeze md5, docblock cites) advance in the same commit; counts
  untouched. Untagged wave: the `#v0.4.6` dependency pin stays put.

### Changed — W55 (cs32): PURE route-manifest provenance re-pin (401 tuples unchanged) — 2026-09-10

- **cs#32 currency re-pin cascade (lane cs32).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #19 against the current
  phlix-server master tip; purity re-proven before regenerating — server
  route-relevant span empty, generator-input guard blobs identical). 401
  `[method, path]` tuples unchanged; only provenance bytes move, so the
  full-file byte-freeze md5 advances while the stripped route-content md5
  measures equal old-vs-new. Gate pins (provenance sha, byte-freeze md5,
  docblock cites) advance in the same commit; counts untouched. Untagged wave:
  the `#v0.4.6` dependency pin stays put.

### Changed — W53 (cs31): PURE route-manifest provenance re-pin (401 tuples unchanged) — 2026-09-10

- **cs#31 currency re-pin cascade (lane cs31).** Vendored
  `tests/fixtures/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #18 against the current
  phlix-server master tip; purity re-proven before regenerating — server
  route-relevant span empty, generator-input guard blobs identical). 401
  `[method, path]` tuples unchanged; only provenance bytes move, so the
  full-file byte-freeze md5 advances while the stripped route-content md5
  measures equal old-vs-new. Gate pins (provenance sha, byte-freeze md5,
  docblock cites) advance in the same commit; counts untouched. Untagged wave:
  the `#v0.4.6` dependency pin stays put.

### Changed — W52 (S353): tizen SyncPlay re-pin to contracts v0.4.6 / ui v0.99.1 + migration pin — 2026-09-10

- **S353 re-pin.** The 2026-08-24 step block named `@phlix/contracts` v0.4.3 +
  `@phlix/ui` v0.99.0; the estate moved past that. Re-derived the live tags from
  the remotes (`git ls-remote --tags`): contracts latest `v0.4.6` (annotated peel
  `97bcda06`), ui latest `v0.99.1`, `@phlix/syncplay` `v0.1.4` — exactly the pins
  master already carries at `472ff6bf` (`#v0.4.6` / `#v0.99.1` / `#v0.1.4`); code
  wins over the block's dated prose. The staged re-pin branch `tagtizen-repin-v0990`
  is an obsolete stray (unmigrated `useSyncPlayStore`, cannot typecheck at any
  v0.4.x); the re-pin itself already landed via the S404/S415 waves, so this lane
  branched off current master and PINS the migration rather than re-applying it.
- **`src/stores/useSyncPlayStore.ts` is already migrated** to the Group vocabulary
  (`SyncPlayGroup` / `SyncPlayGroupListItem`, snake_case `current_media_id`, dict
  `members`, REST only under `/api/v1/syncplay/groups`, playback over the
  `@phlix/syncplay` WebSocket — v0.99.0 removed the REST `sendCommand`; the join
  envelope answers both the room and the session from one request). No production
  change in this PR.
- **New `tests/unit/syncPlayMigration.test.ts`** (5 tests, `54b209ff`/`aa23b07d`)
  pins the mapping against the REAL runtime contracts export: the store's room-view
  key-set equals `SYNC_PLAY_GROUP_KEYS`; the room(wire, snake_case) vs
  session(local, camelCase) vocabulary split with a single-request join; and a full
  create→join→send route census forbidding `/rooms` and any REST `/command` path.
  The lane's code-resident migration token embedded as a string literal. Existing
  SyncPlay suites untouched (syncPlayWireShape 22 / useSyncPlayStore 61 /
  syncplayDispatch 15 / hubRelay 89); suite 312 → 317, typecheck clean. `npm ci`
  remains broken pre-existing — deps installed with `npm install`, no lockfile.

### Changed — W50 (cs30 era-2): route-manifest provenance re-pin — PURE, 401 tuples unchanged — 2026-09-09

- Server moved mid-wave (`32183f5b` → `5986b61d`, S210 #749 — docker boot-gate bounds only,
  route-zero re-proven: Router/Application/guard blobs and Routes/+FastPath/ trees byte-identical).
  Vendored `server-route-manifest.json` re-vendored byte-identical from `@phlix/contracts` master
  `57a8528a` (era-2 regen; full-file md5 `cb53d53f` → `045c0984`, blob identity `dd0cbaca` verified
  against the contracts dist artifact; stripped route-content md5 `508a…` holds — 401 tuples).
  Gate pins advance in the same commit; counts unchanged.

### Changed — W49 (cs30): route-manifest provenance re-pin — PURE, 401 tuples unchanged — 2026-09-09

- **cs#30 currency re-pin.** `tests/fixtures/server-route-manifest.json` re-vendored byte-for-byte from `@phlix/contracts` master `767146a8` (server provenance `32183f5b`; span `e15d9543`→`32183f5b` re-proven route-zero at the contracts leg — S266 #747 + S171 #748). Pure re-pin: the 401 route tuples and route bytes are unmoved — the stripped route-content md5 measures equal old-vs-new (`508a6415…`), only provenance (serverSha + full-file md5) moves. `tests/unit/routeManifest.gate.test.ts` serverSha/md5 pins and docblock regen cites re-pinned to match; all three route-count pins stay 401. Deviation recorded: `npm ci` is broken here pre-existing (package.json demands `#v0.4.6`, the uncommitted lockfile resolves `#v0.3.12`, and `package-lock.json` is gitignored) — deps installed with `npm install` in the sandbox; the installed `@phlix/contracts` resolves the `#v0.4.6` peel `97bcda06`, verified; no lockfile committed.

### Changed — W48 (cs29): route-manifest provenance re-pin — PURE, 401 tuples unchanged — 2026-09-09

- **cs#29 currency re-pin.** `tests/fixtures/server-route-manifest.json` re-vendored byte-for-byte from `@phlix/contracts` master `8697c099` (server provenance `e15d9543`; span `a5cde27e`→`e15d9543` re-proven route-zero at the contracts leg — S211 #745 + S114 #746). Pure re-pin: the 401 route tuples and route bytes are unmoved — the stripped route-content md5 measures equal old-vs-new (`508a6415…`), only provenance (serverSha + full-file md5) moves. `tests/unit/routeManifest.gate.test.ts` serverSha/md5 pins re-pinned to match; all three route-count pins stay 401. Deviation recorded: `npm ci` is broken here pre-existing (package.json demands `#v0.4.6`, the uncommitted lockfile resolves `#v0.3.12`, and `package-lock.json` is gitignored) — deps installed with `npm install` in the sandbox; the installed `@phlix/contracts` resolves the `#v0.4.6` peel `97bcda06`, verified; no lockfile committed.

### Changed — W47 (cs28): route-manifest provenance re-pin — PURE, 401 tuples unchanged — 2026-09-09

- **cs#28 currency re-pin.** `tests/fixtures/server-route-manifest.json` re-vendored byte-for-byte from `@phlix/contracts` master `a1ca39d8` (server provenance `a5cde27e`). Pure re-pin: the 401 route tuples and route bytes are unmoved — the stripped route-content md5 measures equal old-vs-new (`508a6415…`), only provenance (serverSha + full-file md5) moves. `tests/unit/routeManifest.gate.test.ts` serverSha/md5 pins re-pinned to match; all three route-count pins stay 401.

### Changed — W46 (cs27): route-manifest provenance re-pin — PURE, 401 tuples unchanged — 2026-09-09

- **cs#27 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `28000fa4` (regen against
  server master `afe54c7c`; previous provenance `97c87f27`/`1e14b539` — the
  cs#26 leg). Seven server merges since `1e14b539`, all route-zero: the tuple
  set is byte-identical (stripped route-set md5 `508a6415` old = new, 401 both
  sides) — only provenance moves. Gate pins in
  `tests/unit/routeManifest.gate.test.ts`: serverSha `1e14b539` → `afe54c7c`,
  vendored full-file md5 `e3647899` → `5c06306c`; docblock regen cite moves to
  server `afe54c7c` / contracts `28000fa4`. The three route-count pins stay 401;
  the `#v0.4.6` install pin stays (untagged wave). `npm ci` still fails at this
  tip's committed lock desync (pre-existing `0.3.12` pins vs `#v0.4.6` spec);
  `npm install` re-resolves cleanly — lockfile is gitignored here, so the
  re-vendor carries no lock delta; the installed `@phlix/contracts` moves
  `0.3.12` → `0.4.6` per the tag. Suite 312/20 exact.

### Changed — W43 (cs26): route-manifest re-pin — REAL route add, non-pure, 401 tuples — 2026-09-08

- **cs#26 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `97c87f27` (regen against
  server master `1e14b539`; previous provenance `e837e31c`/`2746677e` — the
  cs#25 leg). Unlike cs#23–25 this leg is NON-PURE: the tuple set moves
  400 → 401 — exactly one REAL route added, `POST /api/v1/admin/updates/check`
  (S273), nothing removed. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: serverSha `2746677e` → `1e14b539`,
  vendored md5 `4f4dc687` → `e3647899`, the three route-count pins move to 401,
  and the docblock regen cite moves to server `1e14b539` / contracts `97c87f27`.
  The added admin route is never called from this client, so the 23-site/19-tuple
  per-file coverage pins and the gate id stay; the `#v0.4.6` install pin stays
  (untagged wave, no grants). Suite 312/20 exact.

### Changed — W41 (cs25): route-manifest provenance re-pin (no route change) — 2026-09-08

- **cs#25 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `e837e31c` (regen against
  server master `2746677e`; previous provenance `59fd9b02`/`df6aa8e5` — the
  cs#24 leg, zero route hunks). All 400 tuples byte-identical — only
  provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: serverSha `df6aa8e5` → `2746677e`,
  vendored md5 `b6acafdf` → `4f4dc687`, and the docblock regen cite moves to
  server `2746677e` / contracts `e837e31c`. The three 400-count pins and the
  gate id stay; the `#v0.4.6` install pin stays (untagged wave, no grants).
  Suite 312/20 exact.

### Changed — W40 (cs24): route-manifest provenance re-pin (no route change) — 2026-09-07

- **cs#24 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `59fd9b02` (regen against
  server master `df6aa8e5`; previous provenance `bcd27df`/`bab33ff2` — the
  cs#23 leg, zero route hunks). All 400 tuples byte-identical — only
  provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: serverSha `bab33ff2` → `df6aa8e5`,
  vendored md5 `e8b23b9b` → `b6acafdf`, and the docblock regen cite moves to
  server `df6aa8e5` / contracts `59fd9b02`. The three 400-count pins and the
  gate id stay; the `#v0.4.6` install pin stays (untagged wave, no grants).
  Suite 312/20 exact.

### Changed — W37 (cs23): route-manifest provenance re-pin (no route change) — 2026-09-06

- **cs#23 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `bcd27df` (regen against
  server master `bab33ff2`; previous provenance `876d0ea`/`e4853f0f` — the
  cs#22 leg, zero route hunks). All 400 tuples byte-identical — only
  provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: serverSha `e4853f0f` → `bab33ff2`,
  vendored md5 `791235d4` → `e8b23b9b`, and the docblock regen cite moves to
  server `bab33ff2` / contracts `bcd27df`. The three 400-count pins and the
  gate id stay; the `#v0.4.6` install pin stays (untagged wave, no grants).
  Suite 312/20 exact.

### Changed — W37 (cs22): route-manifest provenance re-pin (no route change) — 2026-09-06

- **cs#22 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `876d0ea` (regen against
  server master `e4853f0f`; previous provenance `341fc6e2`/`e729d48a` — the
  cs#21 leg, zero route hunks). All 400 tuples byte-identical — only
  provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: serverSha `e729d48a` → `e4853f0f`,
  vendored md5 `7accd31d` → `791235d4`, and the docblock regen cite moves to
  server `e4853f0f` / contracts `876d0ea`. The three 400-count pins and the
  gate id stay; the `#v0.4.6` install pin stays (untagged wave, no grants).
  Suite 312/20 exact.

### Changed — W37 (cs21): route-manifest provenance re-pin (no route change) — 2026-09-06

- **cs#21 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `341fc6e2` (regen against
  server master `e729d48a`; previous provenance `f2e284b3`/`f35a5742` — the
  cs#20 re-tag leg, zero route hunks). All 400 tuples byte-identical — only
  provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: serverSha `f35a5742` → `e729d48a`,
  vendored md5 `05db9e75` → `7accd31d`, and the docblock regen cite moves to
  server `e729d48a` / contracts `341fc6e2`. The three 400-count pins and the
  gate id stay; the `#v0.4.6` install pin stays (untagged wave, no grants).
  Suite 312/20 exact.

### Changed — W34 (cs20retag): ui re-tag to v0.99.1 + route-manifest provenance re-pin — 2026-09-05

- **Combined re-tag + cs#20 currency, two facts, one PR.** (1) `package.json`
  re-tags `@phlix/ui` `github:detain/phlix-ui#v0.99.0` → `#v0.99.1` (the
  released v0.99.1 tree; this repo commits no package-lock, as ever). (2)
  `tests/fixtures/server-route-manifest.json` re-vendored verbatim from
  `@phlix/contracts` master `f2e284b3` (regen against server master
  `f35a5742`; previous provenance `2250def2`/`3a253991` — the web-ui ui-tarball
  re-pin, zero route hunks). All 400 tuples byte-identical — only provenance
  moves. The gate pins follow in `tests/unit/routeManifest.gate.test.ts`:
  serverSha `3a253991` → `f35a5742`, vendored md5 `5bc7dd6d` → `05db9e75`, and
  the docblock regen cites move to server `f35a5742` / contracts `f2e284b3`.
  The three 400-count pins and the gate id stay; the contracts install pin
  stays (no grants). Fresh `npm install`; suite 312/20 exact.


### Changed — W33 (cs19): route-manifest provenance re-pin (no route change) — 2026-09-05

- **cs#19 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `2250def2` (regen
  against server master `3a253991`; previous provenance `e74cdc88` — S431
  executable census, one commit, no route hunks). All 400 tuples byte-identical
  — only provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: vendored md5 `9f69628d` →
  `5bc7dd6d`, serverSha `e74cdc88` → `3a253991`, and the contracts regen cite
  `51ed6cd3` → `2250def2`. No issued-URL or coverage pin moved; the `#v0.4.6`
  install pin stays (untagged wave, no grants).

### Changed — W31 (cs18): route-manifest provenance re-pin (no route change) — 2026-09-05

- **cs#18 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `51ed6cd3` (regen
  against server master `e74cdc88`; previous provenance `4b620f59`). All 400
  tuples byte-identical — only provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: vendored md5 `81eeef82` →
  `9f69628d`, serverSha `4b620f59` → `e74cdc88`, and the contracts regen cite
  `55311c6` → `51ed6cd3`. No issued-URL or coverage pin moved; the `#v0.4.6`
  install pin stays (un-tagged wave).

### Changed — W29 (cs17): route-manifest provenance re-pin (no route change) — 2026-09-04

- **cs#17 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `55311c68` (regen
  against server master `4b620f59`; previous provenance `888a42b2`). All 400
  tuples byte-identical — only provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: vendored md5 `9727f2d3` →
  `81eeef82`, serverSha `888a42b2` → `4b620f59`, and the contracts regen cite
  `c7125362` → `55311c68`. No issued-URL or coverage pin moved.

### Added — client route gate (S280)

- **Vendored the canonical `@phlix/contracts` server route manifest** at
  `tests/fixtures/server-route-manifest.json` — 400 route tuples with the
  provenance server sha pinned inside the artifact, byte-identical to the
  mobile/roku copies (md5 `cca4660dda7876fba840f9d108ad7c18`). Vendoring is the
  sanctioned interim pattern until the next contracts tag ships the export: the
  v0.4.4 tag predates it and its exports map blocks JSON subpaths, so no
  npm-pin/import is possible yet.
- **New vitest gate `tests/unit/routeManifest.gate.test.ts`** — every
  server-addressed request URL in `src/` must be tuple-exact against the
  manifest: 23 request sites / 19 distinct `(method, path)` tuples across 9
  modules, pinned per-file. The hub-addressed `src/api/hubRelay.ts` is excluded
  and its exclusion is negative-pinned; a scanner-blindness sweep pins every
  `/api/v1` code occurrence 1:1. A planted unserved URL was demonstrated RED
  before removal.
- **New `tests/unit/RouteWireShape.test.ts`** pins both corrected response
  envelopes fixed below (5 tests). Suite now stands at 289 vitest tests passing
  (17 files).

### Fixed — two never-registered rails, the route gate's first catches (S280, S279-class)

- **`AudioTracksPage` fallback called `GET /api/v1/media/{id}/audio-tracks`** —
  a route phlix-server never registered, so the fallback always failed and the
  track list rendered empty. Now reads `audio_tracks` from the registered
  `GET /api/v1/media/{id}/playback-info` — the same rail `@phlix/ui`'s player
  uses.
- **`UpNextOverlay` called `GET /api/v1/media/{id}/playlist`** — also never
  registered, so the overlay silently never showed. Now reads the head of
  `GET /api/v1/users/me/next-up` (`{items:[…]}`), skipping a self-entry —
  mirroring the roku client's next-up handling.

### Changed

- **`@phlix/contracts` pinned to v0.4.4 (S325 consumer bump).** v0.4.4 carries the canonical snake_case parental-controls wire shape (S234) and admits `dash_url` on the transcode shapes the server emits (S325).

### Fixed

- **ParentalControlsPage read camelCase fields that the wire never carried (S325b).** The page rendered `schedule.startTime` / `endTime` / `daysOfWeek` / `isActive` and filtered `t.tagType`, but the server emits `start_time` / `end_time` / `days_of_week` / `is_active` / `tag_type` (`AccessSchedule::toArray()` / `ProfileTag::toArray()`); `@phlix/contracts` v0.4.3's camelCase declaration was a lie that let those reads compile to `undefined` — blank times, a never-showing Inactive badge, and an always-empty blocked-tags list. All reads and the tag-create POST body now use the wire spelling, pinned by `tests/unit/ParentalControlsWireShape.test.ts` (renders the real times/badge, filters on `tag_type`, sends the canonical body). This is the same defect family S234 closed on mobile/roku — tizen shipped through it because it was the remaining camel-declaring consumer.


### Added — hub-relay `pending_command` consumer (S298, tizen half)

- **New `src/api/hubRelay.ts`** — the Tizen consumer for the hub's SyncPlay
  relay (`ws(s)://<hub>:8804/syncplay/{server_id}`), the ONLY surface that can
  receive "Alexa, play X" (S93's `pending_command` / `play_media` frame).
  The token travels in the `Sec-WebSocket-Protocol: bearer, <token>`
  subprotocol (the only carrier a Tizen webview WebSocket can present; S237
  refuses query-string tokens by design) and the relay echoes it back (S355).
  Relay tokens are minted from the hub's S2a endpoint
  (`POST /api/v1/me/servers/{server_id}/relay-token`) by a cached,
  single-flighted provider that re-mints on expiry and re-asks on a bounded
  5-rung reconnect ladder while a mint is in flight.
- **Open-whenever lifecycle** — the consumer socket opens at boot whenever a
  hub context resolves (hub URL, hub server UUID, hub access token — persisted
  `phlix.hubUrl` / `phlix.hubServerId` / `phlix.hubAccessToken` slots or the
  `VITE_PHLIX_HUB_URL` / `VITE_PHLIX_HUB_SERVER_ID` build env), independent of
  any SyncPlay room join. Without a hub session nothing opens — the honest
  "no open app" state, mirroring the roku client's direct mode.
- **`useSyncPlayStore` S298 surface** — `pendingPlayMedia` slot +
  `applyPendingPlayMedia` / `consumePendingPlayMedia`; the wire's
  `current_media_id` is carried into the local session (`currentMediaId`, the
  paired caller writes it on every adopted command).
- **New `src/syncplayDispatch.ts`** — the load-a-new-title dispatch point:
  watches the store's pending slot, resolves the bare media id through the
  app's `ApiClient` (`GET /api/v1/media/{id}`), loads it via the shared
  `@phlix/ui` player (`setCurrent` + `play`), consumes the slot, and drops
  stale resolutions when a newer command replaced the one in flight.
  Unresolved commands stay in the store slot (the refusal path keeps working).

### Changed — SyncPlay migration to @phlix/contracts v0.4.3 + @phlix/ui v0.99.0

- **`@phlix/ui` bumped to `v0.99.0`, `@phlix/contracts` to `v0.4.3`** (from
  `v0.98.33` / `v0.3.12`) as part of the tag cascade.
- **`useSyncPlayStore` migrated to the v0.4.3/v0.99.0 SyncPlay API**:
  `SyncPlayRoom` → `SyncPlayGroup` and camelCase → snake_case field renames
  (`currentSession` → `current_media_id`, `issuedBy` → `issued_by`);
  the REST client now uses the five `/api/v1/syncplay/groups` routes
  (list/create/get/join/leave — there is no `/rooms`, `/members` or command
  route); `joinRoom` returns `{room, session}`; playback commands are sent as
  `@phlix/syncplay` WebSocket frames (the REST `sendCommand` was removed in
  v0.99.0); positions are converted seconds → milliseconds at the send
  boundary per phlix-syncplay SPEC.md:91, and listing rows keep their
  `current_media` value instead of dropping it to `null`.

### Added — in-player quality selection via the remote (G1)

- **`@phlix/ui` bumped to `v0.74.0`, `@phlix/contracts` to `v0.2.0`** (from
  `v0.55.0` / `v0.1.1`), pulling in `@phlix/ui`'s `QualityMenu` (the on-screen
  stream-quality picker rendered in the player's control bar as a `Select`
  combobox, shown whenever there are ≥2 switchable hls.js ABR rungs).
- **Yellow color button opens/toggles the quality picker** on the player route
  when a multi-variant transcode is playing (no-op for direct-play / single-
  quality streams, where the menu never renders). Once open, the D-pad
  Left/Right/Up/Down and Enter drive the on-screen `Select` exactly as they
  would on a mouse/keyboard — Enter confirms the highlighted rung, Left/Right/
  Up/Down move the highlight.
- **Back dismisses the picker first**, without closing the player underneath;
  a second Yellow press also dismisses it.
- Internally, a new `RemoteManager.suppressPropagation` hook stops the D-pad
  Arrow keydowns from *also* reaching the player's own seek/volume Arrow
  shortcuts while the picker is focused — otherwise the two handlers would
  fight over every Arrow press. All quality-mode flag clearance is routed
  through a single choke point (`close()` in `tizenBridge.ts`) so the flag can
  never get stuck true and permanently freeze D-pad navigation: a
  `MutationObserver` on the picker's `aria-expanded` attribute catches the
  picker closing itself (rung selected, Escape, outside interaction), and a
  `router.afterEach` guard catches the player/route being torn down out from
  under an open picker (Home, or any other route change) with no such DOM
  transition to observe.
- No contracts-side (payload) changes — this repo consumes only
  `buildPhlixHeaders` from `@phlix/contracts`; the version bump is for
  consistency with the rest of the Stream-Quality/ABR client fleet.

### Changed — S404 track-shape alignment (contracts pin + honest track types)

- **`@phlix/contracts` pinned to v0.4.5 (S404 consumer bump).** v0.4.5 corrects
  the playback.ts `AudioTrack`/`SubtitleTrack` pair to the REAL
  `StreamTrackShaper` wire emission (the pre-fix `display_title` pair was a
  fiction the server never emitted; verified at server `01340633`) and exports
  ordered key-list consts for parity gating.
- **`AudioTrackList.vue` / `AudioTracksPage.vue` re-typed to the wire
  `AudioTrack`.** The page's hand-map into the `StreamAudioTrack` DB mirror
  silently DISCARDED `index`/`stream_index`/`default` (and dropped null
  `bitrate`/`title`); the wire type needs no mapping, so the rows now pass
  through untouched — the S280 test that pinned the discard was rewritten to
  pin the pass-through (same rail, same URL assertion).
- **`SubtitleTrackList.vue` reads only wire keys.** The title line moved from
  `track.title` (never emitted on the subtitle wire) to the server-derived
  `track.label` (shown only when it says more than the language); the
  `Forced`/`Default` badges — backed by `isForced`/`isDefault`, keys the
  subtitle wire never carries (there is no forced/default concept for
  subtitles) — were replaced by the honest single `SDH` badge for the emitted
  `hearing_impaired` flag. The component is still unconsumed in `src/` (wiring
  it is S407); only its types/reads were made honest.
- **Tests**: `SubtitleTrackList.test.ts` rewritten HONESTLY to full nine-key
  wire fixtures (not deleted); new `TrackWireShape.test.ts` asserts golden
  server-captured rows against the INSTALLED package's exported key consts
  (5 tests). Suite 289 → 295 vitest tests (18 files); `routeManifest.gate`
  untouched-green; vue-tsc/lint/build clean.
