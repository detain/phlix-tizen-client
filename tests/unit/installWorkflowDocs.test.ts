/**
 * installWorkflowDocs — CI install-truth tripwire (M-TIZEN-13 / review tizen__writer MAJOR-1).
 *
 * WHAT IT PINS: the human-facing docs (README.md §Install, DEVELOPER.md
 * §Prerequisites) must state the SAME install law the workflows actually run:
 * `npm ci --allow-git=all` from the TRACKED `package-lock.json` (audit W105 T-01).
 *
 * WHY A TRIPWIRE: the original defect was a prose fossil two re-pins behind
 * reality — d6b8bee (2026-05-15) flipped CI `npm ci -> npm install` when no lock
 * existed, W105 T-01 later committed the lock and moved every CI leg back to
 * `npm ci --allow-git=all`, updating AGENTS.md/CLAUDE.md/DEVELOPER §version-stamping
 * — but README.md:91 and DEVELOPER.md:357 were left claiming "CI uses `npm install`
 * (not `npm ci`) — `package-lock.json` is gitignored". A contributor following that
 * would skip committing lockfile changes and trust a floating resolve: a direct hit
 * on the repo's core reproducibility law. Same claim-side family as
 * distApiFloor.test.ts L1-L3 (docs and shipped surface must rotate together).
 *
 * RED-ON-PARENT: measured red at 39f4c7a (the false prose present, the truth
 * absent); green at the cure commit.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(__dirname, '..', '..');
const WORKFLOWS_DIR = join(REPO, '.github', 'workflows');

/** Docs that speak the install workflow. AGENTS.md/CLAUDE.md are excluded by
 * design (caliber-managed mirrors — estate law, same carve-out as distApiFloor L3). */
const CLAIM_DOCS = ['README.md', 'DEVELOPER.md'];

describe('installWorkflowDocs — docs state the CI-shipped install truth (M-TIZEN-13)', () => {
  for (const rel of CLAIM_DOCS) {
    describe(rel, () => {
      const text = readFileSync(join(REPO, rel), 'utf8');

      it('never claims the lock is gitignored or that package-lock is not committed', () => {
        // The false half of the fossil claim. `.gitignore` only ever carried a
        // TRACKED-comment for the lock, never an ignore rule.
        expect(text, `${rel} claims package-lock.json is gitignored`).not.toMatch(
          /package-lock\.json`? is gitignored/i
        );
      });

      it('never claims CI installs with `npm install`', () => {
        // The other false half. Local setup prose may (correctly) show
        // `npm install` for regenerating the lock — but never attributed to CI.
        expect(text, `${rel} attributes "npm install" to CI`).not.toMatch(
          /CI uses `npm install`/i
        );
      });

      it('states the shipped truth: npm ci --allow-git=all over the TRACKED lock, with W105 T-01 attribution', () => {
        expect(text).toContain('`npm ci --allow-git=all`');
        expect(text, `${rel} must name the lock as TRACKED/committed`).toMatch(
          /TRACKED|committed/
        );
        expect(text, `${rel} must carry the W105 T-01 attribution`).toContain('W105 T-01');
      });
    });
  }

  it('every CI install leg still runs `npm ci --allow-git=all` (docs+CI rotate together)', () => {
    // If a future lane ever moves the workflows off npm ci, this pin reddens in
    // the same change that must update the docs above — the L1 "rotate together"
    // law, so the two halves can never diverge silently again.
    const installRunRe = /run:\s+(npm (?:ci|install)[^\n]*)/g;
    const runs: { file: string; run: string }[] = [];
    for (const wf of readdirSync(WORKFLOWS_DIR)) {
      const text = readFileSync(join(WORKFLOWS_DIR, wf), 'utf8');
      for (const m of text.matchAll(installRunRe)) {
        if (m[1].startsWith('npm ci') || m[1].startsWith('npm install')) {
          runs.push({ file: wf, run: m[1].trim() });
        }
      }
    }
    expect(runs.length, 'CI install legs found').toBeGreaterThanOrEqual(4);
    for (const { file, run } of runs) {
      expect(run, `${file} install leg must be the pinned npm ci form`).toBe(
        'npm ci --allow-git=all'
      );
    }
  });
});
