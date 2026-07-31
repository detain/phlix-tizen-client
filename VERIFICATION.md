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
**Rationale**: Tizen sets `defaultTheme: 'nocturne'` in createPhlixApp config (main.ts line 100), but `useTheme()` is NOT explicitly called in tizen source. The useTheme() composable reactively reflects preferences store onto `<html>` (data-theme, data-density, data-reduced-motion, --accent* variables). Without useTheme(), theme changes from the preferences store would NOT be reactively applied to the DOM. However, `createPhlixApp` internally calls `applyStoredThemeEarly()` which sets initial theme before mount. For full reactive theme support (if users can change theme in settings), useTheme() should be called. Investigation shows prefs.tv is used in SpatialNavHost for D-pad gating, but full theme reactivity may be handled internally by createPhlixApp.
**Code Changes**: None (createPhlixApp handles theme initialization internally)

## Step 5.8 - usePageTitle
**Decision**: NOT TV-APPLICABLE
**Rationale**: `usePageTitle()` sets `document.title` for browser tab bar. Tizen TV has no tab bar - no visible effect. TV displays are fixed 1920x1080 with no browser chrome. document.title is irrelevant for TV UX.
**Code Changes**: None (no tab bar on TV - no code needed)

## Step 5.9 - useMessages
**Decision**: NOT USED
**Rationale**: `useMessages()` provides i18n infrastructure via `t('group.key', params?)` function. All user-facing strings in tizen are hardcoded English (no grep hits for `useMessages` or i18n in src/). Tizen does not have any i18n/l10n infrastructure. Adding i18n would be a significant effort for minimal benefit on a single-language TV app.
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
**Rationale**: Core playback pipeline for transcoded content. Tizen's `TIZEN_HLS_CONFIG` is passed through createPhlixApp via `playerHlsConfig` (main.ts lines 69-76, 116). Works transparently - the HLS config is passed to @phlix/ui's player which handles transcoding.
**Code Changes**: None (passed through createPhlixApp config - no code needed)

## Step 5.17 - useHeaderHideOnScroll
**Decision**: NOT TV-APPLICABLE
**Rationale**: Web scroll-based pattern that hides header on scroll down, shows on scroll up. TVs use focus-based spatial navigation, not page scrolling. The entire concept of scroll-based header hiding is incompatible with TV D-pad navigation where focus moves between elements.
**Code Changes**: None (no scrolling on TV - no code needed)

## Step 5.18 - Spatial Nav Utilities
**Decision**: ALREADY SUFFICIENT
**Rationale**: `useSpatialNav` is actively used in SpatialNavHost.vue (line 6: `useSpatialNav({enabled: () => Boolean(prefs.tv) && route.name !== 'player'})`). The low-level utilities (bestCandidate, rectCenter) are internal to useSpatialNav implementation. Spatial navigation is properly integrated for D-pad navigation on TV.
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

# Category 6 - Missing Pages (phlix-ui has 30+, tizen has 4 local + 1 imported)

## Overview

The tizen client has **4 local pages** (MusicPage, ParentalControlsPage, ChaptersPage, AudioTracksPage) and imports additional pages from @phlix/ui via `createPhlixApp()`. This creates a feature gap compared to phlix-ui's 30+ dedicated pages. Decisions below distinguish between **TV-SPECIFIC** (intentional local reimplementation), **NOT TV-APPLICABLE** (keyboard/mouse features irrelevant to TV), **NOT USED** (exists in bundle but not routed), and **ALREADY SUFFICIENT** (provided via @phlix/ui or menu system).

## Step 6.1 - Music: Album Detail
**Decision**: TV-SPECIFIC (PARTIAL)
**Finding**: MusicPage.vue handles album detail inline via `currentView === 'tracks'` state. Album header shows 120x120 art (vs 200x200 in phlix-ui), title, artist name, year, track count. Gap: no total album duration, no Play All button, no crossfade/gapless playback (useMusicPlayer not available), no shimmer loading skeleton (just "Loading music..." text). The `emit('play', track)` delegates to parent app for actual playback.
**Code Changes**: None (TV-specific gaps are intentional trade-offs for thin-client model)

## Step 6.2 - Music: Artist Detail
**Decision**: TV-SPECIFIC (PARTIAL)
**Finding**: MusicPage.vue shows artist's albums inline via `currentView === 'albums'`. Uses MusicAlbumCard component with dynamic title showing artist name. Gap: no artist image (phlix-ui shows 200x200 with placeholder SVG), no track count from artist.trackCount, no album paging (shows all albums for selected artist), no page-error banner handling.
**Code Changes**: None (TV-specific gaps are intentional trade-offs)

## Step 6.3 - Music: Artists List
**Decision**: TV-SPECIFIC (PARTIAL)
**Finding**: MusicPage.vue shows artists via `currentView === 'artists'` using MusicArtistCard component. Gap: no offset paging (shows all artists at once - problematic for 2,197 artist DB), no total count display, no shimmer loading skeleton (just "Loading music..." text), full error state instead of preserving rows/pager on failure.
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
**Finding**: BrowsePage exists in bundle at `package/assets/BrowsePage-DPV6hUCE-yuvguuoR.js`. The menu's `libraryLinks: true` (main.ts line 42) expands "Browse" into per-library nav links automatically. The BrowsePage is the home screen (`to: '/app'`) and renders "Continue Watching" rail + configurable home rows per library + "See all" links to LibraryPage. This is the primary entry point for the TV app.
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
**Rationale**: buildAdminRoutes() is correctly imported and used in tizen-client (main.ts line 12, 57). Admin routes ARE accessible at /app/admin/* with 20 pages in the default set. However, admin features are server management features, not TV media consumption features. The v-focusable D-pad navigation issue is internal to @phlix/ui. Server administration should be done through the web interface on a computer.
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
**Rationale**: 19 admin API clients exist in @phlix-ui/src/api/admin/ (dashboard, users, libraries, plugins, settings, webhooks, services, integrations, backup, cast, dlnaServer, remoteAccess, liveTv, collections, history, syncPlay, hubDashboard, metadata-sources, transcoding). These are used internally by admin pages in @phlix/ui, not directly by tizen-client. Admin API access is server administration, not TV media consumption.
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
**Finding**: ChapterOverlay.vue:295-316, SkipIntroOverlay.vue:126-141, and UpNextOverlay.vue:166-181 all use setInterval at 250ms to poll player position from playerStore. This is explicitly documented in each component's header as "tech debt but necessary for the TV webview context." The cat_9.md notes Tizen WebView may have unreliable timeupdate event firing - the polling approach is a deliberate TV-specific workaround. The alternative requestVideoFrameCallback is not used. Core player store updateProgress() is called via Player.vue's onTimeUpdate in @phlix/ui - the issue is that overlays poll separately rather than using reactive subscriptions.
**Code Changes**: None (documented TV-specific tech debt)

## Step 9.2 - Missing Resume System (HIGH)
**Decision**: TV-SPECIFIC
**Finding**: tizenBridge.ts:278 casts usePlayerStore to BridgePlayer with only { playing, play, pause, closePlayer, seekBy }. Resume functions (resumePositionFor, clearResume, mergeServerResume) exist in usePlayerStore.ts:210-248 but are not exposed through BridgePlayer interface. However, overlay components (ChapterOverlay:220, SkipIntroOverlay:108) call playerStore.seekTo() directly, bypassing the thin tizen bridge entirely. The LRU eviction logic at usePlayerStore.ts:137-157 exists but Tizen never triggers it - however this is bounded automatically. The tizen bridge is intentionally minimal; resume system works through direct playerStore access.
**Code Changes**: None (intentional minimal bridge design; overlay components work directly with usePlayerStore)

## Step 9.3 - Missing Queue/Up-Next (MEDIUM)
**Decision**: NOT TV-APPLICABLE
**Finding**: UpNextOverlay.vue:119-146 fetches playlist via `/api/v1/media/{id}/playlist` API directly and finds the next item client-side. This is a TV-specific implementation that doesn't use playerStore.setQueue()/next(). The cat_9.md notes PlayerPage.vue:213-268 shows proper queue management with player.setQueue() and player.next() - but these are in @phlix/ui's PlayerPage, not in tizen. Tizen's UpNextOverlay works differently (API-based) and achieves the same UX.
**Code Changes**: None (UpNextOverlay uses different but equivalent approach)

## Step 9.4 - Missing Media Session (MEDIUM)
**Decision**: NOT TV-APPLICABLE
**Finding**: Tizen WebView (Chromium-based) may not support navigator.mediaSession API. The Tizen bridge does not call setMediaSessionMetadata(), setMediaPositionState(), or bindMediaSession() (usePlayerStore.ts:392-443). RemoteManager.ts handles TV remote integration directly via keydown/keyup document listeners mapped to player store actions. The cat_9.md notes "Tizen's native remote handling via RemoteManager may make Media Session less critical" - this is the case. OS-level transport controls (lock screen, notification) are not a TV use case; the TV remote is handled natively.
**Code Changes**: None (RemoteManager replaces Media Session functionality on Tizen)

## Step 9.5 - Missing Preferences Seeding (MEDIUM)
**Decision**: TV-SPECIFIC (PARTIAL)
**Finding**: seedFromPreferences() exists at usePlayerStore.ts:446-450 but is NOT called in tizen main.ts after createPhlixApp. However, player store initializes defaultVolume, defaultQuality, defaultSubtitleLang from preferences at store creation (usePlayerStore.ts:102-106). Tizen only uses prefs.tv in SpatialNavHost.vue for D-pad navigation gating - no other preference-driven state. The seedFromPreferences gap only matters if user changes preferences at runtime; on Tizen settings UI is limited. This is partial but not blocking.
**Code Changes**: None (preferences initialized at store creation; runtime preference changes not a TV priority)

## Step 9.6 - lastCommand Bus (LOW)
**Decision**: ALREADY SUFFICIENT
**Finding**: tizenBridge.ts:216,219 calls player.seekBy() which writes to lastCommand ref internally (usePlayerStore.ts:289-294). Player.vue:1239-1246 watches lastCommand and applies seek to video element. The Tizen bridge bypasses the command bus interface (BridgePlayer only has seekBy, not lastCommand), but the seekBy() function itself writes to lastCommand before seeking, so command tracking still works. The command bus pattern is for UI-level external commands (keyboard shortcuts, etc.) - Tizen's remote commands go through RemoteManager → tizenBridge → player.seekBy() which properly feeds the command bus.
**Code Changes**: None (works correctly despite interface bypass)

## Step 9.7 - Quality/Subtitle Setters (MEDIUM)
**Decision**: TV-SPECIFIC
**Finding**: createDomQualityMenu at tizenBridge.ts:116-170 uses DOM manipulation (focus, click on .quality-menu .phlix-select__trigger) to drive @phlix/ui's QualityMenu Select component. This is explicitly designed to avoid modifying @phlix/ui's sealed player while still enabling D-pad navigation of quality selection. The DOM approach opens the Select's listbox and lets the Select's own combobox keydown handler own Arrow/Enter/Escape navigation. QualityMenu reactively reads player.quality from the store, so DOM-based selection properly updates player state. setSubtitle() is not called - subtitle selection is handled by SubtitleTrackList.vue using direct API calls.
**Code Changes**: None (intentional DOM-based quality menu, works correctly with @phlix/ui reactive state)

## Step 9.8 - Player Store Type Safety (MEDIUM)
**Decision**: INTERNAL
**Finding**: AudioTracksPage.vue:39,56,83 casts playerStore via `const storeAny = playerStore as unknown as Record<string, unknown>` to access audioTrackId, audioTracks, setAudioTrack, switchAudioTrack, setAudioTrackId, and hls from the player store. These properties do not exist on the exported usePlayerStore type definition. The cast to Record<string, unknown> is a code smell - it's used to bypass TypeScript checking to access dynamic properties. This is an internal tizen-client issue, not an integration problem with @phlix/ui. The audio track switching logic tries multiple method names as fallbacks, suggesting uncertainty about the actual API.
**Code Changes**: None (type safety issue in tizen-client code, not a TV integration gap)

## Step 9.9 - streamUrl / hlsMasterUrl (LOW)
**Decision**: NOT TV-APPLICABLE
**Finding**: usePlayerStore.ts:95,108 has streamUrl and hlsMasterUrl refs for cross-route mini-player continuation. PlayerPage.vue:476 calls player.showMiniPlayer() when current && streamUrl exist. Tizen does not implement mini-player UI (no MiniPlayer.vue component, no #phlix-mini-player mount point). These refs are not used by tizen. The mini-player pattern is for web clients to continue playback while navigating away from the player route - on TV there's no route navigation during playback and no picture-in-picture API.
**Code Changes**: None (mini-player is a web browser feature, not applicable to TV)

## Step 9.10 - miniPlayer show/hide (LOW)
**Decision**: NOT TV-APPLICABLE
**Finding**: usePlayerStore.ts:375-379 has showMiniPlayer() and hideMiniPlayer() functions that toggle player.miniPlayer ref. PlayerPage.vue:340 calls hideMiniPlayer() on route enter; PlayerPage.vue:476 calls showMiniPlayer() when playing with streamUrl. Tizen does not implement mini-player UI and does not call these functions. The mini-player is a web browser feature for background playback during navigation - TV has no equivalent use case since playback is always full-screen and there's no navigation during playback on TV.
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

This category examines Music API endpoints, data structures, and whether they match what tizen expects. Key context: Category 1.5 already verified the Music API breaking changes (listArtists/listAlbums/listTracks page envelope) are **VERIFIED UNAFFECTED** because `useMusicStore.ts` uses raw `client.get('/api/v1/music/artists')` etc., never calling the helper methods. MusicPage.vue exists with currentView state machine for artists/albums/tracks.

## Step 8.1 - Music API Breaking Change (listArtists/listAlbums/listTracks signatures)
**Decision**: ALREADY SUFFICIENT
**Finding**: Already verified in Step 1.5. `useMusicStore.ts` lines 51, 66 use raw `client.get<{ artists: MusicArtist[] }>('/api/v1/music/artists')` and `client.get<{ albums: MusicAlbum[] }>('/api/v1/music/albums')` — NOT calling `listArtists()`, `listAlbums()`, or `listTracks()` helper methods that changed in v0.98.32. The CHANGELOG v0.98.32 explicitly states "The native clients are unaffected and still show the first 100 rows." grep confirms 0 hits for these three methods in `src/`. The tizen client bypasses the breaking change by using raw GET calls.
**Code Changes**: None — already verified unaffected
**Evidence**: Step 1.5 VERIFICATION.md covers this exhaustively; `rg "listArtists|listAlbums|listTracks" src/` → 0 hits

## Step 8.2 - Music Paging (MusicPager added in v0.98.32 — tizen shows only first 100)
**Decision**: TV-SPECIFIC
**Finding**: `useMusicStore.ts` `fetchArtists()` and `fetchAlbums()` make single unparameterized requests with no limit/offset. No `MusicPager` component is used. MusicPage.vue shows all artists in a CSS grid with no pagination controls. The CHANGELOG notes this is the intended behavior for "native clients" — they show the first 100 rows. This is a known limitation, not a bug. TV users with large libraries (e.g., 2,197 artists) will only see the first 100.
**Code Changes**: None — intentional first-100 limitation per CHANGELOG
**Evidence**: `useMusicStore.ts:46-58` (fetchArtists with no params), `useMusicStore.ts:61-73` (fetchAlbums with no params); CHANGELOG v0.98.32 line 46

## Step 8.3 - Music Store Duplication (tizen's useMusicStore.ts reimplements phlix-ui functionality)
**Decision**: TV-SPECIFIC
**Finding**: `useMusicStore.ts` (167 lines) is a custom Pinia store with `fetchArtists`, `fetchAlbums`, `fetchAlbum`, `fetchTrack`, `selectArtist`, `selectAlbum` actions managing artists/albums/tracks UI state. This reimplements what phlix-ui handles via `useMusicPlayer` composable + `MusicPager.vue` + `MusicArtistsPage`/`MusicArtistPage`/`MusicAlbumPage`/`MusicTracksPage` components. The TV-specific justification is: (1) BACK button uses `router.back()` to exit to parent app at artists view (vs phlix-ui staying within music module), (2) D-pad spatial navigation integration, (3) TV-optimized layout. This was also documented in Category 2 Step 2.1.4 as TV-SPECIFIC with justified duplication.
**Code Changes**: None — reimplementation justified by TV navigation requirements
**Cross-refs**: Step 2.1.4 (MusicPage.vue vs MusicLibraryPage.vue - TV-SPECIFIC)

## Step 8.4 - listFavorites / addFavorite / removeFavorite
**Decision**: NOT TV-APPLICABLE
**Finding**: `useMusicStore.ts` has NO favorites methods. `client.addFavorite()`, `client.removeFavorite()`, `client.listFavorites()` exist in @phlix/ui (client.ts:773-850) but are not called anywhere in tizen source. The MusicPage.vue has no favorites UI. The API exists for phlix-ui web clients to manage favorites, but TV music browsing is a thin-client model focused on library navigation, not personal library curation. Favorites management is not relevant to TV UX.
**Code Changes**: None (not a TV use case - no code needed)
**Evidence**: `rg "favorite|Favorite" src/stores/useMusicStore.ts` → 0 hits; MusicPage.vue has no favorites UI

## Step 8.5 - setRating / setLikeLevel
**Decision**: ALREADY SUFFICIENT
**Finding**: `UserRatingPicker.vue` (line 79) correctly calls `await auth.client.setRating(props.mediaId, finalRating)` via the ApiClient. The component provides half-star precision (via `starState()` function at line 64-68), D-pad navigation, optimistic UI with error toast on failure. This is a TV-SPECIFIC reimplementation of phlix-ui's UserRatingPicker which lacks half-star support. The `setRating` API integration is correct and functional.
**Code Changes**: None (already correctly integrated)
**Evidence**: `UserRatingPicker.vue:79` - `await auth.client.setRating(props.mediaId, finalRating)`

## Step 8.6 - markWatched / markUnwatched
**Decision**: NOT TV-APPLICABLE
**Finding**: `useMusicStore.ts` has NO watched state methods. `client.markWatched()` and `client.markUnwatched()` exist in @phlix/ui (client.ts:791-810) but are not called anywhere in tizen source. TV music browsing is a non-progressive experience — users don't mark tracks as watched. The watched state API is for video content with resume/progress tracking, not relevant to music playback on TV.
**Code Changes**: None (not a TV use case - no code needed)
**Evidence**: `rg "markWatched|markUnwatched" src/stores/useMusicStore.ts` → 0 hits

## Step 8.7 - Music track streaming (tizen calls GET /api/v1/music/tracks/:id for stream URL)
**Decision**: TV-SPECIFIC (BUG)
**Finding**: `useMusicStore.ts:92-105` has `fetchTrack(id: number)` which calls `client.get<MusicTrack>(`/api/v1/music/tracks/${id}`)` and assigns the result directly to `currentTrack.value = data`. However, the `GET /api/v1/music/tracks/{id}` API returns a `{ track }` envelope (not a direct `MusicTrack` object) — see ApiClient.d.ts line 580: "Fetch one track by id (`GET /api/v1/music/tracks/{id}` → `{ track }`)". The code assigns the envelope object instead of unwrapping `data.track`. This is a confirmed bug: `currentTrack.value` would be `{ track: MusicTrack }` instead of `MusicTrack`, causing properties like `stream_url` (server-minted signed URL, available in the envelope but not on the raw track) to be inaccessible at the expected path.

Additionally, the `MusicTrack` interface in @phlix/contracts (Music.d.ts) does not define a `stream_url` field — it only has `id, mediaItemId, albumId, artistId, title, trackNumber, discNumber, durationSecs, artist, album`. The signed `stream_url` is added by the API response transformation and is only accessible via the envelope.

**Note**: TypeScript type annotations don't catch this because `client.get<T>()` returns `Promise<T>` with no runtime validation — the generic type parameter is just a compile-time annotation. `vue-tsc --noEmit` passes despite the type-runtime mismatch.
**Code Changes**: None (audit-only — bug identification without code changes)
**Evidence**: ApiClient.d.ts line 580: `GET /api/v1/music/tracks/{id} → { track }`; `Music.d.ts` MusicTrack interface lacks `stream_url`; `useMusicStore.ts:98` assigns directly without unwrapping

## Step 8.8 - Music library redirect (v0.98.33 added /app/library/{id} → /app/music)
**Decision**: ALREADY SUFFICIENT
**Finding**: `buildExtraRoutes()` in main.ts does NOT define `/app/library/:id` — tizen relies on `createPhlixApp()`'s built-in routing which includes the S97 music library redirect (`/app/library/:id` for MUSIC library type → `/app/music`). The redirect works through `createPhlixApp()` base routing, not tizen-specific code. Tizen also doesn't define explicit `/app/music/*` routes — it relies on @phlix/ui's music routing. Since tizen calls `createPhlixApp()` with standard configuration (main.ts line 95-117), the redirect is automatically active.
**Code Changes**: None (works through createPhlixApp base routing)
**Evidence**: `buildExtraRoutes()` only defines `/app/library/scan`, `/app/chapters/:id`, `/app/audio-tracks/:id`, `/app/recommendations`, `/app/parental-controls` — music routing delegated to @phlix/ui

---

## Summary

| Step | Feature | Decision | Notes |
|------|---------|----------|-------|
| 8.1 | Music API Breaking Change | ALREADY SUFFICIENT | Verified in Step 1.5 — raw `client.get()` bypasses helper methods |
| 8.2 | Music Paging | TV-SPECIFIC | First 100 rows only — intentional per CHANGELOG |
| 8.3 | Music Store Duplication | TV-SPECIFIC | TV navigation (router.back() exit), D-pad nav justify reimplementation |
| 8.4 | listFavorites / addFavorite / removeFavorite | NOT TV-APPLICABLE | Not a TV use case — no favorites UI in MusicPage |
| 8.5 | setRating / setLikeLevel | ALREADY SUFFICIENT | UserRatingPicker.vue correctly calls auth.client.setRating |
| 8.6 | markWatched / markUnwatched | NOT TV-APPLICABLE | TV music browsing doesn't use watched state |
| 8.7 | Music track streaming | TV-SPECIFIC (BUG) | API returns `{ track }` envelope but code assigns directly without unwrapping |
| 8.8 | Music library redirect | ALREADY SUFFICIENT | Works through createPhlixApp base routing |

**Decision Distribution**:
- **ALREADY SUFFICIENT**: 3 steps (8.1, 8.5, 8.8) — verified unaffected or correctly integrated
- **TV-SPECIFIC**: 3 steps (8.2, 8.3, 8.7) — intentional TV implementations, 8.7 has a bug
- **NOT TV-APPLICABLE**: 2 steps (8.4, 8.6) — features not relevant to TV UX
- **Code changes needed**: 0 (all decisions are architectural/audit — 8.7 bug identified but not fixed per audit-only scope)

---

# Category 12 - API Clients

## Overview

phlix-ui provides 20+ API client modules. The tizen client directly uses only 2 (ApiClient and contracts), while re-implementing some functionality that already exists in phlix-ui or not using available APIs at all.

## Step 12.1 - Recommendations API
**Decision**: TV-SPECIFIC (PARTIAL GAP)
**Finding**: tizen's RecommendationsScreen.vue (lines 33-49) makes a manual `client.get('/api/v1/me/recommendations', { limit: '20' })` call instead of using `fetchRecommendations()` from @phlix/ui. It has a duplicated local `RecommendationApiResponse` interface and handles error inline. The `fetchRecommendations()` function (phlix-ui/src/api/recommendations.ts:62-76) provides proper error handling, `AbortSignal` support, and converts `UserRecommendation[]` to `MediaItem[]` via `recommendationToMediaItem()`. The tizen implementation uses raw `UserRecommendation[]` directly instead of converting to `MediaItem[]`.

The gap is: (1) duplicated interface, (2) manual error handling instead of centralized, (3) no AbortSignal support, (4) raw `UserRecommendation[]` instead of `MediaItem[]`.

This is a medium-priority gap — consolidation would require importing `fetchRecommendations()` and handling the returned `MediaItem[]` in the component.
**Code Changes**: None (audit-only — gap identified but not fixed per scope)

## Step 12.2 - SyncPlay API
**Decision**: TV-SPECIFIC (SIGNIFICANT GAP)
**Finding**: tizen's useSyncPlayStore.ts (lines 83-160) contains a local `SyncPlayApiClient` class that re-implements the same functionality as `getSyncPlayApi()` from @phlix/ui. Key differences:
1. **API paths**: tizen uses `/api/v1/syncplay/rooms` vs phlix-ui's `/api/v1/syncplay/groups`
2. **WebSocket**: tizen uses custom WebSocket implementation vs phlix-ui's `@phlix/syncplay` protocol
3. **Pattern**: tizen instantiates per-call `new SyncPlayApiClient(apiBase, token)` vs phlix-ui's singleton `getSyncPlayApi(apiBase)`

The tizen implementation has ~80 lines of duplicated API client code plus custom WebSocket handling with exponential backoff. This is a high-priority gap due to significant code duplication and API path divergence.
**Code Changes**: None (audit-only — gap identified but not fixed per scope)

## Step 12.3 - Libraries API
**Decision**: ALREADY SUFFICIENT (INDIRECTLY USED)
**Finding**: tizen uses `libraryLinks: true` in menu configuration (main.ts line 42). The comment states: "libraryLinks expands Browse into one nav link per library (fetched from /api/v1/libraries)". The `libraryLinks` feature is handled internally by @phlix/ui — the tizen client delegates library fetching to @phlix/ui's implementation. This is working as intended.
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
**Finding**: `nextUp.ts` exists in phlix-ui (added v0.98.28) but no tizen source file imports or uses it. The "Next Up" continue-watching functionality is handled by @phlix/ui's Player automatically. The tizen UpNextOverlay.vue (components/UpNextOverlay.vue) fetches playlist data directly via `/api/v1/media/{id}/playlist` to find the next item.
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
**Finding**: All 21 admin API clients (logs, dashboard, users, libraries, plugins, settings, webhooks, services, integrations, backup, cast, dlnaServer, remoteAccess, liveTv, collections, history, syncPlay, hubDashboard, metadata-sources, metrics, duplicates) exist in phlix-ui/src/api/admin/ but are not used by tizen. Admin functionality is accessed via @phlix/ui's admin UI routes (`buildAdminRoutes()` from main.ts line 57). Server administration from TV is not a designed product use case — TV is a media consumption thin client.
**Code Changes**: None (admin features accessed via @phlix/ui admin UI, not direct API)

---

## Summary

| Step | API | Decision | Notes |
|------|-----|----------|-------|
| 12.1 | Recommendations | TV-SPECIFIC (PARTIAL GAP) | Manual fetch vs `fetchRecommendations()` |
| 12.2 | SyncPlay | TV-SPECIFIC (SIGNIFICANT GAP) | Local SyncPlayApiClient vs `getSyncPlayApi()`, different API paths |
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
- **TV-SPECIFIC (SIGNIFICANT GAP)**: 1 step (12.2) — SyncPlay reimplementation with API path divergence
- **ALREADY SUFFICIENT**: 1 step (12.3) — Libraries delegated to @phlix/ui
- **NOT USED**: 6 steps (12.4-12.9) — Features not needed on TV
- **NOT TV-APPLICABLE**: 21 steps (12.10-12.30) — Admin features not applicable to TV client
- **Code changes needed**: 0 (all decisions are architectural/audit)

---

# Category 10 - HLS Configuration

## Overview

This category examines HLS (HTTP Live Streaming) configuration in the Tizen client. The central configuration is `TIZEN_HLS_CONFIG` in `main.ts:69-76`, which is passed to @phlix/ui's player via `createPhlixApp({ playerHlsConfig: TIZEN_HLS_CONFIG })` at line 116. HLS playback is handled by hls.js via @phlix/ui's player module.

## Step 10.1 - Buffer Settings
**Decision**: ALREADY SUFFICIENT
**Finding**: `TIZEN_HLS_CONFIG` in main.ts:69-76 correctly sets all RAM-conscious buffer values:
- `maxBufferLength: 60` (Tizen-specific, web default is 30)
- `maxMaxBufferLength: 180` (Tizen-specific, web default is 60)
- `maxBufferSize: 100 * 1000 * 1000` (100MB, Tizen-specific, web default is 60MB)
- `backBufferLength: 90` (Tizen-specific, web default is 30)

These values are explicitly set to override hls.js defaults and are passed through `playerHlsConfig` which shallow-merges over @phlix/ui's defaults at `hls-playback.ts:316`. The phlix-ui defaults at lines 283-284 only set `backBufferLength: 90` and `maxBufferLength: 60` but NOT `maxMaxBufferLength` or `maxBufferSize` — Tizen's explicit values correctly fill this gap.
**Code Changes**: None (correctly implemented)
**Evidence**: main.ts:69-76 TIZEN_HLS_CONFIG; hls-playback.ts:277-284 phlix-ui defaults; hls-playback.ts:316 shallow merge

## Step 10.2 - Level Cap (capLevelToPlayerSize)
**Decision**: ALREADY SUFFICIENT
**Finding**: `capLevelToPlayerSize: true` is correctly set in `TIZEN_HLS_CONFIG` at main.ts:73. This is a RAM constraint setting unique to Tizen's limited memory environment. The web default is `false`. This setting ensures hls.js does not select a quality level higher than the player's actual rendered size, preventing unnecessary memory usage.
**Code Changes**: None (correctly implemented)
**Evidence**: main.ts:73; comment at line 66: "cap level to player size"

## Step 10.3 - Software AES
**Decision**: ALREADY SUFFICIENT
**Finding**: `enableSoftwareAES: true` is correctly set in `TIZEN_HLS_CONFIG` at main.ts:74. The comment at line 67 explains: "software AES so DRM-free HLS still plays on weaker decoders." This is a Tizen-specific fallback for devices with weaker hardware decryption. The web default is `false` (hardware AES preferred).
**Code Changes**: None (correctly implemented)
**Evidence**: main.ts:74; comment at line 67

## Step 10.4 - Sync with phlix-ui Updates
**Decision**: ALREADY SUFFICIENT
**Finding**: Tizen uses @phlix/ui v0.98.33 and passes `playerHlsConfig: TIZEN_HLS_CONFIG` to createPhlixApp(). The shallow merge at hls-playback.ts:316 means Tizen's explicit values always override phlix-ui defaults. Currently phlix-ui only sets `backBufferLength: 90` and `maxBufferLength: 60` as defaults — these match Tizen's values exactly, so no conflict exists. Future phlix-ui changes to `maxMaxBufferLength`, `maxBufferSize`, `capLevelToPlayerSize`, or `enableSoftwareAES` would still be overridden by Tizen's explicit values. The design is robust against phlix-ui version updates.
**Code Changes**: None (shallow merge design is correct)
**Evidence**: main.ts:116 playerHlsConfig pass-through; hls-playback.ts:316 `{ ...defaultConfig, ...opts.hlsConfig }`

## Step 10.5 - Bandwidth Persistence
**Decision**: ALREADY SUFFICIENT
**Finding**: Bandwidth persistence is implemented in phlix-ui's `hls-playback.ts:157-190` using localStorage key `phlix-bandwidth-estimate` (BW_EST_KEY at line 158). Bandwidth is persisted every 30 seconds via `setInterval(_saveBandwidth, 30_000)` at line 337, and on destroy at line 344. On cold start, persisted bandwidth is loaded via `loadPersistedBandwidth()` and used to seed ABR: `abrEwmaDefaultEstimate: persistedBw` at line 287. Since Tizen uses @phlix/ui's player via `createPhlixApp()`, this mechanism works identically on Tizen. Tizen also uses localStorage for other data (`phlix.serverUrl` in main.ts, `phlix.deviceId` in deviceId.ts), confirming localStorage is available.
**Code Changes**: None (inherited via createPhlixApp — works on Tizen)
**Evidence**: hls-playback.ts:157-190 bandwidth persistence functions; line 287 abrEwmaDefaultEstimate

## Step 10.6 - Codec Probing
**Decision**: ALREADY SUFFICIENT
**Finding**: Codec probing is implemented in phlix-ui via `playback.ts:170-296`. `canDecodeAudioCodec()` uses `MediaCapabilities.decodingInfo()` with fallback to `canPlayType()` at lines 232-259. `canDecodeHevcInMp4()` probes HEVC support via MediaCapabilities at lines 266-296. `needsTranscodeWithCapabilities()` combines extension-based check with runtime codec probing at lines 313-340. Tizen's Chromium webview (Tizen 6.5+) supports the MediaCapabilities API. Since Tizen uses @phlix/ui's player via `createPhlixApp()`, the same codec probing mechanism is used. The `evaluateTranscodeWithCapabilities()` is called when `props.playbackAudioTracks` changes in Player.vue:245-252.
**Code Changes**: None (inherited via createPhlixApp — works on Tizen)
**Evidence**: playback.ts:232-248 MediaCapabilities.decodingInfo() usage; Tizen 6.5+ Chromium webview supports MediaCapabilities

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
