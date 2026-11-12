/**
 * Type declarations for scripts/insecure-hatch-gate.mjs (plain ESM; the sibling
 * audit-gate.d.mts / version-sync.d.mts are the precedent for this seam).
 * Mirrors the module's actual exports.
 */

export declare const INSECURE_HATCH_PREFIX: string;

export interface HatchBundleHit {
  file: string;
  hatches: string[];
}

export declare function findCompiledHatches(text: string): string[];

export declare function findEnvHatches(env: Record<string, string | undefined>): string[];

export declare function scanBuildDir(dir: string): HatchBundleHit[];

export declare function describeViolations(facts: {
  envHatches?: string[];
  bundleHits?: HatchBundleHit[];
  label?: string;
}): string[];
