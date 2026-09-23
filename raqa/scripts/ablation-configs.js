// Matriks konfigurasi ablasi RAQA. Satu variabel diubah per konfigurasi; semua parameter lain
// (model, seed, temperature, tau, budget, skenario, audit seed) SAMA dengan A0.
//
// priority: 'must'   = menjawab langsung masukan pembimbing (kontribusi tiap sumber/komponen)
//           'should' = memperkuat, dijalankan bila waktu cukup
// phase:    'ablation' = dijalankan dengan memori kosong terisolasi
//           'hitl'     = hanya bermakna SETELAH memori berisi verdict manusia (studi H2)
const ALL = ['catalog', 'traces', 'defects', 'qa_docs', 'verdicts'];
const without = (x) => ALL.filter((s) => s !== x);

const CONFIGS = [
  { id: 'A0', label: 'Full RAQA (semua sumber, BM25+dense)', retrieval: true, sources: ALL, retrievers: ['bm25', 'dense'], priority: 'must', phase: 'ablation' },
  { id: 'A1', label: 'Tanpa retrieval (= B2)', retrieval: false, sources: [], retrievers: ['bm25', 'dense'], priority: 'must', phase: 'ablation' },
  { id: 'A2', label: '− test case & acceptance criteria (catalog)', retrieval: true, sources: without('catalog'), retrievers: ['bm25', 'dense'], priority: 'must', phase: 'ablation' },
  { id: 'A3', label: '− execution traces', retrieval: true, sources: without('traces'), retrievers: ['bm25', 'dense'], priority: 'must', phase: 'ablation' },
  { id: 'A4', label: '− defect reports', retrieval: true, sources: without('defects'), retrievers: ['bm25', 'dense'], priority: 'should', phase: 'ablation' },
  { id: 'A6', label: 'BM25 saja (tanpa dense)', retrieval: true, sources: ALL, retrievers: ['bm25'], priority: 'must', phase: 'ablation' },
  { id: 'A7', label: 'Dense saja (tanpa BM25)', retrieval: true, sources: ALL, retrievers: ['dense'], priority: 'must', phase: 'ablation' },
  // A5 sengaja di fase HITL: dengan memori kosong, sumber 'verdicts' kosong sehingga A5 identik dengan A0.
  { id: 'A5', label: '− reviewer verdicts (memori manusia)', retrieval: true, sources: without('verdicts'), retrievers: ['bm25', 'dense'], priority: 'should', phase: 'hitl' },
];

module.exports = { CONFIGS, ALL };
