// Membaca laporan JSON Playwright menjadi daftar hasil per eksekusi test.
const fs = require('fs');
const path = require('path');

/** @returns {Array<{run:string,key:string,id:string,title:string,file:string,project:string,status:string,duration:number,error:string}>} */
function loadRuns(label) {
  const dir = path.join('results', 'runs', label);
  if (!fs.existsSync(dir)) throw new Error(`Folder ${dir} tidak ditemukan. Jalankan run-repeated.js terlebih dahulu.`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'meta.json').sort();
  const rows = [];
  for (const f of files) {
    const report = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const run = f.replace(/\.json$/, '');
    const walk = (suite, trail) => {
      const here = suite.title && !suite.title.endsWith('.js') ? [...trail, suite.title] : trail;
      for (const spec of suite.specs || []) {
        for (const t of spec.tests || []) {
          const last = (t.results || [])[t.results.length - 1] || {};
          const status = t.status === 'skipped' ? 'skipped' : (last.status || 'unknown');
          const title = [...here, spec.title].join(' › ');
          const id = (/(S-[A-Z]+-\d+)/.exec(spec.title) || [])[1] || 'UNMAPPED';
          rows.push({
            run, id, title, file: spec.file, project: t.projectName,
            key: `${t.projectName} | ${spec.file} | ${title}`,
            status, duration: last.duration || 0,
            error: ((last.error && last.error.message) || (last.errors && last.errors[0] && last.errors[0].message) || '')
              .replace(/\u001b\[[0-9;]*m/g, '').split('\n').find((l) => l.trim()) || '',
          });
        }
      }
      for (const s of suite.suites || []) walk(s, here);
    };
    for (const s of report.suites || []) walk(s, []);
  }
  return { rows, runs: files.length };
}

/** Ringkas per test: jumlah eksekusi, pass, verdict stabil/flaky. */
function summarize(rows) {
  const byKey = new Map();
  for (const r of rows) {
    if (r.status === 'skipped') continue;
    const e = byKey.get(r.key) || { ...r, n: 0, pass: 0, durations: [], errors: new Set() };
    e.n += 1;
    if (r.status === 'passed') e.pass += 1; else if (r.error) e.errors.add(r.error);
    e.durations.push(r.duration);
    byKey.set(r.key, e);
  }
  return [...byKey.values()].map((e) => ({
    ...e,
    verdict: e.pass === e.n ? 'stable-pass' : e.pass === 0 ? 'stable-fail' : 'flaky',
    errors: [...e.errors],
  }));
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;

module.exports = { loadRuns, summarize, median, csv };
