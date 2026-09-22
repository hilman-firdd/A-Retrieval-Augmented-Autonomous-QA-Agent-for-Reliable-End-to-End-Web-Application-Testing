// @ts-check
const { test, expect } = require('../../src/fixtures');
const { HomePage } = require('../../src/pages/HomePage');
const { ArticlePage } = require('../../src/pages/ArticlePage');
const { PROGRAMS } = require('../../src/data/site-map');
const { norm } = require('../../src/utils/text');

test.describe('Beranda', () => {
  test.beforeEach(async ({ page }) => {
    await new HomePage(page).open();
  });

  test('S-HOME-01 tombol "Daftar PSB" menuju situs PSB melalui HTTPS', { tag: '@regression' }, async ({ page }) => {
    const href = await new HomePage(page).ctaDaftarPsb().getAttribute('href');
    expect(href).toMatch(/^https:\/\/psb\.pesantrenpersis27\.com\/?$/);
  });

  test('S-HOME-02 tombol "Info Terbaru" membuka daftar berita', { tag: '@regression' }, async ({ page }) => {
    await new HomePage(page).ctaInfoTerbaru().click();
    await expect(page).toHaveURL(/\/portal\/berita$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Berita Terbaru/i);
  });

  test('S-HOME-03 tautan statistik (alumni, santri) valid dan anchor tersedia', { tag: '@regression' }, async ({ page, request }) => {
    const home = new HomePage(page);
    const alumniHref = await home.statLink(/Alumni/i).first().getAttribute('href');
    const res = await request.get(new URL(alumniHref || '', page.url()).href);
    expect(res.status(), `status ${alumniHref}`).toBeLessThan(400);

    for (const anchor of ['tsanawiyyah', 'muallimin']) {
      const link = page.locator(`a[href$="#${anchor}"]`).first();
      await expect(link, `tautan statistik #${anchor}`).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/portal/halaman/santri#${anchor}$`));
      await expect(page.locator(`[id="${anchor}"]`), `elemen target #${anchor} harus ada di halaman santri`).toHaveCount(1);
      await page.goBack();
    }
  });

  test('S-HOME-04 modal program unggulan terbuka dengan judul yang benar dan dapat ditutup', { tag: '@regression' }, async ({ page }) => {
    const home = new HomePage(page);
    await expect(home.programButtons()).toHaveCount(PROGRAMS.length);
    for (let i = 0; i < PROGRAMS.length; i++) {
      const program = PROGRAMS[i];
      await home.programButtons().nth(i).click();
      const modalTitle = page.getByRole('heading', { name: program, level: 4 });
      await expect(modalTitle, `judul modal untuk kartu ke-${i + 1}`).toBeVisible();
      await page.getByRole('button', { name: 'Tutup' }).filter({ visible: true }).first().click();
      await expect(modalTitle).toBeHidden();
    }
  });

  test('S-HOME-05 berita terbaru di beranda membuka artikel dengan judul yang sama', { tag: ['@regression', '@mobile'] }, async ({ page }) => {
    const link = new HomePage(page).latestNewsLinks().first();
    const title = norm(await link.innerText());
    await link.click();
    await expect(page).toHaveURL(/\/portal\/[a-z0-9-]+$/);
    expect(norm(await new ArticlePage(page).title().innerText())).toBe(title);
  });

  test('S-HOME-06 pertanyaan FAQ menampilkan jawabannya', { tag: '@regression' }, async ({ page }) => {
    const home = new HomePage(page);
    await home.faqQuestion('Bagaimana syarat masuk PPI 27?').first().click();
    await expect(page.getByText(/Syarat masuk PPI 27 meliputi/i)).toBeVisible();
  });
});
