#!/usr/bin/env node
// Mengekspor bahan penilaian manusia (studi H1) dari run ablasi, dalam bentuk BUTA:
// reviewer tidak melihat konfigurasi, skor gate, maupun unit yang dikutip -- hanya goal, acceptance
// criteria, halaman, dan langkah dalam bahasa biasa. Kunci pemetaan disimpan terpisah.
//
//   node scripts/export-review-items.js --prefix abl [--seed 2026] [--out review]
//
// Output (folder raqa/<out>/):
//   step-sheet.csv       satu baris per LANGKAH unik (dideduplikasi lintas konfigurasi), urutan diacak
//   scenario-sheet.csv   satu baris per RUN skenario yang punya >= 1 assertion, urutan diacak
//   shots/               screenshot yang dirujuk lembar penilaian
//   KEY-jangan-dibagikan.json   pemetaan item -> konfigurasi & keputusan gate (untuk analisis)
//   PANDUAN-REVIEWER.md  rubrik dan instruksi
const fs = require('fs');
const path = require('path');
const { mulberry32 } = require('./lib-stats');

function parseArgs(argv) {
  const a = { prefix: 'abl', seed: 2026, out: 'review', runsDir: path.join(__dirname, '..', 'runs'), catalog: path.join(__dirname, '..', '..', 'scenarios', 'catalog.json') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--prefix') a.prefix = argv[++i];
    else if (argv[i] === '--seed') a.seed = Number(argv[++i]);
    else if (argv[i] === '--out') a.out = argv[++i];
    else if (argv[i] === '--runs-dir') a.runsDir = path.resolve(argv[++i]);
    else if (argv[i] === '--catalog') a.catalog = path.resolve(argv[++i]);
    else throw new Error(`Flag tidak dikenal: ${argv[i]}`);
  }
  return a;
}

const ASSERTIONS = ['expectVisible', 'expectURL', 'expectTitle', 'expectAttribute'];

/** Deskripsi langkah dalam bahasa biasa, tanpa jejak konfigurasi. @param {any} s */
function describe(s) {
  const t = s.role && s.name ? `${s.role} "${s.name}"` : '';
  switch (s.type) {
    case 'goto': return `Open page ${s.path}`;
    case 'click': return `Click ${t}`;
    case 'hover': return `Hover over ${t}`;
    case 'fill': return `Type "${s.value}" into ${t}`;
    case 'expectVisible': return `Check that ${t} is visible`;
    case 'expectURL': return `Check that the page URL matches ${s.pattern}`;
    case 'expectTitle': return `Check that the page title contains "${s.value}"`;
    case 'expectAttribute': return `Check that ${t} has attribute ${s.attribute} containing "${s.value}"`;
    default: return JSON.stringify(s);
  }
}
const fingerprint = (s) => JSON.stringify([s.type, s.role ?? null, s.name ?? null, s.attribute ?? null, s.value ?? null, s.pattern ?? null, s.path ?? null]);
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const writeCsv = (file, header, rows) => fs.writeFileSync(file, '\ufeff' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n'));
function shuffle(arr, rng) { const a = [...arr]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalog = new Map(JSON.parse(fs.readFileSync(args.catalog, 'utf8')).scenarios.map((s) => [s.id, s]));
  const labels = fs.readdirSync(args.runsDir).filter((d) => d.startsWith(`${args.prefix}-`) && !/-rep\d+$/.test(d)
    && fs.existsSync(path.join(args.runsDir, d, 'results.json')));
  if (!labels.length) throw new Error(`Tidak ada run ${args.prefix}-* di ${args.runsDir}`);
  const outDir = path.join(args.runsDir, '..', args.out);
  fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true });
  const rng = mulberry32(args.seed);

  const steps = new Map(); // fingerprint langkah per skenario -> item
  const scenarioRuns = [];
  for (const label of labels) {
    const configId = label.slice(args.prefix.length + 1);
    const results = JSON.parse(fs.readFileSync(path.join(args.runsDir, label, 'results.json'), 'utf8'));
    for (const r of results) {
      r.trace.forEach((s, i) => {
        const key = `${r.id}|${fingerprint(s)}`;
        if (!steps.has(key)) {
          let shot = null;
          if (s.screenshot) {
            const src = path.join(args.runsDir, label, s.screenshot);
            if (fs.existsSync(src)) { shot = `${steps.size + 1}.png`; fs.copyFileSync(src, path.join(outDir, 'shots', shot)); }
          }
          steps.set(key, { scenarioId: r.id, step: s, plain: describe(s), url: s.url, title: s.title, shot, occurrences: [] });
        }
        steps.get(key).occurrences.push({ configId, label, stepIndex: i + 1, gate: s.gate, c_t: s.scores?.c_t ?? null, accepted: s.accepted, decision: s.decision, autoDone: s.note ? true : undefined, executionFailed: !!s.executionFailed });
      });
      const asserted = r.trace.filter((s) => s.accepted && ASSERTIONS.includes(s.type));
      if (asserted.length) scenarioRuns.push({ configId, label, scenarioId: r.id, done: r.done, steps: asserted.map(describe), fp: asserted.map(fingerprint).join('||') });
    }
  }

  // Item skenario dideduplikasi: run berbeda yang menghasilkan daftar assertion identik dinilai sekali.
  const scenItems = new Map();
  for (const sr of scenarioRuns) {
    const key = `${sr.scenarioId}|${sr.fp}`;
    if (!scenItems.has(key)) scenItems.set(key, { scenarioId: sr.scenarioId, steps: sr.steps, runs: [] });
    scenItems.get(key).runs.push({ configId: sr.configId, label: sr.label, done: sr.done });
  }

  const stepList = shuffle([...steps.values()], rng).map((it, i) => ({ ...it, itemId: `L${String(i + 1).padStart(3, '0')}` }));
  const scenList = shuffle([...scenItems.values()], rng).map((it, i) => ({ ...it, itemId: `S${String(i + 1).padStart(3, '0')}` }));
  const criteriaOf = (id) => catalog.get(id).acceptance_criteria.map((c, j) => `${j + 1}. ${c}`).join('\n');

  writeCsv(path.join(outDir, 'step-sheet.csv'),
    ['item_id', 'goal', 'acceptance_criteria', 'page_url', 'page_title', 'proposed_step', 'screenshot', 'R1_relevance_0_1_2', 'R2_correct_yes_no_unsure', 'R3_decision_accept_edit_reject', 'comment'],
    stepList.map((it) => [it.itemId, catalog.get(it.scenarioId).goal, criteriaOf(it.scenarioId), it.url, it.title, it.plain, it.shot ? `shots/${it.shot}` : '', '', '', '', '']));
  writeCsv(path.join(outDir, 'scenario-sheet.csv'),
    ['item_id', 'goal', 'acceptance_criteria', 'asserted_steps', 'covered_criteria_numbers', 'overall_full_partial_none', 'tautology_yes_no', 'comment'],
    scenList.map((it) => [it.itemId, catalog.get(it.scenarioId).goal, criteriaOf(it.scenarioId), it.steps.map((s, j) => `${j + 1}. ${s}`).join('\n'), '', '', '', '']));

  const key = {
    generatedAt: new Date().toISOString(), prefix: args.prefix, seed: args.seed, labels,
    steps: stepList.map((it) => ({ itemId: it.itemId, scenarioId: it.scenarioId, plain: it.plain, occurrences: it.occurrences })),
    scenarios: scenList.map((it) => ({ itemId: it.itemId, scenarioId: it.scenarioId, nCriteria: catalog.get(it.scenarioId).acceptance_criteria.length, runs: it.runs })),
  };
  fs.writeFileSync(path.join(outDir, 'KEY-jangan-dibagikan.json'), JSON.stringify(key, null, 2));
  fs.copyFileSync(path.join(__dirname, 'PANDUAN-REVIEWER.md'), path.join(outDir, 'PANDUAN-REVIEWER.md'));
  console.log(`${stepList.length} item langkah, ${scenList.length} item skenario dari ${labels.length} run -> ${outDir}`);
  console.log('Bagikan ke reviewer: step-sheet.csv, scenario-sheet.csv, shots/, PANDUAN-REVIEWER.md. JANGAN bagikan KEY-jangan-dibagikan.json.');
}

main();
