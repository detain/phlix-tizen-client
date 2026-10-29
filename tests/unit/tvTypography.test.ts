/**
 * tvTypography — the TV couch-legibility laws (M-TIZEN-11 / review tizen__gameux M3).
 *
 * THE DEFECT: the fixed-viewport widget (index.html meta width=1920) shipped
 * with NO declared root font-size, so ui's desktop-tuned token ladder rendered
 * 11-17px body text on a 1920-px canvas — half the smallest size mainstream TV
 * UIs ship, unreadable from couch distance. The cure is host-side, two-part:
 * `html { font-size: 24px }` in index.html (the fixed-viewport first-frame
 * contract; scales every rem proportionally — controls, spacing, clamp rungs)
 * plus src/styles/tv-typography.css re-flooring the six small ladder rungs in
 * `html:root` (specificity 0,1,1 beats the vendor `:root` 0,1,0 block
 * order-independently). The vendored @phlix/ui tree is NOT touched (estate
 * law) — test 6 below proves the shipped vendor ladder survives byte-intact.
 *
 * WHAT EACH TEST PINS (red on parent 3108866; each failure names its law):
 *  1. root raise declared host-side, in the SOURCE index.html (paints frame one);
 *  2. root raise present in the BUILT package/index.html (rebuild law — a cure
 *     that never reached the shipped widget is theater; mirrors the CI
 *     "Assert committed package/ is fresh" gate);
 *  3. every splash inline px size ≥ the 24px couch floor (the absolute-px
 *     first-frame idiom is allow-listed BY VALUE, never blanket);
 *  4. the host ladder: six small rungs explicit, ≥24px, strictly monotonic;
 *  5. the specificity mechanism (`html:root`) + import order after vendor CSS
 *     (belt and braces: cascade order can never silently un-floor the ladder);
 *  6. vendored token block byte-intact in the shipped bundle (anti-fork law);
 *  7. THE FLOOR LAW, end-to-end math: every rung of the EFFECTIVE ladder —
 *     host six + the six untouched clamp rungs resolved at root 24 on the
 *     1920 canvas — renders ≥24px, with lg < xl monotonic continuity at the
 *     override/natural seam;
 *  8. src-wide sweep law: no literal px/rem/em/% font sizes anywhere in host
 *     styles — every size consumes the token ladder (comments don't count;
 *     the allow-list is exactly index.html's inline splash block);
 *  9. the review's named evidence anchors (ChapterOverlay's four micro rules)
 *     are tokenized.
 *
 * Scope note (residual): ~9 vendored player-chrome rules hardcode px instead
 * of consuming tokens (.chapterlist__* etc. — table in
 * .reviews/fixlog/M-TIZEN-11__fix.md). They are upstream @phlix/ui scope:
 * host-side reach would mean duplicating hash-scoped vendor selectors, the
 * exact fragility the anti-fork law exists to prevent.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(__dirname, '..', '..');
const SRC = join(REPO, 'src');
const ASSETS = join(REPO, 'package', 'assets');

/** index.html's declared rem base — the fixed-viewport raise (test 1 pins it). */
const ROOT_FONT_PX = 24;
/** The fixed canvas: meta width=1920 (test reads it, math uses it). */
const TV_VIEWPORT_W_PX = 1920;
/** LEGIBILITY FLOOR LAW: smallest rendered text class on TV, in px. */
const COUCH_FLOOR_PX = 24;

function readSourceIndexHtml(): string {
  return readFileSync(join(REPO, 'index.html'), 'utf8');
}

/** Concatenated CSS of the built widget bundle (vendor + host layers). */
function readBuiltCss(): { file: string; css: string }[] {
  return readdirSync(ASSETS)
    .filter((f) => f.endsWith('.css'))
    .map((f) => ({ file: f, css: readFileSync(join(ASSETS, f), 'utf8') }));
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every host style-bearing file under src/ (.vue <style> and .css). */
function hostStyleFiles(dir = SRC): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...hostStyleFiles(full));
    } else if (entry.endsWith('.vue') || entry.endsWith('.css')) {
      found.push(full);
    }
  }
  return found.sort();
}

/** The <style> blocks inside a .vue file (all of them; comments kept). */
function styleBlocksOf(source: string): string {
  const blocks: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    blocks.push(m[1]);
  }
  return blocks.join('\n');
}

/** Effective px of a `font-size`/`font:` declaration value (number → px). */
function fontSizeValues(css: string): number[] {
  const clean = stripCssComments(css);
  const values: number[] = [];
  const re = /font(?:-size)?\s*:\s*([^;}]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    const decl = m[1];
    const px = /(\d+(?:\.\d+)?)px/.exec(decl);
    if (px) {
      values.push(parseFloat(px[1]));
    }
  }
  return values;
}

/** Resolve clamp(minRem, aRem + bVw, maxRem) at the declared root + canvas. */
function resolveClampPx(expr: string, rootPx: number, viewportW: number): number {
  const m = /clamp\(\s*([\d.]+)rem\s*,\s*([\d.]+)rem\s*\+\s*([\d.]+)vw\s*,\s*([\d.]+)rem\s*\)/.exec(expr);
  expect(m, `unparsable clamp expression: ${expr}`).not.toBeNull();
  const [, minRem, prefRem, prefVw, maxRem] = m as RegExpExecArray;
  const preferred = parseFloat(prefRem) * rootPx + (parseFloat(prefVw) * viewportW) / 100;
  return Math.min(parseFloat(maxRem) * rootPx, Math.max(parseFloat(minRem) * rootPx, preferred));
}

describe('tvTypography — M-TIZEN-11 TV couch-legibility laws', () => {
  it('raises the rem base host-side in the source index.html (root font story)', () => {
    const html = readSourceIndexHtml();
    // The fixed-viewport meta and the root raise are ONE story told in ONE
    // file: viewport pins the canvas, font-size pins what 1rem means on it.
    expect(html).toMatch(/name=["']viewport["'][^>]*width=1920/);
    const style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    const rule = /html\s*\{([^}]*)\}/.exec(stripCssComments(style));
    expect(rule, 'index.html inline style must declare an html rule').not.toBeNull();
    expect(/font-size:\s*24px/.test(rule![1]), 'html rule must declare font-size: 24px').toBe(true);
  });

  it('carries the root raise into the built widget (package/ rebuild law)', () => {
    const built = readFileSync(join(REPO, 'package', 'index.html'), 'utf8');
    const style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(built)?.[1] ?? '';
    expect(
      /html\s*\{[^}]*font-size:\s*24px/.test(stripCssComments(style)),
      'the SHIPPED widget must carry the root raise — rebuild package/ (npm run package) after editing index.html'
    ).toBe(true);
  });

  it('keeps every allow-listed splash px font size at or above the couch floor', () => {
    // index.html inline px is the sanctioned first-frame idiom (splash paints
    // before any stylesheet exists) — but px is not exempt from the FLOOR.
    const html = readSourceIndexHtml();
    const style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
    const sizes = fontSizeValues(style);
    expect(sizes.length).toBeGreaterThanOrEqual(2); // wordmark + hint present
    for (const size of sizes) {
      expect(size, `splash font-size ${size}px is under the ${COUCH_FLOOR_PX}px couch floor`).toBeGreaterThanOrEqual(COUCH_FLOOR_PX);
    }
  });

  it('floors the six sub-floor ladder rungs in host CSS, monotonically', () => {
    const file = join(SRC, 'styles', 'tv-typography.css');
    expect(existsSync(file), 'src/styles/tv-typography.css must exist').toBe(true);
    const css = stripCssComments(readFileSync(file, 'utf8'));
    const rungs = ['--text-2xs', '--text-xs', '--text-sm', '--text-base', '--text-md', '--text-lg'] as const;
    const values = rungs.map((rung) => {
      const m = new RegExp(`${rung}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(css);
      expect(m, `${rung} must be floored in px by the host layer`).not.toBeNull();
      return parseFloat(m![1]);
    });
    for (let i = 0; i < values.length; i += 1) {
      expect(values[i], `${rungs[i]} under the couch floor`).toBeGreaterThanOrEqual(COUCH_FLOOR_PX);
      if (i > 0) {
        expect(values[i], `ladder not monotonic at ${rungs[i]}`).toBeGreaterThan(values[i - 1]);
      }
    }
  });

  it('wins the vendor cascade by specificity AND import order (belt + braces)', () => {
    const css = stripCssComments(readFileSync(join(SRC, 'styles', 'tv-typography.css'), 'utf8'));
    // html:root = 0,1,1 — beats the vendored `:root` token block (0,1,0)
    // regardless of emitted order. A bare `:root` here would silently lose
    // if the bundle order ever flipped.
    expect(/html:root\s*\{/.test(css), 'host floor must use the html:root compound selector').toBe(true);

    const main = readFileSync(join(SRC, 'main.ts'), 'utf8');
    const vendor = main.indexOf("import '@phlix/ui/style.css'");
    const host = main.indexOf("import './styles/tv-typography.css'");
    expect(vendor).toBeGreaterThan(-1);
    expect(host, 'tv-typography.css must be imported by main.ts').toBeGreaterThan(vendor);
  });

  it('leaves the vendored desktop ladder byte-intact in the shipped bundle (anti-fork law)', () => {
    const vendorTokens: Record<string, string> = {
      '--text-2xs': '.6875rem',
      '--text-xs': '.75rem',
      '--text-sm': '.8125rem',
      '--text-base': '.9375rem',
      '--text-md': '1.0625rem',
      '--text-lg': '1.25rem',
    };
    const allCss = readBuiltCss().map((f) => f.css).join('\n');
    expect(allCss.length).toBeGreaterThan(0);
    for (const [token, desktopValue] of Object.entries(vendorTokens)) {
      // The cure is host-side override; the vendored ladder itself stays as
      // upstream shipped it. If this reddens on a @phlix/ui re-vendor, that
      // is the re-pin ritual (moved pins are re-pins, not silent resets).
      expect(allCss, `vendored ${token} was forked — vendored files are read-only`).toContain(`${token}:${desktopValue}`);
    }
  });

  it('renders EVERY rung of the effective ladder ≥ the 24px couch floor at root 24 on the 1920 canvas', () => {
    // Full-mechanism math, read from disk (not from the cure prose): the host
    // six + the untouched clamp rungs parsed from the shipped bundle,
    // resolved exactly as the TV engine will.
    const hostCss = stripCssComments(readFileSync(join(SRC, 'styles', 'tv-typography.css'), 'utf8'));
    const allCss = readBuiltCss().map((f) => f.css).join('\n');

    const effective: Record<string, number> = {};
    for (const rung of ['2xs', 'xs', 'sm', 'base', 'md', 'lg']) {
      effective[rung] = parseFloat(new RegExp(`--text-${rung}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(hostCss)![1]);
    }
    for (const rung of ['xl', '2xl', '3xl', '4xl', '5xl', 'hero']) {
      const expr = new RegExp(`--text-${rung}:\\s*(clamp\\([^)]*\\))`).exec(allCss);
      expect(expr, `--text-${rung} clamp vanished from the vendor block`).not.toBeNull();
      effective[rung] = resolveClampPx(expr![1], ROOT_FONT_PX, TV_VIEWPORT_W_PX);
    }

    for (const [rung, px] of Object.entries(effective)) {
      expect(px, `--text-${rung} renders ${px}px < ${COUCH_FLOOR_PX}px floor`).toBeGreaterThanOrEqual(COUCH_FLOOR_PX);
    }
    // Monotonic continuity across the override/natural seam (lg host-set,
    // xl untouched): the raise must not invert the ladder.
    const order = ['2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'] as const;
    for (let i = 1; i < order.length; i += 1) {
      expect(effective[order[i]], `ladder inverts at ${order[i]}`).toBeGreaterThan(effective[order[i - 1]]);
    }
  });

  it('bans literal px/rem/em/% font sizes in host styles — every size rides the ladder', () => {
    // The sweep law: a base raise can only fix what scales. Literal sizes in
    // host styles are invisible to the system and rot at 16px-era values.
    // Allow-list is exactly index.html's inline splash block (tested above
    // BY VALUE); this file covers src/, so it must be ZERO-penalty strict.
    const offenders: string[] = [];
    for (const file of hostStyleFiles()) {
      const raw = file.endsWith('.css') ? readFileSync(file, 'utf8') : styleBlocksOf(readFileSync(file, 'utf8'));
      const css = stripCssComments(raw);
      const rel = file.slice(REPO.length + 1);
      // Any font/font-size declaration; blank out var(...) spans first so the
      // sanctioned house pattern `var(--text-sm, 0.875rem)` (fallback = dead
      // code while the vendor :root defines the token) is not misread as a
      // literal. What survives must carry no unit-bearing number.
      const declRe = /\bfont(?:-size)?\s*:\s*([^;}]+)/g;
      let m: RegExpExecArray | null;
      while ((m = declRe.exec(css)) !== null) {
        const decl = m[1].replace(/var\([^()]*\)/g, 'VAR');
        if (/\b\d+(?:\.\d+)?(px|rem|em|%)\b/.test(decl)) {
          offenders.push(`${rel}: ${m[0].trim()}`);
        }
      }
    }
    expect(offenders, `font sizes must consume the --text-* ladder:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('tokenizes the review-named ChapterOverlay evidence anchors', () => {
    const css = stripCssComments(styleBlocksOf(readFileSync(join(SRC, 'components', 'ChapterOverlay.vue'), 'utf8')));
    for (const selector of [
      'chapter-overlay__ad-badge',
      'chapter-overlay__tooltip-label',
      'chapter-overlay__tooltip-time',
      'chapter-overlay__label',
    ]) {
      const rule = new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`).exec(css);
      expect(rule, `.${selector} must exist`).not.toBeNull();
      expect(rule![1], `.${selector} still bypasses the ladder`).toMatch(/font-size:\s*var\(--text-/);
    }
  });
});
