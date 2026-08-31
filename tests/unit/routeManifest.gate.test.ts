/**
 * routeManifest.gate — S280 client route gate (phlix-tizen-client).
 *
 * WHAT IT PINS: every URL the tizen app's request-issuing code can put on
 * the wire is tuple-exact against the VENDORED phlix-server route manifest.
 * The expected set comes from the SERVER side only — `server-route-manifest.json`
 * is a byte-for-byte copy of `@phlix/contracts` `dist/server-route-manifest.json`
 * (provenance: server sha inside) — never from anything derived off this
 * client. A manifest derived from the client it checks would self-adjust and
 * pass every defect it exists to catch (S276/S279 shipped BECAUSE no such
 * gate existed).
 *
 * Why VENDORING and not the pinned dependency: package.json pins
 * `@phlix/contracts` at #v0.4.4, which predates the manifest export (it
 * landed on master at 09161041, untagged), and the package `exports` map
 * blocks JSON subpath imports anyway. Vendoring this one artifact is the
 * sanctioned interim pattern — identical to mobile (dc45e5c3) and roku
 * (1da0910e). Re-adoption of the contracts export replaces the copies when
 * the next contracts tag ships (tracked W19, phlix-ui #349 lane).
 *
 * MATCHING IS EXACT, NEVER SUBSTRING: `{param}` segments are compared as
 * whole path segments (both server `{id}` and client `${...}` canonicalise to
 * the same `{P}` token; everything else is literal string equality over the
 * FULL `METHOD /path` key). `/api/v1/media/{id}` therefore cannot absorb
 * `/api/v1/media/{id}/markers` — sibling-wildcard absorption is the failure
 * mode this gate exists to prevent.
 *
 * COVERAGE IS A PIN, NOT A PROMISE: the per-file site counts and the total
 * are asserted. A file adding request sites without the pin changing, or the
 * scanner going blind on an existing site, REDs here — partial coverage can
 * never read as full. A scan yielding zero sites fails outright.
 *
 * SCAN METHODOLOGY + KNOWN LIMITS (honest enumeration):
 * - tizen has NO central api layer; server fetches are issued two ways, and
 *   the scanner pins exactly those two receiver shapes across src/**\/*.ts
 *   and src/**\/*.vue (tests excluded):
 *     (1) `client.<verb>(…<generics>?)( 'lit' | "lit" | \`lit\` )` — the
 *         `@phlix/ui` ApiClient instances created per page/store.
 *     (2) `this.request<…>( 'lit' | \`lit\` [, { … method: 'X' … } ])` — the
 *         local SyncPlayApiClient in useSyncPlayStore (method defaults GET).
 * - LIMIT: URLs minted INSIDE `@phlix/ui` helpers (useMusicStore's
 *   listArtists/listAlbums/getAlbum/getTrack, player-store calls) carry no
 *   literal in this repo and are out of scan scope HERE — the ui package
 *   gates its own literals (S280 ui leg). This file pins that the tizen
 *   tree itself contains no other server-addressed literal: any NEW literal
 *   on a different receiver shape would be invisible to the scanner, so the
 *   raw-literal sweep test below cross-checks the scanner's findings against
 *   every `/api/v1` code occurrence in src/** (comments stripped) — a
 *   mismatch means the scanner went blind and must be extended.
 * - Dynamic segments: `${expr}` interpolations canonicalise to one `{P}`
 *   token; a client `{P}` may only match a server `{param}` segment. The
 *   sweep guards every URL that keeps `/api/v1` CONTIGUOUS inside one string
 *   (in-call concatenation like `'/api'+'/v1/x'` still lands as an unserved
 *   fragment → RED). A URL deliberately SPLIT across separate quoted
 *   fragments before the call (`const P = '/api'`; `client.get(P + '/v1/x')`)
 *   evades both scanner and sweep — out of any regex gate's threat model by
 *   design; none exists in this tree.
 * - WebSocket/relay transports (buildWsUrl port-8097 socket, hub-relay ws)
 *   are a DIFFERENT registry than the HTTP manifest — pinned OUT of scope by
 *   explicit negative assertions below, not silently ignored.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license MIT
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'server-route-manifest.json');

/** Gate identity marker — single source of truth for this lane's survival token. */
const GATE_ID = 's280tc-tizen-route-gate-v1';

interface Manifest {
  $comment: string;
  provenance: {
    serverSha: string;
    generatedAt: string;
    generator: string;
    total: number;
  };
  routes: [string, string][];
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;

function isParamSegment(segment: string): boolean {
  return /^\{[^{}]*\}$/.test(segment);
}

/**
 * Template-vs-template segment match: SAME number of segments, and each
 * segment must be SERVEABLE: a server parameter (`{id}`) covers a client
 * literal (`/media/42`) and a client interpolation (`${x}`) alike; two
 * literals must be equal; a client parameter must NOT match a server literal.
 * Anchored by construction — lengths must agree, so `/media/{id}` can never
 * absorb `/media/{id}/markers`, and no substring/prefix is ever consulted.
 */
function templateMatches(serverTemplate: string, clientTemplate: string): boolean {
  const a = serverTemplate.split('/');
  const b = clientTemplate.split('/');
  if (a.length !== b.length) return false;
  return a.every((seg, i) => isParamSegment(seg) || (!isParamSegment(b[i]) && seg === b[i]));
}

function served(method: string, clientPath: string): boolean {
  return manifest.routes.some(([m, r]) => m === method && templateMatches(r, clientPath));
}

// ── scan the request-issuing sources ────────────────────────────────────────

interface Site {
  method: string;
  /** `/api/v1/...` with `${...}` interpolations canonicalised to `{P}`. */
  path: string;
  file: string;
}

/**
 * Files that legitimately carry NO server-manifest-addressed literal URLs and
 * are excluded from the server compare, with an enumerated reason:
 * - `src/api/hubRelay.ts` is HUB-addressed (base URL = hub, not the server):
 *   `POST /api/v1/me/servers/{id}/relay-token` is minted by the HUB
 *   (S298/S2a) and lives in the hub's registry, NOT the server manifest.
 *   Its literals are triple-checked below to stay ABSENT from the server
 *   manifest — if it ever points at a server route it must move into the gate.
 * New request-issuing file appears → this list or the pin must change → RED.
 */
const EXCLUDED_FILES: Record<string, string> = {
  'src/api/hubRelay.ts':
    'hub-addressed: POST /api/v1/me/servers/{id}/relay-token is minted by the HUB (S298/S2a), ws relay URL is a socket registry',
};

/** `client.<verb>` on the @phlix/ui ApiClient; generic + multi-line aware. */
const WRAPPER_RE =
  /(?<![\w$.'"])client\.(get|post|put|patch|delete)\b(?:<[\s\S]{0,200}?>)?\s*\(\s*([`'"])([^`'"]+)\2/g;

/**
 * `this.request(...)` on the local SyncPlayApiClient: path literal first,
 * optional options object whose `method:` (if present) is the verb; absent →
 * GET (fetch default). The options body is brace-AWARE one level deep
 * (`(?:[^{}]|\{[^{}]*\})*?`): a non-greedy `[\s\S]*?}` would truncate at the
 * first `}` and could lose a `method:` that follows a nested body object —
 * silently defaulting a POST site to GET (wrong-method false-green).
 */
const SYNCPLAY_RE =
  /this\.request(?:<[\s\S]{0,80}>)?\s*\(\s*([`'"])([^`'"]*)\1\s*,?\s*(?:\{((?:[^{}]|\{[^{}]*\})*?)\}\s*,?)?\s*\)/g;

/**
 * Raw `/api/v1…` fragment inside any string/template — used by the blindness
 * sweep and the hub-exclusion compare. Stops at a quote/backtick/whitespace,
 * so a `${expr}` interpolation survives intact and normalises to `{P}`.
 */
const RAW_API_RE = /\/api\/v1[^`'"\s]*/g;

function commentStripped(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
      continue;
    }
    if (!/\.(ts|vue)$/.test(entry) || /\.test\.(ts|vue)$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

function normalizePath(raw: string): string {
  let p = raw.split('?')[0];
  p = p.replace(/\$\{[^}]*\}/g, '{P}');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (!p.startsWith('/')) throw new Error(`scanned URL literal does not start with /: ${raw}`);
  return p.startsWith('/api/v1') ? p : `/api/v1${p}`;
}

function scan(): Site[] {
  const sites: Site[] = [];
  for (const file of collectSourceFiles(path.join(REPO_ROOT, 'src'))) {
    const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    if (EXCLUDED_FILES[rel]) continue;
    const code = commentStripped(readFileSync(file, 'utf8'));
    for (const [, verb, , literal] of code.matchAll(WRAPPER_RE)) {
      sites.push({ method: verb.toUpperCase(), path: normalizePath(literal), file: rel });
    }
    for (const [, , literal, options] of code.matchAll(SYNCPLAY_RE)) {
      const declared = options ? /method:\s*['"`]([A-Za-z]+)['"`]/.exec(options) : null;
      sites.push({
        method: (declared ? declared[1] : 'GET').toUpperCase(),
        path: normalizePath(literal),
        file: rel,
      });
    }
  }
  return sites;
}

// ── the pins ────────────────────────────────────────────────────────────────

/**
 * Per-file counts measured on the tree at merge time. If a number moves,
 * either the client started or stopped issuing URLs (good reason: update it
 * WITH the manifest check passing) or the scanner went blind (bad reason:
 * find out which before touching this number).
 *
 * S280 findings fixed en route (the gate's first catches — see PR body):
 * AudioTracksPage moved OFF the never-registered /media/{id}/audio-tracks
 * onto /media/{id}/playback-info; UpNextOverlay moved OFF the
 * never-registered /media/{id}/playlist onto /users/me/next-up.
 */
const PER_FILE_COVERAGE: Record<string, number> = {
  'src/components/ChapterOverlay.vue': 2,
  'src/components/SkipIntroOverlay.vue': 1,
  'src/components/UpNextOverlay.vue': 1,
  'src/main.ts': 1,
  'src/pages/AudioTracksPage.vue': 1,
  'src/pages/ChaptersPage.vue': 1,
  'src/pages/ParentalControlsPage.vue': 9,
  'src/screens/RecommendationsScreen.vue': 1,
  'src/stores/useSyncPlayStore.ts': 6,
};
const TOTAL_SITES = Object.values(PER_FILE_COVERAGE).reduce((a, b) => a + b, 0);

describe(`${GATE_ID} — vendored manifest integrity`, () => {
  it('is the contracts artifact derived from phlix-server @ the pinned sha', () => {
    expect(manifest.provenance.serverSha).toBe('8f72faec6ef85c9df1382148d4f294a450d71bed');
    expect(manifest.provenance.total).toBe(400);
    expect(manifest.routes).toHaveLength(400);
    expect(manifest.provenance.generator).toBe('scripts/generate-server-route-manifest.mjs');
  });

  it('is byte-identical to the sibling contracts artifact it vendors', () => {
    // md5 of `@phlix/contracts` `dist/server-route-manifest.json` at 09161041.
    // Mobile and roku vendored the SAME bytes — one source across the estate;
    // any drift here means this copy was edited (the artifact says "do not").
    const raw = readFileSync(MANIFEST_PATH);
    const md5 = createHash('md5').update(raw).digest('hex');
    expect(md5).toBe('cca4660dda7876fba840f9d108ad7c18');
    const unique = new Set(manifest.routes.map(([m, r]) => `${m} ${r}`));
    expect(unique.size).toBe(400);
  });
});

describe(`${GATE_ID} — every URL tizen issues is tuple-exact served`, () => {
  const sites = scan();

  it('is NON-VACUOUS: the scan sees request sites', () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  it('has NO unserved URL in the request-issuing code', () => {
    const unserved = sites.filter((s) => !served(s.method, s.path));
    expect(unserved.map((u) => `${u.method} ${u.path}  <- ${u.file}`)).toEqual([]);
  });

  it('covers exactly the pinned files with the pinned counts (no silent shrink/grow)', () => {
    const perFile = new Map<string, number>();
    for (const s of sites) perFile.set(s.file, (perFile.get(s.file) ?? 0) + 1);
    const uniqueTuples = new Set(sites.map((s) => `${s.method} ${s.path}`));
    console.log(
      `[${GATE_ID}] tizen: ${sites.length} request sites / ${uniqueTuples.size} distinct ` +
        `[method, pathTemplate] tuples across ${perFile.size} modules — all tuple-exact against ` +
        `the vendored 400-route manifest @ ${manifest.provenance.serverSha}`,
    );
    for (const [file, count] of [...perFile.entries()].sort()) {
      console.log(`  ${file}: ${count}`);
    }
    expect(Object.fromEntries(perFile)).toEqual(PER_FILE_COVERAGE);
    expect(sites.length).toBe(TOTAL_SITES);
  });

  it('pins the SyncPlay METHOD per site exactly (verb-blindness control)', () => {
    // The syncplay surface is the only one whose verb is extracted from an
    // options object rather than the receiver name — the one place a
    // method-truncating scanner bug could read green under the wrong verb.
    // Pin the full `METHOD path` multiset, not just per-file counts.
    const syncplay = sites
      .filter((s) => s.file === 'src/stores/useSyncPlayStore.ts')
      .map((s) => `${s.method} ${s.path}`)
      .sort();
    expect(syncplay).toEqual([
      'GET /api/v1/syncplay/groups',
      'GET /api/v1/syncplay/groups/{P}',
      'GET /api/v1/syncplay/groups/{P}',
      'POST /api/v1/syncplay/groups',
      'POST /api/v1/syncplay/groups/{P}/join',
      'POST /api/v1/syncplay/groups/{P}/leave',
    ]);
  });

  it('the scanner cannot have gone blind: every /api/v1 code literal is a scanned site', () => {
    // The blindness sweep: comment-stripped src code is swept for EVERY
    // `/api/v1…` fragment (regex-independent of the scanner) and the per-file
    // occurrence count must EQUAL the per-file scanned-site count, 1:1. A new
    // receiver shape minting server URLs (or a concatenated URL that no
    // literal scanner sees) lands here as an unaccounted occurrence → RED,
    // forcing an honest scanner extension, not a silent blind spot (S345).
    const scannedPerFile = new Map<string, number>();
    for (const s of sites) scannedPerFile.set(s.file, (scannedPerFile.get(s.file) ?? 0) + 1);
    const sweptPerFile = new Map<string, number>();
    for (const file of collectSourceFiles(path.join(REPO_ROOT, 'src'))) {
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
      if (EXCLUDED_FILES[rel]) continue;
      const code = commentStripped(readFileSync(file, 'utf8'));
      let n = 0;
      for (const [literal] of code.matchAll(RAW_API_RE)) {
        // Each occurrence must normalise to the SAME shape a site would take.
        normalizePath(literal);
        n++;
      }
      if (n) sweptPerFile.set(rel, n);
    }
    expect(Object.fromEntries(sweptPerFile)).toEqual(Object.fromEntries(scannedPerFile));
    expect(sites.length).toBe(TOTAL_SITES);
  });

  it('the HUB-addressed exclusion genuinely mints NO server-manifest routes', () => {
    // The exclusion list is only honest while those files point at the HUB.
    // Re-scan each excluded file and require every /api/v1 literal fragment
    // it contains to be ABSENT from the server manifest under every method.
    expect(Object.keys(EXCLUDED_FILES).length).toBeGreaterThan(0);
    for (const rel of Object.keys(EXCLUDED_FILES)) {
      const code = commentStripped(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
      let minted = 0;
      for (const [literal] of code.matchAll(RAW_API_RE)) {
        minted++;
        const full = normalizePath(literal);
        const hitsOnServer = manifest.routes.filter(([, route]) => templateMatches(route, full));
        expect({ file: rel, path: full, hitsOnServer }).toEqual({
          file: rel,
          path: full,
          hitsOnServer: [],
        });
      }
      // The exclusion is only meaningful while the file really does mint
      // hub-addressed API literals (today: exactly the one relay-token call).
      expect({ file: rel, hubMintedApiLiterals: minted }).toEqual({
        file: rel,
        hubMintedApiLiterals: 1,
      });
    }
  });

  it('S279-class tripwires: never-registered rails stay unserved AND uncalled', () => {
    // Historical tizen syncplay debt (S279) plus this wave's two findings.
    // Both halves must stay red-shaped: the manifest must not start serving
    // them, and the client must not start calling them again.
    for (const dead of [
      ['GET', '/api/v1/syncplay/rooms'],
      ['POST', '/api/v1/syncplay/rooms'],
      ['DELETE', '/api/v1/syncplay/rooms/{P}/leave'],
      ['GET', '/api/v1/syncplay/sessions/{P}'],
      ['GET', '/api/v1/media/{P}/audio-tracks'],
      ['GET', '/api/v1/media/{P}/playlist'],
    ] as [string, string][]) {
      expect(served(dead[0], dead[1])).toBe(false);
    }
    const deadCalls = sites.filter(
      (s) =>
        s.path.includes('/syncplay/rooms') ||
        s.path.includes('/syncplay/sessions') ||
        s.path.includes('/audio-tracks') ||
        s.path.endsWith('/playlist'),
    );
    expect(deadCalls).toEqual([]);
  });

  it('WebSocket / relay transports are pinned OUT of the HTTP manifest (by design)', () => {
    // buildWsUrl (syncplay socket, port 8097) and buildHubRelayUrl (ws relay)
    // mint socket URLs — a different registry than the HTTP route manifest.
    // Pin that they are ALSO outside the manifest so nobody mistakes them
    // for gated HTTP.
    expect(manifest.routes.some(([, r]) => r.includes('syncplay/ws'))).toBe(false);
    expect(manifest.routes.some(([, r]) => r.includes('relay/syncplay'))).toBe(false);
    expect(sites.some((s) => s.path.includes(':8097') || s.path.startsWith('ws'))).toBe(false);
  });

  it('fails RED, demonstrably, on a planted unserved URL (non-vacuity control)', () => {
    // The scanner + membership test, run over a synthetic tree addition, MUST
    // flag an unserved URL. A gate never seen to fail proves nothing (S280 AC).
    const planted: Site[] = [
      { method: 'GET', path: '/api/v1/s280tc-planted-probe/{P}', file: 'src/PLANTED.ts' },
    ];
    const flagged = planted.filter((s) => !served(s.method, s.path));
    expect(flagged).toEqual(planted);
    // Exact-compare discipline at segment level: a registered template must
    // not absorb a DEEPER path (sibling-wildcard absorption).
    expect(served('GET', '/api/v1/media/{P}/not-registered')).toBe(false);
    expect(served('GET', '/api/v1/media/{P}')).toBe(true);
  });
});
