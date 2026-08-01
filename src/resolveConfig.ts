/**
 * Tizen TV client entry point and boot glue.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// Pure, unit-testable resolution of the phlix-ui app mode + apiBase for the
// Samsung Tizen client. Tizen has no hub-config IPC like the Windows/Electron
// client, so this is server-mode only for now — but the function shape mirrors
// the Windows resolveConfig so a hub branch can be added later without churn.

export interface ResolveConfigInput {
  /** Server URL persisted in localStorage (phlix.serverUrl), or null. */
  serverUrl?: string | null;
  /** Build-time fallback (import.meta.env.VITE_PHLIX_SERVER_URL). */
  envUrl?: string | null;
}

export interface ResolvedAppConfig {
  app: 'server' | 'hub';
  apiBase: string;
}

/**
 * Decide which base URL the Tizen client talks to.
 *
 * Server mode only: prefer the persisted direct server URL, then the build-time
 * env URL, then an EMPTY base. The `app: 'hub'` member is part of the shared
 * shape for forward-compatibility but is never returned today.
 *
 * An empty `apiBase` is intentional: the client no longer guesses
 * `localhost:8096` (nothing is listening there on a TV). Instead `main.ts` passes
 * `requireConnection: true`, so an empty base routes the user to the shared
 * `@phlix/ui` first-run Connect screen to enter their server address — which is
 * then persisted (and mirrored back to `localStorage['phlix.serverUrl']`) so it
 * re-seeds here on the next launch.
 */
export function resolveAppConfig(input: ResolveConfigInput): ResolvedAppConfig {
  const apiBase = input.serverUrl ?? input.envUrl ?? '';
  return { app: 'server', apiBase };
}
