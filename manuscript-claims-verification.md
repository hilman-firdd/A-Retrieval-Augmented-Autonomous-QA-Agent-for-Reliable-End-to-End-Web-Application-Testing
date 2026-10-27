# Verifikasi klaim naskah JUITA terhadap data di repo

Naskah: **"Offline Human Review Reveals Overstated Success and Confidence Signals in an LLM Web Testing Agent"**
(versi JUITA, 27 Oktober 2026, dengan uji ketahanan). Dokumen ini menggantikan verifikasi lama untuk draf JSC (yang masih memakai 5 fault,
"6 dari 19 test" dan "5 penyebab"; angka-angka itu sudah tidak berlaku).

Setiap baris menyebut angka di naskah, sumbernya, dan perintah untuk mengecek ulang. Semua perintah dijalankan dari
akar repo kecuali disebut lain; semuanya dijalankan ulang pada 27 Oktober 2026 dan hasilnya sama dengan naskah.

Perintah ringkas:

```bash
python3 -I reanalysis/baseline_mcnemar.py
node raqa/scripts/h0-failure-classification.js analyze raqa/review/h0-sheet-R2.csv
(cd raqa && node scripts/analyze-hitl.js --baseline A0)          # menulis raqa/review/analysis.md/json
python3 -I reanalysis/endpoints_and_trace.py .                   # Tabel III + asal status selesai
(cd reanalysis && python3 -I gate_irr_reanalysis.py .. reanalysis.json && python3 -I make_fig2.py)
python3 -I reanalysis/repeats_unique.py . reanalysis/repeats_unique.json   # uji ketahanan
```

## Abstrak

| Klaim | Nilai | Sumber | Status |
|---|---|---|---|
| Suite dijalankan 10 kali; 25 fault; 6 konfigurasi; 17 skenario; 3 penilai; 70 langkah; 22 skrip | sesuai | `results/runs/baseline*/k01..k10`, `faults/faults.csv`, `raqa/runs/abl-manifest.json`, `raqa/review/KEY-jangan-dibagikan.json` | ✅ |
| Flaky 11,88% staging, 0,99% lokal | 12/101, 1/101 | `results/metrics/baseline/summary.json`, `results/metrics/baseline-local/summary.json` | ✅ |
| 8 dari 25 fault | 8/25 | `results/metrics/fault-detection/summary.json` | ✅ |
| Hanya satu atau dua dari 17 skenario semua kriterianya tercakup | 1 (A0–A3, A6), 2 (A7) | `endpoints_and_trace.py` | ✅ |
| Tidak ada konfigurasi yang menemukan cacat nyata | 0 dengan oracle benar | `endpoints_and_trace.py`, `appendix/verified_success_trace.csv` | ✅ |
| κ = 0,905 pada 21 langkah A0 | 0,905 | `reanalysis/reanalysis.json` → `gate_variants.A0` | ✅ |
| κ = 0,747 pada 57 langkah unik; 4 dari 24 lolos-otomatis tidak diterima | 0,747; 4/24 | `reanalysis/table_iv_unique.json` | ✅ |
| Tiga sinyal tanpa aturan: κ = −0,059 | −0,059 | `table_iv_unique.json` | ✅ |

## Method

| Klaim | Nilai | Sumber | Status |
|---|---|---|---|
| 31 skenario, 30 tanpa akun, 101 test | 30 skenario, 101 test | `summary.json` (`scenarios.total`, `tests.total`) | ✅ |
| 1.010 eksekusi per deployment | 101 × 10 | `results/runs/baseline/`, `baseline-local/` | ✅ |
| McNemar eksak berpasangan | p = 0,0034 (12 vs 1) | `baseline_mcnemar.py` | ✅ |
| 20 fault baru di 4 kategori + 5 cacat historis; tiap fault 3 run | sesuai | `faults/faults.csv`, `results/runs/fault-F01..F25/` | ✅ |
| Korpus: katalog 31, trace 101, catatan cacat 6 | 31 / 101 / 6 | `raqa/runs/abl-A0/summary.json` → `corpus` | ✅ |
| RRF, w_r = 0,5, κ = 60, top-5; Qwen3 4B, temperature 0, seed 42 | sesuai | `raqa/src/config.js`, `raqa/src/retrieval.js`, `summary.json` | ✅ |
| Setiap skenario mulai dari halaman tetap sesuai fitur | `startPath` | `raqa/scripts/run-scenarios.js` (`START_PATH_BY_FEATURE`, `START_PATH_BY_ID`) | ✅ |
| Berhenti bila planner menyatakan selesai, bila langkah yang diterima diulang, atau setelah 8 langkah | sesuai | `raqa/src/agent.js` (`runScenario`), `maxSteps: 8` | ✅ |
| Persamaan (3) c_act, termasuk U_t tidak kosong | sesuai | `agent.js` baris `const cAct = ...` | ✅ |
| S(ℓ) = 0,5φ_hist − 0,3φ_str − 0,2φ_vol; φ_str = min(1, (m − 1)/4) | sesuai | `raqa/src/locatorScore.js` | ✅ |
| φ_hist dari locator yang berhasil di run yang sama | memori per konfigurasi, `--no-persist` | `raqa/scripts/run-ablation.js` | ✅ |
| Aturan self-referential, Persamaan (5), ada sebelum semua run | ada sejak commit `0eda785` (22 Sep 2026); aktif di pilot `raqa-v3` | `git log -S selfReferential -- raqa/src`; `raqa/runs/raqa-v3/results.json` | ✅ |
| τ = 0,8; audit 5% dengan seed; stub menerima bila c_t ≥ τ − 0,2 | sesuai | `raqa/src/config.js` (`auditSeed: 1`), `raqa/src/stubReviewer.js` | ✅ |
| Sumber QA docs dan verdict reviewer aktif tetapi kosong | korpus hanya 3 sumber terisi | `summary.json` → `sources`, `corpus` | ✅ |
| Uji ketahanan tidak dipra-registrasi: 2 run tambahan 4B dan 3 run 8B, batas 5 menit per panggilan model; 16 dari 510 skenario dikeluarkan karena halaman awal gagal dimuat | sesuai | `raqa/runs/repeats-manifest.json`, `reanalysis/repeats_unique.json` → `infra_errors` (4B 6, 8B 10) | ✅ |
| Commit aplikasi 91db4a96; pre-registrasi 23 Sep 2026 21.45 WIB sebelum run pertama | `7b08f79` 21:45:36 +0700; A0 selesai 21:54:54 WIB | `git log 7b08f79`; `raqa/runs/abl-A0/summary.json` → `generatedAt` | ✅ |
| 102 episode, 133 kemunculan, 70 langkah unik, 30 episode berskrip, 22 skrip unik | sesuai | `KEY-jangan-dibagikan.json` (`steps`, `occurrences`, `scenarios[].runs`) | ✅ |
| Dua berkas awal satu penilai disisihkan; 65 dari 70 jawaban sama; satu berkas lain disisihkan | sesuai catatan penulis | Belum ada ledger di repo (rencana: `raqa/review/rater-ledger.csv`) | ⚠️ perlu ledger |

## Result and Discussion

| Klaim | Nilai | Sumber | Status |
|---|---|---|---|
| Tabel I (50/39/12 dan 82/18/1; skenario 20,00% dan 3,33%) | sesuai | `summary.json` (`scenarios.flaky` 6/30 dan 1/30) | ✅ |
| Tabel II; κ = 0,648 (16 dari 19); 5 test produk, 4 penyebab; 13 cacat test; 1 timing | sesuai | `h0-failure-classification.js`, `raqa/review/h0-final-overrides.csv` | ✅ |
| Fault per kategori 1/3, 4/7, 2/5, 0/5, 1/5; Wilson 17,2–51,6% | sesuai | `fault-detection/summary.json` → `byCategory` | ✅ |
| Tabel III (semua kolom) | sesuai | `analysis.md` Tabel A1 dan A1-S; `endpoints_and_trace.py` | ✅ |
| Ke-26 penyelesaian berasal dari aturan pengulangan; planner tidak pernah menyatakan selesai | 26/26; 0/133 | `endpoints_and_trace.py` (baris terakhir output) | ✅ |
| A6 gagal di S-AUTH-03 karena assertion "clear" pada field kosong | sesuai | `appendix/verified_success_trace.csv` (baris A6, S-AUTH-03), `raqa/runs/abl-A6/results.json` | ✅ |
| 33,3–45,8% langkah tidak relevan; 11/21 vs 7/15 diterima | sesuai | `analysis.md`; `endpoints_and_trace.py` | ✅ |
| A0: 10 dari 21 ditolak, semua dieskalasi; cakupan 10/21; galat 0/10 (CP 0–30,8%); 0,811 bila audit = eskalasi | sesuai | `reanalysis.json` → `gate_variants.A0`, `A0_legacy_audit_as_escalated` | ✅ |
| Peluang acak 3,1 × 10⁻⁵ (A0) | 3,12 × 10⁻⁵ | `reanalysis.json` → `random_budget_matched` | ✅ |
| c_orc = 1 pada 133 kemunculan; c_act = 1 kecuali satu langkah A2; 6 nilai c_t | sesuai | `reanalysis.json` → `signal_variation`, `distinct_c_t` | ✅ |
| A0: 10 eskalasi dari aturan self-ref (semua ditolak), 2 dari c_loc | sesuai | `reanalysis.json` → `cause_vs_human.A0` | ✅ |
| Aturan aktif 46 kali di luar A1, semua `expectAttribute`, semua ditolak | 46 | `reanalysis.json` → `selfref_types`, `cause_vs_human` | ✅ |
| Tabel IV (semua baris) dan CI bootstrap [0,474; 0,961] dan [−0,243; 0,047] | sesuai | `reanalysis/table_iv_unique.json` | ✅ |
| Peluang acak 1,1 × 10⁻⁸ (57 langkah unik) | 1,11 × 10⁻⁸ | `table_iv_unique.json` → `random_budget_matched` | ✅ |
| Ambang: A0 sama untuk τ di (0,3; 0,925], κ 0,717–1,0; 57 langkah unik sama untuk τ di (0,7; 0,925], τ lebih rendah hanya meloloskan langkah yang diterima | sesuai | `reanalysis.json` → `tau_sweep.A0`; `table_iv_unique.json` → `tau_sweep` | ✅ (kalimat diperbaiki 27 Okt; versi 26 Okt belum membatasi ke A0) |
| Uji ketahanan 4B: 12–17 skenario per konfigurasi bernasib sama di tiga run; 59 langkah unik berlabel, κ gate penuh 0,756, tiga sinyal tanpa aturan −0,057 | sesuai | `raqa/review/analysis-repeats.md`; `reanalysis/repeats_unique.json` → `qwen3:4b.gate_unique_labelled` | ✅ |
| 8B: keberhasilan otomatis 56–80% (4B 24–40%) pada konfigurasi ber-retrieval; aturan self-ref 0 dari 454 langkah (4B 133 dari 340); gate meloloskan 84% | sesuai | `analysis-repeats.md`; `repeats_unique.json` → `signals`, `success` | ✅ |
| 8B menyatakan S-AUTH-03 lulus di 9 dari 15 run ber-retrieval, hanya dengan mengecek heading login; gate meloloskan dan aturan pengulangan menghentikan skenario | 9/15 | `repeats_unique.json` → `s_auth_03`; `raqa/runs/abl8b-r1-A0/results.json` | ✅ |
| Langkah 8B belum dinilai manusia | 0 dari 107 langkah unik sudah berlabel | `repeats_unique.json` → `qwen3:8b.unique_steps` | ✅ |
| Tabel V; Fleiss 0,479; κ berpasangan 0,754 / 0,380 / 0,355; R3 menerima 12 vs 34 dan 26; 5 langkah tanpa mayoritas | sesuai | `reanalysis.json` → `irr` | ✅ |
| Gambar 2 | identik dengan berkas naskah | `reanalysis/fig2_gate.png` | ✅ |
| Tabel VI berdasarkan teks lengkap empat makalah; Lim et al. hanya abstrak | sesuai catatan penulis | — | ⚠️ cek ulang bila teks lengkap Lim et al. bisa diakses |

## Hal yang belum bisa diverifikasi dari repo

1. **Ledger penilai** (jumlah orang unik, urutan pengiriman, siapa yang memutuskan eksklusi). Berkas yang disisihkan
   tidak ada di repo.
2. **Adjudikasi kebenaran ekspektasi** oleh pemeriksa independen belum dilakukan. Naskah sudah menyatakannya.
3. **Izin pemilik aplikasi** untuk patch fault di `faults/patches/`, yang berisi potongan kode SIMASIS, sementara
   naskah menyebut kode SIMASIS tidak publik (lihat `REPLICATION.md`).
