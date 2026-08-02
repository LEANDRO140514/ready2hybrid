/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_INSFORGE_URL?: string
  readonly VITE_INSFORGE_ANON_KEY?: string
  /** Non-sensitive build marker for PWA update tests (never an auth grant). */
  readonly VITE_SHELL_BUILD_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
