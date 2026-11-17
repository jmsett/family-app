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
    command: 'npm run preview:pages',
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
