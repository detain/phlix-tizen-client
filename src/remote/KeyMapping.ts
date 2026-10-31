/**
 * Samsung Tizen Remote Key Mapping
 * Maps Tizen key codes to unified action names.
 *
 * RETARGETED for the Vue 3 / @phlix/ui thin-consumer migration:
 * the arrow keys (LEFT/UP/RIGHT/DOWN) and ENTER are deliberately NOT
 * repeatable / immediate / handled here — @phlix/ui's `useSpatialNav`
 * owns D-pad navigation via its own `document` listener, and ENTER/click
 * is native focus activation. If RemoteManager also emitted/handled arrows
 * its key-repeat would fire phantom navigation actions on top of spatial-nav.
 *
 * S509 (AD-1) adds the 2020+ media-key codes the `tvinputdevice` registration
 * now makes reachable (10252 → PLAY_PAUSE) and names the digit keys DIGIT_0..9
 * as routing groundwork for a later commit buffer.
 *
 * M-TIZEN-09 (review tizen__gameux M1) retires the DEAD half of the vocabulary
 * and makes the transport taps live. Rule applied: a mapped key with no
 * consumer on EITHER side of the bridge is a lie in code — remove the mapping
 * (the key then reaches the webview/TV unhandled, which is the honest
 * behavior); a single press with a sensible action must emit it. Removed:
 * PREVIOUS + OPTIONS (no `usePlayerStore` seam anywhere in the pinned
 * @phlix/ui) and RED/GREEN/BLUE + MENU/INFO/TOOLS (swallowed, caption
 * a toast, accomplish nothing — MENU/INFO actively DENY the TV's own system
 * surfaces). CHANNEL_UP/DOWN KEPT: their immediate classification carries a
 * documented platform effect (stopping the live-TV zap — see the KEY_MAP note;
 * the review's M1 did not enumerate them). FAST_FORWARD/REWIND join IMMEDIATE
 * so the bridge's already-designed ±10 s single-tap seek (`tizenBridge.ts`
 * SEEK_STEP_SECONDS) fires; NEXT/VOLUME_UP/VOLUME_DOWN become immediate
 * single-step actions with real store seams (`next()`, `setVolume()`).
 * Held-FF cadence is throttled in `RemoteManager` (repeat interval 100 →
 * 500 ms), never a per-tick teleport.
 *
 * S535 (AD-22) makes that groundwork live: digits route through the shared
 * digit-commit buffer (`remote/DigitBuffer.ts`) and drain as the new
 * DIGIT_COMMIT action on the existing action channel. Digits stay OUT of
 * IMMEDIATE/HANDLED — while a typing target holds focus they must remain the
 * byte-identical passthrough (search inputs keep typing "1984").
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

export type ActionName = string;

const KEY_MAP: Record<number, ActionName> = {
  // Navigation (kept in the code map for logging, but NOT classified as
  // repeatable/immediate/handled — spatial-nav owns these).
  37: 'LEFT',
  38: 'UP',
  39: 'RIGHT',
  40: 'DOWN',
  13: 'ENTER',
  10009: 'BACK', // Samsung back button
  36: 'HOME', // Home button

  // Playback control
  415: 'PLAY',
  413: 'STOP',
  19: 'PAUSE',
  417: 'FAST_FORWARD',
  412: 'REWIND',
  425: 'NEXT',
  // PREVIOUS (424) REMOVED (M-TIZEN-09): no `previous` seam exists on the
  // pinned @phlix/ui usePlayerStore surface (grep both-sides: store d.ts/chunk
  // 0 hits; the PlayerPage binds no previoustrack producer). Dead mapping.

  // Color buttons — YELLOW only (M-TIZEN-09): RED/GREEN/BLUE (403/404/406)
  // had no consumer on either side of the bridge (swallowed + a caption toast
  // = the lie the review names). YELLOW is the live quality-menu key.
  405: 'YELLOW',

  // Volume
  1028: 'VOLUME_UP',
  1029: 'VOLUME_DOWN',
  1025: 'MUTE',

  // MENU (10282) / INFO (18) / TOOLS (113) REMOVED (M-TIZEN-09): zero
  // consumers both-sides; swallowing MENU/INFO additionally denies Samsung's
  // own system menu, and codes 18/113 collide with the desktop Alt/F2
  // keydowns that dev sessions receive.

  // Digit keys (S509 groundwork, LIVE since S535/AD-22): named DIGIT_0..DIGIT_9,
  // RemoteManager feeds them to the shared digit-commit buffer when the event
  // target is NOT a typing target; the buffer drains as ONE DIGIT_COMMIT action.
  // Still deliberately NOT in IMMEDIATE / HANDLED, so RemoteManager never
  // preventDefaults them — while an INPUT/TEXTAREA/contenteditable holds focus a
  // text input keeps typing "1984" byte-identically (the bypass is hard law).
  48: 'DIGIT_0',
  49: 'DIGIT_1',
  50: 'DIGIT_2',
  51: 'DIGIT_3',
  52: 'DIGIT_4',
  53: 'DIGIT_5',
  54: 'DIGIT_6',
  55: 'DIGIT_7',
  56: 'DIGIT_8',
  57: 'DIGIT_9',

  // Tizen specific
  66: 'PLAY_PAUSE',
  // OPTIONS (79) REMOVED (M-TIZEN-09): never classified (never emitted an
  // action, never preventDefaulted) — a mapped name with zero consumers. 79 is
  // also the desktop 'O' keyCode that @phlix/ui's skipOutro shortcut rides.

  // Media-transport / channel keys registered via `tvinputdevice` (S509): 10252 is
  // the dedicated MediaPlayPause toggle (aliased onto PLAY_PAUSE); 427/428 are the
  // NextChannel/PreviousChannel codes. PLAY/STOP/PAUSE/FF/REWIND/NEXT already
  // resolve via the classic codes above, so S509 added only these gaps.
  //
  // M-TIZEN-09 KEPT the channel pair (unlike the other dead names): their
  // consumer is NEGATIVE — the documented defensive swallow (DEVELOPER.md
  // "claiming the channel keys as immediate also stops a registered channel
  // press from zapping the app to live TV"). The preventDefault IS the
  // feature; no functional action exists and none was invented here.
  // Toast honesty (M-TIZEN-01, W-min170): the caption no longer lies —
  // CHANNEL_UP/CHANNEL_DOWN join DIGIT_COMMIT in KeyMapping.isSilentAction,
  // so the swallow stays invisible to the viewer, as it should be.
  10252: 'PLAY_PAUSE',
  427: 'CHANNEL_UP',
  428: 'CHANNEL_DOWN'
};

// Held-key repeat: ONLY the seek accelerators. M-TIZEN-09 removed NEXT/
// PREVIOUS/VOLUME_* from this set — "hold to repeat a track skip / volume step"
// has no ui idiom and only produced 10 Hz actions into a default arm. FF/REW
// stay repeatable AND join IMMEDIATE below: the press taps one ±10 s step,
// holding past the delay adds 30 s steps at the throttled cadence. Arrows are
// intentionally out — spatial-nav handles repeat navigation itself.
const REPEATABLE_ACTIONS: ReadonlySet<ActionName> = new Set([
  'FAST_FORWARD',
  'REWIND'
]);

// Immediate (fire on keydown). BACK/HOME/PLAY/STOP/PAUSE are bridged to the
// player/router. ENTER intentionally removed — native focus activation.
// M-TIZEN-09 (review tizen__gameux M1): the transport taps land HERE. A lone
// FF/REW press has a sensible action (the ±10 s seek jump the bridge was
// already designed for), so keeping it repeatable-only made the single press
// a silent no-op; NEXT/VOLUME_UP/VOLUME_DOWN join with real store seams. The
// choice is set membership on the existing emit-on-keydown branch
// (RemoteManager.ts isImmediate), NOT a new keyup-repeat-detector state
// machine — zero invention beyond classification.
const IMMEDIATE_ACTIONS: ReadonlySet<ActionName> = new Set([
  'BACK',
  'HOME',
  'PLAY',
  'STOP',
  'PAUSE',
  'PLAY_PAUSE',
  'FAST_FORWARD',
  'REWIND',
  'NEXT',
  'VOLUME_UP',
  'VOLUME_DOWN',
  'MUTE',
  // Defensive swallow (see the 427/428 KEY_MAP note): immediate+handled means
  // RemoteManager preventDefaults them, which is the documented live-TV-zap
  // guard. No bridge case exists — the ACTION is not the point, the SWALLOW is.
  'CHANNEL_UP',
  'CHANNEL_DOWN',
  'YELLOW'
]);

// Digit actions (S509 naming; since S535 routed into the shared digit-commit
// buffer). Predicate-exposed; kept OUT of IMMEDIATE/HANDLED on purpose — they
// must not be preventDefaulted while a text field has focus (see KEY_MAP digits
// note). The digit names are the ONE vocabulary: key codes 48–57 map to these,
// voice digit phrases resolve to these, and RemoteManager.pressDigit accepts
// these; the joined burst commits as the DIGIT_COMMIT action below.
const DIGIT_ACTIONS: ReadonlySet<ActionName> = new Set([
  'DIGIT_0',
  'DIGIT_1',
  'DIGIT_2',
  'DIGIT_3',
  'DIGIT_4',
  'DIGIT_5',
  'DIGIT_6',
  'DIGIT_7',
  'DIGIT_8',
  'DIGIT_9'
]);

// S535 (AD-22): the single action a digit-burst drain emits on the existing
// action channel. Not a key code — a named vocabulary entry like DIGIT_* was
// (one vocabulary, no forked names).
const DIGIT_COMMIT_ACTION: ActionName = 'DIGIT_COMMIT';

/**
 * M-TIZEN-01 (W-min170): the SILENT-action law. These actions have NO positive
 * consumer — their classification exists only to SWALLOW a key (DIGIT_COMMIT is
 * the buffer drain awaiting a go-to-time surface; CHANNEL_UP/CHANNEL_DOWN are the
 * documented defensive zap-guard, M-TIZEN-09: the preventDefault IS the feature).
 * The toast surface must not caption them: echoing "Channel Up" for a press the
 * app deliberately drops tells the viewer something functional happened, and it
 * did not. Display rows stay (vocabulary/registry truth), captions do not.
 * Predicate exposed so the ONE set is the single source (caption layer and any
 * future echo surface consume this, never re-enumerate).
 */
const SILENT_ACTIONS: ReadonlySet<ActionName> = new Set([
  DIGIT_COMMIT_ACTION,
  'CHANNEL_UP',
  'CHANNEL_DOWN'
]);

// Keys for which RemoteManager calls preventDefault. Arrows + ENTER are NOT
// here, so the browser/spatial-nav receive them unimpeded.
const HANDLED_ACTIONS: ReadonlySet<ActionName> = new Set([
  ...REPEATABLE_ACTIONS,
  ...IMMEDIATE_ACTIONS
]);

const DISPLAY_NAMES: Record<string, string> = {
  LEFT: 'Left Arrow',
  RIGHT: 'Right Arrow',
  UP: 'Up Arrow',
  DOWN: 'Down Arrow',
  ENTER: 'OK',
  BACK: 'Back',
  HOME: 'Home',
  PLAY: 'Play',
  STOP: 'Stop',
  PAUSE: 'Pause',
  FAST_FORWARD: 'Fast Forward',
  REWIND: 'Rewind',
  NEXT: 'Next',
  YELLOW: 'Yellow',
  // M-TIZEN-09: PREVIOUS/RED/GREEN/BLUE/MENU/INFO/TOOLS/CHANNEL_UP/
  // CHANNEL_DOWN display rows removed with their mappings — no key produces
  // the action and no voice phrase reads these labels any more.
  VOLUME_UP: 'Volume Up',
  VOLUME_DOWN: 'Volume Down',
  MUTE: 'Mute',
  PLAY_PAUSE: 'Play/Pause',
  // KEPT with the defensive channel swallow (M-TIZEN-09) — see KEY_MAP note;
  // captions for these are suppressed by the SILENT_ACTIONS law (M-TIZEN-01),
  // the rows stay as vocabulary truth (display names are not an echo promise).
  CHANNEL_UP: 'Channel Up',
  CHANNEL_DOWN: 'Channel Down',
  DIGIT_0: '0',
  DIGIT_1: '1',
  DIGIT_2: '2',
  DIGIT_3: '3',
  DIGIT_4: '4',
  DIGIT_5: '5',
  DIGIT_6: '6',
  DIGIT_7: '7',
  DIGIT_8: '8',
  DIGIT_9: '9',
  // S535 display need (re-derived: ActionToastOverlay captions the actions it
  // echoes via getDisplayName — with the M-TIZEN-01 exception: SILENT_ACTIONS
  // keep their row as vocabulary but are never echoed), and the buffer's drain
  // is an action): one honest label for the joined-digit commit. The digit rows
  // above double as the voice phrase source, so digits keep their plain numerals
  // here.
  DIGIT_COMMIT: 'Digits'
};

const KeyMapping = {
  KEY_MAP,

  /** The single digit-burst drain action (S535) — part of the ONE vocabulary. */
  DIGIT_COMMIT: DIGIT_COMMIT_ACTION,

  /** Map Tizen key code to action name. */
  mapKeyCode(keyCode: number): ActionName {
    return KEY_MAP[keyCode] || `UNKNOWN_${keyCode}`;
  },

  /** Whether the action repeats while held (seek accel / volume). */
  isRepeatable(action: ActionName): boolean {
    return REPEATABLE_ACTIONS.has(action);
  },

  /** Whether the action fires immediately on keydown. */
  isImmediate(action: ActionName): boolean {
    return IMMEDIATE_ACTIONS.has(action);
  },

  /** Whether the action is one of the named digit keys (S509 routing groundwork). */
  isDigit(action: ActionName): boolean {
    return DIGIT_ACTIONS.has(action);
  },

  /** The digit char ('0'..'9') a DIGIT_* action carries, or null (S535 buffer feed). */
  digitValue(action: ActionName): string | null {
    if (!DIGIT_ACTIONS.has(action)) return null;
    return action.slice('DIGIT_'.length);
  },

  /** Whether RemoteManager should preventDefault for this action. */
  isHandled(action: ActionName): boolean {
    return HANDLED_ACTIONS.has(action);
  },

  /** Human-readable display name for an action. */
  getDisplayName(action: ActionName): string {
    if (action in DISPLAY_NAMES) {
      return DISPLAY_NAMES[action];
    }
    return action;
  },

  /**
   * Whether the action must stay uncaptioned by echo surfaces (M-TIZEN-01) —
   * negative consumers only; see the SILENT_ACTIONS note.
   */
  isSilentAction(action: ActionName): boolean {
    return SILENT_ACTIONS.has(action);
  }
};

export default KeyMapping;
