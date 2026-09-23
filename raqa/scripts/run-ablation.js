#!/usr/bin/env node
// Menjalankan studi ablasi: setiap konfigurasi di ablation-configs.js dijalankan pada skenario yang SAMA,
// dengan model/seed/tau/budget/audit-seed yang SAMA, dan memori KOSONG yang terisolasi per konfigurasi
// (sehingga urutan konfigurasi tidak memengaruhi hasil).
//
//   node scripts/run-ablation.js --ids S-SMOKE-01,S-HOME-01,... [--only must] [--configs A0,A2] \
//        [--max-steps 8] [--repeat-a0 3] [--prefix abl]
//
// Output: raqa/runs/<prefix>-<ID>/{summary.json, results.json, shots/, compiled/}
//         raqa/runs/<prefix>-manifest.json  (konfigurasi, skenario, waktu, commit git)
// --repeat-a0 N menjalankan A0 N kali tambahan untuk memeriksa determinisme (temperature 0).
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CONFIGS } = require('./ablation-configs');

function parseArgs(argv) {
  const a = { ids: null, only: null, configs: null, maxSteps: 8, repeatA0: 0, prefix: 'abl', phase: 'ablation' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--ids') a.ids = argv[++i];
    else if (argv[i] === '--only') a.only = argv[++i];
    else if (argv[i] === '--configs') a.configs = argv[++i].split(',');
    else if (argv[i] === '--max-steps') a.maxSteps = Number(argv[++i]);
    else if (argv[i] === '--repeat-a0') a.repeatA0 = Number(argv[++i]);
    else if (argv[i] === '--prefix') a.prefix = argv[++i];
    else if (argv[i] === '--phase') a.phase = argv[++i];
    else throw new Error(`Flag tidak dikenal: ${argv[i]}`);
  }
  if (!a.ids) throw new Error('Wajib --ids (daftar skenario) atau --ids prereg (baca scenarios/prereg-ablation.json).');
  if (a.ids === 'prereg') {
    const pre = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'scenarios', 'prereg-ablation.json'), 'utf8'));
    a.ids = Object.keys(pre.in).join(',');
    console.log(`Set skenario pre-registrasi: ${Object.keys(pre.in).length} skenario`);
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
let selected = CONFIGS.filter((c) => c.phase === args.phase);
if (args.only) selected = selected.filter((c) => c.priority === args.only);
if (args.configs) selected = selected.filter((c) => args.configs.includes(c.id));
const runs = [...selected.map((c) => ({ cfg: c, label: `${args.prefix}-${c.id}` }))];
for (let r = 1; r <= args.repeatA0; r += 1) {
  const a0 = CONFIGS.find((c) => c.id === 'A0');
  runs.push({ cfg: a0, label: `${args.prefix}-A0-rep${r}` });
}

let commit = null;
try { commit = execSync('git rev-parse HEAD', { cwd: path.join(__dirname, '..', '..') }).toString().trim(); } catch { /* bukan repo git */ }
const manifest = { startedAt: new Date().toISOString(), commit, ids: args.ids.split(','), maxSteps: args.maxSteps, runs: [] };

for (const { cfg, label } of runs) {
  const memDir = fs.mkdtempSync(path.join(os.tmpdir(), `raqa-mem-${label}-`)); // memori kosong per konfigurasi
  const cli = ['scripts/run-scenarios.js', '--label', label, '--ids', args.ids, '--max-steps', String(args.maxSteps),
    '--memory-dir', memDir, '--no-persist', '--reviewer', 'stub', '--screenshots'];
  if (!cfg.retrieval) cli.push('--no-retrieval');
  else cli.push('--sources', cfg.sources.join(','), '--retrievers', cfg.retrievers.join(','));
  console.log(`\n=== ${label}: ${cfg.label} ===`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, cli, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  manifest.runs.push({ label, configId: cfg.id, configLabel: cfg.label, exitCode: r.status, seconds: (Date.now() - t0) / 1000, cli: cli.join(' ') });
  fs.writeFileSync(path.join(__dirname, '..', 'runs', `${args.prefix}-manifest.json`), JSON.stringify(manifest, null, 2));
}
manifest.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(__dirname, '..', 'runs', `${args.prefix}-manifest.json`), JSON.stringify(manifest, null, 2));
console.log(`\nSelesai. Manifest: raqa/runs/${args.prefix}-manifest.json`);
console.log('Langkah berikutnya: node scripts/export-review-items.js --prefix ' + args.prefix);
