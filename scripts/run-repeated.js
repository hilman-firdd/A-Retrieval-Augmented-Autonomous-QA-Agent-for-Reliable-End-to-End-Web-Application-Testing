#!/usr/bin/env node
/**
 * Menjalankan suite sebanyak k kali secara berurutan (proses terpisah) untuk mengukur flakiness.
 *
 *   node scripts/run-repeated.js --k 10 --label baseline
 *   node scripts/run-repeated.js --k 3 --label fault-F01 -- --grep @regression
 *
 * Argumen setelah "--" diteruskan apa adanya ke `playwright test`.
 * Hasil: results/runs/<label>/k01.json ... kNN.json dan results/runs/<label>/meta.json
 */
require('dotenv').config();
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
const own = sep === -1 ? argv : argv.slice(0, sep);
const passthrough = sep === -1 ? [] : argv.slice(sep + 1);
const opt = (name, def) => { const i = own.indexOf(`--${name}`); return i === -1 ? def : own[i + 1]; };

const k = Number(opt('k', 10));
const label = opt('label', process.env.RUN_LABEL || 'baseline');
const outDir = path.join('results', 'runs', label);
fs.mkdirSync(outDir, { recursive: true });

const meta = {
  label, k, baseURL: process.env.BASE_URL, appVersion: process.env.APP_VERSION || null,
  passthrough, startedAt: new Date().toISOString(), runs: [],
};

for (let i = 1; i <= k; i++) {
  const runId = `k${String(i).padStart(2, '0')}`;
  console.log(`\n=== [${label}] run ${i}/${k} (${runId}) ===`);
  const t0 = Date.now();
  const r = spawnSync('npx', ['playwright', 'test', ...passthrough], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, RUN_LABEL: label, RUN_ID: runId },
  });
  meta.runs.push({ runId, exitCode: r.status, seconds: (Date.now() - t0) / 1000, finishedAt: new Date().toISOString() });
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
}
meta.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(`\nSelesai. Hitung metrik dengan: node scripts/compute-metrics.js --label ${label}`);
