/**
 * docsPinConsistency — M-TIZEN-14 five-docs pin law (review tizen__writer MAJOR-2:
 * "Version-pinning claims: five documents, four answers, none current").
 *
 * WHAT IT PINS: every CURRENT `@phlix/*` pin claim carried in the five documents
 * (README.md, DEVELOPER.md, docs/i18n.md, AGENTS.md, CLAUDE.md) must equal the
 * tag pin in package.json — the single source of truth for library pins.
 * Sibling of tests/unit/versionStamping.test.ts (which single-sources the WIDGET
 * version from package.json into config.xml + telemetry); this suite single-
 * sources the DEPENDENCY story from package.json into the prose. Together they
 * close the two axes the writer review found drifting.
 *
 * Why equality-on-claim-surfaces and not a blanket version sweep: docs/i18n.md
 * (and any doc, tomorrow) may legitimately NARRATE version history ("until the
 * v0.99.5 re-pin…") — history is verbatim and out of scope. Each CURRENT claim
 * therefore has a structured anchor this suite extracts; a re-pin lane that
 * forgets a doc reddens exactly the missed arm.
 *
 * Zero runtime imports (versionStamping idiom): reads FILE TEXT only, never
 * imports src/ or node_modules, so the pin cannot self-reference what it checks.
 *
 * RED-ON-PARENT: at 39f4c7a every arm except the contracts/syncplay halves of
 * AGENTS.md/CLAUDE.md fails — README badge+list carry v0.99.1/v0.4.6/v0.1.4,
 * DEVELOPER.md:14 carries v0.99.0/v0.4.3 and omits syncplay, docs/i18n.md:25
 * claims resolved pin v0.99.8, AGENTS.md/CLAUDE.md pin lines claim v0.99.8,
 * and DEVELOPER.md's troubleshooting hardcodes a fossil "v0.74.0" export
 * contract. Measured reds are recorded in the fix report.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(path.join(REPO, rel), 'utf8');

const SEMVER = String.raw`\d+\.\d+\.\d+`;

/** First capture group of `re` in `text`, or null. */
function grab(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1] : null;
}

describe('dependency-pin doc law — single source is package.json (M-TIZEN-14)', () => {
  const pkg = JSON.parse(read('package.json'));
  const readme = read('README.md');
  const developer = read('DEVELOPER.md');
  const i18nDoc = read(path.join('docs', 'i18n.md'));
  const agents = read('AGENTS.md');
  const claude = read('CLAUDE.md');

  // The SSOT itself must speak in exact tags — a branch/SHA/loose pin here would
  // silently invalidate every doc arm below (the docs copy the TAG).
  const tagPins: Record<string, string | null> = {
    ui: grab(pkg.dependencies['@phlix/ui'] ?? '', new RegExp(`^github:detain/phlix-ui#v(${SEMVER})$`)),
    contracts: grab(pkg.dependencies['@phlix/contracts'] ?? '', new RegExp(`^github:detain/phlix-contracts#v(${SEMVER})$`)),
    syncplay: grab(pkg.dependencies['@phlix/syncplay'] ?? '', new RegExp(`^github:detain/phlix-syncplay#v(${SEMVER})$`)),
  };

  it('package.json pins all three @phlix libraries to exact version tags (the doc arms read from here)', () => {
    expect(tagPins.ui).not.toBeNull();
    expect(tagPins.contracts).not.toBeNull();
    expect(tagPins.syncplay).not.toBeNull();
  });

  it('README badge carries the @phlix/ui tag', () => {
    expect(grab(readme, new RegExp(`%40phlix%2Fui-v(${SEMVER})-f5a524`))).toBe(tagPins.ui);
  });

  it('README Tech Stack list carries all three current tags', () => {
    for (const lib of ['ui', 'contracts', 'syncplay'] as const) {
      const expectRe = new RegExp(
        String.raw`^- \*\*\[\`@phlix/${lib}\`\]\(https://github\.com/detain/phlix-${lib}\)\*\* \`v(${SEMVER})\``,
        'm',
      );
      expect(grab(readme, expectRe), `README Tech Stack @phlix/${lib} line`).toBe(tagPins[lib]);
    }
  });

  it('README Tech Stack names package.json as the pin source + this gate by name', () => {
    expect(readme).toMatch(/source of truth: `package\.json`/);
    expect(readme).toMatch(/docsPinConsistency\.test\.ts/);
  });

  it('DEVELOPER.md header states all three github tag pins', () => {
    const header = grab(developer, new RegExp(String.raw`^(Pinned dependencies[^\n]*)`, 'm'));
    expect(header, 'DEVELOPER.md "Pinned dependencies:" line exists').not.toBeNull();
    expect(header ?? '').toContain(`phlix-ui#v${tagPins.ui}`);
    expect(header ?? '').toContain(`phlix-contracts#v${tagPins.contracts}`);
    expect(header ?? '', 'syncplay was omitted entirely by the review').toContain(`phlix-syncplay#v${tagPins.syncplay}`);
  });

  it('DEVELOPER.md export-contract prose speaks of THE PINNED TAG, never a fossil version', () => {
    // v0.74.0-era hardcoded "must export" line — the review's fifth answer, a pin
    // string so old it predates the 0.99 lineage entirely. The law is about the
    // pinned tag, so the sentence must not carry a number at all.
    expect(developer).not.toMatch(/@phlix\/ui`? v0\.\d+\.\d+`? must export/);
    expect(developer).toMatch(/The pinned `@phlix\/ui` tag must export/);
  });

  it('docs/i18n.md seam section carries the installed ui tag + distinguishes the locale-bundle PIN ref', () => {
    expect(grab(i18nDoc, new RegExp(`Installed pin: \`@phlix/ui\` \`github:detain/phlix-ui#v(${SEMVER})\``)))
      .toBe(tagPins.ui);
    // The conflation the review caught: the heading stated the VENDORED locale ref
    // (a580410f, v0.99.8-era) as the "resolved pin". That phrasing is dead law.
    expect(i18nDoc).not.toMatch(/resolved pin `v/);
    expect(i18nDoc).toMatch(/ui-locale-bundles\/PIN/);
  });

  it('AGENTS.md pin line carries all three current tags', () => {
    expect(grab(agents, new RegExp(String.raw`@phlix/ui#v(${SEMVER})`)), 'AGENTS.md @phlix/ui').toBe(tagPins.ui);
    expect(grab(agents, new RegExp(`@phlix/contracts#v(${SEMVER})`)), 'AGENTS.md @phlix/contracts').toBe(tagPins.contracts);
    expect(grab(agents, new RegExp(`@phlix/syncplay#v(${SEMVER})`)), 'AGENTS.md @phlix/syncplay').toBe(tagPins.syncplay);
  });

  it('CLAUDE.md pin line carries all three current tags', () => {
    for (const lib of ['ui', 'contracts', 'syncplay'] as const) {
      const anchor = lib === 'ui'
        ? new RegExp(`Pinned: \`@phlix/ui\` \`github:detain/phlix-ui#v(${SEMVER})\``)
        : new RegExp(`\`@phlix/${lib}\` \`#v(${SEMVER})\``);
      expect(grab(claude, anchor), `CLAUDE.md @phlix/${lib}`).toBe(tagPins[lib]);
    }
  });
});
