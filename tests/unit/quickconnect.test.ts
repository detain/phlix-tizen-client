/**
 * S520 — quick-connect pairing transport + session unit tests (TV/client half).
 *
 * Pinned with injected fetch fakes (never network): the happy path lands a token
 * pair through the injected `applyTokens` seam, an invisible surface issues ZERO
 * status requests, transient faults back off exponentially and stop rather than
 * hammer, and denied/expired/abandoned resolve calm non-fatal phases without
 * throwing. The transport tests lock the exact served path shapes so a drift off
 * the 410-tuple manifest is caught here too.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  QuickConnectProtocolError,
  fetchPairingStatus,
  initiatePairing,
  redeemPairingToken,
} from '@/quickconnect/quickConnectClient';
import { createPairingSession, type PairingPhase } from '@/quickconnect/quickConnectSession';

// ── a fake transport that records every wire call and returns queued bodies ──

interface Call {
  method: 'GET' | 'POST';
  endpoint: string;
  data?: unknown;
}

class FakeTransport {
  readonly calls: Call[] = [];
  private readonly queue: Array<unknown | Error> = [];

  respond(...bodies: Array<unknown | Error>): this {
    this.queue.push(...bodies);
    return this;
  }

  get(endpoint: string, _params?: Record<string, string>): Promise<unknown> {
    this.calls.push({ method: 'GET', endpoint });
    return this.settle(endpoint);
  }

  post(endpoint: string, data?: unknown): Promise<unknown> {
    this.calls.push({ method: 'POST', endpoint, data });
    return this.settle(endpoint);
  }

  private settle(endpoint: string): Promise<unknown> {
    if (this.queue.length === 0) throw new Error(`FakeTransport: unexpected call to ${endpoint}`);
    const next = this.queue.shift() as unknown;
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('quickConnectClient — transport', () => {
  it('initiate POSTs the served route with identity and parses a camel-safe code', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', interval: 7, expires_at: 1_800_000_000 });
    const offer = await initiatePairing(client, { deviceName: 'Phlix for Samsung TV', deviceType: 'samsung-tizen' });
    expect(client.calls).toEqual([
      { method: 'POST', endpoint: '/api/v1/auth/quick-connect/initiate', data: { deviceName: 'Phlix for Samsung TV', deviceType: 'samsung-tizen' } },
    ]);
    expect(offer).toEqual({ code: 'ABCD-1234', intervalSeconds: 7, expiresAtSeconds: 1_800_000_000 });
  });

  it('initiate accepts documented field aliases and defaults when absent', async () => {
    const client = new FakeTransport();
    client.respond({ user_code: 'WXYZ-9999' });
    const offer = await initiatePairing(client, { deviceName: 'x', deviceType: 'y' });
    expect(offer.code).toBe('WXYZ-9999');
    expect(offer.intervalSeconds).toBeNull();
    expect(offer.expiresAtSeconds).toBeNull();
  });

  it('initiate fails FAST (protocol error) on a body with no code', async () => {
    const client = new FakeTransport();
    client.respond({ message: 'nope' });
    await expect(initiatePairing(client, { deviceName: 'x', deviceType: 'y' })).rejects.toBeInstanceOf(QuickConnectProtocolError);
  });

  it('status GETs the {code}/status path segment and normalises the closed set', async () => {
    const cases: Array<[string, string]> = [
      ['pending', 'pending'],
      ['approved', 'approved'],
      ['denied', 'denied'],
      ['expired', 'expired'],
      ['gibberish', 'unknown'],
    ];
    for (const [raw, expected] of cases) {
      const client = new FakeTransport();
      client.respond({ status: raw });
      await expect(fetchPairingStatus(client, 'ABCD')).resolves.toBe(expected);
      expect(client.calls[0]).toEqual({ method: 'GET', endpoint: '/api/v1/auth/quick-connect/ABCD/status' });
    }
  });

  it('status url-encodes the code into the path segment', async () => {
    const client = new FakeTransport();
    client.respond({ status: 'pending' });
    await fetchPairingStatus(client, 'a b');
    expect(client.calls[0].endpoint).toBe('/api/v1/auth/quick-connect/a%20b/status');
  });

  it('token redeems via POST and returns the camelCase pair', async () => {
    const client = new FakeTransport();
    client.respond({ access_token: 'acc', refresh_token: 'ref' });
    await expect(redeemPairingToken(client, 'ABCD')).resolves.toEqual({ accessToken: 'acc', refreshToken: 'ref' });
    expect(client.calls[0]).toEqual({ method: 'POST', endpoint: '/api/v1/auth/quick-connect/ABCD/token', data: {} });
  });

  it('token fails FAST on an incomplete pair', async () => {
    const client = new FakeTransport();
    client.respond({ access_token: 'acc' });
    await expect(redeemPairingToken(client, 'ABCD')).rejects.toBeInstanceOf(QuickConnectProtocolError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A sleep that resolves immediately, records each delay, and can abort a runaway
// loop after a bounded number of waits so a "never-visible" case terminates.
function harness(
  client: FakeTransport,
  overrides: Partial<Parameters<typeof createPairingSession>[0]> = {},
) {
  const phases: PairingPhase[] = [];
  const codes: string[] = [];
  const applied: Array<{ accessToken: string; refreshToken: string }> = [];
  let applyTokensImpl: ((tokens: { accessToken: string; refreshToken: string }) => void) | undefined;

  const delays: number[] = [];
  let budget = Number.POSITIVE_INFINITY;
  const stopper: { fn: () => void } = { fn: () => {} };
  const sleep = (ms: number): Promise<void> => {
    delays.push(ms);
    if (delays.length > budget) stopper.fn();
    return Promise.resolve();
  };
  const sleeper = { delays, stopAfter: (n: number) => (budget = n) };

  const session = createPairingSession({
    client,
    identity: { deviceName: 'tv', deviceType: 'samsung-tizen' },
    isVisible: () => true,
    applyTokens: (tokens) => {
      applied.push(tokens);
      applyTokensImpl?.(tokens);
    },
    onCode: (code) => codes.push(code),
    onStatusChange: (phase) => phases.push(phase),
    sleep,
    ...overrides,
  });
  // Wired AFTER construction so the bounded-sleep abort cancels the live session.
  stopper.fn = () => session.stop();

  return {
    session,
    phases,
    codes,
    applied,
    sleeper,
    setApplyTokens: (fn: typeof applyTokensImpl) => (applyTokensImpl = fn),
  };
}

describe('quickConnectSession — orchestrator', () => {
  it('HAPPY PATH end-to-end: initiate → code → pending → approved → redeem → applyTokens', async () => {
    const client = new FakeTransport();
    client.respond(
      { code: 'ABCD-1234', interval: 2 }, // initiate
      { status: 'pending' }, // poll 1
      { status: 'approved' }, // poll 2
      { access_token: 'acc', refresh_token: 'ref' }, // redeem
    );
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('approved');

    expect(h.codes).toEqual(['ABCD-1234']);
    expect(h.applied).toEqual([{ accessToken: 'acc', refreshToken: 'ref' }]);
    expect(h.phases).toEqual(['initiating', 'pairing', 'approved']);
    // The poll cadence used the server-published interval (2 s → 2000 ms).
    expect(h.sleeper.delays).toContain(2_000);
    expect(client.calls.map((c) => c.endpoint)).toEqual([
      '/api/v1/auth/quick-connect/initiate',
      '/api/v1/auth/quick-connect/ABCD-1234/status',
      '/api/v1/auth/quick-connect/ABCD-1234/status',
      '/api/v1/auth/quick-connect/ABCD-1234/token',
    ]);
  });

  it('an INVISIBLE surface issues ZERO status requests and stays quiet', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', interval: 1 });
    // Every subsequent GET would hit the fake's empty queue → throw; none may occur.
    const h = harness(client, { isVisible: () => false });
    h.sleeper.stopAfter(5); // after 5 hidden re-checks, abort so the loop ends.
    await expect(h.session.run()).resolves.toBe('abandoned');

    expect(client.calls.filter((c) => c.endpoint.endsWith('/status'))).toHaveLength(0);
    expect(h.applied).toHaveLength(0);
  });

  it('transient faults back off exponentially against the base cadence', async () => {
    const client = new FakeTransport();
    client.respond(
      { code: 'ABCD-1234', interval: 1 }, // initiate (base 1000 ms)
      new Error('network'), // poll 1 fails
      new Error('network'), // poll 2 fails
      { status: 'approved' }, // poll 3 succeeds
      { access_token: 'a', refresh_token: 'r' }, // redeem
    );
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('approved');
    // 1st error → 1000ms, 2nd error → 2000ms (base * 2^(n-1)); success path then polls on.
    expect(h.sleeper.delays.slice(0, 2)).toEqual([1_000, 2_000]);
  });

  it('stops hammering after the error budget is exhausted (non-fatal error phase)', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', interval: 1 }); // initiate ok
    for (let i = 0; i < 10; i += 1) client.respond(new Error('down'));
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('error');
    // Exactly the tolerated count of status attempts, never unbounded.
    expect(client.calls.filter((c) => c.endpoint.endsWith('/status'))).toHaveLength(6);
    expect(h.phases).toContain('error');
  });

  it('denied is a calm terminal phase — no redeem, no tokens, no throw', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', interval: 1 }, { status: 'denied' });
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('denied');
    expect(h.applied).toHaveLength(0);
    expect(client.calls.some((c) => c.endpoint.endsWith('/token'))).toBe(false);
  });

  it('expired is a calm terminal phase', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', interval: 1 }, { status: 'expired' });
    await expect(harness(client).session.run()).resolves.toBe('expired');
  });

  it('stop() during a pending wait abandons the session', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', interval: 1 }, ...Array.from({ length: 8 }, () => ({ status: 'pending' })));
    const h = harness(client);
    h.sleeper.stopAfter(3); // pending polls keep looping; after 3 sleeps the abort fires stop()
    await expect(h.session.run()).resolves.toBe('abandoned');
    expect(h.applied).toHaveLength(0);
  });

  it('a redeem protocol failure after approval resolves error (never throws out)', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', interval: 1 }, { status: 'approved' }, { message: 'malformed' });
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('error');
    expect(h.applied).toHaveLength(0);
  });

  it('intervalSeconds override wins over the server-published interval', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', interval: 9 }, { status: 'approved' }, { access_token: 'a', refresh_token: 'r' });
    const h = harness(client, { intervalSeconds: 3 });
    await h.session.run();
    // base comes from the override (3 s), not the server's 9.
    expect(h.sleeper.delays).not.toContain(9_000);
  });

  it('DEFAULT cadence is the exported fallback', () => {
    expect(DEFAULT_POLL_INTERVAL_SECONDS).toBeGreaterThan(0);
  });
});
