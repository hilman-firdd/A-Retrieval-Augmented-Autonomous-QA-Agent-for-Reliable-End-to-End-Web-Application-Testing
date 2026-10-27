# Stabilitas antar-pengulangan dan perbandingan model

Dihasilkan oleh `scripts/analyze-repeats.js`. Satu pengulangan = keenam konfigurasi pada 17 skenario pre-registrasi.

## Model 4b: qwen3:4b (pengulangan: abl, abl4b-r2, abl4b-r3)

| Konfigurasi | Pengulangan | TSR otomatis per pengulangan | Rata-rata | Skenario dengan hasil sama di semua pengulangan | Skenario dengan langkah identik | Error model (timeout/parse) | Error infrastruktur (dikeluarkan) | Menit per pengulangan |
|---|---|---|---|---|---|---|---|---|
| A0 | 3 | 29.4% / 29.4% / 29.4% | 29.4% | 17/17 | 15/17 | 0 / 0 / 1 | 0 / 0 / 0 | 8.6 / 9.4 / 12.8 |
| A1 | 3 | 0.0% / 0.0% / 0.0% | 0.0% | 17/17 | 15/17 | 1 / 1 / 0 | 0 / 0 / 0 | 5.8 / 5.6 / 5.6 |
| A2 | 3 | 29.4% / 23.5% / 29.4% | 27.5% | 15/17 | 7/17 | 0 / 1 / 1 | 0 / 0 / 0 | 30.6 / 14.0 / 13.5 |
| A3 | 3 | 29.4% / 29.4% / 40.0% | 32.9% | 13/15 | 6/15 | 1 / 0 / 0 | 0 / 0 / 2 | 104.8 / 8.9 / 8.9 |
| A6 | 3 | 29.4% / 35.7% / 25.0% | 30.0% | 12/13 | 6/13 | 0 / 0 / 0 | 0 / 3 / 1 | 9.3 / 10.1 / 7.9 |
| A7 | 3 | 35.3% / 35.3% / 35.3% | 35.3% | 17/17 | 14/17 | 0 / 0 / 0 | 0 / 0 / 0 | 9.5 / 9.1 / 8.3 |

**Sinyal komponen** (konfigurasi ber-retrieval, semua pengulangan, 340 langkah, τ = 0.8): langkah self-referential 39.1%; expectAttribute 93.2%; c_act < τ 0.9% (nilai: 0, 1); c_orc < τ 0.0% (nilai: 1); c_loc < τ 12.4%.

**Gate vs manusia pada langkah berlabel**: 59 dari 84 langkah unik (70.2%) identik dengan item yang sudah dinilai 3 reviewer; 294 dari 340 kemunculan. Langkah lain belum berlabel dan tidak dihitung.

| Varian | TP | FN | FP | TN | Cohen κ | Recall eskalasi | Galat lolos-otomatis [95% CI] |
|---|---|---|---|---|---|---|---|
| Gate penuh (skor) | 127 | 13 | 13 | 141 | 0.823 | 90.7% | 8.4% [5.0%, 13.9%] |
| min(c_act, c_loc, c_orc) tanpa aturan self-ref | 14 | 126 | 13 | 141 | 0.016 | 10.0% | 47.2% [41.3%, 53.2%] |
| Aturan self-ref saja | 124 | 16 | 0 | 154 | 0.890 | 88.6% | 9.4% [5.9%, 14.7%] |
| Terima semua (tanpa gate) | 0 | 140 | 0 | 154 | n/a | 0.0% | 47.6% [42.0%, 53.3%] |

## Model 8b: qwen3:8b (pengulangan: abl8b-r1, abl8b-r2, abl8b-r3)

| Konfigurasi | Pengulangan | TSR otomatis per pengulangan | Rata-rata | Skenario dengan hasil sama di semua pengulangan | Skenario dengan langkah identik | Error model (timeout/parse) | Error infrastruktur (dikeluarkan) | Menit per pengulangan |
|---|---|---|---|---|---|---|---|---|
| A0 | 3 | 76.5% / 80.0% / 76.5% | 77.6% | 15/15 | 13/15 | 0 / 0 / 0 | 0 / 2 / 0 | 15.7 / 17.0 / 17.5 |
| A1 | 3 | 0.0% / 0.0% / 0.0% | 0.0% | 17/17 | 16/17 | 4 / 3 / 4 | 0 / 0 / 0 | 32.1 / 22.5 / 27.1 |
| A2 | 3 | 64.7% / 68.8% / 70.6% | 68.0% | 15/16 | 4/16 | 0 / 0 / 0 | 0 / 1 / 0 | 15.2 / 15.0 / 15.9 |
| A3 | 3 | 75.0% / 76.5% / 68.8% | 73.4% | 13/15 | 6/15 | 0 / 0 / 0 | 1 / 0 / 1 | 14.5 / 16.9 / 13.8 |
| A6 | 3 | 58.8% / 56.3% / 66.7% | 60.6% | 13/14 | 6/14 | 0 / 0 / 0 | 0 / 1 / 2 | 17.0 / 15.1 / 13.4 |
| A7 | 3 | 70.6% / 75.0% / 68.8% | 71.4% | 13/15 | 9/15 | 0 / 1 / 1 | 0 / 1 / 1 | 16.9 / 19.5 / 18.7 |

**Sinyal komponen** (konfigurasi ber-retrieval, semua pengulangan, 454 langkah, τ = 0.8): langkah self-referential 0.0%; expectAttribute 73.8%; c_act < τ 0.4% (nilai: 0, 1); c_orc < τ 0.0% (nilai: 1); c_loc < τ 9.0%.

**Gate vs manusia pada langkah berlabel**: 0 dari 107 langkah unik (0.0%) identik dengan item yang sudah dinilai 3 reviewer; 0 dari 454 kemunculan. Langkah lain belum berlabel dan tidak dihitung.

| Varian | TP | FN | FP | TN | Cohen κ | Recall eskalasi | Galat lolos-otomatis [95% CI] |
|---|---|---|---|---|---|---|---|
| Gate penuh (skor) | 0 | 0 | 0 | 0 | n/a | n/a | n/a [0.0%, 100.0%] |
| min(c_act, c_loc, c_orc) tanpa aturan self-ref | 0 | 0 | 0 | 0 | n/a | n/a | n/a [0.0%, 100.0%] |
| Aturan self-ref saja | 0 | 0 | 0 | 0 | n/a | n/a | n/a [0.0%, 100.0%] |
| Terima semua (tanpa gate) | 0 | 0 | 0 | 0 | n/a | n/a | n/a [0.0%, 100.0%] |

Catatan: "Langkah identik" membandingkan urutan langkah usulan model (tipe, target, nilai) per skenario. TSR otomatis memakai reviewer tiruan (stub); bukan TSR terverifikasi manusia.
