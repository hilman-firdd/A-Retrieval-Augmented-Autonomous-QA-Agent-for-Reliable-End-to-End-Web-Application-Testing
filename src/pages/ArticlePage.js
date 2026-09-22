// @ts-check
const { BasePage } = require('./BasePage');

class ArticlePage extends BasePage {
  title() {
    return this.mainHeading();
  }

  breadcrumbLink(name) {
    return this.page.getByRole('link', { name, exact: true });
  }

  /** Jumlah "N kali dibaca". Nilai ini VOLATIL (bertambah setiap kunjungan), jangan diuji nilai pastinya. */
  async viewCount() {
    const text = await this.page.getByText(/\d+\s+kali dibaca/).first().innerText();
    return Number(/(\d+)\s+kali dibaca/.exec(text)?.[1]);
  }

  shareLink(name) {
    return this.page.getByRole('link', { name, exact: true });
  }

  copyLinkControl() {
    return this.page.getByRole('button', { name: /salin link/i }).or(this.page.getByRole('link', { name: /salin link/i })).first();
  }

  /** Tautan kartu "Artikel Terkait" (heading level 3). */
  relatedLinks() {
    return this.page.getByRole('heading', { level: 3 }).getByRole('link');
  }
}

module.exports = { ArticlePage };
