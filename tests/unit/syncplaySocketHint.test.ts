/**
 * syncplaySocketHint — review M11: the host half of the @phlix/ui v0.99.13
 * socketHint seam. The bundle reads `window.__PHLIX__.wsUrl/wsPath` at every
 * dial; these pins own the seeding law (host/TLS/port derivation shared with
 * the native lane, plaintext refusal, foreign-field preservation, clear-on-
 * lose-connection) and the byte-identity between the hint-expanded bundle
 * template and the tizen `buildWsUrl` output — the whole point of the seam.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applySyncPlaySocketHint } from '@/syncplaySocketHint';
import { buildWsUrl, syncplaySocketOrigin } from '@/stores/useSyncPlayStore';

/** Mirror of the sealed chunk's direct-lane template (`wsPath ?? ''` half). */
function bundleDirectUrl(room: string): string {
  const hint = globalThis.window.__PHLIX__;
  if (!hint || hint.wsUrl === null || hint.wsUrl === undefined) {
    throw new Error('no hint seeded');
  }
  return `${hint.wsUrl}${hint.wsPath ?? ''}?room=${encodeURIComponent(room)}`;
}

describe('applySyncPlaySocketHint (M11)', () => {
  beforeEach(() => {
    delete globalThis.window.__PHLIX__;
    globalThis.localStorage.removeItem('phlix.syncplayPort');
  });
  afterEach(() => {
    delete globalThis.window.__PHLIX__;
    globalThis.localStorage.removeItem('phlix.syncplayPort');
  });

  it('seeds the https base as wss://host:8097 with a null wsPath', () => {
    const outcome = applySyncPlaySocketHint('https://nas.lan:8096', { allowInsecure: false });
    expect(outcome).toEqual({ seeded: true, wsUrl: 'wss://nas.lan:8097' });
    expect(globalThis.window.__PHLIX__).toEqual({ wsUrl: 'wss://nas.lan:8097', wsPath: null });
  });

  it('the hint through the BUNDLE template equals the tizen buildWsUrl output', () => {
    const apiBase = 'https://tv.example.test:9443';
    applySyncPlaySocketHint(apiBase, { allowInsecure: false });
    // This is the cure itself: the sealed chunk, given the hint, dials the
    // exact URL the native lane dials — not a window.location fiction.
    expect(bundleDirectUrl('ROOM-42')).toBe(
      buildWsUrl(apiBase, 'ROOM-42', false, null),
    );
  });

  it('honors the live phlix.syncplayPort row on the default read path', () => {
    globalThis.localStorage.setItem('phlix.syncplayPort', '18097');
    const outcome = applySyncPlaySocketHint('https://nas.lan', { allowInsecure: false });
    expect(outcome.wsUrl).toBe('wss://nas.lan:18097');
  });

  it('an explicit opts.portOverride wins over the stored row (test seam)', () => {
    globalThis.localStorage.setItem('phlix.syncplayPort', '18097');
    const outcome = applySyncPlaySocketHint('https://nas.lan', {
      allowInsecure: false,
      portOverride: 28097,
    });
    expect(outcome.wsUrl).toBe('wss://nas.lan:28097');
  });

  it('refuses to seed a plaintext base without the hatch — and clears stale hints', () => {
    applySyncPlaySocketHint('https://nas.lan', { allowInsecure: false });
    const outcome = applySyncPlaySocketHint('http://nas.lan', { allowInsecure: false });
    expect(outcome.seeded).toBe(false);
    expect(outcome.reason).toBe('insecure-transport-refused');
    // The M-TIZEN-12 posture: a credential-bearing hint we would refuse to
    // dial ourselves never reaches the bundle.
    expect(globalThis.window.__PHLIX__).toEqual({ wsUrl: null, wsPath: null });
  });

  it('the dev hatch seeds ws:// — the same declared trade the native lane makes', () => {
    const outcome = applySyncPlaySocketHint('http://nas.lan', { allowInsecure: true });
    expect(outcome).toEqual({ seeded: true, wsUrl: 'ws://nas.lan:8097' });
  });

  it('an unparsable base clears the hint and reports honestly', () => {
    applySyncPlaySocketHint('https://nas.lan', { allowInsecure: false });
    const outcome = applySyncPlaySocketHint('not a url', { allowInsecure: false });
    expect(outcome.seeded).toBe(false);
    expect(outcome.reason).toBe('unparsable-base');
    expect(globalThis.window.__PHLIX__?.wsUrl).toBeNull();
  });

  it('null/empty base clears the hint (no server → no door)', () => {
    applySyncPlaySocketHint('https://nas.lan', { allowInsecure: false });
    expect(applySyncPlaySocketHint(null).reason).toBe('no-api-base');
    expect(globalThis.window.__PHLIX__?.wsUrl).toBeNull();
    applySyncPlaySocketHint('https://nas.lan', { allowInsecure: false });
    expect(applySyncPlaySocketHint('').reason).toBe('no-api-base');
    expect(globalThis.window.__PHLIX__?.wsUrl).toBeNull();
  });

  it('foreign __PHLIX__ members survive every write (this module owns two fields)', () => {
    globalThis.window.__PHLIX__ = { app: 'server', apiBase: 'https://x', menu: [] };
    applySyncPlaySocketHint('https://nas.lan', { allowInsecure: false });
    expect(globalThis.window.__PHLIX__).toEqual({
      app: 'server',
      apiBase: 'https://x',
      menu: [],
      wsUrl: 'wss://nas.lan:8097',
      wsPath: null,
    });
    applySyncPlaySocketHint(null);
    expect(globalThis.window.__PHLIX__).toEqual({
      app: 'server',
      apiBase: 'https://x',
      menu: [],
      wsUrl: null,
      wsPath: null,
    });
  });

  it('syncplaySocketOrigin: origin-only shape — no query, no path', () => {
    expect(syncplaySocketOrigin('https://nas.lan:8096', false, null)).toBe('wss://nas.lan:8097');
    expect(syncplaySocketOrigin('not a url', false, null)).toBe('');
    // Delegation law: buildWsUrl IS origin + '?room=' + encoded id, byte-for-byte.
    expect(buildWsUrl('https://nas.lan:8096', 'a b/c', false, 4444)).toBe(
      `${syncplaySocketOrigin('https://nas.lan:8096', false, 4444)}?room=a%20b%2Fc`,
    );
  });
});
