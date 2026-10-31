/**
 * parentalControlsPathSegments — M-TIZEN-28 (W-min171) source pins.
 *
 * The page builds `/api/v1/profiles/{id}/…` URLs by interpolating values the
 * server round-tripped into `encodeURIComponent`-guarded segments (the
 * review's crafted-id demo: `2/../../4` reached the wire raw and
 * api-client.joinUrl() collapsed the dot-segments → a bearer-authenticated
 * request aimed at a DIFFERENT profile; `?`/`#` fragments broke the path
 * even further). The cure is structural — one `seg()` helper is the ONLY way
 * this page may write a path segment — and this file pins that shape, because
 * the vulnerability class returns the moment a future edit re-opens raw
 * interpolation (jsdom request-level proofs would need a live ApiClient
 * harness; the string law is the exact contract, so the string law is pinned).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '..', '..');
const SRC = readFileSync(path.join(REPO, 'src/pages/ParentalControlsPage.vue'), 'utf8');

// Comment/docblock strips keep the scan honest to CODE lines: the file's own
// header enumerates the routes (with `{id}` placeholders, not interpolations)
// and the cure rationale cites the old shape — neither may trip the bans.
const CODE = SRC
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\*.*$/gm, '')
  .replace(/^\s*\/\/.*$/gm, '');

/** Every template-literal profiles URL in code (the audit denominator). */
const PROFILE_URLS = CODE.match(/`\/api\/v1\/profiles\/[^`]*`/g) ?? [];

describe('M-TIZEN-28 — the path-segment encoding law of the parental page', () => {
  it('the page has URL shapes to guard (denominator: the audit counted nine)', () => {
    expect(PROFILE_URLS.length).toBe(9);
  });

  it('seg() is defined exactly once and is the encodeURIComponent contract', () => {
    const defs = CODE.match(/function seg\(/g) ?? [];
    expect(defs).toHaveLength(1);
    expect(CODE).toMatch(/function seg\(value: string \| number\): string \{\s*\n\s*return encodeURIComponent\(String\(value\)\);/);
  });

  it('NO profiles URL interpolates a raw expression — every segment rides seg()', () => {
    // Catches `${pid}` / `${scheduleId}` / `${anything}` that is not a
    // seg(…) call, in every one of the template literals above.
    const rawSegments: string[] = [];
    for (const url of PROFILE_URLS) {
      for (const expr of url.match(/\$\{([^}]*)\}/g) ?? []) {
        if (!expr.startsWith('${seg(')) rawSegments.push(expr);
      }
    }
    expect(rawSegments).toEqual([]);
  });

  it('the three tail ids are seg-guarded where they appear (mutation teeth)', () => {
    expect(CODE).toContain('${seg(editingSchedule.value.id)}');
    expect(CODE).toContain('${seg(scheduleId)}');
    expect(CODE).toContain('${seg(tagId)}');
  });

  it('the profile id itself is seg-guarded at every one of the nine sites', () => {
    for (const url of PROFILE_URLS) {
      expect(url, url).toContain('${seg(pid)}');
    }
  });
});
