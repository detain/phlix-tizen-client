/**
 * Tizen-OWN Italian (it) catalog — full translation of `TIZEN_EN`.
 *
 * Language decisions (translation-judgment inventory, estate review):
 * - Informal "tu" / nominal imperative register (TV UI standard, matches the
 *   ui SSOT it voice: "Riprova", "Continua a guardare").
 * - Brands/technical tokens kept verbatim: Phlix, Samsung TV, PiP, SDH, Mono,
 *   Stereo, Intro, Outro, Tag, Hub, AM/PM, kbps, and the API phrase
 *   '(state: none; actions: setSubtitle/setQuality only)'.
 * - "Picture-in-picture" → "immagine in immagine" (Apple it convention).
 * - Recommendations family uses "consigli" (Netflix it "Per te" / "Consigli");
 *   the headingCount/gridAria additive pipes follow "Consiglio | Consigli".
 * - Italian does not capitalize sentence-initially inside aria templates
 *   beyond normal sentence case.
 * - "album" is an invariable masculine loanword in Italian, so album pipe
 *   pairs repeat the same noun in both segments (uniform two-slot law).
 * - Values legitimately identical to English (allow-listed in
 *   tests/unit/i18nLocales.test.ts): tracks.durationAria, chapters.itemAria,
 *   chapters.markerIntro, chapters.markerOutro, audioTracks.bitrateKbps,
 *   audioTracks.mono, audioTracks.stereo, music.albumCountOne,
 *   parentalControls.bandwidthKbps, parentalControls.timeAm,
 *   parentalControls.timePm, pictureInPicture.enterLabel,
 *   subtitleTracks.sdhBadge.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { TizenCatalog } from './en';

const common = {
  retry: 'Riprova',
  goBack: 'Indietro',
  loading: 'Caricamento…',
  loadMore: 'Carica altro',
  noMediaId: 'Nessun ID contenuto fornito',
  unknown: 'Sconosciuto',
  edit: 'Modifica',
  delete: 'Elimina',
  cancel: 'Annulla',
  save: 'Salva',
  saving: 'Salvataggio…',
  add: 'Aggiungi',
  adding: 'Aggiunta…',
  active: 'Attivo',
  inactive: 'Inattivo',
  unlimited: 'Illimitato',
  name: 'Nome',
};

const menu = {
  browse: 'Esplora',
  forYou: 'Per te',
  settings: 'Impostazioni',
  parentalControls: 'Controllo parentale',
  admin: 'Amministrazione',
};

const boot = {
  failedStart: 'Impossibile avviare Phlix: {message}',
  splashHint: 'Avvio in corso',
};

const hub = {
  pausedNotice: 'Connessione all’hub in pausa — riprende quando riapri l’app',
};

const skip = {
  controlsAria: 'Controlli di salto',
  introAria: 'Salta introduzione',
  introLabel: 'Salta introduzione',
  outroAria: 'Salta finale',
  outroLabel: 'Salta finale',
};

const chapters = {
  loadFailed: 'Impossibile caricare i capitoli',
  adBadge: 'Annuncio',
  fallbackTitle: 'Capitolo {index}',
  listAria: 'Elenco capitoli',
  countAria: '{count} capitolo | {count} capitoli',
  itemAria: '{title}, {time}',
  title: 'Capitoli',
  loadingTitle: 'Capitoli…',
  loadingAria: 'Caricamento capitoli',
  loading: 'Caricamento capitoli…',
  empty: 'Nessun capitolo disponibile per questo contenuto.',
  countHeadingOne: '{count} Capitolo',
  countHeadingOther: '{count} Capitoli',
  markerIntro: 'Intro',
  markerOutro: 'Outro',
  markerCredits: 'Titoli di coda',
};

const pictureInPicture = {
  enterAria: 'Apri immagine in immagine',
  exitAria: 'Chiudi immagine in immagine',
  enterLabel: 'PiP',
  exitLabel: 'Chiudi PiP',
};

const screensaver = {
  wakeHint: 'Premi un tasto qualsiasi per riattivare',
};

const telemetry = {
  aria: 'Aiuta a migliorare Phlix',
  title: 'Condividere statistiche di utilizzo anonime?',
  body: 'Un singolo segnale periodico (ID dispositivo, versione app) — nessun titolo, nessun account. Puoi modificarlo in qualsiasi momento.',
  enable: 'Attiva',
  notNow: 'Non ora',
};

const audioTracks = {
  listAria: 'Elenco tracce audio',
  countAria: '{count} traccia audio | {count} tracce audio',
  mono: 'Mono',
  stereo: 'Stereo',
  title: 'Tracce audio',
  loadingAria: 'Caricamento tracce audio',
  loading: 'Caricamento tracce audio…',
  loadFailed: 'Impossibile caricare le tracce audio',
  empty: 'Nessuna traccia audio alternativa disponibile per questo contenuto.',
  bitrateKbps: '{value}kbps',
  loadingTitle: 'Tracce audio…',
  headingOne: '{count} Traccia audio',
  headingOther: '{count} Tracce audio',
  preferredNote: 'Preferita per questo titolo: {language}',
  rememberedNote: '{language} è stata salvata come lingua audio preferita per questo titolo.',
  applyRefusal: 'La scelta della traccia audio non può essere applicata: il player store di @phlix/ui non espone alcuna interfaccia per cambiare traccia (state: none; actions: setSubtitle/setQuality only).',
};

const subtitleTracks = {
  listAria: 'Elenco sottotitoli',
  countAria: '{count} sottotitolo | {count} sottotitoli',
  noneAria: 'Nessun sottotitolo',
  off: 'Disattivati',
  sdhBadge: 'SDH',
  hearingImpaired: 'per non udenti',
  title: 'Sottotitoli',
  loadingAria: 'Caricamento sottotitoli',
  loading: 'Caricamento sottotitoli…',
  loadFailed: 'Impossibile caricare i sottotitoli',
  empty: 'Nessun sottotitolo disponibile per questo contenuto.',
  loadingTitle: 'Sottotitoli…',
  headingOne: '{count} Sottotitolo',
  headingOther: '{count} Sottotitoli',
  languageNote: 'I sottotitoli sono abbinati per lingua: le righe con la stessa lingua si comportano allo stesso modo.',
};

const tracks = {
  durationAria: '{title} — {duration}',
  playAria: 'Riproduci {title}',
};

const ratings = {
  badgeAria: 'Voto: {score} su 10',
  unrated: 'senza voto',
  modalTitle: 'Valuta questo titolo',
  modalCloseAria: 'Chiudi la finestra di valutazione',
  communityRating: 'Voto della community',
  yourRatingHeading: 'La tua valutazione',
  pressEscPrefix: 'Premi ',
  pressEscSuffix: ' per chiudere',
  pickerAria: 'Valuta questo contenuto',
  yourRatingLabel: 'La tua valutazione',
  currentRatingAria: 'Valutazione attuale: {rating} su 10',
  starAria: '{stars} stella ({score} su 10)',
  starsAria: '{stars} stelle ({score} su 10)',
  notRated: 'Non valutato',
  saveFailedToast: 'Impossibile salvare la valutazione: {message}',
};

const recommendations = {
  cardAria: '{title} ({year}) — {percent}% di corrispondenza',
  cardAriaNoYear: '{title} — {percent}% di corrispondenza',
  posterAlt: 'Poster di {title}',
  matchSuffix: '% di corrispondenza',
  becauseYouWatched: 'Perché hai guardato',
  failed: 'Impossibile caricare i consigli',
  heading: 'Per te',
  headingEllipsis: 'Per te…',
  headingCount: '{count} Consiglio | {count} Consigli',
  loadingAria: 'Caricamento consigli',
  loading: 'Caricamento consigli…',
  empty: 'Ancora nessun consiglio. Continua a guardare per ricevere suggerimenti personalizzati!',
  gridAria: '{count} consiglio | {count} consigli',
};

const music = {
  artistsTitle: 'Artisti',
  albumsTitle: 'Album',
  tracksTitle: 'Brani',
  musicTitle: 'Musica',
  loadingAria: 'Caricamento musica',
  loading: 'Caricamento musica…',
  noMusicFound: 'Nessuna musica trovata.',
  artistsAria: '{count} artista | {count} artisti',
  albumsAria: '{count} album | {count} album',
  tracksAria: '{count} brano | {count} brani',
  loadMoreArtistsAria: 'Carica altri artisti — mostrati {shown} di {total}',
  loadMoreAlbumsAria: 'Carica altri album — mostrati {shown} di {total}',
  albumCardAria: '{title} ({year}) — {count} brano | {title} ({year}) — {count} brani',
  albumCardAriaNoYear: '{title} — {count} brano | {title} — {count} brani',
  albumArtAria: 'Copertina dell’album di {title}',
  albumMeta: '{year} · {count} brano | {year} · {count} brani',
  trackCountOne: '{count} brano',
  trackCountOther: '{count} brani',
  artistCardAria: '{name}, {count} album | {name}, {count} album',
  artistPhotoAlt: 'Foto di {name}',
  albumCountOne: '{count} album',
  albumCountOther: '{count} album',
  failedToLoadArtists: 'Impossibile caricare gli artisti',
  failedToLoadMoreArtists: 'Impossibile caricare altri artisti',
  failedToLoadAlbums: 'Impossibile caricare gli album',
  failedToLoadMoreAlbums: 'Impossibile caricare altri album',
  failedToLoadAlbum: 'Impossibile caricare l’album',
  failedToLoadTrack: 'Impossibile caricare il brano',
};

const quickConnect = {
  aria: 'Abbina il telefono',
  eyebrow: 'Phlix per Samsung TV',
  title: 'Accedi senza tastiera',
  preparing: 'Preparazione del codice…',
  instruction: 'Apri Phlix sul telefono e inserisci questo codice',
  declined: 'L’abbinamento è stato rifiutato.',
  expired: 'Il codice è scaduto.',
  unreachable: 'Impossibile raggiungere il server.',
  expiryNote: 'Scade tra qualche minuto — nessuna fretta.',
  tryAgain: 'Riprova',
  hint: 'Sul telefono, apri Phlix → Accedi su TV → digita il codice.',
};

const days = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mer',
  thu: 'Gio',
  fri: 'Ven',
  sat: 'Sab',
  sun: 'Dom',
};

const parentalControls = {
  noProfileSelected: 'Nessun profilo selezionato',
  failedSchedules: 'Impossibile caricare gli orari',
  failedTags: 'Impossibile caricare i tag',
  failedStreamLimits: 'Impossibile caricare il limite di streaming',
  timeAm: 'AM',
  timePm: 'PM',
  noDaysSet: 'Nessun giorno impostato',
  everyDay: 'Ogni giorno',
  title: 'Controllo parentale',
  sectionsAria: 'Sezioni delle impostazioni',
  tabSchedules: 'Orari',
  tabBlockedTags: 'Tag bloccati',
  tabStreamLimits: 'Limiti di streaming',
  accessSchedules: 'Orari di accesso',
  addSchedule: '+ Aggiungi orario',
  loadingSchedules: 'Caricamento orari…',
  noSchedules: 'Nessun orario di accesso configurato.',
  editScheduleTitle: 'Modifica orario',
  newScheduleTitle: 'Nuovo orario',
  namePlaceholder: 'Es., tempo per i compiti',
  startTime: 'Ora di inizio',
  endTime: 'Ora di fine',
  daysOfWeek: 'Giorni della settimana',
  blockedTagsHint: 'I tag impediscono la comparsa dei contenuti nella ricerca o nei consigli.',
  loadingTags: 'Caricamento tag…',
  tagPlaceholder: 'Inserisci un tag da bloccare…',
  removeTagAria: 'Rimuovi tag',
  noBlockedTags: 'Nessun tag bloccato configurato.',
  loadingLimits: 'Caricamento limiti…',
  maxConcurrentStreams: 'Flussi simultanei massimi',
  maxBandwidthLabel: 'Larghezza di banda massima (kbps, 0 = illimitata)',
  maxTotalBandwidth: 'Larghezza di banda totale massima',
  bandwidthKbps: '{kbps} kbps',
  editLimits: 'Modifica limiti',
};

/**
 * Complete Italian override for the Tizen-own catalog — see `es.ts` for why
 * `satisfies TizenCatalog` is the full-translation key-set law.
 */
export const IT_TIZEN_MESSAGES = {
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
} satisfies TizenCatalog;
