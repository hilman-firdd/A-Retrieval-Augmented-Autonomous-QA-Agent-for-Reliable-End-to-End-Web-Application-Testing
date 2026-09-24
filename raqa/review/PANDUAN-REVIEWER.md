# Panduan Reviewer — Penilaian Langkah dan Skrip Pengujian

Terima kasih sudah bersedia menjadi reviewer. Anda akan menilai langkah-langkah pengujian otomatis untuk
portal web SIMASIS. Langkah-langkah ini dihasilkan oleh beberapa varian sistem yang berbeda. **Anda tidak
diberi tahu varian mana yang menghasilkan langkah mana**, dan itu disengaja: nilailah setiap langkah apa adanya.

Perkiraan waktu: ±1 menit per langkah, ±2 menit per skenario. Boleh dikerjakan dalam dua sesi.
Kerjakan **sendiri-sendiri**; jangan berdiskusi dengan reviewer lain sampai semua penilaian selesai.

## Yang Anda terima

| File | Isi |
|---|---|
| `step-sheet.csv` | Satu baris per langkah yang diusulkan |
| `scenario-sheet.csv` | Satu baris per skenario: kumpulan assertion yang akhirnya dijalankan |
| `shots/` | Screenshot halaman saat langkah diusulkan |

Setiap baris memuat **goal** skenario dan **acceptance criteria**-nya. Acceptance criteria adalah acuan
kebenaran Anda, **bukan** apa yang kebetulan tampil di halaman.

## Bagian A — Menilai langkah (`step-sheet.csv`)

Isi tiga kolom untuk setiap baris.

### R1 — Relevansi (`0`, `1`, atau `2`)

| Nilai | Arti | Contoh (goal: "tombol Daftar PSB menuju situs PSB via HTTPS") |
|---|---|---|
| **2** | Langsung memeriksa salah satu acceptance criteria | Check that link "Daftar PSB" has attribute href containing "https://psb.pesantrenpersis27.com" |
| **1** | Langkah persiapan yang berguna (navigasi, membuka menu) tapi belum memeriksa kriteria | Click link "INFO PSB" |
| **0** | Tidak relevan dengan goal, atau **selalu benar sehingga tidak menguji apa pun** | Check that the page title contains "Portal" (untuk goal login) |

> **Perhatikan assertion yang "selalu benar".** Contoh nyata: untuk goal *"kredensial salah ditolak dengan pesan jelas"*,
> langkah *"Check that textbox Password has attribute type containing password"* bernilai **0**. Field password
> selalu bertipe password, apa pun kredensialnya, jadi langkah ini tidak menguji penolakan kredensial.

### R2 — Kebenaran ekspektasi (`yes`, `no`, atau `unsure`)

Apakah **nilai yang diharapkan** sesuai dengan acceptance criteria?
- `yes`: ekspektasinya benar menurut kriteria.
- `no`: ekspektasinya salah atau bertentangan dengan kriteria (mis. mengharapkan `http://` padahal kriteria meminta `https://`).
- `unsure`: tidak bisa dipastikan dari informasi yang ada. Gunakan seperlunya.

Untuk langkah navigasi (R1 = 1) yang tidak memuat ekspektasi, isi `yes` bila langkahnya masuk akal untuk mencapai goal.

### R3 — Keputusan (`accept`, `edit`, atau `reject`)

Bayangkan Anda QA engineer yang me-review langkah ini sebelum masuk ke suite regresi.
- `accept`: layak dipakai apa adanya.
- `edit`: berguna, tetapi perlu diubah (tulis perubahannya di `comment`).
- `reject`: tidak layak dipakai.

## Bagian B — Menilai skenario (`scenario-sheet.csv`)

Setiap baris berisi daftar assertion yang dijalankan untuk satu skenario.

- **`covered_criteria_numbers`**: nomor acceptance criteria yang **benar-benar diuji** oleh assertion tersebut, dipisah koma (mis. `1,3`). Kosongkan bila tidak ada.
- **`overall_full_partial_none`**: `full` bila semua kriteria teruji, `partial` bila sebagian, `none` bila tidak ada.
- **`tautology_yes_no`**: `yes` bila ada assertion yang selalu benar (lihat contoh di atas).

## Aturan penting

1. Nilai berdasarkan **acceptance criteria**, bukan tebakan tentang maksud sistem.
2. Jangan mencoba menebak varian mana yang menghasilkan sebuah langkah.
3. Bila ragu antara dua nilai, pilih yang lebih ketat (mis. antara 1 dan 2, pilih 1).
4. Jangan mengubah kolom selain kolom penilaian dan `comment`.
5. Simpan dengan nama `step-ratings-<inisial>.csv` dan `scenario-ratings-<inisial>.csv`.

Semua langkah dan skrip berasal dari **portal publik**. Tidak ada data pribadi santri, asatidz, atau orang tua
di dalam bahan penilaian ini.
