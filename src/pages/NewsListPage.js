// @ts-check
const { BasePage } = require('./BasePage');
const { allIsoDates } = require('../utils/text');

/** Halaman daftar berita/artikel: /portal/berita, /portal/artikel, /portal/kategori/*, /portal/arsip/*. */
class NewsListPage extends BasePage {
  /** @param {string} path */
  async open(path = '/portal/berita') {
    return this.goto(path);
  }

  /** Tautan judul setiap kartu (heading level 3). Sidebar "Recent Posts" tidak memakai heading. */
  cardLinks() {
    return this.page.getByRole('heading', { level: 3 }).getByRole('link');
  }

  async cardTitles() {
    return (await this.cardLinks().allInnerTexts()).map((t) => t.trim());
  }

  /** Tautan paginasi bernomor (href berisi ?page=N). */
  pageNumberLinks() {
    return this.page.locator('a[href*="page="]').filter({ hasText: /^\s*\d+\s*$/ });
  }

  /** Nomor halaman terakhir berdasarkan tautan paginasi; 1 bila tidak ada paginasi. */
  async lastPageNumber() {
    const texts = await this.pageNumberLinks().allInnerTexts();
    const nums = texts.map((t) => Number(t.trim())).filter(Number.isFinite);
    return nums.length ? Math.max(1, ...nums) : 1;
  }

  /** Jumlah posting per kategori dari sidebar, mis. "Berita Umum 116". Mengembalikan {nama: jumlah}. */
  async categoryCounts() {
    const links = this.page.locator('a[href*="/portal/kategori/"]');
    const out = {};
    for (const text of await links.allInnerTexts()) {
      const m = /^(.*?)\s+(\d+)\s*$/.exec(text.replace(/\s+/g, ' ').trim());
      if (m) out[m[1]] = Number(m[2]);
    }
    return out;
  }

  /** Semua tanggal yang tampil pada kartu (format "17 Jul 2026"), dalam ISO. */
  async cardDatesIso() {
    const main = this.page.locator('main');
    const scope = (await main.count()) ? main.first() : this.page.locator('body');
    return allIsoDates(await scope.innerText());
  }
}

module.exports = { NewsListPage };
