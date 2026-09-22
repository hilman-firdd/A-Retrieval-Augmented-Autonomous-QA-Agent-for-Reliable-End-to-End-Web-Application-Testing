// @ts-check
const { test, expect } = require('../../src/fixtures');
const { NewsListPage } = require('../../src/pages/NewsListPage');
const { ArticlePage } = require('../../src/pages/ArticlePage');
const { norm, toIsoDate, allIsoDates } = require('../../src/utils/text');

const DATE_TEXT = /\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/;

test.describe('Daftar berita', () => {
  test('S-NEWS-01 daftar berita menampilkan kartu dan halaman 2 berbeda dari halaman 1', { tag: ['@smoke', '@mobile'] }, async ({ page }) => {
    const list = new NewsListPage(page);
    await list.open('/portal/berita');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Berita Terbaru/i);
    const page1 = await list.cardTitles();
    expect(page1.length, 'jumlah kartu di halaman 1').toBeGreaterThan(0);

    const last = await list.lastPageNumber();
    test.skip(last < 2, 'Tidak ada paginasi (jumlah berita <= satu halaman).');
    await list.open('/portal/berita?page=2');
    const page2 = await list.cardTitles();
    expect(page2.length).toBeGreaterThan(0);
    const overlap = page2.filter((t) => page1.includes(t));
    expect(overlap, 'berita tidak boleh muncul ganda di halaman 1 dan 2').toEqual([]);
  });

  test('S-NEWS-02 total berita menurut paginasi sama dengan jumlah per kategori di sidebar', { tag: '@regression' }, async ({ page }) => {
    const list = new NewsListPage(page);
    await list.open('/portal/berita');
    const counts = await list.categoryCounts();
    test.skip(Object.keys(counts).length === 0, 'Sidebar kategori tidak ditemukan.');
    const expectedTotal = Object.values(counts).reduce((a, b) => a + b, 0);

    const perPage = (await list.cardTitles()).length;
    const last = await list.lastPageNumber();
    await list.open(`/portal/berita?page=${last}`);
    const onLast = (await list.cardTitles()).length;
    const paginatedTotal = (last - 1) * perPage + onLast;

    test.info().annotations.push({ type: 'data', description: JSON.stringify({ counts, perPage, last, onLast, paginatedTotal }) });
    expect(paginatedTotal, `jumlah menurut paginasi vs sidebar ${JSON.stringify(counts)}`).toBe(expectedTotal);
  });

  test('S-NEWS-03 kategori menampilkan jumlah kartu sesuai sidebar, konsisten di kedua format URL', { tag: '@regression' }, async ({ page }) => {
    const list = new NewsListPage(page);
    await list.open('/portal/berita');
    const perPage = (await list.cardTitles()).length;
    const counts = await list.categoryCounts();
    const count = counts['Berita Kuttab'];
    test.skip(count === undefined, 'Kategori "Berita Kuttab" tidak ada di sidebar.');
    const expected = Math.min(count, perPage);

    // Format yang dipakai sidebar
    await list.open('/portal/kategori/berita-kuttab');
    const viaPath = await list.cardTitles();
    expect(viaPath.length, '/portal/kategori/berita-kuttab').toBe(expected);

    // Format yang dipakai menu NASYATH > BERITA KUTTAB
    await list.open('/portal/berita?kategori=berita-kuttab');
    const viaQuery = await list.cardTitles();
    expect(viaQuery.length, '/portal/berita?kategori=berita-kuttab harus menampilkan isi yang sama').toBe(expected);
    expect(viaQuery).toEqual(viaPath);
  });

  test('S-NEWS-04 halaman arsip bulanan hanya memuat berita dari bulan tersebut', { tag: '@regression' }, async ({ page }) => {
    const list = new NewsListPage(page);
    await list.open('/portal/berita');
    const href = await page.locator('a[href*="/portal/arsip/"]').first().getAttribute('href');
    test.skip(!href, 'Tautan arsip tidak ditemukan.');
    const [, year, month] = /\/arsip\/(\d{4})\/(\d{1,2})/.exec(href || '') || [];
    await list.open(new URL(href || '', page.url()).pathname);
    const dates = await list.cardDatesIso();
    expect(dates.length, 'arsip harus memuat minimal satu berita bertanggal').toBeGreaterThan(0);
    const outside = dates.filter((d) => !d.startsWith(`${year}-${month.padStart(2, '0')}-`));
    expect(outside, `tanggal di luar ${year}-${month}`).toEqual([]);
  });

  test('S-NEWS-09 daftar Artikel Santri membuka detail artikel', { tag: '@regression' }, async ({ page }) => {
    const list = new NewsListPage(page);
    await list.open('/portal/artikel');
    const link = list.cardLinks().first();
    const title = norm(await link.innerText());
    await link.click();
    expect(norm(await new ArticlePage(page).title().innerText())).toBe(title);
  });
});

test.describe('Detail berita', () => {
  /** Buka berita pertama dari daftar dan kembalikan data kartunya. */
  async function openFirstArticle(page) {
    const list = new NewsListPage(page);
    await list.open('/portal/berita');
    const link = list.cardLinks().first();
    const title = norm(await link.innerText());
    const href = new URL((await link.getAttribute('href')) || '', page.url()).href;
    // Naik dari tautan judul ke ancestor terdekat yang memuat tanggal = kartu berita tersebut.
    const cardText = await link.evaluate((a, source) => {
      const re = new RegExp(source);
      let el = a.parentElement;
      while (el && !re.test(el.innerText)) el = el.parentElement;
      return el ? el.innerText : '';
    }, DATE_TEXT.source);
    const cardDate = toIsoDate(cardText);
    expect(cardDate, 'kartu berita harus menampilkan tanggal terbit').toBeTruthy();
    await link.click();
    await page.waitForURL(href);
    return { title, href, cardDate };
  }

  test('S-NEWS-05 detail berita konsisten dengan kartu di daftar (judul, URL, tanggal)', { tag: ['@smoke', '@mobile'] }, async ({ page }) => {
    const { title, href, cardDate } = await openFirstArticle(page);
    const article = new ArticlePage(page);
    await expect(page).toHaveURL(href);
    const h1 = norm(await article.title().innerText());
    expect(h1).toBe(title);
    const body = await page.locator('body').innerText();
    const afterTitle = body.slice(Math.max(0, body.indexOf(await article.title().innerText())));
    const detailDate = allIsoDates(afterTitle)[0];
    expect(detailDate, 'tanggal terbit di detail harus sama dengan tanggal di kartu').toBe(cardDate);
  });

  test('S-NEWS-06 breadcrumb dan tautan berbagi memuat URL artikel', { tag: '@regression' }, async ({ page }) => {
    const { href } = await openFirstArticle(page);
    const article = new ArticlePage(page);
    await expect(article.breadcrumbLink('Beranda')).toBeVisible();
    await expect(article.breadcrumbLink('Berita').first()).toBeVisible();
    for (const name of ['WhatsApp', 'Facebook', 'Twitter']) {
      const shareHref = (await article.shareLink(name).getAttribute('href')) || '';
      const decoded = decodeURIComponent(shareHref.replace(/\+/g, ' '));
      expect(decoded, `tautan berbagi ${name}`).toContain(href);
    }
  });

  test('S-NEWS-07 "Artikel Terkait" tidak memuat artikel yang sedang dibuka', { tag: '@regression' }, async ({ page }) => {
    const { href } = await openFirstArticle(page);
    const hrefs = await new ArticlePage(page).relatedLinks().evaluateAll((els) => els.map((e) => /** @type {HTMLAnchorElement} */ (e).href));
    expect(hrefs.length, 'bagian artikel terkait harus berisi').toBeGreaterThan(0);
    expect(hrefs).not.toContain(href);
  });

  test('S-NEWS-08 penghitung "kali dibaca" berupa angka dan tidak berkurang setelah dimuat ulang', { tag: '@regression' }, async ({ page }) => {
    // Nilai volatil: yang diuji adalah sifatnya (monoton tidak turun), bukan nilai pastinya.
    await openFirstArticle(page);
    const article = new ArticlePage(page);
    const before = await article.viewCount();
    expect(Number.isInteger(before)).toBe(true);
    await page.reload();
    const after = await article.viewCount();
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test.describe('Salin tautan', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
    test('S-NEWS-10 "Salin Link" menyalin URL artikel ke clipboard', { tag: ['@regression', '@chromium-only'] }, async ({ page }) => {
      const { href } = await openFirstArticle(page);
      await new ArticlePage(page).copyLinkControl().click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(href);
    });
  });
});
