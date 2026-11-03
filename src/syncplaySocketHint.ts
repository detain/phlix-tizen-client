/**
 * syncplaySocketHint — feed the sealed @phlix/ui bundle the DIRECT-lane
 * socket endpoint (review tizen__CONSOLIDATED M11).
 *
 * THE PROBLEM: the vendored `SyncPlayModal` chunk builds its room WebSocket
 * from `window.location` when no hint is present. On a TV widget that origin
 * is the widget's own package root, never the LAN server the user pointed
 * the app at — so the bundle's socket dials a door that does not exist while
 * the REST API (apiBase-driven) works fine. Since v0.99.13 the ui reads a
 * `window.__PHLIX__` hint at EVERY dial (`src/api/socketHint.ts`):
 * `wsUrl` (scheme://host[:port], no path/query/userinfo) + optional
 * `wsPath`. This module is the host half of that seam.
 *
 * THE LAW IT REUSES: the origin is computed by `syncplaySocketOrigin` —
 * the exact host/TLS/port derivation the tizen-native socket obeys, port
 * override included. One rule, two consumers: the hint and every tizen dial
 * can never disagree about where :8097 (or `phlix.syncplayPort`) lives.
 *
 * HONEST LIMITS (deliberate, each pinned by a test):
 *  - `wsPath` is seeded `null`. The direct-lane consumer appends its own
 *    `?room=` after `wsPath ?? ''`, which reproduces `buildWsUrl` byte-for-
 *    byte; a stray path would corrupt it. The bundle's relay consumer would
 *    want `/syncplay`, but tizen never hands the bundle a `hubRelay` config
 *    (the relay lane is `src/api/hubRelay.ts`, tizen-native), so `null` is
 *    the only honest value here.
 *  - A plaintext (non-https) base REFUSES the seed (the bearer-transport law
 *    M-TIZEN-12, same as the native lane): without the dev hatch nothing is
 *    written and the bundle keeps its legacy fallback — which is wrong for
 *    the widget too, but seeding a credential-bearing wss hint we refuse to
 *    dial ourselves would be worse. With the hatch, the ws:// hint ships and
 *    the bundle's own bearer posture is the operator's declared trade.
 *  - The port override is sampled at APPLY time (boot / connection change),
 *    not at bundle-dial time — the sealed chunk offers no read hook. An
 *    operator editing `phlix.syncplayPort` mid-session re-enters this client
 *    through boot or a server switch, the same surfaces that refresh it here.
 *
 * The function never throws: it is called from an @phlix/ui callback
 * (T-09 discipline) where a throw would unwind mid-interaction.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import {
  insecureSyncPlayHatchEnabled,
  syncplaySocketOrigin,
  SyncPlayInsecureTransportError,
} from './syncplayTransport';
import { syncPlayPortOverride } from './endpointOverrides';

/** The shape @phlix/ui's socketHint reads out of `window.__PHLIX__`. The
 *  index signature keeps foreign host fields (app, apiBase, …) survivable —
 *  this module owns ONLY the two hint fields and never rewrites the rest.
 *  (The vendor's own d.ts types the slot as a full `PhlixAppConfig`; the two
 *  hint fields are all this host writes, so we bridge through this narrower
 *  local view instead of fighting the vendor declaration.) */
interface MutableShell {
  wsUrl?: string | null;
  wsPath?: string | null;
  [key: string]: unknown;
}

/** Outcome record for tests and console honesty — `wsUrl` is what the hint
 *  now carries (`null` = legacy behavior ships). */
export interface SocketHintOutcome {
  seeded: boolean;
  wsUrl: string | null;
  reason?: string;
}

function shellSlot(): MutableShell {
  const win = globalThis.window as unknown as { __PHLIX__?: MutableShell };
  return win.__PHLIX__ ?? {};
}

/** Write the two hint fields, preserving every other `__PHLIX__` member. */
function seedHint(wsUrl: string | null, wsPath: string | null): void {
  const shell: MutableShell = { ...shellSlot() };
  shell.wsUrl = wsUrl;
  shell.wsPath = wsPath;
  (globalThis.window as unknown as { __PHLIX__: MutableShell }).__PHLIX__ = shell;
}

/**
 * Recompute and write (or clear) the bundle's socket hint for `apiBase`.
 * Call at boot and on every connection change. `opts` exists for tests and
 * any future surface that knows better than the live reads — production
 * passes nothing and gets the same live laws the native lane uses.
 */
export function applySyncPlaySocketHint(
  apiBase: string | null,
  opts: { allowInsecure?: boolean; portOverride?: number | null } = {},
): SocketHintOutcome {
  if (typeof globalThis.window === 'undefined') {
    return { seeded: false, wsUrl: null, reason: 'no-window' };
  }
  if (!apiBase) {
    seedHint(null, null);
    return { seeded: false, wsUrl: null, reason: 'no-api-base' };
  }
  const allowInsecure = opts.allowInsecure ?? insecureSyncPlayHatchEnabled();
  const portOverride = opts.portOverride ?? syncPlayPortOverride();
  let origin: string;
  try {
    origin = syncplaySocketOrigin(apiBase, allowInsecure, portOverride);
  } catch (e) {
    if (e instanceof SyncPlayInsecureTransportError) {
      // Policy refusal, same posture as the native dial: clear, disclose,
      // legacy stands. Terminal until the base becomes https (or hatch).
      seedHint(null, null);
      return { seeded: false, wsUrl: null, reason: 'insecure-transport-refused' };
    }
    throw e; // syncplaySocketOrigin has no other throw path; fail loud if one appears
  }
  if (!origin) {
    seedHint(null, null);
    return { seeded: false, wsUrl: null, reason: 'unparsable-base' };
  }
  seedHint(origin, null);
  return { seeded: true, wsUrl: origin };
}
