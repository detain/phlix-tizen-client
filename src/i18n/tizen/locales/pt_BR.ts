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
 *   AM/PM, kbps, tag.
 * - "Picture-in-picture" → "imagem na imagem" (Apple pt-BR convention).
 * - "legenda" is the pt-BR word for subtitles (not "subtítulo" calques);
 *   audio keeps "faixa de áudio".
 * - Plurals: same additive-pipeline doctrine as es/fr/it — CLDR two-segment
 *   pipes where English hardcoded a plural and the call site passes `count`.
 * - Values legitimately identical to English (allow-listed in
 *   tests/unit/i18nLocales.test.ts): tracks.durationAria, chapters.itemAria,
 *   audioTracks.bitrateKbps, audioTracks.mono,
 *   parentalControls.bandwidthKbps, parentalControls.timeAm,
 *   parentalControls.timePm,
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
  retry: 'Tentar novamente',
  goBack: 'Voltar',
  loading: 'Carregando…',
  loadMore: 'Carregar mais',
  noMediaId: 'Nada para exibir — abra isso a partir de um título.',
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
  tvSettings: 'Configurações da TV',
  parentalControls: 'Controle dos pais',
  admin: 'Administração',
};

const boot = {
  failedStart: 'Falha ao iniciar o Phlix: {message}',
  retryHint: 'Feche o Phlix e abra o app novamente.',
  recentFailures: 'Falhas recentes:',
  splashHint: 'Inicializando',
};

const hub = {
  pausedNotice: 'Conexão com o hub pausada — retoma quando você abrir o app novamente.',
};

const chapters = {
  loadFailed: 'Falha ao carregar os capítulos',
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
};

const screensaver = {
  wakeHint: 'Pressione qualquer tecla para ativar',
};

const tvSettings = {
  title: 'Configurações da TV',
  idleLabel: 'Protetor de tela',
  idleHint: 'Tempo ocioso antes do protetor de tela. Pressione esquerda ou direita para alterar.',
  minutes: '{minutes} minutos',
  telemetryLabel: 'Estatísticas de uso anônimas',
  telemetryOn: 'Ativadas',
  telemetryOff: 'Desativadas',
  telemetryHint: 'Pressione OK para ativar ou desativar as estatísticas de uso anônimas. Um único sinal periódico (ID do dispositivo, versão do app), sem títulos nem conta.',
};

const telemetry = {
  aria: 'Ajude a melhorar o Phlix',
  title: 'Compartilhar estatísticas de uso anônimas?',
  body: 'Um único sinal periódico (ID do dispositivo, versão do app) — sem títulos, sem conta. Nada é enviado até você escolher; você pode mudar depois em Configurações da TV.',
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
  bitrateKbps: '{value} kbps',
  loadingTitle: 'Faixas de áudio…',
  headingOne: '{count} Faixa de áudio',
  headingOther: '{count} Faixas de áudio',
  preferredNote: 'Preferida para este título: {language}',
  rememberedNote: '{language} foi definido como seu idioma de áudio preferido para este título.',
  saveFailedNote: 'Não foi possível salvar {language} na sua conta — este dispositivo ainda lembra sua escolha.',
  applyRefusal: 'Este player ainda não pode trocar de faixa de áudio — sua escolha será lembrada para a próxima.',
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
  empty: 'Ainda não há recomendações. Continue assistindo para receber sugestões personalizadas.',
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
  // RT-097 chooser (the takeover opens on this decision, not on a ceremony).
  chooseTitle: 'Entre nesta TV',
  chooseLead: 'Como você quer entrar?',
  choosePassword: 'Entrar com senha',
  chooseCode: 'Entrar com um código de pareamento',
  preparing: 'Preparando seu código…',
  instruction: 'Digite este código em outro dispositivo Phlix com sessão ativa para parear a TV.',
  declined: 'O pareamento foi recusado.',
  expired: 'Esse código expirou.',
  unreachable: 'Não foi possível acessar o servidor.',
  unsupported: 'Este servidor ainda não permite entrar com código — precisa ser atualizado. Use sua senha em vez disso.',
  expiryNote: 'Expira em alguns minutos — sem pressa.',
  tryAgain: 'Tentar novamente',
  usePassword: 'Digitar a senha em vez disso',
  hint: 'Nenhum aplicativo companheiro pode aprovar um código ainda — se ele expirar, use sua senha.',
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
  tagMutationFailed: 'Não foi possível salvar a alteração de tags — tente novamente.',
  scheduleDeleteFailed: 'Não foi possível excluir essa programação — tente novamente.',
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
  // m3 schedule-window stepper symbols (deferred review, 2026-11-03): locale-neutral
  // minute offsets, byte-identical to the English table (EN_LEAK_OK cohort).
  stepMinusHour: '-60',
  stepMinusQuarter: '-15',
  stepPlusQuarter: '+15',
  stepPlusHour: '+60',
  stepDownAria: 'Diminuir',
  stepUpAria: 'Aumentar',
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
