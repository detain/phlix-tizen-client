/**
 * Tizen-OWN Brazilian Portuguese (pt_BR) catalog — full translation of
 * `TIZEN_EN`.
 *
 * Language decisions (translation-judgment inventory, estate review):
 * - Brazilian register with "você" (Netflix/Disney+ pt-BR standard). NOT
 *   European Portuguese: "ecrã"/"telemóvel"/"iniciar sessão em" pt-PT forms
 *   are deliberately avoided in favour of "tela"/"celular"/"entrar na TV".
 * - The registry key is the region tag `pt_BR` itself (see normalizeLocaleTag
 *   in src/i18n/index.ts — every `pt-*` device signal resolves here).
 * - Brands/technical tokens kept verbatim: Phlix, Samsung TV, PiP, SDH, Mono,
 *   AM/PM, kbps, tag, and the API phrase '(state: none; actions:
 *   setSubtitle/setQuality only)'.
 * - "Picture-in-picture" → "imagem na imagem" (Apple pt-BR convention).
 * - "legenda" is the pt-BR word for subtitles (not "subtítulo" calques);
 *   audio keeps "faixa de áudio".
 * - Plurals: same additive-pipeline doctrine as es/fr/it — CLDR two-segment
 *   pipes where English hardcoded a plural and the call site passes `count`.
 * - Values legitimately identical to English (allow-listed in
 *   tests/unit/i18nLocales.test.ts): tracks.durationAria, chapters.itemAria,
 *   audioTracks.bitrateKbps, audioTracks.mono,
 *   parentalControls.bandwidthKbps, parentalControls.timeAm,
 *   parentalControls.timePm, pictureInPicture.enterLabel,
 *   subtitleTracks.sdhBadge.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { TizenCatalog } from './en';

const common = {
  retry: 'Tentar novamente',
  goBack: 'Voltar',
  loading: 'Carregando…',
  loadMore: 'Carregar mais',
  noMediaId: 'Nenhum ID de mídia fornecido',
  unknown: 'Desconhecido',
  edit: 'Editar',
  delete: 'Excluir',
  cancel: 'Cancelar',
  save: 'Salvar',
  saving: 'Salvando…',
  add: 'Adicionar',
  adding: 'Adicionando…',
  active: 'Ativo',
  inactive: 'Inativo',
  unlimited: 'Ilimitado',
  name: 'Nome',
};

const menu = {
  browse: 'Explorar',
  forYou: 'Para você',
  settings: 'Configurações',
  parentalControls: 'Controle dos pais',
  admin: 'Administração',
};

const boot = {
  failedStart: 'Falha ao iniciar o Phlix: {message}',
  splashHint: 'Inicializando',
};

const hub = {
  pausedNotice: 'Conexão com o hub pausada — retoma quando você abrir o app novamente',
};

const skip = {
  controlsAria: 'Controles de pular',
  introAria: 'Pular introdução',
  introLabel: 'Pular introdução',
  outroAria: 'Pular final',
  outroLabel: 'Pular final',
};

const chapters = {
  loadFailed: 'Falha ao carregar os capítulos',
  adBadge: 'Anúncio',
  fallbackTitle: 'Capítulo {index}',
  listAria: 'Lista de capítulos',
  countAria: '{count} capítulo | {count} capítulos',
  itemAria: '{title}, {time}',
  title: 'Capítulos',
  loadingTitle: 'Capítulos…',
  loadingAria: 'Carregando capítulos',
  loading: 'Carregando capítulos…',
  empty: 'Nenhum capítulo disponível para esta mídia.',
  countHeadingOne: '{count} Capítulo',
  countHeadingOther: '{count} Capítulos',
  markerIntro: 'Introdução',
  markerOutro: 'Final',
  markerCredits: 'Créditos',
};

const pictureInPicture = {
  enterAria: 'Abrir imagem na imagem',
  exitAria: 'Fechar imagem na imagem',
  enterLabel: 'PiP',
  exitLabel: 'Fechar PiP',
};

const screensaver = {
  wakeHint: 'Pressione qualquer tecla para ativar',
};

const telemetry = {
  aria: 'Ajude a melhorar o Phlix',
  title: 'Compartilhar estatísticas de uso anônimas?',
  body: 'Um único sinal periódico (ID do dispositivo, versão do app) — sem títulos, sem conta. Você pode mudar isso a qualquer momento.',
  enable: 'Ativar',
  notNow: 'Agora não',
};

const audioTracks = {
  listAria: 'Lista de faixas de áudio',
  countAria: '{count} faixa de áudio | {count} faixas de áudio',
  mono: 'Mono',
  stereo: 'Estéreo',
  title: 'Faixas de áudio',
  loadingAria: 'Carregando faixas de áudio',
  loading: 'Carregando faixas de áudio…',
  loadFailed: 'Falha ao carregar as faixas de áudio',
  empty: 'Nenhuma faixa de áudio alternativa disponível para esta mídia.',
  bitrateKbps: '{value}kbps',
  loadingTitle: 'Faixas de áudio…',
  headingOne: '{count} Faixa de áudio',
  headingOther: '{count} Faixas de áudio',
  preferredNote: 'Preferida para este título: {language}',
  rememberedNote: '{language} foi definido como seu idioma de áudio preferido para este título.',
  applyRefusal: 'A escolha da faixa de áudio não pode ser aplicada: o player store do @phlix/ui não expõe uma interface para trocar de faixa (state: none; actions: setSubtitle/setQuality only).',
};

const subtitleTracks = {
  listAria: 'Lista de legendas',
  countAria: '{count} legenda | {count} legendas',
  noneAria: 'Sem legendas',
  off: 'Desativadas',
  sdhBadge: 'SDH',
  hearingImpaired: 'deficiência auditiva',
  title: 'Faixas de legenda',
  loadingAria: 'Carregando faixas de legenda',
  loading: 'Carregando faixas de legenda…',
  loadFailed: 'Falha ao carregar as faixas de legenda',
  empty: 'Nenhuma faixa de legenda disponível para esta mídia.',
  loadingTitle: 'Faixas de legenda…',
  headingOne: '{count} Faixa de legenda',
  headingOther: '{count} Faixas de legenda',
  languageNote: 'As legendas são correspondidas por idioma — linhas com o mesmo idioma se comportam igual.',
};

const tracks = {
  durationAria: '{title} — {duration}',
  playAria: 'Reproduzir {title}',
};

const ratings = {
  badgeAria: 'Avaliação: {score} de 10',
  unrated: 'sem avaliação',
  modalTitle: 'Avalie este título',
  modalCloseAria: 'Fechar o modal de avaliação',
  communityRating: 'Avaliação da comunidade',
  yourRatingHeading: 'Sua avaliação',
  pressEscPrefix: 'Pressione ',
  pressEscSuffix: ' para fechar',
  pickerAria: 'Avalie esta mídia',
  yourRatingLabel: 'Sua avaliação',
  currentRatingAria: 'Avaliação atual: {rating} de 10',
  starAria: '{stars} estrela ({score} de 10)',
  starsAria: '{stars} estrelas ({score} de 10)',
  notRated: 'Não avaliado',
  saveFailedToast: 'Falha ao salvar a avaliação: {message}',
};

const recommendations = {
  cardAria: '{title} ({year}) — {percent}% de correspondência',
  cardAriaNoYear: '{title} — {percent}% de correspondência',
  posterAlt: 'Pôster de {title}',
  matchSuffix: '% de correspondência',
  becauseYouWatched: 'Porque você assistiu',
  failed: 'Falha ao carregar as recomendações',
  heading: 'Para você',
  headingEllipsis: 'Para você…',
  headingCount: '{count} Recomendação | {count} Recomendações',
  loadingAria: 'Carregando recomendações',
  loading: 'Carregando recomendações…',
  empty: 'Ainda não há recomendações. Continue assistindo para receber sugestões personalizadas!',
  gridAria: '{count} recomendação | {count} recomendações',
};

const music = {
  artistsTitle: 'Artistas',
  albumsTitle: 'Álbuns',
  tracksTitle: 'Faixas',
  musicTitle: 'Música',
  loadingAria: 'Carregando música',
  loading: 'Carregando música…',
  noMusicFound: 'Nenhuma música encontrada.',
  artistsAria: '{count} artista | {count} artistas',
  albumsAria: '{count} álbum | {count} álbuns',
  tracksAria: '{count} faixa | {count} faixas',
  loadMoreArtistsAria: 'Carregar mais artistas — exibindo {shown} de {total}',
  loadMoreAlbumsAria: 'Carregar mais álbuns — exibindo {shown} de {total}',
  albumCardAria: '{title} ({year}) — {count} faixa | {title} ({year}) — {count} faixas',
  albumCardAriaNoYear: '{title} — {count} faixa | {title} — {count} faixas',
  albumArtAria: 'Capa do álbum de {title}',
  albumMeta: '{year} · {count} faixa | {year} · {count} faixas',
  trackCountOne: '{count} faixa',
  trackCountOther: '{count} faixas',
  artistCardAria: '{name}, {count} álbum | {name}, {count} álbuns',
  artistPhotoAlt: 'Foto de {name}',
  albumCountOne: '{count} álbum',
  albumCountOther: '{count} álbuns',
  failedToLoadArtists: 'Falha ao carregar os artistas',
  failedToLoadMoreArtists: 'Falha ao carregar mais artistas',
  failedToLoadAlbums: 'Falha ao carregar os álbuns',
  failedToLoadMoreAlbums: 'Falha ao carregar mais álbuns',
  failedToLoadAlbum: 'Falha ao carregar o álbum',
  failedToLoadTrack: 'Falha ao carregar a faixa',
};

const quickConnect = {
  aria: 'Pareie com seu celular',
  eyebrow: 'Phlix para Samsung TV',
  title: 'Entre sem teclado',
  preparing: 'Preparando seu código…',
  instruction: 'Abra o Phlix no seu celular e digite este código',
  declined: 'O pareamento foi recusado.',
  expired: 'Esse código expirou.',
  unreachable: 'Não foi possível acessar o servidor.',
  expiryNote: 'Expira em alguns minutos — sem pressa.',
  tryAgain: 'Tentar novamente',
  hint: 'No seu celular, abra o Phlix → Entrar na TV → digite o código.',
};

const days = {
  mon: 'Seg',
  tue: 'Ter',
  wed: 'Qua',
  thu: 'Qui',
  fri: 'Sex',
  sat: 'Sáb',
  sun: 'Dom',
};

const parentalControls = {
  noProfileSelected: 'Nenhum perfil selecionado',
  failedSchedules: 'Falha ao carregar as programações',
  failedTags: 'Falha ao carregar as tags',
  failedStreamLimits: 'Falha ao carregar o limite de transmissão',
  timeAm: 'AM',
  timePm: 'PM',
  noDaysSet: 'Nenhum dia definido',
  everyDay: 'Todos os dias',
  title: 'Controle dos pais',
  sectionsAria: 'Seções de configurações',
  tabSchedules: 'Programações',
  tabBlockedTags: 'Tags bloqueadas',
  tabStreamLimits: 'Limites de transmissão',
  accessSchedules: 'Programações de acesso',
  addSchedule: '+ Adicionar programação',
  loadingSchedules: 'Carregando programações…',
  noSchedules: 'Nenhuma programação de acesso configurada.',
  editScheduleTitle: 'Editar programação',
  newScheduleTitle: 'Nova programação',
  namePlaceholder: 'Ex., horário da tarefa',
  startTime: 'Hora de início',
  endTime: 'Hora de fim',
  daysOfWeek: 'Dias da semana',
  blockedTagsHint: 'As tags impedem que o conteúdo apareça na busca ou nas recomendações.',
  loadingTags: 'Carregando tags…',
  tagPlaceholder: 'Digite uma tag para bloquear…',
  removeTagAria: 'Remover tag',
  noBlockedTags: 'Nenhuma tag bloqueada configurada.',
  loadingLimits: 'Carregando limites…',
  maxConcurrentStreams: 'Máximo de transmissões simultâneas',
  maxBandwidthLabel: 'Largura de banda máxima (kbps, 0 = sem limite)',
  maxTotalBandwidth: 'Largura de banda total máxima',
  bandwidthKbps: '{kbps} kbps',
  editLimits: 'Editar limites',
};

/**
 * Complete Brazilian-Portuguese override for the Tizen-own catalog — see
 * `es.ts` for why `satisfies TizenCatalog` is the full-translation key-set law.
 */
export const PT_BR_TIZEN_MESSAGES = {
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
