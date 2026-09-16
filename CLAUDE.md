# CLAUDE.md

Samsung Tizen TV client for Phlix Media Server. A **thin Vue 3 consumer of `@phlix/ui`** — TypeScript → Vite (`@vitejs/plugin-vue`, target `chrome100`) → Tizen Chromium TV webview, packaged as a signed `.wgt`. The entire UI (browse/detail/player/settings/auth) is rendered by `@phlix/ui`'s `createPhlixApp()`; this repo is just the boot glue + the Tizen remote/spatial-nav bridge (mirrors the Windows/Electron client). HLS is provided by `@phlix/ui`'s player and tuned for TV RAM via `playerHlsConfig`.

Pinned: `@phlix/ui` `github:detain/phlix-ui#v0.99.4`, `@phlix/contracts` `#v0.4.7`, `@phlix/syncplay` `#v0.1.5`. Peer deps Vue 3 + Pinia + vue-router.

## Commands

```bash
npm ci --allow-git=all # reproducible install from the TRACKED, commit-pinned package-lock.json (audit W105 T-01); CI uses this
npm run dev              # vite dev server at :8080
npm run build            # vue-tsc --noEmit && vite build → dist/
npm run typecheck        # vue-tsc --noEmit (no emit)
npm run preview          # vite preview of the built dist/
npm test                 # vitest run (jsdom)
npm run test:watch       # vitest watch mode
npx vitest run tests/unit/tizenBridge.test.ts   # single file
npx vitest run -t "BACK"                         # single test by name
npm run lint             # eslint . (flat config, repo-wide)
npm run lint:fix         # eslint . --fix
npm run package          # npm run build + node scripts/package.js → package/
```

There is no webpack, no Babel, no Jest. `npm run package` builds then assembles `package/` (vite `dist/` + `app/config.xml` + `app/icon.png` at the widget root — the manifest declares `<icon src="icon.png"/>`; audit W105 T-03). Tizen `.wgt` signing still happens in Tizen Studio (or the `tizen` CLI) against the `package/` output — no npm script produces a signed widget.

## Architecture

**Entry**: `index.html` (repo root, the Vite root) loads `/src/main.ts`, which mounts into `#phlix-app`, `#phlix-spatial-host`, `#phlix-chapter-overlay`, `#phlix-skip-intro-overlay`, and `#phlix-pip-overlay`.

`src/main.ts` `boot()` flow:
1. `import './polyfills'` FIRST (installs a `structuredClone` fallback for older Tizen webviews — `@phlix/ui`'s SettingsForm needs it).
2. Resolve the server URL: `localStorage['phlix.serverUrl']` → `import.meta.env.VITE_PHLIX_SERVER_URL` → **empty** (via `resolveAppConfig` in `src/resolveConfig.ts`, server-mode only — no hub IPC on Tizen). An empty base + `requireConnection: true` makes `@phlix/ui` show its first-run Connect screen instead of guessing `localhost`; the chosen URL is mirrored back to `localStorage['phlix.serverUrl']` via `onConnectionChange`.
3. Resolve a stable `deviceId` (`src/deviceId.ts`, persisted as `phlix.deviceId`).
4. `buildPhlixHeaders({ deviceId, deviceName, deviceType: 'samsung-tizen' })` (from `@phlix/contracts`).
5. `createPhlixApp({ app, apiBase, deviceHeaders, defaultTv: true, defaultTheme: 'nocturne', branding: { wordmark: 'Phlix' }, playerHlsConfig: TIZEN_HLS_CONFIG, menu: buildMenu(), extraRoutes: buildExtraRoutes() })` → `.mount('#phlix-app')`. Without a supplied `menu` the shell renders NO top-bar nav at all; `buildExtraRoutes()` carries the full `/app` prefix (the router's history base is `/`).
6. `installTizenBridge(application)` wires the remote — subscribes `wireTizenBridge` to `RemoteManager` actions AND (S509) registers the 2020+ `tvinputdevice` media/channel/colour keys once, releasing them in the returned teardown.
7. Mount a SECOND tiny app `createApp(SpatialNavHost).use(pinia).use(router).mount('#phlix-spatial-host')`, reusing the main app's pinia + router (read off `application.config.globalProperties.$pinia` / `$router`) so it observes the same prefs + route.
8. Mount THREE more tiny apps the same way, each reusing that same pinia + router so they observe the same route: `ChapterOverlay` → `#phlix-chapter-overlay` (3rd), `SkipIntroOverlay` → `#phlix-skip-intro-overlay` (4th), `PiPController` → `#phlix-pip-overlay` (5th). (S501 T-04/T-06: the former 4th/7th apps `SleepTimerOverlay` + `UpNextOverlay` are DELETED — unreachable root-mounted duplicates of `@phlix/ui`'s PlayerPage-bundled Up Next + sleep-timer, whose 250 ms player-position polls ran for the whole app lifetime.)
9. `wireHubRelayConsumer(pinia, apiBase, storage, deviceHeaders)` — opens the S298 hub-relay socket and the pending-command dispatcher (see `api/hubRelay.ts` / `syncplayDispatch.ts` below). No hub context resolved ⇒ nothing opens.

**`src/` files** (all the code this repo owns):
- **`main.ts`** — boot, `createPhlixApp` config, `TIZEN_HLS_CONFIG` (bounded buffers, `capLevelToPlayerSize`, `enableSoftwareAES`), `buildMenu()` / `buildExtraRoutes()`, 2nd-app SpatialNavHost mount, 3rd–5th-app overlay mounts (`ChapterOverlay`, `SkipIntroOverlay`, `PiPController`), and `wireHubRelayConsumer` (which, since S510, maps the relay's transient `waiting-visible` status to a single auto-dismissing `@phlix/ui` toast — non-modal, cleared on recovery).
- **`api/hubRelay.ts`** — the S298 hub-relay `pending_command` consumer ("Alexa, play X"). Connects to `ws(s)://<hub>:8804/syncplay/<server_id>` and carries the relay token on the `Sec-WebSocket-Protocol: bearer, <token>` subprotocol — a TV webview cannot set request headers, and query-string tokens are refused by design. The token is minted from `POST /api/v1/me/servers/{server_id}/relay-token` and re-read on every reconnect (relay tokens expire). Exports `resolveHubRelayConfig`, `openHubRelayConnection`, `closeHubRelayConnection`, `getHubRelaySocket`, `parsePendingCommandFrame`, `HUB_SYNC_PLAY_PORT`. Only `pending_command` / `play_media` frames are consumed; everything else is ignored. The socket opens whenever the app is open with a hub context — it is NOT tied to a SyncPlay room join. Reconnects climb a capped exponential ladder; on exhaustion (S510/T-14) the module stops background hammering and re-asks once on the next foreground `visibilitychange` edge (re-bounded by the same ladder), surfacing the transient `'waiting-visible'` status — never a modal. `HubRelayStatus` ∈ `connecting|open|reconnecting|closed|waiting-visible`; the visibility source injects via `visibilitySource` (defaults to `document`; `null` = classic silent close).
- **`syncplayDispatch.ts`** — `wirePendingPlayMediaDispatcher(store, deps)`: watches the store's `pendingPlayMedia` slot, resolves the bare media id through the app's real `ApiClient` (`GET /api/v1/media/{id}`), then `player.setCurrent()` + `player.play()` and consumes the slot. An unresolved id is NOT consumed (the command stays in the slot); a stale-resolution guard drops a result superseded by a newer command. Structurally-typed deps so tests inject fakes; returns an unwatch.
- **`components/ChapterOverlay.vue`** — portal-rendered overlay (mounted as the 3rd app into `#phlix-chapter-overlay`); fetches chapters from `GET /api/v1/media/{id}/chapters` and markers from `GET /api/v1/media/{id}/markers`, then renders gold chapter tick marks, colored intro/outro/credits/ad ticks, a chapter title label, and an "Ad" badge on the player seekbar. Position is tracked by 250 ms polling.
- **`components/SkipIntroOverlay.vue`** / **`components/PiPController.vue`** — the 4th/5th mounted overlay apps: `GET /api/v1/media/{id}/markers`-driven Skip Intro/Skip Outro buttons (poll bounded to the player route — S501 T-05), and a Samsung Tizen picture-in-picture toggle gated on `document.pictureInPictureEnabled`. (S501 T-04/T-06 deleted `SleepTimerOverlay.vue` and `UpNextOverlay.vue` — see the boot-flow note above.)
- **`components/AudioTrackList.vue`** / **`components/SubtitleTrackList.vue`** / **`components/ChapterList.vue`** / **`components/RecommendationCard.vue`** / **`components/RatingBadge.vue`** / **`components/RatingModal.vue`** / **`components/UserRatingPicker.vue`** — D-pad-optimised TV lists/cards consumed by `pages/ChaptersPage.vue`, `pages/AudioTracksPage.vue`, `pages/SubtitleTracksPage.vue`, and `screens/RecommendationsScreen.vue`. Every locally-kept component carries a `@category TV-Specific Component` (plus `@duplicate`) docblock recording why it is not `@phlix/ui`'s version — keep that note current when editing one.
- **`pages/AudioTracksPage.vue`** / **`pages/SubtitleTracksPage.vue`** — routes `/app/audio-tracks/:id` and `/app/subtitle-tracks/:id`; both read the SINGLE `GET /api/v1/media/{id}/playback-info` rail (`audio_tracks` / `subtitle_tracks`). Subtitles dispatch by `track.language` (`player.setSubtitle`), not by the wire `track.id`, because the store and HTML5 textTracks key on language.
- **`pages/ParentalControlsPage.vue`** — route `/app/parental-controls` (reachable from the `buildMenu()` nav entry); profile schedules, tags and stream limits over `GET|POST|PUT|DELETE /api/v1/profiles/{id}/schedules` (edit is `PUT …/schedules/{scheduleId}` with a snake_case body — S502), `GET|POST|DELETE /api/v1/profiles/{id}/tags`, and `GET|PUT /api/v1/profiles/{id}/stream-limits`.
- **`pages/MusicPage.vue`** + **`components/MusicAlbumCard.vue`** / **`components/MusicArtistCard.vue`** / **`components/TrackListItem.vue`** — local music-browsing UI, backed by the `src/stores/useMusicStore.ts` Pinia store. The music API wraps single resources in envelopes — `GET /api/v1/music/albums/{id}` returns `{ album }` and `GET /api/v1/music/tracks/{id}` returns `{ track }`, so the store unwraps before assigning.
- **`stores/useSyncPlayStore.ts`** — SyncPlay real-time sync store: REST through its local `SyncPlayApiClient` (`/api/v1/syncplay/groups`), frames through `@phlix/syncplay`'s `SyncPlayClient` + `serializeMessage`. Also the hub-relay consumer surface — `applyPendingPlayMedia(command)` adopts a delivered frame into the `pendingPlayMedia` slot, `consumePendingPlayMedia()` clears it.
- **`polyfills.ts`** — `structuredClone` guard. MUST be imported before any `@phlix/ui` code.
- **`resolveConfig.ts`** — pure `resolveAppConfig({serverUrl, envUrl})` → `{app:'server', apiBase}`. Unit-tested; shape kept extensible for a future `app:'hub'` branch.
- **`deviceId.ts`** — pure `resolveDeviceId(storage)`; prefers `crypto.randomUUID`, deterministic fallback for ancient webviews.
- **`SpatialNavHost.vue`** — renderless component; `useSpatialNav({ enabled: () => Boolean(prefs.tv) && route.name !== 'player' && !qualityMenuActive.value })`. Enables `@phlix/ui` D-pad spatial navigation for browse, DISABLES it on the player route so the player's own Arrow seek/volume shortcuts win, and also gates on the shared `qualityMenuActive` flag (`tizenBridge.ts`) as an explicit invariant — spatial-nav is already off on `player`, so this conjunct matters only if the flag were ever set outside that route.
- **`tizenBridge.ts`** — `installTizenBridge(app, tizenLike?)` + the pure `wireTizenBridge(remote, player, router, getRoute, quality)`. Subscribes to `RemoteManager` `'action'` events and maps transport/nav keys onto the `@phlix/ui` `usePlayerStore` + vue-router. Structurally-typed deps for testability (mirrors `electronBridge.ts`). Map: `PLAY`/`PLAY_PAUSE`→toggle, `PAUSE`→pause, `STOP`→`closePlayer()`, `FAST_FORWARD`/`REWIND`→`seekBy(±10`, `±30` when held`)`, `BACK`→dismiss the quality picker if open, else `closePlayer()`+`router.back()` on the player route else `router.back()`, `HOME`→`router.push('/app')`, `YELLOW`→open/toggle the on-screen `QualityMenu` (only on the player route, only when it's actually rendered — ≥2 ABR rungs). Arrows/ENTER are deliberately NOT bridged directly, EXCEPT while quality mode is active, where a `RemoteManager.suppressPropagation` hook stops the D-pad arrows from also hitting the player's seek/volume shortcuts so the focused `Select` owns them. Quality-mode teardown is choke-pointed through one `close()`: a `MutationObserver` on the trigger's `aria-expanded` catches the menu closing ITSELF (rung picked/Escape/outside click), and a `router.afterEach` guard catches the player/route being left (Home, etc.) — see `DEVELOPER.md` for the full mechanism and why both are needed. **S509:** `installTizenBridge` also calls `installRemoteKeyRegistration(tizenLike)` so the 2020+ `tvinputdevice` media/channel/colour keys are registered once at app-ready and released in the same teardown (no parallel key pipeline; absent `tizen` = inert).
- **`remote/RemoteManager.ts`** — KEPT + ported to TS. The single source of TV-remote events (analogue of Electron media events). Captures `keydown`/`keyup` on `document`, emits `'keydown'`/`'keyup'`/`'action'`, held-key repeat (FF/REW accel). `on()` returns an unsubscribe fn. Exposes a host-settable `suppressPropagation` hook (used by `tizenBridge.ts` for the quality-menu D-pad passthrough above) that `stopImmediatePropagation()`s a keydown so later `document` listeners (the player's Arrow shortcuts) don't also fire; RemoteManager itself stays quality-agnostic. Default singleton export.
- **`remote/KeyMapping.ts`** — KEPT + ported + **retargeted**: KEY_MAP still lists arrows/ENTER (for logging), but they are removed from `isRepeatable`/`isImmediate`/`isHandled`, so RemoteManager neither `preventDefault`s nor emits actions for them — `useSpatialNav` owns the D-pad, native focus owns ENTER. Samsung codes: 10009 `BACK`, 415 `PLAY`, 413 `STOP`, 19 `PAUSE`, 417 `FAST_FORWARD`, 412 `REWIND`, color keys 403–406. S509 adds the `tvinputdevice`-reachable media/channel codes (`10252`→`PLAY_PAUSE` alias, `427`/`428`→`CHANNEL_UP`/`CHANNEL_DOWN`, immediate+displayed) and names the digits 48–57 `DIGIT_0`–`DIGIT_9` (+ `isDigit()`) as routing groundwork — digits stay out of immediate/handled so text fields keep typing.
- **`remote/registerKeys.ts`** (S509) — pure, `deviceId.ts`-style wrapper over `tizen.tvinputdevice.registerKey`/`unregisterKey`. `installRemoteKeyRegistration(tizenLike?)` registers `REMOTE_KEYS` (MediaPlay/Pause/PlayPause/Stop/FastForward/Rewind/Next/Previous + NextChannel/PreviousChannel + Colors/Info) once, per-key fail-soft, and returns a teardown releasing exactly what was acquired; absent `tizen` (browser dev / jsdom) = silent no-op. Invoked from `installTizenBridge`, so it follows the bridge's app-ready/teardown pairing rather than opening a second key pipeline.

**Rule**: media/library/auth/player screens live in `@phlix/ui` — to change one, edit `phlix-ui`. This repo's own UI is limited to boot config (`main.ts`), the remote bridge (`tizenBridge.ts` / `remote/*`), spatial-nav gating (`SpatialNavHost.vue`), the hub-relay glue (`api/hubRelay.ts` / `syncplayDispatch.ts`), the player overlays / music / rating / track components and pages under `src/components/` + `src/pages/` + `src/screens/` (backed by `src/stores/`), or the Tizen manifest (`app/config.xml`).

@./DEVELOPER.md

## Tizen runtime constraints

- **No pointer/mouse** — keyboard/D-pad only. D-pad navigation is `@phlix/ui`'s `useSpatialNav` (gated by `SpatialNavHost.vue`); transport keys come through `RemoteManager` → `tizenBridge`. There is no manual D-pad focus-traversal code in this repo — the only direct focus manipulation is the quality-menu trigger handoff (`focus()`/`blur()` in `tizenBridge.ts`).
- **Fixed `1920x1080` viewport** (`index.html` meta viewport).
- **HLS RAM tuning** — Samsung TV webviews are memory-constrained; `TIZEN_HLS_CONFIG` in `main.ts` is passed via `playerHlsConfig` to bound buffers, cap level to player size, and enable software AES. Tune HLS here, not in `phlix-ui`.
- **`app/config.xml`** is the Tizen widget manifest (`.wgt`): app id `phlix.app.phlixtizen`, `required_version` `6.5`, `<content src="index.html"/>`, `<access origin="*">`, `<tizen:profile name="tv-samsung"/>`, `hwkey-event="enable"` on `<tizen:setting>`, privileges (`internet`, `tv.inputdevice` — the S503 hygiene pass pruned the five that carried zero backing `tizen.*`/`webapis` use: `tv.window`, `tv.audio`, `network.get`, `application.launch`, `filesystem.read`), landscape/maximized. New TV capability usually means editing this file — add its privilege WITH the feature, never ahead of it. `scripts/package.js` copies it to the `package/` root.
- **Device → quality profile is now server-side.** The client no longer posts a hand-rolled device profile; it just sends `X-Phlix-Device-Type: samsung-tizen` (via `buildPhlixHeaders`) and phlix-server maps that header to the streaming/transcode quality profile.

## Code style

Flat ESLint (`eslint.config.mjs`, `eslint .`, CI-enforced): `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-vue` `flat/recommended`.

- TypeScript + Vue SFCs (`vue-eslint-parser` with `tseslint.parser` for `<script lang="ts">`).
- ESM only (`"type": "module"`).
- `no-undef` is off (vue-tsc/tsc resolve identifiers + globals — it misfires otherwise).
- `@typescript-eslint/no-unused-vars` is error — prefix intentionally-unused with `^_`. `no-explicit-any` is `warn` (off in tests).
- `vue/multi-word-component-names` off (single-word `@phlix/ui` surface).
- Ignores `dist/`, `node_modules/`, `app/` (legacy reference / manifest only), `package/`, `coverage/`, `.logs/`.

## Tests

Vitest + `jsdom` + `@vue/test-utils` (`vitest.config.ts`, `npm test`). Tests live in `tests/unit/*.test.ts` and are co-located by module name (the `src/` tree is flat). Setup `tests/test-setup.ts` provides an in-memory localStorage mock. Coverage (v8) excludes `app/**`, `tests/`, `dist/`, configs and is threshold-enforced in CI (statements 72 / branches 61 / functions 68 / lines 73 — pinned at the measured floor after the T-11 suites landed, S501 T-13; ratchet up, never down). Current suites (26 files): `resolveConfig`, `deviceId`, `polyfills`, `tizenBridge` (pure `wireTizenBridge` exercised with fakes), `SpatialNavHost`, `RemoteManager`, `KeyMapping`, `registerKeys` (S509, fake-tizen register/teardown pins), `ChapterOverlay`, `SkipIntroOverlay`, `SubtitleTrackList`, `useMusicStore`, `RatingBadge`, `RatingModal`, `UserRatingPicker`, `useSyncPlayStore`, `syncPlayWireShape`, `syncPlayMigration`, `hubRelay`, `syncplayDispatch`, `RouteWireShape`, `TrackWireShape`, `TrackApplyBoundary`, `ParentalControlsWireShape`, `routeManifest.gate`, and `main` (mocks `@phlix/ui`/`@phlix/contracts`/`vue` and asserts the boot wiring). SFC suites mount the component with `@phlix/ui`'s `ApiClient`/`useApiBase`/`usePlayerStore` and `vue-router` stubbed via `vi.hoisted` + `vi.mock`.

`tests/unit/routeManifest.gate.test.ts` pins every URL this client can put on the wire tuple-exact against the vendored `tests/fixtures/server-route-manifest.json` (a byte-for-byte copy of `@phlix/contracts`' `dist/server-route-manifest.json`, provenance sha + md5 asserted inside). Its per-file site counts are a pin, not a promise — adding, moving or removing a request site means updating that file's count there.

```bash
npx vitest run tests/unit/ChapterOverlay.test.ts       # the overlay SFC suite
npx vitest run tests/unit/routeManifest.gate.test.ts  # the client route gate
```

## Quirks

- **`package-lock.json` is TRACKED** (audit W105 T-01) — every git-dep resolution is pinned to an exact commit SHA, so CI installs reproducibly with `npm ci --allow-git=all`. Regenerate (`npm install`) and commit the lock whenever a pin in `package.json` changes.
- **`base: './'` in `vite.config.ts` is MANDATORY.** A `.wgt` loads from a `file://` origin on the TV, so absolute `/assets` paths 404. Relative base keeps every asset URL relative to `index.html`.
- **`structuredClone` polyfill** (`src/polyfills.ts`) must be imported first in `main.ts` — older Tizen Chromium lacks it and `@phlix/ui` needs it.
- **Server-side device→profile mapping** replaces the old client-posted device profile (see Tizen runtime constraints). Don't reintroduce a client profile.
- **`scripts/package.js` is ESM** (the repo is `"type": "module"`); run it via `npm run package`. It assembles `package/` from vite `dist/` + `app/config.xml`.
- **Tizen app id**: `app/config.xml` uses `phlix.app.phlixtizen`. `config.xml` is authoritative — the README CLI examples use it too.
- **Each overlay needs a host `<div>`** — adding a 6th mounted app means adding its container to `index.html` as well as the `createApp(...).mount(...)` call in `main.ts`.
- **Env vars are declared in `vite-env.d.ts`** — `VITE_PHLIX_SERVER_URL` plus the hub-relay overrides `VITE_PHLIX_HUB_URL` / `VITE_PHLIX_HUB_SERVER_ID`. The hub context otherwise comes from `localStorage` (`phlix.hubUrl`, `phlix.hubServerId`, `phlix.hubAccessToken`).
- `.github/workflows/test.yml` (`npx vitest run --coverage` — the coverage floor gate), `lint.yml` (`npm run lint` + `npm run build`) and `build.yml` (`npm run package` + a check that the committed `package/` matches a fresh build, audit W105 T-02) run on push — keep them green.

## Before Committing

**IMPORTANT:** Before every git commit, you MUST ensure Caliber syncs agent configs with the latest code changes.

First, check if the pre-commit hook is already installed:
```bash
grep -q "caliber" .git/hooks/pre-commit 2>/dev/null && echo "hook-active" || echo "no-hook"
```

- If **hook-active**: the hook handles sync automatically — just commit normally. Tell the user: "Caliber will sync your agent configs automatically via the pre-commit hook."
- If **no-hook**: run Caliber manually before committing:
  1. Tell the user: "Caliber: Syncing agent configs with your latest changes..."
  2. Run: `caliber refresh && git add CALIBER_LEARNINGS.md CLAUDE.md .claude/ .opencode/ 2>/dev/null`
  3. After it completes, briefly tell the user what Caliber updated. Then proceed with the commit.

**Valid `caliber refresh` options:** `--quiet` (suppress output) and `--dry-run` (preview without writing). Do not pass any other flags — options like `--auto-approve`, `--debug`, or `--force` do not exist and will cause errors.

**`caliber config`** takes no flags — it runs an interactive provider setup. Do not pass `--provider`, `--api-key`, or `--endpoint`.

If `caliber` is not found, tell the user: "This project uses Caliber for agent config sync. Run /setup-caliber to get set up."
## Session Learnings

Read `CALIBER_LEARNINGS.md` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
## Model Configuration

Recommended default: `claude-sonnet-4-6` with high effort (stronger reasoning; higher cost and latency than smaller models).
Smaller/faster models trade quality for speed and cost — pick what fits the task.
Pin your choice (`/model` in Claude Code, or `CALIBER_MODEL` when using Caliber with an API provider) so upstream default changes do not silently change behavior.

## Context Sync

This project uses [Caliber](https://github.com/caliber-ai-org/ai-setup) to keep AI agent configs in sync across Claude Code, Cursor, Copilot, and Codex.
Configs update automatically before each commit via `caliber refresh`.
If the pre-commit hook is not set up, run `/setup-caliber` to configure everything automatically.