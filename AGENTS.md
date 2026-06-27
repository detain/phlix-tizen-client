# AGENTS.md

Samsung Tizen TV client for Phlix Media Server. A **thin Vue 3 consumer of `@phlix/ui`** — TypeScript → Vite (`@vitejs/plugin-vue`, target `chrome100`, `base:'./'`) → Tizen Chromium TV webview, packaged as a signed `.wgt`. All UI is rendered by `@phlix/ui`'s `createPhlixApp()`; this repo is boot glue + the Tizen remote/spatial-nav bridge (mirrors the Windows client). HLS comes from `@phlix/ui`'s player, RAM-tuned via `playerHlsConfig`. Pinned `@phlix/ui#v0.53.0`, `@phlix/contracts#v0.1.1`; peer deps Vue 3 + Pinia + vue-router.

## Commands

```bash
npm install              # package-lock.json gitignored — CI uses `npm install`
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

**Entry**: `index.html` (repo root = Vite root) → `/src/main.ts`, mounting `#phlix-app` + `#phlix-spatial-host`.

`main.ts` `boot()`: import `./polyfills` first → resolve server URL (`localStorage['phlix.serverUrl']` → `VITE_PHLIX_SERVER_URL` → `localhost:8096`, via `resolveConfig.ts`) → `resolveDeviceId` (`deviceId.ts`) → `buildPhlixHeaders({deviceType:'samsung-tizen'})` → `createPhlixApp({app, apiBase, deviceHeaders, defaultTv:true, defaultTheme:'nocturne', branding:{wordmark:'Phlix'}, playerHlsConfig:TIZEN_HLS_CONFIG}).mount('#phlix-app')` → `installTizenBridge(app)` → mount a 2nd `createApp(SpatialNavHost).use(pinia).use(router).mount('#phlix-spatial-host')` reusing the main app's pinia + router.

- **`src/main.ts`**: boot + `createPhlixApp` config + `TIZEN_HLS_CONFIG` + 2nd-app mount.
- **`src/polyfills.ts`**: `structuredClone` fallback — imported FIRST (older Tizen lacks it; `@phlix/ui` needs it).
- **`src/resolveConfig.ts`**: pure `resolveAppConfig` → `{app:'server', apiBase}` (server-mode only).
- **`src/deviceId.ts`**: pure `resolveDeviceId(storage)`, persisted `phlix.deviceId`.
- **`src/SpatialNavHost.vue`**: renderless; `useSpatialNav({enabled: () => Boolean(prefs.tv) && route.name !== 'player'})`. Enables D-pad nav for browse, off on player route.
- **`src/tizenBridge.ts`**: `installTizenBridge(app)` + pure `wireTizenBridge(remote, player, router, getRoute)`. Maps `RemoteManager` `'action'`s to `usePlayerStore` + router: PLAY/PLAY_PAUSE→toggle, PAUSE→pause, STOP→`closePlayer()`, FAST_FORWARD/REWIND→`seekBy(±10/±30)`, BACK→`closePlayer()`+`back()` on player route else `back()`, HOME→`push('/app')`. Arrows/ENTER not bridged.
- **`src/remote/RemoteManager.ts`**: KEPT (TS). Single source of TV-remote events; `keydown`/`keyup` on `document`; emits `keydown`/`keyup`/`action`; held-key repeat; `on()` returns unsubscribe. Default singleton.
- **`src/remote/KeyMapping.ts`**: KEPT + retargeted. Arrows + ENTER removed from `isRepeatable`/`isImmediate`/`isHandled` so spatial-nav (arrows) + native focus (ENTER) own them. Samsung codes 10009 BACK, 415 PLAY, 413 STOP, 19 PAUSE, 417 FF, 412 REW, 403–406 colors.

**Rule**: no media/library/auth UI lives here — it's all in `@phlix/ui`. Here you only touch boot config, the remote bridge, spatial-nav gating, or `app/config.xml`.

## Tizen runtime

- No pointer/mouse — keyboard/D-pad only via `useSpatialNav` (browse) + `RemoteManager`→bridge (transport). No manual focus code in this repo.
- Fixed `1920x1080` viewport (`index.html` meta).
- HLS RAM tuning lives in `main.ts` `TIZEN_HLS_CONFIG` → `playerHlsConfig` (bounded buffers, cap-to-player-size, software AES).
- `app/config.xml` = `.wgt` manifest: id `phlix.app.phlixtizen`, `required_version` `6.5`, privileges (`internet`, `tv.inputdevice`, `tv.window`, `tv.audio`, `network.get`, `application.launch`, `filesystem.read`), landscape. `scripts/package.js` copies it to the `package/` root.
- Device→quality profile is now SERVER-side (server maps `X-Phlix-Device-Type: samsung-tizen`); the client no longer posts a device profile.

## Code style (`eslint.config.mjs`, flat, CI-enforced)

- `@eslint/js` + `typescript-eslint` + `eslint-plugin-vue` `flat/recommended`. TS + Vue SFCs.
- ESM only (`"type": "module"`). `no-undef` off (tsc resolves types/globals).
- `@typescript-eslint/no-unused-vars` error — prefix unused with `^_`. `no-explicit-any` warn (off in tests). `vue/multi-word-component-names` off.
- Ignores `dist/`, `node_modules/`, `app/`, `package/`, `coverage/`, `.logs/`.

## Tests

Vitest + jsdom + `@vue/test-utils` (`vitest.config.ts`). `tests/unit/*.test.ts`, co-located by module name; setup `tests/test-setup.ts` (localStorage mock). Suites: `resolveConfig`, `deviceId`, `tizenBridge` (pure helper with fakes), `SpatialNavHost`, `main` (mocks `@phlix/ui`/`@phlix/contracts`/`vue`). Coverage v8 excludes `app/**`.

## Quirks

- **`package-lock.json` gitignored** — CI uses `npm install`, not `npm ci`. Don't switch.
- **`base:'./'` is MANDATORY** in `vite.config.ts` — `.wgt` runs from `file://`, absolute `/assets` 404.
- **`structuredClone` polyfill** (`src/polyfills.ts`) imported first in `main.ts`.
- **`scripts/package.js` is ESM**; run via `npm run package` (assembles `package/` from `dist/` + `app/config.xml`).
- **App id**: `app/config.xml` `phlix.app.phlixtizen` is authoritative.
- CI: `.github/workflows/test.yml` (`npm test`) + `lint.yml` (`npm run lint` + `npm run build`) run on push.

See `DEVELOPER.md` for the boot/resolveConfig flow, adding an `extraRoute`, mapping a new remote key, and tuning `playerHlsConfig`.

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
  2. Run: `caliber refresh && git add CLAUDE.md .claude/ .cursor/ .cursorrules .github/copilot-instructions.md .github/instructions/ AGENTS.md CALIBER_LEARNINGS.md .agents/ .opencode/ 2>/dev/null`
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
Configs update automatically before each commit via `/home/my/.nvm/versions/node/v24.15.0/bin/caliber refresh`.
If the pre-commit hook is not set up, read `.agents/skills/setup-caliber/SKILL.md` and follow the setup instructions.
<!-- /caliber:managed:sync -->
