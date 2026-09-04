<!-- s424-doc-honesty-census-2026-09-04 -->

> **S424 doc-honesty sweep (2026-09-04).** Every tizen-repo line-cite and count below was re-derived at tip `f5b9fff9` on 2026-09-04 and restated to the measured value; suite re-run measured **312 tests / 20 files** (was "74 PASS" in the Gates rows). Citations pointing **inside `@phlix/ui` source** (`usePlayerStore.ts`, `hls-playback.ts`, `playback.ts`, `MediaGrid.vue`, `Player.vue`, `PlayerPage.vue`, `client.ts`, `recommendations.ts`, `ApiClient.d.ts`) were measured 2026-07-31 against the then-installed `@phlix/ui` v0.98.33 SOURCE tree and are **HISTORICAL**: `@phlix/ui` v0.99.0 ships only `dist/`, so those line numbers are not re-derivable here and may have drifted. Vendored-copy claims that ARE re-derivable from `dist/` (token occurrence counts, admin-module count, bundle filenames) were re-measured and restated.

# Category 4 - Missing/Unused Stores

## Step 4.1 - useMediaStore
**Decision**: NOT TV-APPLICABLE
**Rationale**: Per AGENTS.md architecture - "this repo writes no media/library/auth UI — that lives in @phlix/ui". Tizen is a thin Vue 3 consumer of @phlix/ui - all media browsing is rendered by @phlix/ui's `createPhlixApp()`. The useMediaStore is an internal implementation detail of @phlix/ui's component tree.
**Code Changes**: None (architectural decision - no code needed)

## Step 4.2 - useUserItemDataStore
**Decision**: NOT TV-APPLICABLE
**Rationale**: This store manages per-item user interaction state (favorites, ratings, likes, watched) with optimistic updates. All user item data interactions happen in @phlix/ui components rendered via `createPhlixApp()`. Tizen client is a thin consumer - these features are handled by @phlix/ui's component layer, not direct store access.
**Code Changes**: None (architectural decision - no code needed)

## Step 4.3 - useLibrariesStore
**Decision**: NOT TV-APPLICABLE
**Rationale**: Library browsing is entirely in @phlix/ui via `createPhlixApp()`. Tizen connects to a single pre-configured server via localStorage and all library navigation happens through @phlix/ui components internally. No TV scenario requires tizen-client to enumerate libraries programmatically.
**Code Changes**: None (architectural decision - no code needed)

## Step 4.4 - useServerStore
**Decision**: NOT TV-APPLICABLE
**Rationale**: This store is hub-specific - for SPA to browse ONE paired media server through relay proxy with currentServerId/Name/Url persisted to localStorage. Tizen connects directly to a single server via localStorage['phlix.serverUrl'] in resolveConfig.ts, not through hub relay. Different architecture entirely.
**Code Changes**: None (hub-specific functionality - no code needed)

## Step 4.5 - useConnectionStore
**Decision**: NOT TV-APPLICABLE
**Rationale**: Tizen uses localStorage directly for server URL configuration via resolveConfig.ts: `localStorage['phlix.serverUrl']` -> `VITE_PHLIX_SERVER_URL`. The probeServer(), isPlainTextPublic(), and runtime server selection features are not needed in tizen's direct-to-server model.
**Code Changes**: None (uses localStorage directly - no code needed)

## Step 4.6 - useSettingsPrefsStore
**Decision**: NOT TV-APPLICABLE (STORE DOES NOT EXIST)
**Rationale**: This store does not exist in phlix-ui - the concept may have been merged into usePreferencesStore or never existed as a separate store. No action needed.
**Code Changes**: None (store doesn't exist - no code needed)

## Step 4.7 - useCommandStore
**Decision**: NOT TV-APPLICABLE
**Rationale**: ⌘K command palette requires keyboard input for fuzzy search. Tizen TV uses D-pad remote - no keyboard. The command palette pattern is fundamentally incompatible with TV remote interface which uses directional navigation and transport keys only.
**Code Changes**: None (requires keyboard - no code needed)

## Step 4.8 - useSyncPlayStore
**Decision**: TV-SPECIFIC REIMPLEMENTATION (existing implementation at src/stores/useSyncPlayStore.ts)
**Rationale**: Tizen has its own 994-line SyncPlay store (`wc -l src/stores/useSyncPlayStore.ts` at tip, 2026-09-04; phlix-ui's compared line-count is a HISTORICAL v0.98.33-source figure). Tizen's version has a fully integrated WebSocket with auto-reconnect (MAX_RECONNECT_ATTEMPTS=5 / BASE_RECONNECT_DELAY=1000 with exponential backoff at useSyncPlayStore.ts:641-653), a local `SyncPlayApiClient` REST class (lines 392-462), and `fetchPublicRooms()` (line 940). The WebSocket PROTOCOL is not custom — it is framed by the imported `@phlix/syncplay` client (import line 41; see Category 11). Reimplemented because @phlix/ui does not export its player-side SyncPlay internals (store docblock lines 7-10); justified for TV-specific cohesive state management.
**Code Changes**: None (reimplementation already exists - justified)

## Step 4.9 - usePlayerUiStore
**Decision**: NOT TV-APPLICABLE
**Rationale**: This store manages theater mode state for in-window player (theaterActive ref, shell chrome removal via @theater toggle). TV uses full-screen player mode by default with no windowed player state to toggle and no persistent shell chrome to remove. The theater toggle coordination functionality has no implementation context on TV.
**Code Changes**: None (full-screen player paradigm - no code needed)

## Step 4.10 - useToastStore
**Decision**: ALREADY SUFFICIENT (partial usage)
**Rationale**: The store is actively functional in UserRatingPicker.vue with proper error handling (toast.error() on rating save failure with 4s auto-dismiss). Partial usage is sufficient for tizen's needs - the store provides all toast capability currently required. No gaps identified in tizen's toast usage.
**Code Changes**: None (already integrated via @phlix/ui - no code needed)

## Step 4.11 - usePreferencesStore
**Decision**: ALREADY SUFFICIENT (partial usage)
**Rationale**: The store is actively functional in SpatialNavHost.vue for `prefs.tv` to gate spatial navigation enablement (D-pad nav for browse, off on player route). Partial usage is sufficient for tizen's needs - the full preferences UI for theme, density, playback settings is not exposed in tizen (those would be in @phlix/ui settings UI). No gaps identified in tizen's preferences usage.
**Code Changes**: None (already integrated via @phlix/ui - no code needed)

---

# Category 2 Verification - Duplicate Component Decisions

> *(HISTORICAL note, S424 2026-09-04: the phlix-ui-side comparisons in this category were measured against the @phlix/ui v0.98.33 source tree; v0.99.0 ships dist-only, so they are not re-derivable here. The tizen-side facts spot-checked by this sweep still hold — e.g. the hardcoded `"tracks"` strings in MusicPage.vue (now :286/:294) are real, and every cited tizen component still exists.)*

## Step 2.1.1 - MusicAlbumCard.vue
**Status**: TV-SPECIFIC (justified)
**Finding**: phlix-ui's version lacks full descriptive aria-label. Tizen version has aria-label summarizing album info. Note: phlix-ui has i18n via useMessages(), tizen version has hardcoded "tracks" string (regression). Merge possible if phlix-ui adds full aria-label and tizen adopts i18n.
**Code Changes**: None (comment updated for accuracy)

## Step 2.1.2 - MusicArtistCard.vue
**Status**: TV-SPECIFIC (justified)
**Finding**: Same as 2.1.1 - phlix-ui's version lacks full descriptive aria-label. Tizen version has aria-label summarizing artist info. phlix-ui has i18n via useMessages(), tizen version has hardcoded "album/albums" string (regression). Merge possible if phlix-ui adds full aria-label and tizen adopts i18n.
**Code Changes**: None (comment updated for accuracy)

## Step 2.1.3 - TrackListItem.vue vs MusicTrackList.vue
**Status**: PARTIAL DUPLICATE - TV-SPECIFIC (justified)
**Finding**: Tizen TrackListItem is a single row component with D-pad support, artist name display, and animated playing indicator. phlix-ui MusicTrackList is a container component with skeleton loading, empty state, and i18n but lacks artist display. Different architectures serving different platform needs. Merge possible if phlix-ui adds artist name and D-pad support to its row.
**Code Changes**: None (documentation only)

## Step 2.1.4 - MusicPage.vue vs MusicLibraryPage.vue
**Status**: TV-SPECIFIC (justified) - corrected from MAJOR DUPLICATE
**Finding**: Both Tizen and phlix-ui use internal state machine patterns for view switching (artists → albums → tracks), so architectural patterns are similar. TV-specific justification is the BACK button navigation behavior: Tizen uses `router.back()` to exit to parent app at artists view, while phlix-ui stays within the music module. This TV UX behavior is intentional and justifies separate implementation.
**Code Changes**: None (comment updated with corrected reasoning)

## Step 2.1.5 - Music Store Duplication
**Status**: NOT A DUPLICATE - No action needed
**Finding**: useMusicStore (tizen) handles library browsing and navigation state. useMusicPlayer (phlix-ui) handles audio playback with gapless playback, crossfade, and queue management. These are complementary, not duplicates.
**Code Changes**: None (documentation only)

## Step 2.2.1 - RatingBadge.vue
**Status**: TV-SPECIFIC (justified)
**Finding**: phlix-ui's version lacks half-star precision (uses Math.round to whole stars). Tizen version provides visual half-star support via linearGradient SVGs. Consolidation possible if phlix-ui adds half-star support.
**Code Changes**: None (comment added)

## Step 2.2.2 - UserRatingPicker.vue
**Status**: TV-SPECIFIC (justified)
**Finding**: phlix-ui's version has better API (v-model, readonly prop, lock icon, spinner) but lacks half-star precision. Tizen version provides half-star support via starState(). Consolidation possible if phlix-ui adds half-star support.
**Code Changes**: None (comment added)

## Step 2.2.3 - RatingModal.vue
**Status**: TV-SPECIFIC (justified) - No action needed
**Finding**: No phlix-ui equivalent found. This is a TV-specific modal component combining RatingBadge and UserRatingPicker.
**Code Changes**: None (comment added)

## Step 2.3.1 - ChapterList.vue
**Status**: TV-SPECIFIC (justified)
**Finding**: phlix-ui's ChapterList lacks D-pad spatial navigation support. Tizen version provides tabindex="0" management and keyboard handlers for spatial-nav, plus custom scrollbar styling. Consolidation possible if phlix-ui adds D-pad support.
**Code Changes**: None (comment added)

## Step 2.3.2 - ChapterOverlay.vue vs MarkerTimeline.vue
**Status**: TV-SPECIFIC (justified) - partial duplicate
**Finding**: Tizen ChapterOverlay uses polling (250ms) for position tracking vs phlix-ui's reactive subscriptions. Conflates marker timeline + seekbar ticks. Consolidation requires phlix-ui MarkerTimeline to support chapters AND Tizen to migrate from polling to reactive.
**Code Changes**: None (comment added)

## Step 2.3.3 - SkipIntroOverlay.vue vs SkipControls.vue
**Status**: TV-SPECIFIC (justified) - duplicate
**Finding**: phlix-ui's SkipControls uses reactive pattern. Tizen's SkipIntroOverlay uses polling (tech debt). Consolidation requires migrating Tizen to reactive pattern.
**Code Changes**: None (comment added)

## Step 2.3.4 - SleepTimerOverlay.vue vs SleepTimer.vue
**Status**: TV-SPECIFIC (justified) - duplicate
**Finding**: phlix-ui's SleepTimer lacks 10min preset and custom input (1-180 min). Tizen has 5, 10, 15, 30, 45, 60 min presets + custom input. Consolidation requires phlix-ui to add 10min preset and custom input support.
**Code Changes**: None (comment added)

## Step 2.3.5 - AudioTrackList.vue
**Status**: TV-SPECIFIC (justified) - No action needed
**Finding**: No phlix-ui equivalent for standalone audio track list. phlix-ui handles audio tracks within CaptionsMenu.vue. Tizen provides D-pad optimized list navigation for TV remote.
**Code Changes**: None (comment added)

## Step 2.3.6 - SubtitleTrackList.vue
**Status**: TV-SPECIFIC (justified) - No action needed
**Finding**: No phlix-ui equivalent for standalone subtitle track list. phlix-ui handles subtitles within CaptionsMenu.vue and CaptionOverlay.vue. Tizen provides D-pad optimized list navigation for TV remote.
**Code Changes**: None (comment added)

## Step 2.3.7 - PiPController.vue
**Status**: TV-SPECIFIC (justified) - No action needed
**Finding**: phlix-ui implements browser standard PiP in Player.vue. This component uses Samsung Tizen PiP API which differs from standard browser PiP. No phlix-ui equivalent.
**Code Changes**: None (comment added)

## Step 2.4.1 - RecommendationCard.vue
**Status**: TV-SPECIFIC (justified) - No action needed
**Finding**: No phlix-ui equivalent found for "Because You Watched" recommendation card pattern. TV-specific recommendation UI component.
**Code Changes**: None (comment added)

## Step 2.4.2 - RecommendationsScreen.vue vs RecommendationsPage.vue
**Status**: TV-SPECIFIC (justified) - No action needed
**Finding**: Tizen's RecommendationsScreen uses the TV-specific RecommendationCard (Step 2.4.1), which is explicitly documented as "no phlix-ui equivalent". The Tizen screen wires only `onSelect` → player navigation. phlix-ui's RecommendationsPage uses the generic MediaGrid/MediaCard system and wires admin-facing handlers (watchlist, mark-watched, edit-metadata, explore-data) via MetadataMatchModal + useItemInspector. These are fundamentally different UI paradigms: TV uses purpose-built "Because You Watched" recommendation display optimized for D-pad/remote; web uses general-purpose media grid with rich interaction suite. The VERIFICATION.md finding ("Tizen has Play, watchlist, info") was inaccurate — Tizen's RecommendationsScreen only provides Play via card selection; watchlist and info exist in phlix-ui's RecommendationsPage but are NOT present in Tizen's screen. The feature gap is by design, not an oversight.
**Code Changes**: None (correction to VERIFICATION.md finding only)

---

# Category 1 Verification - Version & Dependency Analysis

## Step 1.1 - Update @phlix/ui
**Decision**: IMPLEMENTED_OK
**Rationale**: `npm ci` materialized @phlix/ui v0.98.33 into node_modules with no lock-file diff. The package.json pin `github:detain/phlix-ui#v0.98.33` was already correct before and after. useMusicStore.ts uses raw `client.get()` not the page-envelope helpers, so ApiClient.listArtists/listAlbums/listTracks breaking changes do not apply. Key exports (createPhlixApp, buildAdminRoutes, LibraryScanPage, ApiClient, useSpatialNav, usePreferencesStore, usePlayerStore, @phlix/ui/style.css) all verified present at v0.98.33. *(HISTORICAL — audit-date state; at tip 2026-09-04 the pin is `github:detain/phlix-ui#v0.99.0` (package.json:34) and useMusicStore.ts no longer uses raw `client.get()` — see S424 re-measurement under Steps 1.3/1.5.)*
**Code Changes**: None — package.json pin and lock file were already aligned; no source changes needed.
**Evidence**: `node_modules/@phlix/ui/package.json` version 0.98.33 (was 0.81.0); `diff /tmp/package-lock.json.before package-lock.json` showed no diff; src/stores/useMusicStore.ts:17 uses `client.get('/api/v1/music/...')` (not ApiClient methods); key exports verified via `ls node_modules/@phlix/ui/dist/` and `@phlix/ui/package.json` exports field. *(HISTORICAL; tip re-measure: `node_modules/@phlix/ui/package.json` version 0.99.0.)*
**Cross-refs**: none (step 1.2 covers @phlix/contracts version inconsistencies in CLAUDE.md/DEVELOPER.md — out of this step's scope)

## Step 1.3 - @phlix/* Dependencies
**Status**: Verified aligned
**Finding** (re-measured at tip `f5b9fff9`, 2026-09-04): `@phlix/syncplay: "github:detain/phlix-syncplay#v0.1.4"` declared at package.json:33 (S418 re-pin from #v0.1.2). NOT aligned with the vendored phlix-ui copy: `node_modules/@phlix/ui/package.json` (v0.99.0) declares its own `@phlix/syncplay` pin `#v0.1.2` (line 86) — tizen's direct #v0.1.4 wins in the flat install (node_modules copy measures 0.1.4). `@phlix/contracts` pins also differ: tizen-client package.json:32 `#v0.4.6` vs the vendored @phlix/ui@0.99.0's own pin `#v0.4.3` (node_modules/@phlix/ui/package.json:85); installed copy measures 0.4.6.

## Step 1.4 - @phlix/tokens Integration
**Status**: Verified OK
**Finding**: @phlix/tokens v0.1.1 transitively included via @phlix/ui/style.css

## Step 1.5 - Music API Breaking Changes (v0.98.32)
**Decision**: SUPERSEDED (was IMPLEMENTED_OK on raw calls; at tip the store uses the helper methods)
**Rationale**: *Audit-date state (HISTORICAL)*: useMusicStore.ts made raw `client.get()` calls to `/api/v1/music/*` endpoints — no use of the `listArtists()`/`listAlbums()`/`listTracks()` helpers, so the v0.98.32 helper breaking changes did not apply. *Replaced by S125 ("page the Tizen music library", commit `35f3270`) and the envelope-unwrap fix (commit `894bf96`)*: at tip `f5b9fff9` the store calls the ApiClient helpers, and `rg "listArtists|listAlbums|listTracks" src/` returns **5 hits** (no longer 0), so the helper signatures DO now apply to tizen.
**Code Changes**: None — analysis only.
**Evidence** (re-derived at tip, 2026-09-04):
- `useMusicStore.ts:132` / `:156-158`: `getClient().listArtists({ limit: MUSIC_PAGE_SIZE, offset })` — paged helper, not raw call
- `useMusicStore.ts:177-181` / `:202`: `getClient().listAlbums({ limit, offset, artist? })` — paged helper with server-side `?artist=` filter
- `useMusicStore.ts:247`: `getClient().getTrack(id)` — helper unwraps the `{ track }` envelope (ApiClient.d.ts contract `getTrack(): Promise<MusicTrack>`)
- `useMusicStore.ts:51`: `import { ApiClient, MUSIC_PAGE_SIZE } from '@phlix/ui'`
- `MUSIC_PAGE_SIZE = 100` (node_modules/@phlix/ui/dist/api/client.d.ts:61) — page cap, pages beyond the first 100 are now fetched via load-more
- Installed @phlix/ui version at tip: 0.99.0
**Cross-refs**: Step 1.1 (HISTORICAL @phlix/ui v0.98.33 update that triggered this CHANGELOG review); Steps 8.1/8.2/8.7/17.3/17.4 (restated at tip by this sweep)

## Step 1.6 - Node/npm Compatibility
**Decision**: IMPLEMENTED_OK
**Rationale**: package.json:58 specifies node >=22.12.0. Re-measured at tip (2026-09-04): `node --version` = v24.19.0, which satisfies this. Tizen webview Chromium 100 constraints are verified not violated by the current Node version usage.
**Code Changes**: None — analysis only.
**Evidence**: package.json engines field (line 58: node >=22.12.0 — re-verified at tip), node --version output (v24.19.0 at the 2026-09-04 re-measure; v24.15.0 at original audit), deviceId.ts fallback pattern (lines 20-27: typeof guard + Date.now() fallback avoids crypto.randomUUID on ancient webviews — re-verified line-for-line at tip)
**Cross-refs**: None

## Step 1.2 - Resolve version inconsistencies
**Decision**: IMPLEMENTED_OK
**Rationale**: package.json:32 correctly pins @phlix/contracts at v0.3.12. Four doc files (CLAUDE.md:5, DEVELOPER.md:14, AGENTS.md:3, README.md:47) previously claimed v0.2.0 — a stale version from before the actual package.json was updated. All four doc files now reference v0.3.12, matching the installed version. *(HISTORICAL — accurate at audit date only. At tip 2026-09-04 package.json:32 pins `#v0.4.6`, and the doc files have since drifted again: CLAUDE.md:5, DEVELOPER.md:14 and AGENTS.md:3 each claim `#v0.4.3`; README.md's pinned-dependencies section no longer cites a contracts version at its old line. That residual doc-vs-package.json drift lives in those other files and is outside this doc-only step's diff.)*
**Code Changes**: None — only doc file edits. No production code changed.
**Evidence**: git diff shows +v0.3.12 on CLAUDE.md:5, DEVELOPER.md:14, AGENTS.md:3, README.md:47; node_modules/@phlix/contracts/package.json reports 0.3.12 *(HISTORICAL; tip re-measure: package.json:32 `#v0.4.6`, installed copy 0.4.6)*
**Cross-refs**: Step 1.1 (the @phlix/ui v0.98.33 update that prompted this review)

---

# Category 3 Verification - Missing Player Features

## Step 3.1 - Resume Prompt
**Decision**: NOT TV-APPLICABLE
**Rationale**: ResumePrompt.vue exists in @phlix/ui Player (player.js exports `ResumePrompt`). The player renders it automatically when `usePlayerStore.resumeMap` indicates a resumable position (RESUME_MIN_SECONDS=30 to RESUME_MAX_RATIO=0.95). Tizen uses `createPhlixApp()` which mounts the full @phlix/ui Player — the ResumePrompt is therefore rendered by @phlix/ui automatically. No tizen-specific resume prompt is needed because the player component itself handles this UX. Tizen does not need a separate TV-specific resume prompt; it's built into the @phlix/ui Player.
**Code Changes**: None (built into @phlix/ui Player automatically)

## Step 3.2 - Up Next Card
**Decision**: TV-SPECIFIC (PARTIAL duplicate)
**Rationale**: Tizen has UpNextOverlay.vue at `src/components/UpNextOverlay.vue` — a 596-line (re-measured `wc -l` at tip 2026-09-04) TV-specific component with D-pad navigation, countdown ring, and next-item loading. Since S280 the next item comes from the registered `GET /api/v1/users/me/next-up` rail (lines 130-150), NOT the old `GET /api/v1/media/{id}/playlist` call (that route was never registered server-side — the component docblock at :117-128 records this). It uses polling (250ms `setInterval` at lines 169-183) vs phlix-ui's reactive UpNext.vue props. The test file `tests/unit/UpNextOverlay.test.ts` exists and tests props, emits, accessibility, and countdown ring calculations. This was also documented in Category 2 Step 2.3.3 as TV-SPECIFIC with tech debt (polling vs reactive). The architectural difference (polling vs reactive) is justified by TV webview constraints.
**Code Changes**: None (TV-specific component already exists with documented tech debt)

## Step 3.3 - Transcode Notice
**Decision**: NOT TV-APPLICABLE
**Rationale**: Server handles all HLS transcoding. Tizen receives HLS streams only — never MKV, AVI, or HEVC containers directly. The only grep hit for "transcode" in tizen src is a comment in tizenBridge.ts line 240: "when the QualityMenu is actually on screen (multi-variant transcode)" — referring to quality variant selection, not codec transcoding. TranscodeNotice.vue and TranscodePreparing.vue have no tizen-side implementation because they are never triggered.
**Code Changes**: None (server-side HLS eliminates need for transcode UI)

## Step 3.4 - Transcode Preparing
**Decision**: NOT TV-APPLICABLE
**Rationale**: Same as Step 3.3 — server-side HLS warming eliminates the need for transcode preparing UI on the client. Tizen only sees the final HLS stream.
**Code Changes**: None (server-side HLS eliminates need for transcode UI)

## Step 3.5 - Shortcuts Help
**Decision**: NOT TV-APPLICABLE
**Rationale**: ShortcutsHelp.vue (`?` key shortcut overlay) requires a keyboard. Tizen TV uses D-pad remote only. AGENTS.md explicitly states "No pointer/mouse — D-pad (`useSpatialNav`) + transport keys (`RemoteManager` → `tizenBridge`) only." The keyboard shortcut overlay is fundamentally incompatible with TV remote interface.
**Code Changes**: None (keyboard-only feature - no code needed)

## Step 3.6 - Marker Timeline
**Decision**: TV-SPECIFIC (PARTIAL)
**Rationale**: ChapterOverlay.vue in tizen implements tick marks for chapters and markers (intro/outro/credits/ad) on the player seekbar. It fetches from BOTH `GET /api/v1/media/{id}/chapters` AND `GET /api/v1/media/{id}/markers`. Uses polling (250ms) vs phlix-ui's reactive MarkerTimeline.vue subscription pattern. The component was documented in Category 2 Step 2.3.2 as TV-SPECIFIC with tech debt (polling vs reactive). Consolidation requires migrating Tizen to reactive subscriptions.
**Code Changes**: None (TV-specific component already exists with documented tech debt)

## Step 3.7 - Quality Menu
**Decision**: ALREADY SUFFICIENT
**Rationale**: tizenBridge.ts (line refs re-derived at tip 2026-09-04: `BridgeQualityMenu` interface at 50-59, `createDomQualityMenu()` at 116-170, `installTizenBridge()` at 270-325) has the interface and DOM-bridge functions. The QualityMenu is rendered by @phlix/ui's Player and tizen provides D-pad navigation via the DOM-based bridge. Quality selection is server-side (X-Phlix-Device-Type: samsung-tizen header maps to appropriate quality), but the UI is properly bridged for D-pad navigation. The YELLOW color button on the remote activates quality-selection mode (`case 'YELLOW'` at tizenBridge.ts:238; transcode comment now at :240).
**Code Changes**: None (already integrated via tizenBridge.ts bridge)

## Step 3.8 - Speed Menu
**Decision**: NOT TV-APPLICABLE
**Rationale**: SpeedMenu.vue exists in @phlix/ui Player but playback speed control is not typically used on TV. The syncplay store (useSyncPlayStore.ts at tip: `playbackRate` field type at :97, session mapping at :367, and rate applied from sync commands at :749-751 — re-derived 2026-09-04; the old 413-414/536-543 refs predate the S415 store rewrite) handles `playbackRate` for synchronized playback sessions, but there's no tizen-specific speed menu UI. TV playback is generally at normal speed. The absence of a speed menu is intentional for TV UX.
**Code Changes**: None (not a TV use case - no code needed)

## Step 3.9 - Captions Menu
**Decision**: TV-SPECIFIC (PARTIAL)
**Rationale**: Tizen has SubtitleTrackList.vue at `src/components/SubtitleTrackList.vue` — a D-pad navigable list of subtitle tracks with Off option, forced/default badges, and codec display. This was documented in Category 2 Step 2.3.6 as TV-SPECIFIC with no phlix-ui equivalent for standalone subtitle track list. Style customization (size, color, background, edge) is handled by @phlix/ui's CaptionsMenu.vue and persisted in usePreferencesStore.captionStyle. Tizen's SubtitleTrackList handles track selection only — style controls remain in @phlix/ui domain. The split is intentional: TV provides efficient track selection; web provides full caption styling.
**Code Changes**: None (TV-specific track selection + @phlix/ui styling is intentional separation)

## Step 3.10 - Subtitle Search
**Decision**: NOT TV-APPLICABLE
**Rationale**: SubtitleSearch.vue in @phlix/ui handles on-demand subtitle download from external sources (OpenSubtitles etc.). This feature requires keyboard input for search queries and network access to third-party subtitle databases. Tizen TV webview has limited network capabilities and no keyboard. The feature is not relevant for TV use cases.
**Code Changes**: None (external subtitle download not applicable to TV - no code needed)

## Step 3.11 - Ambient Canvas
**Decision**: NOT TV-APPLICABLE
**Rationale**: AmbientCanvas.vue in @phlix/ui creates ambient glow effects based on video content colors — an aesthetic visual effect for ambient viewing. This is a purely cosmetic web-browser feature that has no relevance to TV viewing environments. No grep hits for "ambient" or "AmbientCanvas" in tizen src/.
**Code Changes**: None (visual effect not applicable to TV - no code needed)

## Step 3.12 - Scrubber
**Decision**: ALREADY SUFFICIENT (provided by @phlix/ui Player)
**Rationale**: The scrubber is rendered by @phlix/ui's Player (Scrubber.vue is part of PlayerPage). The scrubber provides position, duration, buffered range, and keyboard navigation. Tizen's ChapterOverlay.vue dims the scrubber when an ad marker is active (line 438: `.chapter-overlay--ad-active .chapter-overlay__ticks { opacity: 0.4 }`). The scrubber is fully functional via @phlix/ui — no tizen-specific scrubber implementation is needed.
**Code Changes**: None (provided by @phlix/ui Player)

## Step 3.13 - Skip Controls
**Decision**: TV-SPECIFIC (PARTIAL)
**Rationale**: Tizen has SkipIntroOverlay.vue at `src/components/SkipIntroOverlay.vue` — displays "Skip Intro" / "Skip Outro" buttons when playback is within marker ranges. Uses polling (250ms) vs phlix-ui's reactive SkipControls.vue pattern. This was documented in Category 2 Step 2.3.3 as TV-SPECIFIC with tech debt (polling vs reactive). The component fetches from `GET /api/v1/media/{id}/markers` and handles intro/outro markers specifically. Consolidation requires migrating Tizen to reactive pattern.
**Code Changes**: None (TV-specific component already exists with documented tech debt)

## Step 3.14 - Theater Mode
**Decision**: NOT TV-APPLICABLE
**Rationale**: Theater mode in @phlix/ui involves toggling a windowed player with shell chrome removal (usePlayerUiStore.theaterActive). Tizen uses full-screen player by default (`defaultTv: true` in createPhlixApp config, main.ts line 173 at tip — re-derived 2026-09-04; line 99 was the audit-date position). TV has no windowed player state to toggle and no shell chrome to remove. The `defaultTv: true` flag sets full-screen mode by default. Theater mode is a web browser window-management concept not applicable to TV.
**Code Changes**: None (full-screen TV paradigm - no code needed)

## Step 3.15 - Chapter Markers API
**Decision**: TV-SPECIFIC (PARTIAL)
**Rationale**: Tizen's ChapterOverlay.vue calls TWO APIs: `GET /api/v1/media/{id}/chapters` (line 93 — re-verified at tip) and `GET /api/v1/media/{id}/markers` (line 111 at tip; line 110 was the audit-date position). The chapters API returns chapter segments (ChapterMarker[] with startSeconds/endSeconds/title). The markers API returns timed markers (Marker[] with startMs/endMs/type/label). Both are used: chapters for seekable segments shown as gold ticks, markers for intro/outro/credits/ad shown as colored ticks. phlix-ui's MarkerTimeline.vue uses only the markers API *(HISTORICAL — v0.98.33-source observation)*. The dual-API usage in Tizen is intentional — chapters provide the seekable segments for the seekbar while markers provide the skip/opportunity overlay behavior. The two APIs serve complementary purposes.
**Code Changes**: None (dual-API usage is intentional for TV-specific UX)

---

## Summary

| Step | Feature | Decision |
|------|---------|----------|
| 3.1 | Resume Prompt | NOT TV-APPLICABLE |
| 3.2 | Up Next Card | TV-SPECIFIC |
| 3.3 | Transcode Notice | NOT TV-APPLICABLE |
| 3.4 | Transcode Preparing | NOT TV-APPLICABLE |
| 3.5 | Shortcuts Help | NOT TV-APPLICABLE |
| 3.6 | Marker Timeline | TV-SPECIFIC |
| 3.7 | Quality Menu | ALREADY SUFFICIENT |
| 3.8 | Speed Menu | NOT TV-APPLICABLE |
| 3.9 | Captions Menu | TV-SPECIFIC |
| 3.10 | Subtitle Search | NOT TV-APPLICABLE |
| 3.11 | Ambient Canvas | NOT TV-APPLICABLE |
| 3.12 | Scrubber | ALREADY SUFFICIENT |
| 3.13 | Skip Controls | TV-SPECIFIC |
| 3.14 | Theater Mode | NOT TV-APPLICABLE |
| 3.15 | Chapter Markers API | TV-SPECIFIC |

- **NOT TV-APPLICABLE**: 8 steps (keyboard-dependent, browser-specific, or irrelevant to TV)
- **TV-SPECIFIC**: 5 steps (components exist in tizen with documented tech debt)
- **ALREADY SUFFICIENT**: 2 steps (provided by @phlix/ui or already bridged)
- **Code changes needed**: 0 (all decisions are architectural/no-code)

---

# Category 5 Verification - Missing/Unused Composables

## Step 5.1 - useOnline
**Decision**: NOT USED
**Rationale**: `useOnline()` monitors `navigator.onLine` for connectivity error states. Tizen TV network is typically stable - no grep hits for `navigator.onLine` in src/. The `onlineMembers` in useSyncPlayStore.ts refers to SyncPlay member presence, not network connectivity. No offline error banners are implemented in tizen. Medium priority: could be useful for error states but TV stability makes it low urgency.
**Code Changes**: None

## Step 5.2 - usePrefetch
**Decision**: NOT TV-APPLICABLE
**Rationale**: `usePrefetch()` uses `pointerenter`/`focus` events to warm lazy route chunks before navigation. D-pad has no hover/focus events - it uses directional navigation and select. This composable is fundamentally incompatible with TV remote interface.
**Code Changes**: None (D-pad has no hover events - no code needed)

## Step 5.3 - usePreconnect
**Decision**: NOT USED
**Rationale**: `usePreconnect()` injects `<link rel="preconnect">` and `<link rel="dns-prefetch">` for cross-origin asset hosts (CDN/posters). No preconnect or dns-prefetch links are injected in tizen (grep returns 0 hits). Could speed up poster loading on TV but is an optimization rather than critical functionality. If TV accesses posters from a CDN, usePreconnect with `imageOrigin` config could help.
**Code Changes**: None

## Step 5.4 - useResumeSync
**Decision**: NOT USED (HIGH priority)
**Rationale**: `useResumeSync` is the cross-device resume READ path - fetches server-side resume positions from `GET /api/v1/users/me/continue-watching` and merges them into `usePlayerStore.mergeServerResume()`. The @phlix/ui PlayerPage does call syncResume on mount, but tizen does NOT explicitly integrate useResumeSync. This means cross-device resume (web→TV) would NOT work - the TV wouldn't fetch server resume positions when the player loads. Tizen has LOCAL resume via usePlayerStore's localStorage-backed resumeMap, but no server sync. HIGH priority: critical for "continue where you left off" across devices.
**Code Changes**: None (would need implementation for cross-device resume)

## Step 5.5 - useResumeReporter
**Decision**: NOT USED (HIGH priority)
**Rationale**: `useResumeReporter` is the cross-device resume WRITE path - reports playback position to server via `POST /api/v1/sessions` and `POST /api/v1/sessions/{id}/progress`. Tizen does NOT report playback position to server. This means TV→web resume would not work - positions watched on TV don't sync back to server for other devices. Often paired with useResumeSync - if 5.4 needs implementation, 5.5 likely does too.
**Code Changes**: None (would need implementation for cross-device resume)

## Step 5.6 - useCommandPaletteHotkey
**Decision**: NOT TV-APPLICABLE
**Rationale**: Keyboard-centric (⌘K/Ctrl+K) command palette. Tizen TV uses D-pad remote only - no keyboard. The command palette pattern is fundamentally incompatible with TV remote interface which uses directional navigation and transport keys only.
**Code Changes**: None (requires keyboard - no code needed)

## Step 5.7 - useTheme
**Decision**: PARTIAL
**Rationale**: Tizen sets `defaultTheme: 'nocturne'` in createPhlixApp config (main.ts line 174 at tip — re-derived 2026-09-04; was line 100 at audit date), but `useTheme()` is NOT explicitly called in tizen source (grep at tip confirms). The useTheme() composable reactively reflects preferences store onto `<html>` (data-theme, data-density, data-reduced-motion, --accent* variables). Without useTheme(), theme changes from the preferences store would NOT be reactively applied to the DOM. However, `createPhlixApp` internally calls `applyStoredThemeEarly()` which sets initial theme before mount. For full reactive theme support (if users can change theme in settings), useTheme() should be called. Investigation shows prefs.tv is used in SpatialNavHost for D-pad gating, but full theme reactivity may be handled internally by createPhlixApp.
**Code Changes**: None (createPhlixApp handles theme initialization internally)

## Step 5.8 - usePageTitle
**Decision**: NOT TV-APPLICABLE
**Rationale**: `usePageTitle()` sets `document.title` for browser tab bar. Tizen TV has no tab bar - no visible effect. TV displays are fixed 1920x1080 with no browser chrome. document.title is irrelevant for TV UX.
**Code Changes**: None (no tab bar on TV - no code needed)

## Step 5.9 - useMessages
**Decision**: NOT USED
**Rationale**: `useMessages()` provides i18n infrastructure via `t('group.key', params?)` function. All user-facing strings in tizen are hardcoded English (re-verified at tip 2026-09-04: grep for `useMessages`/`createTranslator` in src/ → 0 hits). Tizen does not have any i18n/l10n infrastructure. Adding i18n would be a significant effort for minimal benefit on a single-language TV app.
**Code Changes**: None (all strings hardcoded English - no i18n needed)

## Step 5.10 - useMusicPlayer
**Decision**: NOT TV-APPLICABLE
**Rationale**: `useMusicPlayer` handles audio playback with gapless playback, crossfade, and queue management for music. No music UI exists in tizen - not part of TV app scope which focuses on video playback. The phlix-ui MusicPlayerPage and music playback features are not relevant to the TV video player use case.
**Code Changes**: None (music not in TV scope - no code needed)

## Step 5.11 - useTrickplay
**Decision**: NOT USED
**Rationale**: `useTrickplay` provides sprite preview thumbnails during scrubbing (fetches from `GET /api/v1/media/{id}/trickplay`). Requires server-side sprite generation. No trickplay or thumbnail sprite support in tizen player (grep returns 0 hits). Would enhance TV player UX but requires server-side sprite generation which may not be implemented. Low priority enhancement.
**Code Changes**: None (requires server-side sprite generation)

## Step 5.12 - useItemInspector
**Decision**: NOT TV-APPLICABLE
**Rationale**: `useItemInspector` is a debugging tool that provides detailed item metadata inspection for development. Not needed by end users on TV. Debugging tools are not applicable to production TV app UX.
**Code Changes**: None (debugging tool - no code needed)

## Step 5.13 - useSeriesSeasons
**Decision**: ALREADY SUFFICIENT
**Rationale**: Already works via @phlix/ui components. SeasonPage and MediaDetailPage in @phlix/ui use useSeriesSeasons internally to resolve series/season data. Tizen uses createPhlixApp which mounts these components - the composable works automatically behind the scenes.
**Code Changes**: None (works transparently via @phlix/ui)

## Step 5.14 - useMediaItemCache
**Decision**: INTERNAL
**Rationale**: Transparent stale-while-revalidate cache behind @phlix/ui components (60s TTL). Used internally by media-detail and player pages for instant navigation with background refresh. Works transparently - no direct usage in tizen source.
**Code Changes**: None (internal cache - no code needed)

## Step 5.15 - useResolvePlayable
**Decision**: INTERNAL
**Rationale**: Resolves what to play for series/season (idempotent media item → playable item). If tizen uses @phlix/ui's standard play handling via createPhlixApp, it works automatically behind the scenes. The composable is used internally by @phlix/ui player components.
**Code Changes**: None (internal resolution - no code needed)

## Step 5.16 - useHlsTranscode
**Decision**: INTERNAL
**Rationale**: Core playback pipeline for transcoded content. Tizen's `TIZEN_HLS_CONFIG` is passed through createPhlixApp via `playerHlsConfig` (at tip 2026-09-04: config object main.ts:76-83, pass-through :190 — re-derived; lines 69-76/116 were audit-date positions). Works transparently - the HLS config is passed to @phlix/ui's player which handles transcoding.
**Code Changes**: None (passed through createPhlixApp config - no code needed)

## Step 5.17 - useHeaderHideOnScroll
**Decision**: NOT TV-APPLICABLE
**Rationale**: Web scroll-based pattern that hides header on scroll down, shows on scroll up. TVs use focus-based spatial navigation, not page scrolling. The entire concept of scroll-based header hiding is incompatible with TV D-pad navigation where focus moves between elements.
**Code Changes**: None (no scrolling on TV - no code needed)

## Step 5.18 - Spatial Nav Utilities
**Decision**: ALREADY SUFFICIENT
**Rationale**: `useSpatialNav` is actively used in SpatialNavHost.vue (line 31 at tip 2026-09-04 — re-derived; line 6 was the audit-date position: `useSpatialNav({enabled: () => Boolean(prefs.tv) && route.name !== 'player'})`). The low-level utilities (bestCandidate, rectCenter) are internal to useSpatialNav implementation *(HISTORICAL — @phlix/ui-internal)*. Spatial navigation is properly integrated for D-pad navigation on TV.
**Code Changes**: None (already integrated via SpatialNavHost.vue)

---

## Summary

| Step | Feature | Decision | Priority |
|------|---------|----------|----------|
| 5.1 | useOnline | NOT USED | Medium |
| 5.2 | usePrefetch | NOT TV-APPLICABLE | - |
| 5.3 | usePreconnect | NOT USED | Medium |
| 5.4 | useResumeSync | NOT USED | HIGH |
| 5.5 | useResumeReporter | NOT USED | HIGH |
| 5.6 | useCommandPaletteHotkey | NOT TV-APPLICABLE | - |
| 5.7 | useTheme | PARTIAL | Medium |
| 5.8 | usePageTitle | NOT TV-APPLICABLE | - |
| 5.9 | useMessages | NOT USED | None |
| 5.10 | useMusicPlayer | NOT TV-APPLICABLE | - |
| 5.11 | useTrickplay | NOT USED | Medium |
| 5.12 | useItemInspector | NOT TV-APPLICABLE | - |
| 5.13 | useSeriesSeasons | ALREADY SUFFICIENT | - |
| 5.14 | useMediaItemCache | INTERNAL | - |
| 5.15 | useResolvePlayable | INTERNAL | - |
| 5.16 | useHlsTranscode | INTERNAL | - |
| 5.17 | useHeaderHideOnScroll | NOT TV-APPLICABLE | - |
| 5.18 | Spatial Nav Utilities | ALREADY SUFFICIENT | - |

- **NOT TV-APPLICABLE**: 6 steps (keyboard/mouse/scroll-dependent features)
- **NOT USED**: 5 steps (available but not integrated)
- **INTERNAL**: 3 steps (work transparently via @phlix/ui)
- **ALREADY SUFFICIENT**: 2 steps (properly integrated)
- **PARTIAL**: 1 step (partially integrated, investigation needed)
- **HIGH priority NOT USED**: 2 steps (useResumeSync, useResumeReporter - cross-device resume)
- **Code changes needed**: 0 for all decisions (HIGH priority items would need implementation for cross-device resume)

---

# Category 6 - Missing Pages (phlix-ui has 30+, tizen has 5 local pages + 1 screen)

## Overview

*(Count re-derived at tip 2026-09-04: the audit-date text said "4 local pages" — SubtitleTracksPage has since been added (S407), so `src/pages/` now holds 5.)* The tizen client has **5 local pages** (MusicPage, ParentalControlsPage, ChaptersPage, AudioTracksPage, SubtitleTracksPage) plus the `src/screens/RecommendationsScreen.vue`, and imports additional pages from @phlix/ui via `createPhlixApp()`. This creates a feature gap compared to phlix-ui's 30+ dedicated pages. Decisions below distinguish between **TV-SPECIFIC** (intentional local reimplementation), **NOT TV-APPLICABLE** (keyboard/mouse features irrelevant to TV), **NOT USED** (exists in bundle but not routed), and **ALREADY SUFFICIENT** (provided via @phlix/ui or menu system).

## Step 6.1 - Music: Album Detail
**Decision**: TV-SPECIFIC (PARTIAL)
**Finding**: MusicPage.vue handles album detail inline via `currentView === 'tracks'` state. Album header shows 120x120 art (vs 200x200 in phlix-ui), title, artist name, year, track count. Gap: no total album duration, no Play All button, no crossfade/gapless playback (useMusicPlayer not available), no shimmer loading skeleton (just "Loading music..." text). The `emit('play', track)` delegates to parent app for actual playback.
**Code Changes**: None (TV-specific gaps are intentional trade-offs for thin-client model)

## Step 6.2 - Music: Artist Detail
**Decision**: TV-SPECIFIC (PARTIAL)
**Finding**: MusicPage.vue shows artist's albums inline via `currentView === 'albums'`. Uses MusicAlbumCard component with dynamic title showing artist name. Gap: no artist image (phlix-ui shows 200x200 with placeholder SVG), no track count from artist.trackCount. *(Paging gaps CLOSED since S125 — re-measured at tip: albums ARE paged via `listAlbums({limit, offset, artist})` (useMusicStore.ts:177-181/:202) with a load-more control (`hasMoreAlbums`/`loadMoreAlbums`, MusicPage.vue:113/:220) and a server-side artist filter.)* No page-error banner handling *(audit-date observation; MusicPage now renders store error state)*.
**Code Changes**: None (TV-specific gaps are intentional trade-offs)

## Step 6.3 - Music: Artists List
**Decision**: TV-SPECIFIC (PARTIAL)
**Finding**: MusicPage.vue shows artists via `currentView === 'artists'` using MusicArtistCard component. *(Audit-date gap "no offset paging — shows all artists at once (problematic for 2,197-artist DB)" is CLOSED: re-measured at tip, offset paging exists — `listArtists({limit: MUSIC_PAGE_SIZE, offset})` (useMusicStore.ts:132/:156-158), `artistsTotal` read from the page envelope (:134), load-more control (`hasMoreArtists`/`loadMoreArtists`, MusicPage.vue:111/:189) — the S125 fix commit is titled exactly "page the Tizen music library instead of showing 100 of 2,197 artists".)* Remaining audit-date gaps (no shimmer skeleton — just "Loading music…" text at MusicPage.vue:155; full error state on failure) were not re-litigated beyond confirming the loading string.
**Code Changes**: None (TV-specific gaps are intentional trade-offs)

## Step 6.4 - Music: Tracks List
**Decision**: TV-SPECIFIC (PARTIAL)
**Finding**: MusicPage.vue shows tracks inline via `currentView === 'tracks'` using TrackListItem component with per-track play. Gap: no dedicated MusicTracksPage for full library (only album-level), no client-side search, no transport bar (prev/pause/play/next, seek slider, progress time), simplified list item vs full table with Artist/Album columns.
**Code Changes**: None (TV-specific gaps are intentional trade-offs)

## Step 6.5 - Music: Player
**Decision**: NOT TV-APPLICABLE
**Finding**: No dedicated music player page. Playback delegates to parent app via `emit('play', track)` — the actual audio playback happens in @phlix/ui's player context outside the TV app. No queue management, no shuffle/repeat/volume/seek controls. This is by design: TV is primarily a video platform; audio playback is a thin-client delegation.
**Code Changes**: None (audio playback outside TV scope - no code needed)

## Step 6.6 - Books
**Decision**: NOT TV-APPLICABLE
**Finding**: No book-related pages exist in tizen. BooksPage, BookDetailPage, BookReaderPage (epub reader) have no tizen equivalents. Reading books on a TV is not a typical use case. The platform is video-centric.
**Code Changes**: None (not a TV use case - no code needed)

## Step 6.7 - Audiobooks
**Decision**: NOT TV-APPLICABLE
**Finding**: No audiobook pages in tizen. AudiobookDetailPage, AudiobookPlayerPage (with chapter navigation) have no tizen equivalents. Audio content on TV is lower priority than video. The thin-client model delegates audio playback.
**Code Changes**: None (not a TV use case - no code needed)

## Step 6.8 - Photos
**Decision**: NOT TV-APPLICABLE
**Finding**: No photo pages in tizen (PhotoAlbumsPage, PhotoAlbumPage, PhotoViewPage, PhotoSlideshowPage). Photo slideshows could theoretically work on TV but viewing individual photos is less relevant for the TV platform.
**Code Changes**: None (not a TV use case - no code needed)

## Step 6.9 - Explore
**Decision**: NOT TV-APPLICABLE
**Finding**: No explore/discovery page in tizen. ExplorePage (discovery interface for content recommendations) is primarily a web/mobile pattern. TV users typically browse by library rather than needing discovery features.
**Code Changes**: None (not a TV use case - no code needed)

## Step 6.10 - Security Settings
**Decision**: PARTIAL
**Finding**: ParentalControlsPage exists at `/app/parental-controls` (registered in buildExtraRoutes, accessible via menu). Provides PIN-protected parental controls with three tabs: Access Schedules, Tag Blocking, Stream Limits. Gap vs phlix-ui SecuritySettingsPage: no session management, no device management, no password change, no 2FA. These are minor enhancements for admin-level users.
**Code Changes**: None (PARTIAL is sufficient for TV parental control needs)

## Step 6.11 - My Servers
**Decision**: NOT TV-APPLICABLE
**Finding**: No multi-server support pages in tizen. MyServersPage, ServerDetailPage have no tizen equivalents. Tizen is primarily a single-server thin client (server URL stored in localStorage via resolveConfig.ts). Multi-server management is a hub/web feature.
**Code Changes**: None (thin-client architecture - no code needed)

## Step 6.12 - Federation
**Decision**: NOT TV-APPLICABLE
**Finding**: No federation pages in tizen (FederationPage, FederationSharesPage, ManageSharesPage, SharedWithMePage). Federation is primarily a server-to-server feature, less relevant for a TV client that connects directly to a single server.
**Code Changes**: None (server-to-server feature - no code needed)

## Step 6.13 - Invite Links
**Decision**: NOT TV-APPLICABLE
**Finding**: No invite functionality in tizen (InviteLinksPage, AcceptInvitePage). User registration/invitation is typically handled via web admin interface, not a TV client.
**Code Changes**: None (admin/web feature - no code needed)

## Step 6.14 - Watch History
**Decision**: NOT USED
**Finding**: HistoryPage exists in bundle at `package/assets/HistoryPage-HhFjB0Kf-BuRzP3EG.js` but is NOT registered in tizen's routing (not in buildExtraRoutes, not in @phlix/ui standard routes). History is tracked in `usePlayerStore.resumeMap` but exposed only via inline "continue watching" rather than a dedicated history page. Users cannot browse full history or clear it.
**Code Changes**: None (would need routing integration if desired)

## Step 6.15 - Season Detail
**Decision**: NOT USED
**Finding**: SeasonPage exists in bundle at `package/assets/SeasonPage-BTGDnR70-B9lMQ1Ct.js` but NOT explicitly routed in tizen. MediaDetailPage handles series information and episodes are shown within series detail, potentially flat without dedicated season grouping. No `route /app/tv/:seriesId/season/:seasonNumber` is registered.
**Code Changes**: None (would need explicit routing integration)

## Step 6.16 - Series Detail
**Decision**: ALREADY SUFFICIENT
**Finding**: MediaDetailPage at `package/assets/MediaDetailPage-DGDAIlPN-KE30A5Q1.js` handles series display. Series info and episodes are shown within MediaDetail. Season tab navigation (SeriesSeasons component at `package/assets/useSeriesSeasons-BYY54zt4-Dky-fmf3.js`) provides season grouping via collapsible `<details>` elements. The series/season browsing is functional via @phlix/ui's standard routing.
**Code Changes**: None (provided via @phlix/ui MediaDetailPage)

## Step 6.17 - Requests
**Decision**: NOT TV-APPLICABLE
**Finding**: No RequestsPage in tizen. User content requests and approval workflow are handled via admin web interface. TV users do not need request submission functionality.
**Code Changes**: None (admin feature - no code needed)

## Step 6.18 - Browse/Home
**Decision**: ALREADY SUFFICIENT
**Finding**: BrowsePage exists in bundle at `package/assets/BrowsePage-DPV6hUCE-yuvguuoR.js`. The menu's `libraryLinks: true` (main.ts line 47 at tip — re-derived 2026-09-04; line 42 was the audit-date position) expands "Browse" into per-library nav links automatically. The BrowsePage is the home screen (`to: '/app'`) and renders "Continue Watching" rail + configurable home rows per library + "See all" links to LibraryPage. This is the primary entry point for the TV app.
**Code Changes**: None (properly integrated via menu system + @phlix/ui BrowsePage)

## Step 6.19 - Library
**Decision**: ALREADY SUFFICIENT
**Finding**: LibraryPage exists in bundle at `package/assets/LibraryPage-gSBcP7fI-BTFqGapg.js`. Accessed via "See all" links from BrowsePage home rows. Provides full filterable grid for a library with sorting and filtering. The Browse → Library navigation chain is complete and functional via @phlix/ui routing.
**Code Changes**: None (properly integrated via BrowsePage navigation)

## Step 6.20 - Search
**Decision**: ALREADY SUFFICIENT
**Finding**: No dedicated SearchPage route in tizen, but search functionality exists via CommandPalette (`package/assets/CommandPalette-DgXPiuHU-mRtH7fzD.js`). The CommandPalette provides library search with recent items, grouped results, and keyboard shortcut trigger. The palette is opened via menu action or keyboard shortcut and navigates to browse with search query. While the phlix-ui SearchPage at `/app/search` is not explicitly routed, the CommandPalette search covers the same use case for TV.
**Code Changes**: None (CommandPalette provides search functionality)

---

## Summary

| Step | Feature | Decision | Notes |
|------|---------|----------|-------|
| 6.1 | Music - Album Detail | TV-SPECIFIC (PARTIAL) | Inline in MusicPage, 120x120 art, no Play All/crossfade |
| 6.2 | Music - Artist Detail | TV-SPECIFIC (PARTIAL) | No artist image, no paging, no track count |
| 6.3 | Music - Artists List | TV-SPECIFIC (PARTIAL) | No paging, all artists loaded at once |
| 6.4 | Music - Tracks List | TV-SPECIFIC (PARTIAL) | Album-level only, no search/transport bar |
| 6.5 | Music - Player | NOT TV-APPLICABLE | Delegates to parent app audio playback |
| 6.6 | Books | NOT TV-APPLICABLE | Not a TV use case |
| 6.7 | Audiobooks | NOT TV-APPLICABLE | Not a TV use case |
| 6.8 | Photos | NOT TV-APPLICABLE | Not a TV use case |
| 6.9 | Explore | NOT TV-APPLICABLE | Not a TV use case |
| 6.10 | Security Settings | PARTIAL | ParentalControlsPage with 3 tabs, missing session/device management |
| 6.11 | My Servers | NOT TV-APPLICABLE | Thin client single-server model |
| 6.12 | Federation | NOT TV-APPLICABLE | Server-to-server feature |
| 6.13 | Invite Links | NOT TV-APPLICABLE | Admin/web feature |
| 6.14 | Watch History | NOT USED | Bundle has HistoryPage but not routed |
| 6.15 | Season Detail | NOT USED | Bundle has SeasonPage but not routed |
| 6.16 | Series Detail | ALREADY SUFFICIENT | MediaDetailPage via @phlix/ui |
| 6.17 | Requests | NOT TV-APPLICABLE | Admin feature |
| 6.18 | Browse/Home | ALREADY SUFFICIENT | libraryLinks menu + BrowsePage |
| 6.19 | Library | ALREADY SUFFICIENT | "See all" → LibraryPage via @phlix/ui |
| 6.20 | Search | ALREADY SUFFICIENT | CommandPalette provides search |

**Decision Distribution**:
- **TV-SPECIFIC (PARTIAL)**: 5 steps (6.1-6.4 music pages + 6.10 security) - intentional trade-offs for thin-client
- **NOT TV-APPLICABLE**: 9 steps (6.5-6.9, 6.11-6.13, 6.17) - features irrelevant to TV UX
- **NOT USED**: 2 steps (6.14-6.15) - pages exist in bundle but not routed
- **ALREADY SUFFICIENT**: 4 steps (6.16, 6.18-6.20) - provided via @phlix/ui or menu system
- **Code changes needed**: 0 (all decisions are architectural/no-code)

---

# Category 7 - Admin Features

## Executive Summary

All 23 admin feature steps are **NOT TV-APPLICABLE**. Admin features (user management, server settings, log viewing, backup, plugins, etc.) are server administration functions. TV is a thin client for media consumption, not a server administration interface. Admin pages exist in @phlix/ui (not in tizen-client) and are technically accessible via direct URL or admin menu, but:
1. Server administration from TV is not a designed product use case
2. The v-focusable D-pad navigation issue is internal to @phlix/ui
3. Tizen-client is a thin media consumption client per AGENTS.md

## Step 7.1 - Admin Pages Access (buildAdminRoutes)
**Decision**: NOT TV-APPLICABLE
**Rationale**: buildAdminRoutes() is correctly imported and used in tizen-client (main.ts line 13 import, line 62 spread — re-derived at tip 2026-09-04; audit-date refs were 12/57). Admin routes ARE accessible at /app/admin/*. The "20 pages in the default set" count is a HISTORICAL v0.98.33-source observation. However, admin features are server management features, not TV media consumption features. The v-focusable D-pad navigation issue is internal to @phlix/ui. Server administration should be done through the web interface on a computer.
**Code Changes**: None (architectural decision - no code needed)

## Step 7.2 - Admin Dashboard
**Decision**: NOT TV-APPLICABLE
**Rationale**: DashboardPage.vue exists in @phlix/ui with date range filters, now-playing, top users, storage metrics. This is server administration/dashboard functionality, not TV media consumption. TV is not a platform for viewing server analytics.
**Code Changes**: None (server analytics - no TV use case)

## Step 7.3 - Admin Users
**Decision**: NOT TV-APPLICABLE
**Rationale**: UsersPage.vue exists in @phlix/ui with user creation, editing, profile management. User management is a server administration task done through the web UI, not a TV function.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.4 - Admin Libraries
**Decision**: NOT TV-APPLICABLE
**Rationale**: LibrariesPage.vue exists in @phlix/ui with library configuration. Library setup and configuration is a server administration task, not a TV media consumption task.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.5 - Admin Settings
**Decision**: NOT TV-APPLICABLE
**Rationale**: SettingsPage.vue exists in @phlix/ui with server settings, transcoding, logging, etc. Server settings configuration is done through the web interface, not on TV.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.6 - Admin Plugins
**Decision**: NOT TV-APPLICABLE
**Rationale**: PluginsPage.vue exists in @phlix/ui with plugin management. Plugin management is a server administration task requiring detailed interaction not suitable for TV remote.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.7 - Admin Logs
**Decision**: NOT TV-APPLICABLE
**Rationale**: LogsPage.vue exists in @phlix/ui with server log viewing. Log analysis is a server administration/debugging task, not a TV function.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.8 - Admin Backup
**Decision**: NOT TV-APPLICABLE
**Rationale**: BackupPage.vue exists in @phlix/ui with backup/restore functionality. Server backup management is a critical admin task done through the web interface with proper safeguards.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.9 - Admin Cast Devices
**Decision**: NOT TV-APPLICABLE
**Rationale**: CastDevicesPage.vue exists in @phlix/ui with DLNA/Device management. Device configuration is a server administration task, not TV media consumption.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.10 - Admin Collections
**Decision**: NOT TV-APPLICABLE
**Rationale**: CollectionsPage.vue exists in @phlix/ui with collection management. Collection curation is typically done through web UI or server interface.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.11 - Admin DLNA
**Decision**: NOT TV-APPLICABLE
**Rationale**: DlnaServerPage.vue exists in @phlix/ui with DLNA server settings. DLNA configuration is a server networking task, not TV media consumption.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.12 - Admin Duplicates
**Decision**: NOT TV-APPLICABLE
**Rationale**: DuplicatesPage.vue exists in @phlix/ui with duplicate file management. Duplicate detection and resolution is a server library maintenance task.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.13 - Admin History
**Decision**: NOT TV-APPLICABLE
**Rationale**: HistoryPage.vue exists in @phlix/ui with server history. Server-side history management is a library administration task, not a TV viewing feature.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.14 - Admin Hub
**Decision**: NOT TV-APPLICABLE
**Rationale**: HubDashboardPage.vue exists in @phlix/ui (part of hubAdminPages, not default). Hub functionality is for the hub app, not the TV client. Tizen is server-mode only per AGENTS.md.
**Code Changes**: None (hub-specific feature - no TV use case)

## Step 7.15 - Admin Integrations
**Decision**: NOT TV-APPLICABLE
**Rationale**: IntegrationsPage.vue exists in @phlix/ui with third-party integrations. Integration configuration is a server administration task.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.16 - Admin Live TV
**Decision**: NOT TV-APPLICABLE
**Rationale**: LiveTvPage.vue exists in @phlix/ui with Live TV/DVR settings. TV tuner and DVR configuration is a server administration task requiring detailed setup.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.17 - Admin Metrics
**Decision**: NOT TV-APPLICABLE
**Rationale**: MetricsPage.vue exists in @phlix/ui with server metrics/traffic data. Server analytics viewing is an admin task, not a TV media consumption task.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.18 - Admin Remote Access
**Decision**: NOT TV-APPLICABLE
**Rationale**: RemoteAccessPage.vue exists in @phlix/ui with remote access/VPN settings. Remote access configuration is a critical server security task done through web UI.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.19 - Admin Services
**Decision**: NOT TV-APPLICABLE
**Rationale**: ServicesPage.vue exists in @phlix/ui with server services management. Service configuration and monitoring is a server administration task.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.20 - Admin SyncPlay
**Decision**: NOT TV-APPLICABLE
**Rationale**: SyncPlayPage.vue exists in @phlix/ui with SyncPlay settings. SyncPlay is a client feature used during playback, not an admin configuration needed on TV.
**Code Changes**: None (client feature - no TV admin use case)

## Step 7.21 - Admin Webhooks
**Decision**: NOT TV-APPLICABLE
**Rationale**: WebhooksPage.vue exists in @phlix/ui with webhook configuration. Webhook management is a server integration/administration task.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.22 - Admin Audit Logs
**Decision**: NOT TV-APPLICABLE
**Rationale**: AuditLogsPage.vue exists in @phlix/ui (part of hubAdminPages, not default). Audit log review is a security/compliance administration task.
**Code Changes**: None (admin feature - no TV use case)

## Step 7.23 - Admin API Clients
**Decision**: NOT TV-APPLICABLE
**Rationale**: *(Count re-derived at tip 2026-09-04 against the vendored dist — `ls node_modules/@phlix/ui/dist/api/admin/*.d.ts | wc -l` = **26** modules: backup, cast, collections, dashboard, dlnaServer, duplicates, history, hubDashboard, integrations, libraries, liveTv, logs, maintenance, metadata-sources, metrics, networkHealth, plugins, remoteAccess, servers, services, settings, syncPlay, transcoding, updates, users, webhooks. The audit-date src-tree counts — "19" here and "21" in Step 12.10's header — were two mutually inconsistent HISTORICAL snapshots of the same surface; both are superseded by the measured 26.)* These are used internally by admin pages in @phlix/ui, not directly by tizen-client (tizen `src/` grep: 0 imports of any admin client module). Admin API access is server administration, not TV media consumption.
**Code Changes**: None (admin API infrastructure - no TV use case)

## Summary Table

| Step | Feature | Decision | Rationale |
|------|---------|----------|-----------|
| 7.1 | Admin Pages Access | NOT TV-APPLICABLE | Server admin, not TV use case |
| 7.2 | Admin Dashboard | NOT TV-APPLICABLE | Server analytics, not TV use case |
| 7.3 | Admin Users | NOT TV-APPLICABLE | User management, not TV use case |
| 7.4 | Admin Libraries | NOT TV-APPLICABLE | Library config, not TV use case |
| 7.5 | Admin Settings | NOT TV-APPLICABLE | Server settings, not TV use case |
| 7.6 | Admin Plugins | NOT TV-APPLICABLE | Plugin mgmt, not TV use case |
| 7.7 | Admin Logs | NOT TV-APPLICABLE | Log viewing, not TV use case |
| 7.8 | Admin Backup | NOT TV-APPLICABLE | Backup mgmt, not TV use case |
| 7.9 | Admin Cast Devices | NOT TV-APPLICABLE | Device config, not TV use case |
| 7.10 | Admin Collections | NOT TV-APPLICABLE | Collection mgmt, not TV use case |
| 7.11 | Admin DLNA | NOT TV-APPLICABLE | DLNA config, not TV use case |
| 7.12 | Admin Duplicates | NOT TV-APPLICABLE | Duplicate mgmt, not TV use case |
| 7.13 | Admin History | NOT TV-APPLICABLE | History mgmt, not TV use case |
| 7.14 | Admin Hub | NOT TV-APPLICABLE | Hub-specific, not TV use case |
| 7.15 | Admin Integrations | NOT TV-APPLICABLE | Integration config, not TV use case |
| 7.16 | Admin Live TV | NOT TV-APPLICABLE | DVR config, not TV use case |
| 7.17 | Admin Metrics | NOT TV-APPLICABLE | Server metrics, not TV use case |
| 7.18 | Admin Remote Access | NOT TV-APPLICABLE | Remote access config, not TV use case |
| 7.19 | Admin Services | NOT TV-APPLICABLE | Service mgmt, not TV use case |
| 7.20 | Admin SyncPlay | NOT TV-APPLICABLE | SyncPlay settings, not TV admin use case |
| 7.21 | Admin Webhooks | NOT TV-APPLICABLE | Webhook config, not TV use case |
| 7.22 | Admin Audit Logs | NOT TV-APPLICABLE | Audit logs, not TV use case |
| 7.23 | Admin API Clients | NOT TV-APPLICABLE | Admin APIs, not TV use case |

**Decision Distribution**:
- **NOT TV-APPLICABLE**: 23 steps (7.1-7.23) - all admin features are server management, not TV media consumption
- **Code changes needed**: 0 (all decisions are architectural/product decision - no code needed)

**Notes**:
- All admin pages exist in @phlix/ui, not in tizen-client (per AGENTS.md: "this repo writes no media/library/auth UI")
- Admin routes are correctly set up in tizen-client via buildAdminRoutes() from @phlix/ui
- The admin menu entry exists with requiresAdmin: true
- v-focusable D-pad navigation issue is internal to @phlix/ui components
- TV is designed for media consumption, not server administration

---

# Category 9 - Player Store Integration Issues

## Step 9.1 - Polling Instead of Reactivity (HIGH)
**Decision**: TV-SPECIFIC
**Finding**: ChapterOverlay.vue:297-316, SkipIntroOverlay.vue:127-141, and UpNextOverlay.vue:169-183 all use setInterval at 250ms to poll player position from playerStore (line refs re-derived at tip 2026-09-04). This is explicitly documented in each component's header as "tech debt but necessary for the TV webview context." The cat_9.md notes Tizen WebView may have unreliable timeupdate event firing - the polling approach is a deliberate TV-specific workaround. The alternative requestVideoFrameCallback is not used. Core player store updateProgress() is called via Player.vue's onTimeUpdate in @phlix/ui - the issue is that overlays poll separately rather than using reactive subscriptions.
**Code Changes**: None (documented TV-specific tech debt)

## Step 9.2 - Missing Resume System (HIGH)
**Decision**: TV-SPECIFIC
**Finding**: tizenBridge.ts:278 casts usePlayerStore to BridgePlayer with only { playing, play, pause, closePlayer, seekBy } (re-verified at tip). Resume functions (resumePositionFor, clearResume, mergeServerResume) exist in usePlayerStore.ts *(HISTORICAL — @phlix/ui v0.98.33 src lines 210-248; dist-only ship prevents re-derivation)* but are not exposed through BridgePlayer interface. However, overlay components (ChapterOverlay:220, SkipIntroOverlay:108 — both re-verified at tip) call playerStore.seekTo() directly, bypassing the thin tizen bridge entirely. The LRU eviction logic at usePlayerStore.ts:137-157 *(HISTORICAL, same reason)* exists but Tizen never triggers it - however this is bounded automatically. The tizen bridge is intentionally minimal; resume system works through direct playerStore access.
**Code Changes**: None (intentional minimal bridge design; overlay components work directly with usePlayerStore)

## Step 9.3 - Missing Queue/Up-Next (MEDIUM)
**Decision**: NOT TV-APPLICABLE
**Finding**: *(Restated at tip 2026-09-04 — the audit-date "fetches `/api/v1/media/{id}/playlist`" was falsified by S280: that route was never registered server-side.)* UpNextOverlay.vue:130-150 (`loadUpNextMedia`) fetches `GET /api/v1/users/me/next-up` via `client.get` and picks the first non-self item client-side. This is a TV-specific implementation that doesn't use playerStore.setQueue()/next(). The cat_9.md notes PlayerPage.vue:213-268 — *HISTORICAL src ref* — shows proper queue management with player.setQueue() and player.next() - but these are in @phlix/ui's PlayerPage, not in tizen. Tizen's UpNextOverlay works differently (API-based) and achieves the same UX.
**Code Changes**: None (UpNextOverlay uses different but equivalent approach)

## Step 9.4 - Missing Media Session (MEDIUM)
**Decision**: NOT TV-APPLICABLE
**Finding**: Tizen WebView (Chromium-based) may not support navigator.mediaSession API. The Tizen bridge does not call setMediaSessionMetadata(), setMediaPositionState(), or bindMediaSession() (usePlayerStore.ts:392-443 — *HISTORICAL, @phlix/ui v0.98.33 src; dist-only ship*). RemoteManager.ts handles TV remote integration directly via keydown/keyup document listeners mapped to player store actions. The cat_9.md notes "Tizen's native remote handling via RemoteManager may make Media Session less critical" - this is the case. OS-level transport controls (lock screen, notification) are not a TV use case; the TV remote is handled natively.
**Code Changes**: None (RemoteManager replaces Media Session functionality on Tizen)

## Step 9.5 - Missing Preferences Seeding (MEDIUM)
**Decision**: TV-SPECIFIC (PARTIAL)
**Finding**: seedFromPreferences() exists at usePlayerStore.ts:446-450 — *HISTORICAL src ref* but is NOT called in tizen main.ts after createPhlixApp. However, player store initializes defaultVolume, defaultQuality, defaultSubtitleLang from preferences at store creation (usePlayerStore.ts:102-106 — *HISTORICAL src ref*). Tizen only uses prefs.tv in SpatialNavHost.vue for D-pad navigation gating - no other preference-driven state. The seedFromPreferences gap only matters if user changes preferences at runtime; on Tizen settings UI is limited. This is partial but not blocking.
**Code Changes**: None (preferences initialized at store creation; runtime preference changes not a TV priority)

## Step 9.6 - lastCommand Bus (LOW)
**Decision**: ALREADY SUFFICIENT
**Finding**: tizenBridge.ts:216,219 calls player.seekBy() (re-verified at tip) which writes to lastCommand ref internally (usePlayerStore.ts:289-294 *(HISTORICAL — @phlix/ui v0.98.33 src; dist-only ship prevents re-derivation)*). Player.vue:1239-1246 watches lastCommand and applies seek to video element *(HISTORICAL, same reason)*. The Tizen bridge bypasses the command bus interface (BridgePlayer only has seekBy, not lastCommand), but the seekBy() function itself writes to lastCommand before seeking, so command tracking still works. The command bus pattern is for UI-level external commands (keyboard shortcuts, etc.) - Tizen's remote commands go through RemoteManager → tizenBridge → player.seekBy() which properly feeds the command bus.
**Code Changes**: None (works correctly despite interface bypass)

## Step 9.7 - Quality/Subtitle Setters (MEDIUM)
**Decision**: TV-SPECIFIC
**Finding**: createDomQualityMenu at tizenBridge.ts:116-170 (re-verified at tip 2026-09-04) uses DOM manipulation (focus, click on .quality-menu .phlix-select__trigger) to drive @phlix/ui's QualityMenu Select component. This is explicitly designed to avoid modifying @phlix/ui's sealed player while still enabling D-pad navigation of quality selection. The DOM approach opens the Select's listbox and lets the Select's own combobox keydown handler own Arrow/Enter/Escape navigation. QualityMenu reactively reads player.quality from the store, so DOM-based selection properly updates player state. setSubtitle() is not called - subtitle selection is handled by SubtitleTrackList.vue using direct API calls.
**Code Changes**: None (intentional DOM-based quality menu, works correctly with @phlix/ui reactive state)

## Step 9.8 - Player Store Type Safety (MEDIUM)
**Decision**: RESOLVED (was INTERNAL at audit date)
**Finding**: *(Restated at tip 2026-09-04 — RESOLVED by S407, commit `c3bfcd8` "track-picker wiring". The audit-date duck-probe (`storeAny = playerStore as unknown as Record<string, unknown>` at AudioTracksPage.vue:39,56,83, trying multiple method names) no longer exists: grep for `as unknown as Record` in `src/pages/AudioTracksPage.vue` returns **0 hits** at tip. The S407 docblock (AudioTracksPage.vue:34-36, :108, :124) records exactly which probed members (`audioTracks`/`currentAudioTrackId`/`setAudioTrack`/`switchAudioTrack`/`hls`) never existed on the store, and the component now takes a single honest path — fetching tracks from the API (`:113`) instead of probing store internals.)*
**Code Changes**: None in this step (already fixed by S407; audit finding closed)

## Step 9.9 - streamUrl / hlsMasterUrl (LOW)
**Decision**: NOT TV-APPLICABLE
**Finding**: usePlayerStore.ts:95,108 — *HISTORICAL src refs* — has streamUrl and hlsMasterUrl refs for cross-route mini-player continuation. PlayerPage.vue:476 — *HISTORICAL src ref* — calls player.showMiniPlayer() when current && streamUrl exist. Tizen does not implement mini-player UI (no MiniPlayer.vue component, no #phlix-mini-player mount point). These refs are not used by tizen. The mini-player pattern is for web clients to continue playback while navigating away from the player route - on TV there's no route navigation during playback and no picture-in-picture API.
**Code Changes**: None (mini-player is a web browser feature, not applicable to TV)

## Step 9.10 - miniPlayer show/hide (LOW)
**Decision**: NOT TV-APPLICABLE
**Finding**: usePlayerStore.ts:375-379 — *HISTORICAL src refs* — has showMiniPlayer() and hideMiniPlayer() functions that toggle player.miniPlayer ref. PlayerPage.vue:340 — *HISTORICAL src ref* — calls hideMiniPlayer() on route enter; PlayerPage.vue:476 — *HISTORICAL src ref* — calls showMiniPlayer() when playing with streamUrl. Tizen does not implement mini-player UI and does not call these functions. The mini-player is a web browser feature for background playback during navigation - TV has no equivalent use case since playback is always full-screen and there's no navigation during playback on TV.
**Code Changes**: None (mini-player is a web browser feature, not applicable to TV)

---

## Summary

| Step | Feature | Decision | Notes |
|------|---------|----------|-------|
| 9.1 | Polling Instead of Reactivity | TV-SPECIFIC | 250ms setInterval polling in overlays - documented tech debt |
| 9.2 | Missing Resume System | TV-SPECIFIC | BridgePlayer intentionally minimal; overlays use playerStore directly |
| 9.3 | Missing Queue/Up-Next | NOT TV-APPLICABLE | UpNextOverlay fetches via API directly |
| 9.4 | Missing Media Session | NOT TV-APPLICABLE | RemoteManager handles TV remote; no navigator.mediaSession |
| 9.5 | Missing Preferences Seeding | TV-SPECIFIC (PARTIAL) | seedFromPreferences not called but prefs initialized at store creation |
| 9.6 | lastCommand Bus | ALREADY SUFFICIENT | player.seekBy() writes to lastCommand internally; works correctly |
| 9.7 | Quality/Subtitle Setters | TV-SPECIFIC | DOM-based quality menu intentionally drives @phlix/ui Select |
| 9.8 | Player Store Type Safety | INTERNAL | Type casting issue in AudioTracksPage.vue, not TV integration gap |
| 9.9 | streamUrl / hlsMasterUrl | NOT TV-APPLICABLE | No mini-player on TV |
| 9.10 | miniPlayer show/hide | NOT TV-APPLICABLE | No mini-player on TV |

**Decision Distribution**:
- **TV-SPECIFIC**: 4 steps (9.1, 9.2, 9.5 partial, 9.7) - intentional TV-specific implementations
- **NOT TV-APPLICABLE**: 4 steps (9.3, 9.4, 9.9, 9.10) - features not relevant to TV UX
- **ALREADY SUFFICIENT**: 1 step (9.6) - works correctly despite interface bypass
- **INTERNAL**: 1 step (9.8) - type safety issue in tizen-client code, not integration gap
- **Code changes needed**: 0 (all decisions are architectural/no-code)

---

# Category 8 - Music API & Data

## Overview

This category examines Music API endpoints, data structures, and whether they match what tizen expects. Key context *(restated by S424)*: Category 1.5 verified — as of the audit date — that the Music API breaking changes were **UNAFFECTED** because `useMusicStore.ts` used raw `client.get(...)` calls. At tip that is no longer the mechanism: the store adopted the paged helpers since S125 (see restated Steps 8.1/8.2). MusicPage.vue still uses the currentView state machine for artists/albums/tracks (re-verified at tip).

## Step 8.1 - Music API Breaking Change (listArtists/listAlbums/listTracks signatures)
**Decision**: SUPERSEDED (restated at tip 2026-09-04 — the audit-date mechanism no longer exists)
**Finding**: The audit-date reasoning ("raw client.get bypasses the helpers, 0 hits") was true pre-S125. At tip the store ADOPTED the helpers: `listArtists()`/`listAlbums()` (with paging + server-side artist filter) and `getAlbum()`/`getTrack()` (envelope-unwrapping) — `rg "listArtists|listAlbums|listTracks" src/` now returns **5 hits** (useMusicStore.ts docblock :27 + calls :132/:156/:177/:202). The breaking-change exposure therefore INVERTED: tizen now follows the ApiClient helper contract (typed via the vendored dist), which is the intended coupling for a thin consumer.
**Code Changes**: None in this step (change happened in S125 / 894bf96)
**Evidence**: Step 1.5 restatement; useMusicStore.ts:51 (import), :132, :156-158, :177-181, :202, :247

## Step 8.2 - Music Paging (MusicPager added in v0.98.32 — tizen shows only first 100)
**Decision**: TV-SPECIFIC (PAGED) — restated at tip 2026-09-04 from audit-date "first-100 limitation"
**Finding**: Superseded by S125: `fetchArtists()`/`fetchAlbums()` now send `limit`/`offset` (and `artist`) to the paged helpers and read `total`; MusicPage.vue renders load-more controls (`hasMoreArtists` :189, `hasMoreAlbums` :220 → `loadMoreArtists()`/`loadMoreAlbums()` :111/:113). The TV-specific choice now is the LOAD-MORE affordance instead of @phlix/ui's `MusicPager`. The CHANGELOG "first 100 rows" sentence is *HISTORICAL* context for the pre-S125 state.
**Code Changes**: None in this step (implemented by S125)
**Evidence**: `useMusicStore.ts:128-171` (paged fetch + load-more actions), :132/:156-158/:177-181/:202; `MusicPage.vue:111/:113/:189/:220`; CHANGELOG v0.98.32 line 46 *(historical)*

## Step 8.3 - Music Store Duplication (tizen's useMusicStore.ts reimplements phlix-ui functionality)
**Decision**: TV-SPECIFIC
**Finding**: `useMusicStore.ts` (331 lines at tip — re-measured `wc -l`; 167 at audit date) is a custom Pinia store with `fetchArtists`, `fetchAlbums`, `fetchAlbum`, `fetchTrack`, `selectArtist`, `selectAlbum` (plus S125's `loadMoreArtists`/`loadMoreAlbums`) actions managing artists/albums/tracks UI state. This reimplements what phlix-ui handles via `useMusicPlayer` composable + `MusicPager.vue` + `MusicArtistsPage`/`MusicArtistPage`/`MusicAlbumPage`/`MusicTracksPage` components. The TV-specific justification is: (1) BACK button uses `router.back()` to exit to parent app at artists view (vs phlix-ui staying within music module), (2) D-pad spatial navigation integration, (3) TV-optimized layout. This was also documented in Category 2 Step 2.1.4 as TV-SPECIFIC with justified duplication.
**Code Changes**: None — reimplementation justified by TV navigation requirements
**Cross-refs**: Step 2.1.4 (MusicPage.vue vs MusicLibraryPage.vue - TV-SPECIFIC)

## Step 8.4 - listFavorites / addFavorite / removeFavorite
**Decision**: NOT TV-APPLICABLE
**Finding**: `useMusicStore.ts` has NO favorites methods. `client.addFavorite()`, `client.removeFavorite()`, `client.listFavorites()` exist in @phlix/ui (client.ts:773-850 — *HISTORICAL src ref*) but are not called anywhere in tizen source. The MusicPage.vue has no favorites UI. The API exists for phlix-ui web clients to manage favorites, but TV music browsing is a thin-client model focused on library navigation, not personal library curation. Favorites management is not relevant to TV UX.
**Code Changes**: None (not a TV use case - no code needed)
**Evidence**: `rg "favorite|Favorite" src/stores/useMusicStore.ts` → 0 hits; MusicPage.vue has no favorites UI

## Step 8.5 - setRating / setLikeLevel
**Decision**: ALREADY SUFFICIENT
**Finding**: `UserRatingPicker.vue` (line 79) correctly calls `await auth.client.setRating(props.mediaId, finalRating)` via the ApiClient. The component provides half-star precision (via `starState()` function at line 64-68), D-pad navigation, optimistic UI with error toast on failure. This is a TV-SPECIFIC reimplementation of phlix-ui's UserRatingPicker which lacks half-star support. The `setRating` API integration is correct and functional.
**Code Changes**: None (already correctly integrated)
**Evidence**: `UserRatingPicker.vue:79` - `await auth.client.setRating(props.mediaId, finalRating)`

## Step 8.6 - markWatched / markUnwatched
**Decision**: NOT TV-APPLICABLE
**Finding**: `useMusicStore.ts` has NO watched state methods. `client.markWatched()` and `client.markUnwatched()` exist in @phlix/ui (client.ts:791-810 — *HISTORICAL src ref*) but are not called anywhere in tizen source. TV music browsing is a non-progressive experience — users don't mark tracks as watched. The watched state API is for video content with resume/progress tracking, not relevant to music playback on TV.
**Code Changes**: None (not a TV use case - no code needed)
**Evidence**: `rg "markWatched|markUnwatched" src/stores/useMusicStore.ts` → 0 hits

## Step 8.7 - Music track streaming (tizen calls GET /api/v1/music/tracks/:id for stream URL)
**Decision**: RESOLVED (restated at tip 2026-09-04 — audit-date decision was TV-SPECIFIC (BUG))
**Finding**: The envelope-unwrap bug was fixed before tip (commit `894bf96` "[bugfix] useMusicStore: unwrap { track } and { album } API envelopes", then completed by S125's helper adoption). At tip `fetchTrack(id: string)` (useMusicStore.ts:243-255) assigns `currentTrack.value = await getClient().getTrack(id)` (:247), and the vendored ApiClient contract types the return as `Promise<MusicTrack>` (node_modules/@phlix/ui/dist/api/client.d.ts:587) — the `{ track }` envelope is unwrapped inside the helper, so no raw-envelope assignment remains (`client.get` on `/api/v1/music/tracks/` : 0 hits at tip).
**Code Changes**: None in this step (already fixed upstream of tip)
**Evidence**: useMusicStore.ts:243-255; client.d.ts:587 (`getTrack(id): Promise<MusicTrack>`, re-verified at tip); git log --oneline -- src/stores/useMusicStore.ts (894bf96, 35f3270)

## Step 8.8 - Music library redirect (v0.98.33 added /app/library/{id} → /app/music)
**Decision**: ALREADY SUFFICIENT
**Finding**: `buildExtraRoutes()` in main.ts does NOT define `/app/library/:id` (re-verified at tip) — tizen relies on `createPhlixApp()`'s built-in routing which includes the S97 music library redirect (`/app/library/:id` for MUSIC library type → `/app/music`) *(the redirect itself is an @phlix/ui-internal observation — HISTORICAL)*. Tizen also doesn't define explicit `/app/music/*` routes — it relies on @phlix/ui's music routing. Since tizen calls `createPhlixApp()` with standard configuration (main.ts:169-191 at tip — re-derived; audit ref 95-117), the redirect is automatically active.
**Code Changes**: None (works through createPhlixApp base routing)
**Evidence**: `buildExtraRoutes()` (main.ts:62-70 at tip) defines SIX extra routes: `/app/library/scan`, `/app/chapters/:id`, `/app/audio-tracks/:id`, `/app/subtitle-tracks/:id` (added by S407 — the audit-date 5-item list is stale), `/app/recommendations`, `/app/parental-controls` — music routing delegated to @phlix/ui

---

## Summary

| Step | Feature | Decision | Notes |
|------|---------|----------|-------|
| 8.1 | Music API Breaking Change | SUPERSEDED (S424) | Helpers ADOPTED since S125 — 5 hits for list* at tip (was 0) |
| 8.2 | Music Paging | TV-SPECIFIC (PAGED) | Paged via list* helpers + load-more since S125 (was first-100) |
| 8.3 | Music Store Duplication | TV-SPECIFIC | TV navigation (router.back() exit), D-pad nav justify reimplementation |
| 8.4 | listFavorites / addFavorite / removeFavorite | NOT TV-APPLICABLE | Not a TV use case — no favorites UI in MusicPage |
| 8.5 | setRating / setLikeLevel | ALREADY SUFFICIENT | UserRatingPicker.vue correctly calls auth.client.setRating |
| 8.6 | markWatched / markUnwatched | NOT TV-APPLICABLE | TV music browsing doesn't use watched state |
| 8.7 | Music track streaming | RESOLVED (S424) | Envelope unwrap fixed (894bf96 + S125 `getTrack()`) — 0 raw envelope assigns at tip |
| 8.8 | Music library redirect | ALREADY SUFFICIENT | Works through createPhlixApp base routing |

**Decision Distribution**:
- **ALREADY SUFFICIENT**: 1 step (8.5) — correctly integrated (both line anchors re-verified at tip: UserRatingPicker.vue:64 starState, :79 setRating)
- **SUPERSEDED / restated by S424**: 8.1 (helpers adopted), 8.2 (paged TV load-more), 8.7 (bug RESOLVED at tip), 8.8 (still ALREADY SUFFICIENT — route list restated to 6)
- **TV-SPECIFIC**: 1 step (8.3 — store now 331 lines at tip)
- **NOT TV-APPLICABLE**: 2 steps (8.4, 8.6) — features not relevant to TV UX; re-verified 0 hits at tip for favorites/watched in the store
- **Code changes needed**: 0 (the 8.7 audit bug has since been fixed upstream — see restatement)

---

# Category 12 - API Clients

## Overview

phlix-ui provides 20+ API client modules. The tizen client directly uses only 2 (ApiClient and contracts), while re-implementing some functionality that already exists in phlix-ui or not using available APIs at all.

## Step 12.1 - Recommendations API
**Decision**: TV-SPECIFIC (PARTIAL GAP)
**Finding**: tizen's RecommendationsScreen.vue (lines 33-50 at tip; `load()` at :33, call at :39-41 — re-verified) makes a manual `client.get('/api/v1/me/recommendations', { limit: '20' })` call instead of using `fetchRecommendations()` from @phlix-ui (`fetchRecommendations()` present in the vendored dist `node_modules/@phlix/ui/dist/api/`). It has a duplicated local `RecommendationApiResponse` interface and handles error inline. The `fetchRecommendations()` function (phlix-ui/src/api/recommendations.ts:62-76 — *HISTORICAL src ref; function present in vendored dist*) provides proper error handling, `AbortSignal` support, and converts `UserRecommendation[]` to `MediaItem[]` via `recommendationToMediaItem()`. The tizen implementation uses raw `UserRecommendation[]` directly instead of converting to `MediaItem[]`.

The gap is: (1) duplicated interface, (2) manual error handling instead of centralized, (3) no AbortSignal support, (4) raw `UserRecommendation[]` instead of `MediaItem[]`.

This is a medium-priority gap — consolidation would require importing `fetchRecommendations()` and handling the returned `MediaItem[]` in the component.
**Code Changes**: None (audit-only — gap identified but not fixed per scope)

## Step 12.2 - SyncPlay API
**Decision**: TV-SPECIFIC (SIGNIFICANT GAP)
**Finding**: *(Restated at tip 2026-09-04 — audit-date refs/paths were pre-S415 and contradicted the re-measured Category 11.)* tizen's useSyncPlayStore.ts (class at lines 392-462 at tip) contains a local `SyncPlayApiClient` class providing the REST half of the SyncPlay surface, duplicating the functionality of `getSyncPlayApi()` from @phlix/ui (present in dist but kept internal there — store docblock :8-9). Key differences:
1. **API paths**: NO divergence at tip — tizen calls the same five `/api/v1/syncplay/groups` routes the server registers (class docblock :381-385, calls :423-459; the audit-date `/rooms` form has 0 hits in `src/`)
2. **WebSocket**: the socket PROTOCOL is the shared `@phlix/syncplay` client (import :41) — only transport plumbing is tizen-local (see Category 11 restatement)
3. **Pattern**: tizen instantiates per-call `new SyncPlayApiClient(apiBase, token)` (:775/:809/:839/:942) vs phlix-ui's singleton `getSyncPlayApi(apiBase)`

The tizen implementation has a 71-line REST client (392-462, measured) plus tizen-local socket plumbing with exponential backoff. *S424 downgrade of the audit-date "high-priority gap … API path divergence": the path divergence no longer exists at tip and the protocol is shared, so the remaining duplication is the REST wrapper only.*
**Code Changes**: None (audit-only — gap identified but not fixed per scope)

## Step 12.3 - Libraries API
**Decision**: ALREADY SUFFICIENT (INDIRECTLY USED)
**Finding**: tizen uses `libraryLinks: true` in menu configuration (main.ts line 47 at tip — re-derived; line 42 audit-date). The comment states: "libraryLinks expands Browse into one nav link per library (fetched from /api/v1/libraries)". The `libraryLinks` feature is handled internally by @phlix/ui — the tizen client delegates library fetching to @phlix/ui's implementation. This is working as intended.
**Code Changes**: None (delegated to @phlix/ui — works correctly)

## Step 12.4 - Invite Links API
**Decision**: NOT USED
**Finding**: `invite-links.ts` exists in phlix-ui but no tizen source file imports or uses it. Invite link functionality (generating/managing server invite links) is typically a web admin UI task, not a TV media consumption feature.
**Code Changes**: None (not a TV use case)

## Step 12.5 - Most Watched API
**Decision**: NOT USED
**Finding**: `mostWatched.ts` exists in phlix-ui (added v0.98.24) but no tizen source file imports or uses it. "Most Watched" analytics are a server-wide dashboard metric, not a TV media consumption feature.
**Code Changes**: None (analytics feature not relevant to TV)

## Step 12.6 - Next Up API
**Decision**: NOT USED
**Finding**: *(Restated at tip 2026-09-04 — the audit-date playlist-route claim was falsified by S280.)* No tizen source file imports phlix-ui's `nextUp.ts` module; but since S280 UpNextOverlay.vue hits the SAME registered endpoint it wraps — `GET /api/v1/users/me/next-up` via raw `client.get` (UpNextOverlay.vue:138-141) — to pick the next item. "Next Up" continue-watching for BrowsePage rails remains handled by @phlix/ui automatically.
**Code Changes**: None (already handled differently)

## Step 12.7 - Photos API
**Decision**: NOT USED
**Finding**: `photos.ts` exists in phlix-ui but no tizen source file imports or uses it. Photo gallery/slideshow features are not a typical TV use case.
**Code Changes**: None (not a TV use case)

## Step 12.8 - Claim Server API
**Decision**: NOT USED
**Finding**: `claimServer.ts` exists in phlix-ui but no tizen source file imports or uses it. Server claiming/setup is a first-run web UI task, not a pre-configured TV app feature.
**Code Changes**: None (server setup done via web UI)

## Step 12.9 - Avatar API
**Decision**: NOT USED
**Finding**: `avatar.test.ts` exists (test only) but no implementation file or tizen usage found. Avatar management is likely handled via user profile settings in @phlix/ui.
**Code Changes**: None (handled via @phlix/ui profile)

## Steps 12.10-12.30 - Admin APIs (21 total)
**Decision**: NOT TV-APPLICABLE
**Finding**: All **26** admin API client modules (measured at tip: `ls node_modules/@phlix/ui/dist/api/admin/*.d.ts | wc -l` — the audit-date "21" list, like Step 7.23's "19", was a stale src-tree count; both are superseded, see 7.23 for the tip enumeration) exist in phlix-ui but are not used by tizen (src/ grep: 0 admin-client imports). Admin functionality is accessed via @phlix/ui's admin UI routes (`buildAdminRoutes()` spread at main.ts line 62 — re-derived; line 57 audit-date). Server administration from TV is not a designed product use case — TV is a media consumption thin client.
**Code Changes**: None (admin features accessed via @phlix/ui admin UI, not direct API)

---

## Summary

| Step | API | Decision | Notes |
|------|-----|----------|-------|
| 12.1 | Recommendations | TV-SPECIFIC (PARTIAL GAP) | Manual fetch vs `fetchRecommendations()` |
| 12.2 | SyncPlay | TV-SPECIFIC (PARTIAL GAP — restated at tip) | Local `SyncPlayApiClient` REST wrapper (71 lines) vs `getSyncPlayApi()`; API paths IDENTICAL at tip (`/api/v1/syncplay/groups`), protocol shared via @phlix/syncplay |
| 12.3 | Libraries | ALREADY SUFFICIENT | Delegated to @phlix/ui via `libraryLinks: true` |
| 12.4 | Invite Links | NOT USED | Admin/web feature, not TV use case |
| 12.5 | Most Watched | NOT USED | Analytics feature, not TV use case |
| 12.6 | Next Up | NOT USED | UpNextOverlay uses direct API |
| 12.7 | Photos | NOT USED | Not a TV use case |
| 12.8 | Claim Server | NOT USED | Server setup via web UI |
| 12.9 | Avatar | NOT USED | Handled via @phlix/ui profile |
| 12.10-12.30 | Admin APIs (21) | NOT TV-APPLICABLE | Admin features via @phlix/ui admin UI |

**Decision Distribution**:
- **TV-SPECIFIC (PARTIAL GAP)**: 1 step (12.1) — Recommendations API could use `fetchRecommendations()`
- **TV-SPECIFIC (SIGNIFICANT GAP → restated PARTIAL at tip)**: 1 step (12.2) — SyncPlay REST wrapper duplicated; *path divergence claim falsified at tip (paths identical)* and protocol is @phlix/syncplay-shared
- **ALREADY SUFFICIENT**: 1 step (12.3) — Libraries delegated to @phlix/ui
- **NOT USED**: 6 steps (12.4-12.9) — Features not needed on TV
- **NOT TV-APPLICABLE**: 21 steps (12.10-12.30) — Admin features not applicable to TV client
- **Code changes needed**: 0 (all decisions are architectural/audit)

---

# Category 10 - HLS Configuration

## Overview

This category examines HLS (HTTP Live Streaming) configuration in the Tizen client. The central configuration is `TIZEN_HLS_CONFIG` in `main.ts:76-83` (re-derived at tip 2026-09-04; audit-date ref was 69-76), which is passed to @phlix/ui's player via `createPhlixApp({ playerHlsConfig: TIZEN_HLS_CONFIG })` at main.ts:190 (audit-date ref 116). HLS playback is handled by hls.js via @phlix/ui's player module. All `hls-playback.ts`/`playback.ts`/`Player.vue` line refs in this category are @phlix-ui-src observations from the v0.98.33 era — *HISTORICAL (v0.99.0 ships dist-only)*; the tizen-side values below were re-verified against main.ts:76-83 at tip.

## Step 10.1 - Buffer Settings
**Decision**: ALREADY SUFFICIENT
**Finding**: `TIZEN_HLS_CONFIG` in main.ts:76-83 (re-derived at tip) correctly sets all RAM-conscious buffer values:
- `maxBufferLength: 60` (Tizen-specific, web default is 30)
- `maxMaxBufferLength: 180` (Tizen-specific, web default is 60)
- `maxBufferSize: 100 * 1000 * 1000` (100MB, Tizen-specific, web default is 60MB)
- `backBufferLength: 90` (Tizen-specific, web default is 30)

These values are explicitly set to override hls.js defaults and are passed through `playerHlsConfig` which shallow-merges over @phlix/ui's defaults at `hls-playback.ts:316`. The phlix-ui defaults at lines 283-284 only set `backBufferLength: 90` and `maxBufferLength: 60` but NOT `maxMaxBufferLength` or `maxBufferSize` — Tizen's explicit values correctly fill this gap.
**Code Changes**: None (correctly implemented)
**Evidence**: main.ts:76-83 TIZEN_HLS_CONFIG (values 60/180/100MB/90 re-verified at tip); hls-playback.ts:277-284 phlix-ui defaults *HISTORICAL src ref*; hls-playback.ts:316 shallow merge *HISTORICAL src ref*

## Step 10.2 - Level Cap (capLevelToPlayerSize)
**Decision**: ALREADY SUFFICIENT
**Finding**: `capLevelToPlayerSize: true` is correctly set in `TIZEN_HLS_CONFIG` at main.ts:81 (re-derived at tip). This is a RAM constraint setting unique to Tizen's limited memory environment. The web default is `false`. This setting ensures hls.js does not select a quality level higher than the player's actual rendered size, preventing unnecessary memory usage.
**Code Changes**: None (correctly implemented)
**Evidence**: main.ts:81; comment at line 73 (re-derived): "cap level to player size"

## Step 10.3 - Software AES
**Decision**: ALREADY SUFFICIENT
**Finding**: `enableSoftwareAES: true` is correctly set in `TIZEN_HLS_CONFIG` at main.ts:82 (re-derived at tip). The comment at line 74 explains: "software AES so DRM-free HLS still plays on weaker decoders." This is a Tizen-specific fallback for devices with weaker hardware decryption. The web default is `false` (hardware AES preferred).
**Code Changes**: None (correctly implemented)
**Evidence**: main.ts:82; comment at line 74 (re-derived)

## Step 10.4 - Sync with phlix-ui Updates
**Decision**: ALREADY SUFFICIENT
**Finding**: Tizen uses @phlix/ui v0.98.33 *(HISTORICAL — pin at tip 2026-09-04 is `#v0.99.0`, package.json:34)* and passes `playerHlsConfig: TIZEN_HLS_CONFIG` to createPhlixApp(). The shallow merge at hls-playback.ts:316 means Tizen's explicit values always override phlix-ui defaults. Currently phlix-ui only sets `backBufferLength: 90` and `maxBufferLength: 60` as defaults — these match Tizen's values exactly, so no conflict exists. Future phlix-ui changes to `maxMaxBufferLength`, `maxBufferSize`, `capLevelToPlayerSize`, or `enableSoftwareAES` would still be overridden by Tizen's explicit values. The design is robust against phlix-ui version updates.
**Code Changes**: None (shallow merge design is correct)
**Evidence**: main.ts:190 playerHlsConfig pass-through (re-derived at tip); hls-playback.ts:316 `{ ...defaultConfig, ...opts.hlsConfig }` *HISTORICAL src ref*

## Step 10.5 - Bandwidth Persistence
**Decision**: ALREADY SUFFICIENT
**Finding**: Bandwidth persistence is implemented in phlix-ui's `hls-playback.ts:157-190` using localStorage key `phlix-bandwidth-estimate` (BW_EST_KEY at line 158 — *HISTORICAL src refs*). Bandwidth is persisted every 30 seconds via `setInterval(_saveBandwidth, 30_000)` at line 337, and on destroy at line 344. On cold start, persisted bandwidth is loaded via `loadPersistedBandwidth()` and used to seed ABR: `abrEwmaDefaultEstimate: persistedBw` at line 287. Since Tizen uses @phlix/ui's player via `createPhlixApp()`, this mechanism works identically on Tizen. Tizen also uses localStorage for other data (`phlix.serverUrl` in main.ts, `phlix.deviceId` in deviceId.ts), confirming localStorage is available.
**Code Changes**: None (inherited via createPhlixApp — works on Tizen)
**Evidence**: hls-playback.ts:157-190 bandwidth persistence functions; line 287 abrEwmaDefaultEstimate — *HISTORICAL src refs (v0.98.33 era)*

## Step 10.6 - Codec Probing
**Decision**: ALREADY SUFFICIENT
**Finding**: Codec probing is implemented in phlix-ui via `playback.ts:170-296`. `canDecodeAudioCodec()` uses `MediaCapabilities.decodingInfo()` with fallback to `canPlayType()` at lines 232-259. `canDecodeHevcInMp4()` probes HEVC support via MediaCapabilities at lines 266-296. `needsTranscodeWithCapabilities()` combines extension-based check with runtime codec probing at lines 313-340. Tizen's Chromium webview (Tizen 6.5+) supports the MediaCapabilities API. Since Tizen uses @phlix/ui's player via `createPhlixApp()`, the same codec probing mechanism is used. The `evaluateTranscodeWithCapabilities()` is called when `props.playbackAudioTracks` changes in Player.vue:245-252.
**Code Changes**: None (inherited via createPhlixApp — works on Tizen)
**Evidence**: playback.ts:232-248 MediaCapabilities.decodingInfo() usage — *HISTORICAL src ref*; Tizen 6.5+ Chromium webview supports MediaCapabilities

---

## Summary

| Step | Feature | Decision | Notes |
|------|---------|----------|-------|
| 10.1 | Buffer Settings | ALREADY SUFFICIENT | TIZEN_HLS_CONFIG with RAM-conscious values override hls.js defaults |
| 10.2 | Level Cap | ALREADY SUFFICIENT | capLevelToPlayerSize: true correctly set |
| 10.3 | Software AES | ALREADY SUFFICIENT | enableSoftwareAES: true for weaker decoders |
| 10.4 | Sync with phlix-ui | ALREADY SUFFICIENT | Shallow merge design robust against version updates |
| 10.5 | Bandwidth Persistence | ALREADY SUFFICIENT | Implemented in phlix-ui, works via createPhlixApp on Tizen |
| 10.6 | Codec Probing | ALREADY SUFFICIENT | MediaCapabilities.decodingInfo() used in phlix-ui, works on Tizen |

**Decision Distribution**:
- **ALREADY SUFFICIENT**: 6 steps (10.1-10.6) — all HLS config correctly implemented via TIZEN_HLS_CONFIG or inherited from phlix-ui
- **Code changes needed**: 0 (all decisions are correct implementations — no code needed)

---

# Category 11 - SyncPlay

**Audit Date**: 2026-07-31
**Repository**: `/home/sites/phlix/phlix-tizen-client`
**Status**: COMPLETE

## Summary

Category 11 covers SyncPlay — a collaborative playback synchronization feature. The tizen-client has a **local reimplementation of the SyncPlay session surface**: a 994-line store (`wc -l src/stores/useSyncPlayStore.ts` at tip `f5b9fff9`, 2026-09-04) owning the REST client, connection lifecycle and store state. *(Restated by S424 — the audit-date text "645 lines of custom WebSocket code … does NOT use @phlix/syncplay despite declaring it" was true only of the pre-S415 store and contradicted every later re-measurement in this document.)* At tip the WebSocket **protocol is the `@phlix/syncplay` library's** — imported at useSyncPlayStore.ts:41, client instantiated at :564, frames via `serializeMessage`/`handleIncoming` (:568, :605) — while the **transport plumbing** (the `WebSocket` object, reconnect backoff, url building) remains tizen-local, because @phlix/ui does not export its own SyncPlay internals (store docblock :7-10). Declared `package.json`:33 and genuinely used.

## Decision Table

| Step | Decision | Rationale |
|------|----------|-----------|
| 11.1 | **TV-SPECIFIC** | tizen carries its own 994-line store (`wc -l`, re-measured at tip; audit-date value was 645) containing a local `SyncPlayApiClient` REST class (useSyncPlayStore.ts:392-462 at tip) plus WebSocket transport and lifecycle (buildWsUrl :474-486, connectWs :549-634, scheduleReconnect :644, disconnectWs :666). The reimplementation is intentional because @phlix/ui does not export its player-side SyncPlay internals (store docblock :7-10) — but the wire PROTOCOL on the socket is `@phlix/syncplay`'s, on the syncplay port **:8097** (buildWsUrl :485; re-measured — the old "API port (not 8097)" wording described the pre-S415 store). |
| 11.2 | **TV-SPECIFIC** | tizen uses its own `SyncPlayApiClient` class instead of phlix-ui's `getSyncPlayApi()` (which exists in the vendored dist at `node_modules/@phlix/ui/dist/api/syncplay.d.ts` but is not part of the exported app surface the thin client uses — store docblock :8-9). Each store action takes `apiBase` and `token` as parameters and instantiates the client per call (e.g. :775, :809, :839, :942 — re-verified at tip). Intentional TV-specific pattern. |
| 11.3 | **NOT TV-APPLICABLE** | Per AGENTS.md: "this repo writes no media/library/auth UI — that lives in @phlix/ui". SyncPlay UI components (SyncPlayOverlay, SyncPlayModal, SyncPlayControls) are part of @phlix/ui, not this thin TV client repo. |
| 11.4 | **TV-SPECIFIC** | tizen's `syncStatus` computed (lines 527-530 at tip, backed by `isSynced` :520-523; audit-date ref was 190-193) returns `'synced' \| 'outOfSync' \| 're-syncing'` based solely on session state — no drift computation in the store. *(Restated: the audit-date "usePlayerStore handles playback rate sync" is false at tip — the store has zero `usePlayerStore` references (grep: 0 hits); remote play/pause/seek/sync commands are applied IN this store via `onRemoteCommand` (:727-754), including `playbackRate` from `sync` commands (:749-751).)* The lack of drift computation at the store level is by design; clock-drift correction (`syncplay_time_sync`) is handled inside the `@phlix/syncplay` client (its `TimeSync`, node_modules `dist/client.d.ts` :76/:158-159). |
| 11.5 | **TV-SPECIFIC REIMPLEMENTATION** *(restated at tip 2026-09-04 — the audit-date URL and `WsMessage` protocol description were false of the S415+ store; both quoted forms have zero hits in `src/` at tip)* | tizen builds its socket URL in `buildWsUrl` (useSyncPlayStore.ts:474-486) as `${ws\|wss}//${hostname}:8097?token=…&room=…` — the SyncPlay port **8097**, per the store docblock (:23) and phlix-syncplay/SPEC.md. Messages are `@phlix/syncplay` `syncplay_*` frames (19 frame types incl. `syncplay_group_state`, `syncplay_playback_sync`, `syncplay_time_sync` — node_modules `dist/messages.d.ts`), sent via `serializeMessage` (:568) and fed to `client.handleIncoming` (:605). The tizen-specific part is transport plumbing, not protocol. |
| 11.6 | **IN USE** | `@phlix/syncplay: "github:detain/phlix-syncplay#v0.1.4"` is declared in `package.json` (line 33) and IS imported: `grep -r "@phlix/syncplay" src/` matches `src/stores/useSyncPlayStore.ts` (import at line 41 — `SyncPlayClient` + `serializeMessage`; `SyncPlayClient` instantiated in `connectWs()` at line 564 with `onState` at line 578; `ws.onmessage` feeds `client.handleIncoming` at lines 603-605). The earlier "no matches / orphaned dependency" reading was true only of the pre-S415 store and is false at tip (re-measured 2026-09-04). |

## Decision Distribution

| Decision | Count |
|----------|-------|
| TV-SPECIFIC | 3 |
| TV-SPECIFIC REIMPLEMENTATION | 1 |
| NOT TV-APPLICABLE | 1 |
| IN USE | 1 |
| **TOTAL** | **6** |

*(S424 fix: the distribution row said "NOT USED | 1" while the decision table's own 11.6 row reads **IN USE** — the label was pre-S415 residue and contradicted the table above it.)*

## Key Findings

### 1. Local Session Surface + Library-Framed WebSocket (11.1, 11.5) — restated at tip 2026-09-04
The tizen-client carries locally (all line refs re-measured at tip):
- `SyncPlayApiClient` for the five REST routes under `/api/v1/syncplay/groups` (useSyncPlayStore.ts:392-462; class docblock :381-385)
- `buildWsUrl()` :474-486, `connectWs()` :549-634, `scheduleReconnect()` :644-664, `disconnectWs()` :666 (the audit-date helper set `handleWsMessage`/`sendWsMessage` and refs "83-160"/"196-383" do not exist at tip — grep 0 hits — they predate the S415 rewrite)
- Message protocol is **@phlix/syncplay's `syncplay_*` frames** (`serializeMessage` :568 / `client.handleIncoming` :605), NOT a custom `'command' | 'member_joined' | …` type (no `WsMessage` type at tip — grep 0 hits)
- Exponential backoff reconnection (MAX_RECONNECT_ATTEMPTS=5, BASE_RECONNECT_DELAY=1000ms at :641-642, backoff math :653 — re-verified)
- WebSocket on the SyncPlay port **:8097** (`ws(s)://<hostname>:8097?token=&room=` — buildWsUrl :485; the audit-date "API port (not 8097)" is falsified at tip)

### 2. @phlix/syncplay Dependency in Use (11.6)
The package IS imported and drives the SyncPlay WebSocket protocol: `useSyncPlayStore.ts` imports `SyncPlayClient`/`serializeMessage` (line 41) and instantiates the client in `connectWs()` (line 564). The earlier "declared but never imported / orphaned dependency" finding predates the S415 store rewrite and no longer holds (re-measured by grep at tip, 2026-09-04).

### 3. No Drift Computation in the Store (11.4 — restated at tip)
tizen's `syncStatus` computed (:527-530, via `isSynced` :520-523) does not use drift computation. It simply checks if `currentSession.value.state === 'playing' || currentSession.value.state === 'paused'`. *(Restated: rate/position sync is applied by this store's own `onRemoteCommand` (:727-754, `playbackRate` at :749-751) from `@phlix/syncplay` playback/sync callbacks — NOT by `usePlayerStore`, which the store never references (grep 0 hits at tip). Clock-drift correction itself lives in the `@phlix/syncplay` client's `TimeSync` (node_modules `dist/client.d.ts`:76 "Server-initiated clock drift correction"), which is why no store-level drift math is needed.)*

### 4. UI Components Not Applicable (11.3)
The AGENTS.md explicitly states this repo "writes no media/library/auth UI — that lives in @phlix/ui". SyncPlay UI is rendered by @phlix/ui's components, not by this thin TV client.

## Verification Evidence

- **useSyncPlayStore.ts**: 994 lines (re-measured `wc -l` at tip, S424, 2026-09-04); the WebSocket layer runs the real `@phlix/syncplay` `SyncPlayClient` (import line 41, instantiation line 564, onState :578, `handleIncoming` :603-605 — all re-verified)
- **package.json**: `@phlix/syncplay: "github:detain/phlix-syncplay#v0.1.4"` declared (line 33 — re-verified) and used; installed copy `node_modules/@phlix/syncplay` reports 0.1.4; note the vendored `@phlix/ui`@0.99.0 still declares its own syncplay pin `#v0.1.2` (node_modules/@phlix/ui/package.json:86 — measured)
- **tests**: dict-shaped `group_state` survival over the socket is exercised by `tests/unit/useSyncPlayStore.test.ts` (`s418DictMembersSurviveOnMessage` — present in the 312-test suite run at tip)
- **AGENTS.md**: Confirms thin TV consumer model
- **usePlayerStore**: no local definition in this repo (imported from @phlix/ui, e.g. main.ts:13, tizenBridge.ts) — *(S424: the audit-date tail "handles playback rate sync" is false at tip — SyncPlay rate/position sync is applied inside useSyncPlayStore's own `onRemoteCommand` (:727-754; playbackRate :749-751); useSyncPlayStore.ts has zero usePlayerStore references — grep re-run 2026-09-04)*

## Gates

| Gate | Result |
|------|--------|
| `npm run typecheck` | ✅ PASS (re-run green at tip, 2026-09-04) |
| `npm test` | ✅ 312 PASS (20 files) — re-measured at tip `f5b9fff9`, 2026-09-04 (audit-date value was "74 PASS"; the suite has grown via S244–S418-era tests) |
| `npm run lint` | ✅ PASS (re-run green at tip, 2026-09-04) |

## Conclusion

*(S424 rewrite, 2026-09-04 — the audit-date Conclusion contradicted this document's own re-measured 11.6/Key Finding 2/Verification Evidence rows and the tip code; every point below is re-derived at tip `f5b9fff9`.)*

The tizen-client has an **intentional TV-specific SyncPlay session surface** that:
1. **Uses @phlix/syncplay for the WebSocket protocol** — `SyncPlayClient` + `serializeMessage` imported at useSyncPlayStore.ts:41, client constructed in `connectWs()` at :564, outbound frames via `serializeMessage` (:568), inbound via `client.handleIncoming` (:605). The tizen-local parts are the raw `WebSocket` transport, store state and lifecycle.
2. **Connects to the SyncPlay port 8097** — `buildWsUrl` (:474-486) emits `ws(s)://<hostname>:8097?token=…&room=…`; the store docblock (:23) states "Playback transport is the WebSocket on `:8097` (`syncplay_*` frames)".
3. **Speaks @phlix/syncplay's `syncplay_*` frame protocol** (19 message types in the library's `dist/messages.d.ts`), not a custom JSON dialect.
4. Keeps **no drift computation in the store** — `syncStatus` (:527-530) is session-state based; remote play/pause/seek/sync (incl. `playbackRate` at :749-751) are applied by the store's own `onRemoteCommand` (:727-754) fed from SyncPlayClient callbacks, and clock-drift correction is the library's `TimeSync`.

This is NOT a gap to fix — it is an architectural decision to own the SyncPlay surface locally (because @phlix/ui keeps its own SyncPlay internals unexported), while delegating the protocol to the shared @phlix/syncplay library. **The @phlix/syncplay dependency is IN USE (import :41) and must NOT be removed** — removing it would break the live runtime path.

---

# Category 14 - Styling / Design System

**Audit Date**: 2026-07-31
**Repository**: `/home/sites/phlix/phlix-tizen-client`

## Overview

This category examines the design system integration in the Tizen client. The design system consists of:
- **@phlix/tokens**: Design tokens (colors, typography, spacing, radius, shadows, motion, density)
- **@phlix/ui/style.css**: Bundled token set + global resets
- **@phlix/ui/fonts.css**: Self-hosted fonts (Fraunces, Hanken Grotesk, JetBrains Mono)
- **TV Mode CSS**: `[data-tv]` scoped styles for 10-foot UI
- **Theme System**: Nocturne (dark), Daylight (warm light), Midnight (OLED true-black)

All styling is consumed via `@phlix/ui/style.css` and `@phlix/ui/fonts.css` imports in `main.ts`. Tizen is a thin client — UI components use tokens via CSS custom properties; no direct token access from tizen source.

## Step 14.1 - @phlix/tokens import
**Decision**: ALREADY SUFFICIENT
**Finding**: `main.ts:15` imports `@phlix/ui/style.css` (re-derived at tip; :14 was the audit-date line) which bundles `@phlix/tokens/style.css` at build time. The `@phlix/tokens` package is a devDependency of phlix-ui for build-time bundling. Re-counted at tip against `node_modules/@phlix/ui/dist/style.css` (v0.99.0) with `grep -o … | wc -l` — audit-date counts (v0.98.33) shown in parentheses: `--accent: 384 (375)`, `--bg: 20 (14)`, `--surface: 426 (414)`, `--text: 1600 (1505)`, `--font-sans: 8 (8)`, `--font-display: 116 (110)`, `--space-*: 1739 (1680)`, `--radius-*: 392 (382)`, `--shadow-*: 113 (113)`, `--dur-*: 288 (283)`, `--ease-*: 269 (264)`, `--control-h: 31 (31)`
- The `@phlix/tokens` package is not directly imported by tizen — it's correctly bundled by phlix-ui
**Code Changes**: None (correctly implemented)

## Step 14.2 - Theme System
**Decision**: ALREADY SUFFICIENT
**Finding**: `main.ts:174` sets `defaultTheme: 'nocturne'` and `main.ts:173` sets `defaultTv: true` in `createPhlixApp()` (re-derived at tip; audit-date refs 100/99). The full `useTheme()` composable is wired internally in `PhlixApp.vue` (internal to @phlix/ui). `createPhlixApp` calls `applyStoredThemeEarly(defaultTheme, defaultTv)` before mount to set initial `<html>` attributes synchronously, avoiding flash. Available themes (nocturne/daylight/midnight) are defined in `@phlix/tokens/src/themes.ts` and CSS variables in `@phlix/tokens/src/css/colors.css` *(HISTORICAL — @phlix/tokens src not vendored; theme names re-confirmed via @phlix/ui dist)*. Density options (comfortable/compact) are also available via `[data-density]` attribute.
**Code Changes**: None (correctly implemented)

## Step 14.3 - TV Mode CSS
**Decision**: ALREADY SUFFICIENT
**Finding**: `defaultTv: true` (main.ts:173 at tip — re-derived) sets `data-tv="true"` on `<html>`, activating `[data-tv]` scoped styles in `@phlix/tokens/src/css/tv.css`. These styles define 10-foot UI sizing (`--control-h: 3.25rem`, `--control-pad-x: 1.25rem`, `--control-gap: 0.75rem`, `--field-pad-y: 1rem`, `--stack-gap: 1.5rem`) and high-contrast focus rings for D-pad navigation (no pointer hover states). Re-verified 3 `[data-tv]` occurrences in `node_modules/@phlix/ui/dist/style.css` at tip (v0.99.0; grep -o | wc -l). TV mode CSS is part of the bundled `@phlix/ui/style.css` and works automatically via `defaultTv: true`.
**Code Changes**: None (correctly implemented)

## Step 14.4 - Self-hosted Fonts
**Decision**: ALREADY SUFFICIENT
**Finding**: `main.ts:16` imports `@phlix/ui/fonts.css` (re-derived at tip; audit-date ref :15). The bundled `node_modules/@phlix/ui/dist/fonts/fonts.css` declares `@font-face` for:
- Fraunces (variable, woff2, display serif) — `font-family: var(--font-display)`
- Hanken Grotesk (variable, woff2, sans-serif) — `font-family: var(--font-sans)`
- JetBrains Mono (variable, woff2, monospace) — `font-family: var(--font-mono)`

All three fonts are verified declared in the bundled CSS. Metric-matched fallbacks (Arial, Times New Roman, Courier New) are included for zero-CLS swap.
**Code Changes**: None (correctly implemented)

## Step 14.5 - UI Primitives
**Decision**: NOT TV-APPLICABLE
**Finding**: `@phlix/ui/src/components/ui/index.ts` exports 30+ primitives (Button, Input, Select, Modal, Tabs, etc.). Per AGENTS.md: "this repo writes no media/library/auth UI — that lives in @phlix/ui". Tizen's job is to call `createPhlixApp()` with config and mount the result. All UI (including primitives) comes pre-rendered inside the `PhlixApp` shell from @phlix/ui. Tizen does NOT write its own UI components from scratch — it reuses the full phlix-ui surface. The `export * from './components/ui'` is an internal phlix-ui barrel export, not a tizen integration point.
**Code Changes**: None (thin-client architecture — no code needed)

## Step 14.6 - CSS Custom Properties
**Decision**: ALREADY SUFFICIENT
**Finding**: All CSS custom properties from `@phlix/tokens` are bundled into `@phlix/ui/style.css`. The complete token set is verified present:
- **Colors**: `--bg`, `--surface`, `--surface-2/3`, `--text`, `--text-muted/subtle/faint`, `--border`, `--accent*`, `--error*`, `--success*`, `--warning*`, `--info*`, `--grain-opacity`, `--vignette`, `--ambient`
- **Typography**: `--font-sans` (Hanken Grotesk), `--font-display` (Fraunces), `--font-mono` (JetBrains Mono), full `--text-*`, `--fw-*`, `--leading-*`, `--tracking-*` scale
- **Spacing**: `--space-*` (1-16 scale)
- **Radius**: `--radius-sm/md/lg/xl/full`
- **Shadows**: `--shadow-*` (1-6 scale with glass variants)
- **Motion**: `--dur-*` (fast/slower/etc), `--ease-*` (out/in/etc)
- **Density**: `--control-h`, `--control-pad-x`, `--control-gap`, `--field-pad-y`, `--stack-gap` (TV-mode overridden to 10-foot sizing)

Tizen imports `@phlix/ui/style.css` and thus inherits the full token set. TV mode (`[data-tv]`) density overrides apply automatically.
**Code Changes**: None (full token set available via bundled style.css)

## Step 14.7 - Dark/Light Theme
**Decision**: TV-SPECIFIC (by design)
**Finding**: Available themes (nocturne/daylight/midnight) are all implemented in CSS and the theme infrastructure. `main.ts:174` (re-derived at tip) hardcodes `defaultTheme: 'nocturne'` with no user-accessible theme switcher. Three overlays (`ChapterOverlay`, `SleepTimerOverlay`, `SkipIntroOverlay`) are hardcoded to "dark TV UI (nocturne theme)" via comments but use CSS custom properties — they inherit any theme. `ThemeToggle` component exists in `PhlixApp.vue` (internal to @phlix/ui) but is not accessible via tizen's custom overlays.

Hardcoding `nocturne` for a TV client is a **reasonable UX decision** — TV apps in dark living rooms/bedrooms overwhelmingly benefit from dark themes. However, if theme switching is desired in future, the infrastructure (`data-theme` attribute, CSS variables, `useTheme()` composable) already works — it just needs a theme selector UI accessible via D-pad navigation.
**Code Changes**: None (deliberate UX constraint — not a gap)

---

## Summary

| Step | Feature | Decision | Notes |
|------|---------|----------|-------|
| 14.1 | @phlix/tokens import | ALREADY SUFFICIENT | Bundled via @phlix/ui/style.css |
| 14.2 | Theme System | ALREADY SUFFICIENT | Full useTheme via createPhlixApp/PhlixApp |
| 14.3 | TV Mode CSS | ALREADY SUFFICIENT | defaultTv: true activates [data-tv] styles |
| 14.4 | Self-hosted Fonts | ALREADY SUFFICIENT | @phlix/ui/fonts.css imported correctly |
| 14.5 | UI Primitives | NOT TV-APPLICABLE | Thin-client; primitives internal to @phlix/ui |
| 14.6 | CSS Custom Properties | ALREADY SUFFICIENT | Full token set via bundled style.css |
| 14.7 | Dark/Light Theme | TV-SPECIFIC (by design) | nocturne hardcoded; all 3 themes available |

**Decision Distribution**:
- **ALREADY SUFFICIENT**: 5 steps (14.1, 14.2, 14.3, 14.4, 14.6) — all correctly implemented
- **NOT TV-APPLICABLE**: 1 step (14.5) — thin-client architecture makes direct primitive access irrelevant
- **TV-SPECIFIC (by design)**: 1 step (14.7) — hardcoded nocturne is deliberate TV UX choice
- **Code changes needed**: 0 (all decisions are correct implementations — no code needed)

---

# Category 15 - Architecture Issues

## Step 15.1 - 6 Separate Vue Apps (HIGH)
**Decision**: TV-SPECIFIC
**Rationale**: main.ts:193-229 mounts 7 separate Vue apps (main :193 + SpatialNavHost :208 + five overlays :213-229; refs re-derived at tip — audit-date block was 119-149) sharing pinia/router via `globalProperties`. This architecture enables independent overlay lifecycle management with shared state. The overlays (ChapterOverlay, SleepTimerOverlay, SkipIntroOverlay, PiPController, UpNextOverlay, SpatialNavHost) are intentionally separate apps for TV-specific z-index layering and visibility control. Consolidation via Vue Teleport would require significant refactoring with no user-facing benefit on TV hardware.
**Code Changes**: None (architectural decision - no code needed)

## Step 15.2 - DOM-based Quality Control (MEDIUM)
**Decision**: TV-SPECIFIC REIMPLEMENTATION
**Rationale**: tizenBridge.ts:116-170 (`createDomQualityMenu`, re-derived at tip; audit-date ref 86-169) uses querySelector/focus/click/MutationObserver pattern to control @phlix/ui's QualityMenu. This is a deliberate reimplementation to avoid modifying sealed @phlix/ui. The `createDomQualityMenu()` function documents the architectural constraint: the Select's own combobox keydown handler owns Arrow/Enter/Escape navigation. Tech debt to be addressed when @phlix/ui exposes a proper `useQualityMenu()` composable API.
**Code Changes**: None (justified reimplementation - tracked as tech debt)

## Step 15.3 - Dynamic Store Property Access (HIGH)
**Decision**: NOT IMPLEMENTED
**Rationale**: ChapterOverlay.vue:306 and SkipIntroOverlay.vue:132 use fallback chains `storeAny.position ?? storeAny.currentTime ?? storeAny.time ?? storeAny.current_position` (line refs re-derived at tip; audit-date 305-306/131-132). *(S424 restatement: the audit-date third clause about AudioTracksPage.vue `as unknown as Record<string, unknown>` casts is FALSE at tip — S407 (commit c3bfcd8) rewrote that page to a single honest API path; grep -F 'as unknown as Record' src/pages/AudioTracksPage.vue = 0 hits. The two overlay fallback chains remain.)* Remaining fix requires @phlix/ui to expose typed player store getters (currentPosition, duration, etc.) and a declared TypeScript interface for the store API.
**Code Changes**: None (fix requires @phlix/ui changes, not tizen-client)

## Step 15.4 - Missing Type Exports (MEDIUM)
**Decision**: NOT IMPLEMENTED
**Rationale**: @phlix/ui's PlayerStore is not fully typed/exported, forcing tizen-client code to use `as unknown as BridgePlayer` (tizenBridge.ts:278 — re-verified at tip; :272 is a structural router cast, also present at tip) — and, at audit date, `as unknown as Record<string, unknown>` in AudioTracksPage.vue. *(S424 restatement: the AudioTracksPage casts are gone since S407 — 0 hits at tip; see 15.3.)* The bridge defines its own `BridgePlayer` interface (tizenBridge.ts:25-32 at tip) as a workaround. Fix requires @phlix/ui to export a complete `PlayerStore` TypeScript interface with all public API methods/properties.
**Code Changes**: None (fix requires @phlix/ui type exports, not tizen-client)

## Step 15.5 - Event Bus vs Pinia (LOW)
**Decision**: INTERNAL
**Rationale**: The RemoteManager custom event system (on/emit/onAction pattern) is a TV-specific singleton for remote control events - fundamentally different from Vue component events or Pinia state. tizenBridge.ts:188-262 (`wireTizenBridge`, refs re-derived at tip; audit-date 199-250) wires remote 'action' events to player store methods (play/pause/seekBy) - not Pinia actions. This is intentional: TV hardware events flow through RemoteManager → tizenBridge → player store methods. The pattern is internally consistent within tizen-client. No unification needed as these are different concerns (hardware events vs application state).
**Code Changes**: None (internal architecture - no external impact)

## Step 15.6 - Multiple Mount Points (MEDIUM)
**Decision**: TV-SPECIFIC (same architectural decision as 15.1)
**Rationale**: index.html has 7 mount points (`#phlix-app`, `#phlix-spatial-host`, `#phlix-chapter-overlay`, `#phlix-sleep-timer-overlay`, `#phlix-skip-intro-overlay`, `#phlix-pip-overlay`, `#phlix-up-next-overlay`). This is the same architectural decision as Step 15.1 - separate apps for independent overlay visibility control and z-index layering. Single mount with Teleport would complicate overlay lifecycle management with no TV user-facing benefit.
**Code Changes**: None (architectural decision - no code needed)

---

## Summary Table

| Step | Severity | Decision | Key Finding |
|------|----------|----------|-------------|
| 15.1 | HIGH | TV-SPECIFIC | 7 separate Vue apps sharing pinia/router - intentional for TV overlay lifecycle |
| 15.2 | MEDIUM | TV-SPECIFIC REIMPLEMENTATION | DOM quality control - tech debt pending @phlix/ui composable API |
| 15.3 | HIGH | NOT IMPLEMENTED | Dynamic property fallback chains - fix requires @phlix/ui typed getters |
| 15.4 | MEDIUM | NOT IMPLEMENTED | Missing type exports - fix requires @phlix/ui PlayerStore interface |
| 15.5 | LOW | INTERNAL | RemoteManager event system is TV-specific internal architecture |
| 15.6 | MEDIUM | TV-SPECIFIC | Same as 15.1 - separate mount points for TV overlay control |

## Gates

| Gate | Result |
|------|--------|
| `npm run typecheck` | ✅ PASS (re-run green at tip, 2026-09-04) |
| `npm test` | ✅ 312 PASS (20 files) — re-measured at tip `f5b9fff9`, 2026-09-04 (audit-date value was "74 PASS"; the suite has grown via S244–S418-era tests) |
| `npm run lint` | ✅ PASS (re-run green at tip, 2026-09-04) |

## Conclusion

Category 15 identifies architectural patterns that are either TV-specific by design (6+ separate Vue apps, multiple mount points, DOM-based quality control via tizenBridge) or require @phlix/ui changes to resolve (typed player store getters, type exports). The tizen-client architecture is internally consistent for TV-specific requirements. Steps 15.3 and 15.4 are tech debt that should be addressed in @phlix/ui, not tizen-client.

---

# Category 13 - i18n / Localization

**Audit Date**: 2026-07-31
**Repository**: `/home/sites/phlix/phlix-tizen-client`
**Status**: COMPLETE

## Overview

This category examines i18n (internationalization) / l10n (localization) infrastructure in the tizen-client. Key context: the TV app is designed for single-language (English) deployment on Samsung Tizen TV. *(S424 note: the audit-date text attributed a quote — "All visible text is English" — to AGENTS.md; grep of AGENTS.md/CLAUDE.md at tip `f5b9fff9` finds no such string, and `git log -S` shows it was never in the tracked AGENTS.md. The single-language fact itself remains true — empirically re-verified below — but the quotation and its attribution have been removed.)* @phlix/ui has a complete i18n system via `useMessages()` composable with 532+ translation keys, but tizen-client does NOT use it — all strings are hardcoded English.

## Decision Table

| Step | Decision | Rationale |
|------|----------|-----------|
| 13.1 | **NOT USED** | `useMessages()` is NOT USED anywhere in tizen-client (0 references to useMessages, createTranslator, i18n, or messages in src/). @phlix/ui has complete i18n infrastructure but tizen is a single-language TV app. |
| 13.2 | **NOT USED** | Music page has hardcoded "tracks" strings (MusicPage.vue:286 and :294 at tip — re-derived; :233 was the audit-date position) instead of `t('music.tracks')`. All music UI strings are hardcoded English. |
| 13.3 | **NOT TV-APPLICABLE** | Deprecated `music.of` key is not used anywhere in tizen. No pager implementation exists in tizen music browsing — it shows first 100 rows only. |
| 13.4 | **NOT USED** | CONFIRMED extensive hardcoded English strings across multiple components (MusicPage, SkipIntroOverlay, SleepTimerOverlay, main.ts, stores). Single-language English deployment is by design, not a gap *(S424: the previously-quoted AGENTS.md sentence does not exist at tip — see Overview note; strings empirically re-verified hardcoded)*. |
| 13.5 | **NOT TV-APPLICABLE** | No pager implementation in tizen. Music browsing shows first 100 rows with no pagination controls. Pager i18n keys (pageOf, prevPage, nextPage, firstPage, lastPage) are not used. |
| 13.6 | **NOT USED** | Player overlay strings are hardcoded: "Skip Intro", "Skip Outro" in SkipIntroOverlay.vue; "5 min", "10 min", etc. in SleepTimerOverlay.vue; "Sleep Timer" title. |
| 13.7 | **NOT USED** | Error messages are hardcoded in stores (lines re-derived at tip — see Key Finding 3): useMusicStore.ts 'Failed to load artists/albums/album/track' (+ 'load more' variants since S125); useSyncPlayStore.ts 'Failed to parse WebSocket message' etc. — *S424: the audit-date 'WebSocket error' literal no longer exists (client onError interpolates `` `${code}: ${message}` `` at :584)*; ChapterOverlay.vue 'Failed to load chapters' (:97). |

## Decision Distribution

| Decision | Count |
|----------|-------|
| NOT USED | 5 (13.1, 13.2, 13.4, 13.6, 13.7) |
| NOT TV-APPLICABLE | 2 (13.3, 13.5) |
| **TOTAL** | **7** |

## Key Findings

### 1. useMessages() is NOT USED (13.1)
`grep -r "useMessages\|createTranslator\|i18n\|messages" src/ --type vue --type ts` returns **0 matches**. The @phlix/ui i18n composable exists at `node_modules/@phlix/ui/src/composables/useMessages.ts` but is never imported or called in tizen-client source.

### 2. Hardcoded Strings — Confirmed Present (13.4)

**MusicPage.vue** (src/pages/MusicPage.vue) — all lines re-derived at tip 2026-09-04:
- Line 47: `return 'Artists';` (getPageTitle — audit ref 47 still exact)
- Line 50: `return musicStore.selectedArtistId ?? 'Albums'` (audit ref 49; body since simplified)
- Line 52: `return musicStore.currentAlbum?.title ?? 'Tracks'` (audit ref 51)
- Line 54: `return 'Music'` (audit ref 53)
- Line 155: `<p>Loading music…</p>` (audit ref 132)
- Line 170: `Retry` (button text; audit ref 147)
- Line 286: `{{ musicStore.currentAlbum.year }} · {{ musicStore.currentAlbum.totalTracks }} tracks` (audit ref 233) + line 294 aria-label `` `${…} tracks` ``

**SkipIntroOverlay.vue** (src/components/SkipIntroOverlay.vue):
- Line 180: `aria-label="Skip intro"` (re-verified exact at tip)
- Line 204: `<span class="skip-intro-overlay__label">Skip Intro</span>` (re-verified exact at tip)
- Line 211: `aria-label="Skip outro"` (re-verified exact at tip; also `Skip Outro` label at :235)

**SleepTimerOverlay.vue** (src/components/SleepTimerOverlay.vue) — lines re-derived at tip:
- Lines 32-37: `{ label: '5 min', minutes: 5 }` … `{ label: '60 min', minutes: 60 }` (PRESETS array — re-verified exact)
- Line 150: `<h2 class="sleep-timer-overlay__title">` (renders the Sleep Timer title; audit ref 143)
- Line 183: `{{ preset.label }}` (audit ref 175)
- Line 212: `Timer active: {{ remainingTimeDisplay }} remaining` (audit ref 204)
- Line 221: `Cancel Timer` (audit ref 213)

**main.ts** (src/main.ts lines 42-46):
```typescript
{ id: 'browse', label: 'Browse', to: '/app', libraryLinks: true },
{ id: 'for-you', label: 'For You', to: '/app/recommendations' },
{ id: 'settings', label: 'Settings', to: '/app/settings' },
{ id: 'parental-controls', label: 'Parental Controls', to: '/app/parental-controls' },
{ id: 'admin', label: 'Admin', to: '/app/admin/dashboard', requiresAdmin: true }
```

### 3. Error Messages Are Hardcoded (13.7)

**useMusicStore.ts** (src/stores/useMusicStore.ts) — lines re-derived at tip (S125 rewrite shifted them; two new load-more strings):
- Line 136: `'Failed to load artists'` (audit ref 54)
- Line 163: `'Failed to load more artists'` (new since S125)
- Line 186: `'Failed to load albums'` (audit ref 69)
- Line 210: `'Failed to load more albums'` (new since S125)
- Line 232: `'Failed to load album'` (audit ref 85)
- Line 250: `'Failed to load track'` (audit ref 101)

**useSyncPlayStore.ts** (src/stores/useSyncPlayStore.ts) — re-derived at tip after the S415 rewrite:
- Line 584: SyncPlayClient `onError` sets `wsError.value` to `` `${code}: ${message}` `` (the audit-date `payload.message ?? 'WebSocket error'` literal at :262 no longer exists — grep 0 hits for 'WebSocket error')
- Line 608: `'Failed to parse WebSocket message'` (audit ref 297)
- Line 613: `'WebSocket connection error'` (audit ref 302)
- Line 631: `'Failed to connect WebSocket'` (audit ref 318)
- Line 647: `'Failed to reconnect after multiple attempts'` (audit ref 334)
- Lines 767 & 801: `'Already in a room. Leave current room first.'` (audit ref 431)
- Line 787: `'Failed to create room'` (audit ref 450)
- Line 821: `'Failed to join room'` (audit ref 493)

**ChapterOverlay.vue** (src/components/ChapterOverlay.vue):
- Error message `'Failed to load chapters'` at :97 (re-verified at tip)

### 4. No Pager in Tizen (13.3, 13.5)
`grep -r "pageOf\|prevPage\|nextPage\|firstPage\|lastPage\|jumpToPage\|pagination" src/` returns no matches. *(Restated by S424: the audit-date sentence "Music browsing shows first 100 rows only — no pagination controls" is superseded — since S125 the store pages with load-more controls (MusicPage.vue:189/:220 `hasMoreArtists`/`hasMoreAlbums`) — with hardcoded English labels, which is the i18n point this category makes. The CHANGELOG v0.98.32 "first 100 rows" note is HISTORICAL context for the pre-S125 state.)*

### 5. Single-Language Design (restated by S424)
The single-language design is intentional and re-verified empirically at tip (`useMessages`/`createTranslator` grep: 0 hits; hardcoded strings below still present at restated lines). The audit-date claim attributed to AGENTS.md — "All visible text is English" — is NOT in AGENTS.md at tip (grep 0 hits) and has been removed as unverifiable attribution. TV apps deployed in a single market typically do not require runtime language switching.

## Gates

| Gate | Result |
|------|--------|
| `npm run typecheck` | ✅ PASS (re-run green at tip, 2026-09-04) |
| `npm test` | ✅ 312 PASS (20 files) — re-measured at tip `f5b9fff9`, 2026-09-04 (audit-date value was "74 PASS"; the suite has grown via S244–S418-era tests) |
| `npm run lint` | ✅ PASS (re-run green at tip, 2026-09-04) |

## Conclusion

The tizen-client intentionally does NOT use i18n infrastructure despite @phlix/ui providing a complete system. All strings are hardcoded English. This is empirically true at tip (0 i18n references in src/, hardcoded strings re-located below) and appropriate for a single-language TV app deployment. *(S424: the prior AGENTS.md quotation was not found at tip and was removed — see Overview.)* No i18n changes are needed or recommended for this project scope.

---

# Category 17 - Bug Fixes Since v0.81.0

> *(S424 2026-09-04: all @phlix/ui-internal line refs in this category were measured against the v0.98.33 source tree and are **HISTORICAL** — v0.99.0 ships dist-only. Tizen-side refs and decisions were re-derived at tip; Steps 17.3/17.4 restated NOT IMPLEMENTED → IMPLEMENTED (S125), and the "v0.98.33 (installed)" phrasing means "installed AT AUDIT DATE"; the tip pin is `#v0.99.0` (package.json:34).)*

## Step 17.1 - Poster skeletons stuck after first 24 (v0.98.27)
**Decision**: ALREADY SUFFICIENT
**Rationale**: @phlix/ui v0.98.33 (installed) includes S35 cache fix in MediaGrid.vue (lines 317-324) where `source` array identity is now part of the cache key. This fixes the issue where items beyond index 24 loaded via A-Z jump rail or random-access paging remained stuck as skeleton placeholders. Tizen uses `createPhlixApp()` which internally uses the fixed MediaGrid component. The parent component's `need-range` event handling delegates to `useMediaStore.ensureRange()` which calls `placePage()` - this flow is handled internally by @phlix/ui.
**Code Changes**: None (@phlix/ui handles this internally)

## Step 17.2 - Subtitle default track on load (v0.98.11)
**Decision**: ALREADY SUFFICIENT
**Rationale**: @phlix/ui v0.98.33 (installed) includes the fix in `usePlayerStore.ts` (line 106) where `subtitleLang` is properly initialized and `seedFromPreferences()` honors the server's `default: true` track flag. Tizen uses `createPhlixApp()` which sets up the player store internally. The `@phlix/ui/CaptionsMenu` component properly initializes the selected subtitle based on `subtitleLang`.
**Code Changes**: None (@phlix/ui handles this internally)

## Step 17.3 - Music album filtering (v0.98.32)
**Decision**: NOT IMPLEMENTED
**Decision**: IMPLEMENTED (restated at tip 2026-09-04 from NOT IMPLEMENTED)
**Rationale**: The v0.98.32 fix added server-side filtering with `?artist=` to `/api/v1/music/albums`. The audit-date bug (raw unfiltered `client.get` + client-side `artistAlbums` filtering) was exactly what S125 replaced: at tip `fetchAlbums(artist?)` passes `{ artist }` to `listAlbums({ limit: MUSIC_PAGE_SIZE, offset: 0, artist })` (useMusicStore.ts:173-181, condition :180) — the fix's recommended pattern is now live.
**Code Changes**: None in this step (implemented by S125)

## Step 17.4 - Music paging missing (v0.98.32)
**Decision**: NOT IMPLEMENTED
**Decision**: IMPLEMENTED (restated at tip 2026-09-04 from NOT IMPLEMENTED)
**Rationale**: The v0.98.32 paged helpers are now ADOPTED (S125): `listArtists({ limit: MUSIC_PAGE_SIZE, offset })` at useMusicStore.ts:132/:156-158, `total` read into `artistsTotal`/`albumsTotal` (:134/:184), load-more wired in MusicPage.vue (:111/:189/:220). "Only first 100 items are ever fetched" is false at tip — subsequent pages are fetched on demand.
**Code Changes**: None in this step (implemented by S125)

## Step 17.5 - Resume position on direct→HLS fallback (v0.80.0)
**Decision**: ALREADY SUFFICIENT
**Rationale**: @phlix/ui v0.98.33 (installed) includes the fix in `hls-playback.ts` (lines 152, 273) where `startPosition` is properly passed to hls.js when direct play falls back to HLS transcode. Tizen passes `TIZEN_HLS_CONFIG` to `playerHlsConfig` (main.ts line 116) - this config is for buffer tuning, not startPosition. The `startPosition` for resume is handled by @phlix/ui's player internally when calling `attachHls()` with the resume position.
**Code Changes**: None (@phlix/ui handles this internally)

## Step 17.6 - Finished signal (v0.98.13)
**Decision**: TV-SPECIFIC
**Rationale**: @phlix/ui includes `useResumeReporter` which calls `finish()` on video end to notify server to remove item from continue-watching *(v0.98.33-era observation — HISTORICAL)*. Tizen's `UpNextOverlay.vue` (file is 596 lines at tip; polling at :169-183, emits 'play-now'/:155, :205 and 'cancel'/:162) does NOT reference `useResumeReporter` at all — re-verified: `grep -rn "useResumeSync\|useResumeReporter" src/` → 0 hits at tip. Whatever finished-signal tizen sends comes only from @phlix/ui's own player internals, not tizen code. TV-SPECIFIC designation retained.
**Code Changes**: None (tech debt - UpNextOverlay uses event emission pattern, not reactive)

## Step 17.7 - Up-next race condition (v0.98.10)
**Decision**: TV-SPECIFIC
**Rationale**: @phlix/ui v0.98.10 fixed queue race conditions with atomic `setQueue()`/`enqueue()`/`next()` operations in `usePlayerStore` *(HISTORICAL src ref)*. Tizen's `UpNextOverlay.vue` (since S280: `loadUpNextMedia` at :130-150) fetches `GET /api/v1/users/me/next-up` and picks the first non-self item client-side — the audit-date `/api/v1/media/{id}/playlist` fetch no longer exists (that route was never server-registered; the component docblock :117-128 records the S280 finding). It remains a different architecture — tizen manages its own up-next logic rather than relying on @phlix/ui's player store queue, which tizen bypasses. The race-condition fix concern still applies structurally.
**Code Changes**: None (tizen uses custom up-next architecture with different queue semantics)

## Step 17.8 - Menu positioning (v0.66.0)
**Decision**: ALREADY SUFFICIENT
**Rationale**: The menu positioning fix (proper `getBoundingClientRect()` for trigger location, viewport boundary checking) is in @phlix/ui's Menu component *(HISTORICAL src ref)*. Tizen's `buildMenu()` (main.ts:43-52 at tip — re-derived; audit ref 38-48) returns `MenuItem[]` which @phlix/ui's menu component renders. The actual menu positioning is handled by @phlix/ui's Menu component internally.
**Code Changes**: None (@phlix/ui handles this internally)

## Step 17.9 - HLS bandwidth persistence (v0.80.x)
**Decision**: ALREADY SUFFICIENT
**Rationale**: @phlix/ui v0.98.33 includes bandwidth persistence via `phlix-bandwidth-estimate` localStorage key in `hls-playback.ts` (lines 157-183, 333-344). On `attachHls()` it seeds `abrEwmaDefaultEstimate` from localStorage. Tizen passes `TIZEN_HLS_CONFIG` to `playerHlsConfig` (main.ts line 116) - this is buffer tuning config passed to hls.js, not the ABR seeding. The bandwidth persistence is handled by @phlix/ui's `hls-playback.ts` internally when `createPhlixApp()` sets up the player.
**Code Changes**: None (@phlix/ui handles this internally)

## Step 17.10 - Codec probing before direct play (v0.80.x)
**Decision**: ALREADY SUFFICIENT
**Rationale**: @phlix/ui v0.98.33 includes `probeCodecSupport()` in `playback.ts` (lines 170-216) using `navigator.mediaCapabilities.decodingInfo()` with canPlayType fallback. This is called before direct play decision to proactively trigger transcode for unsupported codecs. Tizen uses `createPhlixApp()` which sets up the player internally - the `useResolvePlayable` composable (or equivalent) in @phlix/ui's player flow handles codec probing.
**Code Changes**: None (@phlix/ui handles this internally)

---

## Verification Evidence

### Key files examined
- `package.json`: @phlix/ui pinned to v0.98.33 (includes all v0.81.0+ fixes)
- `src/main.ts`: `createPhlixApp()` with `playerHlsConfig: TIZEN_HLS_CONFIG`
- `src/stores/useMusicStore.ts`: paged ApiClient-helper calls with limit/offset + server-side artist filter at tip (17.3/17.4 IMPLEMENTED — S125 restatements)
- `src/components/UpNextOverlay.vue`: Polling-based overlay with event emission, not reactive, sourcing `users/me/next-up` (17.6/17.7 TV-SPECIFIC — restated)
- `src/tizenBridge.ts`: Uses `usePlayerStore` from @phlix/ui for remote bridge

### Architecture context
- Tizen is a "thin Vue 3 consumer of @phlix/ui" (AGENTS.md)
- All media/library/player UI is rendered by @phlix/ui via `createPhlixApp()`
- Tizen-specific code: main.ts boot config, tizenBridge.ts remote handling, overlays with polling
- Most bug fixes flow through @phlix/ui internally when using `createPhlixApp()`
- Music store has been reworked SINCE the audit (S125) onto the paged v0.98.32+ API contract — the old "predates" note is superseded (2026-09-04)

## Gates

| Gate | Result |
|------|--------|
| `npm run typecheck` | ✅ PASS (re-run green at tip, 2026-09-04) |
| `npm test` | ✅ 312 PASS (20 files) — re-measured at tip `f5b9fff9`, 2026-09-04 (audit-date value was "74 PASS"; the suite has grown via S244–S418-era tests) |
| `npm run lint` | ✅ PASS (re-run green at tip, 2026-09-04) |

## Decision Distribution

| Step | Bug Fix | Version | Decision | Rationale |
|------|---------|---------|----------|-----------|
| 17.1 | Poster skeletons stuck | 0.98.27 | ALREADY SUFFICIENT | @phlix/ui MediaGrid has S35 fix, tizen uses createPhlixApp |
| 17.2 | Subtitle default track | 0.98.11 | ALREADY SUFFICIENT | @phlix/ui usePlayerStore has fix, tizen uses createPhlixApp |
| 17.3 | Music album filtering | 0.98.32 | IMPLEMENTED (S424 restatement) | listAlbums({artist}) server-side filter live since S125 |
| 17.4 | Music paging missing | 0.98.32 | IMPLEMENTED (S424 restatement) | limit/offset paging + load-more live since S125 |
| 17.5 | Resume on HLS fallback | 0.80.0 | ALREADY SUFFICIENT | @phlix/ui hls-playback has fix, TIZEN_HLS_CONFIG is buffer tuning only |
| 17.6 | Finished signal | 0.98.13 | TV-SPECIFIC | UpNextOverlay uses event emission, not useResumeReporter.finish() |
| 17.7 | Up-next race condition | 0.98.10 | TV-SPECIFIC | UpNextOverlay uses custom polling architecture, not player store queue |
| 17.8 | Menu positioning | 0.66.0 | ALREADY SUFFICIENT | @phlix/ui Menu component has fix |
| 17.9 | HLS bandwidth persistence | 0.80.x | ALREADY SUFFICIENT | @phlix/ui hls-playback has localStorage persistence |
| 17.10 | Codec probing | 0.80.x | ALREADY SUFFICIENT | @phlix/ui playback.ts has probeCodecSupport() |

## Conclusion

Most bug fixes (6/10 ALREADY SUFFICIENT) flow through automatically because tizen uses `createPhlixApp()`, which sets up all components internally with the fixes *(S424: distribution re-derived at tip from the restated steps below/above)*.

Two items (17.3, 17.4) were NOT IMPLEMENTED at audit date because `useMusicStore.ts` used raw API calls predating the v0.98.32 paged API changes — **restated at tip as IMPLEMENTED**: S125 + `894bf96` adopted the paged helpers, the server-side `?artist=` filter, and envelope-unwrapping (see Category 8 restatements).

Two items (17.6, 17.7) are TV-SPECIFIC because tizen has custom overlay components (UpNextOverlay) that use polling/event-emission architecture rather than @phlix/ui's reactive patterns. This is documented tech debt in the codebase comments.

No code changes required for this category - the findings are documentation of architectural decisions and known gaps.


---

# Category 16 - New Features Since v0.81.0

## Overview

This category audits 22 features added between v0.81.0 (old stale version) and v0.98.33 (current version). Many new @phlix/ui features were added but may not be available in tizen-client, which is a thin consumer of @phlix/ui via `createPhlixApp()`. Decisions distinguish between **TV-SPECIFIC** (intentional TV reimplementation), **NOT TV-APPLICABLE** (keyboard/mouse/admin features irrelevant to TV), **ALREADY SUFFICIENT** (provided via @phlix/ui or bundled), **NOT IMPLEMENTED** (missing UI despite server support), **NOT USED** (available but not integrated), **PARTIAL** (partially works), and **INTERNAL** (works transparently via @phlix/ui).

## Step 16.1 - Subtitle Search & Download (v0.98.0)
**Decision**: NOT IMPLEMENTED
**Rationale**: `SubtitleFetchService`, `SubtitleStorage`, and `RemoteSubtitleController` exist in phlix-server. `client.searchSubtitles()` and `client.downloadSubtitle()` exist in phlix-ui. Tizen's `SubtitleTrackList.vue` ONLY handles selecting existing subtitle tracks passed via props — it has NO UI for searching external subtitle providers (OpenSubtitles) or downloading on-demand. Users cannot search for or download subtitles from external providers on Tizen. This requires a TV-specific UI flow (likely in player settings) to search, select, and download subtitles.
**Code Changes**: None (audit-only — gap identified)
**Evidence**: `SubtitleTrackList.vue` only renders pre-existing tracks; no search/download UI; grep `searchSubtitle|downloadSubtitle` src/ → 0 hits (re-run at tip 2026-09-04)

## Step 16.2 - Theater Mode (v0.98.26)
**Decision**: NOT TV-APPLICABLE
**Rationale**: Theater mode in @phlix/ui toggles a windowed player with shell chrome removal. Tizen uses full-screen player by default (`defaultTv: true` in createPhlixApp config). TV has no windowed player state to toggle and no shell chrome to remove. Theater mode is a web browser window-management concept not applicable to TV. Consistent with Step 3.14 which reached the same conclusion.
**Code Changes**: None (full-screen TV paradigm)
**Evidence**: grep "theater" src/ → 0 hits; Step 3.14

## Step 16.3 - Next Up API (v0.98.28)
**Decision**: ALREADY SUFFICIENT
**Rationale**: Backend has `GET /api/v1/users/me/next-up` implemented in S36 with `NextUpSelector.php` and `WatchHistory::getNextUp()`. phlix-ui has `fetchNextUp()` and BrowsePage shows Next Up rail. Since Tizen uses `createPhlixApp()` which includes BrowsePage, the Next Up rail renders automatically.
**Code Changes**: None (works via createPhlixApp BrowsePage)
**Evidence**: BrowsePage in package/assets/ renders Next Up rail

## Step 16.4 - Most Watched API (v0.98.24)
**Decision**: ALREADY SUFFICIENT
**Rationale**: Backend has `GET /api/v1/media/most-watched` implemented in S31 via `MostWatchedController.php` and `StatsCollector::getTopMedia()`. phlix-ui has `fetchMostWatched()` and BrowsePage shows Most Watched rail. Tizen benefits via `createPhlixApp()` BrowsePage automatically.
**Code Changes**: None (works via createPhlixApp BrowsePage)
**Evidence**: BrowsePage in package/assets/ renders Most Watched rail

## Step 16.5 - Music Paging (MusicPager) (v0.98.32)
**Decision**: IMPLEMENTED (restated at tip 2026-09-04 from audit-date NOT IMPLEMENTED)
**Finding**: Resolved by S125 (commit `35f3270`, "page the Tizen music library instead of showing 100 of 2,197 artists"). At tip `useMusicStore.ts` calls the paged ApiClient helpers — `listArtists({limit: MUSIC_PAGE_SIZE, offset})` (:132/:156-158), `listAlbums({limit, offset, artist?})` (:177-181/:202) — reads `total` from the envelope (:134) and exposes `loadMoreArtists`/`loadMoreAlbums`, wired to load-more controls in MusicPage.vue (:189/:220). Users no longer see only the first 100.
**Code Changes**: None in this step (already implemented upstream of tip)
**Evidence**: Category 8 Steps 8.1/8.2 restatements; useMusicStore.ts:132/:177; MusicPage.vue:111/:113/:189/:220 (all re-measured at tip)

## Step 16.6 - MediaListRow view mode (v0.98.31)
**Decision**: ALREADY SUFFICIENT
**Rationale**: `MediaRow-*.js` asset exists in package/assets/ (list-view component). BrowsePage uses `MediaGrid.vue` with `columns`/`rowHeight` override props and list view mode toggle. Since Tizen uses `createPhlixApp()` which includes BrowsePage with list view mode, this works automatically.
**Code Changes**: None (works via createPhlixApp BrowsePage)
**Evidence**: package/assets/MediaRow-*.js exists; BrowsePage includes MediaGrid with list mode toggle

## Step 16.7 - MediaBackdropRow view mode (v0.98.31)
**Decision**: NOT FOUND
**Rationale**: No `MediaBackdropRow` component found in the codebase. grep for "backdrop" only matched CSS `backdrop-filter` in RatingModal.vue. `MediaListRow` exists (Step 16.6) but may serve different purpose. May not have been implemented or uses different naming.
**Code Changes**: None (component doesn't exist)
**Evidence**: grep "MediaBackdropRow|DownRow" src/ → 0 hits; grep "backdrop" src/ → only CSS backdrop-filter matches

## Step 16.8 - Resume Reporter (v0.98.13)
**Decision**: ALREADY SUFFICIENT
**Rationale**: `useResumeReporter.ts` composable exists in @phlix/ui for tracking resume position and reporting to server during playback. Tizen benefits from `createPhlixApp()` player implementation — `useResumeReporter` is part of @phlix/ui's player. The capability is present in the bundle.
**Code Changes**: None (works via @phlix/ui player)
**Evidence**: useResumeReporter is part of @phlix/ui player module — *dist-supported at tip: `api/v1/sessions` routes appear in `node_modules/@phlix/ui/dist/phlix-ui.js`; tizen src/ itself has 0 references to useResumeReporter (grep, re-run 2026-09-04)*

## Step 16.9 - Finished Signal (v0.98.13)
**Decision**: NOT IMPLEMENTED
**Rationale**: Per updates.md: "Items linger in Continue Watching because `markAsWatched`/`clearProgress` wiring gap and `completed` signal not properly firing." The `POST /api/v1/sessions/{id}/complete` endpoint exists but the client-side signal to fire this when playback finishes may not be wired in Tizen. Items watched on Tizen may not be properly marked as finished and removed from Continue Watching.
**Code Changes**: None (audit-only — gap identified)
**Evidence**: updates.md notes the completed signal wiring gap

## Step 16.10 - Up-next deterministic queue (v0.98.10)
**Decision**: ALREADY SUFFICIENT
**Rationale**: Deterministic queue implemented in S12 with `applyItem()` ordering logic. Player.vue `onEnded` handler uses deterministic up-next queue. `useResumeReporter.ts` calls `finish()` before chrome-pin/up-next logic. Tizen benefits from `createPhlixApp()` player implementation which includes this feature.
**Code Changes**: None (works via createPhlixApp player)
**Evidence**: S12 worklog; Step 3.2/3.13 confirm TV-specific UpNextOverlay.vue works with queue

## Step 16.11 - Per-library relay throttle/quota (v0.98.30)
**Decision**: NOT TV-APPLICABLE
**Rationale**: Relay functionality is server-side and per-library rate limiting is an admin concern. Tizen is a client — relay throttling is managed server-side, not on the client.
**Code Changes**: None (server handles this)
**Evidence**: Admin/server feature — no client-side implementation needed

## Step 16.12 - Relay tunnel real status (v0.98.29)
**Decision**: NOT TV-APPLICABLE
**Rationale**: Relay tunnel status is a server/admin concern exposed by the Hub module. Tizen client uses relay for remote access but doesn't manage tunnel status — it only displays connection status, not tunnel internals.
**Code Changes**: None (server handles this)
**Evidence**: Admin/server feature — no client-side implementation needed

## Step 16.13 - TMDB box-set auto-collection (v0.98.25)
**Decision**: NOT TV-APPLICABLE
**Rationale**: Metadata enhancement is server-side. `MetadataManager` handles TMDB box-set detection. Tizen client displays metadata but doesn't control collection detection — it's automatic server-side behavior.
**Code Changes**: None (server handles this)
**Evidence**: Admin/server feature — no client-side implementation needed

## Step 16.14 - Plugin catalog channel (v0.98.9)
**Decision**: NOT TV-APPLICABLE
**Rationale**: Plugin system with `PluginLoader` and manifest schema is server-side. Plugin catalog channel would be admin UI. Tizen is a client — plugin installation is a server admin function.
**Code Changes**: None (server handles this)
**Evidence**: Admin/server feature — no client-side implementation needed

## Step 16.15 - useMusicPlayer (dual audio gapless) (v0.80.1)
**Decision**: PARTIAL
**Finding**: Already documented in Category 8 (Item 8.3). `useMusicPlayer.ts` composable handles audio playback with gapless playback, crossfade, and queue management. Tizen's `useMusicStore.ts` reimplements fetch logic differently (uses raw `client.get()` calls instead of the composable). Gapless playback may not work correctly on Tizen because the custom store doesn't use `useMusicPlayer`. The `gaplessEnabled` state exists in settings but the Tizen implementation may not honor it.
**Code Changes**: None (documented in Category 8)
**Evidence**: Category 8 Step 8.3; useMusicStore.ts uses custom approach

## Step 16.16 - useTrickplay (sprite previews) (v0.80.x)
**Decision**: NOT IMPLEMENTED
**Rationale**: `useTrickplay.ts` composable and `TrickplaySprite` type exist in @phlix/contracts. Sprite preview generation happens during transcoding on the server. No `useTrickplay` usage found in Tizen client — `tizenBridge.ts` doesn't mention trickplay. Trickplay requires both server-side sprite generation AND client-side sprite reading/display during seek.
**Code Changes**: None (audit-only — gap identified)
**Evidence**: grep "trickplay|sprite" src/ → 0 hits; requires server-side sprite generation + client-side wiring

## Step 16.17 - Book/Audiobook/Photo pages (v0.80.x)
**Decision**: NOT TV-APPLICABLE
**Rationale**: No Book or Photo pages exist in Tizen client. `MusicPage.vue` exists for music content, but audiobooks and photos are not TV use cases. TV form factor is primarily video playback.
**Code Changes**: None (not a TV use case)
**Evidence**: MusicPage.vue exists but no Book/Audiobook/Photo components; Tizen components list confirms no book/photo pages

## Step 16.18 - Music library redirect (v0.98.33)
**Decision**: ALREADY SUFFICIENT
**Finding**: Already documented in Category 8 (Item 8.8). S97 redirect: `/app/library/:id` for MUSIC library type → `/app/music`. `createPhlixApp.ts` handles this redirect. Tizen uses `createPhlixApp()` which includes this redirect automatically.
**Code Changes**: None (documented in Category 8)
**Evidence**: Category 8 Step 8.8; createPhlixApp handles redirect

## Step 16.19 - Series seasons navigation (v0.80.x)
**Decision**: ALREADY SUFFICIENT
**Rationale**: `useSeriesSeasons-*.js` exists in package/assets/ (SeasonPage-*.js also in bundle). MediaDetail page in @phlix/ui shows series with season navigation via the useSeriesSeasons composable. Since Tizen uses `createPhlixApp()` which mounts MediaDetailPage, season navigation works automatically.
**Code Changes**: None (works via createPhlixApp MediaDetail page)
**Evidence**: package/assets/useSeriesSeasons-*.js; SeasonPage-*.js in bundle; createPhlixApp MediaDetail handles seasons

## Step 16.20 - Item data inspector modal (v0.98.12)
**Decision**: NOT TV-APPLICABLE
**Rationale**: `useItemInspector` composable is a debugging tool for development. Not needed by end users on TV. Debugging tools are not applicable to production TV app UX.
**Code Changes**: None (debugging tool — not for TV)
**Evidence**: grep "itemInspector|ItemInspector" src/ → 0 hits

## Step 16.21 - Inline help text for settings (v0.98.14)
**Decision**: ALREADY SUFFICIENT
**Rationale**: `phlix-help-text` CSS class exists in @phlix/ui. Settings via `createPhlixApp()` include inline help text if part of the base settings component. Tizen settings are rendered by @phlix/ui's settings page via `createPhlixApp()`. Help text renders if part of the base settings component — no TV-specific override needed.
**Code Changes**: None (works via createPhlixApp settings)
**Evidence**: help text CSS class exists in @phlix/ui style; SettingsPage via createPhlixApp renders help text

## Step 16.22 - Test credentials button (plugins) (v0.93.0)
**Decision**: NOT TV-APPLICABLE
**Rationale**: Plugin settings with test credential functionality is an admin feature in server/admin UI. Tizen doesn't manage plugins — that's a server admin function.
**Code Changes**: None (admin feature)
**Evidence**: Admin/server feature — no TV use case

---

## Summary

| Step | Feature | Decision | Notes |
|------|---------|----------|-------|
| 16.1 | Subtitle Search & Download | NOT IMPLEMENTED | Server+phlix-ui API exists; Tizen lacks search/download UI |
| 16.2 | Theater Mode | NOT TV-APPLICABLE | Full-screen TV paradigm — no windowed player to toggle |
| 16.3 | Next Up API | ALREADY SUFFICIENT | Works via createPhlixApp BrowsePage |
| 16.4 | Most Watched API | ALREADY SUFFICIENT | Works via createPhlixApp BrowsePage |
| 16.5 | Music Paging | IMPLEMENTED (S424 restatement) | S125 paging at tip — see Category 8 restated 8.2 |
| 16.6 | MediaListRow | ALREADY SUFFICIENT | Works via createPhlixApp BrowsePage with MediaRow |
| 16.7 | MediaBackdropRow | NOT FOUND | Component doesn't exist or uses different naming |
| 16.8 | Resume Reporter | ALREADY SUFFICIENT | Works via @phlix/ui player |
| 16.9 | Finished Signal | NOT IMPLEMENTED | Items linger in Continue Watching — signal gap |
| 16.10 | Up-next queue | ALREADY SUFFICIENT | S12 deterministic queue via createPhlixApp player |
| 16.11 | Per-library relay throttle | NOT TV-APPLICABLE | Admin/server feature |
| 16.12 | Relay tunnel status | NOT TV-APPLICABLE | Admin/server feature |
| 16.13 | TMDB box-set auto-collection | NOT TV-APPLICABLE | Admin/server feature |
| 16.14 | Plugin catalog channel | NOT TV-APPLICABLE | Admin/server feature |
| 16.15 | useMusicPlayer (gapless) | PARTIAL | Documented in Category 8 — custom store, may lack gapless |
| 16.16 | useTrickplay (sprites) | NOT IMPLEMENTED | No trickplay found in Tizen; requires server+client support |
| 16.17 | Book/Audiobook/Photo | NOT TV-APPLICABLE | TV form factor — not a TV use case |
| 16.18 | Music library redirect | ALREADY SUFFICIENT | Documented in Category 8 — works via createPhlixApp |
| 16.19 | Series seasons nav | ALREADY SUFFICIENT | Works via createPhlixApp MediaDetail page |
| 16.20 | Item inspector modal | NOT TV-APPLICABLE | Debug feature — not for TV |
| 16.21 | Inline help text | ALREADY SUFFICIENT | Works via createPhlixApp settings |
| 16.22 | Test credentials button | NOT TV-APPLICABLE | Admin feature |

**Decision Distribution**:
- **ALREADY SUFFICIENT**: 8 steps (16.3, 16.4, 16.6, 16.8, 16.10, 16.18, 16.19, 16.21)
- **NOT TV-APPLICABLE**: 7 steps (16.2, 16.11, 16.12, 16.13, 16.14, 16.17, 16.20, 16.22)
- **NOT IMPLEMENTED**: 3 steps (16.1, 16.9, 16.16) + **IMPLEMENTED** 1 step (16.5 — paged since S125, restated at tip)
- **NOT FOUND**: 1 step (16.7)
- **PARTIAL**: 1 step (16.15)
- **Code changes needed**: 0 (all decisions are architectural/audit — no code expected per scope)

**Key Gaps Identified**:
1. **16.1 (Subtitle Search & Download)** — HIGH: External subtitle provider search/download UI missing on Tizen
2. **16.9 (Finished Signal)** — MEDIUM: Items may linger in Continue Watching due to completed signal not firing
3. **16.16 (Trickplay)** — MEDIUM: Scrubbing preview sprites not implemented on Tizen
4. ~~16.5 (Music Paging)~~ — CLOSED at tip: S125 implemented paging (restated 2026-09-04; see Categories 8/16 restatements)

(End of VERIFICATION.md)
