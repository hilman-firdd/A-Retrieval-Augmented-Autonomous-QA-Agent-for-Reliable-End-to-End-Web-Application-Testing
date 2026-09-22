// @ts-check
// Skor kandidat locator dan c_loc = margin antara dua kandidat terbaik (Bagian 3 naskah, sebelum Persamaan 3):
//   "same locator survived earlier versions according to retrieved traces, phi_str penalises dependence on
//   position, and phi_vol penalises text that changes often, such as dates, prices, or view counters.
//   The weights are fixed in advance ... RAQA stores the three best candidates."
// Bobot TIDAK disebutkan angkanya di naskah ([report values]) -- nilai di bawah adalah pilihan desain,
// tetap/tidak dipelajari selama run, dan dilaporkan apa adanya di RAQA.md.
const fs = require('fs');
const path = require('path');
const { CONFIG } = require('./config');
const { namePattern, stripPUA } = require('./page');

const WEIGHTS = Object.freeze({ hist: 0.5, str: 0.3, vol: 0.2 });

// Teks yang "berubah-ubah" (Bagian 3 & 1: penghitung "kali dibaca" yang jadi contoh phi_vol di naskah).
const VOLATILE_PATTERNS = [
  /\bkali dibaca\b/i,
  /\bviews?\b/i,
  /\b\d{1,3}([.,]\d{3})+\b/, // angka berformat ribuan (harga, penghitung besar)
  /\b\d{1,2}\s+(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)\w*\s+\d{4}\b/i, // tanggal
  /\brp\s?\d/i,
];

/** @param {string} name */
function phiVol(name) {
  return VOLATILE_PATTERNS.some((re) => re.test(name)) ? 1 : 0;
}

/**
 * Ketergantungan posisi: kandidat yang HANYA bisa dibedakan lewat urutan DOM (perlu >1 kecocokan
 * lalu dipilih index tertentu) dihukum sebanding jumlah elemen yang bersaing.
 * @param {number} matchCount
 */
function phiStr(matchCount) {
  if (matchCount <= 1) return 0;
  return Math.min(1, (matchCount - 1) / 4);
}

/** Penyimpanan sederhana berbasis berkas JSON: locator (role|name) yang pernah dieksekusi berhasil. */
class LocatorMemory {
  /** @param {string} [file] */
  constructor(file = path.join(CONFIG.paths.e2eRoot, 'raqa', '.memory', 'locator-history.json')) {
    this.file = file;
    /** @type {Record<string, number>} */
    this.survived = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  }

  /** @param {string} role @param {string} name */
  key(role, name) {
    return `${role}|${stripPUA(name)}`;
  }

  /** @param {string} role @param {string} name */
  score(role, name) {
    return this.survived[this.key(role, name)] ? 1 : 0;
  }

  /** @param {string} role @param {string} name */
  record(role, name) {
    const k = this.key(role, name);
    this.survived[k] = (this.survived[k] || 0) + 1;
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.survived, null, 2));
  }
}

/**
 * Kandidat locator untuk satu (role, name) yang diusulkan LLM: nama persis, dan varian longgar
 * (memuat substring nama) untuk elemen yang mirip tapi tidak identik (mis. teks tambahan di sekitar).
 * @param {import('playwright').Page} page @param {string} role @param {string} name
 */
async function buildCandidates(page, role, name) {
  const clean = stripPUA(name);
  if (!clean) return [];
  const exact = page.getByRole(/** @type {any} */ (role), { name: namePattern(clean) });
  const loose = page.getByRole(/** @type {any} */ (role), { name: clean });
  const exactCount = await exact.count();
  const looseCount = await loose.count();
  /** @type {{ role: string, name: string, locator: import('playwright').Locator, matchCount: number, kind: string }[]} */
  const candidates = [];
  if (exactCount > 0) candidates.push({ role, name: clean, locator: exact, matchCount: exactCount, kind: 'exact' });
  if (looseCount > 0 && looseCount !== exactCount) candidates.push({ role, name: clean, locator: loose, matchCount: looseCount, kind: 'loose' });
  return candidates;
}

/**
 * @param {import('playwright').Page} page @param {string} role @param {string} name @param {LocatorMemory} memory
 * @returns {Promise<{ ranked: Array<{ kind: string, matchCount: number, locator: import('playwright').Locator, score: number }>, c_loc: number }>}
 */
async function scoreLocator(page, role, name, memory) {
  const candidates = await buildCandidates(page, role, name);
  if (candidates.length === 0) return { ranked: [], c_loc: 0 };
  const ranked = candidates
    .map((c) => ({
      kind: c.kind,
      matchCount: c.matchCount,
      locator: c.matchCount > 1 ? c.locator.first() : c.locator,
      score: WEIGHTS.hist * memory.score(role, c.name) - WEIGHTS.str * phiStr(c.matchCount) - WEIGHTS.vol * phiVol(c.name),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const cLoc = ranked.length === 1
    ? Math.max(0, Math.min(1, ranked[0].score + 1)) // satu kandidat: pakai skor absolut, digeser ke [0,1]
    : Math.max(0, Math.min(1, ranked[0].score - ranked[1].score));
  return { ranked, c_loc: cLoc };
}

module.exports = { LocatorMemory, buildCandidates, scoreLocator, phiStr, phiVol, WEIGHTS };
