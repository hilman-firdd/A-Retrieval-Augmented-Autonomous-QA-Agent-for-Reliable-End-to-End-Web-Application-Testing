// @ts-check
const fs = require('fs');
const path = require('path');
const { Document } = require('@langchain/core/documents');
const { CONFIG, isExcludedFromCorpus } = require('../config');

/** @param {string} p */
function guard(p) {
  if (isExcludedFromCorpus(p)) throw new Error(`Sumber ${p} dikecualikan dari korpus (bocor kunci jawaban FDR).`);
}

/** Test case historis: satu Document per skenario di scenarios/catalog.json. */
function loadCatalog(file = CONFIG.paths.catalog) {
  guard(file);
  const { scenarios } = JSON.parse(fs.readFileSync(file, 'utf8'));
  return scenarios.map((s) => new Document({
    pageContent: [
      `Scenario ${s.id} (${s.feature})`,
      `Goal: ${s.goal}`,
      'Acceptance criteria:',
      ...s.acceptance_criteria.map((c) => `- ${c}`),
      `Oracle: ${(s.oracle || []).join(', ')}`,
    ].join('\n'),
    metadata: { source: 'catalog', type: 'test_case', id: s.id },
  }));
}

/** Trace eksekusi: satu Document per test, diringkas dari k run baseline (verdict + error pertama). */
function loadExecutionTraces(dir = CONFIG.paths.baselineRuns) {
  guard(dir);
  const { loadRuns, summarize } = require(path.join(CONFIG.paths.e2eRoot, 'scripts', 'lib-results.js'));
  const label = path.basename(dir);
  const cwd = process.cwd();
  process.chdir(CONFIG.paths.e2eRoot);
  try {
    const { rows, runs } = loadRuns(label);
    return summarize(rows).map((t) => new Document({
      pageContent: [
        `Execution trace ${t.id} [${t.project}] ${t.title}`,
        `Verdict over ${t.n} runs: ${t.verdict} (${t.pass}/${t.n} passed)`,
        ...(t.errors.length ? [`First error: ${t.errors[0]}`] : []),
      ].join('\n'),
      metadata: { source: 'baseline-runs', type: 'execution_trace', id: t.id, project: t.project, runs },
    }));
  } finally {
    process.chdir(cwd);
  }
}

/** Laporan cacat awal dari README (bagian "Temuan awal"), satu Document per temuan. */
function loadReadmeDefects(file = path.join(CONFIG.paths.e2eRoot, 'README.md')) {
  guard(file);
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('## Temuan awal');
  if (start === -1) return [];
  return text.slice(start).split(/\n(?=### )/).slice(1).map((block) => new Document({
    pageContent: block.trim(),
    metadata: { source: 'readme', type: 'defect_report', id: (/^### (T\d+)/.exec(block) || [])[1] || 'README' },
  }));
}

/** Jenis dokumen ditebak dari nama berkas; berkas yang tidak cocok tetap masuk sebagai 'document'. @param {string} file */
function typeFromFilename(file) {
  const n = path.basename(file).toLowerCase();
  if (/bug|defect|issue/.test(n)) return 'defect_report';
  if (/element|locator|selector/.test(n)) return 'element_ids';
  if (/test|case|scenario/.test(n)) return 'test_case';
  if (/req|spec|story/.test(n)) return 'requirement';
  return 'document';
}

/**
 * Dokumen QA lokal di ./qa_docs/: .md/.txt (requirement, test case langkah demi langkah) dan
 * .csv (bug report, daftar ID elemen). CSV dipecah satu Document per baris ("kolom: nilai").
 */
async function loadQaDocs(dir = CONFIG.paths.qaDocs) {
  if (!fs.existsSync(dir)) {
    console.warn(`[raqa] folder ${dir} tidak ada, qa_docs dilewati.`);
    return [];
  }
  const { DirectoryLoader } = require('@langchain/classic/document_loaders/fs/directory');
  const { TextLoader } = require('@langchain/classic/document_loaders/fs/text');
  const { CSVLoader } = require('@langchain/community/document_loaders/fs/csv');
  const loader = new DirectoryLoader(dir, {
    '.md': (p) => new TextLoader(p),
    '.txt': (p) => new TextLoader(p),
    '.csv': (p) => new CSVLoader(p),
  });
  const docs = await loader.load();
  return docs
    .filter((d) => !isExcludedFromCorpus(d.metadata.source))
    .map((d) => {
      const rel = path.relative(dir, d.metadata.source);
      const id = d.metadata.line === undefined ? rel : `${rel}:${d.metadata.line}`;
      return new Document({ pageContent: d.pageContent, metadata: { ...d.metadata, source: 'qa_docs', file: rel, type: typeFromFilename(rel), id } });
    });
}

/**
 * Verdict reviewer dari sesi-sesi sebelumnya (raqa/.memory/reviewer-verdicts.jsonl), satu Document per
 * verdict -- ini yang membuat indeks jadi "memori bersama yang tumbuh" (RQ5 naskah): pertanyaan yang
 * sudah dijawab reviewer tidak perlu dijawab dua kali karena verdict-nya bisa diambil kembali.
 */
/**
 * Verdict yang BUKAN keputusan manusia tidak boleh masuk korpus. Entri baru ditandai reviewerKind='stub';
 * entri lama (sebelum penanda ini ada) dikenali dari komentar stubReviewer.js. Tanpa filter ini, penolakan
 * mekanis dari stub diambil kembali oleh retrieval seolah-olah pengetahuan reviewer (terbukti di
 * offline-check: unit teratas adalah verdict stub dari run pilot).
 * @param {any} v
 */
function isHumanVerdict(v) {
  if (v.reviewerKind) return v.reviewerKind === 'human';
  return !/^stub non-interaktif/.test(v.verdict?.comment || '');
}

function loadReviewerVerdicts(file = path.join(CONFIG.paths.memoryDir, 'reviewer-verdicts.jsonl')) {
  if (!fs.existsSync(file)) return [];
  const all = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const human = all.filter(isHumanVerdict);
  if (human.length < all.length) console.warn(`[raqa] ${all.length - human.length} verdict non-manusia (stub) dilewati dari korpus.`);
  return human.map((v, i) => {
    return new Document({
      pageContent: [
        `Reviewer verdict for goal: ${v.goal}`,
        `Proposed step: ${JSON.stringify(v.proposal)}`,
        `Scores at proposal time: ${JSON.stringify(v.scores)}`,
        `Decision: ${v.verdict.decision}${v.verdict.comment ? ` (${v.verdict.comment})` : ''}${v.verdict.correction ? ` correction: ${v.verdict.correction}` : ''}`,
      ].join('\n'),
      metadata: { source: 'reviewer-verdicts', type: 'reviewer_verdict', id: `verdict-${i}`, at: v.at },
    });
  });
}

module.exports = { loadCatalog, loadExecutionTraces, loadReadmeDefects, loadQaDocs, loadReviewerVerdicts, isHumanVerdict };
