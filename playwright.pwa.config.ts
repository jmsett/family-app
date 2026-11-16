import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'pwa.spec.ts',
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173/family-app/',
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
      : undefined,
  },
  webServer: {
    env: { VITE_BASE_PATH: '/family-app/' },
    command:
      'npm exec -- vite preview --config apps/web/vite.config.ts --host localhost --port 4173 --strictPort',
    url: 'http://localhost:4173/family-app/',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' },
    },
  ],
});
