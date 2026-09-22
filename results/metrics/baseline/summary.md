# Ringkasan metrik: baseline

- Jumlah run (k): **10**; URL: https://staging.pesantrenpersis27.com; versi aplikasi: -
- Test dieksekusi: **101** (stabil lulus 50, stabil gagal 39, flaky 12)
- **Flakiness rate (per test): 11.88%**
- Skenario: 30; skenario flaky 6 (**20%**)
- Median durasi per test: 1853.5 ms; median durasi satu suite: 248.775 s

## Test flaky
- [chromium-desktop] Login SIMASIS › S-AUTH-01 form login lengkap dan setiap input memiliki nama yang dapat diakses: 9/10 lulus — TimeoutError: page.goto: Timeout 30000ms exceeded.
- [chromium-desktop] Beranda › S-HOME-02 tombol "Info Terbaru" membuka daftar berita: 2/10 lulus — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Beranda › S-HOME-05 berita terbaru di beranda membuka artikel dengan judul yang sama: 1/10 lulus — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Beranda › S-HOME-06 pertanyaan FAQ menampilkan jawabannya: 4/10 lulus — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Smoke › S-SMOKE-01 beranda termuat dengan judul dan heading utama: 7/10 lulus — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [mobile-chrome] Smoke › S-SMOKE-01 beranda termuat dengan judul dan heading utama: 8/10 lulus — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] S-PAGE-01 Halaman statis dapat diakses › S-PAGE-01 [/portal/halaman/wajah-wijhah] WAJAH WIJHAH: 9/10 lulus — TimeoutError: page.goto: Timeout 30000ms exceeded.
- [chromium-desktop] S-PAGE-01 Halaman statis dapat diakses › S-PAGE-01 [/portal/halaman/muallimin] MU'ALLIMIN: 9/10 lulus — TimeoutError: page.goto: Timeout 30000ms exceeded.
- [chromium-desktop] S-PAGE-01 Halaman statis dapat diakses › S-PAGE-01 [/portal/halaman/kbm-design-grafis] DESIGN GRAFIS: 8/10 lulus — TimeoutError: page.goto: Timeout 30000ms exceeded.
- [chromium-desktop] S-PAGE-01 Halaman statis dapat diakses › S-PAGE-01 [/portal/halaman/ekskul-kuliah-umum] KULIAH UMUM: 9/10 lulus — TimeoutError: page.goto: Timeout 30000ms exceeded.
- [chromium-desktop] S-PAGE-01 Halaman statis dapat diakses › S-PAGE-01 [/portal/halaman/ekskul-life-skill] PELATIHAN LIFE SKILL DAN ENTERPRENEURSHIP: 9/10 lulus — Error: status HTTP /portal/halaman/ekskul-life-skill
- [chromium-desktop] S-PAGE-01 Halaman statis dapat diakses › S-PAGE-01 [/portal/halaman/bahasa-arab] BAHASA ARAB: 9/10 lulus — Error: status HTTP /portal/halaman/bahasa-arab

## Test gagal stabil (kandidat cacat, WAJIB ditriase manual)
- [chromium-desktop] Login SIMASIS › S-AUTH-03 login dengan kredensial salah ditolak dengan pesan yang jelas — TimeoutError: page.goto: Timeout 30000ms exceeded.
- [chromium-desktop] Beranda › S-HOME-01 tombol "Daftar PSB" menuju situs PSB melalui HTTPS — TimeoutError: locator.getAttribute: Timeout 15000ms exceeded.
- [chromium-desktop] Beranda › S-HOME-03 tautan statistik (alumni, santri) valid dan anchor tersedia — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Beranda › S-HOME-04 modal program unggulan terbuka dengan judul yang benar dan dapat ditutup — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [mobile-chrome] Beranda › S-HOME-05 berita terbaru di beranda membuka artikel dengan judul yang sama — TimeoutError: locator.click: Timeout 15000ms exceeded.
- [chromium-desktop] Integritas tautan dan aset › S-LINK-01 semua tautan internal pada halaman kunci tidak rusak (status < 400) — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Integritas tautan dan aset › S-LINK-02 tautan ke domain milik pesantren memakai HTTPS — Error: tautan http:// ke domain sendiri (risiko mixed content / tanpa enkripsi)
- [chromium-desktop] Integritas tautan dan aset › S-LINK-03 semua gambar pada halaman kunci dapat dimuat — Error: gambar rusak dari 29 gambar
- [chromium-desktop] Navigasi menu utama › S-NAV-01 setiap item menu ada dengan tujuan (href) yang sesuai spesifikasi — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [IFTITAH > NIZHAM] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [IFTITAH > TSANAWIYYAH] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [IFTITAH > WEB DESIGN] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [MANHAJ > BAHASA ARAB] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [NASYATH > BERITA TERBARU] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [PESANTREN UMUM > BROSUR PESANTREN UMUM] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [INFO PSB > KETENTUAN SELEKSI SANTRI] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [SIMASIS > LOGIN] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Daftar berita › S-NEWS-01 daftar berita menampilkan kartu dan halaman 2 berbeda dari halaman 1 — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Daftar berita › S-NEWS-02 total berita menurut paginasi sama dengan jumlah per kategori di sidebar — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Daftar berita › S-NEWS-03 kategori menampilkan jumlah kartu sesuai sidebar, konsisten di kedua format URL — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Daftar berita › S-NEWS-04 halaman arsip bulanan hanya memuat berita dari bulan tersebut — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Daftar berita › S-NEWS-09 daftar Artikel Santri membuka detail artikel — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [mobile-chrome] Daftar berita › S-NEWS-01 daftar berita menampilkan kartu dan halaman 2 berbeda dari halaman 1 — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Detail berita › S-NEWS-05 detail berita konsisten dengan kartu di daftar (judul, URL, tanggal) — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Detail berita › S-NEWS-06 breadcrumb dan tautan berbagi memuat URL artikel — TimeoutError: locator.getAttribute: Timeout 15000ms exceeded.
- [chromium-desktop] Detail berita › S-NEWS-07 "Artikel Terkait" tidak memuat artikel yang sedang dibuka — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Detail berita › S-NEWS-08 penghitung "kali dibaca" berupa angka dan tidak berkurang setelah dimuat ulang — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [mobile-chrome] Detail berita › S-NEWS-05 detail berita konsisten dengan kartu di daftar (judul, URL, tanggal) — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Detail berita › Salin tautan › S-NEWS-10 "Salin Link" menyalin URL artikel ke clipboard — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Aksesibilitas (axe-core, WCAG 2.x A/AA) › S-QUAL-01 [beranda] tidak ada pelanggaran aksesibilitas berdampak "critical" — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] Aksesibilitas (axe-core, WCAG 2.x A/AA) › S-QUAL-01 [daftar berita] tidak ada pelanggaran aksesibilitas berdampak "critical" — Error: pelanggaran critical (lihat lampiran untuk semua tingkat)
- [chromium-desktop] Aksesibilitas (axe-core, WCAG 2.x A/AA) › S-QUAL-01 [artikel santri] tidak ada pelanggaran aksesibilitas berdampak "critical" — Error: pelanggaran critical (lihat lampiran untuk semua tingkat)
- [chromium-desktop] SEO dasar › S-QUAL-02 [beranda] URL canonical sama dengan URL halaman — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] SEO dasar › S-QUAL-02 [daftar berita] URL canonical sama dengan URL halaman — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] SEO dasar › S-QUAL-02 [artikel santri] URL canonical sama dengan URL halaman — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [chromium-desktop] SEO dasar › S-QUAL-02 [login] URL canonical sama dengan URL halaman — Error: canonical menunjuk ke halaman lain
- [mobile-chrome] Responsif (mobile) › S-QUAL-03 [beranda] tidak ada scroll horizontal di layar ponsel — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [mobile-chrome] Responsif (mobile) › S-QUAL-03 [daftar berita] tidak ada scroll horizontal di layar ponsel — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)
- [mobile-chrome] Responsif (mobile) › S-QUAL-03 [artikel santri] tidak ada scroll horizontal di layar ponsel — Error: Implicit oracle: JS error / console error / HTTP 5xx / request gagal (first-party)

> Kegagalan stabil belum tentu bug aplikasi: bisa juga selector yang perlu dikalibrasi atau
> ekspektasi test yang keliru. Klasifikasikan setiap kasus (product defect / test defect) sebelum dilaporkan.