#!/usr/bin/env node
// Analisis studi H1 (penilaian buta) + ablasi. Membaca rating reviewer dan kunci dari export-review-items.js,
// lalu menghitung reliabilitas antar-reviewer, kalibrasi gate, TSR terverifikasi, dan perbandingan ablasi.
//
//   node scripts/analyze-hitl.js --review-dir review --baseline A0 [--gate-config A0]
//
// Butuh di <review-dir>: KEY-jangan-dibagikan.json, step-ratings-*.csv, scenario-ratings-*.csv (>= 2 reviewer).
// Output: <review-dir>/analysis.json dan <review-dir>/analysis.md (tabel siap-paper).
// Tidak ada angka yang dikarang: setiap nilai dihitung dari file rating; sel tanpa data ditulis "n/a".
const fs = require('fs');
const path = require('path');
const S = require('./lib-stats');

function parseArgs(argv) {
  const a = { reviewDir: path.join(__dirname, '..', 'review'), baseline: 'A0', gateConfig: null, runsDir: path.join(__dirname, '..', 'runs'),
    groundTruth: path.join(__dirname, '..', '..', 'scenarios', 'ground-truth.json') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--review-dir') a.reviewDir = path.resolve(argv[++i]);
    else if (argv[i] === '--baseline') a.baseline = argv[++i];
    else if (argv[i] === '--gate-config') a.gateConfig = argv[++i];
    else if (argv[i] === '--runs-dir') a.runsDir = path.resolve(argv[++i]);
    else if (argv[i] === '--ground-truth') a.groundTruth = path.resolve(argv[++i]);
    else throw new Error(`Flag tidak dikenal: ${argv[i]}`);
  }
  a.gateConfig = a.gateConfig || a.baseline;
  return a;
}

/** Parser CSV yang menangani BOM, kutip, koma, dan baris baru di dalam sel. @param {string} text */
function parseCsv(text) {
  const t = text.replace(/^\ufeff/, '');
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < t.length; i += 1) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const norm = (v) => (v || '').trim().toLowerCase();
const f3 = (x) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : x.toFixed(3));
const pct = (x) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : `${(100 * x).toFixed(1)}%`);
const ci = (c) => (c ? `[${pct(c[0])}, ${pct(c[1])}]` : '');
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const plurality = (vals) => {
  const v = vals.filter((x) => x !== null && x !== undefined && x !== '');
  if (!v.length) return null;
  const c = {}; v.forEach((x) => { c[x] = (c[x] || 0) + 1; });
  const best = Math.max(...Object.values(c));
  const top = Object.keys(c).filter((k) => c[k] === best);
  return top.length === 1 && best > v.length / 2 ? top[0] : null; // mayoritas mutlak; seri -> null
};

function loadRatings(dir, prefix) {
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.csv')).sort();
  return files.map((f) => ({ reviewer: f.slice(prefix.length, -4), rows: new Map(parseCsv(fs.readFileSync(path.join(dir, f), 'utf8')).map((r) => [r.item_id, r])) }));
}

/** Alpha + CI bootstrap atas unit (item). @param {(number|null)[][]} data @param {string} level */
function alphaWithCi(data, level) {
  const units = data[0].length;
  if (units < 2) return { alpha: null, ci: null };
  const alpha = S.krippendorffAlpha(data, level);
  const idx = Array.from({ length: units }, (_, i) => i);
  const c = S.clusterBootstrapCI(idx, (sample) => S.krippendorffAlpha(data.map((r) => sample.map((i) => r[i])), level), { B: 2000, seed: 11 });
  return { alpha, ci: c };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = JSON.parse(fs.readFileSync(path.join(args.reviewDir, 'KEY-jangan-dibagikan.json'), 'utf8'));
  const stepR = loadRatings(args.reviewDir, 'step-ratings-');
  const scenR = loadRatings(args.reviewDir, 'scenario-ratings-');
  if (stepR.length < 2) throw new Error('Butuh minimal 2 file step-ratings-*.csv');
  const out = { reviewers: stepR.map((r) => r.reviewer), nStepItems: key.steps.length, nScenarioItems: key.scenarios.length };
  const md = [];

  // ---------- 1. Reliabilitas antar-reviewer (langkah) ----------
  const R1 = { '0': 0, '1': 1, '2': 2 };
  const R2 = { yes: 1, no: 0 }; // unsure -> hilang
  const R3 = { accept: 0, edit: 1, reject: 2 };
  const grid = (map, col) => stepR.map((r) => key.steps.map((it) => { const v = map[norm(r.rows.get(it.itemId)?.[col])]; return v === undefined ? null : v; }));
  const gR1 = grid(R1, 'R1_relevance_0_1_2');
  const gR2 = grid(R2, 'R2_correct_yes_no_unsure');
  const gR3 = grid(R3, 'R3_decision_accept_edit_reject');
  out.irr = {
    R1_relevance_ordinal: alphaWithCi(gR1, 'ordinal'),
    R2_correct_nominal: alphaWithCi(gR2, 'nominal'),
    R3_decision_nominal: alphaWithCi(gR3, 'nominal'),
  };
  const complete = key.steps.map((_, u) => gR3.every((r) => r[u] !== null));
  if (complete.filter(Boolean).length >= 2) {
    const counts = S.toFleissCounts(gR3.map((r) => r.filter((_, u) => complete[u])), [0, 1, 2]);
    out.irr.R3_fleiss_kappa = S.fleissKappa(counts);
  }
  md.push('## Tabel H1 — Reliabilitas antar-reviewer', '', `Reviewer: ${out.reviewers.length}; item langkah: ${key.steps.length}.`, '',
    '| Dimensi | Skala | Krippendorff α | 95% CI (bootstrap) |', '|---|---|---|---|',
    `| R1 Relevansi | ordinal (0/1/2) | ${f3(out.irr.R1_relevance_ordinal.alpha)} | ${out.irr.R1_relevance_ordinal.ci ? `[${f3(out.irr.R1_relevance_ordinal.ci[0])}, ${f3(out.irr.R1_relevance_ordinal.ci[1])}]` : 'n/a'} |`,
    `| R2 Kebenaran ekspektasi | nominal (yes/no) | ${f3(out.irr.R2_correct_nominal.alpha)} | ${out.irr.R2_correct_nominal.ci ? `[${f3(out.irr.R2_correct_nominal.ci[0])}, ${f3(out.irr.R2_correct_nominal.ci[1])}]` : 'n/a'} |`,
    `| R3 Keputusan | nominal (accept/edit/reject) | ${f3(out.irr.R3_decision_nominal.alpha)} | ${out.irr.R3_decision_nominal.ci ? `[${f3(out.irr.R3_decision_nominal.ci[0])}, ${f3(out.irr.R3_decision_nominal.ci[1])}]` : 'n/a'} |`,
    '', `Fleiss κ (R3, item lengkap): ${f3(out.irr.R3_fleiss_kappa ?? null)}`, '');

  // Konsensus per item langkah
  const consensus = new Map(key.steps.map((it, u) => {
    const r1 = gR1.map((r) => r[u]).filter((v) => v !== null);
    const r3 = plurality(gR3.map((r) => (r[u] === null ? null : String(r[u]))));
    return [it.itemId, { relevance: r1.length ? median(r1) : null, decision: r3 === null ? null : Number(r3) }];
  }));

  // ---------- 2. Kualitas langkah per konfigurasi ----------
  const configs = [...new Set(key.steps.flatMap((it) => it.occurrences.map((o) => o.configId)))].sort();
  const occ = key.steps.flatMap((it) => it.occurrences.map((o) => ({ ...o, itemId: it.itemId, scenarioId: it.scenarioId, ...consensus.get(it.itemId) })));
  out.stepQuality = {};
  md.push('## Tabel H2 — Kualitas langkah per konfigurasi (konsensus reviewer)', '',
    '| Konfigurasi | Langkah | Diterima reviewer (accept) | Relevansi = 0 (tak relevan/tautologi) | Dieskalasi gate |', '|---|---|---|---|---|');
  for (const c of configs) {
    const o = occ.filter((x) => x.configId === c);
    const judged = o.filter((x) => x.decision !== null);
    const acc = judged.filter((x) => x.decision === 0).length;
    const irrel = o.filter((x) => x.relevance === 0).length;
    const esc = o.filter((x) => x.gate !== 'auto').length;
    out.stepQuality[c] = { steps: o.length, judged: judged.length, acceptRate: judged.length ? acc / judged.length : null, acceptCi: S.wilson(acc, judged.length), irrelevantRate: o.length ? irrel / o.length : null, escalationRate: o.length ? esc / o.length : null };
    md.push(`| ${c} | ${o.length} | ${pct(out.stepQuality[c].acceptRate)} ${ci(out.stepQuality[c].acceptCi)} | ${pct(out.stepQuality[c].irrelevantRate)} | ${pct(out.stepQuality[c].escalationRate)} |`);
  }
  md.push('', 'Accept = konsensus mayoritas "accept"; item tanpa mayoritas tidak dihitung pada kolom accept.', '');

  // ---------- 3. Kalibrasi gate vs manusia ----------
  const g = occ.filter((x) => x.configId === args.gateConfig && x.decision !== null);
  const auto = g.map((x) => (x.gate === 'auto' ? 1 : 0));
  const ok = g.map((x) => (x.decision === 0 ? 1 : 0));
  const tp = g.filter((x, i) => !ok[i] && !auto[i]).length; // manusia menolak/edit, gate mengeskalasi
  const fn = g.filter((x, i) => !ok[i] && auto[i]).length;  // manusia menolak/edit, gate meloloskan
  const fp = g.filter((x, i) => ok[i] && !auto[i]).length;  // manusia menerima, gate mengeskalasi
  const tn = g.filter((x, i) => ok[i] && auto[i]).length;
  const hasVar = new Set(auto).size > 1 && new Set(ok).size > 1;
  out.gate = {
    config: args.gateConfig, n: g.length, tp, fn, fp, tn,
    kappa: hasVar ? S.cohenKappa(auto, ok) : null,
    escalationRecall: tp + fn ? tp / (tp + fn) : null, escalationRecallCi: S.wilson(tp, tp + fn),
    escalationPrecision: tp + fp ? tp / (tp + fp) : null,
    autoAcceptErrorRate: tn + fn ? fn / (tn + fn) : null, autoAcceptErrorCi: S.wilson(fn, tn + fn),
  };
  md.push(`## Tabel H3 — Keputusan gate vs penilaian manusia (${args.gateConfig})`, '',
    '| | Manusia: accept | Manusia: edit/reject |', '|---|---|---|',
    `| Gate: lolos otomatis | ${tn} | ${fn} |`, `| Gate: dieskalasi | ${fp} | ${tp} |`, '',
    `- Cohen κ (gate vs manusia): ${f3(out.gate.kappa)}${hasVar ? '' : ' (tak terdefinisi: salah satu sisi tidak bervariasi)'}`,
    `- Recall eskalasi, P(dieskalasi | manusia tidak menerima): ${pct(out.gate.escalationRecall)} ${ci(out.gate.escalationRecallCi)}`,
    `- Presisi eskalasi, P(manusia tidak menerima | dieskalasi): ${pct(out.gate.escalationPrecision)}`,
    `- Galat lolos-otomatis, P(manusia tidak menerima | lolos otomatis): ${pct(out.gate.autoAcceptErrorRate)} ${ci(out.gate.autoAcceptErrorCi)}`, '');

  // ---------- 4. Skenario: cakupan kriteria & TSR terverifikasi ----------
  let scenData = null;
  if (scenR.length >= 2) {
    const cover = new Map(); const overall = new Map(); const taut = new Map();
    const unitsCrit = []; // (item, kriteria) biner untuk reliabilitas
    const overGrid = scenR.map(() => []);
    for (const it of key.scenarios) {
      const sets = scenR.map((r) => new Set(String(r.rows.get(it.itemId)?.covered_criteria_numbers || '').split(/[,\s]+/).filter(Boolean).map(Number)));
      const covered = Array.from({ length: it.nCriteria }, (_, j) => sets.filter((s) => s.has(j + 1)).length > scenR.length / 2);
      cover.set(it.itemId, covered.filter(Boolean).length / it.nCriteria);
      for (let j = 0; j < it.nCriteria; j += 1) unitsCrit.push(sets.map((s) => (s.has(j + 1) ? 1 : 0)));
      const ov = scenR.map((r) => norm(r.rows.get(it.itemId)?.overall_full_partial_none) || null);
      scenR.forEach((_, k) => overGrid[k].push({ full: 2, partial: 1, none: 0 }[ov[k]] ?? null));
      overall.set(it.itemId, plurality(ov));
      taut.set(it.itemId, plurality(scenR.map((r) => norm(r.rows.get(it.itemId)?.tautology_yes_no) || null)));
    }
    out.irr.criterionCoverage_nominal = alphaWithCi(scenR.map((_, k) => unitsCrit.map((u) => u[k])), 'nominal');
    out.irr.scenarioOverall_ordinal = alphaWithCi(overGrid, 'ordinal');

    // Ground truth: vonis yang BENAR per skenario pada versi aplikasi yang diuji. PASS bila aplikasi benar,
    // FAIL bila skenario menguji cacat nyata yang masih ada. Skenario yang tidak tercantum dianggap PASS.
    const gt = fs.existsSync(args.groundTruth) ? JSON.parse(fs.readFileSync(args.groundTruth, 'utf8')).expected : {};
    out.groundTruth = { file: fs.existsSync(args.groundTruth) ? args.groundTruth : null, expectedFail: Object.keys(gt).filter((k) => gt[k] === 'FAIL') };
    const relevanceOf = new Map(key.steps.flatMap((it) => it.occurrences.map((o) => [`${o.label}|${it.scenarioId}|${o.stepIndex}`, consensus.get(it.itemId)?.relevance ?? null])));
    const failedRelevance = (label, r) => {
      const idx = r.trace.findIndex((t) => t.executionFailed);
      return idx === -1 ? null : relevanceOf.get(`${label}|${r.id}|${idx + 1}`) ?? null;
    };
    // Hasil per konfigurasi per skenario (dari results.json: skenario tanpa assertion = gagal, cakupan 0)
    const perCfg = {};
    for (const label of key.labels) {
      const c = label.slice(key.prefix.length + 1);
      const results = JSON.parse(fs.readFileSync(path.join(args.runsDir, label, 'results.json'), 'utf8'));
      perCfg[c] = {};
      for (const r of results) {
        const it = key.scenarios.find((s) => s.scenarioId === r.id && s.runs.some((x) => x.label === label));
        const ov = it ? overall.get(it.itemId) : 'none';
        const expected = gt[r.id] || 'PASS';
        const verdict = r.verdict || (r.done ? 'PASS' : 'INCOMPLETE');
        const failRel = verdict === 'FAIL' ? failedRelevance(label, r) : null;
        perCfg[c][r.id] = {
          done: r.done, verdict, expected, coverage: it ? cover.get(it.itemId) : 0, overall: ov,
          // Benar bila: (harus PASS) agen selesai dan reviewer menilai cakupan full/partial; atau
          // (harus FAIL) agen memvonis FAIL lewat assertion yang dinilai reviewer relevan (skor 2).
          verified: expected === 'PASS' ? !!(r.done && (ov === 'full' || ov === 'partial')) : (verdict === 'FAIL' && failRel === 2),
          strict: expected === 'PASS' ? !!(r.done && ov === 'full') : (verdict === 'FAIL' && failRel === 2),
          falseDone: !!(r.done && ov === 'none'),
          maskedDefect: expected === 'FAIL' && verdict === 'PASS', // agen "lulus" padahal cacat nyata ada
          tautology: it ? taut.get(it.itemId) === 'yes' : false,
        };
      }
    }
    scenData = perCfg;
    const ids = Object.keys(perCfg[args.baseline] || {});
    if (!ids.length) throw new Error(`Konfigurasi baseline ${args.baseline} tidak ditemukan di kunci`);
    out.scenario = {};
    md.push('## Tabel A1 — Studi ablasi (tingkat skenario, n = ' + ids.length + ' skenario)', '',
      '| Konfigurasi | TSR otomatis | TSR terverifikasi | Δ vs ' + args.baseline + ' [95% CI] | p (McNemar, Holm) | Cakupan kriteria | Δ cakupan [95% CI] | p (Wilcoxon, Holm) | "Selesai" palsu | Cacat tertutupi |',
      '|---|---|---|---|---|---|---|---|---|---|');
    const rows = [];
    for (const c of Object.keys(perCfg).sort()) {
      const d = perCfg[c];
      const common = ids.filter((id) => d[id]);
      const mean = (f, cfg) => common.reduce((s, id) => s + f(perCfg[cfg][id]), 0) / common.length;
      const res = {
        n: common.length,
        autoTsr: mean((x) => (x.done ? 1 : 0), c),
        verifiedTsr: mean((x) => (x.verified ? 1 : 0), c),
        coverage: mean((x) => x.coverage, c),
        falseDone: common.filter((id) => d[id].falseDone).length,
        maskedDefects: common.filter((id) => d[id].maskedDefect).length,
      };
      if (c !== args.baseline) {
        const b = common.filter((id) => perCfg[args.baseline][id].verified && !d[id].verified).length;
        const cc = common.filter((id) => !perCfg[args.baseline][id].verified && d[id].verified).length;
        res.mcnemarP = S.mcnemarExact(b, cc);
        res.discordant = { baselineOnly: b, configOnly: cc };
        res.deltaTsr = res.verifiedTsr - mean((x) => (x.verified ? 1 : 0), args.baseline);
        res.deltaTsrCi = S.clusterBootstrapCI(common, (s) => s.reduce((a, id) => a + (d[id].verified ? 1 : 0) - (perCfg[args.baseline][id].verified ? 1 : 0), 0) / s.length, { seed: 3 });
        const diffs = common.map((id) => d[id].coverage - perCfg[args.baseline][id].coverage);
        const w = S.wilcoxon(diffs);
        res.wilcoxonP = w.p; res.wilcoxonMethod = w.method;
        res.deltaCoverage = diffs.reduce((a, x) => a + x, 0) / diffs.length;
        res.deltaCoverageCi = S.clusterBootstrapCI(diffs, (s) => s.reduce((a, x) => a + x, 0) / s.length, { seed: 5 });
      }
      out.scenario[c] = res;
      rows.push(c);
    }
    const others = rows.filter((c) => c !== args.baseline);
    const hm = S.holm(others.map((c) => out.scenario[c].mcnemarP));
    const hw = S.holm(others.map((c) => out.scenario[c].wilcoxonP));
    others.forEach((c, i) => { out.scenario[c].mcnemarPHolm = hm[i]; out.scenario[c].wilcoxonPHolm = hw[i]; });
    for (const c of rows) {
      const r = out.scenario[c];
      const base = c === args.baseline;
      md.push(`| ${c}${base ? ' (acuan)' : ''} | ${pct(r.autoTsr)} | ${pct(r.verifiedTsr)} | ${base ? '—' : `${(100 * r.deltaTsr).toFixed(1)} pp ${r.deltaTsrCi ? `[${(100 * r.deltaTsrCi[0]).toFixed(1)}, ${(100 * r.deltaTsrCi[1]).toFixed(1)}]` : ''}`} | ${base ? '—' : f3(r.mcnemarPHolm)} | ${pct(r.coverage)} | ${base ? '—' : `${(100 * r.deltaCoverage).toFixed(1)} pp [${(100 * r.deltaCoverageCi[0]).toFixed(1)}, ${(100 * r.deltaCoverageCi[1]).toFixed(1)}]`} | ${base ? '—' : f3(r.wilcoxonPHolm)} | ${r.falseDone} | ${r.maskedDefects} |`);
    }
    md.push('', 'TSR terverifikasi = vonis benar: skenario harus-PASS diselesaikan dengan cakupan "full"/"partial" menurut konsensus reviewer; skenario harus-FAIL divonis FAIL lewat assertion yang dinilai relevan (skor 2).',
      '"Selesai" palsu = agen menyatakan selesai tetapi konsensus reviewer menilai "none" (tidak ada kriteria teruji).',
      'Cacat tertutupi = skenario yang seharusnya FAIL (cacat nyata, lihat ground-truth.json) tetapi agen memvonis PASS.',
      `Ground truth: ${out.groundTruth.file ? `${out.groundTruth.expectedFail.length} skenario harus FAIL (${out.groundTruth.expectedFail.join(', ')})` : 'tidak ada file; semua skenario dianggap harus PASS'}.`,
      'Δ dan CI: selisih terhadap acuan, CI 95% bootstrap dengan resampling skenario. p disesuaikan Holm atas semua konfigurasi.', '',
      `Reliabilitas skenario: cakupan per-kriteria α = ${f3(out.irr.criterionCoverage_nominal.alpha)}, penilaian keseluruhan α (ordinal) = ${f3(out.irr.scenarioOverall_ordinal.alpha)}.`, '');
  } else {
    md.push('## Tabel A1 — Studi ablasi', '', 'n/a: butuh minimal 2 file scenario-ratings-*.csv.', '');
  }

  // ---------- 5. Waktu review (studi H2, bila ada keputusan manusia di run) ----------
  const times = [];
  for (const label of key.labels) {
    const results = JSON.parse(fs.readFileSync(path.join(args.runsDir, label, 'results.json'), 'utf8'));
    results.forEach((r) => r.trace.forEach((s) => { if (s.decision && typeof s.reviewMs === 'number' && s.reviewMs > 500) times.push({ label, ms: s.reviewMs, decision: s.decision }); }));
  }
  if (times.length) {
    const ms = times.map((t) => t.ms).sort((a, b) => a - b);
    const q = (p) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))];
    out.reviewTime = { n: ms.length, medianSec: median(ms) / 1000, q1Sec: q(0.25) / 1000, q3Sec: q(0.75) / 1000, decisions: times.reduce((a, t) => { a[t.decision] = (a[t.decision] || 0) + 1; return a; }, {}) };
    md.push('## Tabel H4 — Waktu keputusan reviewer (sesi interaktif)', '', `n = ${ms.length} eskalasi; median ${out.reviewTime.medianSec.toFixed(1)} s (IQR ${out.reviewTime.q1Sec.toFixed(1)}–${out.reviewTime.q3Sec.toFixed(1)} s); keputusan: ${JSON.stringify(out.reviewTime.decisions)}.`, '');
  }

  fs.writeFileSync(path.join(args.reviewDir, 'analysis.json'), JSON.stringify({ ...out, perScenario: scenData }, null, 2));
  fs.writeFileSync(path.join(args.reviewDir, 'analysis.md'), md.join('\n'));
  console.log(md.join('\n'));
  console.log(`\nTersimpan: ${path.join(args.reviewDir, 'analysis.md')}`);
}

main();
