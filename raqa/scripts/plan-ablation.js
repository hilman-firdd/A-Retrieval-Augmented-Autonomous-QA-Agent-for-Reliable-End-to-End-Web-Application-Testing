#!/usr/bin/env node
// Perencana anggaran waktu ablasi. Tidak menebak: memakai durasi NYATA dari run yang sudah selesai.
//
// Alur untuk anggaran 1 jam:
//   1. node scripts/run-ablation.js --ids prereg --configs A0      (run nyata pertama, ±10-15 menit)
//   2. node scripts/plan-ablation.js --prefix abl --budget-min 60   (hitung apa yang masih muat)
//   3. jalankan konfigurasi yang direkomendasikan dengan --configs ...
//
// Durasi konfigurasi dengan retrieval diperkirakan dari A0; tanpa retrieval (A1) dari A1 bila sudah ada,
// selain itu dari rata-rata B2 pilot (runs/b2-v1). Margin 15% ditambahkan untuk variasi.
const fs = require('fs');
const path = require('path');
const { CONFIGS } = require('./ablation-configs');

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const prefix = opt('prefix', 'abl');
const budgetMin = Number(opt('budget-min', 60));
const margin = Number(opt('margin', 1.15));
const RUNS = path.join(__dirname, '..', 'runs');

const secsOf = (label) => {
  const f = path.join(RUNS, label, 'results.json');
  if (!fs.existsSync(f)) return null;
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  return { n: r.length, total: r.reduce((a, x) => a + x.seconds, 0), mean: r.reduce((a, x) => a + x.seconds, 0) / r.length };
};

const a0 = secsOf(`${prefix}-A0`);
if (!a0) { console.error(`Belum ada runs/${prefix}-A0. Jalankan dulu: node scripts/run-ablation.js --ids prereg --configs A0`); process.exit(1); }
const a1 = secsOf(`${prefix}-A1`) || secsOf('b2-v1');
const nScen = a0.n;
const done = CONFIGS.filter((c) => c.phase === 'ablation' && secsOf(`${prefix}-${c.id}`));
const spentMin = done.reduce((a, c) => a + secsOf(`${prefix}-${c.id}`).total, 0) / 60;
const estMin = (c) => ((c.retrieval ? a0.mean : a1.mean) * nScen * margin) / 60;

console.log(`Skenario: ${nScen} | rata-rata A0: ${a0.mean.toFixed(1)} s/skenario | tanpa retrieval: ${a1.mean.toFixed(1)} s/skenario`);
console.log(`Sudah selesai: ${done.map((c) => c.id).join(', ')} (${spentMin.toFixed(1)} menit). Sisa anggaran: ${(budgetMin - spentMin).toFixed(1)} menit.\n`);

// Urutan prioritas: MUST dulu (urutan di ablation-configs.js), lalu SHOULD.
const order = ['must', 'should'].flatMap((p) => CONFIGS.filter((c) => c.phase === 'ablation' && c.priority === p));
let left = budgetMin - spentMin;
const plan = [];
for (const c of order) {
  if (done.includes(c)) continue;
  const m = estMin(c);
  const fits = m <= left;
  console.log(`${fits ? 'MUAT ' : 'TIDAK'} ${c.id.padEnd(3)} ${c.priority.padEnd(6)} ~${m.toFixed(1).padStart(5)} menit  ${c.label}`);
  if (fits) { plan.push(c.id); left -= m; }
}
const mustLeft = order.filter((c) => c.priority === 'must' && !done.includes(c) && !plan.includes(c.id));
console.log(`\nRekomendasi sesi ini: node scripts/run-ablation.js --ids prereg --configs ${plan.join(',') || '(tidak ada)'}`);
if (mustLeft.length) console.log(`PERHATIAN: konfigurasi MUST yang tidak muat (${mustLeft.map((c) => c.id).join(', ')}) harus dijalankan di sesi kedua dengan kode & skenario yang sama. JANGAN mengurangi skenario untuk menghemat waktu: itu mengubah pre-registrasi.`);
