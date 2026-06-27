/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PHLIX_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
