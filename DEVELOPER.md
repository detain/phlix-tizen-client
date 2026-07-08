# Phlix Tizen - Developer Guide

This document is the developer reference for the Phlix Tizen TV application.

The Tizen client is a **thin Vue 3 consumer of `@phlix/ui`**. It does not contain any media/library/auth/player UI of its own — `@phlix/ui`'s `createPhlixApp()` renders the entire application. This repo provides only:

1. The boot glue (`src/main.ts` + `resolveConfig` / `deviceId` / `polyfills`).
2. The Tizen remote → player/router bridge (`src/tizenBridge.ts` + `src/remote/*`).
3. Spatial-navigation gating for the TV (`src/SpatialNavHost.vue`).
4. The Tizen `.wgt` manifest + packaging (`app/config.xml`, `scripts/package.js`).

It mirrors the Windows/Electron client's thin-consumer shape (`electronBridge` ↔ `tizenBridge`, `resolveConfig` ↔ `resolveConfig`). To change a screen, a feature, theming, or the player, edit **`phlix-ui`** — not this repo.

Pinned dependencies: `@phlix/ui` `github:detain/phlix-ui#v0.74.0`, `@phlix/contracts` `#v0.2.0`. Peer runtime deps: Vue 3, Pinia, vue-router. Toolchain: Vite + `@vitejs/plugin-vue`, Vitest + jsdom + `@vue/test-utils`, flat ESLint, `vue-tsc`.

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
   │  BACK/HOME/YEL           │                       │  (Samsung key codes) │
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
precedence is persisted `serverUrl` → build-time `envUrl` → an **empty base**. An
empty base is intentional: combined with `requireConnection: true` in `main.ts`,
`@phlix/ui` shows its first-run Connect screen (enter your server address) rather
than guessing `localhost:8096`; the chosen URL is persisted by the connection
store and mirrored back to `localStorage['phlix.serverUrl']` via
`onConnectionChange` so it re-seeds here next launch. The `app: 'hub'` member
exists in the shape for forward-compatibility but is never returned today; the
function shape deliberately mirrors the Windows `resolveConfig` so a hub branch
can be added later without churn.

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
useSpatialNav({
  enabled: () => Boolean(prefs.tv) && route.name !== 'player' && !qualityMenuActive.value
});
```

`useSpatialNav` re-reads `enabled` on every keydown. Spatial nav is on for D-pad
browsing when the TV layout is active, and DISABLED on the `player` route so
`@phlix/ui`'s own Arrow seek/volume shortcuts win. The `!qualityMenuActive.value`
conjunct (the shared flag from `tizenBridge.ts`) is an explicit invariant rather
than a load-bearing gate today — quality mode can currently only be entered on
the `player` route, where spatial-nav is already off — but it keeps the
component correct even if that assumption ever changes, without depending on
route-name comparisons to stay in sync across two files.

> If `@phlix/ui` ever renames `usePreferencesStore().tv` or its player route name,
> update both the getter here and the `getRoute()` comparison in `tizenBridge.ts`.

### Tizen remote bridge (`src/tizenBridge.ts`)

Two exports:

- **`wireTizenBridge(remote, player, router, getRoute, quality?)`** — pure wiring
  helper. Subscribes to the remote's `'action'` events and maps them onto a
  player store, a router, and (for `YELLOW`/`BACK`) the on-screen quality
  picker. Dependencies are structurally typed (`BridgeRemote` / `BridgePlayer` /
  `BridgeRouter` / `BridgeRoute` / `BridgeQualityMenu`) so it can be exercised
  with fakes and no real Vue app or DOM. The `quality` param defaults to
  `createDomQualityMenu()` (the real DOM-backed controller) but tests inject a
  fake `BridgeQualityMenu`. Returns a cleanup function that unsubscribes (it
  prefers the unsubscribe returned by `on()`, and falls back to `off()`). No-op
  safe when `remote` is null/undefined.
- **`installTizenBridge(app)`** — pulls `$pinia` / `$router` off
  `app.config.globalProperties`, resolves `usePlayerStore(pinia)`, sets
  `getRoute = () => router.currentRoute.value`, wires
  `remoteManager.suppressPropagation` for the quality-mode D-pad passthrough
  (see below), registers a `router.afterEach` guard for quality-mode teardown,
  and delegates to `wireTizenBridge` with the `RemoteManager` singleton. Its
  returned cleanup unwires the action handler, removes the route guard, forces
  quality mode off, and nulls `suppressPropagation` — so nothing from this
  bridge can outlive it.

Action map:

| Remote action     | Effect                                                              |
|-------------------|---------------------------------------------------------------------|
| `PLAY` / `PLAY_PAUSE` | toggle: `player.playing ? pause() : play()`                     |
| `PAUSE`           | `player.pause()`                                                    |
| `STOP`            | `player.closePlayer()`                                              |
| `FAST_FORWARD`    | `player.seekBy(repeat ? 30 : 10)`                                   |
| `REWIND`          | `player.seekBy(repeat ? -30 : -10)`                                 |
| `BACK`            | if the quality picker is open: dismiss it (`quality.deactivate()`), player untouched; else on `route.name === 'player'`: `closePlayer()` + `router.back()`; else `router.back()` |
| `HOME`            | `router.push('/app')`                                               |
| `YELLOW`          | on the player route only, and only when the picker actually has a menu to show (`quality.isAvailable()`): toggle quality-selection mode (`quality.activate()` / `deactivate()`) |
| arrows / ENTER / other color keys / etc. | **not bridged directly** — spatial-nav + native focus own them, EXCEPT while quality mode is active (see below) |

#### Quality-selection mode (`YELLOW`, the on-screen `QualityMenu`)

`@phlix/ui`'s `Player.vue` renders a `QualityMenu` — a `Select` combobox
(`.quality-menu .phlix-select__trigger`) — in the control bar whenever the
active stream has ≥2 switchable hls.js ABR rungs. It is fully keyboard-operable
once its trigger is focused (its own `keydown` handler owns Arrow-to-navigate /
Enter-to-select / Escape-to-close), but on a TV two things stand in the way:
`SpatialNavHost.vue` disables spatial-nav on the player route (so the D-pad
can't focus the trigger), and even once focused, the player's own document-level
Arrow seek/volume shortcuts fire in parallel with the Select's Arrow handling.
This repo bridges the gap entirely on the client side (no `@phlix/ui` change):

1. **`YELLOW` opens/toggles it.** `wireTizenBridge`'s `YELLOW` case, only on the
   player route and only when `quality.isAvailable()` (the trigger exists —
   i.e. a real multi-variant transcode), focuses and clicks open the trigger
   via `createDomQualityMenu()`'s DOM-backed `activate()`. This drives the
   sealed `@phlix/ui` Select purely through `focus()`/`click()`/`aria-expanded`
   — no `@phlix/ui` source change needed.
2. **`RemoteManager.suppressPropagation` stops the player's Arrow shortcuts
   from double-firing.** While `qualityMenuActive` is true,
   `installTizenBridge` wires `remoteManager.suppressPropagation` to return
   `true` for `LEFT`/`RIGHT`/`UP`/`DOWN` (`QUALITY_NAV_KEYS`), which calls
   `event.stopImmediatePropagation()` in the keydown BUBBLE phase on
   `document`. This is needed because `@phlix/ui`'s player registers its own
   Arrow seek/volume `document` keydown listener, and without suppression it
   would fire on every Arrow press alongside the focused Select's own
   TARGET-phase handling — a single D-pad press would both move the picker's
   highlight AND seek/change volume underneath it. The ordering is
   load-bearing: `RemoteManager`'s `document` listener is registered at
   module-eval time (before `@phlix/ui` mounts the player), so in the bubble
   phase it always runs — and can suppress — before the player's later
   listener; the Select's own target-phase handler has already done its job by
   then. ENTER is deliberately excluded from `QUALITY_NAV_KEYS` — the player
   has no ENTER shortcut to fight, and the Select needs ENTER to confirm a
   rung.
3. **`BACK` dismisses the picker first** without tearing down the player
   underneath (see the action map above).

**Teardown — one choke point, two independent triggers.** All of the above
hinges on `qualityMenuActive` never getting stuck `true` (a stuck flag would
permanently suppress the player's Arrow shortcuts, and — via
`SpatialNavHost.vue`'s gate — spatial-nav app-wide too). Rather than patching
every individual way the on-screen menu can disappear, `tizenBridge.ts` routes
every path through a single private `close()` inside `createDomQualityMenu()`,
and only two independent mechanisms ever call it — because there are exactly
two *orthogonal* classes of exit:

- **Menu-level self-close** — the Select closes itself while the player and
  its route are untouched (ENTER selects a rung, Escape, or an outside
  click/blur). `activate()` attaches a `MutationObserver` on the trigger's
  `aria-expanded` attribute (started AFTER the open-click, so the open
  transition itself isn't misread as a close); whenever the Select flips it
  back off `'true'`, the observer calls `close()`. This is the only reliable
  way to notice a self-close because the sealed Select emits no event for it —
  the bridge has to watch the DOM.
- **Player/route-level teardown** — the player (and its `QualityMenu` trigger)
  is torn out from under an *open* menu, e.g. `HOME`/`router.push('/app')` or
  any other programmatic navigation away from `'player'`. There is no
  `aria-expanded` mutation to observe here — the trigger element is simply
  gone — so `installTizenBridge` registers a `router.afterEach` guard that
  calls `quality.deactivate()` whenever navigation leaves the player route.

Both mechanisms funnel into the same `close()` (idempotent — safe to call twice,
and safe when the trigger no longer exists), so `qualityMenuActive` is always
derived from reality rather than tracked as a separately-mutated boolean that
can drift. **Do not "simplify" this to a single mechanism** — the two exit
classes are genuinely independent (one is a DOM mutation with the route
unchanged, the other is a route change with no DOM mutation to observe), and a
version of this code that only handled one of them shipped a real bug: a
normal ENTER-selected quality change (self-close, no route change) left
`suppressPropagation` armed and the player's seek/volume arrows dead until a
stray `BACK`/`YELLOW` press.

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

`@phlix/ui` v0.74.0 must export `createPhlixApp`, `useSpatialNav`,
`usePreferencesStore`, `usePlayerStore`, and `QualityMenu`'s trigger markup
(`.quality-menu .phlix-select__trigger` with `aria-expanded`), and accept
`playerHlsConfig` + `defaultTv` in its app config. If the pinned tag lacks one,
`vue-tsc` / `vite build` will flag it — bump the pin or adjust the consumer.

### D-pad navigation does nothing / double-navigates

Check `SpatialNavHost.vue`'s `enabled` predicate and that arrows are NOT in
`KeyMapping`'s `isHandled` set (they must pass through to spatial-nav). If
navigation is frozen **everywhere** (not just on the player route), check
whether `qualityMenuActive` (`tizenBridge.ts`) is stuck `true` — it should
always clear itself via `close()` when the on-screen quality picker closes
(self-close via the `aria-expanded` `MutationObserver`, or route-away via the
`router.afterEach` guard); if you've changed either of those teardown paths,
this is the most likely regression.

### Playback transport keys do nothing

Verify `installTizenBridge` ran (after `mount`) and that the action is handled in
`wireTizenBridge`'s `switch`. Confirm the route name comparison (`'player'`)
matches the `@phlix/ui` player route.

### Yellow (quality picker) does nothing / D-pad fights the player while it's open

`YELLOW` only does anything on the player route AND when `quality.isAvailable()`
is true (the `QualityMenu` trigger exists in the DOM — i.e. the active stream
has ≥2 ABR rungs; direct-play and single-quality transcodes never render it).
If the picker opens but Arrow presses also seek/change volume, check that
`remoteManager.suppressPropagation` is actually wired (set in
`installTizenBridge`) and that `RemoteManager`'s `document` listener is still
registered before `@phlix/ui` mounts the player (module-eval time) — the
bubble-phase ordering is what lets it suppress the player's later listener.

### Network / CORS issues

The Phlix server must allow the TV origin. The CSP in `index.html` permits
`http`/`https`/`ws`/`wss` connect-src for LAN servers.
