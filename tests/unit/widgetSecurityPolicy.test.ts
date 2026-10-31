/**
 * widgetSecurityPolicy.test — M-TIZEN-23 (W-min170), the widget manifest law.
 *
 * app/config.xml is the platform contract of the shipped .wgt. Three pins,
 * all asserted on BOTH carriers (source + package/ mirror — the version-
 * stamping gate keeps them byte-copied):
 *  1. `encryption="enable"` on <tizen:setting> (M-TIZEN-23): the manifest
 *     previously carried the scaffold default "disable" while the app stores
 *     bearer/refresh tokens in localStorage; the flip asks the platform to
 *     encrypt webdata at rest. The one-time re-login cost on the first
 *     update-after-flip is recorded in the manifest comment itself.
 *  2. The privilege surface stays EXACTLY two (TizenCapability — the AC-1
 *     no-smuggling law already asserted from the screensaver side; this is
 *     the whole-manifest twin).
 *  3. The decided-egress `<access origin="*" subdomains="*">` row is named
 *     beside its posture comment (M-TIZEN-38) — the CSP block in index.html
 *     cross-references it, so the comment must exist where it points.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '..', '..');

const CARRIERS = [
  path.join('app', 'config.xml'),
  path.join('package', 'config.xml'),
] as const;

describe('widgetSecurityPolicy — config.xml manifest (M-TIZEN-23 / M-TIZEN-38)', () => {
  for (const carrier of CARRIERS) {
    const source = readFileSync(path.join(REPO, carrier), 'utf8');

    it(`${carrier}: webdata encryption is ENABLED at rest`, () => {
      // Comments stripped first: the S503 posture note names <tizen:setting>
      // in prose and must not trip the grep (repo scan-the-CODE doctrine).
      const code = source.replace(/<!--[\s\S]*?-->/g, '');
      const setting = /<tizen:setting\b[^>]*?\/>/.exec(code);
      expect(setting, 'tizen:setting row present').not.toBeNull();
      expect(setting![0]).toContain('encryption="enable"');
      expect(setting![0]).not.toContain('encryption="disable"');
    });

    it(`${carrier}: the flip carries its tradeoff comment (re-login cost recorded, not hidden)`, () => {
      const commentIndex = source.indexOf('M-TIZEN-23');
      expect(commentIndex, 'M-TIZEN-23 note present').toBeGreaterThan(-1);
      const note = source.slice(commentIndex, commentIndex + 1200);
      expect(note).toContain('re-login');
    });

    it(`${carrier}: exactly the two shipped privileges — nothing display/power smuggled`, () => {
      const privileges = [...source.matchAll(/<tizen:privilege\b[^>]*>/g)].map((m) => m[0]);
      expect(privileges).toHaveLength(2);
      expect(privileges).toContain('<tizen:privilege name="http://tizen.org/privilege/internet"/>');
      expect(privileges).toContain('<tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>');
    });

    it(`${carrier}: the decided-egress <access> row ships with the posture note beside it`, () => {
      expect(source).toContain('<access origin="*" subdomains="*"></access>');
      // The row is deliberate (index.html's CSP block cross-references it);
      // the manifest must keep the honest reasoning where the pointer lands:
      const accessIndex = source.indexOf('<access origin="*"');
      expect(accessIndex).toBeGreaterThan(-1);
      const note = source.slice(Math.max(0, accessIndex - 900), accessIndex);
      expect(note, 'M-TIZEN-38 posture comment sits directly above the access row').toContain('M-TIZEN-38');
    });
  }
});
