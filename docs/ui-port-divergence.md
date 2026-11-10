# Local ports of sealed `@phlix/ui` surfaces

**What this document is.** The Tizen client renders its app UI from the vendored
`@phlix/ui` bundle, but three behaviors could not ride that bundle because
`@phlix/ui` does not export them (as of the pin at time of writing, v0.99.26).
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

## Mirror-lag list (as of writing — ui `github:detain/phlix-ui#v0.99.26`)

Verified against the vendored bundle in `package/assets/` and the local sources
at this commit, not from memory (rows re-grepped at the 2026-11-10 v0.99.26
re-pin onto the v0.99.26 bytes — four pins crossed since .21: the .22 perf
release (ambient-canvas fps cure), the .23 syncplay-pin erratum cycle
(v0.99.23 landed red-CI riding #v0.1.8; erratum `1a9f5472` reverted the ride —
a truthful orphan, NEVER pin it — and .24 re-cut clean), the .23–.25
feature set (login guidance, anchor music nav, catalog-rails i18n, color-mix
theming, stacked-overlay focus routing, SyncPlay reconnect park ladder),
and the .26 auth wave (cookie token custody seam, 401 single-flight refresh,
pinia peer widening, PageHint root-barrel export — no port-surface moves);
every row re-attested FACT-UNCHANGED at v0.99.26 — the three .25-era
chunk-ATTRIBUTION corrections (invite DTO, hand-rolled escape, picker-literal
dist-side movement) all STAND, with widget-side renames only: 31 of 39 asset
files renaming (the eight byte-stable: episode-order/hls/recommendations/
useMediaItemCache chunks + three fonts + the entry stylesheet
`index-BVpuTFMB.css`, HELD this wave — the .26 payload moves zero CSS),
the player carrier `PlayerPage-Bp-fkb06-*` → `PlayerPage-5onGq7ES-*`
(matching the .26 release register: the Bp-fkb06/BtnPW08u pair ROTATED at
`8852c14a`, ui dist hash `708772c4…`), the widget entry chunk re-anchoring
to `index-BD26Z3-N.js` (this doc's previous cite `index-D1c6SPMk.js` was one
era stale — the RT-106 landing moved it via `index-CEKJyz_J.js`), and the
`playlist_url`/`_master.m3u8` signed-URL cure law re-greps live on the new
carrier bytes):

- **SyncPlay socket hint seam (`wsUrl` / `wsPath`).** The ui gained a
  `socketHint` seam so hosts can point the player's SyncPlay dial at
  a custom URL/path; it SHIPS at the pinned v0.99.25 (re-grepped at the 2026-11-06 v0.99.21 wave → `SyncPlayModal-*.js` + `index-*.js` chunks; at the 2026-11-09 v0.99.25 re-pin the dist graph names it `socketHint-*.js` + `SyncPlayModal-*.js` + the `phlix-ui.js`/`player.js` entries; keys still typed in the bundle's `app/types.d.ts` (`wsUrl?`/`wsPath?`); re-attested at the 2026-11-10 v0.99.26 re-pin — dist names UNCHANGED (`socketHint-C0yqQROO.js` + `SyncPlayModal-hRQmGRs_.js` + both entries present), `wsUrl?`/`wsPath?` still typed in `app/types.d.ts`, and `wsUrl` re-greps 1 site in the widget entry `index-BD26Z3-N.js`. The host-side seam (M-TIZEN-07,
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
  `.map` sourcesContent) purely from bundler map granularity — RE-MEASURED 5 at the v0.99.16 re-pin (2026-11-04), 5 again at the v0.99.17 re-pin, 5 again at the v0.99.19 re-pin, 5 again at the v0.99.20 re-pin and 5 again at the v0.99.21 re-pin (2026-11-06) and 5 again at the v0.99.25
  re-pin (2026-11-09) and 5 again at the v0.99.26 re-pin (2026-11-10) — so re-attest via the shipped
  `(shared — read-only)` picker literal — at v0.99.25 the dist graph emits a
  STANDALONE `MediaCard-*.js` chunk carrying it again, while this widget build
  still folds the literal into the committed `index-*.js` chunk
  (package/assets grep → `index-BD26Z3-N.js`; no standalone `MediaCard-*.js`
  in the widget graph — the .26 re-pin re-greps the literal in exactly one dist
  `MediaCard-*.js` and exactly one widget chunk, gate proven live).
  Row kept as the closed bookend; delete
  it in the next touch that has other business in this file.
- **Invite create-token DTO.** NOT lagged — the two-leg create-token invite
  shape already ships (re-verified at the v0.99.21 re-pin (2026-11-06) — the
  `invite-links` path plus the `invite_link_not_found` /
  `invite_expired_or_exhausted` codes and the `redeem` leg ride the committed
  bundle — `invite-links` greps to the `McpTokensPage-*.js` chunk, the codes
  and `redeem` to `index-*.js`; at the 2026-11-09 v0.99.25 re-pin this
  attribution MOVES (FACT-CHANGED): `invite-links` now greps to the dist
  `hubHelpLinks-*.js` chunk plus entry-inline in `phlix-ui.js`, the two codes
  to `client-*.js` + `player.js`, and `redeem` to `phlix-ui.js` — the
  `McpTokensPage-*.js` chunk still builds but carries none of it (re-attested at the 2026-11-10 v0.99.26 re-pin: attribution UNCHANGED — `invite-links` greps to `hubHelpLinks-BNMhK6oW.js` + `phlix-ui.js`, the codes to `client-CdNyEcUJ.js` + `player.js`, `redeem` to `phlix-ui.js`; in the widget graph `redeem` still rides the entry only); the wording at v0.99.16 additionally listed
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
  construction site first. Re-verified at the v0.99.21 re-pin (2026-11-06): the `MusicLibraryPage-*.js` chunk still builds it (1 site) and `mediaSession`
  still appears only in the video-path `index-*.js` chunk. Re-verified again
  at the 2026-11-09 v0.99.25 re-pin: the construction site is still exactly 1;
  in the dist graph it MOVES to `MusicAlbumCard-*.js` (`MusicLibraryPage-*.js`
  carries 0 hits there — attribution FACT-CHANGED), while the widget build
  still folds it into the committed `MusicLibraryPage-*.js` chunk
  (package/assets grep → 1 site, `MusicLibraryPage-7wf4WY0X-*.js`); re-verified
  again at the 2026-11-10 v0.99.26 re-pin — widget fold now
  `MusicLibraryPage-DyAzEjsj-*.js` (content hash moved: the .26 payload touched
  the music-page bundle; still EXACTLY 1 `new Audio` site) and the dist site
  still `MusicAlbumCard-ujKoQiZr.js` (1), so the
  `package/assets/Music*.js` watch glob stays green; `mediaSession` still
  rides the video path only (dist: `player.js` + `usePlayerStore-*.js`;
  widget: entry) — observer posture unchanged, watch pin green.
- **Vendored `MetadataMatchModal` hand-rolled innerHTML escape (M-TIZEN-22
  backstop).** The bundle escapes `&,"<>` per string then assigns innerHTML —
  a hand-rolled sanitizer in frozen bytes this repo cannot edit. Carried as an
  UPSTREAM item: replace with a text binding in @phlix/ui. Meanwhile the client
  hardened its own boundary: `script-src 'self'` (no 'unsafe-inline') makes any
  future escape regression non-executable inline (tests/unit/cspPolicy.test.ts). Re-verified at the v0.99.21 re-pin (2026-11-06): the pattern STILL ships
  (grep `replace(/&/g` → `useItemInspector-*.js` chunk); re-verified again at
  the 2026-11-09 v0.99.25 re-pin it STILL ships — at .25 dist the pattern
  greps to `MetadataMatchModal-*.js` + `LogsPage-*.js` (the .21-era
  `useItemInspector-*.js` dist attribution is FACT-CHANGED by bundler
  regrouping) while the committed widget bytes still ride
  `useItemInspector-CC5nNuXm-*.js`; re-verified again at the 2026-11-10
  v0.99.26 re-pin — dist attribution UNCHANGED (`MetadataMatchModal-p3cAYdBc.js`
  + `LogsPage-BeadsInZ.js` carry the pattern) and the widget bytes still ride
  `useItemInspector-CC5nNuXm-DoFVbEpT.js` (content hash HELD through the .26
  re-vendor; only its import-reference suffix rotated) — so the row stands and the strict CSP
  stays load-bearing. The row retires only when a future
  bundle loses the pattern — grep it at every re-pin.
- **Bare token storage keys in the ui auth store (M-TIZEN-23 note).** The
  widget's webdata (now encrypted at rest via config.xml `encryption="enable"`)
  contains the vendored store's UNPREFIXED rows `access_token`, `refresh_token`,
  `user` beside this app's namespaced `phlix.*` keys. Harmless under the
  per-app-id sandbox, but they break the namespace convention every other key
  keeps, and renaming them is a STORE-LEVEL migration only ui can make.
  Carried upstream: prefix (or consolidate) the auth store's storage keys;
  re-verified at the v0.99.21 re-pin (2026-11-06): the bare literals still ship in the committed bundle (grep `"access_token"` → `index-*.js` chunk,
  hoisted as `var Xr="access_token"` at the v0.99.21 build — `var Zr=` across the v0.99.15, v0.99.16, v0.99.17, v0.99.19 and v0.99.20 builds — `var Hr=` at v0.99.14; re-verified again at the
  2026-11-09 v0.99.25 re-pin the bare literals STILL ship: the widget bytes
  hoist `var Pi="access_token"` in the committed `index-*.js` chunk, and the
  .25 dist graph carries `var M = "access_token"` (`client-*.js`) plus
  `var yt = "access_token"` (`player.js`); re-verified again at the 2026-11-10
  v0.99.26 re-pin the bare literals STILL ship: the widget bytes hoist
  `var Ni="access_token"` in the committed `index-*.js` chunk (the .25-era `Pi`
  name rotated with the minifier), and the .26 dist graph carries
  `var k = "access_token"` (`client-*.js`) plus `var vt = "access_token"`
  (`player.js`);
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
