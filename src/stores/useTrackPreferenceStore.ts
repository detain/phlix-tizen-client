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
 * preference memory must never be able to break playback. The per-item memory
 * itself is LRU-capped at `PER_ITEM_SLOT_CAP` live slots and cannot throw out
 * of `setPerItem` (w12: RT-084) — a quota-full webview store silently keeps
 * only its most recent pages of choices instead of erroring the picker.
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

/**
 * LRU bookkeeping for the per-item slots (w12: RT-084 cure). Every
 * `phlix.trackPref.<kind>.<itemId>` write is tracked in a most-recent-first
 * key index under one extra localStorage key, and the number of live slots is
 * capped at {@link PER_ITEM_SLOT_CAP}. Before this, the TV accumulated one
 * permanent slot per watched title for the life of the device: on the capped
 * webview storage (~5 MB, shared with the whole app) a heavy viewer could
 * reach quota, and a throwing `setItem` propagated out of a "can never break
 * playback" store. The index is the cap's bookkeeping; a corrupt/absent index
 * is re-derived by enumerating the storage, so the cap never depends on the
 * index being trustworthy.
 */
export const PER_ITEM_SLOT_CAP = 100;

/** Half-cap eviction floor used by the quota-recovery retry. */
const PER_ITEM_EVICT_FLOOR = Math.floor(PER_ITEM_SLOT_CAP / 2);

const PER_ITEM_INDEX_KEY = `${PER_ITEM_KEY_PREFIX}.index`;

/** Storage slice used by the per-item memory (enumeration included for the re-derive path). */
type TrackStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** SSR/Tizen-safe localStorage accessor — null when storage is unavailable. */
function trackStorage(): TrackStorageLike | null {
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

function isSlotKey(key: string | null): key is string {
  return !!key && key.startsWith(`${PER_ITEM_KEY_PREFIX}.`) && key !== PER_ITEM_INDEX_KEY;
}

/** Parse the LRU index; anything malformed reads as absent (re-derive follows). */
function readIndex(store: TrackStorageLike): string[] | null {
  const raw = store.getItem(PER_ITEM_INDEX_KEY);
  if (typeof raw !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return null;
  }
}

/** Fallback slot discovery when the index is absent/corrupt: walk the storage. */
function enumerateSlotKeys(store: TrackStorageLike): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (isSlotKey(key)) keys.push(key);
  }
  return keys;
}

/** Live slots, most-recent-first; ghosts (indexed but gone) are filtered. */
function currentSlots(store: TrackStorageLike): string[] {
  const candidates = readIndex(store) ?? enumerateSlotKeys(store);
  return candidates.filter((key) => store.getItem(key) !== null);
}

function writeIndex(store: TrackStorageLike, slots: readonly string[]): void {
  try {
    store.setItem(PER_ITEM_INDEX_KEY, JSON.stringify(slots));
  } catch {
    // Index write is bookkeeping, never the payload: a missing entry only
    // costs cap precision until the next enumeration re-derives it.
  }
}

/** Promote `key` to the front of the LRU index and evict anything past the cap. */
function rememberSlot(store: TrackStorageLike, key: string): void {
  const slots = [key, ...currentSlots(store).filter((slot) => slot !== key)];
  const kept = slots.slice(0, PER_ITEM_SLOT_CAP);
  for (const evicted of slots.slice(kept.length)) {
    try {
      store.removeItem(evicted);
    } catch {
      // Already off the index; a stuck eviction cannot strand quota room.
    }
  }
  writeIndex(store, kept);
}

/** Drop `key` from storage and index (clear path). */
function forgetSlot(store: TrackStorageLike, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    return; // removeItem throwing means storage is unhealthy; nothing to un-index
  }
  writeIndex(store, currentSlots(store).filter((slot) => slot !== key));
}

/** Quota recovery: trim the live set to half-cap so a retry has room. */
function evictToHalfCap(store: TrackStorageLike): void {
  const slots = currentSlots(store);
  const kept = slots.slice(0, PER_ITEM_EVICT_FLOOR);
  for (const evicted of slots.slice(kept.length)) {
    try {
      store.removeItem(evicted);
    } catch {
      // best-effort room-making; the retry below still stands or fails on its own
    }
  }
  writeIndex(store, kept);
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

  /**
   * Store (or, with an empty language, clear) the per-title choice locally.
   * LRU-capped and quota-safe (w12: RT-084): the write is preceded by a
   * cap-enforcing promotion, a rejected write evicts down to half-cap and
   * retries exactly once, and a still-rejected write is swallowed — the
   * in-session state and the account PUT in {@link persist} are unaffected,
   * honoring the fail-soft contract above (a preference memory that throws is
   * the bug this cures).
   */
  function setPerItem(itemId: string, kind: TrackKind, language: string | null): void {
    const store = trackStorage();
    if (!store) return;
    const key = perItemKey(itemId, kind);
    if (language === null || language === '') {
      forgetSlot(store, key);
      return;
    }
    rememberSlot(store, key);
    try {
      store.setItem(key, language);
      return;
    } catch {
      // Quota (or an unhealthy webview store): make room and try once more.
    }
    evictToHalfCap(store);
    rememberSlot(store, key);
    try {
      store.setItem(key, language);
    } catch {
      // Fail-soft by contract: local memory is best-effort. The choice still
      // lives in-session (persist's refs) and on the account row.
    }
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
