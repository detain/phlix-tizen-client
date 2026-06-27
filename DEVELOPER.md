# Phlix Tizen - Developer Guide

This document is the developer reference for the Phlix Tizen TV application.

The Tizen client is a **thin Vue 3 consumer of `@phlix/ui`**. It does not contain any media/library/auth/player UI of its own — `@phlix/ui`'s `createPhlixApp()` renders the entire application. This repo provides only:

1. The boot glue (`src/main.ts` + `resolveConfig` / `deviceId` / `polyfills`).
2. The Tizen remote → player/router bridge (`src/tizenBridge.ts` + `src/remote/*`).
3. Spatial-navigation gating for the TV (`src/SpatialNavHost.vue`).
4. The Tizen `.wgt` manifest + packaging (`app/config.xml`, `scripts/package.js`).

It mirrors the Windows/Electron client's thin-consumer shape (`electronBridge` ↔ `tizenBridge`, `resolveConfig` ↔ `resolveConfig`). To change a screen, a feature, theming, or the player, edit **`phlix-ui`** — not this repo.

Pinned dependencies: `@phlix/ui` `github:detain/phlix-ui#v0.53.0`, `@phlix/contracts` `#v0.1.1`. Peer runtime deps: Vue 3, Pinia, vue-router. Toolchain: Vite + `@vitejs/plugin-vue`, Vitest + jsdom + `@vue/test-utils`, flat ESLint, `vue-tsc`.

## Architecture Overview

```
                            index.html  (repo root = Vite root)
                                  │  loads /src/main.ts
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         src/main.ts  boot()                            │
│  1. import './polyfills'  (structuredClone first)                      │
│  2. resolveAppConfig({serverUrl, envUrl})  → { app:'server', apiBase } │
│  3. resolveDeviceId(localStorage)          → 'tizen-…'                  │
│  4. buildPhlixHeaders({deviceType:'samsung-tizen'})  (@phlix/contracts) │
│  5. createPhlixApp({ … playerHlsConfig:TIZEN_HLS_CONFIG }) (@phlix/ui)  │
│         .mount('#phlix-app')                                           │
│  6. installTizenBridge(app)                                            │
│  7. createApp(SpatialNavHost).use(pinia).use(router)                   │
│         .mount('#phlix-spatial-host')   (2nd app, shared pinia+router) │
└───────────────┬───────────────────────────────────────┬───────────────┘
                │                                         │
                ▼                                         ▼
   ┌────────────────────────┐               ┌──────────────────────────┐
   │   @phlix/ui app          │               │  SpatialNavHost.vue        │
   │   (#phlix-app)           │               │  (#phlix-spatial-host)     │
   │  all browse/detail/      │               │  useSpatialNav({ enabled })│
   │  player/settings/auth    │               │  D-pad nav, off on player  │
   └──────────┬───────────────┘               └──────────────────────────┘
              │ usePlayerStore / vue-router
              ▼
   ┌────────────────────────┐    'action' events    ┌─────────────────────┐
   │   tizenBridge.ts         │ ◄──────────────────── │  remote/RemoteManager│
   │  wireTizenBridge(...)    │                       │  (singleton)         │
   │  PLAY/PAUSE/STOP/FF/REW/ │                       │  remote/KeyMapping   │
   │  BACK/HOME               │                       │  (Samsung key codes) │
   └────────────────────────┘                       └─────────────────────┘
```

### Why two Vue apps?

`createPhlixApp()` installs and owns Pinia + vue-router and exposes them on
`application.config.globalProperties.$pinia` / `$router`. `main.ts` reads those
two instances and mounts `SpatialNavHost` as a **second** tiny `createApp(...)`
using the SAME pinia + router. The host's `useRoute()` / `usePreferencesStore()`
therefore observe the real shared state. The host is renderless (`<div
style="display:none">`); its only job is to call `useSpatialNav` with an
`enabled` predicate so D-pad navigation can be turned off on the player route.

## Component Structure

### Entry point (`src/main.ts`)

`boot()` is an `async` function (exported for tests; invoked via `void boot()`):

1. `import './polyfills'` is the very first line so `structuredClone` exists before any `@phlix/ui` module loads.
2. Reads the persisted server URL from `localStorage['phlix.serverUrl']`, the build-time `import.meta.env.VITE_PHLIX_SERVER_URL`, and the device id.
3. `resolveAppConfig({ serverUrl, envUrl })` decides `{ app, apiBase }`.
4. `buildPhlixHeaders({ deviceId, deviceName: 'Phlix for Samsung TV', deviceType: 'samsung-tizen' })`.
5. `createPhlixApp({ app, apiBase, deviceHeaders, defaultTv: true, defaultTheme: 'nocturne', branding: { wordmark: 'Phlix' }, playerHlsConfig: TIZEN_HLS_CONFIG })`.
6. `.mount('#phlix-app')`, then `installTizenBridge(application)`.
7. Mount `SpatialNavHost` as the second app.

`TIZEN_HLS_CONFIG` lives at the top of `main.ts`:

```ts
const TIZEN_HLS_CONFIG = {
  maxBufferLength: 60,
  maxMaxBufferLength: 180,
  maxBufferSize: 100 * 1000 * 1000,
  backBufferLength: 90,
  capLevelToPlayerSize: true,
  enableSoftwareAES: true
};
```

This is forwarded to `@phlix/ui`'s player via `playerHlsConfig` to keep HLS
buffers bounded on RAM-constrained Samsung webviews. **Tune HLS here, not in
`phlix-ui`.**

### Config resolution (`src/resolveConfig.ts`)

Pure, unit-testable:

```ts
resolveAppConfig({ serverUrl, envUrl }): { app: 'server' | 'hub'; apiBase: string }
```

Server mode only — Tizen has no hub-config IPC like the Electron client. The
precedence is persisted `serverUrl` → build-time `envUrl` → `http://localhost:8096`.
The `app: 'hub'` member exists in the shape for forward-compatibility but is
never returned today; the function shape deliberately mirrors the Windows
`resolveConfig` so a hub branch can be added later without churn.

### Device id (`src/deviceId.ts`)

Pure `resolveDeviceId(storage)` returns the persisted `phlix.deviceId`, or
generates one (preferring `crypto.randomUUID()` → `tizen-<uuid>`, with a
timestamp + monotonic-counter fallback for ancient webviews — no `Math.random`,
so tests stay deterministic) and persists it. A stable device id lets the server
track sessions/devices via the `X-Phlix-Device-ID` header.

### Polyfills (`src/polyfills.ts`)

Installs a `structuredClone` deep-clone fallback (`JSON.parse(JSON.stringify(...))`)
for pre-Chrome-98 Tizen webviews. `@phlix/ui`'s SettingsForm relies on
`structuredClone`. This module MUST be the first import in `main.ts`.

### Spatial navigation (`src/SpatialNavHost.vue`)

A renderless component (its template is `<div style="display:none" />`). In
`setup()`:

```ts
const route = useRoute();
const prefs = usePreferencesStore();
useSpatialNav({ enabled: () => Boolean(prefs.tv) && route.name !== 'player' });
```

`useSpatialNav` re-reads `enabled` on every keydown. Spatial nav is on for D-pad
browsing when the TV layout is active, and DISABLED on the `player` route so
`@phlix/ui`'s own Arrow seek/volume shortcuts win.

> If `@phlix/ui` ever renames `usePreferencesStore().tv` or its player route name,
> update both the getter here and the `getRoute()` comparison in `tizenBridge.ts`.

### Tizen remote bridge (`src/tizenBridge.ts`)

Two exports:

- **`wireTizenBridge(remote, player, router, getRoute)`** — pure wiring helper.
  Subscribes to the remote's `'action'` events and maps them onto a player store
  and a router. Dependencies are structurally typed (`BridgeRemote` /
  `BridgePlayer` / `BridgeRouter` / `BridgeRoute`) so it can be exercised with
  fakes and no real Vue app or DOM. Returns a cleanup function that unsubscribes
  (it prefers the unsubscribe returned by `on()`, and falls back to `off()`).
  No-op safe when `remote` is null/undefined.
- **`installTizenBridge(app)`** — pulls `$pinia` / `$router` off
  `app.config.globalProperties`, resolves `usePlayerStore(pinia)`, sets
  `getRoute = () => router.currentRoute.value`, and delegates to
  `wireTizenBridge` with the `RemoteManager` singleton.

Action map:

| Remote action     | Effect                                                              |
|-------------------|---------------------------------------------------------------------|
| `PLAY` / `PLAY_PAUSE` | toggle: `player.playing ? pause() : play()`                     |
| `PAUSE`           | `player.pause()`                                                    |
| `STOP`            | `player.closePlayer()`                                              |
| `FAST_FORWARD`    | `player.seekBy(repeat ? 30 : 10)`                                   |
| `REWIND`          | `player.seekBy(repeat ? -30 : -10)`                                 |
| `BACK`            | on `route.name === 'player'`: `closePlayer()` + `router.back()`; else `router.back()` |
| `HOME`            | `router.push('/app')`                                               |
| arrows / ENTER / color keys / etc. | **not bridged** — spatial-nav + native focus own them  |

### Remote input (`src/remote/`)

- **`RemoteManager.ts`** — the single source of TV-remote events (the analogue
  of Electron media events). A class with a default singleton export. Listens to
  `keydown` / `keyup` on `document` (guarded for jsdom), maps the key code via
  `KeyMapping`, and emits `'keydown'` / `'keyup'` / `'action'`. Held keys repeat
  (`keyRepeatDelay = 500`, `keyRepeatInterval = 100`) for seek-accel. `on()`
  returns an unsubscribe function; `destroy()` removes the DOM listeners and
  clears subscribers.
- **`KeyMapping.ts`** — maps Samsung Tizen key codes to action names
  (`10009` `BACK`, `415` `PLAY`, `413` `STOP`, `19` `PAUSE`, `417`
  `FAST_FORWARD`, `412` `REWIND`, `403`–`406` color keys, etc.). **Retargeted
  for the Vue migration:** the arrow keys (`LEFT`/`UP`/`RIGHT`/`DOWN`) and
  `ENTER` remain in `KEY_MAP` (for logging) but were removed from
  `isRepeatable`, `isImmediate`, AND `isHandled`. So `RemoteManager` neither
  `preventDefault`s nor emits actions for them — `@phlix/ui`'s `useSpatialNav`
  owns D-pad navigation directly on `document`, and ENTER is native focus
  activation. If RemoteManager also handled arrows, its key-repeat would fire
  phantom navigation on top of spatial-nav.

## Streaming and device profile

The Tizen client no longer posts a JSON device profile to choose direct-play vs
transcode. Instead it sends the device type header (via `buildPhlixHeaders`):

```
X-Phlix-Device-Type: samsung-tizen
X-Phlix-Device-ID:   tizen-<uuid>
```

**phlix-server** maps `X-Phlix-Device-Type: samsung-tizen` to the appropriate
streaming/transcode quality profile server-side. Do not reintroduce a
client-posted device profile. HLS playback behaviour on the client is tuned only
through `TIZEN_HLS_CONFIG` → `playerHlsConfig` (buffer sizes, level cap, software
AES).

## Building, Testing, Packaging

### Prerequisites

- Node.js 22.12+ (`engines.node` is `>=22.12.0`)
- npm (CI uses `npm install`, not `npm ci` — `package-lock.json` is gitignored)
- Tizen Studio (for `.wgt` signing + TV deployment)

### Setup

```bash
git clone https://github.com/detain/phlix-tizen-client.git
cd phlix-tizen-client
npm install
```

### Development workflow

```bash
npm run dev          # vite dev server at :8080
npm run test:watch   # vitest in watch mode
npm run typecheck    # vue-tsc --noEmit
npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
```

Set `VITE_PHLIX_SERVER_URL` (e.g. in a `.env` / shell env) to point the dev
server at a real Phlix server, or set `localStorage['phlix.serverUrl']` in the
running app.

### Production build + packaging

```bash
npm run build        # vue-tsc --noEmit && vite build → dist/
npm run package      # build, then node scripts/package.js → package/
```

`scripts/package.js` (ESM) copies the Vite `dist/` (index.html + assets) and
`app/config.xml` into a fresh `package/` directory at the widget root, and
sanity-checks that both `index.html` and `config.xml` land there. Tizen Studio
(or the `tizen` CLI) then signs the `package/` contents into a signed `.wgt`.
See `docs/signing.md` for the full certificate + signing flow.

> `base: './'` in `vite.config.ts` is MANDATORY — a `.wgt` runs from a `file://`
> origin on the TV, so absolute `/assets` paths would 404.

### Writing tests

Vitest + jsdom + `@vue/test-utils`. Tests live in `tests/unit/*.test.ts`,
co-located by module name (the `src/` tree is flat). `tests/test-setup.ts`
installs an in-memory localStorage mock. Pure helpers (`resolveConfig`,
`deviceId`, `wireTizenBridge`) are tested directly with fakes; `main.test.ts`
mocks `@phlix/ui`, `@phlix/contracts`, `tizenBridge`, `SpatialNavHost`, and
`vue`'s `createApp` to assert the boot wiring (`defaultTv: true`,
`deviceType: 'samsung-tizen'`, `playerHlsConfig` present, mounts, bridge install,
2nd-app `use(pinia).use(router).mount('#phlix-spatial-host')`).

```ts
// tests/unit/resolveConfig.test.ts
import { describe, it, expect } from 'vitest';
import { resolveAppConfig } from '@/resolveConfig';

describe('resolveAppConfig', () => {
  it('prefers the persisted server URL', () => {
    expect(resolveAppConfig({ serverUrl: 'http://tv:8096', envUrl: null }))
      .toEqual({ app: 'server', apiBase: 'http://tv:8096' });
  });
});
```

Run a single file: `npx vitest run tests/unit/tizenBridge.test.ts`; a single
test: `npx vitest run -t "BACK"`.

## Common Tasks

### Add a new screen / route

Screens live in `@phlix/ui`. Add the route + view there. If the Tizen client
needs to inject a Tizen-only route, pass it through `createPhlixApp`'s config in
`main.ts` (e.g. an `extraRoutes` / `extraRoute` option if the `@phlix/ui`
version exposes one) rather than building UI in this repo. There is no local
router or view layer to edit here.

### Map a new remote key to an action

1. Add or confirm the Samsung key code → action name in `src/remote/KeyMapping.ts`'s
   `KEY_MAP`.
2. Add the action to `IMMEDIATE_ACTIONS` (fires on keydown) or `REPEATABLE_ACTIONS`
   (fires repeatedly while held) — both feed `HANDLED_ACTIONS`, which controls
   `preventDefault`. Do NOT add arrows/ENTER here (spatial-nav + native focus
   own them).
3. Handle the new action in `wireTizenBridge`'s `switch` in `src/tizenBridge.ts`,
   acting on the `BridgePlayer` / `BridgeRouter` deps. Extend the `BridgePlayer` /
   `BridgeRouter` interfaces if you need a new player/router method.
4. Add a case to `tests/unit/tizenBridge.test.ts`.

### Tune HLS for the TV

Edit `TIZEN_HLS_CONFIG` in `src/main.ts`. It is passed verbatim as
`playerHlsConfig` to `@phlix/ui`'s player. Keep buffers bounded for Samsung RAM.

### Change a Tizen privilege or app metadata

Edit `app/config.xml` (the `.wgt` manifest). `scripts/package.js` copies it to
the `package/` root. New TV capabilities usually mean a new `<tizen:privilege>`.

### Point the client at a server

Set `localStorage['phlix.serverUrl']` (runtime) or `VITE_PHLIX_SERVER_URL`
(build/dev). Resolution lives in `src/resolveConfig.ts`.

## Tizen-Specific Notes

1. **No pointer/mouse** — keyboard/D-pad only. Browse navigation is
   `useSpatialNav` (gated by `SpatialNavHost.vue`); transport keys flow through
   `RemoteManager` → `tizenBridge`. No manual focus code lives in this repo.
2. **Fixed `1920x1080`** viewport (`index.html` meta).
3. **`structuredClone` polyfill** loads first (`src/polyfills.ts`).
4. **RAM-bounded HLS** via `playerHlsConfig` (`TIZEN_HLS_CONFIG`).
5. **`base: './'`** in Vite is required for the `file://` `.wgt` origin.

## Troubleshooting

### Build / typecheck failures referencing `@phlix/ui`

`@phlix/ui` v0.53.0 must export `createPhlixApp`, `useSpatialNav`,
`usePreferencesStore`, `usePlayerStore` and accept `playerHlsConfig` + `defaultTv`
in its app config. If the pinned tag lacks one, `vue-tsc` / `vite build` will
flag it — bump the pin or adjust the consumer.

### D-pad navigation does nothing / double-navigates

Check `SpatialNavHost.vue`'s `enabled` predicate and that arrows are NOT in
`KeyMapping`'s `isHandled` set (they must pass through to spatial-nav).

### Playback transport keys do nothing

Verify `installTizenBridge` ran (after `mount`) and that the action is handled in
`wireTizenBridge`'s `switch`. Confirm the route name comparison (`'player'`)
matches the `@phlix/ui` player route.

### Network / CORS issues

The Phlix server must allow the TV origin. The CSP in `index.html` permits
`http`/`https`/`ws`/`wss` connect-src for LAN servers.
