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

  it('falls back to localhost:8096 when nothing else is set', () => {
    const result = resolveAppConfig({ serverUrl: null, envUrl: null });
    expect(result).toEqual({ app: 'server', apiBase: 'http://localhost:8096' });
  });

  it('treats an empty string server URL as unset', () => {
    const result = resolveAppConfig({ serverUrl: '', envUrl: '' });
    expect(result).toEqual({ app: 'server', apiBase: 'http://localhost:8096' });
  });
});
