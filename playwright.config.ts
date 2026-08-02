import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'line',
  outputDir: 'test-results',
  timeout: 120_000,
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'harness',
      testMatch: /app\.smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4173',
      },
    },
    {
      name: 'pwa-prod',
      testMatch: /pwa-production\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4175',
      },
    },
    {
      name: 'pwa-update',
      testMatch: /pwa-update\.spec\.ts/,
      fullyParallel: false,
      dependencies: ['pwa-prod'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4176',
      },
    },
  ],
  webServer: [
    {
      command:
        'npm run dev -- --mode e2e --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        'npm run build && npm run preview -- --host 127.0.0.1 --port 4175 --strictPort',
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        VITE_SHELL_BUILD_ID: 'prod-e2e-a',
      },
    },
  ],
})
