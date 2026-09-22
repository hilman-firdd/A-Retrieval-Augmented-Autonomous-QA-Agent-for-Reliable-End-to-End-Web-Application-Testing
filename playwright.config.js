// @ts-check
require('dotenv').config();
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://staging.pesantrenpersis27.com';
const RUN_LABEL = process.env.RUN_LABEL || 'baseline';
const RUN_ID = process.env.RUN_ID || `single-${new Date().toISOString().replace(/[:.]/g, '-')}`;

const projects = [
  { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
  // Mobile hanya menjalankan skenario bertanda @mobile agar waktu eksekusi tetap wajar.
  { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
];
if (process.env.ALL_BROWSERS === '1') {
  projects.push(
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] }, grepInvert: /@chromium-only/ },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] }, grepInvert: /@chromium-only/ },
  );
}

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // PENTING untuk riset: retries = 0. Retry otomatis menyembunyikan flakiness,
  // sehingga flakiness rate (FR) menjadi bias ke bawah.
  retries: 0,
  workers: Number(process.env.WORKERS || 2),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join('results', 'runs', RUN_LABEL, `${RUN_ID}.json`) }],
    ['html', { outputFolder: path.join('results', 'html', RUN_LABEL), open: 'never' }],
  ],
  outputDir: path.join('results', 'artifacts', RUN_LABEL, RUN_ID),
  use: {
    baseURL: BASE_URL,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects,
});
