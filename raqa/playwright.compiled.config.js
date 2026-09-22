// @ts-check
// Menjalankan spec hasil kompilasi RAQA dengan pengaturan yang sama persis dengan B1 (retries 0, proyek, locale),
// dan menulis laporan JSON ke results/runs/<RUN_LABEL>/ agar compute-metrics.js dapat dipakai tanpa perubahan.
// Jalankan dari root ppi27-e2e:
//   npx playwright test -c raqa/playwright.compiled.config.js
//   node scripts/run-repeated.js --k 10 --label raqa-compiled -- -c raqa/playwright.compiled.config.js
const path = require('path');
const base = require('../playwright.config.js');

const ROOT = path.resolve(__dirname, '..');
const RUN_LABEL = process.env.RUN_LABEL || 'raqa-compiled';
const RUN_ID = process.env.RUN_ID || `single-${new Date().toISOString().replace(/[:.]/g, '-')}`;
// RAQA_TESTDIR menunjuk ke raqa/runs/<label-eksperimen>/compiled/ saat mengukur FR/FDR hasil satu eksperimen;
// default raqa/compiled/ dipakai untuk uji manual (scripts/demo.js, offline-check.js).
const TEST_DIR = process.env.RAQA_TESTDIR ? path.resolve(process.env.RAQA_TESTDIR) : path.join(__dirname, 'compiled');

module.exports = {
  ...base,
  testDir: TEST_DIR,
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(ROOT, 'results', 'runs', RUN_LABEL, `${RUN_ID}.json`) }],
    ['html', { outputFolder: path.join(ROOT, 'results', 'html', RUN_LABEL), open: 'never' }],
  ],
  outputDir: path.join(ROOT, 'results', 'artifacts', RUN_LABEL, RUN_ID),
};
