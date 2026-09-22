#!/usr/bin/env node
/**
 * Menghitung metrik reliabilitas dari k run (baseline B1).
 *   node scripts/compute-metrics.js --label baseline
 * Output: results/metrics/<label>/{per-test.csv, per-scenario.csv, summary.json, summary.md}
 *
 * Definisi (sesuai naskah, Persamaan 5):
 *   flaky  : 0 < jumlah pass < jumlah eksekusi
 *   FR     : |test flaky| / |test yang dieksekusi|
 */
const fs = require('fs');
const path = require('path');
const { loadRuns, summarize, median, csv } = require('./lib-results');

const i = process.argv.indexOf('--label');
const label = i === -1 ? 'baseline' : process.argv[i + 1];
const { rows, runs } = loadRuns(label);
const tests = summarize(rows);
const outDir = path.join('results', 'metrics', label);
fs.mkdirSync(outDir, { recursive: true });

const count = (v) => tests.filter((t) => t.verdict === v).length;
const total = tests.length;
const pct = (x, n) => (n ? +(100 * x / n).toFixed(2) : 0);

// Per skenario: flaky bila ada test flaky; gagal-stabil bila ada test gagal-stabil.
const scen = new Map();
for (const t of tests) {
  const s = scen.get(t.id) || { id: t.id, tests: 0, flaky: 0, stableFail: 0 };
  s.tests += 1; if (t.verdict === 'flaky') s.flaky += 1; if (t.verdict === 'stable-fail') s.stableFail += 1;
  scen.set(t.id, s);
}
const scenarios = [...scen.values()].sort((a, b) => a.id.localeCompare(b.id));

const allDur = tests.flatMap((t) => t.durations);
const meta = fs.existsSync(path.join('results', 'runs', label, 'meta.json'))
  ? JSON.parse(fs.readFileSync(path.join('results', 'runs', label, 'meta.json'), 'utf8')) : null;
const suiteSeconds = meta ? meta.runs.map((r) => r.seconds) : [];

const summary = {
  label, runs, generatedAt: new Date().toISOString(), baseURL: meta?.baseURL, appVersion: meta?.appVersion,
  tests: { total, stablePass: count('stable-pass'), stableFail: count('stable-fail'), flaky: count('flaky') },
  flakinessRatePct: pct(count('flaky'), total),
  scenarios: { total: scenarios.length, flaky: scenarios.filter((s) => s.flaky).length, withStableFailure: scenarios.filter((s) => s.stableFail).length },
  scenarioFlakinessRatePct: pct(scenarios.filter((s) => s.flaky).length, scenarios.length),
  durationMs: { medianPerTest: median(allDur), medianSuiteSeconds: median(suiteSeconds) },
  byProject: Object.fromEntries([...new Set(tests.map((t) => t.project))].map((p) => {
    const ts = tests.filter((t) => t.project === p);
    return [p, { total: ts.length, flaky: ts.filter((t) => t.verdict === 'flaky').length, flakinessRatePct: pct(ts.filter((t) => t.verdict === 'flaky').length, ts.length) }];
  })),
};

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(outDir, 'per-test.csv'),
  ['scenario_id,project,title,runs,passes,verdict,median_ms,errors']
    .concat(tests.map((t) => [t.id, t.project, t.title, t.n, t.pass, t.verdict, median(t.durations), t.errors.join(' || ')].map(csv).join(',')))
    .join('\n'));
fs.writeFileSync(path.join(outDir, 'per-scenario.csv'),
  ['scenario_id,tests,flaky_tests,stable_fail_tests'].concat(scenarios.map((s) => [s.id, s.tests, s.flaky, s.stableFail].join(','))).join('\n'));

const md = [
  `# Ringkasan metrik: ${label}`,
  '',
  `- Jumlah run (k): **${runs}**; URL: ${summary.baseURL || '-'}; versi aplikasi: ${summary.appVersion || '-'}`,
  `- Test dieksekusi: **${total}** (stabil lulus ${summary.tests.stablePass}, stabil gagal ${summary.tests.stableFail}, flaky ${summary.tests.flaky})`,
  `- **Flakiness rate (per test): ${summary.flakinessRatePct}%**`,
  `- Skenario: ${summary.scenarios.total}; skenario flaky ${summary.scenarios.flaky} (**${summary.scenarioFlakinessRatePct}%**)`,
  `- Median durasi per test: ${summary.durationMs.medianPerTest} ms; median durasi satu suite: ${summary.durationMs.medianSuiteSeconds} s`,
  '',
  '## Test flaky',
  ...tests.filter((t) => t.verdict === 'flaky').map((t) => `- [${t.project}] ${t.title}: ${t.pass}/${t.n} lulus — ${t.errors[0] || ''}`),
  '',
  '## Test gagal stabil (kandidat cacat, WAJIB ditriase manual)',
  ...tests.filter((t) => t.verdict === 'stable-fail').map((t) => `- [${t.project}] ${t.title} — ${t.errors[0] || ''}`),
  '',
  '> Kegagalan stabil belum tentu bug aplikasi: bisa juga selector yang perlu dikalibrasi atau',
  '> ekspektasi test yang keliru. Klasifikasikan setiap kasus (product defect / test defect) sebelum dilaporkan.',
].join('\n');
fs.writeFileSync(path.join(outDir, 'summary.md'), md);
console.log(md);
console.log(`\nFile tersimpan di ${outDir}`);
