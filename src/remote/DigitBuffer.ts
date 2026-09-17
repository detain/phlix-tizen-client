/**
 * Digit-commit buffer (S535 — AD-22).
 *
 * Pure digit queue with a ONE-SHOT timeout drain: consecutive digits join into
 * a single commit — "1-2-3 fast = 123, else 1". Each pushed digit RE-ARMS the
 * one timeout (no early drain); when the window lapses the whole queue drains
 * at once, the buffer is left empty, and the injected `commit(value)` seam
 * fires exactly ONE commit for the burst. A lone digit flushes alone on the
 * same timeout. Zero DOM coupling — timers and strings only, fake-timer
 * testable — mirroring the `backPolicy.ts` / `registerKeys.ts` pure-seam idiom.
 *
 * The findings' 2 s silence window is the shipped constant (CODE WINS re-
 * derivation: no competing value anywhere on tip); the caller injects it in
 * tests. The ONE-buffer law: exactly one instance exists at runtime, owned by
 * the `RemoteManager` singleton, fed by routed keydowns AND recognised numeric
 * voice phrases (S531's coordinate-on-arrival) — never a forked digit path
 * (grep-pinned in the suite).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/** Silence window before a queued digit burst commits as one value (2 s, findings §AD-22). */
export const DIGIT_COMMIT_TIMEOUT_MS = 2000;

/** Exactly one ASCII digit — the sole shape the queue accepts (parse at the boundary). */
const SINGLE_DIGIT = /^[0-9]$/;

/**
 * INPUT types that never receive typed digits on a TV remote path — focus on
 * them does NOT make the element a typing target (a checkbox/radio keeps
 * working while routed digits still reach the buffer).
 */
const NON_TYPING_INPUT_TYPES: ReadonlySet<string> = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit'
]);

/** A `contenteditable` attribute value that makes its element an editing host. */
function contenteditableOpensEditing(element: HTMLElement): boolean {
  const value = element.getAttribute?.('contenteditable');
  return value === '' || value === 'true' || value === 'plaintext-only';
}

/**
 * The typing-target gate behind the "1984" hard law (S535): while an editable
 * INPUT / TEXTAREA / contenteditable subtree holds focus, routed digits stay
 * BYTE-IDENTICAL to the old passthrough — no buffer, no preventDefault — so a
 * search box keeps typing numbers like any other text. Structural (attribute-
 * reading) so it is pure and jsdom-honest; `document` / absent / non-element
 * targets are not typing targets. A readonly/disabled text control cannot
 * receive typed text, so it does NOT gate the buffer either.
 */
export function isTypingTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof (target as HTMLElement).getAttribute !== 'function') return false;
  let node: HTMLElement | null = target as HTMLElement;
  // Walk up to the nearest element that decides editability: an explicit
  // `contenteditable="false"` inside an editing host closes it again.
  while (node) {
    const tag = typeof node.tagName === 'string' ? node.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (node.hasAttribute?.('readonly') || node.hasAttribute?.('disabled')) return false;
      if (tag === 'TEXTAREA') return true;
      const type = (node.getAttribute('type') || 'text').toLowerCase();
      return !NON_TYPING_INPUT_TYPES.has(type);
    }
    if (node.hasAttribute?.('contenteditable')) {
      return contenteditableOpensEditing(node);
    }
    node = node.parentElement;
  }
  return false;
}

/** Create the commit seam; `commit` receives the joined digit string once per drain. */
export interface DigitBufferOptions {
  /** Called with the joined queue (e.g. '123') exactly once when the one-shot lapses. */
  commit: (value: string) => void;
  /** Silence window; defaults to the findings' {@link DIGIT_COMMIT_TIMEOUT_MS}. */
  timeoutMs?: number;
}

/** The shared digit queue surface RemoteManager (and tests) drive. */
export interface DigitBuffer {
  /** Enqueue one digit char and re-arm the one-shot drain (junk chars are refused). */
  push(digit: string): void;
  /** The queued-so-far joined string ('' when idle) — observation only. */
  pending(): string;
  /** Drop the queue + cancel the armed timer WITHOUT committing (teardown). */
  clear(): void;
}

/**
 * Pure factory: no DOM, no globals beyond `setTimeout`, no imports. One
 * armed timer at a time; every push re-arms it; the drain fires exactly one
 * commit per burst and leaves the buffer empty for the next.
 */
export function createDigitBuffer({ commit, timeoutMs = DIGIT_COMMIT_TIMEOUT_MS }: DigitBufferOptions): DigitBuffer {
  let digits = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const drain = (): void => {
    timer = null;
    const value = digits;
    digits = '';
    if (value === '') return; // only ever armed by a real digit; guard for honesty
    commit(value);
  };

  return {
    push(digit: string): void {
      if (!SINGLE_DIGIT.test(digit)) return; // Law 1: refuse anything but one digit char.
      digits += digit;
      if (timer !== null) clearTimeout(timer); // Law 3: re-arm — never an early drain.
      timer = setTimeout(drain, timeoutMs);
    },
    pending(): string {
      return digits;
    },
    clear(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      digits = '';
    }
  };
}
