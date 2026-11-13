/**
 * Tizen-OWN German (de) catalog — full translation of `TIZEN_EN`.
 *
 * Language decisions (translation-judgment inventory, estate review):
 * - Informal "du" register (consumer TV UI, Netflix/Disney+ de convention).
 * - Nouns capitalized per German orthography; compound labels preferred
 *   ("Audiospurliste", "Kapitelliste") to keep TV rows short.
 * - Brands/technical tokens kept verbatim: Phlix, Samsung TV, PiP, SDH, Mono,
 *   Stereo, Intro, Outro, Stream, Tag, Hub, AM/PM, kbps.
 * - "Picture-in-picture" → "Bild-im-Bild" (Microsoft/Apple de convention).
 * - Recommendations heading pair: "Für dich" (de TV convention for "For You").
 * - German "Kapitel"/"Titel"/"Künstler" do not inflect for the plural, so
 *   several One/Other pairs and pipe segments are intentionally IDENTICAL —
 *   the segment law keeps two slots so the mechanism stays uniform.
 * - Values legitimately identical to English (allow-listed in
 *   tests/unit/i18nLocales.test.ts): common.name, tracks.durationAria,
 *   chapters.itemAria,
 *   audioTracks.bitrateKbps, audioTracks.mono, audioTracks.stereo,
 *   parentalControls.bandwidthKbps,
 *   parentalControls.timeAm, parentalControls.timePm,
 *   subtitleTracks.sdhBadge.
 *   parentalControls.stepMinusHour, parentalControls.stepMinusQuarter,
 *   parentalControls.stepPlusQuarter, parentalControls.stepPlusHour
 *   (m3 schedule-stepper symbols, 2026-11-03).
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { TizenCatalog } from './en';

const common = {
  retry: 'Erneut versuchen',
  goBack: 'Zurück',
  loading: 'Wird geladen…',
  loadMore: 'Mehr laden',
  noMediaId: 'Nichts anzuzeigen — öffne dies aus einem Titel.',
  unknown: 'Unbekannt',
  edit: 'Bearbeiten',
  delete: 'Löschen',
  cancel: 'Abbrechen',
  save: 'Speichern',
  saving: 'Speichern…',
  add: 'Hinzufügen',
  adding: 'Wird hinzugefügt…',
  active: 'Aktiv',
  inactive: 'Inaktiv',
  unlimited: 'Unbegrenzt',
  name: 'Name',
};

const menu = {
  browse: 'Stöbern',
  forYou: 'Für dich',
  settings: 'Einstellungen',
  tvSettings: 'TV-Einstellungen',
  parentalControls: 'Jugendschutz',
  admin: 'Verwaltung',
};

const boot = {
  failedStart: 'Phlix konnte nicht gestartet werden: {message}',
  retryHint: 'Schließ Phlix und öffne die App erneut.',
  recentFailures: 'Letzte Fehler:',
  splashHint: 'Wird gestartet',
};

const hub = {
  pausedNotice: 'Hub-Verbindung pausiert — setzt ein, wenn du die App erneut öffnest.',
};

const chapters = {
  loadFailed: 'Kapitel konnten nicht geladen werden',
  fallbackTitle: 'Kapitel {index}',
  listAria: 'Kapitelliste',
  countAria: '{count} Kapitel | {count} Kapitel',
  itemAria: '{title}, {time}',
  title: 'Kapitel',
  loadingTitle: 'Kapitel…',
  loadingAria: 'Kapitel werden geladen',
  loading: 'Kapitel werden geladen…',
  empty: 'Für dieses Medium sind keine Kapitel verfügbar.',
  countHeadingOne: '{count} Kapitel',
  countHeadingOther: '{count} Kapitel',
};

const screensaver = {
  wakeHint: 'Taste drücken zum Aktivieren',
};

const tvSettings = {
  title: 'TV-Einstellungen',
  idleLabel: 'Bildschirmschoner',
  idleHint: 'Leerlaufzeit bis zum Start des Bildschirmschoners. Links oder rechts drücken zum Ändern.',
  minutes: '{minutes} Min.',
};

const telemetry = {
  aria: 'Hilf mit, Phlix zu verbessern',
  title: 'Anonyme Nutzungsstatistiken teilen?',
  body: 'Ein einzelnes periodisches Signal (Geräte-ID, App-Version) — keine Titel, kein Konto. Diese Karte ist die einzige Entscheidung — nichts wird gesendet, bis du wählst.',
  enable: 'Aktivieren',
  notNow: 'Jetzt nicht',
};

const audioTracks = {
  listAria: 'Audiospurliste',
  countAria: '{count} Audiospur | {count} Audiospuren',
  mono: 'Mono',
  stereo: 'Stereo',
  title: 'Audiospuren',
  loadingAria: 'Audiospuren werden geladen',
  loading: 'Audiospuren werden geladen…',
  loadFailed: 'Audiospuren konnten nicht geladen werden',
  empty: 'Für dieses Medium sind keine alternativen Audiospuren verfügbar.',
  bitrateKbps: '{value} kbps',
  loadingTitle: 'Audiospuren…',
  headingOne: '{count} Audiospur',
  headingOther: '{count} Audiospuren',
  preferredNote: 'Bevorzugt für diesen Titel: {language}',
  rememberedNote: '{language} wurde als bevorzugte Audiosprache für diesen Titel gemerkt.',
  saveFailedNote: '{language} konnte nicht in deinem Konto gespeichert werden — dieses Gerät merkt sich deine Auswahl trotzdem.',
  applyRefusal: 'Dieser Player kann noch keine Audiospuren umschalten — deine Auswahl wird für das nächste Mal gemerkt.',
};

const subtitleTracks = {
  listAria: 'Untertitelliste',
  countAria: '{count} Untertitel | {count} Untertitel',
  noneAria: 'Keine Untertitel',
  off: 'Aus',
  sdhBadge: 'SDH',
  hearingImpaired: 'für Hörgeschädigte',
  title: 'Untertitel',
  loadingAria: 'Untertitel werden geladen',
  loading: 'Untertitel werden geladen…',
  loadFailed: 'Untertitel konnten nicht geladen werden',
  empty: 'Für dieses Medium sind keine Untertitel verfügbar.',
  loadingTitle: 'Untertitel…',
  headingOne: '{count} Untertitel',
  headingOther: '{count} Untertitel',
  languageNote: 'Untertitel werden nach Sprache abgeglichen — Zeilen mit derselben Sprache verhalten sich identisch.',
};

const tracks = {
  durationAria: '{title} — {duration}',
  playAria: '{title} abspielen',
};

const recommendations = {
  cardAria: '{title} ({year}) — {percent} % Übereinstimmung',
  cardAriaNoYear: '{title} — {percent} % Übereinstimmung',
  posterAlt: 'Poster für {title}',
  matchSuffix: '% Übereinstimmung',
  becauseYouWatched: 'Weil du das geschaut hast',
  failed: 'Empfehlungen konnten nicht geladen werden',
  heading: 'Für dich',
  headingEllipsis: 'Für dich…',
  headingCount: '{count} Empfehlung | {count} Empfehlungen',
  loadingAria: 'Empfehlungen werden geladen',
  loading: 'Empfehlungen werden geladen…',
  empty: 'Noch keine Empfehlungen. Schau weiter, um personalisierte Vorschläge zu erhalten.',
  gridAria: '{count} Empfehlung | {count} Empfehlungen',
};

const music = {
  artistsTitle: 'Künstler',
  albumsTitle: 'Alben',
  tracksTitle: 'Titel',
  musicTitle: 'Musik',
  loadingAria: 'Musik wird geladen',
  loading: 'Musik wird geladen…',
  noMusicFound: 'Keine Musik gefunden.',
  artistsAria: '{count} Künstler | {count} Künstler',
  albumsAria: '{count} Album | {count} Alben',
  tracksAria: '{count} Titel | {count} Titel',
  loadMoreArtistsAria: 'Mehr Künstler laden — {shown} von {total} angezeigt',
  loadMoreAlbumsAria: 'Mehr Alben laden — {shown} von {total} angezeigt',
  albumCardAria: '{title} ({year}) — {count} Titel | {title} ({year}) — {count} Titel',
  albumCardAriaNoYear: '{title} — {count} Titel | {title} — {count} Titel',
  albumArtAria: 'Albumcover zu {title}',
  albumMeta: '{year} · {count} Titel | {year} · {count} Titel',
  trackCountOne: '{count} Titel',
  trackCountOther: '{count} Titel',
  artistCardAria: '{name}, {count} Album | {name}, {count} Alben',
  artistPhotoAlt: 'Foto von {name}',
  albumCountOne: '{count} Album',
  albumCountOther: '{count} Alben',
  failedToLoadArtists: 'Künstler konnten nicht geladen werden',
  failedToLoadMoreArtists: 'Weitere Künstler konnten nicht geladen werden',
  failedToLoadAlbums: 'Alben konnten nicht geladen werden',
  failedToLoadMoreAlbums: 'Weitere Alben konnten nicht geladen werden',
  failedToLoadAlbum: 'Album konnte nicht geladen werden',
  failedToLoadTrack: 'Titel konnte nicht geladen werden',
};

const quickConnect = {
  aria: 'Mit dem Telefon koppeln',
  eyebrow: 'Phlix für Samsung TV',
  title: 'Ohne Tastatur anmelden',
  // RT-097 chooser (the takeover opens on this decision, not on a ceremony).
  chooseTitle: 'An diesem TV anmelden',
  chooseLead: 'Wie möchtest du dich anmelden?',
  choosePassword: 'Mit Passwort anmelden',
  chooseCode: 'Mit einem Kopplungscode anmelden',
  preparing: 'Dein Code wird vorbereitet…',
  instruction: 'Gib diesen Code auf einem anderen angemeldeten Phlix-Gerät ein, um den TV zu koppeln.',
  declined: 'Die Kopplung wurde abgelehnt.',
  expired: 'Dieser Code ist abgelaufen.',
  unreachable: 'Der Server konnte nicht erreicht werden.',
  unsupported: 'Dieser Server unterstützt die Code-Anmeldung noch nicht — er muss aktualisiert werden. Verwende stattdessen dein Passwort.',
  expiryNote: 'Läuft in wenigen Minuten ab — kein Grund zur Eile.',
  tryAgain: 'Erneut versuchen',
  usePassword: 'Stattdessen Passwort eingeben',
  hint: 'Noch kann keine Companion-App einen Code bestätigen — wenn der Code abläuft, verwende dein Passwort.',
};

const days = {
  mon: 'Mo',
  tue: 'Di',
  wed: 'Mi',
  thu: 'Do',
  fri: 'Fr',
  sat: 'Sa',
  sun: 'So',
};

const parentalControls = {
  noProfileSelected: 'Kein Profil ausgewählt',
  failedSchedules: 'Zeitpläne konnten nicht geladen werden',
  failedTags: 'Tags konnten nicht geladen werden',
  failedStreamLimits: 'Stream-Limit konnte nicht geladen werden',
  tagMutationFailed: 'Die Tag-Änderung konnte nicht gespeichert werden — versuche es erneut.',
  scheduleDeleteFailed: 'Der Zeitplan konnte nicht gelöscht werden — versuche es erneut.',
  timeAm: 'AM',
  timePm: 'PM',
  noDaysSet: 'Keine Tage festgelegt',
  everyDay: 'Jeden Tag',
  title: 'Jugendschutz',
  sectionsAria: 'Einstellungsbereiche',
  tabSchedules: 'Zeitpläne',
  tabBlockedTags: 'Blockierte Tags',
  tabStreamLimits: 'Stream-Limits',
  accessSchedules: 'Zugangszeitpläne',
  addSchedule: '+ Zeitplan hinzufügen',
  loadingSchedules: 'Zeitpläne werden geladen…',
  noSchedules: 'Keine Zugangszeitpläne konfiguriert.',
  editScheduleTitle: 'Zeitplan bearbeiten',
  newScheduleTitle: 'Neuer Zeitplan',
  namePlaceholder: 'Z. B. Hausaufgabenzeit',
  startTime: 'Startzeit',
  endTime: 'Endzeit',
  daysOfWeek: 'Wochentage',
  blockedTagsHint: 'Tags halten Inhalte davon ab, in der Suche oder den Empfehlungen aufzutauchen.',
  loadingTags: 'Tags werden geladen…',
  tagPlaceholder: 'Zu blockierendes Tag eingeben…',
  removeTagAria: 'Tag entfernen',
  noBlockedTags: 'Keine blockierten Tags konfiguriert.',
  loadingLimits: 'Limits werden geladen…',
  maxConcurrentStreams: 'Maximal gleichzeitige Streams',
  maxBandwidthLabel: 'Max. Bandbreite (kbps, 0 = unbegrenzt)',
  maxTotalBandwidth: 'Max. Gesamtbandbreite',
  bandwidthKbps: '{kbps} kbps',
  editLimits: 'Limits bearbeiten',
  // m3 schedule-window stepper symbols (deferred review, 2026-11-03): locale-neutral
  // minute offsets, byte-identical to the English table (EN_LEAK_OK cohort).
  stepMinusHour: '-60',
  stepMinusQuarter: '-15',
  stepPlusQuarter: '+15',
  stepPlusHour: '+60',
  stepDownAria: 'Verringern',
  stepUpAria: 'Erhöhen',
};

/**
 * Complete German override for the Tizen-own catalog — see `es.ts` for why
 * `satisfies TizenCatalog` is the full-translation key-set law.
 */
export const DE_TIZEN_MESSAGES = {
  common,
  menu,
  boot,
  hub,
  chapters,
  screensaver,
  tvSettings,
  telemetry,
  audioTracks,
  subtitleTracks,
  tracks,
  recommendations,
  music,
  quickConnect,
  days,
  parentalControls,
} satisfies TizenCatalog;
