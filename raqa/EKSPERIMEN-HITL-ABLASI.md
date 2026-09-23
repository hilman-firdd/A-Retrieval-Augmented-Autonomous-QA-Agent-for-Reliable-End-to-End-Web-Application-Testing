# Runbook Eksperimen: Human-in-the-Loop & Ablasi RAQA

Runbook ini menjawab masukan pembimbing: *"perlu diperkuat dengan pengujian yang melibatkan reviewer manusia
(Human-in-the-Loop), dan studi ablasi untuk melihat kontribusi masing-masing atribut."*

Ada tiga studi manusia dan satu studi ablasi:

| Studi | Pertanyaan | Siapa | Waktu |
|---|---|---|---|
| **H0** | Apakah klasifikasi 19 kegagalan (Tabel 4) konsisten bila dinilai orang lain? | 1 rekan QA | ±30 menit |
| **Ablasi** | Seberapa besar kontribusi tiap sumber pengetahuan & jenis retriever? | Otomatis | ±1 jam (lihat Langkah 4) |
| **H1** | Apakah langkah & skrip agen benar menurut manusia? Apakah gate RAQA tahu kapan harus bertanya? | 3 rekan QA, buta | ±2–3 jam per orang |
| **H2** (opsional) | Berapa lama reviewer memutuskan, dan apakah memori reviewer membantu run berikutnya? | 1–2 rekan QA, interaktif | ±1 jam |

Semua angka di paper harus berasal dari file yang dihasilkan langkah-langkah di bawah. Jangan mengisi tabel dengan perkiraan.

---

## Langkah 0 — Persiapan (sekali)

```bash
git pull                       # atau: git pull raqa-hitl-ablation.bundle hitl-ablation (lihat README bundle)
cd raqa && npm install
cp .env.example .env           # isi BASE_URL=http://127.0.0.1:8000 dan RAQA_ARTICLE_PATH
```

1. **Bekukan versi SIMASIS.** Catat commit SIMASIS di `scenarios/ground-truth.json` (`appCommit`).
   **Jangan memperbaiki 4 cacat di ground-truth.json sampai semua eksperimen selesai**, karena jawaban benarnya akan berubah.
2. **Tinjau `scenarios/prereg-ablation.json`.** Setujui daftar 17 skenario IN, lalu commit. Setelah itu daftar ini tidak boleh diubah.
3. **Isi `RAQA_ARTICLE_PATH`** dengan path satu artikel yang pasti ada di instance lokal (titik mulai S-NEWS-06/07).
4. **Arsipkan memori lama.** `raqa/.memory/reviewer-verdicts.jsonl` berisi 9 keputusan stub dari pilot (bukan manusia).
   Kode baru sudah menolaknya dari korpus, tetapi lebih rapi dipindahkan:
   `git mv raqa/.memory/reviewer-verdicts.jsonl raqa/.memory/archive-pilot-stub-verdicts.jsonl`

## Langkah 1 — Verifikasi alat (5 menit, tanpa Ollama)

```bash
npm run verify-wiring          # harus: SEMUA PEMERIKSAAN LULUS
pip install krippendorff statsmodels scipy scikit-learn
npm run verify-stats           # harus: SEMUA COCOK
```

Kalau salah satu gagal, **berhenti** dan laporkan outputnya.

## Langkah 2 — H0: rater kedua untuk Tabel 4 (30 menit, bisa paralel dengan Langkah 3–4)

```bash
node scripts/h0-failure-classification.js template
```

Berikan `review/h0-sheet.csv` ke satu rekan QA (bukan `h0-KEY-jangan-dibagikan.json`). Ia mengisi kolom kategori:
`product` / `test` / `timing` / `environment`, sebaiknya sambil membuka trace Playwright-nya. Setelah kembali:

```bash
node scripts/h0-failure-classification.js analyze review/h0-sheet-<inisial>.csv
```

Hasil: Cohen's κ dan daftar ketidaksepakatan. Ketidaksepakatan diselesaikan lewat diskusi, dan **keduanya** dilaporkan
(κ sebelum diskusi + hasil akhir).

## Langkah 3 — Ablasi, sesi pertama: A0 (±10–15 menit)

Pastikan Ollama berjalan dan instance SIMASIS lokal hidup.

```bash
node scripts/run-ablation.js --ids prereg --configs A0
```

## Langkah 4 — Rencanakan sisa anggaran 1 jam

```bash
node scripts/plan-ablation.js --prefix abl --budget-min 60
```

Perencana memakai durasi **nyata** A0 dari MacBook Anda dan mencetak konfigurasi yang masih muat, sesuai prioritas
(A1, A2, A3, A6, A7 = MUST; A4 = SHOULD). Jalankan perintah yang direkomendasikan, misalnya:

```bash
node scripts/run-ablation.js --ids prereg --configs A1,A2,A3,A6
```

Bila ada MUST yang tidak muat, jalankan di sesi kedua dengan kode dan skenario yang sama. **Jangan mengurangi jumlah
skenario** untuk menghemat waktu.

Opsional (determinisme): `node scripts/run-ablation.js --ids prereg --configs A0 --repeat-a0 1 --prefix abldet`, lalu
bandingkan hasilnya dengan `abl-A0`. Pada temperature 0 hasilnya seharusnya identik.

## Langkah 5 — H1: penilaian buta oleh 3 rekan QA

```bash
node scripts/export-review-items.js --prefix abl
```

Bagikan ke tiap reviewer isi folder `raqa/review/` **kecuali** `KEY-jangan-dibagikan.json`:
`step-sheet.csv`, `scenario-sheet.csv`, `shots/`, `PANDUAN-REVIEWER.md`.

Aturan:
- Tiap reviewer bekerja sendiri, tanpa diskusi, dan tidak diberi tahu konfigurasi mana yang menghasilkan langkah mana.
- Anda (penulis) **tidak** ikut menilai, karena Anda pengembang SIMASIS dan perancang RAQA.
- Adakan sesi kalibrasi 10 menit memakai 3 contoh di PANDUAN-REVIEWER.md, **bukan** item dari lembar penilaian.
- Minta persetujuan tertulis singkat (informed consent) dari setiap reviewer; contoh ada di dokumen rancangan eksperimen.

Simpan file kembalian sebagai `review/step-ratings-<inisial>.csv` dan `review/scenario-ratings-<inisial>.csv`.

## Langkah 6 — Analisis

```bash
node scripts/analyze-hitl.js --review-dir review --baseline A0
```

Output `review/analysis.md` berisi tabel siap-paper:
- **H1**: reliabilitas antar-reviewer (Krippendorff α + CI bootstrap, Fleiss κ).
- **H2**: kualitas langkah per konfigurasi.
- **H3**: gate vs manusia (κ, recall eskalasi, galat lolos-otomatis).
- **A1**: ablasi (TSR otomatis vs terverifikasi, Δ vs A0 dengan CI, McNemar/Wilcoxon + Holm, "selesai" palsu, cacat tertutupi).

## Langkah 7 (opsional) — H2: sesi interaktif

Round 1 dengan reviewer manusia sungguhan, memakai memori baru yang **disimpan**:

```bash
node scripts/run-scenarios.js --label hitl-R1 --ids <prereg> --reviewer human --memory-dir .memory-hitl --screenshots
```

Round 2 memakai skenario dan memori yang sama (simulasi siklus regresi berikutnya):

```bash
node scripts/run-scenarios.js --label hitl-R2 --ids <prereg> --reviewer human --memory-dir .memory-hitl --screenshots
node scripts/export-review-items.js --prefix hitl --out review-hitl
# ... penilaian buta seperti Langkah 5 ...
node scripts/analyze-hitl.js --review-dir review-hitl --baseline R1
```

Tabel H4 berisi waktu keputusan reviewer (median, IQR). Tabel A1 membandingkan R2 dengan R1: apakah eskalasi turun dan
vonis membaik setelah memori reviewer tersedia. Untuk A5 (− reviewer verdicts), jalankan konfigurasi A5 pada skenario
yang sama dengan memori `.memory-hitl` setelah Round 1.

## Yang dikirim balik untuk mengisi paper

`raqa/runs/abl-*/summary.json`, `raqa/runs/abl-manifest.json`, `raqa/review/analysis.md`, `raqa/review/analysis.json`,
output H0, dan (bila ada) `raqa/review-hitl/analysis.md`. **Jangan** kirim `shots/`, karena ukurannya besar.
