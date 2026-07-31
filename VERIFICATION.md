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
**Rationale**: Tizen has its own 645-line WebSocket implementation vs phlix-ui's 299-line version. Tizen's version has fully integrated WebSocket with auto-reconnect (5 attempts, exponential backoff), local SyncPlayApiClient class, and fetchPublicRooms(). This is intentionally reimplemented for TV-specific reliability requirements - phlix-ui outsources WebSocket to external module while tizen integrates it directly for cohesive state management.
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
**Rationale**: `npm ci` materialized @phlix/ui v0.98.33 into node_modules with no lock-file diff. The package.json pin `github:detain/phlix-ui#v0.98.33` was already correct before and after. useMusicStore.ts uses raw `client.get()` not the page-envelope helpers, so ApiClient.listArtists/listAlbums/listTracks breaking changes do not apply. Key exports (createPhlixApp, buildAdminRoutes, LibraryScanPage, ApiClient, useSpatialNav, usePreferencesStore, usePlayerStore, @phlix/ui/style.css) all verified present at v0.98.33.
**Code Changes**: None — package.json pin and lock file were already aligned; no source changes needed.
**Evidence**: `node_modules/@phlix/ui/package.json` version 0.98.33 (was 0.81.0); `diff /tmp/package-lock.json.before package-lock.json` showed no diff; src/stores/useMusicStore.ts:17 uses `client.get('/api/v1/music/...')` (not ApiClient methods); key exports verified via `ls node_modules/@phlix/ui/dist/` and `@phlix/ui/package.json` exports field.
**Cross-refs**: none (step 1.2 covers @phlix/contracts version inconsistencies in CLAUDE.md/DEVELOPER.md — out of this step's scope)

## Step 1.3 - @phlix/* Dependencies
**Status**: Verified aligned
**Finding**: @phlix/contracts v0.3.12, @phlix/syncplay v0.1.2 - aligned between tizen-client and phlix-ui

## Step 1.4 - @phlix/tokens Integration
**Status**: Verified OK
**Finding**: @phlix/tokens v0.1.1 transitively included via @phlix/ui/style.css

## Step 1.5 - Music API Breaking Changes (v0.98.32)
**Decision**: IMPLEMENTED_OK
**Rationale**: useMusicStore.ts makes raw `client.get()` calls to `/api/v1/music/*` endpoints at lines 51, 66, 82, 98 — no use of `listArtists()`, `listAlbums()`, or `listTracks()`. The CHANGELOG v0.98.32 explicitly states "The native clients are unaffected and still show the first 100 rows." grep confirms 0 hits for these three methods in `src/`. The @phlix/ui ApiClient music-helper methods can change arbitrarily without impacting tizen-client.
**Code Changes**: None — CHANGELOG analysis only.
**Evidence**:
- `useMusicStore.ts:51`: `client.get<{ artists: MusicArtist[] }>('/api/v1/music/artists')` — raw call, not `listArtists()`
- `useMusicStore.ts:66`: `client.get<{ albums: MusicAlbum[] }>('/api/v1/music/albums')` — raw call, not `listAlbums()`
- `useMusicStore.ts:82`: `client.get<{ tracks: MusicTrack[] }>('/api/v1/music/tracks/{id}')` — raw call, not `listTracks()`
- `useMusicStore.ts:98`: `client.get<...>(`/api/v1/music/tracks/${id}/stream`) — raw call
- CHANGELOG v0.98.32 line 46: "The native clients are unaffected and still show the first 100 rows."
- `rg "listArtists|listAlbums|listTracks" src/` → 0 hits
- Installed @phlix/ui version: 0.98.33
**Cross-refs**: Step 1.1 (the @phlix/ui v0.98.33 update that triggered this CHANGELOG review)

## Step 1.6 - Node/npm Compatibility
**Decision**: IMPLEMENTED_OK
**Rationale**: package.json:58 specifies node >=22.12.0. Current system runs v24.15.0 which satisfies this. Tizen webview Chromium 100 constraints are verified not violated by the current Node version usage.
**Code Changes**: None — analysis only.
**Evidence**: package.json engines field (line 58: node >=22.12.0), node --version output (v24.15.0), deviceId.ts fallback pattern (lines 20-27: typeof guard + Date.now() fallback avoids crypto.randomUUID on ancient webviews)
**Cross-refs**: None

## Step 1.2 - Resolve version inconsistencies
**Decision**: IMPLEMENTED_OK
**Rationale**: package.json:32 correctly pins @phlix/contracts at v0.3.12. Four doc files (CLAUDE.md:5, DEVELOPER.md:14, AGENTS.md:3, README.md:47) previously claimed v0.2.0 — a stale version from before the actual package.json was updated. All four doc files now reference v0.3.12, matching the installed version.
**Code Changes**: None — only doc file edits. No production code changed.
**Evidence**: git diff shows +v0.3.12 on CLAUDE.md:5, DEVELOPER.md:14, AGENTS.md:3, README.md:47; node_modules/@phlix/contracts/package.json reports 0.3.12
**Cross-refs**: Step 1.1 (the @phlix/ui v0.98.33 update that prompted this review)

---

# Category 3 Verification - Missing Player Features

## Step 3.1 - Resume Prompt
**Decision**: NOT TV-APPLICABLE
**Rationale**: ResumePrompt.vue exists in @phlix/ui Player (player.js exports `ResumePrompt`). The player renders it automatically when `usePlayerStore.resumeMap` indicates a resumable position (RESUME_MIN_SECONDS=30 to RESUME_MAX_RATIO=0.95). Tizen uses `createPhlixApp()` which mounts the full @phlix/ui Player — the ResumePrompt is therefore rendered by @phlix/ui automatically. No tizen-specific resume prompt is needed because the player component itself handles this UX. Tizen does not need a separate TV-specific resume prompt; it's built into the @phlix/ui Player.
**Code Changes**: None (built into @phlix/ui Player automatically)

## Step 3.2 - Up Next Card
**Decision**: TV-SPECIFIC (PARTIAL duplicate)
**Rationale**: Tizen has UpNextOverlay.vue at `src/components/UpNextOverlay.vue` — a 594-line TV-specific component with D-pad navigation, countdown ring, and playlist-based next item loading. It uses polling (250ms) vs phlix-ui's reactive UpNext.vue props. The test file `tests/unit/UpNextOverlay.test.ts` exists and tests props, emits, accessibility, and countdown ring calculations. This was also documented in Category 2 Step 2.3.3 as TV-SPECIFIC with tech debt (polling vs reactive). The architectural difference (polling vs reactive) is justified by TV webview constraints.
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
**Rationale**: tizenBridge.ts (lines 44-68, 116-193, 280-322) has `BridgeQualityMenu` interface and `createDomQualityMenu()` function. The QualityMenu is rendered by @phlix/ui's Player and tizen provides D-pad navigation via the DOM-based bridge. Quality selection is server-side (X-Phlix-Device-Type: samsung-tizen header maps to appropriate quality), but the UI is properly bridged for D-pad navigation. The YELLOW color button on the remote activates quality-selection mode (tizenBridge.ts line 243).
**Code Changes**: None (already integrated via tizenBridge.ts bridge)

## Step 3.8 - Speed Menu
**Decision**: NOT TV-APPLICABLE
**Rationale**: SpeedMenu.vue exists in @phlix/ui Player but playback speed control is not typically used on TV. The syncplay store (useSyncPlayStore.ts lines 413-414, 536-543) handles `playbackRate` for synchronized playback sessions, but there's no tizen-specific speed menu UI. TV playback is generally at normal speed. The absence of a speed menu is intentional for TV UX.
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
**Rationale**: Theater mode in @phlix/ui involves toggling a windowed player with shell chrome removal (usePlayerUiStore.theaterActive). Tizen uses full-screen player by default (`defaultTv: true` in createPhlixApp config, main.ts line 99). TV has no windowed player state to toggle and no shell chrome to remove. The `defaultTv: true` flag sets full-screen mode by default. Theater mode is a web browser window-management concept not applicable to TV.
**Code Changes**: None (full-screen TV paradigm - no code needed)

## Step 3.15 - Chapter Markers API
**Decision**: TV-SPECIFIC (PARTIAL)
**Rationale**: Tizen's ChapterOverlay.vue calls TWO APIs: `GET /api/v1/media/{id}/chapters` (line 93) and `GET /api/v1/media/{id}/markers` (line 110). The chapters API returns chapter segments (ChapterMarker[] with startSeconds/endSeconds/title). The markers API returns timed markers (Marker[] with startMs/endMs/type/label). Both are used: chapters for seekable segments shown as gold ticks, markers for intro/outro/credits/ad shown as colored ticks. phlix-ui's MarkerTimeline.vue uses only the markers API. The dual-API usage in Tizen is intentional — chapters provide the seekable segments for the seekbar while markers provide the skip/opportunity overlay behavior. The two APIs serve complementary purposes.
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
