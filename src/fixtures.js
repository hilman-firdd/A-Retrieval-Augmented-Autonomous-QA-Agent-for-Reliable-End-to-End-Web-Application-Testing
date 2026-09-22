// @ts-check
/**
 * Fixture dasar semua test.
 *
 * `oracle` (auto) adalah implementasi "implicit oracle" dari naskah (Bagian 3.7):
 * setiap test otomatis gagal bila selama eksekusi terjadi
 *   - uncaught JavaScript exception (pageerror),
 *   - console.error dari halaman first-party,
 *   - respons HTTP 5xx dari domain first-party,
 *   - request first-party yang gagal di level jaringan.
 * Semua temuan dilampirkan sebagai `implicit-oracle.json` pada laporan.
 *
 * Test dapat menonaktifkan oracle ini (mis. test yang sengaja memicu error) dengan
 *   test.info().annotations.push({ type: 'skip-implicit-oracle' })
 */
const base = require('@playwright/test');
const { expect } = base;

/** Host yang dianggap first-party (milik aplikasi yang diuji). */
function isFirstParty(url, baseURL) {
  try {
    const host = new URL(url).hostname;
    const baseHost = new URL(baseURL || 'http://localhost').hostname;
    return host === baseHost || host.endsWith('pesantrenpersis27.com') || host.includes('simasis27');
  } catch {
    return false;
  }
}

/** Pesan console yang berasal dari pihak ketiga/embed dan bukan tanggung jawab aplikasi. */
const IGNORED_CONSOLE = [/youtube/i, /googlevideo/i, /doubleclick/i, /google-analytics/i, /googletagmanager/i, /ERR_BLOCKED_BY_CLIENT/i];

const test = base.test.extend({
  oracle: [
    async ({ page, baseURL }, use, testInfo) => {
      /** @type {Array<Record<string, any>>} */
      const issues = [];
      page.on('pageerror', (err) => issues.push({ type: 'pageerror', message: err.message }));
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        const src = msg.location()?.url || '';
        if (IGNORED_CONSOLE.some((r) => r.test(text) || r.test(src))) return;
        if (src && !isFirstParty(src, baseURL)) return;
        issues.push({ type: 'console-error', message: text, source: src });
      });
      page.on('response', (res) => {
        if (res.status() >= 500 && isFirstParty(res.url(), baseURL)) {
          issues.push({ type: 'http-5xx', status: res.status(), url: res.url() });
        }
      });
      page.on('requestfailed', (req) => {
        const err = req.failure()?.errorText || '';
        // ERR_ABORTED umumnya berasal dari navigasi yang membatalkan request lama, bukan cacat aplikasi.
        if (isFirstParty(req.url(), baseURL) && !/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(err)) {
          issues.push({ type: 'request-failed', url: req.url(), error: err });
        }
      });

      await use({ issues });

      await testInfo.attach('implicit-oracle.json', {
        body: JSON.stringify(issues, null, 2),
        contentType: 'application/json',
      });
      const skipped = testInfo.annotations.some((a) => a.type === 'skip-implicit-oracle');
      if (!skipped && testInfo.status === testInfo.expectedStatus) {
        expect(issues, 'Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)').toEqual([]);
      }
    },
    { auto: true },
  ],
});

module.exports = { test, expect, isFirstParty };
