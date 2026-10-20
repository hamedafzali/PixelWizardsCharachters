// Browser smoke tests (`npm run test:e2e`). jsdom runs no CSS animation and
// lays nothing out, so these are the checks the node suite cannot make: the
// rig mounts, its styles land and a gesture actually animates, in real engines.
import { defineConfig, devices } from '@playwright/test'

const port = 4181

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${port}` },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    env: { PORT: String(port), NO_OPEN: '1' },
    url: `http://localhost:${port}/e2e/fixture.html`,
    reuseExistingServer: !process.env.CI,
  },
})
