#!/usr/bin/env node
// Studi H0: rater kedua yang independen mengklasifikasikan ulang 19 test yang gagal pada instance lokal
// tanpa fault (Tabel 4 naskah), lalu kesepakatannya dengan klasifikasi penulis dihitung (Cohen's kappa).
// Tujuan: menjawab ancaman validitas "penulis = pengembang SIMASIS = satu-satunya pengklasifikasi".
//
//   node scripts/h0-failure-classification.js template        -> review/h0-sheet.csv (untuk rater kedua)
//   node scripts/h0-failure-classification.js analyze <csv>   -> kappa + matriks konfusi
//
// Rater kedua melihat judul test, error, dan (disarankan) trace Playwright-nya; TIDAK melihat label penulis.
const fs = require('fs');
const path = require('path');
const S = require('./lib-stats');

const ROOT = path.join(__dirname, '..', '..');
const CATS = ['product', 'test', 'timing', 'environment'];

// Label penulis untuk ke-19 test, sesuai Tabel 4 naskah (kunci: scenario|project|potongan judul).
const AUTHOR = [
  ['S-AUTH-03', 'chromium-desktop', 'kredensial salah', 'product'],
  ['S-HOME-01', 'chromium-desktop', 'Daftar PSB', 'test'],
  ['S-HOME-04', 'chromium-desktop', 'program unggulan', 'timing'],
  ['S-HOME-05', 'mobile-chrome', 'berita terbaru', 'product'],
  ['S-LINK-02', 'chromium-desktop', 'HTTPS', 'product'],
  ['S-NAV-02', 'chromium-desktop', 'NIZHAM', 'test'],
  ['S-NAV-02', 'chromium-desktop', 'TSANAWIYYAH', 'test'],
  ['S-NAV-02', 'chromium-desktop', 'WEB DESIGN', 'test'],
  ['S-NAV-02', 'chromium-desktop', 'BAHASA ARAB', 'test'],
  ['S-NAV-02', 'chromium-desktop', 'BERITA TERBARU', 'test'],
  ['S-NAV-02', 'chromium-desktop', 'BROSUR PESANTREN UMUM', 'test'],
  ['S-NAV-02', 'chromium-desktop', 'KETENTUAN SELEKSI SANTRI', 'test'],
  ['S-NAV-02', 'chromium-desktop', 'SIMASIS > LOGIN', 'test'],
  ['S-NEWS-05', 'chromium-desktop', 'konsisten dengan kartu', 'test'],
  ['S-NEWS-05', 'mobile-chrome', 'konsisten dengan kartu', 'test'],
  ['S-NEWS-06', 'chromium-desktop', 'breadcrumb', 'test'],
  ['S-QUAL-01', 'chromium-desktop', 'daftar berita', 'product'],
  ['S-QUAL-01', 'chromium-desktop', 'artikel santri', 'product'],
  ['S-QUAL-02', 'chromium-desktop', '[login]', 'product'],
];

function readFailures() {
  const text = fs.readFileSync(path.join(ROOT, 'results', 'metrics', 'baseline-local', 'per-test.csv'), 'utf8').replace(/^\ufeff/, '');
  const { parseCsvRows } = { parseCsvRows: (t) => { const rows = []; let row = []; let c = ''; let q = false; for (let i = 0; i < t.length; i += 1) { const ch = t[i]; if (q) { if (ch === '"' && t[i + 1] === '"') { c += '"'; i += 1; } else if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(c); c = ''; } else if (ch === '\n') { row.push(c); rows.push(row); row = []; c = ''; } else if (ch !== '\r') c += ch; } if (c || row.length) { row.push(c); rows.push(row); } return rows; } };
  const [h, ...b] = parseCsvRows(text);
  return b.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? '']))).filter((r) => r.verdict && r.verdict !== 'stable-pass');
}

function authorLabel(r) {
  const m = AUTHOR.filter(([id, proj, frag]) => r.scenario_id === id && r.project === proj && r.title.includes(frag));
  if (m.length !== 1) throw new Error(`Label penulis ambigu/hilang untuk: ${r.scenario_id} ${r.project} ${r.title}`);
  return m[0][3];
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const [cmd, file] = process.argv.slice(2);
const failures = readFailures();
if (failures.length !== 19) console.warn(`Peringatan: ditemukan ${failures.length} kegagalan, bukan 19.`);

if (cmd === 'template') {
  const out = path.join(__dirname, '..', 'review');
  fs.mkdirSync(out, { recursive: true });
  const rows = failures.map((r, i) => [`F${String(i + 1).padStart(2, '0')}`, r.scenario_id, r.project, r.title, r.verdict, `${r.passes}/${r.runs}`, r.errors.split(' || ')[0], '', '']);
  fs.writeFileSync(path.join(out, 'h0-sheet.csv'), '\ufeff' + [['item_id', 'scenario_id', 'project', 'test_title', 'verdict', 'passes', 'first_error', `class_${CATS.join('_')}`, 'comment'], ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n'));
  fs.writeFileSync(path.join(out, 'h0-KEY-jangan-dibagikan.json'), JSON.stringify(failures.map((r, i) => ({ itemId: `F${String(i + 1).padStart(2, '0')}`, author: authorLabel(r) })), null, 2));
  console.log(`review/h0-sheet.csv (${rows.length} item). Kategori: ${CATS.join(' | ')}`);
  console.log('Definisi: product = cacat aplikasi; test = cacat pada kode test (locator/ekspektasi); timing = hasil berubah antar-run karena waktu; environment = masalah server/infrastruktur, bukan kode aplikasi.');
} else if (cmd === 'analyze') {
  const key = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'review', 'h0-KEY-jangan-dibagikan.json'), 'utf8'));
  const text = fs.readFileSync(file, 'utf8').replace(/^\ufeff/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map((h) => h.replace(/"/g, ''));
  const col = header.findIndex((h) => h.startsWith('class_'));
  const rater = new Map(lines.slice(1).map((l) => { const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')); return [cells[0], cells[col].trim().toLowerCase()]; }));
  const a = []; const b = [];
  for (const k of key) { const v = rater.get(k.itemId); if (!CATS.includes(v)) throw new Error(`${k.itemId}: kategori "${v}" tidak valid (${CATS.join('/')})`); a.push(k.author); b.push(v); }
  const agree = a.filter((x, i) => x === b[i]).length;
  console.log(`Cohen kappa (penulis vs rater kedua) = ${S.cohenKappa(a, b).toFixed(3)}; kesepakatan mentah ${agree}/${a.length}`);
  console.log('\nMatriks konfusi (baris = penulis, kolom = rater kedua):');
  console.log(['', ...CATS].map((c) => c.padEnd(12)).join(''));
  for (const r of CATS) console.log([r, ...CATS.map((c) => String(a.filter((x, i) => x === r && b[i] === c).length))].map((c) => c.padEnd(12)).join(''));
  console.log('\nKetidaksepakatan (diselesaikan lewat diskusi, dan hasilnya dilaporkan di naskah):');
  key.forEach((k, i) => { if (a[i] !== b[i]) console.log(`  ${k.itemId}: penulis=${a[i]} rater=${b[i]}`); });
} else if (cmd === 'final') {
  // Kappa SETELAH diskusi: sama seperti 'analyze', tapi item yang tidak sepakat memakai kategori final
  // dari file overrides (item_id,kategori_final), hasil kesepakatan penulis+rater, bukan salah satu pihak.
  const overridesFile = process.argv[4];
  if (!overridesFile) throw new Error('Pakai: final <rater.csv> <overrides.csv>');
  const key = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'review', 'h0-KEY-jangan-dibagikan.json'), 'utf8'));
  const parseSimple = (t) => t.trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
  const overrides = new Map(parseSimple(fs.readFileSync(overridesFile, 'utf8')).map(([id, cat]) => [id, cat.trim().toLowerCase()]));
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(',').map((h) => h.replace(/"/g, ''));
  const col = header.findIndex((h) => h.startsWith('class_'));
  const rater = new Map(lines.slice(1).map((l) => { const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')); return [cells[0], cells[col].trim().toLowerCase()]; }));
  const a = []; const b = [];
  for (const k of key) {
    const v = overrides.get(k.itemId) ?? rater.get(k.itemId);
    if (!CATS.includes(v)) throw new Error(`${k.itemId}: kategori "${v}" tidak valid`);
    a.push(overrides.has(k.itemId) ? v : k.author); // item yang direvisi: kedua sisi disamakan ke keputusan final
    b.push(v);
  }
  const agree = a.filter((x, i) => x === b[i]).length;
  console.log(`Setelah diskusi -- kesepakatan ${agree}/${a.length} (item yang direvisi disamakan ke keputusan final, sehingga kappa naik menjadi 1,0 secara definisi; laporkan sebagai "kesepakatan akhir 100% setelah diskusi", BUKAN sebagai kappa independen kedua).`);
  console.log('\nKlasifikasi final ke-19 item:');
  key.forEach((k, i) => console.log(`  ${k.itemId}: ${b[i]}${overrides.has(k.itemId) ? '  (direvisi dari penulis=' + k.author + ')' : ''}`));
} else {
  console.log('Pakai: template | analyze <csv> | final <csv> <overrides.csv>');
}
