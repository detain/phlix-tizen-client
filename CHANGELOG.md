# Changelog

All notable changes to **phlix-tizen-client** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
