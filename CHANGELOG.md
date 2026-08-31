# Changelog

All notable changes to **phlix-tizen-client** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
