# Local ports of sealed `@phlix/ui` surfaces

**What this document is.** The Tizen client renders its app UI from the vendored
`@phlix/ui` bundle, but three behaviors could not ride that bundle because
`@phlix/ui` does not export them (as of the pin at time of writing, v0.99.17).
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

## Mirror-lag list (as of writing — ui `github:detain/phlix-ui#v0.99.17`)

Verified against the vendored bundle in `package/assets/` and the local sources
at this commit, not from memory (rows re-grepped at the 2026-11-06 v0.99.17
re-pin onto the v0.99.17 bytes — the ui delta across that pin is the
PLAYERMUTE autoplay-mute cure, the embedded version-stamp literal and a
ui-internal routeGate fixture regen; `git diff 4d89b3a7..b958fb574 -- src/i18n`
empty — every row re-attested FACT-UNCHANGED from the 2026-11-04 v0.99.16
re-greps, with chunk content-hash renames (32 pairs — the entry CSS chunk
rotates this wave, the Player.vue edit moving its scoped-style hash; at
v0.99.16 the CSS chunk had HELD) aside):

- **SyncPlay socket hint seam (`wsUrl` / `wsPath`).** The ui gained a
  `socketHint` seam so hosts can point the player's SyncPlay dial at
  a custom URL/path; it SHIPS at the pinned v0.99.17 (re-grepped at the
  2026-11-06 wave → `SyncPlayModal-*.js` + `index-*.js` chunks; keys typed in
  the bundle's `app/types.d.ts`-era config). The host-side seam (M-TIZEN-07,
  W-min171)
  `src/endpointOverrides.ts` — validating `phlix.syncplayPort` /
  `phlix.relayPort` / `phlix.relayPath` storage rows at every dial —
  therefore does NOT retire: both of tizen's dial lanes are HOST-owned code
  (`useSyncPlayStore.ts` `buildWsUrl` for the :8097 direct socket and
  `hubRelay.ts` `buildHubRelayUrl` for the :8804 relay), which the bundle's
  socket never owns, and the vocabularies differ — one `wsUrl`/`wsPath` pair
  cannot carry tizen's split port/relay-path override set while the hub
  origin stays slot-owned. OWED FOLLOW-UP (registered here, deliberately not
  taken in a pin-bump lane): forward the validated overrides into the
  `PhlixAppConfig` `wsUrl`/`wsPath` at app creation so the BUNDLE socket obeys
  the same dial-time law the host sockets already do — behavior change, needs
  its own measured wave.
- **Playlist manageability gating (`canManagePlaylist`, ui v0.99.11 era,
  `playlistPermissions.ts`).** CLOSED by this re-pin — the gate ships in the
  pinned bytes (grep `canManagePlaylist` → 5 sites in the installed
  `@phlix/ui` dist; `PlaylistDetailPage-*.js` + `PlaylistsPage-*.js` chunks
  now carry it in `package/assets/`). Methodology notes: from the v0.99.14
  re-grep the 23-site figure was a RECURSIVE dist count over `.map`/`.d.ts`
  too — the identifier never survives in the minified `.js` bodies; at the
  v0.99.15 re-pin (2026-11-04) that recursive count read 5 (1 `.d.ts` + 4
  `.map` sourcesContent) purely from bundler map granularity — RE-MEASURED 5 at
  the v0.99.16 re-pin (2026-11-04), and 5 again at the v0.99.17 re-pin
  (2026-11-06) — so re-attest via the shipped
  `(shared — read-only)` picker literal — at v0.99.17 it still rides the
  committed `index-*.js` chunk (this widget build folds MediaCard
  into index; no standalone `MediaCard-*.js`), gate proven live.
  Row kept as the closed bookend; delete
  it in the next touch that has other business in this file.
- **Invite create-token DTO.** NOT lagged — the two-leg create-token invite
  shape already ships (re-verified at the v0.99.17 re-pin (2026-11-06) — the
  `invite-links` path plus the `invite_link_not_found` /
  `invite_expired_or_exhausted` codes and the `redeem` leg ride the committed
  bundle — `invite-links` greps to the `McpTokensPage-*.js` chunk, the codes
  and `redeem` to `index-*.js`; the wording at v0.99.16 additionally listed
  `index-*.js` for `invite-links`, imprecise even at those bytes — count 0 —
  corrected from this wave's grep). Recorded so nobody re-audits
  it twice; it re-enters the list only if the DTO moves again.
- **Music playback state (M-TIZEN-30 probe).** ui's music player
  (`useMusicPlayer`) keeps playing-state as PAGE-INSTANCE refs on detached
  `new Audio()` elements, exports no store, and sets no `navigator.mediaSession`
  for the music path — the host cannot observe "a track is playing" through any
  legitimate seam. Tizen's `src/mediaActivity.ts` is therefore an OBSERVER-ONLY
  decoration of the global `Audio` constructor feeding the screensaver veto.
  **Retirement:** when ui exports music playback state (a shared store, or
  mediaSession parity with the video path), DELETE the probe and its test +
  this row; the probe's reappearance pin (bundle grep `new Audio` in
  `package/assets/Music*.js`) reddens on any re-pin that moves the
  construction site first. Re-verified at the v0.99.17 re-pin (2026-11-06):
  the `MusicLibraryPage-*.js` chunk still builds it (1 site) and `mediaSession`
  still appears only in the video-path `index-*.js` chunk — observer posture
  unchanged, watch pin green.
- **Vendored `MetadataMatchModal` hand-rolled innerHTML escape (M-TIZEN-22
  backstop).** The bundle escapes `&,"<>` per string then assigns innerHTML —
  a hand-rolled sanitizer in frozen bytes this repo cannot edit. Carried as an
  UPSTREAM item: replace with a text binding in @phlix/ui. Meanwhile the client
  hardened its own boundary: `script-src 'self'` (no 'unsafe-inline') makes any
  future escape regression non-executable inline (tests/unit/cspPolicy.test.ts).
  Re-verified at the v0.99.17 re-pin (2026-11-06): the pattern STILL ships
  (grep `replace(/&/g` → `useItemInspector-*.js` chunk), so the row stands and
  the strict CSP stays load-bearing. The row retires only when a future
  bundle loses the pattern — grep it at every re-pin.
- **Bare token storage keys in the ui auth store (M-TIZEN-23 note).** The
  widget's webdata (now encrypted at rest via config.xml `encryption="enable"`)
  contains the vendored store's UNPREFIXED rows `access_token`, `refresh_token`,
  `user` beside this app's namespaced `phlix.*` keys. Harmless under the
  per-app-id sandbox, but they break the namespace convention every other key
  keeps, and renaming them is a STORE-LEVEL migration only ui can make.
  Carried upstream: prefix (or consolidate) the auth store's storage keys;
  re-verified at the v0.99.17 re-pin (2026-11-06): the bare literals still
  ship in the committed bundle (grep `"access_token"` → `index-*.js` chunk,
  hoisted as `var Zr="access_token"` across the v0.99.15, v0.99.16 and
  v0.99.17 builds — `var Hr=` at v0.99.14;
  the hoist NAME is minifier churn, grep the LITERAL, not a
  `setItem('access_token` spelling, which minification never emits).

## The law

1. **A new local port of a ui-internal surface must be added to the table in
   its landing commit.** No port without a row.
2. **Every `@phlix/ui` re-pin re-verifies every row of this ledger** — check
   each lag item against the new bundle (grep evidence, not memory) and either
   port it, or update its row with the honest reason it stays behind.
3. **When `@phlix/ui` exports a surface this repo has ported, the port must
   retire** in favor of the export (that is the whole point of pinning tags).
   A retired port is deleted, and its ledger row says so with the sha.
