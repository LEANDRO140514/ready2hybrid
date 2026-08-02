import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

function forbidFixtureInProductionBuild(
  command: 'build' | 'serve' | 'test',
  mode: string,
): void {
  if (command !== 'build' || mode !== 'production') return
  const env = loadEnv(mode, rootDir, '')
  const authMode = process.env.VITE_AUTH_MODE ?? env.VITE_AUTH_MODE
  if (authMode === 'fixture') {
    throw new Error(
      'R2H-T2-1D: VITE_AUTH_MODE=fixture is forbidden in production builds. ' +
        'Use vite --mode e2e with main.e2e.tsx for Playwright harnesses.',
    )
  }
}

export default defineConfig(({ command, mode }) => {
  forbidFixtureInProductionBuild(command, mode)

  const isE2eHarness = mode === 'e2e'

  return {
    plugins: [
      react(),
      {
        name: 'r2h-e2e-entry',
        transformIndexHtml(html) {
          if (!isE2eHarness) return html
          return html.replace('/src/main.tsx', '/src/main.e2e.tsx')
        },
      },
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'offline.html',
          'icons/icon-192.png',
          'icons/icon-512.png',
        ],
        manifest: {
          name: 'Ready2Hybrid',
          short_name: 'R2H',
          description: 'Shell operativo Ready2Hybrid',
          lang: 'es',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          background_color: '#0f172a',
          theme_color: '#0f172a',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /\/functions\//],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'tests/e2e/**'],
      setupFiles: ['./src/test/setup.ts'],
      alias: {
        'virtual:pwa-register/react': path.join(
          rootDir,
          'src/test/pwa-register-stub.ts',
        ),
      },
    },
  }
})
