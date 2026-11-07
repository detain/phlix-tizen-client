/**
 * S520 — quick-connect pairing transport + session unit tests (TV/client half).
 *
 * Pinned with injected fetch fakes (never network): the happy path lands a token
 * pair through the injected `applyTokens` seam, an invisible surface issues ZERO
 * status requests, transient faults back off exponentially and stop rather than
 * hammer, and denied/expired/abandoned resolve calm non-fatal phases without
 * throwing. The transport tests lock the exact served path shapes so a drift off
 * the 415-tuple manifest is caught here too.
 *
 * RT-058 cure (w08-L4 adversarial review): the fakes speak the SERVER'S wire,
 * not a wish. `initiate` answers carry the 43-char base64url pairing secret the
 * shipped controller really mints (`QuickConnectController.php:183-187`),
 * `initiatePairing` fails loud without it, and every redeem pins the body
 * `{secret}` that `token()` demands before it consults a pairing at all
 * (`:300-303`) — the pre-cure empty body draws 400 "secret is required" from the
 * real server on EVERY call, so a fantasy-wire fake here would pin nothing but
 * the bug. One pin is source-grepped: the module's posture note must never
 * re-certify the retired "the code is the sole redeem secret" claim.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  QuickConnectProtocolError,
  fetchPairingStatus,
  initiatePairing,
  redeemPairingToken,
  type PairingOffer,
} from '@/quickconnect/quickConnectClient';
import { createPairingSession, type PairingPhase } from '@/quickconnect/quickConnectSession';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * A source file flattened to prose: comment stars, indentation and line breaks
 * collapse to single spaces, so a claim wrapped across a JSDoc line still
 * matches a whole-phrase grep. The RT-058 myth survived literal greps precisely
 * because it sits on a comment break.
 */
function proseOf(file: string): string {
  return readFileSync(path.join(REPO_ROOT, file), 'utf8')
    .replace(/[\s*/-]+/g, ' ')
    .trim();
}

/**
 * What the server actually hands the TV at initiate: 32 random bytes, base64url
 * unpadded, 43 chars (`QuickConnectStateStore.php:389-391`, pinned by its own
 * suite at `:60-64`). Not the 6-letter human code — the code routes, this redeems.
 */
const PAIRING_SECRET = '2kPLRlAvgL6tr4knlXnxnx43fFG8Dy3hB93C9XNGivc';

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

  get<T = unknown>(endpoint: string, _params?: Record<string, string>): Promise<T> {
    this.calls.push({ method: 'GET', endpoint });
    return this.settle(endpoint) as Promise<T>;
  }

  post<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    this.calls.push({ method: 'POST', endpoint, data });
    return this.settle(endpoint) as Promise<T>;
  }

  private settle(endpoint: string): Promise<unknown> {
    if (this.queue.length === 0) throw new Error(`FakeTransport: unexpected call to ${endpoint}`);
    const next = this.queue.shift() as unknown;
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
/** An offer exactly as `initiatePairing` hands it on — the ONLY thing redeem may be given. */
function offer(code = 'ABCD-1234', secret = PAIRING_SECRET): PairingOffer {
  return { code, secret, intervalSeconds: null, expiresAtSeconds: null };
}

describe('quickConnectClient — transport', () => {
  it('initiate POSTs the served route with identity and parses the code + secret pair', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 7, expires_at: 1_800_000_000 });
    const offer = await initiatePairing(client, { deviceName: 'Phlix for Samsung TV', deviceType: 'samsung-tizen' });
    expect(client.calls).toEqual([
      { method: 'POST', endpoint: '/api/v1/auth/quick-connect/initiate', data: { deviceName: 'Phlix for Samsung TV', deviceType: 'samsung-tizen' } },
    ]);
    expect(offer).toEqual({
      code: 'ABCD-1234',
      secret: PAIRING_SECRET,
      intervalSeconds: 7,
      expiresAtSeconds: 1_800_000_000,
    });
  });

  // RT-058: the shipped controller's literal answer shape, byte-for-byte the
  // keys at QuickConnectController.php:183-187. The secret is NOT optional and
  // NOT derived from the code — a client that drops it cannot ever redeem.
  it('initiate parses the REAL server answer {code, secret, expiresIn} and keeps its secret', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'QKTVWA', secret: PAIRING_SECRET, expiresIn: 600 });
    const offer = await initiatePairing(client, { deviceName: 'tv', deviceType: 'samsung-tizen' });
    expect(offer.code).toBe('QKTVWA');
    expect(offer.secret).toBe(PAIRING_SECRET);
    expect(offer.secret).not.toBe(offer.code);
  });

  it('initiate accepts documented field aliases and defaults when absent', async () => {
    const client = new FakeTransport();
    client.respond({ user_code: 'WXYZ-9999', secret: PAIRING_SECRET });
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

  // RT-058: an initiate that carries no usable secret is a DEAD pairing — the
  // redeem would 400 forever. Failing at the boundary beats a doomed poll loop.
  // The client's bar is the server's own shape guard (`is_string && !== ''`,
  // QuickConnectController.php:302) — content is the server's to compare.
  it('initiate fails FAST when the body carries no usable pairing secret', async () => {
    for (const secret of [undefined, '', 42, null, {}]) {
      const client = new FakeTransport();
      client.respond({ code: 'ABCDEF', ...(secret === undefined ? {} : { secret }) });
      await expect(
        initiatePairing(client, { deviceName: 'x', deviceType: 'y' })
      ).rejects.toBeInstanceOf(QuickConnectProtocolError);
    }
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

  // RT-058 — THE wire truth. `token()` reads the secret from the BODY and answers
  // 400 "secret is required" for anything else (QuickConnectController.php:300-303)
  // BEFORE it consults the pairing. The empty body this client shipped pre-cure
  // therefore never redeemed anything, on any server version (S518-era to today).
  it('token redeems via POST carrying {secret} in the body and returns the camelCase pair', async () => {
    const client = new FakeTransport();
    client.respond({ access_token: 'acc', refresh_token: 'ref' });
    await expect(redeemPairingToken(client, offer())).resolves.toEqual({
      accessToken: 'acc',
      refreshToken: 'ref',
    });
    expect(client.calls[0]).toEqual({
      method: 'POST',
      endpoint: '/api/v1/auth/quick-connect/ABCD-1234/token',
      data: { secret: PAIRING_SECRET },
    });
  });

  // The credential rides the body, never the URL: a path/query secret is
  // reproduced into access logs, proxies and history. The server's own placement
  // law says so (class header :61-66 — the code routes, the secret authorises).
  it('token keeps the pairing secret OUT of the request URL', async () => {
    const client = new FakeTransport();
    client.respond({ access_token: 'acc', refresh_token: 'ref' });
    await redeemPairingToken(client, offer());
    expect(client.calls[0].endpoint).toBe('/api/v1/auth/quick-connect/ABCD-1234/token');
    expect(client.calls[0].endpoint).not.toContain(PAIRING_SECRET);
    expect(client.calls[0].data).toEqual({ secret: PAIRING_SECRET });
  });

  it('token fails FAST on an incomplete pair', async () => {
    const client = new FakeTransport();
    client.respond({ access_token: 'acc' });
    await expect(redeemPairingToken(client, offer())).rejects.toBeInstanceOf(QuickConnectProtocolError);
  });

  // RT-058 Critical #1 guard: the module's posture note must state the server
  // contract and must never re-certify the retired code-is-the-secret claim the
  // shipped wire refutes. Source-grepped, because a comment IS the artifact here —
  // and flattened first, so the same myth wrapped across a comment break cannot
  // sneak past a literal-string grep.
  it('the redeem posture note states the real contract, not the retired myth', () => {
    const prose = proseOf('src/quickconnect/quickConnectClient.ts');
    expect(prose).not.toMatch(/sole\s+redeem\s+secret/i);
    expect(prose).toMatch(/bearer\s+credential/i);
    expect(prose).toMatch(/secret\s+is\s+required/);
    expect(prose).toMatch(/QuickConnectController\.php/);
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
      { code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 2 }, // initiate
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
    // RT-058 end-to-end carry-through: the secret the initiate answer carried is
    // the SAME one the session redeems with. The offer is the pairing handle; no
    // leg of the loop re-derives, drops or invents the credential on the way.
    expect(client.calls.find((c) => c.endpoint.endsWith('/token'))?.data).toEqual({ secret: PAIRING_SECRET });
  });

  // RT-058: a code the TV can never redeem is not a pairing. Pre-cure the session
  // happily polled such an offer to approval and then ate a 400 at redeem; now the
  // boundary refuses the offer up front and the surface gets a calm terminal phase.
  it('RT-058: an initiate answer with no secret ends error — never a doomed poll loop', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', interval: 1 }); // secretless = unredeemable
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('error');
    expect(h.codes).toHaveLength(0);
    expect(client.calls.filter((c) => c.endpoint.endsWith('/status'))).toHaveLength(0);
  });

  it('an INVISIBLE surface issues ZERO status requests and stays quiet', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1 });
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
      { code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1 }, // initiate (base 1000 ms)
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
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1 }); // initiate ok
    for (let i = 0; i < 10; i += 1) client.respond(new Error('down'));
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('error');
    // Exactly the tolerated count of status attempts, never unbounded.
    expect(client.calls.filter((c) => c.endpoint.endsWith('/status'))).toHaveLength(6);
    expect(h.phases).toContain('error');
  });

  it('denied is a calm terminal phase — no redeem, no tokens, no throw', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1 }, { status: 'denied' });
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('denied');
    expect(h.applied).toHaveLength(0);
    expect(client.calls.some((c) => c.endpoint.endsWith('/token'))).toBe(false);
  });

  it('expired is a calm terminal phase', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1 }, { status: 'expired' });
    await expect(harness(client).session.run()).resolves.toBe('expired');
  });

  it('stop() during a pending wait abandons the session', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1 }, ...Array.from({ length: 8 }, () => ({ status: 'pending' })));
    const h = harness(client);
    h.sleeper.stopAfter(3); // pending polls keep looping; after 3 sleeps the abort fires stop()
    await expect(h.session.run()).resolves.toBe('abandoned');
    expect(h.applied).toHaveLength(0);
  });

  it('a redeem protocol failure after approval resolves error (never throws out)', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1 }, { status: 'approved' }, { message: 'malformed' });
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('error');
    expect(h.applied).toHaveLength(0);
  });

  // ── RT-050 (review tizen__casualgamer #2) — initiate refusals split by ANSWER.
  // Pre-cure every initiate throw became the network-blaming `error`; a server
  // that 404s the unknown quick-connect route never touched a failed network.
  it('RT-050: an answered 4xx refusal on initiate resolves unsupported, not error', async () => {
    for (const status of [400, 404, 405]) {
      const client = new FakeTransport();
      client.respond(Object.assign(new Error('quick-connect refused'), { status }));
      const h = harness(client);
      await expect(h.session.run()).resolves.toBe('unsupported');
      expect(h.codes, `status ${status} issues no code`).toHaveLength(0);
      expect(h.phases[h.phases.length - 1]).toBe('unsupported');
    }
  });

  it('RT-050: a no-answer throw on initiate keeps error (the true unreachable)', async () => {
    const client = new FakeTransport();
    client.respond(new Error('connect failed'));
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('error');
    expect(h.phases[h.phases.length - 1]).toBe('error');
  });

  it('RT-050: 429 and 5xx answers keep the retry-bearing error posture (not capability refusals)', async () => {
    for (const status of [429, 503]) {
      const client = new FakeTransport();
      client.respond(Object.assign(new Error('busy or broken'), { status }));
      const h = harness(client);
      await expect(h.session.run()).resolves.toBe('error');
    }
  });

  // ── RT-055 (review tizen__exploiter #4) — a stopped session publishes nothing ──
  it('RT-055: stop() while initiate is in flight publishes NO code and never enters pairing', async () => {
    // The window the cure closes: the viewer dismissed the panel (or a fresh
    // base superseded the session) WHILE the initiate request was still open.
    // Pre-cure, the awaited offer was published unconditionally after the
    // await — a dead session stamped its code onto the live surface, and the
    // panel displayed a code whose polling loop had already exited.
    let settle!: (value: unknown) => void;
    const transport = {
      get(endpoint: string): Promise<unknown> {
        return Promise.reject(new Error(`unexpected GET ${endpoint}`));
      },
      post(endpoint: string): Promise<unknown> {
        if (!endpoint.endsWith('/initiate')) {
          return Promise.reject(new Error(`unexpected POST ${endpoint}`));
        }
        return new Promise((resolve) => {
          settle = resolve;
        });
      },
    };
    const phases: PairingPhase[] = [];
    const codes: string[] = [];
    const session = createPairingSession({
      client: transport as unknown as Parameters<typeof createPairingSession>[0]['client'],
      identity: { deviceName: 'tv', deviceType: 'samsung-tizen' },
      isVisible: () => true,
      applyTokens: () => {},
      onCode: (code) => codes.push(code),
      onStatusChange: (phase) => phases.push(phase),
      sleep: () => Promise.resolve(),
    });
    const running = session.run();
    await Promise.resolve(); // let run() park on the initiate await
    session.stop(); // viewer moved on while the request was open
    settle({ code: 'STALE-1234', secret: PAIRING_SECRET, interval: 1 }); // the server answers LATE
    await expect(running).resolves.toBe('abandoned');
    // The whole point: the late offer dies with its session.
    expect(codes).toHaveLength(0);
    expect(phases).not.toContain('pairing');
  });

  it('RT-055: onCode stamps the owning session so the surface can drop stale writes', async () => {
    // The identity half: publishing the code is not enough — the receiver must
    // be able to prove WHICH session authored it. The handle itself rides the
    // callback (no ids to invent); the panel compares it against its current
    // session before writing, pinned in QuickConnectPanel.test.ts.
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1 }, { status: 'approved' }, { access_token: 'a', refresh_token: 'r' });
    const owners: unknown[] = [];
    const session = createPairingSession({
      client,
      identity: { deviceName: 'tv', deviceType: 'samsung-tizen' },
      isVisible: () => true,
      applyTokens: () => {},
      onCode: (_code, _exp, owner) => owners.push(owner),
      sleep: () => Promise.resolve(),
    });
    await expect(session.run()).resolves.toBe('approved');
    expect(owners).toHaveLength(1);
    expect(owners[0]).toBe(session);
  });

  it('intervalSeconds override wins over the server-published interval', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 9 }, { status: 'approved' }, { access_token: 'a', refresh_token: 'r' });
    const h = harness(client, { intervalSeconds: 3 });
    await h.session.run();
    // base comes from the override (3 s), not the server's 9.
    expect(h.sleeper.delays).not.toContain(9_000);
  });

  // ── M-TIZEN-25 — server-published cadence is clamped to a sane window ─────
  it('M-TIZEN-25: a server interval of 0 cannot hammer the poll endpoint (floor 1 s)', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 0 }, { status: 'pending' }, { status: 'approved' }, { access_token: 'a', refresh_token: 'r' });
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('approved');
    expect(h.sleeper.delays).toContain(1_000); // floored, never 0
    expect(h.sleeper.delays).not.toContain(0);
  });

  it('M-TIZEN-25: a giant server interval is ceilinged at 60 s (the flow cannot freeze)', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1_000_000_000 }, { status: 'pending' }, { status: 'approved' }, { access_token: 'a', refresh_token: 'r' });
    const h = harness(client);
    await expect(h.session.run()).resolves.toBe('approved');
    expect(h.sleeper.delays).toContain(60_000);
    expect(Math.max(...h.sleeper.delays)).toBeLessThanOrEqual(60_000);
  });

  it('M-TIZEN-25: a non-finite override falls back to the exported default cadence', async () => {
    const client = new FakeTransport();
    client.respond({ code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 9 }, { status: 'pending' }, { status: 'approved' }, { access_token: 'a', refresh_token: 'r' });
    const h = harness(client, { intervalSeconds: Number.NaN });
    await h.session.run();
    expect(h.sleeper.delays).toContain(DEFAULT_POLL_INTERVAL_SECONDS * 1000);
    expect(h.sleeper.delays).not.toContain(9_000);
  });

  it('DEFAULT cadence is the exported fallback', () => {
    expect(DEFAULT_POLL_INTERVAL_SECONDS).toBeGreaterThan(0);
  });

  // ── m17 — the client-side expiry belt ─────────────────────────────────────
  it('m17: a server stuck on `pending` past its own window ends client-side', async () => {
    const client = new FakeTransport();
    client.respond(
      { code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1, expires_at: 30 }, // absolute 30 s from t0
      ...Array.from({ length: 40 }, () => ({ status: 'pending' })),
    );
    let clockMs = 0;
    const phases: PairingPhase[] = [];
    const session = createPairingSession({
      client,
      identity: { deviceName: 'tv', deviceType: 'samsung-tizen' },
      isVisible: () => true,
      applyTokens: () => {},
      onCode: () => {},
      onStatusChange: (phase) => phases.push(phase),
      sleep: async (ms) => {
        clockMs += ms; // the fake sleep CONSUMES the wall clock, like a real one
      },
      now: () => clockMs,
    });
    await expect(session.run()).resolves.toBe('expired');
    // One poll per second of window, plus the final one that trips the belt —
    // bounded, never the old unbounded hold.
    const statusCalls = client.calls.filter((c) => c.endpoint.endsWith('/status')).length;
    expect(statusCalls).toBeLessThanOrEqual(31);
    expect(phases[phases.length - 1]).toBe('expired');
  });

  it('m17: a skewed-FAST TV clock never expires a live code client-side — the server stays authoritative', async () => {
    const client = new FakeTransport();
    client.respond(
      { code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1, expires_at: 100 }, // unix 100 s
      { status: 'pending' },
      { status: 'approved' },
      { access_token: 'a', refresh_token: 'r' },
    );
    let clockMs = 500_000; // TV clock already "past" the absolute expiry (skew)
    const applied: Array<{ accessToken: string; refreshToken: string }> = [];
    const session = createPairingSession({
      client,
      identity: { deviceName: 'tv', deviceType: 'samsung-tizen' },
      isVisible: () => true,
      applyTokens: (tokens) => applied.push(tokens),
      onCode: () => {},
      sleep: async (ms) => {
        clockMs += ms;
      },
      now: () => clockMs,
    });
    // Derived window is negative → belt DISARMED by design; the flow completes
    // on the server's honest answers, no client-side 'expired' phantom.
    await expect(session.run()).resolves.toBe('approved');
    expect(applied).toEqual([{ accessToken: 'a', refreshToken: 'r' }]);
  });

  it('m17: a late-but-true approval still redeems — the belt sits AFTER status handling', async () => {
    const client = new FakeTransport();
    client.respond(
      { code: 'ABCD-1234', secret: PAIRING_SECRET, interval: 1, expires_at: 2 }, // only 2 s of slack
      { status: 'pending' },
      { status: 'pending' },
      { status: 'approved' }, // arrives after the client deadline lapsed
      { access_token: 'a', refresh_token: 'r' },
    );
    let clockMs = 0;
    const applied: unknown[] = [];
    const session = createPairingSession({
      client,
      identity: { deviceName: 'tv', deviceType: 'samsung-tizen' },
      isVisible: () => true,
      applyTokens: (tokens) => applied.push(tokens),
      onCode: () => {},
      sleep: async (ms) => {
        clockMs += ms;
      },
      now: () => clockMs,
    });
    // t=0 poll pending → sleep 1000 → t=1000 poll pending (belt: 1000 < 2000 OK)
    // → sleep → t=2000 poll APPROVED (belt checked only after status handling).
    await expect(session.run()).resolves.toBe('approved');
    expect(applied).toHaveLength(1);
  });
});
