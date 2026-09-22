// @ts-check
const readline = require('readline/promises');

/**
 * Minta keputusan reviewer lewat terminal. Reviewer melihat goal, langkah yang diusulkan, skor, dan bukti.
 * @param {{ goal: string, step: object, scores: Record<string, number|null>, evidence: string[], screenshot?: string }} ctx
 * @returns {Promise<{ decision: 'accept'|'correct'|'reject', correction?: string, comment?: string }>}
 */
async function askReviewer(ctx) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('\n================ RAQA butuh keputusan reviewer ================');
    console.log(`Goal      : ${ctx.goal}`);
    console.log(`Langkah   : ${JSON.stringify(ctx.step)}`);
    console.log(`Skor      : ${JSON.stringify(ctx.scores)}`);
    if (ctx.screenshot) console.log(`Screenshot: ${ctx.screenshot}`);
    console.log('Bukti yang diambil:');
    for (const e of ctx.evidence) console.log(`  - ${e}`);
    for (;;) {
      const answer = (await rl.question('[a]ccept / [c]orrect / [r]eject ? ')).trim().toLowerCase();
      if (answer === 'a') return { decision: 'accept' };
      if (answer === 'r') return { decision: 'reject', comment: (await rl.question('Alasan: ')).trim() };
      if (answer === 'c') {
        const correction = (await rl.question('Koreksi (JSON langkah, mis. {"type":"click","target":{"role":"link","name":"..."}}): ')).trim();
        return { decision: 'correct', correction };
      }
    }
  } finally {
    rl.close();
  }
}

module.exports = { askReviewer };
