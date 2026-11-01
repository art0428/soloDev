import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 設定。網址由 run-e2e.sh 用環境變數給（拋棄式環境），不寫死。
 * AUTH_MODE 預設 mock：登入走 /auth/login?as=<mccSub>。真實 MCC 登入在 login-real.pw.ts，預設 skip。
 */
const WEB = process.env.E2E_WEB_URL || 'http://127.0.0.1:4120'

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.pw\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: WEB,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    ...devices['Desktop Chrome'],
  },
})
