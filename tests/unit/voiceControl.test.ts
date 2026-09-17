/**
 * voiceControl — guarded VoiceControl registration (S531, AD-23).
 *
 * Drives the module against a HAND-BUILT fake `tizen` (the `registerKeys.ts` /
 * `deviceId.ts` idiom), so the platform API contract — FOREGROUND setCommandList on
 * player mount, symmetric teardown, and a SILENT no-op when `voicecontrol` is
 * absent or throws — is pinned without any real device. The mapping group proves
 * every default command reuses an EXISTING ActionName (no forked vocabulary), and
 * the grep group proves the platform voice API is never touched outside this one
 * guarded module. A manifest group re-pins the S503 mask: no voicecontrol feature,
 * config.xml unchanged.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  registerVoiceCommands,
  installVoiceControlRegistration,
  resolveVoiceControl,
  phraseToAction,
  DEFAULT_VOICE_COMMANDS,
  SERVICE_LEVEL
} from '@/voiceControl';
import KeyMapping from '@/remote/KeyMapping';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The complete set of ActionNames the app already knows (from KEY_MAP values). */
const KNOWN_ACTIONS = new Set<string>(Object.values(KeyMapping.KEY_MAP));

/** A controllable fake `tizen.voicecontrol` that records every platform call. */
function fakeVoiceControl() {
  let id = 100;
  let listener: ((command: string) => void) | undefined;
  const svc = {
    setCommandList: vi.fn((_commands: readonly string[], _level: string) => ++id),
    removeCommandList: vi.fn((_serviceId: number) => { /* released */ }),
    addResultListener: vi.fn((l: (command: string) => void) => {
      listener = l;
      return ++id;
    }),
    removeResultListener: vi.fn((_listenerId: number) => { /* released */ })
  };
  return {
    svc,
    get listener() {
      return listener;
    },
    commandsArg: () => svc.setCommandList.mock.calls[0]?.[0] as string[] | undefined,
    levelArg: () => svc.setCommandList.mock.calls[0]?.[1] as string | undefined
  };
}

/** A fake router whose `afterEach` guard the test can fire manually. */
function fakeRouter(initial: { name?: string | symbol | null } = { name: 'player' }) {
  let guard: ((to: { name?: string | symbol | null }) => void) | undefined;
  return {
    route: initial,
    afterEach: vi.fn((g: (to: { name?: string | symbol | null }) => void) => {
      guard = g;
      return () => { guard = undefined; };
    }),
    navigateTo(to: { name?: string | symbol | null }): void {
      guard?.(to);
    }
  };
}

describe('voiceControl — registration lifecycle (AC#1)', () => {
  it('registers a FOREGROUND command list while the player route is mounted', () => {
    const { svc, commandsArg, levelArg } = fakeVoiceControl();
    const router = fakeRouter({ name: 'player' });
    const onAction = vi.fn();

    installVoiceControlRegistration({
      getRoute: () => router.route,
      router,
      tizenLike: { voicecontrol: svc },
      onAction
    });

    expect(svc.setCommandList).toHaveBeenCalledTimes(1);
    expect(levelArg()).toBe(SERVICE_LEVEL);
    expect(levelArg()).toBe('FOREGROUND');
    expect(commandsArg()).toEqual(DEFAULT_VOICE_COMMANDS.map((c) => c.phrase));
    expect(svc.addResultListener).toHaveBeenCalledTimes(1);
  });

  it('unregisters on unmount (route leaves the player) and re-registers on re-entry', () => {
    const { svc } = fakeVoiceControl();
    const router = fakeRouter({ name: 'player' });

    installVoiceControlRegistration({
      getRoute: () => router.route,
      router,
      tizenLike: { voicecontrol: svc },
      onAction: () => { /* noop */ }
    });
    expect(svc.setCommandList).toHaveBeenCalledTimes(1);

    router.navigateTo({ name: 'browse' });
    expect(svc.removeResultListener).toHaveBeenCalledTimes(1);
    expect(svc.removeCommandList).toHaveBeenCalledTimes(1);

    router.navigateTo({ name: 'player' });
    expect(svc.setCommandList).toHaveBeenCalledTimes(2); // fresh registration
  });

  it('the returned teardown releases exactly what was acquired', () => {
    const { svc } = fakeVoiceControl();
    const router = fakeRouter({ name: 'player' });
    const release = installVoiceControlRegistration({
      getRoute: () => router.route,
      router,
      tizenLike: { voicecontrol: svc },
      onAction: () => { /* noop */ }
    });
    release();
    expect(svc.removeCommandList).toHaveBeenCalledTimes(1);
    expect(svc.removeResultListener).toHaveBeenCalledTimes(1);
    expect(router.afterEach).toHaveBeenCalledTimes(1);
  });

  it('does NOT register when the app boots OFF the player route', () => {
    const { svc } = fakeVoiceControl();
    const router = fakeRouter({ name: 'browse' });
    installVoiceControlRegistration({
      getRoute: () => router.route,
      router,
      tizenLike: { voicecontrol: svc },
      onAction: () => { /* noop */ }
    });
    expect(svc.setCommandList).not.toHaveBeenCalled();
    router.navigateTo({ name: 'player' }); // only mounts voice once the player appears
    expect(svc.setCommandList).toHaveBeenCalledTimes(1);
  });
});

describe('voiceControl — silent no-op when voicecontrol is absent/throwing (AC#1)', () => {
  it('absent `tizen` (browser dev / jsdom) → resolveVoiceControl null, register is a no-op', () => {
    expect(resolveVoiceControl(undefined)).toBeNull();
    // no ambient global tizen in jsdom
    expect(resolveVoiceControl(null)).toBeNull();

    const onAction = vi.fn();
    const teardown = registerVoiceCommands(onAction, {}); // tizenLike present, no voicecontrol
    expect(typeof teardown).toBe('function');
    teardown();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('a partially-formed voicecontrol object is treated as absent', () => {
    expect(resolveVoiceControl({ voicecontrol: { setCommandList: () => 1 } as never })).toBeNull();
  });

  it('a voicecontrol whose setCommandList THROWS degrades to a silent no-op, never propagates', () => {
    const svc = {
      setCommandList: vi.fn(() => { throw new Error('not supported on this profile'); }),
      removeCommandList: vi.fn(),
      addResultListener: vi.fn(),
      removeResultListener: vi.fn()
    };
    let threw = false;
    try {
      const teardown = registerVoiceCommands(vi.fn(), { voicecontrol: svc });
      teardown();
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(svc.addResultListener).not.toHaveBeenCalled();
  });

  it('install lifecycle with a throwing platform never throws and stays unregistered', () => {
    const router = fakeRouter({ name: 'player' });
    const svc = {
      setCommandList: vi.fn(() => { throw new Error('boom'); }),
      removeCommandList: vi.fn(),
      addResultListener: vi.fn(() => 1),
      removeResultListener: vi.fn()
    };
    const release = installVoiceControlRegistration({
      getRoute: () => router.route,
      router,
      tizenLike: { voicecontrol: svc },
      onAction: vi.fn()
    });
    expect(svc.addResultListener).not.toHaveBeenCalled(); // registration aborted before the listener
    expect(() => release()).not.toThrow();
  });
});

describe('voiceControl — default commands reuse existing ActionNames (AC#1)', () => {
  it('every default action is an EXISTING KeyMapping action name', () => {
    for (const { action } of DEFAULT_VOICE_COMMANDS) {
      expect(KNOWN_ACTIONS.has(action)).toBe(true);
    }
  });

  it('every phrase is the action name’s OWN display name (no forked label table)', () => {
    for (const { phrase, action } of DEFAULT_VOICE_COMMANDS) {
      expect(phrase).toBe(KeyMapping.getDisplayName(action));
    }
  });

  it('is the transport set PLUS the ten digit phrases — committed, not withheld (S535)', () => {
    // S531's WITHHELD-numeric posture discharged with the AD-22 buffer's arrival:
    // the digits are registered because they now land on the SAME commit handler.
    expect(DEFAULT_VOICE_COMMANDS.length).toBeGreaterThan(0);
    const transport = ['PLAY', 'PAUSE', 'STOP', 'REWIND', 'FAST_FORWARD', 'NEXT', 'PREVIOUS'];
    const digits = Array.from({ length: 10 }, (_, n) => `DIGIT_${n}`);
    expect(DEFAULT_VOICE_COMMANDS.map((c) => c.action)).toEqual([...transport, ...digits]);
    // Every digit action is still a KEY_MAP-existing name and its phrase is the
    // action's OWN display name (the numeral) — no forked label table.
    for (const action of digits) {
      expect(KNOWN_ACTIONS.has(action)).toBe(true);
      expect(KeyMapping.isDigit(action)).toBe(true);
    }
    expect(phraseToAction('4')).toBe('DIGIT_4');
    expect(phraseToAction('0')).toBe('DIGIT_0');
    // Nothing outside transport + digits creeps in (vocabulary stays closed).
    for (const { action } of DEFAULT_VOICE_COMMANDS) {
      expect(transport.includes(action) || digits.includes(action)).toBe(true);
    }
  });

  it('recognised phrase → mapped ActionName reaches onAction; unknown phrase is dropped', () => {
    const voice = fakeVoiceControl();
    const svc = voice.svc;
    const onAction = vi.fn();
    installVoiceControlRegistration({
      getRoute: () => ({ name: 'player' }),
      router: fakeRouter({ name: 'player' }),
      tizenLike: { voicecontrol: svc },
      onAction
    });

    const play = DEFAULT_VOICE_COMMANDS.find((c) => c.action === 'PLAY');
    expect(play).toBeDefined();
    voice.listener?.(play!.phrase);
    expect(onAction).toHaveBeenCalledWith('PLAY');

    onAction.mockClear();
    voice.listener?.('some phrase we never registered');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('a recognised DIGIT phrase is delivered as its DIGIT_* action to the SAME seam (S535)', () => {
    // Same-handler law: voice numerics exit through the one onAction seam as
    // digit action names — production routes them into the shared buffer
    // (tizenBridge.test pins the end-to-end DIGIT_COMMIT; this pins the module).
    const voice = fakeVoiceControl();
    const onAction = vi.fn();
    installVoiceControlRegistration({
      getRoute: () => ({ name: 'player' }),
      router: fakeRouter({ name: 'player' }),
      tizenLike: { voicecontrol: voice.svc },
      onAction
    });
    // The registered phrase list itself contains the ten numerals.
    expect(voice.commandsArg()).toEqual(expect.arrayContaining(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']));

    voice.listener?.('7');
    expect(onAction).toHaveBeenCalledWith('DIGIT_7');
    voice.listener?.('not-a-digit');
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('phraseToAction round-trips every default command and returns null for junk', () => {
    for (const { phrase, action } of DEFAULT_VOICE_COMMANDS) {
      expect(phraseToAction(phrase)).toBe(action);
    }
    expect(phraseToAction('nope')).toBeNull();
  });
});

describe('voiceControl — no voice API outside the guarded module + config mask (AC#2)', () => {
  /** Walk src/**\/*.ts|*.vue (tests excluded) and return matching file/line pairs. */
  function sweep(pattern: RegExp): string[] {
    const hits: string[] = [];
    const dir = path.join(REPO_ROOT, 'src');
    const walk = (d: string): void => {
      for (const entry of readdirSync(d)) {
        const full = path.join(d, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|vue)$/.test(entry) && !/\.test\.(ts|vue)$/.test(entry)) {
          readFileSync(full, 'utf8')
            .split('\n')
            .forEach((line, i) => {
              if (pattern.test(line)) hits.push(`${path.relative(REPO_ROOT, full)}:${i + 1}`);
            });
        }
      }
    };
    walk(dir);
    return hits;
  }

  it('the voicecontrol platform methods appear in NO file but src/voiceControl.ts', () => {
    const offenders = sweep(/\b(setCommandList|removeCommandList|addResultListener|removeResultListener)\b/);
    expect(offenders.filter((h) => !h.startsWith('src/voiceControl.ts'))).toEqual([]);
    expect(offenders.length).toBeGreaterThan(0); // non-vacuous: the guarded module really does call them
  });

  it('the VoiceControl seam is integrated at ONE point — module + its single bridge importer', () => {
    // The module is the only writer of voice commands; the bridge is its only
    // consumer. No screen / store / other bridge wires voicecontrol (AC#2 single-writer).
    const offenders = sweep(/[Vv]oiceControl/);
    const allowed = new Set(['src/voiceControl.ts', 'src/tizenBridge.ts']);
    const files = new Set(offenders.map((h) => h.split(':')[0]));
    expect([...files].filter((f) => !allowed.has(f))).toEqual([]);
    expect(files.has('src/voiceControl.ts')).toBe(true); // non-vacuous
    expect(files.has('src/tizenBridge.ts')).toBe(true); // the sanctioned mount-hook importer
  });

  it('app/config.xml keeps the S503 mask — 2 privileges, no voicecontrol feature (byte-zero posture)', () => {
    const cfgPath = path.join(REPO_ROOT, 'app', 'config.xml');
    expect(existsSync(cfgPath)).toBe(true);
    const xml = readFileSync(cfgPath, 'utf8');
    const privileges = [...xml.matchAll(/tizen:privilege name="([^"]+)"/g)].map((m) => m[1]);
    expect(privileges.sort()).toEqual([
      'http://tizen.org/privilege/internet',
      'http://tizen.org/privilege/tv.inputdevice'
    ]);
    const features = [...xml.matchAll(/<feature name="([^"]+)"/g)].map((m) => m[1]);
    expect(features.some((f) => /voice/i.test(f))).toBe(false);
    expect(features.sort()).toEqual([
      'http://tizen.org/feature/screen.orientation.landscape',
      'http://tizen.org/feature/screen.size.all'
    ]);
  });
});
