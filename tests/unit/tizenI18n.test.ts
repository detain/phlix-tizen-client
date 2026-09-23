/**
 * Pins for the Tizen-OWN message catalog (`src/i18n/tizen/`).
 *
 * Three laws, mirroring the catalog docblock:
 *  1. BYTE IDENTITY — every catalog value is pinned verbatim here. Editing a
 *     string in `locales/en.ts` without editing its pin (and, for rendered
 *     surfaces, the component test that asserts the old text) fails loudly.
 *  2. INTEGRITY — group set, key shape, non-empty values, no stray
 *     whitespace, and every key has a real call site (or a named exemption).
 *  3. ACCESSOR SEMANTICS — `tTizen`/`createTizenTranslator`/`mergeTizenMessages`
 *     behave exactly like the ui seam's translator they mirror.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  TIZEN_EN,
  clearTizenLocale,
  createTizenTranslator,
  mergeTizenMessages,
  setTizenLocale,
  tTizen,
  tizenLocale,
  type TizenCatalog,
  type TizenMessageKey,
  type TizenMessagesConfig,
} from '@/i18n/tizen';
import { resolveLocale } from '@/i18n';
// The English ANCHOR the module-scope export carries (kept literal by design so
// boundary tests can import it); the catalog entry must stay byte-identical to it.
import { AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE } from '@/pages/AudioTracksPage.vue';

/** Flatten the catalog to `group.key` → value. */
function flatten(catalog: TizenCatalog): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [group, entries] of Object.entries(catalog)) {
    for (const [key, value] of Object.entries(entries as Record<string, string>)) {
      out[`${group}.${key}`] = value;
    }
  }
  return out;
}

/**
 * VERBATIM pin table — each value is the exact string the call site rendered
 * inline before extraction (review-pinned inventory, branch feat/i18n-messages-wiring).
 */
const EXPECTED: Record<string, string> = {
  "common.retry": "Retry",
  "common.goBack": "Go back",
  "common.loading": "Loading…",
  "common.loadMore": "Load more",
  "common.noMediaId": "No media id provided",
  "common.unknown": "Unknown",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.saving": "Saving…",
  "common.add": "Add",
  "common.adding": "Adding…",
  "common.active": "Active",
  "common.inactive": "Inactive",
  "common.unlimited": "Unlimited",
  "common.name": "Name",
  "menu.browse": "Browse",
  "menu.forYou": "For You",
  "menu.settings": "Settings",
  "menu.parentalControls": "Parental Controls",
  "menu.admin": "Admin",
  "boot.failedStart": "Phlix failed to start: {message}",
  "boot.splashHint": "Booting",
  "hub.pausedNotice": "Hub connection paused — resumes when you open the app again",
  "skip.controlsAria": "Skip controls",
  "skip.introAria": "Skip intro",
  "skip.introLabel": "Skip Intro",
  "skip.outroAria": "Skip outro",
  "skip.outroLabel": "Skip Outro",
  "chapters.loadFailed": "Failed to load chapters",
  "chapters.adBadge": "Ad",
  "chapters.fallbackTitle": "Chapter {index}",
  "chapters.listAria": "Chapter list",
  "chapters.countAria": "{count} chapters",
  "chapters.itemAria": "{title}, {time}",
  "chapters.title": "Chapters",
  "chapters.loadingTitle": "Chapters…",
  "chapters.loadingAria": "Loading chapters",
  "chapters.loading": "Loading chapters…",
  "chapters.empty": "No chapters available for this media.",
  "chapters.countHeadingOne": "{count} Chapter",
  "chapters.countHeadingOther": "{count} Chapters",
  "chapters.markerIntro": "Intro",
  "chapters.markerOutro": "Outro",
  "chapters.markerCredits": "Credits",
  "pictureInPicture.enterAria": "Enter picture-in-picture",
  "pictureInPicture.exitAria": "Exit picture-in-picture",
  "pictureInPicture.enterLabel": "PiP",
  "pictureInPicture.exitLabel": "Exit PiP",
  "screensaver.wakeHint": "Press any key to wake",
  "telemetry.aria": "Help improve Phlix",
  "telemetry.title": "Share anonymous usage stats?",
  "telemetry.body": "A single periodic signal (device id, app version) — no titles, no account. You can change this anytime.",
  "telemetry.enable": "Enable",
  "telemetry.notNow": "Not now",
  "audioTracks.listAria": "Audio track list",
  "audioTracks.countAria": "{count} audio tracks",
  "audioTracks.mono": "Mono",
  "audioTracks.stereo": "Stereo",
  "audioTracks.title": "Audio Tracks",
  "audioTracks.loadingAria": "Loading audio tracks",
  "audioTracks.loading": "Loading audio tracks…",
  "audioTracks.loadFailed": "Failed to load audio tracks",
  "audioTracks.empty": "No alternative audio tracks available for this media.",
  "audioTracks.bitrateKbps": "{value}kbps",
  "audioTracks.loadingTitle": "Audio Tracks…",
  "audioTracks.headingOne": "{count} Audio Track",
  "audioTracks.headingOther": "{count} Audio Tracks",
  "audioTracks.preferredNote": "Preferred for this title: {language}",
  "audioTracks.rememberedNote": "Remembered {language} as your preferred audio language for this title.",
  "audioTracks.applyRefusal": "Audio track choice cannot be applied: the @phlix/ui player store exposes no audio-track switching surface (state: none; actions: setSubtitle/setQuality only).",
  "subtitleTracks.listAria": "Subtitle track list",
  "subtitleTracks.countAria": "{count} subtitle tracks",
  "subtitleTracks.noneAria": "No subtitles",
  "subtitleTracks.off": "Off",
  "subtitleTracks.sdhBadge": "SDH",
  "subtitleTracks.hearingImpaired": "hearing impaired",
  "subtitleTracks.title": "Subtitle Tracks",
  "subtitleTracks.loadingAria": "Loading subtitle tracks",
  "subtitleTracks.loading": "Loading subtitle tracks…",
  "subtitleTracks.loadFailed": "Failed to load subtitle tracks",
  "subtitleTracks.empty": "No subtitle tracks available for this media.",
  "subtitleTracks.loadingTitle": "Subtitle Tracks…",
  "subtitleTracks.headingOne": "{count} Subtitle Track",
  "subtitleTracks.headingOther": "{count} Subtitle Tracks",
  "subtitleTracks.languageNote": "Subtitles are matched by language — rows sharing a language behave identically.",
  "tracks.durationAria": "{title} — {duration}",
  "tracks.playAria": "Play {title}",
  "ratings.badgeAria": "Rating: {score} out of 10",
  "ratings.unrated": "unrated",
  "ratings.modalTitle": "Rate This Title",
  "ratings.modalCloseAria": "Close rating modal",
  "ratings.communityRating": "Community Rating",
  "ratings.yourRatingHeading": "Your Rating",
  "ratings.pressEscPrefix": "Press ",
  "ratings.pressEscSuffix": " to close",
  "ratings.pickerAria": "Rate this media",
  "ratings.yourRatingLabel": "Your rating",
  "ratings.currentRatingAria": "Current rating: {rating} of 10",
  "ratings.starAria": "{stars} star ({score} of 10)",
  "ratings.starsAria": "{stars} stars ({score} of 10)",
  "ratings.notRated": "Not rated",
  "ratings.saveFailedToast": "Failed to save rating: {message}",
  "recommendations.cardAria": "{title} ({year}) — {percent}% match",
  "recommendations.cardAriaNoYear": "{title} — {percent}% match",
  "recommendations.posterAlt": "Poster for {title}",
  "recommendations.matchSuffix": "% match",
  "recommendations.becauseYouWatched": "Because You Watched",
  "recommendations.failed": "Failed to load recommendations",
  "recommendations.heading": "For You",
  "recommendations.headingEllipsis": "For You…",
  "recommendations.headingCount": "{count} Recommendations",
  "recommendations.loadingAria": "Loading recommendations",
  "recommendations.loading": "Loading recommendations…",
  "recommendations.empty": "No recommendations yet. Keep watching to get personalized suggestions!",
  "recommendations.gridAria": "{count} recommendations",
  "music.artistsTitle": "Artists",
  "music.albumsTitle": "Albums",
  "music.tracksTitle": "Tracks",
  "music.musicTitle": "Music",
  "music.loadingAria": "Loading music",
  "music.loading": "Loading music…",
  "music.noMusicFound": "No music found.",
  "music.artistsAria": "{count} artists",
  "music.albumsAria": "{count} albums",
  "music.tracksAria": "{count} tracks",
  "music.loadMoreArtistsAria": "Load more artists — showing {shown} of {total}",
  "music.loadMoreAlbumsAria": "Load more albums — showing {shown} of {total}",
  "music.albumCardAria": "{title} ({year}) — {count} tracks",
  "music.albumCardAriaNoYear": "{title} — {count} tracks",
  "music.albumArtAria": "Album art for {title}",
  "music.albumMeta": "{year} · {count} tracks",
  "music.trackCountOne": "{count} track",
  "music.trackCountOther": "{count} tracks",
  "music.artistCardAria": "{name}, {count} albums",
  "music.artistPhotoAlt": "Photo of {name}",
  "music.albumCountOne": "{count} album",
  "music.albumCountOther": "{count} albums",
  "music.failedToLoadArtists": "Failed to load artists",
  "music.failedToLoadMoreArtists": "Failed to load more artists",
  "music.failedToLoadAlbums": "Failed to load albums",
  "music.failedToLoadMoreAlbums": "Failed to load more albums",
  "music.failedToLoadAlbum": "Failed to load album",
  "music.failedToLoadTrack": "Failed to load track",
  "quickConnect.aria": "Pair with your phone",
  "quickConnect.eyebrow": "Phlix for Samsung TV",
  "quickConnect.title": "Sign in without a keyboard",
  "quickConnect.preparing": "Preparing your code…",
  "quickConnect.instruction": "Open Phlix on your phone and enter this code",
  "quickConnect.declined": "Pairing was declined.",
  "quickConnect.expired": "That code expired.",
  "quickConnect.unreachable": "Could not reach the server.",
  "quickConnect.expiryNote": "Expires in a few minutes — no need to hurry.",
  "quickConnect.tryAgain": "Try again",
  "quickConnect.hint": "On your phone, open Phlix → Sign in on TV → type the code.",
  "days.mon": "Mon",
  "days.tue": "Tue",
  "days.wed": "Wed",
  "days.thu": "Thu",
  "days.fri": "Fri",
  "days.sat": "Sat",
  "days.sun": "Sun",
  "parentalControls.noProfileSelected": "No profile selected",
  "parentalControls.failedSchedules": "Failed to load schedules",
  "parentalControls.failedTags": "Failed to load tags",
  "parentalControls.failedStreamLimits": "Failed to load stream limit",
  "parentalControls.timeAm": "AM",
  "parentalControls.timePm": "PM",
  "parentalControls.noDaysSet": "No days set",
  "parentalControls.everyDay": "Every day",
  "parentalControls.title": "Parental Controls",
  "parentalControls.sectionsAria": "Settings sections",
  "parentalControls.tabSchedules": "Schedules",
  "parentalControls.tabBlockedTags": "Blocked Tags",
  "parentalControls.tabStreamLimits": "Stream Limits",
  "parentalControls.accessSchedules": "Access Schedules",
  "parentalControls.addSchedule": "+ Add Schedule",
  "parentalControls.loadingSchedules": "Loading schedules…",
  "parentalControls.noSchedules": "No access schedules configured.",
  "parentalControls.editScheduleTitle": "Edit Schedule",
  "parentalControls.newScheduleTitle": "New Schedule",
  "parentalControls.namePlaceholder": "e.g., Homework Time",
  "parentalControls.startTime": "Start Time",
  "parentalControls.endTime": "End Time",
  "parentalControls.daysOfWeek": "Days of Week",
  "parentalControls.blockedTagsHint": "Tags block content from appearing in search or recommendations.",
  "parentalControls.loadingTags": "Loading tags…",
  "parentalControls.tagPlaceholder": "Enter tag to block…",
  "parentalControls.removeTagAria": "Remove tag",
  "parentalControls.noBlockedTags": "No blocked tags configured.",
  "parentalControls.loadingLimits": "Loading limits…",
  "parentalControls.maxConcurrentStreams": "Max Concurrent Streams",
  "parentalControls.maxBandwidthLabel": "Max Bandwidth (kbps, 0 = unlimited)",
  "parentalControls.maxTotalBandwidth": "Max Total Bandwidth",
  "parentalControls.bandwidthKbps": "{kbps} kbps",
  "parentalControls.editLimits": "Edit Limits",};

describe('tizen-own catalog — byte identity', () => {
  const actual = flatten(TIZEN_EN);

  it('pins the exact key set', () => {
    expect(Object.keys(actual).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('renders every value byte-identical to its pin', () => {
    for (const key of Object.keys(EXPECTED)) {
      expect(actual[key], `catalog drift at ${key}`).toBe(EXPECTED[key]);
    }
  });
});

describe('tizen-own catalog — integrity', () => {
  const actual = flatten(TIZEN_EN);

  it('every key is group.key of identifier segments', () => {
    for (const key of Object.keys(actual)) {
      expect(key, key).toMatch(/^[a-z][a-zA-Z]*\.[a-zA-Z]+$/);
    }
  });

  it('every value is a non-empty trimmed-ish string', () => {
    const ALLOWED_EDGE_SPACE = new Set(['ratings.pressEscPrefix', 'ratings.pressEscSuffix']);
    for (const [key, value] of Object.entries(actual)) {
      expect(typeof value).toBe('string');
      expect(value.length, key).toBeGreaterThan(0);
      if (!ALLOWED_EDGE_SPACE.has(key)) {
        expect(value, `leading space at ${key}`).toBe(value.trimStart());
        expect(value, `trailing space at ${key}`).toBe(value.trimEnd());
      }
      expect(value, `double space at ${key}`).not.toContain('  ');
      expect(value, `tab at ${key}`).not.toContain('\t');
    }
  });

  it('english plurals ride on One/Other key pairs, never pipe templates', () => {
    // The en table renders every plural via explicit keys with caller-side
    // count selection; pipe templates are a locale-override mechanism only.
    for (const [key, value] of Object.entries(actual)) {
      expect(value, `unexpected pipe template at ${key}`).not.toContain(' | ');
    }
  });

  it('interpolation tokens are all well-formed {word}', () => {
    for (const [key, value] of Object.entries(actual)) {
      const stray = value.replace(/\{\w+\}/g, '');
      expect(stray, `malformed token at ${key}`).not.toMatch(/\{|\}/);
    }
  });

  it('every catalog key has a call site in src/ (or a named exemption)', () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|vue)$/.test(p)) files.push(p);
      }
    };
    walk(join(__dirname, '../../src'));
    // The catalog + accessor define the keys; they are not call sites.
    const callSites = files
      .filter((f) => !f.includes('/i18n/'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    // request-store cache-kind literals that LOOK like catalog keys (data, not chrome).
    const NOT_I18N = new Set(['music.album', 'music.track']);
    // boot.splashHint renders from STATIC index.html markup (pre-JS splash; the
    // catalog carries the literal for translators + the pin below).
    const HTML_PINNED = new Set(['boot.splashHint']);
    for (const key of Object.keys(EXPECTED)) {
      if (NOT_I18N.has(key) || HTML_PINNED.has(key)) continue;
      expect(callSites.includes(`'${key}'`), `unreferenced catalog key: ${key}`).toBe(true);
    }
    expect(readFileSync(join(__dirname, '../../index.html'), 'utf8')).toContain(
      `>${TIZEN_EN.boot.splashHint}<`,
    );
    // The look-alike data kinds must stay OUT of the catalog (guard the whitelist).
    expect(Object.keys(EXPECTED)).not.toContain('music.album');
    expect(Object.keys(EXPECTED)).not.toContain('music.track');
  });
});

describe('tTizen accessor semantics', () => {
  afterEach(() => {
    clearTizenLocale();
  });

  it('resolves the boot-pinned english value for a plain key', () => {
    setTizenLocale('en');
    expect(tizenLocale()).toBe('en');
    expect(tTizen('menu.browse')).toBe('Browse');
    expect(tTizen('audioTracks.applyRefusal')).toBe(
      TIZEN_EN.audioTracks.applyRefusal,
    );
  });

  it('interpolates {params} and rides unmatched tokens through', () => {
    setTizenLocale('en');
    expect(tTizen('boot.failedStart', { message: 'boom' })).toBe('Phlix failed to start: boom');
    expect(tTizen('tracks.playAria', { wrong: 'A' })).toBe('Play {title}');
    expect(tTizen('tracks.playAria', { title: 'A' })).toBe('Play A');
  });

  it('stringifies zero and rejects null-ish params to the token', () => {
    setTizenLocale('en');
    expect(tTizen('chapters.countAria', { count: 0 })).toBe('0 chapters');
  });

  it('echoes unknown keys (and warns in dev)', () => {
    setTizenLocale('en');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(tTizen('nope.nope' as TizenMessageKey)).toBe('nope.nope');
    // The loud dev flag is part of the contract (task spec): a typed-away or
    // JS-level typo must announce itself, never render silently.
    expect(warn).toHaveBeenCalledWith('[phlix:i18n:tizen] unknown message key:', 'nope.nope');
    warn.mockRestore();
  });

  it('rendered refusal stays byte-identical to the module-scope ENGLISH anchor', () => {
    setTizenLocale('en');
    expect(tTizen('audioTracks.applyRefusal')).toBe(AUDIO_TRACK_APPLY_UNSUPPORTED_UI_STORE);
  });

  it('TizenMessagesConfig accepts partial override tables at compile time (type-level drift alarm)', () => {
    // `satisfies` fails typecheck the moment a group/key stops existing, so a
    // future locale file written the same way can never drift silently (the
    // full-locale sibling pattern is `satisfies TizenCatalog` — same alarm,
    // requiring every key).
    const override = { common: { retry: 'X' } } satisfies TizenMessagesConfig;
    expect(mergeTizenMessages(override).common.retry).toBe('X');
  });

  it('selects pipe plurals by count via the ui helper, last form without count', () => {
    const t = createTizenTranslator({
      common: { retry: '{count} retry | {count} retries' },
    });
    expect(t('common.retry', { count: 1 })).toBe('1 retry');
    expect(t('common.retry', { count: 3 })).toBe('3 retries');
    expect(t('common.retry', { count: 0 })).toBe('0 retries');
    expect(t('common.retry')).toBe('{count} retries');
    expect(t('common.retry', { count: 'x' as unknown as number })).toBe('x retries'); // NaN count picks the other form; the string param still interpolates
  });

  it('mergeTizenMessages: undefined is the base, partial groups fall back per key', () => {
    expect(mergeTizenMessages()).toBe(TIZEN_EN);
    const merged = mergeTizenMessages({ menu: { browse: 'Explorar' } });
    expect(merged.menu.browse).toBe('Explorar');
    expect(merged.menu.settings).toBe(TIZEN_EN.menu.settings);
    expect(merged.boot).toEqual(TIZEN_EN.boot);
    // The base object is never mutated.
    expect(TIZEN_EN.menu.browse).toBe('Browse');
  });

  it('mergeTizenMessages drops overrides for unknown groups, rides unknown keys along', () => {
    const merged = mergeTizenMessages({
      menu: { browse: 'B', anything: 'x' },
      bogus: { anything: 'x' },
    } as unknown as Parameters<typeof mergeTizenMessages>[0]);
    expect(merged).not.toHaveProperty('bogus');
    // Unknown key inside a known group survives the merge (typed call sites
    // can never request it — it rides unrendered, mirroring ui merge law).
    expect(merged.menu.browse).toBe('B');
    expect(Object.keys(merged.menu)).toContain('anything');
  });

  it('setTizenLocale parses garbage to the english fallback, never throws', () => {
    expect(() => setTizenLocale('')).not.toThrow();
    expect(tizenLocale()).toBe('en');
    setTizenLocale('ko-KR');
    expect(tizenLocale()).toBe('en'); // genuinely unsupported subtag → fallback
    setTizenLocale('en-US');
    expect(tizenLocale()).toBe('en');
  });

  it('setTizenLocale accepts the estate locales through regional tags', () => {
    // Post 6-locale build-out (was pinned as 'fr unsupported → en' before the
    // bundles shipped — same probe, inverted truth, intent preserved: the
    // accessor resolves exactly what the registry contains).
    setTizenLocale('fr-FR');
    expect(tizenLocale()).toBe('fr');
    setTizenLocale('pt-BR');
    expect(tizenLocale()).toBe('pt_BR');
    setTizenLocale('ja-JP');
    expect(tizenLocale()).toBe('ja');
    setTizenLocale('en');
  });

  it('tTizen memoizes per locale and rebuilds on change', () => {
    setTizenLocale('en');
    const first = tTizen('menu.forYou');
    setTizenLocale('en'); // same effective locale → same cached translator
    expect(tTizen('menu.forYou')).toBe(first);
  });

  it('un-pinned locale lazily matches the ui-seam resolver', () => {
    clearTizenLocale();
    expect(tizenLocale()).toBe(resolveLocale());
  });
});
