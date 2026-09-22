# ppi27-e2e — Suite Playwright untuk Portal Pesantren PERSIS 27

Suite E2E berbasis **Playwright + JavaScript** untuk `staging.pesantrenpersis27.com`. Suite ini dibuat untuk dua keperluan:

1. **Baseline B1 ("human-written suite")** pada eksperimen naskah RAQA. Suite ini menghasilkan data flakiness (FR) dan fault detection (FDR) untuk baris/kolom B1.
2. **Fondasi eksekutor RAQA.** Page object, prioritas locator, *implicit oracle*, dan katalog skenario di sini adalah komponen yang nantinya dipakai ulang oleh agen RAQA.

---

## Penting: apa yang BISA dan TIDAK BISA dijawab suite ini

| Placeholder di naskah | Bisa diisi dari suite ini? | Sumber |
|---|---|---|
| Tabel 2: `#S` dan `#F` untuk aplikasi ini | ✅ | `scenarios/catalog.json`, `faults/faults.csv` |
| Bagian 5.2: `[y4]` (FR suite buatan manusia) dan kolom FR script baris B1 di Tabel 3 | ✅ | `results/metrics/baseline/summary.json` |
| Tabel 4 kolom **B1** (fault terdeteksi per kategori, FDR, false alarm) | ✅ | `results/metrics/fault-detection/` |
| Bagian 4.5: versi Playwright, hardware, OS | ✅ | `results/env-info.json` |
| Bagian 4.1: deskripsi aplikasi subjek dan skenario | ✅ sebagian | README ini + katalog skenario |
| TSR, HAR, dan semua angka **RAQA / B2 / B3 / B4** | ❌ | butuh agen RAQA dan baseline agen |
| RQ4 (ablasi) dan RQ5 (reviewer manusia) | ❌ | butuh agen RAQA |
| Abstrak dan Kesimpulan | ❌ belum | menunggu semua angka di atas |

**Jangan** memakai hasil suite ini untuk mengisi angka RAQA. Suite ini adalah pembanding (B1), bukan sistem yang diusulkan.

**Soal kejujuran metodologi.** Naskah saat ini menulis bahwa B1 disusun oleh "QA engineers". Suite ini disusun dengan bantuan AI lalu (seharusnya) Anda kalibrasi. Sesuaikan Bagian 4.2 dengan kenyataan, misalnya: *"B1 was drafted with AI assistance, then reviewed and calibrated by the author against the application"*. Idealnya, minta satu rekan QA me-review suite ini dan cantumkan di Acknowledgment. Cantumkan juga penggunaan AI ini di pernyataan disclosure.

---

## 1. Instalasi

Prasyarat: Node.js ≥ 18.

```bash
npm install
npx playwright install --with-deps chromium   # tambah firefox webkit bila ALL_BROWSERS=1
cp .env.example .env                           # Windows PowerShell: copy .env.example .env
```

Isi `.env` sesuai kebutuhan (lihat komentar di dalamnya). Kredensial SIMASIS bersifat **opsional**; tanpa kredensial, skenario S-AUTH-04 otomatis dilewati. Jika diisi, gunakan **akun khusus uji**, jangan akun asatidz, santri, atau orang tua sungguhan. File `.env` sudah masuk `.gitignore`.

## 2. Langkah pertama: kalibrasi (wajib sebelum eksperimen)

Selector ditulis berdasarkan struktur konten situs, tetapi **belum pernah dijalankan terhadap situs aslinya**, karena lingkungan saya tidak dapat mengakses domain staging. Framework-nya (fixture, reporter, skrip metrik, FDR) sudah diverifikasi terhadap server tiruan.

```bash
npm run test:smoke          # cepat, cek koneksi dan halaman utama
npx playwright test         # seluruh suite satu kali
npm run report              # buka laporan HTML
```

Untuk setiap test yang gagal pada putaran pertama, tentukan penyebabnya:

- **Selector perlu disesuaikan** dengan DOM asli, misalnya dropdown yang dibuka dengan klik alih-alih hover, atau tombol "Selengkapnya" yang berupa `div`. Perbaiki di `src/pages/*`, jangan di test.
- **Ekspektasi test keliru**, yaitu aturan bisnis yang saya asumsikan ternyata salah. Perbaiki test dan catat alasannya.
- **Cacat aplikasi sungguhan.** Biarkan test tetap gagal dan catat sebagai temuan.

Catat ketiga kategori ini. Jumlahnya berguna untuk bagian Threats to Validity. Setelah kalibrasi selesai, **bekukan** versi suite (commit/tag) sebelum eksperimen, dan jangan mengubah test lagi selama pengukuran.

Tips kalibrasi: `npx playwright test --ui` atau `npx playwright codegen https://staging.pesantrenpersis27.com` untuk melihat accessible name setiap elemen.

## 3. Mengukur flakiness (FR) untuk B1

```bash
node scripts/run-repeated.js --k 10 --label baseline
node scripts/compute-metrics.js --label baseline
node scripts/env-info.js
```

- `retries` sengaja **0** di konfigurasi. Retry otomatis menyembunyikan flakiness.
- Setiap run adalah proses terpisah (`k01`–`k10`), sehingga mirip eksekusi CI.
- Worker default 2. Jalankan di luar jam sibuk agar tidak membebani staging.
- Efek samping di staging: penghitung "kali dibaca" bertambah, dan ada satu percobaan login gagal per run. Keduanya wajar untuk staging, tetapi perlu Anda ketahui.

Output di `results/metrics/baseline/`:

- `summary.md` / `summary.json`: FR per test dan per skenario, durasi.
- `per-test.csv`: verdict tiap test (stable-pass / stable-fail / flaky) beserta pesan error.
- `per-scenario.csv`: rekap per ID skenario.

## 4. Mengukur fault detection (FDR) untuk B1

**Jangan menanam fault di staging yang dipakai orang lain.** Jalankan aplikasi di instance lokal/terpisah (misalnya `php artisan serve` dengan salinan database) dan arahkan `BASE_URL` ke sana.

1. Salin `faults/faults.example.csv` menjadi `faults/faults.csv`. Isi dengan fault yang **benar-benar Anda tanam** di kode Laravel. Baris contoh berisi lokasi file dugaan saya; sesuaikan dengan struktur kode Anda. Gunakan kategori yang sama dengan Tabel 4: *Input validation, Business logic, Navigation and state, Error handling, Real historical defects*. Untuk kategori terakhir, revert fix bug nyata dari riwayat git Anda.
2. Jalankan baseline pada versi **tanpa fault** (langkah 3) di instance yang sama.
3. Untuk setiap fault: terapkan satu fault saja, lalu jalankan:
   ```bash
   node scripts/run-repeated.js --k 3 --label fault-F01
   ```
   Setelah itu kembalikan kodenya, dan ulangi untuk F02, F03, dan seterusnya.
4. Hitung hasilnya:
   ```bash
   node scripts/fault-detection.js
   ```

Kriteria deteksi: sebuah fault dianggap terdeteksi bila ada test yang **stabil lulus di baseline** dan gagal pada mayoritas run versi ber-fault. False alarm dihitung dari test yang tidak stabil lulus di versi tanpa fault.

## 5. Yang perlu dikirim kembali untuk mengisi naskah

Kirim isi folder berikut. Jangan kirim video atau trace, karena ukurannya besar dan bisa memuat data pribadi.

```
results/metrics/baseline/summary.json, summary.md, per-test.csv, per-scenario.csv
results/metrics/fault-detection/summary.json, per-fault.csv
results/runs/baseline/meta.json
results/env-info.json
faults/faults.csv
```

Sertakan juga catatan singkat hasil kalibrasi (berapa test yang diperbaiki karena selector, ekspektasi, atau cacat nyata) dan triase setiap test `stable-fail`.

---

## Struktur

```
playwright.config.js     retries 0, reporter JSON per run, trace/video saat gagal
src/fixtures.js          implicit oracle otomatis (JS error, console error, 5xx, request gagal)
src/pages/               page object; locator berbasis role/label/teks, tanpa XPath
src/data/site-map.js     spesifikasi menu & halaman yang diharapkan
src/utils/text.js        normalisasi judul & tanggal (format "17 Jul 2026" / "17 July 2026")
tests/                   31 skenario (107 eksekusi test termasuk parameterisasi & mobile)
scenarios/catalog.json   katalog skenario + acceptance criteria (ground truth & korpus RAQA)
scripts/                 run-repeated, compute-metrics, fault-detection, env-info
faults/                  daftar fault yang ditanam (CSV)
```

Tag: `@smoke` (cepat), `@regression`, `@mobile` (juga dijalankan di Pixel 7), `@a11y`, `@seo`, `@chromium-only`.

---

## Temuan awal dari penelusuran halaman (perlu dikonfirmasi saat run)

Temuan berikut saya catat dari membaca konten halaman. Semuanya **belum diverifikasi** dengan eksekusi test.

### T1. Menu "PENDAFTARAN PSB" memakai HTTP, bukan HTTPS
- **Steps to Reproduce:** Buka beranda → menu INFO PSB → periksa tautan "PENDAFTARAN PSB".
- **Actual Result:** Tautan mengarah ke `http://psb.pesantrenpersis27.com`. Tombol "Daftar PSB" di hero sudah memakai `https://`.
- **Solving/Expected Result:** Semua tautan ke domain pesantren memakai `https://`. Perbaiki href di template menu. Dideteksi oleh **S-LINK-02**.

### T2. Canonical halaman login menunjuk ke beranda
- **Steps to Reproduce:** Buka `/login` → lihat `<link rel="canonical">` dan `og:image`.
- **Actual Result:** Canonical = `https://staging.pesantrenpersis27.com` (beranda), dan `og:image` merujuk ke domain WordPress lama.
- **Solving/Expected Result:** Canonical = URL halaman itu sendiri (atau halaman login diberi `noindex`), dan `og:image` memakai aset portal baru. Dideteksi oleh **S-QUAL-02 [login]**.

### T3. Dua format URL untuk kategori "Berita Kuttab"
- **Steps to Reproduce:** Bandingkan menu NASYATH → BERITA KUTTAB (`/portal/berita?kategori=berita-kuttab`) dengan tautan sidebar (`/portal/kategori/berita-kuttab`).
- **Actual Result:** Belum diketahui. Jika parameter `?kategori=` tidak diproses, menu akan menampilkan semua berita, sementara sidebar menyatakan kategori ini berisi 0 berita.
- **Solving/Expected Result:** Kedua URL menampilkan isi yang sama; sebaiknya menu memakai satu format kanonis. Dideteksi oleh **S-NEWS-03**.

### T4. Ejaan label menu
- **Actual Result:** Tertulis "EKSTRAKULIKULER", sementara menu saudaranya "KBM EKSTRAKURIKULER".
- **Solving/Expected Result:** "EKSTRAKURIKULER". Temuan konten ini tidak diuji otomatis.

### T5. Nama bulan berbahasa Inggris di detail berita
- **Actual Result:** Daftar menampilkan "17 Jul 2026", sedangkan detail menampilkan "17 July 2026" pada antarmuka berbahasa Indonesia.
- **Solving/Expected Result:** Format tanggal konsisten, dengan locale `id` (misalnya "17 Juli 2026"). Test S-NEWS-05 tetap lulus karena membandingkan tanggal setelah dinormalisasi.

### Catatan desain: penghitung "kali dibaca"
Penghitung ini bertambah pada setiap pemuatan halaman, termasuk oleh crawler. Hal ini berpotensi menggelembungkan daftar "Populer". Test S-NEWS-08 sengaja hanya menguji sifat monotonnya, bukan nilainya. Ini contoh konkret *volatile text* yang dibahas di naskah (φ_vol, Persamaan 2).
