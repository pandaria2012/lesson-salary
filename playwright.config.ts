import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4177',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    channel: process.env.PW_CHANNEL ?? 'msedge',
    headless: true,
    locale: 'zh-CN'
  },
  webServer: {
    command: 'npm run preview -- --port 4177 --strictPort',
    url: 'http://localhost:4177',
    reuseExistingServer: true,
    timeout: 120_000
  }
})
