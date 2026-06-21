# AGENTS.md

Samsung Tizen TV client for Phlix Media Server. Vanilla JS (ES2022 modules) → webpack → Babel (Chrome 100 target) → Tizen 2.3+ Chromium TV browser. HLS via `hls.js`.

## Commands

```bash
npm install              # package-lock.json gitignored — CI uses `npm install`
npm run serve            # webpack-dev-server :8080
npm run build:dev        # dev bundle → dist/
npm run build            # prod bundle → dist/
npm run watch            # rebuild on change
npm test                 # Jest jsdom
npm run test:unit        # tests/unit/**
npm run test:integration # tests/integration/** (smoke.test.js)
npx jest tests/unit/api/ApiClient.test.js  # single file
npx jest -t "name fragment"                # single test
npm run lint             # ESLint over app/js
npm run lint -- --fix    # autofix
node scripts/package.js  # wrap dist/ into package/ for Tizen Studio signing
```

## Architecture

**Entry**: `app/js/main.js` → singleton `App` (`app/js/ui/App.js`) → `window.app`.

- **`app/js/ui/`**: `HomeView.js` · `LibraryView.js` · `DetailView.js` · `PlayerView.js` · `SettingsView.js` · `Router.js` · `App.js`. Plain ES classes with `show()`/`hide()`/`load(params)`. Manual focus.
- **`app/js/api/`**: `ApiClient.js` is the only HTTP entry point and owns the device-profile. Managers: `AuthManager.js` · `SessionManager.js` · `LibraryManager.js` · `PlayerManager.js`. 401 → `restoreSession()`. Errors → `ApiError`.
- **`app/js/player/`**: `VideoPlayer.js` facade · `HlsPlayer.js` (extends `hls.js`) · `SubtitleRenderer.js` · `QualitySelector.js` · `SkipButton.js` (Skip Intro/Outro overlays). **Always `.destroy()` the prior HLS instance before creating a new one.**
- **`app/js/remote/`**: `RemoteManager.js` singleton · `KeyMapping.js` (Samsung codes — 10009 BACK, 415 PLAY, 403–406 colors) · `PlayerRemoteHandler.js` (swapped in via `activate()`/`deactivate()`).
- **`app/js/hub/`**: Hub Mode. `hubConfig.js` holds connection state (`direct`/`relay`); `hubApi.js` signs in and lists claimed servers; `hubAwareApi.js` wraps `ApiClient` to route requests through the hub when enabled.
- **`app/js/syncplay/`**: `SyncPlayService.js` — synchronized playback across clients (NTP-style offset averaging, WebSocket group comms).
- **`app/js/utils/`**: `Logger.js` · `Storage.js` (localStorage wrapper) · `Helpers.js`.
- **`app/js/config/constants.js`**: bitrates, codecs, intervals, focus classes.

**Rule**: views never call `fetch` directly — manager → `ApiClient`. New endpoint: method on `ApiClient.js`, exposed via the matching manager.

## Tizen runtime

- No Web Audio API — use HTML5 `<video>` for audio.
- No pointer/mouse events — `keydown`/`keyup` through `RemoteManager`.
- `app/config.xml` declares privileges (`internet`, `tv.inputdevice`, `tv.window`, `tv.audio`, `network.get`, `application.launch`, `filesystem.read`) — copied into `dist/` by `CopyWebpackPlugin`.
- Fixed `1920x1080` viewport (`app/index.html`, `app/css/style.css`).

## Code style (`.eslintrc.json`, CI-enforced)

- 4-space indent, single quotes, semicolons, `===`, braces always.
- ESM only (`"type": "module"`).
- `no-unused-vars` errors — prefix unused args with `_` (e.g. `loadDirect(url, _playbackInfo)`).
- ESLint ignores `dist/`, `node_modules/`, `coverage/`, `*.test.js`.

## Tests

Jest + jsdom (config in `package.json`). Tests mirror source at `tests/unit/<layer>/<File>.test.js`. See `tests/unit/api/ApiClient.test.js`, `tests/unit/remote/KeyMapping.test.js`, `tests/unit/utils/Helpers.test.js`. Import the named class (not the singleton) for fresh `beforeEach` instances. `babel-jest` via `babel.config.cjs`. `app/js/main.js` excluded from coverage.

## Quirks

- **`package-lock.json` gitignored** — CI uses `npm install`, not `npm ci`. Don't switch.
- **Mixed module systems**: `webpack.config.js` is ESM, but `scripts/build.js` · `scripts/debug.js` · `scripts/package.js` use CommonJS `require()` and fail under `"type": "module"` if invoked directly. Run via npm scripts; if editing one, rename to `.cjs` or port to ESM.
- **`tests/integration/`** now exists with `smoke.test.js` — `npm run test:integration` runs it.
- **App id mismatch**: `app/config.xml` uses `phlix.app.phlixtizen`; `README.md` deploy example uses `org.phlix.phlixtv`. `config.xml` is authoritative.
- CI: `.github/workflows/test.yml` and `.github/workflows/lint.yml` run on push.

See `DEVELOPER.md` for `ApiClient` method tree, device-profile shape, and view/route/endpoint/remote-key extension patterns.

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
