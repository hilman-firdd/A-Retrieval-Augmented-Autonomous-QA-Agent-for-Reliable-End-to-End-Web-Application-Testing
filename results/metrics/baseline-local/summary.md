# Ringkasan metrik: baseline-local

- Jumlah run (k): **10**; URL: http://127.0.0.1:8000; versi aplikasi: -
- Test dieksekusi: **101** (stabil lulus 82, stabil gagal 18, flaky 1)
- **Flakiness rate (per test): 0.99%**
- Skenario: 30; skenario flaky 1 (**3.33%**)
- Median durasi per test: 1009.5 ms; median durasi satu suite: 195.6405 s

## Test flaky
- [chromium-desktop] Beranda › S-HOME-04 modal program unggulan terbuka dengan judul yang benar dan dapat ditutup: 8/10 lulus — Error: expect(locator).toBeHidden() failed

## Test gagal stabil (kandidat cacat, WAJIB ditriase manual)
- [chromium-desktop] Login SIMASIS › S-AUTH-03 login dengan kredensial salah ditolak dengan pesan yang jelas — Error: expect(locator).toBeVisible() failed
- [chromium-desktop] Beranda › S-HOME-01 tombol "Daftar PSB" menuju situs PSB melalui HTTPS — TimeoutError: locator.getAttribute: Timeout 15000ms exceeded.
- [mobile-chrome] Beranda › S-HOME-05 berita terbaru di beranda membuka artikel dengan judul yang sama — TimeoutError: locator.click: Timeout 15000ms exceeded.
- [chromium-desktop] Integritas tautan dan aset › S-LINK-02 tautan ke domain milik pesantren memakai HTTPS — Error: tautan http:// ke domain sendiri (risiko mixed content / tanpa enkripsi)
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [IFTITAH > NIZHAM] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [IFTITAH > TSANAWIYYAH] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [IFTITAH > WEB DESIGN] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [MANHAJ > BAHASA ARAB] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [NASYATH > BERITA TERBARU] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [PESANTREN UMUM > BROSUR PESANTREN UMUM] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [INFO PSB > KETENTUAN SELEKSI SANTRI] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Navigasi menu utama › S-NAV-02 [SIMASIS > LOGIN] navigasi lewat dropdown — TimeoutError: locator.hover: Timeout 15000ms exceeded.
- [chromium-desktop] Detail berita › S-NEWS-05 detail berita konsisten dengan kartu di daftar (judul, URL, tanggal) — Error: tanggal terbit di detail harus sama dengan tanggal di kartu
- [chromium-desktop] Detail berita › S-NEWS-06 breadcrumb dan tautan berbagi memuat URL artikel — TimeoutError: locator.getAttribute: Timeout 15000ms exceeded.
- [mobile-chrome] Detail berita › S-NEWS-05 detail berita konsisten dengan kartu di daftar (judul, URL, tanggal) — Error: tanggal terbit di detail harus sama dengan tanggal di kartu
- [chromium-desktop] Aksesibilitas (axe-core, WCAG 2.x A/AA) › S-QUAL-01 [daftar berita] tidak ada pelanggaran aksesibilitas berdampak "critical" — Error: pelanggaran critical (lihat lampiran untuk semua tingkat)
- [chromium-desktop] Aksesibilitas (axe-core, WCAG 2.x A/AA) › S-QUAL-01 [artikel santri] tidak ada pelanggaran aksesibilitas berdampak "critical" — Error: pelanggaran critical (lihat lampiran untuk semua tingkat)
- [chromium-desktop] SEO dasar › S-QUAL-02 [login] URL canonical sama dengan URL halaman — Error: canonical menunjuk ke halaman lain

> Kegagalan stabil belum tentu bug aplikasi: bisa juga selector yang perlu dikalibrasi atau
> ekspektasi test yang keliru. Klasifikasikan setiap kasus (product defect / test defect) sebelum dilaporkan.