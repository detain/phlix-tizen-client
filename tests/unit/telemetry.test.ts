/**
 * S521 AD-27 — client telemetry consent gate + heartbeat. This is the ALGORITHM
 * test (the seam test is TelemetryConsent.test.ts): it pins that nothing POSTs
 * before an explicit opt-in, the bounded zero-PII payload shape, the stable
 * install identity, the hourly-tick / 24h-throttle cadence, and that EVERY
 * failure is swallowed without a throw or an app-facing effect.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildHeartbeatPayload,
  buildTelemetryDeps,
  CLIENT_VERSION,
  CONSENT_KEY,
  createHeartbeat,
  getConsent,
  HEARTBEAT_MIN_INTERVAL_MS,
  HEARTBEAT_TICK_MS,
  LAST_SENT_KEY,
  setConsent,
  startTelemetry,
  stopTelemetry,
  __resetTelemetryForTests,
  type HeartbeatTransport,
  type TelemetryDeps,
} from '@/telemetry';

// The ApiClient the transport builder constructs — a bare fake so buildTelemetryDeps
// can run without a network. The heartbeat itself is exercised with an injected
// transport, never this one.
vi.mock('@phlix/ui', () => ({
  ApiClient: vi.fn(function () {
    return { post: vi.fn() };
  }),
}));

class FakeStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

class FakeTransport implements HeartbeatTransport {
  posts: { endpoint: string; data: unknown }[] = [];
  behavior: () => Promise<void> = async () => {};
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    this.posts.push({ endpoint, data });
    await this.behavior();
    return {} as T;
  }
  get count(): number {
    return this.posts.length;
  }
}

function makeDeps(over: Partial<TelemetryDeps> = {}) {
  const storage = over.storage ?? new FakeStorage();
  const transport = over.transport ?? new FakeTransport();
  const armed: { fn?: () => void; ms?: number; cancel: number } = { cancel: 0 };
  const deps: TelemetryDeps = {
    transport,
    storage,
    now: over.now ?? (() => 1_700_000_000_000),
    schedule:
      over.schedule ??
      ((fn, ms) => {
        armed.fn = fn;
        armed.ms = ms;
        return () => {
          armed.cancel += 1;
        };
      }),
    instanceId: over.instanceId ?? 'tizen-inst-1',
  };
  return { deps, storage, transport, armed };
}

describe('telemetry — consent gate is default-OFF and hard-gates the network', () => {
  it('getConsent is strictly === "true": unset / empty / garbage / false are all OFF', () => {
    const s = new FakeStorage();
    expect(getConsent(s)).toBe(false); // never written
    s.setItem(CONSENT_KEY, '');
    expect(getConsent(s)).toBe(false);
    s.setItem(CONSENT_KEY, 'yes');
    expect(getConsent(s)).toBe(false);
    s.setItem(CONSENT_KEY, 'false');
    expect(getConsent(s)).toBe(false);
    s.setItem(CONSENT_KEY, 'true');
    expect(getConsent(s)).toBe(true);
  });

  it('NOT consented → tick POSTS NOTHING (zero network before opt-in)', async () => {
    const { deps, transport } = makeDeps();
    const h = createHeartbeat(deps);
    await h.tick();
    expect(transport.count).toBe(0);
  });

  it('consent persists locally and gates the sender once granted', async () => {
    const { deps, storage, transport } = makeDeps();
    setConsent(storage, true);
    expect(storage.getItem(CONSENT_KEY)).toBe('true');
    const h = createHeartbeat(deps);
    await h.tick();
    expect(transport.count).toBe(1);
  });

  it('withdrawal stops the tick: after stop() a still-consented handle sends nothing', async () => {
    const { deps, storage, transport } = makeDeps();
    setConsent(storage, true);
    const h = createHeartbeat(deps);
    h.start();
    await h.tick();
    expect(transport.count).toBe(1);
    h.stop();
    // Clear the throttle stamp so a would-be send is not merely throttled.
    storage.removeItem(LAST_SENT_KEY);
    await h.tick();
    expect(transport.count).toBe(1); // stop() latched — no further traffic.
  });
});

describe('telemetry — bounded, zero-PII payload on the existing route', () => {
  it('posts the snake_case bounded set to the live telemetry route', async () => {
    const { deps, storage, transport } = makeDeps();
    setConsent(storage, true);
    const h = createHeartbeat(deps);
    await h.tick();
    expect(transport.posts[0].endpoint).toBe('/api/v1/telemetry/heartbeat');
    expect(transport.posts[0].data).toEqual({
      instance_id: 'tizen-inst-1',
      version: CLIENT_VERSION,
      client_type: 'samsung-tizen',
      platform: 'tizen',
      build: CLIENT_VERSION,
    });
  });

  it('buildHeartbeatPayload carries ONLY the bounded fields — zero PII, no server→hub HeartbeatDto keys', () => {
    const p = buildHeartbeatPayload('inst-x');
    expect(Object.keys(p).sort()).toEqual(['build', 'client_type', 'instance_id', 'platform', 'version']);
    // The forbidden server→hub DTO surface must be entirely absent.
    for (const hubKey of ['libraries', 'hostnames', 'uptime', 'server_id', 'timestamp', 'version_major']) {
      expect(p).not.toHaveProperty(hubKey);
    }
  });

  it('instance_id is stable per install via the deviceId seam (no second identity)', () => {
    const s = new FakeStorage();
    const a = buildTelemetryDeps({ storage: s, baseUrl: 'http://tv:8096' });
    const b = buildTelemetryDeps({ storage: s, baseUrl: 'http://tv:8096' });
    expect(a.instanceId).toBe(b.instanceId);
    expect(a.instanceId).toMatch(/^tizen-/); // the deviceId.ts shape
  });
});

describe('telemetry — hourly tick + 24h throttle + swallowed failures', () => {
  it('start() arms an hourly timer', () => {
    const { deps, armed } = makeDeps();
    const h = createHeartbeat(deps);
    h.start();
    expect(armed.ms).toBe(HEARTBEAT_TICK_MS);
    expect(HEARTBEAT_TICK_MS).toBe(3_600_000);
  });

  it('throttles: two ticks inside 24h POST once; a tick past the window POSTs again', async () => {
    let now = 1_700_000_000_000;
    const { deps, transport } = makeDeps({ now: () => now });
    (deps.storage as FakeStorage).setItem(CONSENT_KEY, 'true');
    const h = createHeartbeat(deps);
    await h.tick();
    expect(transport.count).toBe(1);
    await h.tick(); // same instant → throttled
    expect(transport.count).toBe(1);
    now += HEARTBEAT_MIN_INTERVAL_MS - 1000; // just inside the window
    await h.tick();
    expect(transport.count).toBe(1);
    now += 2000; // now past 24h
    await h.tick();
    expect(transport.count).toBe(2);
    expect(HEARTBEAT_MIN_INTERVAL_MS).toBe(86_400_000);
  });

  it('swallows a rejecting transport — no throw, throttle stamp NOT advanced (retry next tick)', async () => {
    const { deps, storage, transport } = makeDeps();
    (storage as FakeStorage).setItem(CONSENT_KEY, 'true');
    transport.behavior = async () => {
      throw new Error('network down');
    };
    const h = createHeartbeat(deps);
    await expect(h.tick()).resolves.toBeUndefined();
    expect(storage.getItem(LAST_SENT_KEY)).toBeNull(); // stamp not advanced
    // next tick retries (still un-throttled because no success was recorded)
    await h.tick();
    expect(transport.count).toBe(2);
  });

  it('swallows a timeout and a 500 identically — the app is never touched', async () => {
    const { deps, storage, transport } = makeDeps();
    (storage as FakeStorage).setItem(CONSENT_KEY, 'true');
    const timeout = Object.assign(new Error('aborted'), { name: 'TimeoutError' });
    transport.behavior = () => Promise.reject(timeout);
    const h = createHeartbeat(deps);
    await expect(h.tick()).resolves.toBeUndefined();
    transport.behavior = () => Promise.reject(new Error('HTTP 500'));
    await expect(h.tick()).resolves.toBeUndefined();
    expect(storage.getItem(LAST_SENT_KEY)).toBeNull();
  });

  it('a successful send advances ONLY the throttle stamp (never a consent flip)', async () => {
    const { deps, storage } = makeDeps();
    (storage as FakeStorage).setItem(CONSENT_KEY, 'true');
    const h = createHeartbeat(deps);
    await h.tick();
    expect(storage.getItem(LAST_SENT_KEY)).toBe('1700000000000');
    expect(getConsent(storage)).toBe(true); // consent untouched by a send
  });
});

describe('telemetry — module singleton is idempotent and withdrawal-honest', () => {
  beforeEach(() => __resetTelemetryForTests());

  it('setConsent(false) clears the last-sent stamp (no inherited throttle, no local history)', () => {
    const s = new FakeStorage();
    s.setItem(CONSENT_KEY, 'true');
    s.setItem(LAST_SENT_KEY, '123');
    setConsent(s, false);
    expect(s.getItem(CONSENT_KEY)).toBe('false');
    expect(s.getItem(LAST_SENT_KEY)).toBeNull();
  });

  it('startTelemetry is idempotent — a second call reuses the one sender', async () => {
    const first = makeDeps();
    (first.storage as FakeStorage).setItem(CONSENT_KEY, 'true');
    const h1 = startTelemetry(first.deps);
    const second = makeDeps();
    const h2 = startTelemetry(second.deps);
    expect(h2).toBe(h1); // same handle, no second timer armed
    // The first deps' transport is the live one; the second never POSTs.
    await h1.tick();
    expect((first.transport as FakeTransport).count).toBe(1);
    expect((second.transport as FakeTransport).count).toBe(0);
    stopTelemetry();
    __resetTelemetryForTests();
  });
});
