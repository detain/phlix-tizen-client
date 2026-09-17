/**
 * Guarded VoiceControl registration (S531 — AD-23).
 *
 * Feature-detects the `tizen.voicecontrol` platform API and, ONLY while the
 * player route is mounted, registers a transport + digit command list at
 * `FOREGROUND` service level so a spoken "play"/"pause"/"7"/… drives the SAME
 * actions the remote keys already do. Every touch is guarded (a missing API)
 * and wrapped (a throwing API), so an absent or broken `voicecontrol` — the
 * common case across TV profiles — is a SILENT NO-OP and app behaviour is
 * byte-identical without voice. This mirrors the `remote/registerKeys.ts` /
 * `deviceId.ts` idiom: a thin pure seam that takes a `tizenLike` argument so a
 * unit test drives a hand-built object and a non-Tizen (browser dev / jsdom)
 * run never calls into the platform.
 *
 * ## No forked vocabulary, no second pipeline
 *
 * The default command list is mapped onto EXISTING `KeyMapping` action names —
 * phrases come from `KeyMapping.getDisplayName`, so there is no parallel label
 * table (AC#1). A recognised command is delivered to an injected `onAction`
 * seam; in production the bridge wires that seam to `RemoteManager` — non-digit
 * actions re-enter the SINGLE existing action pipeline via `emit('action', …)`
 * that `wireTizenBridge` already consumes, and digit actions enter the same
 * digit-commit buffer the physical keys use (S535) — voice never becomes a
 * second dispatcher.
 *
 * Since S535 the numeric phrases are registered too: digit names ride the SAME
 * `onAction` seam, and production routes them into the single digit-commit
 * buffer (`remote/DigitBuffer.ts` via `RemoteManager.pressDigit`) exactly like
 * physical digit keys — a spoken burst drains as the SAME DIGIT_COMMIT action.
 * ONE buffer, one handler, never a forked digit path (findings §AD-22/§AD-23:
 * "numeric voice commands land in the same handler as AD-22").
 *
 * ## Manifest honesty (TN-2 / S503)
 *
 * On some profiles `tizen.voicecontrol` only materialises once the app declares
 * a `voicecontrol` `<feature>` in `app/config.xml`. This module deliberately does
 * NOT pre-add that feature: a guarded no-op ship is preferred to a speculative
 * manifest delta, and privilege/feature changes belong to the batched,
 * line-justified C-seam manifest PR — not this lane. If the target profile needs
 * the feature, the API stays absent here, this module no-ops, and the feature
 * decision is reported for that separate PR.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import KeyMapping, { type ActionName } from './remote/KeyMapping';

/** The subset of `tizen.voicecontrol` this module touches. All four are required. */
export interface VoiceControlLike {
  setCommandList(
    commands: readonly string[],
    serviceLevel: string,
    onSuccess?: () => void,
    onError?: (error: unknown) => void
  ): number;
  removeCommandList(
    serviceId: number,
    onSuccess?: () => void,
    onError?: (error: unknown) => void
  ): void;
  addResultListener(
    listener: (command: string) => void,
    onSuccess?: () => void,
    onError?: (error: unknown) => void
  ): number;
  removeResultListener(
    listenerId: number,
    onSuccess?: () => void,
    onError?: (error: unknown) => void
  ): void;
}

/** The minimal structural shape of the ambient `tizen` object we read from. */
export interface TizenLike {
  voicecontrol?: VoiceControlLike;
}

/** One voice command: the spoken phrase mapped onto an existing remote ActionName. */
export interface VoiceCommand {
  readonly phrase: string;
  readonly action: ActionName;
}

/** Tizen service level — FOREGROUND so the list is active only for the focused app. */
export const SERVICE_LEVEL = 'FOREGROUND';

/**
 * The DEFAULT command list: the transport subset plus the ten digit names, all
 * drawn ONLY from existing `KeyMapping` action names. Each phrase is the
 * action's own display name (`KeyMapping.getDisplayName`) — no forked label
 * table; for digits that display name IS the spoken numeral. Since S535 the
 * digit entries are live: a recognised DIGIT_* lands on the shared
 * digit-commit buffer through the same seam as physical keys (ONE handler).
 */
const VOICE_TRANSPORT_ACTIONS: readonly ActionName[] = [
  'PLAY',
  'PAUSE',
  'STOP',
  'REWIND',
  'FAST_FORWARD',
  'NEXT',
  'PREVIOUS'
];

/** DIGIT_0 … DIGIT_9 — the numeral phrases, from the ONE digit vocabulary. */
const VOICE_DIGIT_ACTIONS: readonly ActionName[] = Array.from(
  { length: 10 },
  (_, n) => `DIGIT_${n}`
);

export const DEFAULT_VOICE_COMMANDS: readonly VoiceCommand[] = [
  ...VOICE_TRANSPORT_ACTIONS,
  ...VOICE_DIGIT_ACTIONS
].map((action) => ({ phrase: KeyMapping.getDisplayName(action), action }));

/** Route a recognised spoken phrase back to its existing ActionName, or null. */
export function phraseToAction(
  phrase: string,
  commands: readonly VoiceCommand[] = DEFAULT_VOICE_COMMANDS
): ActionName | null {
  const hit = commands.find((c) => c.phrase === phrase);
  return hit ? hit.action : null;
}

/**
 * Resolve the platform voice-control API, or `null` when it is unavailable. A
 * non-Tizen webview (browser dev, jsdom), a profile with no voicecontrol feature,
 * and a partially-formed object all land here — the honest no-op (Law 1: guard the
 * absent case first). Never throws: a getter that throws is treated as absent.
 */
export function resolveVoiceControl(tizenLike?: TizenLike | null): VoiceControlLike | null {
  let tizen: TizenLike | undefined;
  try {
    tizen = tizenLike ?? (globalThis as { tizen?: TizenLike }).tizen;
  } catch {
    return null;
  }
  const vc = tizen?.voicecontrol;
  if (
    !vc ||
    typeof vc.setCommandList !== 'function' ||
    typeof vc.removeCommandList !== 'function' ||
    typeof vc.addResultListener !== 'function' ||
    typeof vc.removeResultListener !== 'function'
  ) {
    return null;
  }
  return vc;
}

/**
 * Register the command list + result listener while the app is foregrounded, and
 * return a teardown that releases exactly what this call acquired. Absent API →
 * a silent no-op teardown (identical behaviour pinned). Every platform call is
 * try/caught so a throwing profile can never break the caller's mount lifecycle.
 */
export function registerVoiceCommands(
  onAction: (action: ActionName) => void,
  tizenLike?: TizenLike | null,
  commands: readonly VoiceCommand[] = DEFAULT_VOICE_COMMANDS
): () => void {
  const vc = resolveVoiceControl(tizenLike);
  if (!vc) return () => { return; };

  const phrases = commands.map((c) => c.phrase);
  let serviceId: number | null = null;
  let listenerId: number | null = null;

  try {
    serviceId = vc.setCommandList(
      phrases,
      SERVICE_LEVEL,
      undefined,
      () => {
        /* platform rejects the list on this profile — stay a no-op, never surface. */
      }
    );
  } catch {
    return () => { return; };
  }

  try {
    listenerId = vc.addResultListener((command) => {
      const action = phraseToAction(command, commands);
      if (action) onAction(action);
    });
  } catch {
    // A listener could not be armed; release the command list we did acquire.
    if (serviceId !== null) {
      try { vc.removeCommandList(serviceId); } catch { /* nothing actionable on cleanup */ }
    }
    return () => { return; };
  }

  return () => {
    if (listenerId !== null) {
      try { vc.removeResultListener(listenerId); } catch { /* best-effort teardown */ }
    }
    if (serviceId !== null) {
      try { vc.removeCommandList(serviceId); } catch { /* best-effort teardown */ }
    }
  };
}

/** The mount/unmount lifecycle seams `installVoiceControlRegistration` reads. */
export interface VoiceMountHooks {
  /** A route only needs a `name` (vue-router names are `string | symbol`); we test for `'player'`. */
  getRoute: () => { name?: string | symbol | null } | null;
  router?: {
    afterEach?: (guard: (to: { name?: string | symbol | null }) => void) => () => void;
  } | null;
  tizenLike?: TizenLike | null;
  onAction: (action: ActionName) => void;
  commands?: readonly VoiceCommand[];
}

/**
 * Player-route mount hook: register voice commands when the player mounts,
 * unregister on unmount (a `router.afterEach` leaving `player`). Guarded so it
 * still works against a fake router with no `afterEach`, and so the whole thing
 * is a no-op when `voicecontrol` is absent — the app boots byte-identical.
 * Returns a teardown that unregisters (if registered) and drops the route guard.
 */
export function installVoiceControlRegistration(hooks: VoiceMountHooks): () => void {
  let teardown: (() => void) | null = null;

  const setVoice = (mounted: boolean): void => {
    if (mounted && !teardown) {
      teardown = registerVoiceCommands(hooks.onAction, hooks.tizenLike, hooks.commands);
    } else if (!mounted && teardown) {
      teardown();
      teardown = null;
    }
  };

  setVoice(hooks.getRoute()?.name === 'player');

  const removeGuard =
    hooks.router && typeof hooks.router.afterEach === 'function'
      ? hooks.router.afterEach((to) => setVoice(to?.name === 'player'))
      : undefined;

  return () => {
    removeGuard?.();
    setVoice(false);
  };
}
