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
 *
 * M-TIZEN-09 (review tizen__gameux M1): transport taps go LIVE and the hold
 * cadence is throttled. FAST_FORWARD/REWIND are now immediate AND repeatable
 * (tap = one ±10 s step on keydown via the existing emit branch; hold adds
 * ±30 s steps after the delay), NEXT/VOLUME_UP/VOLUME_DOWN moved from the
 * repeatable-only set to immediate (each press is one discrete step — a
 * 10 Hz track-skip storm was the parent's only emission path), and the
 * repeatable set is FF/REW alone. `keyRepeatInterval` 100 → 500 ms.
 *
 * M-TIZEN-26 (review tizen__gameux m2): held-key auto-repeat no longer storms
 * the action channel. A keydown the host flags `repeat` never emits an
 * immediate action, and unflagged same-key presses are floored to one emit
 * per 250 ms. Suppressed keydowns also skip the hold-timer re-arm, so a held
 * seek accelerator REACHES its 500 ms hold cadence instead of restarting
 * under every repeat — a tap is ONE step, a hold is the designed ±30 s
 * cadence, and a held PLAY/STOP/BACK/VOLUME key is one press, not an event
 * per repeat.
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import KeyMapping, { type ActionName } from './KeyMapping';
import { createDigitBuffer, isTypingTarget, type DigitBuffer } from './DigitBuffer';

/**
 * M-TIZEN-26 (review tizen__gameux m2): floor between EMITTED immediate
 * actions for the same key. The Tizen webview fires auto-repeat keydowns
 * while a key is held (see the repeat branch in `onKeyDown`); without a
 * floor every repeat re-emitted the immediate action — a held PLAY/STOP/
 * BACK/VOLUME key became a storm instead of one press. `event.repeat` is
 * honored first (the webview sets it on its own auto-repeats); this floor is
 * the defense for hosts that deliver unflagged repeats. The window is
 * measured against the last EMIT, so a genuine mash faster than the floor
 * still registers one step per window (bounded 4 per second per key).
 */
const IMMEDIATE_ACTION_FLOOR_MS = 250;

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
  /**
   * M-TIZEN-09 (review tizen__gameux M1): 100 → 500 ms. At 100 ms a held FF
   * fired a 30 s step ten times a second (≈300× timeline — a teleport, not a
   * fast-forward). 500 ms × the designed 30 s repeat step = 2 steps/s ≈ 60×,
   * a mainstream hold-FF rate. The step stays a RELATIVE `seekBy` delta via
   * the bridge — never a per-tick jump to a computed target. Only the seek
   * accelerators repeat anymore (the repeatable set is FF/REW alone).
   */
  keyRepeatInterval = 500;
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
   * M-TIZEN-26: per-action-name timestamp of the last EMITTED immediate
   * action. Written only on emission (a suppressed press never refreshes it),
   * read by the floor predicate in `onKeyDown`. Cleared with the rest of the
   * runtime state on disable/destroy.
   */
  private readonly lastImmediateAt = new Map<ActionName, number>();
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

    // M-TIZEN-26: suppression law for the immediate-action branches below —
    // a keydown the host flags `repeat` never re-emits, and an unflagged
    // same-key press inside IMMEDIATE_ACTION_FLOOR_MS of the last EMIT
    // doesn't either. Raw `keydown` subscribers (above) and digits (the S535
    // buffer has its own window) are untouched; the event is still
    // preventDefaulted — only the action emission and the hold-timer re-arm
    // are gated, so the FIRST press arms the hold timer and repeats leave it
    // alone: a held seek accelerator finally reaches its 500 ms hold cadence
    // instead of restarting under every auto-repeat keydown.
    const suppressedImmediate =
      KeyMapping.isImmediate(mappedKey) &&
      (event.repeat === true ||
        Date.now() - (this.lastImmediateAt.get(mappedKey) ?? Number.NEGATIVE_INFINITY) <
          IMMEDIATE_ACTION_FLOOR_MS);

    // Held-key repeat (seek-accelerator hold: FAST_FORWARD/REWIND). Clear any
    // prior repeat timer first — a genuine new press re-arms cleanly. A
    // SUPPRESSED keydown (M-TIZEN-26) must NOT re-arm: re-arming on every
    // auto-repeat is how a held key restarted its 500 ms delay forever and
    // never reached the hold cadence. (M-TIZEN-09: FF/REW are ALSO immediate
    // now — under such a host they tap-step ±10 per keydown exactly like
    // every other immediate key already does; on the tvinputdevice path one
    // press is one keydown, which is the shipped doctrine — see
    // remote/registerKeys.ts.)
    if (KeyMapping.isRepeatable(mappedKey)) {
      event.preventDefault();
      if (!suppressedImmediate) {
        this.stopKeyRepeat();
        this.activeKeyRepeat = setTimeout(() => {
          this.startKeyRepeat(mappedKey);
        }, this.keyRepeatDelay);
      }
    }

    // Immediate action keys (PLAY/STOP/PAUSE/BACK/HOME/etc.).
    if (KeyMapping.isImmediate(mappedKey)) {
      event.preventDefault();
      if (!suppressedImmediate) {
        this.lastImmediateAt.set(mappedKey, Date.now());
        this.emit('action', { key: mappedKey });
      }
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
      // M-TIZEN-26: re-enabling must not inherit a floor window from before
      // the disable — the next press is a fresh first press.
      this.lastImmediateAt.clear();
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
    this.lastImmediateAt.clear();
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.boundKeyDown);
      document.removeEventListener('keyup', this.boundKeyUp);
    }
    this.listeners.clear();
  }
}

const remoteManager = new RemoteManager();
export default remoteManager;
