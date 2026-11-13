/**
 * Tizen-OWN French (fr) catalog — full translation of `TIZEN_EN`.
 *
 * Language decisions (translation-judgment inventory, estate review):
 * - Formal "vous" register (TV-family context), matching the ui SSOT fr voice.
 * - French typography: thin-space-free " : " spacing before colons is used
 *   (plain spaces keep the file ASCII-simple); curly apostrophes ’ like the
 *   ui bundles; « % » space before percent in match copy ("à 85 %" style).
 * - Brands/technical tokens kept verbatim: Phlix, Samsung TV, PiP, SDH, Mono,
 *   AM/PM, kbps, tag (accepted loanword in fr UI for labels).
 * - "Picture-in-picture" → "image dans l’image" (Apple fr convention).
 * - Subtitle family uses plain "sous-titres" (fr does not say "pistes de
 *   sous-titres" in TV UIs); audio keeps "pistes audio".
 * - Plurals: same additive-pipeline doctrine as es — CLDR two-segment pipe
 *   templates where English hardcoded a plural and the call site passes
 *   `count`; One/Other keys carry singular/plural forms.
 * - Values legitimately identical to English (allow-listed in
 *   tests/unit/i18nLocales.test.ts): tracks.durationAria, chapters.itemAria,
 *   audioTracks.bitrateKbps, audioTracks.mono, music.albumsTitle,
 *   music.albumCountOne, music.albumCountOther, parentalControls.bandwidthKbps,
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
  retry: 'Réessayer',
  goBack: 'Retour',
  loading: 'Chargement…',
  loadMore: 'Charger plus',
  noMediaId: 'Rien à afficher — ouvrez cela depuis un titre.',
  unknown: 'Inconnu',
  edit: 'Modifier',
  delete: 'Supprimer',
  cancel: 'Annuler',
  save: 'Enregistrer',
  saving: 'Enregistrement…',
  add: 'Ajouter',
  adding: 'Ajout…',
  active: 'Actif',
  inactive: 'Inactif',
  unlimited: 'Illimité',
  name: 'Nom',
};

const menu = {
  browse: 'Parcourir',
  forYou: 'Pour vous',
  settings: 'Paramètres',
  tvSettings: 'Réglages TV',
  parentalControls: 'Contrôle parental',
  admin: 'Administration',
};

const boot = {
  failedStart: 'Échec du démarrage de Phlix : {message}',
  retryHint: 'Essayez de fermer Phlix, puis de rouvrir l’application.',
  recentFailures: 'Échecs récents :',
  splashHint: 'Démarrage',
};

const hub = {
  pausedNotice: 'Connexion au hub suspendue — elle reprend à la prochaine ouverture de l’application.',
};

const chapters = {
  loadFailed: 'Échec du chargement des chapitres',
  fallbackTitle: 'Chapitre {index}',
  listAria: 'Liste des chapitres',
  countAria: '{count} chapitre | {count} chapitres',
  itemAria: '{title}, {time}',
  title: 'Chapitres',
  loadingTitle: 'Chapitres…',
  loadingAria: 'Chargement des chapitres',
  loading: 'Chargement des chapitres…',
  empty: 'Aucun chapitre disponible pour ce média.',
  countHeadingOne: '{count} Chapitre',
  countHeadingOther: '{count} Chapitres',
};

const screensaver = {
  wakeHint: 'Appuyez sur une touche pour réveiller',
};

const tvSettings = {
  title: 'Réglages TV',
  idleLabel: 'Économiseur d’écran',
  idleHint: 'Délai d’inactivité avant l’économiseur d’écran. Appuyez à gauche ou à droite pour modifier.',
  minutes: '{minutes} minutes',
};

const telemetry = {
  aria: 'Aidez à améliorer Phlix',
  title: 'Partager des statistiques d’utilisation anonymes ?',
  body: 'Un seul signal périodique (ID de l’appareil, version de l’application) — aucun titre, aucun compte. Cette carte est le seul lieu de décision — rien n’est envoyé avant votre choix.',
  enable: 'Activer',
  notNow: 'Plus tard',
};

const audioTracks = {
  listAria: 'Liste des pistes audio',
  countAria: '{count} piste audio | {count} pistes audio',
  mono: 'Mono',
  stereo: 'Stéréo',
  title: 'Pistes audio',
  loadingAria: 'Chargement des pistes audio',
  loading: 'Chargement des pistes audio…',
  loadFailed: 'Échec du chargement des pistes audio',
  empty: 'Aucune piste audio alternative disponible pour ce média.',
  bitrateKbps: '{value} kbps',
  loadingTitle: 'Pistes audio…',
  headingOne: '{count} Piste audio',
  headingOther: '{count} Pistes audio',
  preferredNote: 'Préférée pour ce titre : {language}',
  rememberedNote: '{language} a été mémorisée comme langue audio préférée pour ce titre.',
  saveFailedNote: 'Impossible d’enregistrer {language} dans votre compte — cet appareil retient malgré tout votre choix.',
  applyRefusal: 'Ce lecteur ne peut pas encore changer de piste audio — votre choix est retenu pour la prochaine fois.',
};

const subtitleTracks = {
  listAria: 'Liste des sous-titres',
  countAria: '{count} sous-titre | {count} sous-titres',
  noneAria: 'Aucun sous-titre',
  off: 'Désactivés',
  sdhBadge: 'SDH',
  hearingImpaired: 'malentendant',
  title: 'Sous-titres',
  loadingAria: 'Chargement des sous-titres',
  loading: 'Chargement des sous-titres…',
  loadFailed: 'Échec du chargement des sous-titres',
  empty: 'Aucun sous-titre disponible pour ce média.',
  loadingTitle: 'Sous-titres…',
  headingOne: '{count} Sous-titre',
  headingOther: '{count} Sous-titres',
  languageNote: 'Les sous-titres sont appariés par langue — les lignes d’une même langue se comportent de façon identique.',
};

const tracks = {
  durationAria: '{title} — {duration}',
  playAria: 'Lire {title}',
};

const recommendations = {
  cardAria: '{title} ({year}) — correspondance à {percent} %',
  cardAriaNoYear: '{title} — correspondance à {percent} %',
  posterAlt: 'Affiche de {title}',
  matchSuffix: '% de correspondance',
  becauseYouWatched: 'Parce que vous avez regardé',
  failed: 'Échec du chargement des recommandations',
  heading: 'Pour vous',
  headingEllipsis: 'Pour vous…',
  headingCount: '{count} Recommandation | {count} Recommandations',
  loadingAria: 'Chargement des recommandations',
  loading: 'Chargement des recommandations…',
  empty: 'Aucune recommandation pour l’instant. Continuez à regarder pour recevoir des suggestions personnalisées.',
  gridAria: '{count} recommandation | {count} recommandations',
};

const music = {
  artistsTitle: 'Artistes',
  albumsTitle: 'Albums',
  tracksTitle: 'Pistes',
  musicTitle: 'Musique',
  loadingAria: 'Chargement de la musique',
  loading: 'Chargement de la musique…',
  noMusicFound: 'Aucune musique trouvée.',
  artistsAria: '{count} artiste | {count} artistes',
  albumsAria: '{count} album | {count} albums',
  tracksAria: '{count} piste | {count} pistes',
  loadMoreArtistsAria: 'Charger plus d’artistes — {shown} affichés sur {total}',
  loadMoreAlbumsAria: 'Charger plus d’albums — {shown} affichés sur {total}',
  albumCardAria: '{title} ({year}) — {count} piste | {title} ({year}) — {count} pistes',
  albumCardAriaNoYear: '{title} — {count} piste | {title} — {count} pistes',
  albumArtAria: 'Pochette de l’album {title}',
  albumMeta: '{year} · {count} piste | {year} · {count} pistes',
  trackCountOne: '{count} piste',
  trackCountOther: '{count} pistes',
  artistCardAria: '{name}, {count} album | {name}, {count} albums',
  artistPhotoAlt: 'Photo de {name}',
  albumCountOne: '{count} album',
  albumCountOther: '{count} albums',
  failedToLoadArtists: 'Échec du chargement des artistes',
  failedToLoadMoreArtists: 'Échec du chargement d’autres artistes',
  failedToLoadAlbums: 'Échec du chargement des albums',
  failedToLoadMoreAlbums: 'Échec du chargement d’autres albums',
  failedToLoadAlbum: 'Échec du chargement de l’album',
  failedToLoadTrack: 'Échec du chargement de la piste',
};

const quickConnect = {
  aria: 'Associez votre téléphone',
  eyebrow: 'Phlix pour Samsung TV',
  title: 'Connectez-vous sans clavier',
  // RT-097 chooser (the takeover opens on this decision, not on a ceremony).
  chooseTitle: 'Connectez-vous sur ce téléviseur',
  chooseLead: 'Comment voulez-vous vous connecter ?',
  choosePassword: 'Se connecter avec un mot de passe',
  chooseCode: 'Se connecter avec un code d’association',
  preparing: 'Préparation de votre code…',
  instruction: 'Saisissez ce code sur un autre appareil Phlix connecté pour associer la TV.',
  declined: 'L’association a été refusée.',
  expired: 'Ce code a expiré.',
  unreachable: 'Impossible de joindre le serveur.',
  unsupported: 'Ce serveur ne propose pas encore la connexion par code — il doit être mis à jour. Utilisez plutôt votre mot de passe.',
  expiryNote: 'Expire dans quelques minutes — pas besoin de se presser.',
  tryAgain: 'Réessayer',
  usePassword: 'Saisir le mot de passe à la place',
  hint: 'Aucune application compagnon ne peut encore approuver un code — s’il expire, utilisez votre mot de passe.',
};

const days = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mer',
  thu: 'Jeu',
  fri: 'Ven',
  sat: 'Sam',
  sun: 'Dim',
};

const parentalControls = {
  noProfileSelected: 'Aucun profil sélectionné',
  failedSchedules: 'Échec du chargement des horaires',
  failedTags: 'Échec du chargement des tags',
  failedStreamLimits: 'Échec du chargement de la limite de flux',
  tagMutationFailed: 'Impossible d’enregistrer la modification des tags — réessayez.',
  scheduleDeleteFailed: 'Impossible de supprimer cet horaire — réessayez.',
  timeAm: 'AM',
  timePm: 'PM',
  noDaysSet: 'Aucun jour défini',
  everyDay: 'Tous les jours',
  title: 'Contrôle parental',
  sectionsAria: 'Sections des paramètres',
  tabSchedules: 'Horaires',
  tabBlockedTags: 'Tags bloqués',
  tabStreamLimits: 'Limites de flux',
  accessSchedules: 'Horaires d’accès',
  addSchedule: '+ Ajouter un horaire',
  loadingSchedules: 'Chargement des horaires…',
  noSchedules: 'Aucun horaire d’accès configuré.',
  editScheduleTitle: 'Modifier l’horaire',
  newScheduleTitle: 'Nouvel horaire',
  namePlaceholder: 'Ex. : heure des devoirs',
  startTime: 'Heure de début',
  endTime: 'Heure de fin',
  daysOfWeek: 'Jours de la semaine',
  blockedTagsHint: 'Les tags empêchent le contenu d’apparaître dans la recherche ou les recommandations.',
  loadingTags: 'Chargement des tags…',
  tagPlaceholder: 'Saisissez un tag à bloquer…',
  removeTagAria: 'Supprimer le tag',
  noBlockedTags: 'Aucun tag bloqué configuré.',
  loadingLimits: 'Chargement des limites…',
  maxConcurrentStreams: 'Nombre maximal de flux simultanés',
  maxBandwidthLabel: 'Bande passante maximale (kbps, 0 = illimitée)',
  maxTotalBandwidth: 'Bande passante totale maximale',
  bandwidthKbps: '{kbps} kbps',
  editLimits: 'Modifier les limites',
  // m3 schedule-window stepper symbols (deferred review, 2026-11-03): locale-neutral
  // minute offsets, byte-identical to the English table (EN_LEAK_OK cohort).
  stepMinusHour: '-60',
  stepMinusQuarter: '-15',
  stepPlusQuarter: '+15',
  stepPlusHour: '+60',
  stepDownAria: 'Diminuer',
  stepUpAria: 'Augmenter',
};

/**
 * Complete French override for the Tizen-own catalog — see `es.ts` for why
 * `satisfies TizenCatalog` is the full-translation key-set law.
 */
export const FR_TIZEN_MESSAGES = {
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
