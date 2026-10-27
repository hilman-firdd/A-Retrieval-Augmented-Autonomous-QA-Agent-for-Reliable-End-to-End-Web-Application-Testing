# RAQA dan ppi27-e2e — repositori replikasi

Repositori ini berisi semua bahan untuk naskah
**"Offline Human Review Reveals Overstated Success and Confidence Signals in an LLM Web Testing Agent"**
(versi JUITA, 27 Oktober 2026). Naskah ini adalah studi kasus tentang agen pengujian E2E berbasis LLM (RAQA) pada
SIMASIS, aplikasi Laravel milik Pesantren Persatuan Islam 27 Situaksan, Bandung.

**Mulai dari sini:**

| Kebutuhan | Buka |
|---|---|
| Menghitung ulang setiap angka, tabel, dan gambar di naskah | [`REPLICATION.md`](REPLICATION.md) |
| Ringkasan hasil yang sudah selaras dengan naskah | [`raqa/HASIL-HITL-ABLASI.md`](raqa/HASIL-HITL-ABLASI.md) |
| Daftar klaim naskah beserta file dan perintah pengeceknya | [`manuscript-claims-verification.md`](manuscript-claims-verification.md) |
| Rencana eksperimen sebelum run (pre-registrasi) | [`raqa/EKSPERIMEN-HITL-ABLASI.md`](raqa/EKSPERIMEN-HITL-ABLASI.md), `scenarios/prereg-ablation.json`, `scenarios/ground-truth.json` (commit `7b08f79`) |
| Rincian baseline suite B1 (kalibrasi, flakiness, fault) | [`result.md`](result.md) |
| Rancangan dan riwayat pengembangan agen (pilot) | [`RAQA.md`](RAQA.md) |

Dokumen `RAQA.md`, `result.md`, dan bagian bawah README ini ditulis sebelum naskah final. Isinya tetap disimpan
sebagai catatan proses, dan setiap dokumen diberi catatan status di bagian atasnya. Bila ada perbedaan, yang berlaku
adalah naskah dan `raqa/HASIL-HITL-ABLASI.md`.

## Ringkasan studi

- **Baseline suite B1** (Playwright, 31 skenario, 101 test tanpa akun): 11,88% flaky di staging dan 0,99% di lokal
  (McNemar eksak p = 0,0034); menemukan 8 dari 25 fault yang ditanam.
- **Agen RAQA** (Qwen3 4B lokal, retrieval BM25 + dense dengan RRF, gate eskalasi): enam konfigurasi pada 17 skenario
  pra-registrasi, masing-masing satu run untuk analisis utama. Uji ketahanan yang tidak dipra-registrasi mengulang
  keenam konfigurasi tiga kali dengan Qwen3 4B dan tiga kali dengan Qwen3 8B (`raqa/review/analysis-repeats.md`).
- **Review offline** oleh tiga praktisi QA yang tidak membangun SIMASIS atau agen: 70 langkah unik dan 22 skrip,
  tanpa melihat konfigurasi, skor gate, atau unit yang dikutip.
- **Temuan utama:** status "selesai" agen biasanya terkonfirmasi, tetapi jarang mencakup semua kriteria penerimaan;
  kesepakatan gate dengan penilai berasal dari satu aturan yang menolak assertion self-referential, bukan dari tiga
  sinyal keyakinannya.

## Struktur repositori

```
README.md, REPLICATION.md          titik masuk dan peta replikasi
playwright.config.js, src/, tests/ baseline suite B1 (retries 0, implicit oracle di src/fixtures.js)
scenarios/                         katalog 31 skenario, 17 skenario pra-registrasi, ground truth
scripts/                           run-repeated, compute-metrics, fault-detection, env-info
results/                           log run B1 dan ringkasan metrik
faults/                            daftar 25 fault (faults.csv) dan patch-nya (lihat catatan di REPLICATION.md)
raqa/src/                          agen: prompt dan gate (agent.js), retrieval, skor locator, oracle, stub reviewer
raqa/scripts/                      runner ablasi, ekspor item review, analyze-hitl.js, compare_runs.py
raqa/runs/abl-A0 … abl-A7/         log per langkah (skor c_act, c_loc, c_orc, c_t, keputusan gate, jawaban stub)
raqa/review/                       rating anonim R1–R3, kunci item, analysis.md/json
reanalysis/                        skrip analisis untuk naskah revisi (gate, reliabilitas, endpoint, gambar, trace)
appendix/                          tabel penelusuran keberhasilan dan dua contoh trace
```

Kode dan database SIMASIS tidak publik. Angka di naskah bisa dihitung ulang dari log dan rating di repo ini, tetapi
agen dan suite tidak bisa dijalankan ulang tanpa aplikasinya.

---

# Panduan baseline suite B1 (catatan proses)

> Bagian di bawah ini adalah panduan kerja awal untuk suite B1. Kalibrasi, pengukuran flakiness (k = 10 di staging dan
> lokal), dan fault seeding (25 fault) sudah selesai; hasilnya ada di `result.md` dan Tabel I–II naskah.

Suite E2E berbasis **Playwright + JavaScript** untuk `staging.pesantrenpersis27.com`. Suite ini dipakai untuk dua hal:

1. **Baseline B1** pada naskah: data flakiness dan deteksi fault (Tabel I, Tabel II, dan RQ1 naskah).
2. **Fondasi eksekutor RAQA.** Page object, prioritas locator, implicit oracle, dan katalog skenario di sini dipakai
   ulang oleh agen.

| Angka di naskah | Sumber |
|---|---|
| Tabel I (stable-pass, stable-fail, flaky, FR per test dan per skenario) | `results/metrics/baseline/summary.json`, `results/metrics/baseline-local/summary.json` |
| McNemar staging vs lokal | `python3 -I reanalysis/baseline_mcnemar.py` |
| Tabel II (19 kegagalan di lokal tanpa fault) dan κ = 0,648 | `raqa/review/h0-sheet-R2.csv`, `raqa/review/h0-final-overrides.csv`, `node raqa/scripts/h0-failure-classification.js analyze raqa/review/h0-sheet-R2.csv` |
| Deteksi fault 8/25 per kategori | `results/metrics/fault-detection/summary.json`, `per-fault.csv` |
| Versi Node.js dan Playwright | `results/env-info.json` |

Hasil suite ini adalah pembanding, bukan sistem yang diusulkan. Agen **tidak** dijalankan pada fault yang ditanam,
jadi tidak ada perbandingan deteksi fault antara agen dan suite.

Suite ini disusun dengan bantuan AI lalu ditinjau dan dikalibrasi oleh penulis pertama terhadap aplikasi. Hal ini
sudah dinyatakan di naskah (Method dan pernyataan penggunaan AI).

## 1. Instalasi

Prasyarat: Node.js ≥ 18 (studi memakai 20.19.0) dan Playwright 1.56.1.

```bash
npm install
npx playwright install --with-deps chromium   # tambah firefox webkit bila ALL_BROWSERS=1
cp .env.example .env                           # Windows PowerShell: copy .env.example .env
```

Isi `.env` sesuai kebutuhan (lihat komentar di dalamnya). Kredensial SIMASIS bersifat **opsional**; tanpa kredensial,
skenario S-AUTH-04 otomatis dilewati. Pada studi ini 101 dari 107 test dijalankan (6 dilewati: S-AUTH-04 tanpa
kredensial dan 5 test S-QUAL-03 yang hanya relevan untuk tampilan mobile), dari 30 skenario. Jika diisi, gunakan
**akun khusus uji**, jangan akun asatidz, santri, atau orang tua sungguhan. File `.env` sudah masuk `.gitignore`.

## 2. Kalibrasi (sudah dilakukan)

```bash
npm run test:smoke          # cepat, cek koneksi dan halaman utama
npx playwright test         # seluruh suite satu kali
npm run report              # buka laporan HTML
```

Setiap test yang gagal pada putaran pertama dikelompokkan menjadi: selector perlu disesuaikan, ekspektasi test keliru,
atau cacat aplikasi sungguhan. Hasil triase final (setelah rater kedua) ada di Tabel II naskah: 5 test menunjukkan cacat
produk (4 penyebab), 13 cacat test, 1 timing. Versi suite dibekukan sebelum pengukuran.

## 3. Mengukur flakiness (FR)

```bash
node scripts/run-repeated.js --k 10 --label baseline
node scripts/compute-metrics.js --label baseline
node scripts/env-info.js
```

- `retries` sengaja **0** di konfigurasi. Retry otomatis menyembunyikan flakiness.
- Setiap run adalah proses terpisah (`k01`–`k10`), sehingga mirip eksekusi CI.
- Worker default 2. Jalankan di luar jam sibuk agar tidak membebani staging.
- Efek samping di staging: penghitung "kali dibaca" bertambah, dan ada satu percobaan login gagal per run.

Output di `results/metrics/baseline/`: `summary.md` / `summary.json`, `per-test.csv`, `per-scenario.csv`.

## 4. Mengukur deteksi fault

**Jangan menanam fault di staging yang dipakai orang lain.** Jalankan aplikasi di instance lokal/terpisah
(misalnya `php artisan serve` dengan salinan database) dan arahkan `BASE_URL` ke sana.

1. Daftar fault ada di `faults/faults.csv` (25 fault: 20 fault baru dalam empat kategori perilaku dan 5 cacat
   historis yang dimunculkan kembali dengan membalik perbaikannya).
2. Jalankan baseline pada versi **tanpa fault** (langkah 3) di instance yang sama.
3. Untuk setiap fault: terapkan satu fault saja, lalu jalankan `node scripts/run-repeated.js --k 3 --label fault-F01`,
   kembalikan kodenya, dan ulangi untuk fault berikutnya (`faults/run-batch.sh`).
4. Hitung hasilnya: `node scripts/fault-detection.js`.

Kriteria deteksi: sebuah fault dianggap terdeteksi bila ada test yang **stabil lulus di baseline** dan gagal pada
mayoritas run versi ber-fault.

## 5. Tag test

Tag: `@smoke` (cepat), `@regression`, `@mobile` (juga dijalankan di Pixel 7), `@a11y`, `@seo`, `@chromium-only`.

---

<!--
PENTING: bagian "Temuan awal" di bawah ini adalah salah satu sumber retrieval agen (6 catatan cacat,
dibaca oleh raqa/src/sources/local.js mulai dari judul bagian itu sampai akhir berkas).
Jangan mengubah isinya, jangan menambah teks di bawahnya, dan jangan menulis judul bagian yang sama di atas.
Status terkini T1–T5 ada di result.md bagian 6 (misalnya T3 ternyata bukan bug).
-->

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
