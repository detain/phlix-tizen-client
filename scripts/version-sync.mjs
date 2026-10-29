/**
 * Version stamping — single source of truth (review tizen__devops MAJ-2,
 * M-TIZEN-05; r2 adds the telemetry carrier per review MAJOR-1).
 *
 * package.json "version" is the ONE version declaration for the widget. This
 * script stamps it into TWO carriers:
 *   - app/config.xml's <widget version="..."> attribute — the version the TV
 *     and the Samsung store read (+ GENERATED_MARKER comment), and
 *   - src/telemetry.ts's CLIENT_VERSION literal — the version every opted-in
 *     TV POSTs to the server as `version` AND `build` on the heartbeat
 *     (+ TELEMETRY_MARKER comment; before r2 this was a hand-maintained
 *     mirror no automation or test touched).
 * `npm run package` runs this FIRST — before `npm run build` — so the Vite
 * bundle too carries the stamped constant, and before scripts/package.js
 * assembles package/, so the committed mirror always carries the stamped bytes.
 * The drift pin (tests/unit/versionStamping.test.ts) asserts both equalities,
 * both markers and the chain order.
 *
 * Estate siblings: phlix-roku-client scripts/derive-version.sh + Makefile:24-27
 * (build-time manifest injection, R8.8) with verify-runtime.sh Check 18 as the
 * drift gate; phlix-windows-client .github/workflows/build.yml version-check
 * job (tag == package.json). Tizen has no Makefile, so the stamp lives in the
 * npm package chain instead.
 *
 * Idempotent: when both carriers already carry the SSOT version and the
 * markers, nothing is written — local dev sees zero churn.
 *
 * Fail-loud: a non-semver package.json version, a config.xml whose <widget>
 * tag has no (or two) version attributes, or a src/telemetry.ts whose
 * CLIENT_VERSION declaration is missing or duplicated all exit 1 rather than
 * silently shipping a widget the TV, the store or the server would read at the
 * wrong version forever.
 *
 * Run via `npm run version:sync` (manual) or `npm run package` (automatic,
 * first in the chain). Bumping a release = change package.json "version"
 * once, refresh the tracked lock, then `npm run package`; see DEVELOPER.md
 * "Versioning".
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const configPath = path.join(root, 'app', 'config.xml');
const telemetryPath = path.join(root, 'src', 'telemetry.ts');

/** Marker comment stamped into app/config.xml (imported by the drift pin — one source). */
export const GENERATED_MARKER =
  '<!-- generated: run scripts/version-sync — widget version is stamped from package.json (single source); do not hand-edit -->';

/**
 * Marker comment stamped beside CLIENT_VERSION in src/telemetry.ts (imported
 * by the drift pin — one source). It rides as a trailing comment on the
 * stamped line itself, so the docblock above stays attached to the constant
 * and the marker is impossible to decouple from what it certifies.
 */
export const TELEMETRY_MARKER =
  'generated: stamped from package.json by scripts/version-sync (single source); do not hand-edit';

const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const WIDGET_VERSION = /(<widget\b[^>]*\bversion=")[^"]*(")/;
const XML_DECL = /^<\?xml[^>]*\?>\r?\n/;
const TELEMETRY_DECL = /^export const CLIENT_VERSION = '[^']*';.*$/m;

/**
 * Read the SSOT version out of package.json. Fail loud on anything that is not
 * a plain version — a typo here must never reach a store submission.
 */
function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (typeof pkg.version !== 'string' || !SEMVER.test(pkg.version)) {
    console.error(
      `version-sync: package.json "version" is not semver (got ${JSON.stringify(pkg.version)})`
    );
    process.exit(1);
  }
  return pkg.version;
}

/**
 * Rewrite app/config.xml so <widget version="..."> equals the SSOT version and
 * the generated marker sits directly beneath the XML declaration.
 * Returns the new text, or null when the file is already in sync (no write).
 */
export function stampConfig(configText, version) {
  const matches = configText.match(new RegExp(WIDGET_VERSION.source, 'g'));
  if (!matches || matches.length !== 1) {
    console.error(
      `version-sync: expected exactly one <widget version="..."> in app/config.xml, found ${matches ? matches.length : 0}`
    );
    process.exit(1);
  }

  let next = configText.replace(WIDGET_VERSION, `$1${version}$2`);

  if (!next.includes(GENERATED_MARKER)) {
    if (!XML_DECL.test(next)) {
      console.error('version-sync: app/config.xml has no leading <?xml ...?> declaration');
      process.exit(1);
    }
    next = next.replace(XML_DECL, (decl) => `${decl}${GENERATED_MARKER}\n`);
  }

  return next === configText ? null : next;
}

/**
 * Rewrite src/telemetry.ts so the CLIENT_VERSION literal equals the SSOT
 * version and the line carries the trailing TELEMETRY_MARKER. Returns the new
 * text, or null when the file is already in sync (no write).
 */
export function stampTelemetry(telemetryText, version) {
  const matches = telemetryText.match(new RegExp(TELEMETRY_DECL.source, 'gm'));
  if (!matches || matches.length !== 1) {
    console.error(
      `version-sync: expected exactly one "export const CLIENT_VERSION = '...'" line in src/telemetry.ts, found ${matches ? matches.length : 0}`
    );
    process.exit(1);
  }

  const next = telemetryText.replace(
    TELEMETRY_DECL,
    `export const CLIENT_VERSION = '${version}'; // ${TELEMETRY_MARKER}`
  );
  return next === telemetryText ? null : next;
}

function main() {
  const version = readPackageVersion();
  const targets = [
    { label: 'app/config.xml', file: configPath, stamp: stampConfig },
    { label: 'src/telemetry.ts', file: telemetryPath, stamp: stampTelemetry },
  ];

  for (const { label, file, stamp } of targets) {
    const before = fs.readFileSync(file, 'utf8');
    const after = stamp(before, version);

    if (after === null) {
      console.log(`version-sync: ${label} already stamped at ${version} (in sync, nothing written)`);
      continue;
    }

    fs.writeFileSync(file, after);
    console.log(`version-sync: ${label} version stamped to ${version}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
