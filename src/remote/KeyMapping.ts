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
 * @copyright 2026 Joe Huss <detain@interserver.net>
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

  // Misc digits
  48: '0',
  49: '1',
  50: '2',
  51: '3',
  52: '4',
  53: '5',
  54: '6',
  55: '7',
  56: '8',
  57: '9',

  // Tizen specific
  66: 'PLAY_PAUSE',
  79: 'OPTIONS'
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
  'TOOLS'
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
  PLAY_PAUSE: 'Play/Pause'
};

const KeyMapping = {
  KEY_MAP,

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

  /** Whether RemoteManager should preventDefault for this action. */
  isHandled(action: ActionName): boolean {
    return HANDLED_ACTIONS.has(action);
  },

  /** Human-readable display name for an action. */
  getDisplayName(action: ActionName): string {
    return DISPLAY_NAMES[action] || action;
  }
};

export default KeyMapping;
