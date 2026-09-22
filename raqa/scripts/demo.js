#!/usr/bin/env node
// Demo satu langkah RAQA dengan stack offline sungguhan (Qwen3 4B + nomic-embed-text via Ollama).
// Bukan loop tes penuh: buka halaman, minta satu usulan langkah, hitung c_t, gate (reviewer terminal bila perlu),
// eksekusi bila diterima, lalu kompilasi ke folder sementara.
//   node scripts/demo.js "<goal>" [path-awal] [--persist]
// --persist menulis locator/verdict sesi ini ke .memory/ bersama (baru masuk akal untuk sesi
// interaktif sungguhan dengan reviewer manusia nyata di terminal). Default: TIDAK menulis,
// supaya demo/spot-check tidak mencemari memori yang dipakai scripts/run-scenarios.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RAQAAgent } = require('../src/agent');
const { CONFIG } = require('../src/config');

(async () => {
  const rawArgs = process.argv.slice(2);
  const persist = rawArgs.includes('--persist');
  const positional = rawArgs.filter((a) => a !== '--persist');
  const goal = positional[0] || 'A visitor opens the SIMASIS login page and checks that the login button is visible.';
  const startPath = positional[1] || '/login';
  const agent = await new RAQAAgent({ persistMemory: persist }).init();
  try {
    console.log(`LLM: ${CONFIG.llm.model} (temperature ${CONFIG.llm.temperature}, seed ${CONFIG.llm.seed}, think ${CONFIG.llm.think}) | embed: ${CONFIG.embedding.model} | KB: ${agent.kb.chunks.length} chunk`);
    await agent.execute({ type: 'goto', path: startPath });

    const t0 = Date.now();
    const { proposal, units } = await agent.proposeStep(goal);
    console.log(`Usulan (${((Date.now() - t0) / 1000).toFixed(1)}s):`, JSON.stringify(proposal, null, 2));
    console.log('Konteks:', units.map((u) => u.metadata.unitId).join(', '));

    const scores = await agent.score(proposal, units);
    const gate = await agent.gate(goal, proposal, scores, units);
    console.log('Skor:', JSON.stringify(scores), '| gate:', gate.by, gate.accepted ? 'DITERIMA' : 'DITOLAK');

    if (gate.accepted && !proposal.done) {
      const step = gate.verdict?.decision === 'correct' && gate.verdict.correction
        ? JSON.parse(gate.verdict.correction)
        : RAQAAgent.toStep(proposal);
      await agent.execute(step);
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raqa-demo-'));
      console.log('Spec:', agent.compile('S-DEMO-03', goal.slice(0, 60), outDir));
    }
  } finally {
    await agent.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
