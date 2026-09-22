#!/usr/bin/env node
// Uji kabel arsitektur RAQA TANPA Ollama: embedding diganti FakeEmbeddings (vektor acak, hanya untuk wiring),
// panggilan LLM dilewati (proposal ditulis tangan), reviewer diganti stub. Semua bagian lain berjalan sungguhan.
const { FakeEmbeddings } = require('@langchain/core/utils/testing');
const { RAQAAgent } = require('../src/agent');
const { CONFIG } = require('../src/config');

(async () => {
  const reviewerCalls = [];
  const agent = new RAQAAgent({
    embeddings: new FakeEmbeddings(),
    reviewer: async (ctx) => { reviewerCalls.push(ctx); return { decision: 'accept' }; },
    // Data di sini adalah fixture sintetis, bukan interaksi sungguhan -- jangan ikut mencemari
    // .memory/ bersama yang dipakai run eksperimen nyata (scripts/run-scenarios.js).
    persistMemory: false,
  });
  await agent.init();
  console.log(`KB: ${agent.kb.chunks.length} chunk | model: ${CONFIG.llm.model} | temperature: ${CONFIG.llm.temperature ?? '(tidak dikirim)'}`);

  const goal = 'A visitor opens the SIMASIS login page and sees the login form.';
  await agent.execute({ type: 'goto', path: '/login' });
  const units = await agent.kb.retrieve(agent.buildQuery(goal, 'SIMASIS login | /login'));
  console.log('Konteks:', units.map((u) => u.metadata.unitId).join(', '));

  // Proposal yang seolah-olah dari LLM: satu grounded + unik, satu mengutip unit karangan, satu ambigu.
  const cases = [
    { type: 'expectVisible', role: 'button', name: 'Masuk', citedUnits: [units[0].metadata.unitId] },
    { type: 'expectVisible', role: 'button', name: 'Masuk', citedUnits: ['catalog:S-FAKE-99#0'] },
    { type: 'expectVisible', role: 'link', name: 'Kembali ke Landing Page', citedUnits: [] },
  ];
  for (const c of cases) {
    const p = { done: false, value: null, path: null, pattern: null, rationale: 'offline', ...c };
    const scores = await agent.score(p, units);
    const g = await agent.gate(goal, p, scores, units);
    console.log(`${c.role} "${c.name}" cited=${JSON.stringify(c.citedUnits)} -> ${JSON.stringify(scores)} -> ${g.by}`);
    if (g.accepted && scores.c_loc === 1) await agent.execute(RAQAAgent.toStep(p));
  }
  console.log(`Reviewer dipanggil ${reviewerCalls.length}x (τ=${CONFIG.gate.tau}, audit=${CONFIG.gate.auditRate})`);
  console.log('Trace:', JSON.stringify(agent.trace));
  // Ditulis ke folder sementara agar tidak tercampur dengan spec eksperimen di raqa/compiled/.
  const outDir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'raqa-offline-'));
  console.log('Spec:', agent.compile('S-DEMO-02', 'offline check: form login', outDir));
  await agent.close();
})().catch((e) => { console.error(e); process.exit(1); });
