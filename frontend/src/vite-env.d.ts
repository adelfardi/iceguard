/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" builds the public read-only demo (banner + client-side write guard). */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
