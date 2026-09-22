#!/usr/bin/env node
// Menjalankan agen (RAQA dengan retrieval, atau B2 tanpa retrieval) terhadap skenario nyata dari
// scenarios/catalog.json, memakai Qwen3 4B sungguhan. Mencatat TSR, HAR, dan rincian gate per langkah.
// Skenario yang selesai (done=true) dikompilasi ke folder output.
//
//   node scripts/run-scenarios.js --label raqa-run --ids S-SMOKE-01,S-AUTH-01,... [--no-retrieval] [--max-steps 10]
//
// Tanpa --ids, semua 31 skenario di catalog.json dijalankan.
const fs = require('fs');
const path = require('path');
const { RAQAAgent } = require('../src/agent');
const { CONFIG } = require('../src/config');
const { LocatorMemory } = require('../src/locatorScore');
const { makeStubReviewer } = require('../src/stubReviewer');

// Titik awal deterministik per fitur (lihat catatan di RAQAAgent.runScenario: mencegah agen mengarang
// elemen saat mulai dari halaman kosong). Bukan usulan LLM, jadi tidak dihitung ke HAR/langkah agen.
const START_PATH_BY_FEATURE = {
  Beranda: '/', Navigasi: '/', Berita: '/portal/berita', 'Artikel santri': '/portal/artikel',
  Login: '/login', Integritas: '/', Kualitas: '/', 'Halaman statis': '/',
};

function parseArgs(argv) {
  const args = { label: 'raqa-run', ids: null, retrieval: true, maxSteps: 10, headless: true };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--label') args.label = argv[++i];
    else if (argv[i] === '--ids') args.ids = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === '--no-retrieval') args.retrieval = false;
    else if (argv[i] === '--max-steps') args.maxSteps = Number(argv[++i]);
    else if (argv[i] === '--headed') args.headless = false;
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const { scenarios } = JSON.parse(fs.readFileSync(CONFIG.paths.catalog, 'utf8'));
  const selected = args.ids ? scenarios.filter((s) => args.ids.includes(s.id)) : scenarios;
  if (args.ids) {
    const missing = args.ids.filter((id) => !selected.some((s) => s.id === id));
    if (missing.length) throw new Error(`ID tidak ditemukan di catalog.json: ${missing.join(', ')}`);
  }

  const outDir = path.join(CONFIG.paths.e2eRoot, 'raqa', 'runs', args.label);
  const compiledDir = path.join(CONFIG.paths.e2eRoot, 'raqa', 'runs', args.label, 'compiled');
  fs.mkdirSync(outDir, { recursive: true });

  let escalations = 0;
  const memory = new LocatorMemory();
  const agent = await new RAQAAgent({
    retrieval: args.retrieval,
    headless: args.headless,
    locatorMemory: memory,
    reviewer: makeStubReviewer(() => { escalations += 1; }),
  }).init();

  console.log(`label=${args.label} retrieval=${args.retrieval} maxSteps=${args.maxSteps} skenario=${selected.length} model=${CONFIG.llm.model}`);

  const results = [];
  for (const scenario of selected) {
    agent.trace = [];
    const t0 = Date.now();
    const startPath = START_PATH_BY_FEATURE[scenario.feature] ?? '/';
    const log = await agent.runScenario({ ...scenario, startPath }, args.maxSteps);
    const seconds = (Date.now() - t0) / 1000;
    const llmSteps = log.steps.filter((s) => s.gate !== 'fixed-start');
    const hallucinated = llmSteps.filter((s) => s.hallucinated).length;
    let compiledPath = null;
    if (log.done) {
      try { compiledPath = agent.compile(scenario.id, scenario.goal.slice(0, 70), compiledDir); } catch (e) { log.error = `compile: ${/** @type {Error} */ (e).message}`; }
    }
    results.push({
      id: scenario.id, done: log.done, error: log.error, steps: llmSteps.length, hallucinated, seconds, compiledPath,
      gate: llmSteps.map((s) => s.gate),
      trace: llmSteps.map((s) => ({
        type: s.proposal.type, role: s.proposal.role, name: s.proposal.name, value: s.proposal.value,
        attribute: s.proposal.attribute, done: s.proposal.done, citedUnits: s.proposal.citedUnits,
        scores: s.scores, gate: s.gate, accepted: s.accepted, hallucinated: s.hallucinated,
      })),
    });
    console.log(`${scenario.id.padEnd(12)} ${log.done ? 'DONE ' : 'GAGAL'} steps=${llmSteps.length} halusinasi=${hallucinated} ${seconds.toFixed(1)}s ${log.error ? '- ' + log.error : ''}`);
  }

  await agent.close();

  const totalSteps = results.reduce((a, r) => a + r.steps, 0);
  const totalHallucinated = results.reduce((a, r) => a + r.hallucinated, 0);
  const summary = {
    label: args.label,
    retrieval: args.retrieval,
    maxSteps: args.maxSteps,
    model: CONFIG.llm.model,
    scenarios: results.length,
    done: results.filter((r) => r.done).length,
    tsrPct: +(100 * results.filter((r) => r.done).length / results.length).toFixed(2),
    harPct: totalSteps ? +(100 * totalHallucinated / totalSteps).toFixed(2) : 0,
    totalSteps,
    escalations,
    compiledCount: results.filter((r) => r.compiledPath).length,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
  console.log('\n' + JSON.stringify(summary, null, 2));
  console.log(`\nTersimpan: ${outDir}`);
})().catch((e) => { console.error(e); process.exit(1); });
