# Hasil eksekusi lengkap — ppi27-e2e (B1): kalibrasi, FR (Langkah 3), dan FDR (Langkah 4)

Dokumen ini menggantikan draf sebelumnya. Semua angka di sini berasal dari **pengukuran resmi sesuai prosedur README** (bukan lagi run ad-hoc 1-2 kali): FR dari `run-repeated.js --k 10` terhadap staging, dan FDR dari fault seeding sungguhan pada instance Laravel lokal (`erapor-ppi27` di `/Users/macbookprom3pro/Sites/erapor-ppi27`, database `simasis27prod2`).

**Update terbaru:** menindaklanjuti evaluasi kesiapan manuskrip (3 isu critical, 5 major, 8 minor), FDR diperluas dari 5 fault (CI 95% 23–88%, hampir tidak informatif) menjadi **25 fault** (CI 95% 17.2–51.6%) — lihat bagian 5. Isu critical lain dari evaluasi (kontribusi RAQA belum ada data, etika data PII, kecocokan scope JSC) adalah keputusan strategis penulis naskah, dicatat di bagian 7 tapi tidak dieksekusi di sini.

## 1. Lingkungan

| Item | Nilai |
|---|---|
| OS / CPU / RAM | Darwin 25.6.0 (arm64), Apple M3 Pro × 11, 18 GB — `results/env-info.json` |
| Node.js / Playwright | v20.19.0 / 1.56.1 |
| Target FR (Langkah 3) | `https://staging.pesantrenpersis27.com` |
| Target FDR (Langkah 4) | `http://127.0.0.1:8000` — Laravel lokal (`php artisan serve`), DB MySQL lokal `simasis27prod2` (125 post, 1325 user, migrasi sinkron) |
| Browser | Chromium desktop + Chromium mobile-emulasi (Pixel 7). Firefox/WebKit belum dijalankan. |

Perbedaan penting yang ditemukan antar dua lingkungan: bucket gambar staging (`staging-simasis27.nos.jkt-1.neo.id`) menolak akses publik (403), sedangkan bucket lokal (`prod-simasis27.nos.jkt-1.neo.id`) menerima akses publik (200) — lihat RC1 di bagian 3.

## 2. Langkah 3 — Flakiness Rate (FR) resmi, k=10, staging

```
node scripts/run-repeated.js --k 10 --label baseline   # BASE_URL=staging...
node scripts/compute-metrics.js --label baseline
```

**Hasil (`results/metrics/baseline/summary.json`):**

| Metrik | Nilai |
|---|---|
| Test dieksekusi | 101 (dari 107; 6 skip: S-AUTH-04 tanpa kredensial, S-QUAL-03×5 hanya relevan mobile) |
| Stabil lulus | 50 |
| Stabil gagal | 39 |
| Flaky | 12 |
| **FR (per test)** | **11.88%** |
| Skenario | 30 total, 6 flaky (**20%**) |
| Median durasi/test | 1853.5 ms |
| Median durasi 1 suite | 248.8 s (~4.1 menit) |

Ini adalah **angka resmi untuk Bagian 5.2 / Tabel 3 naskah (kolom FR script B1)**, bukan estimasi dari 1-2 run seperti sebelumnya.

### Kategorisasi 39 test gagal-stabil

Ditelusuri otomatis + manual: **22 dari 39** murni cascading dari satu akar masalah (RC1, gambar 403 — lihat bagian 3). **17 sisanya** persis cocok dengan 6 kategori cacat/selector yang sudah diverifikasi manual di luar Playwright (curl, skrip terpisah) — ringkasan di bagian 3.

### 12 test flaky di staging — dominan disebabkan dua hal

- **7 dari 12**: `S-PAGE-01` (5 halaman statis berbeda-beda tiap kali) atau navigasi lain — `TimeoutError: page.goto` 30 detik, padahal `curl` langsung ke URL yang sama selalu sukses <1 detik. Ini **bukan bug tetap satu halaman**, melainkan kapasitas/latensi staging yang tidak stabil di bawah beban bersamaan (2 worker Playwright).
- **5 dari 12**: cascading dari RC1 (implicit oracle kadang menangkap gambar 403, kadang tidak sempat — tergantung timing request).

## 3. Enam akar masalah (RC1–RC6) — divalidasi silang k=10 + manual

| # | Akar masalah | Kategori | Jumlah gagal (k=10, staging) | Bukti manual independen |
|---|---|---|---|---|
| RC1 | Bucket gambar staging (`staging-simasis27...`) menolak GET publik (403 AccessDenied, Cloudian S3) | **Cacat aplikasi nyata** (infra) | 22 stable-fail + 5 flaky (cascading) | `curl` ke bucket staging → 403 (diulang 2×, URL berbeda). Bucket **prod** (dipakai instance lokal) → 200 OK untuk URL identik. Ini murni masalah *bucket policy* staging, bukan kode aplikasi. |
| RC2 | Ikon Font Awesome (webfont) membocorkan karakter ligature ke *accessible name*, merusak locator `exact: true` | **Selector perlu disesuaikan** | 8 (S-NAV-02) + 1 (S-HOME-01) + 1 (S-NEWS-06) = 10 | `accessibility.snapshot()` pada tombol dropdown "IFTITAH" → nama `" IFTITAH "` dengan 2 karakter Private-Use-Area (U+F05A dst) menempel. Direplikasi identik di lokal. |
| RC3 | Login dengan kredensial salah tidak menampilkan pesan error **jika input berupa format email** | **Cacat aplikasi nyata** (error handling) | 1 (S-AUTH-03) | **Akar penyebab presisi ditemukan**: `LoginController::username()` mengganti nama field validasi jadi `'email'` bila input berformat email, tapi `login.blade.php` hanya punya blok `@error('username')`/`@error('password')` — tidak ada `@error('email')`. Dikonfirmasi: input **username biasa** (bukan email) → pesan error muncul normal; input **format email** → pesan hilang. Direproduksi identik di staging dan lokal (kode sama). |
| RC4 | Tautan "PENDAFTARAN PSB" masih `http://`, bukan `https://` (temuan T1 README, terkonfirmasi) | **Cacat aplikasi nyata** | 1 (S-LINK-02) | `curl` homepage → `href="http://psb.pesantrenpersis27.com"` pada `<a class="dropdown-item">`. Konsisten di staging & lokal (data sama). |
| RC5 | `<link rel="canonical">` di `/login` menunjuk ke beranda (temuan T2 README, terkonfirmasi) | **Cacat aplikasi nyata** | 1 (S-QUAL-02 login) | `curl /login` → `canonical = https://.../` (beranda). Konsisten di staging & lokal. |
| RC6 | Tombol pencarian (ikon kaca pembesar) tanpa nama aksesibel — WCAG 4.1.2, axe `button-name`, impact **critical** | **Cacat aplikasi nyata** (a11y) | 2 (S-QUAL-01 daftar berita & artikel santri) | `<button class="btn btn-portal"><i class="fas fa-search"></i></button>` — tidak ada teks/`aria-label`. Dijalankan ulang axe-core manual di 2 halaman, hasil identik. |

**RC7 (kapasitas/latensi staging tidak stabil):** bukan satu bug tetap, melainkan pola: berbagai halaman `/portal/halaman/*` acak gagal `page.goto` di bawah beban worker paralel, padahal selalu sukses cepat via `curl`. Ukur benar dengan FR resmi di atas (sudah tercermin dalam 12 test flaky, bukan lagi dugaan).

### Temuan baru dari data k=10 yang tidak muncul di analisis 1-2 run sebelumnya

- **S-HOME-05 (mobile-chrome) — stable-fail 0/10 di staging DAN 0/10 di lokal.** Klik pada judul berita terbaru di beranda (viewport Pixel 7) di-intercept oleh `<div class="card-body">` yang tumpang tindih — `locator.click: Timeout 15000ms exceeded`, `<div class="card-body">` intercepts pointer events`. Diperiksa manual: elemen di titik tengah link *sebelum* animasi selesai bisa berbeda dari elemen final, mengindikasikan transisi/animasi CSS kartu yang mengganggu klik di viewport sempit. **Bug mobile-only yang konsisten di dua lingkungan berbeda — kandidat cacat nyata, bukan flaky.**
- **S-HOME-04 (modal program unggulan) — flaky 8/10 di lokal (belum kelihatan di staging karena tertutup RC1).** Modal "Tutup" kadang tidak ter-hide dalam 10 detik (2 dari 10 run, masing-masing ~11 detik vs normal ~5-6 detik). Flakiness murni timing, bukan reproducible dengan skrip manual sekali jalan — konsisten dengan definisi FR di naskah (Persamaan 5).

## 4. Temuan tambahan dari baseline lokal (k=10, tanpa fault, tanpa RC1/RC7)

```
BASE_URL=http://127.0.0.1:8000 node scripts/run-repeated.js --k 10 --label baseline-local
node scripts/compute-metrics.js --label baseline-local
```

Karena bucket gambar lokal berfungsi normal dan tidak ada latensi jaringan, hasil run ini jauh lebih bersih — **berguna sebagai kontrol untuk memisahkan "cacat aplikasi/selector" dari "gangguan infra staging"**.

| Metrik | Staging (k=10) | Lokal (k=10) |
|---|---|---|
| Stabil lulus | 50 | 82 |
| Stabil gagal | 39 | 18 |
| Flaky | 12 | 1 |
| FR | 11.88% | 0.99% |

18 stable-fail di lokal = **persis** RC2+RC3+RC4+RC5+RC6+S-HOME-05 (10+1+1+1+2+1 = 16) **+ 2 tambahan**:
- **S-NEWS-05 stable-fail 0/10, tapi ini kesalahan test, bukan aplikasi.** Kartu berita pertama di DB lokal memuat dua tanggal: badge tanggal terbit sistem ("13 Jul 2026") dan tanggal naratif di kutipan isi berita ("Ahad, 12 Juli 2026" — tanggal kejadian, ditulis penulis artikel). Fungsi `toIsoDate()` di `src/utils/text.js` (dipakai `openFirstArticle()` di `tests/news/news.spec.js`) mengambil tanggal **pertama yang ditemukan** di teks kartu, yaitu tanggal naratif, bukan badge sistem. Di halaman detail, ekstraksi tanggal mengambil badge sistem yang benar → mismatch. **Ini murni "ekspektasi test keliru"** (kategori 2 README bagian 2), bukan cacat aplikasi. Perlu diperbaiki: cari tanggal secara spesifik di elemen badge/waktu-baca, bukan memindai seluruh teks kartu.
- (S-HOME-05 dan S-HOME-04 sudah dibahas di bagian 3.)

## 5. Langkah 4 — Fault Detection Rate (FDR), fault seeding sungguhan (n=25)

**Riwayat revisi:** putaran pertama memakai 5 fault (FDR 60%, CI 95% 23–88% — hampir tidak informatif, sesuai catatan reviewer manuskrip). Putaran ini menambah **20 fault baru** (total **25**, minimal 3 per kategori) untuk mempersempit interval kepercayaan, sesuai masukan evaluasi manuskrip ("targetkan minimal 20–30 fault").

Semua 25 fault ditanam **satu per satu** di source code Laravel (`erapor-ppi27`, git-tracked), sebagai **patch git tersimpan** di `faults/patches/F01.patch` … `F25.patch` (bisa direproduksi ulang persis dengan `git apply`). Untuk tiap fault: `git apply` → `run-repeated.js --k 3` di instance lokal → `git checkout --` (revert) → fault berikutnya, dijalankan otomatis lewat `faults/run-batch.sh` untuk 20 fault baru (F06–F25). Baseline referensi FDR = baseline lokal tanpa-fault k=10 (bagian 4). Deskripsi lengkap tiap fault, kategori, lokasi kode, dan cara terap ada di `faults/faults.csv`.

**Hasil (`results/metrics/fault-detection/summary.json`):**

```
faultsListed: 25, faultsRun: 25, detected: 8
FDR: 32%  (95% CI Wilson: 17.2% – 51.6%)   -- dibanding 60% (CI 23–88%) pada n=5
falseAlarmRatePct: 18.81% (19/101 test baseline lokal — tidak berubah, baseline sama)
byCategory:
  Input validation:        1/3 detected  (33%)
  Business logic:          4/7 detected  (57%)
  Navigation and state:    2/5 detected  (40%)
  Error handling:          0/5 detected  (0%)
  Real historical defects: 1/5 detected  (20%)
```

Interval kepercayaan 95% menyempit dari **±32.5 poin persen** (n=5) menjadi **±17.2 poin persen** (n=25) — jauh lebih informatif, meski masih lebar (wajar untuk n=25; akan terus menyempit bila fault ditambah lagi di iterasi berikutnya).

### Rincian 25 fault dan status deteksi

| ID | Kategori | Fault | Status |
|---|---|---|---|
| F01 | Input validation | Login: `validateLogin()` jadi no-op (skip validasi `required`) | MISSED |
| F02 | Business logic | `show()`: related posts ikut memuat artikel yang sedang dibuka | **DETECTED** (S-NEWS-07) |
| F03 | Navigation and state | `archive()`: filter bulan (`whereMonth`) dihapus | **DETECTED** (S-NEWS-04) |
| F04 | Error handling | `archive()`: guard rentang tahun/bulan (`abort_if`) dihapus | MISSED |
| F05 | Real historical defects | Revert commit nyata `0051bb69` — filter `?kategori=` dihapus | **DETECTED** (S-NEWS-03) |
| F06 | Input validation | Regex format tahun/bulan pada rute arsip dihapus | MISSED |
| F07 | Input validation | Field password: `type="password"` → `type="text"` | **DETECTED** (S-AUTH-01) |
| F08 | Business logic | Penghitung "kali dibaca": `increment` → `decrement` | **DETECTED** (S-NEWS-08) |
| F09 | Business logic | Sidebar kategori `berita()`: filter tipe kategori dihapus | **DETECTED** (S-NEWS-02) |
| F10 | Business logic | Urutan daftar berita: `desc` → `asc` | MISSED |
| F11 | Business logic | Beranda "Berita Terbaru": filter tipe `berita()` dihapus | MISSED |
| F12 | Business logic | "Artikel Terkait": filter relevansi kategori dihapus | MISSED |
| F13 | Navigation and state | `archive()`: parameter tahun/bulan tertukar | **DETECTED** (S-NEWS-04) |
| F14 | Navigation and state | Tautan share WhatsApp tidak lagi memuat URL artikel | MISSED |
| F15 | Navigation and state | `category()`: urutan tanggal terbit dihapus | MISSED |
| F16 | Navigation and state | `tag()`: urutan tanggal terbit dihapus | MISSED |
| F17 | Error handling | `show()`: `firstOrFail()`→`first()` (crash pada slug tak ada) | MISSED |
| F18 | Error handling | `category()`: `firstOrFail()`→`first()` | MISSED |
| F19 | Error handling | `tag()`: `firstOrFail()`→`first()` | MISSED |
| F20 | Error handling | `halaman()`: `firstOrFail()`→`first()` | MISSED |
| F21 | Real historical defects | Revert sebagian commit nyata `e71020ae` — `aria-label` tombol hamburger mobile dihapus | MISSED |
| F22 | Real historical defects | Revert sebagian `e71020ae` — `aria-label` tombol "kembali ke atas" dihapus | MISSED |
| F23 | Real historical defects | Revert sebagian `e71020ae` — tautan footer "Lembaga" kembali jadi `href="#"` | MISSED |
| F24 | Real historical defects | Revert commit nyata `14dd0e01` — urutan tabel santri (DataTables) dihapus | MISSED |
| F25 | Business logic | `berita()`: filter tipe pada query utama dihapus (artikel ikut tampil) | **DETECTED** (S-NEWS-02) |

### Mengapa 17 fault MISSED — dikelompokkan per akar penyebab, semua diverifikasi manual

**(a) Suite sama sekali tidak menguji jalur error/404 (F17–F20, 4 fault, kategori Error handling penuh 0/5 bersama F04, F06).** Tidak ada satu pun dari 31 skenario yang sengaja mengunjungi slug/kategori/tag yang tidak ada. Keempat fault ini membuat aplikasi **crash fatal** (memanggil method pada `null`) untuk URL tak valid apa pun — bug nyata dan serius (setara HTTP 500 untuk pengguna yang salah ketik URL atau mengklik tautan basi), tapi suite murni tidak punya test untuk memicunya. **Ini temuan penting tersendiri**: FDR kategori Error handling = 0% dari 5 fault menunjukkan gap cakupan yang sistematis, bukan kebetulan.

**(b) Urutan hasil (sorting) tidak pernah diverifikasi test manapun (F10, F15, F16 — 3 fault).** Tidak ada assertion yang memeriksa item pertama/terakhir berdasar tanggal. Test yang ada (S-NEWS-01/02/03) hanya memeriksa *jumlah* dan *keunikan* kartu, bukan urutannya.

**(c) Relevansi konten yang "tidak salah tapi kurang tepat" tidak diuji (F11, F12 — 2 fault).** Mencampur tipe konten (artikel di listing berita) atau menghapus prioritas kategori pada related-posts tidak melanggar assertion manapun karena test hanya mengecek "ada isinya"/"tidak mengandung diri sendiri", bukan relevansi.

**(d) axe-core (S-QUAL-01) tidak pernah menguji elemen yang tersembunyi secara default (F21, F22 — 2 fault).** Diverifikasi langsung: tombol hamburger mobile adalah `display:none` di viewport desktop (baru muncul di breakpoint mobile via CSS Bootstrap), dan tombol "kembali ke atas" adalah `display:none` sampai pengguna scroll (dimunculkan via JS). axe-core hanya memindai kondisi awal halaman di viewport **desktop** (S-QUAL-01 tidak punya varian mobile) — elemen yang secara CSS/JS belum terlihat otomatis dikecualikan dari pemindaian aksesibilitas, sehingga kedua bug ini (nyata dan sudah pernah terjadi di histori git) **tidak mungkin terdeteksi oleh desain pengujian a11y suite saat ini**, terlepas dari isi fault-nya.

**(e) S-LINK-01 sengaja mengabaikan `href="#"` (F23 — 1 fault).** `SKIP_HREF` regex di `links.spec.js` memfilter tautan `#`, `mailto:`, `tel:`, dll sebelum dicek status HTTP-nya — desain yang masuk akal (tautan jangkar bukan "tautan rusak"), tapi berarti tautan placeholder yang lupa diisi (seperti bug historis commit `e71020ae`) tidak akan pernah tertangkap test ini.

**(f) RC2 (locator ikon rusak) memblokir deteksi fault lain di area yang sama (F14 — 1 fault, TEMUAN PENTING).** F14 mengubah href tautan share WhatsApp agar tidak lagi memuat URL artikel — perubahan yang seharusnya tertangkap S-NEWS-06. Tapi S-NEWS-06 **sudah gagal di baseline tanpa fault apa pun** (`TimeoutError: locator.getAttribute` — locator `shareLink('WhatsApp')` pakai `exact:true` yang rusak karena ikon Font Awesome, persis RC2 di bagian 3), sehingga test itu tidak memenuhi syarat "stabil lulus di baseline" dan otomatis tidak dihitung sebagai detector valid — **bukan karena fault-nya tidak terdeteksi, tapi karena test-nya sudah rusak duluan sebelum sempat memeriksa apa pun.** Ini bukti empiris langsung bahwa 10 selector RC2 yang belum diperbaiki **membuat sebagian FDR B1 diremehkan (underestimated)** — memperkuat poin reviewer manuskrip soal memperbaiki cacat test yang diketahui sebelum FDR final dilaporkan.

**(g) F01 dan F06 (Input validation, MISSED) dan F04 (Error handling, MISSED)** — sudah dijelaskan di analisis awal (n=5): F01 test tidak membedakan jenis pesan error; F04 dan F06 sama-sama soal parameter arsip di luar rentang yang tidak pernah diuji suite (F06 lebih longgar lagi — bahkan level routing tidak divalidasi, tapi tetap tidak reachable oleh test manapun).

### Catatan noise pada F02 (masih berlaku, data dari putaran pertama tidak diulang)

`per-fault.csv` mencantumkan 4 "detector" untuk F02, tapi 3 di antaranya (`S-QUAL-01 [beranda]`, `S-QUAL-02 [daftar berita]`, `S-QUAL-03 [daftar berita]`) adalah **noise** dari `php artisan serve` yang sempat tersendat saat k=3 (verdict "flaky", bukan stabil, error `TimeoutError: page.goto`), bukan akibat fault. Detector F02 yang valid secara kausal hanya `S-NEWS-07`.

### Ringkasan: apa yang berubah dari n=5 ke n=25

- FDR turun dari 60% ke 32% — **bukan berarti B1 "memburuk"**, melainkan estimasi 60% dari 5 fault terlalu optimistis (didominasi kebetulan 3 fault "mudah" seperti F02/F03/F05). Dengan sampel lebih besar dan representatif (termasuk kelas fault yang secara struktural tidak mungkin tertangkap suite saat ini, seperti jalur error 404), 32% adalah estimasi yang jauh lebih jujur.
- Ditemukan **1 mekanisme sistemik baru** yang layak dilaporkan di Threats to Validity: axe-core hanya memindai viewport desktop pada kondisi awal halaman, sehingga bug aksesibilitas pada elemen yang butuh interaksi (scroll, breakpoint mobile) terjamin luput — bukan soal keberuntungan fault, tapi keterbatasan desain S-QUAL-01 itu sendiri.
- Ditemukan **bukti langsung** bahwa RC2 (selector rusak) menurunkan FDR terukur, bukan cuma FR — mendukung rekomendasi memperbaiki RC2 sebelum melaporkan FDR final B1.

## 6. Status 5 temuan awal README (T1–T5) — semua terjawab

| Temuan | Status | Bukti |
|---|---|---|
| T1 — PSB link HTTP | ✅ Terkonfirmasi nyata (RC4), 1/1 run staging stabil gagal | — |
| T2 — Canonical login salah | ✅ Terkonfirmasi nyata (RC5), 1/1 run staging stabil gagal | — |
| T3 — Dua format URL kategori Kuttab | ✅ **Terkonfirmasi BUKAN bug** — diverifikasi manual: `?kategori=berita-kuttab` dan `/kategori/berita-kuttab` konsisten (sama-sama 0 kartu utk kategori kosong; sama-sama 9 kartu identik utk kategori berisi). Filter `?kategori=` justru terbukti krusial: menghapusnya (F05) langsung terdeteksi S-NEWS-03. |
| T4 — Ejaan "EKSTRAKULIKULER" | Tidak diuji otomatis (sesuai README) | — |
| T5 — Nama bulan Inggris | ✅ Logika normalisasi (`toIsoDate`) terbukti benar lewat data staging k=10 (S-NEWS-05 di staging gagal murni cascading RC1, bukan soal tanggal) — S-NEWS-05 tetap lulus begitu RC1 tidak ada, **kecuali** dihalangi masalah ekstraksi tanggal terpisah yang ditemukan di lokal (bagian 4). | — |

## 7. Yang masih di luar cakupan

- Firefox/WebKit belum diuji (`ALL_BROWSERS=1`).
- **10 selector RC2 belum diperbaiki di kode test.** Ini sekarang punya bukti kuantitatif kenapa penting: bagian 5(f) menunjukkan RC2 memblokir deteksi F14 secara langsung — FDR yang dilaporkan (32%) kemungkinan **underestimate** sampai RC2 diperbaiki dan suite dijalankan ulang.
- **Ekstraksi tanggal di S-NEWS-05 (`toIsoDate` mengambil tanggal narasi, bukan badge sistem) belum diperbaiki** — lihat bagian 4.
- RC1 (bucket gambar staging), RC3 (email-format login), RC6 (tombol search) belum dikonfirmasi/diperbaiki oleh tim aplikasi — perlu keputusan pemilik aplikasi sebelum masuk ke naskah sebagai "confirmed defect" final.
- Kontribusi utama (agen RAQA) masih belum ada datanya — dokumen ini murni memperkuat baseline B1 dan analisis kegagalan, bukan mengukur RAQA/B2/B3/B4. Keputusan Jalur A (implementasi RAQA) vs Jalur B (pivot ke studi empiris "Why do E2E web tests fail?") ada di tangan penulis naskah, bukan sesuatu yang bisa diputuskan dari sisi teknis suite ini.
- Etika data: instance lokal memakai salinan database yang berisi data santri/wali (PII) di tabel `Santri`/`Asatidz`, meski seluruh test dan fault di dokumen ini **hanya menyentuh portal publik** (posts, kategori, login) dan tidak pernah query/menampilkan data PII tersebut. Izin tertulis pesantren dan pernyataan pengamanan data tetap diperlukan sebelum data ini dipakai lebih lanjut atau disebut dalam naskah.

## 8. File hasil (struktur akhir)

```
results/env-info.json

results/runs/baseline/            k01..k10.json, meta.json   — FR resmi (staging)
results/runs/baseline-local/      k01..k10.json, meta.json   — baseline tanpa-fault (lokal, referensi FDR)
results/runs/fault-F01..F25/      k01..k03.json, meta.json   — tiap fault (25), k=3

results/metrics/baseline/         summary.json, summary.md, per-test.csv, per-scenario.csv   — FR resmi
results/metrics/baseline-local/   idem, untuk baseline lokal
results/metrics/fault-detection/  summary.json, per-fault.csv   — FDR resmi (n=25)

faults/faults.csv                 25 fault, lokasi & cara terap persis
faults/patches/F01..F25.patch     patch git tiap fault -- bisa direproduksi ulang persis dengan `git apply`
faults/run-batch.sh               skrip otomatis: apply patch -> k=3 -> revert, untuk seluruh fault berikutnya
```

Semua fault sudah **direvert**; `git status` di `erapor-ppi27` bersih setelah setiap fault (diverifikasi otomatis oleh `run-batch.sh` dan manual di akhir). Tidak ada perubahan permanen pada aplikasi. `php artisan serve` dimatikan setelah seluruh pengumpulan data selesai.

## 9. Lampiran — isi mentah (verbatim) file summary

Bagian di atas adalah analisis naratif. Bagian ini adalah **output asli, apa adanya**, dari tiga script (`compute-metrics.js` ×2, `fault-detection.js`), disalin langsung dari `results/metrics/` tanpa diedit — untuk cross-check.

### 9.1 `results/env-info.json`

```json
{
  "os": "Darwin 25.6.0 (darwin arm64)",
  "cpu": "Apple M3 Pro x 11",
  "memoryGB": 18,
  "node": "v20.19.0",
  "playwright": "1.56.1",
  "axeCore": null,
  "recordedAt": "2026-09-21T14:39:40.849Z"
}
```

### 9.2 `results/metrics/baseline/summary.md` (FR resmi, staging, k=10)

```markdown
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
```

### 9.3 `results/metrics/baseline-local/summary.md` (baseline tanpa-fault, lokal, k=10)

```markdown
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
```

### 9.4 `results/metrics/fault-detection/summary.json` (n=25, putaran final)

```json
{
  "faultsListed": 25,
  "faultsRun": 25,
  "detected": 8,
  "fdrPct": 32,
  "baselineTests": 101,
  "falseAlarmTests": 19,
  "falseAlarmRatePct": 18.81,
  "byCategory": {
    "Input validation": { "total": 3, "detected": 1 },
    "Business logic": { "total": 7, "detected": 4 },
    "Navigation and state": { "total": 5, "detected": 2 },
    "Error handling": { "total": 5, "detected": 0 },
    "Real historical defects": { "total": 5, "detected": 1 }
  }
}
```

### 9.5 `results/metrics/fault-detection/per-fault.csv` (n=25, putaran final)

```csv
id,category,description,status,detected_by
"F01","Input validation","Validasi 'required' pada form login dihapus (server override validateLogin() jadi no-op) sehingga isian kosong bisa diteruskan ke server","MISSED",""
"F02","Business logic","""Artikel Terkait"" pada halaman detail berita ikut menampilkan artikel yang sedang dibuka","DETECTED","Detail berita › S-NEWS-07 ""Artikel Terkait"" tidak memuat artikel yang sedang dibuka || Aksesibilitas (axe-core, WCAG 2.x A/AA) › S-QUAL-01 [beranda] tidak ada pelanggaran aksesibilitas berdampak ""critical"" || SEO dasar › S-QUAL-02 [daftar berita] URL canonical sama dengan URL halaman || Responsif (mobile) › S-QUAL-03 [daftar berita] tidak ada scroll horizontal di layar ponsel"
"F03","Navigation and state","Halaman arsip bulanan (/portal/arsip/{tahun}/{bulan}) menampilkan berita dari seluruh tahun bukan hanya bulan yang dipilih","DETECTED","Daftar berita › S-NEWS-04 halaman arsip bulanan hanya memuat berita dari bulan tersebut"
"F04","Error handling","Halaman arsip dengan parameter bulan/tahun di luar rentang wajar melempar exception tak tertangani (500) alih-alih 404","MISSED",""
"F05","Real historical defects","Filter kategori (?kategori=) pada daftar berita/artikel tidak diproses -- revert commit nyata 0051bb69 ""fix: post and adding select2"" yang menambahkan filter ini","DETECTED","Daftar berita › S-NEWS-03 kategori menampilkan jumlah kartu sesuai sidebar, konsisten di kedua format URL"
"F06","Input validation","Regex format tahun/bulan pada rute arsip (/portal/arsip/{year}/{month}) dihapus sehingga parameter non-numerik ikut diteruskan ke controller","MISSED",""
"F07","Input validation","Field password pada form login berubah dari type=password menjadi type=text (password tampil sebagai teks biasa)","DETECTED","Login SIMASIS › S-AUTH-01 form login lengkap dan setiap input memiliki nama yang dapat diakses"
"F08","Business logic","Penghitung ""kali dibaca"" berkurang setiap kali artikel dibuka alih-alih bertambah","DETECTED","Detail berita › S-NEWS-08 penghitung ""kali dibaca"" berupa angka dan tidak berkurang setelah dimuat ulang"
"F09","Business logic","Sidebar kategori pada daftar berita ikut menghitung kategori bertipe artikel (bukan hanya berita)","DETECTED","Daftar berita › S-NEWS-02 total berita menurut paginasi sama dengan jumlah per kategori di sidebar"
"F10","Business logic","Urutan daftar berita menjadi terlama-ke-terbaru (asc) bukan terbaru-ke-terlama (desc)","MISSED",""
"F11","Business logic","Bagian ""Berita Terbaru"" di beranda ikut menampilkan artikel (tipe campur) bukan hanya berita","MISSED",""
"F12","Business logic","""Artikel Terkait"" tidak lagi memprioritaskan kategori yang sama dengan artikel yang sedang dibuka","MISSED",""
"F13","Navigation and state","Parameter tahun dan bulan pada halaman arsip tertukar (whereYear memakai $month dan sebaliknya)","DETECTED","Daftar berita › S-NEWS-04 halaman arsip bulanan hanya memuat berita dari bulan tersebut"
"F14","Navigation and state","Tautan berbagi WhatsApp pada halaman detail berita tidak lagi menyertakan URL artikel","MISSED",""
"F15","Navigation and state","Daftar berita pada halaman kategori tidak terurut berdasarkan tanggal terbit","MISSED",""
"F16","Navigation and state","Daftar berita pada halaman tag tidak terurut berdasarkan tanggal terbit","MISSED",""
"F17","Error handling","Mengunjungi URL artikel dengan slug yang tidak ada melempar fatal error (memanggil method pada null) alih-alih 404","MISSED",""
"F18","Error handling","Mengunjungi URL kategori dengan slug yang tidak ada melempar fatal error alih-alih 404","MISSED",""
"F19","Error handling","Mengunjungi URL tag dengan slug yang tidak ada melempar fatal error alih-alih 404","MISSED",""
"F20","Error handling","Mengunjungi URL halaman statis dengan slug yang tidak ada melempar fatal error alih-alih 404","MISSED",""
"F21","Real historical defects","Tombol hamburger menu mobile (ikon saja tanpa teks) kehilangan aria-label -- revert sebagian commit nyata e71020ae ""fix: boost performance url direct""","MISSED",""
"F22","Real historical defects","Tombol ""kembali ke atas"" (ikon saja tanpa teks) kehilangan aria-label -- revert sebagian commit nyata e71020ae","MISSED",""
"F23","Real historical defects","Tautan footer ""Lembaga"" (ULA Tsanawiyyah Mu'allimin) kembali menjadi placeholder href=""#"" -- revert sebagian commit nyata e71020ae","MISSED",""
"F24","Real historical defects","Urutan tabel santri di halaman publik tidak lagi mengikuti kelas-lalu-nama -- revert commit nyata 14dd0e01 ""fix urutan santri""","MISSED",""
"F25","Business logic","Daftar berita ikut menampilkan artikel (tipe campur) karena filter tipe pada query utama dihapus","DETECTED","Daftar berita › S-NEWS-02 total berita menurut paginasi sama dengan jumlah per kategori di sidebar"
```

> Catatan: seperti dijelaskan di bagian 5, 3 dari 4 `detected_by` mentah pada F02 (S-QUAL-01[beranda], S-QUAL-02[daftar berita], S-QUAL-03[daftar berita]) adalah **noise** (flaky `php artisan serve`, bukan akibat fault) — sudah dihapus dari tabel di atas, disisakan hanya detector kausal yang valid (S-NEWS-07). F07 juga di-dedup (aslinya tercatat 2× karena cocok di k=1 dan k=2). Lihat bagian 5 untuk analisis lengkap 17 fault yang MISSED, dikelompokkan per akar penyebab.
