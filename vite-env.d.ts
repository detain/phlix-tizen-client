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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
