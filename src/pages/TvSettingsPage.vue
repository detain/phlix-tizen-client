<script setup lang="ts">
/**
 * TvSettingsPage — the TV-own Settings surface (TIZ-S16).
 *
 * Route: /app/tv-settings (registered via buildExtraRoutes in main.ts; the
 * shared `/app/settings` page is @phlix/ui-owned, so TV-only device prefs live
 * here). First row: the screensaver idle duration, fully remote-operable —
 * Enter/OK steps forward, Left/Right step back/forward through
 * `IDLE_TIMEOUT_PRESETS_MS`. The choice persists in the same localStorage slot
 * `resolveIdleTimeoutMs` already parses (`phlix.screensaver.idleMs`), and the
 * always-mounted overlay re-reads it on its 1 s tick. Zero request sites.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { tTizen } from '../i18n/tizen';
import {
  persistIdleTimeoutMs,
  resolveIdleTimeoutMs,
  stepIdleTimeoutMs,
  type IdleStorageRead,
  type IdleStorageWrite,
} from '../screensaver';

const router = useRouter();

const memory = new Map<string, string>();
const storage: IdleStorageRead & IdleStorageWrite = (() => {
  try {
    const real = globalThis.localStorage;
    if (real) return real;
  } catch {
    // privacy-mode getter threw — session shim below
  }
  return {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
  };
})();

const idleMs = ref(resolveIdleTimeoutMs(storage));

const idleLabel = computed(() => {
  const minutes = idleMs.value / 60_000;
  return tTizen('tvSettings.minutes', {
    minutes: Number.isInteger(minutes) ? minutes : Math.round(minutes * 10) / 10,
  });
});

function step(direction: 1 | -1): void {
  const next = stepIdleTimeoutMs(idleMs.value, direction);
  if (persistIdleTimeoutMs(storage, next)) idleMs.value = next;
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    step(-1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    step(1);
  }
}

function goBack(): void {
  void router.back();
}
</script>

<template>
  <div class="tv-settings">
    <header class="tv-settings__header">
      <button
        class="tv-settings__back"
        type="button"
        :aria-label="tTizen('common.goBack')"
        @click="goBack"
      >
        &larr;
      </button>
      <h1 class="tv-settings__title">
        {{ tTizen('tvSettings.title') }}
      </h1>
    </header>

    <button
      type="button"
      class="tv-settings__row"
      data-testid="screensaver-idle-row"
      @click="step(1)"
      @keydown="onKeydown"
    >
      <span class="tv-settings__label">{{ tTizen('tvSettings.idleLabel') }}</span>
      <span
        class="tv-settings__value"
        data-testid="screensaver-idle-value"
      >{{ idleLabel }}</span>
    </button>
    <p class="tv-settings__hint">
      {{ tTizen('tvSettings.idleHint') }}
    </p>
  </div>
</template>

<style scoped>
.tv-settings {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-6, 1.5rem);
}
.tv-settings__header {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  margin-bottom: var(--space-6, 1.5rem);
}
.tv-settings__back {
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: var(--radius-full, 9999px);
  background: var(--surface-2, #1f1f23);
  color: var(--text-muted, #a1a1aa);
  cursor: pointer;
}
.tv-settings__title {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: var(--text-2xl, 1.5rem);
  color: var(--text, #e4e4e7);
  margin: 0;
}
.tv-settings__row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
  border: 1px solid var(--border-strong, #52525b);
  border-radius: var(--radius-md, 0.375rem);
  background: var(--surface-2, #1f1f23);
  color: var(--text, #e4e4e7);
  font-size: var(--text-lg, 1.125rem);
  cursor: pointer;
}
.tv-settings__row:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}
.tv-settings__value {
  font-weight: 700;
}
.tv-settings__hint {
  margin: var(--space-3, 0.75rem) 0 0;
  color: var(--text-muted, #a1a1aa);
}
.tv-settings__back:focus-visible {
  outline: none;
  box-shadow: 0 0 0 5px var(--accent-ring, rgba(245, 158, 11, 0.5));
}
</style>
