# Changelog

All notable changes to **phlix-tizen-client** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

**Shape law (declared 2026-10-30, M-TIZEN-42 — this repo's actual release
mechanics, not a drift from the above).** The widget ships as a rolling
prerelease: the only git tag is the floating `latest` pointer that the CI
release leg re-points on every master push (docs/signing.md — "rolling
prerelease era"), and no semver release has ever been cut. Consequences this
ledger accepts deliberately:
- Everything lives under a single `## [Unreleased]` heading, because nothing
  has been *released* in the Keep-a-Changelog sense. Date-stamped `###` entry
  headings carry the chronology that release headings would otherwise hold;
  they are per-entry by design, not misplaced version headings.
- No `[Unreleased]: …compare/…` link definition exists or can exist: compare
  links need two semver endpoints and there is only the floating tag. The
  first tagged release (a store/OTA event, owner-gated) converts the ledger:
  entries above it move under a version heading at that moment, not before.
- Historical section titles written before this law was declared stand
  verbatim (including the non-KaC `### Prior era snapshot — …` grouping deep
  in the file) — estate history-verbatim law; corrections append, never
  rewrite. (Deferred m19/m20 adjudication, 2026-11-03: the non-KaC headings
  the reviews enumerated are historical record; they grandfather, they do not
  migrate.)
- Forward-entry law for every lane landing here: lead each entry with the
  **user-visible delta**, then the mechanism; internal churn belongs in the
  body, not the heading.
- Forward-vocabulary law (deferred m20, 2026-11-03): NEW `###` headings under
  `## [Unreleased]` use only the six Keep-a-Changelog categories — Added,
  Changed, Deprecated, Removed, Fixed, Security — followed by ` — <topic> —
  <ISO date>`. Grandfathered non-KaC titles above do not set a precedent;
  coining a fresh category is the drift this clause exists to stop.

## [Unreleased]

### Changed — English screensaver wake hint is now a punctuated sentence ("Press any key to wake.") — 2026-11-13

### Changed — build toolchain upgraded to the newest mutually compatible set (ESLint 10, TypeScript 6.0, jsdom 31, @types/node 24, globals 17) — 2026-11-13

- ESLint 10 + `@eslint/js` 10; the new recommended rules were satisfied in source (`no-useless-assignment`, `preserve-caught-error` — the SyncPlay REST timeout error now carries `{ cause }`), no rule weakened.
- TypeScript stays on 6.0.x, NOT 7.x: `typescript-eslint` 8.72 peers `typescript <6.1.0`. TS 6 removed `baseUrl` (`tsconfig.tests.json` paths are now `./`-relative) and `tsconfig.json` adds the `ES2022.Error` lib for `Error.cause`.
- `overrides` pin `minimatch ^11.0.8` / `glob ^14.0.6`, clearing the open minimatch advisories (`npm audit`: 0 vulnerabilities, was 11).
- GitHub Actions were already at the latest majors; Node 24 CI unchanged.
- ESLint floor raised to 10.15.0; `@types/node` stays on 24 (matches the Node 24 CI/runtime; 26 would type APIs Node 24 lacks), TypeScript 7 still blocked by the `typescript-eslint` peer range (`<6.1.0`).

### Fixed — boot no longer aborts when a non-English locale chunk fails to load (falls back to English); TV settings and the screensaver share one guarded storage helper — 2026-11-13

- `messagesForLocale` now catches a dynamic locale-chunk load failure and returns the English catalog (TIZ-S21).
- New `src/guardedStorage.ts` replaces the duplicated localStorage-or-session-shim code in `TvSettingsPage.vue` and `ScreenSaverOverlay.vue` (TIZ-S16).
- Deliberately unchanged, recorded here so the skip is not silent: the
  `wakeHint` copy (an imperative sentence, which the fragment law excludes
  from the punctuation rule); the TvSettingsPage ArrowLeft/Right pass-through
  (needs a hardware focus check, nothing to change in code); and the
  build.yml force-PATCH of the `latest` tag (assumes no tag-protection rules;
  note only, no defect).

### Fixed — "Alexa, play X": the TV no longer plays a command meant for another server, or one that is long out of date — 2026-11-12

- **User-visible delta:** a hub-relay play command now starts playback only
  when it names the server the TV is connected to and was issued within ten
  minutes of the TV's clock (review round 2026-11-11 TIZ-17). Before, a
  frame for a different server had its media id looked up in the wrong
  library, and an old command could still start a title.
- **Mechanism:** the relay socket's `onmessage` in `src/api/hubRelay.ts`
  drops a parsed `pending_command` whose `server_id` differs from the
  socket's bound `serverId` (also covers frames for the old server after a
  re-point). `wirePendingPlayMediaDispatcher` in `src/syncplayDispatch.ts`
  checks `issuedAt` before resolving: outside `PENDING_COMMAND_MAX_SKEW_S`
  (600 s, both directions, generous because TV clocks drift) the command is
  consumed unplayed and the new optional `onStale` callback is told. A frame
  without `issued_at` is still stamped "now" at the parse boundary, so it is
  never stale. The wire schema is unchanged; both checks only read fields
  the parser already had. The tests are in `tests/unit/hubRelay.test.ts`
  (cross-server and post-re-point drops) and
  `tests/unit/syncplayDispatch.test.ts` (window edges, past and future
  rejection, drifted-but-sane acceptance, clock seam). `package/` is
  regenerated in the same commit.

### Fixed — parental controls: a double-pressed Save no longer creates a duplicate schedule row or sends a doubled limit update, and the shipped widget now carries the fix (package/ regenerated) — 2026-11-12

- **User-visible delta:** pressing Save twice quickly on a parental schedule
  (new or edited) or on the stream limit now sends one request, not two. A
  double-pressed create no longer leaves a second schedule row on the server
  (review round 2026-11-11 TIZ-18).
- **Mechanism:** `saveSchedule` and `saveLimit` in
  `src/pages/ParentalControlsPage.vue` now return early while their
  `savingSchedule` / `savingLimit` flight is open. Before, the Save button's
  `:disabled`, applied on the next render, was the only barrier. This is the
  same handler-entry rule `deleteSchedule`, `addTag` and `removeTag` already
  follow (RT-099, 2026-11-09 entry below, left unedited). The existing
  `finally` resets re-arm each guard for the next press. The tests are in
  `tests/unit/ParentalControlsWireShape.test.ts`, in the RT-099
  mutation-guards suite: a double-activated Save fires exactly one create
  POST, one edit PUT and one stream-limits PUT, and each guard re-arms. The
  source change landed in `dabbc23`.
- **package/ regenerated.** `dabbc23` and the TIZ-S11 commit before it
  (`f81ee87`) both changed shipped source without rebuilding `package/`, so
  the committed widget bundle still had the unguarded handlers and the Build
  workflow's freshness assertion (audit W105 T-02, shipped == audited)
  failed on both pushes. `npm run package` at HEAD regenerates it: 52 hashed
  chunk renames plus `package/index.html`. Two runs back to back gave
  identical bytes. No wire, request shape or theme value changed.

### Fixed — ledger erratum: one post-law `### Documentation —` heading re-categorized, and the shape-law preamble's phantom `docs/signing.md` cite re-sourced to the CI release job — 2026-11-12

- **User-visible delta:** readers of this ledger get two corrections to how
  existing text should be read. Nothing above or below this entry is
  rewritten (estate history-verbatim law: corrections append, never rewrite);
  no source, test, widget or `package/` byte moved (review round 2026-11-11
  TIZ-23 / TIZ-33).
- **Heading erratum.** `### Documentation — entry maps and audit trails carry
  the w13/w15 landing — 2026-11-09` (landed `452ae44`, 2026-11-09) postdates
  the forward-vocabulary law (`776e582`, 2026-11-03) and coins exactly the
  non-Keep-a-Changelog category that law exists to stop. Read it as
  `### Changed — …`: it records doc-only edits to existing entry maps, which
  is a change, not an addition or a fix. It is an erratum'd violation, NOT a
  grandfathered precedent — no later entry may cite it to justify a fresh
  `Documentation` coin. Census, measured at this entry: the ledger holds
  exactly two `### Documentation —` headings. The other one, `### Documentation
  — the widget update path is written down (M-TIZEN-16 / review tizen__devops
  MINOR-7) — 2026-10-30` (`b0abe86`, 2026-10-30 23:05 -0400), landed after
  the shape-law preamble (`e046a2f`, 21:34 the same day) but before the
  forward-vocabulary clause existed, so the 2026-11-03 m19/m20 grandfather
  adjudication covers it and it stays read as written.
- **Phantom cite.** The shape-law preamble sources the rolling-`latest`
  mechanics to `docs/signing.md — "rolling prerelease era"`. That phrase does
  not exist in docs/signing.md and never has:
  `git log -S'rolling prerelease' -- docs/ README.md` returns no commits. The
  true source is `.github/workflows/build.yml`, job `release-latest`
  (`name: Update "latest" prerelease`, :70–71). On every master/main push it
  deletes the `latest` release and tag (step `Reset "latest" release + tag`),
  then re-creates them (step `Publish "latest" prerelease`, `tag_name:
  latest`). Read the preamble's parenthetical as citing that job.
  docs/signing.md does describe the published artifact ("the "latest" GitHub
  release publishes this RAW, UNSIGNED .wgt") but does not name an era.

### Changed — deps: @phlix/ui #v0.99.28 → #v1.0.0 (owner-approved cascade; ui v1.0.0 requests @phlix/contracts #v0.5.8)

- **Pin leg:** `package.json` + lock rotated (ui peel `5901e05518d14875087bfa99f2130e555d69ea9f`
  from `git ls-remote`); README / DEVELOPER / AGENTS / CLAUDE / docs/i18n.md pin lines rotated.
- **Locale re-vendor:** `git diff dfe8fc65..v1.0.0 -- src/i18n` touches only `errors.test.ts`
  (no locale source change); bundles byte-identical, PIN + `SOURCE_REF` re-anchored to `5901e055`.
- **package/ re-vendored** (`npm run package`); `:focus-visible` census re-measured, unchanged at 155
  (distApiFloor + runtime-floor.md figures hold). No consumer code change needed.

### Changed — deps: @phlix/ui #v0.99.27 → #v0.99.28 + @phlix/contracts #v0.5.7 → #v0.5.8 (CTR-S14 cascade re-pin)

- **Pin leg:** `package.json` + lock rotated (ui `dfe8fc6586e41728b4dcdc1a22a2bf8d19e74e01`,
  contracts `e5a33809e9659ab40325aae4e92411b464ddbcd7`, peels from `git ls-remote`); README /
  DEVELOPER / AGENTS / CLAUDE / docs/i18n.md pin lines rotated with it.
- **Locale re-vendor:** ui locale SOURCE moved (`git diff 1f906979..v0.99.28 -- src/i18n`
  non-empty); bundles + PIN re-synced to `dfe8fc65` via `scripts/sync-ui-locale-bundles.mjs`.
- **package/ re-vendored** (`npm run package`); `:focus-visible` census 154→155 (+1
  `.device-sessions-page__card-title` token), distApiFloor + runtime-floor.md updated.

### Changed — deps: @phlix/ui #v0.99.26 → #v0.99.27 (session-rows wave cascade) — Settings gains the device-sessions tab, the locale vendor re-synced (+24 leaves, 542→566), package/ regenerated (63 chunk renames, deterministic ×2) — 2026-11-11

- **User-visible delta:** the installed ui bundle now carries
  `DeviceSessionsPage` — Settings > Sessions lists the devices signed in to
  the account and signs out the others (ui `feat(sessions)` @ `1f906979`).
  Zero new tizen-side code: the surface rides in through `createPhlixApp()`.
- **Pin leg:** `github:detain/phlix-ui#v0.99.26` → `#v0.99.27`, lock
  surgical — EXACTLY 3+/3− (package.json, lock root echo, entry
  `version`/`resolved`). `resolved` peel `1f9069793f7195eb8b5c101d435725daad18a403`
  re-verified by own `git ls-remote` (tag object `c262b68132954ecf6950760970607a5b2b3b52b1`
  == ui master at the wave). No other dep moved — the 2026-11-11 latest-secure
  floors above stay exactly as landed.
- **Locale re-vendor:** `git diff dc2e70fe..1f906979 -- src/i18n` is
  NON-empty (the sessions block), so the key-set equality law demanded a
  conscious re-sync: BOTH equality legs measured RED on the fresh .27 install
  first (`es missing installed keys: ['settings.tabSessions', …(23)]` +
  `expected 566 to be 542`), then `scripts/sync-ui-locale-bundles.mjs --ref
  1f906979` re-vendored the seven-file tree. 12 of the fourteen PIN hashes
  rotated (six bundles × source+vendored); the `index.ts` pair HELD for the
  sixth consecutive real re-vendor wave. The script's bootstrap `SOURCE_REF`
  advanced with the ref (constants==PIN drift pin green), the
  `i18nLocales.test.ts` era comment and `docs/i18n.md` lineage carry the new
  head entry.
- **package/ re-vendor:** widget bundle rebuilt at .27 — 63 chunk renames
  (entry `index-D9xcKabx.js` → `index-DM7Rs6-m.js`, css `index-DVCjqgJ1.css`
  → `index-ZhzVHCBR.css`, PlayerPage carrier `5onGq7ES-CYJm1rhs` →
  `CHLjXsKa-Bhwg2fOC`), file set unchanged at 104, deterministic ×2 (clean
  rebuild per-file md5 identity), committed bytes == a fresh build for the
  Build-workflow freshness gate. The sessions view chunk-merges into the
  existing lazy pages — no new chunk name arrives.
- **Runtime floor:** `distApiFloor` census moved ZERO — the .27 payload added
  no above-floor live call site; the polyfill roster (`.at`,
  structuredClone, randomUUID, Object.hasOwn) is untouched and every pin held
  un-rotated.
- **Gates:** vue-tsc 0; vitest 65 files / 1210 tests — EXACT parent figures
  (no test added, none removed; the six `docsPinConsistency` legs measured RED
  at tip on the stale stamps, cured by the .26→.27 rotations in README/
  DEVELOPER/AGENTS/CLAUDE/docs-i18n); lint 0 errors / 29 warnings (parent
  parity); audit-gate PASS — same two-entry allow-list (glob/minimatch dev
  chains), zero new advisories, unchanged posture.

### Changed — deps: latest-secure dependency wave (owner ruling 2026-11-11) — vite 8.3.8 taken (the deferral above cured: rolldown bundle re-attestation completed), vue 3.5.45, vue-router 5.5.0, @phlix/syncplay #v0.1.8, vitest/coverage 5.1.0, @vue/test-utils 2.5.1, vue-eslint-parser 10.4.2, vue-tsc 3.3.14, typescript-eslint 8.72.1 floors; eslint 10 / TS 7 / @types-node 26 / globals 17 / jsdom 31 cross-major cohort NOT taken (owner-gated audit triage); #v0.99.26 ui pin held (the batch's v0.99.24 downgrade refused); package/ regenerated (rolldown, 97 chunks, deterministic ×2), runtime-floor tripwires re-derived from disk — 2026-11-11

- **Latest-secure wave per owner ruling** over the open dependabot batches
  (#123 pinia-era, #120 vite, the #127-supersession lineage, #129 batch):
  every targeted library re-resolved to its LATEST registry version and
  checked against GHSA/npm audit before taking it.
- **vite ^8.3.8** (latest; the 8.x advisories GHSA-vfpm-58rq-9qcg et al. are
  patched at 8.3.3, and 8.3.8 is alert-free — `npm audit` unchanged). This
  SUPERSEDES the same-day wave's `evaluated-and-deferred` verdict: the deferred
  re-attestation IS this commit — rolldown+oxc codegen re-derived every
  `distApiFloor` runtime-floor pin from disk (backticked compare folds,
  `void 0` crypto guard, Menu/pinia/Icon lazy-chunk addresses, spaced
  color-mix probe) with per-pin attribution; entry `index-D9xcKabx.js`,
  css `index-DVCjqgJ1.css`, 97 JS chunks, `npm run package` deterministic
  ×2. `build.target: chrome100` stays explicit, so vite-8 default-target
  changes are inert for the Chromium ≥ 85 floor contract.
- **@phlix/syncplay #v0.1.7 → #v0.1.8** (latest tag; wire vocabulary
  unchanged — zero new codes/messages). The client-side discipline is new:
  LW-041 non-string id refusals, LW-042 clamped group position, LW-044
  grouped-delivery law (seek/play frames ride only after a group_state
  fold). The M-TIZEN-27 poison fixture arms via a canonical
  `syncplay_group_state` frame instead of poking store state — the honest
  wire shape, mutation-visible exactly as before.
- **vue 3.5.45, vue-router 5.5.0** (latest; zero advisories on either).
- **vitest/@vitest/coverage-v8 5.1.0, @vue/test-utils 2.5.1,
  vue-eslint-parser 10.4.2, vue-tsc 3.3.14, typescript-eslint 8.72.1 floors**
  (#129 legs, latest-secure, all gates green on the pair). vitest 5.1.0
  rides the vite-8 module-runner fix below.
- **src/polyfills.ts install seam**: the `Array.prototype.at` guard is now
  the exported `installArrayAt()` (auto-invoked at import). vite 8's module
  runner captures the native `.at` internals before the entry-body install
  runs; the seam lets the polyfills suite re-install after its
  `at → undefined` global patch window instead of breaking vitest-internal
  callstack reads. Behavior for shipped code is unchanged.
- **NOT taken**: `eslint ^10` / `@eslint/js ^10` / `typescript ^7` /
  `@types/node ^26` / `globals ^17` / `jsdom ^31` (cross-major dev cohort —
  owner-gated audit-triage hold, windows precedent) and the batch's
  `@phlix/ui` v0.99.26 → v0.99.24 downgrade (curated estate pins are
  never downgraded — owner law). Dependabot alert #63 (minimatch, dev-
  transitive) stays open pending that triage (re-verify duty 2027-02-04).
- **Era stamps rotated**: README/DEVELOPER/AGENTS/CLAUDE syncplay pin lines,
  store docblock wire-truth cites, `docs/runtime-floor.md` census (chunk
  counts + per-chunk locations) in the same change, per the floor-doc law.

### Changed — deps wave 2 (owner latest-secure ruling, follow-on to the same-day wave): every IN-RANGE dev/runtime dep advanced to its ceiling — vue 3.5.45, vue-router 5.5.0, vitest/coverage-v8 5.1.0, vue-tsc 3.3.14, @vue/test-utils 2.5.1, eslint 9.39.5, plugin family minors; package/ regenerated (32/39 chunks rotate, entry now `index-Dh02D-Ij.js`); superseded #129 — 2026-11-11

- **User-visible delta:** none shipped-visible; the bundle re-hashes only through the vue 3.5.39→3.5.45 /
  vue-router 5.1.0→5.5.0 runtime advance. Runtime-floor census re-attested with ZERO movement (header note).
- **Why:** the push of the wave-1 commit re-triggered the dependabot updater, which opened #129 — an 18-package
  mega-batch under owner-derived inspection mixing FOUR categories: (a) in-range latest-secure (this entry —
  landed); (b) a forbidden `@phlix/ui` DOWNGRADE v0.99.26→v0.99.24 and an `@phlix/syncplay` v0.1.8 pin move
  (REFUSED: NEVER-downgrade law + `@phlix/*` pins are owner-run-wave territory); (c) out-of-range majors —
  typescript ^7.0.2, eslint ^10, @types/node ^26, jsdom ^31, globals ^17 — deferred as a dedicated toolchain
  migration program (TS7 is a compiler-generation jump); (d) `vite ^8.3.6` — REJECTED on the wave-1 floor
  evidence (same rolldown-era bundle that reddened all three distApiFloor guards; 8.3.6 is also BELOW the
  8.3.8 evaluated). Dependabot's batch figures were again non-authoritative: it proposed vue-router 5.4.0
  while 5.5.0 was already the in-range latest, and rolled vite BACKWARD to 8.3.6.
- **Venue:** `npm update --legacy-peer-deps` (package.json ranges untouched — pure lock + tree ceiling move;
  `npm ci`-reproducible; audit-gate PASS unchanged at the allow-list {GHSA-g3hv, GHSA-3g3m}). Coverage floor
  measured 89.66/83.34/86.63/91.03 (up from 89.6/83.34/86.48/90.96 — rise, not rotation).


### Changed — deps wave (owner latest-secure ruling): CI actions advance to v7 majors, vite to 7.3.8 with the 8.x line evaluated-and-deferred on runtime-floor evidence, plugin-vue to 6.0.10; no shipped-code delta, package/ regenerated — 2026-11-11

- **User-visible delta:** none — every change is dev-dependency or CI-plumbing; the widget bundle
  differs only in chunk content-hashes (entry `index-DgueOqPh.js` → `index-CiXKA_h7.js`), which is
  why `package/` rotates as a companion. The runtime-floor census (distApiFloor) re-attested with
  ZERO movement.
- **Why:** owner ruling 2026-11-11 — for each open dependabot PR, do not take the PR's version;
  derive the latest secure release ourselves and implement what the upgrade needs. Replaces (and
  closes as superseded) #124 (actions/checkout v6→v7: 5 uses across test/build/lint), #125
  (actions/setup-node v6→v7: 4 uses), #120 (vite 7.3.6→7.3.7 — already stale: the tip lock had
  silently reached 7.3.7; our replacement is the 7.x-line latest **7.3.8**).
- **vite 8.3.8 evaluation (deferred, not refused):** the 8.x line swaps the bundler stack
  (esbuild+rollup → rolldown+lightningcss) and, measured in a clone, re-drew the whole widget
  bundle: the three runtime-floor guards (crypto.randomUUID per-chunk census RT-106, Vue 3.5
  inert-patcher pin, color-mix() census RT-107) all red on the rolldown output. Re-attesting
  those floors under a new bundler is a dedicated program, not a deps wave — smallest lawful
  landing is the latest 7.x patch. Dependabot flags no vite advisory on this lock; `npm audit`
  exit 0 both sides.
- **@vitejs/plugin-vue 6.0.7 → 6.0.10** (in declared ^6.0.0, latest secure; advanced with vite
  as its related lib). pinia stays ^4.1.0 (RT-087 already landed it — no open PR to supersede);
  estate pins `@phlix/*` untouched (owner-run pin waves). The one open dependabot ALERT (#63
  minimatch, GHSA-g3hv class) remains the unreachable-patch allowlist case scripts/audit-gate.mjs
  documents — re-verify duty 2027-04-30.
- **Venue:** `npm update vite @vitejs/plugin-vue --legacy-peer-deps` — the bare resolver refuses
  to re-derive the tree over the PRE-EXISTING vue-router@5.1.0 `peerOptional pinia@^3.0.4` vs
  pinia@4.1.0 tension the lock already carries (ea6c2be era, CI-green; `npm ci` never re-checks
  optional peers). dependabot.yml comment + distApiFloor header advanced for doc truth.
- **Gates (all measured parent-then-tip at bd0e7dda / this commit):** typecheck +
  typecheck:tests clean; vitest 65 files / 1210 tests / 0 skip on both sides (the i18n locale
  guard passes against the real ui sibling); coverage 89.6/83.34/86.48/90.96 vs floors
  72/61/68/73 — unchanged; eslint 0 errors / 29 warnings baseline-held; `npm run package`
  deterministic ×2; audit-gate PASS (allow-list {GHSA-g3hv, GHSA-3g3m} exact, zero new).

### Changed — docs (CP-023 [w35/L2]): device-class token-custody truth line added — the localStorage bearer is declared by design, not a migration target, per the estate cookie-auth design — 2026-11-10

- **Why:** the estate cookie-auth design (`COOKIE-DESIGN.md`) settled the permanent split —
  same-origin browser clients ride session cookies, device-class clients (this widget among
  them) ride bearer custody forever. Its §4.6 assigned this repo final landing debt: the docs
  stated the facts (which `localStorage` rows hold what) but never stated that the custody
  shape is by design — leaving room to read the stored bearer as a stopgap awaiting cookie
  custody. It is not: a cross-origin TV web app is never a cookie-credentialed party, because
  a SameSite=Lax cookie is never sent to it.
- **What:** a "Token custody" paragraph in README.md and a docblock over the composition-root
  `ApiClient` construction in `src/main.ts`, both naming the law (COOKIE-DESIGN §2.1/§4.6,
  owner ruling D6c, 2026-11-05). No behavior changed; the `phlix.hubAccessToken` row and every
  existing custody law (M-TIZEN-06/12/23) are untouched.

### Changed — pinia ^4.1.0 manual bump (RT-087): one dep call above the floor shipped, answered with an entry-local polyfill and rotated census pins; package/ regenerated — 2026-11-10

- **What viewers see:** nothing new on screen — this is a dependency
  modernization (owner ruling 2026-11-10, choice (a): manual bump, Info-severity
  scope, nothing else moves). One real-world guard ships with it: pinia 4's
  dist calls `Object.hasOwn` (Chrome 93), above this widget's admitted
  Chromium ≥ 85 floor, so the entry chunk now installs the sanctioned
  own-property polyfill and the vendored store layer keeps working on the
  older Samsung webview population.
- **Pin leg:** `package.json` `pinia` `^3.0.0` → `^4.1.0` — the ONLY dependency
  movement (this deliberately is NOT dependabot PR #122's contaminated batch,
  which carried estate-pin downgrades and was closed unmerged 2026-11-06; it is
  neither merged nor replicated). `package-lock.json` regenerated by a fresh
  `npm install --allow-git=all` (npm 12.0.2 / node 24.21.0, the repo-declared
  toolchain). Lock delta is exactly the pinia family: `pinia` 3.0.4→4.1.0;
  `+nostics` 1.3.0 (pinia-4's own new runtime dep, registry-verified);
  `@vue/devtools-{api,kit,shared}` 7.7.10→8.2.1 (pinia-4 non-optional peers;
  their `vue ^3.5.11` requirement satisfied by the already-resolved 3.5.39,
  which stays unrotated); `perfect-debounce` 1.0.0→2.1.0; 10 nodes removed
  (the retired superjson chain copy-anything/is-what/mitt/rfdc/speakingurl/
  superjson, plus vue-router's nested devtools copies now deduped to root).
  **Estate pins held:** `@phlix/ui #v0.99.26` / `@phlix/contracts #v0.5.7` /
  `@phlix/syncplay #v0.1.7` lock entries byte-identical vs parent, and
  `diff -rq` of all three installed trees is clean — this wave moves pinia and
  nothing else.
- **Runtime-floor leg (the real breakage):** the pinia-4 relink put 3 live
  `Object.hasOwn(` call sites into the widget entry; the `distApiFloor` census
  pin redded FIRST (expected 0, measured 3) exactly as the M-TIZEN-03 tripwire
  is engineered to. Cure = the sanctioned install point: `src/polyfills.ts`
  gains a call-free guard (`typeof Object.hasOwn!=='function'`) installing a
  non-enumerable, writable, configurable `defineProperty` shim over
  `hasOwnProperty.call` — the RT-106/`.at`/`structuredClone` precedent line.
  The census pin rotates WITH ATTRIBUTION to 3 (all entry-local, zero in any
  other asset — newly pinned both ways), plus an entry install-shape arm and a
  4-test fallback suite (install-when-absent — RED-ON-PARENT by construction;
  native-equivalent semantics incl. ToObject-boxed primitives and the
  null/undefined TypeError; never overwriting a present native; descriptor
  shape). `docs/runtime-floor.md` re-derives its `Object.hasOwn` row (0→3 live
  calls, polyfilled) in the same change.
- **Widget leg:** `package/` regenerated via `npm run package`; 31 of 42 files
  renamed (ui first-hash segments all preserved — `PlayerPage-5onGq7ES-*`,
  `SyncPlayModal-hRQmGRs_*`, `MusicLibraryPage-DyAzEjsj-*`; entry stylesheet
  `index-BVpuTFMB.css` byte-ident — zero CSS delta), `index.html` rewritten,
  10 files byte-ident; entry `index-BD26Z3-N.js` → `index-DgueOqPh.js`.
  Deterministic ×2, aggregate md5 (`find package -type f | sort | xargs
  md5sum | md5sum`) `21831bcf351d0abdecccd8e6a2b03904`. ui stamp `0.99.26`
  exactly once on the new entry, zero `0.99.25` residue; carrier keeps the
  `playlist_url` + `_master.m3u8` law greps (1 each); `(shared — read-only)`
  1 site in the entry; `wsUrl` still 13 tokens in the entry (era-stable).
  `docs/ui-port-divergence.md` live cites re-attested against the new bytes
  (wsUrl bullet, MediaCard-literal row, and the `access_token` hoist alias
  `var Ni`→`var Ri` line, minifier churn on the relink — the `@phlix/*` dist
  aliases hold unrotated because those trees are byte-ident).
- **Locale leg:** PIN held — pinia touches zero locale bytes; `i18nLocales`
  45/45 green on the installed tree without rotation, pinned hashes and
  SOURCE_REF untouched.
- **Gates:** vitest serial `--coverage` 65 files both sides — parent worktree
  clone 1203 pass +1 skipped, tip clone 1209 pass +1 skipped: delta EXACTLY
  +6, every test attributed to the RT-087 arms (2 `distApiFloor` + 4
  `polyfills`); coverage 89.59→89.60 Stmts / 83.33→83.34 Branch /
  86.46→86.48 Funcs / 90.95→90.96 Lines (the polyfill body); the in-repo run
  (locale SOURCE-parity legs execute there) 1210 pass 0 fail. typecheck 0;
  typecheck:tests 0 (one test-side widening: the spec signature of
  `Object.hasOwn` restricts `target: object`, so the ToObject coercion-leg
  assertions run through a typed alias); lint 0 errors (29 pre-existing
  warnings held); build 0; audit-gate PASS exact-set
  {GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249} re-verify 2027-04-30 stands.

### Changed — ui #v0.99.26 re-vendor: 401 refreshes collapse to one, the cookie-custody seam ships inert; locale PIN held; package/ regenerated — 2026-11-10

- **What viewers see:** nothing new on screen — this is a resilience re-vendor.
  When the session token expires mid-use, the vendored ui client now files ONE
  refresh round-trip per burst (401 single-flight) instead of each failing call
  stampeding its own refresh, and the logout leg of that path is explicit;
  recovery from a stale sign-in is quieter and less likely to self-conflict.
  The wave also carries ui's cookie token-custody seam (CookieTokenStore +
  credentials policy + session probe) into the bundle — the widget keeps its
  own localStorage custody and does NOT opt into it, so behavior on TVs is
  unchanged by that half; and the pinia peer range widened (`^3 || ^4`), a
  compile-time fact only.
- **Pin leg:** `@phlix/ui` `#v0.99.25` → `#v0.99.26` (tag object
  `74c120bc7053bdb7f5c42eb491a3ac5ee04ac6cf`, peel `dc2e70fea43355aa7f56bc29f5c8e78195be8628`
  == ui master tip, ls-remote verified; codeload 200 @ 27,048,600 B md5
  `937a8512fe3d35236fb7ece8893828fd` — own download, identity re-extracted
  locally). `package-lock.json` surgical 4+/4- (root edge spec echo + ui node
  version/resolved — resolved lands on the peel — plus the ui node's `peerDependencies.pinia`
  line mirroring the tag's widened range, a lock-MIRROR of payload metadata,
  zero resolution effect: tizen's own pinia root pin `^3.0.0` is untouched);
  contracts `#v0.5.7` + syncplay `#v0.1.7` HELD — the tag's own `package.json`
  carries the identical edges (read from the peel, not recalled). npm11
  idempotency proven (2nd install byte-identical); fresh-resolve oracle
  (lockless `--package-lock-only` re-resolve) reproduced the committed triple
  EXACTLY (ui `0.99.26@dc2e70fe` / contracts `0.5.7@bedfe69b` / syncplay
  `0.1.7@1a80b1d1`); no nested `@phlix/ui` divergence. Installed tree
  `dist/phlix-ui.js` md5 `7cea63d44e4a8f5fdaed775b6e3506ab`, `dist/player.js`
  `a6428a081dbcc2427e268e674434df1a`, carrier `PlayerPage-5onGq7ES.js`
  `708772c4f3c6f6bc2ca4a314d5ce5357` — all match the .26 release register.
  Docs rotated at measured red-first (the six docsPinConsistency arms reddened
  on the bump: README badge + Tech Stack, DEVELOPER.md, `docs/i18n.md`
  installed-pin, AGENTS.md, CLAUDE.md); `docs/ui-port-divergence.md` ledger
  re-attested row-by-row against the NEW bytes (all six rows FACT-UNCHANGED;
  widget-side chunk/hoist re-anchors: entry `index-D1c6SPMk.js`→`index-BD26Z3-N.js`
  — the doc was one era stale via RT-106's `index-CEKJyz_J.js` —, music fold
  `MusicLibraryPage-7wf4WY0X-*`→`DyAzEjsj-*`, hoist `var Pi`→`var Ni`).
- **Locale leg:** PIN HELD — `git diff 6e1ce2d8..dc2e70fe -- src/i18n` in ui is
  EMPTY (the .26 payload moved auth code + test pins, zero locale source), and
  all seven v0.99.26 tag-payload locale files re-hashed EXACTLY to their PIN
  source hashes; ref, fourteen hashes and SOURCE_REF untouched, era comments
  advanced stamp-only (the .20/.22 branch of the law). `i18nLocales` 45/45
  green on the installed .26 bytes without rotation.
- **Widget leg:** `package/` regenerated via `npm run package` (version-sync
  idempotent, zero config.xml/telemetry churn — widget version stays 1.0.0);
  deterministic ×2 (`diff -r` clean; post-commit 3rd-build freshness sim clean);
  42 files, aggregate md5 (`find package -type f | sort | xargs md5sum | md5sum`)
  `6c45f9253df4526f6b22ba1648fe876e`; 31 of 39 assets renamed, the eight
  byte-stable incl. the entry stylesheet `index-BVpuTFMB.css` (zero CSS delta —
  the above-floor census arms stayed green unrotated, RT-106/107 JS pins too:
  entry `randomUUID` census 7, unguarded-Menu discriminator 1, hls 1); ui stamp
  `0.99.26` exactly once on `index-BD26Z3-N.js`, zero `0.99.25` residue
  anywhere under `package/`; carrier `PlayerPage-5onGq7ES-BScSAF90.js` carries
  the `playlist_url` + `_master.m3u8` law greps (1 each), entry carries
  `(shared — read-only)`, `users/me/settings`, `themeCatalogueUnavailable`,
  `Continue watching`, `var Ni="access_token"`; escape pattern 1 site
  (`useItemInspector-CC5nNuXm-DoFVbEpT.js`), `new Audio` exactly 1 site
  (`MusicLibraryPage-DyAzEjsj-*.js`).
- **Gates:** vitest serial 65 files / 1204 tests at BOTH parent and tip — the
  exact-zero-delta branch of the wave (no new tests: the payload demands none;
  every sensitive pin measured, none moved); lint 0 errors (29 pre-existing
  warnings held); typecheck 0; typecheck:tests 0; audit-gate PASS exact-set
  {GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249} re-verify 2027-04-30 stands.

### Fixed — player/library menus survive pre-Chrome-92 webviews; CSS floor census pinned complete — 2026-11-09

- **What viewers see:** on older Samsung webviews (the admitted Chromium 85–91
  population) the player's quality/captions/speed menus, the user menu, the
  card context menus and the Libraries menus can now open — previously the
  vendored ui Menu component's unguarded `crypto.randomUUID()` call (Chrome
  92) threw during setup and unmounted every Menu subtree in silence
  (RT-106, review `tizen__crossfe.md` M1). No visual change on ≥ 92 engines.
- **Mechanism (RT-106):** `src/polyfills.ts` gains the sanctioned install —
  an RFC 4122 v4 shim over `crypto.getRandomValues`, guarded on the native
  member being absent AND the entropy source present, following the
  `Array.prototype.at` precedent for vendored call sites the client cannot
  edit. `tests/unit/distApiFloor.test.ts` pins the minified install shape at
  the entry chunk, the per-chunk token census (entry 7 = 5 vendored + 2
  install; hls 1) and the unguarded-Menu call discriminator (count 1 — it
  reddens when upstream guards the call, retiring the pin by design);
  `tests/unit/polyfills.test.ts` adds the behavioral family (v4 shape,
  200-draw uniqueness, native-not-overwritten, inert without
  `getRandomValues`). Red-on-parent proof at `cc8a40f8`: six convictions
  before the cure, green after. Upstream guard still owed at ui `Menu.vue:62`
  (recorded in docs, out of this repo's edit scope).
- **Mechanism (RT-107, review M2):** the `color-mix()` (Chrome 111) census —
  49 tokens = 14 `@supports` probes + 35 declaration sites — is now pinned in
  the tripwire with a machine-checked guard walk: every declaration site has
  a plain-color twin inside its guard block, zero double-declares, zero
  unguarded sites (the two ambient/backdrop scrim gradients contribute two
  tokens each; buckets count tokens so the sub-counts partition exactly).
  `docs/runtime-floor.md` gains both rows (randomUUID / color-mix), the
  superseded provisional "38 without a preceding fallback" scan is replaced
  by the adjudicated classification with its history kept, and the test
  asserts the census row's presence — the doc-completeness claim RT-107
  exists to restore.
- **Bundle:** `package/` rebuilt deterministically (×2, aggregate md5
  `fa4b86b150831c142a8610b9147588d7`). The entry chunk carries the shim
  (`index-D1c6SPMk.js` → `index-CEKJyz_J.js`); every lazy chunk's
  content-hash suffix rotated through the import-reference cascade (the
  82–99%-similar renames — bodies otherwise unchanged, only embedded import
  paths); the stylesheet is byte-identical (`index-BVpuTFMB.css`). Battery
  65 files / 1204 tests (+7 exactly over the `cc8a40f8` baseline, all new,
  no pins rotated gratuitously).
- **LW-087 disclosure:** the row's re-pin legs (ui #v0.99.25, contracts
  #v0.5.7) already landed at this parent via the `.25` re-vendor commit —
  absorbed, not re-cut. syncplay holds #v0.1.7: the #v0.1.8 leg stays
  owner-gated pending the RE-BASELINE wave (evidence: the mobile law-passer
  review in `.reviews/2026-11-09/REVIEW-w23L2mobile.md`); locale/vendor PINs
  ride `cc8a40f8` unchanged (0 new i18n keys this lane).

### Changed — `@phlix/ui` #v0.99.25 re-vendor; Parental stream-limits finally live — 2026-11-09

- **What viewers see:** the Parental Controls → Stream Limits section works
  for the first time. The server wraps the DTO in `{ stream_limits }` and
  speaks snake_case on BOTH verbs (`StreamLimitController`, declared by
  contracts `ProfileStreamLimit` since LW-065); the page's camelCase reads
  and save body never matched that wire — the resting display was pinned at
  '—' and every save 400'd. The #v0.5.7 type-truth bump made the compiler
  say so (5 typecheck errors), and the cure landed with it: boundary
  unwrap/rewrite in `ParentalControlsPage.vue`, envelope-true test mocks, and
  a new whole-tuple PUT pin in `ParentalControlsWireShape.test.ts` (convicted
  by re-widening the src body to camel — exactly 1 red, restored).
  Riding in from the vendored bundle: the stacked-overlay focus-routing and
  SyncPlay reconnect PARK ladder (ui `b9adc481`) — the room socket no longer
  dies after its budget; it waits for a visible window and re-asks — plus
  the localized browse-rail strings (Continue watching / Next up / …) across
  all seven ui locale bundles.
- **Pin leg.** `package.json` advances ui #v0.99.22→#v0.99.25 and contracts
  #v0.5.6→#v0.5.7 (the .25 tag payload declares .5.7; holding .5.6 would
  force an unratified nested divergence era — the estate .25 plan names the
  re-pin in this wave); syncplay holds #v0.1.7 (v0.1.8 is a separate owner-
  gated RE-BASELINE, and #v0.99.23 stays NEVER-pin, the truthful red-CI
  orphan). npm11 install, lock surgical 7+/7- (two spec echoes, the ui node
  to `6e1ce2d8`, the contracts node to `bedfe69b` fresh-minted — no stale
  hoist — and the ui-node edge echo), idempotent x2, and a lockless
  fresh-resolve oracle reproduces the committed triple exactly. Registry
  trio bytes (`5d1783a7…` error-codes etc.) verified unmoved — the .5.7 delta
  is types/docblocks, which the two cures above show is NOT docs-only for
  tizen.
- **Locale leg (REAL rotation).** The .23–.25 source carried 16 new leaves
  (browse group + rails/error/guidance keys): red-first on the installed
  .25 bytes before sync (`es missing installed keys …(15)`,
  `expected 542 to be 526`), then `scripts/sync-ui-locale-bundles.mjs --ref
  6e1ce2d8` rotated the six bundles and the catalog PIN 526→542 (12/14
  bundle pin hashes moved; the `index.ts` pair holds for the fifth
  consecutive wave, `f5c2011a`/`fb4fa495`); post-sync `i18nLocales` 45/45
  including the local SOURCE-parity leg against the ui repo at the real peel.
- **Widget leg.** `package/assets/` re-vendored deterministically (x2
  `diff -r` clean, 42 files): entry CSS `index-B3a2zLUG.css` →
  `index-BVpuTFMB.css` (the .23 color-mix/browse-rail styles crossed it),
  player carrier `PlayerPage-BbWPOZn8-*` → `PlayerPage-Bp-fkb06-DNvJApVL.js`,
  32 of 39 assets rename; stamp `0.99.25` exactly once, zero 0.99.2x residue;
  law greps (playlist_url/_master, theme seam, picker literal, CSP-escape,
  watch glob) all live on the new bytes; aggregate md5s (recipes disclosed in
  the wave register) `f7a2aaee…` / `f186cdf0…`.
- **Ledger re-verification (docs law #2).** All six `ui-port-divergence` rows
  re-grepped at .25 bytes: all FACT-UNCHANGED, three honest attribution
  corrections (invite DTO chunks, `new Audio` dist-side move, escape-pattern
  chunk), the `canManagePlaylist` recursive census read 5 again, and the bare
  `access_token` literals still ship (hoist `var Pi=` in the widget entry;
  `var M`/`var yt` in dist — grep-the-LITERAL law unchanged).
- **Census rotations (measured reds, attributed).** `distApiFloor`: `inset:`
  42→43 (the vendored `.album-card__link` overlay; selector-set diff), and
  `docs/runtime-floor.md` re-measured in the same change — including a new
  unpinned-Info note for the `color-mix()` 1→49 jump riding the ui .23
  fallback cure. `TrackWireShape` golden subtitle vectors + the
  `SUBTITLE_TRACK_KEYS.length` pin rotated 9→10 for S507 `delivery`, and the
  M8 reconnect law moved its UNREADABLE probe to the host side because the
  ui CU-078 contract made `LocalStorageTokenStore` never-throw (memory-mirror
  degradation) — captured-token dial preserved, both M8 tests green.
- **Fold-in.** `docsTestListings` gained arm (f): the `docs/i18n.md`
  186-keys/15-groups census is now machine-pinned against `en.ts` (red-first
  convicted x2 by perturbing each number in scratch).
- **Gates.** typecheck/typecheck:tests/lint 0 errors; full vitest serial
  65 files 1197/1197 (parent at 64ba6655 measured 1194 — +2 arm-(f), +1 PUT
  pin); docsPin 9/9; audit-gate PASS on the exact allow-set {GHSA-3g3m,
  GHSA-g3hv} (re-verify 2027-04-30 stands); build determinism above.


### Fixed — the i18n census prose and audit trails read the true 186 / 15 (w15-L10 round 2) — 2026-11-09

- **What viewers see:** the docs finally match the shipped catalog. The RT-100
  purge deleted the whole `skip` and `pictureInPicture` groups (13 keys with the
  marker trio + `adBadge`; net −8 over the five keys this wave added), moving
  the tizen-own English base from 194 keys / 17 groups to **186 / 15**. The
  landing rotated the machine pins but orphaned five PROSE census sites, which
  this commit rotates from measured truth: three in `docs/i18n.md` (locale
  matrix row, `src/i18n/` tree line, tizen-own Files section) and two in
  `tests/unit/i18nLocales.test.ts` (the header law-list and the type-law test
  title). Key count proven by a measured-red probe (flipping the `toBe` pin
  reddens with `expected 186 to be 194`; probe reverted), group count by
  `grep -c '^const '` on `en.ts`. Suite totals are unchanged by this commit
  (test titles renamed are names, not cases).
- **Ledger correction (forward per the verbatim-history law):** two
  cross-references in the entries above stand corrected here; they stay
  verbatim as the record. (1) The Removed entry's closing parenthetical calls
  RT-101 "w15-L10's anchor item 'checkbox outside the focus law'" — wrong on
  both axes: RT-101 is the duplicate chapter tick-rail card (w13L4, gameux#2),
  and the checkbox item is **RT-103**, the actual w15L10 anchor (its own entry
  lands below). The deletion narrative itself remains true; only the numbering
  was garbled. (2) The RT-102 entry says the breathing skeleton covers "six
  loading branches" — disk shows **seven** skeleton sites across five files
  (RecommendationsScreen, SubtitleTracksPage, AudioTracksPage, ChaptersPage,
  ParentalControlsPage ×3), matching `tvMotion.test.ts`'s own enumeration,
  which the entry's text contradicts.
- **Audit trail:** `VERIFICATION.md`, missed by the w13/w15 docs sweep, gets the
  S501 precedent: a dated census note at the head declares every still-live /
  re-verified-at-tip prose about the four RT-100-deleted files historical, and
  Steps 9.1 and 15.1 each gain a 2026-11-09 counter-note to their falsified
  2026-11-07 currency claims (disk truth: five mounted apps, four overlay/panel
  hosts — `main.ts:607/:629/:646/:655/:663/:675`).

### Fixed — track-preference saves coalesce instead of storming the wire (RT-085) — 2026-11-09

- **What users see:** fast track picks (a held or rapid sequence on the audio
  page) land as ONE save instead of a per-press PUT storm, and when a save
  fails the page says so instead of silently claiming success. The
  "Audio preference saved" note now appears only after the write has actually
  settled; a rejected write leaves a localized failure note in its place and
  the remembered selection rolls forward correctly when a later press won the
  coalescing race.
  Mechanism (src/stores/useTrackPreferenceStore.ts): `persist` returns a
  `Promise<boolean>` — account writes per `kind:itemId` slot coalesce
  latest-wins through pending/in-flight maps, so an in-flight PUT is never
  duplicated and the trailing intent still lands. The audio page gates its
  confirmation on the settle result through a persist-sequence guard.
  New `audioTracks.saveFailedNote` × seven locales (194 to 195). Track
  suites carry the new coalescing legs (three language-memory + four store
  harness legs). (w15-L10 takeover: the lane inherited this as dead-lane WIP,
  repaired a ReferenceError at its store-test tail, and gate-verified it.)

### Fixed — parental guards hold against held repeats and say when they fail (RT-099) — 2026-11-09

- **What users see:** holding ENTER in the blocked-tag field creates ONE tag,
  not one per repeat (the held-key burst used to POST duplicates the server
  happily stored); a rejected tag or schedule mutation now surfaces a localized
  inline notice instead of vanishing, and the healthy rows beside it stay on
  screen. Buttons disable while their own mutation is in flight.
  Mechanism (src/pages/ParentalControlsPage.vue): `addTag` self-guards before
  flipping its flag (the @keyup.enter path no longer bypasses the button
  :disabled), remove-tag and delete-schedule gained per-row in-flight sets +
  `:disabled` mirrors, and two new notice surfaces (`role=alert`
  `.mutation-notice`) fed by `parentalControls.tagMutationFailed` /
  `scheduleDeleteFailed` × seven locales (195 to 197). Five new
  ParentalControlsWireShape legs pin one-POST-per-burst, mid-flight disable,
  failure disclosure with rows preserved, and notice clearing on success.

### Removed — unreachable chapter/skip/PiP host overlays deleted (RT-100, RT-101) — 2026-11-09

- **What users see:** nothing less — everything MORE. The player route's
  chapters panel, skip controls, marker timeline and PiP button were already
  the vendored player's own (operable, focused); the host-mounted twins behind
  them could never receive the remote and only added a position-poll tax.
  Deleting them removes that dead weight and the false surface the reviews
  kept re-tripping on.
  Mechanism: `src/components/ChapterOverlay.vue`, `SkipIntroOverlay.vue`,
  `PiPController.vue` and the shared `src/playerProgressTicker.ts` are DELETED
  with their three suites (68 files to 65 — the AGENTS/CLAUDE census re-measured
  in this same commit), plus the 3rd/4th/5th root mounts, their `index.html`
  host divs, and the thirteen tizen locale keys that existed only to label them
  (`chapters.marker*`+`adBadge`, `skip.*`, `pictureInPicture.*` — 199 pairs to
  186 across all seven files). Verification re-executed against the CURRENT
  vendored bundle (ui #v0.99.22): `showMarkerTimeline:!0` default-true, 12
  `marker-timeline__tick` rules, `player__iconbtn` skip + PiP surfaces, and the
  chapters panel all ship inside PlayerPage — the review's premise holds at
  this pin. This is S501 T-04/T-06 (UpNext + sleep-timer) applied once more;
  the routeManifest scan moved 27 to 24 sites, the vendored manifest itself
  byte-identical. (RT-101 was w15-L10's anchor item "checkbox outside the
  focus law" — the adjudicated landing for that card is this deletion: the
  chapter tick rail it concerns lived wholly inside the deleted twin; the
  surviving D-pad-operable chapter surface is the sealed player's.)

### Fixed — loading states breathe on the TV (RT-102) — 2026-11-09

- **What users see:** the recommendations, audio-track, subtitle-track,
  chapters and parental pages no longer show a single static sentence that is
  visually identical to a hang — three skeleton bars breathe above the copy
  while loading, and stop breathing (holding their settled state) under
  prefers-reduced-motion. The status sentence keeps the announcement job; the
  bars are aria-hidden decoration.
  Mechanism: new host CSS layer `src/styles/tv-loading.css` (imported after
  tv-motion.css in `src/main.ts`), five skeleton token values parked in
  tv-typography.css to keep the M-TIZEN-35 policy grep's scope strict, and the
  `.tv-loading-skeleton` div added to six loading branches. tvMotion.test.ts
  gained the layer's compositor-cheap + reduced-motion + import-order +
  presence pins (five legs).

### Fixed — parental forms are operable with a remote (RT-103) — 2026-11-09

- **What users see:** the schedule "Active" control is a focusable toggle pill
  (5px ring, switch semantics, text state) instead of a 1.25rem native
  checkbox the D-pad could tab over but never SEE; the two limit fields
  (concurrent streams, bandwidth) gained symbol −/+ steppers beside the
  typing path, and the pointer-only native spinner arrows are gone.
  Mechanism: `stepNumber(value, delta, min, max)` joins the pure
  parentalTimeStepper module (garbage input degrades to the field floor —
  parse-don't-validate, mirroring stepTime's stance) with
  `STEP_BANDWIDTH_KBPS = 1000` as the coarse rung; two `aria-hidden`-safe new
  locale keys `parentalControls.stepDownAria`/`stepUpAria` × seven (197 to
  199 pairs; the i18n expectation tables and the key-count pin rotated from
  measured reds). Five new TimeStepper arms + the wire-shape suite's
  existing mount law cover the arithmetic; toggle/steppers are source-pinned.

### Fixed — a standby-black-holed SyncPlay socket now recovers on its own (RT-104) — 2026-11-09

- **What users see:** after the panel sleeps and wakes, a watch party whose
  socket quietly died re-syncs within seconds — previously the room sat
  "connected" with a frozen group state forever, because the reconnect ladder
  only armed on close/error events that a black-holed link never fires.
  Mechanism (src/stores/useSyncPlayStore.ts): every inbound byte (malformed
  included) stamps a liveness clock; a visibility seam listener — the SAME
  source `armVisibleWindowRetry` uses — on a hidden→visible edge force-closes
  an open-but-silent (> 30 s) socket, handing recovery to the existing
  identity-guarded ladder. Six new useSyncPlayStore legs pin stamping,
  threshold behavior, no-op edges and listener pairing across reconnects.

### Documentation — entry maps and audit trails carry the w13/w15 landing — 2026-11-09

- AGENTS.md/CLAUDE.md/README.md/DEVELOPER.md/docs/i18n.md/.claude rules
  renumbered to the four surviving overlay apps, host-div lists trimmed, the
  overlay-missing debug section rewritten to point at the vendored player,
  suite census 68 → 65, the vitest sample commands swapped to existing
  suites, and the three T-07/saneMarker provenance notes re-homed honestly
  (they name the deleted overlays as their origin, past tense).
### Fixed — code sign-in is now a CHOSEN path, not the default takeover (RT-097) — 2026-11-08

- **What users see:** a TV with a server set but no session no longer slaps a
  pairing code in your face the moment the app opens. The takeover now arrives
  as a chooser — "Sign in with password" is the primary amber action (it works
  against every server today), "Sign in with a pairing code" is the secondary
  one, and the card states honestly that no companion app can approve a code
  yet. Only choosing the code path starts a session; the chooser itself issues
  ZERO requests.
  Mechanism (src/quickconnect/QuickConnectPanel.vue): a `mode` ref gates the
  ceremony — the session watcher moved from `eligible` to `pairingActive`
  (eligible AND mode==='pairing'), and a base change re-offers the takeover
  back AT the chooser, never mid-ceremony. Estate verification 2026-11-08 at
  current tips: ui and mobile carry the quick-connect ROUTE FIXTURES only — no
  approve UI ships anywhere — which is why the code path is opt-in copy, not
  the buried-default. Four new `quickConnect.choose*` keys × seven locales
  (190 to 194 — the key-set identity, byte-parity and call-site pins rotated
  from measured reds, plus re-wrote `instruction`/`hint` to the honest pairing
  copy); nine existing ceremony pins converted through the chooser click;
  three new chooser legs (arrival-zero-request, choose-code-arms-one-session,
  choose-password-retires-clean).

### Fixed — BACK on a page that cannot go back exits instead of dying (RT-098) — 2026-11-08

- **What users see:** on a screen the back-walk cannot move (a deep link whose
  history segment is empty, an app opened cold into a details page), the FIRST
  BACK still tries the walk; if the screen did not move, the NEXT BACK quits
  the app cleanly. Previously every further press did nothing at all — the
  dead-end button the exploit review walked into.
  Mechanism: `BackSnapshot` gains `priorBackInert` and `decideBackRung`
  escalates it to `exit-app` (row-snap and modal-close still outrank — nearest
  absorbable thing first). `tizenBridge.ts` observes the walk by route key
  (`name` + `fullPath ?? path`): the observation pairs ONLY two adjacent
  presses, is consumed on every press, and any route movement or non-walk rung
  disarms it, so a genuine multi-step walk never false-exits. Three pure-table
  arms + three bridge integration legs (stub-router inert → exit; moving fake
  → keeps walking; interleaved modal-close resets) red-first; README +
  DEVELOPER BACK rows carry the escalation clause.

### Fixed — track-preference memory cannot fill device storage or throw (RT-084) — 2026-11-08

- **What users see:** nothing when it works — and nothing when it doesn't.
  Choosing audio/subtitle languages per title no longer accumulates one
  permanent localStorage slot per watched title forever; the oldest choices
  age out past 100 live slots, and on a quota-full TV webview store the
  picker quietly keeps working instead of erroring.
  Mechanism (src/stores/useTrackPreferenceStore.ts): a most-recent-first LRU
  index key (`phlix.trackPref.index`) with an exported `PER_ITEM_SLOT_CAP`
  of 100; writes are preceded by cap-eviction, a rejected write evicts to
  half-cap and retries exactly once, a still-rejected write is swallowed
  (the fail-soft contract header law now states it covers local storage too;
  in-session refs + the account PUT are untouched). A corrupt/absent index
  re-derives by storage enumeration, so the cap never trusts the bookkeeping.
  Six new legs (cap eviction + index order, front-promotion, corruption
  re-derive, quota retry-lands at 51 live slots, dead-store cannot throw,
  clear un-indexes) on a scripted fake store — the repo's shared test-setup
  mock has no key()/length and cannot fail on demand.

### Fixed — two HLS buffer knobs were ABOVE hls.js defaults, now restored (RT-083) — 2026-11-08

- **What users see:** unchanged playback with a smaller resident buffer on
  RAM-tight Samsung webviews (the config keeps its bounded 180s forward
  ceiling and 90s back window — both BELOW the library defaults).
  Mechanism (src/main.ts `TIZEN_HLS_CONFIG`): measured against the resolved
  hls.js 1.6.16 DefaultConfig, `maxBufferLength 60` and `maxBufferSize
  100MB` were DOUBLE and ~1.7× the defaults the review note had itself
  mis-stated (the note's "default 60/30" premise is partly wrong — the 180
  and 90 legs were already down-default). 60→30, 100e6→60e6; the docblock
  now states every knob against the default it overrides. The `main.test.ts`
  config pin rotated from measured red to a FULL six-key `toEqual` (drift
  up reddens); DEVELOPER.md's mirrored block re-synced (the vendored player
  merges `playerHlsConfig` after its own values — verified at #v0.99.22 —
  so these numbers win).

### Changed — the relay-URL shorthand reads `wss://` like the law it documents (RT-082) — 2026-11-08

- Comments only: README's file-tree annotation and `src/api/hubRelay.ts`'s
  header both described the hub relay as `ws://<hub>:8804` while the same
  header's bullets enforce TLS-always with a named build-time dev hatch for
  plaintext. Both now say `wss://` (the README notes the hatch exists); no
  behavior, no bundle delta. RT-086 (the superseded dependabot vite PR) is
  an OWNER-FILES decision, recorded not acted.

### Fixed — forward-record: the RT-076 12/9 split needs its counting rule stated — 2026-11-08

- The 2026-11-07 forward-record above announces "12 space-only / 9 glyph"
  but does not define the classification that reproduces it. Rule: a row
  counts as space-only when its content characters match the old row after
  collapsing runs of spaces — which counts the first `◄` action-events
  link-row as space-FILL compensation (its right-edge shift absorbs the
  glyph), yielding 12/9. Under a strict character-classification (any
  differing non-space character, including added glyphs, is a glyph change)
  the same 21 lines measure 11 space-only / 10 glyph-changed. Both totals
  are honest; the entry's 21-line scope and interiors-verbatim law stand.

### Changed — doc currency: reading guide enumerates all 17 sections; learnings label matches the gate; i18n counts caught up — 2026-11-08

- VERIFICATION.md's reading guide "(4, 2, 1, 3, 5, 6)" was the six-era list
  never extended to seventeen; the guide now enumerates the full appended
  order (4, 2, 1, 3, 5, 6, 7, 9, 8, 12, 10, 11, 14, 15, 13, 17, 16 —
  grep-verified against the section headers at tip 30649d0).
- CALIBER_LEARNINGS.md's pin-drift convention called the set "FIVE doc
  surfaces" while listing package.json + four docs; the gate
  (`docsPinConsistency.test.ts`) machines FIVE DOC files (README,
  DEVELOPER, docs/i18n, AGENTS, CLAUDE) with package.json as the source of
  truth — the entry now describes six surfaces with the gate's five named,
  plus a historic note recording the old mislabel.
- docs/i18n.md still said 189 keys while tip pinned 190 (the w11L2 boot-
  retryHint row missed the doc); all three mentions read 194 now, moving
  with this wave's `choose*` additions.

### Fixed — forward-record: the RT-076 diagram prose above overstated its diff — 2026-11-07

- The w11-L2 entry labels the DEVELOPER.md architecture-diagram rebuild
  "whitespace-only restructure". Measured truth: of the 21 replaced lines,
  12 differ ONLY in space counts and 9 pairs change box-drawing glyphs
  (equalized border widths, tee/connector columns, the unclosed
  `tizenBridge.ts` right edge, per-row `◄` arrows on the action-events
  link). Text interiors are verbatim; the FRAME geometry is redrawn —
  which is exactly what the misalignment finding asked for. The entry
  above stands verbatim per history law; this row is the correction.

### Fixed — the boot-failure screen states the recovery step; entry-doc honesty pass — 2026-11-07

- **What users see:** when boot fails hard enough to replace the app with
  the raw failure screen, the headline is now followed directly by a
  recovery line — 'Try closing Phlix and opening it again.' — in all seven
  locales. Previously the screen showed the headline plus the diagnostic
  ring only, leaving a stuck viewer no next move to try.
  `renderBootFailure` (src/main.ts) emits the new `boot.retryHint` between
  the headline and the 'Recent failures:' ring (diagnostics stay the tail);
  the key lands in all seven Tizen catalogs (189 to 190 — the key-set
  identity, byte-parity and call-site pins rotated from measured reds) and
  two new `main.test.ts` pins lock the text-adjacency and the ordering
  above the ring, red-first at parent.
- Docs truth pass: `DEVELOPER.md` architecture diagram rebuilt with
  border-accurate box widths and tee/connector column alignment
  (interiors verbatim, whitespace-only restructure) (RT-076); the
  DevTools-dispatch snippet gains the Chromium-only caveat for the
  non-standard `keyCode` init member plus the portable
  `Object.defineProperty` form `remote/gamepadBridge.ts` already ships
  (RT-078); `VERIFICATION.md` gains an H1 and a reading guide stating the
  append-order ledger's category sequence and dated-stamp meaning
  (RT-077); the `docs/i18n.md` messages-seam bullet cites the
  `messages` member of `PhlixAppConfig` instead of a reflow-prone
  `types.d.ts` line-range (RT-081); two stale `CALIBER_LEARNINGS.md`
  entries now tell the current truth — the lock is committed and
  `npm ci --allow-git=all` with setup-node cache is live, and the pin
  convention spans the five gated doc surfaces — each keeping a
  historic-note tail (RT-079).
- `package/` assets regenerated: the entry chunk carries the new catalog
  strings, so its hash rotated and every importer re-hashed in cascade
  (31 renames + `index.html` script ref); rebuild verified deterministic
  x2.

### Fixed — remote digit presses echo the joined buffer as you type — 2026-11-07

- **What users see:** a number key on the remote now shows its digits on
  screen while they are being entered. A digit press previously produced
  ZERO feedback for the full 2 s buffer window — the caption layer stayed
  dead-air because the drain event itself is silent (no consumer yet).
  `RemoteManager.pressDigit` now echoes every ACCEPTED press with the joined
  pending value on a new `digit` observation channel, and
  `ActionToastOverlay` captions it ('1', then '12', …). The commit law is
  unchanged: `action` still carries exactly ONE silent `DIGIT_COMMIT` per
  burst (M-TIZEN-32's law untouched — the echo is per-press feedback, not a
  re-badged drain), refused digits (typing targets, auto-repeat, non-digit
  names) echo nothing, and the flood-cap overflow stays echo-silent — an
  abandoned burst has no value to honestly echo. Five new pins across the
  existing RemoteManager/ActionToastOverlay suites; committed sources
  rebuilt deterministically (package/ ×3). RT-070 (review tizen__gameux
  Info #6).

### Changed — documentation truth pass: S501 currency notes, locale-PIN lineage prose, scripts tree, ledger IDs out of public docs — 2026-11-07

- **What users see:** nothing on the TV surface — docs, comments and
  config prose only.
- `VERIFICATION.md`: every step and summary row citing `UpNextOverlay.vue`,
  `tests/unit/UpNextOverlay.test.ts` or `SleepTimerOverlay.vue` as LIVE now
  carries a **Currency (2026-11-07, S501 reconciliation)** note or marker —
  both components (and the UpNext suite) were deleted at S501 (PR #87,
  2026-09-16) as never-renderable duplicates of the @phlix/ui PlayerPage
  surfaces; the live truth was already in README/AGENTS. Historical text
  preserved verbatim per the history law (RT-071).
- `docs/i18n.md`: the 46-line run-on `@phlix/ui` seam paragraph is now short
  sentences plus a newest-first bulleted PIN lineage (v0.99.8 → .22 — all
  shas, `git diff -- src/i18n` outcomes, key counts and the 12-of-14 hash
  rotation law preserved), led by the current state and the measured fact
  that the installed v0.99.22 moved NO locale SOURCE (vendor holds at
  `01acaa12`). The present-tense '~412 strings' figure becomes the
  era-bound 526 (the v0.99.5-era historical '412 keys' row stands verbatim)
  (RT-072/RT-073).
- `README.md`: the `scripts/` tree now lists all eight files with one-line
  purposes (was two) (RT-074).
- Ledger hygiene (rows banked by the w09-L4 review): RT-## ticket IDs are
  scrubbed from `docs/`, `DEVELOPER.md` and `.github/` prose — sentences
  name the behavior, not the ticket; `.github/dependabot.yml` keeps ONE
  copy of the github-actions rationale (it had been stated twice); the
  `tests/unit/distApiFloor.test.ts` CSS census banner says 153 alongside
  its moved pin (the rotation-history comments keep their figures as
  history).

### Changed — w09-L4 Info-review hygiene: CI/Dependabot triggers, maintenance-script exposure, `100dvh`/`:focus-visible` governance pins, dead CSS removal — 2026-11-06

- **What users see:** nothing on the TV surface. These are registered Info-class
  review findings (crossfe/devops/gameux), and every change is either tooling
  wiring, a governance pin, or the deletion of code that never ran: the doubled
  `:focus-visible:focus-visible` arm was a no-op (an element cannot be "more"
  focused) and the `@media (max-width:640px)` density fallbacks could never fire
  on the fixed 1920 canvas. The widget rebuilds deterministically; the CSS
  surface is byte-identical apart from the removed dead rules.
- **RT-064 (devops Info #6):** `.github/workflows/lint.yml` + `test.yml` dropped
  `develop` from their `push`/`pull_request` branch lists (both already `[ master,
  main ]`); the repo has no `develop` branch, and `build.yml` already named only
  master/main — pure trigger hygiene.
- **RT-065 (devops Info #1):** `.github/dependabot.yml` gains a `github-actions`
  package-ecosystem alongside npm (weekly). The workflows float action MAJOR tags
  (checkout@v6 / setup-node@v6 / upload-artifact@v7 / download-artifact@v8 /
  softprops/action-gh-release@v3), so a new action major could previously ship
  with no PR signal.
- **RT-066 (devops Info #8):** `scripts/make-icon.js` (the sole provenance record
  for the shipped `app/icon.png`, copied into every widget by
  `scripts/package.js:50`) and `scripts/add-copyright.mjs` (idempotent header
  injector, never part of build/CI) are now exposed as `npm run icon:gen` /
  `npm run copyright:headers`, with a DEVELOPER.md pointer making the provenance
  chain discoverable. The `package` chain string is untouched, so
  `versionStamping.test.ts` stays green.
- **RT-067 (crossfe Info #6):** `tests/unit/distApiFloor.test.ts` pins the
  `100dvh` (Chrome 108) census at the measured 7 with its guard split (5 guarded
  theater heights behind `@supports not (height:100dvh)` fallbacks + 2 unguarded
  vendored menu/userpanel `max-height` clamps whose only loss on ≤ 107 is a
  cosmetic overflow clamp), and `docs/runtime-floor.md` gains the matching
  "CSS features above 85" row. The `@phlix/ui` double-declare cure for the two
  unguarded sites is upstream, outside this repo's pin scope.
- **RT-068 (crossfe Info #7 / gameux Info #1):** removed the redundant
  `.audio-track-list__item:focus-visible:focus-visible` and
  `.subtitle-track-list__item:focus-visible:focus-visible` arms in
  `src/components/AudioTrackList.vue` + `SubtitleTrackList.vue`, mirroring the
  ChapterList m14 cure. Bundle `:focus-visible` census moved 157→153 (−2 tokens
  per doubled selector × 2 files); the distApiFloor pin and the floor-doc
  table/attribution re-measured from the rebuilt bundle in the same commit.
- **RT-069 (gameux Info #7):** deleted the dead `@media (max-width: 640px)`
  density fallbacks in `src/screens/RecommendationsScreen.vue` +
  `src/pages/MusicPage.vue`; `index.html` pins the viewport `width=1920` so a
  desktop-width breakpoint can never fire. The live `minmax(200px)`/`minmax(180px)`
  auto-fill grids are the only density control; the legitimate
  `@media (prefers-reduced-motion)` queries are kept.
- **Banked add-on (one-token):** `tests/unit/quickconnect.test.ts:9` header said
  "the 410-tuple manifest"; the vendored manifest `provenance.total` is 415
  (serverSha `58530ec2`, matching `routeManifest.gate.test.ts:454`) — corrected
  to 415. The "410-tuple cs#47 canonical" note in `routeManifest.gate.test.ts:56`
  is accurate historical narrative and stands verbatim.

### Fixed — quick-connect redeem carries the pairing secret the server requires; the RT-058 posture note is corrected — 2026-11-06

- **What users see:** a TV pairing can now be redeemed at all. The shipped flow
  asked the server for the token pair with an EMPTY body, and the server answers
  every such request `400 secret is required` — so a pairing never completed on
  any server this client can talk to: the panel reached `approved` and fell
  straight to its error phase. What still does NOT work is the other half of the
  flow (named below, not fixed here): no estate client implements the companion's
  approve leg, so a pairing completing end-to-end remains future work. What
  changes today is that the TV's half is truthful about the wire.
- **Mechanism (w08-L4 review, Critical #2):** `PairingOffer`
  (`src/quickconnect/quickConnectClient.ts:62`) gains a required `secret`;
  `initiatePairing` parses it under its single wire name and FAILS LOUD when the
  answer omits one (`:133-136` — a code without a secret is a pairing that can
  never redeem, so it is refused at the boundary instead of being polled to a
  doomed approval); `redeemPairingToken` takes the OFFER rather than a bare code
  and posts `{secret}` in the body while the code stays in the path segment
  (`:199-206`) — the shape the server's `token()` demands
  (`phlix-server` `QuickConnectController.php:300-303`).
  `createPairingSession` hands the offer straight through
  (`quickConnectSession.ts:292`), so the credential has exactly one source, and
  the code it shows the viewer is the code ONLY (`:238-241`) — the secret never
  reaches the on-screen surface.
- **Ledger correction (Critical #1, forward per the verbatim-history law):** the
  entry below, and the docblock it describes, say "the pairing code is the sole
  redeem secret" with the residual bounded by "server-side code entropy and the
  approval TTL". The wire refutes all three clauses: `token()` takes the pairing
  secret from the request BODY (`QuickConnectController.php:300-303`), that secret
  is 32 random bytes as 43-char base64url (`QuickConnectStateStore.php:389-391`,
  entropy pinned by its own suite at `:60-64`), constant-time compared (`:261`)
  and one-shot with a 600 s window (`:63`), and the server's law on the code is
  the opposite — a guessed code reveals state to someone who "cannot redeem"
  (`QuickConnectController.php:49-50`). The requirement is original to the feature
  (S518, server `730e55b7`) and present at this client's pinned era `58530ec2`.
  The earlier entry stands verbatim as the record; this one is its correction. The
  docblock now states the secret is the bearer credential and the code only
  routes, and a source-grepped pin (comments flattened first, so a re-wrapped
  claim cannot slip past) refuses any return of the old wording.
- **Tests:** the fake transport finally speaks the server's wire — every initiate
  answer carries a realistic 43-char secret and every redeem pins the `{secret}`
  body (the pre-cure suite mentioned the secret zero times, so what it pinned was
  the bug). Five pins added: the real `{code, secret, expiresIn}` answer,
  fail-loud on a secretless initiate (transport AND session, with zero status
  traffic), the redeem body, the secret staying OUT of the request URL, and the
  note-truth grep; the session happy path now asserts the end-to-end
  carry-through. Battery 68 files / 1,162 passing / 0 skipped (was 1,157 — +5
  exact, no file added, so the arm-(e) census holds); red-first against the
  pre-cure source convicted 8 tests.
- **Named, not fixed (owner call, out of this card):** (1) the companion
  `POST …/quick-connect/{code}/approve` with `{secret}` exists on the server
  (`QuickConnectController.php:241-277`) and in the vendored manifest, but no
  estate client ships it, and this TV surfaces the code alone — the server's flow
  sketch (`:37`) has the QR carrying code + secret. Until a companion half lands,
  no pairing completes from a Tizen screen. (2) The server answers initiate with
  the RELATIVE `expiresIn` (`:186`) while `initiatePairing` parses the ABSOLUTE
  aliases `expires_at`/`expiresAt`, so the client-side expiry belt
  (`quickConnectSession.ts:255-258`) never arms against a real server. Both want
  their own waves with their own red-first pins.

### Fixed — the entry docs teach the shipped chain, count, cadence and CI story, not fossils; the quick-connect redeem docblock names its LAN race — 2026-11-06

- **What users see:** nothing at runtime — no behavior changed and the shipped
  bundle is byte-identical (the sole `src/` touch is a comment). What changes is
  what a reader is taught: `npm run package` now reads sync-first on every
  surface naming its legs (README command comment, AGENTS/CLAUDE command blocks
  + the CLAUDE chain sentence, all three `docs/signing.md` recipes — RT-062);
  the AGENTS.md/CLAUDE.md suite census reads 68 and is now machine-pinned by a
  new `docsTestListings` arm (e) that redds any future drift in the same commit
  that moves the count (RT-061, red-first against the stale 63); DEVELOPER.md's
  held-key cadence matches the retuned `RemoteManager` fields and cites the
  seam instead of hardening a bare number (RT-059); `docs/i18n.md` states the
  true CI checkout story — only this repo is checked out, the contracts
  manifest rides as the vendored fixture, the phlix-ui sibling is absent so
  source-parity skips (RT-060); README's workflow map names test.yml's three
  legs — vitest + coverage floor, tests/scripts typecheck, audit gate (RT-063).
- **Mechanism (RT-058, review tizen__secnet #2):** `redeemPairingToken` gains a
  posture-ledger paragraph — the pairing code is the sole redeem secret and
  travels in the URL path segment, so on the ratified http-permitted LAN
  baseline an on-path observer of the initiate response can attempt a
  race-redeem at approval; server-side code entropy and the approval TTL own
  the residual. Naming only; zero code change.
- **Ledger correction (forward, per the w07-L6 review minor):** the c999d4a1
  commit-message prose double-counted pins — disk truth is 10 pure + 1 mount
  for RT-054, and RT-053's own pins are 2 mount pins (the third parent-side
  WireShape red belongs to RT-054). The entry's +22 battery total was and
  remains exact; only the per-RT prose was inflated.

### Security — quick-connect base mirror passes the storage gate; hub relay mint refuses plaintext (2026-11-06)

- **What users see:** nothing changes on healthy setups. A TV paired against
  a hand-poisoned server base (e.g. a `javascript:` address seeded into
  storage) no longer persists that poison back into `phlix.serverUrl` — the
  pairing itself still lands, because the credential pair is real. Tizen
  hubs reached over a plain-HTTP hub base now fail the relay-token mint
  immediately instead of sending the hub JWT in the clear to a scheme the
  socket law would refuse at dial time anyway.
- **Mechanism (RT-056, review tizen__secnet #1):** `QuickConnectPanel`
  applyTokens now routes the base through the same
  `sanitizeServerAddress` + `pushAddressHistory` edge as the Connect
  writers (refuse → warn, no write; accept → mirror + become a re-seed
  candidate). The `phlix.serverUrl` writer census (exactly two writers,
  both gated) is recorded in the `resolveConfig` header.
- **Mechanism (RT-057, review tizen__secnet #3):** `mintHubRelayToken`
  gained an `allowInsecure` parameter (default: the
  `VITE_PHLIX_DEV_ALLOW_INSECURE_RELAY` hatch, same as the dial gate) and
  throws `HubRelayInsecureTransportError` before any fetch on plaintext
  http bases — the provider's existing reject-arm already degrades a
  failed mint to null, so no call-site change. Tests that genuinely mint
  moved to https bases; the two never-fetch provider pins deliberately
  stayed http to prove the guard does not leak into non-mint paths.

### Fixed — pairing codes can't be stamped by dead sessions; parental schedule form opens on demand; poison schedule rows degrade per-row; recommendation failures name the cause (2026-11-06)

- **What users see:** starting a second pairing (dismiss-then-re-offer or a
  base change) can no longer flash a stale short code from the abandoned
  first attempt onto the live panel. The parental-controls schedule editor
  starts closed — it used to sit open on every visit because its `v-if`
  ended in `|| true` — and one malformed row from a degraded server drops
  just that row instead of blanking the whole schedules panel with a
  TypeError. When recommendations fail to load, the screen says so in the
  app's own language first, with the raw network error underneath as
  detail (previously a raw axios string replaced the localized headline).
- **Mechanism (RT-055, review tizen__exploiter #4):** `createPairingSession`
  keeps a named handle, re-checks `stopped` after the initiate round-trip
  resolves BEFORE publishing the code, and stamps its own identity into
  `onCode(code, expiresAt, session)`; the panel accepts a code only from
  the session it currently holds.
- **Mechanism (RT-053, review tizen__exploiter #6):** explicit
  `scheduleFormOpen` ref driven by start/cancel/save, replacing the
  scaffold's always-true condition.
- **Mechanism (RT-054, review tizen__exploiter #5):** new pure
  `src/parentalScheduleRows.ts` validates each wire row against the
  contracts `AccessSchedule` shape (integer id, string name, clock-formatted
  times with bounds, all-valid day lists, boolean `is_active`,
  `profileId`/`profile_id` both accepted); invalid rows are DROPPED, which
  is the safe direction for access windows — a partially-repaired schedule
  could silently widen a child's allowed time.
- **Mechanism (RT-052, review tizen__casualgamer #4):** headline is always
  the catalog key; `errorDetail` carries the raw message only when the
  throw is an `Error`.
- Also: comment-only currency — the `phlix.serverUrl`/era-stamp notes in
  `resolveConfig.ts` and `quickConnectClient.ts` now state the 415-tuple
  fixture era (contracts #v0.5.6) instead of the retired 412-tuple one.

### Fixed — quick-connect refusal no longer blames the network; telemetry consent says only what is true; CSS-census red forward-fixed (2026-11-06)

- **What users see:** pairing a TV against an old server now says "This
  server can’t do code sign-in yet — it needs updating. Use your password
  instead." instead of "Could not reach the server." (never true of a server
  that answered); the telemetry consent card no longer promises "You can
  change this anytime" — that surface does not exist — and states the card is
  the only place to decide, nothing sent until you choose.
- RT-050 (review tizen__casualgamer #2): `createPairingSession` splits initiate
  failures by ANSWER — an answered 4xx (a pre-quick-connect server 404-ing the
  unknown route, or a 400/405 refusal) resolves the new calm terminal phase
  `unsupported`; the status is read STRUCTURALLY off the thrown value (ui's
  `ApiError` carries it; no upstream class identity, plain-Error fakes stay
  honest), while no-answer throws keep the network-blaming `error`, and 429
  plus 5xx deliberately stay retry-bearing `error` — a rate limit or a broken
  endpoint is not a capability refusal. `unsupported` shows NO "Try again"
  (re-asking an old server cannot change its answer); the always-mounted
  password pill is the exit the copy names. New key `quickConnect.unsupported`
  across all seven Tizen locales; session pins cover 400/404/405, no-answer,
  429 and 503; the panel suite pins both arms plus the retry absence.
- RT-051 (review tizen__casualgamer #3): `telemetry.body` reworded ×7 locales to
  the `CONSENT_KEY` truth — the card is the only decision surface (a Settings
  row stays an unshipped future option; nothing in the vendored ui bundle or
  this client reopens the decision). The `tizenI18n` EN copy pin rotates in
  the same commit.
- The Tizen-OWN catalog key-count pin rotates 188→189 from the measured red in
  this adding commit (the `TizenCatalog` satisfies law + the both-directions
  key-set identity held across all seven locales without a single edit); the
  vendored ui-bundle locale PINs are UNTOUCHED — this lane ships no ui-catalog
  bytes and the v0.99.22 hold stays byte-true.
- **Attributed forward-fix (pre-existing at tip):** the `distApiFloor` CSS
  census was red on master — `inset:` measured 42 against the pinned 41. The
  site arrived with the ui #v0.99.22 re-vendor's ambient-canvas cure
  (selector-set diff of the then-committed `index-DzrZJodb.css` against the
  v0.99.21 `index-u1vjsYdH.css`; the release commit's gates claim predates
  it). The pin rotates to 42 here and `docs/runtime-floor.md` re-derives its
  table row in the same change (every other figure held).

### Changed — route-manifest fixture takes the 415-tuple re-vendor; stale-era docblock stamps cured; package/ regenerated (2026-11-06)

- LW-033 (behavior-neutral): `tests/fixtures/server-route-manifest.json`
  re-vendored byte-identical to the pinned contracts #v0.5.6 artifact —
  412→415 tuples, server `58530ec2…`, md5 `90b79e35…` (cs#48's estate-wide
  rotation; Tizen was the last hold-out). The three additions
  (`GET /api/v1/me/history`, `GET /api/v1/servers/{id}`,
  `GET /api/v1/users/me/history`) are additions-only and never issued from this
  client — the gate's per-file scan coverage stays 27, and the S279 dead-rail
  tripwires re-verified false on the new bytes. Provenance pins (serverSha /
  total / length / md5 / unique) rotated from the measured two-assert red
  inside this commit; the header narrative's false "shares disposition with the
  console/roku CHECK legs this wave" cross-claim (both had already moved) is
  corrected in the same pass. The gate reads the vendored fixture only — zero
  behavior change.
- LW-035: `VERIFICATION.md` Step 1.4 carries the audit-date-annotation —
  `@phlix/tokens` rides #v0.2.1 through the ui devPin era (append-style
  correction; the v0.1.1 finding line stays as history).
- LW-037-a / LW-038: the register-named stale-era stamps are cured — `main.ts`
  drops "(v0.53.0)" (a phlix-shared version line has no place crediting the
  `playerHlsConfig` seam; cited by name, re-verified in the vendored dist) and
  the `v0.99.10` errorHandler-provenance literal (the no-default-handler claim
  re-grep-proven against the pinned bundle: zero `config.errorHandler`);
  `syncplayDispatch.ts`'s dead premise is rewritten — v0.99.0 did NOT predate
  `resolvePendingMedia`: the prop exists on the vendored `Player.vue` surface
  but carries no `createPhlixApp` config seam, so this module remains the
  Tizen half of the load path (conclusion stands, reasoning corrected); the
  admin CSS docblock now records the UI-3.3 REJECTION upstream (the split
  orphaned ~248 KB and shipped the app unstyled; the `dist-css-bundle` guard
  holds) instead of calling it an open follow-up — posture ACCEPT-TV-COST, with
  the measured current sizes (ui `style.css` ~447 KB; widget entry CSS ~482 KB).
- `package/` regenerated in this commit (shipped JS + i18n changed):
  deterministic ×2, 42 files, aggregate md5 `635c697f12a16f1c59e8c98afc02d1e5`
  (recipe: `find package -type f | LC_ALL=C sort | xargs md5sum | md5sum`),
  entry chunk rotated (`index-Yld_BPQH.js`), zero `0.99.21` residue, version
  stamp `0.99.22` carried.
- Gates: vitest serial 66 files / 1133 passed (baseline 1128, +5 new pins
  disclosed above, +1 red cured); `typecheck`, `typecheck:tests`, `lint` all
  clean.

### Changed — ui #v0.99.22 re-pin: the player presents its full frame rate (no live CSS blurs on the playing path); locale PIN held; package/ regenerated (2026-11-06)

- **What users see:** smoother video. v0.99.22 stops the player page re-rasterising
  live CSS blurs on every video repaint — the poster backdrop and the ambient glow are
  pre-rendered to small bitmaps and the hidden chrome drops its `backdrop-filter`
  (field-measured on desktop Firefox: ~6–9 presented fps → ~24). Tizen's Chromium
  webview runs the same page, so it no longer pays that compositing cost either.
- **Pin leg:** `@phlix/ui` `#v0.99.21` → `#v0.99.22` (tag object `abc9566c`, peel
  `a4ede939` == ui master tip, ls-remote verified). `package-lock.json` surgical 3+/3-
  (root edge spec + ui node version/resolved — resolved lands on the peel); contracts
  `#v0.5.6` + syncplay `#v0.1.7` held. Fresh `npm ci`: `dist/phlix-ui.js` `a3a8aa84`.
  Pin docs rotated (README ×2, CLAUDE.md, DEVELOPER.md, AGENTS.md, `docs/i18n.md`
  installed-pin line, `docs/ui-port-divergence.md` pin header ×2); dated
  "re-verified at v0.99.21" history lines left verbatim.
- **Locale leg:** PIN HELD — `git diff 01acaa12..a4ede939 -- src/i18n` is EMPTY in ui
  (the release touched only player code), so ref, hashes and SOURCE_REF hold;
  `i18nLocales` suites green unchanged.
- **Widget leg:** `package/` regenerated via `npm run package` (version-sync idempotent,
  zero config.xml/telemetry churn); deterministic ×2 (`diff -r` clean); 42 files,
  aggregate md5 (`find package -type f | sort | xargs md5sum | md5sum`)
  `92c3abcc0623239d0166aaedc7fd5d2d`; ui stamp `0.99.22` on `index-DwbVGWf9.js`, zero
  `0.99.21` residue; carrier `PlayerPage-BbWPOZn8-DNp0W6Cc.js` carries `is-preblurred`.
- **Gates:** vitest 66 files / 1128 tests (incl. docsPinConsistency); lint 0; typecheck
  0; typecheck:tests 0.

### Changed — ui #v0.99.21 re-pin: theme choices now persist per-user server-side; Appearance-picker disclosures + catalogue force-refresh; locale bundles REAL re-vendor (PIN rotated 524→526) — 2026-11-06

- **What users see:** a theme picked on this TV follows the signed-in user
  across devices and sessions — the Appearance choice round-trips through the
  EXISTING `GET|PUT /api/v1/users/me/settings` account endpoint (the same seam
  the track-language memory already reuses; zero new routes), and a choice
  made on another portal/device is adopted on login. When the theme catalogue
  cannot load, or a save stays device-only, the picker now says so honestly
  instead of degrading silently; a plugin enabled after page load surfaces in
  the picker without a full reload (catalogue force-refresh at mount); the
  Plugins page carries the per-user theme copy. Requires a phlix-server at
  `7d15183b`-shape for persistence; against older servers the sync is a silent
  no-op and every prior behavior stands.
- **Pin leg:** `@phlix/ui` `#v0.99.20`→`#v0.99.21` (one tag crossed; tag object
  `bf70c58f1f1dc0fbb549cd6f69a3c807875b9a03`, peel
  `01acaa1264736fa9c744fc902044c9ad511b93ba` == ui master tip, ls-remote
  verified; codeload 200 @ 26,780,271 B; v0.99.20 peel proven ancestor).
  `package-lock.json` surgical 3+/3- (root edge spec + ui node version/
  resolved — resolved lands on the peel); contracts `#v0.5.6` + syncplay
  `#v0.1.7` HELD — the tag's own `package.json` carries the identical edges
  (checked, not recalled). npm11 idempotency proven (2nd install
  byte-identical); installed tree `diff -r` vs the codeload tag payload: zero
  content differences (only-in-tag = ui source, correctly excluded by
  `files:[dist]`); `dist/phlix-ui.js` md5 `7e4c16b5b1bd3c2630e8c1435875f992`,
  `dist/player.js` md5 `fcb3596cf78dc7ecf67228b18b31152e` and carrier
  `PlayerPage-BTz2s3yI.js` md5 `5b5ac8271efe2ab3ce8c808bc29ea326` all match
  the .21 release register.
- **Locale leg:** REAL re-vendor — the .20 held run ends: `git diff
  a6c9d466..01acaa12 -- src/i18n` NON-empty (the six bundle files + the
  installed `messages.ts` each gained the `settings.themeCatalogueUnavailable`
  + `settings.themeSavedLocally` leaves, catalog 524→526, +2 per locale × 6).
  RED-FIRST measured on the .21 install BEFORE the sync — both equality legs
  red: `es missing installed keys: ['settings.themeCatalogueUnavailable',
  'settings.themeSavedLocally']` and `expected 526 to be 524` (raw log
  retained with this lane's register). Re-synced at the peel via
  `scripts/sync-ui-locale-bundles.mjs --ref 01acaa12…`; ref
  `a6c9d466`→`01acaa12` and 12 of the fourteen PIN hashes ROTATED (source +
  vendored pair for each of six bundle files), the index.ts pair HOLDING
  byte-identical (`f5c2011a` source / `fb4fa495` vendored — ui's locales
  `index.ts` is byte-stable across the pin, the fourth wave running);
  `SOURCE_REF` in the sync script rotated with the PIN (the suite hard-pins
  constant == PIN); era docblock rewritten in
  `tests/unit/i18nLocales.test.ts`. Post-sync: all three locale suites green
  (90 tests, incl. the sibling SOURCE-parity leg at the real peel).
- **Widget leg:** `package/` regenerated — 31 JS chunk renames + `index.html`
  rewire + the entry CSS chunk ROTATED `index-BqeiLgxA.css` →
  `index-u1vjsYdH.css` (the `.aps__hint` disclosure styles from the .21 theme
  wave crossed it; it had held since the .17 re-greps). PlayerPage carrier
  rotated `PlayerPage-BUnWXFam-*` → `PlayerPage-BTz2s3yI-C5eG8fum.js` (the ui
  register flagged this rotation for consumers up front). Embedded ui stamp
  `0.99.20`→`0.99.21` single site (`index-BS813AAP.js`), zero stale. LAW
  GREPS: `playlist_url`, `_master.m3u8` and `rung mini-master unavailable`
  ship in the new carrier; the new `users/me/settings` +
  `themeCatalogueUnavailable` strings ship in `index-*.js` (the latter also in
  `SettingsPage-*.js`). Determinism ×2 `diff -r`-identical; aggregate md5
  under the disclosed recipe `find package -type f | sort | xargs md5sum |
  md5sum`: `90359d9a6ea00502387f29daf8e6e51a` (.20 bytes) →
  `fa496906e734400922df55595773b896` (.21 bytes), 42 files (the .20 entry's
  `022d5991…` figure predates recipe disclosure and is not re-derivable here —
  determinism rides the `diff -r` proof, not the aggregate). Freshness-gate
  sim after staging: rebuild left `package/` byte-identical to the index
  (build.yml "Assert committed package/ is fresh" holds).
- **Gate ledgers advanced (measured, not recalled):** serial vitest EXACT 66
  files / 1128 tests / 0 skipped at the PARENT tree AND post-change — zero
  suite churn (the .21 feature rides entirely inside the sealed bundle; no
  host-side test is added or moved). docsPinConsistency MEASURED 6 red arms
  (badge, Tech Stack, DEVELOPER, i18n seam, AGENTS, CLAUDE) → rotated → 9/9.
  `distApiFloor` NOT rotated — green on the new bytes. typecheck 0;
  typecheck:tests 0; lint 0; audit-gate PASS (same 2 allow-listed dev-chain
  ids, zero new); build rc 0; package rc 0 ×2 + post-stage ×1.
- **Docs leg:** README badge + Tech Stack, DEVELOPER, AGENTS, CLAUDE,
  docs/i18n seam rotated; docs/ui-port-divergence six rows re-grepped at
  v0.99.21 bytes — all FACT-UNCHANGED (wsUrl/wsPath still `SyncPlayModal-*.js`
  + `index-*.js`; canManagePlaylist recursive dist count re-measured 5;
  `(shared — read-only)` picker still `index-*.js` — the widget build still
  folds MediaCard into index; invite-links still `McpTokensPage-*` only with
  codes + `redeem` in `index-*.js`; `new Audio` still 1 `MusicLibraryPage-*`
  site with `mediaSession` video-path-only; escape pattern still
  `useItemInspector-*.js`; bare `access_token` hoist name walked `Zr`→`Xr` at
  .21 — minifier churn, the LITERAL law holds; chain through v0.99.21).

### Changed — ui #v0.99.20 re-pin: the bundle consumes server-minted signed playlist URLs verbatim (pinned-quality "can't play" class closed); locale PIN held — 2026-11-06

- **What users see:** the fresh-tab pinned-quality failure introduced by the
  .18/.19 mini-master wave closes on this widget. v0.99.19 derived the per-rung
  mini-master URL by appending `_master.m3u8` client-side — onto a SIGNED
  `?exp=…&sig=…` URL that put the filename INSIDE the signature value and the
  extension-less path before the query, so every pinned pick 404'd loudly
  (the 2026-11-06 hub.phlix "can't play it" incident, job 6df5ca50). The ui now
  loads `playlist_url` — each playable variant's own signed mini-master index,
  advertised beside the signed bare `url` by phlix-server — VERBATIM for probe
  and load, falls back to the advertised `url` on a decisive 404, and derives
  only for a rung the ladder never advertises, strictly PATH-scoped (split at
  `?`, rename in the path, re-append the query — the prefix-scoped signer
  authorises every file under `/hls/{job}`). Auto-quality and the
  `master.m3u8` path are untouched; interim mitigation (picking Auto) stays
  harmless.
- **Pin leg:** `@phlix/ui` `#v0.99.19`→`#v0.99.20` (one tag crossed; tag object
  `bab302e2ef9d124a3f27c54caf6e582e98a6b270`, peel
  `e48d8d029cbf81b2e92c93e0a6914765330718b1` == ui master tip, ls-remote
  verified; codeload 200; v0.99.19 proven ancestor). `package-lock.json`
  surgical 3+/3- (root edge spec + ui node version/resolved — resolved lands on
  the peel); contracts `#v0.5.6` + syncplay `#v0.1.7` HELD — the tag's own
  `package.json` carries the identical edges (checked, not recalled). npm11
  idempotency proven (2nd install byte-identical); installed tree `diff -r` vs
  the codeload tag payload: zero content differences (only-in-tag = ui source,
  correctly excluded by `files:[dist]`); `dist/phlix-ui.js` md5
  `818e5829e510ade58b140ad451b7b10e` and `dist/player.js` md5
  `ca81bb6e71763f6cd80a2494ef40519f` match the .20 release register; carrier
  `PlayerPage-BUnWXFam.js` present.
- **Locale leg:** PIN HELD — `git diff a6c9d466..e48d8d02 -- src/i18n` is EMPTY
  and all seven v0.99.20 tag-payload locale files re-hash EXACTLY to their
  `PIN.source_sha256`; ref, all fourteen hashes and `SOURCE_REF` untouched; era
  comment advanced in `tests/unit/i18nLocales.test.ts` (stamp-only).
- **Widget leg:** `package/` regenerated — 31 JS chunk renames + `index.html`
  rewire; the entry CSS chunk `index-BqeiLgxA.css` HOLDS (this wave crossed no
  scoped-style edits). Embedded ui stamp `0.99.19`→`0.99.20` single site
  (`index-2q1ZxDUw.js`), zero stale. LAW GREPS: `playlist_url`,
  `_master.m3u8` and the fallback wording `rung mini-master unavailable` all
  ship in `PlayerPage-BUnWXFam-DsOXQs9M.js` (the installed `dist/player.js`
  likewise). Determinism ×2 `diff -r`-identical; aggregate md5
  `6baff…`-era lineage: `6b5415c76d609960be825b309f794d58` →
  `022d5991152490307e676d2c01dbc035` (42 files). Freshness-gate sim after
  staging: rebuild left `package/` byte-identical to the index (build.yml
  "Assert committed package/ is fresh" holds).
- **Gate ledgers advanced (measured, not recalled):** serial vitest EXACT 66
  files / 1128 tests / 0 skipped at the PARENT tree AND post-change — zero
  suite churn. docsPinConsistency MEASURED 6 red arms → rotated → 9/9.
  `distApiFloor` NOT rotated — green on the new bytes (pins measure content,
  not chunk names). typecheck 0; typecheck:tests 0; lint 0; audit-gate PASS
  (same 2 allow-listed dev-chain ids, zero new); build rc 0; package rc 0 ×2.
- **Docs leg:** README badge + Tech Stack, DEVELOPER, AGENTS, CLAUDE, docs/i18n
  seam rotated; docs/ui-port-divergence six rows re-grepped at v0.99.20 bytes —
  all FACT-UNCHANGED (wsUrl/wsPath still `SyncPlayModal-*.js` + `index-*.js`;
  canManagePlaylist recursive dist count re-measured 5; `(shared — read-only)`
  picker still `index-*.js`; invite-links still `McpTokensPage-*` only with
  codes + `redeem` in `index-*.js`; `new Audio` still 1 `MusicLibraryPage-*`
  site with `mediaSession` video-path-only; escape pattern still
  `useItemInspector-*.js`; bare `access_token` still `var Zr=` — chain extended
  through v0.99.20).

### Changed — ui #v0.99.19 re-pin (two tags crossed): mini-master audio cure + stale-menu fix ride the bundle; locale bundles REAL re-vendor — 2026-11-06

- **What users see:** the hosted-TV playback silence class closes on this
  widget. Pinned-quality loads now ride per-rung `media_v*_master.m3u8`
  mini-master indexes (ui v0.99.18 RUNGMASTER — hls.js drops `EXT-X-MEDIA`
  renditions on bare-playlist loads, so multi-audio sources shipped silent
  video; the index restores the audio group), with a HEAD-404 fallback to the
  legacy bare URL for pre-1035e7de servers (one probe per quality pick), a
  synthesized "Original" audio entry for muxed-audio HLS (single-track sources
  get the menu option back; copy = new `player.audioOriginal` leaf), and an
  audio menu that no longer lists stale renditions after the pin path
  (the stale-track sync cure). The six vendored locales each gained the
  `audioOriginal` string (catalog 523→524) — this wave is a REAL locale
  re-vendor, not a held pin.
- **Pin leg:** `@phlix/ui` `#v0.99.17`→`#v0.99.19` (annotated tag object
  `f9b89669d6d9e567373bd21f4ea7601dad4f497e`, peel
  `a6c9d466a9a8d99076128c0c9928d99de0cc14b7` == ui master tip at dispatch,
  origin-verified via ls-remote; codeload 200), tag-form per the repo pin law.
  `package-lock.json` SURGICAL 3+/3−: the root edge spec and the ui node
  `version`/`resolved` (→ peel, full-40). `@phlix/contracts` `#v0.5.6` and
  `@phlix/syncplay` `#v0.1.7` root pins HELD — ui v0.99.19 declares the same
  edges (verified against the tag's `package.json`, not recalled). Venue:
  NPM_CONFIG_USERCONFIG=/dev/null + `npx --yes npm@11 install`; SECOND install
  byte-identical (idempotency proven). Supply chain: installed
  `node_modules/@phlix/ui` (889 files) `diff -r` against the codeload
  v0.99.19 tag tree = ZERO shared-file content differences (19 only-in-tag
  entries: ui source/configs, correctly excluded by `files: ["dist"]`);
  `dist/phlix-ui.js` md5 `feadba0155082abfd8178f0a19ebaf4d` and `dist/player.js`
  md5 `9af331187aff3c7a7a555c7216e7ff07` — both match the release register;
  the carriers rotated as registered: `PlayerPage-kwMAZlDu.js` md5
  `2aba040e291a38be42da1a7e7d99f4b6` + `PlayerPage-DAswZ8i8.cjs` md5
  `14a50c008b001f47f6b697d047513f27`.
- **Locale leg (REAL re-vendor — verified, not assumed):** the held run of
  `36c04fbe` ended. Upstream `git diff 2158564a..a6c9d466 -- src/i18n` is
  NON-empty (six bundle files + `messages.ts` gained `player.audioOriginal`;
  `errors.ts` delta is docblock wording; `locales.test.ts` is ui-internal) —
  while `git diff b958fb574..2158564a -- src/i18n` (the v0.99.18 leg) is
  EMPTY, so one re-anchor crossed the held .18 stamp and the moving .19 wave
  together. MEASURED RED-FIRST before the sync: `i18nLocales` reddened
  exactly the two equality legs (`es missing installed keys:
  ['player.audioOriginal']`, `524 ≠ 523`). `scripts/sync-ui-locale-bundles.mjs
  --ref a6c9d466…` re-vendored: the six bundles each +1 line, the index.ts
  pair byte-HOLDING as ever; PIN ref `36c04fbe`→`a6c9d466` with 12 of the
  fourteen hashes rotating; the `SOURCE_REF` bootstrap constant re-anchored
  the SAME commit (drift fails `PIN↔SOURCE_REF` pin); era comment rewritten
  with the two-era narrative + measured-red disclosure.
- **Widget leg:** `package/` regenerated — 32 chunk renames + the `index.html`
  entry rewire; the `index-*.css` chunk rotated AGAIN
  (`index-aXIOf-KD`→`index-BqeiLgxA`) — bundle-substantive: the
  CaptionsMenu/Player edits move scoped styles. Embedded ui version stamp
  `0.99.17`→`0.99.19` (single site in `index-D6A1amz-.js`; zero stale
  `0.99.17` strings in `package/`). LAW GREP: `_master.m3u8` ships in
  `PlayerPage-kwMAZlDu-pDFpVY3j.js` (also in the installed `dist/player.js`);
  `audioOriginal` rides `index-*.js` + the PlayerPage chunk (compiled locale
  bundles). Determinism: two consecutive `npm run package` builds
  `diff -r`-identical, re-attested this turn. AGGREGATE-MD5 recipe (as last
  waves): `7382e4fa4c4a7ed32ccb5cde7a0dc6ca`→`6b5415c76d609960be825b309f794d58`
  (42 files). Freshness-gate sim after staging: rebuild left `package/`
  byte-identical to the index (build.yml "Assert committed package/ is
  fresh" holds).
- **Gate ledgers advanced (measured, not recalled):** serial vitest EXACT
  66 files / 1128 tests / 0 skipped at the PARENT tree AND post-change — zero
  suite churn this wave. docsPinConsistency MEASURED 6 red arms → rotated →
  9/9. `distApiFloor` NOT rotated — green on the new bytes (the pins measure
  content, not chunk names). typecheck 0; typecheck:tests 0; lint 0;
  audit-gate PASS (same 2 allow-listed dev-chain ids, zero new); build rc 0;
  package rc 0 ×2.
- **Docs leg:** README badge + Tech Stack, DEVELOPER, AGENTS, CLAUDE,
  docs/i18n seam rotated to `v0.99.19`; the i18n seam narrative rewritten for
  the moved PIN ref (`36c04fbe` held-run ended → `a6c9d466`, 12/14 rotating);
  the divergence ledger's six rows re-grepped at v0.99.19 bytes — all
  FACT-UNCHANGED (`wsUrl` ships in `SyncPlayModal-*.js` + `index-*.js`;
  `canManagePlaylist` recursive count RE-MEASURED 5 + the
  `(shared — read-only)` picker literal still rides `index-*.js`;
  `invite-links` still McpTokensPage-only; `new Audio` still 1
  `MusicLibraryPage-*.js` site with `mediaSession` video-path-only;
  the innerHTML-escape pattern still `useItemInspector-*.js`; bare
  `"access_token"` still hoisted as `var Zr=` — chain extended through
  v0.99.19). Era stamps advanced.

### Changed — ui #v0.99.17 re-pin: PLAYERMUTE cure rides the bundle; locale PIN HELD again — 2026-11-06

- **What users see:** one playback behavior change reaches the TV — an
  autoplay-forced mute no longer leaks across media items (ui PLAYERMUTE
  cure: the forced mute is tagged as such and released when the next item
  loads, so one blocked autoplay no longer silences everything after it).
  The bundle's `usePlayerStore` typing gains the ADDITIVE members
  `autoplayMuted` / `muteForAutoplay` (nothing removed; vue-tsc green).
  Copy is stable: the six vendored locale bundles are byte-stable across
  this ui wave.
- **Pin leg:** `@phlix/ui` `#v0.99.16`→`#v0.99.17` (annotated tag object
  `4515df9c`, peel `b958fb574744bb490ff573d70f7fbe134bdf721f` == ui master
  tip at dispatch, origin-verified via ls-remote), tag-form per the repo pin
  law. `package-lock.json` SURGICAL 3+/3−: the root edge spec and the ui node
  `version`/`resolved` (→ peel, full-40). `@phlix/contracts` `#v0.5.6` and
  `@phlix/syncplay` `#v0.1.7` root pins HELD — ui v0.99.17 ships the same
  edges, so no as-published drift was reintroduced. Venue:
  NPM_CONFIG_USERCONFIG=/dev/null + `npx --yes npm@11 install`; SECOND
  install byte-identical (idempotency proven). Supply chain: installed
  `node_modules/@phlix/ui` (889 files) `diff -r` against the codeload
  v0.99.17 tag tree = ZERO shared-file content differences (the only-in-tag
  entries are ui's source/vite configs, correctly excluded by
  `files: ["dist"]`); installed `package.json` byte-identical to the tag;
  `dist/phlix-ui.js` md5 `e00ff69ccfb857c9ec011ded49fbe042` and
  `dist/player.js` md5 `903b503cfeee4e22420d653a0dae590a` — both match the
  release register; the fix chunk `usePlayerStore-BpohCwDP.js` is present.
- **Locale leg (PIN HELD — verified, not assumed):** upstream `git diff
  4d89b3a7..b958fb574 -- src/i18n` is EMPTY and all seven tag-payload
  `src/i18n/locales` files re-hash EXACTLY to the `PIN.source_sha256` values
  — ref `36c04fbe`, all fourteen hashes and `SOURCE_REF` UNTOUCHED for the
  SECOND consecutive wave. `tests/unit/i18nLocales.test.ts` green against the
  INSTALLED v0.99.17 catalog, incl. both key-set equality directions; only
  its era comment advanced (stamp-only).
- **Widget leg:** `package/` regenerated — 32 chunk renames + the
  `index.html` entry rewire; UNLIKE the v0.99.16 wave the `index-*.css`
  chunk ROTATED (`index-C0I6qGRy`→`index-aXIOf-KD`) — this wave is
  bundle-substantive (the Player.vue edit moves its scoped-style hash, so
  CSS bytes genuinely changed). Embedded ui version stamp `0.99.16`→`0.99.17`
  (single site in `index-*.js` — the M-UI-23 stamp; zero stale `0.99.16`
  strings in `package/`). The cure ships in the widget: `muteForAutoplay`
  greps to `index-*.js` + `PlayerPage-*.js` chunks. Determinism: two
  consecutive `npm run package` builds `diff -r`-identical, re-attested this
  turn. AGGREGATE-MD5 recipe (as last wave):
  `b1f57c27c042ea1710f97b375a15ad3a`→`7382e4fa4c4a7ed32ccb5cde7a0dc6ca`
  (42 files). Freshness-gate sim after staging: rebuild left `package/`
  byte-identical to the index (build.yml "Assert committed package/ is
  fresh" holds).
- **Gate ledgers advanced (comment-only, 0 behavior):** the routeManifest
  gate's vendored fixture STAYS at the 412-era bytes — the contracts pin did
  not move this wave (re-vendor #36 duty already discharged at v0.99.16).
  `distApiFloor` NOT rotated — measured green on the new bundle: CSS census
  holds (`:focus-visible` 157, `inset:` 41, `aspect-ratio` 36,
  `accent-color` 8, `:has(` 1) and the JS census + entry-polyfill +
  version-stamping laws all pass; the pins measure content, not chunk names,
  so the 32 renames are inert to them.
- **Docs leg:** docsPinConsistency MEASURED 6 red arms (README badge, README
  Tech Stack, DEVELOPER, docs/i18n seam, AGENTS, CLAUDE) → rotated → 9/9.
  docs/i18n.md seam narrative now records the TWO-consecutive-held-waves run
  with both `git diff` proofs; the divergence ledger's six rows re-grepped
  against the fresh v0.99.17 bundle bytes — ALL FACT-UNCHANGED (wsPath rides
  `SyncPlayModal-*.js`+`index-*.js`; picker literal `(shared — read-only)` in
  the index chunk only, MediaCard still folded; invite paths/codes ship —
  with a precision CORRECTION: `invite-links` greps ONLY to
  `McpTokensPage-*.js`, the prior wording also listing `index-*.js` was
  imprecise even at the v0.99.16 bytes (count 0 there), and the codes +
  `redeem` leg ride `index-*.js`; `new Audio` 1 site, `mediaSession`
  video-only; `replace(/&/g` still in `useItemInspector-*.js`; auth hoist
  `var Zr="access_token"` stable across v0.99.15→16→17). The closed
  canManagePlaylist bookend row was RE-STAMPED rather than deleted (recursive
  count re-measured 5) — it says "delete it in the next touch"; deleting
  ledger history is outside a pin-bump lane's remit and is left to a docs
  wave.
- **Baseline + Gates:** full serial vitest at the PARENT measured 66 files /
  1128 tests / 0 skipped, and EXACT at this tree post-rotation (no test
  gained, none lost). lint 0, `vue-tsc` src 0, `typecheck:tests` 0,
  `node scripts/audit-gate.mjs` PASS (same 2 allow-listed dev-chain advisory
  ids, zero new), `npm run build` rc 0, `npm run package` rc 0 ×2.

### Changed — ui #v0.99.16 + contracts #v0.5.6 re-pin: locale PIN HELD + widget bundle regen — 2026-11-04

- **What users see:** nothing on the copy front — the six vendored locale
  bundles are byte-stable across this ui wave, so TV strings do not move.
  The shipped widget bundle is regenerated at the new era (embedded version
  stamp + chunk-hash renames only); app behavior is unchanged.
- **Pin leg:** `@phlix/ui` `#v0.99.15`→`#v0.99.16` (annotated tag object
  `743a4b38`, peel `4d89b3a7` == ui master tip at dispatch, origin-verified
  via ls-remote) and `@phlix/contracts` `#v0.5.5`→`#v0.5.6` (tag object
  `9f04fc50`, peel `c89c8420`), both tag-form per the repo pin law.
  `package-lock.json` SURGICAL 7+/7−: the two root edge specs, the ui node
  `version`/`resolved` (→ peel, full-40), the contracts node
  `version`/`resolved` (→ peel, full-40), and the ui as-published
  `@phlix/contracts` edge `#v0.5.5`→`#v0.5.6` — EQUALS the root spec, so the
  v0.99.15 wave's hoist-asymmetry cure stays cured. `@phlix/syncplay`
  `#v0.1.7` root pin HELD (ui ships the same edge). Venue:
  NPM_CONFIG_USERCONFIG=/dev/null + `npx --yes npm@11 install`; SECOND
  install byte-identical (idempotency proven); installed-vs-tag payload byte
  identity via codeload tarballs: `dist/phlix-ui.js` sha256 `df46896e…`,
  `dist/player.js` sha256 `6fb1f8aa…`; contracts `dist/error-codes.json`
  `5d1783a7…` cmp-equal BOTH sides — the registry bytes do not move across
  v0.5.5→v0.5.6 (205 codes, zero new mints → no TS2741 hazard class, and
  this tree carries no `ErrorCode` surface anyway — re-grepped).
- **Locale leg (PIN HELD — verified, not assumed):** the ui tag payload's
  seven `src/i18n/locales` files re-hashed EXACTLY to the `PIN`
  `source_sha256` values, and upstream `git diff 36c04fbe..4d89b3a7 --
  src/i18n` is EMPTY — so ref, all fourteen hashes and the script's
  `SOURCE_REF` constant stay UNTOUCHED (first held locale pin since v0.99.13;
  the v0.99.16 ui delta is its contracts dep spec + the dist stamp literal).
  `tests/unit/i18nLocales.test.ts` green against the INSTALLED v0.99.16
  catalog, incl. both key-set equality directions.
- **Widget leg:** `package/` regenerated — 31 chunk renames + the
  `index.html` entry rewire; the embedded ui version stamp moves `0.99.15`→
  `0.99.16` (single site — the M-UI-23 stamp; zero stale `0.99.15` strings
  in `package/`); the `index-*.css` chunk name HOLDS (CSS bytes unchanged).
  Determinism: two consecutive `npm run package` builds `diff -r`-identical,
  re-attested this turn. AGGREGATE-MD5 RECIPE
  `find package -type f -print0 | sort -z | xargs -0 md5sum | awk '{print $1}' | sort | tr -d '\n' | md5sum`:
  `6baff790f0c7792e80069474b90e8c42` → `b1f57c27c042ea1710f97b375a15ad3a`.
  Freshness-gate sim after staging: rebuild left `package/` byte-identical to
  the index (build.yml "Assert committed package/ is fresh" holds).
- **Gate ledgers advanced (comment-only, 0 behavior):** the routeManifest
  gate's vendored fixture STAYS at the 412-era bytes (`91579683…`) per the
  wave plan ruling — the fixture tracks the cs#48 coordination cascade, not
  the npm pin; the #v0.5.6 embed is regen #36 (`90b79e35…`/415: +
  `GET /api/v1/me/history`, +`GET /api/v1/servers/{id}`, +
  `GET /api/v1/users/me/history`, zero removals, none issued from this tree —
  scan sites and per-file pins UNCHANGED), recorded as a new honest leg in
  the gate header + `useSyncPlayStore` pin-cite currency (registry-held facts
  re-verified by md5, not copied). `distApiFloor` NOT rotated — measured
  green on the new bundle (`:focus-visible` stays 157; the ui dist delta
  carries no stylesheet change).
- **Docs leg:** docsPinConsistency MEASURED 6 red arms (README badge, README
  Tech Stack, DEVELOPER, docs/i18n seam, AGENTS, CLAUDE) → rotated → 9/9.
  docs/i18n.md seam narrative gained the held-pin sentence with the
  `git diff` proof; the divergence ledger's six rows re-grepped against the
  fresh v0.99.16 bundle bytes — ALL FACT-UNCHANGED (wsPath rides
  `SyncPlayModal-*.js`+`index-*.js`; picker literal `(shared — read-only)` in
  the index chunk only, MediaCard still folded; invite paths/codes ship;
  `new Audio` 1 site, `mediaSession` video-only; `replace(/&/g` still in
  `useItemInspector-*.js`; auth hoist `var Zr` stable v0.99.15→v0.99.16).
- **Baseline conflict RESOLVED by measurement (the 63f/1067 vs 66f/1128
  register conflict):** full serial vitest at the PARENT tree = 66 files /
  1128 tests / 0 skipped — the 66/1128 era figure is the measured truth;
  final post-rotation run EXACT (66/1128/0). Gates: vue-tsc src+tests 0,
  eslint 0, `npm run package` rc 0 ×2, `git diff` clean vs origin tip before
  push.

### Changed — ui #v0.99.15 re-pin: locale re-vendor + widget bundle regen — 2026-11-04

- **What users see:** the TV copy lands localized in all six vendored
  non-English catalogs — the v0.99.15 ui wave grew favorite/mark-watched/
  rating failure toasts, the primary-nav landmark label, search
  `showingOf`/`inputLabel`, `noRooms`/`unknownError`/`matching` and the
  syncplay `leaveConfirm` leg — plus the regenerated widget bundle those
  rules ride.
- **Pin leg:** `@phlix/ui` moves `#v0.99.14`→`#v0.99.15` (annotated tag
  object `74c9e1e3`, peel `36c04fbe` == ui master tip, origin-verified;
  tag-form pin per the repo's pin law). `package-lock.json` SURGICAL 4+/4−:
  root edge spec, the ui node `version`/`resolved` to the peel, and the ui
  as-published `@phlix/syncplay` edge `#v0.1.6`→`#v0.1.7` — which ELIMINATES
  the prior wave's disclosed as-published asymmetry. `@phlix/contracts`
  `#v0.5.5` and `@phlix/syncplay` `#v0.1.7` root pins HELD (recon-confirmed
  live; no drift taken). Install idempotency proven by a second
  `npm@11 install` (NPM_CONFIG_USERCONFIG=/dev/null) byte-identical to the
  first, and installed-vs-tag byte identity: `dist/phlix-ui.js`
  sha256 `d1a83db4…`, `dist/player.js` sha256 `ec461df9…` == the v0.99.15
  peel blobs; the vendored syncplay `dist/phlix-syncplay.js`
  `b19581f4…` == the v0.1.7 peel blob.
- **Locale leg (REAL re-vendor):** `scripts/sync-ui-locale-bundles.mjs
  --ref 36c04fbe` — 6 of the 7 vendored files genuinely move (de.ts ±17,
  es/fr/it/ja/pt_BR.ts ±19 each; recon's measurement confirmed against the
  actual tags, `git diff a437b995..36c04fbe -- src/i18n/locales`); the
  ui-side install catalog (`messages.ts`) grows alongside, so the
  installed↔bundle key-set equality holds by joint re-sync, not luck.
  `locales/index.ts` byte-HOLDS; PIN ref re-anchored `a437b995`→`36c04fbe`
  and 12 of the fourteen hashes rotate with the pair holding. The `SOURCE_REF`
  constant in the sync script re-anchored in the same commit (its equality
  pin is the drift law).
- **Widget leg:** `package/` regenerated — 32 chunk renames + the
  `index.html` rewire; the embedded ui version stamp moves `0.99.14`→
  `0.99.15` (single site, the M-UI-23 stamp), zero stale `0.99.14` strings
  remain. Determinism proven: two clean builds byte-identical (`diff -r`
  empty); aggregate md5 `ac20ea10e25b33605bb26bbe8205a88b` →
  `6baff790f0c7792e80069474b90e8c42` (recipe in TW-TIZEN-UI15.md).
- **Runtime-floor adjudication:** the above-floor CSS census golden
  `:focus-visible` moves 156→157 — attributed to EXACTLY one new vendored
  rule (`.phlix-input.is-invalid .phlix-input__field:focus-visible`, via a
  scope-hash-stripped selector-set diff of old vs new committed stylesheet;
  host CSS untouched). Golden rotated with the attribution staircase comment
  and the `docs/runtime-floor.md` degradation table re-derived in the same
  commit, per that file's own law. `inset:` 41, `aspect-ratio` 36,
  `accent-color` 8 re-measured UNCHANGED.
- **Divergence ledger:** all six mirror-lag rows in
  `docs/ui-port-divergence.md` re-grepped against the v0.99.15 bytes (law
  #2: grep evidence, not memory) — every row FACT-UNCHANGED. Two bookkeeping
  deltas disclosed in-place: the `canManagePlaylist` recursive dist count
  23→5 (map-granularity; gate re-attested through the shipped
  `(shared — read-only)` picker literal, which now rides the `index-*.js`
  chunk — this widget build folds MediaCard into index) and the
  `access_token` hoist name drift (`Hr`→`Zr`). The registered
  endpointOverrides→`wsUrl`/`wsPath` forwarding follow-up stays OPEN —
  deliberately not taken in a pin-bump lane.
- **Docs rotation:** README badge + Tech Stack line, DEVELOPER.md pin line,
  AGENTS.md / CLAUDE.md pin lines, and the `docs/i18n.md` seam narrative
  re-anchored (the v0.99.14 era folded into the prior-era record; the
  v0.99.12/13 legs carried verbatim). `tests/unit/i18nLocales.test.ts` era
  comment rotated the same way.
- **Gates:** `docsPinConsistency.test.ts` measured the expected 6 red arms
  pre-rotation → 9/9 green after; vue-tsc src + tests rc=0; eslint rc=0;
  `vitest run --no-file-parallelism` **66 files / 1128 tests / 0 skipped**
  rc=0 — baseline-exact against the v0.99.14-wave record (66f/1128; the
  stale 63f/1067 figure predates the phase-3 test additions).

### Changed — in-source pin cites advanced to contracts #v0.5.5 / syncplay #v0.1.7 — 2026-11-04

- **What users see:** nothing — the shipped widget is byte-identical (zero-
  rebuild proof below). What was stale was the code's own prose: five
  in-source cites still named the pre-cascade pins after `081975b8` moved
  the lock — the `useSyncPlayStore` header ("typed against
  `@phlix/contracts` v0.5.4 … framed by `@phlix/syncplay` v0.1.6"), the
  M-TIZEN-40 rate-envelope docblock ("Wire truth at this pin
  (@phlix/syncplay v0.1.6)" — self-referentially false against a #v0.1.7
  lock), the T-15 `onUnknownFrame` note, and the M-TIZEN-40 source-pin
  comment in the store's test. Review tizen Minor-1.
- **Why CI could not catch it:** `docsPinConsistency.test.ts` machine-pins
  README / AGENTS / CLAUDE / DEVELOPER only — in-source cites are the
  human-law surface. This completes the cascade's own skipped batch-2 m6
  re-anchor discipline (performed for the v0.5.4/#v0.1.6 era, not re-run
  when the era moved).
- **Facts re-verified at the new pins, not copied:** contracts #v0.5.5 is
  additive over #v0.5.4 (error-code registry `40c1da48…`→`5d1783a7…`,
  204→205 — the one new RESERVED `common.not_found`; the `SyncPlay*` types,
  `server-route-manifest.json` `91579683…` and `mcp-scopes.json`
  `8c92c070…` all HOLD). syncplay #v0.1.7 over #v0.1.6 changes no wire code
  (upstream `git diff v0.1.6 v0.1.7`: `src/messages.ts` byte-unchanged,
  `serializeMessage` zero-diff; the leg is decode-side `UnknownFrame`
  honesty plus send-return observability — neither read through this
  store's rails). `PlaybackCommand` re-confirmed rate-free
  `{type, position, serverTime}` and the 19 canonical `syncplay_*` set
  re-counted against the installed #v0.1.7 types.
- **Discipline:** leg-scoped history + a new leg stating the move, modeled
  on `routeManifest.gate.test.ts`; historically-scoped lines kept verbatim
  per the history law (the S415 "retired in contracts v0.4.6" note, the
  test's v0.1.2/v0.1.4 fold history, `package-lock.json`'s disclosed
  ui→#v0.1.6 edge line).
- **Zero-rebuild proof:** every changed line is a comment; no built artifact
  embeds the touched prose (grep-proven across `package/` and `dist/`), and
  a full `npm run package` after the edits left the committed `package/` at
  ZERO git churn — no re-vendor taken, none due.
- **Gates:** vue-tsc src + tests rc=0; eslint rc=0; `vitest run
  --no-file-parallelism` 66 files / 1128 tests / 0 skipped, rc=0 —
  baseline-exact (the edits touch no assertion).

### Changed — phase-3 cascade re-pin: contracts #v0.5.5, syncplay #v0.1.7, ui #v0.99.14 — 2026-11-03

- **What users see:** the translated UI catches up with upstream copy — the
  six non-English catalogs re-vendor onto the v0.99.14 ui locale wave (new
  and refreshed es/fr/de/it/pt_BR/ja strings wherever the viewer has a
  language set); the bundled UI itself is a chunk refresh (content-hash
  renames, behavior unchanged).
- **Pin advance (phase-3 cascade, release chain).** `@phlix/contracts`
  `#v0.5.4`→`#v0.5.5` (annotated tag `122d0acb`, peels `e21598166a`),
  `@phlix/syncplay` `#v0.1.6`→`#v0.1.7` (tag `fe687f27`, peels `1a80b1d1`),
  `@phlix/ui` `#v0.99.13`→`#v0.99.14` (tag `bfe47d15`, peels `a437b995`);
  the lock `resolved` fields equal the peels — strict-equality law.
- **Lock churn is the minimal declared-delta shape:** 10 lines of
  `package-lock.json` (+/−: root dependency-edge trio, per-node `version` +
  `resolved`, and the ui node's contracts edge) + 3 lines of `package.json`,
  produced by a real `npm 12.0.2 install --allow-git=all` with
  `NPM_CONFIG_USERCONFIG=/dev/null` and proven idempotent (a second full
  install left the lock byte-identical).
- **syncplay hoist-dedup divergence (disclosed).** `@phlix/ui` `v0.99.14`
  as published still declares its `@phlix/syncplay#v0.1.6` edge; the root
  `#v0.1.7` hoists and npm accepts the edge with ZERO nested nodes — the
  windows contracts-v0.5.2-era precedent exercised here for the first time
  in tizen. Content-neutral for this widget: the ui dist carries zero
  runtime `@phlix/syncplay` references (grep-proven), and this repo's own
  `SyncPlayClient`/`serializeMessage` import resolves to the pinned v0.1.7.
- **Contracts trio: the v0.5.4-era freeze breaks honestly.**
  `error-codes.json` moves `40c1da48…`→`5d1783a7…` (204→205 codes — the
  additive RESERVED `common.not_found` mint) while
  `server-route-manifest.json` (`91579683…`) and `mcp-scopes.json`
  (`8c92c070…`) HOLD. The vendored fixture cmps byte-identical to the
  installed dist — no re-vendor due, none taken; this tree carries NO
  registry fixture and NO `Record`-over-union type pin (zero `ErrorCode`
  surface — grep-proven), so the mint cannot break it. S279-class dead-rail
  and WS/relay OUT-of-manifest tripwires re-verified green on the unchanged
  manifest bytes.
- **Byte identity.** Installed dist sha256 each equal to the tag tree blob:
  ui `dist/phlix-ui.js` `81022381…`, `dist/player.js` `cb19528b…`; contracts
  `dist/phlix-contracts.js` `fb818c45…`; syncplay `dist/phlix-syncplay.js`
  `b19581f4…`.
- **i18n law's ACTIVE re-sync branch taken.** v0.99.14 moved ui locale
  SOURCE (`git diff 1f0046c5..a437b995 -- src/i18n` non-empty: the six
  bundle files plus the messages/errors catalogs), so
  `scripts/sync-ui-locale-bundles.mjs --ref a437b995` re-vendored: PIN ref
  `1f0046c5`→`a437b995` and 12 of the fourteen hashes rotated, the index.ts
  pair HOLDING (ui's `locales/index.ts` byte-stable across the pin); the
  bootstrap `SOURCE_REF` constant rotated with the ref (constant==PIN law).
- **Divergence ledger re-verified row-by-row onto the v0.99.14 bytes**
  (`docs/ui-port-divergence.md`, cites advanced): socketHint `wsUrl`/`wsPath`
  seam SHIPS (host `endpointOverrides` stays — the registered forwarding
  follow-up untouched in this pin lane); playlist-gating CLOSED bookend holds
  (23 sites — with a new methodology note: the count is recursive over
  `.map`/`.d.ts`, the identifier never surviving minified `.js`); invite
  two-leg DTO un-lagged; music observer posture unchanged (`new Audio` still
  exactly 1 site, `mediaSession` video-path-only); the `MetadataMatchModal`
  hand-rolled escape still ships (strict CSP stays load-bearing); bare
  `access_token` literals still hoist in the index chunk.
- **Doc arms rotated with the pins:** README badge + Tech-Stack trio,
  DEVELOPER.md pinned-dependencies header, AGENTS.md/CLAUDE.md pin lines,
  `docs/i18n.md` seam passage (all drift-gated by
  `tests/unit/docsPinConsistency.test.ts`); the `routeManifest.gate` docblock
  pin cite advanced with its v0.5.5 leg; `i18nLocales`'s era note tells the
  re-sync story.
- **Widget re-packaged.** `npm run package` refreshed `package/` (33 chunk
  renames, net −1 asset file; `index.html` refs; `config.xml`/`icon.png`
  byte-ident). Deterministic: two consecutive runs byte-identical, aggregate
  md5 `2bba6c70…` → `f62b2d03…`.
- **Gates:** `vue-tsc --noEmit` 0; `vue-tsc -p tsconfig.tests.json` 0;
  `eslint .` 0; `vitest run --no-file-parallelism` **66 files / 1128 passed
  / 0 skipped** — baseline-exact against the same-day pre-pin measure on this
  tree; `npx vitest run --coverage` floor gate 0 (stmts 86.17 / branches
  78.14 / funcs 83.88 / lines 87.44); `npm run package` 0 ×2. CI re-runs the
  same legs, incl. 'Assert committed package/ is fresh'.

### Fixed — deferred-review lane: locale copy, TV focus scale, chapter ticks, D-pad schedule window — 2026-11-03

- **What users see:** bitrate chips read `1280 kbps` with a proper space
  (was `1280kbps`, clashing with the bandwidth format beside it); the skip
  buttons now read "Skip intro"/"Skip outro" — the same words they announce;
  the bandwidth hint says "0 means Unlimited" in plain words instead of
  developer shorthand (`0 = unlimited`); every host-owned focus ring is
  visible from the couch — rings went from 3px desktop scale to 5px
  translucent / 4px solid TV weight (final eyeball calibration is a
  real-TV-session item, device-test-pending); the seekbar chapter map no
  longer pretends the remote has a mouse — the hover tooltip and click-seek
  machinery that could never fire on a TV is gone, and ChaptersPage remains
  the operable chapter surface; the parental schedule window can finally be
  edited with the remote alone — four minute-stepper buttons (-60/-15/+15/
  +60) around a 12-hour readout replace two segment-editing time fields that
  wanted a pointer the device does not have.
- Mechanism: a new pure helper (`src/parentalTimeStepper.ts`) owns the
  stepping arithmetic — 24-hour wrap both directions, seconds-segment shape
  preserved so wire bodies change only when the viewer actually steps, and a
  pinned degrade-to-midnight for corrupt stored times. Four locale-neutral
  symbol keys joined all seven catalog tables (184 → 188 keys, mirrors
  byte-identical, EN_LEAK_OK cohort extended); the `:focus-visible` CSS
  census rotated 155 → 156 with attribution in both surfaces it lives in;
  the copy law is written down in docs/i18n.md and the ring law in
  docs/runtime-floor.md (governance item 6). Stepper presses write into the
  exact form fields the S325b/S502 wire pins guard, so every
  verb/URL/body tuple kept its byte-for-byte meaning.
- Deferred-m20 discipline: the ledger's forward-vocabulary clause above now
  restricts new headings to the six Keep-a-Changelog categories; the
  non-KaC historical titles the reviews enumerated grandfather verbatim.

### Fixed — TV-experience review remediation (25 findings) — 2026-11-03

- **What users see:** the pairing dialog and telemetry consent card no longer
  leak D-pad focus behind them (the spatial pool yields to a mounted takeover
  and blurs stale focus — removal only, never a trap); a dead YELLOW-button
  press off the player no longer toasts "Yellow" for nothing; spamming digits
  (held/stuck remote key) can no longer flood channel-commit; the intro/chapter
  overlays stop double-polling the player; the QuickConnect spinner actually
  stops when the server-side code's window lapses; focus rings are visible on
  the consent card; splash/consent/pairing geometry survives 85-era overscan
  (longhand insets + safe-area passthrough on three edge-anchored overlays).
- **Reliability.** The hub-relay now REPORTS its terminal `closed` transition
  to the lifecycle listener (it silently died before); both reconnect ladders
  jitter one-sided under the documented power-of-two ceiling; a cleared
  credential dials anonymously instead of re-presenting a logged-out JWT;
  SyncPlay REST gained a 10 s deadline and clips server error bodies to 200
  chars before they reach the 10-foot channel; implausible wire epochs clamp to
  the now-fallback; frame-parse and frame-handler failures are distinguishable.
- **Seam + floors.** The sealed bundle's socket hint (`window.__PHLIX__`) is now
  seeded from the resolved server origin (the direct lane follows the host TLS
  law instead of `window.location`); the CSS half of the Chromium-85 floor is
  tripwired (census + the load-bearing vendored `[data-tv] :focus` fallback);
  the immediate-action floor is per FUNCTIONAL group (PLAY/PAUSE aliases share
  one meter — one physical toggle press is no longer a 3× flood).
- **Housekeeping.** The position-poll law moved to a shared typed module; the
  lint workflow no longer re-assembles `package/` without version-sync; the
  rolling release body carries version + sha256; signing material is
  git-ignored by extension.
- Mechanism, pins and per-finding dispositions: `.reviews/FIXLOG/tizen.md`
  (batches 1–4, commits `2a1872b`, `e2995a7`, `f1e1603`, `953862e`).

### Changed — ui #v0.99.13 re-pin (ui13-wave) — 2026-11-02

- **What users see:** the bundled UI's `Select` dropdown gains the upstream
  internal-ref cure (`open`→`isOpen`, clearing the vue/no-dupe-keys collision
  under ui's refreshed eslint-plugin-vue era — the public `v-open` model API
  is unchanged); everything else in the bump is a toolchain-era dist rebuild
  (chunk-content hashes move, behavior does not).
- **Pin advance.** `@phlix/ui` `#v0.99.12`→`#v0.99.13` (annotated tag
  `ff9c1f91`, peels `e30bae9f`; lock `resolved` equals the peel — strict
  equality law). `@phlix/contracts` `#v0.5.4` (`c491985317`) and
  `@phlix/syncplay` `#v0.1.6` (`081687742`) deliberately UNMOVED: v0.99.13
  requests the same tags, so the equality era continues — zero nested
  `@phlix` nodes, and the FROZEN contracts trio stays byte-ident (fixture
  cmp held, no re-vendor; no gate cite to advance).
- **Lock churn is the minimal declared-delta shape:** exactly 3 lines of
  `package-lock.json` (root dependency edge, `node_modules/@phlix/ui`
  `version` + `resolved`) + 1 line of `package.json`, hand-surgical — and
  proven idempotent: a real `npm 12.0.2 install --allow-git=all` with
  `NPM_CONFIG_USERCONFIG=/dev/null` left the lock byte-identical.
- **Byte identity.** The GitHub `refs/tags/v0.99.13.tar.gz` hashes to
  `sha512-/M5vgoBcc…Kr+5NQ==` — verified live, the exact tarball the
  server and hub `web-ui` lanes pinned. Tizen's git+ssh lock form carries
  no integrity field for git deps (lockfileVersion 3, C3 precedent), so the
  identity law rides content: installed `dist/phlix-ui.js` sha256
  `0899810a…`, `dist/player.js` `57ce05a0…` — each identical to the tag's
  tree blob AND to the server/hub installed copies; contracts `d06f81e9…`
  and syncplay `e6be5a68…` UNMOVED.
- **i18n law's silent-zero-churn branch exercised.** v0.99.13 moved only
  `src/components/ui/Select.vue` in ui's source — `git diff
  1f0046c5..e30bae9f -- src/i18n` is EMPTY. `scripts/
  sync-ui-locale-bundles.mjs --ref e30bae9f` re-vendored all seven files
  byte-identically, so the vendor ref and all fourteen PIN hashes HOLD and
  the bootstrap `SOURCE_REF` constant stays (law: constant == pin.ref);
  the installed↔bundle key-set equality pin is green by construction
  against the v0.99.13 install. `docs/i18n.md` tells the story.
- **Divergence ledger re-verified row-by-row onto the v0.99.13 bytes**
  (`docs/ui-port-divergence.md`, cites advanced): socketHint
  `wsUrl`/`wsPath` seam SHIPS (host `endpointOverrides` stays — unchanged
  registered follow-up); playlist gating CLOSED bookend holds
  (`canManagePlaylist` 23 sites in the installed dist — same figure as the
  C3 era); invite create-token DTO stands; music-observer posture stands
  (`new Audio` 1 site in the `MusicLibraryPage-*.js` chunk, `mediaSession`
  video-path-only); the `MetadataMatchModal` escape pattern still ships
  (strict CSP stays load-bearing); bare auth-key literals still ship
  (`Hr="access_token"` hoist byte-equal across eras); `app.config.errorHandler`
  still set by NOBODY in ui dist (0 sites; the bundle's 3 occurrences are
  Vue runtime internals + this app's own bridge — count-invariant).
- **Widget re-packaged.** `npm run package` refreshed `package/` (33 chunk
  renames + `index.html` refs; `config.xml`/`icon.png` byte-ident).
  Deterministic: two consecutive runs byte-identical, aggregate md5
  `de020fc3…` → `2bba6c70…`.
- **Gates:** `vue-tsc --noEmit` 0; `vue-tsc -p tsconfig.tests.json` 0;
  `eslint .` 0; `vitest run --no-file-parallelism` **63 files / 1067 passed
  / 0 skipped** — baseline-exact against the same-day pre-pin measure at
  `27a650a`; `npm run package` 0 ×2. CI re-runs the same legs, incl.
  'Assert committed package/ is fresh'.

### Changed — tag-wave C3 re-pin: contracts #v0.5.4, syncplay #v0.1.6, ui #v0.99.12 — 2026-11-02

- **What users see:** the widget's bundled UI gains the ui v0.99.11+v0.99.12
  waves — playlist manageability gating (delete/remove correctly gated;
  shared playlists render read-only), the My-List copy moves (M-UI-02), the
  publicRooms wording sweep (R-UI-06) and auth-lockout messaging — and the
  six vendored locale bundles (es/fr/de/it/pt_BR/ja) ride the same wave.
- **Pin advance (tag-wave C3, release cascade).** `@phlix/contracts`
  `#v0.5.3`→`#v0.5.4` (annotated tag `eb649cd9`, peels `c491985317`),
  `@phlix/syncplay` `#v0.1.5`→`#v0.1.6` (tag `24e51a95`, peels
  `081687742`), `@phlix/ui` `#v0.99.10`→`#v0.99.12` (tag `93b6d186`, peels
  `1f0046c5`); each lock `resolved` equals its tag peel (strict-equality pin
  law). The FROZEN contracts trio is byte-ident at v0.5.4 (`error-codes.json`
  `40c1da48…`, `server-route-manifest.json` `91579683…`, `mcp-scopes.json`
  `8c92c070…`): the vendored `tests/fixtures/server-route-manifest.json` cmps
  equal to the installed artifact — no re-vendor was due and none was taken;
  the gate test's docblock cite advanced (comment-only, 0 behavior).
- **Lock churn is the minimal declared-delta shape** (npm 11 via
  `npx --yes npm@11`, `npm_config_userconfig=/dev/null`): exactly 11+/11− —
  three root dependency edges, the `version`/`resolved` pair under each of
  the three `node_modules/@phlix/*` nodes, and two dependency edges recorded
  under the ui node. ui v0.99.12 requests the SAME contracts/syncplay tags,
  so the install is the equality era: zero nested `@phlix` nodes, no
  hoist-divergence waiver. Vendored identity proven: installed
  `@phlix/ui/dist/phlix-ui.js` sha256 `c6a0ea4c…`, `dist/player.js`
  `36fe4035…`, `@phlix/contracts/dist/phlix-contracts.js` `d06f81e9…`,
  `@phlix/syncplay/dist/phlix-syncplay.js` `e6be5a68…` — each identical to
  the corresponding tag's tree blob.
- **syncplay v0.1.6 is inert at this host's consumption.** `PlaybackCommand`
  stays `{type, position, serverTime}` (no `rate` exists to forward — the
  M-TIZEN-40 source pin now cites v0.1.6, re-verified against the installed
  `client.d.ts`); the wave's `onChat`/`onQueueChanged`/`sendChat`/`sendTyping`
  seams are additive and unconsumed here.
- **i18n law exercised — the era's one forced exception.** The v0.99.12 wave
  grew ui's catalog (`messages.ts` + all six locale files), so `vue-tsc`
  reddened on the stale `a580410f`-era bundles exactly as the drift design
  intends; the sanctioned `scripts/sync-ui-locale-bundles.mjs --ref
  1f0046c5 --branch master` re-vendored the six bundles + `PIN` (index.ts
  content unchanged — `fb4fa495…`, the registry shape did not move) and the
  script's bootstrap `SOURCE_REF` advanced with it (law: constant ==
  pin.ref). `docs/i18n.md`'s PIN paragraph tells the full story.
- **Divergence ledger re-verified row-by-row against the new bytes**
  (`docs/ui-port-divergence.md`): the socketHint `wsUrl`/`wsPath` seam SHIPS
  at v0.99.12, but the host-side `endpointOverrides` seam deliberately does
  NOT retire — both of tizen's dial lanes are host-owned and the one-pair
  vocabulary can't express the split port/relay-path override set; the
  bundle-forwarding follow-up is registered there as its own future wave.
  The playlist lag CLOSED at this pin; invite-DTO, MetadataMatchModal
  escape, bare-auth-keys and music-observer premises each re-grepped (last
  three still stand on v0.99.12 bytes).
- **Widget re-packaged.** `npm run package` refreshed `package/` (40 assets +
  `index.html`; deterministic: two consecutive runs byte-identical, aggregate
  md5 `de020fc3…`). Era-cite rotations: README badge + Tech-Stack lines,
  DEVELOPER/AGENTS/CLAUDE pin lines, AGENTS bundle-era narratives
  (connectScan affordance ships; `app.config.errorHandler` still set by
  nobody — re-grep-proven), `main.test.ts` Vue-bridge comment.
- **Gates:** `vue-tsc --noEmit` 0 (folds into `package`); `vue-tsc -p
  tsconfig.tests.json` 0; `eslint .` 0; `vitest run --no-file-parallelism`
  **63 files / 1067 passed / 0 skipped** — baseline-exact against the
  same-day pre-pin measure at `6a24fca` (the 733-era figure in older entries
  is history; the suite grew through October's review waves);
  `npm run package` 0 ×2. CI re-runs the same legs, incl. 'Assert committed
  package/ is fresh'.

### Removed — dead rating UI trio and its 16 catalog strings (M-TIZEN-04 / review tizen__casualgamer m4) — 2026-10-30

- **What users see:** nothing renders differently — that is the finding.
  The detail-page rating surface users actually interact with is shipped
  inside the sealed `@phlix/ui` `MediaDetailPage` chunk (which carries its
  own rating UI); the tizen-side trio never mounted anywhere.
- `RatingModal.vue`, `RatingBadge.vue`, `UserRatingPicker.vue` were
  born-orphaned — `git log -S` over the full history of `main.ts` and every
  page/screen shows ZERO mount sites ever. Deleted with their three unit
  suites and the 16-key `ratings.*` group across all seven locale catalogs
  (200 keys / 18 groups → 184 keys / 17 groups; the tizenI18n integrity law
  "every key has a real call site" is now satisfied by deletion, and the two
  whitespace-exclusion ledgers that existed only for `ratings.*` values
  retired to unconditional law).
- The `tizenBridge` TV-keyboard ladder layer (`RATING_MODAL_SELECTOR`,
  reviewed majors fix M-TIZEN-18) stays as the documented INERT forward
  probe its docblock always said it was — the producer was removed here; the
  note now carries that truth. Docs currency: `docs/i18n.md` counts rotated,
  `VERIFICATION.md` carries appended currency notes (history-verbatim law),
  `AGENTS.md`/`CLAUDE.md` suite enumerations fixed (both fossilized below
  reality; corrected counts measured at W-min173).

### Added — tests/ and scripts/ typecheck gate with a shrink-only exclusion ledger (M-TIZEN-12 / review tizen__devops MIN-2) — 2026-10-30

- **What users see:** nothing — dev-chain. Type drift in test fixtures and
  dev scripts now fails CI where it used to surface only at runtime.
- `npm run typecheck:tests` = `vue-tsc -p tsconfig.tests.json` (covers
  `src/`, `tests/` and `scripts/` with `allowJs`+`checkJs` for the .mjs/.js
  tooling, same strict base config) wired as a blocking step in the Test
  workflow. The existing prod `vue-tsc --noEmit` gate is untouched.
- Migration landed here: `src/polyfills.ts` global `Array.at` declaration
  made non-optional (the module IS the existence guarantee), vitest v5
  `Mock`-generic fake player in `syncplayDispatch.test`, `makeDeps` transport
  slot typed as the `FakeTransport` it returns in `telemetry.test`,
  `as const` on the `onRemoteCommand` verb literals + completed
  `LocalSyncPlayMember` fixture + five lying `@ts-expect-error` directives
  pruned in `useSyncPlayStore.test`, JSDoc parameter/return annotations
  through `add-copyright.mjs`/`sync-ui-locale-bundles.mjs`/`make-icon.js`, and
  a `scripts/version-sync.d.mts` declaration sidecar (audit-gate.d.mts
  precedent) for the stamping helpers.
- LEDGER (named follow-up): `tests/unit/tizenBridge.test.ts` (FakeRemote
  interface no longer structurally extends the vitest v5 `BridgeRemote`) and
  `tests/unit/main.test.ts` (vi-mock call-tuple assertion drift) are excluded
  — 50 + 28 errors in two single-root-cause era-drift families.
  `tests/unit/testsTypecheckLedger.test.ts` pins the exclude array EXACTLY
  (additions red, mutation-proven) and requires every entry to exist on disk:
  the ledger may only shrink.

### Fixed — a remote sync command can no longer force the player to an absurd rate (M-TIZEN-40 / review tizen__secnet MINOR-6) — 2026-10-30

- **What users see:** if a group member (or a compromised server
  rebroadcast) sends a sync command carrying rate NaN/Infinity/0/4×-plus,
  the TV keeps its current rate instead of warping playback; clean rates
  still apply verbatim.
- The position arm of the same review id was already cured at `fa05cad`
  (W-min171, `optFiniteMs` at the socket boundary). The rate arm was live:
  `onRemoteCommand`'s sync case applied `command.rate` unvalidated. It now
  passes `optFiniteRate` — drop-not-clamp, [0.25, 4] inclusive envelope
  (server vocabulary only ever nudges 1 ± 0.1; SPEC.md). Wire truth logged
  in the guard's docblock: at @phlix/syncplay v0.1.5 the socket rail cannot
  carry a rate at all (`PlaybackCommand` = {type, position, serverTime}),
  so the guard protects the store's public seam — and tests pin the rails'
  rate-free shape so a future re-pin that starts forwarding `rate` reddens
  the pin and forces a deliberate envelope review.

### Documentation — the widget update path is written down (M-TIZEN-16 / review tizen__devops MINOR-7) — 2026-10-30

- **What users see:** README gains "Updating an installed widget": no store
  channel exists, so updates ride the same signed sideload as first
  install; same author certificate + same app id replaces in place and
  preserves the widget's localStorage (server url, install-stable device
  id, tokens, prefs — the app restarts paired); uninstall-then-install
  resets to a fresh pairing; the one-time re-login caveat of the
  `encryption="enable"` webdata flag (added at `409fcc2`) is stated; and
  the GitHub `latest` release's raw `.wgt` is named what it is — an
  unsigned inspection snapshot, never an update source.
- `docs/signing.md` CI-signing section cross-points the new README section.

### Security — dev-chain advisory clear + retroactive log of three shipped dependency/CI moves (M-TIZEN-41 / review tizen__writer #1) — 2026-10-30

- **What users see:** nothing — every commit below is dev-chain/CI surface;
  the shipped widget bytes are unchanged by this entry.
- **Retroactive log (landed unlogged, ancestors of this ledger's tip, found by
  `git log` at the W-min169 sweep — M-TIZEN-41):**
  - 2026-10-20, `7c88559` (Dependabot PR #119, npm_and_yarn group):
    `postcss-selector-parser` 7.1.4→7.1.6 and `source-map-js` bumped in-range
    — both advisory-driven dev-chain bumps.
  - 2026-10-20, `ec4240d` (dep-sec-patcher): `@vue/server-renderer` → 3.5.42 —
    security patch release taken in range.
- **Fresh gate (W-min169, M-TIZEN-13):** in-range clears `vite` 7.3.6→7.3.7
  (5 GHSA ids, dev-server era), `vitest`+`@vitest/coverage-v8` 5.0.1→5.0.5
  (`@vitest/mocker` 2 ids), `undici` 7.29.1→7.30.1 via jsdom (8 ids). Two
  dev-chain advisories with NO in-range fix survive under the new
  `scripts/audit-gate.mjs` allow-list (minimatch `GHSA-g3hv-75wg-m249` —
  patched only at 11.x, no parent admits it; glob `GHSA-3g3m-2fjr-6pw4` —
  patched only at 14.x, js-beautify still declares ^13). Neither reaches the
  bundle. The 2026-10-08 CI-runner pin is logged under Changed below.

### Changed — CI runners pinned to ubuntu-26.04; in-repo Dependabot scope declared (M-TIZEN-41 / M-TIZEN-13) — landed 2026-10-08, logged 2026-10-30

- **What users see:** nothing — CI/infra only.
- 2026-10-08, `b8d84a1`: build/test/lint Linux jobs moved from
  `ubuntu-latest` to explicit `ubuntu-26.04` ahead of the runner rollover
  (estate-wide deliberate migration; action pins already current-major).
- 2026-10-30: `.github/dependabot.yml` now declares the repo's own update
  scope (weekly grouped npm, root ecosystem) — the same effective behavior
  that previously arrived invisibly from organization config (M-TIZEN-13),
  and `test.yml` gained a final `Security audit` step running
  `node scripts/audit-gate.mjs`.

### Fixed — rating-modal key hint matches remote reality; the modal joins the BACK ladder (M-TIZEN-18 / review tizen__writer MAJOR #6) — 2026-10-29

- **The violation, at tip a7ea19e.** `RatingModal.vue` rendered "Press
  **Esc** to close" — a Samsung remote has no Esc; the dismiss key is
  **Back** (keyCode 10009). Behind the wording lie sat a functional hole:
  the modal's only key handler listened for `e.key === 'Escape'`, and the
  overlay was registered with NONE of the S526 `BackLayer` ladder surfaces,
  so a device BACK press fell past `modal-close` into `history-back` —
  navigating the page underneath while the dialog stayed up. Second defect
  inside the first: the `Esc` literal was hardcoded outside `TIZEN_EN`, so
  the six non-English locales dutifully translated a prefix/suffix pair
  around an untranslated, nonexistent key name.
- **Cure (both sides).** `createRatingModalLayer()` (id `rating-modal`,
  probe `[data-rating-modal]`) joins the ladder below the full-bleed
  z-12000 quick-connect takeover and above the generic ui focus-trap
  probe, same ring-the-bell contract: BACK dispatches a bubbling `Escape`
  keydown on the overlay root and the modal's own handler closes — the
  Escape listener stays because it IS the bell AND the desktop truth (the
  app runs in browsers). The hint becomes device-first and fully
  localizable: `pressBackPrefix` + kbd(`pressBackKey`) + `pressBackSuffix`
  → EN "Press **Back** to close (or Esc on a keyboard)"; all seven locale
  catalogs gain the key-name token (de Zurück / es Atrás / fr Retour /
  it Indietro / ja 戻る / pt_BR Voltar), catalog 199→200 keys.
- **Pins.** `tizenI18n.test.ts` byte-identity table + edge-space set
  rotated; `i18nLocales.test.ts` 200-key law + edge-space pair rotated;
  `docs/i18n.md` counts re-pinned; `tizenBridge.test.ts` gains the layer
  suite (id, probe, bell, root-BACK-closes-not-exits, both priority
  rankings, no-fabrication); `RatingModal.test.ts` pins the honest copy,
  the probe attribute lifecycle, and copy↔function coherence (the named
  key demonstrably closes the modal).

### Fixed — signing.md CLI-fallback phantom flag/commands from the partial cure removed; pin arms extended (M-TIZEN-17 / review tizen__writer MAJOR #5) — 2026-10-29

- **The violation, at tip 756e79b.** The reviewer's ORIGINAL fabrics (`sdb
  push author.p12`, on-device `pkgcmd … -c <password>`, the fabricated
  `storage.googleapis.com/tizen-sdk` installer URL, `-s <path>.p12
  --password`) were already gone — cured at 1d37585 (the queue's
  "cured-by C27 d2a5202" pointer is crossed-label: d2a5202 is a nav commit
  that never touches signing.md). But that cure had itself introduced new
  phantoms: `tizen package … -o ./release` (the official CLI reference option
  table — current AND 2022-era revisions — lists only `-t`, `-s`, `-S` and
  `--`; the TV CLI page says the signed `.wgt` is written INTO the `--`
  directory, which pointed at the git-TRACKED, CI-freshness-gated
  `package/` root), `install -n ./release/<signed>.wgt … -- ./package`
  (official contract: `-n <bare file name>` + `-- <directory holding it>`),
  `-t <TV_IP>:26101` conflating sdb's serial column with the target-name
  column, and `sdb capability | grep -i duid` — no `capability` command
  exists in the official SDB reference at all.
- **Cure (docs/signing.md + README Option-2, kept argv-mirrored).** The CLI
  signing step now signs a COPY (`cp -r package ./build-widget`) and passes
  `-- ./build-widget`; the prose names the absence of any output-directory
  flag and the CLI's printed `Package File Location:`; install/run take `-n
  <signed>.wgt -t <target-name> -- ./build-widget` with the
  serial-vs-target-name law stated from the SDB reference; the DUID
  instruction keeps only the officially documented TV menu path and records
  that no SDB command prints a DUID; the CI headless sketch steps 6–7
  follow the same shape. Verified against github.com/Samsung/tizen-docs
  (command-line-interface.md + smart-development-bridge.md) and the TV CLI
  page signing.md itself links; no repo script or workflow invokes `tizen`.
- **Gate.** `tests/unit/docsDeployWalk.test.ts` extended with arms (f) and
  (g): every `tizen package` command line carries only documented flags
  (no `-o`, no `--password`, a `--` output dir present) and the install
  contract (`-n` bare name, output dir ≠ tracked `package/`) plus repo-wide
  bans on `sdb capability` / the Google-Cloud SDK URL. Red-on-parent
  measured at 756e79b with docs un-cured: exactly the 2 new arms red, the 6
  M15-era arms green; after the cure 8/8.
- **Suite.** vitest serial 57 files / 949 tests (M16-era 947 + 2 exact);
  vue-tsc 0; eslint 0. Docs-only: `package/` rebuild law not triggered
  (zero src/ or package/ changes).

### Fixed — README stops documenting the S501-deleted overlays/tests; a doc-citation gate reddens any future fossil (M-TIZEN-16 / review tizen__writer MAJOR-4) — 2026-10-29

- **The violation, at tip 220ea1d.** Four README surfaces still taught the
  pre-S501 world: the single-file example ran
  `npx vitest run tests/unit/UpNextOverlay.test.ts` (file absent since S501
  T-04), the tree listed `SleepTimerOverlay`/`UpNextOverlay` in
  `src/components/` and `UpNextOverlay.test.ts` in `tests/unit/`, and the
  "Overlay Missing" debug walk demanded a host `<div>` for overlays whose
  Tizen apps were deleted — a check that can never succeed for the two
  PlayerPage-bundled features it named. TWO tree lines carried the pre-S501
  "5" mount count ("5 overlay apps" on the main.ts line, "5 overlay hosts" on
  the index.html line); main.ts now mounts seven (S516/S520/S521/S523 added
  four after S501 deleted two).
  One fossil survived outside the README: `.claude/rules/test-conventions.md`
  still cited `tests/unit/UpNextOverlay.test.ts` as the SFC-suite example.
- **Cure.** All six README sites corrected to tip truth (example command
  → `SkipIntroOverlay.test.ts`; components tree line → the six live
  `src/components/` overlays; main.ts line → 7 overlay apps; index.html line
  → 7 overlay hosts; tests tree →
  `ChapterOverlay.test.ts`; Overlay Missing rewritten to split Tizen-hosted
  mounts — with the seven real `#phlix-*` div ids — from the
  `@phlix/ui` PlayerPage-bundled sleep timer / up next, whose absence is now
  a bundle question, not a host-div question). Rules-file example swapped to
  the existing `ChapterOverlay.test.ts`.
- **Gate.** NEW `tests/unit/docsTestListings.test.ts` (14 tests, zero-runtime
  docsPinConsistency/docsDeployWalk idiom): (a) every `*.test.ts` name cited
  by README/DEVELOPER/AGENTS/CLAUDE/.claude-rules must exist; (b) every
  `npx vitest run <path>` command target exists; (c) README's "N overlay
  apps" count is derived from main.ts `createApp(...).mount(...)` calls minus
  the spatial host; (d) host-div parity index.html ↔ main.ts, and the
  Overlay Missing walk may only name real div ids. Red-on-parent measured at
  220ea1d with the cures stashed: exactly 4 reds (arms a×2, b, c), 10 green.
- **Queue note.** This is the third crossed "cured-by: C27 d2a5202" label
  after M-TIZEN-04 and M-TIZEN-13 (see the M13 entry): d2a5202 is the
  spatial-nav candidate fix and touched none of these lines.

### Fixed — the http-literal persisted server URL is refused at the RESOLVE BOUNDARY for credential traffic (M-TIZEN-12 r2 / review tizen__secnet M12r2) — 2026-10-29

- **The r1 gap, honestly stated.** r1 (39f4c7a) gated the direct `:8097`
  bearer DIAL (`buildWsUrl`) — that cure is real and untouched. But the
  resolve boundary kept classifying schemes WITHOUT asking what the surviving
  base was about to carry: `resolveAppConfig` handed a persisted
  `http://`-literal `phlix.serverUrl` verbatim to `main.ts`, and
  `wireHubRelayConsumer` fed that plaintext base straight into the hub-relay
  `serverUrl` fallback (`resolveHubRelayConfig`). A refusal living only at one
  dial is one new bearer caller away from leaking again.
- **Cure (the e4d8516 idiom — it REFUSES, never silently upgrades).**
  `src/resolveConfig.ts` gains the credential-transport boundary: named
  `CredentialTransportInsecureError`, the one scheme predicate
  `isPlaintextCredentialBase`, and `resolveCredentialBase(input,
  allowInsecure)` — reusing the M-TIZEN-07 legacy-poison read sanitize,
  keeping the persisted→env precedence, and refusing an absolute `http:` base
  with an honest actionable message unless the caller threads its OWN
  documented `VITE_PHLIX_DEV_ALLOW_INSECURE_*` hatch (no third flag exists).
  `src/main.ts` resolves the relay fallback through it: a refused plaintext
  server-origin fallback is disclosed loudly once at boot and the resolver is
  fed `''` — no doomed config, no relay-token mint, no dial attempt; the
  consumer reaches the same closed end-state the dial-side law already chose,
  one edge earlier.
- **What deliberately did NOT move.** An EXPLICIT persisted/env `phlix.hubUrl`
  slot stays ungated at boot (demoting a configured origin would silently
  repoint the relay at a DIFFERENT host — its TLS refusal stays at
  `buildHubRelayUrl`, M-TIZEN-06 law byte-held); both dial builders keep their
  own named consumer errors (`connectWs` still distinguishes terminal policy
  refusals — r1's law tests green UNMODIFIED = extraction proof); the ratified
  M-TIZEN-07 persistence law (http persistable for LAN REST browsing) is
  composed with, never re-litigated.
- **Tests.** Boundary suite in `tests/unit/resolveConfig.test.ts` (the
  reviewer's planted-http repro, poison-read sanitize, env-only refusal,
  hatch pass-through, non-absolute semantics, the WHATWG dot-scheme poison
  class, and a one-value/both-builders agreement composite) plus boot-level
  pins in `tests/unit/main.test.ts` (refused fallback → resolver sees `''` +
  disclosure; https fallback survives verbatim + silent; the relay's hatch
  stays an explicit module seam). One existing permissive-feed pin (the
  M-TIZEN-07 relay test) flips to the new law — disclosed: it encoded the
  r1-era feed this item closes; the S298 explicit-slot pin records the
  precedence unchanged. Full serial: parent (`9c04556`, stash-proven) 54
  files/909 tests → tip 54/918 (+9 exact, 0 failed). Mutations: boundary gate
  stripped → exactly 5 named reds; r1 dial gate stripped → its 5 law reds +
  the composite (the cross-edge agrees).

### Fixed — the install-workflow doc claims are cured to the CI-shipped truth (M-TIZEN-13 / review tizen__writer MAJOR-1) — 2026-10-29

- **The fossil, enumerated.** README §Install claimed "CI uses `npm install`
  (not `npm ci`) — `package-lock.json` is gitignored", and DEVELOPER
  §Prerequisites repeated it. Both halves have been untrue since audit
  W105 T-01 committed the lock: all four CI install legs run
  `npm ci --allow-git=all` (`test.yml`, `lint.yml` ×2, `build.yml`) and
  `package-lock.json` is TRACKED (`.gitignore` carries only a comment saying
  so). The claim was a prose fossil of d6b8bee (May 2026, the no-lock era):
  W105 T-01 moved CI back to `npm ci` and updated AGENTS.md, CLAUDE.md and the
  DEVELOPER version-stamping section, but these two lines were left behind —
  now contradicting DEVELOPER.md's own "TRACKED `package-lock.json` … a stale
  lock makes CI's `npm ci` fail loudly" prose 57 lines below. A contributor
  following them would skip committing lockfile changes and trust a floating
  resolve: a hit on the repo's reproducibility law.
- **Cure.** Both claims rewritten to the shipped truth (CI =
  `npm ci --allow-git=all` from the TRACKED lock, W105 T-01 attribution;
  regenerate with `npm install` on a pin change). The local-setup
  `npm install` command lines stay — they are the correct local workflow per
  the lock-regeneration law.
- **Regression pin.** `tests/unit/installWorkflowDocs.test.ts` (claim-side
  family of `distApiFloor`): the docs never repeat the gitignored/`npm install`
  claims and always carry the `npm ci --allow-git=all` truth with attribution;
  plus a workflows cross-check — if CI ever moves off `npm ci`, docs and
  pin must rotate in the same change. Red-on-parent measured at 39f4c7a.
- **Queue note.** The ledger lines "cured-by: C27 d2a5202" on M-TIZEN-04 and
  M-TIZEN-13 are crossed labels — d2a5202 is the spatial-nav candidate fix and
  touched no install prose; the cure never landed until now.
### Fixed — version-pinning claims unified to the shipped workflow across the five documents + a drift gate (M-TIZEN-14 / review tizen__writer MAJOR-2) — 2026-10-29

- **The drift.** "Five documents, four answers, none current": at 39f4c7a the
  `@phlix/ui` pin was stated as `v0.99.1` (README badge + Tech Stack), `v0.99.0`
  (DEVELOPER header, with contracts `#v0.4.3` and syncplay omitted ENTIRELY),
  `v0.99.8` (docs/i18n.md heading, AGENTS.md, CLAUDE.md) — against the actual
  `package.json` pins `#v0.99.10` / `#v0.5.3` / `#v0.1.5`. A sixth fossil
  answer hid in DEVELOPER's troubleshooting ("`@phlix/ui` v0.74.0 must export",
  predating the 0.99 lineage). Every re-pin cascade lane updated the CHANGELOG
  and the pins, never the prose, so drift compounded release over release.
  The i18n heading was also a CONFLATION: `v0.99.8` was the vendored locale
  bundles' own PIN ref (`a580410f`), not the installed seam pin — the two axes
  are now named distinctly. (docs/i18n.md's v0.99.4/v0.99.5 strictness HISTORY
  narrative is verbatim and untouched; history is not a current claim.)
- **The single truth, traced at HEAD.** `package.json` is the one source for
  BOTH version axes: the widget `"version"` stamped into `app/config.xml` +
  `src/telemetry.ts` by `scripts/version-sync.mjs` (TIZEN-05 law, already
  documented + drift-pinned by `versionStamping.test.ts`), and the three
  `@phlix/*` github TAG pins frozen to exact commits by the TRACKED
  `package-lock.json` and installed by CI's `npm ci --allow-git=all` in all
  three workflows. Neither the `tizen` CLI nor Tizen Studio participates in
  versioning — CI never invokes them (build.yml zips an UNSIGNED `.wgt`;
  signing/deploy stay local duties). README/DEVELOPER now state that whole
  story; AGENTS.md/CLAUDE.md carry current numbers.
- **Permanent cure.** `tests/unit/docsPinConsistency.test.ts` (versionStamping
  idiom, zero runtime imports — reads FILE TEXT): every CURRENT pin claim in
  the five docs must equal the `package.json` tag; historical narrative stays
  out of scope by anchoring on structured claim surfaces only. RED-ON-PARENT
  measured 8/9 arms failing at 39f4c7a with the docs unchanged; green after
  the rewrite. A re-pin that forgets a doc surface reddens exactly the missed
  arm — the doc currency a re-pin cascade lane owes is now machine law.
- **Gates.** vue-tsc clean; vitest serial on the rebased tip 55 files / 926 pass
  + 1 skip (pre-M14 baseline 53/901+1; this lane adds exactly +9 arms, the
  concurrent install-docs lane +16 — both law suites coexist green);
  `npm run package` x2 leaves `package/`, `app/config.xml` and
  `src/telemetry.ts` byte-identical to HEAD (docs/test-only change, zero
  bundle churn — determinism re-proven).
- **Out of scope named:** README/DEVELOPER's npm-install/gitignore claim pair
  (review finding #1, M-TIZEN-13) was cured concurrently (1d71fbf, now the
  parent of this entry); this commit adds nothing to those lines.

### Fixed — README "Deployment to TV" becomes completable by a first-timer: import story, real directories, signing.md cross-refs + a runnability gate (M-TIZEN-15 / review tizen__writer MAJOR-3) — 2026-10-29

- **The defect, verified at HEAD.** The review's headline stood at f9329a5:
  Option 1 told importers to "Select the `phlix-tizen` directory" — no such
  directory exists (the clone dir is `phlix-tizen-client`; `phlix-tizen` is
  only the npm package name), and importing the repo root could never work
  anyway: Tizen web-project imports expect `config.xml` at the project root,
  which this repo keeps (source-truthfully) in `app/`. The CLI lane's worst
  halves had already been cured by 1d37585 — `-s` now reads as a profile
  NAME, the install target is an `sdb`-visible `<TV_IP>:26101` serial with an
  explicit `sdb connect` step, and `tizen run` replaced the fabricated
  `launch` — so this cure left those commands byte-untouched (they match
  docs/signing.md's canonical walk).
- **Queue label, honestly named.** The ledger's "cured-by: C27 d2a5202" is a
  crossed label of the same family M-TIZEN-04/13 recorded: d2a5202 is the
  spatial-nav fix and its README diff touches only Remote-Control prose. The
  real partial cure is 1d37585 (verified via `git log -L` on the section);
  the import instruction was never reached until now.
- **The cure (docs-only).** The section now LEADS with the config.xml-at-
  project-root fact and names `package/` as the only Tizen-shaped directory
  (CI's "Assert committed package/ is fresh" keeps it widget-current). Option
  1 gains runnable steps: `npm ci` → `npm run package` → `cp -r package
  ../phlix-tv-import` (import a COPY — Studio metadata writes would dirty the
  tracked dir and redden the freshness gate), import-from-existing as the
  supported path with create-then-copy as the named fallback, a Certificate
  Manager step cross-referenced to docs/signing.md, a Developer-Mode/pairing
  step mirroring signing.md's facts (12345 from App Settings, toggle ON, dev
  IP, FULL power cycle, 26101 not 26159, the "Permit to install applications"
  dialog) without duplicating its detail, and "Build Signed Package" (phrase
  attested in signing.md) before Run As. Install-refusal reality points at
  signing.md Known Issues — the review's "036" exemplar is deliberately NOT
  invented into either doc; signing.md names the modes in prose, and the walk
  cites that prose.
- **Permanent cure.** `tests/unit/docsDeployWalk.test.ts` (docsPinConsistency
  idiom, zero runtime imports): bans the fossil instruction, requires the
  project-root explanation, checks the taught directories exist on disk as a
  widget project root, pins README↔signing.md argv equality for
  install/run/package (placeholder-normalized skeletons — the no-duplication-
  drift law as code), and re-derives the run app id from `app/config.xml`.
  RED-ON-PARENT measured at f9329a5 with the new suite: the first three arms
  fail (fossil present, no root-manifest explanation, `package/` never named
  as the project); the argv/id arms pass at the parent — guards around the
  1d37585 cure.
- **Gates.** vitest serial `--no-file-parallelism` 56 files / 933 pass / 0
  fail (M14-era 55/927 + this lane's +6 arms exact); vue-tsc clean; eslint
  clean; `npm run build` clean; `npm run package` leaves tracked `package/`
  byte-identical to HEAD (docs/test-only, zero chunk churn — the rebuild law
  observed, no renames to commit).

### Fixed — the direct SyncPlay `:8097` bearer dial is TLS-mandatory; the surviving plaintext lane closes (M-TIZEN-12 / review tizen__secnet MAJOR-1) — 2026-10-29

- **The surviving cleartext path, enumerated.** M-TIZEN-06 (e4d8516) closed
  the hub-relay lane and M-TIZEN-07 (e4c81bb) scheme-allowlisted the
  storage boundary, but the review's MAJOR-1 family had one transport left
  ungated: `buildWsUrl` derived `ws:`/`wss:` purely from `apiBase.protocol`
  and `connectWs` then presented the full bearer JWT in the
  `Sec-WebSocket-Protocol` handshake of a plain `ws://` dial — with the
  replayable SHA-256 group password hash (join frame) and every
  group/playback frame following it unencrypted. A HEAD sweep of every
  outbound URL construction: the two `new WebSocket` sites (this one and the
  already-gated relay), the REST clients (all ride the persisted base —
  M-TIZEN-07's ratified boundary law keeps `http:` persistable for LAN
  browsing; that half is dispositioned, not re-litigated here), and the
  unauthenticated `/health` discovery probes (no credentials). The bearer
  DIAL was the gap.
- **Cure (the M-TIZEN-06 idiom transposed, coords cited in-file):**
  `buildWsUrl` now only moves the scheme UPWARD — `https:` → `wss:` is the
  law, any other base throws the named `SyncPlayInsecureTransportError`
  BEFORE `connectWs` constructs a socket. A policy refusal is terminal (no
  reconnect ladder behind it — the base must change), loud on the console
  with the refused origin named, and surfaced actionably on the store's
  `wsError` channel that the room UI already renders. The escape hatch is
  the repo's default-off build-env convention:
  `VITE_PHLIX_DEV_ALLOW_INSECURE_SYNCPLAY=1` (declared `vite-env.d.ts`,
  documented README-insecure-only) permits the plaintext dial and warns on
  EVERY attempt — deliberately a separate var from the relay hatch, so one
  env flag never unlocks two bearer transports.
- **Tests:** `tests/unit/useSyncPlayStore.test.ts` +10 (full suite
  53 files 892 → 902, measured from the stashed-parent run; the file
  itself 53 → 63). Builder law (refusal message names the error, the
  mandatory-wss law, the hatch env and the refused origin; `ws://` base
  refused; unparsable base keeps the `''` bail; https→wss pin), the
  hatch-default-is-the-env-read lock + the exactly-`'1'` convention, the
  terminal no-socket connect refusal, per-attempt hatch disclosure, and the
  silent https path. Mutation probe: stripping the gate condition reddens
  exactly 5 law tests (58 pass around them) — including the behavioral
  `connectWs` no-socket test, which dials against the parent's silent
  downgrade and is the red-on-parent for the surviving path itself.
- **Laws:** `routeManifest.gate` untouched (zero new request sites — the
  `:8097` site predates this change; only its scheme law moved); CSP stays
  permissive per the M-TIZEN-07 recorded posture; the vendored
  `@phlix/ui` REST credential lanes (`useAuthStore` login, `client.ts`
  refresh) remain the same dispositioned REST class — enforcement there is
  an @phlix/ui-side decision, out of this repo's edit scope per the
  thin-consumer rule.

### Fixed — TV-scale typography: rem base raised for the 1920 canvas, px outliers swept (M-TIZEN-11 / review tizen__gameux M3) — 2026-10-29

- **Root cause:** the fixed-viewport widget (`index.html` meta
  `width=1920`) never declared a root font-size, so `1rem` resolved to the
  browser default 16px and @phlix/ui's DESKTOP-tuned ladder rendered
  11–17px body text at couch distance. The splash "scaled fine" only because
  it hand-tunes absolute px — the idiom never generalized to the app body.
- **Cure (host-side, vendored files untouched):** `html { font-size: 24px }`
  in `index.html` — the classic TV-web pattern; every rem (controls, spacing,
  clamp rungs) scales ×1.5 at once. On top, `src/styles/tv-typography.css`
  re-floors the six small ladder rungs in `html:root` (specificity 0,1,1
  beats the vendor `:root` 0,1,0 order-independently):
  2xs 24 / xs 26 / sm 28 / base 30 / md 32 / lg 36 px. Pure raising could
  not meet the floor (24 × .6875 = 16.5px); the re-floor is the documented
  LEAST the ladder needed to sit entirely ≥ 24px on the shipped canvas.
  Effective ladder end-to-end: body 30px, card titles 32px, rail headers 42px,
  page headers 60–90px — the six untouched clamp rungs never drop below
  33.6px at root 24 and render 42–144px on the 1920 canvas (math pinned by
  test).
- **Sweep:** every literal px/rem font size in `src/**` now consumes the
  ladder — ChapterOverlay's four micro rules (10/12/12/14px),
  QuickConnectPanel (7 rules), ScreenSaver/ActionToast/TelemetryConsent
  `font:` shorthands split to longhands on tokens, and 8 raw-rem literals in
  RatingModal/RatingBadge/UserRatingPicker/ParentalControlsPage.
  `index.html`'s inline splash px stays allow-listed BY VALUE (≥24 verified).
- **Known residual (upstream):** ~9 vendored @phlix/ui player-chrome rules
  hardcode 10–13px instead of consuming tokens (`.chapterlist__*`,
  `.control-btn__label`, player time/kbd micro-readouts). Host-side reach
  would mean duplicating hash-scoped vendor selectors — the exact fragility
  the anti-fork law prevents; ticketed for a ui-side tokenization pass.
- **Laws:** `tests/unit/tvTypography.test.ts` (9 tests) pins root raise in
  source AND shipped `package/index.html`, the by-value splash allow-list,
  the floored monotonic ladder, `html:root` specificity + import order, the
  byte-intact vendor ladder in the bundle (anti-fork), the ≥24px floor for
  EVERY effective rung resolved at root 24/1920, the src-wide no-literal
  sweep, and the four named ChapterOverlay anchors. 8/9 red at parent
  3108866 (the anti-fork pin is parent-green by design).
  `package/` re-vendored via `npm run package`.

### Fixed — transport keys: single-tap live, hold throttled, dead vocabulary removed (M-TIZEN-09 / review tizen__gameux M1) — 2026-10-29

- **Single-tap was dead by classification.** `FAST_FORWARD`/`REWIND` were
  repeatable-ONLY (`KeyMapping.ts:95-102` at the parent) and absent from
  `IMMEDIATE` (`:106-123`), so a lone press emitted nothing — its only effect
  was `preventDefault` (`RemoteManager.ts:112-117`). The bridge already carried
  the designed tap arm (`seekBy(±SEEK_STEP_SECONDS=10)` gated on the ABSENCE of
  `action.repeat` — reachable only from voice at the parent). Cure = admit
  FF/REW to `IMMEDIATE` (keydown-emit model — the state machine's existing
  shape; a keyup-detector would invent per-press repeat-tracking that exists
  nowhere); the ±10/±30 ternary went live unchanged.
- **Hold was a teleport.** The repeat timer fired `+30 s` every
  `keyRepeatInterval = 100 ms` (`:42`) from 500 ms ≈ 300× timeline. `100 → 500`
  with the steps staying RELATIVE (`seekBy`, never a target jump): held FF now
  runs 30 s steps at 2 Hz = 60×, inside mainstream fast-forward. Tap-vs-hold
  boundary stays at the unchanged `keyRepeatDelay = 500 ms`.
- **Dead vocabulary, both-sides audited** (the only functional consumers are
  `wireTizenBridge`'s switch + the cosmetic `ActionToastOverlay`; vendored
  `@phlix/ui` v0.99.10 subscribes to nothing on the shell bus). REMOVED —
  `PREVIOUS` 424 (`next` exists in the store, `previous` has ZERO seams
  anywhere), `RED/GREEN/BLUE` 403/404/406 and `MENU/INFO/TOOLS` 10282/18/113
  (swallowed + captioned, accomplish nothing; MENU/INFO actively DENY the TV's
  own surfaces), `OPTIONS` 79 (unclassified AND a desktop-'O' collision).
  WIRED to EXISTING store seams only: `NEXT → next(item => item.stream_url ??
  '')` (bare `next()` writes an empty streamUrl — resolver mandatory),
  `VOLUME_UP/DOWN → setVolume(volume ± 0.05)` (the vendored ArrowUp/Down idiom;
  the store clamps + auto-unmutes), `MUTE → toggleMute()`. `YELLOW` stays
  (live quality menu). `CHANNEL_UP/DOWN` KEPT after re-audit: no functional
  consumer, but the immediate+handled swallow is DEVELOPER.md's DOCUMENTED
  live-TV-zap guard and M1 never enumerated them (misleading caption logged as
  a MINOR residual).
- `REMOTE_KEYS` sheds `MediaPrevious` + `Info`; the voice command list derives
  from the ONE vocabulary (`PREVIOUS` phrase gone with its action).
- **Measured:** vitest FULL serial 52 files 874 → **883** (+9 exact: 4 tap /
  cadence-pair / retired-emit / 3 bridge seams … full list in
  `.reviews/fixlog/M-TIZEN-09__fix.md`); the 21 new/rotated pins are RED at
  parent `34c0bb3` with only this lane's test files overlaid (21 failed |
  133 passed across the five touched files — measured-from-red); `vue-tsc` 0;
  `eslint` 0; `package/` rebuilt, 30-for-30 chunk renames + `index.html` ref,
  determinism ×2 aggregate md5 `0966d6c4f32f6c6941af09d9d2ccdc1b`; bundle
  honesty grep: zero dead-vocabulary strings in the shipped chunks.
- Adjacent NOT-fixed (reported): keyCode 66 (`PLAY_PAUSE`) is desktop 'B' —
  typing 'b' outside the digit-branch typing guard toggles playback; digit
  buffer has no DIGIT_COMMIT consumer (pre-existing MINOR m3). Doc-currency
  owed: DEVELOPER.md:195/:306 + AGENTS.md:54-56/:70/:87/:159 (lane law —
  reported for closeout collection, not self-edited).

### Fixed — the claim side can no longer undercut the Chromium ≥ 85 engine floor (M-TIZEN-08 / review tizen__exploiter) — 2026-10-29

- **Premise reconciled, nothing fabricated.** The review's pre-85-support chain
  read `app/config.xml required_version="6.5"` as an engine claim. Per the
  canonical contract (`docs/runtime-floor.md`, landed `76379f5`) that line is a
  Tizen PLATFORM version and the repo explicitly refuses to fabricate a
  Tizen↔Chromium mapping — so the manifest cannot be adjudicated below the
  floor, and this lane does not invent the arithmetic. Bundle side verified
  fresh against the committed `package/`: logical-assignment census equals the
  floor doc's measured table exactly (`||=` 530 / `&&=` 37 / `??=` 1; entry
  chunk `index-J2WGZPKQ.js` 147 + 3), so the entry chunk ships its ≥ 85 syntax
  BY DESIGN under the honest contract — no `vite.config.ts`, manifest, or
  bundle change; the cured-by `d2a5202` was in fact the spatial-nav focus cure,
  the floor half being `76379f5`.
- **The real survivors, enumerated both-sides:** `DEVELOPER.md` carried the
  last unreconciled engine claim — "…for pre-Chrome-98 Tizen webviews" with
  zero floor bounding anywhere in the file (grep-proven pre-fix); read naively
  it admits a sub-85 supported population while the shipped entry chunk
  hard-fails parsing there (permanent CSS splash). `README.md:51` was already
  bounded (`chrome100` sentence carries the ≥ 85 contract + tripwire +
  canonical pointer), `src/polyfills.ts` likewise. Examined and excluded:
  `VERIFICATION.md:187` (names Chromium 100 — above the floor),
  `VERIFICATION.md:1033/1035` (platform-capability claim for MediaCapabilities
  with the ui `canPlayType` fallback — no engine-version support claim),
  `docs/signing.md` (Studio tooling versions only); historical records stay
  verbatim per estate law.
- **Cure:** the `DEVELOPER.md` polyfill paragraph now bounds its field intel
  with the contract — Chromium ≥ 85, pointer to `docs/runtime-floor.md` and
  the tripwire — and states the honest consequence below the floor: a parse
  failure, not a polyfillable condition; such engines are NOT a supported
  population.
- **Tripwire extension (`tests/unit/distApiFloor.test.ts`, +3 tests):** L1
  pins the manifest silent about engines (zero Chrome/Chromium tokens in
  `app/` + `package/config.xml`; `required_version` stays the literal platform
  `'6.5'`) — preventative, shipped green (no contradiction exists today,
  disclosed); L2 pins the floor doc's own adjudication sentences ("not a
  Chromium version" / "does not fabricate") so any future 6.5→Chromium mapping
  must re-adjudicate through the law; L3 obliges every hand-written
  claim-surface doc that speaks engine versions (README / DEVELOPER /
  `src/polyfills.ts`) to state the ≥ 85 floor literal AND the canonical
  pointer in the same file — red-on-parent measured at `e4c81bb` on
  `DEVELOPER.md` before the prose fix, green after.
- **Gates (measured):** vitest full serial 52 files / 871 → 874 tests (+3
  exact); `vue-tsc --noEmit` clean; `eslint .` clean; `npm run build` rebuilt
  `dist/` byte-identical (`git status` clean under `dist/`) — docs+tests-only
  cure, zero bundle bytes moved, `package/` untouched, no `.wgt` churn.

### Fixed — server/hub address passes an http(s) scheme allow-list at the storage boundary (M-TIZEN-07 / review tizen__exploiter MAJOR-2) — 2026-10-29

- **The persisted-address trust closes.** `phlix.serverUrl` / `phlix.serverHistory`
  were written verbatim and read verbatim: the review's coords re-derived at this
  tip (siblings moved lines) confirmed `resolveAppConfig` passed the stored string
  through as `apiBase` (the credential-carrying base), `pushAddressHistory`
  stored any non-blank trim, and `onConnectionChange` persisted raw. The adjacent
  C27 `d2a5202` was the spatial-nav focus cure and the M6 relay TLS law
  `e4d8516` guards the relay DIAL — neither gated persistence; disk-reproved open
  here before this cure.
- **The law (parse at the boundary, both edges):** one single-source validator
  in `src/resolveConfig.ts` — `isAllowedServerAddress` / `sanitizeServerAddress`
  — admits an ABSOLUTE URL only when `new URL()` parses its protocol as
  `http:`/`https:` (the URL parser, not a regex, is the arbiter: scheme-case
  `JAVASCRIPT:`, padded `'  javascript:…'`, and tab/CR-split `java\tscript:`
  all classify honestly); null/undefined stays null, blank stays blank, and
  NON-absolute strings (relative bases, scheme-less text) keep their existing
  pass-through semantics. Writes refuse (Connect choice persisted only when it
  survives the gate; a refusal leaves the previous clean slot intact + warns
  loud), the resolve read normalizes (a legacy-poisoned base falls to env →
  empty → the Connect screen re-asks — stored-forever entries cannot drive the
  bearer base), and the history read sanitizes (suggestion rail + probes
  never carry poison; the next clean connect rewrites storage through the
  filter and heals the slot).
- **Gated edges:** `pushAddressHistory` (history writes), `readAddressHistory`
  (legacy sanitize, feeds `buildConnectSuggestions` + every scan probe),
  `resolveAppConfig` (boot resolve), `main.ts` `onConnectionChange` (slot
  writes), the `phlix.hubUrl` relay read, and the connectScan `currentBase`
  read. `@phlix/ui`'s own `phlix.connection.apiBase` slot and the M6 relay
  refusal logic are untouched — composition, not replacement: plaintext
  `http://` LAN bases stay persistable by design; only non-http(s) ABSOLUTE
  schemes are refused, and the relay dial still independently demands `https:`.
- **CSP `connect-src` — assessed, honestly NOT tightened (no theater).** The
  app origin is `file://` (a `.wgt`), so `'self'` carries no API traffic; the
  base IS user-configured, arbitrary-origin, plain-`http`-by-default LAN
  servers — narrowing to `https: wss:` breaks every non-TLS LAN deployment and
  pinning hosts is impossible. Owner-reel note filed with this close; the
  disposition is recorded in an `index.html` comment. The credential-theft
  class the finding describes is cured at the storage boundary, above.
- **Measured:** full vitest serial 52 files / 833 → 871 tests (+38: scheme-class
  table 17 refused + 8 accepted classes, resolve-composition 4, history
  gate/sanitize/heal 5, boot-composition 4 in `main.test`); mutation matrix
  re-pinned from measured reds — strip resolve gate = 3 red, strip read filter
  = 3 red (the load-bearing legacy case is host-carrying `ws://evil:8097`;
  host-less `javascript:`/`data:`/`file:` classes coincide with
  `prepareCandidates`' empty-host drop, disclosed), strip push gate = 1 red,
  strip main write/hub/currentBase gates = 4 reds; vue-tsc 0, eslint 0,
  vite build + `npm run package` clean; served entry chunk `package/assets/
  index-J2WGZPKQ.js` carries the refusal string, `package/index.html` carries
  the CSP disposition note; zero new request sites (routeManifest scan stays 27),
  zero new user strings (i18n law untouched — refusal surfaces through the
  console idiom the M6 cure established), `app/config.xml` byte-identical.

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
