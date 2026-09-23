// @ts-check
const fs = require('fs');
const path = require('path');
const { ChatOllama } = require('@langchain/ollama');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { z } = require('zod');
const { chromium } = require('playwright');
const { CONFIG, ALL_SOURCES } = require('./config');
const { KnowledgeBase } = require('./retrieval');
const { loadCatalog, loadExecutionTraces, loadReadmeDefects, loadQaDocs, loadReviewerVerdicts } = require('./sources/local');
const { observe, locate } = require('./page');
const { askReviewer } = require('./human');
const { compileRun } = require('./compiler');
const { LocatorMemory, scoreLocator } = require('./locatorScore');
const { ImplicitOracle, scoreOracle } = require('./oracle');

const StepProposal = z.object({
  done: z.boolean().describe('true bila goal sudah tercapai dan tidak perlu langkah lagi'),
  type: z.enum(['goto', 'click', 'hover', 'fill', 'expectVisible', 'expectURL', 'expectTitle', 'expectAttribute']),
  role: z.string().nullable().describe('ARIA role target, persis seperti di snapshot; null untuk goto/expectURL/expectTitle'),
  name: z.string().nullable().describe('accessible name target, persis seperti di snapshot; boleh substring untuk expectVisible'),
  value: z.string().nullable().describe('teks yang diisi (fill), atau substring yang diharapkan (expectTitle/expectAttribute)'),
  path: z.string().nullable().describe('path relatif, hanya untuk goto'),
  pattern: z.string().nullable().describe('regex URL, hanya untuk expectURL'),
  attribute: z.string().nullable().describe('nama atribut HTML, hanya untuk expectAttribute (mis. "href", "type")'),
  citedUnits: z.array(z.string()).describe('unitId konteks yang menjadi dasar langkah ini'),
  rationale: z.string(),
});

const SYSTEM_PROMPT = `You are RAQA, a QA agent that tests the SIMASIS web portal through its accessibility tree.
Propose exactly one next step toward the goal. Ground every step in the provided context units and page snapshot:
- use a role and accessible name that appear in the current snapshot; do not invent elements;
- cite the unitId of each context unit you relied on; cite none if the context did not inform the step;
- for assertions, derive the expected outcome from the acceptance criteria in the context, not from what the page currently shows;
- prefer expectAttribute for links/hrefs, expectTitle for the page <title>, and expectVisible (with a partial name) for headings or text content;
- for expectAttribute, "value" is the attribute's VALUE, never its name (e.g. attribute="aria-expanded", value="true"; attribute="type", value="submit" -- do not write value="aria-expanded" or value="type");
- a goal usually needs several assertions -- propose them one at a time across turns, not all at once;
- always list every context unitId you relied on in citedUnits, even if the connection feels obvious to you;
- never repeat a step you already executed in "Last actions" with the exact same type/role/name/value -- if the goal's acceptance criteria are already covered by what you asserted so far, set done=true instead of asserting it again.
If the context and the page disagree, still propose your best step and explain the disagreement in the rationale.
Set done=true once the goal's acceptance criteria are satisfied by what you have already asserted.`;

/** PRNG deterministik (mulberry32) untuk undian audit, agar run berulang dengan seed sama identik. @param {number} seed */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NO_RETRIEVAL_NOTICE = '(retrieval disabled for this run -- B2 baseline: propose from the goal and page snapshot alone)';

class RAQAAgent {
  /**
   * @param {{ embeddings?: import('@langchain/core/embeddings').EmbeddingsInterface,
   *           reviewer?: typeof askReviewer, headless?: boolean, retrieval?: boolean,
   *           locatorMemory?: LocatorMemory, persistMemory?: boolean, sources?: string[],
   *           retrievers?: string[], memoryDir?: string, reviewerKind?: 'human'|'stub',
   *           auditSeed?: number, auditRate?: number, screenshotDir?: string }} [opts]
   */
  constructor(opts = {}) {
    this.opts = opts;
    this.retrievalEnabled = opts.retrieval !== false; // false => B2 (agen sama, tanpa retrieval)
    /** Sumber korpus aktif (ablasi leave-one-out). */
    this.sources = opts.sources || CONFIG.sources;
    const unknown = this.sources.filter((x) => !ALL_SOURCES.includes(x));
    if (unknown.length) throw new Error(`Sumber tidak dikenal: ${unknown.join(', ')} (pilihan: ${ALL_SOURCES.join(', ')})`);
    this.memoryDir = opts.memoryDir || CONFIG.paths.memoryDir;
    this.kb = new KnowledgeBase({ embeddings: opts.embeddings, retrievers: opts.retrievers });
    this.reviewer = opts.reviewer || askReviewer;
    /** 'human' hanya bila reviewer adalah manusia sungguhan (askReviewer); stub selalu 'stub'. */
    this.reviewerKind = opts.reviewerKind || (this.reviewer === askReviewer ? 'human' : 'stub');
    this.memory = opts.locatorMemory || new LocatorMemory(path.join(this.memoryDir, 'locator-history.json'));
    this.persistMemory = opts.persistMemory !== false;
    this.auditRate = opts.auditRate ?? CONFIG.gate.auditRate;
    this.rng = mulberry32(opts.auditSeed ?? CONFIG.gate.auditSeed);
    this.screenshotDir = opts.screenshotDir || null;
    /** Runnable LLM dengan keluaran terstruktur (JSON schema lewat parameter `format` Ollama). @type {any} */
    this.llm = null;
    /** @type {import('playwright').Browser | null} */
    this.browser = null;
    /** @type {import('playwright').Page | null} */
    this.page = null;
    /** @type {ImplicitOracle | null} */
    this.implicitOracle = null;
    /** Langkah yang sudah dieksekusi dan diterima; bahan kompilasi. @type {import('./compiler').Step[]} */
    this.trace = [];
    /** Keputusan reviewer sesi ini; ditulis balik ke .memory/reviewer-verdicts.json saat close(). @type {object[]} */
    this.reviewerVerdicts = [];
    /** Setiap usulan (diterima maupun tidak), untuk menghitung HAR dan proporsi eskalasi. @type {object[]} */
    this.proposals = [];
    /** Pergantian ke kandidat locator ke-2/3 setelah kandidat pertama gagal saat eksekusi. @type {object[]} */
    this.repairs = [];
  }

  async init() {
    const has = (x) => this.sources.includes(x);
    const docs = this.retrievalEnabled ? [
      ...(has('catalog') ? loadCatalog() : []),
      ...(has('traces') ? loadExecutionTraces() : []),
      ...(has('defects') ? loadReadmeDefects() : []),
      ...(has('qa_docs') ? await loadQaDocs() : []),
      ...(has('verdicts') ? loadReviewerVerdicts(path.join(this.memoryDir, 'reviewer-verdicts.jsonl')) : []),
    ] : [];
    /** Jumlah dokumen per sumber, dicatat di summary agar konfigurasi ablasi bisa diverifikasi. */
    this.corpusStats = docs.reduce((acc, d) => { const k = d.metadata.source; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    await this.kb.build(docs.length ? docs : [{ pageContent: '(no context)', metadata: { unitId: 'none', type: 'none' } }]);
    const { model, temperature, seed, numCtx, think } = CONFIG.llm;
    this.llm = new ChatOllama({ model, temperature, seed, numCtx, think, baseUrl: CONFIG.ollama.baseUrl })
      .withStructuredOutput(StepProposal, { name: 'StepProposal' });
    this.browser = await chromium.launch({ headless: this.opts.headless !== false });
    const context = await this.browser.newContext({ baseURL: CONFIG.app.baseURL, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
    this.page = await context.newPage();
    this.implicitOracle = new ImplicitOracle(this.page);
    return this;
  }

  /** q_t = goal + deskripsi singkat halaman + beberapa aksi terakhir (Bagian 3 naskah). @param {string} goal @param {string} pageSummary */
  buildQuery(goal, pageSummary) {
    const last = this.trace.slice(-3).map((s) => JSON.stringify(s)).join('; ');
    return [`Goal: ${goal}`, `Page: ${pageSummary}`, last ? `Last actions: ${last}` : ''].filter(Boolean).join('\n');
  }

  /** @param {string} goal */
  async proposeStep(goal) {
    if (!this.page || !this.llm) throw new Error('Panggil init() dulu.');
    const obs = await observe(this.page);
    const units = this.retrievalEnabled ? await this.kb.retrieve(this.buildQuery(goal, obs.summary)) : [];
    const contextText = this.retrievalEnabled
      ? units.map((u) => `<unit id="${u.metadata.unitId}" type="${u.metadata.type}">\n${u.pageContent}\n</unit>`).join('\n')
      : NO_RETRIEVAL_NOTICE;
    const raw = await this.llm.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(`<goal>${goal}</goal>\n<context>\n${contextText}\n</context>\n<page url="${obs.url}" title="${obs.title}">\n${obs.snapshot}\n</page>`),
    ]);
    // Validasi ulang di sisi klien: model 4B bisa saja menghasilkan JSON yang lolos format tapi melanggar skema.
    const proposal = StepProposal.parse(raw);
    return { proposal, units, obs };
  }

  /**
   * c_t = min{c_act, c_loc, c_orc} (Persamaan 3 naskah).
   * c_act: unit yang dikutip semuanya benar-benar diambil retriever (0 bila mengarang atau tak berretrieval).
   * c_loc: margin skor antara dua kandidat locator terbaik (lihat locatorScore.js).
   * c_orc: 1 bila tier implicit bersih saat langkah ini diusulkan, 0 bila sudah ada masalah.
   * @param {z.infer<typeof StepProposal>} p @param {import('@langchain/core/documents').Document[]} units
   */
  async score(p, units) {
    if (!this.page || !this.implicitOracle) throw new Error('Panggil init() dulu.');
    const retrieved = new Set(units.map((u) => u.metadata.unitId));
    const cAct = this.retrievalEnabled && p.citedUnits.length > 0 && p.citedUnits.every((id) => retrieved.has(id)) ? 1 : 0;
    // goto/expectURL/expectTitle tidak memakai locator sama sekali -- role/name di sana (bila model 4B
    // tetap mengisinya walau diminta null) diabaikan, bukan dinilai sebagai kandidat locator yang hilang.
    const usesLocator = ['click', 'hover', 'fill', 'expectVisible', 'expectAttribute'].includes(p.type);
    let cLoc = 1;
    let ranked = [];
    if (usesLocator && p.role && p.name) {
      const r = await scoreLocator(this.page, p.role, p.name, this.memory);
      cLoc = r.c_loc;
      ranked = r.ranked;
    }
    const cOrc = scoreOracle(this.implicitOracle);
    // Pemeriksaan kewarasan: ditemukan lewat pengujian langsung bahwa Qwen3 4B kadang menaruh NAMA
    // atribut sebagai NILAI-nya sendiri (mis. attribute="href", value="href") meski sistem prompt
    // sudah eksplisit melarangnya. Ini bukan soal locator atau grounding (c_loc/c_act tetap benar),
    // jadi dideteksi terpisah dan dipaksa ke reviewer alih-alih dieksekusi lalu gagal di tengah skenario.
    const selfReferential = p.type === 'expectAttribute' && !!p.attribute && !!p.value
      && p.value.trim().toLowerCase() === p.attribute.trim().toLowerCase();
    const cT = selfReferential ? 0 : Math.min(cAct, cLoc, cOrc);
    const hallucinated = usesLocator && !!(p.role && p.name) && ranked.length === 0;
    this.proposals.push({ goal: undefined, proposal: p, hallucinated, selfReferential });
    return { c_act: cAct, c_loc: cLoc, c_orc: cOrc, c_t: cT, candidates: ranked, hallucinated, selfReferential };
  }

  /**
   * Terima otomatis hanya bila c_t ≥ τ dan tidak terpilih audit acak; selain itu ke reviewer.
   * @param {string} goal @param {z.infer<typeof StepProposal>} proposal
   * @param {Awaited<ReturnType<RAQAAgent['score']>>} scores @param {import('@langchain/core/documents').Document[]} units
   */
  async gate(goal, proposal, scores, units) {
    const auditDraw = this.rng();
    const audited = auditDraw < this.auditRate;
    if (scores.c_t >= CONFIG.gate.tau && !audited) return { accepted: true, by: 'auto', auditDraw };
    const t0 = Date.now();
    const verdict = await this.reviewer({
      goal,
      step: proposal,
      scores: { c_act: scores.c_act, c_loc: scores.c_loc, c_orc: scores.c_orc, c_t: scores.c_t, tau: CONFIG.gate.tau },
      evidence: units.map((u) => `${u.metadata.unitId}: ${u.pageContent.split('\n')[0]}`),
    });
    const reviewMs = Date.now() - t0; // waktu keputusan reviewer (RQ5); untuk stub mendekati 0
    this.reviewerVerdicts.push({ goal, proposal, scores: { c_act: scores.c_act, c_loc: scores.c_loc, c_orc: scores.c_orc, c_t: scores.c_t }, audited, verdict, reviewerKind: this.reviewerKind, reviewMs, at: new Date().toISOString() });
    return { accepted: verdict.decision !== 'reject', by: audited ? 'audit' : 'reviewer', verdict, auditDraw, reviewMs };
  }

  /**
   * Eksekusi satu langkah. Untuk click/fill/expectVisible dengan kandidat locator (dari score()),
   * coba kandidat #1; bila gagal, coba #2 lalu #3 dan catat sebagai repair (Bagian 3 naskah).
   * @param {import('./compiler').Step} step @param {Array<{kind:string,locator:import('playwright').Locator}>} [candidates]
   */
  async execute(step, candidates = []) {
    if (!this.page) throw new Error('Panggil init() dulu.');
    if (step.type === 'goto') {
      await this.page.goto(step.path);
    } else if (step.type === 'expectURL') {
      if (!new RegExp(step.pattern).test(this.page.url())) throw new Error(`URL ${this.page.url()} tidak cocok ${step.pattern}`);
    } else if (step.type === 'expectTitle') {
      const title = await this.page.title();
      if (!title.includes(step.value)) throw new Error(`Judul "${title}" tidak memuat "${step.value}"`);
    } else {
      const locators = candidates.length ? candidates.map((c) => c.locator) : [locate(this.page, /** @type {any} */ (step.target))];
      let lastErr;
      for (let i = 0; i < locators.length; i += 1) {
        try {
          if (step.type === 'click') await locators[i].click({ timeout: 5000 });
          else if (step.type === 'hover') await locators[i].hover({ timeout: 5000 });
          else if (step.type === 'fill') await locators[i].fill(step.value, { timeout: 5000 });
          else if (step.type === 'expectVisible') await locators[i].waitFor({ state: 'visible', timeout: 5000 });
          else if (step.type === 'expectAttribute') {
            const val = await locators[i].getAttribute(step.attribute, { timeout: 5000 });
            if (val === null || !val.includes(step.value)) throw new Error(`Atribut ${step.attribute}="${val}" tidak memuat "${step.value}"`);
          }
          if (i > 0) this.repairs.push({ step, fromKind: candidates[0]?.kind, toKind: candidates[i]?.kind, attempt: i });
          if (['click', 'hover', 'fill'].includes(step.type) && step.target) this.memory.record(step.target.role, step.target.name);
          lastErr = undefined;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (lastErr) throw lastErr;
    }
    this.trace.push(step);
  }

  /** @param {z.infer<typeof StepProposal>} p @returns {import('./compiler').Step} */
  static toStep(p) {
    const target = p.role && p.name ? { role: p.role, name: p.name } : null;
    switch (p.type) {
      case 'goto': return { type: 'goto', path: p.path || '/' };
      case 'expectURL': return { type: 'expectURL', pattern: p.pattern || '.*' };
      case 'expectTitle': return { type: 'expectTitle', value: p.value || '' };
      case 'fill': if (!target) throw new Error('fill tanpa target'); return { type: 'fill', target, value: p.value || '' };
      case 'expectAttribute':
        if (!target) throw new Error('expectAttribute tanpa target');
        if (!p.attribute) throw new Error('expectAttribute tanpa nama atribut');
        return { type: 'expectAttribute', target, attribute: p.attribute, value: p.value || '' };
      default: if (!target) throw new Error(`${p.type} tanpa target`); return { type: p.type, target };
    }
  }

  /**
   * Loop skenario penuh: usul -> skor -> gate -> eksekusi -> ulang sampai done atau budget habis.
   * `startPath`, bila diisi, dieksekusi lebih dulu secara deterministik (bukan usulan LLM). Ditemukan
   * lewat pengujian langsung: dari halaman kosong (about:blank), Qwen3 4B cenderung mengarang elemen
   * alih-alih mengusulkan goto lebih dulu -- lihat RAQA.md bagian temuan.
   * @param {{ id: string, goal: string, startPath?: string }} scenario @param {number} [maxSteps]
   */
  async runScenario(scenario, maxSteps = 10) {
    // verdict: PASS (agen menyatakan selesai), FAIL (sebuah assertion GAGAL dieksekusi -- bisa berarti
    // agen menemukan cacat nyata), INCOMPLETE (berhenti karena alasan lain). Dibedakan agar skenario
    // yang memang menguji bug nyata (jawaban benar = FAIL) tidak salah dihitung sebagai kegagalan agen.
    const log = { id: scenario.id, goal: scenario.goal, steps: [], done: false, error: null, verdict: 'INCOMPLETE', failedStep: null };
    if (scenario.startPath) {
      const step = { type: 'goto', path: scenario.startPath };
      await this.execute(step);
      log.steps.push({ proposal: { type: 'goto', path: scenario.startPath, done: false }, scores: null, gate: 'fixed-start', accepted: true, hallucinated: false });
    }
    /** Sidik jari langkah sebelumnya, untuk mendeteksi pengulangan persis (lihat catatan di bawah). */
    let lastFingerprint = null;
    for (let i = 0; i < maxSteps; i += 1) {
      let proposal, units, scores, gateResult, obs, screenshot = null;
      try {
        ({ proposal, units, obs } = await this.proposeStep(scenario.goal));
        if (this.screenshotDir && this.page) {
          fs.mkdirSync(this.screenshotDir, { recursive: true });
          screenshot = path.join(this.screenshotDir, `${scenario.id}-step${i + 1}.png`);
          await this.page.screenshot({ path: screenshot, fullPage: false });
        }
        scores = await this.score(proposal, units);
        gateResult = await this.gate(scenario.goal, proposal, scores, units);
      } catch (e) {
        log.error = `propose/score/gate: ${/** @type {Error} */ (e).message}`;
        break;
      }
      log.steps.push({
        proposal, scores: { c_act: scores.c_act, c_loc: scores.c_loc, c_orc: scores.c_orc, c_t: scores.c_t },
        gate: gateResult.by, accepted: gateResult.accepted, hallucinated: scores.hallucinated,
        decision: gateResult.verdict?.decision ?? null, reviewMs: gateResult.reviewMs ?? null,
        url: obs?.url ?? null, title: obs?.title ?? null, screenshot,
        citedUnitsText: units.filter((u) => proposal.citedUnits.includes(u.metadata.unitId)).map((u) => ({ id: u.metadata.unitId, text: u.pageContent })),
      });
      if (!gateResult.accepted) { log.error = `ditolak reviewer pada langkah ${i + 1}`; break; }
      // Qwen3 4B kadang tidak pernah menyetel done=true dan mengusulkan assertion yang SAMA berulang
      // (diverifikasi lewat pengujian langsung, lihat RAQA.md). Assertion itu sudah TERBUKTI berhasil
      // pada eksekusi sebelumnya (kalau tidak, loop sudah berhenti lewat cabang error di bawah) --
      // mengulanginya tidak menambah informasi, jadi diperlakukan sebagai sinyal "goal tercapai".
      const fingerprint = JSON.stringify([proposal.type, proposal.role, proposal.name, proposal.attribute, proposal.value]);
      if (i > 0 && fingerprint === lastFingerprint) { log.done = true; log.steps[log.steps.length - 1].note = 'auto-done: pengulangan step identik'; break; }
      lastFingerprint = fingerprint;
      if (proposal.done) { log.done = true; break; }
      try {
        const step = gateResult.by !== 'auto' && gateResult.verdict?.decision === 'correct' && gateResult.verdict.correction
          ? JSON.parse(gateResult.verdict.correction)
          : RAQAAgent.toStep(proposal);
        await this.execute(step, scores.candidates);
      } catch (e) {
        log.error = `eksekusi langkah ${i + 1}: ${/** @type {Error} */ (e).message}`;
        if (['expectVisible', 'expectURL', 'expectTitle', 'expectAttribute'].includes(proposal.type)) {
          log.verdict = 'FAIL';
          log.failedStep = log.steps.length; // indeks 1-based pada log.steps (termasuk fixed-start)
          log.steps[log.steps.length - 1].executionFailed = true;
        }
        break;
      }
    }
    if (log.done) log.verdict = 'PASS';
    if (!log.done && !log.error) log.error = `budget ${maxSteps} langkah habis tanpa done=true`;
    return log;
  }

  /** @param {string} scenarioId @param {string} title @param {string} [outDir] */
  compile(scenarioId, title, outDir) {
    return compileRun({ scenarioId, title, steps: this.trace }, outDir);
  }

  /** Tulis balik memori locator dan verdict reviewer sesi ini (Bagian RQ5: memori bersama yang tumbuh). */
  persist() {
    if (!this.persistMemory) return;
    this.memory.save();
    if (this.reviewerVerdicts.length) {
      const file = path.join(this.memoryDir, 'reviewer-verdicts.jsonl');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, this.reviewerVerdicts.map((v) => JSON.stringify(v)).join('\n') + '\n');
    }
  }

  async close() {
    this.persist();
    await this.browser?.close();
  }
}

module.exports = { RAQAAgent, StepProposal };
