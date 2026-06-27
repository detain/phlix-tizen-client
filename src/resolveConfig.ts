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

const DEFAULT_SERVER_URL = 'http://localhost:8096';

/**
 * Decide which base URL the Tizen client talks to.
 *
 * Server mode only: prefer the persisted direct server URL, then the build-time
 * env URL, then localhost:8096. The `app: 'hub'` member is part of the shared
 * shape for forward-compatibility but is never returned today.
 */
export function resolveAppConfig(input: ResolveConfigInput): ResolvedAppConfig {
  const apiBase = input.serverUrl || input.envUrl || DEFAULT_SERVER_URL;
  return { app: 'server', apiBase };
}
