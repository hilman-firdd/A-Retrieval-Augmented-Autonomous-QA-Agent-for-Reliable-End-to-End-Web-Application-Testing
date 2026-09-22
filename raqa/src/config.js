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
  },
  gate: {
    tau: Number(process.env.RAQA_TAU || 0.8),
    auditRate: Number(process.env.RAQA_AUDIT_RATE || 0.05),
  },
  app: { baseURL: process.env.BASE_URL || 'https://staging.pesantrenpersis27.com' },
  paths: {
    e2eRoot: E2E_ROOT,
    qaDocs: process.env.RAQA_QA_DOCS || path.join(RAQA_ROOT, 'qa_docs'),
    indexDir: path.join(RAQA_ROOT, '.index'),
    compiledDir: path.join(RAQA_ROOT, 'compiled'),
    catalog: path.join(E2E_ROOT, 'scenarios', 'catalog.json'),
    baselineRuns: path.join(E2E_ROOT, 'results', 'runs', 'baseline'),
  },
  // Sumber yang TIDAK boleh masuk korpus: berisi kunci jawaban eksperimen FDR (daftar fault, hasil run ber-fault, laporan hasil).
  excludedFromCorpus: [/[\\/]faults[\\/]/, /[\\/]results[\\/]runs[\\/]fault-/, /[\\/]result\.md$/, /manuscript-claims-verification\.md$/],
});

/** @param {string} p */
function isExcludedFromCorpus(p) {
  return CONFIG.excludedFromCorpus.some((re) => re.test(path.resolve(p)));
}

module.exports = { CONFIG, isExcludedFromCorpus };
