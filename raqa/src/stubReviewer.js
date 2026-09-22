// @ts-check
// Pengganti reviewer manusia untuk run eksperimen TANPA PENGAWASAN (mis. lewat SSH/CI, bukan terminal interaktif).
// PENTING: ini BUKAN data ulasan manusia. Fungsinya hanya memvalidasi bahwa mekanisme gate/eskalasi berjalan
// benar ketika c_t < tau. Setiap keputusan human.js (askReviewer) yang sungguhan tetap tersedia dan dipakai
// bila stub ini tidak diberikan (lihat scripts/run-scenarios.js). Jangan laporkan output stub ini sebagai RQ5.
const { CONFIG } = require('./config');

/**
 * Terima otomatis bila c_t masih dekat ambang (selisih < 0.2); selain itu tolak dengan alasan eksplisit.
 * Setiap panggilan dicatat lewat onEscalation (untuk dilaporkan sebagai "N eskalasi ditangani stub, bukan manusia").
 * @param {(ctx: object) => void} [onEscalation]
 */
function makeStubReviewer(onEscalation) {
  /** @param {{ goal: string, step: object, scores: Record<string, number|null> }} ctx */
  return async (ctx) => {
    onEscalation?.(ctx);
    const near = ctx.scores.tau !== null && typeof ctx.scores.c_t === 'number' && ctx.scores.c_t >= /** @type {number} */ (ctx.scores.tau) - 0.2;
    return near
      ? { decision: 'accept' }
      : { decision: 'reject', comment: `stub non-interaktif: c_t=${ctx.scores.c_t} jauh di bawah tau=${CONFIG.gate.tau}` };
  };
}

module.exports = { makeStubReviewer };
