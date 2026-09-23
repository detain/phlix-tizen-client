/**
 * Tizen-OWN Japanese (ja) catalog — full translation of `TIZEN_EN`.
 *
 * Language decisions (translation-judgment inventory, estate review):
 * - Polite desu/masu style with katakana UI loanwords (読み込み, スキップ,
 *   チャプター), matching Samsung/Netflix ja TV voice.
 * - JA HAS ZERO PIPE TEMPLATES IN THIS FILE — CLDR gives Japanese a single
 *   plural category ("other"), so every count string is one segment with a
 *   native counter word: 人 for people (artists), 枚 for flat media (albums),
 *   曲 for songs (tracks), 章 for chapters, 本 for long objects (audio/
 *   subtitle tracks), 件 for items (recommendations). The One/Other KEY pair
 *   is kept for registry key-set identity — both members carry the identical
 *   counter phrase (Japanese does not distinguish 1 vs n).
 * - The non-CJK allow-list for tests/unit/i18nLocales.test.ts is exactly:
 *   tracks.durationAria, chapters.itemAria (pure {placeholder} templates),
 *   audioTracks.bitrateKbps, parentalControls.bandwidthKbps (unit formats),
 *   pictureInPicture.enterLabel ('PiP'), subtitleTracks.sdhBadge ('SDH').
 *   Katakana UI words (スキップ, チャプター…) are NOT allow-listed — they are
 *   Japanese written in the CJK ranges, not Latin leftovers.
 * - Brands kept verbatim: Phlix, PiP, SDH, TV, ID, @phlix/ui and the API
 *   phrase '(state: none; actions: setSubtitle/setQuality only)' which is a
 *   developer-facing diagnostic quoted from code, translated only in prose.
 * - AM/PM render as 午前/午後; weekday initials are the single kanji 月火水木
 *   金土日 (standard Japanese TV listings).
 * - Full-width punctuation （）： inside ja copy; ASCII commas/dashes retained
 *   where they belong to {placeholder} templates shared with other locales.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */
import type { TizenCatalog } from './en';

const common = {
  retry: '再試行',
  goBack: '戻る',
  loading: '読み込み中…',
  loadMore: 'さらに読み込む',
  noMediaId: 'メディアIDが指定されていません',
  unknown: '不明',
  edit: '編集',
  delete: '削除',
  cancel: 'キャンセル',
  save: '保存',
  saving: '保存中…',
  add: '追加',
  adding: '追加中…',
  active: '有効',
  inactive: '無効',
  unlimited: '無制限',
  name: '名前',
};

const menu = {
  browse: 'ブラウズ',
  forYou: 'おすすめ',
  settings: '設定',
  parentalControls: 'ペアレンタルコントロール',
  admin: '管理',
};

const boot = {
  failedStart: 'Phlixを起動できませんでした: {message}',
  splashHint: '起動中',
};

const hub = {
  pausedNotice: 'ハブへの接続は一時停止中です — アプリを再度開くと再開されます',
};

const skip = {
  controlsAria: 'スキップ操作',
  introAria: 'イントロをスキップ',
  introLabel: 'イントロをスキップ',
  outroAria: 'アウトロをスキップ',
  outroLabel: 'アウトロをスキップ',
};

const chapters = {
  loadFailed: 'チャプターを読み込めませんでした',
  adBadge: '広告',
  fallbackTitle: 'チャプター {index}',
  listAria: 'チャプター一覧',
  countAria: '{count}章',
  itemAria: '{title}, {time}',
  title: 'チャプター',
  loadingTitle: 'チャプター…',
  loadingAria: 'チャプターを読み込み中',
  loading: 'チャプターを読み込み中…',
  empty: 'このメディアにはチャプターがありません。',
  countHeadingOne: '{count}章',
  countHeadingOther: '{count}章',
  markerIntro: 'イントロ',
  markerOutro: 'アウトロ',
  markerCredits: 'エンドロール',
};

const pictureInPicture = {
  enterAria: 'ピクチャーインピクチャーを開始',
  exitAria: 'ピクチャーインピクチャーを終了',
  enterLabel: 'PiP',
  exitLabel: 'PiPを終了',
};

const screensaver = {
  wakeHint: 'いずれかのキーを押すと復帰します',
};

const telemetry = {
  aria: 'Phlixの改善に協力',
  title: '匿名の利用統計を共有しますか？',
  body: '一定間隔のシグナル1つのみ（デバイスID、アプリバージョン）— タイトルやアカウント情報は含まれません。設定はいつでも変更できます。',
  enable: '有効にする',
  notNow: 'あとで',
};

const audioTracks = {
  listAria: '音声トラック一覧',
  countAria: '{count}本の音声トラック',
  mono: 'モノラル',
  stereo: 'ステレオ',
  title: '音声トラック',
  loadingAria: '音声トラックを読み込み中',
  loading: '音声トラックを読み込み中…',
  loadFailed: '音声トラックを読み込めませんでした',
  empty: 'このメディアに代替の音声トラックはありません。',
  bitrateKbps: '{value}kbps',
  loadingTitle: '音声トラック…',
  headingOne: '{count}本の音声トラック',
  headingOther: '{count}本の音声トラック',
  preferredNote: 'この作品の優先言語: {language}',
  rememberedNote: 'この作品の優先音声言語として{language}を記憶しました。',
  applyRefusal: '音声トラックの選択は適用できません: @phlix/ui のプレイヤー store に音声トラック切り替えのインターフェースがありません (state: none; actions: setSubtitle/setQuality only).',
};

const subtitleTracks = {
  listAria: '字幕トラック一覧',
  countAria: '{count}本の字幕トラック',
  noneAria: '字幕なし',
  off: 'オフ',
  sdhBadge: 'SDH',
  hearingImpaired: '聴覚障害者向け',
  title: '字幕トラック',
  loadingAria: '字幕トラックを読み込み中',
  loading: '字幕トラックを読み込み中…',
  loadFailed: '字幕トラックを読み込めませんでした',
  empty: 'このメディアに字幕トラックはありません。',
  loadingTitle: '字幕トラック…',
  headingOne: '{count}本の字幕トラック',
  headingOther: '{count}本の字幕トラック',
  languageNote: '字幕は言語でマッチングされます。同じ言語の行は同じ動作をします。',
};

const tracks = {
  durationAria: '{title} — {duration}',
  playAria: '{title}を再生',
};

const ratings = {
  badgeAria: '評価: {score} / 10',
  unrated: '未評価',
  modalTitle: 'この作品を評価',
  modalCloseAria: '評価モーダルを閉じる',
  communityRating: 'コミュニティ評価',
  yourRatingHeading: 'あなたの評価',
  pressEscPrefix: '閉じるには ',
  pressEscSuffix: ' キーを押します',
  pickerAria: 'このメディアを評価',
  yourRatingLabel: 'あなたの評価',
  currentRatingAria: '現在の評価: {rating} / 10',
  starAria: '星{stars}（{score} / 10）',
  starsAria: '星{stars}（{score} / 10）',
  notRated: '評価されていません',
  saveFailedToast: '評価を保存できませんでした: {message}',
};

const recommendations = {
  cardAria: '{title}（{year}年）— 一致度{percent}%',
  cardAriaNoYear: '{title} — 一致度{percent}%',
  posterAlt: '{title}のポスター',
  matchSuffix: '%一致',
  becauseYouWatched: '視聴履歴より',
  failed: 'おすすめを読み込めませんでした',
  heading: 'おすすめ',
  headingEllipsis: 'おすすめ…',
  headingCount: '{count}件のおすすめ',
  loadingAria: 'おすすめを読み込み中',
  loading: 'おすすめを読み込み中…',
  empty: 'まだおすすめはありません。視聴を続けると、あなたに合った提案が届きます！',
  gridAria: '{count}件のおすすめ',
};

const music = {
  artistsTitle: 'アーティスト',
  albumsTitle: 'アルバム',
  tracksTitle: 'トラック',
  musicTitle: '音楽',
  loadingAria: '音楽を読み込み中',
  loading: '音楽を読み込み中…',
  noMusicFound: '音楽が見つかりませんでした。',
  artistsAria: '{count}人のアーティスト',
  albumsAria: '{count}枚のアルバム',
  tracksAria: '{count}曲',
  loadMoreArtistsAria: 'アーティストをさらに読み込む — 全{total}件中{shown}を表示',
  loadMoreAlbumsAria: 'アルバムをさらに読み込む — 全{total}件中{shown}を表示',
  albumCardAria: '{title}（{year}年）— {count}曲',
  albumCardAriaNoYear: '{title} — {count}曲',
  albumArtAria: '{title}のアルバムジャケット',
  albumMeta: '{year}年 · {count}曲',
  trackCountOne: '{count}曲',
  trackCountOther: '{count}曲',
  artistCardAria: '{name}、{count}枚のアルバム',
  artistPhotoAlt: '{name}の写真',
  albumCountOne: '{count}枚のアルバム',
  albumCountOther: '{count}枚のアルバム',
  failedToLoadArtists: 'アーティストを読み込めませんでした',
  failedToLoadMoreArtists: '追加のアーティストを読み込めませんでした',
  failedToLoadAlbums: 'アルバムを読み込めませんでした',
  failedToLoadMoreAlbums: '追加のアルバムを読み込めませんでした',
  failedToLoadAlbum: 'アルバムを読み込めませんでした',
  failedToLoadTrack: 'トラックを読み込めませんでした',
};

const quickConnect = {
  aria: 'スマートフォンと連携',
  eyebrow: 'Samsung TV用 Phlix',
  title: 'キーボードなしでサインイン',
  preparing: 'コードを準備しています…',
  instruction: 'スマートフォンでPhlixを開いてこのコードを入力してください',
  declined: '連携が拒否されました。',
  expired: 'このコードは期限切れです。',
  unreachable: 'サーバーに接続できませんでした。',
  expiryNote: '数分で期限切れになります — 急がなくて大丈夫です。',
  tryAgain: 'もう一度お試しください',
  hint: 'スマートフォンでPhlixを開く → テレビにサインイン → コードを入力。',
};

const days = {
  mon: '月',
  tue: '火',
  wed: '水',
  thu: '木',
  fri: '金',
  sat: '土',
  sun: '日',
};

const parentalControls = {
  noProfileSelected: 'プロフィールが選択されていません',
  failedSchedules: 'スケジュールを読み込めませんでした',
  failedTags: 'タグを読み込めませんでした',
  failedStreamLimits: 'ストリーム制限を読み込めませんでした',
  timeAm: '午前',
  timePm: '午後',
  noDaysSet: '曜日未設定',
  everyDay: '毎日',
  title: 'ペアレンタルコントロール',
  sectionsAria: '設定セクション',
  tabSchedules: 'スケジュール',
  tabBlockedTags: 'ブロック済みタグ',
  tabStreamLimits: 'ストリーム制限',
  accessSchedules: 'アクセススケジュール',
  addSchedule: '+ スケジュールを追加',
  loadingSchedules: 'スケジュールを読み込み中…',
  noSchedules: 'アクセススケジュールが設定されていません。',
  editScheduleTitle: 'スケジュールを編集',
  newScheduleTitle: '新規スケジュール',
  namePlaceholder: '例：宿題の時間',
  startTime: '開始時間',
  endTime: '終了時間',
  daysOfWeek: '曜日',
  blockedTagsHint: 'タグを設定すると、そのコンテンツは検索結果やおすすめに表示されなくなります。',
  loadingTags: 'タグを読み込み中…',
  tagPlaceholder: 'ブロックするタグを入力…',
  removeTagAria: 'タグを削除',
  noBlockedTags: 'ブロック済みタグはありません。',
  loadingLimits: '制限を読み込み中…',
  maxConcurrentStreams: '同時ストリームの上限',
  maxBandwidthLabel: '最大帯域幅 (kbps、0 = 無制限)',
  maxTotalBandwidth: '合計帯域幅の上限',
  bandwidthKbps: '{kbps} kbps',
  editLimits: '制限を編集',
};

/**
 * Complete Japanese override for the Tizen-own catalog — see `es.ts` for why
 * `satisfies TizenCatalog` is the full-translation key-set law. This file
 * additionally carries the JA segment law: zero '|' anywhere (see header).
 */
export const JA_TIZEN_MESSAGES = {
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
