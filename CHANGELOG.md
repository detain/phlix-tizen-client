# Changelog

All notable changes to **phlix-tizen-client** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed — W37 (cs22): route-manifest provenance re-pin (no route change) — 2026-09-06

- **cs#22 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `876d0ea` (regen against
  server master `e4853f0f`; previous provenance `341fc6e2`/`e729d48a` — the
  cs#21 leg, zero route hunks). All 400 tuples byte-identical — only
  provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: serverSha `e729d48a` → `e4853f0f`,
  vendored md5 `7accd31d` → `791235d4`, and the docblock regen cite moves to
  server `e4853f0f` / contracts `876d0ea`. The three 400-count pins and the
  gate id stay; the `#v0.4.6` install pin stays (untagged wave, no grants).
  Suite 312/20 exact.

### Changed — W37 (cs21): route-manifest provenance re-pin (no route change) — 2026-09-06

- **cs#21 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `341fc6e2` (regen against
  server master `e729d48a`; previous provenance `f2e284b3`/`f35a5742` — the
  cs#20 re-tag leg, zero route hunks). All 400 tuples byte-identical — only
  provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: serverSha `f35a5742` → `e729d48a`,
  vendored md5 `05db9e75` → `7accd31d`, and the docblock regen cite moves to
  server `e729d48a` / contracts `341fc6e2`. The three 400-count pins and the
  gate id stay; the `#v0.4.6` install pin stays (untagged wave, no grants).
  Suite 312/20 exact.

### Changed — W34 (cs20retag): ui re-tag to v0.99.1 + route-manifest provenance re-pin — 2026-09-05

- **Combined re-tag + cs#20 currency, two facts, one PR.** (1) `package.json`
  re-tags `@phlix/ui` `github:detain/phlix-ui#v0.99.0` → `#v0.99.1` (the
  released v0.99.1 tree; this repo commits no package-lock, as ever). (2)
  `tests/fixtures/server-route-manifest.json` re-vendored verbatim from
  `@phlix/contracts` master `f2e284b3` (regen against server master
  `f35a5742`; previous provenance `2250def2`/`3a253991` — the web-ui ui-tarball
  re-pin, zero route hunks). All 400 tuples byte-identical — only provenance
  moves. The gate pins follow in `tests/unit/routeManifest.gate.test.ts`:
  serverSha `3a253991` → `f35a5742`, vendored md5 `5bc7dd6d` → `05db9e75`, and
  the docblock regen cites move to server `f35a5742` / contracts `f2e284b3`.
  The three 400-count pins and the gate id stay; the contracts install pin
  stays (no grants). Fresh `npm install`; suite 312/20 exact.


### Changed — W33 (cs19): route-manifest provenance re-pin (no route change) — 2026-09-05

- **cs#19 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `2250def2` (regen
  against server master `3a253991`; previous provenance `e74cdc88` — S431
  executable census, one commit, no route hunks). All 400 tuples byte-identical
  — only provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: vendored md5 `9f69628d` →
  `5bc7dd6d`, serverSha `e74cdc88` → `3a253991`, and the contracts regen cite
  `51ed6cd3` → `2250def2`. No issued-URL or coverage pin moved; the `#v0.4.6`
  install pin stays (untagged wave, no grants).

### Changed — W31 (cs18): route-manifest provenance re-pin (no route change) — 2026-09-05

- **cs#18 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `51ed6cd3` (regen
  against server master `e74cdc88`; previous provenance `4b620f59`). All 400
  tuples byte-identical — only provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: vendored md5 `81eeef82` →
  `9f69628d`, serverSha `4b620f59` → `e74cdc88`, and the contracts regen cite
  `55311c6` → `51ed6cd3`. No issued-URL or coverage pin moved; the `#v0.4.6`
  install pin stays (un-tagged wave).

### Changed — W29 (cs17): route-manifest provenance re-pin (no route change) — 2026-09-04

- **cs#17 currency cascade.** `tests/fixtures/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `55311c68` (regen
  against server master `4b620f59`; previous provenance `888a42b2`). All 400
  tuples byte-identical — only provenance moves. The gate pins follow in
  `tests/unit/routeManifest.gate.test.ts`: vendored md5 `9727f2d3` →
  `81eeef82`, serverSha `888a42b2` → `4b620f59`, and the contracts regen cite
  `c7125362` → `55311c68`. No issued-URL or coverage pin moved.

### Added — client route gate (S280)

- **Vendored the canonical `@phlix/contracts` server route manifest** at
  `tests/fixtures/server-route-manifest.json` — 400 route tuples with the
  provenance server sha pinned inside the artifact, byte-identical to the
  mobile/roku copies (md5 `cca4660dda7876fba840f9d108ad7c18`). Vendoring is the
  sanctioned interim pattern until the next contracts tag ships the export: the
  v0.4.4 tag predates it and its exports map blocks JSON subpaths, so no
  npm-pin/import is possible yet.
- **New vitest gate `tests/unit/routeManifest.gate.test.ts`** — every
  server-addressed request URL in `src/` must be tuple-exact against the
  manifest: 23 request sites / 19 distinct `(method, path)` tuples across 9
  modules, pinned per-file. The hub-addressed `src/api/hubRelay.ts` is excluded
  and its exclusion is negative-pinned; a scanner-blindness sweep pins every
  `/api/v1` code occurrence 1:1. A planted unserved URL was demonstrated RED
  before removal.
- **New `tests/unit/RouteWireShape.test.ts`** pins both corrected response
  envelopes fixed below (5 tests). Suite now stands at 289 vitest tests passing
  (17 files).

### Fixed — two never-registered rails, the route gate's first catches (S280, S279-class)

- **`AudioTracksPage` fallback called `GET /api/v1/media/{id}/audio-tracks`** —
  a route phlix-server never registered, so the fallback always failed and the
  track list rendered empty. Now reads `audio_tracks` from the registered
  `GET /api/v1/media/{id}/playback-info` — the same rail `@phlix/ui`'s player
  uses.
- **`UpNextOverlay` called `GET /api/v1/media/{id}/playlist`** — also never
  registered, so the overlay silently never showed. Now reads the head of
  `GET /api/v1/users/me/next-up` (`{items:[…]}`), skipping a self-entry —
  mirroring the roku client's next-up handling.

### Changed

- **`@phlix/contracts` pinned to v0.4.4 (S325 consumer bump).** v0.4.4 carries the canonical snake_case parental-controls wire shape (S234) and admits `dash_url` on the transcode shapes the server emits (S325).

### Fixed

- **ParentalControlsPage read camelCase fields that the wire never carried (S325b).** The page rendered `schedule.startTime` / `endTime` / `daysOfWeek` / `isActive` and filtered `t.tagType`, but the server emits `start_time` / `end_time` / `days_of_week` / `is_active` / `tag_type` (`AccessSchedule::toArray()` / `ProfileTag::toArray()`); `@phlix/contracts` v0.4.3's camelCase declaration was a lie that let those reads compile to `undefined` — blank times, a never-showing Inactive badge, and an always-empty blocked-tags list. All reads and the tag-create POST body now use the wire spelling, pinned by `tests/unit/ParentalControlsWireShape.test.ts` (renders the real times/badge, filters on `tag_type`, sends the canonical body). This is the same defect family S234 closed on mobile/roku — tizen shipped through it because it was the remaining camel-declaring consumer.


### Added — hub-relay `pending_command` consumer (S298, tizen half)

- **New `src/api/hubRelay.ts`** — the Tizen consumer for the hub's SyncPlay
  relay (`ws(s)://<hub>:8804/syncplay/{server_id}`), the ONLY surface that can
  receive "Alexa, play X" (S93's `pending_command` / `play_media` frame).
  The token travels in the `Sec-WebSocket-Protocol: bearer, <token>`
  subprotocol (the only carrier a Tizen webview WebSocket can present; S237
  refuses query-string tokens by design) and the relay echoes it back (S355).
  Relay tokens are minted from the hub's S2a endpoint
  (`POST /api/v1/me/servers/{server_id}/relay-token`) by a cached,
  single-flighted provider that re-mints on expiry and re-asks on a bounded
  5-rung reconnect ladder while a mint is in flight.
- **Open-whenever lifecycle** — the consumer socket opens at boot whenever a
  hub context resolves (hub URL, hub server UUID, hub access token — persisted
  `phlix.hubUrl` / `phlix.hubServerId` / `phlix.hubAccessToken` slots or the
  `VITE_PHLIX_HUB_URL` / `VITE_PHLIX_HUB_SERVER_ID` build env), independent of
  any SyncPlay room join. Without a hub session nothing opens — the honest
  "no open app" state, mirroring the roku client's direct mode.
- **`useSyncPlayStore` S298 surface** — `pendingPlayMedia` slot +
  `applyPendingPlayMedia` / `consumePendingPlayMedia`; the wire's
  `current_media_id` is carried into the local session (`currentMediaId`, the
  paired caller writes it on every adopted command).
- **New `src/syncplayDispatch.ts`** — the load-a-new-title dispatch point:
  watches the store's pending slot, resolves the bare media id through the
  app's `ApiClient` (`GET /api/v1/media/{id}`), loads it via the shared
  `@phlix/ui` player (`setCurrent` + `play`), consumes the slot, and drops
  stale resolutions when a newer command replaced the one in flight.
  Unresolved commands stay in the store slot (the refusal path keeps working).

### Changed — SyncPlay migration to @phlix/contracts v0.4.3 + @phlix/ui v0.99.0

- **`@phlix/ui` bumped to `v0.99.0`, `@phlix/contracts` to `v0.4.3`** (from
  `v0.98.33` / `v0.3.12`) as part of the tag cascade.
- **`useSyncPlayStore` migrated to the v0.4.3/v0.99.0 SyncPlay API**:
  `SyncPlayRoom` → `SyncPlayGroup` and camelCase → snake_case field renames
  (`currentSession` → `current_media_id`, `issuedBy` → `issued_by`);
  the REST client now uses the five `/api/v1/syncplay/groups` routes
  (list/create/get/join/leave — there is no `/rooms`, `/members` or command
  route); `joinRoom` returns `{room, session}`; playback commands are sent as
  `@phlix/syncplay` WebSocket frames (the REST `sendCommand` was removed in
  v0.99.0); positions are converted seconds → milliseconds at the send
  boundary per phlix-syncplay SPEC.md:91, and listing rows keep their
  `current_media` value instead of dropping it to `null`.

### Added — in-player quality selection via the remote (G1)

- **`@phlix/ui` bumped to `v0.74.0`, `@phlix/contracts` to `v0.2.0`** (from
  `v0.55.0` / `v0.1.1`), pulling in `@phlix/ui`'s `QualityMenu` (the on-screen
  stream-quality picker rendered in the player's control bar as a `Select`
  combobox, shown whenever there are ≥2 switchable hls.js ABR rungs).
- **Yellow color button opens/toggles the quality picker** on the player route
  when a multi-variant transcode is playing (no-op for direct-play / single-
  quality streams, where the menu never renders). Once open, the D-pad
  Left/Right/Up/Down and Enter drive the on-screen `Select` exactly as they
  would on a mouse/keyboard — Enter confirms the highlighted rung, Left/Right/
  Up/Down move the highlight.
- **Back dismisses the picker first**, without closing the player underneath;
  a second Yellow press also dismisses it.
- Internally, a new `RemoteManager.suppressPropagation` hook stops the D-pad
  Arrow keydowns from *also* reaching the player's own seek/volume Arrow
  shortcuts while the picker is focused — otherwise the two handlers would
  fight over every Arrow press. All quality-mode flag clearance is routed
  through a single choke point (`close()` in `tizenBridge.ts`) so the flag can
  never get stuck true and permanently freeze D-pad navigation: a
  `MutationObserver` on the picker's `aria-expanded` attribute catches the
  picker closing itself (rung selected, Escape, outside interaction), and a
  `router.afterEach` guard catches the player/route being torn down out from
  under an open picker (Home, or any other route change) with no such DOM
  transition to observe.
- No contracts-side (payload) changes — this repo consumes only
  `buildPhlixHeaders` from `@phlix/contracts`; the version bump is for
  consistency with the rest of the Stream-Quality/ABR client fleet.

### Changed — S404 track-shape alignment (contracts pin + honest track types)

- **`@phlix/contracts` pinned to v0.4.5 (S404 consumer bump).** v0.4.5 corrects
  the playback.ts `AudioTrack`/`SubtitleTrack` pair to the REAL
  `StreamTrackShaper` wire emission (the pre-fix `display_title` pair was a
  fiction the server never emitted; verified at server `01340633`) and exports
  ordered key-list consts for parity gating.
- **`AudioTrackList.vue` / `AudioTracksPage.vue` re-typed to the wire
  `AudioTrack`.** The page's hand-map into the `StreamAudioTrack` DB mirror
  silently DISCARDED `index`/`stream_index`/`default` (and dropped null
  `bitrate`/`title`); the wire type needs no mapping, so the rows now pass
  through untouched — the S280 test that pinned the discard was rewritten to
  pin the pass-through (same rail, same URL assertion).
- **`SubtitleTrackList.vue` reads only wire keys.** The title line moved from
  `track.title` (never emitted on the subtitle wire) to the server-derived
  `track.label` (shown only when it says more than the language); the
  `Forced`/`Default` badges — backed by `isForced`/`isDefault`, keys the
  subtitle wire never carries (there is no forced/default concept for
  subtitles) — were replaced by the honest single `SDH` badge for the emitted
  `hearing_impaired` flag. The component is still unconsumed in `src/` (wiring
  it is S407); only its types/reads were made honest.
- **Tests**: `SubtitleTrackList.test.ts` rewritten HONESTLY to full nine-key
  wire fixtures (not deleted); new `TrackWireShape.test.ts` asserts golden
  server-captured rows against the INSTALLED package's exported key consts
  (5 tests). Suite 289 → 295 vitest tests (18 files); `routeManifest.gate`
  untouched-green; vue-tsc/lint/build clean.
