# Hasil Eksperimen HITL & Ablasi RAQA — Kesimpulan

Dokumen ini diselaraskan dengan naskah JUITA versi 27 Oktober 2026, berjudul
**"Offline Human Review Reveals Overstated Success and Confidence Signals in an LLM Web Testing Agent"**.
Bila ada perbedaan antara dokumen lama di repo ini dan naskah, yang berlaku adalah naskah dan dokumen ini.

Semua angka berasal dari berkas di repo ini. Cara menghitung ulang setiap tabel dan gambar ada di
[`REPLICATION.md`](../REPLICATION.md). Aplikasi yang diuji: instance lokal SIMASIS pada commit `91db4a96`
(dibekukan; lihat `scenarios/ground-truth.json`). Model: Qwen3 4B lokal (`qwen3:4b`, Q4_K_M, Ollama 0.33.3),
temperature 0, seed 42, τ = 0,8. Uji ketahanan (bagian 3, "Uji ketahanan"): keenam konfigurasi diulang tiga kali
dengan Qwen3 4B (run asli + 2 pengulangan) dan tiga kali dengan Qwen3 8B. Uji ini **tidak dipra-registrasi**.

Sumber angka:
- `raqa/review/analysis.md` (dari `raqa/scripts/analyze-hitl.js`): endpoint pra-registrasi, Δ, p Holm, Tabel H3-K.
- `reanalysis/` (skrip Python): endpoint correct-oracle, cakupan semua kriteria, gate pada 57 langkah unik
  (Tabel IV naskah), reliabilitas label (Tabel V naskah), Gambar 2.
- `raqa/review/analysis-repeats.md` (dari `raqa/scripts/analyze-repeats.js`) dan `reanalysis/repeats_unique.json`
  (dari `reanalysis/repeats_unique.py`): pengulangan dan model 8B.

## 1. Kesimpulan singkat

| Pertanyaan | Jawaban berdasarkan data | Kekuatan bukti |
|---|---|---|
| Apakah status "selesai" dari agen bisa dipercaya? | Sebagian. Skenario yang selesai biasanya terkonfirmasi (TSR otomatis = TSR correct-oracle di 5 dari 6 konfigurasi), tetapi hanya 1 skenario (2 di A7) yang semua kriteria penerimaannya tercakup. Yang berlebihan adalah **kelengkapan**, bukan keberhasilan palsu | Kuat untuk pola; n = 17 skenario |
| Apakah gate tahu kapan harus bertanya ke manusia? | Ya, tetapi bukan karena skor keyakinan. A0: κ = 0,905 (21 langkah). 57 langkah unik dari lima konfigurasi ber-retrieval: κ = 0,747, dan 4 dari 24 langkah yang lolos otomatis tidak diterima penilai. Kesepakatan ini berasal dari aturan self-referential; tiga sinyal tanpa aturan itu: κ = 0,009 (A0) dan −0,059 (57 langkah unik) | Kuat untuk "sinyal keyakinan tidak berkontribusi"; n kecil |
| Apakah retrieval diperlukan? | **Tidak bisa disimpulkan dari studi ini.** Tanpa retrieval, setiap langkah bernilai 0 dan ditolak stub, jadi A1 tidak mungkin menyelesaikan skenario (0% di semua pengulangan, 4B dan 8B, juga karena desain ini). A0 vs A1 membandingkan dua kebijakan utuh, bukan efek retrieval saja. Kualitas langkah A0 dan A1 mirip (11/21 vs 7/15 langkah diterima) | Lemah |
| Apakah hasil stabil bila run diulang? | Pada tingkat skenario cukup stabil (12–17 skenario per konfigurasi bernasib sama di ketiga pengulangan), tetapi urutan langkah tidak selalu sama walaupun temperature 0. Pada 4B, kesepakatan gate di tiga pengulangan sama polanya: 59 langkah unik berlabel, κ gate penuh 0,756, tanpa aturan self-referential −0,057 | Sedang; eksploratif, tidak dipra-registrasi |
| Apakah temuan gate bertahan pada model lebih besar? | Polanya bergeser. Qwen3 8B tidak pernah memicu aturan self-referential (0 dari 454 langkah; 4B 133 dari 340), c_act dan c_orc tetap hampir konstan, dan gate meloloskan 381 dari 454 langkah (4B 155 dari 340). Pada 9 dari 15 run ber-retrieval, 8B menyatakan skenario cacat S-AUTH-03 **lulus** | Kuat untuk ukuran objektif; langkah 8B belum dinilai manusia |
| Apakah keluaran agen andal? | Belum. 33,3–45,8% langkah dinilai tidak relevan atau tautologis | Sedang (kesepakatan penilai moderat) |
| Komponen retrieval mana yang paling berkontribusi? | Tidak terbedakan. Tidak ada beda yang tetap signifikan setelah koreksi Holm | Daya uji rendah (n = 17) |
| Apakah agen menemukan cacat nyata? | Tidak. Tidak ada konfigurasi yang menemukan cacat S-AUTH-03 dengan oracle yang benar; suite buatan tangan menemukannya. Pada 8B cacat ini malah tertutupi (lihat atas) | Hanya 1 cacat di 17 skenario |
| Apakah label manusia stabil? | Moderat. α keputusan = 0,481 (di bawah 0,667); sebagian besar ketidaksepakatan dari satu penilai (R3) | Label mayoritas = acuan, bukan ground truth stabil |
| Apakah klasifikasi kegagalan baseline konsisten? | Ya. κ = 0,648 (16 dari 19) | Sedang (1 rater kedua) |

**Klaim yang sudah dihapus dari naskah dan tidak boleh muncul lagi di repo:** "Reliable" pada judul; agen atau gate
"dapat dipercaya"; run "deterministik" karena temperature 0; retrieval "meningkatkan" keberhasilan; kolaborasi
manusia–agen yang diukur; TSR terverifikasi sebagai "batas bawah"; uji Fisher untuk perbandingan staging dan lokal
(diganti McNemar eksak berpasangan).

## 2. Alur item

| Tahap | Jumlah | Catatan |
|---|---|---|
| Episode (skenario × konfigurasi) | 102 | 17 skenario × 6 konfigurasi |
| Kemunculan langkah | 133 | deskripsi log, bukan observasi independen |
| Langkah unik yang dinilai | 70 | digabung hanya di dalam skenario yang sama (skenario + langkah identik) |
| Langkah unik dari lima konfigurasi ber-retrieval | 57 | unit analisis gate (Tabel IV naskah); A1 tidak dihitung |
| Kemunculan self-referential (di luar A1) | 46 | semuanya `expectAttribute`, semuanya ditolak mayoritas |
| Episode dengan skrip | 30 | menjadi 22 skrip unik yang dinilai |

Unit analisis: skenario untuk keberhasilan tugas, langkah unik untuk kesepakatan gate.

## 3. Hasil per studi

### RQ1 — Baseline suite (B1)
- Staging: 12 dari 101 test flaky (11,88%). Lokal: 1 dari 101 (0,99%). Uji McNemar eksak berpasangan: 12 vs 1,
  p = 0,0034 (`reanalysis/baseline_mcnemar.py`).
- Fault: 8 dari 25 terdeteksi (32%, Wilson 17,2–51,6%). Agen **tidak** dijalankan pada fault, jadi tidak ada
  perbandingan deteksi fault antara agen dan suite.

### H0 — rater kedua untuk klasifikasi 19 kegagalan baseline
- κ sebelum diskusi = **0,648**; sepakat 16 dari 19.
- Tidak sepakat: F01 (S-AUTH-03), F04 (S-HOME-05 tampilan HP), F18 (S-QUAL-01). Setelah diskusi dengan bukti uji ulang:
  F01 dan F18 tetap cacat aplikasi; F04 dikoreksi menjadi kesalahan pengecekan (artikel terbuka 10 dari 10 di HP).
- Klasifikasi final: product 5 test (4 penyebab), test 13, timing 1, environment 0. Kesepakatan akhir 19 dari 19
  adalah hasil diskusi, bukan κ independen kedua.

### RQ2 — Keberhasilan otomatis vs terverifikasi (Tabel III naskah)

| Konfigurasi | TSR otomatis | Pra-registrasi | Correct-oracle (utama, post hoc) | Δ correct-oracle vs A0 [CI 95%] | p Holm | Semua kriteria tercakup | Langkah diterima |
|---|---|---|---|---|---|---|---|
| A0 Full | 29,4% | 29,4% | 29,4% | – | – | 1 | 11/21 |
| A1 tanpa retrieval | 0% | 0% | 0% | −29,4 [−52,9; −11,8] | 0,313 | 0 | 7/15 |
| A2 tanpa katalog | 29,4% | 17,6% | 17,6% | −11,8 [−29,4; 0,0] | 1,000 | 1 | 11/23 |
| A3 tanpa trace | 29,4% | 29,4% | 29,4% | 0,0 [0,0; 0,0] | 1,000 | 1 | 12/21 |
| A6 BM25 saja | 29,4% | 35,3% | 29,4% | 0,0 [0,0; 0,0] | 1,000 | 1 | 11/24 |
| A7 dense saja | 35,3% | 35,3% | 35,3% | +5,9 [0,0; 17,6] | 1,000 | 2 | 14/23 |

- Δ: bootstrap persentil atas skenario, tidak disesuaikan per perbandingan. p Holm: McNemar eksak, disesuaikan atas
  lima perbandingan. "Langkah diterima": penyebut tanpa langkah yang tidak punya mayoritas.
- **Tiga endpoint.** (1) Pra-registrasi: skenario harus-PASS terverifikasi bila agen selesai dan mayoritas menilai
  skripnya menguji minimal satu kriteria; skenario harus-FAIL bila agen gagal pada assertion yang dinilai relevan.
  (2) Correct-oracle: sama, ditambah ekspektasi assertion harus dinilai benar. Aturan ini dibuat **setelah** melihat
  data (post hoc), tetapi dipakai sebagai endpoint utama. (3) Semua kriteria tercakup.
- Correct-oracle hanya mengubah A6: S-AUTH-03 gagal pada assertion yang mengecek nilai field password berisi "clear",
  padahal field kosong. Kegagalan itu karena ekspektasi keliru, bukan karena pesan error yang hilang.
- Label kebenaran ekspektasi berkesepakatan rendah (α = 0,296) dan **belum diadjudikasi** oleh pemeriksa independen.
  Jejak setiap keberhasilan ada di `appendix/verified_success_trace.csv`.
- **Asal status "selesai".** Ke-26 episode yang selesai semuanya dihentikan oleh aturan pengulangan di
  `raqa/src/agent.js`: bila langkah yang sudah diterima diusulkan lagi persis sama, harness menganggap tujuan tercapai
  (catatan `auto-done: pengulangan step identik` di log). Planner tidak pernah menyetel `done = true` (0 dari 133
  langkah). Jadi "TSR otomatis" adalah sinyal selesai dari sistem (planner + harness), bukan pernyataan planner.
  Dihitung oleh `reanalysis/endpoints_and_trace.py`.
- Setiap skenario dimulai dari halaman awal tetap sesuai fiturnya (`startPath`, tidak diusulkan LLM).
- Pengecualian otomatis = pra-registrasi ada di A2 dan A6 (empat dari enam konfigurasi sama).
- Agen berhenti di langkah pertama yang ditolak pada S-AUTH-03 di lima konfigurasi.

### RQ3 — Gate (Tabel IV dan Gambar 2 naskah)

**A0 (21 langkah dengan mayoritas).** Penilai tidak menerima 10 langkah; gate mengeskalasi kesepuluhnya, plus 1 langkah
yang diterima penilai. Tidak ada dari 10 langkah lolos-otomatis yang ditolak. κ = 0,905; cakupan 10/21; galat
lolos-otomatis 0/10 (Clopper–Pearson 0–30,8%). Bila langkah yang terkena undian audit dihitung sebagai eskalasi
(definisi lama di Tabel H3 `analysis.md`), κ = 0,811. Peluang menangkap kesepuluh langkah bila 11 dari 21 dipilih acak:
3,1 × 10⁻⁵. Ini perhitungan kondisional, bukan eksperimen dengan gate acak di dalam loop.

**57 langkah unik dari lima konfigurasi ber-retrieval** (`reanalysis/table_iv_unique.json`):

| Varian gate | κ | Recall eskalasi | Galat lolos-otomatis [CP 95%] | Cakupan |
|---|---|---|---|---|
| Gate penuh (sesuai kode) | 0,747 [bootstrap skenario 0,474; 0,961] | 30/34 | 4/24 = 16,7% [4,7; 37,4] | 42,1% |
| Aturan self-referential saja | 0,824 | 29/34 | 5/28 = 17,9% [6,1; 36,9] | 49,1% |
| min(c_act, c_loc, c_orc) tanpa aturan | −0,059 [−0,243; 0,047] | 2/34 | 32/52 = 61,5% [47,0; 74,7] | 91,2% |
| c_loc saja | −0,083 | 1/34 | 33/53 = 62,3% [47,9; 75,2] | 93,0% |
| c_act saja | 0,024 | 1/34 | 33/56 = 58,9% [45,0; 71,9] | 98,2% |
| c_orc saja / terima semua | 0,000 | 0/34 | 34/57 = 59,6% [45,8; 72,4] | 100% |

Peluang gate acak dengan anggaran sama menangkap ≥ 30 dari 34 langkah yang tidak diterima: 1,1 × 10⁻⁸ (kondisional).

**Kenapa gate sepakat dengan penilai.**
- c_orc = 1 pada seluruh 133 kemunculan. c_act = 1 di semua konfigurasi ber-retrieval kecuali satu langkah di A2.
  Akibatnya c_t hanya punya enam nilai berbeda.
- Di A0, 12 eskalasi: 10 karena aturan self-referential (semuanya tidak diterima penilai), 2 karena c_loc (satu diterima,
  satu tanpa mayoritas).
- Di luar A1, aturan self-referential aktif pada 46 kemunculan, semuanya `expectAttribute`, semuanya ditolak mayoritas.
- Empat langkah unik yang lolos gate tetapi tidak diterima penilai: tiga mengecek tautan pendaftaran di skenario smoke
  yang kriterianya tentang judul dan heading halaman, satu mengecek field password berisi "clear". Masalahnya relevansi;
  tidak ada sinyal gate yang membandingkan langkah dengan kriteria penerimaan.

**Ambang τ.** Pada A0, semua τ di atas 0,3 sampai 0,925 memberi keputusan yang sama dengan τ = 0,8, dan κ tetap 0,717–1,0
untuk semua ambang, dengan galat lolos-otomatis nol. Pada 57 langkah unik, keputusan sama untuk τ di atas 0,7 sampai
0,925; menurunkan τ hanya meloloskan langkah yang memang diterima penilai (galat lolos-otomatis tetap 4).

**Batas tafsir.** Analisis varian gate menilai ulang langkah yang sudah tercatat. Ini menunjukkan kontribusi tiap bagian
gate terhadap keputusan pada langkah itu, **bukan** performa gate pengganti bila dipasang saat agen berjalan (agen bisa
mengambil langkah, menyelesaikan skenario, dan menghasilkan skrip yang berbeda).

**Tabel H3-K di `analysis.md`.** Tabel itu menghitung **kemunculan** gabungan (n = 112; κ gate penuh 0,785; galat 6/59;
tanpa aturan κ −0,027). Angkanya sah tetapi satu langkah bisa terhitung beberapa kali. Naskah memakai **langkah unik**
(n = 57). Jangan mencampur kedua set angka dalam satu klaim.

**Asal aturan self-referential.** Aturan ini ada di `raqa/src/agent.js` sejak commit pertama repo (`0eda785`,
22 September 2026) dan sudah aktif pada run pilot `raqa/runs/raqa-v3`. Jadi aturan ini dibuat saat pengembangan pilot,
untuk pola kegagalan Qwen3 4B yang menaruh nama atribut sebagai nilainya, dan sudah ada sebelum pre-registrasi
(`7b08f79`, 23 September 2026, 21.45 WIB) dan sebelum semua run ablasi. Aturan ini tidak dijelaskan di versi naskah
sebelumnya (JSC) dan sekarang menjadi Persamaan (5).

**Parameter gate lain.** Stub menerima langkah bila c_t ≥ τ − 0,2 (= 0,6) dan menolak bila tidak. Audit acak 5%
(seed 1) aktif di setiap run. φ_hist dihitung dari memori locator di dalam satu run: setiap konfigurasi memakai folder
memori terpisah dan `--no-persist` (`raqa/scripts/run-ablation.js`).

### Uji ketahanan: pengulangan dan model lebih besar (eksploratif, tidak dipra-registrasi)

Sumber: `review/analysis-repeats.md`, `runs/repeats-manifest.json`, `../reanalysis/repeats_unique.json`.

**Cara run.** Qwen3 4B pengulangan 1 = run asli (`abl-*`, 23 September). Pengulangan 2–3 (`abl4b-r2/r3-*`) dan Qwen3 8B
pengulangan 1–3 (`abl8b-r1/r2/r3-*`) dijalankan 26–27 Oktober 2026 pada salinan beku SIMASIS `91db4a96`, dengan
pengaturan agen yang sama. Perbedaan dengan run asli:
- kode agen di commit `92ede45`: batas 5 menit per panggilan model (run asli tanpa batas), dan skenario yang halaman
  awalnya gagal dimuat ditandai sebagai error infrastruktur;
- server `php artisan serve` diberi `PHP_CLI_SERVER_WORKERS=4` mulai sesi 27 Oktober 04.33;
- rencana run ulang **tidak di-commit sebelum run** (tidak ada pre-registrasi), dan analisisnya dibuat setelah hasil
  run asli diketahui.

**Keberhasilan otomatis** (selesai / skenario yang bisa dinilai; skenario dengan error infrastruktur dikeluarkan:
4B 6 dan 8B 10 dari 510 eksekusi skenario):

| Konfigurasi | 4B rep 1 / 2 / 3 | 8B rep 1 / 2 / 3 |
|---|---|---|
| A0 | 5/17, 5/17, 5/17 | 13/17, 12/15, 13/17 |
| A1 | 0/17, 0/17, 0/17 | 0/17, 0/17, 0/17 |
| A2 | 5/17, 4/17, 5/17 | 11/17, 11/16, 12/17 |
| A3 | 5/17, 5/17, 6/15 | 12/16, 13/17, 11/16 |
| A6 | 5/17, 5/14, 4/16 | 10/17, 9/16, 10/15 |
| A7 | 6/17, 6/17, 6/17 | 12/17, 12/16, 11/16 |

Persentase di `analysis-repeats.md` memakai penyebut tanpa error infrastruktur (misalnya A3 4B rep 3 = 6/15 = 40,0%).
Ini keberhasilan **otomatis** (dengan stub), bukan terverifikasi manusia.

**Ukuran objektif** (konfigurasi ber-retrieval, semua pengulangan):

| Ukuran | Qwen3 4B | Qwen3 8B |
|---|---|---|
| Langkah | 340 | 454 |
| Langkah self-referential | 133 (39,1%) | 0 |
| Lolos otomatis oleh gate | 155 (45,6%) | 381 (83,9%) |
| Nilai c_act / c_orc yang muncul | {0, 1} / {1} | {0, 1} / {1} |
| Status "selesai" dari aturan pengulangan | 77 dari 77 | 172 dari 172 |
| S-AUTH-03 dinyatakan PASS (cacat tertutupi) | 0 dari 15 run | 9 dari 15 run |

- **8B dan S-AUTH-03.** Di A0, A3, dan A7 pada ketiga pengulangan, 8B mengusulkan `expectVisible heading "Selamat
  Datang"` dua kali tanpa pernah mengisi kredensial. Gate meloloskannya (c_t = 1), aturan pengulangan menyatakan selesai,
  dan skenario cacat tercatat PASS. Di A2, vonisnya FAIL, tetapi karena assertion yang tidak terkait (`aria-label`
  tombol Masuk), bukan karena pesan error yang hilang.
- **Gate 4B lintas pengulangan, unit langkah unik** (sama dengan Tabel IV naskah): 84 langkah unik, 63 identik dengan
  item yang sudah dinilai, 59 punya mayoritas, 21 belum pernah dinilai. Gate penuh κ = 0,756 (galat lolos-otomatis 4/25);
  tiga sinyal tanpa aturan κ = −0,057 (33/54); aturan self-referential saja κ = 0,830 (5/29). Versi gabungan kemunculan
  di `analysis-repeats.md` (294 kemunculan; κ 0,823 / 0,016 / 0,890) menghitung langkah yang sama berkali-kali.
- **8B belum dinilai manusia.** Tidak satu pun dari 107 langkah unik 8B identik dengan langkah yang sudah dinilai,
  sehingga κ gate dan keberhasilan terverifikasi untuk 8B belum ada.
- Waktu: 8B kira-kira dua kali lebih lambat (A0 15,7–17,5 menit per 17 skenario; 4B 8,6–12,8 menit).
- Versi model 8B (ID Ollama) belum tercatat di repo.

### RQ4 — Reliabilitas label manusia (Tabel V naskah)

| Penilaian | Krippendorff α [CI 95%] | Gwet AC1 [CI 95%] |
|---|---|---|
| Relevansi langkah (ordinal) | 0,618 [0,470; 0,744] | – |
| Keputusan langkah (terima/edit/tolak) | 0,481 [0,361; 0,595] | 0,560 [0,430; 0,688] |
| Diterima vs tidak diterima | 0,495 [0,336; 0,642] | 0,584 [0,431; 0,732] |
| Ekspektasi benar | 0,296 [0,144; 0,437] | 0,353 [0,174; 0,530] |
| Kriteria yang dicakup skrip | 0,720 [0,550; 0,861] | – |

- Fleiss κ keputusan = 0,479. κ berpasangan untuk keputusan: R1–R2 0,754; R1–R3 0,380; R2–R3 0,355.
- R3 menerima 12 langkah; R1 dan R2 menerima 34 dan 26.
- 5 dari 70 langkah tanpa mayoritas karena tiga penilai memilih terima, edit, dan tolak.
- CI di tabel ini dari `reanalysis/gate_irr_reanalysis.py`. `analysis.md` memakai bootstrap lain, sehingga batas CI
  sedikit berbeda (misalnya relevansi [0,474–0,743]); nilai α-nya sama.
- Penilai tidak melihat unit yang dikutip agen, jadi penilaian mereka menilai langkahnya sendiri, bukan apakah
  retrieval mendukungnya.

## 4. Seleksi berkas penilai

Sebelum menerima berkas ketiga dari satu penilai, dua berkas awal dari penilai itu disisihkan: berkas pertama memberi
jawaban yang sama untuk semua item; berkas kedua sama dengan berkas penilai lain pada 65 dari 70 jawaban. Kesamaan
itu alasan untuk memeriksa independensi, **bukan bukti penyalinan**; karena independensi tidak bisa dikonfirmasi,
berkas itu tidak dipakai. Satu berkas lain disisihkan dengan alasan yang sama. Keputusan ini dibuat saat berkas
diterima dan tidak ada di pre-registrasi. Ledger anonim (jumlah orang unik, urutan pengiriman, siapa yang memutuskan,
prosedur menjaga independensi) belum lengkap di repo dan akan ditambahkan sebagai `raqa/review/rater-ledger.csv`.
Satu penilai ikut H1 dan H0.

## 5. Deviasi dari pre-registrasi dan analisis post hoc

| Item | Status |
|---|---|
| Endpoint correct-oracle | Post hoc; dipakai sebagai endpoint utama, endpoint pra-registrasi tetap dilaporkan |
| Kolom "semua kriteria tercakup" | Post hoc |
| Analisis gate per sinyal dan per aturan | Post hoc; ditambahkan setelah terlihat bahwa satu skor tidak pernah berubah |
| Analisis 57 langkah unik | Post hoc |
| Seleksi berkas penilai | Diputuskan saat berkas diterima |
| Konfigurasi A4 (tanpa catatan cacat) | Tidak dijalankan |
| H2 (sesi review interaktif) | Tidak dijalankan; semua eskalasi dijawab stub, review manusia dilakukan offline |
| Studi waktu manual | Dikumpulkan tetapi **tidak dilaporkan di naskah** (lihat bagian 7) |
| Pengulangan 4B dan model 8B | Tidak dipra-registrasi; dijalankan setelah hasil asli diketahui, dengan kode yang sedikit berubah (batas waktu model, penanganan error infrastruktur) |

## 6. Keterbatasan yang wajib ada di naskah
1. Reviewer eskalasi adalah stub mekanis. TSR dan laju eskalasi bergantung pada aturan stub. Waktu, upaya, dan
   ketergantungan reviewer tidak diukur.
2. Analisis utama (Tabel III–V) memakai satu run per konfigurasi. Pengulangan (tidak dipra-registrasi) menunjukkan
   hasil tingkat skenario cukup stabil, tetapi urutan langkah berubah walaupun temperature 0.
3. n = 17 skenario, satu cacat nyata, 21 langkah A0: hanya efek besar yang bisa terdeteksi. Ablasi bersifat eksploratif.
4. Penulis pertama mengembangkan SIMASIS dan merancang test, fault, dan agen. Penilai buta dan rater kedua mengurangi
   bias ini, tetapi penilai adalah rekan kerja penulis.
5. Kesepakatan keputusan penilai di bawah ambang Krippendorff; kebenaran ekspektasi belum diadjudikasi.
6. Analisis gate dan aturan correct-oracle post hoc; analisis gate menilai ulang log, bukan menjalankan ulang agen.
7. Satu browser. Analisis utama memakai satu model kecil (Qwen3 4B). Pada Qwen3 8B aturan self-referential tidak
   pernah aktif, sehingga gate tinggal bergantung pada sinyal yang tidak diskriminatif dan meloloskan 84% langkah,
   termasuk langkah yang menutupi cacat. Langkah 8B belum dinilai manusia.
8. Kode dan database SIMASIS tidak publik: angka bisa dihitung ulang dari log, tetapi agen tidak bisa dijalankan ulang
   oleh pihak luar.

## 7. Data tambahan yang tidak dilaporkan di naskah

**Studi waktu manual (1 penguji, pendahuluan).** 17 skenario, total 410 detik (6,8 menit), median 23 detik, rentang
11–47 detik; semua PASS. Agen A0: total 8,6 menit, 5 dari 17 selesai. Penguji memakai HP dan situs produksi, pernah
melihat keluaran RAQA, dan pada S-AUTH-03 mengisi username sehingga cacat (email) terlewat. Karena kondisi berbeda,
tidak ada rasio kecepatan yang boleh diklaim. Detail: `review/manual-timing-provenance.json`.

**Run lanjutan.** Hasil pengulangan dan model 8B ada di bagian 3 ("Uji ketahanan"). Untuk run berikutnya, commit
rencananya lebih dulu sebagai pre-registrasi, lalu bandingkan dengan `scripts/analyze-repeats.js` atau
`python3 -I scripts/compare_runs.py abl <prefix-baru> --ref abl` (dari folder `raqa/`).

## 8. Sumber data
- `review/analysis.md`, `review/analysis.json` (Tabel H1, H2, H3, H3-K, A1, A1-S)
- `../reanalysis/reanalysis.json`, `../reanalysis/table_iv_unique.json`, `../reanalysis/fig_data.json`
- `../appendix/verified_success_trace.csv`, `../appendix/example_traces.md`
- `review/step-ratings-R1..R3.csv`, `review/scenario-ratings-R1..R3.csv` (ID penilai anonim; pemetaan tidak disimpan di repo)
- `review/h0-sheet-R2.csv`, `review/h0-final-overrides.csv`, `review/h0-KEY-jangan-dibagikan.json`
- `review/manual-timing.csv`, `review/manual-timing-provenance.json`
- `runs/abl-A0 … abl-A7/` (`results.json`, `summary.json`), `runs/abl-manifest.json`
- `review/analysis-repeats.md`, `review/analysis-repeats.json`, `../reanalysis/repeats_unique.json`
- `runs/abl4b-r2-*`, `runs/abl4b-r3-*`, `runs/abl8b-r1-*` … `abl8b-r3-*`, `runs/repeats-manifest.json` (screenshot
  pengulangan tidak disertakan)
- `instrumen/` — templat kosong (H1, H0, studi waktu, keterangan penguji). Tautan screenshot di templat H1 mengacu ke
  `shots/L###.png` yang tidak disertakan; screenshot asli ada di `review/shots/`.
- `../scenarios/prereg-ablation.json`, `../scenarios/ground-truth.json`
