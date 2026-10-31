/**
 * Type declarations for scripts/version-sync.mjs (the stamping CLI is plain
 * ESM; the sibling audit-gate.d.mts is the precedent for this seam). Mirrors
 * the module's actual exports and the JSDoc contract: each stamper returns
 * the NEW text, or null when the input is already in sync (no write). The
 * CLI arms exit(1) on malformed input — declared via `never` is wrong here
 * (the functions return normally), so the signatures stay honest.
 */

export declare const GENERATED_MARKER: string;
export declare const TELEMETRY_MARKER: string;

export declare function stampConfig(configText: string, version: string): string | null;

export declare function stampTelemetry(telemetryText: string, version: string): string | null;
