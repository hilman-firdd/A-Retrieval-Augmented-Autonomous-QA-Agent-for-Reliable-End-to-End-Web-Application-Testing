// @ts-check
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');

const E2E_ROOT = path.resolve(__dirname, '..', '..');
const RAQA_ROOT = path.resolve(__dirname, '..');

/** Parameter desain RAQA (stack offline). Semua nilai yang dilaporkan di naskah berasal dari objek ini. */
const CONFIG = Object.freeze({
  ollama: { baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434' },
  llm: {
    model: process.env.RAQA_MODEL || 'qwen3:4b',
    temperature: 0,
    seed: Number(process.env.RAQA_SEED || 42),
    // Default context Ollama terlalu kecil untuk ARIA snapshot (beranda SIMASIS ±15.000 karakter); prompt bisa terpotong diam-diam.
    numCtx: Number(process.env.RAQA_NUM_CTX || 16384),
    // Qwen3 punya mode berpikir; dimatikan agar keluaran JSON ringkas dan lebih stabil antar-run.
    think: process.env.RAQA_THINK === '1',
  },
  embedding: { model: process.env.RAQA_EMBED_MODEL || 'nomic-embed-text' },
  // chunkSize/chunkOverlap dihitung dalam KARAKTER (panjang string), bukan token.
  splitter: { chunkSize: 512, chunkOverlap: 50 },
  retrieval: {
    kPerRetriever: 5,
    kContext: 5,
    weights: { bm25: 0.5, vector: 0.5 },
    rrfConstant: 60,
    // Retriever yang aktif. Default keduanya (Persamaan 1). Ablasi: ['bm25'] atau ['dense'].
    retrievers: (process.env.RAQA_RETRIEVERS || 'bm25,dense').split(',').map((s) => s.trim()).filter(Boolean),
  },
  // Sumber pengetahuan yang dimuat ke korpus (Tabel 1 naskah). Ablasi leave-one-out menghapus satu per satu.
  sources: (process.env.RAQA_SOURCES || 'catalog,traces,defects,qa_docs,verdicts').split(',').map((s) => s.trim()).filter(Boolean),
  gate: {
    tau: Number(process.env.RAQA_TAU || 0.8),
    auditRate: Number(process.env.RAQA_AUDIT_RATE || 0.05),
    // Seed untuk undian audit acak. Sebelumnya Math.random() tanpa seed, sehingga dua run dengan
    // konfigurasi identik bisa berbeda hanya karena undian audit -- merusak perbandingan ablasi.
    auditSeed: Number(process.env.RAQA_AUDIT_SEED || 1),
  },
  app: { baseURL: process.env.BASE_URL || 'https://staging.pesantrenpersis27.com' },
  paths: {
    e2eRoot: E2E_ROOT,
    qaDocs: process.env.RAQA_QA_DOCS || path.join(RAQA_ROOT, 'qa_docs'),
    indexDir: path.join(RAQA_ROOT, '.index'),
    compiledDir: path.join(RAQA_ROOT, 'compiled'),
    catalog: path.join(E2E_ROOT, 'scenarios', 'catalog.json'),
    // Folder memori (verdict reviewer + riwayat locator). Ablasi dan studi HITL memakai folder terpisah
    // per konfigurasi agar keputusan satu konfigurasi tidak bocor ke konfigurasi lain.
    memoryDir: process.env.RAQA_MEMORY_DIR || path.join(RAQA_ROOT, '.memory'),
    baselineRuns: path.join(E2E_ROOT, 'results', 'runs', 'baseline'),
  },
  // Sumber yang TIDAK boleh masuk korpus: berisi kunci jawaban eksperimen FDR (daftar fault, hasil run ber-fault, laporan hasil).
  excludedFromCorpus: [/[\\/]faults[\\/]/, /[\\/]results[\\/]runs[\\/]fault-/, /[\\/]result\.md$/, /manuscript-claims-verification\.md$/],
});

/** @param {string} p */
function isExcludedFromCorpus(p) {
  return CONFIG.excludedFromCorpus.some((re) => re.test(path.resolve(p)));
}

const ALL_SOURCES = ['catalog', 'traces', 'defects', 'qa_docs', 'verdicts'];
const ALL_RETRIEVERS = ['bm25', 'dense'];

module.exports = { CONFIG, isExcludedFromCorpus, ALL_SOURCES, ALL_RETRIEVERS };
