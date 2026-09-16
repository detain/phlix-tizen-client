/**
 * S515 AD-3 — boot-time reachability probe for the resolved server base.
 *
 * The client ships with (or persists) a server URL that may be SET yet
 * UNREACHABLE — the machine is off, the IP moved, the LAN changed. Until now
 * that state booted straight into a silently failing app: the `requireConnection`
 * guard in `@phlix/ui` only routes to the Connect screen when NO base resolves.
 *
 * This module is the thin, pure decision layer `boot()` consults before it
 * commits to a base. It deliberately REUSES `@phlix/ui`'s exported
 * {@link probeServer} rather than re-implementing the wire check: one probe
 * implementation, one loose response-shape rule (`status === 'ok' || version
 * !== undefined` — re-derived from the server's public unauthenticated GET
 * `/health`, which answers `{status:'ok', timestamp, version}` per
 * `phlix-server` `src/Server/Core/Application.php` `loadRoutes()`; NOT
 * hard-asserted here), one 6 s `AbortController` timeout. The server stays
 * untouched (era law).
 *
 * The probe is ADVISORY, never fatal: a back end whose `/health` is
 * CORS-restricted answers `false` just like a dead one. `boot()` treats
 * 'unreachable' as "route the user to the D-pad-operable Connect screen" —
 * whose own "Connect anyway" affordance keeps such a server fully usable.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

import { probeServer } from '@phlix/ui';

/** Verdict of the boot probe against a resolved API base. */
export type BootProbeVerdict = 'empty' | 'reachable' | 'unreachable';

/**
 * Classify the resolved base before the app commits to it.
 *
 * - `''` (nothing persisted/seeded) → `'empty'`: NO probe runs — the ui's
 *   connect-gate already owns that path byte-identically (first-run Connect
 *   screen), and probing an empty base would be noise.
 * - non-empty → `'reachable'` when `probeServer` accepts `{base}/health`,
 *   else `'unreachable'` (non-OK status, malformed body, CORS rejection,
 *   timeout, network error).
 *
 * Never rejects: `probeServer` swallows every failure into `false`, and the
 * call here is additionally hardened — a probe implementation that somehow
 * throws degrades to `'unreachable'` (advisory offline routing) rather than
 * sinking `boot()`. The T-09 rule (boot must not die from network reality)
 * still holds. `fetchImpl` is injectable for unit tests; it defaults to the
 * webview's own `fetch`.
 */
export async function probeBootBase(
  apiBase: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BootProbeVerdict> {
  if (!apiBase) return 'empty';
  try {
    return (await probeServer(apiBase, fetchImpl)) ? 'reachable' : 'unreachable';
  } catch {
    // probeServer's own contract is never-reject; belt-and-braces so AD-3 can
    // not become a new boot-failure vector under any implementation.
    return 'unreachable';
  }
}
