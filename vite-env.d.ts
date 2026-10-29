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
  /** M-TIZEN-06 — INSECURE DEV-ONLY hub-relay transport hatch. Set to '1' to
   *  let the hub relay dial plaintext `ws://` when the hub base is not
   *  `https:`. Default-off: without it a bearer relay connection to a
   *  non-https hub is REFUSED at connect (the relay token would be readable
   *  on the LAN). For local relay testing against a dev hub ONLY — never
   *  ship a release .wgt built with this set. See README → Configuration. */
  readonly VITE_PHLIX_DEV_ALLOW_INSECURE_RELAY?: string;
  /** M-TIZEN-12 — INSECURE DEV-ONLY SyncPlay transport hatch (the direct
   *  `:8097` lane's sibling of `VITE_PHLIX_DEV_ALLOW_INSECURE_RELAY`). Set to
   *  '1' to let the SyncPlay socket dial plaintext `ws://` when the server
   *  base is not `https:`. Default-off: without it a bearer-carrying SyncPlay
   *  connection to a non-https server is REFUSED before the dial (the JWT and
   *  the replayable group password hash would be readable on the LAN). For
   *  local watch-party testing against a plain-http dev server ONLY — never
   *  ship a release .wgt built with this set. See README → Configuration. */
  readonly VITE_PHLIX_DEV_ALLOW_INSECURE_SYNCPLAY?: string;
  /** Build-time locale override for the client i18n seam (src/i18n). Wins over
   *  navigator.language, loses to an explicit runtime value. Unset/'en' keeps
   *  the byte-identical English ui defaults (the catalog ships an empty 'en'
   *  override). */
  readonly VITE_PHLIX_LOCALE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
