# AGENTS.md

Samsung Tizen TV client for Phlix Media Server. A **thin Vue 3 consumer of `@phlix/ui`** — TypeScript → Vite (`@vitejs/plugin-vue`, target `chrome100`, `base:'./'`) → Tizen Chromium TV webview, packaged as a signed `.wgt`. All UI is rendered by `@phlix/ui`'s `createPhlixApp()`; this repo is boot glue + the Tizen remote/spatial-nav bridge (mirrors the Windows client). HLS comes from `@phlix/ui`'s player, RAM-tuned via `playerHlsConfig`. Pinned `@phlix/ui#v0.99.4`, `@phlix/contracts#v0.4.7`, `@phlix/syncplay#v0.1.5`; peer deps Vue 3 + Pinia + vue-router.

## Commands

```bash
npm ci --allow-git=all   # reproducible install from the committed package-lock.json (W105 T-01); CI uses this
npm run dev              # vite dev server :8080
npm run build            # vue-tsc --noEmit && vite build → dist/
npm run typecheck        # vue-tsc --noEmit
npm run preview          # preview built dist/
npm test                 # vitest run (jsdom)
npm run test:watch       # vitest watch
npx vitest run tests/unit/tizenBridge.test.ts  # single file
npx vitest run -t "BACK"                        # single test
npm run lint             # eslint . (flat config)
npm run lint:fix         # eslint . --fix
npm run package          # build + node scripts/package.js → package/
```

No webpack, no Babel, no Jest.

## Architecture

**Entry**: `index.html` (repo root = Vite root) → `/src/main.ts`, mounting `#phlix-app` + `#phlix-spatial-host` + `#phlix-chapter-overlay` + `#phlix-skip-intro-overlay` + `#phlix-pip-overlay` + `#phlix-action-toast-overlay` + `#phlix-quick-connect` (S520) + `#phlix-telemetry-consent` (S521) + `#phlix-screensaver` (S523). A CSS-only branded splash (`#phlix-splash`, S515 AD-3) paints from the first HTML frame and retires declaratively via `#phlix-app:not(:empty) ~ #phlix-splash` when Vue mounts (or `renderBootFailure` writes) — zero JS in its lifecycle.

`main.ts` `boot()`: import `./polyfills` first → resolve server URL (`localStorage['phlix.serverUrl']` → `VITE_PHLIX_SERVER_URL` → **empty**, via `resolveConfig.ts`; an empty base + `requireConnection: true` shows `@phlix/ui`'s first-run Connect screen instead of guessing `localhost`, and the chosen URL is mirrored back to `localStorage['phlix.serverUrl']` via `onConnectionChange`) → `resolveDeviceId` (`deviceId.ts`) → `buildPhlixHeaders({deviceType:'samsung-tizen'})` → `createPhlixApp({app, apiBase, deviceHeaders, defaultTv:true, defaultTheme:'nocturne', branding:{wordmark:'Phlix'}, playerHlsConfig:TIZEN_HLS_CONFIG, menu:buildMenu(), extraRoutes:buildExtraRoutes()}).mount('#phlix-app')` → `installTizenBridge(app)` → `installGamepadBridge()` (S522 AD-20 dev/QA gamepad→synthetic-keyboard; silent no-op where there is no Gamepad API, so a TV boot is byte-identical) → mount a 2nd `createApp(SpatialNavHost).use(pinia).use(router).mount('#phlix-spatial-host')` plus 3rd–9th overlay apps (`ChapterOverlay` → `#phlix-chapter-overlay`, `SkipIntroOverlay` → `#phlix-skip-intro-overlay`, `PiPController` → `#phlix-pip-overlay`, `ActionToastOverlay` → `#phlix-action-toast-overlay`, `QuickConnectPanel` → `#phlix-quick-connect`, `TelemetryConsent` → `#phlix-telemetry-consent`, `ScreenSaverOverlay` → `#phlix-screensaver`), all reusing the main app's pinia + router → `wireHubRelayConsumer(pinia, apiBase, storage, deviceHeaders)`.

- **`src/bootProbe.ts`** (S515 AD-3): pure `probeBootBase(apiBase, fetchImpl?)` → `'empty' | 'reachable' | 'unreachable'` — reuses `@phlix/ui`'s exported `probeServer` (GET `{base}/health`, 6s `AbortController`, loose body rule `status==='ok' || version !== undefined`; never hard-asserts the server tuple). Empty base = NO probe (the ui connect-gate owns first-run). `boot()` awaits it; on `'unreachable'` it keeps the real `apiBase` + the persisted URL (non-destructive) and installs a ONE-SHOT pre-mount `router.beforeEach` steering the first navigation to the D-pad-operable Connect screen (whose "Connect anyway" keeps CORS-restricted back ends usable) — needed because `effectiveBase()` prefers the ui-persisted `phlix.connection.apiBase`, so passing an empty base would not fire the gate after any past Connect commit.
- **`src/main.ts`**: boot + `createPhlixApp` config + `TIZEN_HLS_CONFIG` + `buildMenu()` (top-bar nav, incl. `Parental Controls`; the `requiresAdmin` Admin entry is emitted ONLY when the S517 default-off flag `VITE_PHLIX_TV_ADMIN=1` is set — unset, `/app/admin/*` has no route; the flag drops the admin-layout chunk, page chunks stay via ui's static registry import = ui follow-up) + `buildExtraRoutes()` (`buildAdminRoutes()` spread behind the same flag, `LibraryScanPage`, chapters / audio-tracks / subtitle-tracks / recommendations / parental-controls) + 2nd-app SpatialNavHost mount + 3rd–9th overlay app mounts (`ChapterOverlay`, `SkipIntroOverlay`, `PiPController`, `ActionToastOverlay` — S516 AD-13 transient focus/action caption, pinia-only, focus-safe — `QuickConnectPanel` → `#phlix-quick-connect`, S520 AD-25 password-free pairing, pinia-only, self-gated — `TelemetryConsent` → `#phlix-telemetry-consent`, S521 AD-27 one-time opt-in privacy card, pinia-only, self-gated — and `ScreenSaverOverlay` → `#phlix-screensaver`, S523 AD-21 idle overlay, pinia-only, never focusable, playback-vetoed) + the hub-relay consumer wiring + start-when-opted-in telemetry boot.
- **`src/api/hubRelay.ts`**: S298 hub-relay `pending_command` consumer — `ws(s)://<hub>:8804/syncplay/<server_id>`, token carried on the `Sec-WebSocket-Protocol: bearer, <token>` subprotocol (a TV webview cannot set request headers), minted via `POST /api/v1/me/servers/{server_id}/relay-token`. Exports `resolveHubRelayConfig`, `openHubRelayConnection`, `closeHubRelayConnection`, `parsePendingCommandFrame`. The socket opens whenever the app is open with a hub context — not inside a SyncPlay room. Reconnect uses a capped exponential ladder (5 rungs); on exhaustion (S510/T-14) it stops background hammering and re-asks once on the next foreground `visibilitychange` edge (bounded again by the same ladder), surfacing the transient `HubRelayStatus` `'waiting-visible'` for a non-modal notice. `HubRelayStatus` = `connecting | open | reconnecting | closed | waiting-visible`; the visibility source is injectable (`HubRelayVisibilitySource`, defaults to `document`, `null` opts out to a silent `closed`).
- **`src/syncplayDispatch.ts`**: `wirePendingPlayMediaDispatcher(store, deps)` — watches the store's `pendingPlayMedia` slot, resolves the bare media id via `GET /api/v1/media/{id}`, then `player.setCurrent()` + `player.play()`. Unresolved commands are NOT consumed; a stale-resolution guard drops results superseded by a newer command.
- **`src/quickconnect/`** (S520 AD-25): the TV half of password-free device pairing. `quickConnectClient.ts` issues the three served request sites — `POST /api/v1/auth/quick-connect/initiate`, `GET /api/v1/auth/quick-connect/{code}/status`, `POST /api/v1/auth/quick-connect/{code}/token` — parsing the snake_case wire into one trusted camelCase shape; the companion `…/{code}/approve` leg is intentionally absent (the phone approves, never the TV). `quickConnectSession.ts` (`createPairingSession`) drives initiate → surface-code → poll, gated by an injectable `isVisible()` (an invisible surface issues ZERO status requests), honouring server-published cadence with exponential backoff to a ceiling, and resolving calm non-fatal phases (`approved|denied|expired|abandoned|error`) without ever throwing. `QuickConnectPanel.vue` mounts as the seventh root app (shares pinia), self-gates on `server set && !isLoggedIn && on-screen`, and on approval hands `{accessToken, refreshToken}` to the EXISTING `useAuthStore().setTokens` seam — no second token store, no QR, no new route.
- **`src/telemetry.ts` + `src/components/TelemetryConsent.vue`** (S521 AD-27): the OPT-IN (default-**OFF**) privacy gate + a single bounded heartbeat. `telemetry.ts` owns the whole surface — `getConsent`/`setConsent` (strict `=== 'true'`; unset/garbage/false all OFF; an explicit decline clears the throttle stamp), `buildHeartbeatPayload` (the server's bounded snake set — `instance_id` from the EXISTING `deviceId.ts` seam, so no second identity, plus version/client_type/platform/build — **zero PII**, NOT the forbidden server→hub `HeartbeatDto`), `createHeartbeat`/`startTelemetry` (an hourly tick + 24h throttle; `tick` is fully guarded and swallows EVERY failure — reject/timeout/500 — so it never throws or surfaces; a SUCCESS alone advances the persisted last-sent stamp), and `buildTelemetryDeps` (production wiring). The one request site is `client.post('/api/v1/telemetry/heartbeat', …)` on the EXISTING served route. `TelemetryConsent.vue` mounts as the eighth root app, shows the one-time D-pad-operable card ONLY for a never-decided install that already has a server (raw key presence — getConsent can't distinguish a prior decline from unset), and routes Enable → persist `true` + `startTelemetry`, Not-now → persist `false` + `stopTelemetry`. `main.ts` boots the sender only when consent was ALREADY granted AND a base exists (start-when-opted-in). No new server route; fixture md5 unchanged.
- **`src/screensaver.ts` + `src/components/ScreenSaverOverlay.vue`** (S523 AD-21): the PRIVILEGE-HONEST idle screen policy. The as-shipped `app/config.xml` grants ONLY `internet` + `tv.inputdevice` (S503 prune; TN-2 law: privileges fold in with their feature, never pre-added) — Tizen keep-awake needs `privilege/display`, which is NOT granted, so the **keep-awake leg is WITHHELD** (reported honestly, zero manifest change) and the shipped half is the zero-privilege idle overlay. `screensaver.ts` holds the whole WHEN policy as pure functions: `IDLE_TIMEOUT_MS = 180_000` (jellyfin convention) overridable via `phlix.screensaver.idleMs` (positive-integer parse, garbage → default), and `shouldEngageScreenSaver({now, lastActivityAt, timeoutMs, isPlaying})` — engages iff NOT playing AND the window fully elapsed. `ScreenSaverOverlay.vue` is the ninth root app (pinia-only): a 1 s tick reads `usePlayerStore().playing` (playing refreshes the activity stamp, so the post-pause window counts from the pause) and `remoteManager.on('keydown', …)` (the seam EVERY routed key — arrows included — passes through) wakes + re-arms; `screensaver-active` body class while engaged; focus-safe per S512/S516 (aria-hidden, no tabindex, never focus()/preventDefault — the waking key keeps its action). Zero request sites; fixture md5 unchanged.
- **`src/components/*.vue`**: TV-specific overlays + D-pad lists — `ChapterOverlay` (`GET /api/v1/media/{id}/chapters` + `GET /api/v1/media/{id}/markers`), `SkipIntroOverlay` (`GET /api/v1/media/{id}/markers`), `PiPController`, plus the track/rating/music cards used by `src/pages/` + `src/screens/` and backed by `src/stores/`. Each carries a `@category TV-Specific Component` / `@duplicate` docblock recording why it is kept instead of `@phlix/ui`'s version — keep that note current when editing one. (S501 T-04/T-06: the former `UpNextOverlay` + `SleepTimerOverlay` are DELETED — unreachable root-mounted duplicates of `@phlix/ui`'s PlayerPage-bundled UpNext + sleep-timer that could never render yet still polled player position at 250 ms for the whole app lifetime.)
- **`src/pages/AudioTracksPage.vue`** / **`src/pages/SubtitleTracksPage.vue`**: both read the single `GET /api/v1/media/{id}/playback-info` rail (`audio_tracks` / `subtitle_tracks`). Subtitles are dispatched by `track.language` (`setSubtitle`), not by wire id. S511 (AD-18) adds per-item language memory to both via `src/stores/useTrackPreferenceStore.ts`: on open the pages adopt the ladder default (per-item memory → account `preferred_*_language` → none) — subtitles call `setSubtitle` once when the user has no current choice; audio cannot be live-applied client-side so it only marks the remembered row while keeping its named `AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE` refusal. Each selection persists per-item to `localStorage` and PUTs the single `preferred_{audio,subtitle}_language` field back through the existing `PUT /api/v1/users/me/settings`.
- **`src/stores/useTrackPreferenceStore.ts`** (S511): Pinia bridge over the EXISTING `GET|PUT /api/v1/users/me/settings` account endpoint (`preferred_audio_language` / `preferred_subtitle_language`) plus per-item `localStorage` (`phlix.trackPref.<kind>.<itemId>`). `load(baseUrl)` (fail-soft → null prefs), `getPerItem`/`setPerItem`, `persist(...)` (local + best-effort account PUT), `resolveDefault(...)` delegating to the pure `src/tracks/languageLadder.ts`. No new server route (era law).
- **`src/pages/ParentalControlsPage.vue`**: profile schedules / tags / stream-limits over `GET|POST|PUT|DELETE /api/v1/profiles/{id}/schedules` (edit is `PUT …/schedules/{scheduleId}` with a snake_case body — S502), `GET|POST|DELETE /api/v1/profiles/{id}/tags`, `GET|PUT /api/v1/profiles/{id}/stream-limits`.
- **`src/stores/useSyncPlayStore.ts`**: SyncPlay store — REST over its local `SyncPlayApiClient` (`/api/v1/syncplay/groups`), frames via `@phlix/syncplay`'s `SyncPlayClient`. Also the hub-relay consumer surface: `applyPendingPlayMedia` adopts a delivered frame into `pendingPlayMedia`, `consumePendingPlayMedia` clears it.
- **`src/polyfills.ts`**: `structuredClone` fallback — imported FIRST (older Tizen lacks it; `@phlix/ui` needs it).
- **`src/resolveConfig.ts`**: pure `resolveAppConfig` → `{app:'server', apiBase}` (server-mode only).
- **`src/deviceId.ts`**: pure `resolveDeviceId(storage)`, persisted `phlix.deviceId`.
- **`src/SpatialNavHost.vue`**: renderless; `useSpatialNav({enabled: () => Boolean(prefs.tv) && route.name !== 'player'})`. Enables D-pad nav for browse, off on player route.
- **`src/tizenBridge.ts`**: `installTizenBridge(app, tizenLike?)` + pure `wireTizenBridge(remote, player, router, getRoute)`. Maps `RemoteManager` `'action'`s to `usePlayerStore` + router: PLAY/PLAY_PAUSE→toggle, PAUSE→pause, STOP→`closePlayer()`, FAST_FORWARD/REWIND→`seekBy(±10/±30)`, BACK→`closePlayer()`+`back()` on player route else `back()`, HOME→`push('/app')`. Arrows/ENTER not bridged. S509: `installTizenBridge` also registers the 2020+ `tvinputdevice` media/channel/colour keys at app-ready (via `remote/registerKeys.ts`) and releases them in its returned teardown.
- **`src/remote/RemoteManager.ts`**: singleton source of TV-remote events; captures `keydown`/`keyup` on `document`, emits `'keydown'`/`'keyup'`/`'action'`, held-key repeat (FF/REW accel); `on()` returns an unsubscribe fn.
- **`src/remote/KeyMapping.ts`**: Samsung key codes → actions (`10009` BACK, `415` PLAY, `413` STOP, `19` PAUSE, `417` FF, `412` REW, `403`–`406` color, `10252` PLAY_PAUSE alias + `427`/`428` CHANNEL_UP/DOWN added in S509). Arrows/ENTER stay in `KEY_MAP` for logging but are removed from `isRepeatable`/`isImmediate`/`isHandled` — spatial-nav + native focus own them. Digits 48–57 are named `DIGIT_0`–`DIGIT_9` + exposed via `isDigit()` (S509 routing groundwork; NOT immediate/handled so text inputs still type).
- **`src/remote/registerKeys.ts`** (S509): pure, fakeable wrapper over `tizen.tvinputdevice.registerKey`/`unregisterKey`. `installRemoteKeyRegistration(tizenLike?)` registers `REMOTE_KEYS` (media-transport + channel + Colors/Info) once and returns a paired teardown releasing exactly what it acquired; absent `tizen` = silent no-op (browser dev). Called from `installTizenBridge`, so registration follows the bridge's app-ready/teardown lifecycle — no parallel key pipeline.
- **`src/remote/gamepadBridge.ts`** (S522 / AD-20): the gamepad→**synthetic-keyboard** bridge — DEV / manual-QA input only (a real TV has no Gamepad API). `pollGamepad(getGamepads, dispatch, now, state)` is PURE over injected fakes and emits the SAME `document` key events the remote produces (so `RemoteManager`, which reads `event.keyCode`, and `@phlix/ui` `useSpatialNav`, which reads `event.key`, react with **zero change** to `KeyMapping`/`RemoteManager`): D-pad + left stick (0.5 deadzone, dominant axis) → `Arrow*` with 400 ms initial / 150 ms hold-repeat; **A → `Enter`** (native activation); **B → Samsung code `10009`** → the existing `BACK` action. `installGamepadBridge(overrides?)` runs it on an injectable rAF loop, installs **idempotently**, wraps every frame fail-soft, and returns a teardown; with **no Gamepad API present it installs NOTHING** (boot byte-identical). `dispatchDomKey` is the only DOM touch — `document.dispatchEvent` of a `KeyboardEvent` carrying a real `keyCode` (via `Object.defineProperty`); the module calls **no `focus()`/DOM-mutation** (grep-pinned). Installed once from `boot()` after `installTizenBridge`.

**Rule**: this repo writes no media/library/auth UI — that lives in `@phlix/ui`. Edit boot config (`main.ts`), the remote bridge (`tizenBridge.ts` / `remote/*`), spatial-nav gating (`SpatialNavHost.vue`), the TV overlays/pages (`src/components/`, `src/pages/`, `src/screens/`, `src/stores/`), the hub-relay glue (`src/api/hubRelay.ts`, `src/syncplayDispatch.ts`), or the Tizen manifest (`app/config.xml`).

## Tizen constraints

- No pointer/mouse — D-pad (`useSpatialNav`) + transport keys (`RemoteManager` → `tizenBridge`) only.
- Fixed `1920x1080` viewport (`index.html` meta).
- RAM-bounded HLS via `TIZEN_HLS_CONFIG` → `playerHlsConfig`. Tune HLS here, not in `phlix-ui`.
- `base: './'` in `vite.config.ts` is MANDATORY — `.wgt` runs from `file://`, so absolute `/assets` 404.
- `app/config.xml` is the `.wgt` manifest (app id `phlix.app.phlixtizen`, `required_version` `6.5`); `scripts/package.js` copies it to `package/`.
- **2020+ key registration doctrine (S509 / AD-1):** a Samsung TV webview does NOT deliver media-transport / channel / colour / Info keys to the DOM until the app declares them via `tizen.tvinputdevice.registerKey`. `remote/registerKeys.ts` does this once at app-ready (invoked from `installTizenBridge`) and releases the keys on teardown. `tv.inputdevice` is already declared in `config.xml` — no manifest delta needed.
- Device→quality is server-side: the client sends `X-Phlix-Device-Type: samsung-tizen`; the server maps it. Don't reintroduce a client device profile.
- Build-time env vars are declared in `vite-env.d.ts`: `VITE_PHLIX_SERVER_URL`, plus `VITE_PHLIX_HUB_URL` / `VITE_PHLIX_HUB_SERVER_ID` for the hub relay.

## Tests

Vitest + jsdom + `@vue/test-utils` (`tests/unit/*.test.ts`, flat `src/` tree). Suites (38 files): `resolveConfig`, `deviceId`, `polyfills`, `tizenBridge`, `SpatialNavHost`, `RemoteManager`, `KeyMapping`, `registerKeys`, `gamepadBridge` (S522 pure-poll deadzone/repeat/A-B + idempotent-install + absent-API no-op + real-RemoteManager integration + focus-safe source grep), `ChapterOverlay`, `SkipIntroOverlay`, `SubtitleTrackList`, `useMusicStore`, `useTrackPreferenceStore`, `languageLadder`, `RatingBadge`, `RatingModal`, `UserRatingPicker`, `useSyncPlayStore`, `syncPlayWireShape`, `syncPlayMigration`, `hubRelay`, `syncplayDispatch`, `quickconnect` (S520 transport+session), `QuickConnectPanel` (S520 wiring), `telemetry` (S521 consent-gate+cadence+swallow algorithm), `TelemetryConsent` (S521 card seam), `screensaver` (S523 pure idle decision table + timeout parse), `ScreenSaverOverlay` (S523 fake-timer seam on the real RemoteManager key path + AC-1 two-privilege manifest pins + focus-safe grep), `RouteWireShape`, `TrackWireShape`, `TrackApplyBoundary`, `TrackLanguageMemory`, `ParentalControlsWireShape`, `routeManifest.gate`, `main`. SFC suites mock `@phlix/ui` (`ApiClient`, `useApiBase`, `usePlayerStore`) and `vue-router` via `vi.hoisted`. `routeManifest.gate` pins every client request URL tuple-exact against the vendored `tests/fixtures/server-route-manifest.json` — adding or moving a request site means updating its per-file coverage count there (S520 added `src/quickconnect/quickConnectClient.ts`: 3 sites, scan 23 → 26; S521 added `src/telemetry.ts`: 1 site, scan 26 → 27; S522 gamepad adds ZERO request sites — it is input-side only — and S523's idle overlay is likewise purely client-side, so the scan stays 27 and the manifest is untouched).

```bash
npx vitest run tests/unit/ChapterOverlay.test.ts
npx vitest run tests/unit/routeManifest.gate.test.ts
```

<!-- caliber:managed:pre-commit -->
## Before Committing

**IMPORTANT:** Before every git commit, you MUST ensure Caliber syncs agent configs with the latest code changes.

First, check if the pre-commit hook is already installed:
```bash
grep -q "caliber" .git/hooks/pre-commit 2>/dev/null && echo "hook-active" || echo "no-hook"
```

- If **hook-active**: the hook handles sync automatically — just commit normally. Tell the user: "Caliber will sync your agent configs automatically via the pre-commit hook."
- If **no-hook**: run Caliber manually before committing:
  1. Tell the user: "Caliber: Syncing agent configs with your latest changes..."
  2. Run: `caliber refresh && git add CALIBER_LEARNINGS.md AGENTS.md .agents/ 2>/dev/null`
  3. After it completes, briefly tell the user what Caliber updated. Then proceed with the commit.

**Valid `caliber refresh` options:** `--quiet` (suppress output) and `--dry-run` (preview without writing). Do not pass any other flags — options like `--auto-approve`, `--debug`, or `--force` do not exist and will cause errors.

**`caliber config`** takes no flags — it runs an interactive provider setup. Do not pass `--provider`, `--api-key`, or `--endpoint`.

If `caliber` is not found, read `.agents/skills/setup-caliber/SKILL.md` and follow its instructions to install Caliber.
<!-- /caliber:managed:pre-commit -->

<!-- caliber:managed:learnings -->
## Session Learnings

Read `CALIBER_LEARNINGS.md` for patterns and anti-patterns learned from previous sessions.
These are auto-extracted from real tool usage — treat them as project-specific rules.
<!-- /caliber:managed:learnings -->

<!-- caliber:managed:model-config -->
## Model Configuration

Recommended default: `claude-sonnet-4-6` with high effort (stronger reasoning; higher cost and latency than smaller models).
Smaller/faster models trade quality for speed and cost — pick what fits the task.
Pin your choice (`/model` in Claude Code, or `CALIBER_MODEL` when using Caliber with an API provider) so upstream default changes do not silently change behavior.

<!-- /caliber:managed:model-config -->

<!-- caliber:managed:sync -->
## Context Sync

This project uses [Caliber](https://github.com/caliber-ai-org/ai-setup) to keep AI agent configs in sync across Claude Code, Cursor, Copilot, and Codex.
Configs update automatically before each commit via `caliber refresh`.
If the pre-commit hook is not set up, read `.agents/skills/setup-caliber/SKILL.md` and follow the setup instructions.
<!-- /caliber:managed:sync -->