/**
 * DigitBuffer — digit-commit buffer (S535, AD-22).
 *
 * AC#1: pure fake-timer pins — "1-2-3" → ONE joined commit after the timeout;
 * a lone digit flushes alone; every digit RE-ARMS the one-shot (no early
 * drain); buffer empty after drain; zero DOM coupling (source grep).
 * The typing-target gate (the "1984" hard law) gets its own structural pins,
 * and a one-buffer grep pin proves the tree holds a single digit queue
 * (RemoteManager owns the instance; voice keys in through it — never a fork).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  createDigitBuffer,
  isTypingTarget,
  DIGIT_COMMIT_TIMEOUT_MS
} from '@/remote/DigitBuffer';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Recursively list every .ts/.vue file under a directory (relative paths). */
function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(ts|vue)$/.test(entry)) found.push(path.relative(REPO_ROOT, full));
  }
  return found;
}

describe('DigitBuffer — one-shot drain (AC#1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('joins a fast burst "1-2-3" into ONE commit after the timeout', () => {
    const commit = vi.fn();
    const buffer = createDigitBuffer({ commit });

    buffer.push('1');
    buffer.push('2');
    buffer.push('3');

    vi.advanceTimersByTime(DIGIT_COMMIT_TIMEOUT_MS - 1);
    expect(commit).not.toHaveBeenCalled(); // no early drain
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('123');
    expect(buffer.pending()).toBe(''); // empty after drain
  });

  it('flushes a lone digit alone ("else 1")', () => {
    const commit = vi.fn();
    const buffer = createDigitBuffer({ commit });

    buffer.push('7');
    vi.advanceTimersByTime(DIGIT_COMMIT_TIMEOUT_MS);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('7');
    expect(buffer.pending()).toBe('');
  });

  it('each digit RE-ARMS the one-shot — no drain while digits keep arriving', () => {
    const commit = vi.fn();
    const buffer = createDigitBuffer({ commit });

    buffer.push('1');
    vi.advanceTimersByTime(DIGIT_COMMIT_TIMEOUT_MS - 100);
    buffer.push('2'); // re-arm: the window restarts from here
    vi.advanceTimersByTime(DIGIT_COMMIT_TIMEOUT_MS - 100);
    expect(commit).not.toHaveBeenCalled(); // the FIRST timer was cancelled, not drained
    vi.advanceTimersByTime(100);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('12');
  });

  it('commits exactly ONE timer per burst (re-arm clears, never stacks)', () => {
    const commit = vi.fn();
    const buffer = createDigitBuffer({ commit });
    for (const digit of ['1', '2', '3', '4', '5']) {
      buffer.push(digit);
      vi.advanceTimersByTime(50); // digits inside the window keep re-arming
    }
    vi.advanceTimersByTime(DIGIT_COMMIT_TIMEOUT_MS);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('12345');
  });

  it('a second burst after a drain commits separately (buffer is reusable)', () => {
    const commit = vi.fn();
    const buffer = createDigitBuffer({ commit });

    buffer.push('1');
    vi.advanceTimersByTime(DIGIT_COMMIT_TIMEOUT_MS);
    buffer.push('9');
    buffer.push('8');
    vi.advanceTimersByTime(DIGIT_COMMIT_TIMEOUT_MS);

    expect(commit.mock.calls.map((call) => call[0])).toEqual(['1', '98']);
  });

  it('honours an injected timeoutMs (test seam)', () => {
    const commit = vi.fn();
    const buffer = createDigitBuffer({ commit, timeoutMs: 250 });
    buffer.push('4');
    vi.advanceTimersByTime(249);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledWith('4');
  });

  it('refuses anything but one ASCII digit (parse at the boundary)', () => {
    const commit = vi.fn();
    const buffer = createDigitBuffer({ commit });
    for (const junk of ['', 'a', '12', '7 ', '-5', '٣']) {
      buffer.push(junk);
    }
    vi.advanceTimersByTime(DIGIT_COMMIT_TIMEOUT_MS * 2);
    expect(commit).not.toHaveBeenCalled();
    expect(buffer.pending()).toBe('');
    // '0' IS a digit and must still commit.
    buffer.push('0');
    vi.advanceTimersByTime(DIGIT_COMMIT_TIMEOUT_MS);
    expect(commit).toHaveBeenCalledWith('0');
  });

  it('clear() drops the queue + cancels the armed timer WITHOUT committing', () => {
    const commit = vi.fn();
    const buffer = createDigitBuffer({ commit });
    buffer.push('4');
    buffer.push('2');
    expect(buffer.pending()).toBe('42');

    buffer.clear();
    vi.advanceTimersByTime(DIGIT_COMMIT_TIMEOUT_MS * 2);
    expect(commit).not.toHaveBeenCalled();
    expect(buffer.pending()).toBe('');
  });

  it('clear() on an idle buffer is idempotent (safe teardown)', () => {
    const buffer = createDigitBuffer({ commit: () => { /* noop */ } });
    expect(() => {
      buffer.clear();
      buffer.clear();
    }).not.toThrow();
  });

  it('DIGIT_COMMIT_TIMEOUT_MS is the findings\' 2 s (CODE WINS re-derivation)', () => {
    expect(DIGIT_COMMIT_TIMEOUT_MS).toBe(2000);
  });
});

describe('DigitBuffer — zero DOM coupling (AC#1)', () => {
  it('the module source never touches document/window/focus/selector APIs', () => {
    const src = readFileSync(path.join(REPO_ROOT, 'src/remote/DigitBuffer.ts'), 'utf8');
    expect(/\bdocument\./.test(src)).toBe(false);
    expect(/\bwindow\./.test(src)).toBe(false);
    expect(/querySelector|getElementById|\.focus\(/.test(src)).toBe(false);
  });

  it('a hand-rolled structural target works with NO DOM at all (purity proof)', () => {
    const fakeInput = {
      tagName: 'INPUT',
      hasAttribute: () => false,
      getAttribute: () => null,
      parentElement: null
    };
    expect(isTypingTarget(fakeInput as unknown as EventTarget)).toBe(true);
  });
});

describe('DigitBuffer — isTypingTarget, the "1984" hard gate (AC#2)', () => {
  const el = (html: string): HTMLElement => {
    const holder = document.createElement('div');
    holder.innerHTML = html;
    return holder.firstElementChild as HTMLElement;
  };

  it('editable text controls ARE typing targets', () => {
    expect(isTypingTarget(el('<input type="text">'))).toBe(true);
    expect(isTypingTarget(el('<input type="search">'))).toBe(true);
    expect(isTypingTarget(el('<input type="number">'))).toBe(true);
    expect(isTypingTarget(el('<input>'))).toBe(true); // default type is text
    expect(isTypingTarget(el('<textarea></textarea>'))).toBe(true);
  });

  it('contenteditable hosts and their descendants ARE typing targets', () => {
    const holder = document.createElement('div');
    holder.innerHTML = '<div contenteditable="true"><span id="inner">edit</span></div>';
    const host = holder.querySelector('#inner')!.parentElement as HTMLElement;
    expect(isTypingTarget(host)).toBe(true);
    expect(isTypingTarget(host.querySelector('#inner'))).toBe(true); // inherited
    expect(isTypingTarget(el('<div contenteditable></div>'))).toBe(true); // '' means true
  });

  it('contenteditable="false" inside an editing host CLOSES it again', () => {
    const holder = document.createElement('div');
    holder.innerHTML =
      '<div contenteditable="true"><span contenteditable="false">locked</span></div>';
    const locked = holder.querySelector('[contenteditable="false"]');
    expect(isTypingTarget(locked)).toBe(false);
  });

  it('non-typing controls are NOT typing targets (digits still route)', () => {
    for (const type of ['checkbox', 'radio', 'range', 'button', 'submit', 'hidden', 'file']) {
      expect(isTypingTarget(el(`<input type="${type}">`))).toBe(false);
    }
    expect(isTypingTarget(el('<input type="text" readonly>'))).toBe(false);
    expect(isTypingTarget(el('<input type="text" disabled>'))).toBe(false);
    expect(isTypingTarget(el('<button>Go</button>'))).toBe(false);
    expect(isTypingTarget(el('<div>browse me</div>'))).toBe(false);
  });

  it('absent / non-element targets are NOT typing targets (fake events, document)', () => {
    expect(isTypingTarget(undefined)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(document)).toBe(false); // synthetic gamepad events target document
    expect(isTypingTarget(document.body)).toBe(false);
  });
});

describe('DigitBuffer — ONE buffer in the tree (AC#3 grep pin)', () => {
  it('createDigitBuffer is CALLED exactly once in src (RemoteManager owns it)', () => {
    const definition = 'src/remote/DigitBuffer.ts';
    const callers = sourceFiles(path.join(REPO_ROOT, 'src'))
      .filter((rel) => rel !== definition)
      .filter((rel) => /createDigitBuffer\(/.test(readFileSync(path.join(REPO_ROOT, rel), 'utf8')));
    expect(callers).toEqual(['src/remote/RemoteManager.ts']);
    // Non-vacuous: the definition itself really exports the factory.
    expect(readFileSync(path.join(REPO_ROOT, definition), 'utf8')).toContain(
      'export function createDigitBuffer('
    );
  });

  it('only RemoteManager imports the buffer module anywhere under src', () => {
    const importers = sourceFiles(path.join(REPO_ROOT, 'src')).filter((rel) =>
      /from '[^']*DigitBuffer'/.test(readFileSync(path.join(REPO_ROOT, rel), 'utf8'))
    );
    expect(importers).toEqual(['src/remote/RemoteManager.ts']);
  });
});
