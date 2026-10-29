/**
 * Version stamping — single source of truth (review tizen__devops MAJ-2, M-TIZEN-05).
 *
 * package.json "version" is the ONE version declaration for the widget. This
 * script stamps it into app/config.xml's <widget version="..."> attribute and
 * maintains the GENERATED marker comment that the drift pin
 * (tests/unit/versionStamping.test.ts) asserts. `npm run package` runs this
 * automatically before scripts/package.js assembles package/, so the committed
 * package/config.xml freshness mirror always carries the stamped bytes.
 *
 * Estate siblings: phlix-roku-client scripts/derive-version.sh + Makefile:24-27
 * (build-time manifest injection, R8.8) with verify-runtime.sh Check 18 as the
 * drift gate; phlix-windows-client .github/workflows/build.yml version-check
 * job (tag == package.json). Tizen has no Makefile, so the stamp lives in the
 * npm package chain instead.
 *
 * Idempotent: when config.xml already carries the SSOT version and the marker,
 * nothing is written — local dev sees zero churn.
 *
 * Fail-loud: a non-semver package.json version, or a config.xml whose <widget>
 * tag has no version attribute, exits 1 rather than silently shipping a widget
 * the TV or the Samsung store would read as 1.0.0 forever.
 *
 * Run via `npm run version:sync` (manual) or `npm run package` (automatic).
 * Bumping a release = change package.json "version" once, then `npm run
 * package`; see DEVELOPER.md "Versioning".
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const configPath = path.join(root, 'app', 'config.xml');

/** The marker comment stamped into app/config.xml (imported by the drift pin — one source). */
export const GENERATED_MARKER =
  '<!-- generated: run scripts/version-sync — widget version is stamped from package.json (single source); do not hand-edit -->';

const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const WIDGET_VERSION = /(<widget\b[^>]*\bversion=")[^"]*(")/;
const XML_DECL = /^<\?xml[^>]*\?>\r?\n/;

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

function main() {
  const version = readPackageVersion();
  const before = fs.readFileSync(configPath, 'utf8');
  const after = stampConfig(before, version);

  if (after === null) {
    console.log(`version-sync: app/config.xml already stamped at ${version} (in sync, nothing written)`);
    return;
  }

  fs.writeFileSync(configPath, after);
  console.log(`version-sync: app/config.xml version stamped to ${version}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
