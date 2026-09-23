/**
 * Tizen-OWN Spanish (es) catalog — full translation of `TIZEN_EN`.
 *
 * Language decisions (translation-judgment inventory, estate review):
 * - Neutral Latin-American Spanish, "tú" register — mirroring the ui SSOT es
 *   bundle voice ("your cinema" friendly English → informal tú).
 * - Brands/technical tokens kept verbatim: Phlix, Samsung TV, PiP, SDH, Mono,
 *   AM/PM, kbps, and the developer-facing API phrase '(state: none; actions:
 *   setSubtitle/setQuality only)' inside audioTracks.applyRefusal.
 * - "Picture-in-picture" → "imagen en imagen" (Apple/Google es convention).
 * - Skip labels: "Saltar introducción" / "Saltar cierre"; marker tooltips use
 *   the matching nouns ("Introducción" / "Final"… see below) — outro renders
 *   as "Final" in badges to avoid the awkward loanword "Outro".
 * - Plurals: the English catalog encodes singular/plural as One/Other KEY
 *   pairs (call-site selection) and hardcodes plurals in `{count}` aria/heading
 *   strings. Where English hardcoded a plural AND the call site passes
 *   `count`, es adds the honest CLDR two-segment pipe template
 *   ({count} capítulo | {count} capítulos …) — the same additive-plural
 *   doctrine the ui SSOT applied to player.subtitleDownloads.
 * - Heading keys keep English-style sentence capitalization for display
 *   parity ("{count} Capítulos").
 * - Values legitimately identical to English (allow-listed in
 *   tests/unit/i18nLocales.test.ts): tracks.durationAria, chapters.itemAria,
 *   audioTracks.bitrateKbps, audioTracks.mono, parentalControls.bandwidthKbps,
 *   parentalControls.timeAm, parentalControls.timePm,
 *   pictureInPicture.enterLabel, subtitleTracks.sdhBadge.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { TizenCatalog } from './en';

const common = {
  retry: 'Reintentar',
  goBack: 'Volver',
  loading: 'Cargando…',
  loadMore: 'Cargar más',
  noMediaId: 'No se proporcionó el ID del contenido',
  unknown: 'Desconocido',
  edit: 'Editar',
  delete: 'Eliminar',
  cancel: 'Cancelar',
  save: 'Guardar',
  saving: 'Guardando…',
  add: 'Añadir',
  adding: 'Añadiendo…',
  active: 'Activo',
  inactive: 'Inactivo',
  unlimited: 'Ilimitado',
  name: 'Nombre',
};

const menu = {
  browse: 'Explorar',
  forYou: 'Para ti',
  settings: 'Ajustes',
  parentalControls: 'Control parental',
  admin: 'Administración',
};

const boot = {
  failedStart: 'Phlix no pudo iniciarse: {message}',
  splashHint: 'Iniciando',
};

const hub = {
  pausedNotice: 'Conexión con el hub en pausa — se reanuda al abrir la aplicación de nuevo',
};

const skip = {
  controlsAria: 'Controles de salto',
  introAria: 'Saltar introducción',
  introLabel: 'Saltar introducción',
  outroAria: 'Saltar cierre',
  outroLabel: 'Saltar cierre',
};

const chapters = {
  loadFailed: 'No se pudieron cargar los capítulos',
  adBadge: 'Anuncio',
  fallbackTitle: 'Capítulo {index}',
  listAria: 'Lista de capítulos',
  countAria: '{count} capítulo | {count} capítulos',
  itemAria: '{title}, {time}',
  title: 'Capítulos',
  loadingTitle: 'Capítulos…',
  loadingAria: 'Cargando capítulos',
  loading: 'Cargando capítulos…',
  empty: 'No hay capítulos disponibles para este contenido.',
  countHeadingOne: '{count} Capítulo',
  countHeadingOther: '{count} Capítulos',
  markerIntro: 'Introducción',
  markerOutro: 'Final',
  markerCredits: 'Créditos',
};

const pictureInPicture = {
  enterAria: 'Abrir imagen en imagen',
  exitAria: 'Cerrar imagen en imagen',
  enterLabel: 'PiP',
  exitLabel: 'Salir de PiP',
};

const screensaver = {
  wakeHint: 'Pulsa cualquier tecla para activar',
};

const telemetry = {
  aria: 'Ayuda a mejorar Phlix',
  title: '¿Compartir estadísticas de uso anónimas?',
  body: 'Una única señal periódica (ID del dispositivo, versión de la app) — sin títulos, sin cuenta. Puedes cambiar esto en cualquier momento.',
  enable: 'Activar',
  notNow: 'Ahora no',
};

const audioTracks = {
  listAria: 'Lista de pistas de audio',
  countAria: '{count} pista de audio | {count} pistas de audio',
  mono: 'Mono',
  stereo: 'Estéreo',
  title: 'Pistas de audio',
  loadingAria: 'Cargando pistas de audio',
  loading: 'Cargando pistas de audio…',
  loadFailed: 'No se pudieron cargar las pistas de audio',
  empty: 'No hay pistas de audio alternativas disponibles para este contenido.',
  bitrateKbps: '{value}kbps',
  loadingTitle: 'Pistas de audio…',
  headingOne: '{count} Pista de audio',
  headingOther: '{count} Pistas de audio',
  preferredNote: 'Preferida para este título: {language}',
  rememberedNote: 'Recordé {language} como tu idioma de audio preferido para este título.',
  applyRefusal: 'No se puede aplicar la elección de pista de audio: el player store de @phlix/ui no expone ninguna interfaz para cambiar de pista (state: none; actions: setSubtitle/setQuality only).',
};

const subtitleTracks = {
  listAria: 'Lista de subtítulos',
  countAria: '{count} subtítulo | {count} subtítulos',
  noneAria: 'Sin subtítulos',
  off: 'Desactivados',
  sdhBadge: 'SDH',
  hearingImpaired: 'discapacidad auditiva',
  title: 'Subtítulos',
  loadingAria: 'Cargando subtítulos',
  loading: 'Cargando subtítulos…',
  loadFailed: 'No se pudieron cargar los subtítulos',
  empty: 'No hay subtítulos disponibles para este contenido.',
  loadingTitle: 'Subtítulos…',
  headingOne: '{count} Subtítulo',
  headingOther: '{count} Subtítulos',
  languageNote: 'Los subtítulos se emparejan por idioma: las filas con el mismo idioma se comportan igual.',
};

const tracks = {
  durationAria: '{title} — {duration}',
  playAria: 'Reproducir {title}',
};

const ratings = {
  badgeAria: 'Valoración: {score} sobre 10',
  unrated: 'sin valorar',
  modalTitle: 'Valora este título',
  modalCloseAria: 'Cerrar el diálogo de valoración',
  communityRating: 'Valoración de la comunidad',
  yourRatingHeading: 'Tu valoración',
  pressEscPrefix: 'Pulsa ',
  pressEscSuffix: ' para cerrar',
  pickerAria: 'Valora este contenido',
  yourRatingLabel: 'Tu valoración',
  currentRatingAria: 'Valoración actual: {rating} de 10',
  starAria: '{stars} estrella ({score} de 10)',
  starsAria: '{stars} estrellas ({score} de 10)',
  notRated: 'Sin valorar',
  saveFailedToast: 'No se pudo guardar la valoración: {message}',
};

const recommendations = {
  cardAria: '{title} ({year}) — {percent}% de coincidencia',
  cardAriaNoYear: '{title} — {percent}% de coincidencia',
  posterAlt: 'Póster de {title}',
  matchSuffix: '% de coincidencia',
  becauseYouWatched: 'Porque viste',
  failed: 'No se pudieron cargar las recomendaciones',
  heading: 'Para ti',
  headingEllipsis: 'Para ti…',
  headingCount: '{count} Recomendación | {count} Recomendaciones',
  loadingAria: 'Cargando recomendaciones',
  loading: 'Cargando recomendaciones…',
  empty: 'Aún no hay recomendaciones. ¡Sigue viendo para recibir sugerencias personalizadas!',
  gridAria: '{count} recomendación | {count} recomendaciones',
};

const music = {
  artistsTitle: 'Artistas',
  albumsTitle: 'Álbums',
  tracksTitle: 'Pistas',
  musicTitle: 'Música',
  loadingAria: 'Cargando música',
  loading: 'Cargando música…',
  noMusicFound: 'No se encontró música.',
  artistsAria: '{count} artista | {count} artistas',
  albumsAria: '{count} álbum | {count} álbumes',
  tracksAria: '{count} pista | {count} pistas',
  loadMoreArtistsAria: 'Cargar más artistas — mostrando {shown} de {total}',
  loadMoreAlbumsAria: 'Cargar más álbumes — mostrando {shown} de {total}',
  albumCardAria: '{title} ({year}) — {count} pista | {title} ({year}) — {count} pistas',
  albumCardAriaNoYear: '{title} — {count} pista | {title} — {count} pistas',
  albumArtAria: 'Portada del álbum de {title}',
  albumMeta: '{year} · {count} pista | {year} · {count} pistas',
  trackCountOne: '{count} pista',
  trackCountOther: '{count} pistas',
  artistCardAria: '{name}, {count} álbum | {name}, {count} álbumes',
  artistPhotoAlt: 'Foto de {name}',
  albumCountOne: '{count} álbum',
  albumCountOther: '{count} álbumes',
  failedToLoadArtists: 'No se pudieron cargar los artistas',
  failedToLoadMoreArtists: 'No se pudieron cargar más artistas',
  failedToLoadAlbums: 'no se pudieron cargar los álbumes',
  failedToLoadMoreAlbums: 'No se pudieron cargar más álbumes',
  failedToLoadAlbum: 'No se pudo cargar el álbum',
  failedToLoadTrack: 'No se pudo cargar la pista',
};

const quickConnect = {
  aria: 'Empareja con tu teléfono',
  eyebrow: 'Phlix para Samsung TV',
  title: 'Inicia sesión sin teclado',
  preparing: 'Preparando tu código…',
  instruction: 'Abre Phlix en tu teléfono e introduce este código',
  declined: 'El emparejamiento fue rechazado.',
  expired: 'Ese código caducó.',
  unreachable: 'No se pudo contactar con el servidor.',
  expiryNote: 'Caduca en unos minutos — no hay prisa.',
  tryAgain: 'Intentar de nuevo',
  hint: 'En tu teléfono, abre Phlix → Iniciar sesión en TV → escribe el código.',
};

const days = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
};

const parentalControls = {
  noProfileSelected: 'Ningún perfil seleccionado',
  failedSchedules: 'No se pudieron cargar los horarios',
  failedTags: 'No se pudieron cargar las etiquetas',
  failedStreamLimits: 'No se pudo cargar el límite de transmisión',
  timeAm: 'AM',
  timePm: 'PM',
  noDaysSet: 'Sin días definidos',
  everyDay: 'Todos los días',
  title: 'Control parental',
  sectionsAria: 'Secciones de ajustes',
  tabSchedules: 'Horarios',
  tabBlockedTags: 'Etiquetas bloqueadas',
  tabStreamLimits: 'Límites de transmisión',
  accessSchedules: 'Horarios de acceso',
  addSchedule: '+ Añadir horario',
  loadingSchedules: 'Cargando horarios…',
  noSchedules: 'No hay horarios de acceso configurados.',
  editScheduleTitle: 'Editar horario',
  newScheduleTitle: 'Nuevo horario',
  namePlaceholder: 'P. ej., hora de deberes',
  startTime: 'Hora de inicio',
  endTime: 'Hora de fin',
  daysOfWeek: 'Días de la semana',
  blockedTagsHint: 'Las etiquetas impiden que el contenido aparezca en la búsqueda o en las recomendaciones.',
  loadingTags: 'Cargando etiquetas…',
  tagPlaceholder: 'Introduce una etiqueta para bloquear…',
  removeTagAria: 'Quitar etiqueta',
  noBlockedTags: 'No hay etiquetas bloqueadas configuradas.',
  loadingLimits: 'Cargando límites…',
  maxConcurrentStreams: 'Máximo de transmisiones simultáneas',
  maxBandwidthLabel: 'Ancho de banda máximo (kbps, 0 = sin límite)',
  maxTotalBandwidth: 'Ancho de banda total máximo',
  bandwidthKbps: '{kbps} kbps',
  editLimits: 'Editar límites',
};

/**
 * Complete Spanish override for the Tizen-own catalog. `satisfies
 * TizenCatalog` (not the deep-partial `TizenMessagesConfig`) is the
 * full-translation form of the key-set law: TypeScript fails the moment this
 * file drifts from English, group by group, key by key.
 */
export const ES_TIZEN_MESSAGES = {
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
