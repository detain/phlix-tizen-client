/**
 * endpointOverrides — M-TIZEN-07 (W-min171): the shape law for the three
 * operator escape-hatch storage rows (direct SyncPlay port, relay port, relay
 * mount path). Pure validators, tables — the dial-side tests live with their
 * modules (useSyncPlayStore / hubRelay suites).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import {
  parsePathOverride,
  parsePortOverride,
  RELAY_PATH_KEY,
  RELAY_PORT_KEY,
  SYNCPLAY_PORT_KEY,
} from '@/endpointOverrides';

describe('parsePortOverride', () => {
  it('accepts real ports (trimmed)', () => {
    expect(parsePortOverride('18097')).toBe(18097);
    expect(parsePortOverride(' 443 ')).toBe(443);
    expect(parsePortOverride('8097')).toBe(8097);
    expect(parsePortOverride('65535')).toBe(65535);
    expect(parsePortOverride('1')).toBe(1);
  });

  it('refuses everything that is not a plain 1..65535 decimal', () => {
    // null/absent/empty = unset; the rest are poison a persisted row can hold.
    for (const raw of [null, undefined, '', 'abc', '0', '65536', '-1', '1e3', '8097;rm', ' 80 97', '08097!']) {
      expect(parsePortOverride(raw), JSON.stringify(raw)).toBeNull();
    }
    // '8097 ' trims fine — recheck explicitly (it MUST be accepted, not refused):
    expect(parsePortOverride('8097 ')).toBe(8097);
    expect(parsePortOverride(' 80 97')).toBeNull(); // interior whitespace stays poison
    expect(parsePortOverride('08097')).toBe(8097); // leading zero decimal parses clean
  });
});

describe('parsePathOverride', () => {
  it('accepts single-slash mount paths', () => {
    expect(parsePathOverride('/syncplay')).toBe('/syncplay');
    expect(parsePathOverride('/relay/ws')).toBe('/relay/ws');
    expect(parsePathOverride('  /deep/path  ')).toBe('/deep/path');
    expect(parsePathOverride('/')).toBe('/');
  });

  it('refuses scheme-shaped and ambiguous strings', () => {
    for (const raw of [
      null,
      undefined,
      '',
      '   ',
      'syncplay', // no leading slash
      '//evil.example/x', // protocol-relative — the M-TIZEN-29 twin class
      '/a?b', // query smuggle
      '/a#b', // fragment smuggle
      '/a b', // whitespace interior
      `/${'x'.repeat(200)}`, // over length (201 chars total)
    ]) {
      expect(parsePathOverride(raw), JSON.stringify(raw)).toBeNull();
    }
  });
});

describe('the storage keys are the documented vocabulary', () => {
  it('names the three rows exactly', () => {
    expect(SYNCPLAY_PORT_KEY).toBe('phlix.syncplayPort');
    expect(RELAY_PORT_KEY).toBe('phlix.relayPort');
    expect(RELAY_PATH_KEY).toBe('phlix.relayPath');
  });
});
