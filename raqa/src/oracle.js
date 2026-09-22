// @ts-check
// Dua tier oracle (Bagian 3 naskah: "c^orc the agreement between the oracle tiers"), memakai definisi
// yang SAMA dengan implicit oracle B1 (src/fixtures.js) supaya temuan RC1 dkk berlaku identik di sini:
//   implicit: JS error, console.error first-party, HTTP 5xx first-party, request gagal first-party.
//   explicit: assertion yang diturunkan dari acceptance_criteria skenario (dieksekusi lewat expectVisible/expectURL).
// c_orc untuk langkah yang DIUSULKAN (belum dieksekusi) = 1 bila tier implicit BERSIH pada state
// halaman saat ini; 0 bila implicit sudah melaporkan masalah -- artinya tidak masuk akal menegaskan
// sesuatu (tier explicit) di atas halaman yang tier implicit-nya sudah menyalakan alarm.

const { CONFIG } = require('./config');

/** @param {string} url @param {string} baseURL */
function isFirstParty(url, baseURL) {
  try {
    const host = new URL(url).hostname;
    const baseHost = new URL(baseURL).hostname;
    return host === baseHost || (baseHost.includes('pesantrenpersis27.com') && host.endsWith('pesantrenpersis27.com'));
  } catch {
    return false;
  }
}

const IGNORED_CONSOLE = [/youtube/i, /googlevideo/i, /doubleclick/i, /google-analytics/i, /googletagmanager/i, /ERR_BLOCKED_BY_CLIENT/i];

class ImplicitOracle {
  /** @param {import('playwright').Page} page */
  constructor(page) {
    /** @type {Array<Record<string, any>>} */
    this.issues = [];
    page.on('pageerror', (err) => this.issues.push({ type: 'pageerror', message: err.message }));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      const src = msg.location()?.url || '';
      if (IGNORED_CONSOLE.some((re) => re.test(text) || re.test(src))) return;
      if (src && !isFirstParty(src, CONFIG.app.baseURL)) return;
      this.issues.push({ type: 'console-error', message: text, source: src });
    });
    page.on('response', (res) => {
      if (res.status() >= 500 && isFirstParty(res.url(), CONFIG.app.baseURL)) this.issues.push({ type: 'http-5xx', status: res.status(), url: res.url() });
    });
    page.on('requestfailed', (req) => {
      const err = req.failure()?.errorText || '';
      if (isFirstParty(req.url(), CONFIG.app.baseURL) && !/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(err)) {
        this.issues.push({ type: 'request-failed', url: req.url(), error: err });
      }
    });
  }

  clean() {
    return this.issues.length === 0;
  }

  /** Ambil isu sejak checkpoint terakhir tanpa mereset (dipakai untuk melaporkan, bukan menilai). */
  snapshot() {
    return [...this.issues];
  }
}

/**
 * c_orc untuk langkah yang diusulkan: 1 bila tier implicit bersih saat ini, 0 bila tidak.
 * @param {ImplicitOracle} implicitOracle
 */
function scoreOracle(implicitOracle) {
  return implicitOracle.clean() ? 1 : 0;
}

module.exports = { ImplicitOracle, scoreOracle, isFirstParty };
