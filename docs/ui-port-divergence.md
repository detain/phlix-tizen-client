# Local ports of sealed `@phlix/ui` surfaces

**What this document is.** The Tizen client renders its app UI from the vendored
`@phlix/ui` bundle, but three behaviors could not ride that bundle because
`@phlix/ui` does not export them (as of the pin at time of writing, v0.99.10).
They are therefore **re-implemented locally** in this repo. Local ports drift:
every ui release can change the thing being ported while the port stands still.
This ledger names every port, what it is sealed behind, and the known
mirror-lag at the time of writing. It exists so a re-pin lane cannot silently
leave a port behind.

| Local port | Ports the ui surface of | Why it could not ride the bundle |
|---|---|---|
| `src/stores/useSyncPlayStore.ts` | the ui's SyncPlay REST client + WebSocket layer (`getSyncPlayApi`, `openSyncPlayConnection`, `sendSyncPlayCommand`) | internal to the package — `@phlix/ui` exports no player-side SyncPlay API |
| `src/api/hubRelay.ts` | the ui's hub-relay pending-command consumer (ui S298 half) | boot glue differs (tizen config resolution, S2a token mint); documented as a faithful port in its header |
| `src/syncplayDispatch.ts` | the ui's `Player.vue` pending-media load path (`resolvePendingMedia` prop era) | the player page lives inside the sealed bundle; this is the host-side watcher driving the shared player store |

## Mirror-lag list (as of writing — ui `github:detain/phlix-ui#v0.99.10`)

Verified against the vendored bundle in `package/assets/` and the local sources
at this commit, not from memory:

- **SyncPlay socket hint seam (`wsUrl` / `wsPath`, ui v0.99.11 era).** The ui
  gained a `socketHint` seam so hosts can point the player's SyncPlay dial at
  a custom URL/path. The vendored v0.99.10 bundle has none of it (grep
  `socketHint` → zero hits). Interim host-side seam SHIPPED (M-TIZEN-07,
  W-min171): `src/endpointOverrides.ts` validates `phlix.syncplayPort` /
  `phlix.relayPort` / `phlix.relayPath` storage rows at every dial — the
  manual, tizen-local equivalent of the env seam the hub uses. PORT AT THE
  NEXT UI RE-PIN to the `socketHint` prop and retire the storage vocabulary
  (or record here why the override should stay host-side).
- **Playlist manageability gating (`canManagePlaylist`, ui v0.99.11 era,
  `playlistPermissions.ts`).** Playlist UI ships from the bundle, so this lag
  closes itself at the next re-pin — listed here so the re-pin lane CHECKS it
  (grep `canManagePlaylist` in the old bundle: zero hits → v0.99.11+ required).
- **Invite create-token DTO.** NOT lagged — the two-leg create-token invite
  shape already ships in the v0.99.10 bundle. Recorded so nobody re-audits it
  twice; it re-enters the list only if the DTO moves again.
- **Music playback state (M-TIZEN-30 probe).** ui's music player
  (`useMusicPlayer`) keeps playing-state as PAGE-INSTANCE refs on detached
  `new Audio()` elements, exports no store, and sets no `navigator.mediaSession`
  for the music path — the host cannot observe "a track is playing" through any
  legitimate seam. Tizen's `src/mediaActivity.ts` is therefore an OBSERVER-ONLY
  decoration of the global `Audio` constructor feeding the screensaver veto.
  **Retirement:** when ui exports music playback state (a shared store, or
  mediaSession parity with the video path), DELETE the probe and its test +
  this row; the probe's reappearance pin (bundle grep `new Audio(` in
  `package/assets/Music*.js`) reddens on any re-pin that moves the
  construction site first.
- **Vendored `MetadataMatchModal` hand-rolled innerHTML escape (M-TIZEN-22
  backstop).** The bundle escapes `&,"<>` per string then assigns innerHTML —
  a hand-rolled sanitizer in frozen bytes this repo cannot edit. Carried as an
  UPSTREAM item: replace with a text binding in @phlix/ui. Meanwhile the client
  hardened its own boundary: `script-src 'self'` (no 'unsafe-inline') makes any
  future escape regression non-executable inline (tests/unit/cspPolicy.test.ts).
  At the next ui re-pin, grep the new bundle for the escape pattern; gone →
  retire this row (and keep the strict CSP anyway — it never needed to loosen).
- **Bare token storage keys in the ui auth store (M-TIZEN-23 note).** The
  widget's webdata (now encrypted at rest via config.xml `encryption="enable"`)
  contains the vendored store's UNPREFIXED rows `access_token`, `refresh_token`,
  `user` beside this app's namespaced `phlix.*` keys. Harmless under the
  per-app-id sandbox, but they break the namespace convention every other key
  keeps, and renaming them is a STORE-LEVEL migration only ui can make.
  Carried upstream: prefix (or consolidate) the auth store's storage keys; a
  re-pin lane can grep `localStorage.setItem('access_token` to check.

## The law

1. **A new local port of a ui-internal surface must be added to the table in
   its landing commit.** No port without a row.
2. **Every `@phlix/ui` re-pin re-verifies every row of this ledger** — check
   each lag item against the new bundle (grep evidence, not memory) and either
   port it, or update its row with the honest reason it stays behind.
3. **When `@phlix/ui` exports a surface this repo has ported, the port must
   retire** in favor of the export (that is the whole point of pinning tags).
   A retired port is deleted, and its ledger row says so with the sha.
