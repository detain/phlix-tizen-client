/**
 * Remote Manager
 * Handles Samsung Tizen remote control input.
 *
 * Ported to TypeScript for the @phlix/ui thin-consumer migration. It remains
 * the SINGLE source of TV-remote events (the analogue of Electron's media
 * events). Arrow keys are intentionally not handled here — @phlix/ui's
 * useSpatialNav owns D-pad navigation directly on `document`.
 */

import KeyMapping, { type ActionName } from './KeyMapping';

export interface ActionEvent {
  key: ActionName;
  repeat?: boolean;
}

export interface KeyEvent {
  keyCode: number;
  mappedKey: ActionName;
}

type RemoteEventName = 'action' | 'keydown' | 'keyup';
type Handler = (data: ActionEvent | KeyEvent) => void;

export class RemoteManager {
  enabled = true;
  keyRepeatDelay = 500;
  keyRepeatInterval = 100;
  private activeKeyRepeat: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | null =
    null;
  private listeners = new Map<RemoteEventName, Handler[]>();
  private readonly boundKeyDown: (event: KeyboardEvent) => void;
  private readonly boundKeyUp: (event: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
    this.boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e);
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
    }
  }

  /** Register an action handler (convenience wrapper). */
  onAction(callback: (data: ActionEvent) => void): void {
    this.on('action', callback as Handler);
  }

  /** Register an event handler. Returns an unsubscribe function. */
  on(event: RemoteEventName, callback: Handler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
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
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.boundKeyDown);
      document.removeEventListener('keyup', this.boundKeyUp);
    }
    this.listeners.clear();
  }
}

const remoteManager = new RemoteManager();
export default remoteManager;
