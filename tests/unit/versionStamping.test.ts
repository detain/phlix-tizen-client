/**
 * versionStamping — M-TIZEN-05 drift pin (review tizen__devops MAJ-2; r2 adds
 * the telemetry carrier per review MAJOR-1).
 *
 * WHAT IT PINS: the widget version is single-sourced from package.json into
 * EVERY carrier. (1) app/config.xml's <widget version> must equal the SSOT and
 * carry the generated marker proving stamping is automated
 * (scripts/version-sync.mjs). (2) The committed package/config.xml freshness
 * mirror must carry the same stamped bytes. (3) src/telemetry.ts's
 * CLIENT_VERSION — the version every opted-in TV POSTs to the server as
 * `version` AND `build` — must equal the SSOT and carry its own marker on the
 * stamped line. (4) The package chain must run version-sync FIRST, before
 * `npm run build` (so the Vite bundle carries the stamped constant, not a
 * stale one) and before scripts/package.js assembles the mirror.
 *
 * The CLIENT_VERSION equality reads the literal from the FILE TEXT by regex —
 * it never imports src/telemetry.ts (that would drag @phlix/ui runtime deps
 * into a zero-dep pin) and never takes its expectation from the symbol itself
 * (an expected===actual import is self-reference, not a pin — review r1).
 *
 * Siblings: phlix-roku-client verify-runtime.sh Check 18 (package.json ↔
 * manifest drift) and phlix-windows-client build.yml version-check job
 * (tag == package.json). Both sides read-only cited in the fix report.
 *
 * TEETH (honest disclosure): every carrier is EQUAL at 1.0.0 today — the repo
 * has never shipped a version bump (only the rolling `latest` tag exists) —
 * so this suite is the FUTURE-drift detector, not a red-on-parent cure.
 * Mutation-proven at the fix lanes: bumping package.json without running sync
 * reddens the manifest equality, mirror and telemetry arms; stripping a
 * marker reddens its arm; editing the version out of package/ reddens the
 * mirror arm; hand-editing CLIENT_VERSION away from the SSOT reddens the
 * telemetry arm; dropping version-sync from the chain, or re-ordering it
 * after the build, reddens the wiring arm.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GENERATED_MARKER, TELEMETRY_MARKER } from '../../scripts/version-sync.mjs';

const REPO = path.resolve(__dirname, '..', '..');

/** The <widget ...> version attribute of a config.xml source text. */
function widgetVersion(xml: string): string | null {
  const m = xml.match(/<widget\b[^>]*\bversion="([^"]*)"/);
  return m ? m[1] : null;
}

/** The CLIENT_VERSION string literal, read from src/telemetry.ts FILE TEXT. */
function clientVersionLiteral(ts: string): string | null {
  const m = ts.match(/^export const CLIENT_VERSION = '([^']*)';/m);
  return m ? m[1] : null;
}

/** The stamped CLIENT_VERSION line itself (the marker rides on this line). */
function clientVersionLine(ts: string): string | undefined {
  return ts.split('\n').find((l) => l.startsWith("export const CLIENT_VERSION = '"));
}

describe('version stamping — single source is package.json (M-TIZEN-05)', () => {
  const pkg = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const appConfig = readFileSync(path.join(REPO, 'app', 'config.xml'), 'utf8');
  const mirrorConfig = readFileSync(path.join(REPO, 'package', 'config.xml'), 'utf8');
  const telemetrySrc = readFileSync(path.join(REPO, 'src', 'telemetry.ts'), 'utf8');

  it('package.json version is a plain semver string (the SSOT must be sane)', () => {
    expect(typeof pkg.version).toBe('string');
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
  });

  it('app/config.xml widget version equals the package.json SSOT', () => {
    expect(widgetVersion(appConfig)).toBe(pkg.version);
  });

  it('app/config.xml carries the generated marker (stamping is automated)', () => {
    expect(appConfig).toContain(GENERATED_MARKER);
  });

  it('package/config.xml mirror carries the SSOT version + marker (shipped bytes agree)', () => {
    expect(widgetVersion(mirrorConfig)).toBe(pkg.version);
    expect(mirrorConfig).toContain(GENERATED_MARKER);
  });

  it('src/telemetry.ts CLIENT_VERSION equals the package.json SSOT (server heartbeat version)', () => {
    expect(clientVersionLiteral(telemetrySrc)).toBe(pkg.version);
  });

  it('src/telemetry.ts CLIENT_VERSION line carries the generated marker (stamping is automated)', () => {
    expect(clientVersionLine(telemetrySrc)).toContain(TELEMETRY_MARKER);
  });

  it('npm package chain runs version-sync BEFORE build AND before scripts/package.js', () => {
    const chain: string = pkg.scripts.package;
    const syncAt = chain.indexOf('scripts/version-sync.mjs');
    const buildAt = chain.indexOf('npm run build');
    const assembleAt = chain.indexOf('scripts/package.js');
    expect(syncAt).toBeGreaterThan(-1);
    expect(buildAt).toBeGreaterThan(-1);
    expect(assembleAt).toBeGreaterThan(-1);
    // Before scripts/package.js (mirror stamped) AND before `npm run build`
    // (so the bundle compiled from src carries the stamped CLIENT_VERSION).
    expect(syncAt).toBeLessThan(assembleAt);
    expect(syncAt).toBeLessThan(buildAt);
  });
});
