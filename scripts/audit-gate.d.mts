/**
 * Type declarations for scripts/audit-gate.mjs (the gate script itself is
 * plain ESM, shared byte-shape with the windows/website design). Tests import
 * the pure decision core; CI runs the CLI entry.
 */

export const EXIT_OK: 0;
export const EXIT_VIOLATION: 1;
export const EXIT_STRUCTURE_ERROR: 2;

export interface AllowedAdvisoryEntry {
  package: string;
  justification: string;
}

export declare const ALLOWED_ADVISORIES: Map<string, AllowedAdvisoryEntry>;

export declare class AuditGateError extends Error {}

export interface AuditRunFacts {
  exitCode: number;
  stdout: string;
  stderr: string;
  spawnError: Error | null;
}

export interface AuditVerdict {
  code: number;
  clean: boolean;
  allowed: string[];
  unknown: string[];
  problems: string[];
}

export declare function runAudit(): AuditRunFacts;
export declare function collectAdvisoryIds(stdout: string): Set<string>;
export declare function decide(facts: {
  exitCode: number;
  stdout: string;
  spawnError?: Error | null;
  allowList?: Map<string, AllowedAdvisoryEntry | { package: string; justification: string }>;
}): AuditVerdict;
export declare function main(): number;
