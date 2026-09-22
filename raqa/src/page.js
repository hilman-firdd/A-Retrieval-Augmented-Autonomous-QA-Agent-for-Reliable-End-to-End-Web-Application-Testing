// @ts-check
// Representasi halaman untuk agen: ARIA snapshot (role, accessible name, state) tanpa elemen tak terlihat,
// dengan karakter Unicode Private Use Area (glyph ikon font) dibuang sebelum nama dibandingkan.

const PUA = /[-]|[\u{F0000}-\u{FFFFD}]|[\u{100000}-\u{10FFFD}]/gu;
const PUA_CLASS = '\\uE000-\\uF8FF';

/** @param {string} s */
function stripPUA(s) {
  return s.replace(PUA, '').replace(/\s+/g, ' ').trim();
}

/** @param {string} s */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pola nama yang cocok penuh setelah mengabaikan spasi dan glyph PUA di sekitar teks
 * (akar masalah RC2: " IFTITAH " dengan ikon U+F05A/U+F078 gagal dicocokkan exact:true).
 * Dipakai identik saat eksekusi agen dan di skrip hasil kompilasi, agar perilakunya sama.
 * @param {string} name
 */
function namePatternSource(name) {
  return `^[\\s${PUA_CLASS}]*${escapeRegExp(stripPUA(name))}[\\s${PUA_CLASS}]*$`;
}

/** @param {string} name */
function namePattern(name) {
  return new RegExp(namePatternSource(name));
}

/** @param {import('playwright').Page} page */
async function observe(page) {
  const snapshot = (await page.locator('body').ariaSnapshot()).replace(PUA, '');
  const title = await page.title();
  const h1 = await page.getByRole('heading', { level: 1 }).first().textContent({ timeout: 2000 }).catch(() => null);
  return {
    url: page.url(),
    title,
    // Deskripsi singkat halaman, bagian dari query q_t (Bagian 3 naskah).
    summary: `${title} | ${page.url()}${h1 ? ` | h1: ${stripPUA(h1)}` : ''}`,
    snapshot,
  };
}

/**
 * Locator berbasis role + accessible name, toleran terhadap glyph PUA.
 * @param {import('playwright').Page} page
 * @param {{ role: Parameters<import('playwright').Page['getByRole']>[0], name: string }} target
 */
function locate(page, target) {
  return page.getByRole(target.role, { name: namePattern(target.name) });
}

module.exports = { stripPUA, namePattern, namePatternSource, observe, locate };
