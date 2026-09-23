/**
 * Tizen-OWN English message catalog — every user-facing string the Tizen client
 * renders outside the `@phlix/ui` seam (boot chrome, TV overlays, D-pad lists,
 * the Quick-Connect panel, parental controls pages, track pages, screens).
 *
 * ## Shape mirrors the ui catalog on purpose
 *
 * Two levels (`group.key`), values typed as plain `string` (no `as const` —
 * same widening `@phlix/ui`'s `DEFAULT_MESSAGES` relies on so override tables
 * stay assignable; each group carries only `satisfies Record<string, string>`
 * as a non-string guard), `{name}` interpolation placeholders (mirroring ui's
 * `createTranslator`), and the same dotted-key union (`TizenMessageKey`).
 *
 * ## The byte-identity contract
 *
 * Every value here is the EXACT literal that previously sat inline at its call
 * site (review-pinned inventory, branch `feat/i18n-messages-wiring` @ 22a6955).
 * Interpolated originals became `{param}` templates; the surrounding call sites
 * pass the same runtime values. `tests/unit/tizenI18n.test.ts` pins every
 * value verbatim — changing a string here without changing the pin there is a
 * loud test failure, and the reverse drift is caught by the same file's
 * "catalog covers every key" integrity suite.
 *
 * ## Adding a locale
 *
 * See `src/i18n/tizen/index.ts` — one new override file + one registry line.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

/**
 * Cross-page primitives the Tizen client repeats verbatim (retry buttons,
 * back-affordance aria labels, generic form verbs). Grouped `common` exactly
 * like ui's `common` group so the two catalogs read alike.
 */
const common = {
  retry: 'Retry',
  goBack: 'Go back',
  loading: 'Loading…',
  loadMore: 'Load more',
  noMediaId: 'No media id provided',
  unknown: 'Unknown',
  edit: 'Edit',
  delete: 'Delete',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  add: 'Add',
  adding: 'Adding…',
  active: 'Active',
  inactive: 'Inactive',
  unlimited: 'Unlimited',
  name: 'Name',
} satisfies Record<string, string>;

const menu = {
  browse: 'Browse',
  forYou: 'For You',
  settings: 'Settings',
  parentalControls: 'Parental Controls',
  admin: 'Admin',
} satisfies Record<string, string>;

const boot = {
  failedStart: 'Phlix failed to start: {message}',
  // Static S515 AD-3 CSS-only splash (index.html): rendered with ZERO JS, so it
  // cannot call tTizen without violating the splash design. Cataloged anyway —
  // byte-pinned against index.html by tests/unit/tizenI18n.test.ts — so a future
  // locale wave has the string and its drift guard. The 'Phlix' wordmark beside
  // it is brand identity and stays excluded.
  splashHint: 'Booting',
} satisfies Record<string, string>;

const hub = {
  pausedNotice: 'Hub connection paused — resumes when you open the app again',
} satisfies Record<string, string>;

const skip = {
  controlsAria: 'Skip controls',
  introAria: 'Skip intro',
  introLabel: 'Skip Intro',
  outroAria: 'Skip outro',
  outroLabel: 'Skip Outro',
} satisfies Record<string, string>;

const chapters = {
  loadFailed: 'Failed to load chapters',
  adBadge: 'Ad',
  fallbackTitle: 'Chapter {index}',
  listAria: 'Chapter list',
  countAria: '{count} chapters',
  itemAria: '{title}, {time}',
  // ChaptersPage chrome (heading tri-state + load affordances). The count
  // heading keeps ui's singular/plural shape as two pinned keys
  // ('{n} Chapter' / '{n} Chapters') so the English render is byte-identical to the ternary it
  // replaces; locales with different plural rules override per CLDR later.
  title: 'Chapters',
  loadingTitle: 'Chapters…',
  loadingAria: 'Loading chapters',
  loading: 'Loading chapters…',
  empty: 'No chapters available for this media.',
  countHeadingOne: '{count} Chapter',
  countHeadingOther: '{count} Chapters',
  // Tooltip fallback labels for marker types without a server-supplied label
  // (contracts MarkerType union: intro | outro | credits | ad — 'Ad' reuses
  // adBadge above, byte-identical to the source's capitalized wire type).
  markerIntro: 'Intro',
  markerOutro: 'Outro',
  markerCredits: 'Credits',
} satisfies Record<string, string>;

const pictureInPicture = {
  enterAria: 'Enter picture-in-picture',
  exitAria: 'Exit picture-in-picture',
  enterLabel: 'PiP',
  exitLabel: 'Exit PiP',
} satisfies Record<string, string>;

const screensaver = {
  wakeHint: 'Press any key to wake',
} satisfies Record<string, string>;

const telemetry = {
  aria: 'Help improve Phlix',
  title: 'Share anonymous usage stats?',
  body: 'A single periodic signal (device id, app version) — no titles, no account. You can change this anytime.',
  enable: 'Enable',
  notNow: 'Not now',
} satisfies Record<string, string>;

const audioTracks = {
  listAria: 'Audio track list',
  countAria: '{count} audio tracks',
  mono: 'Mono',
  stereo: 'Stereo',
  title: 'Audio Tracks',
  loadingAria: 'Loading audio tracks',
  loading: 'Loading audio tracks…',
  loadFailed: 'Failed to load audio tracks',
  empty: 'No alternative audio tracks available for this media.',
  // Row-meta bitrate: the original template glued value and unit with NO space
  // (`320kbps`) — byte-pinned as such.
  bitrateKbps: '{value}kbps',
  // Page heading chrome (same tri-state shape the chapters/recommendations
  // pages use; One/Other pair keeps the English ternary render byte-identical).
  loadingTitle: 'Audio Tracks…',
  headingOne: '{count} Audio Track',
  headingOther: '{count} Audio Tracks',
  preferredNote: 'Preferred for this title: {language}',
  rememberedNote:
    'Remembered {language} as your preferred audio language for this title.',
  applyRefusal:
    'Audio track choice cannot be applied: the @phlix/ui player store exposes no audio-track switching surface (state: none; actions: setSubtitle/setQuality only).',
} satisfies Record<string, string>;

const subtitleTracks = {
  listAria: 'Subtitle track list',
  countAria: '{count} subtitle tracks',
  noneAria: 'No subtitles',
  off: 'Off',
  sdhBadge: 'SDH',
  hearingImpaired: 'hearing impaired',
  title: 'Subtitle Tracks',
  loadingAria: 'Loading subtitle tracks',
  loading: 'Loading subtitle tracks…',
  loadFailed: 'Failed to load subtitle tracks',
  empty: 'No subtitle tracks available for this media.',
  loadingTitle: 'Subtitle Tracks…',
  headingOne: '{count} Subtitle Track',
  headingOther: '{count} Subtitle Tracks',
  languageNote:
    'Subtitles are matched by language — rows sharing a language behave identically.',
} satisfies Record<string, string>;

const tracks = {
  durationAria: '{title} — {duration}',
  playAria: 'Play {title}',
} satisfies Record<string, string>;

const ratings = {
  badgeAria: 'Rating: {score} out of 10',
  unrated: 'unrated',
  modalTitle: 'Rate This Title',
  modalCloseAria: 'Close rating modal',
  communityRating: 'Community Rating',
  yourRatingHeading: 'Your Rating',
  pressEscPrefix: 'Press ',
  pressEscSuffix: ' to close',
  pickerAria: 'Rate this media',
  yourRatingLabel: 'Your rating',
  currentRatingAria: 'Current rating: {rating} of 10',
  starAria: '{stars} star ({score} of 10)',
  starsAria: '{stars} stars ({score} of 10)',
  notRated: 'Not rated',
  saveFailedToast: 'Failed to save rating: {message}',
} satisfies Record<string, string>;

const recommendations = {
  cardAria: '{title} ({year}) — {percent}% match',
  cardAriaNoYear: '{title} — {percent}% match',
  posterAlt: 'Poster for {title}',
  matchSuffix: '% match',
  becauseYouWatched: 'Because You Watched',
  failed: 'Failed to load recommendations',
  heading: 'For You',
  headingEllipsis: 'For You…',
  headingCount: '{count} Recommendations',
  loadingAria: 'Loading recommendations',
  loading: 'Loading recommendations…',
  empty: 'No recommendations yet. Keep watching to get personalized suggestions!',
  gridAria: '{count} recommendations',
} satisfies Record<string, string>;

const music = {
  artistsTitle: 'Artists',
  albumsTitle: 'Albums',
  tracksTitle: 'Tracks',
  musicTitle: 'Music',
  loadingAria: 'Loading music',
  loading: 'Loading music…',
  noMusicFound: 'No music found.',
  artistsAria: '{count} artists',
  albumsAria: '{count} albums',
  tracksAria: '{count} tracks',
  loadMoreArtistsAria: 'Load more artists — showing {shown} of {total}',
  loadMoreAlbumsAria: 'Load more albums — showing {shown} of {total}',
  albumCardAria: '{title} ({year}) — {count} tracks',
  albumCardAriaNoYear: '{title} — {count} tracks',
  albumArtAria: 'Album art for {title}',
  albumMeta: '{year} · {count} tracks',
  // MusicAlbumCard body count ("1 track" / "5 tracks") — the original hand-rolled
  // `=== 1 ? 'track' : 'tracks'` ternary, cataloged as One/Other pair.
  trackCountOne: '{count} track',
  trackCountOther: '{count} tracks',
  artistCardAria: '{name}, {count} albums',
  artistPhotoAlt: 'Photo of {name}',
  // MusicArtistCard body count ("1 album" / "3 albums") ternary pair.
  albumCountOne: '{count} album',
  albumCountOther: '{count} albums',
  failedToLoadArtists: 'Failed to load artists',
  failedToLoadMoreArtists: 'Failed to load more artists',
  failedToLoadAlbums: 'Failed to load albums',
  failedToLoadMoreAlbums: 'Failed to load more albums',
  failedToLoadAlbum: 'Failed to load album',
  failedToLoadTrack: 'Failed to load track',
} satisfies Record<string, string>;

const quickConnect = {
  aria: 'Pair with your phone',
  eyebrow: 'Phlix for Samsung TV',
  title: 'Sign in without a keyboard',
  preparing: 'Preparing your code…',
  instruction: 'Open Phlix on your phone and enter this code',
  declined: 'Pairing was declined.',
  expired: 'That code expired.',
  unreachable: 'Could not reach the server.',
  expiryNote: 'Expires in a few minutes — no need to hurry.',
  tryAgain: 'Try again',
  hint: 'On your phone, open Phlix → Sign in on TV → type the code.',
} satisfies Record<string, string>;

const days = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
} satisfies Record<string, string>;

const parentalControls = {
  noProfileSelected: 'No profile selected',
  failedSchedules: 'Failed to load schedules',
  failedTags: 'Failed to load tags',
  failedStreamLimits: 'Failed to load stream limit',
  timeAm: 'AM',
  timePm: 'PM',
  noDaysSet: 'No days set',
  everyDay: 'Every day',
  title: 'Parental Controls',
  sectionsAria: 'Settings sections',
  tabSchedules: 'Schedules',
  tabBlockedTags: 'Blocked Tags',
  tabStreamLimits: 'Stream Limits',
  accessSchedules: 'Access Schedules',
  addSchedule: '+ Add Schedule',
  loadingSchedules: 'Loading schedules…',
  noSchedules: 'No access schedules configured.',
  editScheduleTitle: 'Edit Schedule',
  newScheduleTitle: 'New Schedule',
  namePlaceholder: 'e.g., Homework Time',
  startTime: 'Start Time',
  endTime: 'End Time',
  daysOfWeek: 'Days of Week',
  blockedTagsHint: 'Tags block content from appearing in search or recommendations.',
  loadingTags: 'Loading tags…',
  tagPlaceholder: 'Enter tag to block…',
  removeTagAria: 'Remove tag',
  noBlockedTags: 'No blocked tags configured.',
  loadingLimits: 'Loading limits…',
  maxConcurrentStreams: 'Max Concurrent Streams',
  maxBandwidthLabel: 'Max Bandwidth (kbps, 0 = unlimited)',
  maxTotalBandwidth: 'Max Total Bandwidth',
  // Display value for a SET limit: the original glued value + ' kbps' in a
  // template (`3000 kbps`, WITH space) — byte-pinned; the 'Unlimited' branch of
  // that ternary reuses common.unlimited.
  bandwidthKbps: '{kbps} kbps',
  editLimits: 'Edit Limits',
} satisfies Record<string, string>;

/**
 * The full Tizen-own English catalog. `TIZEN_EN` is BOTH the shipped `en` table
 * and the fallback default every other locale partially overrides (mirroring how
 * ui treats `DEFAULT_MESSAGES`) — so a locale file may translate one string or
 * all of them and missing keys resolve to this English.
 */
export const TIZEN_EN = {
  common,
  menu,
  boot,
  hub,
  skip,
  chapters,
  pictureInPicture,
  screensaver,
  telemetry,
  audioTracks,
  subtitleTracks,
  tracks,
  ratings,
  recommendations,
  music,
  quickConnect,
  days,
  parentalControls,
};

/** The full catalog type (keys narrowed by inference, values widened to string). */
export type TizenCatalog = typeof TIZEN_EN;

/** A top-level tizen catalog group, e.g. `'menu'`. */
export type TizenMessageGroup = keyof TizenCatalog;

/** A dotted tizen message key, e.g. `'menu.browse'` — the argument to `tTizen()`. */
export type TizenMessageKey = {
  [G in TizenMessageGroup]: `${G & string}.${keyof TizenCatalog[G] & string}`;
}[TizenMessageGroup];

/**
 * A locale override table for the tizen-own catalog: every group and key
 * optional, exactly like ui's `PhlixMessagesConfig`. Future locale files declare
 * `satisfies TizenMessagesConfig` so a typo'd group/key fails typecheck (the
 * same "may only override known pairs" law the ui override table enforces).
 */
export type TizenMessagesConfig = {
  [G in TizenMessageGroup]?: Partial<TizenCatalog[G]>;
};
