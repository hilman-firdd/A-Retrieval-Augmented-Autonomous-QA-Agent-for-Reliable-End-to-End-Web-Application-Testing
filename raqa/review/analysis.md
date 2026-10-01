## Tabel H1 — Reliabilitas antar-reviewer

Reviewer: 3; item langkah: 70.

| Dimensi | Skala | Krippendorff α | 95% CI (bootstrap) |
|---|---|---|---|
| R1 Relevansi | ordinal (0/1/2) | 0.618 | [0.474, 0.743] |
| R2 Kebenaran ekspektasi | nominal (yes/no) | 0.296 | [0.149, 0.429] |
| R3 Keputusan | nominal (accept/edit/reject) | 0.481 | [0.355, 0.603] |

Fleiss κ (R3, item lengkap): 0.479

## Tabel H2 — Kualitas langkah per konfigurasi (konsensus reviewer)

| Konfigurasi | Langkah | Diterima reviewer (accept) | Relevansi = 0 (tak relevan/tautologi) | Dieskalasi gate |
|---|---|---|---|---|
| A0 | 22 | 52.4% [32.4%, 71.7%] | 40.9% | 59.1% |
| A1 | 16 | 46.7% [24.8%, 69.9%] | 43.8% | 100.0% |
| A2 | 24 | 47.8% [29.2%, 67.0%] | 45.8% | 58.3% |
| A3 | 22 | 57.1% [36.5%, 75.5%] | 36.4% | 59.1% |
| A6 | 25 | 45.8% [27.9%, 64.9%] | 44.0% | 48.0% |
| A7 | 24 | 60.9% [40.8%, 77.8%] | 33.3% | 54.2% |

Accept = konsensus mayoritas "accept"; item tanpa mayoritas tidak dihitung pada kolom accept.

## Tabel H3 — Keputusan gate vs penilaian manusia (A0)

| | Manusia: accept | Manusia: edit/reject |
|---|---|---|
| Gate: lolos otomatis | 9 | 0 |
| Gate: dieskalasi | 2 | 10 |

- Cohen κ (gate vs manusia): 0.811
- Recall eskalasi, P(dieskalasi | manusia tidak menerima): 100.0% [72.2%, 100.0%]
- Presisi eskalasi, P(manusia tidak menerima | dieskalasi): 83.3%
- Galat lolos-otomatis, P(manusia tidak menerima | lolos otomatis): 0.0% [0.0%, 29.9%]

## Tabel A1 — Studi ablasi (tingkat skenario, n = 17 skenario)

| Konfigurasi | TSR otomatis | TSR terverifikasi | Δ vs A0 [95% CI] | p (McNemar, Holm) | Cakupan kriteria | Δ cakupan [95% CI] | p (Wilcoxon, Holm) | "Selesai" palsu | Cacat tertutupi |
|---|---|---|---|---|---|---|---|---|---|
| A0 (acuan) | 29.4% | 29.4% | — | — | 15.7% | — | — | 0 | 0 |
| A1 | 0.0% | 0.0% | -29.4 pp [-52.9, -11.8] | 0.313 | 0.0% | -15.7 pp [-30.4, -4.9] | 0.313 | 0 | 0 |
| A2 | 29.4% | 17.6% | -11.8 pp [-29.4, 0.0] | 1.000 | 17.6% | 2.0 pp [-7.8, 15.7] | 1.000 | 2 | 0 |
| A3 | 29.4% | 29.4% | 0.0 pp [0.0, 0.0] | 1.000 | 15.7% | 0.0 pp [0.0, 0.0] | 1.000 | 0 | 0 |
| A6 | 29.4% | 35.3% | 5.9 pp [0.0, 17.6] | 1.000 | 18.6% | 2.9 pp [0.0, 8.8] | 1.000 | 0 | 0 |
| A7 | 35.3% | 35.3% | 5.9 pp [0.0, 17.6] | 1.000 | 21.6% | 5.9 pp [0.0, 17.6] | 1.000 | 0 | 0 |

TSR terverifikasi = vonis benar: skenario harus-PASS diselesaikan dengan cakupan "full"/"partial" menurut konsensus reviewer; skenario harus-FAIL divonis FAIL lewat assertion yang dinilai relevan (skor 2).
"Selesai" palsu = agen menyatakan selesai tetapi konsensus reviewer menilai "none" (tidak ada kriteria teruji).
Cacat tertutupi = skenario yang seharusnya FAIL (cacat nyata, lihat ground-truth.json) tetapi agen memvonis PASS.
Ground truth: 4 skenario harus FAIL (S-AUTH-03, S-LINK-02, S-QUAL-01, S-QUAL-02).
Δ dan CI: selisih terhadap acuan, CI 95% bootstrap dengan resampling skenario. p disesuaikan Holm atas semua konfigurasi.

Reliabilitas skenario: cakupan per-kriteria α = 0.720, penilaian keseluruhan α (ordinal) = 0.321.

## Tabel A1-S — Sensitivitas: deteksi cacat butuh ekspektasi benar

Definisi ini ditetapkan SETELAH data terlihat, sehingga dilaporkan sebagai analisis sensitivitas, bukan hasil utama. Skenario harus-FAIL dihitung benar hanya bila assertion yang gagal dinilai relevan (R1 = 2) DAN ekspektasinya benar (konsensus R2 = yes).

| Konfigurasi | TSR terverifikasi (utama) | TSR terverifikasi (sensitivitas) | Δ sensitivitas vs A0 [95% CI] | p (McNemar, Holm) |
|---|---|---|---|---|
| A0 (acuan) | 29.4% | 29.4% | — | — |
| A1 | 0.0% | 0.0% | -29.4 pp [-52.9, -11.8] | 0.313 |
| A2 | 17.6% | 17.6% | -11.8 pp [-29.4, 0.0] | 1.000 |
| A3 | 29.4% | 29.4% | 0.0 pp [0.0, 0.0] | 1.000 |
| A6 | 35.3% | 29.4% | 0.0 pp [0.0, 0.0] | 1.000 |
| A7 | 35.3% | 35.3% | 5.9 pp [0.0, 17.6] | 1.000 |
