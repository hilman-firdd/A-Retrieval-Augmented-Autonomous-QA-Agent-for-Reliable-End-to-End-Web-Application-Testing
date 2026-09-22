#!/usr/bin/env node
/**
 * Menghitung fault detection rate (FDR) dan false alarm untuk suite B1.
 *
 * Alur:
 *  1. Jalankan baseline (versi tanpa fault) k kali:  node scripts/run-repeated.js --k 10 --label baseline
 *  2. Untuk setiap fault Fi di faults/faults.csv: deploy versi ber-fault (instance terpisah),
 *     lalu:                                          node scripts/run-repeated.js --k 3 --label fault-Fi
 *  3.                                                node scripts/fault-detection.js
 *
 * Kriteria: fault terdeteksi bila ada test yang STABIL LULUS di baseline dan gagal pada mayoritas
 * run versi ber-fault. Test yang flaky/gagal di baseline tidak dipakai sebagai detektor.
 * False alarm: test yang gagal (stabil atau flaky) pada versi tanpa fault.
 */
const fs = require('fs');
const path = require('path');
const { loadRuns, summarize, csv } = require('./lib-results');

const faultsFile = path.join('faults', 'faults.csv');
if (!fs.existsSync(faultsFile)) { console.error(`Buat ${faultsFile} (lihat faults/faults.example.csv).`); process.exit(1); }
const [header, ...lines] = fs.readFileSync(faultsFile, 'utf8').trim().split(/\r?\n/);
const cols = header.split(',').map((c) => c.trim());
const faults = lines.filter((l) => l.trim() && !l.startsWith('#')).map((l) => {
  const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
  return Object.fromEntries(cols.map((c, j) => [c, (cells[j] || '').trim()]));
});

const base = summarize(loadRuns('baseline').rows);
const detectors = new Set(base.filter((t) => t.verdict === 'stable-pass').map((t) => t.key));
const falseAlarms = base.filter((t) => t.verdict !== 'stable-pass');

const results = [];
for (const f of faults) {
  const label = `fault-${f.id}`;
  let tests;
  try { tests = summarize(loadRuns(label).rows); } catch { results.push({ ...f, status: 'NOT RUN', detectedBy: [] }); continue; }
  const detectedBy = tests.filter((t) => detectors.has(t.key) && t.pass < t.n / 2).map((t) => t.title);
  results.push({ ...f, status: detectedBy.length ? 'DETECTED' : 'MISSED', detectedBy });
}

const run = results.filter((r) => r.status !== 'NOT RUN');
const byCat = {};
for (const r of run) {
  byCat[r.category] = byCat[r.category] || { total: 0, detected: 0 };
  byCat[r.category].total += 1; if (r.status === 'DETECTED') byCat[r.category].detected += 1;
}
const detected = run.filter((r) => r.status === 'DETECTED').length;
const summary = {
  faultsListed: faults.length, faultsRun: run.length, detected,
  fdrPct: run.length ? +(100 * detected / run.length).toFixed(2) : 0,
  baselineTests: base.length, falseAlarmTests: falseAlarms.length,
  falseAlarmRatePct: base.length ? +(100 * falseAlarms.length / base.length).toFixed(2) : 0,
  byCategory: byCat,
};
const outDir = path.join('results', 'metrics', 'fault-detection');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(outDir, 'per-fault.csv'),
  ['id,category,description,status,detected_by'].concat(results.map((r) => [r.id, r.category, r.description, r.status, r.detectedBy.join(' || ')].map(csv).join(','))).join('\n'));
console.log(JSON.stringify(summary, null, 2));
console.log(`\nFile tersimpan di ${outDir}`);
