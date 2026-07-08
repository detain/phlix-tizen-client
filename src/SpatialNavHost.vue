<script setup lang="ts">
/**
 * Renderless host for spatial navigation.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
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
import { useRoute } from 'vue-router';
import { useSpatialNav, usePreferencesStore } from '@phlix/ui';
import { qualityMenuActive } from './tizenBridge';

const route = useRoute();
const prefs = usePreferencesStore();

useSpatialNav({
  enabled: () => Boolean(prefs.tv) && route.name !== 'player' && !qualityMenuActive.value
});
</script>

<template>
  <div style="display: none" />
</template>
