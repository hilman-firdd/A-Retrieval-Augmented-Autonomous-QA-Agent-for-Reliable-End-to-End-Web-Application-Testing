// @ts-check
const { test, expect } = require('../../src/fixtures');
const { HomePage } = require('../../src/pages/HomePage');
const { STATIC_PAGES } = require('../../src/data/site-map');

const NOT_FOUND = /404|not found|halaman tidak ditemukan|server error|whoops|something went wrong/i;

test.describe('Smoke', () => {
  test('S-SMOKE-01 beranda termuat dengan judul dan heading utama', { tag: ['@smoke', '@mobile'] }, async ({ page }) => {
    const home = new HomePage(page);
    const res = await home.open();
    expect(res?.status(), 'status HTTP beranda').toBeLessThan(400);
    await expect(page).toHaveTitle(/Pesantren PERSIS 27/i);
    await expect(home.mainHeading()).toContainText(/Tafaqquh Fid Din/i);
  });
});

test.describe('S-PAGE-01 Halaman statis dapat diakses', () => {
  for (const { name, path } of STATIC_PAGES) {
    test(`S-PAGE-01 [${path}] ${name}`, { tag: '@regression' }, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(res?.status(), `status HTTP ${path}`).toBeLessThan(400);
      const title = await page.title();
      expect(title.trim(), 'document.title tidak boleh kosong').not.toBe('');
      expect(title, 'judul tidak boleh menandakan halaman error').not.toMatch(NOT_FOUND);
      await expect(page.getByRole('heading').first(), 'halaman harus memiliki heading yang terlihat').toBeVisible();
    });
  }
});
