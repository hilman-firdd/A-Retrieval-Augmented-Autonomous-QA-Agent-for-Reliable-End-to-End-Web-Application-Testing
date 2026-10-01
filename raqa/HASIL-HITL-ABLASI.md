# Hasil Eksperimen HITL & Ablasi RAQA — Kesimpulan

Semua angka berasal dari berkas di repo ini (sumber di akhir dokumen). Tidak ada angka yang dibulatkan ulang
secara manual. Aplikasi yang diuji: instance lokal SIMASIS pada commit `91db4a96` (dibekukan; lihat
`scenarios/ground-truth.json`). Model: Qwen3 4B lokal, temperature 0, seed 42, τ = 0,8.

## 1. Kesimpulan singkat

| Pertanyaan | Jawaban berdasarkan data | Kuat? |
|---|---|---|
| Apakah retrieval diperlukan? | Ya. Tanpa retrieval 0/17 skenario berhasil; dengan retrieval 17,6–35,3% | Arah konsisten; belum signifikan setelah koreksi Holm (p = 0,31) |
| Apakah gate tahu kapan harus bertanya ke manusia? | Ya. κ = 0,81; semua 10 langkah yang ditolak manusia sudah dieskalasi; 0 dari 9 langkah lolos-otomatis ditolak | Menjanjikan, tetapi n kecil (CI galat lolos-otomatis 0–29,9%) |
| Apakah keluaran agen andal? | Belum. 33–46% langkah dinilai tidak relevan/tautologis; keberhasilan terverifikasi hanya 17,6–35,3% | Kuat (3 reviewer) |
| Komponen mana yang paling berkontribusi? | Tidak terbedakan. Selain retrieval, tidak ada konfigurasi yang berbeda terdeteksi dari A0 | Daya uji rendah (n = 17) |
| Apakah agen menemukan cacat nyata? | Tidak. Cacat S-AUTH-03 tidak ditemukan oleh konfigurasi mana pun | Hanya 1 cacat di set 17 skenario |
| Apakah agen lebih cepat dari manual? | Tidak terbukti. Manual 6,8 menit untuk 17 skenario, agen 8,6 menit dan hanya menyelesaikan 5 | Pendahuluan: 1 penguji, kondisi uji berbeda |
| Apakah klasifikasi kegagalan penulis konsisten? | Ya. κ = 0,648 (substansial) | Sedang (1 rater kedua) |

**Dampak ke klaim naskah.** Kata "Reliable" pada judul belum didukung untuk keluaran agen. Yang didukung data adalah
keandalan **mekanisme gate** (kapan meminta manusia) dan temuan bahwa metrik otomatis menyesatkan tanpa
verifikasi manusia. Bingkai yang jujur: studi empiris keandalan agen QA ber-retrieval dengan evaluasi terverifikasi
manusia. Keputusan judul ada pada penulis.

## 2. Hasil per studi

### H0 — rater kedua untuk klasifikasi 19 kegagalan baseline
- κ sebelum diskusi = **0,648**; sepakat 16 dari 19.
- Tidak sepakat: F01 (S-AUTH-03), F04 (S-HOME-05 tampilan HP), F18 (S-QUAL-01). Setelah diskusi dengan bukti uji ulang:
  F01 dan F18 tetap cacat aplikasi; F04 dikoreksi menjadi kesalahan pengecekan (artikel terbuka 10 dari 10 di HP).
- Klasifikasi final: product 5, test 13, timing 1, environment 0. Kesepakatan akhir 19/19 adalah hasil diskusi,
  bukan κ independen kedua.
- Ground truth S-AUTH-03 tetap FAIL. Temuan rater: login dengan username salah menampilkan pesan error, dengan
  email salah tidak.

### H1 — penilaian buta 3 reviewer (70 langkah unik, 22 skrip)
- Reliabilitas langkah: R1 relevansi α = 0,618 [0,474–0,743]; R3 keputusan α = 0,481 [0,355–0,603], Fleiss κ = 0,479;
  R2 kebenaran ekspektasi α = 0,296 [0,149–0,429] (rendah, tidak dipakai sebagai hasil utama).
- Reliabilitas skrip: cakupan kriteria α = 0,720; penilaian keseluruhan (ordinal) α = 0,321 (rendah). Akibatnya TSR
  terverifikasi, yang bergantung pada penilaian ini, harus dibaca dengan hati-hati.
- Gate vs manusia (A0, 21 langkah dengan konsensus): κ = 0,811; recall eskalasi 10/10 = 100% [72,2–100%];
  presisi eskalasi 10/12 = 83,3%; galat lolos-otomatis 0/9 = 0% [0–29,9%].
- Langkah tak relevan/tautologis (konsensus R1 = 0): A0 40,9%; A1 43,8%; A2 45,8%; A3 36,4%; A6 44,0%; A7 33,3%.

### Ablasi (17 skenario pre-registrasi, 1 run per konfigurasi, reviewer eskalasi = tiruan mekanis)
| Konfigurasi | TSR otomatis | TSR terverifikasi | Δ vs A0 [CI 95%] | p (McNemar, Holm) |
|---|---|---|---|---|
| A0 Full | 29,4% | 29,4% | – | – |
| A1 tanpa retrieval | 0% | 0% | −29,4 pp [−52,9; −11,8] | 0,313 |
| A2 − catalog | 29,4% | 17,6% | −11,8 pp [−29,4; 0,0] | 1,000 |
| A3 − traces | 29,4% | 29,4% | 0,0 pp | 1,000 |
| A6 BM25 saja | 29,4% | 35,3% (29,4%*) | +5,9 pp [0,0; 17,6] | 1,000 |
| A7 dense saja | 35,3% | 35,3% | +5,9 pp [0,0; 17,6] | 1,000 |

\* Aturan sensitivitas (Tabel A1-S di `review/analysis.md`): deteksi cacat hanya dihitung bila assertion yang gagal
berekspektasi benar. Aturan ini ditetapkan **setelah** melihat data, sehingga dilaporkan sebagai analisis
sensitivitas, bukan hasil utama. Pada A6, S-AUTH-03 gagal karena ekspektasi keliru (`value` berisi "clear"), bukan
karena cacat ditemukan.

Cacat tertutupi = 0 pada semua konfigurasi hanya karena agen tidak pernah menyatakan S-AUTH-03 lulus: pada A0, A1,
A2, A3, dan A7 skenario berhenti di langkah pertama (ditolak reviewer tiruan); pada A6 gagal pada assertion
berekspektasi keliru. Tidak ada konfigurasi yang menemukan cacat tersebut.

### Studi waktu manual (1 penguji, pendahuluan)
- 17 skenario, total 410 detik (6,8 menit), median 23 detik, rata-rata 24,1 detik, rentang 11–47 detik; semua PASS.
- Pembanding agen A0: total 8,6 menit, median 27,2 detik per skenario, 5 dari 17 selesai, 13 eskalasi.
- Penguji memakai HP + situs produksi (bukan desktop + instance lokal), pernah melihat langkah/hasil RAQA, dan pada
  S-AUTH-03 mengisi username sehingga cacat (email) terlewat. Detail: `review/manual-timing-provenance.json`.

## 3. Keterbatasan yang wajib ditulis di paper
1. **Reviewer eskalasi adalah tiruan mekanis** (`stubReviewer`), bukan manusia. TSR dan laju eskalasi adalah
   kondisional terhadap aturan tiruan itu; sesi HITL interaktif (H2) tidak dijalankan, jadi tidak ada data waktu
   keputusan manusia (RQ5) dan tidak ada efek memori reviewer (A5).
2. n = 17 skenario, satu run per konfigurasi (temperature 0 membuat run deterministik, tetapi determinisme tidak diuji
   ulang). Hanya satu cacat nyata (S-AUTH-03) di set pre-registrasi. Ablasi bersifat eksploratif.
3. Reviewer adalah rekan kerja penulis; penilaian buta terhadap konfigurasi, tetapi kedekatan tidak bisa dihapus.
   Satu reviewer ikut H1 dan H0. Riwayat kualitas data: dua pengiriman satu reviewer ditolak sebelum penilaian ketiga
   diterima (pertama seragam seluruhnya, kedua turunan dari berkas reviewer lain, 65 dari 70 item identik); satu
   berkas tambahan tidak dipakai karena independensinya tidak terjamin. Kriteria penolakan: jawaban seragam penuh atau
   kemiripan tidak wajar dengan reviewer lain.
4. Aturan "deteksi cacat butuh ekspektasi benar" ditambahkan setelah data terlihat (hanya mengubah A6).
5. Studi waktu: dikumpulkan satu penguji, kondisi berbeda dari agen (HP, produksi, pernah melihat RAQA); keterangan
   penguji dikumpulkan setelah pengerjaan. Arah bias campuran, sehingga tidak ada rasio kecepatan yang dilaporkan.
6. Konfigurasi A4 (− defect reports) tidak dijalankan.
7. Hasil diukur pada instance lokal yang dibekukan; staging/produksi tidak diuji ulang penuh (pemeriksaan pasif
   menunjukkan judul, tautan Daftar PSB, dan 5 tombol "Selengkapnya" sama).

## 4. Draf teks paper (English; semua angka dari tabel di atas)

**Human-in-the-loop evaluation (setup).** Three QA practitioners who were not involved in building SIMASIS or RAQA
independently and blindly rated every distinct step (n = 70) and every compiled scenario script (n = 22) produced
across six configurations, without access to the configuration, gate score or cited units. Items identical across
configurations were rated once and mapped back through a separate key; order was randomised with a fixed seed.
Steps received a relevance score (0–2), an expectation-correctness judgement and an accept/edit/reject decision.
A fourth submission was excluded because its independence could not be assured. A separate QA practitioner
re-classified the 19 baseline failures.

**Results.** Inter-rater agreement was moderate (Krippendorff's α = 0.62 [0.47, 0.74] for relevance; α = 0.48
[0.36, 0.60] and Fleiss' κ = 0.48 for the decision; α = 0.30 for expectation correctness, which we therefore do not
use as a primary outcome). For the full configuration, the gate's escalation decisions agreed with the reviewers'
consensus (Cohen's κ = 0.81): all 10 steps that reviewers did not accept were escalated (recall 100%, 95% CI
[72.2, 100]), and none of the 9 auto-accepted steps was rejected (0%, [0, 29.9]). Between 33% and 46% of steps in each
configuration were judged irrelevant or tautological. Verified task success was 29.4% for the full configuration and
0% without retrieval (Δ = −29.4 pp, bootstrap 95% CI [−52.9, −11.8]; exact McNemar p = 0.31 after Holm correction);
no other ablation differed detectably (|Δ| ≤ 11.8 pp). No configuration detected the one naturally occurring defect
in the scenario set. The author's failure classification agreed with the independent rater at κ = 0.65 (16/19).

**Threats to validity.** The escalation reviewer used in all unattended runs was a mechanical stub, so success rates
are conditional on it and decision time and the effect of reviewer memory were not measured. With 17 scenarios and
one defect the ablation is exploratory and reports effect sizes with intervals. Reviewers are colleagues of the
author, which may bias ratings towards acceptance; blinding limits but cannot remove this. One stricter defect-
detection rule was introduced after inspecting the data and is reported as a sensitivity analysis. A single QA
practitioner timed the manual baseline on a phone against the production site, having previously seen RAQA output;
we therefore report it as a pilot and make no speed-up claim.

## 5. Sumber data
- `review/analysis.md`, `review/analysis.json` (Tabel H1, H2, H3, A1, A1-S)
- `review/step-ratings-R1..R3.csv`, `review/scenario-ratings-R1..R3.csv` (ID reviewer anonim; pemetaan tidak disimpan di repo)
- `review/h0-sheet-R2.csv`, `review/h0-final-overrides.csv`, `review/h0-KEY-jangan-dibagikan.json`
- `review/manual-timing.csv`, `review/manual-timing-provenance.json`
- `runs/abl-A0 … abl-A7/` (`results.json`, `summary.json`), `runs/abl-manifest.json`
- `instrumen/` — templat kosong (H1, H0, studi waktu, keterangan penguji). Tautan screenshot di templat H1 mengacu ke
  `shots/L###.png` yang tidak disertakan; screenshot asli ada di `review/shots/`.
- `scenarios/prereg-ablation.json`, `scenarios/ground-truth.json`
