# Phlix Tizen TV App

[![Tests](https://github.com/detain/phlix-tizen-client/actions/workflows/test.yml/badge.svg)](https://github.com/detain/phlix-tizen-client/actions/workflows/test.yml)
[![Lint](https://github.com/detain/phlix-tizen-client/actions/workflows/lint.yml/badge.svg)](https://github.com/detain/phlix-tizen-client/actions/workflows/lint.yml)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
![Platform](https://img.shields.io/badge/platform-Samsung%20Tizen-1428A0?logo=samsung&logoColor=white)
[![@phlix/ui](https://img.shields.io/badge/%40phlix%2Fui-v0.99.10-f5a524)](https://github.com/detain/phlix-ui)

Samsung Smart TV client application for Phlix Media Server, built with Tizen SDK.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Building the App](#building-the-app)
- [Testing](#testing)
- [Deployment to TV](#deployment-to-tv)
- [Remote Control](#remote-control)
- [Supported Codecs](#supported-codecs)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

Phlix Tizen is a native Samsung Smart TV application that connects to a Phlix Media Server, letting users browse their media library and play content on their television. It is a **thin Vue 3 consumer of [`@phlix/ui`](https://github.com/detain/phlix-ui)** — the entire UI (browse, detail, player, settings, auth) is rendered by `@phlix/ui`'s `createPhlixApp()`, and this repository contributes the boot glue, the Tizen remote-control bridge, and TV spatial-navigation gating. The build pipeline is Vite + TypeScript, packaged as a signed `.wgt` widget for Tizen. HLS streaming is provided by `@phlix/ui`'s player and tuned for Samsung TV memory limits.

## Features

- **Library Browsing**: Browse movies, TV shows, music, and other media from Phlix
- **Video Playback**: Direct play and HLS streaming with quality selection, tuned for TV memory
- **Remote Control**: Samsung remote support — spatial D-pad navigation plus transport keys (play/pause/stop/seek/back/home)
- **User Authentication**: Secure login with Phlix account credentials
- **Progress Tracking**: Automatic resume from last playback position
- **Subtitle & Audio Tracks**: Multiple subtitle and audio track selection
- **Search**: Search across your media library
- **Favorites & Watch History**: Mark favorites and track watched items
- **Player Overlays**: TV-specific chapter/marker ticks, Skip Intro & Skip Outro, sleep timer, picture-in-picture, and an end-of-video "Up next" card
- **Parental Controls**: Per-profile viewing schedules, tag restrictions, and stream limits
- **Theming**: Ships the `nocturne` theme by default

> Provided by `@phlix/ui`. To add or change a feature/screen, edit `phlix-ui`.

## Tech Stack

- **Vue 3** + **Pinia** + **vue-router** (peer dependencies)
- **[`@phlix/ui`](https://github.com/detain/phlix-ui)** `v0.99.10` — the entire application UI via `createPhlixApp()`, incl. the player's `QualityMenu` stream-quality picker
- **[`@phlix/contracts`](https://github.com/detain/phlix-contracts)** `v0.5.3` — `buildPhlixHeaders` (device headers)
- **[`@phlix/syncplay`](https://github.com/detain/phlix-syncplay)** `v0.1.5` — SyncPlay frame client used by `src/stores/useSyncPlayStore.ts`

> Pin source of truth: `package.json` — the three libraries above are declared as
> exact GitHub tag pins (`github:detain/phlix-*#v...`), and the tracked
> `package-lock.json` freezes each tag to its exact commit, so CI's
> `npm ci --allow-git=all` installs reproducible bytes. The numbers in this README
> (badge + list) are copies, kept honest by `tests/unit/docsPinConsistency.test.ts`:
> a re-pin must update all five doc surfaces (README, DEVELOPER, docs/i18n.md,
> AGENTS.md, CLAUDE.md) in the same commit or the test suite reddens. The widget's
> OWN version (what the TV and store read) is single-sourced from `package.json`
> `"version"` and stamped by `scripts/version-sync.mjs` — see DEVELOPER.md
> "Versioning" and `tests/unit/versionStamping.test.ts`.
- **Vite** + `@vitejs/plugin-vue` (build target `chrome100` — an esbuild *syntax ceiling*, not the engine floor; the runtime contract is Chromium ≥ 85, enforced by `tests/unit/distApiFloor.test.ts`, canonical in [`docs/runtime-floor.md`](docs/runtime-floor.md); `base: './'`)
- **Vitest** + jsdom + `@vue/test-utils` (tests)
- **TypeScript** + `vue-tsc` (typecheck)
- **Flat ESLint** (`eslint.config.mjs`)
- **Tizen** `.wgt` packaging via `app/config.xml` + `scripts/package.js`

## Prerequisites

### Development Environment

- **Node.js**: Version 22.12 or higher (`engines.node` is `>=22.12.0`)
- **npm**: Included with Node.js
- **Git**: For version control

### Samsung TV Development

- **Tizen Studio**: current generation (6.1-era, or Tizen SDK 10 + the VS Code
  Tizen extension) from <https://samsungtizenos.com/tools-download/> — for
  `.wgt` signing + deployment; see [`docs/signing.md`](docs/signing.md) for the
  verified install steps (Package Manager → TV Extensions + **Samsung
  Certificate Extension ≥ 2.0.73**)
- **Samsung Developer account**: required to create TV author certificates
- **Samsung Smart TV**: Tizen OS device (`config.xml` `required_version` is
  `6.5`), in Developer Mode for sideloading

### Phlix Media Server

- **Phlix Media Server**: A running Phlix server reachable from the TV
- **Network**: TV and server must be on the same network

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/detain/phlix-tizen-client.git
cd phlix-tizen-client
```

### 2. Install Dependencies

```bash
npm install
```

> CI installs with `npm ci --allow-git=all` from the TRACKED `package-lock.json`
> (audit W105 T-01 — every git-dep resolution is pinned to an exact commit SHA).
> Whenever a `package.json` pin changes, regenerate the lock with `npm install`
> and commit it; a stale lock makes CI's `npm ci` fail loudly.

### 3. Start the Dev Server

```bash
npm run dev
```

The app is served at `http://localhost:8080`. Point it at a server via the
`VITE_PHLIX_SERVER_URL` environment variable, or set `phlix.serverUrl` in the
app's `localStorage` at runtime.

## Configuration

### Server URL

The client resolves which server to talk to in this order (see `src/resolveConfig.ts`):

1. `localStorage['phlix.serverUrl']` (set at runtime in the app)
2. `import.meta.env.VITE_PHLIX_SERVER_URL` (build/dev-time env)
3. **empty** — with `requireConnection: true`, `@phlix/ui` shows its first-run
   Connect screen instead of guessing `localhost`; the URL you enter is mirrored
   back to `localStorage['phlix.serverUrl']` and re-seeds the next launch

The hub-relay consumer (`src/api/hubRelay.ts`, the "Alexa, play X" path) resolves
its own context from `localStorage['phlix.hubUrl']`, `['phlix.hubServerId']` and
`['phlix.hubAccessToken']`, with the build-time overrides `VITE_PHLIX_HUB_URL`
and `VITE_PHLIX_HUB_SERVER_ID` (all env vars are declared in `vite-env.d.ts`).
Without a hub context nothing opens.

**Relay transport is TLS-mandatory (M-TIZEN-06).** The relay socket presents a
bearer credential in its opening handshake (`Sec-WebSocket-Protocol: bearer, …`),
so the dial requires an **`https://` hub base** (`wss://`). A plaintext hub base
is refused at connect — loudly, with an actionable console error — before any
credential (including the relay-token mint) touches the wire; nothing else in
the app is affected and the socket simply stays closed. For **LOCAL TESTING
ONLY** (a dev hub on plain http), the build-time escape hatch

```bash
VITE_PHLIX_DEV_ALLOW_INSECURE_RELAY=1 npm run build
```

permits the plaintext `ws://` dial and warns on the console with every attempt.
It ships the relay bearer token **unencrypted to anyone on your network** and is
**never release-safe** — do not build a `.wgt` for distribution with it set.

**SyncPlay transport is TLS-mandatory (M-TIZEN-12).** The direct watch-party
socket (`:8097`) presents the bearer JWT in its opening handshake — and the
group-join frame that follows carries the replayable SHA-256 group password
hash — so that dial requires an **`https://` server base** (`wss://`): the
M-TIZEN-06 relay law transposed to the surviving lane. A plaintext base is
refused at connect with a loud, actionable console error and a short
"needs an https:// server URL" notice on the SyncPlay error channel; the
socket is never constructed, while browsing and REST on the persisted LAN
address stay untouched (the M-TIZEN-07 boundary law keeps `http:` persistable).
For **LOCAL TESTING ONLY** (a dev server on plain http), the build-time escape
hatch

```bash
VITE_PHLIX_DEV_ALLOW_INSECURE_SYNCPLAY=1 npm run build
```

permits the plaintext `ws://` dial and warns on the console with every attempt.
It ships the session credential **unencrypted to anyone on your network** and is
**never release-safe** — do not build a `.wgt` for distribution with it set. The
two hatches are deliberately SEPARATE env vars: enabling one never unlocks the
other bearer transport.

**The plaintext refusal also lives at the resolve boundary (M-TIZEN-12 r2).**
`resolveConfig.resolveCredentialBase` is the scheme gate HUB/CREDENTIAL traffic
resolves through: a persisted (or build-env) `http://`-literal server URL is
REFUSED there with a named, honest error — the e4d8516 idiom refuses, it never
silently upgrades — and the hub-relay server-origin fallback is never fed a
plaintext base (a refused fallback is disclosed once at boot; the consumer stays
closed exactly as the dial-side law already decided). Legacy-poisoned entries
(`javascript:`/`data:`/raw-scheme storage) are sanitized on read at the same
edge. This is defense-in-depth, not a replacement: `http:` remains persistable
for LAN browsing (M-TIZEN-07 law, unchanged), and both dial builders keep their
own named refusals. Each consumer's documented `VITE_PHLIX_DEV_ALLOW_INSECURE_*`
hatch threads through the boundary too — still exactly one flag per transport.

The client sends `X-Phlix-Device-Type: samsung-tizen` and a stable
`X-Phlix-Device-ID` (persisted as `phlix.deviceId`). **The server** maps the
device-type header to the appropriate streaming/transcode quality profile — the
client does not post a device profile.

### Tizen Configuration

`app/config.xml` is the Tizen widget (`.wgt`) manifest:

- App ID (`phlix.app.phlixtizen`) and version — the version attribute is
  machine-stamped from `package.json` `"version"` by `scripts/version-sync.mjs`
  on every `npm run package` (single source; see DEVELOPER.md "Versioning")
- `required_version` (`6.5`)
- Network access (`<access origin="*">`) and TV privileges (`internet`, `tv.inputdevice` — only what the code actually exercises is granted; a privilege folds in with its feature, never pre-added)
- `<tizen:profile name="tv-samsung"/>` and `hwkey-event="enable"` (without the hwkey flag the webview never delivers remote key events to the app)
- Landscape / maximized viewmode

### HLS Tuning

`TIZEN_HLS_CONFIG` in `src/main.ts` is forwarded to `@phlix/ui`'s player via
`playerHlsConfig` to keep HLS buffers bounded on RAM-constrained Samsung
webviews (`maxBufferLength`, `capLevelToPlayerSize`, `enableSoftwareAES`, etc.).

## Building the App

### Type-check

```bash
npm run typecheck   # vue-tsc --noEmit
```

### Production Build

```bash
npm run build       # vue-tsc --noEmit && vite build
```

Output is placed in the `dist/` directory (`index.html` + `assets/`).

### Packaging for Tizen

```bash
npm run package     # npm run build, node scripts/version-sync.mjs, then node scripts/package.js
```

This assembles the `package/` directory (the Vite `dist/` plus `app/config.xml`
at the widget root). Tizen Studio (or the `tizen` CLI) then signs `package/`
into a `.wgt`. See [`docs/signing.md`](docs/signing.md) for the certificate +
signing flow.

> `base: './'` in `vite.config.ts` is required — a `.wgt` runs from a `file://`
> origin on the TV, so absolute asset paths would 404.

## Testing

### Run All Tests

```bash
npm test            # vitest run (jsdom)
```

### Watch Mode

```bash
npm run test:watch
```

### Single File / Test

```bash
npx vitest run tests/unit/tizenBridge.test.ts
npx vitest run tests/unit/SkipIntroOverlay.test.ts
npx vitest run tests/unit/routeManifest.gate.test.ts
npx vitest run -t "BACK"
```

### Code Linting

```bash
npm run lint        # eslint .
npm run lint:fix    # eslint . --fix
```

## Deployment to TV

One fact governs both paths below: **the repository directory is not a Tizen
project.** Tizen Studio's web-project import expects `config.xml` at the
*project root*, and this repo keeps its widget manifest in `app/config.xml`
(a version-stamped source file) — the repo root has none. The real Tizen web
project is **`package/`**: `npm run package` assembles `config.xml`,
`icon.png`, `index.html` and `assets/` at its root, and the directory is
committed and kept byte-fresh by CI's "Assert committed package/ is fresh"
gate. Import or sign *that* — and never a directory called `phlix-tizen`:
no such directory exists (the clone directory is `phlix-tizen-client`, and
`phlix-tizen` is only the npm package name inside `package.json`).

### Option 1: Tizen Studio

1. **Open Tizen Studio** — launch the Studio GUI from the installation
   (launcher under `<install>/ide/bin/`; there is no `tizen studio` command)
2. **Prepare an importable project directory** (from the repo root):

   ```bash
   npm ci
   npm run package                    # dist/ + app/config.xml + icon → package/
   cp -r package ../phlix-tv-import   # import a COPY, never the tracked dir
   ```

   The copy is deliberate: Tizen Studio writes project metadata into whatever
   directory you import, and the tracked `package/` must stay clean or CI's
   freshness gate reddens the build.
3. **Import the project**
   - File → Import → Tizen → Tizen Project → select `../phlix-tv-import`
     (the copy — the repo root imports nowhere, having no root `config.xml`)
   - Platform **TV**; the profile is dictated by the manifest (`tv-samsung`)
   - If Import rejects the copy, the fallback is create-then-copy: File →
     New → Tizen Project → TV → Web → template, then replace the new
     project's `config.xml`, `index.html`, `icon.png` and `assets/` with the
     copy's files. Same final tree either way; import-from-existing is the
     supported path.
4. **Create the signing profile** — Certificate Manager: author certificate +
   distributor (development) certificate + a profile name. The full walk, the
   Samsung Certificate Extension prerequisite, and every failure mode live in
   [`docs/signing.md`](docs/signing.md) ("Creating the Certificate Profile") —
   Studio signs with this profile when you build.
5. **Connect the TV** (2026 flow — the retired Eclipse "Window → Preferences →
   Tizen TV → Devices" path no longer exists)
   - On the TV: enable **Developer Mode** — Smart Hub → Apps → **App
     Settings** → type `12345` on the remote → toggle **Developer mode ON** →
     enter your development computer's IP → **full power cycle** (standby is
     not enough on "Instant On" models)
   - Studio → **Tools → Device Manager → Remote Device Manager → +** →
     the TV's IP, port **26101** (not the legacy 26159, which is for
     phone/wearables and fails against TVs)
   - The TV confirms the pairing, and on first install shows a **"Permit to
     install applications"** dialog — accept it (or right-click the device →
     Permit to install applications beforehand)
6. **Build signed package and run**
   - Right-click the project → Tizen → **Build Signed Package** (produces the
     signed `.wgt` — the GUI equivalent of the `tizen package` CLI below)
   - Right-click the project → Run As → Tizen TV Application
   - Install refused with "invalid author certificate"? The TV is out of
     Developer Mode, the profile's development distributor certificate does
     not list the TV's DUID, or the permit dialog was never accepted —
     [`docs/signing.md`](docs/signing.md) ("Known Issues") names every mode.

### Option 2: CLI Deployment

```bash
# Build and package (assembles the widget root: package/ with config.xml on top)
npm ci
npm run package

# Sign a COPY into a .wgt with the tizen CLI (needs a Certificate Manager
# profile; `-s` is the profile NAME — there is no --password flag, and the
# signed .wgt is written INTO the directory given after `--`, so the tracked,
# CI-freshness-gated package/ root itself is not the output dir):
cp -r package ./build-widget
<install>/tools/ide/bin/tizen package -t wgt -s <profile-name> -- ./build-widget

# Connect the TV — it must be in Developer Mode (walk-through in
# docs/signing.md); on first install the TV shows a "Permit to install
# applications" dialog to accept. `sdb devices` prints [serialNumber]
# [state] [targetName]; `-t` takes the target name (or use `-s <serial>`):
sdb connect <TV_IP>:26101
<install>/tools/ide/bin/tizen install -n <signed>.wgt -t <target-name> -- ./build-widget
<install>/tools/ide/bin/tizen run -p phlix.app.phlixtizen -t <target-name>
```

The app id `phlix.app.phlixtizen` comes from `app/config.xml` (authoritative).
See [`docs/signing.md`](docs/signing.md) for signing details, the TV-as-device
walk, and install failure modes.

## Remote Control

D-pad navigation is handled by `@phlix/ui`'s spatial navigation
(`useSpatialNav`); transport keys are routed by the Tizen bridge
(`src/tizenBridge.ts`) to the player and router. The engine moves focus between
its registered candidates; because the ui bundle ships no `v-focusable` call
sites at the pinned version, the Tizen host keeps that candidate pool populated
itself — `src/spatial/focusCandidates.ts` registers every currently-interactive
element under `document.body` (links, buttons, inputs, selects, textareas,
`tabindex` stops) live as they appear, leave, or become disabled.

| Button | Action |
|--------|--------|
| Arrow Up/Down/Left/Right | Spatial navigation between focusable items |
| OK / Enter | Activate the focused item (native focus) |
| Back | Walks the four-rung BACK ladder (`src/remote/backPolicy.ts`): snap a panned shelf row back to its start, else close the topmost open layer (quick-connect, rating modal, `@phlix/ui` modal, quality picker), else navigate back (on the player this closes playback first), else at the home route exit the app |
| Home | Return to the home route (`/app`) |
| Play / Pause | Toggle playback |
| Stop | Close the player; when the player route is what's on screen, also returns to where you came from (off the player route it is a plain player teardown, no navigation) |
| Fast Forward | Seek forward 10s (30s when held) |
| Rewind | Seek backward 10s (30s when held) |
| Yellow | On the player route, open/close the on-screen stream-quality picker (only when the active stream has ≥2 ABR rungs to choose from); while open, Left/Right/Up/Down/Enter drive the picker instead of seek/volume |

On the player route, spatial navigation is disabled so the player's own Arrow
seek/volume shortcuts take over. While the quality picker is open, the Arrow
keys are instead routed to the picker (the player's seek/volume shortcuts are
briefly suppressed) so the D-pad can select a rung.

## Supported Codecs

This client does not decode media by itself: `@phlix/ui`'s player feeds
streams to the Samsung webview's native decoder, and the server maps the
`X-Phlix-Device-Type: samsung-tizen` header to a transcode profile targeting
what those webviews handle (see Troubleshooting → Playback Issues). The list
below is therefore the **server-assisted working set** — what the profile
aims at — not a guarantee of native playback on every model or region.

### Video
- H.264 (AVC) — natively decoded on Tizen TVs
- H.265 (HEVC) — hardware-dependent per model/region; the server transcodes where the profile says so

### Audio
- AAC — the default HLS audio track
- AC3 (Dolby Digital) / EAC3 (Dolby Digital Plus) — hardware-dependent; transcode fallback applies
- MP3

### Delivery
- HLS (HTTP Live Streaming) via `@phlix/ui`'s hls.js player, RAM-bounded by `TIZEN_HLS_CONFIG`
- Progressive HTTP download of server-chosen direct-play streams

Container/codec combinations outside the device's native support are the
server's transcode decision; nothing in this repository adds or removes a
decodable format.

## Project Structure

```
phlix-tizen-client/
├── index.html               # Vite entry (repo root); mounts #phlix-app, #phlix-spatial-host + 7 overlay hosts
├── vite-env.d.ts            # VITE_PHLIX_SERVER_URL / VITE_PHLIX_HUB_URL / VITE_PHLIX_HUB_SERVER_ID
├── src/
│   ├── main.ts              # boot(): createPhlixApp + bridge + spatial-nav host + 7 overlay apps; TIZEN_HLS_CONFIG, buildMenu, buildExtraRoutes
│   ├── polyfills.ts         # structuredClone fallback (imported first)
│   ├── resolveConfig.ts     # pure resolveAppConfig({serverUrl, envUrl})
│   ├── deviceId.ts          # pure resolveDeviceId(storage) → persisted phlix.deviceId
│   ├── syncplayDispatch.ts  # pending_command → resolve media id → @phlix/ui player store
│   ├── SpatialNavHost.vue   # renderless useSpatialNav gate (off on player route)
│   ├── tizenBridge.ts       # RemoteManager 'action' → usePlayerStore + router; Yellow/Back drive the QualityMenu
│   ├── api/
│   │   └── hubRelay.ts      # hub-relay pending_command WebSocket consumer (ws://<hub>:8804)
│   ├── components/          # TV overlays (ChapterOverlay, SkipIntroOverlay, PiPController, ActionToastOverlay, TelemetryConsent, ScreenSaverOverlay) + D-pad lists/cards
│   ├── pages/               # ChaptersPage, AudioTracksPage, SubtitleTracksPage, MusicPage, ParentalControlsPage
│   ├── screens/             # RecommendationsScreen
│   ├── stores/              # useMusicStore, useSyncPlayStore (Pinia)
│   └── remote/
│       ├── RemoteManager.ts # TV-remote event singleton (keydown/keyup/action)
│       └── KeyMapping.ts     # Samsung key codes → actions (arrows/ENTER not handled)
├── app/
│   └── config.xml           # Tizen .wgt manifest (privileges, app id, version)
├── scripts/
│   └── package.js           # assembles package/ from dist/ + config.xml (ESM)
├── tests/
│   ├── test-setup.ts        # in-memory localStorage mock
│   ├── fixtures/
│   │   └── server-route-manifest.json  # vendored @phlix/contracts route manifest (route gate)
│   └── unit/
│       ├── resolveConfig.test.ts
│       ├── deviceId.test.ts
│       ├── tizenBridge.test.ts
│       ├── SpatialNavHost.test.ts
│       ├── RemoteManager.test.ts
│       ├── ChapterOverlay.test.ts
│       ├── hubRelay.test.ts
│       ├── syncplayDispatch.test.ts
│       ├── routeManifest.gate.test.ts
│       └── main.test.ts
├── docs/
│   ├── signing.md           # certificate + .wgt signing guide
│   ├── runtime-floor.md     # engine-floor contract (syntax target vs runtime)
│   ├── i18n.md              # locale catalogs + vendored ui-locale story
│   └── ui-port-divergence.md # local ports of sealed @phlix/ui surfaces (M-TIZEN-08)
├── .github/workflows/
│   ├── test.yml             # npm test (vitest)
│   └── lint.yml             # npm run lint + npm run build
├── vite.config.ts           # base: './', target chrome100
├── vitest.config.ts
├── eslint.config.mjs        # flat config
├── tsconfig.json
├── package.json
├── LICENSE                  # MIT
└── README.md
```

## Troubleshooting

### App Won't Start

1. Ensure your TV runs Tizen OS (`config.xml` `required_version` 6.5)
2. Check that the TV is on the same network as the server
3. Verify the Phlix Media Server is running and the resolved server URL is reachable
4. Confirm the build used `base: './'` (absolute asset paths 404 from the `file://` `.wgt` origin)

### Playback Issues

1. For buffering, check network bandwidth and the `TIZEN_HLS_CONFIG` buffer sizes in `src/main.ts`
2. Quality/transcode decisions are made server-side from the `X-Phlix-Device-Type: samsung-tizen` header
3. Check server logs for codec/transcode warnings

### Overlay Missing (chapters, skip intro, PiP, action toast, quick connect, telemetry, screensaver)

1. Each Tizen-hosted overlay is its own mounted app — confirm its host `<div>`
   exists in `index.html` (`#phlix-chapter-overlay`, `#phlix-skip-intro-overlay`,
   `#phlix-pip-overlay`, `#phlix-action-toast-overlay`, `#phlix-quick-connect`,
   `#phlix-telemetry-consent`, `#phlix-screensaver`) and the matching
   `createApp(...).mount(...)` call is present in `src/main.ts`
2. The chapter and skip-intro overlays need their endpoints
   (`GET /api/v1/media/{id}/chapters` and `/markers`) to return data for the
   current media id

Sleep timer and the end-of-video "Up next" card are **not** Tizen-hosted. They
render from `@phlix/ui`'s PlayerPage bundle — the former
`SleepTimerOverlay.vue` / `UpNextOverlay.vue` mount apps were unreachable
duplicates and were deleted (their `index.html` host divs are gone, so a
host-div check for them can never succeed). If either is missing on the player
screen, suspect the pinned `@phlix/ui` bundle's player route, not this repo's
mount list.

### Remote Not Working

1. D-pad navigation comes from `@phlix/ui`'s spatial navigation — verify the TV layout is active and you are not on the player route
2. Transport keys (play/stop/seek) flow through `src/tizenBridge.ts` — confirm `installTizenBridge` ran after mount
3. Ensure no other device is controlling the TV; check the remote batteries

## License

MIT License — see [`LICENSE`](LICENSE).

Copyright (c) 2026 Phlix contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
