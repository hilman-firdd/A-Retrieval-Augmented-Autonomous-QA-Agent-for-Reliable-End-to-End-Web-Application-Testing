# Hasil Eksperimen HITL & Ablasi RAQA — Kesimpulan

Semua angka berasal dari berkas di repo ini (sumber di akhir dokumen). Tidak ada angka yang dibulatkan ulang
secara manual. Aplikasi yang diuji: instance lokal SIMASIS pada commit `91db4a96` (dibekukan; lihat
`scenarios/ground-truth.json`). Model: Qwen3 4B lokal, temperature 0, seed 42, τ = 0,8. Uji ketahanan (bagian 2,
"Pengulangan dan model lebih besar"): keenam konfigurasi diulang 3 kali dengan Qwen3 4B dan 3 kali dengan Qwen3 8B.

## 1. Kesimpulan singkat

| Pertanyaan | Jawaban berdasarkan data | Kuat? |
|---|---|---|
| Apakah retrieval diperlukan? | Ya. Tanpa retrieval 0/17 skenario berhasil; dengan retrieval 17,6–35,3%. Tanpa retrieval tetap 0% di ketiga pengulangan, pada 4B maupun 8B | Arah konsisten di 2 model × 3 pengulangan; uji pada run pertama belum signifikan setelah Holm (p = 0,31) |
| Apakah gate tahu kapan harus bertanya ke manusia? | Sebagian, tetapi bukan karena skor keyakinan. Di A0 κ = 0,81 dan semua 10 langkah yang ditolak manusia dieskalasi, namun seluruh 10 eskalasi itu berasal dari aturan self-referential (assertion seperti `href` berisi "href"). Tanpa aturan itu, skor min(c_act, c_loc, c_orc) setara tanpa gate (κ = 0,01 di A0; −0,03 gabungan) | Kuat untuk kesimpulan "skor keyakinan tidak berkontribusi"; bertahan di 3 pengulangan 4B (tanpa aturan κ = 0,016; dengan aturan κ = 0,82) |
| Apakah temuan gate bertahan pada model lebih besar? | Pola kegagalannya bergeser. Qwen3 8B tidak pernah memicu aturan self-referential (0% dari 454 langkah; 4B 39,1%), c_act dan c_orc tetap praktis konstan, dan 83,9% langkah lolos otomatis (4B 45,6%). Gate tidak lagi menahan langkah 8B; κ terhadap manusia untuk 8B tidak dihitung karena langkahnya belum dinilai | Kuat untuk sinyal komponen (objektif); kualitas langkah 8B belum diverifikasi manusia |
| Apakah hasil stabil antar-pengulangan? | Ya pada tingkat skenario: rentang TSR otomatis antar-pengulangan paling besar 10,6 pp (A0: 0 pp di 4B, 3,5 pp di 8B); 12–17 skenario per konfigurasi bernasib sama di ketiga pengulangan. Urutan langkah tidak selalu identik (temperature 0 tidak sepenuhnya deterministik) | Kuat (3 pengulangan, 2 model) |
| Apakah keluaran agen andal? | Belum. 33–46% langkah dinilai tidak relevan/tautologis; keberhasilan terverifikasi hanya 17,6–35,3% | Kuat (3 reviewer) |
| Komponen mana yang paling berkontribusi? | Tidak terbedakan. Selain retrieval, tidak ada konfigurasi yang berbeda terdeteksi dari A0 | Daya uji rendah (n = 17) |
| Apakah agen menemukan cacat nyata? | Tidak. Cacat S-AUTH-03 tidak ditemukan oleh run mana pun (36 run, 2 model). Qwen3 8B bahkan **menutupinya**: dinyatakan lulus di 9 dari 15 run ber-retrieval hanya dengan memeriksa judul halaman login, tanpa mengisi kredensial | Hanya 1 cacat di set 17 skenario; penutupan cacat dihitung objektif dari ground truth |
| Apakah agen lebih cepat dari manual? | Tidak terbukti. Manual 6,8 menit untuk 17 skenario, agen 8,6 menit dan hanya menyelesaikan 5 | Pendahuluan: 1 penguji, kondisi uji berbeda |
| Apakah klasifikasi kegagalan penulis konsisten? | Ya. κ = 0,648 (substansial) | Sedang (1 rater kedua) |

**Dampak ke klaim naskah.** Kata "Reliable" pada judul belum didukung, baik untuk keluaran agen maupun untuk skor
keyakinan c_t = min(c_act, c_loc, c_orc). Dalam eksperimen ini dua dari tiga komponen konstan (c_act = 1 dan c_orc = 1
pada semua langkah A0), dan kesepakatan gate dengan manusia hampir seluruhnya berasal dari satu aturan heuristik
(self-referential) yang ditambahkan setelah pilot untuk satu pola kegagalan model. Bingkai yang jujur: studi empiris
yang menunjukkan bahwa metrik otomatis menyesatkan tanpa verifikasi manusia, dan bahwa sinyal keyakinan yang
dirancang belum diskriminatif pada model kecil. Aturan self-referential harus dijelaskan di bagian metode (saat ini
tidak tercakup oleh persamaan c_t di naskah). Uji pada Qwen3 8B memperkuat ini: model lebih besar menghasilkan
TSR otomatis lebih tinggi (56–80%), tetapi aturan self-referential tidak pernah aktif, sinyal lain tetap konstan, gate
meloloskan 84% langkah, dan satu cacat nyata dinyatakan lulus di 9 dari 15 run. Metrik otomatis yang tampak membaik
justru menyertai penutupan cacat. Keputusan judul ada pada penulis.

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
- Gate vs manusia (A0, 21 langkah dengan konsensus, Tabel H3): κ = 0,811; recall eskalasi 10/10 = 100% [72,2–100%];
  presisi eskalasi 10/12 = 83,3%; galat lolos-otomatis 0/9 = 0% [0–29,9%]. Tabel H3 menghitung 1 langkah yang
  terkena undian audit acak (diterima manusia) sebagai eskalasi; bila keputusan dihitung dari skor saja, κ = 0,905.
- **Kontribusi komponen (Tabel H3-K).** Di A0, c_act dan c_orc bernilai 1 pada semua langkah, sehingga tidak pernah
  memicu eskalasi. Kesepuluh langkah yang ditolak manusia dieskalasi oleh aturan self-referential. Tanpa aturan itu:
  κ = 0,009, recall 1/10, galat lolos-otomatis 9/19 = 47,4% [27,3–68,3%], setara "terima semua" (47,6%).
  Aturan self-referential saja: κ = 1,000. Gabungan kelima konfigurasi ber-retrieval (112 kemunculan): gate penuh
  κ = 0,785, galat lolos-otomatis 6/59 = 10,2% [4,7–20,5%]; tanpa aturan self-ref κ = −0,027 dan galat 48,0%; aturan
  self-ref saja κ = 0,874. Jadi angka 0/9 di A0 tidak berlaku umum: di gabungan konfigurasi, 6 langkah yang
  ditolak manusia lolos otomatis.
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

### Pengulangan dan model lebih besar (3 × 6 konfigurasi per model; `review/analysis-repeats.md`)
Qwen3 4B: rep 1 = run asli; rep 2–3 dan Qwen3 8B rep 1–3 dijalankan 2026-10-26/27 terhadap salinan beku SIMASIS
`91db4a96`, dengan batas 5 menit per panggilan model. Total 510 skenario; 16 (3%) gagal karena infrastruktur (halaman
awal tidak termuat dalam 30 detik) dan dikeluarkan sebagai data hilang. Panggilan model yang melewati 5 menit dihitung
sebagai kegagalan agen (8B tanpa retrieval: 3–4 skenario yang sama di tiap pengulangan).

| Konfigurasi | 4B: TSR otomatis rep 1 / 2 / 3 | 8B: TSR otomatis rep 1 / 2 / 3 |
|---|---|---|
| A0 Full | 29,4 / 29,4 / 29,4% | 76,5 / 80,0 / 76,5% |
| A1 tanpa retrieval | 0 / 0 / 0% | 0 / 0 / 0% |
| A2 − catalog | 29,4 / 23,5 / 29,4% | 64,7 / 68,8 / 70,6% |
| A3 − traces | 29,4 / 29,4 / 40,0% | 75,0 / 76,5 / 68,8% |
| A6 BM25 saja | 29,4 / 35,7 / 25,0% | 58,8 / 56,3 / 66,7% |
| A7 dense saja | 35,3 / 35,3 / 35,3% | 70,6 / 75,0 / 68,8% |

TSR di tabel ini **otomatis** (reviewer tiruan), bukan terverifikasi manusia. Semua "selesai" di kedua model berasal
dari pengaman pengulangan (4B 77 dari 77, 8B 172 dari 172), tidak ada yang dari model menyatakan selesai sendiri.

| Sinyal (konfigurasi ber-retrieval, semua pengulangan) | Qwen3 4B (340 langkah) | Qwen3 8B (454 langkah) |
|---|---|---|
| Langkah self-referential | 39,1% | 0,0% |
| c_act < τ | 0,9% | 0,4% |
| c_orc < τ | 0,0% | 0,0% |
| c_loc < τ | 12,4% | 9,0% |
| Lolos otomatis (gate) | 45,6% | 83,9% |
| S-AUTH-03 dinyatakan lulus (cacat tertutupi) | 0 dari 15 run | 9 dari 15 run |

- **Stabilitas.** Skenario yang bernasib sama di ketiga pengulangan: 4B 12–17 per konfigurasi, 8B 13–17. Urutan langkah
  identik di ketiga pengulangan hanya pada 6–15 (4B) dan 4–16 (8B) skenario, jadi run tidak sepenuhnya deterministik
  meskipun temperature 0.
- **Gate 4B lintas 3 pengulangan** (294 kemunculan berlabel, label manusia dari H1 untuk langkah yang identik): gate
  penuh κ = 0,823, galat lolos-otomatis 8,4% [5,0–13,9%]; tanpa aturan self-ref κ = 0,016 dan galat 47,2%; aturan
  self-ref saja κ = 0,890. Temuan Tabel H3-K bertahan.
- **8B dan S-AUTH-03.** Pada A0, A3, dan A7 di ketiga pengulangan, 8B menyatakan skenario "kredensial salah ditolak"
  lulus dengan assertion `heading "Selamat Datang" terlihat` (diulang), tanpa pernah mengisi kredensial. Pada A2 vonis
  FAIL di ketiga pengulangan, tetapi karena assertion yang tidak terkait (`aria-label` tombol Masuk), bukan pesan error.
- **Belum diverifikasi manusia.** Tidak satu pun dari 107 langkah unik 8B identik dengan langkah yang sudah dinilai
  reviewer, sehingga κ gate vs manusia dan TSR terverifikasi untuk 8B tidak dilaporkan.
- Waktu: 8B ±2 kali lebih lambat (A0 15,7–17,5 menit per 17 skenario; 4B 8,6–12,8 menit).

### Studi waktu manual (1 penguji, pendahuluan)
- 17 skenario, total 410 detik (6,8 menit), median 23 detik, rata-rata 24,1 detik, rentang 11–47 detik; semua PASS.
- Pembanding agen A0: total 8,6 menit, median 27,2 detik per skenario, 5 dari 17 selesai, 13 eskalasi.
- Penguji memakai HP + situs produksi (bukan desktop + instance lokal), pernah melihat langkah/hasil RAQA, dan pada
  S-AUTH-03 mengisi username sehingga cacat (email) terlewat. Detail: `review/manual-timing-provenance.json`.

## 3. Keterbatasan yang wajib ditulis di paper
1. **Reviewer eskalasi adalah tiruan mekanis** (`stubReviewer`), bukan manusia. TSR dan laju eskalasi adalah
   kondisional terhadap aturan tiruan itu; sesi HITL interaktif (H2) tidak dijalankan, jadi tidak ada data waktu
   keputusan manusia (RQ5) dan tidak ada efek memori reviewer (A5).
2. n = 17 skenario. Uji statistik ablasi (Tabel A1) memakai run pertama; pengulangan menunjukkan hasil tingkat skenario
   stabil tetapi urutan langkah tidak sepenuhnya deterministik meskipun temperature 0. Hanya satu cacat nyata
   (S-AUTH-03) di set pre-registrasi. Ablasi bersifat eksploratif.
3. Reviewer adalah rekan kerja penulis; penilaian buta terhadap konfigurasi, tetapi kedekatan tidak bisa dihapus.
   Satu reviewer ikut H1 dan H0. Riwayat kualitas data: dua pengiriman satu reviewer ditolak sebelum penilaian ketiga
   diterima (pertama seragam seluruhnya, kedua turunan dari berkas reviewer lain, 65 dari 70 item identik); satu
   berkas tambahan tidak dipakai karena independensinya tidak terjamin. Kriteria penolakan: jawaban seragam penuh atau
   kemiripan tidak wajar dengan reviewer lain.
4. Aturan "deteksi cacat butuh ekspektasi benar" ditambahkan setelah data terlihat (hanya mengubah A6).
5. Studi waktu: dikumpulkan satu penguji, kondisi berbeda dari agen (HP, produksi, pernah melihat RAQA); keterangan
   penguji dikumpulkan setelah pengerjaan. Arah bias campuran, sehingga tidak ada rasio kecepatan yang dilaporkan.
6. Konfigurasi A4 (− defect reports) tidak dijalankan.
7. Aturan self-referential pada gate ditambahkan setelah pilot untuk satu pola kegagalan Qwen3 4B, dan menjadi
   sumber hampir seluruh kesepakatan gate dengan manusia. Skor min(c_act, c_loc, c_orc) sendiri tidak diskriminatif;
   c_act dan c_orc konstan pada konfigurasi ber-retrieval. Ambang τ = 0,8 tidak dikalibrasi.
8. Hasil diukur pada instance lokal yang dibekukan; staging/produksi tidak diuji ulang penuh (pemeriksaan pasif
   menunjukkan judul, tautan Daftar PSB, dan 5 tombol "Selengkapnya" sama).
9. Langkah Qwen3 8B tidak dinilai manusia; untuk 8B hanya dilaporkan metrik objektif (sinyal komponen, laju lolos
   otomatis, cacat tertutupi terhadap ground truth) dan TSR otomatis. Hanya satu ukuran model tambahan dari keluarga
   yang sama yang diuji.
10. Pengulangan dijalankan dengan batas 5 menit per panggilan model (run asli tanpa batas) dan terhadap salinan beku
    aplikasi; 16 dari 510 skenario gagal karena infrastruktur dan dikeluarkan. Korpus retrieval memuat trace baseline B1
    dari staging, sementara agen menguji instance lokal; hal ini sama di semua run.

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
[72.2, 100]), and none of the 9 auto-accepted steps was rejected (0%, [0, 29.9]). A component analysis shows that this
agreement does not come from the confidence score. Two of its three components were constant (c_act = c_orc = 1 on
every step), and all 10 escalations of rejected steps were triggered by a rule that zeroes confidence for
self-referential attribute assertions (e.g. an `href` expected to contain "href"), added after the pilot. Without that
rule, min(c_act, c_loc, c_orc) did not discriminate (κ = 0.01; 9 of 19 auto-accepted steps rejected, versus 10 of 21
with no gate). Pooled over the five retrieval configurations (112 occurrences), the gate reached κ = 0.79 with 6 of 59
auto-accepted steps rejected (10.2%, [4.7, 20.5]), and κ = −0.03 without the rule. Between 33% and 46% of steps in each
configuration were judged irrelevant or tautological. Verified task success was 29.4% for the full configuration and
0% without retrieval (Δ = −29.4 pp, bootstrap 95% CI [−52.9, −11.8]; exact McNemar p = 0.31 after Holm correction);
no other ablation differed detectably (|Δ| ≤ 11.8 pp). No configuration detected the one naturally occurring defect
in the scenario set. The author's failure classification agreed with the independent rater at κ = 0.65 (16/19).

**Robustness: repetitions and a larger model.** We repeated all six configurations three times with Qwen3 4B and
three times with Qwen3 8B (510 scenario runs; 16 lost to infrastructure time-outs and treated as missing). Scenario
outcomes were stable across repetitions (the range of automatic success across repetitions was at most 10.6 pp per configuration), although
step sequences were not always identical despite temperature 0. Without retrieval no scenario succeeded in any
repetition of either model. Across the three 4B repetitions the component analysis held: the gate agreed with
reviewers at κ = 0.82 with the self-referential rule and κ = 0.02 without it. With the 8B model, automatic success rose
to 56–80%, but the self-referential rule never fired (0% of 454 steps, versus 39% for 4B), c_act and c_orc remained
effectively constant, and 84% of steps were auto-accepted (46% for 4B). In 9 of 15 retrieval runs the 8B agent declared
the scenario with the real login defect successful by asserting only that the login heading was visible, without
entering any credentials. Higher automatic success thus coincided with a masked defect. The 8B steps were not rated by
humans, so we report only these objective measures for that model.

**Threats to validity.** The escalation reviewer used in all unattended runs was a mechanical stub, so success rates
are conditional on it and decision time and the effect of reviewer memory were not measured. With 17 scenarios and
one defect the ablation is exploratory and reports effect sizes with intervals. Reviewers are colleagues of the
author, which may bias ratings towards acceptance; blinding limits but cannot remove this. One stricter defect-
detection rule was introduced after inspecting the data and is reported as a sensitivity analysis. The gate's
agreement with reviewers rests on a single post-pilot heuristic for one failure mode of a 4B model; the confidence
components and the threshold τ = 0.8 were not calibrated, so the gate result should not be generalised to other
models or step types; with a larger model the rule never fired and the remaining signals did not hold back steps
that masked a defect. Only one additional model size from the same family was tested, and its steps were not rated
by humans. A single QA
practitioner timed the manual baseline on a phone against the production site, having previously seen RAQA output;
we therefore report it as a pilot and make no speed-up claim.

## 5. Sumber data
- `review/analysis.md`, `review/analysis.json` (Tabel H1, H2, H3, H3-K, A1, A1-S)
- `review/step-ratings-R1..R3.csv`, `review/scenario-ratings-R1..R3.csv` (ID reviewer anonim; pemetaan tidak disimpan di repo)
- `review/h0-sheet-R2.csv`, `review/h0-final-overrides.csv`, `review/h0-KEY-jangan-dibagikan.json`
- `review/manual-timing.csv`, `review/manual-timing-provenance.json`
- `runs/abl-A0 … abl-A7/` (`results.json`, `summary.json`), `runs/abl-manifest.json`
- `review/analysis-repeats.md`, `review/analysis-repeats.json` (pengulangan dan model 8B; `scripts/analyze-repeats.js`)
- `runs/abl4b-r2-*`, `runs/abl4b-r3-*`, `runs/abl8b-r1-*` … `abl8b-r3-*`, `runs/repeats-manifest.json` (screenshot tidak
  disertakan)
- `instrumen/` — templat kosong (H1, H0, studi waktu, keterangan penguji). Tautan screenshot di templat H1 mengacu ke
  `shots/L###.png` yang tidak disertakan; screenshot asli ada di `review/shots/`.
- `scenarios/prereg-ablation.json`, `scenarios/ground-truth.json`
