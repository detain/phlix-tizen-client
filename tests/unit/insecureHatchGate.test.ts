/**
 * insecureHatchGate — TIZ-S9 (review TIZ-20): the insecure-dial dev hatches
 * must be compiled OFF in every packaged widget.
 *
 * Pinned laws:
 *  1. BUNDLE KEY LAW: a hatch name compiled as an env-object KEY (the shape
 *     Vite emits for `import.meta.env[CONST]` when the variable is set) is
 *     detected in every quoting form; the hatch-name CONSTANT and the
 *     resolveConfig `…_INSECURE_* hatch` message are NOT keys and never match,
 *     so a clean build stays green.
 *  2. ENV LAW: any hatch variable present in the resolved build env (any
 *     value, not just '1') is a violation; unrelated VITE_ vars are not.
 *  3. PREFIX LAW: both shipped hatch constants start with the gate prefix, and
 *     both readers use bracket access on that constant (the shape the bundle
 *     leg scans), so a rename or a dot-access refactor cannot slip past.
 *  4. WIRING LAW: scripts/package.js runs the gate on dist/ before package/ is
 *     rebuilt (env leg on) and again on package/ after assembly.
 *  5. COMMITTED MIRROR: the tracked package/ widget carries no hatch today.
 *
 * Mutation proof at the fix lane: `VITE_PHLIX_DEV_ALLOW_INSECURE_RELAY=1
 * npm run package` exits 1 on the env leg; a hatched `npm run build` followed
 * by a clean-env `node scripts/package.js` exits 1 on the bundle leg.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INSECURE_HATCH_PREFIX,
  describeViolations,
  findCompiledHatches,
  findEnvHatches,
  scanBuildDir,
} from '../../scripts/insecure-hatch-gate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RELAY = 'VITE_PHLIX_DEV_ALLOW_INSECURE_RELAY';
const SYNCPLAY = 'VITE_PHLIX_DEV_ALLOW_INSECURE_SYNCPLAY';

/** The exact clean shape Vite 8 emits for the relay reader today. */
const CLEAN_READER =
  'var xh=`VITE_PHLIX_DEV_ALLOW_INSECURE_RELAY`;function Sh(){return{BASE_URL:`./`,' +
  'DEV:!1,MODE:`production`,PROD:!0,SSR:!1}[xh]===`1`}';

describe('findCompiledHatches — bundle key law', () => {
  it('a clean build (constant + env literal without the key) is green', () => {
    expect(findCompiledHatches(CLEAN_READER)).toEqual([]);
  });

  it('the resolveConfig wildcard message is not a key', () => {
    expect(
      findCompiledHatches("the consumer's VITE_PHLIX_DEV_ALLOW_INSECURE_* hatch (exactly '1') relaxes this gate")
    ).toEqual([]);
  });

  it('detects a set hatch in the inlined env object (bare key)', () => {
    const hatched = CLEAN_READER.replace('SSR:!1}', `SSR:!1,${RELAY}:\`1\`}`);
    expect(findCompiledHatches(hatched)).toEqual([RELAY]);
  });

  it.each([
    [`{"${SYNCPLAY}":"1"}`],
    [`{'${SYNCPLAY}':'1'}`],
    [`{\`${SYNCPLAY}\`:\`1\`}`],
    [`{${SYNCPLAY} : "0"}`],
  ])('detects quoted / spaced / any-value key forms: %s', (text) => {
    expect(findCompiledHatches(text)).toEqual([SYNCPLAY]);
  });

  it('covers a future third hatch by prefix, and de-duplicates + sorts', () => {
    const text = `{${SYNCPLAY}:"1"},{${RELAY}:"1"},{${RELAY}:"1"},{${INSECURE_HATCH_PREFIX}CAST:"1"}`;
    expect(findCompiledHatches(text)).toEqual([`${INSECURE_HATCH_PREFIX}CAST`, RELAY, SYNCPLAY]);
  });

  it('does not match a longer identifier that merely ends in the prefix', () => {
    expect(findCompiledHatches(`{X${RELAY}:"1"}`)).toEqual([]);
  });
});

describe('findEnvHatches — env law', () => {
  it('flags any hatch variable present, whatever its value', () => {
    expect(findEnvHatches({ [RELAY]: '1', [SYNCPLAY]: '0', VITE_PHLIX_TV_ADMIN: '1' })).toEqual([
      RELAY,
      SYNCPLAY,
    ]);
  });

  it('an env with no hatch is green', () => {
    expect(findEnvHatches({ VITE_PHLIX_SERVER_URL: 'https://x', VITE_PHLIX_TV_ADMIN: '1' })).toEqual([]);
  });
});

describe('scanBuildDir + describeViolations', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('reports only the offending compiled files, relative and sorted', () => {
    dir = mkdtempSync(join(tmpdir(), 'hatch-gate-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<script type="module" src="./assets/index.js"></script>');
    writeFileSync(join(dir, 'assets', 'index.js'), CLEAN_READER.replace('SSR:!1}', `SSR:!1,${RELAY}:\`1\`}`));
    writeFileSync(join(dir, 'assets', 'clean.js'), CLEAN_READER);
    writeFileSync(join(dir, 'assets', 'notes.txt'), `{${SYNCPLAY}:"1"}`); // not a compiled extension
    const hits = scanBuildDir(dir);
    expect(hits).toEqual([{ file: join('assets', 'index.js'), hatches: [RELAY] }]);
    const lines = describeViolations({ envHatches: [SYNCPLAY], bundleHits: hits, label: 'dist' });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain(SYNCPLAY);
    expect(lines[1]).toContain(`dist/${join('assets', 'index.js')}`);
    expect(lines[1]).toContain(RELAY);
  });

  it('no violations means no lines (green)', () => {
    expect(describeViolations({})).toEqual([]);
  });
});

describe('prefix + wiring laws', () => {
  it.each([
    ['src/api/hubRelay.ts', 'HUB_RELAY_INSECURE_DEV_HATCH_ENV', RELAY],
    ['src/syncplayTransport.ts', 'SYNCPLAY_INSECURE_DEV_HATCH_ENV', SYNCPLAY],
  ])('%s declares its hatch under the gate prefix and reads it by bracket access', (file, constName, value) => {
    const src = readFileSync(join(ROOT, file), 'utf8');
    expect(src).toContain(`export const ${constName} = '${value}';`);
    expect(value.startsWith(INSECURE_HATCH_PREFIX)).toBe(true);
    expect(src).toContain(`import.meta.env[${constName}] === '1'`);
    // no dot-access reader (Vite would fold it to a bare literal the bundle leg cannot see)
    expect(src).not.toMatch(/import\.meta\.env\.VITE_PHLIX_DEV_ALLOW_INSECURE_/);
  });

  it('scripts/package.js gates dist/ (env leg on) before rebuilding package/, then package/ itself', () => {
    const pkg = readFileSync(join(ROOT, 'scripts/package.js'), 'utf8');
    const distGate = pkg.indexOf("assertInsecureHatchesOff(distDir, 'dist', { checkEnv: true });");
    const wipe = pkg.indexOf('fs.rmSync(pkgDir');
    const pkgGate = pkg.indexOf("assertInsecureHatchesOff(pkgDir, 'package');");
    const done = pkg.indexOf("console.log('Package created in:'");
    expect(distGate).toBeGreaterThan(-1);
    expect(distGate).toBeLessThan(wipe);
    expect(pkgGate).toBeGreaterThan(wipe);
    expect(pkgGate).toBeLessThan(done);
    expect(pkg).toMatch(/problems\.length > 0\)[\s\S]*?process\.exit\(1\)/);
  });

  it('the committed package/ widget carries no compiled-in hatch', () => {
    expect(scanBuildDir(join(ROOT, 'package'))).toEqual([]);
  });
});
