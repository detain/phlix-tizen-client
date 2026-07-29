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
**Status**: SIMILAR - Feature parity review needed
**Finding**: Tizen has Play, watchlist, info. phlix-ui additionally has mark-watched, edit-metadata, explore-data. Feature parity gap identified. Review needed to align feature sets.
**Code Changes**: None (documentation only)

---

# Category 1 Verification - Version & Dependency Analysis

## Step 1.3 - @phlix/* Dependencies
**Status**: Verified aligned
**Finding**: @phlix/contracts v0.3.12, @phlix/syncplay v0.1.2 - aligned between tizen-client and phlix-ui

## Step 1.4 - @phlix/tokens Integration
**Status**: Verified OK
**Finding**: @phlix/tokens v0.1.1 transitively included via @phlix/ui/style.css

## Step 1.5 - Music API Breaking Changes
**Status**: Verified no impact
**Finding**: useMusicStore.ts uses raw `client.get()` not ApiClient music methods

## Step 1.6 - Node/npm Compatibility
**Status**: Verified compatible
**Finding**: Node v24.15.0 >= v22.12.0 required by tizen-client
