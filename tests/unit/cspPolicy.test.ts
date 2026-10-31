/**
 * cspPolicy.test — M-TIZEN-22 (W-min170), the script-execution CSP law.
 *
 * Pins BOTH carriers of the widget CSP (index.html source + the shipped
 * package/index.html mirror — the freshness gate keeps them together) and
 * the two halves of the law:
 *  1. script-src is STRICT: `'self'` only, no 'unsafe-inline'. The majors-era
 *     inline boot canary is gone (S515 made the splash CSS-only and moved
 *     renderBootFailure into the bundled main.ts), so 'unsafe-inline' became
 *     dead weight — and dead weight with an exploit surface should not ship.
 *     Strict script-src blocks inline <script> AND inline event handlers, the
 *     class-level backstop for the vendored hand-rolled innerHTML escape
 *     (docs/ui-port-divergence.md row) should that escape ever regress.
 *  2. style-src KEEPS 'unsafe-inline' — the splash <style> block and Vue SFC
 *     inline styles genuinely need it; styles cannot execute script.
 * Plus the structural precondition: neither carrier contains an inline
 * <script> element at all (the strict CSP must not be a lie that breaks the
 * app on the day a real inline script is introduced — that change must come
 * back here as a deliberate, reviewed CSP edit).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '..', '..');

const CARRIERS = ['index.html', path.join('package', 'index.html')] as const;

function cspContent(source: string): string {
  const match = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(source)
    ?? /content="([^"]+)"\s+http-equiv="Content-Security-Policy"/.exec(source);
  expect(match, 'CSP meta tag present').not.toBeNull();
  return match![1];
}

describe('cspPolicy — script-src strictness (M-TIZEN-22)', () => {
  for (const carrier of CARRIERS) {
    const source = readFileSync(path.join(REPO, carrier), 'utf8');

    it(`${carrier}: script-src is exactly 'self' — no unsafe-inline, no wildcards`, () => {
      const content = cspContent(source);
      const scriptSrc = content
        .split(';')
        .map((d) => d.trim())
        .find((d) => d.startsWith('script-src'));
      expect(scriptSrc).toBeDefined();
      expect(scriptSrc).toBe("script-src 'self'");
    });

    it(`${carrier}: style-src keeps 'unsafe-inline' (splash block + SFC styles; styles ≠ script)`, () => {
      const content = cspContent(source);
      const styleSrc = content
        .split(';')
        .map((d) => d.trim())
        .find((d) => d.startsWith('style-src'));
      expect(styleSrc).toBeDefined();
      expect(styleSrc).toContain("'unsafe-inline'");
    });

    it(`${carrier}: zero inline <script> elements — the strict script-src is survivable`, () => {
      // HTML comments stripped FIRST — the M-TIZEN-22 posture prose names the
      // banned shape and must not trip its own grep (repo doctrine: scan the
      // CODE, same as the screensaver focus-safe pin).
      const code = source.replace(/<!--[\s\S]*?-->/g, '');
      // All script tags must carry src= (module externals). An inline block
      // here would boot broken under this very CSP.
      const tags = code.match(/<script\b[^>]*>/g) ?? [];
      expect(tags.length).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag, `script tag external: ${tag}`).toContain('src=');
      }
    });
  }

  it('the majors-era connect-src posture stays as assessed (no silent edits to other directives)', () => {
    // The M-TIZEN-07 block (index.html comment) records the wide egress as a
    // decided product posture; this pin keeps future "security" drive-bys from
    // narrowing (or widening) the FETCH directives without re-reading it.
    const content = cspContent(readFileSync(path.join(REPO, 'index.html'), 'utf8'));
    expect(content).toContain("connect-src 'self' https: http: ws: wss:");
    expect(content).toContain("img-src 'self' data: https: http:");
    expect(content).toContain("media-src 'self' https: http: blob:");
  });
});
