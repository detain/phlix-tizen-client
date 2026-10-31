/**
 * mediaActivity.test — M-TIZEN-30 (W-min170), the sealed-music playback probe.
 *
 * Pins the three laws of the probe:
 *  1. OBSERVER-ONLY: elements created through the decorated constructor are
 *     genuine native HTMLAudioElements (prototype identity, real behavior
 *     untouched) and un-instrumented consumers cannot notice.
 *  2. THE STATE MACHINE: play/playing set live; pause/ended/close/emptied
 *     clear it; hasActiveAudioPlayback is the only read side.
 *  3. RETIREMENT WATCH: the vendored bundle still constructs music audio via
 *     global `new Audio(` — if a ui re-pin MOVES that construction (e.g. to
 *     document.createElement('audio'), which is NOT decorated), this pin
 *     reddens and the probe must be re-derived (docs/ui-port-divergence law).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { installMediaActivityProbe, hasActiveAudioPlayback } from '@/mediaActivity';

const REPO = path.resolve(__dirname, '..', '..');

describe('mediaActivity — the boot audio probe (M-TIZEN-30)', () => {
  let teardown: (() => void) | null = null;

  afterEach(() => {
    teardown?.();
    teardown = null;
    expect(hasActiveAudioPlayback()).toBe(false);
  });

  it('idle registry: nothing has ever played', () => {
    teardown = installMediaActivityProbe();
    expect(hasActiveAudioPlayback()).toBe(false);
  });

  it('decorated elements stay genuine native HTMLAudioElements (observer-only)', () => {
    teardown = installMediaActivityProbe();
    const el = new Audio();
    expect(el).toBeInstanceOf(HTMLAudioElement);
    expect(Object.getPrototypeOf(el)).toBe(Audio.prototype);
    // Pre-existing properties untouched — the decoration is construction-only:
    expect(typeof el.addEventListener).toBe('function');
    expect(el.paused).toBe(true);
  });

  it('play sets the live flag; pause, ended, emptied and close clear it', () => {
    teardown = installMediaActivityProbe();
    const el = new Audio();

    el.dispatchEvent(new Event('play'));
    expect(hasActiveAudioPlayback()).toBe(true);

    el.dispatchEvent(new Event('pause'));
    expect(hasActiveAudioPlayback()).toBe(false);

    el.dispatchEvent(new Event('playing'));
    expect(hasActiveAudioPlayback()).toBe(true);

    el.dispatchEvent(new Event('ended'));
    expect(hasActiveAudioPlayback()).toBe(false);

    el.dispatchEvent(new Event('play'));
    el.dispatchEvent(new Event('emptied'));
    expect(hasActiveAudioPlayback()).toBe(false);

    el.dispatchEvent(new Event('play'));
    el.dispatchEvent(new Event('close'));
    expect(hasActiveAudioPlayback()).toBe(false);
  });

  it('two elements, one playing, is playback; stopping the live one ends it', () => {
    teardown = installMediaActivityProbe();
    const a = new Audio();
    const b = new Audio();
    a.dispatchEvent(new Event('play'));
    expect(hasActiveAudioPlayback()).toBe(true);
    b.dispatchEvent(new Event('play'));
    a.dispatchEvent(new Event('pause'));
    expect(hasActiveAudioPlayback()).toBe(true);
    b.dispatchEvent(new Event('pause'));
    expect(hasActiveAudioPlayback()).toBe(false);
  });

  it('teardown restores the native constructor and clears the registry', () => {
    const nativeAudio = globalThis.Audio;
    teardown = installMediaActivityProbe();
    expect(globalThis.Audio).not.toBe(nativeAudio);
    const el = new Audio();
    el.dispatchEvent(new Event('play'));
    expect(hasActiveAudioPlayback()).toBe(true);

    teardown();
    teardown = null;
    expect(globalThis.Audio).toBe(nativeAudio);
    expect(hasActiveAudioPlayback()).toBe(false);

    // Post-teardown construction is invisible (undecorated path):
    const late = new Audio();
    late.dispatchEvent(new Event('play'));
    expect(hasActiveAudioPlayback()).toBe(false);
  });

  it('install is idempotent; the second teardown is a no-op (boot never double-mounts)', () => {
    const first = installMediaActivityProbe();
    const decorated = globalThis.Audio;
    const second = installMediaActivityProbe();
    expect(globalThis.Audio).toBe(decorated);
    second(); // documented no-op
    expect(globalThis.Audio).toBe(decorated);
    first();
  });

  it('RETIREMENT WATCH: the vendored music chunk still constructs global `new Audio(`', () => {
    // If a ui re-pin changes the construction site, the probe is blind and
    // must be re-derived — this pin turns that from a silent regression into
    // a red test with a pointer (mediaActivity.ts header + the divergence
    // ledger row).
    const assets = readdirSync(path.join(REPO, 'package', 'assets'));
    const musicChunks = assets.filter((f) => /^Music.*\.js$/.test(f));
    expect(musicChunks.length, 'expected a vendored Music* page chunk in package/assets').toBeGreaterThan(0);
    const total = musicChunks.reduce((acc, f) => {
      const source = readFileSync(path.join(REPO, 'package', 'assets', f), 'utf8');
      // `new Audio` — the minifier may drop the parens (verified: the vendored
      // factory reads `let a=new Audio;return …`). Match the construction, not
      // one spelling of it.
      return acc + (source.match(/\bnew\s+Audio\b/g) ?? []).length;
    }, 0);
    expect(total, 'probe premise: ui music builds audio via global new Audio(').toBeGreaterThan(0);
  });
});
