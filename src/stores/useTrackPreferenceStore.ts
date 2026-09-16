/**
 * useTrackPreferenceStore — per-item + account language preference memory
 * (S511 / AD-18).
 *
 * WHAT IT OWNS: the two inputs the {@link resolvePreferredLanguage} ladder reads
 * for a given title and kind (audio|subtitle) —
 *
 *   - `preferredAudio` / `preferredSubtitle`: the account-wide languages read
 *     once from `GET /api/v1/users/me/settings` (server `UserSettings`), and
 *   - a per-title localStorage slot (`phlix.trackPref.<kind>.<itemId>`) holding
 *     the language the viewer last chose for THIS title.
 *
 * WRITE-BACK: a chosen language is remembered locally immediately and pushed to
 * the account through `PUT /api/v1/users/me/settings` with a single whitelisted
 * key (`preferred_audio_language` / `preferred_subtitle_language`). The server's
 * `UserRepository::updateSettings()` is an `INSERT … ON DUPLICATE KEY UPDATE`
 * that touches ONLY the supplied columns, so sending one language field is a
 * safe partial merge — it never clobbers `max_streams`/`subtitle_mode`/etc.
 *
 * NO NEW ROUTES (S511 AC3 / era law): both verbs reuse the existing
 * `/api/v1/users/me/settings` surface already served by the vendored route
 * manifest — the route gate pins this file at exactly those two request sites.
 * Server untouched.
 *
 * Fail-soft by contract: a settings fetch failure leaves the account preference
 * `null` (the ladder then behaves as "absent"); an account write failure still
 * keeps the per-item memory (local write happens first). Both are deliberate —
 * preference memory must never be able to break playback.
 *
 * The API client is constructed per call from an explicit `baseUrl` argument
 * (the page owns `useApiBase()`), mirroring `fetchPlaybackInfoTracks` rather
 * than hiding a composable inside the store — explicit deps, trivially testable.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ApiClient } from '@phlix/ui';
import {
  resolvePreferredLanguage,
  type LanguageLadderResult,
} from '../tracks/languageLadder';

export type TrackKind = 'audio' | 'subtitle';

/** The slice of `UserSettings` this store reads; typed to the wire, not hand-widened. */
interface UserSettingsResponse {
  settings?: {
    preferred_audio_language?: string | null;
    preferred_subtitle_language?: string | null;
  } | null;
}

const PER_ITEM_KEY_PREFIX = 'phlix.trackPref';

/** SSR/Tizen-safe localStorage accessor — null when storage is unavailable. */
function trackStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try {
    const store = globalThis.localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

function perItemKey(itemId: string, kind: TrackKind): string {
  return `${PER_ITEM_KEY_PREFIX}.${kind}.${itemId}`;
}

function accountField(kind: TrackKind): 'preferred_audio_language' | 'preferred_subtitle_language' {
  return kind === 'audio' ? 'preferred_audio_language' : 'preferred_subtitle_language';
}

export const useTrackPreferenceStore = defineStore('trackPreference', () => {
  const preferredAudio = ref<string | null>(null);
  const preferredSubtitle = ref<string | null>(null);
  const loaded = ref(false);

  /**
   * Read the account language preferences once. Fail-soft: on any error (or a
   * body missing the settings object) both stay `null` so the ladder treats the
   * server layer as absent. Marks `loaded` either way so callers don't re-fetch.
   */
  async function load(baseUrl: string): Promise<void> {
    try {
      const client = new ApiClient({ baseUrl });
      const response = await client.get<UserSettingsResponse>('/api/v1/users/me/settings');
      const settings = response?.settings ?? null;
      preferredAudio.value = settings?.preferred_audio_language ?? null;
      preferredSubtitle.value = settings?.preferred_subtitle_language ?? null;
    } catch {
      preferredAudio.value = null;
      preferredSubtitle.value = null;
    } finally {
      loaded.value = true;
    }
  }

  /** The remembered language for one title+kind, or `null` when none was stored. */
  function getPerItem(itemId: string, kind: TrackKind): string | null {
    return trackStorage()?.getItem(perItemKey(itemId, kind)) ?? null;
  }

  /** Store (or, with an empty language, clear) the per-title choice locally. */
  function setPerItem(itemId: string, kind: TrackKind, language: string | null): void {
    const store = trackStorage();
    if (!store) return;
    const key = perItemKey(itemId, kind);
    if (language === null || language === '') {
      store.removeItem(key);
      return;
    }
    store.setItem(key, language);
  }

  /**
   * Persist a chosen language: write the per-item memory first (immediate,
   * local, cannot fail the playback path), then push it to the account through
   * the existing settings endpoint. The account write is best-effort — a
   * rejected PUT is swallowed because the local memory already stands.
   */
  async function persist(
    baseUrl: string,
    itemId: string,
    kind: TrackKind,
    language: string,
  ): Promise<void> {
    setPerItem(itemId, kind, language);
    if (kind === 'audio') preferredAudio.value = language;
    else preferredSubtitle.value = language;
    try {
      const client = new ApiClient({ baseUrl });
      await client.put('/api/v1/users/me/settings', { [accountField(kind)]: language });
    } catch {
      // Account write is best-effort; per-item memory + in-session state hold.
    }
  }

  /**
   * Resolve the default track language for one title+kind by running the ladder
   * over the per-item memory and the account preference the store already holds.
   * Pure decision; performs no I/O (call {@link load} first to populate server).
   */
  function resolveDefault(
    itemId: string,
    kind: TrackKind,
    availableLanguages: readonly (string | null | undefined)[],
  ): LanguageLadderResult {
    return resolvePreferredLanguage({
      perItem: getPerItem(itemId, kind),
      server: kind === 'audio' ? preferredAudio.value : preferredSubtitle.value,
      availableLanguages,
    });
  }

  return {
    preferredAudio,
    preferredSubtitle,
    loaded,
    load,
    getPerItem,
    setPerItem,
    persist,
    resolveDefault,
  };
});
