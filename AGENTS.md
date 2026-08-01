# AGENTS.md

Samsung Tizen TV client for Phlix Media Server. A **thin Vue 3 consumer of `@phlix/ui`** — TypeScript → Vite (`@vitejs/plugin-vue`, target `chrome100`, `base:'./'`) → Tizen Chromium TV webview, packaged as a signed `.wgt`. All UI is rendered by `@phlix/ui`'s `createPhlixApp()`; this repo is boot glue + the Tizen remote/spatial-nav bridge (mirrors the Windows client). HLS comes from `@phlix/ui`'s player, RAM-tuned via `playerHlsConfig`. Pinned `@phlix/ui#v0.98.33`, `@phlix/contracts#v0.3.12`; peer deps Vue 3 + Pinia + vue-router.

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

**Entry**: `index.html` (repo root = Vite root) → `/src/main.ts`, mounting `#phlix-app` + `#phlix-spatial-host` + `#phlix-chapter-overlay` + `#phlix-sleep-timer-overlay` + `#phlix-skip-intro-overlay` + `#phlix-pip-overlay` + `#phlix-up-next-overlay`.

`main.ts` `boot()`: import `./polyfills` first → resolve server URL (`localStorage['phlix.serverUrl']` → `VITE_PHLIX_SERVER_URL` → **empty**, via `resolveConfig.ts`; an empty base + `requireConnection: true` shows `@phlix/ui`'s first-run Connect screen instead of guessing `localhost`, and the chosen URL is mirrored back to `localStorage['phlix.serverUrl']` via `onConnectionChange`) → `resolveDeviceId` (`deviceId.ts`) → `buildPhlixHeaders({deviceType:'samsung-tizen'})` → `createPhlixApp({app, apiBase, deviceHeaders, defaultTv:true, defaultTheme:'nocturne', branding:{wordmark:'Phlix'}, playerHlsConfig:TIZEN_HLS_CONFIG}).mount('#phlix-app')` → `installTizenBridge(app)` → mount a 2nd `createApp(SpatialNavHost).use(pinia).use(router).mount('#phlix-spatial-host')` plus 3rd–7th overlay apps (`ChapterOverlay` → `#phlix-chapter-overlay`, `SleepTimerOverlay` → `#phlix-sleep-timer-overlay`, `SkipIntroOverlay` → `#phlix-skip-intro-overlay`, `PiPController` → `#phlix-pip-overlay`, `UpNextOverlay` → `#phlix-up-next-overlay`), all reusing the main app's pinia + router.

- **`src/main.ts`**: boot + `createPhlixApp` config + `TIZEN_HLS_CONFIG` + 2nd-app SpatialNavHost mount + 3rd–7th overlay app mounts.
- **`src/components/*.vue`**: TV-specific overlays + D-pad lists — `ChapterOverlay` (`GET /api/v1/media/{id}/chapters` + `GET /api/v1/media/{id}/markers`), `SleepTimerOverlay`, `SkipIntroOverlay` (`GET /api/v1/media/{id}/markers`), `PiPController`, `UpNextOverlay` (`GET /api/v1/media/{id}/playlist`), plus the track/rating/music cards used by `src/pages/` + `src/screens/` and backed by `src/stores/`. Each carries a `@category TV-Specific Component` / `@duplicate` docblock recording why it is kept instead of `@phlix/ui`'s version — keep that note current when editing one.
- **`src/polyfills.ts`**: `structuredClone` fallback — imported FIRST (older Tizen lacks it; `@phlix/ui` needs it).
- **`src/resolveConfig.ts`**: pure `resolveAppConfig` → `{app:'server', apiBase}` (server-mode only).
- **`src/deviceId.ts`**: pure `resolveDeviceId(storage)`, persisted `phlix.deviceId`.
- **`src/SpatialNavHost.vue`**: renderless; `useSpatialNav({enabled: () => Boolean(prefs.tv) && route.name !== 'player'})`. Enables D-pad nav for browse, off on player route.
- **`src/tizenBridge.ts`**: `installTizenBridge(app)` + pure `wireTizenBridge(remote, player, router, getRoute)`. Maps `RemoteManager` `'action'`s to `usePlayerStore` + router: PLAY/PLAY_PAUSE→toggle, PAUSE→pause, STOP→`closePlayer()`, FAST_FORWARD/REWIND→`seekBy(±10/±30)`, BACK→`closePlayer()`+`back()` on player route else `back()`, HOME→`push('/app')`. Arrows/ENTER not bridged.
- **`src/remote/RemoteManager.ts`**: singleton source of TV-remote events; captures `keydown`/`keyup` on `document`, emits `'keydown'`/`'keyup'`/`'action'`, held-key repeat (FF/REW accel); `on()` returns an unsubscribe fn.
- **`src/remote/KeyMapping.ts`**: Samsung key codes → actions (`10009` BACK, `415` PLAY, `413` STOP, `19` PAUSE, `417` FF, `412` REW, `403`–`406` color). Arrows/ENTER stay in `KEY_MAP` for logging but are removed from `isRepeatable`/`isImmediate`/`isHandled` — spatial-nav + native focus own them.

**Rule**: this repo writes no media/library/auth UI — that lives in `@phlix/ui`. Edit boot config (`main.ts`), the remote bridge (`tizenBridge.ts` / `remote/*`), spatial-nav gating (`SpatialNavHost.vue`), the TV overlays/pages (`src/components/`, `src/pages/`, `src/screens/`, `src/stores/`), or the Tizen manifest (`app/config.xml`).

## Tizen constraints

- No pointer/mouse — D-pad (`useSpatialNav`) + transport keys (`RemoteManager` → `tizenBridge`) only.
- Fixed `1920x1080` viewport (`index.html` meta).
- RAM-bounded HLS via `TIZEN_HLS_CONFIG` → `playerHlsConfig`. Tune HLS here, not in `phlix-ui`.
- `base: './'` in `vite.config.ts` is MANDATORY — `.wgt` runs from `file://`, so absolute `/assets` 404.
- `app/config.xml` is the `.wgt` manifest (app id `phlix.app.phlixtizen`, `required_version` `6.5`); `scripts/package.js` copies it to `package/`.
- Device→quality is server-side: the client sends `X-Phlix-Device-Type: samsung-tizen`; the server maps it. Don't reintroduce a client device profile.

## Tests

Vitest + jsdom + `@vue/test-utils` (`tests/unit/*.test.ts`, flat `src/` tree). Suites: `resolveConfig`, `deviceId`, `tizenBridge`, `SpatialNavHost`, `RemoteManager`, `UpNextOverlay`, `main`. SFC suites mock `@phlix/ui` (`ApiClient`, `useApiBase`, `usePlayerStore`) and `vue-router` via `vi.hoisted`:

```bash
npx vitest run tests/unit/UpNextOverlay.test.ts
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
