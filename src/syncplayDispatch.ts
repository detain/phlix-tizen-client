/**
 * Tizen load-a-new-title dispatch point for hub-relay pending commands (S298).
 *
 * A delivered `pending_command` / `play_media` frame carries ONLY a media id +
 * title ("Alexa, play X"). Nothing in the app can play that until the player
 * LOADS it — the Tizen player page lives inside the sealed `@phlix/ui` bundle:
 * the ui's `resolvePendingMedia` player prop exists on the vendored `Player.vue`
 * surface (re-verified at the current pin), but it is a COMPONENT prop with no
 * `createPhlixApp` config seam, so this shell cannot supply it. This module is
 * therefore still the Tizen half of the ui's Player.vue load path: a watcher
 * over the
 * store's `pendingPlayMedia` slot that resolves the id to a `MediaItem` and
 * drives the shared `@phlix/ui` player store. Port ledger + mirror-lag duties
 * (M-TIZEN-08): `docs/ui-port-divergence.md`.
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
 * - TIZ-17: a command whose `issuedAt` sits more than
 *   {@link PENDING_COMMAND_MAX_SKEW_S} from the TV clock (either way) is
 *   STALE — consumed without resolving, `onStale` notified, never played. The
 *   cross-server half of TIZ-17 lives at the socket (`api/hubRelay.ts`
 *   onmessage drops a frame whose `server_id` is not the bound server).
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

/**
 * TIZ-17 — how far `issuedAt` may sit from the TV's clock, in seconds, before
 * a command is treated as stale. Deliberately generous: TV clocks drift (no
 * guaranteed NTP on a set that has been off the network), so the bound only
 * catches a genuinely old frame — a slot that sat unhandled, a replay — not a
 * clock a minute or two off. Symmetric: an `issuedAt` this far in the FUTURE
 * is equally implausible (a unit error, e.g. milliseconds, or a broken clock).
 * A frame without `issued_at` was already stamped "now" at the parse boundary,
 * so it is never stale here.
 */
export const PENDING_COMMAND_MAX_SKEW_S = 10 * 60;

/** True when `issuedAt` (Unix s) is outside the {@link PENDING_COMMAND_MAX_SKEW_S}
 *  window around `nowMs`. Pure; exported for tests. */
export function isPendingCommandStale(
  issuedAt: number,
  nowMs: number,
  maxSkewS: number = PENDING_COMMAND_MAX_SKEW_S,
): boolean {
  return Math.abs(nowMs / 1000 - issuedAt) > maxSkewS;
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
  /** Called when a command arrived too far from the TV's clock (see
   *  {@link PENDING_COMMAND_MAX_SKEW_S}). The slot IS consumed in that case —
   *  a stale command must never start playback later. */
  onStale?: (command: PendingPlayMediaCommand) => void;
  /** Clock seam (ms since epoch); defaults to `Date.now`. */
  now?: () => number;
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
      // TIZ-17 — staleness guard BEFORE any resolution: an old "Alexa, play X"
      // must not suddenly start a title. Consumed (not left in the slot) so
      // nothing can pick it up later; the host is told via onStale.
      if (isPendingCommandStale(command.issuedAt, (deps.now ?? Date.now)())) {
        store.consumePendingPlayMedia();
        deps.onStale?.(command);
        return;
      }
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
