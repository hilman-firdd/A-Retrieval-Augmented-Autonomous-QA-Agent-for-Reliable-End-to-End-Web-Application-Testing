// @ts-check
// Kompilasi run yang sudah diverifikasi menjadi spec @playwright/test deterministik (tanpa LLM saat dijalankan).
// Spec memakai fixture implicit oracle milik B1 (src/fixtures.js) agar FR/FDR diukur dengan harness yang sama.
const fs = require('fs');
const path = require('path');
const { CONFIG } = require('./config');
const { namePatternSource } = require('./page');

/**
 * @typedef {{ role: string, name: string, nth?: number }} Target
 * @typedef {{ type: 'goto', path: string }
 *   | { type: 'click', target: Target }
 *   | { type: 'hover', target: Target }
 *   | { type: 'fill', target: Target, value: string }
 *   | { type: 'expectVisible', target: Target }
 *   | { type: 'expectURL', pattern: string }
 *   | { type: 'expectTitle', value: string }
 *   | { type: 'expectAttribute', target: Target, attribute: string, value: string }} Step
 */

/** @param {string} s */
function escapeForRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @param {Target} t */
function locatorCode(t) {
  const base = `page.getByRole(${JSON.stringify(t.role)}, { name: new RegExp(${JSON.stringify(namePatternSource(t.name))}) })`;
  return t.nth === undefined ? base : `${base}.nth(${t.nth})`;
}

/** @param {Step} s */
function stepCode(s) {
  switch (s.type) {
    case 'goto': return `await page.goto(${JSON.stringify(s.path)});`;
    case 'click': return `await ${locatorCode(s.target)}.click();`;
    case 'hover': return `await ${locatorCode(s.target)}.hover();`;
    case 'fill': return `await ${locatorCode(s.target)}.fill(${JSON.stringify(s.value)});`;
    case 'expectVisible': return `await expect(${locatorCode(s.target)}).toBeVisible();`;
    case 'expectURL': return `await expect(page).toHaveURL(new RegExp(${JSON.stringify(s.pattern)}));`;
    case 'expectTitle': return `await expect(page).toHaveTitle(new RegExp(${JSON.stringify(escapeForRegExp(s.value))}));`;
    case 'expectAttribute': return `await expect(${locatorCode(s.target)}).toHaveAttribute(${JSON.stringify(s.attribute)}, new RegExp(${JSON.stringify(escapeForRegExp(s.value))}));`;
    default: throw new Error(`Tipe langkah tidak dikenal: ${JSON.stringify(s)}`);
  }
}

/**
 * @param {{ scenarioId: string, title: string, tags?: string[], steps: Step[] }} run
 * @param {string} [outDir]
 */
function compileRun(run, outDir = CONFIG.paths.compiledDir) {
  if (!/^S-[A-Z]+-\d+$/.test(run.scenarioId)) throw new Error(`scenarioId tidak valid: ${run.scenarioId}`);
  // Relatif ke outDir SEBENARNYA (tempat berkas ini ditulis). Memindahkan berkas hasil kompilasi ke folder
  // lain akan merusak jalur require ini -- itu wajar untuk require relatif, bukan cacat compiler ini.
  const fixtures = path.relative(outDir, path.join(CONFIG.paths.e2eRoot, 'src', 'fixtures')).split(path.sep).join('/');
  const tags = JSON.stringify(run.tags && run.tags.length ? run.tags : ['@raqa']);
  const body = run.steps.map((s) => `    ${stepCode(s)}`).join('\n');
  const code = `// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require(${JSON.stringify(fixtures)});

test(${JSON.stringify(`${run.scenarioId} ${run.title}`)}, { tag: ${tags} }, async ({ page }) => {
${body}
});
`;
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${run.scenarioId}.spec.js`);
  fs.writeFileSync(file, code);
  return file;
}

module.exports = { compileRun };
