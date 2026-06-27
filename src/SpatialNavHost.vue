<script setup lang="ts">
// Renderless host that opts @phlix/ui's spatial navigation in/out per route.
// It is mounted as a SECOND tiny Vue app sharing the SAME pinia + router as
// the main phlix-ui app (see main.ts), so `route` and `prefs` observe the
// real shared state. useSpatialNav re-reads `enabled` on every keydown.
//
// Spatial-nav is enabled for D-pad browsing when the TV layout is active, but
// DISABLED on the player route so phlix-ui's own Arrow seek/volume shortcuts win.
import { useRoute } from 'vue-router';
import { useSpatialNav, usePreferencesStore } from '@phlix/ui';

const route = useRoute();
const prefs = usePreferencesStore();

useSpatialNav({
  enabled: () => Boolean(prefs.tv) && route.name !== 'player'
});
</script>

<template>
  <div style="display: none" />
</template>
