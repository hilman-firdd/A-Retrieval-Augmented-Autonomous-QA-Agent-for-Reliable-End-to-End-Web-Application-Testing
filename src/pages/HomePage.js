// @ts-check
const { BasePage } = require('./BasePage');

class HomePage extends BasePage {
  async open() {
    return this.goto('/');
  }

  ctaDaftarPsb() {
    return this.page.getByRole('link', { name: 'Daftar PSB', exact: true });
  }

  ctaInfoTerbaru() {
    return this.page.getByRole('link', { name: 'Info Terbaru', exact: true });
  }

  /** Tautan statistik, mis. "364 Alumni tersebar di nusantara". @param {RegExp} name */
  statLink(name) {
    return this.page.getByRole('link', { name });
  }

  /** Tombol "Selengkapnya" pada kartu program unggulan (bisa berupa button atau link). */
  programButtons() {
    return this.page.getByRole('button', { name: 'Selengkapnya' }).or(this.page.getByRole('link', { name: 'Selengkapnya' }));
  }

  /** Dialog/modal yang sedang terbuka dan memuat judul program. @param {string} program */
  programDialog(program) {
    return this.page.getByRole('dialog').filter({ has: this.page.getByRole('heading', { name: program }) });
  }

  /** Judul berita di bagian "Berita Terbaru" beranda (heading level 3 berisi tautan). */
  latestNewsLinks() {
    return this.page.getByRole('heading', { level: 3 }).getByRole('link');
  }

  /** Pertanyaan FAQ (accordion). @param {string} question */
  faqQuestion(question) {
    return this.page.getByRole('button', { name: question }).or(this.page.getByRole('heading', { name: question }));
  }
}

module.exports = { HomePage };
