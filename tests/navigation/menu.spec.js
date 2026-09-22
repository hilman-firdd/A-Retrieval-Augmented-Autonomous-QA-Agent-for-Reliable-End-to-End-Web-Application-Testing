// @ts-check
const { test, expect } = require('../../src/fixtures');
const { BasePage } = require('../../src/pages/BasePage');
const { MENU } = require('../../src/data/site-map');

test.describe('Navigasi menu utama', () => {
  test('S-NAV-01 setiap item menu ada dengan tujuan (href) yang sesuai spesifikasi', { tag: '@regression' }, async ({ page }) => {
    const base = new BasePage(page);
    await base.goto('/');
    const missing = [];
    for (const group of MENU) {
      for (const [name, path] of group.items) {
        if ((await base.menuLink(name, path).count()) === 0) missing.push(`${group.parent} > ${name} (${path})`);
      }
    }
    expect(missing, 'Item menu yang hilang, berganti nama, atau berpindah tujuan').toEqual([]);
  });

  // Satu item representatif per menu induk, termasuk item di dalam sub-dropdown.
  const SAMPLES = [
    ['IFTITAH', 'NIZHAM', '/portal/halaman/nizham'],
    ['IFTITAH', 'TSANAWIYYAH', '/portal/halaman/tsanawiyyah'],
    ['IFTITAH', 'WEB DESIGN', '/portal/halaman/kbm-web-design'],
    ['MANHAJ', 'BAHASA ARAB', '/portal/halaman/bahasa-arab'],
    ['NASYATH', 'BERITA TERBARU', '/portal/berita'],
    ['PESANTREN UMUM', 'BROSUR PESANTREN UMUM', '/portal/halaman/brosur-pesantren-umum'],
    ['INFO PSB', 'KETENTUAN SELEKSI SANTRI', '/portal/halaman/ketentuan-seleksi'],
    ['SIMASIS', 'LOGIN', '/login'],
  ];
  for (const [parent, child, path] of SAMPLES) {
    test(`S-NAV-02 [${parent} > ${child}] navigasi lewat dropdown`, { tag: '@regression' }, async ({ page }) => {
      const base = new BasePage(page);
      await base.goto('/');
      await base.navigateViaMenu(parent, child, path);
      await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, '\\?')}$`));
      await expect(page.getByRole('heading').first()).toBeVisible();
    });
  }
});
