// @ts-check
const { expect } = require('@playwright/test');

/**
 * Page object dasar. Prioritas locator mengikuti praktik yang juga dipakai RAQA (Bagian 3.6):
 * data-testid > role + accessible name > label > teks > CSS. XPath tidak dipakai.
 * Selector berbasis struktur (nth-child, kelas CSS tata letak) sengaja dihindari.
 */
class BasePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
  }

  /** @param {string} path */
  async goto(path) {
    const res = await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    return res;
  }

  /** Tautan menu utama berdasarkan nama DAN href, sehingga tidak tertukar dengan induk menu
   *  yang bernama sama (mis. "IFTITAH") atau tautan footer.
   *  @param {string} name @param {string} path */
  menuLink(name, path) {
    // includeHidden: item dropdown tersembunyi sampai menu induk dibuka, tetapi tetap harus ada di DOM.
    return this.page
      .getByRole('link', { name, exact: true, includeHidden: true })
      .and(this.page.locator(`a[href$="${path}"]`))
      .first();
  }

  /** Induk dropdown (href="#"). @param {string} name */
  menuParent(name) {
    return this.page
      .getByRole('link', { name, exact: true })
      .and(this.page.locator('a[href="#"], a:not([href])'))
      .first();
  }

  /**
   * Navigasi seperti pengguna: buka dropdown induk (hover, lalu klik bila perlu), klik anak menu.
   * @param {string} parent @param {string} child @param {string} path
   */
  async navigateViaMenu(parent, child, path) {
    const childLink = this.menuLink(child, path);
    if (!(await childLink.isVisible())) await this.menuParent(parent).hover();
    if (!(await childLink.isVisible())) await this.menuParent(parent).click();
    // Submenu bertingkat (mis. LEMBAGA PENDIDIKAN, KBM EKSTRAKURIKULER) mungkin butuh hover tambahan;
    // bila masih tersembunyi, test akan gagal dengan pesan yang jelas di bawah.
    await expect(childLink, `Menu "${parent} > ${child}" harus dapat dibuka dan terlihat`).toBeVisible();
    await Promise.all([this.page.waitForURL((u) => u.href.endsWith(path)), childLink.click()]);
  }

  mainHeading() {
    return this.page.getByRole('heading', { level: 1 }).first();
  }

  async canonical() {
    const el = this.page.locator('link[rel="canonical"]').first();
    return (await el.count()) ? el.getAttribute('href') : null;
  }

  /** true bila halaman tidak memiliki scroll horizontal (cek responsif). */
  async hasNoHorizontalOverflow() {
    return this.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  }
}

module.exports = { BasePage };
