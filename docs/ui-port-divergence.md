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
  `socketHint` → zero hits), and the local `connectWs` does not yet accept a
  host-supplied dial override. PORT AT THE NEXT UI RE-PIN, or record here why
  the override is not wanted.
- **Playlist manageability gating (`canManagePlaylist`, ui v0.99.11 era,
  `playlistPermissions.ts`).** Playlist UI ships from the bundle, so this lag
  closes itself at the next re-pin — listed here so the re-pin lane CHECKS it
  (grep `canManagePlaylist` in the old bundle: zero hits → v0.99.11+ required).
- **Invite create-token DTO.** NOT lagged — the two-leg create-token invite
  shape already ships in the v0.99.10 bundle. Recorded so nobody re-audits it
  twice; it re-enters the list only if the DTO moves again.

## The law

1. **A new local port of a ui-internal surface must be added to the table in
   its landing commit.** No port without a row.
2. **Every `@phlix/ui` re-pin re-verifies every row of this ledger** — check
   each lag item against the new bundle (grep evidence, not memory) and either
   port it, or update its row with the honest reason it stays behind.
3. **When `@phlix/ui` exports a surface this repo has ported, the port must
   retire** in favor of the export (that is the whole point of pinning tags).
   A retired port is deleted, and its ledger row says so with the sha.
