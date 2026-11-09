/**
 * tvMotion.test — M-TIZEN-35 (W-min170), the TV-era GPU posture.
 *
 * Two halves: the pure decide/apply law in src/tvMotion.ts, and the shipped
 * source pins that make the mitigation REAL on the sealed bundle — the
 * stylesheet must exist, must carry the blanket backdrop kill under the
 * agreed class, and main.ts must import it AFTER the vendor stylesheets (the
 * tv-typography import-order idiom) and apply the class at boot. A CSS layer
 * that loads before the vendor bundle is a layer that loses the cascade —
 * this pin is the difference between a mitigation and a shrug.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  TV_MOTION_KEY,
  TV_MOTION_LITE_CLASS,
  resolveTvMotionLite,
  applyTvMotionClass,
} from '@/tvMotion';

const REPO = path.resolve(__dirname, '..', '..');

function fakeBody(): { classList: { toggle(name: string, on: boolean): void; contains(name: string): boolean }; _classes: Set<string> } {
  const _classes = new Set<string>();
  return {
    _classes,
    classList: {
      toggle(name: string, on: boolean): void {
        if (on) _classes.add(name);
        else _classes.delete(name);
      },
      contains(name: string): boolean {
        return _classes.has(name);
      },
    },
  };
}

const store = (value: string | null) => ({ getItem: () => value });

describe('tvMotion — pure posture decide (M-TIZEN-35)', () => {
  it('the ONLY opt-out is the exact string "full"', () => {
    expect(resolveTvMotionLite(store('full'))).toBe(false);
  });

  it('TV-era default is lite; garbage opts into lite, never out of it', () => {
    expect(resolveTvMotionLite(store(null))).toBe(true);
    for (const raw of ['', 'FULL', 'Full ', 'on', '1', '0', 'false', 'anything']) {
      expect(resolveTvMotionLite(store(raw)), raw).toBe(true);
    }
  });

  it('apply toggles the agreed class and mirrors the decide verdict', () => {
    const body = fakeBody();
    expect(applyTvMotionClass(store(null), body as unknown as Pick<HTMLElement, "classList">)).toBe(true);
    expect(body._classes.has(TV_MOTION_LITE_CLASS)).toBe(true);
    expect(applyTvMotionClass(store('full'), body as unknown as Pick<HTMLElement, "classList">)).toBe(false);
    expect(body._classes.has(TV_MOTION_LITE_CLASS)).toBe(false);
  });

  it('the storage key and class name are the documented pair', () => {
    expect(TV_MOTION_KEY).toBe('phlix.tvMotion');
    expect(TV_MOTION_LITE_CLASS).toBe('tv-motion-lite');
  });
});

describe('tvMotion — shipped-source pins', () => {
  const css = readFileSync(path.join(REPO, 'src', 'styles', 'tv-motion.css'), 'utf8');
  const mainSource = readFileSync(path.join(REPO, 'src', 'main.ts'), 'utf8');

  it('the stylesheet kills backdrop blur under the gate class (the seal tax: blanket + !important)', () => {
    expect(css).toContain(`.${TV_MOTION_LITE_CLASS} *`);
    expect(css).toMatch(/backdrop-filter:\s*none\s*!important/);
    expect(css).toMatch(/-webkit-backdrop-filter:\s*none\s*!important/);
  });

  it('it does NOT blanket-override transition durations (disclosed trap: override would ADD motion where 0s exists)', () => {
    expect(css).not.toMatch(/transition[^;]*!important/);
  });

  it('main.ts imports the layer AFTER the vendor @phlix/ui stylesheet (cascade order is the fix)', () => {
    const vendorStyle = mainSource.indexOf("@phlix/ui/style.css'");
    const typography = mainSource.indexOf("import './styles/tv-typography.css'");
    const motion = mainSource.indexOf("import './styles/tv-motion.css'");
    expect(vendorStyle, 'vendor style import present').toBeGreaterThan(-1);
    expect(typography, 'typography layer present').toBeGreaterThan(-1);
    expect(motion, 'motion layer present').toBeGreaterThan(-1);
    expect(motion).toBeGreaterThan(vendorStyle);
    expect(motion).toBeGreaterThan(typography);
  });

  it('boot applies the class (the decide half is actually wired)', () => {
    expect(mainSource).toMatch(/applyTvMotionClass\(storage,\s*document\.body\)/);
  });
});

// ---- RT-102 (w13-L4, gameux#3): loading must LOOK like loading at 10 feet ----
// The per-screen loading branches used to be one static sentence — visually
// identical to a hung app on a wall-mounted panel. The shared skeleton layer
// now breathes under the SAME compositor-choir posture this suite polices:
// opacity + transform only, no blur/backdrop anywhere in it, and the reduced-
// motion escape kills the animation outright. Its token VALUES live in
// tv-typography.css because the blanket policy grep above only scans
// tv-motion.css — pinning that split here keeps the grep's scope honest.
describe('RT-102 loading-skeleton layer', () => {
  const skeletonCss = readFileSync(path.join(REPO, 'src', 'styles', 'tv-loading.css'), 'utf8');
  const mainSource = readFileSync(path.join(REPO, 'src', 'main.ts'), 'utf8');

  it('the layer exists, breathes with keyframes, and stops under prefers-reduced-motion', () => {
    expect(skeletonCss).toMatch(/@keyframes\s+tv-skeleton-breath/);
    expect(skeletonCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none/);
  });

  it('uses ONLY compositor-cheap properties (the M-TIZEN-35 law, re-applied to the new layer)', () => {
    // Judge the RULES, not the header prose (the header NAMES the banned
    // properties to explain the ban — matching it there would be the test
    // tripping on its own caption).
    const rules = skeletonCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rules).toMatch(/opacity:/);
    expect(rules).toMatch(/transform:/);
    expect(rules).not.toMatch(/backdrop-filter/);
    expect(rules).not.toMatch(/[^-]filter:/);
    expect(rules).not.toMatch(/box-shadow/);
    expect(rules).not.toMatch(/\bblur\(/);
  });

  it('the skeleton tokens live in tv-typography.css, OUT OF the policy-scanned tv-motion.css', () => {
    const typography = readFileSync(path.join(REPO, 'src', 'styles', 'tv-typography.css'), 'utf8');
    const motion = readFileSync(path.join(REPO, 'src', 'styles', 'tv-motion.css'), 'utf8');
    expect(typography).toMatch(/--tv-skeleton-breathe-ms/);
    expect(motion).not.toMatch(/--tv-skeleton/);
  });

  it('main.ts imports the layer AFTER the motion layer (cascade order is the whole mitigation)', () => {
    const motion = mainSource.indexOf("import './styles/tv-motion.css'");
    const loading = mainSource.indexOf("import './styles/tv-loading.css'");
    expect(motion).toBeGreaterThan(-1);
    expect(loading, 'tv-loading.css imported by main.ts').toBeGreaterThan(-1);
    expect(loading).toBeGreaterThan(motion);
  });

  it('every loading branch that used to be a static sentence now carries the skeleton', () => {
    const files = [
      'src/screens/RecommendationsScreen.vue',
      'src/pages/AudioTracksPage.vue',
      'src/pages/SubtitleTracksPage.vue',
      'src/pages/ChaptersPage.vue',
      'src/pages/ParentalControlsPage.vue',
    ];
    for (const rel of files) {
      const src = readFileSync(path.join(REPO, rel), 'utf8');
      expect(src, rel + ' carries the skeleton').toContain('tv-loading-skeleton');
      // aria-hidden: the breathing bars decorate the status label; they are
      // never announced themselves (the sentence keeps the role=status job).
      for (const line of src.split('\n')) {
        if (line.includes('tv-loading-skeleton')) expect(line).toContain('aria-hidden');
      }
    }
    // ParentalControls has three loading sections — each one gets the treatment.
    const parental = readFileSync(path.join(REPO, 'src/pages/ParentalControlsPage.vue'), 'utf8');
    expect(parental.match(/tv-loading-skeleton/g)?.length).toBe(3);
  });
});
