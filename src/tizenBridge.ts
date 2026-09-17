/**
 * Tizen TV client entry point and boot glue.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { usePlayerStore } from '@phlix/ui';
import { ref, type App as VueApp, type Ref } from 'vue';
import remoteManager from './remote/RemoteManager';
import type { ActionEvent } from './remote/RemoteManager';
import type { ActionName } from './remote/KeyMapping';
import { installRemoteKeyRegistration, type TizenLike } from './remote/registerKeys';
import { installVoiceControlRegistration, type TizenLike as VoiceTizenLike } from './voiceControl';
import {
  createLayerFocusStack,
  decideBackRung,
  findScrolledRow,
  isAppRootRoute,
  openBackLayers,
  type BackLayer,
  type LayerFocusStack,
  type RowNode
} from './remote/backPolicy';

// Minimal structural types for the pieces of the RemoteManager singleton, the
// phlix-ui player store, the vue-router instance, and the current route that
// the bridge actually touches. Keeping them local makes the wiring helper
// trivially unit-testable with fakes (mirrors the Windows electronBridge).

export interface BridgeRemote {
  /** Subscribe to an event; ideally returns an unsubscribe function. */
  on(_event: string, callback: (data: ActionEvent) => void): (() => void) | void;
  off?: (_event: string, callback: (data: ActionEvent) => void) => void;
}

export interface BridgePlayer {
  playing: boolean;
  play: () => void;
  pause: () => void;
  closePlayer: () => void;
  /** Relative seek in seconds (phlix-ui player command bus). */
  seekBy: (_delta: number) => void;
}

export interface BridgeRouter {
  push: (_to: string) => unknown;
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

/** The focusable shape @phlix/ui's focus trap itself accepts (useFocusTrap.ts) —
 * row-snap "item 0" focuses the first node a spatial stop could ever land on. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Attribute @phlix/ui's `useFocusTrap` puts on every modal surface it guards. */
export const FOCUS_TRAP_SELECTOR = '[data-focus-trap]';

/** The structural slice of the ambient `tizen` object the EXIT rung may need. */
interface TizenApplicationLike {
  application?: {
    getCurrentApplication?: () => { exit?: () => void } | null;
  } | null;
}

/**
 * Zombie-webview exit (AD-10 / folded AD-28): the platform call is
 * `tizen.application.getCurrentApplication().exit()`, resolved LAZILY through
 * optional chaining so a non-Tizen webview (browser dev, jsdom) is a silent
 * no-op — the module never touches `tizen.*` at import or on any other path.
 */
export function defaultExitApplication(): void {
  const tizenGlobal = (globalThis as { tizen?: TizenApplicationLike }).tizen;
  tizenGlobal?.application?.getCurrentApplication?.()?.exit?.();
}

/** Default row-snap probe: walk up from the focused node to a scrolled shelf. */
function activeScrolledRow(): RowNode | null {
  if (typeof document === 'undefined') return null;
  return findScrolledRow(document.activeElement as unknown as RowNode | null);
}

/** Default row-snap executor: pan the row home and focus its first item. */
function snapRowToStart(row: RowNode): void {
  const element = row as unknown as HTMLElement;
  element.scrollLeft = 0;
  element.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
}

/**
 * Generic modal-close layer for the `[data-focus-trap]` surfaces @phlix/ui
 * owns: it has no exported close handle, but every trap guards with a keydown
 * handler that runs its component's `onEscape`, so BACK is dispatched as the
 * Escape key the trap already understands. Closing (and its own focus return)
 * stays the modal's business — the bridge only rings the bell.
 */
export function createFocusTrapLayer(): BackLayer {
  return {
    id: 'ui-focus-trap',
    isOpen(): boolean {
      return typeof document !== 'undefined' && document.querySelector(FOCUS_TRAP_SELECTOR) !== null;
    },
    close(): void {
      if (typeof document === 'undefined') return;
      const trap = document.querySelector(FOCUS_TRAP_SELECTOR);
      if (!trap) return;
      const target = trap.contains(document.activeElement) ? document.activeElement ?? trap : trap;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    }
  };
}

/**
 * The injectable BACK seams of `wireTizenBridge` — every DOM/platform touch the
 * ladder performs lives behind one of these so unit tests (and the AD-9 ui
 * adopt-leg) can drive each rung with fakes. All optional; the defaults are the
 * production behaviors described above.
 */
export interface BridgeBack {
  /** Extra closable layers, TOPMOST FIRST; the trap + quality layers follow. */
  layers?: BackLayer[];
  /** Explicit app exit at the root rung (default: guarded `tizen` exit). */
  exit?: () => void;
  /** Row probe for the row-snap rung (default: `document.activeElement` walk). */
  findRow?: () => RowNode | null;
  /** Row executor for the row-snap rung (default: pan to 0 + focus item 0). */
  snapRow?: (row: RowNode) => void;
  /** Focus memory riding the layer stack (default: fresh LIFO per wiring). */
  focusMemory?: LayerFocusStack<Element>;
}

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
 *
 * S526 (AD-10): BACK is no longer a one-liner — it walks the pure ladder from
 * `remote/backPolicy.ts` (row-snap → topmost modal-close → history-back →
 * explicit app exit at the root). Every effect the ladder runs is injectable
 * through `back` (layers / exit / row probe+executor / focus memory), so the
 * rung decisions are unit-pinned against fakes and the zombie-webview exit is
 * a real `exitApplication()` behind that seam — never a blind `history.back()`
 * poke at an empty stack.
 */
export function wireTizenBridge(
  remote: BridgeRemote | null | undefined,
  player: BridgePlayer,
  router: BridgeRouter,
  getRoute: () => BridgeRoute,
  quality: BridgeQualityMenu = createDomQualityMenu(),
  back: BridgeBack = {}
): () => void {
  if (!remote) {
    return () => { return; };
  }

  // Focus memory riding the layer stack + the ladder's own seams.
  const focusMemory = back.focusMemory ?? createLayerFocusStack<Element>();
  // The quality flyout is the ladder's deepest closable layer; host-supplied
  // layers and the generic ui focus-trap probe sit ABOVE it (topmost first).
  const qualityLayer: BackLayer = {
    id: 'quality-menu',
    isOpen: () => quality.isActive(),
    close: () => {
      quality.deactivate();
      // Back across the overlay stack lands where the viewer stood BEFORE the
      // layer opened — but only while that node is still on screen; a layer
      // torn down by navigation keeps its own (ui-side) focus return.
      const opener = focusMemory.pop();
      if (opener && opener.isConnected) (opener as HTMLElement).focus();
    }
  };
  const backLayers: BackLayer[] = [...(back.layers ?? []), createFocusTrapLayer(), qualityLayer];
  const findRow = back.findRow ?? activeScrolledRow;
  const snapRow = back.snapRow ?? snapRowToStart;

  const handleBack = (): void => {
    const row = findRow();
    const open = openBackLayers(backLayers);
    const rung = decideBackRung({
      rowScrolled: row !== null,
      openLayers: open,
      atAppRoot: isAppRootRoute(getRoute())
    });
    if (rung === 'row-snap' && row) {
      snapRow(row);
      return;
    }
    if (rung === 'modal-close') {
      open[0]?.close();
      return;
    }
    if (rung === 'exit-app') {
      (back.exit ?? defaultExitApplication)();
      return;
    }
    // history-back — the pre-S526 behavior, unchanged.
    if (getRoute().name === 'player') {
      player.closePlayer();
    }
    router.back();
  };

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
        // S526 / AD-10 — the BACK ladder: row-snap first, then the topmost
        // closable layer (quality flyout included), then history, then an
        // EXPLICIT exit at the app root. Never a blind back() at the floor.
        handleBack();
        break;
      case 'HOME':
        router.push('/app');
        break;
      case 'YELLOW':
        // Yellow color button = "Quality". Only on the player route, and only
        // when the QualityMenu is actually on screen (multi-variant transcode);
        // it toggles quality-selection mode so the D-pad drives the picker.
        if (getRoute().name === 'player') {
          if (quality.isActive()) qualityLayer.close();
          else if (quality.isAvailable()) {
            // Remember where the viewer stood so BACK can return them (AD-10
            // focus memory — the seam AD-9's ui focus-stack adopts).
            if (typeof document !== 'undefined' && document.activeElement) {
              focusMemory.push(document.activeElement);
            }
            quality.activate();
          }
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
 *
 * S509 (AD-1): registers the 2020+ `tvinputdevice` media / channel / colour keys
 * once here — at app-ready, alongside the rest of the bridge — and releases
 * exactly those keys in the returned teardown (the same install/teardown pairing
 * the route guard uses, so there is no listener leak). On a non-Tizen webview the
 * ambient `tizen` global is absent and registration is a silent no-op; a
 * `tizenLike` may be injected for tests. RemoteManager's DOM keydown fallback
 * still handles every code that reaches it.
 *
 * S526 (AD-10): `options.exit` overrides the root rung's app exit — the
 * fake-able seam behind `tizen.application.getCurrentApplication().exit()`, so
 * no test (and no browser dev session) can ever trip a real platform call.
 */
export function installTizenBridge(
  app: VueApp,
  tizenLike?: TizenLike | null,
  options: { exit?: () => void } = {}
): () => void {
  const pinia = app.config.globalProperties.$pinia;
  const router = app.config.globalProperties.$router as unknown as {
    push: (to: string) => unknown;
    back: () => void;
    currentRoute: { value: BridgeRoute };
    afterEach?: (_guard: (to: BridgeRoute) => void) => () => void;
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
    quality,
    { exit: options.exit }
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

  // S509 — declare the 2020+ media / channel / colour keys with the platform now
  // (app-ready). Returns a teardown releasing only what it acquired; a no-op when
  // the `tizen` global is absent. Registered keys arrive as DOM keydowns that
  // RemoteManager + KeyMapping already dispatch — no second pipeline.
  const releaseRemoteKeys = installRemoteKeyRegistration(tizenLike);

  // S531 (AD-23) — guarded VoiceControl. Register the transport command list ONLY
  // while the player route is mounted and release on unmount, riding the same
  // route seam the quality guard uses (single-writer B-seam: this is the mount
  // hook, nothing more). A recognised phrase re-enters the EXISTING action
  // pipeline through `remoteManager.emit('action', …)` so voice is never a second
  // dispatcher; a `tizen.voicecontrol` that is absent or throws (the common TV
  // case) makes this a silent no-op — app behaviour stays byte-identical.
  const releaseVoiceControl = installVoiceControlRegistration({
    getRoute,
    router,
    // The ambient `tizen` object is the same for both subsystems; each module
    // reads only its own structural slice (`tvinputdevice` / `voicecontrol`), so
    // the injected fake is passed through and feature-detected independently.
    tizenLike: tizenLike as unknown as VoiceTizenLike | null | undefined,
    onAction: (action) => {
      remoteManager.emit('action', { key: action });
    }
  });

  return () => {
    unwire();
    removeRouteGuard?.();
    releaseRemoteKeys();
    releaseVoiceControl();
    // Never let the shared flag / suppression outlive the bridge itself.
    quality.deactivate();
    remoteManager.suppressPropagation = null;
  };
}
