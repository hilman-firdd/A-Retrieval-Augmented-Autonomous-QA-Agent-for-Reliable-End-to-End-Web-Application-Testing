// @ts-check
const { test, expect } = require('../../src/fixtures');
const { default: AxeBuilder } = require('@axe-core/playwright');
const { BasePage } = require('../../src/pages/BasePage');

const PAGES = [
  ['beranda', '/'],
  ['daftar berita', '/portal/berita'],
  ['artikel santri', '/portal/artikel'],
  ['halaman statis', '/portal/halaman/manhaj'],
  ['login', '/login'],
];

test.describe('Aksesibilitas (axe-core, WCAG 2.x A/AA)', () => {
  for (const [name, path] of PAGES) {
    test(`S-QUAL-01 [${name}] tidak ada pelanggaran aksesibilitas berdampak "critical"`, { tag: '@a11y' }, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('iframe')
        .analyze();
      const summary = results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
      await test.info().attach('axe-violations.json', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
      const critical = summary.filter((v) => v.impact === 'critical');
      expect(critical, 'pelanggaran critical (lihat lampiran untuk semua tingkat)').toEqual([]);
    });
  }
});

test.describe('SEO dasar', () => {
  for (const [name, path] of PAGES) {
    test(`S-QUAL-02 [${name}] URL canonical sama dengan URL halaman`, { tag: '@seo' }, async ({ page }) => {
      await page.goto(path);
      const canonical = await new BasePage(page).canonical();
      expect(canonical, 'tag <link rel="canonical"> harus ada').toBeTruthy();
      const strip = (/** @type {string} */ u) => { const x = new URL(u); return `${x.origin}${x.pathname.replace(/\/$/, '')}`; };
      expect(strip(canonical || ''), 'canonical menunjuk ke halaman lain').toBe(strip(page.url()));
    });
  }
});

test.describe('Responsif (mobile)', () => {
  for (const [name, path] of PAGES) {
    test(`S-QUAL-03 [${name}] tidak ada scroll horizontal di layar ponsel`, { tag: '@mobile' }, async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Hanya relevan di project mobile.');
      await page.goto(path);
      expect(await new BasePage(page).hasNoHorizontalOverflow(), 'lebar konten melebihi lebar layar').toBe(true);
    });
  }
});
