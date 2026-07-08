/**
 * Tizen TV client entry point and boot glue.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

import { usePlayerStore } from '@phlix/ui';
import { ref, type App as VueApp, type Ref } from 'vue';
import remoteManager from './remote/RemoteManager';
import type { ActionEvent } from './remote/RemoteManager';
import type { ActionName } from './remote/KeyMapping';

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

/**
 * The on-screen stream-quality picker (@phlix/ui's `QualityMenu`, rendered as a
 * `Select` combobox inside the player chrome). It only appears when there are
 * ≥2 switchable hls.js rungs, so `isAvailable()` is the guard the bridge checks
 * before entering quality-selection mode. Structurally typed (like the other
 * bridge deps) so `wireTizenBridge` can be exercised with a fake.
 */
export interface BridgeQualityMenu {
  /** True when the QualityMenu is actually on screen (a real quality choice). */
  isAvailable(): boolean;
  /** True while quality-selection mode is active (menu focused/open). */
  isActive(): boolean;
  /** Enter quality mode: focus + open the QualityMenu so the D-pad drives it. */
  activate(): void;
  /** Leave quality mode: close the menu + hand the D-pad back to the player. */
  deactivate(): void;
}

/**
 * Shared, framework-global reactive flag: true while the TV remote has the
 * on-screen QualityMenu focused for D-pad selection. `SpatialNavHost.vue` reads
 * it (to keep spatial-nav out of the way) and the RemoteManager suppression
 * guard reads it (to stop the player's own Arrow shortcuts) — a single source
 * of truth both the bridge and the (separately-mounted) spatial-nav host share.
 */
export const qualityMenuActive: Ref<boolean> = ref(false);

/** CSS selector for the QualityMenu's Select trigger inside the player chrome. */
const QUALITY_TRIGGER_SELECTOR = '.quality-menu .phlix-select__trigger';

/**
 * Remote keys whose default player action (seek / volume) must be suppressed
 * while quality mode is active, so the focused QualityMenu Select owns the
 * D-pad. ENTER is omitted — the player has no ENTER shortcut, and the Select
 * needs it to confirm a rung.
 */
export const QUALITY_NAV_KEYS: ReadonlySet<ActionName> = new Set([
  'LEFT',
  'RIGHT',
  'UP',
  'DOWN'
]);

function findQualityTrigger(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(QUALITY_TRIGGER_SELECTOR);
}

/**
 * The real, DOM-backed QualityMenu controller used at runtime. It drives
 * @phlix/ui's `Select` purely through the DOM (focus / native click), so no
 * changes to the sealed @phlix/ui player are needed: focusing the trigger and
 * opening the listbox lets the Select's OWN combobox keydown handler own
 * Arrow/Enter/Escape navigation.
 *
 * The shared flag is kept in lock-step with the Select's REAL open/closed state
 * rather than tracked as an independent boolean that can drift: `activate()`
 * observes the trigger's `aria-expanded`, so however the listbox closes — ENTER
 * selecting a rung, Escape, an outside click, or the explicit `deactivate()` —
 * the flag is cleared exactly once, at the single choke point `close()`. That
 * closes the finding where a normal ENTER-select left `suppressPropagation`
 * armed and the player's seek/volume arrows permanently dead.
 *
 * This observer only covers ONE of the two orthogonal ways the menu can go
 * away: the Select closing ITSELF while the trigger element still exists in
 * the DOM. It CANNOT see the other way — the player/route being torn down out
 * from under an open menu (e.g. HOME), which removes the trigger with no
 * `aria-expanded` mutation to observe. That second case is handled entirely
 * separately, by a `router.afterEach` guard in `installTizenBridge` below.
 * Both paths call this same `close()`, so do not "simplify" this into a single
 * mechanism — a version that only handled one of them is exactly how the
 * ENTER-select bug (above) and the stuck-on-HOME bug were introduced.
 */
export function createDomQualityMenu(state: Ref<boolean> = qualityMenuActive): BridgeQualityMenu {
  // Observes the trigger's aria-expanded so a Select that closes ITSELF (rung
  // select / Escape / blur) still tears the flag down. Held per-instance so
  // repeated activate/deactivate cycles never leak an observer.
  let expandedObserver: MutationObserver | null = null;

  const stopObserving = (): void => {
    expandedObserver?.disconnect();
    expandedObserver = null;
  };

  // The SINGLE place the flag is cleared. Idempotent and safe when the trigger
  // has already been removed from the DOM (e.g. the player unmounted on HOME /
  // route change): it just drops the observer and clears the flag.
  const close = (): void => {
    const trigger = findQualityTrigger();
    // Toggle the listbox closed if it is still open, then release focus so the
    // player's Arrow seek/volume shortcuts resume.
    if (trigger && trigger.getAttribute('aria-expanded') === 'true') trigger.click();
    trigger?.blur();
    stopObserving();
    state.value = false;
  };

  return {
    isAvailable: () => findQualityTrigger() != null,
    isActive: () => state.value,
    activate(): void {
      const trigger = findQualityTrigger();
      if (!trigger) return;
      state.value = true;
      trigger.focus();
      // Open the listbox right away so the rungs are visible; from here the
      // Select's combobox keydown handler (target phase) owns navigation.
      if (trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
      // Sync the flag to the Select's real state: when it flips aria-expanded
      // back off 'true' (the Select closed itself — the ENTER-select case), run
      // the same teardown as an explicit deactivate. Attached AFTER the open
      // click so the open transition itself is not read as a close.
      stopObserving();
      if (typeof MutationObserver !== 'undefined') {
        expandedObserver = new MutationObserver(() => {
          if (findQualityTrigger()?.getAttribute('aria-expanded') !== 'true') close();
        });
        expandedObserver.observe(trigger, {
          attributes: true,
          attributeFilter: ['aria-expanded']
        });
      }
    },
    deactivate(): void {
      close();
    }
  };
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
 * The exception is quality-selection mode (see `quality`): the YELLOW color
 * button opens the on-screen QualityMenu on the player route, and while it is
 * active BACK dismisses it instead of leaving the player.
 */
export function wireTizenBridge(
  remote: BridgeRemote | null | undefined,
  player: BridgePlayer,
  router: BridgeRouter,
  getRoute: () => BridgeRoute,
  quality: BridgeQualityMenu = createDomQualityMenu()
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
        // While the quality flyout is up, Back dismisses IT first — without
        // tearing down the player underneath.
        if (quality.isActive()) {
          quality.deactivate();
          break;
        }
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
      case 'YELLOW':
        // Yellow color button = "Quality". Only on the player route, and only
        // when the QualityMenu is actually on screen (multi-variant transcode);
        // it toggles quality-selection mode so the D-pad drives the picker.
        if (getRoute().name === 'player') {
          if (quality.isActive()) quality.deactivate();
          else if (quality.isAvailable()) quality.activate();
        }
        break;
      default:
        // Arrows / ENTER / other color keys / etc. — not bridged.
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
    afterEach?: (guard: (to: BridgeRoute) => void) => () => void;
  };
  const player = usePlayerStore(pinia) as unknown as BridgePlayer;
  const getRoute = (): BridgeRoute => router.currentRoute.value;
  const quality = createDomQualityMenu();

  // While quality-selection mode is active, stop the D-pad Arrow keydowns from
  // ALSO reaching @phlix/ui's own player seek/volume shortcuts. RemoteManager's
  // document listener is registered before the player mounts, so it can suppress
  // the later listener; the focused QualityMenu Select has already handled the
  // key in the target phase (see RemoteManager.suppressPropagation).
  remoteManager.suppressPropagation = (mappedKey): boolean =>
    qualityMenuActive.value && QUALITY_NAV_KEYS.has(mappedKey);

  const unwire = wireTizenBridge(
    remoteManager as unknown as BridgeRemote,
    player,
    router,
    getRoute,
    quality
  );

  // Centralized teardown for the SECOND of the two orthogonal ways the menu
  // goes away (see the docblock on `createDomQualityMenu` above for the
  // first): the player/route being left, which tears the player — and its
  // QualityMenu trigger — out from under an open menu with no `aria-expanded`
  // transition for that observer to see. HOME (`router.push('/app')`) is the
  // motivating case. Note STOP is NOT one of these: `player.closePlayer()`
  // only clears the player store and does not navigate, so `afterEach` never
  // fires for it — the menu, if open, is simply left open and dismissible via
  // BACK/YELLOW/rung-select as normal; this guard exists purely for
  // route-changing exits. A single router.afterEach guard clears quality mode
  // whenever navigation leaves the player route, so a stuck `qualityMenuActive`
  // can never disable D-pad navigation app-wide. Guarded so the helper still
  // works against a fake router with no afterEach in tests.
  const removeRouteGuard =
    typeof router.afterEach === 'function'
      ? router.afterEach((to) => {
          if (to?.name !== 'player') quality.deactivate();
        })
      : undefined;

  return () => {
    unwire();
    removeRouteGuard?.();
    // Never let the shared flag / suppression outlive the bridge itself.
    quality.deactivate();
    remoteManager.suppressPropagation = null;
  };
}
