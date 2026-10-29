<script setup lang="ts">
/**
 * Renderless host for spatial navigation.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// Renderless host that opts @phlix/ui's spatial navigation in/out per route.
// It is mounted as a SECOND tiny Vue app sharing the SAME pinia + router as
// the main phlix-ui app (see main.ts), so `route` and `prefs` observe the
// real shared state. useSpatialNav re-reads `enabled` on every keydown.
//
// Spatial-nav is enabled for D-pad browsing when the TV layout is active, but
// DISABLED on the player route so phlix-ui's own Arrow seek/volume shortcuts win.
// It is ALSO disabled whenever quality-selection mode is active (the YELLOW
// button opened the on-screen QualityMenu): the focused Select owns the D-pad
// then, so spatial-nav must not contest it. On the player route it is already
// off, but gating on the shared flag keeps the invariant explicit. The flag is
// torn down on EVERY exit — the Select closing itself (rung select / Escape),
// explicit BACK/YELLOW deactivate, leaving the player route (a router.afterEach
// guard in tizenBridge), and bridge cleanup — so it can never get stuck `true`
// and freeze D-pad navigation app-wide.
//
// S526 / AD-10: the BACK key now walks a pure layer-stack ladder in
// `remote/backPolicy.ts` (row-snap → topmost-modal-close → history-back →
// explicit app exit at root). The modal-close rung dismisses the quality
// flyout FIRST, so `qualityMenuActive` still tears down on BACK exactly as
// before — the shared flag keeps gating spatial-nav out while the flyout is up.
//
// C27 / review tizen__gameux: an enabled engine with an EMPTY candidate pool is
// what made the D-pad inert — the ui bundle never invokes `v-focusable`, so
// nothing ever entered `focusableRegistry`. This host now owns populating it:
// `spatial/focusCandidates.ts` keeps every currently-interactive element under
// document.body registered while the host lives, and the engine's `enabled`
// gate alone decides whether moves are allowed (surface-off = pool idle, never
// contesting the player or the quality flyout).
import { onBeforeUnmount, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useSpatialNav, usePreferencesStore, focusableRegistry } from '@phlix/ui';
import { qualityMenuActive } from './tizenBridge';
import { createFocusCandidateWatcher } from './spatial/focusCandidates';

const route = useRoute();
const prefs = usePreferencesStore();

useSpatialNav({
  enabled: () => Boolean(prefs.tv) && route.name !== 'player' && !qualityMenuActive.value
});

let candidateWatcher: ReturnType<typeof createFocusCandidateWatcher> | null = null;

onMounted(() => {
  candidateWatcher = createFocusCandidateWatcher({ root: document.body, registry: focusableRegistry });
});

onBeforeUnmount(() => {
  candidateWatcher?.destroy();
  candidateWatcher = null;
});
</script>

<template>
  <div style="display: none" />
</template>
