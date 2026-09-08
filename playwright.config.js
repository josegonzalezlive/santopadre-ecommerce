// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list']] : [['html', { open: 'never' }]],
  expect: {
    // El sitio no cambia tras el load (sin animaciones infinitas relevantes al layout),
    // así que una diferencia de píxeles pequeña ya es señal real de regresión visual.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /visual\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      // Chromium con viewport/UA de iPhone 13, no WebKit real: solo nos importa
      // verificar el CSS responsive, y así basta con el navegador que ya instalamos.
      name: 'mobile',
      testMatch: /visual\.mobile\.spec\.js/,
      use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 4173',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
