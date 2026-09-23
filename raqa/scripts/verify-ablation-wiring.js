#!/usr/bin/env node
// Verifikasi kabel ablasi TANPA Ollama: embedding diganti FakeEmbeddings, LLM tidak dipanggil.
// Untuk setiap konfigurasi di ablation-configs.js, dicek bahwa:
//   1. korpus hanya berisi sumber yang dimaksud (dan sumber yang dihapus benar-benar hilang);
//   2. retrieval hanya mengembalikan unit dari sumber aktif;
//   3. retriever tunggal benar-benar tunggal (tidak ada unit dari retriever yang dimatikan);
//   4. verdict stub tidak pernah masuk korpus;
//   5. undian audit dengan seed yang sama identik antar-run.
// Jalankan sebelum eksperimen:  BASE_URL=http://127.0.0.1:8000 node scripts/verify-ablation-wiring.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FakeEmbeddings } = require('@langchain/core/utils/testing');
const { RAQAAgent } = require('../src/agent');
const { CONFIGS } = require('./ablation-configs');

const SOURCE_TAG = { catalog: 'catalog', traces: 'baseline-runs', defects: 'readme', qa_docs: 'qa_docs', verdicts: 'reviewer-verdicts' };
let failures = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'OK  ' : 'GAGAL'} ${msg}`); if (!ok) failures += 1; };

(async () => {
  // Memori uji: satu verdict manusia + satu verdict stub. Hanya yang manusia boleh masuk korpus.
  const memDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raqa-verify-'));
  const human = { goal: 'uji', proposal: { type: 'expectTitle', value: 'X' }, scores: {}, verdict: { decision: 'accept' }, reviewerKind: 'human', at: 'x' };
  const stub = { goal: 'uji', proposal: { type: 'expectTitle', value: 'Y' }, scores: {}, verdict: { decision: 'reject', comment: 'stub non-interaktif: c_t=0' }, reviewerKind: 'stub', at: 'x' };
  const legacyStub = { ...stub, reviewerKind: undefined }; // format lama tanpa penanda
  fs.writeFileSync(path.join(memDir, 'reviewer-verdicts.jsonl'), [human, stub, legacyStub].map((v) => JSON.stringify(v)).join('\n') + '\n');

  const queries = ['Goal: A visitor opens the SIMASIS login page\nPage: SIMASIS | /login', 'Goal: news archive shows only that month\nPage: Berita | /portal/berita'];

  for (const cfg of CONFIGS) {
    console.log(`\n[${cfg.id}] ${cfg.label}`);
    const agent = new RAQAAgent({
      embeddings: new FakeEmbeddings(), reviewer: async () => ({ decision: 'accept' }), reviewerKind: 'stub',
      retrieval: cfg.retrieval, sources: cfg.sources, retrievers: cfg.retrievers, memoryDir: memDir, persistMemory: false,
    });
    await agent.init();
    const present = Object.keys(agent.corpusStats);
    if (!cfg.retrieval) {
      check(present.length === 0, 'tanpa retrieval: korpus kosong');
    } else {
      for (const src of cfg.sources.filter((x) => x !== 'qa_docs')) {
        check(present.includes(SOURCE_TAG[src]), `sumber aktif "${src}" ada di korpus (${agent.corpusStats[SOURCE_TAG[src]] || 0} dok)`);
      }
      for (const src of Object.keys(SOURCE_TAG).filter((x) => !cfg.sources.includes(x))) {
        check(!present.includes(SOURCE_TAG[src]), `sumber dihapus "${src}" tidak ada di korpus`);
      }
      if (cfg.sources.includes('verdicts')) check(agent.corpusStats['reviewer-verdicts'] === 1, 'hanya 1 verdict manusia masuk korpus (2 stub ditolak)');
      const allowed = new Set(cfg.sources.map((x) => SOURCE_TAG[x]));
      for (const q of queries) {
        const units = await agent.kb.retrieve(q);
        check(units.every((u) => allowed.has(u.metadata.source)), `retrieval hanya dari sumber aktif (${units.map((u) => u.metadata.source).join(',')})`);
      }
      check(agent.kb.ensemble.retrievers.length === cfg.retrievers.length, `jumlah retriever = ${cfg.retrievers.length} (${cfg.retrievers.join('+')})`);
    }
    await agent.close();
  }

  // Determinisme undian audit.
  const draws = async () => { const a = new RAQAAgent({ embeddings: new FakeEmbeddings(), retrieval: false, auditSeed: 7, persistMemory: false }); return Array.from({ length: 20 }, () => a.rng()); };
  const [d1, d2] = [await draws(), await draws()];
  console.log('\n[audit]');
  check(JSON.stringify(d1) === JSON.stringify(d2), 'undian audit dengan seed sama identik antar-run');

  console.log(`\n${failures === 0 ? 'SEMUA PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`}`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
