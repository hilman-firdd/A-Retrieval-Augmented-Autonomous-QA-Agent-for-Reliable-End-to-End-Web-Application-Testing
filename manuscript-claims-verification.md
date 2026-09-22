# Verifikasi klaim naskah terhadap data mentah — hanya bagian B1 (baseline)

Dokumen ini memeriksa **setiap angka dan pernyataan faktual yang sudah tertulis** (bukan placeholder `[...]`) di 8 potongan naskah yang dikirim, lalu mencocokkannya satu per satu dengan file data mentah di `results/`. Setiap baris di bawah mencantumkan **perintah/file yang dipakai untuk mengecek ulang**, supaya bisa direproduksi. Placeholder yang belum diisi (`[X]`, `[Y]`, `[m]`, dst.) **tidak saya isi** — dijelaskan terpisah di bagian akhir kenapa tidak bisa.

## Ringkasan status

| Bagian naskah | Jumlah klaim terperiksa | Cocok | Tidak cocok / perlu perhatian |
|---|---|---|---|
| Abstract (statistik B1) | 4 | 4 | 1 (lihat **PERINGATAN** di bawah) |
| RQ1 — rincian flaky staging | 4 | 4 | 0 |
| RQ1 — 6 dari 19 cacat nyata | 2 | 2 | 0 |
| RQ3 — Tabel 6 (FDR 5-fault) | 6 | 6 | 0 |
| 4.7 Implementation — lingkungan | 4 | 4 | 0 |
| Ethics — data pribadi lokal | 1 | 1 | 0 |

---

## 1. Abstract

> "a conventional Playwright suite of 101 tests had a flakiness rate of 11.88% on the staging server and 0.99% on a local instance"

✅ **COCOK**. Sumber: `results/metrics/baseline/summary.json` → `"total": 101, "flakinessRatePct": 11.88`; `results/metrics/baseline-local/summary.json` → `"total": 101, "flakinessRatePct": 0.99`.

> "and detected 3 of 5 seeded faults"

⚠️ **COCOK untuk n=5, TAPI SUDAH TIDAK MUTAKHIR.** Diverifikasi ulang barusan (lihat bagian 4) — 3 dari 5 fault ORISINAL (F01–F05) memang terdeteksi (F02, F03, F05), sesuai naskah. **Tapi** sejak sesi ini juga memperluas FDR ke 25 fault (atas permintaan Anda sebelumnya, menindaklanjuti evaluasi manuskrip yang bilang CI 95% untuk n=5 terlalu lebar/tidak informatif), `results/metrics/fault-detection/summary.json` **saat ini** berisi **25 fault, 8 terdeteksi (32%, CI 95% 17.2–51.6%)** — bukan lagi 5/3/60%. Naskah yang dikirim ke saya masih memakai angka lama. **Ini bukan salah saya membaca data — ini pertanyaan keputusan Anda**: apakah naskah mau tetap melaporkan studi n=5 (dan n=25 jadi studi lanjutan terpisah), atau di-update total ke n=25. Saya tidak mengubah naskah, hanya melaporkan status ini.

> "only 6 of the 19 tests that failed on the fault-free version revealed real defects"

✅ **COCOK**. Sumber: dihitung ulang dari `results/runs/baseline-local/k01..k10.json` via `scripts/lib-results.js` — 18 stable-fail + 1 flaky = 19 test gagal total; setelah ditelusuri manual per test (bagian 3 `result.md`), tepat 6 di antaranya (S-AUTH-03, S-HOME-05[mobile], S-LINK-02, S-QUAL-01[daftar berita], S-QUAL-01[artikel santri], S-QUAL-02[login]) adalah cacat aplikasi nyata; 13 sisanya adalah cacat selector test (RC2, 10 test) atau cacat ekstraksi tanggal di test itu sendiri (2 test) atau flakiness murni (1 test).

---

## 2. RQ1 — rincian penyebab flaky di staging (halaman "The implicit check therefore failed...")

> "The implicit check therefore failed 22 tests in every run and 5 tests in some runs, depending on whether the broken image request finished before the test ended."

✅ **COCOK PERSIS**. Dihitung ulang dari `results/runs/baseline/k01..k10.json`: 22 test stable-fail dengan error `Implicit oracle...` (gambar 403 dari bucket staging), 5 test flaky (verdict campuran pass/fail) dengan error yang sama.

> "The other 7 flaky tests on staging were page loads that timed out after 30 seconds, although the same pages loaded in under one second when requested directly."

✅ **COCOK**. 7 test flaky sisanya (dari 12 total flaky) bererror `TimeoutError: page.goto: Timeout 30000ms exceeded` atau `Error: status HTTP ...` pada URL `/portal/halaman/*` dan `S-AUTH-01`. Klaim "loaded in under one second when requested directly" sesuai temuan `curl` manual sebelumnya di sesi ini (bagian 4 `result.md`, RC7).

> "We attribute them to the limited capacity of the staging server under parallel tests. None of these failures is caused by the application code."

Ini kesimpulan interpretatif (bukan angka), konsisten dengan data di atas — tidak ada satu pun dari 12 test flaky staging yang errornya berupa assertion aplikasi (semua `TimeoutError`/`Implicit oracle` infra-level).

---

## 3. RQ1 — "5 distinct causes" untuk 6 cacat nyata

> "The most serious one concerns login: when a user types an e-mail address with a wrong password, the page shows no error message. The controller renames the validated field to email, but the page only displays errors for username and password."

✅ **COCOK PERSIS**, dan ini deskripsi akurat dari akar penyebab yang saya temukan lewat pembacaan kode (`LoginController::username()` vs `login.blade.php`) dan verifikasi manual (login dengan username biasa → pesan muncul; login dengan format email → pesan hilang), dua kali di dua lingkungan (staging & lokal).

> "The other defects were a link to the admission site that uses HTTP instead of HTTPS, a canonical URL on the login [page pointing to home]..."

✅ **COCOK**, sesuai RC4 dan RC5.

**5 penyebab berbeda** untuk 6 test (dihitung ulang): (1) email-format login tanpa pesan error, (2) link PSB HTTP, (3) canonical login salah, (4) tombol search tanpa nama aksesibel (1 penyebab, 2 test: daftar berita + artikel santri), (5) klik kartu berita ke-intercept elemen lain di mobile. ✅ **COCOK** dengan "5 distinct causes".

---

## 4. RQ3 — Tabel 6 (fault seeding, kolom B1)

Dihitung ulang **langsung dari file run mentah** `results/runs/fault-F01..F05/` (bukan dari file `summary.json` yang sekarang sudah berisi 25 fault), pakai baseline lokal sebagai detector:

| ID | Klaim naskah | Hasil hitung ulang | Cocok? |
|---|---|---|---|
| F01 | Missed | MISSED | ✅ |
| F02 | Detected — "caught by the test that checks that the current article is not listed" | DETECTED oleh S-NEWS-07 ("Artikel Terkait tidak memuat artikel yang sedang dibuka") | ✅ |
| F03 | Detected — "the archive fault by the test that checks that all dates belong to the selected month" | DETECTED oleh S-NEWS-04 ("halaman arsip bulanan hanya memuat berita dari bulan tersebut") | ✅ |
| F04 | Missed | MISSED | ✅ |
| F05 | Detected — "the real historical defect by the test that compares the two URL forms of a category page" | DETECTED oleh S-NEWS-03 ("kategori ... konsisten di kedua format URL") | ✅ |
| FDR total | 60% | 3/5 = 60% | ✅ |

Semua 6 klaim di tabel ini **cocok persis**, termasuk deskripsi *bagaimana* tiap fault tertangkap (nama test dan alasan spesifik yang disebut di teks naskah).

---

## 5. Bagian 4.7 Implementation — lingkungan eksekusi

> "All runs used a MacBook with an Apple M3 Pro (11 cores, 18 GB RAM, macOS 26), Node.js 20.19.0, and Playwright 1.56.1 with Chromium."

✅ **COCOK PERSIS**. Sumber: `results/env-info.json` → `"cpu": "Apple M3 Pro x 11", "memoryGB": 18, "node": "v20.19.0", "playwright": "1.56.1"`. `"os": "Darwin 25.6.0"` konsisten dengan penomoran versi macOS 26 (Darwin 25.x = generasi macOS Tahoe/26).

---

## 6. Etika — data pribadi di instance lokal

> "The local instance used a copy of production data that includes personal data of students and staff"

✅ **COCOK**. Database lokal `simasis27prod2` memang berisi tabel `Santri` dan `Asatidz` dengan kolom PII (nama lengkap, tempat/tanggal lahir, nama orang tua, dll — sudah diperiksa strukturnya di sesi sebelumnya). **Yang perlu digarisbawahi**: seluruh test dan fault yang dijalankan di dokumen ini **hanya menyentuh portal publik** (posts, kategori, login) — tidak pernah query atau menampilkan isi tabel `Santri`/`Asatidz`. Ini sudah dicatat di `result.md` bagian 7.

---

## 7. Placeholder yang TIDAK saya isi, dan kenapa

Bagian-bagian berikut di naskah masih `[...]` dan **sengaja tidak saya isi** karena mengisinya tanpa data sungguhan akan jadi halusinasi:

- **`[X]`, `[Y]`, `[Z]` di Abstract, seluruh Tabel 5 (TSR/FR/FDR/HAR untuk B2–B4 dan RAQA), RQ2–RQ5, bagian 6.1 "[After the RAQA experiments...]"** — semuanya butuh **agen RAQA yang belum diimplementasikan**. Tidak ada kode RAQA di direktori manapun yang saya akses sepanjang sesi ini (`ppi27-e2e` hanya berisi suite Playwright B1). Sesuai keputusan Jalur A/B yang sudah dibahas sebelumnya.
- **`[m]`, `[c]`, `[report values]` di rumus retrieval (Bagian 3)** — ini parameter desain RAQA (jumlah unit yang di-*rerank*, ukuran konteks, bobot `φ_str`/`φ_vol`), bukan angka yang diukur dari eksperimen. Harus ditentukan penulis sebagai keputusan desain, bukan "dibuktikan" dari data.
- **`[5]%` di audit sampel acak** — sudah terisi kuning (kemungkinan draf penulis), bukan blank kosong; saya tidak menyentuhnya.
- **`[describe the safeguards...]`, `[State ethical approval...]`, `[confirm]`, `[names]`, `[Funding agency...]`, `[tool name and version]`, `[describe exactly how...]`, `[State how this was handled...]`, `[URL or DOI]`** — semuanya keputusan institusional/administratif (izin pesantren, persetujuan etik, nama reviewer, pendanaan, tautan repositori publik) yang hanya bisa diisi oleh Anda/pesantren, bukan dari data teknis yang saya punya.
- **`[describe...]` di Threats to Validity (bias penulis merangkap developer)** — ini butuh pernyataan reflektif penulis, bukan angka.

## 8. Rekomendasi konkret

1. **Putuskan versi FDR mana yang dipakai naskah**: n=5 (seperti sekarang, konsisten dengan draf yang dikirim) atau n=25 (CI jauh lebih sempit, 17.2–51.6% vs 23–88%, sudah tersedia lengkap di `result.md` bagian 5). Kalau pakai n=25, Tabel 6 dan angka FDR di Abstract/RQ3 perlu direvisi total (25 baris, bukan 5).
2. Semua nilai lain yang sudah tertulis di naskah (bukan placeholder) **terverifikasi akurat 100%** terhadap data mentah — aman dipakai apa adanya.
