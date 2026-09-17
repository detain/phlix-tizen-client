/**
 * Remote Manager
 * Handles Samsung Tizen remote control input.
 *
 * Ported to TypeScript for the @phlix/ui thin-consumer migration. It remains
 * the SINGLE source of TV-remote events (the analogue of Electron's media
 * events). Arrow keys are intentionally not handled here — @phlix/ui's
 * useSpatialNav owns D-pad navigation directly on `document`.
 *
 * S535 (AD-22): the digit channel stops being a dead passthrough. Routed
 * DIGIT_* keydowns feed the ONE shared digit-commit buffer (below), which
 * drains as a single DIGIT_COMMIT action on the existing `action` channel.
 * While a typing target holds focus, digits stay byte-identical to the old
 * passthrough — no buffer, no preventDefault. Recognised numeric voice
 * phrases (S531) enter through the SAME `pressDigit` seam — never a forked
 * digit path.
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import KeyMapping, { type ActionName } from './KeyMapping';
import { createDigitBuffer, isTypingTarget, type DigitBuffer } from './DigitBuffer';

export interface ActionEvent {
  key: ActionName;
  repeat?: boolean;
  /** Joined digit string carried by the S535 DIGIT_COMMIT drain (buffer value). */
  value?: string;
}

export interface KeyEvent {
  keyCode: number;
  mappedKey: ActionName;
}

type RemoteEventName = 'action' | 'keydown' | 'keyup';
type Handler = (_data: ActionEvent | KeyEvent) => void;

export class RemoteManager {
  enabled = true;
  keyRepeatDelay = 500;
  keyRepeatInterval = 100;
  /**
   * Optional host predicate. When it returns true for a keydown, RemoteManager
   * calls `event.stopImmediatePropagation()` so LATER `document` keydown
   * listeners (notably @phlix/ui's own player Arrow seek/volume shortcuts and
   * `useSpatialNav`) do NOT also react to that key. RemoteManager stays generic:
   * it knows nothing about WHY a key is being suppressed — the tizenBridge sets
   * this to stop the player hijacking the D-pad while the on-screen QualityMenu
   * is being navigated.
   *
   * This works because RemoteManager's `document` listener is registered at
   * module-eval time (before @phlix/ui mounts the player), so in the bubble
   * phase it fires BEFORE those later listeners. The focused control's own
   * target-phase keydown handler has already run by then, so navigation inside
   * that control still works — only the redundant global handlers are stopped.
   */
  suppressPropagation: ((mappedKey: ActionName, _event: KeyboardEvent) => boolean) | null = null;
  private activeKeyRepeat: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | null =
    null;
  /**
   * THE single digit-commit buffer (S535 ONE-buffer law). Keydowns routed here
   * by `onKeyDown` and voice digits routed here by `pressDigit` share it; its
   * drain re-enters the ONE existing `action` channel as DIGIT_COMMIT.
   */
  private readonly digitBuffer: DigitBuffer = createDigitBuffer({
    commit: (value: string) => {
      this.emit('action', { key: KeyMapping.DIGIT_COMMIT, value });
    }
  });
  private listeners = new Map<RemoteEventName, Handler[]>();
  private readonly boundKeyDown: (_event: KeyboardEvent) => void;
  private readonly boundKeyUp: (_event: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDown = (e: KeyboardEvent) => { this.onKeyDown(e); };
    this.boundKeyUp = (e: KeyboardEvent) => { this.onKeyUp(e); };
    this.init();
  }

  /** Initialize remote control handling. */
  init(): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.addEventListener('keydown', this.boundKeyDown);
    document.addEventListener('keyup', this.boundKeyUp);
  }

  /** Handle key down event. */
  onKeyDown(event: KeyboardEvent): void {
    if (!this.enabled) {
      return;
    }

    const keyCode = event.keyCode;
    const mappedKey = KeyMapping.mapKeyCode(keyCode);

    this.emit('keydown', { keyCode, mappedKey });

    // S535 (AD-22): digits on NORMAL focus feed the one shared commit buffer —
    // the drain later emits a single DIGIT_COMMIT action. While a typing target
    // holds focus this is skipped entirely: no buffer, no preventDefault, the
    // event keeps its byte-identical passthrough so a search input types "1984".
    if (KeyMapping.isDigit(mappedKey) && !isTypingTarget(event.target)) {
      this.pressDigit(mappedKey);
    }

    // Held-key repeat (FF/REW accel, volume). Clear any prior repeat timer
    // first — the webview fires auto-repeat keydowns while a key is held, and
    // re-arming without clearing would orphan the previous timer.
    if (KeyMapping.isRepeatable(mappedKey)) {
      event.preventDefault();
      this.stopKeyRepeat();
      this.activeKeyRepeat = setTimeout(() => {
        this.startKeyRepeat(mappedKey);
      }, this.keyRepeatDelay);
    }

    // Immediate action keys (PLAY/STOP/PAUSE/BACK/HOME/etc.).
    if (KeyMapping.isImmediate(mappedKey)) {
      event.preventDefault();
      this.emit('action', { key: mappedKey });
    }

    // preventDefault for handled keys (arrows + ENTER are NOT handled → pass
    // through to spatial-nav / native focus).
    if (KeyMapping.isHandled(mappedKey)) {
      event.preventDefault();
    }

    // Host-driven suppression: stop later document/window keydown listeners
    // (the player's own Arrow shortcuts / spatial-nav) from also firing. Runs
    // last so our own subscribers + the focused control's target-phase handler
    // are unaffected. Only stops the onward bubble; never preventDefaults here.
    if (this.suppressPropagation?.(mappedKey, event)) {
      event.stopImmediatePropagation();
    }
  }

  /** Handle key up event. */
  onKeyUp(event: KeyboardEvent): void {
    if (!this.enabled) {
      return;
    }

    const keyCode = event.keyCode;
    const mappedKey = KeyMapping.mapKeyCode(keyCode);

    this.stopKeyRepeat();
    this.emit('keyup', { keyCode, mappedKey });
  }

  /** Start key repeat for an action being held. */
  startKeyRepeat(key: ActionName): void {
    this.stopKeyRepeat();
    this.activeKeyRepeat = setInterval(() => {
      this.emit('action', { key, repeat: true });
    }, this.keyRepeatInterval);
  }

  /** Stop key repeat. */
  stopKeyRepeat(): void {
    if (this.activeKeyRepeat) {
      clearTimeout(this.activeKeyRepeat as ReturnType<typeof setTimeout>);
      clearInterval(this.activeKeyRepeat as ReturnType<typeof setInterval>);
      this.activeKeyRepeat = null;
    }
  }

  /** Enable/disable remote handling. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopKeyRepeat();
      // A disabled manager queues nothing and commits nothing (S535): drop the
      // pending burst WITHOUT emitting — same posture as stopping key repeat.
      this.digitBuffer.clear();
    }
  }

  /**
   * Shared entry for ONE digit action name (e.g. 'DIGIT_7') into the single
   * commit buffer (S535). Routed keydowns and recognised numeric voice phrases
   * both arrive here — the ONE-buffer law's choke point. Non-digit names are
   * refused without touching the queue.
   */
  pressDigit(action: ActionName): void {
    const digit = KeyMapping.digitValue(action);
    if (digit === null) return;
    this.digitBuffer.push(digit);
  }

  /** Register an action handler (convenience wrapper). */
  onAction(callback: (_data: ActionEvent) => void): void {
    this.on('action', callback as Handler);
  }

  /** Register an event handler. Returns an unsubscribe function. */
  on(event: RemoteEventName, callback: Handler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.push(callback);
    }
    return () => this.off(event, callback);
  }

  off(event: RemoteEventName, callback: Handler): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) {
      return;
    }
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event: RemoteEventName, data: ActionEvent | KeyEvent): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) {
      return;
    }
    for (const callback of [...callbacks]) {
      callback(data);
    }
  }

  /** Cleanup all listeners + DOM handlers. */
  destroy(): void {
    this.stopKeyRepeat();
    this.digitBuffer.clear();
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.boundKeyDown);
      document.removeEventListener('keyup', this.boundKeyUp);
    }
    this.listeners.clear();
  }
}

const remoteManager = new RemoteManager();
export default remoteManager;
