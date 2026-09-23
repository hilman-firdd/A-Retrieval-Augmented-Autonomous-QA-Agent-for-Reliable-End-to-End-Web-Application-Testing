// Statistik untuk analisis HITL dan ablasi. Setiap fungsi diverifikasi terhadap implementasi rujukan
// (statsmodels, scipy, paket `krippendorff`) oleh scripts/verify-stats.py -- lihat README eksperimen.

/** PRNG deterministik untuk bootstrap. @param {number} seed */
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

/** Cohen's kappa untuk dua penilai, kategori nominal. @param {any[]} a @param {any[]} b */
function cohenKappa(a, b) {
  if (a.length !== b.length || !a.length) throw new Error('cohenKappa: panjang tidak sama/kosong');
  const cats = [...new Set([...a, ...b])];
  const n = a.length;
  const po = a.filter((x, i) => x === b[i]).length / n;
  const pe = cats.reduce((s, c) => s + (a.filter((x) => x === c).length / n) * (b.filter((x) => x === c).length / n), 0);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

/**
 * Fleiss' kappa. @param {number[][]} counts matriks N unit x k kategori; setiap baris berjumlah n penilai.
 */
function fleissKappa(counts) {
  const N = counts.length;
  const n = counts[0].reduce((s, x) => s + x, 0);
  if (counts.some((r) => r.reduce((s, x) => s + x, 0) !== n)) throw new Error('fleissKappa: jumlah penilai per unit harus sama');
  const k = counts[0].length;
  const pj = Array.from({ length: k }, (_, j) => counts.reduce((s, r) => s + r[j], 0) / (N * n));
  const Pi = counts.map((r) => (r.reduce((s, x) => s + x * x, 0) - n) / (n * (n - 1)));
  const Pbar = Pi.reduce((s, x) => s + x, 0) / N;
  const Pe = pj.reduce((s, x) => s + x * x, 0);
  return Pe === 1 ? 1 : (Pbar - Pe) / (1 - Pe);
}

/** Ubah label mentah (penilai x unit) menjadi matriks hitungan Fleiss. @param {any[][]} ratings @param {any[]} categories */
function toFleissCounts(ratings, categories) {
  const units = ratings[0].length;
  return Array.from({ length: units }, (_, u) => categories.map((c) => ratings.filter((r) => r[u] === c).length));
}

/**
 * Krippendorff's alpha. @param {(number|null)[][]} data penilai x unit (null = tidak dinilai)
 * @param {'nominal'|'ordinal'|'interval'} level
 */
function krippendorffAlpha(data, level = 'nominal') {
  const units = data[0].length;
  const values = [...new Set(data.flat().filter((v) => v !== null && v !== undefined))].sort((x, y) => x - y);
  const idx = new Map(values.map((v, i) => [v, i]));
  const V = values.length;
  const o = Array.from({ length: V }, () => new Array(V).fill(0)); // matriks koinsidensi
  for (let u = 0; u < units; u += 1) {
    const vals = data.map((r) => r[u]).filter((v) => v !== null && v !== undefined);
    const m = vals.length;
    if (m < 2) continue;
    for (let i = 0; i < m; i += 1) for (let j = 0; j < m; j += 1) if (i !== j) o[idx.get(vals[i])][idx.get(vals[j])] += 1 / (m - 1);
  }
  const nc = o.map((r) => r.reduce((s, x) => s + x, 0));
  const n = nc.reduce((s, x) => s + x, 0);
  const delta = (c, k) => {
    if (level === 'nominal') return c === k ? 0 : 1;
    if (level === 'interval') return (values[c] - values[k]) ** 2;
    const [lo, hi] = c < k ? [c, k] : [k, c]; // ordinal
    let s = 0;
    for (let g = lo; g <= hi; g += 1) s += nc[g];
    return (s - (nc[c] + nc[k]) / 2) ** 2;
  };
  let Do = 0; let De = 0;
  for (let c = 0; c < V; c += 1) for (let k = 0; k < V; k += 1) {
    Do += o[c][k] * delta(c, k);
    De += nc[c] * nc[k] * delta(c, k);
  }
  Do /= n; De /= n * (n - 1);
  return De === 0 ? 1 : 1 - Do / De;
}

/** log n! yang stabil. */
const logFact = (() => { const c = [0]; return (n) => { for (let i = c.length; i <= n; i += 1) c[i] = c[i - 1] + Math.log(i); return c[n]; }; })();
const binomPmf = (k, n, p) => Math.exp(logFact(n) - logFact(k) - logFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p));

/** Uji binomial eksak dua sisi (metode scipy: jumlahkan peluang <= peluang teramati). */
function binomTestTwoSided(k, n, p = 0.5) {
  if (n === 0) return 1;
  const pk = binomPmf(k, n, p);
  let s = 0;
  for (let i = 0; i <= n; i += 1) { const pi = binomPmf(i, n, p); if (pi <= pk * (1 + 1e-7)) s += pi; }
  return Math.min(1, s);
}

/** McNemar eksak untuk data biner berpasangan. b = hanya A sukses, c = hanya B sukses. */
function mcnemarExact(b, c) {
  return binomTestTwoSided(Math.min(b, c), b + c, 0.5);
}

/**
 * Wilcoxon signed-rank eksak dua sisi (selisih nol dibuang, ties = rank rata-rata; distribusi eksak
 * dihitung dengan enumerasi tanda, tepat untuk n <= 20). @param {number[]} diffs
 */
function wilcoxonExact(diffs) {
  const d = diffs.filter((x) => x !== 0);
  const n = d.length;
  if (n === 0) return { W: 0, p: 1, n };
  if (n > 20) throw new Error('wilcoxonExact: n > 20, gunakan aproksimasi normal');
  const abs = d.map((x, i) => ({ v: Math.abs(x), i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(n);
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && abs[j + 1].v === abs[i].v) j += 1;
    for (let t = i; t <= j; t += 1) ranks[abs[t].i] = (i + j + 2) / 2;
    i = j + 1;
  }
  const Wplus = d.reduce((s, x, i) => s + (x > 0 ? ranks[i] : 0), 0);
  const total = ranks.reduce((s, x) => s + x, 0);
  const obs = Math.min(Wplus, total - Wplus);
  let count = 0;
  for (let mask = 0; mask < (1 << n); mask += 1) {
    let w = 0;
    for (let i = 0; i < n; i += 1) if (mask & (1 << i)) w += ranks[i];
    if (Math.min(w, total - w) <= obs + 1e-9) count += 1;
  }
  return { W: Wplus, p: Math.min(1, count / (1 << n)), n };
}

/**
 * Wilcoxon signed-rank, aproksimasi normal dengan koreksi ties, tanpa koreksi kontinuitas
 * (setara scipy.stats.wilcoxon(method='approx', correction=False)). Untuk n > 20. @param {number[]} diffs
 */
function wilcoxonNormal(diffs) {
  const d = diffs.filter((x) => x !== 0);
  const n = d.length;
  if (n === 0) return { W: 0, p: 1, n, z: 0 };
  const abs = d.map((x, i) => ({ v: Math.abs(x), i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(n);
  let tieTerm = 0;
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && abs[j + 1].v === abs[i].v) j += 1;
    const t = j - i + 1;
    tieTerm += t * t * t - t;
    for (let q = i; q <= j; q += 1) ranks[abs[q].i] = (i + j + 2) / 2;
    i = j + 1;
  }
  const Wplus = d.reduce((s, x, i) => s + (x > 0 ? ranks[i] : 0), 0);
  const Wminus = n * (n + 1) / 2 - Wplus;
  const T = Math.min(Wplus, Wminus);
  const mean = n * (n + 1) / 4;
  const sd = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - tieTerm / 48);
  const z = (T - mean) / sd;
  return { W: Wplus, p: Math.min(1, 2 * normCdf(-Math.abs(z))), n, z };
}

/** CDF normal baku lewat erfc Chebyshev (Numerical Recipes "erfcc"), galat relatif < 1.2e-7. */
function normCdf(x) {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  const cdfAbs = 1 - r / 2;
  return x >= 0 ? cdfAbs : 1 - cdfAbs;
}

/** Wilcoxon: eksak bila n tak-nol <= 20, selain itu aproksimasi normal. */
function wilcoxon(diffs) {
  const nz = diffs.filter((x) => x !== 0).length;
  return nz <= 20 ? { ...wilcoxonExact(diffs), method: 'exact' } : { ...wilcoxonNormal(diffs), method: 'normal' };
}

/** Koreksi Holm untuk perbandingan ganda. Mengembalikan p yang disesuaikan, urutan sama dengan input. */
function holm(pvals) {
  const m = pvals.length;
  const order = pvals.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const adj = new Array(m);
  let running = 0;
  order.forEach(({ p, i }, r) => { running = Math.max(running, Math.min(1, (m - r) * p)); adj[i] = running; });
  return adj;
}

/** Interval kepercayaan Wilson untuk proporsi. */
function wilson(x, n, z = 1.959963984540054) {
  if (n === 0) return [0, 1];
  const p = x / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - r) / d), Math.min(1, (c + r) / d)];
}

/**
 * Cluster bootstrap (resample skenario, bukan langkah -- langkah dalam satu skenario tidak independen).
 * @param {any[]} clusters @param {(sample: any[]) => number} stat @returns {[number, number]} CI persentil
 */
function clusterBootstrapCI(clusters, stat, { B = 5000, seed = 1, alpha = 0.05 } = {}) {
  const rng = mulberry32(seed);
  const vals = [];
  for (let b = 0; b < B; b += 1) {
    const s = Array.from({ length: clusters.length }, () => clusters[Math.floor(rng() * clusters.length)]);
    const v = stat(s);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((x, y) => x - y);
  const q = (p) => vals[Math.min(vals.length - 1, Math.max(0, Math.floor(p * vals.length)))];
  return [q(alpha / 2), q(1 - alpha / 2)];
}

module.exports = { mulberry32, cohenKappa, fleissKappa, toFleissCounts, krippendorffAlpha, binomTestTwoSided, mcnemarExact, wilcoxonExact, wilcoxonNormal, wilcoxon, normCdf, holm, wilson, clusterBootstrapCI };
