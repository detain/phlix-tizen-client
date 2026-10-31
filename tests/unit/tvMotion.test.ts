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
