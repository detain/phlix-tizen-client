# Phlix Tizen TV App

[![Tests](https://github.com/detain/phlix-tizen-client/actions/workflows/test.yml/badge.svg)](https://github.com/detain/phlix-tizen-client/actions/workflows/test.yml)
[![Lint](https://github.com/detain/phlix-tizen-client/actions/workflows/lint.yml/badge.svg)](https://github.com/detain/phlix-tizen-client/actions/workflows/lint.yml)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
![Platform](https://img.shields.io/badge/platform-Samsung%20Tizen-1428A0?logo=samsung&logoColor=white)
[![@phlix/ui](https://img.shields.io/badge/%40phlix%2Fui-v0.74.0-f5a524)](https://github.com/detain/phlix-ui)

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
- [Supported Codecs](#supported-codecs)
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
- **Theming**: Ships the `nocturne` theme by default

> Provided by `@phlix/ui`. To add or change a feature/screen, edit `phlix-ui`.

## Tech Stack

- **Vue 3** + **Pinia** + **vue-router** (peer dependencies)
- **[`@phlix/ui`](https://github.com/detain/phlix-ui)** `v0.74.0` — the entire application UI via `createPhlixApp()`, incl. the player's `QualityMenu` stream-quality picker
- **[`@phlix/contracts`](https://github.com/detain/phlix-contracts)** `v0.2.0` — `buildPhlixHeaders` (device headers)
- **Vite** + `@vitejs/plugin-vue` (build target `chrome100`, `base: './'`)
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

- **Tizen Studio**: Version 4.0 or higher (for `.wgt` signing + deployment)
- **Samsung TV SDK**: Tizen TV Extensions
- **Samsung Smart TV**: Tizen OS device (`config.xml` `required_version` is `6.5`)

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

> CI uses `npm install` (not `npm ci`) — `package-lock.json` is gitignored.

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
3. `http://localhost:8096` (default)

The client sends `X-Phlix-Device-Type: samsung-tizen` and a stable
`X-Phlix-Device-ID` (persisted as `phlix.deviceId`). **The server** maps the
device-type header to the appropriate streaming/transcode quality profile — the
client does not post a device profile.

### Tizen Configuration

`app/config.xml` is the Tizen widget (`.wgt`) manifest:

- App ID (`phlix.app.phlixtizen`) and version
- `required_version` (`6.5`)
- Network access (`<access origin="*">`) and TV privileges (`internet`, `tv.inputdevice`, `tv.window`, `tv.audio`, `network.get`, `application.launch`, `filesystem.read`)
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
npm run package     # npm run build, then node scripts/package.js
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
npx vitest run -t "BACK"
```

### Code Linting

```bash
npm run lint        # eslint .
npm run lint:fix    # eslint . --fix
```

## Deployment to TV

### Option 1: Tizen Studio

1. **Open Tizen Studio**
   ```bash
   tizen studio
   ```

2. **Import Project**
   - File → Import → Tizen → Tizen Project
   - Select the `phlix-tizen` directory
   - Choose "TV" as the platform

3. **Connect Device**
   - Ensure your TV and computer are on the same network
   - In Tizen Studio, go to Window → Preferences → Tizen TV → Devices
   - Add your TV's IP address

4. **Run on Device**
   - Right-click the project → Run As → Tizen TV Application
   - Or press `Shift + F11` to run

### Option 2: CLI Deployment

```bash
# Build and package
npm run package

# Sign package/ into a .wgt with Tizen Studio (or the tizen CLI), then:
tizen install -n <signed>.wgt -t <TV_IP>
tizen launch  -n phlix.app.phlixtizen
```

The app id `phlix.app.phlixtizen` comes from `app/config.xml` (authoritative).
See [`docs/signing.md`](docs/signing.md) for signing details.

## Remote Control

D-pad navigation is handled by `@phlix/ui`'s spatial navigation
(`useSpatialNav`); transport keys are routed by the Tizen bridge
(`src/tizenBridge.ts`) to the player and router.

| Button | Action |
|--------|--------|
| Arrow Up/Down/Left/Right | Spatial navigation between focusable items |
| OK / Enter | Activate the focused item (native focus) |
| Back | Dismiss the quality picker if it's open (see Yellow below); otherwise leave the player (and go back), or navigate back |
| Home | Return to the home route (`/app`) |
| Play / Pause | Toggle playback |
| Stop | Close the player |
| Fast Forward | Seek forward 10s (30s when held) |
| Rewind | Seek backward 10s (30s when held) |
| Yellow | On the player route, open/close the on-screen stream-quality picker (only when the active stream has ≥2 ABR rungs to choose from); while open, Left/Right/Up/Down/Enter drive the picker instead of seek/volume |

On the player route, spatial navigation is disabled so the player's own Arrow
seek/volume shortcuts take over. While the quality picker is open, the Arrow
keys are instead routed to the picker (the player's seek/volume shortcuts are
briefly suppressed) so the D-pad can select a rung.

## Supported Codecs

### Video
- H.264 (AVC)
- H.265 (HEVC)
- VP9

### Audio
- AAC
- AC3 (Dolby Digital)
- EAC3 (Dolby Digital Plus)
- DTS
- FLAC
- MP3

### Containers
- MP4
- MKV
- WebM
- TS (MPEG Transport Stream)

### Streaming
- HLS (HTTP Live Streaming)
- MPEG-DASH
- Progressive HTTP download

## Project Structure

```
phlix-tizen-client/
├── index.html               # Vite entry (repo root); mounts #phlix-app + #phlix-spatial-host
├── src/
│   ├── main.ts              # boot(): createPhlixApp + bridge + spatial-nav host; TIZEN_HLS_CONFIG
│   ├── polyfills.ts         # structuredClone fallback (imported first)
│   ├── resolveConfig.ts     # pure resolveAppConfig({serverUrl, envUrl})
│   ├── deviceId.ts          # pure resolveDeviceId(storage) → persisted phlix.deviceId
│   ├── SpatialNavHost.vue   # renderless useSpatialNav gate (off on player route)
│   ├── tizenBridge.ts       # RemoteManager 'action' → usePlayerStore + router; Yellow/Back drive the QualityMenu
│   └── remote/
│       ├── RemoteManager.ts # TV-remote event singleton (keydown/keyup/action)
│       └── KeyMapping.ts     # Samsung key codes → actions (arrows/ENTER not handled)
├── app/
│   └── config.xml           # Tizen .wgt manifest (privileges, app id, version)
├── scripts/
│   └── package.js           # assembles package/ from dist/ + config.xml (ESM)
├── tests/
│   ├── test-setup.ts        # in-memory localStorage mock
│   └── unit/
│       ├── resolveConfig.test.ts
│       ├── deviceId.test.ts
│       ├── tizenBridge.test.ts
│       ├── SpatialNavHost.test.ts
│       └── main.test.ts
├── docs/
│   └── signing.md           # certificate + .wgt signing guide
├── .github/workflows/
│   ├── test.yml             # npm test (vitest)
│   └── lint.yml             # npm run lint + npm run build
├── vite.config.ts           # base: './', target chrome100
├── vitest.config.ts
├── eslint.config.mjs        # flat config
├── tsconfig.json
├── package.json
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

### Remote Not Working

1. D-pad navigation comes from `@phlix/ui`'s spatial navigation — verify the TV layout is active and you are not on the player route
2. Transport keys (play/stop/seek) flow through `src/tizenBridge.ts` — confirm `installTizenBridge` ran after mount
3. Ensure no other device is controlling the TV; check the remote batteries

## License

MIT License

Copyright (c) 2024 Phlix

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
