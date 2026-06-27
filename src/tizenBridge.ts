import { usePlayerStore } from '@phlix/ui';
import type { App as VueApp } from 'vue';
import remoteManager from './remote/RemoteManager';
import type { ActionEvent } from './remote/RemoteManager';

// Minimal structural types for the pieces of the RemoteManager singleton, the
// phlix-ui player store, the vue-router instance, and the current route that
// the bridge actually touches. Keeping them local makes the wiring helper
// trivially unit-testable with fakes (mirrors the Windows electronBridge).

export interface BridgeRemote {
  /** Subscribe to an event; ideally returns an unsubscribe function. */
  on(event: string, callback: (data: ActionEvent) => void): (() => void) | void;
  off?(event: string, callback: (data: ActionEvent) => void): void;
}

export interface BridgePlayer {
  playing: boolean;
  play: () => void;
  pause: () => void;
  closePlayer: () => void;
  /** Relative seek in seconds (phlix-ui player command bus). */
  seekBy: (delta: number) => void;
}

export interface BridgeRouter {
  push: (to: string) => unknown;
  back: () => void;
}

export interface BridgeRoute {
  name?: string | symbol | null;
}

/** Single-tap seek jump (seconds); held keys jump further. */
const SEEK_STEP_SECONDS = 10;
const SEEK_STEP_REPEAT_SECONDS = 30;

/**
 * Pure wiring helper: subscribes to RemoteManager 'action' events and maps
 * remote transport/navigation keys onto a player store + router. Returns a
 * single cleanup function that unsubscribes. Accepts dependencies as params
 * so it can be exercised with fakes and no real Vue app / DOM.
 *
 * Arrow keys and ENTER are intentionally NOT handled here — @phlix/ui's
 * useSpatialNav owns D-pad navigation and ENTER is native focus activation.
 */
export function wireTizenBridge(
  remote: BridgeRemote | null | undefined,
  player: BridgePlayer,
  router: BridgeRouter,
  getRoute: () => BridgeRoute
): () => void {
  if (!remote) {
    return () => {};
  }

  const handler = (action: ActionEvent): void => {
    switch (action.key) {
      case 'PLAY':
      case 'PLAY_PAUSE':
        if (player.playing) {
          player.pause();
        } else {
          player.play();
        }
        break;
      case 'PAUSE':
        player.pause();
        break;
      case 'STOP':
        player.closePlayer();
        break;
      case 'FAST_FORWARD':
        player.seekBy(action.repeat ? SEEK_STEP_REPEAT_SECONDS : SEEK_STEP_SECONDS);
        break;
      case 'REWIND':
        player.seekBy(action.repeat ? -SEEK_STEP_REPEAT_SECONDS : -SEEK_STEP_SECONDS);
        break;
      case 'BACK':
        if (getRoute().name === 'player') {
          player.closePlayer();
          router.back();
        } else {
          router.back();
        }
        break;
      case 'HOME':
        router.push('/app');
        break;
      default:
        // Arrows / ENTER / color keys / etc. — not bridged.
        break;
    }
  };

  const unsubscribe = remote.on('action', handler);

  return () => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    } else if (typeof remote.off === 'function') {
      remote.off('action', handler);
    }
  };
}

/**
 * Installs the Tizen remote bridge against a mounted phlix-ui Vue app. Pulls
 * the active pinia + router off the app's global properties, resolves the
 * player store, and delegates to the pure wiring helper. No-op safe if the
 * RemoteManager singleton is unavailable.
 */
export function installTizenBridge(app: VueApp): () => void {
  const pinia = app.config.globalProperties.$pinia;
  const router = app.config.globalProperties.$router as unknown as {
    push: (to: string) => unknown;
    back: () => void;
    currentRoute: { value: BridgeRoute };
  };
  const player = usePlayerStore(pinia) as unknown as BridgePlayer;
  const getRoute = (): BridgeRoute => router.currentRoute.value;

  return wireTizenBridge(remoteManager as unknown as BridgeRemote, player, router, getRoute);
}
