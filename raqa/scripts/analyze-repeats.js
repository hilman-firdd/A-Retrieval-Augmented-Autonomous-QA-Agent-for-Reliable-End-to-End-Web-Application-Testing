#!/usr/bin/env node
// Stabilitas antar-pengulangan dan perbandingan model untuk studi ablasi.
//
//   node scripts/analyze-repeats.js --group 4b=abl,abl4b-r2,abl4b-r3 --group 8b=abl8b-r1,abl8b-r2,abl8b-r3
//
// Setiap prefix adalah satu pengulangan penuh (runs/<prefix>-<config>/). Penilaian manusia (review/step-ratings-*.csv)
// hanya tersedia untuk langkah yang dihasilkan run asli (prefix "abl"). Langkah dari run lain memakai label manusia
// HANYA bila identik (skenario + tipe + target + nilai) dengan item yang sudah dinilai; sisanya dilaporkan sebagai
// belum berlabel dan tidak diberi label apa pun.
const fs = require('fs');
const path = require('path');
const S = require('./lib-stats');

const RAQA = path.join(__dirname, '..');
const RUNS = path.join(RAQA, 'runs');
const REVIEW = path.join(RAQA, 'review');
const CONFIGS = ['A0', 'A1', 'A2', 'A3', 'A6', 'A7'];
const fingerprint = (s) => JSON.stringify([s.type, s.role ?? null, s.name ?? null, s.attribute ?? null, s.value ?? null, s.pattern ?? null, s.path ?? null]);

const groups = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--group') { const [name, list] = argv[++i].split('='); groups.push({ name, prefixes: list.split(',') }); }
}
if (!groups.length) throw new Error('Pakai: --group <nama>=<prefix1>,<prefix2>,...');

// ---------- label manusia (konsensus mayoritas) dari run asli ----------
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') q = false; else cell += ch; } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [h, ...b] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k.trim().replace(/^﻿/, ''), (r[i] ?? '').trim()])));
}
const majority = (vals) => {
  const v = vals.filter((x) => x !== null && x !== undefined && x !== '');
  if (!v.length) return null;
  const c = {}; v.forEach((x) => { c[x] = (c[x] || 0) + 1; });
  const best = Math.max(...Object.values(c)); const top = Object.keys(c).filter((k) => c[k] === best);
  return top.length === 1 && best > v.length / 2 ? top[0] : null;
};
const ratingFiles = fs.readdirSync(REVIEW).filter((f) => /^step-ratings-.+\.csv$/.test(f));
const ratings = ratingFiles.map((f) => new Map(parseCsv(fs.readFileSync(path.join(REVIEW, f), 'utf8')).map((r) => [r.item_id, r])));
const key = JSON.parse(fs.readFileSync(path.join(REVIEW, 'KEY-jangan-dibagikan.json'), 'utf8'));
const humanByStep = new Map(); // `${scenario}|${fingerprint}` -> { ok: bool }
for (const it of key.steps) {
  const dec = majority(ratings.map((r) => (r.get(it.itemId)?.R3_decision_accept_edit_reject || '').toLowerCase()));
  if (dec === null) continue;
  const o = it.occurrences[0];
  const tr = JSON.parse(fs.readFileSync(path.join(RUNS, o.label, 'results.json'), 'utf8')).find((r) => r.id === it.scenarioId).trace[o.stepIndex - 1];
  humanByStep.set(`${it.scenarioId}|${fingerprint(tr)}`, { ok: dec === 'accept' });
}

// ---------- muat run ----------
const load = (prefix, cfg) => {
  const dir = path.join(RUNS, `${prefix}-${cfg}`);
  if (!fs.existsSync(path.join(dir, 'results.json'))) return null;
  return { results: JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8')), summary: JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8')) };
};
const f1 = (x) => (x === null || Number.isNaN(x) ? 'n/a' : x.toFixed(1));
const f3 = (x) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : x.toFixed(3));
const pct = (x) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : `${(100 * x).toFixed(1)}%`);
const out = { generatedAt: new Date().toISOString(), groups: {} };
const md = ['# Stabilitas antar-pengulangan dan perbandingan model', '',
  'Dihasilkan oleh `scripts/analyze-repeats.js`. Satu pengulangan = keenam konfigurasi pada 17 skenario pre-registrasi.', ''];

for (const g of groups) {
  const reps = g.prefixes.filter((p) => CONFIGS.some((c) => load(p, c)));
  const G = { prefixes: reps, configs: {} };
  const models = new Set(); const tau = new Set();
  const allSteps = [];
  for (const c of CONFIGS) {
    const runs = reps.map((p) => ({ p, run: load(p, c) })).filter((x) => x.run);
    if (!runs.length) continue;
    runs.forEach(({ run }) => { models.add(run.summary.model); tau.add(run.summary.tau); });
    // Skenario dengan infraError (halaman awal gagal dimuat) tidak pernah dijalankan agen: dihitung sebagai data
    // hilang, dikeluarkan dari penyebut TSR dan dari perbandingan stabilitas.
    const valid = (run) => run.results.filter((r) => !r.infraError);
    const tsr = runs.map(({ run }) => valid(run).filter((r) => r.done).length / valid(run).length);
    const infra = runs.map(({ run }) => run.results.filter((r) => r.infraError).length);
    const steps = runs.map(({ run }) => run.results.reduce((a, r) => a + r.trace.length, 0));
    const errs = runs.map(({ run }) => run.results.filter((r) => /propose\/score\/gate/.test(r.error || '')).length);
    const minutes = runs.map(({ run }) => run.results.reduce((a, r) => a + r.seconds, 0) / 60);
    // Stabilitas per skenario: hasil (done) sama di semua pengulangan; urutan langkah persis sama.
    const ids = runs[0].run.results.map((r) => r.id)
      .filter((id) => runs.every(({ run }) => !run.results.find((r) => r.id === id)?.infraError));
    const sameOutcome = ids.filter((id) => new Set(runs.map(({ run }) => run.results.find((r) => r.id === id)?.done)).size === 1).length;
    const sameTrace = ids.filter((id) => new Set(runs.map(({ run }) => (run.results.find((r) => r.id === id)?.trace || []).map(fingerprint).join('>'))).size === 1).length;
    for (const { p, run } of runs) {
      for (const r of run.results) r.trace.forEach((t) => allSteps.push({ cfg: c, rep: p, scen: r.id, t, retrieval: run.summary.retrieval, tauRun: run.summary.tau }));
    }
    G.configs[c] = { reps: runs.length, tsr, infra, steps, scenarioErrors: errs, minutes, sameOutcome, sameTrace, nScenarios: ids.length };
  }
  G.models = [...models]; G.tau = [...tau];
  const T = G.tau[0] ?? 0.8;

  // ---------- sinyal komponen (konfigurasi ber-retrieval, semua pengulangan) ----------
  const ret = allSteps.filter((x) => x.retrieval);
  const comp = ret.map((x) => {
    const s = x.t.scores; const base = Math.min(s.c_act, s.c_loc, s.c_orc);
    return { ...x, s, base, selfRef: s.c_t === 0 && base > 0, attr: x.t.type === 'expectAttribute' };
  });
  const share = (f) => (comp.length ? comp.filter(f).length / comp.length : null);
  G.signals = {
    nSteps: comp.length,
    selfRefShare: share((x) => x.selfRef),
    expectAttributeShare: share((x) => x.attr),
    cActBelowTau: share((x) => x.s.c_act < T),
    cOrcBelowTau: share((x) => x.s.c_orc < T),
    cLocBelowTau: share((x) => x.s.c_loc < T),
    cActValues: [...new Set(comp.map((x) => x.s.c_act))].sort(),
    cOrcValues: [...new Set(comp.map((x) => x.s.c_orc))].sort(),
  };

  // ---------- gate vs manusia pada langkah berlabel ----------
  const labelled = comp.map((x) => ({ ...x, h: humanByStep.get(`${x.scen}|${fingerprint(x.t)}`) })).filter((x) => x.h);
  const uniqueAll = new Set(comp.map((x) => `${x.scen}|${fingerprint(x.t)}`));
  const uniqueLab = new Set(labelled.map((x) => `${x.scen}|${fingerprint(x.t)}`));
  const variants = [
    ['Gate penuh (skor)', (x) => x.s.c_t],
    ['min(c_act, c_loc, c_orc) tanpa aturan self-ref', (x) => x.base],
    ['Aturan self-ref saja', (x) => (x.selfRef ? 0 : 1)],
    ['Terima semua (tanpa gate)', () => 1],
  ];
  G.gate = { nLabelledOccurrences: labelled.length, nOccurrences: comp.length, uniqueSteps: uniqueAll.size, uniqueLabelled: uniqueLab.size, variants: {} };
  for (const [name, f] of variants) {
    const a = labelled.map((x) => (f(x) >= T ? 1 : 0)); const h = labelled.map((x) => (x.h.ok ? 1 : 0));
    const c = (pa, ph) => labelled.filter((_, i) => a[i] === pa && h[i] === ph).length;
    const r = { tp: c(0, 0), fn: c(1, 0), fp: c(0, 1), tn: c(1, 1) };
    r.kappa = new Set(a).size > 1 && new Set(h).size > 1 ? S.cohenKappa(a, h) : null;
    r.recall = r.tp + r.fn ? r.tp / (r.tp + r.fn) : null;
    r.autoErr = r.tn + r.fn ? r.fn / (r.tn + r.fn) : null; r.autoErrCi = S.wilson(r.fn, r.tn + r.fn);
    G.gate.variants[name] = r;
  }
  out.groups[g.name] = G;

  // ---------- markdown ----------
  md.push(`## Model ${g.name}: ${G.models.join(', ')} (pengulangan: ${reps.join(', ')})`, '',
    '| Konfigurasi | Pengulangan | TSR otomatis per pengulangan | Rata-rata | Skenario dengan hasil sama di semua pengulangan | Skenario dengan langkah identik | Error model (timeout/parse) | Error infrastruktur (dikeluarkan) | Menit per pengulangan |',
    '|---|---|---|---|---|---|---|---|---|');
  for (const [c, v] of Object.entries(G.configs)) {
    const mean = v.tsr.reduce((a, b) => a + b, 0) / v.tsr.length;
    md.push(`| ${c} | ${v.reps} | ${v.tsr.map(pct).join(' / ')} | ${pct(mean)} | ${v.sameOutcome}/${v.nScenarios} | ${v.sameTrace}/${v.nScenarios} | ${v.scenarioErrors.join(' / ')} | ${v.infra.join(' / ')} | ${v.minutes.map(f1).join(' / ')} |`);
  }
  const sg = G.signals;
  md.push('', `**Sinyal komponen** (konfigurasi ber-retrieval, semua pengulangan, ${sg.nSteps} langkah, τ = ${T}): ` +
    `langkah self-referential ${pct(sg.selfRefShare)}; expectAttribute ${pct(sg.expectAttributeShare)}; ` +
    `c_act < τ ${pct(sg.cActBelowTau)} (nilai: ${sg.cActValues.join(', ')}); c_orc < τ ${pct(sg.cOrcBelowTau)} (nilai: ${sg.cOrcValues.join(', ')}); c_loc < τ ${pct(sg.cLocBelowTau)}.`, '',
    `**Gate vs manusia pada langkah berlabel**: ${G.gate.uniqueLabelled} dari ${G.gate.uniqueSteps} langkah unik (${pct(G.gate.uniqueSteps ? G.gate.uniqueLabelled / G.gate.uniqueSteps : null)}) identik dengan item yang sudah dinilai 3 reviewer; ` +
    `${G.gate.nLabelledOccurrences} dari ${G.gate.nOccurrences} kemunculan. Langkah lain belum berlabel dan tidak dihitung.`, '',
    '| Varian | TP | FN | FP | TN | Cohen κ | Recall eskalasi | Galat lolos-otomatis [95% CI] |', '|---|---|---|---|---|---|---|---|');
  for (const [name, r] of Object.entries(G.gate.variants)) {
    md.push(`| ${name} | ${r.tp} | ${r.fn} | ${r.fp} | ${r.tn} | ${f3(r.kappa)} | ${pct(r.recall)} | ${pct(r.autoErr)} [${pct(r.autoErrCi[0])}, ${pct(r.autoErrCi[1])}] |`);
  }
  md.push('');
}
md.push('Catatan: "Langkah identik" membandingkan urutan langkah usulan model (tipe, target, nilai) per skenario. ' +
  'TSR otomatis memakai reviewer tiruan (stub); bukan TSR terverifikasi manusia.', '');
fs.writeFileSync(path.join(REVIEW, 'analysis-repeats.json'), JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(REVIEW, 'analysis-repeats.md'), md.join('\n'));
console.log(md.join('\n'));
