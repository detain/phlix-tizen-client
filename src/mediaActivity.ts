/**
 * mediaActivity — host-side observability of SEALED-BUNDLE media playback.
 *
 * WHY THIS EXISTS (M-TIZEN-30 / review tizen__gameux m1): the screensaver's
 * "active playback IS continuous activity" law (src/screensaver.ts) could only
 * ever see VIDEO playback, because its signal is `usePlayerStore().playing` —
 * and music playback in @phlix/ui (v0.99.10 pin) lives in the `useMusicPlayer`
 * composable as PAGE-INSTANCE-LOCAL refs driving detached `new Audio()`
 * elements. The composable is not exported from the ui barrel, its elements are
 * not in the document (media events on a detached element never traverse the
 * document capture path, so a document-level listener cannot see them), and the
 * music path sets no `navigator.mediaSession` state. Net effect at tip: a
 * viewer leaving a track playing on the music surface got the screensaver
 * dimming to "Phlix — press any key" OVER LIVE AUDIO — a wrong-behavior the
 * review caught cold.
 *
 * THE CURE SHAPE: an OBSERVER-ONLY decoration of the global `Audio`
 * constructor, installed at boot BEFORE the app (and therefore before any
 * lazy ui chunk) runs. Every element the ui creates is appended to a bounded
 * registry and watched via `play`/`pause`/`ended`/`emptied` listeners ON THE
 * ELEMENT (the only channel a detached element has). Nothing is intercepted:
 * the returned element is byte-for-byte the native one, properties untouched,
 * and un-decorated consumers cannot tell the difference (prototype identity is
 * preserved). This mirrors the repo's existing boot-observation precedents
 * (installRuntimeFailureCapture wraps error handlers; gamepadBridge synthesizes
 * key events) — host-side seams for surfaces the sealed bundle cannot export.
 *
 * RETIREMENT (ledger law): this probe exists because the bundle cannot tell us
 * "music is playing". A docs/ui-port-divergence.md row names the upstream seam
 * (ui exporting music playback state — mediaSession for the music path, or a
 * store on the shared pinia — would make this file DELETE-BY-REMOVAL at the
 * next re-pin). Until then, a ui re-pin that MOVES the `new Audio(` construction
 * (e.g. to `document.createElement('audio')`) reddens the probe's own
 * reappearance pin in tests/unit/mediaActivity.test.ts, and the re-pin lane
 * re-derives here.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

type MediaStateListener = (event: Event) => void;

/**
 * One observed element. WeakRef keeps the registry from being a leak: the ui
 * disposes page instances (routes unmount, `dispose()` pauses + clears src),
 * and dead refs are swept on every read.
 */
interface ProbeEntry {
  ref: WeakRef<HTMLAudioElement>;
  live: boolean;
}

const NATIVE = globalThis.Audio;

/** Candidate elements ever seen; `live` is the event-tracked play verdict. */
const entries: ProbeEntry[] = [];

let originalAudio: typeof globalThis.Audio | null = null;

function track(el: HTMLAudioElement): void {
  const entry: ProbeEntry = { ref: new WeakRef(el), live: false };
  entries.push(entry);
  const setState = (live: boolean): MediaStateListener => () => {
    entry.live = live;
  };
  const onPlay = setState(true);
  const onStop = setState(false);
  el.addEventListener('play', onPlay);
  el.addEventListener('playing', onPlay);
  el.addEventListener('pause', onStop);
  el.addEventListener('ended', onStop);
  el.addEventListener('close', onStop);
  el.addEventListener('emptied', onStop);
}

function decoratedAudio(this: unknown, ...args: ConstructorParameters<typeof globalThis.Audio>): HTMLAudioElement {
  const el = new NATIVE(...args);
  track(el);
  return el;
}
decoratedAudio.prototype = NATIVE.prototype;

/**
 * Install the probe. Idempotent; returns a teardown that restores the native
 * constructor and clears the registry (test harness use; boot never calls it —
 * the widget has one boot).
 */
export function installMediaActivityProbe(): () => void {
  if (originalAudio !== null) {
    return () => undefined;
  }
  originalAudio = globalThis.Audio;
  globalThis.Audio = decoratedAudio as unknown as typeof globalThis.Audio;
  return () => {
    if (originalAudio !== null) {
      globalThis.Audio = originalAudio;
      originalAudio = null;
    }
    entries.length = 0;
  };
}

/**
 * True iff at least one OBSERVED audio element currently reports playing.
 * Sweeps dead WeakRefs on every read (bounded work: the registry is written
 * only by construction sites, and ui creates two elements per music page
 * instance at most, each page being lazy-mounted).
 */
export function hasActiveAudioPlayback(): boolean {
  let anyLive = false;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const el = entries[i].ref.deref();
    if (el === undefined) {
      entries.splice(i, 1);
      continue;
    }
    if (entries[i].live) {
      anyLive = true;
    }
  }
  return anyLive;
}
