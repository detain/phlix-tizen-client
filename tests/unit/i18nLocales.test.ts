/**
 * Six-locale integrity suite — the law-gate for BOTH catalogs shipped by the
 * feat/i18n-locales lane (es, fr, de, it, pt_BR, ja):
 *
 *  A. UI SEAM (vendored from phlix-ui, SSOT): key-set identity across the six
 *     bundles, coverage of the INSTALLED DEFAULT_MESSAGES, pinned ahead-of-pin
 *     extras, placeholder parity, CLDR segment law (incl. the documented
 *     additive exception), diacritics/CJK sanity, and PIN/hash drift guards
 *     against the vendored files (CI-skipped source leg, see below).
 *  B. TIZEN-OWN: 197-key identity per locale, placeholder parity, the
 *     additive-pipe plural doctrine (latin 2-seg on exactly 12 keys), JA zero
 *     pipes + counter phrases, per-locale English-LEAK allow-lists verified
 *     BOTH directions, diacritics aggregates.
 *  C. RESOLUTION MATRIX + REAL-BUNDLE E2E: device tag → chosen bundle for
 *     both catalogs; Spanish actually renders through mergeMessages() and
 *     tTizen(); untouched hypothetical keys stay English.
 *
 * CI NOTE (anti-phantom, verified against .github/workflows/test.yml): CI
 * clones ONLY ../phlix-contracts. The vendored SOURCE leg therefore skips
 * (loudly, by name) when ../phlix-ui is absent and hard-fails on dev machines
 * — drift protection there rides the local gate plus the re-pin cascade
 * (docs/i18n.md). The PIN↔disk leg needs no sibling and runs everywhere.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MESSAGES, mergeMessages } from '@phlix/ui';
import {
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
  messagesForLocale,
  normalizeLocaleTag,
  resolveLocale,
  type SupportedLocale,
} from '../../src/i18n';
import { LOCALE_MESSAGES } from '../../src/i18n/ui-locale-bundles';
import { TIZEN_EN, type TizenMessageKey } from '../../src/i18n/tizen/locales/en';
import { ES_TIZEN_MESSAGES } from '../../src/i18n/tizen/locales/es';
import { FR_TIZEN_MESSAGES } from '../../src/i18n/tizen/locales/fr';
import { DE_TIZEN_MESSAGES } from '../../src/i18n/tizen/locales/de';
import { IT_TIZEN_MESSAGES } from '../../src/i18n/tizen/locales/it';
import { PT_BR_TIZEN_MESSAGES } from '../../src/i18n/tizen/locales/pt_BR';
import { JA_TIZEN_MESSAGES } from '../../src/i18n/tizen/locales/ja';
import { setTizenLocale, tTizen, tizenLocale } from '../../src/i18n/tizen';

type Table = Record<string, Record<string, string>>;
const LOCALES = ['es', 'fr', 'de', 'it', 'pt_BR', 'ja'] as const;
type Locale = (typeof LOCALES)[number];
const LATIN: readonly Locale[] = ['es', 'fr', 'de', 'it', 'pt_BR'];

const TIZEN_TABLES: Record<Locale, Table> = {
  es: ES_TIZEN_MESSAGES,
  fr: FR_TIZEN_MESSAGES,
  de: DE_TIZEN_MESSAGES,
  it: IT_TIZEN_MESSAGES,
  pt_BR: PT_BR_TIZEN_MESSAGES,
  ja: JA_TIZEN_MESSAGES,
};
const UI_TABLES = LOCALE_MESSAGES as unknown as Record<Locale, Table>;

/** Flatten a nested catalog to `group.key` → value. */
function flat(table: Table): Map<string, string> {
  const out = new Map<string, string>();
  for (const [group, entries] of Object.entries(table)) {
    for (const [key, value] of Object.entries(entries)) out.set(`${group}.${key}`, value);
  }
  return out;
}
const EN_TIZEN = flat(TIZEN_EN as unknown as Table);
const EN_UI = flat(DEFAULT_MESSAGES as unknown as Table);

function keySet(table: Table): string {
  return [...flat(table).keys()].sort().join('\n');
}
function placeholders(value: string): string {
  return [...new Set(value.match(/\{\w+\}/g) ?? [])].sort().join(',');
}
function segments(value: string): number {
  return value.split('|').length;
}

// The 12 tizen-own keys where English hardcodes a plural while passing
// `count`: latin locales carry the honest 2-segment pipe, ja one segment.
const TIZEN_ADDITIVE_PIPES: readonly string[] = [
  'chapters.countAria',
  'audioTracks.countAria',
  'subtitleTracks.countAria',
  'recommendations.gridAria',
  'recommendations.headingCount',
  'music.artistsAria',
  'music.albumsAria',
  'music.tracksAria',
  'music.albumCardAria',
  'music.albumCardAriaNoYear',
  'music.albumMeta',
  'music.artistCardAria',
];
// ui-side exception (SSOT doctrine): player.subtitleDownloads adds the pipe
// form in latin bundles where the English default hardcodes the plural.
const UI_ADDITIVE_PIPES: readonly string[] = ['player.subtitleDownloads'];

// Keys the vendored bundles carry AHEAD of the installed @phlix/ui pin
// (v0.99.4). ONE list for all three laws below (installed-coverage flip,
// cross-bundle placeholder parity, cross-bundle segment parity) so extending
// the vendor set cannot silently miss a law.
const UI_AHEAD_OF_PIN = [
  'connect.scan',
  'connect.scanning',
  'connect.scanFailed',
  'connect.scanEmpty',
  'connect.scanListLabel',
  'player.seekBackward',
  'player.seekForward',
].sort();

// Keys whose value legitimately EQUALS English (brand tokens, unit formats,
// {placeholder}-only templates). Verified BOTH directions per locale.
const EN_LEAK_OK: Record<Locale, readonly string[]> = {
  es: ['tracks.durationAria', 'chapters.itemAria', 'audioTracks.bitrateKbps', 'audioTracks.mono', 'parentalControls.bandwidthKbps', 'parentalControls.timeAm', 'parentalControls.timePm', 'pictureInPicture.enterLabel', 'subtitleTracks.sdhBadge'],
  fr: ['tracks.durationAria', 'chapters.itemAria', 'audioTracks.bitrateKbps', 'audioTracks.mono', 'music.albumsTitle', 'music.albumCountOne', 'music.albumCountOther', 'parentalControls.bandwidthKbps', 'parentalControls.timeAm', 'parentalControls.timePm', 'pictureInPicture.enterLabel', 'subtitleTracks.sdhBadge'],
  de: ['common.name', 'tracks.durationAria', 'chapters.itemAria', 'chapters.markerIntro', 'chapters.markerOutro', 'audioTracks.bitrateKbps', 'audioTracks.mono', 'audioTracks.stereo', 'parentalControls.bandwidthKbps', 'parentalControls.timeAm', 'parentalControls.timePm', 'pictureInPicture.enterLabel', 'subtitleTracks.sdhBadge'],
  it: ['tracks.durationAria', 'chapters.itemAria', 'chapters.markerIntro', 'chapters.markerOutro', 'audioTracks.bitrateKbps', 'audioTracks.mono', 'audioTracks.stereo', 'music.albumCountOne', 'parentalControls.bandwidthKbps', 'parentalControls.timeAm', 'parentalControls.timePm', 'pictureInPicture.enterLabel', 'subtitleTracks.sdhBadge'],
  pt_BR: ['tracks.durationAria', 'chapters.itemAria', 'audioTracks.bitrateKbps', 'audioTracks.mono', 'parentalControls.bandwidthKbps', 'parentalControls.timeAm', 'parentalControls.timePm', 'pictureInPicture.enterLabel', 'subtitleTracks.sdhBadge'],
  ja: ['tracks.durationAria', 'chapters.itemAria', 'audioTracks.bitrateKbps', 'parentalControls.bandwidthKbps', 'pictureInPicture.enterLabel', 'subtitleTracks.sdhBadge'],
};

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
const LATIN_SPECS: Record<string, { re: RegExp; min: number }> = {
  es: { re: /[áéíóúüñ¿¡]/, min: 50 },
  fr: { re: /[àâäéèêëîïôùûüçœ]/, min: 50 },
  de: { re: /[äöüß]/, min: 40 },
  it: { re: /[àèéìòù]/, min: 4 },
  pt_BR: { re: /[ãõáâàéêíóôúçü]/, min: 30 },
};

// ---------------------------------------------------------------------------
// C. Locale-resolution matrix + real-bundle end-to-end rendering
// ---------------------------------------------------------------------------

describe('locale resolution matrix (device tag → bundle, both catalogs)', () => {
  const MATRIX: [string, SupportedLocale][] = [
    ['es-ES', 'es'], ['es-419', 'es'], ['ES', 'es'],
    ['fr-CA', 'fr'], ['de-DE', 'de'], ['it-IT', 'it'],
    ['pt', 'pt_BR'], ['pt_BR', 'pt_BR'], ['pt-PT', 'pt_BR'],
    ['ja-JP', 'ja'], ['en-GB', 'en'],
    ['zz', 'en'], ['xx_YY', 'en'], ['kl-GL', 'en'],
  ];
  for (const [tag, expected] of MATRIX) {
    it(`'${tag}' selects '${expected}' for BOTH the ui seam and tizen-own`, () => {
      // The parser returns the PRIMARY SUBTAG; only supported ones (plus the
      // pt→pt_BR region rule) key a catalog. Unsupported parses ('zz') are
      // carried to the registry lookup, where the walk ends at FALLBACK —
      // asserted via resolveLocale, the function that actually picks a bundle.
      const parsed = normalizeLocaleTag(tag);
      if (parsed !== null && (SUPPORTED_LOCALES as readonly string[]).includes(parsed)) {
        expect(parsed).toBe(expected);
      } else {
        expect(expected, `${tag} must only reach the matrix as a fallback row`).toBe(FALLBACK_LOCALE);
      }
      expect(resolveLocale({ explicit: tag })).toBe(expected);
      // ui seam: the override actually handed to createPhlixApp.
      const override = messagesForLocale(tag);
      if (expected === 'en') {
        expect(Object.keys(override)).toEqual([]); // en passes English defaults through
      } else {
        expect(Object.keys(override).length, `ui override empty for ${tag}`).toBeGreaterThan(0);
        expect((override as Table).common.retry).toBe(flat(UI_TABLES[expected as Locale]).get('common.retry'));
      }
      // tizen-own: the accessor actually renders from.
      setTizenLocale(tag);
      expect(tizenLocale()).toBe(expected);
      const expectedBrowse =
        expected === 'en' ? TIZEN_EN.menu.browse : flat(TIZEN_TABLES[expected]).get('menu.browse');
      expect(tTizen('menu.browse')).toBe(expectedBrowse);
      setTizenLocale('en');
    });
  }

  it('unsupported tags never leak past the registry (FALLBACK is in SUPPORTED_LOCALES)', () => {
    expect(SUPPORTED_LOCALES).toContain(FALLBACK_LOCALE);
    expect(SUPPORTED_LOCALES).toEqual(['en', 'es', 'fr', 'de', 'it', 'pt_BR', 'ja']);
  });
});

describe('real-bundle E2E — Spanish actually renders (and English survives gaps)', () => {
  it('t() through mergeMessages renders the vendored es bundle, not English', () => {
    const locale = resolveLocale({ explicit: 'es' });
    const merged = mergeMessages(messagesForLocale(locale));
    const esUi = flat(UI_TABLES.es);
    expect(merged.common.retry).toBe(esUi.get('common.retry'));
    expect(merged.common.retry).not.toBe('Retry');
  });

  it('a hypothetical PARTIAL override still falls back to English for untouched keys', () => {
    // Same law, partial slice: the merge — not the bundle — owns fallback.
    const merged = mergeMessages({ common: { retry: 'ZZZ-SOLO-ES' } });
    expect(merged.common.retry).toBe('ZZZ-SOLO-ES');
    expect(merged.common.close).toBe('Close');
  });

  it('tTizen renders Spanish (menu.browse) and Japanese (days.mon) for real keys', () => {
    setTizenLocale('es');
    expect(tTizen('menu.browse')).toBe('Explorar');
    expect(tTizen('common.loading')).toBe('Cargando…');
    setTizenLocale('ja');
    expect(tTizen('days.mon')).toBe('月');
    setTizenLocale('en');
    expect(tTizen('menu.browse')).toBe(TIZEN_EN.menu.browse);
  });

  it('en path stays byte-identical: full en override renders DEFAULT, tTizen renders TIZEN_EN', () => {
    const mergedEn = mergeMessages(messagesForLocale('en'));
    expect(mergedEn.common.retry).toBe(DEFAULT_MESSAGES.common.retry);
    setTizenLocale('en');
    for (const [key, value] of EN_TIZEN) {
      expect(tTizen(key as TizenMessageKey), `en drift at ${key}`).toBe(value);
    }
  });
});

// ---------------------------------------------------------------------------
// D. Vendoring drift guards — PIN↔disk everywhere; PIN↔source when sibling exists
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR_DIR = join(HERE, '../../src/i18n/ui-locale-bundles');
const SIBLING_UI = join(HERE, '../../../phlix-ui');
const SIBLING_PRESENT = existsSync(join(SIBLING_UI, '.git'));

interface Pin {
  ref: string;
  branch: string;
  directory: string;
  files: Record<string, { source_sha256: string; vendored_sha256: string }>;
}
const pin: Pin = JSON.parse(readFileSync(join(VENDOR_DIR, 'PIN'), 'utf8'));

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('vendored bundles — PIN integrity (runs in CI: needs no sibling)', () => {
  it('PIN covers exactly the seven vendored files', () => {
    expect(Object.keys(pin.files).sort()).toEqual(
      ['de.ts', 'es.ts', 'fr.ts', 'index.ts', 'it.ts', 'ja.ts', 'pt_BR.ts'],
    );
  });

  it('every vendored file on disk hashes to its PIN entry', () => {
    for (const [file, entry] of Object.entries(pin.files)) {
      const disk = readFileSync(join(VENDOR_DIR, file), 'utf8');
      expect(sha256(disk), `${file} drifted from PIN without a re-sync`).toBe(entry.vendored_sha256);
    }
  });

  it('the sync script cannot silently roll the vendor back to a stale constant', () => {
    // The pre-fix hazard: a hardcoded SOURCE_REF constant that drifted from
    // PIN.ref (2f2df8a2 vs dc1df7d5 once shipped) made a BARE script run
    // re-vendor the OLD commit and self-rewrite the PIN — silent rollback,
    // undetectable except against the ui origin. Law now: the bare-run
    // default comes from the PIN on disk, the constants are bootstrap-only,
    // and this suite pins constants == PIN so the bootstrap anchor can never
    // go stale unnoticed. Runs in CI (needs no sibling).
    const script = readFileSync(join(HERE, '../../scripts/sync-ui-locale-bundles.mjs'), 'utf8');
    const constantRef = script.match(/const SOURCE_REF = '([0-9a-f]{40})';/)?.[1];
    const constantBranch = script.match(/const SOURCE_BRANCH = '([^']+)';/)?.[1];
    expect(constantRef, 'SOURCE_REF constant missing from sync script').toBe(pin.ref);
    expect(constantBranch, 'SOURCE_BRANCH constant missing from sync script').toBe(pin.branch);
    // Bare-run default must resolve FROM THE PIN, not the constant.
    expect(script).toContain("arg('--ref', pinned.ref)");
    expect(script).toContain("arg('--branch', pinned.branch)");
    expect(script).not.toMatch(/arg\('--ref', SOURCE_REF\)/);
  });

  it('the registry exposes precisely the six estate locales', () => {
    expect(Object.keys(LOCALE_MESSAGES).sort()).toEqual([...LOCALES].sort());
  });
});

describe.skipIf(!SIBLING_PRESENT)(
  'vendored bundles — SOURCE parity vs pinned phlix-ui commit [HARD-FAILS locally; SKIPS in CI: no phlix-ui sibling checked out — drift protection rides the local gate + re-pin cascade, see docs/i18n.md]',
  () => {
    it('disk equals script-transformed pristine source AND PIN source hashes match', () => {
      // Re-derive the vendored bytes from `git show <ref>:<file>` with the
      // three documented transforms; any mismatch means someone hand-edited
      // the vendor or the SSOT moved without a re-pin.
      const applyTransforms = (file: string, source: string): string => {
        let out = source.split("import type { PhlixMessages } from '../messages';\n").join('');
        out = file === 'index.ts'
          ? out.split('Record<PhlixLocaleCode, PhlixMessages>').join('Record<PhlixLocaleCode, Record<string, Record<string, string>>>')
          : out.split('satisfies PhlixMessages;').join('satisfies Record<string, Record<string, string>>;');
        return out;
      };
      for (const [file, entry] of Object.entries(pin.files)) {
        const source = execFileSync('git', ['-C', SIBLING_UI, 'show', `${pin.ref}:${pin.directory}/${file}`], {
          encoding: 'utf8',
          maxBuffer: 8 * 1024 * 1024,
        });
        expect(sha256(source), `PIN source hash for ${file}`).toBe(entry.source_sha256);
        const disk = readFileSync(join(VENDOR_DIR, file), 'utf8');
        expect(disk, `${file} ≠ transform(${pin.ref.slice(0, 8)}:${file}) — re-run scripts/sync-ui-locale-bundles.mjs (bare run re-vendors this PIN'd ref)`).toBe(
          applyTransforms(file, source),
        );
      }
    });
  },
);

// ---------------------------------------------------------------------------
// A. Vendored UI bundles (SSOT = phlix-ui; we only re-prove invariants here)
// ---------------------------------------------------------------------------

describe('ui bundles — key-set identity and installed coverage', () => {
  it('all six vendored bundles carry an identical key set', () => {
    const reference = keySet(UI_TABLES.es);
    for (const locale of LOCALES) {
      expect(keySet(UI_TABLES[locale]), `${locale} key set differs from es`).toBe(reference);
    }
  });

  it('installed DEFAULT_MESSAGES keys are all present in every bundle (installed ⊆ bundle)', () => {
    for (const locale of LOCALES) {
      const bundleKeys = new Set(flat(UI_TABLES[locale]).keys());
      const missing = [...EN_UI.keys()].filter((key) => !bundleKeys.has(key));
      expect(missing, `${locale} missing installed keys`).toEqual([]);
    }
  });

  it('bundles run exactly 7 keys AHEAD of the installed pin (the documented extras)', () => {
    // Vendored @ dc1df7d5 vs @phlix/ui 0.99.4 — the ahead-of-pin set is pinned
    // HERE so a client dependency bump that ships these keys flips this pin
    // and forces a conscious re-vendor/re-pin instead of silent drift.
    const bundleKeys = [...flat(UI_TABLES.es).keys()];
    expect(bundleKeys.filter((key) => !EN_UI.has(key)).sort()).toEqual(UI_AHEAD_OF_PIN);
  });

  it('every bundle value keeps its key\'s {placeholder} set (vs English)', () => {
    for (const locale of LOCALES) {
      const table = flat(UI_TABLES[locale]);
      for (const [key, value] of table) {
        const en = EN_UI.get(key);
        // Ahead-of-pin keys have no installed baseline — cross-bundle parity
        // below still covers them; here they must at least be non-empty.
        if (en === undefined) {
          expect(value.trim().length, `${locale} ${key} empty`).toBeGreaterThan(0);
          continue;
        }
        expect(placeholders(value), `${locale} ${key} placeholders`).toBe(placeholders(en));
      }
    }
  });

  it('cross-bundle placeholder sets agree for the ahead-of-pin keys', () => {
    // ALL 7 ahead-of-pin keys — they have no installed English baseline, so
    // this loop is their ONLY placeholder-parity law across the six bundles.
    for (const key of UI_AHEAD_OF_PIN) {
      const base = placeholders(flat(UI_TABLES.es).get(key) ?? '');
      for (const locale of LOCALES) {
        expect(placeholders(flat(UI_TABLES[locale]).get(key) ?? ''), `${locale} ${key}`).toBe(base);
      }
    }
  });

  it('CLDR segment law: latin mirrors English (additive exception 2), ja collapses to 1 everywhere', () => {
    for (const locale of LOCALES) {
      const table = flat(UI_TABLES[locale]);
      for (const [key, value] of table) {
        const en = EN_UI.get(key);
        if (en === undefined) continue; // ahead-of-pin: cross-bundle counts pinned below
        if (locale === 'ja') {
          // SSOT ja doctrine: Japanese has one plural category — every English
          // pipe template collapses to a single counter-equipped segment.
          expect(segments(value), `ja ${key} must be pipe-free`).toBe(1);
          continue;
        }
        if (UI_ADDITIVE_PIPES.includes(key)) {
          expect(segments(value), `${locale} ${key}`).toBe(2);
          continue;
        }
        expect(segments(value), `${locale} ${key} segment drift vs en`).toBe(segments(en));
      }
    }
  });

  it('ahead-of-pin keys carry identical segment counts across bundles', () => {
    for (const key of UI_AHEAD_OF_PIN) {
      const counts = new Set(LOCALES.map((locale) => segments(flat(UI_TABLES[locale]).get(key) ?? '')));
      expect([...counts], `${key} segment counts differ across bundles`).toHaveLength(1);
    }
  });

  it('no bundle is a copy-paste of English (each differs from the default on ≥90% of shared keys)', () => {
    for (const locale of LOCALES) {
      const table = flat(UI_TABLES[locale]);
      const shared = [...EN_UI.entries()];
      const differs = shared.filter(([key, value]) => table.get(key) !== value).length;
      expect(differs / shared.length, `${locale} looks untranslated`).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('ja ui bundle is overwhelmingly CJK (≥90% of values; formats/loanwords may stay Latin)', () => {
    // The exhaustive non-CJK allow-list lives in the ui SSOT suite; here we
    // only cap bulk-English regressions (an email placeholder or a 'PiP'
    // badge staying ASCII is legitimate — 10% budget absorbs them all).
    const values = [...flat(UI_TABLES.ja).values()];
    const cjkCount = values.filter((value) => CJK.test(value)).length;
    expect(cjkCount / values.length).toBeGreaterThanOrEqual(0.9);
  });
});

// ---------------------------------------------------------------------------
// B. Tizen-OWN catalogs (authored in this repo — every law fully pinned)
// ---------------------------------------------------------------------------

describe('tizen-own catalogs — key-set, placeholders, plurals', () => {
  it('every locale table has EXACTLY the 197 English keys (both directions)', () => {
    const reference = keySet(TIZEN_EN as unknown as Table);
    for (const locale of LOCALES) {
      expect(keySet(TIZEN_TABLES[locale]), `${locale} key set differs from en`).toBe(reference);
    }
    expect(EN_TIZEN.size).toBe(197);
  });

  it('every value keeps its key\'s {placeholder} set verbatim', () => {
    for (const locale of LOCALES) {
      const table = flat(TIZEN_TABLES[locale]);
      for (const [key, value] of table) {
        expect(placeholders(value), `${locale} ${key} placeholders`).toBe(placeholders(EN_TIZEN.get(key) ?? ''));
      }
    }
  });

  it('English own-catalog baseline keeps ZERO pipes (One/Other keys, not templates)', () => {
    for (const [key, value] of EN_TIZEN) {
      expect(value.includes('|'), `en ${key} unexpectedly pipes`).toBe(false);
    }
  });

  it('latin locales: 2-segment pipes on EXACTLY the 12 additive keys, 1 segment elsewhere', () => {
    for (const locale of LATIN) {
      const table = flat(TIZEN_TABLES[locale]);
      for (const [key, value] of table) {
        const expected = TIZEN_ADDITIVE_PIPES.includes(key) ? 2 : 1;
        expect(segments(value), `${locale} ${key} segments`).toBe(expected);
        if (expected === 2) {
          for (const part of value.split('|')) {
            expect(part).toContain('{count}');
          }
        }
      }
    }
  });

  it('ja carries ZERO pipe templates anywhere (CLDR "other" only)', () => {
    const table = flat(TIZEN_TABLES.ja);
    for (const [key, value] of table) {
      expect(value.includes('|'), `ja ${key} must not pipe`).toBe(false);
    }
  });

  it('ja count strings use native counters (章/曲/枚/人/本/件), never a bare number', () => {
    const table = flat(TIZEN_TABLES.ja);
    const counters: Record<string, string> = {
      'chapters.countAria': '章',
      'chapters.countHeadingOther': '章',
      'music.tracksAria': '曲',
      'music.trackCountOther': '曲',
      'music.albumsAria': '枚',
      'music.albumCountOther': '枚',
      'music.artistsAria': '人',
      'audioTracks.countAria': '本',
      'subtitleTracks.countAria': '本',
      'recommendations.gridAria': '件',
      'recommendations.headingCount': '件',
    };
    for (const [key, counter] of Object.entries(counters)) {
      expect(table.get(key), `ja ${key} counter`).toContain(counter);
    }
  });

  it('ja One/Other PAIRS carry identical values (no singular form exists)', () => {
    const table = flat(TIZEN_TABLES.ja);
    const pairs: [string, string][] = [
      ['music.trackCountOne', 'music.trackCountOther'],
      ['music.albumCountOne', 'music.albumCountOther'],
      ['chapters.countHeadingOne', 'chapters.countHeadingOther'],
      ['audioTracks.headingOne', 'audioTracks.headingOther'],
      ['subtitleTracks.headingOne', 'subtitleTracks.headingOther'],
    ];
    for (const [one, other] of pairs) {
      expect(table.get(other), `${other} vs ${one}`).toBe(table.get(one));
    }
  });

  it('English-LEAK allow-list is exact in BOTH directions, per locale', () => {
    for (const locale of LOCALES) {
      const table = flat(TIZEN_TABLES[locale]);
      const actualLeaks = [...table.entries()]
        .filter(([key, value]) => EN_TIZEN.get(key) === value)
        .map(([key]) => key)
        .sort();
      expect(actualLeaks, `${locale} leak set drifted from allow-list`).toEqual(
        [...EN_LEAK_OK[locale]].sort(),
      );
    }
  });

  it('values are trimmed except the shared pressEsc edge-space pair', () => {
    const EDGE_SPACES = new Set(['ratings.pressEscPrefix', 'ratings.pressEscSuffix']);
    for (const locale of LOCALES) {
      for (const [key, value] of flat(TIZEN_TABLES[locale])) {
        if (EDGE_SPACES.has(key)) continue;
        expect(value, `${locale} ${key} edge whitespace`).toBe(value.trim());
      }
    }
  });

  it('no value carries double-spaces or tabs (mirrors the en integrity law)', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of flat(TIZEN_TABLES[locale])) {
        expect(value.includes('  '), `${locale} ${key} double space`).toBe(false);
        expect(value.includes('\t'), `${locale} ${key} tab`).toBe(false);
      }
    }
  });

  it('latin diacriticals aggregate above floor per language', () => {
    for (const [locale, spec] of Object.entries(LATIN_SPECS)) {
      let hits = 0;
      for (const value of flat(TIZEN_TABLES[locale as Locale]).values()) {
        if (spec.re.test(value)) hits += 1;
      }
      expect(hits, `${locale} diacritical coverage (${hits})`).toBeGreaterThanOrEqual(spec.min);
    }
  });

  it('ja is overwhelmingly CJK; non-CJK values are exactly the allow-listed formats', () => {
    const nonCjk = [...flat(TIZEN_TABLES.ja).entries()]
      .filter(([, value]) => !CJK.test(value))
      .map(([key]) => key)
      .sort();
    expect(nonCjk).toEqual([...EN_LEAK_OK.ja].sort());
  });

  it('the 197-key type law: every locale compiles against TizenCatalog (satisfies)', () => {
    // Compile-time guarantee, re-asserted at runtime via key-set identity;
    // this it() documents that the `satisfies TizenCatalog` annotations in
    // src/i18n/tizen/locales/*.ts are the FIRST line of that defense.
    const k: TizenMessageKey = 'menu.browse';
    expect(tTizen(k)).toBeTruthy();
  });
});
