/**
 * Tizen-OWN French (fr) catalog — full translation of `TIZEN_EN`.
 *
 * Language decisions (translation-judgment inventory, estate review):
 * - Formal "vous" register (TV-family context), matching the ui SSOT fr voice.
 * - French typography: thin-space-free " : " spacing before colons is used
 *   (plain spaces keep the file ASCII-simple); curly apostrophes ’ like the
 *   ui bundles; « % » space before percent in match copy ("à 85 %" style).
 * - Brands/technical tokens kept verbatim: Phlix, Samsung TV, PiP, SDH, Mono,
 *   AM/PM, kbps, tag (accepted loanword in fr UI for labels), and the API
 *   phrase '(state: none; actions: setSubtitle/setQuality only)'.
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
 *   pictureInPicture.enterLabel, subtitleTracks.sdhBadge.
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
  noMediaId: 'Aucun ID de média fourni',
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
  parentalControls: 'Contrôle parental',
  admin: 'Administration',
};

const boot = {
  failedStart: 'Échec du démarrage de Phlix : {message}',
  splashHint: 'Démarrage',
};

const hub = {
  pausedNotice: 'Connexion au hub suspendue — elle reprend à la prochaine ouverture de l’application',
};

const skip = {
  controlsAria: 'Commandes de saut',
  introAria: 'Passer l’intro',
  introLabel: 'Passer l’intro',
  outroAria: 'Passer la fin',
  outroLabel: 'Passer la fin',
};

const chapters = {
  loadFailed: 'Échec du chargement des chapitres',
  adBadge: 'Pub',
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
  markerIntro: 'Introduction',
  markerOutro: 'Fin',
  markerCredits: 'Générique',
};

const pictureInPicture = {
  enterAria: 'Activer l’image dans l’image',
  exitAria: 'Désactiver l’image dans l’image',
  enterLabel: 'PiP',
  exitLabel: 'Quitter PiP',
};

const screensaver = {
  wakeHint: 'Appuyez sur une touche pour réveiller',
};

const telemetry = {
  aria: 'Aidez à améliorer Phlix',
  title: 'Partager des statistiques d’utilisation anonymes ?',
  body: 'Un seul signal périodique (ID de l’appareil, version de l’application) — aucun titre, aucun compte. Vous pouvez modifier ce choix à tout moment.',
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
  bitrateKbps: '{value}kbps',
  loadingTitle: 'Pistes audio…',
  headingOne: '{count} Piste audio',
  headingOther: '{count} Pistes audio',
  preferredNote: 'Préférée pour ce titre : {language}',
  rememberedNote: '{language} a été mémorisée comme langue audio préférée pour ce titre.',
  applyRefusal: 'Le choix de piste audio ne peut pas être appliqué : le store du lecteur @phlix/ui n’expose aucune interface de changement de piste audio (state: none; actions: setSubtitle/setQuality only).',
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

const ratings = {
  badgeAria: 'Note : {score} sur 10',
  unrated: 'non noté',
  modalTitle: 'Noter ce titre',
  modalCloseAria: 'Fermer la fenêtre de notation',
  communityRating: 'Note de la communauté',
  yourRatingHeading: 'Votre note',
  pressEscPrefix: 'Appuyez sur ',
  pressEscSuffix: ' pour fermer',
  pickerAria: 'Noter ce média',
  yourRatingLabel: 'Votre note',
  currentRatingAria: 'Note actuelle : {rating} sur 10',
  starAria: '{stars} étoile ({score} sur 10)',
  starsAria: '{stars} étoiles ({score} sur 10)',
  notRated: 'Non noté',
  saveFailedToast: 'Échec de l’enregistrement de la note : {message}',
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
  empty: 'Aucune recommandation pour l’instant. Continuez à regarder pour recevoir des suggestions personnalisées !',
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
  preparing: 'Préparation de votre code…',
  instruction: 'Ouvrez Phlix sur votre téléphone et saisissez ce code',
  declined: 'L’association a été refusée.',
  expired: 'Ce code a expiré.',
  unreachable: 'Impossible de joindre le serveur.',
  expiryNote: 'Expire dans quelques minutes — pas besoin de se presser.',
  tryAgain: 'Réessayer',
  hint: 'Sur votre téléphone, ouvrez Phlix → Se connecter sur TV → saisissez le code.',
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
