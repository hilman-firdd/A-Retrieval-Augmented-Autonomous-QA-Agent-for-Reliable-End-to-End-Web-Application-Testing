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
  /** @param {{ embeddings?: import('@langchain/core/embeddings').EmbeddingsInterface }} [opts] */
  constructor(opts = {}) {
    this.embeddings = opts.embeddings || new OllamaEmbeddings({ model: CONFIG.embedding.model, baseUrl: CONFIG.ollama.baseUrl });
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
    const bm25 = BM25Retriever.fromDocuments(this.chunks, { k });
    const faiss = await FaissStore.fromDocuments(this.chunks, this.embeddings);
    this.faiss = faiss;
    this.ensemble = new EnsembleRetriever({
      retrievers: [bm25, faiss.asRetriever({ k })],
      weights: [CONFIG.retrieval.weights.bm25, CONFIG.retrieval.weights.vector],
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
    if (!this.faiss) throw new Error('KnowledgeBase belum di-build.');
    await this.faiss.save(dir);
  }
}

module.exports = { KnowledgeBase };
