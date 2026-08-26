/**
 * Tizen load-a-new-title dispatch point for hub-relay pending commands (S298).
 *
 * A delivered `pending_command` / `play_media` frame carries ONLY a media id +
 * title ("Alexa, play X"). Nothing in the app can play that until the player
 * LOADS it — the Tizen player page lives inside sealed `@phlix/ui` v0.99.0
 * (which predates the ui's `resolvePendingMedia` player prop), so this module
 * is the Tizen half of the ui's Player.vue load path: a watcher over the
 * store's `pendingPlayMedia` slot that resolves the id to a `MediaItem` and
 * drives the shared `@phlix/ui` player store.
 *
 * - With a working `resolveMedia`, the id resolves to a `MediaItem`,
 *   `player.setCurrent()` loads it, `player.play()` starts it, and the store
 *   slot is consumed (cleared so a later session update cannot re-trigger).
 * - Resolution failure or a `null` item is NOT consumed: the command stays in
 *   the store slot and `onUnresolved` is called so the host can surface or
 *   route it (mirrors the ui's `pending-media` event fallback).
 * - A NEWER command may replace the one being resolved (the hub can push
 *   again while a slow resolution is in flight); the stale-resolution guard
 *   drops the result so the wrong title is never loaded (ui review fix).
 *
 * The watcher is wired once at boot (`main.ts`) and lives for the app's
 * lifetime; `wirePendingPlayMediaDispatcher` returns an unwatch for tests and
 * teardown.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

import { watch } from 'vue';
import type { MediaItem } from '@phlix/ui';
import type { PendingPlayMediaCommand } from './api/hubRelay';

/** The store surface this dispatcher touches (structural, for test fakes). */
export interface PendingPlayMediaStore {
  pendingPlayMedia: PendingPlayMediaCommand | null;
  consumePendingPlayMedia: () => void;
}

/** The player surface the dispatcher drives (structural, for test fakes). */
export interface PendingPlayMediaPlayer {
  setCurrent: (media: MediaItem, opts?: { resetPosition?: boolean; streamUrl?: string }) => void;
  play: () => void;
}

export interface PendingPlayMediaDeps {
  /** Resolve a bare media id to a playable item; `null`/throw = unresolved. */
  resolveMedia: (
    command: { mediaId: string; title: string },
  ) => Promise<MediaItem | null> | MediaItem | null;
  /** The shared @phlix/ui player store (or a structural fake). */
  player: PendingPlayMediaPlayer;
  /** Called when a command could NOT be loaded (resolver failed / no item).
   *  The store slot is deliberately NOT consumed in that case, so the host
   *  can pick the command up later. */
  onUnresolved?: (command: PendingPlayMediaCommand) => void;
}

/**
 * Watch the store's `pendingPlayMedia` slot and load the title on arrival.
 *
 * Returns an unwatch function. The watcher mirrors the ui's Player.vue load
 * path exactly: resolve → setCurrent (reset position) → play → consume, with
 * the stale-resolution guard (a newer command wins over a slow resolution).
 */
export function wirePendingPlayMediaDispatcher(
  store: PendingPlayMediaStore,
  deps: PendingPlayMediaDeps,
): () => void {
  return watch(
    () => store.pendingPlayMedia,
    async (command) => {
      if (!command) return;
      let item: MediaItem | null = null;
      try {
        item = await deps.resolveMedia({ mediaId: command.mediaId, title: command.title });
      } catch {
        item = null; // resolution failure falls back to onUnresolved, like null
      }
      // A newer command may have replaced this one while the resolver ran —
      // applying a STALE resolution would load the wrong title.
      if (store.pendingPlayMedia !== command) return;
      if (item) {
        deps.player.setCurrent(item, { resetPosition: true });
        deps.player.play();
        store.consumePendingPlayMedia();
        return;
      }
      deps.onUnresolved?.(command);
    },
  );
}