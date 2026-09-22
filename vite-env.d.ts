/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PHLIX_SERVER_URL?: string;
  /** Explicit hub origin override for the S298 hub-relay consumer
   *  (defaults to the server URL's origin — the self-hosted layout). */
  readonly VITE_PHLIX_HUB_URL?: string;
  /** Hub server UUID override for the S298 hub-relay consumer. */
  readonly VITE_PHLIX_HUB_SERVER_ID?: string;
  /** S517 T-10 — admin console build flag. Set to '1' to ship the admin
   *  section (routes + nav entry) in the .wgt; ANY other value (including
   *  unset) means admin is omitted. Default-off. */
  readonly VITE_PHLIX_TV_ADMIN?: string;
  /** Build-time locale override for the client i18n seam (src/i18n). Wins over
   *  navigator.language, loses to an explicit runtime value. Unset/'en' keeps
   *  the byte-identical English ui defaults (the catalog ships an empty 'en'
   *  override). */
  readonly VITE_PHLIX_LOCALE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
