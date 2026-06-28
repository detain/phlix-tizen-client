import { describe, it, expect } from 'vitest';
import { resolveAppConfig } from '@/resolveConfig';

describe('resolveAppConfig', () => {
  it('uses the persisted server URL in server mode', () => {
    const result = resolveAppConfig({
      serverUrl: 'http://my-server:8096',
      envUrl: 'http://env-server:8096'
    });
    expect(result).toEqual({ app: 'server', apiBase: 'http://my-server:8096' });
  });

  it('falls back to the env URL when no persisted server URL', () => {
    const result = resolveAppConfig({ serverUrl: null, envUrl: 'http://env-server:8096' });
    expect(result).toEqual({ app: 'server', apiBase: 'http://env-server:8096' });
  });

  it('falls back to an EMPTY base when nothing else is set (→ Connect screen)', () => {
    // No localhost guess: an empty base signals main.ts/@phlix/ui to show the
    // first-run Connect screen rather than authenticate against nothing.
    const result = resolveAppConfig({ serverUrl: null, envUrl: null });
    expect(result).toEqual({ app: 'server', apiBase: '' });
  });

  it('treats an empty string server URL as unset (→ empty base)', () => {
    const result = resolveAppConfig({ serverUrl: '', envUrl: '' });
    expect(result).toEqual({ app: 'server', apiBase: '' });
  });
});
