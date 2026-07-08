# CLAUDE.md

Samsung Tizen TV client for Phlix Media Server. A **thin Vue 3 consumer of `@phlix/ui`** — TypeScript → Vite (`@vitejs/plugin-vue`, target `chrome100`) → Tizen Chromium TV webview, packaged as a signed `.wgt`. The entire UI (browse/detail/player/settings/auth) is rendered by `@phlix/ui`'s `createPhlixApp()`; this repo is just the boot glue + the Tizen remote/spatial-nav bridge (mirrors the Windows/Electron client). HLS is provided by `@phlix/ui`'s player and tuned for TV RAM via `playerHlsConfig`.

Pinned: `@phlix/ui` `github:detain/phlix-ui#v0.74.0`, `@phlix/contracts` `#v0.2.0`. Peer deps Vue 3 + Pinia + vue-router.

## Commands

```bash
npm install              # package-lock.json is gitignored — CI uses `npm install`, not `npm ci`
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

There is no webpack, no Babel, no Jest. `npm run package` builds then assembles `package/` (vite `dist/` + `app/config.xml` at the widget root). Tizen `.wgt` signing still happens in Tizen Studio (or the `tizen` CLI) against the `package/` output — no npm script produces a signed widget.

## Architecture

**Entry**: `index.html` (repo root, the Vite root) loads `/src/main.ts`, which mounts into `#phlix-app` and `#phlix-spatial-host`.

`src/main.ts` `boot()` flow:
1. `import './polyfills'` FIRST (installs a `structuredClone` fallback for older Tizen webviews — `@phlix/ui`'s SettingsForm needs it).
2. Resolve the server URL: `localStorage['phlix.serverUrl']` → `import.meta.env.VITE_PHLIX_SERVER_URL` → **empty** (via `resolveAppConfig` in `src/resolveConfig.ts`, server-mode only — no hub IPC on Tizen). An empty base + `requireConnection: true` makes `@phlix/ui` show its first-run Connect screen instead of guessing `localhost`; the chosen URL is mirrored back to `localStorage['phlix.serverUrl']` via `onConnectionChange`.
3. Resolve a stable `deviceId` (`src/deviceId.ts`, persisted as `phlix.deviceId`).
4. `buildPhlixHeaders({ deviceId, deviceName, deviceType: 'samsung-tizen' })` (from `@phlix/contracts`).
5. `createPhlixApp({ app, apiBase, deviceHeaders, defaultTv: true, defaultTheme: 'nocturne', branding: { wordmark: 'Phlix' }, playerHlsConfig: TIZEN_HLS_CONFIG })` → `.mount('#phlix-app')`.
6. `installTizenBridge(application)` wires the remote.
7. Mount a SECOND tiny app `createApp(SpatialNavHost).use(pinia).use(router).mount('#phlix-spatial-host')`, reusing the main app's pinia + router (read off `application.config.globalProperties.$pinia` / `$router`) so it observes the same prefs + route.

**`src/` files** (all the code this repo owns):
- **`main.ts`** — boot, `createPhlixApp` config, `TIZEN_HLS_CONFIG` (bounded buffers, `capLevelToPlayerSize`, `enableSoftwareAES`), 2nd-app SpatialNavHost mount.
- **`polyfills.ts`** — `structuredClone` guard. MUST be imported before any `@phlix/ui` code.
- **`resolveConfig.ts`** — pure `resolveAppConfig({serverUrl, envUrl})` → `{app:'server', apiBase}`. Unit-tested; shape kept extensible for a future `app:'hub'` branch.
- **`deviceId.ts`** — pure `resolveDeviceId(storage)`; prefers `crypto.randomUUID`, deterministic fallback for ancient webviews.
- **`SpatialNavHost.vue`** — renderless component; `useSpatialNav({ enabled: () => Boolean(prefs.tv) && route.name !== 'player' && !qualityMenuActive.value })`. Enables `@phlix/ui` D-pad spatial navigation for browse, DISABLES it on the player route so the player's own Arrow seek/volume shortcuts win, and also gates on the shared `qualityMenuActive` flag (`tizenBridge.ts`) as an explicit invariant — spatial-nav is already off on `player`, so this conjunct matters only if the flag were ever set outside that route.
- **`tizenBridge.ts`** — `installTizenBridge(app)` + the pure `wireTizenBridge(remote, player, router, getRoute, quality)`. Subscribes to `RemoteManager` `'action'` events and maps transport/nav keys onto the `@phlix/ui` `usePlayerStore` + vue-router. Structurally-typed deps for testability (mirrors `electronBridge.ts`). Map: `PLAY`/`PLAY_PAUSE`→toggle, `PAUSE`→pause, `STOP`→`closePlayer()`, `FAST_FORWARD`/`REWIND`→`seekBy(±10`, `±30` when held`)`, `BACK`→dismiss the quality picker if open, else `closePlayer()`+`router.back()` on the player route else `router.back()`, `HOME`→`router.push('/app')`, `YELLOW`→open/toggle the on-screen `QualityMenu` (only on the player route, only when it's actually rendered — ≥2 ABR rungs). Arrows/ENTER are deliberately NOT bridged directly, EXCEPT while quality mode is active, where a `RemoteManager.suppressPropagation` hook stops the D-pad arrows from also hitting the player's seek/volume shortcuts so the focused `Select` owns them. Quality-mode teardown is choke-pointed through one `close()`: a `MutationObserver` on the trigger's `aria-expanded` catches the menu closing ITSELF (rung picked/Escape/outside click), and a `router.afterEach` guard catches the player/route being left (Home, etc.) — see `DEVELOPER.md` for the full mechanism and why both are needed.
- **`remote/RemoteManager.ts`** — KEPT + ported to TS. The single source of TV-remote events (analogue of Electron media events). Captures `keydown`/`keyup` on `document`, emits `'keydown'`/`'keyup'`/`'action'`, held-key repeat (FF/REW accel). `on()` returns an unsubscribe fn. Exposes a host-settable `suppressPropagation` hook (used by `tizenBridge.ts` for the quality-menu D-pad passthrough above) that `stopImmediatePropagation()`s a keydown so later `document` listeners (the player's Arrow shortcuts) don't also fire; RemoteManager itself stays quality-agnostic. Default singleton export.
- **`remote/KeyMapping.ts`** — KEPT + ported + **retargeted**: KEY_MAP still lists arrows/ENTER (for logging), but they are removed from `isRepeatable`/`isImmediate`/`isHandled`, so RemoteManager neither `preventDefault`s nor emits actions for them — `useSpatialNav` owns the D-pad, native focus owns ENTER. Samsung codes: 10009 `BACK`, 415 `PLAY`, 413 `STOP`, 19 `PAUSE`, 417 `FAST_FORWARD`, 412 `REWIND`, color keys 403–406.

**Rule**: this repo writes no media/library/auth UI — that all lives in `@phlix/ui`. To change a screen, edit `phlix-ui`. Here you only touch boot config (`main.ts`), the remote bridge (`tizenBridge.ts` / `remote/*`), spatial-nav gating (`SpatialNavHost.vue`), or the Tizen manifest (`app/config.xml`).

@./DEVELOPER.md

## Tizen runtime constraints

- **No pointer/mouse** — keyboard/D-pad only. D-pad navigation is `@phlix/ui`'s `useSpatialNav` (gated by `SpatialNavHost.vue`); transport keys come through `RemoteManager` → `tizenBridge`. There is no manual focus code in this repo anymore.
- **Fixed `1920x1080` viewport** (`index.html` meta viewport).
- **HLS RAM tuning** — Samsung TV webviews are memory-constrained; `TIZEN_HLS_CONFIG` in `main.ts` is passed via `playerHlsConfig` to bound buffers, cap level to player size, and enable software AES. Tune HLS here, not in `phlix-ui`.
- **`app/config.xml`** is the Tizen widget manifest (`.wgt`): app id `phlix.app.phlixtizen`, `required_version` `6.5`, `<content src="index.html"/>`, `<access origin="*">`, privileges (`internet`, `tv.inputdevice`, `tv.window`, `tv.audio`, `network.get`, `application.launch`, `filesystem.read`), landscape/maximized. New TV capability usually means editing this file. `scripts/package.js` copies it to the `package/` root.
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

Vitest + `jsdom` + `@vue/test-utils` (`vitest.config.ts`, `npm test`). Tests live in `tests/unit/*.test.ts` and are co-located by module name (the `src/` tree is flat). Setup `tests/test-setup.ts` provides an in-memory localStorage mock. Coverage (v8) excludes `app/**`, `tests/`, `dist/`, configs. Current suites: `resolveConfig`, `deviceId`, `tizenBridge` (pure `wireTizenBridge` exercised with fakes), `SpatialNavHost`, `main` (mocks `@phlix/ui`/`@phlix/contracts`/`vue` and asserts the boot wiring).

## Quirks

- **`package-lock.json` gitignored** — CI uses `npm install`, not `npm ci`. Don't switch without coordinating.
- **`base: './'` in `vite.config.ts` is MANDATORY.** A `.wgt` loads from a `file://` origin on the TV, so absolute `/assets` paths 404. Relative base keeps every asset URL relative to `index.html`.
- **`structuredClone` polyfill** (`src/polyfills.ts`) must be imported first in `main.ts` — older Tizen Chromium lacks it and `@phlix/ui` needs it.
- **Server-side device→profile mapping** replaces the old client-posted device profile (see Tizen runtime constraints). Don't reintroduce a client profile.
- **`scripts/package.js` is ESM** (the repo is `"type": "module"`); run it via `npm run package`. It assembles `package/` from vite `dist/` + `app/config.xml`.
- **Tizen app id**: `app/config.xml` uses `phlix.app.phlixtizen`. `config.xml` is authoritative — the README CLI examples use it too.
- `.github/workflows/test.yml` (runs `npm test`) and `.github/workflows/lint.yml` (`npm run lint` + `npm run build`) run on push — keep them green.

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
  2. Run: `caliber refresh && git add CALIBER_LEARNINGS.md CLAUDE.md .claude/ .opencode/ 2>/dev/null`
  3. After it completes, briefly tell the user what Caliber updated. Then proceed with the commit.

**Valid `caliber refresh` options:** `--quiet` (suppress output) and `--dry-run` (preview without writing). Do not pass any other flags — options like `--auto-approve`, `--debug`, or `--force` do not exist and will cause errors.

**`caliber config`** takes no flags — it runs an interactive provider setup. Do not pass `--provider`, `--api-key`, or `--endpoint`.

If `caliber` is not found, tell the user: "This project uses Caliber for agent config sync. Run /setup-caliber to get set up."
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
If the pre-commit hook is not set up, run `/setup-caliber` to configure everything automatically.
<!-- /caliber:managed:sync -->
