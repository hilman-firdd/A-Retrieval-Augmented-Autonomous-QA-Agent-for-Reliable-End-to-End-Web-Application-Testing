# RAQA — implementasi & hasil eksperimen awal (stack offline: Qwen3 4B + Ollama + LangChain + Playwright)

Dokumen ini menjelaskan agen RAQA di folder `raqa/`: arsitektur lengkap (bukan lagi cuma pondasi), parameter desain, dan **hasil eksperimen sungguhan** dengan Qwen3 4B pada 6 skenario nyata dari `scenarios/catalog.json`, dibandingkan dengan B2 (agen sama tanpa retrieval). Semua angka di bagian 7 berasal dari run nyata yang tersimpan di `raqa/runs/` dan `results/metrics/raqa-fr/` — tidak ada yang dikarang. Skala eksperimen (6 dari 31 skenario) jauh lebih kecil dari cakupan B1; ini dijelaskan gamblang di bagian 9.

## 1. Keputusan bahasa: JavaScript, bukan Python

Spesifikasi awal meminta Python, tetapi sesuai arahan Anda ("kalau bahasanya sudah JavaScript, berarti JavaScript, tetap yang ada"), RAQA ditulis dalam **JavaScript (Node.js, CommonJS)** karena suite B1 sudah JavaScript:

1. **Versi Playwright identik dengan B1** (`playwright@1.56.1`).
2. **Skrip hasil kompilasi RAQA memakai fixture implicit oracle milik B1** (`src/fixtures.js`) apa adanya — dibuktikan di bagian 7.3: skrip RAQA kena RC1 (bucket gambar staging 403) persis seperti B1.
3. **FR RAQA diukur dengan skrip B1 tanpa modifikasi**: `run-repeated.js`, `compute-metrics.js`. Dibuktikan di bagian 7.3.
4. Korpus memakai ulang `scenarios/catalog.json`, trace eksekusi baseline, dan `scripts/lib-results.js`.

Konsekuensi untuk naskah: bagian 4.7 perlu menyebut "RAQA is implemented in JavaScript (Node.js 20.19.0)", dan frasa "Playwright Python script" diganti "Playwright Test script".

## 2. Padanan `requirements.txt` → `raqa/package.json`

Semua versi dikunci **persis** (tanpa `^`).

| Kebutuhan (spesifikasi Python) | Paket JavaScript | Versi |
|---|---|---|
| `playwright` (async API) | `playwright` | 1.56.1 |
| `langchain` | `@langchain/core`, `@langchain/classic` | 1.2.12, 1.0.48 |
| `langchain-ollama` | `@langchain/ollama` | 1.3.0 |
| `langchain-community` (BM25, FAISS, CSVLoader) | `@langchain/community` | 1.1.29 |
| `faiss-cpu` | `faiss-node` | 0.5.1 |
| `langchain-text-splitters` | `@langchain/textsplitters` | 1.0.1 |
| loader dokumen | `TextLoader` + `CSVLoader` + `d3-dsv` | 2.0.0 |
| `pydantic` (skema keluaran) | `zod` | 4.6.5 |
| `python-dotenv` | `dotenv` | 16.4.5 |

`.npmrc` berisi `legacy-peer-deps=true` karena `@langchain/community` meminta Playwright ≥1.58 **hanya sebagai optional peer** untuk loader web yang tidak dipakai; mengikuti permintaan itu akan merusak kesetaraan versi dengan B1.

Prasyarat di luar npm: Ollama 0.33.3 dengan model `qwen3:4b` (ID `359d7dd4bcda`, 4.0B parameter, Q4_K_M) dan `nomic-embed-text` (ID `0a109f422b47`, 137M, dimensi 768).

## 3. Parameter desain

| Parameter | Spesifikasi | Implementasi |
|---|---|---|
| LLM | Qwen3 4B via Ollama, temperature 0.0 | `qwen3:4b`, `temperature: 0`, `seed: 42`, mode berpikir mati |
| Context window LLM | — | `numCtx: 16384` (default Ollama terlalu kecil untuk ARIA snapshot ±15.000 karakter) |
| Embedding | nomic-embed-text atau bge-small | `nomic-embed-text`, lokal via Ollama |
| Text splitting | chunk_size 512, overlap 50 | `RecursiveCharacterTextSplitter`, satuan **karakter** bukan token |
| Vector store | FAISS/Chroma | FAISS (`faiss-node`) |
| Retrieval | Ensemble 50% vector + 50% BM25 | `EnsembleRetriever({ weights: [0.5, 0.5], c: 60 })` = Persamaan (1), κ=60 |
| Top-k per retriever / konteks | k = 5 | 5 per retriever (≤10 gabungan sebelum dipotong), dipotong ke 5 |
| Skor locator φ (Bagian 3 naskah) | "weights are fixed in advance" (nilai tak disebut) | `w_hist=0.5, w_str=0.3, w_vol=0.2` — **pilihan desain saya**, tetap selama run (`src/locatorScore.js`) |
| c_loc | margin dua kandidat locator terbaik | diimplementasikan (bagian 6.2) |
| c_orc | kesepakatan tier oracle | tier implicit (sama seperti B1) vs eksplisit; diimplementasikan (bagian 6.3) |
| Kandidat locator disimpan | 3 terbaik, repair bila #1 gagal | diimplementasikan (`execute()`, dicatat di `this.repairs`) |
| Gate keyakinan τ | — | 0.8, audit acak 5%. **Belum dikalibrasi** — nilai awal |
| Budget aksi per skenario (B, Bagian 4.3 naskah) | `[B]` | 8 (dipakai di eksperimen bagian 7) |
| Sumber data | ./qa_docs/ (.md/.txt/.csv) + korpus historis | lihat bagian 5 |

## 4. Struktur berkas

```
RAQA.md                              dokumen ini
raqa/
  package.json, .npmrc, .env.example
  playwright.compiled.config.js      testDir dikendalikan RAQA_TESTDIR (default raqa/compiled/)
  qa_docs/                           taruh dokumen QA lokal di sini (kosong)
  compiled/                          spec hasil kompilasi manual (demo/offline-check)
  runs/<label>/                      hasil scripts/run-scenarios.js: summary.json, results.json, compiled/
  .memory/                           locator-history.json + reviewer-verdicts.jsonl (memori lintas sesi)
  src/
    config.js                        parameter desain + guard kebocoran kunci jawaban
    agent.js                         kelas RAQAAgent: propose -> score -> gate -> execute -> runScenario
    retrieval.js                     KnowledgeBase: splitter, BM25, FAISS, EnsembleRetriever
    locatorScore.js                  kandidat locator, phi_str, phi_vol, LocatorMemory (riwayat)
    oracle.js                        ImplicitOracle (sama seperti B1) + skor c_orc
    page.js                          observasi ARIA snapshot + locator toleran glyph ikon (PUA)
    human.js                         reviewer lewat terminal (accept/correct/reject) -- manusia sungguhan
    stubReviewer.js                  pengganti non-interaktif untuk run tanpa pengawasan -- BUKAN data manusia
    compiler.js                      langkah terverifikasi -> spec Playwright deterministik
    sources/local.js                 loader qa_docs + katalog + trace + defect README + reviewer-verdicts
  scripts/
    offline-check.js                 uji wiring tanpa Ollama (persistMemory:false, tidak mencemari .memory/)
    demo.js                          satu langkah interaktif dengan Qwen3 (--persist opsional)
    run-scenarios.js                 loop skenario penuh atas catalog.json, RAQA atau B2, log lengkap
```

## 5. Sumber pengetahuan

| Sumber | Jenis unit | Jumlah dokumen |
|---|---|---|
| `scenarios/catalog.json` | test case historis (goal + acceptance criteria) | 31 |
| `results/runs/baseline/` (staging, k=10) | trace eksekusi (verdict + error pertama per test) | 101 |
| `README.md`, bagian "Temuan awal" | defect report T1–T5 | 6 |
| `raqa/qa_docs/*.md,*.txt,*.csv` | requirement/test case/bug report/element ID | 0 (folder kosong, sengaja tidak diisi data karangan) |
| `raqa/.memory/reviewer-verdicts.jsonl` | verdict reviewer sesi sebelumnya (memori tumbuh, RQ5) | 9 (dari eksperimen bagian 7) |

**Guard kebocoran kunci jawaban.** `faults/`, `results/runs/fault-*`, `result.md`, `manuscript-claims-verification.md` ditolak masuk korpus (`isExcludedFromCorpus`). Tanpa guard ini, RAQA bisa "membaca" daftar fault yang sedang diuji dan FDR-nya tidak sah.

## 6. Arsitektur yang sudah diimplementasikan dan diverifikasi

### 6.1 Pipeline dasar (retrieval, page representation, kompilasi)

| Uji | Hasil |
|---|---|
| Semua jalur import LangChain/Ollama/FAISS/loader | ada dan termuat (diperiksa satu per satu di source, tidak ditebak) |
| `EnsembleRetriever` sesuai Persamaan (1) | dibaca dari source: `score += w_r / (rank + c)`, `c = 60` |
| Build KB, embedding nomic-embed-text sungguhan | 138 dokumen → 139 chunk (maks 458 karakter ≤ 512), 2,7 detik |
| Guard kebocoran | `faults/faults.csv`, `fault-F01/k01.json`, `result.md` ditolak; katalog diterima |
| Locator toleran glyph PUA | "Daftar PSB": B1 `exact:true` = 0 elemen, RAQA = 1 (href benar) |
| Compiler → spec → harness B1 | dibuktikan berulang kali di bagian 7 dengan skrip hasil kompilasi sungguhan |

### 6.2 Skor locator c_loc (kandidat, phi_str, phi_vol, riwayat)

`src/locatorScore.js` menghasilkan kandidat locator (exact PUA-tolerant, dan varian longgar bila beda), lalu menilai tiap kandidat:

```
skor = w_hist * riwayat_bertahan(role,name) - w_str * phi_str(jumlah_kecocokan) - w_vol * phi_vol(nama)
c_loc = margin(skor#1 - skor#2)  jika ≥2 kandidat, else skor#1 digeser ke [0,1]
```

`phi_vol` mendeteksi teks berubah-ubah (contoh eksplisit di naskah: "kali dibaca", tanggal, harga) lewat pola regex. `phi_str` menghukum kandidat yang hanya bisa dibedakan lewat posisi DOM (perlu `.nth()`), sebanding jumlah pesaing. `riwayat_bertahan` dibaca dari `raqa/.memory/locator-history.json`, diisi tiap kali sebuah locator BERHASIL dieksekusi (click/hover/fill) — di eksperimen bagian 7, semua langkah yang diterima adalah *assertion* (`expectAttribute`/`expectTitle`), bukan interaksi, jadi komponen riwayat ini **belum pernah terisi/aktif** pada run yang ada; perlu skenario dengan klik/isi form untuk menguji riwayat secara nyata.

Tiga kandidat terbaik disimpan; `execute()` mencoba #1 lalu #2/#3 bila gagal, dicatat sebagai *repair* di `this.repairs`. Belum ada kejadian repair di eksperimen bagian 7 (tidak ada kandidat #1 yang gagal saat eksekusi).

### 6.3 Oracle dua tier dan c_orc

`src/oracle.js` memasang listener yang SAMA dengan `src/fixtures.js` milik B1 (pageerror, console-error first-party, HTTP 5xx first-party, request gagal first-party). `c_orc` untuk langkah yang diusulkan = 1 bila tier implicit bersih *saat itu*, 0 bila sudah ada masalah — dasar pemikiran: tidak masuk akal menegaskan sesuatu (tier eksplisit) di atas halaman yang tier implicit-nya sudah menyalakan alarm.

**Nuansa penting (ditemukan lewat pengujian, bagian 7.3):** `c_orc` RAQA menilai kebersihan *pada saat proposal*, sedangkan fixture B1 mengakumulasi isu SEPANJANG test dan menilai di akhir. Karena itu, langkah yang lolos `c_orc=1` saat diusulkan RAQA bisa tetap membuat skrip hasil kompilasinya gagal saat dijalankan lewat harness B1 penuh, jika ada request gambar yang baru gagal belakangan (persis kasus RC1). Ini bukan bug — kedua tier memang mengukur hal yang sedikit berbeda (state sesaat vs akumulasi test) — tapi berarti `c_orc=1` dari RAQA TIDAK menjamin skrip hasil kompilasinya akan selalu lulus di harness B1.

### 6.4 c_t, gate, dan loop skenario penuh

```
c_t = min(c_act, c_loc, c_orc)     (Persamaan 3 naskah)
c_act = 1 jika retrieval aktif DAN semua citedUnits benar-benar ada di unit yang diambil, else 0
```

`runScenario(scenario, maxSteps)`: navigasi awal deterministik (bagian 7.2) → loop usul→skor→gate→eksekusi sampai `done` atau `maxSteps` habis. Gate: terima otomatis bila `c_t ≥ τ` dan tidak terpilih audit acak (5%); selain itu ke reviewer (`human.js` interaktif, atau `stubReviewer.js` untuk run tanpa pengawasan). Keputusan reviewer ditulis ke `.memory/reviewer-verdicts.jsonl` saat `close()` dan ikut jadi unit yang bisa diambil retrieval pada sesi berikutnya (memori tumbuh, RQ5) — **kecuali** `persistMemory:false` diset (dipakai `offline-check.js` dan `demo.js` default, supaya data sintetis/spot-check tidak mencemari memori sungguhan; lihat bug yang ditemukan dan diperbaiki di bagian 7.1).

### 6.5 B2 (baseline tanpa retrieval)

`RAQAAgent({ retrieval: false })`: `kb.retrieve()` selalu mengembalikan `[]`, sehingga `c_act` **selalu 0 by construction** (tidak ada unit untuk dikutip). Ini agen yang SAMA persis (model, page representation, executor) dengan RAQA, isolasi satu-satunya variabel adalah retrieval — sesuai definisi B2 di naskah. Konsekuensi kuantitatifnya dilaporkan di bagian 7.2.

## 7. Eksperimen sungguhan: 6 skenario, RAQA vs B2

### 7.1 Bug yang ditemukan dan diperbaiki selama pengujian (sebelum data final)

1. **Kontaminasi memori.** `offline-check.js`/`demo.js` (data sintetis) awalnya ikut menulis ke `.memory/reviewer-verdicts.jsonl` yang sama dengan run eksperimen. Terbukti nyata: run pertama S-SMOKE-01 mengusulkan `expectVisible link "Kembali ke Landing Page"` — persis rationale yang MENGUTIP verdict palsu dari `offline-check.js` sebelumnya. Diperbaiki: `persistMemory:false` default di kedua skrip; `.memory/` dibersihkan sebelum run final.
2. **`score()` menilai locator untuk step yang tidak memakainya.** `expectTitle`/`expectURL`/`goto` seharusnya mengabaikan `role`/`name`, tapi model 4B kadang mengisi field itu (mis. `role:"page", name:"title"`) walau diminta `null`. Skor lama salah menganggap ini "locator hilang" → `hallucinated:true` yang keliru, padahal isi assertion-nya (judul halaman) benar. Diperbaiki: locator hanya dinilai untuk tipe yang benar-benar memakainya.
3. **Compiler: jalur `require` fixture salah bila spec dipindah folder setelah ditulis.** Diperbaiki: dihitung relatif ke `outDir` sebenarnya, bukan folder tetap.

### 7.2 Navigasi awal deterministik — dan mengapa itu perlu

Uji langsung (sebelum ada perbaikan apa pun): dari `about:blank`, diminta goal "A visitor opens the portal home page", Qwen3 4B mengusulkan `expectAttribute link "Beranda" href="https://www.persis27.org"` — **elemen dan URL yang sama sekali tidak ada** di halaman kosong maupun di konteks yang diambil (5 unit dari catalog.json, tak satu pun menyebut URL itu). Skor menandainya `hallucinated:true` dan reviewer menolaknya dengan benar — pipeline bekerja seperti dirancang. Tapi ini menunjukkan Qwen3 4B tidak bisa diandalkan mengusulkan `goto` lebih dulu saat mulai dari halaman kosong.

**Perbaikan:** `runScenario()` menerima `startPath` opsional yang dieksekusi lebih dulu secara **deterministik** (bukan usulan LLM, tidak dihitung ke HAR), dipetakan dari `feature` skenario (`scripts/run-scenarios.js::START_PATH_BY_FEATURE`). Ini mengurangi cakupan "otonomi" yang diukur (agen tidak lagi diuji kemampuannya bernavigasi dari nol), sebuah trade-off yang disengaja dan dilaporkan di sini, bukan disembunyikan.

### 7.3 Hasil kuantitatif

**RAQA (retrieval aktif), 6 skenario, budget 8 langkah, τ=0.8, model qwen3:4b, seed 42:**

```json
{ "scenarios": 6, "done": 3, "tsrPct": 50, "harPct": 0, "totalSteps": 10, "escalations": 3, "compiledCount": 3 }
```

**B2 (retrieval nonaktif), 6 skenario SAMA, budget SAMA:**

```json
{ "scenarios": 6, "done": 0, "tsrPct": 0, "harPct": 0, "totalSteps": 6, "escalations": 6, "compiledCount": 0 }
```

**Tingkat eskalasi** (langkah yang butuh reviewer / total langkah): RAQA **30%** (3/10), B2 **100%** (6/6). B2 selalu eskalasi *by construction* (`c_act` mustahil 1 tanpa retrieval, jadi `c_t` selalu 0) — ini demonstrasi kuantitatif langsung untuk RQ1: tanpa grounding, gate menolak mempercayai otomatis APA PUN, terlepas dari kualitas usulannya. HAR 0% di kedua kondisi: locator yang diusulkan **selalu** ada di halaman sungguhan (page representation sendiri sudah cukup untuk grounding locator; efek retrieval ada di tempat lain — lihat 7.4).

**FR (flakiness rate) skrip hasil kompilasi RAQA, k=10, instance lokal** (2 dari 3 skrip yang lolos — lihat 7.5 kenapa bukan 3):

```json
{ "runs": 10, "tests": { "total": 2, "stablePass": 2, "stableFail": 0, "flaky": 0 }, "flakinessRatePct": 0 }
```

Diukur dengan `scripts/run-repeated.js` + `scripts/compute-metrics.js` B1 **tanpa modifikasi** (`RUN_LABEL=raqa-fr`, `RAQA_TESTDIR=raqa/compiled`). Terhadap **staging**, dua skrip yang sama gagal 2/2 karena RC1 (bucket gambar 403) — persis pola yang sudah didokumentasikan untuk B1 di `result.md`; tidak diulang k kali di sini karena hasilnya sudah diketahui deterministik dari analisis RC1 sebelumnya.

### 7.4 Kenapa `done=3` bukan berarti TSR 50% yang jujur — audit manual

Diperiksa satu per satu: **tak satu pun** dari 3 kasus "done" berasal dari model secara eksplisit mengeluarkan `done:true`. Semuanya dipicu oleh pengaman baru yang ditambahkan setelah ditemukan model tidak pernah berhenti sendiri (lihat 7.6 temuan #1): jika langkah yang diusulkan **identik persis** dengan langkah sebelumnya, loop dihentikan dan dianggap "goal tercapai".

| Skenario | Assertion yang berulang | Relevan dengan goal aslinya? |
|---|---|---|
| S-SMOKE-01 | `expectTitle` judul memuat "Portal Pesantren PERSIS 27 Situaksan" | ✅ Ya — salah satu acceptance criteria persis ini |
| S-HOME-01 | `expectAttribute` href tautan "Daftar PSB" | ✅ Ya — satu-satunya acceptance criteria skenario ini |
| S-AUTH-03 | `expectAttribute type="password"` pada field password | ❌ Tidak — goal-nya "kredensial salah ditolak dengan pesan jelas", field password SELALU bertipe password terlepas dari kredensial; assertion ini tidak menguji apa pun yang relevan |

**TSR yang diverifikasi manual: 2/6 (33,3%)**, bukan 3/6 (50%). Skrip S-AUTH-03 tetap tersimpan di `raqa/runs/raqa-v3/compiled/` sebagai bukti temuan ini, tapi TIDAK diikutkan ke pengukuran FR (bagian 7.3) karena tidak menguji apa yang diklaim judulnya.

**Ini temuan paling penting dari eksperimen ini**, dan justru mendukung tesis human-in-the-loop naskah: penanda "selesai" otomatis (baik dari model maupun pengaman rekayasa) tidak bisa dipercaya sepenuhnya — audit manusia atas KLAIM "selesai", bukan cuma atas langkah individual yang tidak yakin, tetap diperlukan.

### 7.5 Pola kegagalan kualitatif (dari transcript lengkap, `raqa/runs/*/results.json`)

1. **Model tidak pernah eksplisit `done:true` pada 6 skenario ini.** Ditemukan lewat inspeksi trace langkah-demi-langkah: S-HOME-01 dan S-AUTH-05 mengusulkan assertion yang SAMA 8 kali berturut-turut (mengisi budget penuh) sebelum perbaikan; setelah perbaikan (repeat-detection + penajaman prompt), turun jadi berhenti di langkah ke-2. Prompt sudah eksplisit meminta `done=true` begitu kriteria terpenuhi — model 4B tidak konsisten mematuhinya.
2. **Kebingungan nilai-vs-nama-atribut, sistemik.** Untuk `expectAttribute` pada atribut BOOLEAN/STATE (`aria-expanded`, `type`), model berulang kali menaruh NAMA atribut sebagai NILAI (`attribute:"href", value:"href"`; `attribute:"type", value:"type"`) — sudah dicoba diperbaiki lewat instruksi eksplisit + contoh di system prompt (bagian 7.1), FR turun tapi tidak hilang total. Sebaliknya, untuk atribut `href` yang nilainya adalah URL, model SELALU benar (S-HOME-01, S-AUTH-05 tautan "Kembali ke Landing Page" — href persis cocok di semua percobaan). Pola: model kompeten untuk nilai yang "terlihat jelas" di teks halaman (URL tertulis), tapi tidak untuk nilai implisit/state (`true`/`false`, `submit`) yang perlu disimpulkan, bukan disalin.
3. **Sitasi (`citedUnits`) tidak konsisten** sebelum penajaman prompt eksplisit ("always list every unitId"): 1 dari 3 percobaan awal tidak mengutip apa pun walau jelas memakai konteks yang diambil. Setelah penajaman, 0 dari 6 skenario final gagal karena ini (S-SMOKE-01, S-HOME-01, S-AUTH-03 semua mengutip dengan benar di run final).
4. **`START_PATH_BY_FEATURE` terlalu kasar untuk skenario yang perlu navigasi berlapis.** S-NEWS-06 (breadcrumb & share link artikel) butuh berada di halaman DETAIL artikel, bukan daftar berita; pemetaan per-fitur mengirimnya ke `/portal/berita` (daftar), dan model tidak berinisiatif mengklik masuk ke satu artikel dulu — malah menegaskan atribut tautan yang salah. Skenario ini **dikeluarkan dari set eksperimen**, bukan dipaksakan lulus.

### 7.6 Perbandingan RAQA vs B2 secara kualitatif

Dari proposal langkah PERTAMA tiap skenario (tabel lengkap di `raqa/runs/b2-v1/results.json`): B2 (tanpa retrieval) tetap menghasilkan locator yang valid (c_loc=1, HAR 0%) untuk semua 6 skenario — *page representation* saja sudah cukup untuk grounding locator dasar. Yang berbeda: (a) B2 tidak pernah bisa mencapai `c_act=1` *by construction*, jadi 100% langkahnya butuh eskalasi meski usulannya sendiri kadang identik dengan RAQA (mis. href "Daftar PSB" persis sama); (b) untuk S-SMOKE-01, RAQA (membaca acceptance criteria "page title contains...") memilih menguji **judul halaman**, sedangkan B2 (menebak dari snapshot semata) memilih menguji **teks heading** — dua tafsir berbeda dari goal yang sama, di mana RAQA lebih tepat sasaran karena tahu PERSIS kriteria yang diminta. Retrieval, pada sampel ini, menyumbang *arah* pengujian yang tepat dan *audit trail* (`citedUnits`), bukan kualitas locator itu sendiri.

## 8. Placeholder naskah yang sekarang bisa diisi

| Placeholder | Nilai |
|---|---|
| 4.7 `[language]` | JavaScript (Node.js 20.19.0) |
| 4.7 `[embedding model]` | nomic-embed-text (ID Ollama `0a109f422b47`, 137M, dimensi 768) via Ollama 0.33.3 |
| 4.7 `[vector store]` | FAISS (faiss-node 0.5.1) |
| 4.7 `[re-ranking model]` | tidak ada komponen re-ranking terpisah (RRF adalah satu-satunya penggabungan) — kalimat "[re-ranking model]" di naskah sebaiknya dihapus, kecuali Anda ingin menambah re-ranker sebagai kerja lanjutan |
| 4.3 `[name and version]` | Qwen3 4B (`qwen3:4b`, ID `359d7dd4bcda`, 4.0B, Q4_K_M) via Ollama 0.33.3, temperature 0, seed 42, mode berpikir mati |
| 4.3 `[B]` (budget aksi) | 8 |
| Bagian 3 `[m]`, `[c]` (retrieval) | 5 per retriever (≤10 gabungan), 5 |
| Bagian 3 bobot φ (locator) | w_hist=0.5, w_str=0.3, w_vol=0.2 — pilihan desain saya, dilaporkan di bagian 3 |
| Abstract/RQ2 `[X]` (TSR RAQA) | **33,3% (2/6)** terverifikasi manual — **BUKAN 50%**, lihat 7.4 untuk kenapa keduanya berbeda dan mana yang jujur dilaporkan |
| RQ2 `[x2]` (TSR B2) | 0% (0/6), *by construction* — lihat 7.2/7.6 |
| Abstract/RQ2 `[Y]` (FR skrip RAQA) | 0% pada instance lokal (k=10, 2 skrip terverifikasi); tidak diukur ulang di staging (dominan RC1, k tidak diulang — lihat 7.3) |
| RQ3 `[Z]`/FDR RAQA | **belum diukur** — hanya 2 skrip terverifikasi, tidak cukup luas untuk dibandingkan adil dengan FDR 25-fault B1 (lihat bagian 9) |
| RQ2 HAR | 0% (RAQA dan B2, 6 skenario) |
| Tabel 5 baris RAQA | TSR 33,3%\*, FR staging tidak diukur ulang / FR lokal 0%, FDR belum, HAR 0% (\*audit manual; 50% bila hanya memakai klaim `done` otomatis — laporkan keduanya) |
| Tabel 5 baris B2 | TSR 0%\*, FR/FDR/HAR tidak relevan (tidak ada skrip terverifikasi untuk dikompilasi) |

## 9. Batasan cakupan eksperimen — mohon dibaca sebelum menulis Bagian 5 naskah

- **6 dari 31 skenario**, dipilih karena kosakata langkah RAQA saat ini (`goto/click/hover/fill/expectVisible/expectURL/expectTitle/expectAttribute`) bisa mengekspresikannya. Skenario yang butuh perbandingan nilai lintas-halaman (mis. "H1 artikel = judul kartu", S-HOME-05/S-NEWS-05/09), penghitungan/agregasi (S-NEWS-02/03/04), pemindaian non-UI (axe-core S-QUAL-01, viewport S-QUAL-03, canonical S-QUAL-02), atau pengecekan banyak elemen sekaligus (S-LINK-01/02/03, S-NAV-01) **tidak achievable** dengan desain step-tunggal-per-giliran saat ini — ini keterbatasan arsitektur yang nyata, bukan sekadar belum sempat dicoba.
- **budget=8, τ=0.8 belum dikalibrasi** — dipilih sebagai nilai awal yang masuk akal, bukan hasil tuning.
- **Reviewer eskalasi dijawab `stubReviewer.js` (mekanis), bukan manusia sungguhan.** RQ5 (upaya manusia) **tidak bisa diisi** dari run ini — yang terbukti hanya bahwa mekanisme eskalasi menyala pada saat yang tepat (30% RAQA vs 100% B2), bukan seberapa baik manusia sungguhan akan memutuskan. `human.js` (reviewer terminal sungguhan) sudah ada dan berfungsi (dipakai di `demo.js` secara default), tinggal dipakai untuk sesi interaktif nyata.
- **FDR belum diukur untuk RAQA.** Infrastruktur fault (25 patch di `faults/patches/`) sudah ada dan bisa dipakai ulang, tapi 2 skrip RAQA yang terverifikasi (judul halaman, href statis) tidak menyentuh kode yang diubah oleh fault manapun — mengukur FDR pada set sekecil ini tidak akan adil dibandingkan dengan FDR 25-fault/107-eksekusi B1.
- **RQ4 (ablasi: tanpa requirement, tanpa trace, tanpa defect report, BM25-only, dense-only) belum dijalankan.** Baru ada indikasi kualitatif retrieval vs no-retrieval (bagian 7.6), bukan ablasi sumber-per-sumber.

Rekomendasi jujur untuk naskah: laporkan angka bagian 7 sebagai **studi percontohan (pilot) pada subset skenario**, bukan sebagai RQ1–RQ5 penuh. Memperluas ke 31 skenario butuh memperluas kosakata langkah (variabel lintas-langkah untuk perbandingan nilai, minimal) dan navigasi multi-halaman yang lebih baik dari `START_PATH_BY_FEATURE`.

## 10. Cara menjalankan

```bash
cd raqa
npm install
ollama serve                          # di terminal terpisah, bila belum jalan
ollama pull qwen3:4b && ollama pull nomic-embed-text

npm run offline-check                 # uji wiring, tanpa Ollama, tidak menulis .memory/
npm run demo -- "goal" /login         # satu langkah interaktif, reviewer terminal sungguhan

# Loop skenario penuh, RAQA vs B2 (menulis raqa/runs/<label>/{summary,results}.json + compiled/):
node scripts/run-scenarios.js --label raqa-run --ids S-SMOKE-01,S-HOME-01 --max-steps 8
node scripts/run-scenarios.js --label b2-run --ids S-SMOKE-01,S-HOME-01 --max-steps 8 --no-retrieval

# FR skrip hasil kompilasi, dengan harness B1 (dari root ppi27-e2e):
BASE_URL=http://127.0.0.1:8000 RAQA_TESTDIR=raqa/runs/raqa-run/compiled \
  node scripts/run-repeated.js --k 10 --label raqa-fr -- -c raqa/playwright.compiled.config.js
node scripts/compute-metrics.js --label raqa-fr
```

## 11. Masih belum dikerjakan

- Kosakata langkah untuk perbandingan nilai lintas-halaman (variabel/binding antar langkah) — perlu untuk ~40% skenario catalog.json.
- Navigasi multi-halaman yang lebih baik dari pemetaan statis per-fitur.
- Sesi reviewer manusia sungguhan (bukan stub) untuk data RQ5 yang sah.
- Kalibrasi τ dan budget B secara sistematis.
- Ablasi RQ4 (per-sumber korpus, BM25-only, dense-only).
- FDR untuk skrip hasil kompilasi RAQA, setelah set skenario terverifikasi cukup luas.
- Pengujian komponen riwayat locator (`w_hist`) dengan skenario yang benar-benar berisi interaksi klik/isi, bukan cuma assertion.
