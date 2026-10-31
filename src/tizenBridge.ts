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
import KeyMapping, { type ActionName } from './remote/KeyMapping';
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
import { FOCUSABLE_SELECTOR } from './spatial/focusCandidates';

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
  /** Current player volume 0..1 (phlix-ui store; Pinia unwraps the ref here). */
  volume: number;
  /** Absolute volume set — the store CLAMPS to 0..1 and auto-unmutes above 0. */
  setVolume: (_level: number) => void;
  /** Player mute toggle (phlix-ui store seam, the ui 'M' shortcut's target). */
  toggleMute: () => void;
  /**
   * Queue advance (phlix-ui store seam). The resolver supplies the shifted
   * item's stream URL from data ALREADY on the queue item (`stream_url`) —
   * calling `next()` with no resolver would write an EMPTY streamUrl.
   */
  next: (_resolveStreamUrl?: (_item: { stream_url?: string }) => string) => unknown;
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

/**
 * Volume step per VOLUME_UP/DOWN press (M-TIZEN-09) — EXACTLY the vendored
 * player's own ArrowUp/Down step (0.05, @phlix/ui v0.99.10 shortcuts module),
 * so remote and keyboard idiom cannot disagree. The store's `setVolume`
 * clamps 0..1 and auto-unmutes when raising above zero; the bridge forwards.
 */
const VOLUME_STEP = 0.05;

/** The focusable shape @phlix/ui's focus trap itself accepts (useFocusTrap.ts) —
 * row-snap "item 0" focuses the first node a spatial stop could ever land on.
 * Single source now lives in `spatial/focusCandidates.ts` (C27), shared with
 * the spatial candidate watcher so both consume the identical interactive set. */

/** Attribute @phlix/ui's `useFocusTrap` puts on every modal surface it guards. */
export const FOCUS_TRAP_SELECTOR = '[data-focus-trap]';

/**
 * Attribute the S520 QuickConnectPanel puts on its full-bleed takeover root
 * WHILE visible (C16 / tizen__casualgamer). The BACK ladder probes it so the
 * pairing card is a closable layer, never the wall that forces `exit-app`.
 */
export const QUICK_CONNECT_SELECTOR = '[data-quick-connect-panel]';

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
 * The quick-connect takeover card (S520 / C16) as a closable BACK layer. The
 * panel renders full-bleed at `z-index: 12000`, so WHILE it is on screen it is
 * unconditionally the topmost surface — this layer therefore ranks above the
 * generic ui focus-trap probe, whose invisible-under-the-takeover modal must
 * not steal the press. Same ring-the-bell contract as the trap layer: BACK
 * dispatches an Escape keydown ON the panel root and the panel's own
 * `@keydown.escape` handler decides what closing means (stop the ceremony,
 * retire the surface, expose the password form). TV law: BACK always escapes —
 * a pairing card must never leave `exit-app` as the only "dismiss".
 */
export function createQuickConnectLayer(): BackLayer {
  return {
    id: 'quick-connect',
    isOpen(): boolean {
      return typeof document !== 'undefined' && document.querySelector(QUICK_CONNECT_SELECTOR) !== null;
    },
    close(): void {
      if (typeof document === 'undefined') return;
      const panel = document.querySelector(QUICK_CONNECT_SELECTOR);
      if (!panel) return;
      panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    }
  };
}

/**
 * Attribute the RatingModal overlay root carries WHILE visible (M-TIZEN-18).
 * The BACK ladder probes it so the rating dialog is a closable layer — the
 * hint on its footer names the Back key, and this is what makes that true.
 * W-min173 truth-note (M-TIZEN-04): the client-owned `RatingModal.vue` that
 * produced this attribute was deleted as an orphan — no code path ever
 * mounted it, and the live rating surface ships inside the sealed ui
 * MediaDetailPage chunk. The probe is therefore INERT today and kept
 * deliberately: if a rating modal ever renders again (client-side or from a
 * future ui bundle carrying the attribute), the closable-layer semantics
 * must already be in the ladder, not re-derived.
 */
export const RATING_MODAL_SELECTOR = '[data-rating-modal]';

/**
 * The rating modal (historically the client-owned RatingModal.vue at z-9999;
 * INERT since W-min173 — see the RATING_MODAL_SELECTOR note above for why the
 * layer is kept) as a closable BACK layer
 * (M-TIZEN-18, tizen__writer MAJOR #6). Same ring-the-bell contract as the
 * quick-connect layer: BACK dispatches an Escape keydown ON the overlay root
 * and the modal's own document-level Escape handler decides what closing
 * means (emit `close`; the host unmounts). Without this layer the ladder
 * fell past modal-close straight into `history-back` — the page underneath
 * navigated while the modal the viewer wanted gone stayed up. Ranking sits
 * between the two neighbours by z-order reality: BELOW the full-bleed
 * z-12000 quick-connect takeover (the visible card answers first) and ABOVE
 * the generic ui focus-trap probe (this overlay covers trap surfaces).
 */
export function createRatingModalLayer(): BackLayer {
  return {
    id: 'rating-modal',
    isOpen(): boolean {
      return typeof document !== 'undefined' && document.querySelector(RATING_MODAL_SELECTOR) !== null;
    },
    close(): void {
      if (typeof document === 'undefined') return;
      const overlay = document.querySelector(RATING_MODAL_SELECTOR);
      if (!overlay) return;
      overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
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
  /** Extra closable layers, TOPMOST FIRST; quick-connect, rating, trap + quality follow. */
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
  // layers, the C16 quick-connect takeover, the M-TIZEN-18 rating modal and
  // the generic ui focus-trap probe sit ABOVE it (topmost first). The takeover
  // outranks the trap because the panel is full-bleed z-12000: whatever trap
  // may idle beneath it, the card the viewer can SEE is the one a BACK press
  // must answer to first; the z-9999 rating overlay ranks between the two for
  // the same visible-surface reason.
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
  const backLayers: BackLayer[] = [
    ...(back.layers ?? []),
    createQuickConnectLayer(),
    createRatingModalLayer(),
    createFocusTrapLayer(),
    qualityLayer,
  ];
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
        // M-TIZEN-02/M-TIZEN-33 (review tizen__gameux / tizen__crossfe): STOP
        // that only tears the player down leaves the viewer standing on a
        // blanked player route — a dead screen with no visible way onward.
        // TV law: STOP leaves the player, so when the player route is the
        // current one, STOP follows its own close with the ladder's
        // history-back rung (same `closePlayer(); router.back()` shape BACK
        // uses at `getRoute().name === 'player'`). Off the player route,
        // STOP stays what it always was: a player teardown, no navigation.
        player.closePlayer();
        if (getRoute().name === 'player') {
          router.back();
        }
        break;
      case 'FAST_FORWARD':
        // M-TIZEN-09: the bare (non-repeat) press is now REACHABLE — FF/REW
        // joined IMMEDIATE, so a tap lands here as one ±10 s step and a held
        // key adds ±30 s steps at the throttled 500 ms cadence.
        player.seekBy(action.repeat ? SEEK_STEP_REPEAT_SECONDS : SEEK_STEP_SECONDS);
        break;
      case 'REWIND':
        player.seekBy(action.repeat ? -SEEK_STEP_REPEAT_SECONDS : -SEEK_STEP_SECONDS);
        break;
      case 'NEXT':
        // M-TIZEN-09: the store seam exists; the resolver reads the queue
        // item's OWN already-resolved `stream_url` (no new request site —
        // same shape ui's PlayerPage passes via its streamUrlFor prop).
        player.next((item) => item.stream_url ?? '');
        break;
      case 'VOLUME_UP':
        player.setVolume(player.volume + VOLUME_STEP);
        break;
      case 'VOLUME_DOWN':
        player.setVolume(player.volume - VOLUME_STEP);
        break;
      case 'MUTE':
        player.toggleMute();
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
        // Arrows / ENTER / keys with no consumer — not bridged. M-TIZEN-09
        // retired the dead vocabulary at the KEY_MAP, so the codes it removed
        // (PREVIOUS, RED/GREEN/BLUE, MENU/INFO/TOOLS, CHANNEL_*) can no longer
        // even reach here as actions: they map to UNKNOWN_* and pass through
        // unhandled to the webview/system.
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
 * the route guard uses, so there is no listener leak; M-TIZEN-09 pruned the dead
 * names — the channel pair rides on for the documented zap-guard). On a non-Tizen webview the
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
  // motivating case; STOP reaches it too when the player route is current
  // (M-TIZEN-02/33: STOP backs out of the player, so this guard then tears
  // down quality mode along with the route). A STOP fired off the player
  // route performs no navigation, so the menu — if open — stays open and
  // dismissible via BACK/YELLOW/rung-select as normal; this guard exists
  // purely for route-changing exits. A single router.afterEach guard clears
  // quality mode whenever navigation leaves the player route, so a stuck
  // `qualityMenuActive` can never disable D-pad navigation app-wide. Guarded
  // so the helper still works against a fake router with no afterEach in tests.
  const removeRouteGuard =
    typeof router.afterEach === 'function'
      ? router.afterEach((to) => {
          if (to?.name !== 'player') quality.deactivate();
        })
      : undefined;

  // S509 — declare the 2020+ media / channel / colour keys to the platform now
  // (app-ready; M-TIZEN-09 pruned MediaPrevious + Info from the set — dead
  // actions — while the channel pair stays as the documented live-TV-zap
  // swallow). Returns a teardown releasing only what it acquired; a no-op when
  // the `tizen` global is absent. Registered keys arrive as DOM keydowns that
  // RemoteManager + KeyMapping already dispatch — no second pipeline.
  const releaseRemoteKeys = installRemoteKeyRegistration(tizenLike);

  // S531 (AD-23) — guarded VoiceControl. Register the transport + digit command
  // list ONLY while the player route is mounted and release on unmount, riding
  // the same route seam the quality guard uses (single-writer B-seam: this is the
  // mount hook, nothing more). A recognised non-digit phrase re-enters the
  // EXISTING action pipeline through `remoteManager.emit('action', …)` so voice
  // is never a second dispatcher; since S535 a recognised DIGIT phrase enters the
  // ONE shared digit-commit buffer through `remoteManager.pressDigit` — the same
  // handler physical digit keys use, so a spoken "1-2-3" drains as the same
  // DIGIT_COMMIT action. A `tizen.voicecontrol` that is absent or throws (the
  // common TV case) makes this a silent no-op — app behaviour byte-identical.
  const releaseVoiceControl = installVoiceControlRegistration({
    getRoute,
    router,
    // The ambient `tizen` object is the same for both subsystems; each module
    // reads only its own structural slice (`tvinputdevice` / `voicecontrol`), so
    // the injected fake is passed through and feature-detected independently.
    tizenLike: tizenLike as unknown as VoiceTizenLike | null | undefined,
    onAction: (action) => {
      // ONE-buffer law (S535): digits join the routed-key queue, everything
      // else keeps the pre-S535 direct emit. No forked digit path.
      if (KeyMapping.isDigit(action)) remoteManager.pressDigit(action);
      else remoteManager.emit('action', { key: action });
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
