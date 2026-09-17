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
 * now makes reachable (10252 → PLAY_PAUSE, 427/428 → CHANNEL_UP/DOWN) and names
 * the digit keys DIGIT_0..9 as routing groundwork for a later commit buffer.
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
  424: 'PREVIOUS',
  425: 'NEXT',

  // Color buttons
  403: 'RED',
  404: 'GREEN',
  405: 'YELLOW',
  406: 'BLUE',

  // Volume
  1028: 'VOLUME_UP',
  1029: 'VOLUME_DOWN',
  1025: 'MUTE',

  // Menu
  10282: 'MENU',
  18: 'INFO',
  113: 'TOOLS',

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
  79: 'OPTIONS',

  // Media-transport / channel keys registered via `tvinputdevice` (S509): 10252 is
  // the dedicated MediaPlayPause toggle (aliased onto PLAY_PAUSE); 427/428 are the
  // NextChannel/PreviousChannel codes. PLAY/STOP/PAUSE/FF/REWIND/NEXT/PREVIOUS
  // already resolve via the classic codes above, so only these two gaps are added.
  10252: 'PLAY_PAUSE',
  427: 'CHANNEL_UP',
  428: 'CHANNEL_DOWN'
};

// Held-key repeat: FAST_FORWARD/REWIND accelerate seek when held. Arrow keys
// intentionally removed — spatial-nav handles repeat navigation itself.
const REPEATABLE_ACTIONS: ReadonlySet<ActionName> = new Set([
  'FAST_FORWARD',
  'REWIND',
  'NEXT',
  'PREVIOUS',
  'VOLUME_UP',
  'VOLUME_DOWN'
]);

// Immediate (fire on keydown). BACK/HOME/PLAY/STOP/PAUSE are bridged to the
// player/router. ENTER intentionally removed — native focus activation.
const IMMEDIATE_ACTIONS: ReadonlySet<ActionName> = new Set([
  'BACK',
  'HOME',
  'PLAY',
  'STOP',
  'PAUSE',
  'PLAY_PAUSE',
  'RED',
  'GREEN',
  'YELLOW',
  'BLUE',
  'MUTE',
  'MENU',
  'INFO',
  'TOOLS',
  'CHANNEL_UP',
  'CHANNEL_DOWN'
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
  PREVIOUS: 'Previous',
  RED: 'Red',
  GREEN: 'Green',
  YELLOW: 'Yellow',
  BLUE: 'Blue',
  VOLUME_UP: 'Volume Up',
  VOLUME_DOWN: 'Volume Down',
  MUTE: 'Mute',
  MENU: 'Menu',
  INFO: 'Info',
  TOOLS: 'Tools',
  PLAY_PAUSE: 'Play/Pause',
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
  // S535 display need (re-derived: ActionToastOverlay captions EVERY action via
  // getDisplayName, and the buffer's drain is an action): one honest label for
  // the joined-digit commit. The digit rows above double as the voice phrase
  // source, so digits keep their plain numerals here.
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
  }
};

export default KeyMapping;
