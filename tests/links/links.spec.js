// @ts-check
const { test, expect } = require('../../src/fixtures');
const { OWN_DOMAIN } = require('../../src/data/site-map');

const KEY_PAGES = ['/', '/portal/berita', '/portal/artikel', '/login'];
const SKIP_HREF = /^(#|mailto:|tel:|javascript:|whatsapp:)/i;

/** Kumpulkan semua href absolut dari halaman kunci (+ satu artikel). */
async function collectHrefs(page) {
  const all = new Set();
  const pages = [...KEY_PAGES];
  await page.goto('/portal/berita');
  const first = await page.getByRole('heading', { level: 3 }).getByRole('link').first().getAttribute('href');
  if (first) pages.push(new URL(first, page.url()).pathname);
  for (const p of pages) {
    await page.goto(p, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.locator('a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href') || ''));
    for (const h of hrefs) if (h && !SKIP_HREF.test(h)) all.add(new URL(h, page.url()).href.split('#')[0]);
  }
  return [...all];
}

test.describe('Integritas tautan dan aset', () => {
  test.describe.configure({ timeout: 180_000 });

  test('S-LINK-01 semua tautan internal pada halaman kunci tidak rusak (status < 400)', { tag: '@regression' }, async ({ page, request, baseURL }) => {
    const host = new URL(baseURL || '').hostname;
    const internal = (await collectHrefs(page)).filter((u) => new URL(u).hostname === host && !/\/logout/.test(u));
    const broken = [];
    for (const url of internal) {
      const res = await request.get(url, { maxRedirects: 5, timeout: 30_000 }).catch((e) => ({ status: () => `ERR ${e.message}` }));
      const status = res.status();
      if (typeof status !== 'number' || status >= 400) broken.push({ url, status });
    }
    await test.info().attach('checked-links.json', { body: JSON.stringify({ checked: internal.length, broken }, null, 2), contentType: 'application/json' });
    expect(broken, `tautan rusak dari ${internal.length} tautan internal`).toEqual([]);
  });

  test('S-LINK-02 tautan ke domain milik pesantren memakai HTTPS', { tag: '@regression' }, async ({ page }) => {
    const insecure = (await collectHrefs(page)).filter((u) => {
      const url = new URL(u);
      return OWN_DOMAIN.test(url.hostname) && url.protocol === 'http:';
    });
    expect([...new Set(insecure)], 'tautan http:// ke domain sendiri (risiko mixed content / tanpa enkripsi)').toEqual([]);
  });

  test('S-LINK-03 semua gambar pada halaman kunci dapat dimuat', { tag: '@regression' }, async ({ page, request }) => {
    const srcs = new Set();
    for (const p of ['/', '/portal/berita', '/portal/artikel']) {
      await page.goto(p, { waitUntil: 'domcontentloaded' });
      const list = await page.locator('img').evaluateAll((els) =>
        els.map((e) => /** @type {HTMLImageElement} */ (e).currentSrc || e.getAttribute('src') || e.getAttribute('data-src') || ''),
      );
      for (const s of list) if (s && !s.startsWith('data:')) srcs.add(new URL(s, page.url()).href);
    }
    const broken = [];
    for (const src of srcs) {
      const res = await request.get(src, { timeout: 30_000 }).catch(() => null);
      const type = res?.headers()['content-type'] || '';
      if (!res || res.status() >= 400 || !/^image\//.test(type)) broken.push({ src, status: res?.status() ?? 'ERR', type });
    }
    expect(broken, `gambar rusak dari ${srcs.size} gambar`).toEqual([]);
  });
});
