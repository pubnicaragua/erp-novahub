import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_FRONTEND_PORT || 5173);
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
const manualServer = process.env.E2E_MANUAL_SERVER === '1';
const dualFullStack = process.env.E2E_DUAL_FULLSTACK === '1';
const backendPort = Number(process.env.E2E_BACKEND_PORT || 3310);
const dualApiUrl = process.env.E2E_API_URL || `http://localhost:${backendPort}/api`;
const dualProjects = dualFullStack ? [
  {
    name: 'dual-desktop',
    testMatch: /specs[\\/].*\.spec\.ts$/,
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
  },
  {
    name: 'dual-mobile-iphone',
    testMatch: /specs[\\/].*\.spec\.ts$/,
    use: { ...devices['iPhone 12'] },
  },
  {
    name: 'dual-mobile-pixel5',
    testMatch: /specs[\\/].*\.spec\.ts$/,
    use: { ...devices['Pixel 5'] },
  },
  {
    name: 'dual-tablet',
    testMatch: /specs[\\/].*module-smoke\.spec\.ts$/,
    use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
  },
  {
    name: 'dual-compact',
    testMatch: /specs[\\/].*module-smoke\.spec\.ts$/,
    use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 800 } },
  },
  {
    name: 'dual-wide',
    testMatch: /specs[\\/].*module-smoke\.spec\.ts$/,
    use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  },
] : [];

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: dualFullStack ? false : true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: dualFullStack ? 1 : (process.env.CI ? 2 : undefined),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts$/,
    },
    {
      name: 'onboarding',
      testMatch: /onboarding\.spec\.ts$/,
      dependencies: ['setup'],
    },
    {
      name: 'vistas',
      testMatch: /vistas[\\/].*\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
    },
    ...dualProjects,
  ],
  ...(dualFullStack ? {
    globalSetup: './e2e/global-setup.ts',
    webServer: [
      {
        command: 'node e2e/start-backend.mjs',
        url: `http://localhost:${backendPort}/api/health/ready`,
        reuseExistingServer: false,
        timeout: 180_000,
      },
      ...(manualServer ? [] : [{
        command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          ...process.env,
          VITE_API_URL: dualApiUrl,
          VITE_E2E_DISABLE_SENTRY: '1',
        },
      }]),
    ],
  } : (manualServer ? {} : {
    webServer: {
      command: 'npm run dev',
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  })),
});
