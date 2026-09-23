// @ts-check
const { Document } = require('@langchain/core/documents');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { BM25Retriever } = require('@langchain/community/retrievers/bm25');
const { FaissStore } = require('@langchain/community/vectorstores/faiss');
const { EnsembleRetriever } = require('@langchain/classic/retrievers/ensemble');
const { OllamaEmbeddings } = require('@langchain/ollama');
const { CONFIG } = require('./config');

/**
 * Knowledge base RAQA: BM25 (leksikal) + FAISS (dense), digabung weighted reciprocal rank fusion
 * s(d|q) = Σ_r w_r / (κ + rank_r(d|q)), κ = 60 (Persamaan 1 naskah; implementasi EnsembleRetriever).
 */
class KnowledgeBase {
  /** @param {{ embeddings?: import('@langchain/core/embeddings').EmbeddingsInterface, retrievers?: string[] }} [opts] */
  constructor(opts = {}) {
    this.embeddings = opts.embeddings || new OllamaEmbeddings({ model: CONFIG.embedding.model, baseUrl: CONFIG.ollama.baseUrl });
    /** Retriever aktif: ['bm25','dense'] (default), atau salah satu saja untuk ablasi. */
    this.retrievers = opts.retrievers || CONFIG.retrieval.retrievers;
    const unknown = this.retrievers.filter((r) => !['bm25', 'dense'].includes(r));
    if (unknown.length || !this.retrievers.length) throw new Error(`Retriever tidak dikenal/kosong: ${JSON.stringify(this.retrievers)}`);
    /** @type {EnsembleRetriever | null} */
    this.ensemble = null;
    /** @type {Document[]} */
    this.chunks = [];
  }

  /** @param {Document[]} docs */
  async build(docs) {
    const splitter = new RecursiveCharacterTextSplitter(CONFIG.splitter);
    const chunks = await splitter.splitDocuments(docs);
    // unitId stabil agar LLM bisa mengutip unit yang dipakainya (dasar skor c_act).
    const seen = new Map();
    this.chunks = chunks.map((c) => {
      const base = `${c.metadata.source}:${c.metadata.id}`;
      const i = seen.get(base) || 0;
      seen.set(base, i + 1);
      return new Document({ pageContent: c.pageContent, metadata: { ...c.metadata, unitId: `${base}#${i}` } });
    });

    const k = CONFIG.retrieval.kPerRetriever;
    const parts = [];
    const weights = [];
    if (this.retrievers.includes('bm25')) {
      parts.push(BM25Retriever.fromDocuments(this.chunks, { k }));
      weights.push(CONFIG.retrieval.weights.bm25);
    }
    if (this.retrievers.includes('dense')) {
      const faiss = await FaissStore.fromDocuments(this.chunks, this.embeddings);
      this.faiss = faiss;
      parts.push(faiss.asRetriever({ k }));
      weights.push(CONFIG.retrieval.weights.vector);
    }
    // Varian satu-retriever dibuat dengan MELEPAS retriever lain, bukan memberinya bobot 0. Di
    // EnsembleRetriever (@langchain/classic), dokumen dari retriever berbobot 0 tetap ikut _uniqueUnion
    // dengan skor 0; biasanya terdorong keluar oleh slice(0, kContext), tetapi bisa lolos bila retriever
    // lain mengembalikan < kContext dokumen unik. Melepasnya membuat isolasi variabel ablasi eksak.
    const total = weights.reduce((a, b) => a + b, 0);
    this.ensemble = new EnsembleRetriever({
      retrievers: parts,
      weights: weights.map((w) => w / total),
      c: CONFIG.retrieval.rrfConstant,
    });
    return this;
  }

  /** EnsembleRetriever mengembalikan gabungan unik kedua retriever (hingga 2k); di sini dipotong ke kContext. @param {string} query */
  async retrieve(query) {
    if (!this.ensemble) throw new Error('KnowledgeBase belum di-build.');
    const fused = await this.ensemble.invoke(query);
    return fused.slice(0, CONFIG.retrieval.kContext);
  }

  /** Simpan indeks FAISS agar embedding tidak dihitung ulang tiap run. @param {string} [dir] */
  async save(dir = CONFIG.paths.indexDir) {
    if (!this.faiss) throw new Error('KnowledgeBase belum di-build atau retriever dense tidak aktif.');
    await this.faiss.save(dir);
  }
}

module.exports = { KnowledgeBase };
