/**
 * versionStamping — M-TIZEN-05 drift pin (review tizen__devops MAJ-2).
 *
 * WHAT IT PINS: the widget version a TV (and the Samsung store) reads is
 * single-sourced from package.json. app/config.xml's <widget version> must
 * equal package.json's, config.xml must carry the generated marker proving
 * stamping is automated (scripts/version-sync.mjs, chained into
 * `npm run package` BEFORE scripts/package.js assembles the package/ mirror),
 * and the committed package/config.xml freshness mirror must carry the same
 * stamped bytes.
 *
 * Siblings: phlix-roku-client verify-runtime.sh Check 18 (package.json ↔
 * manifest drift) and phlix-windows-client build.yml version-check job
 * (tag == package.json). Both sides read-only cited in the fix report.
 *
 * TEETH (honest disclosure): config.xml and package.json are EQUAL at 1.0.0
 * today — the repo has never shipped a version bump (only the rolling `latest`
 * tag exists) — so this suite is the FUTURE-drift detector, not a red-on-parent
 * cure. Mutation-proven at the fix lane: bumping package.json without running
 * sync reddens the equality arm; stripping the marker reddens the generator
 * arm; editing the version out of package/ reddens the mirror arm; dropping
 * version-sync from the package chain reddens the wiring arm.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GENERATED_MARKER } from '../../scripts/version-sync.mjs';

const REPO = path.resolve(__dirname, '..', '..');

/** The <widget ...> version attribute of a config.xml source text. */
function widgetVersion(xml: string): string | null {
  const m = xml.match(/<widget\b[^>]*\bversion="([^"]*)"/);
  return m ? m[1] : null;
}

describe('version stamping — single source is package.json (M-TIZEN-05)', () => {
  const pkg = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const appConfig = readFileSync(path.join(REPO, 'app', 'config.xml'), 'utf8');
  const mirrorConfig = readFileSync(path.join(REPO, 'package', 'config.xml'), 'utf8');

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

  it('npm package chain runs version-sync BEFORE scripts/package.js', () => {
    const chain: string = pkg.scripts.package;
    const syncAt = chain.indexOf('scripts/version-sync.mjs');
    const assembleAt = chain.indexOf('scripts/package.js');
    expect(syncAt).toBeGreaterThan(-1);
    expect(assembleAt).toBeGreaterThan(-1);
    expect(syncAt).toBeLessThan(assembleAt);
  });
});
